"""sources/github.py 单测（T1.1）：查询拼装、归一化、降级语义。

不依赖网络与 API key：用 monkeypatch 模拟 httpx 响应/异常。
"""

from __future__ import annotations

import httpx
import pytest

from evopm.sources import github
from evopm.sources.github import GithubUnavailable, fetch_issues


class _FakeResp:
    def __init__(self, status_code: int, payload: dict | None = None, text: str = ""):
        self.status_code = status_code
        self._payload = payload
        self.text = text

    def json(self):
        if self._payload is None:
            raise ValueError("no json")
        return self._payload


def test_build_query_limits_repo_and_type():
    q = github._build_query("infiniflow/ragflow", ["parsing", "upload failed"])
    assert q.startswith("repo:infiniflow/ragflow type:issue")
    assert '"parsing"' in q and '"upload failed"' in q
    assert " OR " in q


def test_normalize_is_isomorphic_to_mock_schema():
    item = {
        "number": 13678,
        "title": "[Bug]: parsing failed",
        "body": "details",
        "labels": [{"name": "bug"}, {"name": "p1"}],
        "state": "open",
        "created_at": "2026-04-18T08:12:00Z",
        "html_url": "https://github.com/infiniflow/ragflow/issues/13678",
    }
    out = github._normalize(item)
    assert set(out) == {
        "number",
        "title",
        "body",
        "labels",
        "state",
        "created_at",
        "html_url",
    }
    assert out["labels"] == ["bug", "p1"]
    assert out["number"] == 13678


def test_fetch_issues_success_returns_normalized(monkeypatch):
    payload = {
        "items": [
            {
                "number": 1,
                "title": "t",
                "body": "b",
                "labels": ["bug"],
                "state": "open",
                "created_at": "2026-01-01T00:00:00Z",
                "html_url": "https://example/1",
            }
        ]
    }
    monkeypatch.setattr(
        github.httpx, "get", lambda *a, **k: _FakeResp(200, payload)
    )
    out = fetch_issues("infiniflow/ragflow", ["parsing"], limit=10)
    assert len(out) == 1
    assert out[0]["html_url"] == "https://example/1"
    assert out[0]["labels"] == ["bug"]


def test_fetch_issues_respects_limit(monkeypatch):
    payload = {"items": [{"number": i, "html_url": f"u{i}"} for i in range(20)]}
    monkeypatch.setattr(github.httpx, "get", lambda *a, **k: _FakeResp(200, payload))
    out = fetch_issues("r/r", ["x"], limit=5)
    assert len(out) == 5


def test_fetch_issues_raises_on_429(monkeypatch):
    monkeypatch.setattr(
        github.httpx, "get", lambda *a, **k: _FakeResp(429, None, "rate limited")
    )
    with pytest.raises(GithubUnavailable):
        fetch_issues("r/r", ["x"])


def test_fetch_issues_raises_on_network_error(monkeypatch):
    def _boom(*a, **k):
        raise httpx.ConnectError("offline")

    monkeypatch.setattr(github.httpx, "get", _boom)
    with pytest.raises(GithubUnavailable):
        fetch_issues("r/r", ["x"])


def test_token_auth_header_set_when_env_present(monkeypatch):
    captured = {}

    def _capture(url, params=None, headers=None, timeout=None):
        captured["headers"] = headers
        return _FakeResp(200, {"items": []})

    monkeypatch.setenv("GITHUB_TOKEN", "tok123")
    monkeypatch.setattr(github.httpx, "get", _capture)
    fetch_issues("r/r", ["x"])
    assert captured["headers"]["Authorization"] == "Bearer tok123"

"""GitHub issues 拉取（spec §7 / §11.2）。

``fetch_issues`` 走 GitHub Search API（httpx），可选 ``GITHUB_TOKEN`` 认证；
429 / 网络错误 → 抛 ``GithubUnavailable``，由 intake 节点捕获后降级读
``issues_mock.json``。输出 dict 与 ``issues_mock.json`` 条目同构（number/title/
body/labels/state/created_at/html_url），保证降级前后下游处理一致。
"""

from __future__ import annotations

import os

import httpx

GITHUB_SEARCH_URL = "https://api.github.com/search/issues"
REQUEST_TIMEOUT = 20  # 单次请求超时（秒）

# 默认检索关键词（spec §7 / T1.1：上传失败 / 解析 / 检索 / 引用）
DEFAULT_KEYWORDS = ["upload failed", "parsing", "retrieval", "citation"]


class GithubUnavailable(Exception):
    """GitHub API 限流 / 网络错误 / 响应异常（外部数据源，调用方降级 mock）。"""


def _build_query(repo: str, keywords: list[str]) -> str:
    """组装 Search API 的 q 参数：限定 repo + issue 类型 + 关键词 OR。"""
    terms = " OR ".join(f'"{k}"' for k in keywords) if keywords else ""
    base = f"repo:{repo} type:issue"
    return f"{base} {terms}".strip()


def _normalize(item: dict) -> dict:
    """把 Search API 返回项裁剪为与 issues_mock.json 同构的 dict。"""
    return {
        "number": item.get("number"),
        "title": item.get("title", ""),
        "body": item.get("body") or "",
        "labels": [
            lb.get("name", "") if isinstance(lb, dict) else str(lb)
            for lb in (item.get("labels") or [])
        ],
        "state": item.get("state", ""),
        "created_at": item.get("created_at", ""),
        "html_url": item.get("html_url", ""),
    }


def fetch_issues(
    repo: str, keywords: list[str] | None = None, limit: int = 10
) -> list[dict]:
    """拉取 ``repo`` 下匹配 ``keywords`` 的 issues，最多 ``limit`` 条。

    输出 dict 与 ``issues_mock.json`` 条目同构。429 / 网络错误 / 响应异常
    → 抛 ``GithubUnavailable``。
    """
    kws = keywords if keywords is not None else DEFAULT_KEYWORDS
    params = {
        "q": _build_query(repo, kws),
        "per_page": str(min(max(limit, 1), 100)),
        "sort": "created",
        "order": "desc",
    }
    headers = {"Accept": "application/vnd.github+json"}
    token = os.environ.get("GITHUB_TOKEN")
    if token:
        headers["Authorization"] = f"Bearer {token}"

    try:
        resp = httpx.get(
            GITHUB_SEARCH_URL,
            params=params,
            headers=headers,
            timeout=REQUEST_TIMEOUT,
        )
    except httpx.HTTPError as e:  # 网络 / 超时
        raise GithubUnavailable(f"GitHub 请求失败: {e}") from e

    if resp.status_code != 200:  # 403/429 限流或其它 HTTP 错误
        raise GithubUnavailable(
            f"GitHub API 返回 {resp.status_code}: {resp.text[:200]}"
        )

    try:
        items = resp.json().get("items", [])
    except ValueError as e:
        raise GithubUnavailable(f"GitHub 响应非法 JSON: {e}") from e

    return [_normalize(it) for it in items[:limit]]

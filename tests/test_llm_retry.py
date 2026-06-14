"""structured_call 重试 / 缓存 / 预算逻辑单测（T0.3，spec §6 / §11.1）。

不依赖真实 GLM：monkeypatch llm.get_chat 注入可编程的 fake 结构化输出。
"""

from types import SimpleNamespace

import pytest
from pydantic import BaseModel

from evopm import llm


class Tiny(BaseModel):
    value: str


class FakeStructured:
    def __init__(self, script):
        self.script = list(script)
        self.calls = 0
        self.last_messages = None

    def invoke(self, messages):
        self.calls += 1
        self.last_messages = messages
        item = self.script.pop(0)
        if isinstance(item, Exception):
            raise item
        return item


class FakeChat:
    def __init__(self, structured):
        self._s = structured

    def with_structured_output(self, schema, method, include_raw):
        assert method == "function_calling"  # spec：禁止 json_schema
        assert include_raw is True
        return self._s


@pytest.fixture(autouse=True)
def _isolate(monkeypatch, tmp_path):
    monkeypatch.setattr(llm, "_BACKOFF_DELAYS", (0, 0, 0))
    monkeypatch.setattr(llm, "CACHE_DIR", tmp_path / "cache")
    llm.reset_budget()
    llm.set_run_mode("mock")
    yield


def _install(monkeypatch, script):
    fake = FakeStructured(script)
    monkeypatch.setattr(llm, "get_chat", lambda model=None, temperature=0.1: FakeChat(fake))
    return fake


def _ok(value="hi"):
    return {"parsed": Tiny(value=value), "parsing_error": None, "raw": SimpleNamespace(content="")}


def _bad(err="schema mismatch", content="not json"):
    return {"parsed": None, "parsing_error": err, "raw": SimpleNamespace(content=content)}


def test_network_errors_retry_then_succeed(monkeypatch):
    fake = _install(monkeypatch, [RuntimeError("429"), RuntimeError("timeout"), _ok("ok")])
    out = llm.structured_call(Tiny, "sys", "user", use_cache=False)
    assert out.value == "ok"
    assert fake.calls == 3


def test_validation_failure_retries_once_with_feedback(monkeypatch):
    fake = _install(monkeypatch, [_bad(), _ok("recovered")])
    out = llm.structured_call(Tiny, "sys", "user", use_cache=False)
    assert out.value == "recovered"
    assert fake.calls == 2
    # 第二次调用的 user 消息应被附加错误反馈
    user_msg = fake.last_messages[1][1]
    assert "无法解析" in user_msg


def test_validation_failure_exhausted_raises(monkeypatch):
    _install(monkeypatch, [_bad(), _bad()])
    with pytest.raises(llm.LLMCallFailed):
        llm.structured_call(Tiny, "sys", "user", use_cache=False)


def test_cache_hit_skips_second_call(monkeypatch):
    fake = _install(monkeypatch, [_ok("cached")])
    a = llm.structured_call(Tiny, "sys", "user", use_cache=True)
    b = llm.structured_call(Tiny, "sys", "user", use_cache=True)
    assert a.value == b.value == "cached"
    assert fake.calls == 1  # 第二次命中缓存，不再真实调用


def test_replay_miss_raises(monkeypatch):
    _install(monkeypatch, [_ok()])
    llm.set_run_mode("replay")
    with pytest.raises(llm.LLMCallFailed):
        llm.structured_call(Tiny, "sys", "fresh-user", use_cache=True)


def test_budget_exceeded(monkeypatch):
    _install(monkeypatch, [_ok(f"v{i}") for i in range(llm.BUDGET_LIMIT + 1)])
    for i in range(llm.BUDGET_LIMIT):
        llm.structured_call(Tiny, "sys", f"user-{i}", use_cache=False)
    with pytest.raises(llm.LLMBudgetExceeded):
        llm.structured_call(Tiny, "sys", "user-over", use_cache=False)


def test_real_failure_falls_back_to_cache(monkeypatch, tmp_path):
    # 真实调用穷尽重试仍失败（mock/live）→ 从缓存目录找同 schema 样本兜底，链路不崩。
    cache = tmp_path / "cache"
    cache.mkdir(parents=True, exist_ok=True)
    (cache / "x.json").write_text('{"value": "from-cache"}', encoding="utf-8")
    _install(monkeypatch, [RuntimeError("429")] * 4)  # 每次 invoke 都网络失败
    out = llm.structured_call(Tiny, "sys", "user", use_cache=False)
    assert out.value == "from-cache"
    assert llm.get_fallback_used() == 1


def test_no_fallback_sample_still_raises(monkeypatch, tmp_path):
    # 缓存目录无可校验样本时仍抛 LLMCallFailed（不静默返回脏数据）。
    (tmp_path / "cache").mkdir(parents=True, exist_ok=True)
    monkeypatch.setattr(llm, "FALLBACK_CACHE_DIR", tmp_path / "nope")
    _install(monkeypatch, [RuntimeError("429")] * 4)
    with pytest.raises(llm.LLMCallFailed):
        llm.structured_call(Tiny, "sys", "user", use_cache=False)


def test_temperature_zero_rejected():
    # 温度边界在 get_chat 最前面校验，先于 api key 检查
    with pytest.raises(ValueError):
        llm.get_chat(temperature=0)

"""GLM（智谱）封装：结构化调用、磁盘缓存 / replay、重试、预算、web_search（spec §6 / §11）。

设计要点：
- 不维护跨节点对话历史，每次 ``structured_call`` 是一次性 (system, user)。
- 缓存 key = sha256(model+system+user)，落 ``runs/.cache/{key}.json``；replay 模式 miss 直接抛错。
- 模块级预算计数器（缓存命中不计），上限 30；replay 模式 / run_mode 经 ``set_run_mode`` 注入，
  不走 state（structured_call 看不到 state）。
- 失败策略：LLM 结构化调用重试穷尽 → ``LLMCallFailed`` fail-fast；外部数据源（web_search）失败
  → ``WebSearchUnavailable``，由调用方降级 mock。
"""

from __future__ import annotations

import hashlib
import json
import os
import time
from pathlib import Path

import httpx
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from pydantic import BaseModel

load_dotenv()

# --------------------------------------------------------------------------- #
# 常量与异常
# --------------------------------------------------------------------------- #
BASE_URL = "https://open.bigmodel.cn/api/coding/paas/v4/"
DEFAULT_MODEL = "glm-5.1"
REQUEST_TIMEOUT = 120  # 单次结构化请求超时（秒）
WEB_SEARCH_TIMEOUT = 20  # web_search 超时（秒）
BUDGET_LIMIT = 30  # 全局 LLM 真实调用上限
_BACKOFF_DELAYS = (1, 4, 16)  # 429/5xx/网络超时指数退避（测试可 monkeypatch）
CACHE_DIR = Path("runs/.cache")


class LLMCallFailed(Exception):
    """LLM 结构化调用重试穷尽（内部 fail-fast，不静默降级）。"""


class LLMBudgetExceeded(Exception):
    """全局 LLM 真实调用次数超过 BUDGET_LIMIT。"""


class WebSearchUnavailable(Exception):
    """web_search 失败 / 空结果 / 超时（外部数据源，调用方降级 mock）。"""


class SearchResult(BaseModel):
    title: str = ""
    url: str = ""
    snippet: str = ""
    publish_date: str = ""


# --------------------------------------------------------------------------- #
# 模块级状态：预算计数器 + run_mode
# --------------------------------------------------------------------------- #
_budget_used = 0
_run_mode = "mock"  # "live" | "mock" | "replay"，CLI run 入口经 set_run_mode 注入


def reset_budget() -> None:
    """CLI run 入口调用，归零模块级预算计数器。"""
    global _budget_used
    _budget_used = 0


def get_budget_used() -> int:
    """report 节点读取，写入 state.llm_call_count（仅供展示）。"""
    return _budget_used


def set_run_mode(mode: str) -> None:
    """CLI run 入口注入运行模式；replay 时缓存 miss 直接抛错。"""
    global _run_mode
    _run_mode = mode


def get_run_mode() -> str:
    return _run_mode


def _charge_budget() -> None:
    global _budget_used
    _budget_used += 1
    if _budget_used > BUDGET_LIMIT:
        raise LLMBudgetExceeded(
            f"LLM 真实调用超过预算上限 {BUDGET_LIMIT}（当前 {_budget_used}）"
        )


# --------------------------------------------------------------------------- #
# get_chat
# --------------------------------------------------------------------------- #
def get_chat(model: str | None = None, temperature: float = 0.1) -> ChatOpenAI:
    """构造指向 GLM OpenAI 兼容端点的 ChatOpenAI。temperature 必须 ∈ (0,1)。"""
    if not (0 < temperature < 1):
        raise ValueError(f"temperature 必须 ∈ (0,1)，禁止取 0，收到 {temperature}")
    resolved = model or os.environ.get("EVOPM_MODEL") or DEFAULT_MODEL
    api_key = os.environ.get("ZHIPUAI_API_KEY")
    if not api_key:
        raise LLMCallFailed("缺少 ZHIPUAI_API_KEY（仅 replay 模式可离线运行）")
    return ChatOpenAI(
        model=resolved,
        temperature=temperature,
        base_url=BASE_URL,
        api_key=api_key,
        timeout=REQUEST_TIMEOUT,
        max_retries=0,  # 重试统一由 structured_call 控制
    )


# --------------------------------------------------------------------------- #
# 缓存
# --------------------------------------------------------------------------- #
def _resolved_model(model: str | None) -> str:
    return model or os.environ.get("EVOPM_MODEL") or DEFAULT_MODEL


def _cache_key(model: str, system: str, user: str) -> str:
    raw = f"{model}\x00{system}\x00{user}".encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


def _read_cache(key: str, schema: type[BaseModel], mode: str) -> BaseModel | None:
    """命中返回校验后的对象；miss 返回 None。replay 模式下 miss / 损坏直接抛错。"""
    path = CACHE_DIR / f"{key}.json"
    if not path.exists():
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return schema.model_validate(data)
    except (json.JSONDecodeError, ValueError, OSError) as e:
        if mode == "replay":
            raise LLMCallFailed(f"replay 模式缓存损坏: {path} ({e})") from e
        return None  # live：当 miss 处理，重新调用并覆盖


def _write_cache(key: str, obj: BaseModel) -> None:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    path = CACHE_DIR / f"{key}.json"
    path.write_text(
        json.dumps(obj.model_dump(mode="json"), ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


# --------------------------------------------------------------------------- #
# structured_call
# --------------------------------------------------------------------------- #
def _invoke_with_network_retries(structured_llm, messages):
    """429/5xx/网络/超时 → 指数退避 3 次（1s/4s/16s）。"""
    last_exc: Exception | None = None
    for attempt in range(len(_BACKOFF_DELAYS)):
        try:
            return structured_llm.invoke(messages)
        except Exception as e:  # 网络/限流/超时等 transient 失败统一退避重试
            last_exc = e
            if attempt < len(_BACKOFF_DELAYS) - 1:
                time.sleep(_BACKOFF_DELAYS[attempt])
            else:
                raise
    raise last_exc  # 理论不可达


def structured_call(
    schema: type[BaseModel],
    system: str,
    user: str,
    model: str | None = None,
    use_cache: bool = True,
) -> BaseModel:
    """一次性结构化调用 GLM，返回校验后的 schema 实例。

    重试矩阵：transient 失败指数退避 3 次；Pydantic 校验失败 / 无 tool call →
    把错误信息+原始输出附到 user 末尾重试 1 次；穷尽抛 LLMCallFailed。
    """
    resolved = _resolved_model(model)
    mode = _run_mode
    key = _cache_key(resolved, system, user)

    if use_cache or mode == "replay":
        cached = _read_cache(key, schema, mode)
        if cached is not None:
            return cached
        if mode == "replay":
            raise LLMCallFailed(f"replay 模式缓存未命中（{schema.__name__}）: {key}")

    _charge_budget()  # 真实调用计入预算（缓存命中已 return）

    chat = get_chat(model=resolved)
    structured_llm = chat.with_structured_output(
        schema, method="function_calling", include_raw=True
    )

    user_msg = user
    last_err = ""
    for _ in range(2):  # 初次 + 校验失败重试 1 次
        result = _invoke_with_network_retries(
            structured_llm, [("system", system), ("user", user_msg)]
        )
        parsed = result.get("parsed")
        parsing_error = result.get("parsing_error")
        if parsed is not None and parsing_error is None:
            if use_cache:
                _write_cache(key, parsed)
            return parsed
        # 校验失败 / 无 tool call（纯文本）→ 附错误与原始输出重试
        raw = result.get("raw")
        raw_text = getattr(raw, "content", str(raw)) if raw is not None else ""
        last_err = str(parsing_error) if parsing_error else "模型未返回 tool call（纯文本）"
        user_msg = (
            f"{user}\n\n[上一轮输出无法解析为目标结构，请严格按工具 schema 重新作答]\n"
            f"错误：{last_err}\n原始输出：{raw_text[:800]}"
        )

    raise LLMCallFailed(
        f"结构化调用穷尽重试仍失败（schema={schema.__name__}）：{last_err}"
    )


# --------------------------------------------------------------------------- #
# web_search（GLM 内置工具，不计入 LLM 预算 —— spec §11.4）
# --------------------------------------------------------------------------- #
def web_search_call(query: str, count: int = 5) -> list[SearchResult]:
    """GLM 内置 web_search（search_pro）。失败/空结果/超时 → WebSearchUnavailable。"""
    api_key = os.environ.get("ZHIPUAI_API_KEY")
    if not api_key:
        raise WebSearchUnavailable("缺少 ZHIPUAI_API_KEY")
    model = os.environ.get("EVOPM_MODEL") or DEFAULT_MODEL
    body = {
        "model": model,
        "messages": [{"role": "user", "content": query}],
        "temperature": 0.1,
        "tools": [
            {
                "type": "web_search",
                "web_search": {
                    "enable": True,
                    "search_engine": "search_pro",
                    "search_result": True,
                    "count": count,
                },
            }
        ],
    }
    try:
        resp = httpx.post(
            f"{BASE_URL}chat/completions",
            headers={"Authorization": f"Bearer {api_key}"},
            json=body,
            timeout=WEB_SEARCH_TIMEOUT,
        )
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:  # 网络/超时/HTTP 错误统一降级信号
        raise WebSearchUnavailable(f"web_search 请求失败: {e}") from e

    # GLM 在 search_result=True 时把检索结果放在顶层 web_search 数组
    raw_results = data.get("web_search") or []
    results = [
        SearchResult(
            title=item.get("title", ""),
            url=item.get("link") or item.get("url", ""),
            snippet=item.get("content") or item.get("snippet", ""),
            publish_date=item.get("publish_date", ""),
        )
        for item in raw_results
        if isinstance(item, dict)
    ]
    if not results:
        raise WebSearchUnavailable("web_search 返回空结果")
    return results

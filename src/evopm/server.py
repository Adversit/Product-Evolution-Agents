"""FastAPI Web 封装：把进程内 LangGraph 暴露为 HTTP/WS 接口。

契约见 ``docs/frontend_api.md``。**Demo 取向：单会话、无鉴权、无并发**——固定
``thread_id="evopm-demo"``，全局单例 :class:`Runner` 在后台线程跑图，事件落进
``events_log``，``/ws`` 轮询转发；REST 端点从 ``graph.get_state`` 取数。

复用 CLI 的驱动逻辑（``cli._drive`` 同款 stream/interrupt 处理）与 ``report.render``
的派生/序列化助手，**不重写业务逻辑**。

运行：``uv run --extra server evopm-server``（或 ``python -m evopm.server``）。
默认 startup 自动跑一次 **replay**（离线、无需 key），让 ``/api/state`` 立即可用。
"""

from __future__ import annotations

import asyncio
import os
import queue
import threading
import time
from pathlib import Path
from typing import Any, Optional

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from evopm import hitl, llm
from evopm.cli import (
    _NODE_AGENT,
    _RUN_CONFIG,
    _extract_interrupt_payload,
    _load_initial_state,
    _summarize_node,
)
from evopm.report import render

# 离线 replay 默认指向提交进仓库的 glm-5.1 缓存（quality 61→86 剧情，无需 key）。
_REPLAY_CACHE = Path("tests/replay_cache_glm51")
_REPLAY_MODEL = "glm-5.1"
# mock/live 的写盘缓存目录（llm 默认 runs/.cache，import 时捕获，避免污染 replay fixture）。
_DEFAULT_CACHE = llm.CACHE_DIR
_REPORT_NAMES = (
    "opportunity_report",
    "engineering_report",
    "prd_draft",
    "executive_summary",
)

# 派生字段（contract §5：避免前端自己 derive；均 json-able）。
_DERIVED_KEYS = (
    "funnel",
    "filtered_signals",
    "duplicate_signals",
    "verdict_groups",
    "tech_by_maturity",
    "impact_by_level",
    "tasks_by_type",
    "roadmap_by_horizon",
    "evidence_cards",
    "quality_first",
    "quality_last",
    "rejected_refs",
    "observations",
)


# --------------------------------------------------------------------------- #
# Runner — 单例，后台线程驱动图
# --------------------------------------------------------------------------- #
class Runner:
    """单会话运行器：start() 起后台线程跑 ``graph.stream``，事件入 events_log。"""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._thread: Optional[threading.Thread] = None
        self._resume_q: "queue.Queue[Any]" = queue.Queue()
        self.graph: Any = None
        self.events_log: list[dict] = []
        self.generation: int = 0  # 每次 start 自增；/ws 据此检测新 run 并从头重放
        self.status: str = "idle"  # idle | running | interrupted | done | error
        self.mode: str = "replay"
        self.interactive: bool = False

    # -- 生命周期 -- #
    def start(
        self,
        mode: str = "replay",
        model: Optional[str] = None,
        data: str = "data/demo_kb",
        interactive: bool = False,
    ) -> None:
        with self._lock:
            if self.status == "running" or self.status == "interrupted":
                return  # 已有运行，忽略（demo 单会话）
            self.mode = mode
            self.interactive = interactive
            self.events_log = []  # 新 run → 新列表
            self.generation += 1  # /ws 检测到 generation 变化即从头重放新 run
            self.status = "running"
            # drain 残留 resume
            while not self._resume_q.empty():
                self._resume_q.get_nowait()

        # LLM 运行配置：归零预算 + 注入 run_mode；replay 指向缓存。
        llm.reset_budget()
        llm.set_run_mode(mode)
        if mode == "replay":
            os.environ["EVOPM_MODEL"] = _REPLAY_MODEL
            llm.CACHE_DIR = _REPLAY_CACHE
        else:
            # mock/live：写盘缓存回默认目录，绝不污染提交进仓库的 replay fixture。
            llm.CACHE_DIR = _DEFAULT_CACHE
            if model:
                os.environ["EVOPM_MODEL"] = model

        self._thread = threading.Thread(
            target=self._run, args=(data, mode, interactive), daemon=True
        )
        self._thread.start()

    def _run(self, data: str, mode: str, interactive: bool) -> None:
        from langgraph.types import Command

        from evopm.graph import build_graph

        try:
            self.graph = build_graph()  # 全新 MemorySaver → 干净 thread_id
            initial = _load_initial_state(data, mode)
            pending: Any = initial
            node_start = time.perf_counter()

            while True:
                interrupted = False
                for chunk in self.graph.stream(pending, config=_RUN_CONFIG):
                    if "__interrupt__" in chunk:
                        payload = _extract_interrupt_payload(chunk["__interrupt__"])
                        self._emit({"event": "interrupt", "payload": payload})
                        if interactive:
                            self.status = "interrupted"
                            value = self._resume_q.get()  # 阻塞等前端
                            self.status = "running"
                        else:
                            value = hitl.auto_resume(payload)
                        pending = Command(resume=value)
                        interrupted = True
                        break

                    for node, value in chunk.items():
                        elapsed = time.perf_counter() - node_start
                        node_start = time.perf_counter()
                        self._emit(
                            {
                                "event": "node",
                                "node": node,
                                "agent": _NODE_AGENT.get(node, "—"),
                                "summary": _summarize_node(node, value),
                                "elapsed": round(elapsed, 1),
                            }
                        )
                if not interrupted:
                    break

            values = self.graph.get_state(_RUN_CONFIG).values
            self._emit(
                {
                    "event": "done",
                    "report_paths": values.get("report_paths", []) or [],
                    "funnel": render._funnel_stats(values),
                }
            )
            self.status = "done"
        except llm.LLMBudgetExceeded as exc:
            self._fail("budget", str(exc))
        except llm.LLMCallFailed as exc:
            self._fail("llm_failed", str(exc))
        except Exception as exc:  # noqa: BLE001 — demo：任何失败都转 error 事件
            self._fail("internal", f"{type(exc).__name__}: {exc}")

    def _emit(self, event: dict) -> None:
        self.events_log.append(event)

    def _fail(self, kind: str, message: str) -> None:
        self._emit({"event": "error", "kind": kind, "message": message})
        self.status = "error"

    def submit_resume(self, value: Any) -> None:
        self._resume_q.put(value)

    def state_values(self) -> Optional[dict]:
        if self.graph is None:
            return None
        try:
            snap = self.graph.get_state(_RUN_CONFIG)
        except Exception:
            return None
        return dict(snap.values) if snap and snap.values else None


RUNNER = Runner()


# --------------------------------------------------------------------------- #
# 序列化助手
# --------------------------------------------------------------------------- #
def _serialize_state(values: dict) -> dict:
    """完整 state（json-able）+ ``derived`` 派生块（contract §5）。"""
    out = {k: render._jsonable(v) for k, v in values.items()}
    ctx = render.build_context(values)
    derived: dict[str, Any] = {}
    for k in _DERIVED_KEYS:
        v = ctx.get(k)
        if isinstance(v, (set, frozenset)):
            v = sorted(v)
        derived[k] = render._jsonable(v)
    out["derived"] = derived
    return out


def _report_path(name: str, values: dict) -> Optional[Path]:
    for p in values.get("report_paths", []) or []:
        if Path(p).stem == name:
            return Path(p)
    return None


# --------------------------------------------------------------------------- #
# FastAPI app
# --------------------------------------------------------------------------- #
app = FastAPI(title="EvoPM Agent API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class RunReq(BaseModel):
    mode: str = "replay"
    model: Optional[str] = None
    data: str = "data/demo_kb"
    interactive: bool = False


@app.on_event("startup")
def _autorun() -> None:
    """默认 startup 自动跑一次 replay（离线），让 /api/state 立即可用。"""
    if os.environ.get("EVOPM_AUTO_RUN", "1") != "0":
        RUNNER.start(mode="replay", interactive=False)


@app.post("/api/run")
def api_run(req: RunReq) -> dict:
    RUNNER.start(req.mode, req.model, req.data, req.interactive)
    return {
        "run_id": "evopm-demo",
        "thread_id": "evopm-demo",
        "mode": req.mode,
        "status": "started",
    }


@app.post("/api/reset")
def api_reset() -> dict:
    if RUNNER.status in ("running", "interrupted"):
        # 运行中不重置：否则会留下孤儿线程，其后续 _emit/status 写入会与新 run 交错。
        return {"status": "busy", "detail": "run in progress; reset ignored"}
    RUNNER.status = "idle"
    RUNNER.events_log = []
    RUNNER.graph = None
    return {"status": "reset"}


@app.get("/api/status")
def api_status() -> dict:
    return {"status": RUNNER.status, "mode": RUNNER.mode, "events": len(RUNNER.events_log)}


@app.get("/api/state")
def api_state() -> dict:
    values = RUNNER.state_values()
    if not values:
        raise HTTPException(status_code=409, detail="no run state yet — POST /api/run first")
    return _serialize_state(values)


@app.get("/api/funnel")
def api_funnel() -> dict:
    values = RUNNER.state_values()
    if not values:
        raise HTTPException(status_code=409, detail="no run state yet")
    return render._funnel_stats(values)


@app.get("/api/reports")
def api_reports() -> dict:
    values = RUNNER.state_values() or {}
    reports = []
    for name in _REPORT_NAMES:
        p = _report_path(name, values)
        if p is not None:
            reports.append({"name": name, "path": str(p)})
    return {"reports": reports}


@app.get("/api/reports/{name}")
def api_report(name: str) -> dict:
    values = RUNNER.state_values() or {}
    p = _report_path(name, values)
    if p is None or not p.exists():
        raise HTTPException(status_code=404, detail=f"report not found: {name}")
    return {"name": name, "markdown": p.read_text(encoding="utf-8")}


@app.get("/api/evidence/{ref_id}")
def api_evidence(ref_id: str) -> dict:
    values = RUNNER.state_values()
    if not values:
        raise HTTPException(status_code=409, detail="no run state yet")
    card = render.evidence_card(ref_id, values)
    if not card:
        raise HTTPException(status_code=404, detail=f"evidence not found: {ref_id}")
    return card


@app.websocket("/ws")
async def ws(websocket: WebSocket) -> None:
    await websocket.accept()

    async def _recv() -> None:
        try:
            while True:
                msg = await websocket.receive_json()
                if isinstance(msg, dict) and msg.get("action") == "resume":
                    RUNNER.submit_resume(msg.get("value"))
        except Exception:
            pass

    recv_task = asyncio.create_task(_recv())
    idx = 0
    gen = RUNNER.generation
    try:
        while True:
            if RUNNER.generation != gen:  # 新 run：从头重放新 events_log（避免漏掉早期节点事件）
                gen = RUNNER.generation
                idx = 0
            log = RUNNER.events_log
            while idx < len(log):
                await websocket.send_json(log[idx])
                idx += 1
            await asyncio.sleep(0.08)
    except WebSocketDisconnect:
        pass
    finally:
        recv_task.cancel()


def main() -> None:
    import uvicorn

    host = os.environ.get("EVOPM_HOST", "127.0.0.1")
    port = int(os.environ.get("EVOPM_PORT", "8000"))
    uvicorn.run(app, host=host, port=port)


if __name__ == "__main__":
    main()

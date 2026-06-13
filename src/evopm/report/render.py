"""报告渲染：state → 4 份 Markdown 报告 + state.json（spec §9）。

职责（纯渲染，无 LLM、无网络）：

1. **证据卡**（``evidence_card`` / ``build_evidence_cards``）：把任一 evidence_ref id
   回查到 ``{excerpt(≤120字), source, strength}``，跨 signals / competitor_findings /
   tech_findings 三个来源域查找（id 前缀 sig-/cf-/tf-）。
2. **``[未确认]`` 规则**：被人工 REJECT 的对象（按 item_ref 匹配）或 critic 标记
   不确定的结论，在渲染时加 ``[未确认]`` 前缀。
3. **观察项降权**：critic findings 中 ``demote_to_observation=True`` 的，
   归入「观察项」section（``observations``）。
4. 渲染全部 4 个模板到 ``runs/<ts>/``，同目录 dump ``state.json``。
"""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any

from jinja2 import Environment, FileSystemLoader, StrictUndefined
from pydantic import BaseModel

from evopm.schemas import (
    CompetitorFinding,
    ReviewAction,
    SignalItem,
    TechFinding,
)
from evopm.state import EvoPMState

_TEMPLATE_DIR = Path(__file__).parent / "templates"

# 4 份报告：模板文件名 → 输出文件名
_REPORTS: dict[str, str] = {
    "opportunity_report.md.j2": "opportunity_report.md",
    "engineering_report.md.j2": "engineering_report.md",
    "prd_draft.md.j2": "prd_draft.md",
    "executive_summary.md.j2": "executive_summary.md",
}

_UNCONFIRMED_PREFIX = "[未确认] "
_EXCERPT_MAX = 120


# --------------------------------------------------------------------------- #
# 证据卡
# --------------------------------------------------------------------------- #
def _truncate(text: str, limit: int = _EXCERPT_MAX) -> str:
    text = (text or "").strip().replace("\n", " ")
    if len(text) <= limit:
        return text
    return text[: limit - 1] + "…"


def evidence_card(ref_id: str, state: EvoPMState) -> dict[str, str]:
    """把单个 evidence_ref id 回查为证据卡 dict。

    跨 signals / competitor_findings / tech_findings 查找。返回
    ``{"ref": id, "excerpt": ≤120字, "source": URL/文件, "strength": 强度}``。
    未找到的 id 返回 strength="unknown" 的占位卡（便于报告暴露悬空引用）。
    """
    signals: list[SignalItem] = state.get("signals", []) or []
    cfs: list[CompetitorFinding] = state.get("competitor_findings", []) or []
    tfs: list[TechFinding] = state.get("tech_findings", []) or []

    for s in signals:
        if s.id == ref_id:
            return {
                "ref": ref_id,
                "excerpt": _truncate(s.text),
                "source": s.origin_url or f"{s.source_type.value}",
                "strength": (s.data_quality.value if s.data_quality else "n/a"),
            }
    for cf in cfs:
        if cf.id == ref_id:
            return {
                "ref": ref_id,
                "excerpt": _truncate(f"[{cf.competitor}] {cf.conclusion}"),
                "source": cf.source_url or "n/a",
                "strength": cf.evidence_strength.value,
            }
    for tf in tfs:
        if tf.id == ref_id:
            return {
                "ref": ref_id,
                "excerpt": _truncate(f"[{tf.solution_name}] {tf.fit_reason}"),
                "source": tf.source_url or "n/a",
                "strength": tf.evidence_strength.value,
            }
    return {"ref": ref_id, "excerpt": "(未找到对应证据)", "source": "n/a", "strength": "unknown"}


def build_evidence_cards(state: EvoPMState) -> list[dict[str, str]]:
    """收集报告中所有出现过的 evidence_ref，去重后回查成证据卡列表（附录用）。

    覆盖：焦点需求/用户故事/验收标准/机会评分的 evidence_refs，以及任务卡的
    evidence_refs。保持首次出现顺序。
    """
    seen: list[str] = []

    def add(refs: list[str] | None) -> None:
        for r in refs or []:
            if r not in seen:
                seen.append(r)

    fc = state.get("focus_candidate")
    if fc is not None:
        add(fc.evidence_refs)
        for us in fc.user_stories:
            add(us.evidence_refs)
        for ac in fc.acceptance_criteria:
            add(ac.evidence_refs)

    opp = state.get("opportunity")
    if opp is not None:
        for sc in opp.scores:
            add(sc.evidence_refs)

    sol = state.get("solution")
    if sol is not None:
        for ac in sol.acceptance_criteria:
            add(ac.evidence_refs)

    execution = state.get("execution")
    if execution is not None:
        for t in execution.tasks:
            add(t.evidence_refs)

    return [evidence_card(r, state) for r in seen]


# --------------------------------------------------------------------------- #
# [未确认] / 观察项 降权规则
# --------------------------------------------------------------------------- #
def _rejected_refs(state: EvoPMState) -> set[str]:
    """人工 REJECT 的 item_ref 集合 → 这些结论加 [未确认] 前缀。"""
    refs: set[str] = set()
    for d in state.get("human_decisions", []) or []:
        if d.action == ReviewAction.REJECT:
            refs.add(d.item_ref)
    return refs


def _demoted_targets(state: EvoPMState) -> list[str]:
    """critic 标记 demote_to_observation 的结论 target 描述（→ 观察项 section）。"""
    cr = state.get("critic_review")
    if cr is None:
        return []
    return [f.target for f in cr.findings if f.demote_to_observation]


def mark_unconfirmed(label: str, ref: str, rejected: set[str]) -> str:
    """若 ref（或 label 本身命中）被人工驳回/未确认，则给 label 加 [未确认] 前缀。"""
    if ref in rejected or label in rejected:
        return _UNCONFIRMED_PREFIX + label
    return label


# --------------------------------------------------------------------------- #
# 模板上下文组装
# --------------------------------------------------------------------------- #
def _verdict_groups(state: EvoPMState) -> dict[str, list[CompetitorFinding]]:
    groups: dict[str, list[CompetitorFinding]] = {"adopt": [], "avoid": [], "watch": []}
    for cf in state.get("competitor_findings", []) or []:
        groups[cf.verdict.value].append(cf)
    return groups


def _tech_by_maturity(state: EvoPMState) -> dict[str, list[TechFinding]]:
    groups: dict[str, list[TechFinding]] = {}
    for tf in state.get("tech_findings", []) or []:
        groups.setdefault(tf.maturity.value, []).append(tf)
    return groups


def _impact_by_level(state: EvoPMState) -> dict[str, list]:
    groups: dict[str, list] = {"certain": [], "possible": [], "uncertain": []}
    ci = state.get("code_impact")
    if ci is None:
        return groups
    for item in ci.items:
        groups[item.impact_level.value].append(item)
    return groups


def _tasks_by_type(state: EvoPMState) -> dict[str, list]:
    groups: dict[str, list] = {}
    execution = state.get("execution")
    if execution is None:
        return groups
    for t in execution.tasks:
        groups.setdefault(t.type.value, []).append(t)
    return groups


def _roadmap_by_horizon(state: EvoPMState) -> dict[str, list]:
    groups: dict[str, list] = {"now": [], "next": [], "later": []}
    for r in state.get("roadmap", []) or []:
        groups.setdefault(r.horizon.value, []).append(r)
    return groups


def _filtered_signals(state: EvoPMState) -> list[SignalItem]:
    """漏斗第一层：被可行动性过滤的信号（emotional/suspected_misuse/insufficient）。"""
    from evopm.schemas import Actionability

    dropped = {
        Actionability.EMOTIONAL,
        Actionability.SUSPECTED_MISUSE,
        Actionability.INSUFFICIENT,
    }
    return [s for s in state.get("signals", []) or [] if s.actionability in dropped]


def _duplicate_signals(state: EvoPMState) -> list[SignalItem]:
    """漏斗第二层：信号查重（duplicate_of 非空）。"""
    return [s for s in state.get("signals", []) or [] if s.duplicate_of]


def _funnel_stats(state: EvoPMState) -> dict[str, int]:
    signals = state.get("signals", []) or []
    clusters = state.get("clusters", []) or []
    filtered = _filtered_signals(state)
    dups = _duplicate_signals(state)
    dup_clusters = [c for c in clusters if c.duplicate_of_existing]
    return {
        "total_signals": len(signals),
        "filtered": len(filtered),
        "duplicates": len(dups),
        "clusters": len(clusters),
        "dup_clusters": len(dup_clusters),
        "focus": 1 if state.get("focus_candidate") else 0,
    }


def build_context(state: EvoPMState) -> dict[str, Any]:
    """state → 全部模板共享的渲染上下文。"""
    rejected = _rejected_refs(state)
    fc = state.get("focus_candidate")

    # 质量评分前后对比（quality_history：初评 → enrich 后）
    quality_first = None
    quality_last = None
    if fc is not None:
        history = list(fc.quality_history)
        if fc.quality is not None and fc.quality not in history:
            history = history + [fc.quality]
        if history:
            quality_first = history[0]
            quality_last = history[-1]

    return {
        "product": state.get("product_context"),
        "run_mode": state.get("run_mode", ""),
        "llm_call_count": state.get("llm_call_count", 0),
        "signals": state.get("signals", []) or [],
        "existing_requirements": state.get("existing_requirements", []) or [],
        "clusters": state.get("clusters", []) or [],
        "selected_cluster_id": state.get("selected_cluster_id", ""),
        "competitor_findings": state.get("competitor_findings", []) or [],
        "tech_findings": state.get("tech_findings", []) or [],
        "focus": fc,
        "opportunity": state.get("opportunity"),
        "roadmap": state.get("roadmap", []) or [],
        "solution": state.get("solution"),
        "code_impact": state.get("code_impact"),
        "execution": state.get("execution"),
        "critic_review": state.get("critic_review"),
        "human_decisions": state.get("human_decisions", []) or [],
        # 派生
        "funnel": _funnel_stats(state),
        "filtered_signals": _filtered_signals(state),
        "duplicate_signals": _duplicate_signals(state),
        "verdict_groups": _verdict_groups(state),
        "tech_by_maturity": _tech_by_maturity(state),
        "impact_by_level": _impact_by_level(state),
        "tasks_by_type": _tasks_by_type(state),
        "roadmap_by_horizon": _roadmap_by_horizon(state),
        "evidence_cards": build_evidence_cards(state),
        "quality_first": quality_first,
        "quality_last": quality_last,
        "rejected_refs": rejected,
        "observations": _demoted_targets(state),
        # 模板里用于回查证据卡 / 标注未确认的辅助函数
        "card": lambda ref: evidence_card(ref, state),
        "unconfirmed": lambda label, ref="": mark_unconfirmed(label, ref, rejected),
    }


# --------------------------------------------------------------------------- #
# state.json dump
# --------------------------------------------------------------------------- #
def _jsonable(obj: Any) -> Any:
    if isinstance(obj, BaseModel):
        return obj.model_dump(mode="json")
    if isinstance(obj, list):
        return [_jsonable(x) for x in obj]
    if isinstance(obj, dict):
        return {k: _jsonable(v) for k, v in obj.items()}
    return obj


def dump_state_json(state: EvoPMState, out_dir: Path) -> Path:
    """把 state 序列化为 state.json（Pydantic 模型转 json-able）。"""
    data = {k: _jsonable(v) for k, v in state.items()}
    path = out_dir / "state.json"
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    return path


# --------------------------------------------------------------------------- #
# 入口
# --------------------------------------------------------------------------- #
def _env() -> Environment:
    return Environment(
        loader=FileSystemLoader(str(_TEMPLATE_DIR)),
        undefined=StrictUndefined,
        trim_blocks=True,
        lstrip_blocks=True,
        keep_trailing_newline=True,
    )


def render_reports(state: EvoPMState, runs_dir: str | Path = "runs") -> list[str]:
    """渲染全部 4 份报告 + state.json 到 runs/<ts>/。

    返回生成的报告文件路径列表（不含 state.json），供写回 state.report_paths。
    """
    ts = datetime.now().strftime("%Y%m%d-%H%M%S")
    out_dir = Path(runs_dir) / ts
    out_dir.mkdir(parents=True, exist_ok=True)

    env = _env()
    ctx = build_context(state)

    paths: list[str] = []
    for template_name, out_name in _REPORTS.items():
        rendered = env.get_template(template_name).render(**ctx)
        out_path = out_dir / out_name
        out_path.write_text(rendered, encoding="utf-8")
        paths.append(str(out_path))

    dump_state_json(state, out_dir)
    return paths

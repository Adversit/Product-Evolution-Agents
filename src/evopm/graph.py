"""LangGraph 组装（WT-7 / T7.1，spec §3.2）。

把 WT-1…6 的 7 个 Agent 接成 14 节点的有向图：每个节点从 state 取**最小上下文切片**
（spec §11.3）注入对应 Agent，调用其方法，做证据闭包校验（``validate_evidence_refs``），
返回 state delta。轮次计数器的 ``+= 1`` 一律在**节点函数体内**完成（spec §3.2 计数所有权）；
四个条件路由函数（route_research_out / route_gate / route_critic / route_review）纯只读。

三个 interrupt（select_cluster / clarify_human / human_review）用 langgraph ``interrupt``
发起，payload / resume 值 schema 见 spec §3.3；human_review 节点据 decisions 设置补证据
重入标志（research_reentry / more_evidence_rounds / _reentry_target），hitl.py 只负责渲染解析。

外部依赖降级（spec §11.2）由节点接线驱动：intake 把 run_mode 传给 ``load_signals``
（``GithubUnavailable`` → mock）；两个 research 节点把 run_mode 传给 Agent（web_search → mock）。
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Literal

from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, START, StateGraph
from langgraph.types import interrupt

from evopm import llm
from evopm.agents.base import collect_valid_ids, validate_evidence_refs
from evopm.agents.critic import CriticAgent
from evopm.agents.discovery import DiscoveryAgent, filter_actionable
from evopm.agents.engineering import EngineeringAgent
from evopm.agents.intake import IntakeAgent, load_signals
from evopm.agents.requirement import RequirementAgent
from evopm.agents.research import ResearchAgent
from evopm.agents.strategy import StrategyAgent
from evopm.report.render import render_reports
from evopm.schemas import (
    GateStatus,
    ReviewAction,
    RiskTier,
)
from evopm.state import EvoPMState

# intake 节点无 data_dir 时的默认 KB（CLI --data 默认值一致，spec §8）。
_DEFAULT_DATA_DIR = "data/demo_kb"
# 研究重入软裁剪：人工补证据时只重跑被点名的单路调研。


# --------------------------------------------------------------------------- #
# 节点：intake
# --------------------------------------------------------------------------- #
def intake_node(state: EvoPMState) -> dict[str, Any]:
    """加载并编号原始信号（GitHub 失败→mock）→ 一次批量 LLM 标注 → 合并回信号。"""
    pc = state["product_context"]
    run_mode = state.get("run_mode", "mock")
    data_dir = state.get("data_dir", _DEFAULT_DATA_DIR)  # CLI 不传时退化到 demo KB
    signals = load_signals(
        data_dir,
        repo=pc.github_repo,
        run_mode=run_mode,
        keywords=pc.tech_topics or None,
    )
    agent = IntakeAgent()
    output = agent.run(product_context=pc, signals=signals)
    merged = agent.merge_annotations(signals, output)
    return {"signals": merged}


# --------------------------------------------------------------------------- #
# 节点：discovery
# --------------------------------------------------------------------------- #
def discovery_node(state: EvoPMState) -> dict[str, Any]:
    """可行动信号 + 历史需求池 → 2–4 个 InsightCluster（闭包校验已在 Agent 内）。"""
    signals = state.get("signals", [])
    existing = state.get("existing_requirements", [])
    actionable = filter_actionable(signals)
    agent = DiscoveryAgent()
    output = agent.run(signals=actionable, existing_requirements=existing)
    return {"clusters": list(output.clusters)}


# --------------------------------------------------------------------------- #
# 节点：select_cluster（interrupt ①）
# --------------------------------------------------------------------------- #
def select_cluster_node(state: EvoPMState) -> dict[str, Any]:
    """interrupt ①：人工/replay 选定焦点簇 id（spec §3.3）。"""
    clusters = state.get("clusters", [])
    payload = {
        "type": "select_cluster",
        "clusters": [
            {
                "id": c.id,
                "title": c.title,
                "summary": c.summary,
                "frequency": c.frequency,
                "severity": c.severity.value,
                "status": c.status.value,
            }
            for c in clusters
        ],
    }
    resume = interrupt(payload)
    cluster_id = resume.get("cluster_id") if isinstance(resume, dict) else None
    valid = {c.id for c in clusters}
    if cluster_id not in valid:  # 兜底：非法 id 退回最大频次簇（与 replay 预设一致）
        # 跳过 duplicate/insufficient（这类不能作焦点 P0），并列/无可选时退回全体最大频次。
        selectable = [
            c for c in clusters if c.status.value not in ("duplicate", "insufficient")
        ]
        pool = selectable or clusters
        cluster_id = max(pool, key=lambda c: c.frequency).id if pool else ""
    return {"selected_cluster_id": cluster_id}


def _selected_cluster(state: EvoPMState):
    cid = state.get("selected_cluster_id", "")
    for c in state.get("clusters", []):
        if c.id == cid:
            return c
    return None


# --------------------------------------------------------------------------- #
# 节点：competitor_research / tech_research（fan-out；可补证据重入）
# --------------------------------------------------------------------------- #
def competitor_research_node(state: EvoPMState) -> dict[str, Any]:
    cluster = _selected_cluster(state)
    pc = state["product_context"]
    run_mode = state.get("run_mode", "mock")
    agent = ResearchAgent(mode="competitor")
    out = agent.run(cluster=cluster, product_context=pc, run_mode=run_mode)
    valid_ids = collect_valid_ids(dict(state))
    clean, viol = validate_evidence_refs(out, valid_ids)
    return {"competitor_findings": list(clean.findings), "evidence_violations": viol}


def tech_research_node(state: EvoPMState) -> dict[str, Any]:
    cluster = _selected_cluster(state)
    pc = state["product_context"]
    run_mode = state.get("run_mode", "mock")
    agent = ResearchAgent(mode="tech")
    out = agent.run(cluster=cluster, product_context=pc, run_mode=run_mode)
    valid_ids = collect_valid_ids(dict(state))
    clean, viol = validate_evidence_refs(out, valid_ids)
    return {"tech_findings": list(clean.findings), "evidence_violations": viol}


def route_research_out(state: EvoPMState) -> Literal["quality_gate", "critic"]:
    """调研出边（纯只读）：补证据重入 → critic 复审；首轮 → quality_gate（fan-in 去重）。"""
    return "critic" if state.get("research_reentry") else "quality_gate"


# --------------------------------------------------------------------------- #
# 节点：quality_gate（初评 / enrich / clarify 后重评）
# --------------------------------------------------------------------------- #
def quality_gate_node(state: EvoPMState) -> dict[str, Any]:
    """质量门禁节点。

    - 首次进入（focus_candidate 尚不存在）：draft_and_score 起草+评分。
    - 带人工补充文本重入（clarify supplement）：用补充文本重新起草+评分。
    - 其余重入（enrich 后 / clarify force_pass / route_support）：**不重新起草**，
      沿用已重评/已处理的 focus_candidate，仅由 route_gate 读取其 gate 分流
      （否则会丢弃 enrich 的 round-2 结果或人工 force_pass）。
    """
    human_supplement = state.get("_clarify_supplement", "")
    existing = state.get("focus_candidate")
    if existing is not None and not human_supplement:
        return {}  # 重入且无补充文本：保留现有候选，交 route_gate 分流

    cluster = _selected_cluster(state)
    cfs = state.get("competitor_findings", [])
    tfs = state.get("tech_findings", [])
    valid_ids = collect_valid_ids(dict(state))
    agent = RequirementAgent()
    candidate, viol = agent.draft_and_score(
        cluster=cluster,
        competitor_findings=cfs,
        tech_findings=tfs,
        human_supplement=human_supplement,
        valid_ids=valid_ids,
    )
    return {
        "focus_candidate": candidate,
        "_clarify_supplement": "",
        "evidence_violations": viol,
    }


def route_gate(
    state: EvoPMState,
) -> Literal["enrich", "clarify_human", "opportunity", "report"]:
    """门禁路由（纯只读，spec §3.2）。"""
    gate = state["focus_candidate"].quality.gate
    if gate == GateStatus.PASS:
        return "opportunity"
    if gate == GateStatus.ROUTE_SUPPORT:
        return "report"
    if state.get("enrich_rounds", 0) == 0:
        return "enrich"
    if state.get("clarify_rounds", 0) >= 1:
        return "report"  # 防澄清死循环：1 次后仍不达标降级出报告
    return "clarify_human"


# --------------------------------------------------------------------------- #
# 节点：enrich（计数所有权：enrich_rounds）
# --------------------------------------------------------------------------- #
def enrich_node(state: EvoPMState) -> dict[str, Any]:
    """补全 acceptance_criteria/non_goals/boundary 并重评（round=2）；enrich_rounds += 1。"""
    cluster = _selected_cluster(state)
    candidate = state["focus_candidate"]
    cfs = state.get("competitor_findings", [])
    tfs = state.get("tech_findings", [])
    valid_ids = collect_valid_ids(dict(state))
    agent = RequirementAgent()
    enriched, viol = agent.enrich(
        candidate=candidate,
        cluster=cluster,
        competitor_findings=cfs,
        tech_findings=tfs,
        valid_ids=valid_ids,
    )
    return {
        "focus_candidate": enriched,
        "enrich_rounds": state.get("enrich_rounds", 0) + 1,
        "evidence_violations": viol,
    }


# --------------------------------------------------------------------------- #
# 节点：clarify_human（interrupt ②；计数所有权：clarify_rounds）
# --------------------------------------------------------------------------- #
def clarify_human_node(state: EvoPMState) -> dict[str, Any]:
    """interrupt ②：人工澄清。resume action ∈ {supplement, force_pass, route_support}。

    - supplement：把补充文本暂存到 _clarify_supplement，回 quality_gate 重评；
    - force_pass：把 focus_candidate.quality.gate 直接置 PASS；
    - route_support：置 ROUTE_SUPPORT（route_gate 将其导向 report）。
    clarify_rounds += 1（本节点所有权，防澄清死循环）。
    """
    q = state["focus_candidate"].quality
    payload = {
        "type": "clarify",
        "missing_info": list(q.missing_info) if q else [],
        "questions": list(q.followup_questions) if q else [],
    }
    resume = interrupt(payload)
    action = resume.get("action") if isinstance(resume, dict) else None
    text = resume.get("text", "") if isinstance(resume, dict) else ""

    delta: dict[str, Any] = {"clarify_rounds": state.get("clarify_rounds", 0) + 1}
    candidate = state["focus_candidate"].model_copy(deep=True)
    if action == "force_pass" and candidate.quality is not None:
        candidate.quality.gate = GateStatus.PASS
        delta["focus_candidate"] = candidate
        delta["_clarify_supplement"] = ""
    elif action == "route_support" and candidate.quality is not None:
        candidate.quality.gate = GateStatus.ROUTE_SUPPORT
        delta["focus_candidate"] = candidate
        delta["_clarify_supplement"] = ""
    else:  # supplement（或未知）→ 带补充文本回 quality_gate 重评
        delta["_clarify_supplement"] = text
    return delta


# --------------------------------------------------------------------------- #
# 节点：opportunity（焦点精评 + 全簇路线图）
# --------------------------------------------------------------------------- #
def opportunity_node(state: EvoPMState) -> dict[str, Any]:
    """StrategyAgent.score：一次调用产出 OpportunityDecision + 全簇 roadmap。"""
    candidate = state["focus_candidate"]
    clusters = state.get("clusters", [])
    pc = state["product_context"]
    cfs = state.get("competitor_findings", [])
    tfs = state.get("tech_findings", [])
    valid_ids = collect_valid_ids(dict(state))
    agent = StrategyAgent()
    decision, roadmap, viol = agent.score(
        focus_candidate=candidate,
        clusters=clusters,
        product_context=pc,
        competitor_findings=cfs,
        tech_findings=tfs,
        valid_ids=valid_ids,
    )
    return {"opportunity": decision, "roadmap": list(roadmap), "evidence_violations": viol}


# --------------------------------------------------------------------------- #
# 节点：solution_design
# --------------------------------------------------------------------------- #
def solution_design_node(state: EvoPMState) -> dict[str, Any]:
    """StrategyAgent.design → SolutionSpec。"""
    candidate = state["focus_candidate"]
    opportunity = state["opportunity"]
    cfs = state.get("competitor_findings", [])
    tfs = state.get("tech_findings", [])
    valid_ids = collect_valid_ids(dict(state))
    agent = StrategyAgent()
    solution, viol = agent.design(
        focus_candidate=candidate,
        opportunity=opportunity,
        competitor_findings=cfs,
        tech_findings=tfs,
        valid_ids=valid_ids,
    )
    return {"solution": solution, "evidence_violations": viol}


# --------------------------------------------------------------------------- #
# 节点：engineering（gate≠PASS → blocked，Agent 内短路）
# --------------------------------------------------------------------------- #
def engineering_node(state: EvoPMState) -> dict[str, Any]:
    """EngineeringAgent → CodeImpactMap + ExecutionProposal（risk_tier 代码覆写在 Agent 内）。"""
    solution = state["solution"]
    repo_map = state.get("repo_map", "")
    pc = state["product_context"]
    gate = state["focus_candidate"].quality.gate
    agent = EngineeringAgent()
    output = agent.run(
        solution=solution,
        repo_map=repo_map,
        core_modules=pc.core_modules,
        gate=gate,
    )
    return {"code_impact": output.impact, "execution": output.execution}


# --------------------------------------------------------------------------- #
# 节点：critic（计数所有权：redo_rounds）
# --------------------------------------------------------------------------- #
def _assemble_conclusions(state: EvoPMState) -> list[dict]:
    """代码组装结论清单（结论 + evidence_refs + 来源），不喂全文（spec §11.3 / §4）。"""
    conclusions: list[dict] = []
    fc = state.get("focus_candidate")
    if fc is not None:
        conclusions.append(
            {"target": f"需求 {fc.id}：{fc.title}", "evidence_refs": list(fc.evidence_refs)}
        )
    for cf in state.get("competitor_findings", []):
        conclusions.append(
            {
                "target": f"竞品发现 {cf.id}：{cf.conclusion}",
                "evidence_refs": [cf.id],
                "source_url": cf.source_url,
            }
        )
    for tf in state.get("tech_findings", []):
        conclusions.append(
            {
                "target": f"技术发现 {tf.id}：{tf.solution_name}",
                "evidence_refs": [tf.id],
                "source_url": tf.source_url,
            }
        )
    sol = state.get("solution")
    if sol is not None:
        for ac in sol.acceptance_criteria:
            conclusions.append(
                {"target": f"验收标准：{ac.text}", "evidence_refs": list(ac.evidence_refs)}
            )
    return conclusions


def critic_node(state: EvoPMState) -> dict[str, Any]:
    """对抗审查。计数所有权（spec §3.2/§3.2 注释）：

    严重问题且 redo_rounds<1 → Agent 已据传入 redo_rounds 决定是否设 redo_target；
    若本输出含 redo_target，则本节点把 redo_rounds 置 1（保证最多一轮，router 只读）。
    """
    redo_rounds = state.get("redo_rounds", 0)
    conclusions = _assemble_conclusions(state)
    ci = state.get("code_impact")
    high_risk_items = list(ci.human_confirmation_needed) if ci is not None else []
    # 各节点累加的闭包 violations（去重保序），喂给 Critic 作悬空引用输入。
    violations = list(dict.fromkeys(state.get("evidence_violations", []) or []))
    agent = CriticAgent()
    review = agent.run(
        conclusions=conclusions,
        violations=violations,
        high_risk_items=high_risk_items,
        redo_rounds=redo_rounds,
    )
    # 归一化 redo_target：非法值（"null"/空/幻觉节点名）一律视为不回炉。
    if review.redo_target not in _REDO_TARGETS:
        review.redo_target = None
    delta: dict[str, Any] = {"critic_review": review}
    # 计数所有权：仅当 Agent 设了合法 redo_target（即将回炉）时自增 redo_rounds=1。
    if review.redo_target and redo_rounds < 1:
        delta["redo_rounds"] = 1
    return delta


# 合法回炉目标（Critic 可点名重跑的节点）；其余值（含 "null"/空/幻觉名）一律落 human_review。
_REDO_TARGETS = {"opportunity", "solution_design", "engineering", "quality_gate"}


def route_critic(state: EvoPMState) -> str:
    """Critic 回炉路由（纯只读，spec §3.2）。非法 redo_target 安全兜底到 human_review。"""
    if state.get("research_reentry"):
        return "human_review"
    target = state["critic_review"].redo_target
    return target if target in _REDO_TARGETS else "human_review"


# --------------------------------------------------------------------------- #
# 节点：human_review（interrupt ③；计数所有权：more_evidence_rounds + 重入标志）
# --------------------------------------------------------------------------- #
def _review_items(state: EvoPMState) -> list[dict]:
    """final_review 待评审项：critic findings（带 risk_tier / evidence_strength）。"""
    items: list[dict] = []
    cr = state.get("critic_review")
    if cr is not None:
        for f in cr.findings:
            items.append(
                {
                    "ref": f.target,
                    "description": f.note,
                    "risk_tier": f.risk_tier.value,
                    "evidence_strength": f.evidence_strength.value,
                }
            )
    # 高风险代码影响项也进评审清单（spec §5.3：全部 HIGH 项需人工确认）。
    ci = state.get("code_impact")
    if ci is not None:
        for note in ci.human_confirmation_needed:
            items.append(
                {
                    "ref": note,
                    "description": note,
                    "risk_tier": RiskTier.HIGH.value,
                    "evidence_strength": "n/a",
                }
            )
    return items


def human_review_node(state: EvoPMState) -> dict[str, Any]:
    """interrupt ③：最终评审。据 decisions 设补证据重入标志（spec §3.2 计数所有权）。

    含 MORE_EVIDENCE 且 more_evidence_rounds<1 → research_reentry=True、
    more_evidence_rounds=1、_reentry_target=("competitor"|"tech")；否则 research_reentry=False。
    """
    # 补证据复审回到本节点：此时 research_reentry 仍为 True，需复位为 False 后正常出报告。
    if state.get("research_reentry"):
        return {"research_reentry": False}

    payload = {"type": "final_review", "items": _review_items(state)}
    resume = interrupt(payload)
    raw_decisions = resume.get("decisions", []) if isinstance(resume, dict) else []

    # 解析为 HumanDecision，累加进 state.human_decisions（供 report 渲染 [未确认]）。
    from evopm.schemas import HumanDecision

    decisions: list[HumanDecision] = []
    for d in raw_decisions:
        if isinstance(d, HumanDecision):
            decisions.append(d)
        elif isinstance(d, dict):
            decisions.append(_coerce_decision(d))

    existing = list(state.get("human_decisions", []))
    delta: dict[str, Any] = {"human_decisions": existing + decisions}

    more_rounds = state.get("more_evidence_rounds", 0)
    me = next((d for d in decisions if d.action == ReviewAction.MORE_EVIDENCE), None)
    if me is not None and more_rounds < 1:
        delta["research_reentry"] = True
        delta["more_evidence_rounds"] = 1
        delta["_reentry_target"] = _infer_reentry_target(me.item_ref)
    else:
        delta["research_reentry"] = False
    return delta


def _coerce_decision(d: dict) -> Any:
    """把 resume 的 decision dict 补齐为合法 HumanDecision（hitl 已基本对齐 schema）。"""
    from datetime import datetime, timezone

    from evopm.schemas import HumanDecision

    return HumanDecision(
        checkpoint=d.get("checkpoint", "final_review"),
        item_ref=str(d.get("item_ref", "")),
        action=ReviewAction(d.get("action", "accept")),
        reason=d.get("reason", ""),
        edited_content=d.get("edited_content", ""),
        timestamp=d.get("timestamp") or datetime.now(timezone.utc).isoformat(),
    )


def _infer_reentry_target(item_ref: str) -> str:
    """据被点名 item_ref（cf-* / tf-*）决定补证据去向；默认竞品。"""
    return "tech" if "tf-" in (item_ref or "") else "competitor"


def route_review(
    state: EvoPMState,
) -> Literal["competitor_research", "tech_research", "report"]:
    """评审后补证据路由（纯只读，spec §3.2）。"""
    if state.get("research_reentry"):
        return (
            "competitor_research"
            if state.get("_reentry_target") == "competitor"
            else "tech_research"
        )
    return "report"


# --------------------------------------------------------------------------- #
# 节点：report
# --------------------------------------------------------------------------- #
def report_node(state: EvoPMState) -> dict[str, Any]:
    """渲染 4 份报告 + state.json；写回 report_paths 与 llm_call_count（仅展示）。"""
    used = llm.get_budget_used()
    full_state = dict(state)
    full_state["llm_call_count"] = used
    paths = render_reports(full_state)
    return {"report_paths": paths, "llm_call_count": used}


# --------------------------------------------------------------------------- #
# build_graph
# --------------------------------------------------------------------------- #
def build_graph(checkpointer: Any = None):
    """组装并编译 LangGraph（spec §3.2）。

    14 节点；select_cluster fan-out 到两个 research 节点；route_research_out 挂在两节点上
    （首轮均回 quality_gate → fan-in 去重为一次）；四个条件路由全只读。
    编译用 MemorySaver（调用方传 recursion_limit=50 + thread_id）。
    """
    g = StateGraph(EvoPMState)

    g.add_node("intake", intake_node)
    g.add_node("discovery", discovery_node)
    g.add_node("select_cluster", select_cluster_node)
    g.add_node("competitor_research", competitor_research_node)
    g.add_node("tech_research", tech_research_node)
    g.add_node("quality_gate", quality_gate_node)
    g.add_node("enrich", enrich_node)
    g.add_node("clarify_human", clarify_human_node)
    g.add_node("opportunity", opportunity_node)
    g.add_node("solution_design", solution_design_node)
    g.add_node("engineering", engineering_node)
    g.add_node("critic", critic_node)
    g.add_node("human_review", human_review_node)
    g.add_node("report", report_node)

    # 线性主链 + fan-out
    g.add_edge(START, "intake")
    g.add_edge("intake", "discovery")
    g.add_edge("discovery", "select_cluster")
    g.add_edge("select_cluster", "competitor_research")  # fan-out
    g.add_edge("select_cluster", "tech_research")  # fan-out

    # 条件边 0：两调研节点出边（首轮 fan-in 到 quality_gate；补证据重入回 critic）
    research_out = {"quality_gate": "quality_gate", "critic": "critic"}
    g.add_conditional_edges("competitor_research", route_research_out, research_out)
    g.add_conditional_edges("tech_research", route_research_out, research_out)

    # 条件边 1：门禁
    g.add_conditional_edges(
        "quality_gate",
        route_gate,
        {
            "enrich": "enrich",
            "clarify_human": "clarify_human",
            "opportunity": "opportunity",
            "report": "report",
        },
    )
    g.add_edge("enrich", "quality_gate")
    g.add_edge("clarify_human", "quality_gate")

    # 主链
    g.add_edge("opportunity", "solution_design")
    g.add_edge("solution_design", "engineering")
    g.add_edge("engineering", "critic")

    # 条件边 2：Critic 回炉
    g.add_conditional_edges(
        "critic",
        route_critic,
        {
            "human_review": "human_review",
            "opportunity": "opportunity",
            "solution_design": "solution_design",
            "engineering": "engineering",
            "quality_gate": "quality_gate",
        },
    )

    # 条件边 3：评审后补证据
    g.add_conditional_edges(
        "human_review",
        route_review,
        {
            "competitor_research": "competitor_research",
            "tech_research": "tech_research",
            "report": "report",
        },
    )
    g.add_edge("report", END)

    return g.compile(checkpointer=checkpointer or MemorySaver())

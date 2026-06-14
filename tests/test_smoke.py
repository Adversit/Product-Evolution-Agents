"""smoke test（WT-7 / T7.4，spec §10 五项）。

1. test_gate_rule / 2. test_risk_tier：复用 rules 纯函数，无需密钥（与既有
   tests/test_gate_rule.py、tests/test_risk_tier.py 同源，这里再断言关键分支，不重复失败）。
3. test_loop_caps：monkeypatch llm.structured_call 返回 canned 对象，驱动 build_graph()：
   - clarify_rounds 触顶 → 收敛到 report（不死循环）；
   - redo_rounds 触顶后第二次 critic 不再设 redo_target（enforce_redo_ownership）。
4. test_degrade：monkeypatch github.fetch_issues→GithubUnavailable、
   llm.web_search_call→WebSearchUnavailable，断言 intake 读 issues_mock.json、
   research findings 带 mock:// 来源，全链不崩。
5. test_replay_e2e：完整 replay 端到端（4 报告、quality.round==2、total 提升、
   execution.blocked==False、闭包合法）。需密钥生成缓存 fixture → skipif 守卫。
"""

from __future__ import annotations

import os
from pathlib import Path

import pytest
from langgraph.types import Command

from evopm import llm
from evopm.graph import build_graph
from evopm.schemas import (
    Category,
    ClusterStatus,
    CodeImpactItem,
    CodeImpactMap,
    CompetitorFinding,
    CompetitorVerdict,
    CriticFinding,
    CriticReview,
    EvidenceStrength,
    ExecutionProposal,
    GateStatus,
    Horizon,
    ImpactLevel,
    ImpactType,
    InsightCluster,
    OpportunityDecision,
    OpportunityScore,
    Priority,
    ProductContext,
    QualityDimension,
    QualityReport,
    RequirementCandidate,
    RiskTier,
    RoadmapEntry,
    Severity,
    SolutionSpec,
    TaskCard,
    TaskType,
    TechFinding,
    TechMaturity,
    UserStory,
)

_RUN_CONFIG = {"recursion_limit": 50, "configurable": {"thread_id": "evopm-demo"}}
_DATA_DIR = "data/demo_kb"


# --------------------------------------------------------------------------- #
# 1 + 2：规则分支（无密钥）
# --------------------------------------------------------------------------- #
def test_gate_rule():
    """decide_gate 三分支（pass / needs_enrich / route_support）。"""
    from evopm.rules import BLOCKER_DIMS, decide_gate

    def q(total, score, missing=None):
        return QualityReport(
            total=total,
            dimensions=[
                QualityDimension(name=d, score=score, rationale="r")
                for d in BLOCKER_DIMS
            ],
            missing_info=missing or [],
            ambiguities=[],
            followup_questions=[],
            gate=GateStatus.NEEDS_ENRICH,
            round=1,
        )

    assert decide_gate(q(82, 75)) == GateStatus.PASS
    assert decide_gate(q(58, 75)) == GateStatus.NEEDS_ENRICH
    assert decide_gate(q(82, 75, ["缺验收"])) == GateStatus.NEEDS_ENRICH
    assert decide_gate(q(82, 75), [Category.MISUSE, Category.DOCS]) == GateStatus.ROUTE_SUPPORT


def test_risk_tier():
    """核心模块前缀命中 → HIGH（spec §5.3）。"""
    from evopm.rules import risk_tier

    core = ["rag/nlp", "deepdoc/parser", "rag/svr"]

    def item(path, level):
        return CodeImpactItem(
            module_path=path,
            impact_level=level,
            impact_types=[ImpactType.SERVICE],
            description="d",
            is_core_module=False,
            risk_tier=RiskTier.LOW,
            verify_points=[],
        )

    assert risk_tier(item("rag/svr/x.py", ImpactLevel.CERTAIN), core) == RiskTier.HIGH
    assert risk_tier(item("web/src", ImpactLevel.UNCERTAIN), core) == RiskTier.HIGH
    assert risk_tier(item("web/src", ImpactLevel.POSSIBLE), core) == RiskTier.MEDIUM
    assert risk_tier(item("web/src", ImpactLevel.CERTAIN), core) == RiskTier.LOW


# --------------------------------------------------------------------------- #
# 共用：canned 上游对象 + product_context
# --------------------------------------------------------------------------- #
def _product_context() -> ProductContext:
    from evopm import config

    return config.load_product_context(Path(_DATA_DIR) / "product.yaml")


def _initial_state(run_mode: str = "mock") -> dict:
    from evopm import config

    base = Path(_DATA_DIR)
    pc = config.load_product_context(base / "product.yaml")
    existing = config.load_existing_requirements(base / "existing_requirements.md")
    repo_map = config.load_repo_map(base / "repo_map.md")
    return {
        "product_context": pc,
        "existing_requirements": existing,
        "repo_map": repo_map,
        "run_mode": run_mode,
        "data_dir": _DATA_DIR,
    }


def _intake_output():
    from evopm.agents.intake import IntakeAnnotation, IntakeOutput

    # 标注两条信号（与 mock CSV 行数无关——merge 按 id 匹配，未匹配的保留为未标注）。
    return IntakeOutput(
        signals=[
            IntakeAnnotation(
                id="sig-001",
                module_guess="文件上传与问答质量",
                category="stability",
                sentiment="negative",
                actionability="real_issue",
                data_quality="complete",
            )
        ]
    )


def _discovery_output():
    from evopm.agents.discovery import DiscoveryOutput

    return DiscoveryOutput(
        clusters=[
            InsightCluster(
                id="clu-01",
                title="文档解析失败且状态不可见",
                summary="上传大文件后长时间转圈，无法判断卡死还是仍在解析。",
                signal_ids=["sig-001"],
                categories=[Category.STABILITY, Category.UX],
                severity=Severity.HIGH,
                frequency=1,
                status=ClusterStatus.NEW,
                candidate_title="提供解析进度与失败可见性",
                user_story_draft="作为用户，我希望看到解析进度。",
            ),
            InsightCluster(
                id="clu-02",
                title="检索引用质量",
                summary="检索结果引用不准。",
                signal_ids=[],
                categories=[Category.PERFORMANCE],
                severity=Severity.MEDIUM,
                frequency=1,
                status=ClusterStatus.NEW,
                candidate_title="提升引用准确性",
                user_story_draft="作为用户，我希望引用更准。",
            ),
        ]
    )


def _competitor_output():
    from evopm.agents.research import CompetitorOutput

    return CompetitorOutput(
        findings=[
            CompetitorFinding(
                id="cf-01",
                competitor="Dify",
                research_question="如何展示解析进度？",
                has_solved=True,
                conclusion="Dify 有分阶段进度提示。",
                verdict=CompetitorVerdict.ADOPT,
                gap_description="我方无进度反馈",
                implication="可借鉴分阶段进度",
                source_url="https://dify.ai",
                evidence_strength=EvidenceStrength.STRONG,
            )
        ]
    )


def _tech_output():
    from evopm.agents.research import TechOutput

    return TechOutput(
        findings=[
            TechFinding(
                id="tf-01",
                topic="上传状态机",
                solution_name="显式状态机 + 心跳",
                maturity=TechMaturity.MATURE,
                fit_reason="可把解析拆为可观测阶段",
                cost_estimate="medium",
                risk="状态粒度过细增加写压力",
                source_url="https://example.com",
                evidence_strength=EvidenceStrength.MODERATE,
            )
        ]
    )


def _draft_candidate(passing: bool):
    """quality_gate 节点现在调 RequirementDraftLLM（扁平）。

    passing=False → blocker 维低 + missing_info（代码侧 gate=NEEDS_ENRICH）；True → 高分无缺失。
    """
    from evopm.agents.requirement import DimLLM, RequirementDraftLLM

    if passing:
        scores = {d: 85 for d in _ALL_QDIMS}
        missing = []
    else:
        scores = {d: 50 for d in _ALL_QDIMS}
        missing = ["缺少验收标准"]
    return RequirementDraftLLM(
        id="req-01",
        title="提供解析进度与失败可见性",
        background="bg",
        target_users=["企业知识库团队"],
        pain_point="解析无反馈",
        business_goal="降低求助",
        scope=["展示进度"],
        non_goals=[],
        boundary_conditions=[],
        clarifications=[],
        user_stories=[
            UserStory(
                role="用户", scenario="上传", benefit="掌握状态",
                story_text="作为用户我希望看到进度", evidence_refs=["sig-001"],
            )
        ],
        acceptance_criteria=[],
        evidence_refs=["sig-001", "cf-01", "tf-01"],
        dimensions=[DimLLM(name=d, score=scores[d], rationale="r") for d in _ALL_QDIMS],
        missing_info=missing,
        ambiguities=[],
        followup_questions=["进度粒度？"],
    )


from evopm.rules import QUALITY_DIMS as _ALL_QDIMS  # noqa: E402


def _opportunity_output():
    from evopm.agents.strategy import OpportunityOutput
    from evopm.rules import OPPORTUNITY_DIMS

    return OpportunityOutput(
        decision=OpportunityDecision(
            requirement_id="req-01",
            scores=[
                OpportunityScore(dimension=d, score=80, rationale="r", evidence_refs=["sig-001"])
                for d in OPPORTUNITY_DIMS
            ],
            total=0.0,
            priority=Priority.P1,
            horizon=Horizon.NOW,
            rationale="高频高严重",
            special_types=[],
        ),
        roadmap=[
            RoadmapEntry(cluster_id="clu-01", title="解析可见性", priority=Priority.P1,
                         horizon=Horizon.NOW, one_line_reason="焦点", is_focus=True),
            RoadmapEntry(cluster_id="clu-02", title="引用质量", priority=Priority.P2,
                         horizon=Horizon.NEXT, one_line_reason="次要", is_focus=False),
        ],
    )


def _solution():
    from evopm.schemas import AcceptanceCriterion

    return SolutionSpec(
        requirement_id="req-01",
        summary="加状态机与进度上报",
        scope=["进度展示"],
        non_goals=["不改解析算法"],
        user_flow=["上传", "查看进度"],
        acceptance_criteria=[
            AcceptanceCriterion(text="展示阶段进度", type="functional", evidence_refs=["cf-01"]),
            AcceptanceCriterion(text="心跳 ≤10s", type="nonfunctional", evidence_refs=["tf-01"]),
        ],
        edge_cases=["超大文件"],
        test_scenarios=["上传 200MB"],
        role_notes={"product": "p", "dev": "d", "qa": "q", "support": "s"},
        risks=["写压力"],
        dependencies=["任务队列"],
    )


def _engineering_output():
    from evopm.agents.engineering import EngineeringOutput

    return EngineeringOutput(
        impact=CodeImpactMap(
            requirement_id="req-01",
            items=[
                CodeImpactItem(
                    module_path="rag/svr",
                    impact_level=ImpactLevel.CERTAIN,
                    impact_types=[ImpactType.SERVICE],
                    description="加状态上报",
                    is_core_module=False,
                    risk_tier=RiskTier.LOW,
                    verify_points=["状态正确"],
                ),
                CodeImpactItem(
                    module_path="web/src",
                    impact_level=ImpactLevel.POSSIBLE,
                    impact_types=[ImpactType.FRONTEND],
                    description="进度 UI",
                    is_core_module=False,
                    risk_tier=RiskTier.LOW,
                    verify_points=["UI 显示"],
                ),
            ],
            suggested_order=["rag/svr", "web/src"],
            human_confirmation_needed=[],
        ),
        execution=ExecutionProposal(
            requirement_id="req-01",
            tasks=[
                TaskCard(
                    id="task-01", type=TaskType.BACKEND, title="状态上报",
                    description="改造任务队列", related_modules=["rag/svr"],
                    evidence_refs=["tf-01"], risk_tier=RiskTier.LOW,
                )
            ],
            change_suggestions=["加状态字段"],
            test_suggestions=["状态机单测"],
            impl_plan=[],
            changelog_draft="新增解析进度",
            blocked=False,
        ),
    )


def _critic_review(redo: bool):
    return CriticReview(
        findings=[
            CriticFinding(
                target="需求 req-01：提供解析进度与失败可见性",
                evidence_strength=EvidenceStrength.MODERATE,
                overreach=False,
                risk_tier=RiskTier.HIGH,
                note="核心模块改动需确认",
                demote_to_observation=False,
            )
        ],
        pending_confirmations=["rag/svr 改动需人工确认"],
        redo_target="opportunity" if redo else None,
        redo_instructions="重评机会分" if redo else "",
    )


# --------------------------------------------------------------------------- #
# canned structured_call 分发器
# --------------------------------------------------------------------------- #
def _make_canned(*, draft_passing: bool, redo_once: bool, ever_passes: bool | None = None):
    """返回一个替身 structured_call(schema, system, user, **kw)，按 schema 名分发 canned 对象。

    draft_passing：RequirementCandidate 的初评是否达标（False 触发 enrich/clarify 循环）。
    ever_passes：enrich（第二次起）是否允许达标；None 时取 draft_passing。
      clarify-cap 场景传 False，使所有轮次都不达标 → 触发澄清上限降级。
    redo_once：CriticReview 是否在 redo_rounds<1 时设 redo_target（用于回炉一次）。
    """
    from evopm.agents.research import ResearchQuestions

    if ever_passes is None:
        ever_passes = draft_passing
    state = {"critic_calls": 0, "req_calls": 0}

    def canned(schema, system, user, model=None, use_cache=True):
        name = schema.__name__
        if name == "IntakeOutput":
            return _intake_output()
        if name == "DiscoveryOutput":
            return _discovery_output()
        if name == "ResearchQuestions":
            return ResearchQuestions(questions=["Q1", "Q2", "Q3"])
        if name == "CompetitorOutput":
            return _competitor_output()
        if name == "TechOutput":
            return _tech_output()
        if name == "RequirementDraftLLM":
            state["req_calls"] += 1
            # 初评（req_calls==1）按 draft_passing；enrich（req_calls>=2）按 ever_passes
            passing = draft_passing if state["req_calls"] == 1 else ever_passes
            return _draft_candidate(passing)
        if name == "OpportunityOutput":
            return _opportunity_output()
        if name == "SolutionSpec":
            return _solution()
        if name == "EngineeringOutput":
            return _engineering_output()
        if name == "CriticReview":
            state["critic_calls"] += 1
            # 仅第一次允许设 redo_target；Agent 的 enforce_redo_ownership 还会兜底。
            return _critic_review(redo_once and state["critic_calls"] == 1)
        raise AssertionError(f"未预期的 schema：{name}")

    canned._state = state  # 暴露调用计数供断言
    return canned


# --------------------------------------------------------------------------- #
# 3：test_loop_caps
# --------------------------------------------------------------------------- #
def test_loop_caps_clarify(monkeypatch, tmp_path):
    """clarify_rounds 触顶 → 收敛到 report（enrich 后仍不达标，澄清一次后降级）。"""
    canned = _make_canned(draft_passing=False, redo_once=False, ever_passes=False)
    monkeypatch.setattr(llm, "structured_call", canned)
    monkeypatch.chdir(_repo_root())

    graph = build_graph()
    final = _drive_with_resumes(
        graph,
        _initial_state("mock"),
        # select=clu-01；clarify=supplement（不强制通过，保持 NEEDS_ENRICH 以触发上限）
        select="clu-01",
        clarify={"action": "supplement", "text": "补充说明"},
        review="accept_all",
    )
    # 不死循环：到达 report（report_paths 非空）；clarify_rounds 触顶为 1。
    assert final.get("report_paths"), "应收敛到 report"
    assert final.get("clarify_rounds", 0) == 1
    assert final.get("enrich_rounds", 0) == 1
    # 始终不达标 → 未进入 opportunity（无 opportunity 决策）。
    assert final.get("opportunity") is None


def test_loop_caps_redo(monkeypatch, tmp_path):
    """redo_rounds 触顶：critic 第一次设 redo_target 回炉，第二次不再回炉 → human_review → report。"""
    canned = _make_canned(draft_passing=True, redo_once=True)
    monkeypatch.setattr(llm, "structured_call", canned)
    monkeypatch.chdir(_repo_root())

    graph = build_graph()
    final = _drive_with_resumes(
        graph,
        _initial_state("mock"),
        select="clu-01",
        clarify={"action": "force_pass", "text": ""},
        review="accept_all",
    )
    assert final.get("report_paths"), "应收敛到 report"
    # 回炉恰好一次。
    assert final.get("redo_rounds", 0) == 1
    # critic 被调用至少两次（回炉后复评），且未无限回炉。
    assert canned._state["critic_calls"] >= 2


# --------------------------------------------------------------------------- #
# 4：test_degrade
# --------------------------------------------------------------------------- #
def test_degrade(monkeypatch):
    """GithubUnavailable + WebSearchUnavailable 全降级 mock，全链不中断。

    intake 读 issues_mock.json；research findings 带 mock:// 来源；结构化调用走 canned。
    """
    monkeypatch.chdir(_repo_root())

    # github：live 模式下 fetch_issues 抛 GithubUnavailable → intake 降级 issues_mock.json
    from evopm.sources import github

    def _boom_issues(*a, **k):
        raise github.GithubUnavailable("forced")

    monkeypatch.setattr(github, "fetch_issues", _boom_issues)
    # intake.py 在模块顶层 from ... import fetch_issues，需同时打补丁
    from evopm.agents import intake as intake_mod

    monkeypatch.setattr(intake_mod, "fetch_issues", _boom_issues)

    # web_search：抛 WebSearchUnavailable → research 单项降级读 competitors/*、tech_notes/*
    def _boom_search(*a, **k):
        raise llm.WebSearchUnavailable("forced")

    monkeypatch.setattr(llm, "web_search_call", _boom_search)

    # 结构化调用走 canned（无密钥）。draft 直接达标，避免澄清交互。
    canned = _make_canned(draft_passing=True, redo_once=False)
    monkeypatch.setattr(llm, "structured_call", canned)

    graph = build_graph()
    final = _drive_with_resumes(
        graph,
        _initial_state("live"),  # live 模式才会尝试真实调用→触发降级
        select="clu-01",
        clarify={"action": "force_pass", "text": ""},
        review="accept_all",
    )

    # intake 降级：信号里含 GitHub issue 来源（来自 issues_mock.json）。
    signals = final.get("signals", [])
    assert signals, "应加载到信号"
    assert any(s.source_type.value == "github_issue" for s in signals), \
        "GithubUnavailable 后应从 issues_mock.json 读到 issue 信号"

    # research 降级：findings 的 source_url 带 mock://（research._postprocess 强制改写）。
    cfs = final.get("competitor_findings", [])
    tfs = final.get("tech_findings", [])
    all_findings = cfs + tfs
    assert all_findings, "应有调研发现"
    assert any(str(f.source_url).startswith("mock://") for f in all_findings), \
        "WebSearchUnavailable 后 finding.source_url 应标 mock://"

    # 全链不中断：抵达 report。
    assert final.get("report_paths"), "降级后全链应仍跑到 report"


# --------------------------------------------------------------------------- #
# 5：test_replay_e2e（需密钥生成缓存 fixture）
# --------------------------------------------------------------------------- #
def test_replay_e2e(monkeypatch):
    """完整 replay 端到端：4 报告 / quality.round==2 / total 提升 / blocked==False / 闭包合法。

    读取提交进仓库的缓存 fixture（tests/replay_cache_glm51/，glm-5.1 生成 = 演示主链同款缓存），
    **无需 key、可离线运行**。用 glm-5.1 缓存而非 air：演示主路径用的就是它，且其聚类把焦点簇
    标 known（非 duplicate），与「选簇跳过 duplicate/insufficient」的新逻辑一致、全链命中缓存。
    """
    monkeypatch.chdir(_repo_root())
    monkeypatch.setenv("EVOPM_MODEL", "glm-5.1")
    monkeypatch.setattr(llm, "CACHE_DIR", _repo_root() / "tests" / "replay_cache_glm51")
    llm.reset_budget()
    llm.set_run_mode("replay")

    graph = build_graph()
    final = _drive_with_resumes(
        graph,
        _initial_state("replay"),
        select=None,  # 用 auto_resume 最大簇
        clarify="auto",
        review="accept_all",
    )

    paths = final.get("report_paths", [])
    assert len(paths) == 4, "应生成 4 份报告"

    fc = final.get("focus_candidate")
    assert fc is not None and fc.quality is not None
    assert fc.quality.round == 2, "enrich 后 round==2"
    history = fc.quality_history
    assert len(history) >= 2 and history[-1].total > history[0].total, "total 应提升"

    execution = final.get("execution")
    assert execution is not None and execution.blocked is False

    # 证据闭包：报告中所有 evidence_ref 都能回查到（render 已做，这里抽查 focus refs）。
    from evopm.agents.base import collect_valid_ids

    valid = collect_valid_ids(dict(final))
    for r in fc.evidence_refs:
        assert r in valid, f"悬空引用 {r}"


# --------------------------------------------------------------------------- #
# 驱动辅助：手动消费 interrupt（不依赖 CLI/stdin）
# --------------------------------------------------------------------------- #
def _repo_root() -> Path:
    return Path(__file__).resolve().parent.parent


def _drive_with_resumes(graph, initial_state, *, select, clarify, review):
    """stream 驱动图，按预设应答三个 interrupt，返回最终完整 state（get_state.values）。"""
    from evopm import hitl

    pending = initial_state
    while True:
        interrupted = False
        for chunk in graph.stream(pending, config=_RUN_CONFIG):
            if "__interrupt__" in chunk:
                payload = chunk["__interrupt__"][0].value
                ptype = payload.get("type")
                if ptype == "select_cluster":
                    resume = (
                        {"cluster_id": select}
                        if select
                        else hitl.auto_resume(payload)
                    )
                elif ptype == "clarify":
                    resume = hitl.auto_resume(payload) if clarify == "auto" else clarify
                elif ptype == "final_review":
                    resume = hitl.auto_resume(payload)  # 全 accept
                else:
                    raise AssertionError(f"未知 interrupt：{ptype}")
                pending = Command(resume=resume)
                interrupted = True
                break
        if not interrupted:
            break

    snapshot = graph.get_state(_RUN_CONFIG)
    return dict(snapshot.values)

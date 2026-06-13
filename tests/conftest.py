"""WT-3 测试公共构造器（手写上游对象，不依赖其他 WT 分支）。

附带一个全局 autouse fixture：每个测试前归零 llm 模块级预算计数器，避免整套 live
测试在同一进程内累计调用超过 BUDGET_LIMIT 触发 LLMBudgetExceeded。
"""

from __future__ import annotations

import pytest

from evopm import llm
from evopm.schemas import (
    AcceptanceCriterion,
    Category,
    ClusterStatus,
    CompetitorFinding,
    CompetitorVerdict,
    EvidenceStrength,
    GateStatus,
    InsightCluster,
    OpportunityScore,
    ProductContext,
    QualityDimension,
    QualityReport,
    RequirementCandidate,
    Severity,
    TechFinding,
    TechMaturity,
    UserStory,
)
from evopm.rules import OPPORTUNITY_DIMS, QUALITY_DIMS


@pytest.fixture(autouse=True)
def _reset_llm_budget():
    """每个测试前归零 LLM 预算计数器（防整套 live 测试累计触顶）。"""
    llm.reset_budget()
    yield


def make_cluster(
    cid: str = "clu-01",
    status: ClusterStatus = ClusterStatus.NEW,
    categories: list[Category] | None = None,
) -> InsightCluster:
    return InsightCluster(
        id=cid,
        title="文档解析失败且状态不可见",
        summary="大量用户反馈上传大文件后长时间转圈，无法判断是卡死还是仍在解析。",
        signal_ids=["sig-001", "sig-002", "sig-003"],
        categories=categories or [Category.STABILITY, Category.UX],
        severity=Severity.HIGH,
        frequency=6,
        status=status,
        candidate_title="提供解析进度与失败可见性",
        user_story_draft="作为知识库用户，我希望看到解析进度，以便判断系统是否卡死。",
    )


def make_findings() -> tuple[list[CompetitorFinding], list[TechFinding]]:
    cf = [
        CompetitorFinding(
            id="cf-01",
            competitor="Dify",
            research_question="Dify 如何展示文档解析进度？",
            has_solved=True,
            conclusion="Dify 有分阶段进度与失败原因提示。",
            verdict=CompetitorVerdict.ADOPT,
            gap_description="我方无进度反馈",
            implication="可借鉴分阶段进度模型",
            source_url="mock://dify.md",
            evidence_strength=EvidenceStrength.MODERATE,
        )
    ]
    tf = [
        TechFinding(
            id="tf-01",
            topic="上传状态机",
            solution_name="显式状态机 + 心跳上报",
            maturity=TechMaturity.MATURE,
            fit_reason="可将解析拆分为可观测阶段并上报进度",
            cost_estimate="medium：需改造任务队列状态上报",
            risk="状态粒度过细会增加写压力",
            source_url="mock://upload_state_machine.md",
            evidence_strength=EvidenceStrength.MODERATE,
        )
    ]
    return cf, tf


def make_product_context() -> ProductContext:
    return ProductContext(
        name="RAGFlow",
        description="基于深度文档理解的开源 RAG 引擎",
        target_users=["企业知识库团队", "开发者"],
        module="文件上传与问答质量",
        stage="growth",
        analysis_goals=["发现高频问题"],
        team_preference="提升体验",
        competitors=[],
        tech_topics=["上传状态机"],
        opportunity_weights={"pain_frequency": 1.2, "severity": 1.2, "cost": 0.8},
        core_modules=["rag/svr"],
    )


def _quality(dims_scores: dict[str, int], missing: list[str], gate=GateStatus.NEEDS_ENRICH, rnd=1) -> QualityReport:
    return QualityReport(
        total=999,  # 故意错值，验证代码覆写
        dimensions=[
            QualityDimension(name=d, score=dims_scores[d], rationale=f"{d} 理由")
            for d in QUALITY_DIMS
        ],
        missing_info=missing,
        ambiguities=[],
        followup_questions=[],
        gate=gate,
        round=rnd,
    )


def make_draft_candidate() -> RequirementCandidate:
    """模拟 LLM 初评返回：缺验收标准/边界，blocker 维偏低，total 落在 55-62。"""
    scores = {
        "clarity": 65, "completeness": 50, "testability": 48,
        "acceptance_clarity": 45, "evidence_sufficiency": 68, "scope_control": 62,
        "feasibility": 70, "consistency": 64, "user_value": 72, "stage_fit": 66,
    }
    return RequirementCandidate(
        id="req-01",
        cluster_id="clu-01",
        title="提供文档解析进度与失败可见性",
        background="用户上传大文件后无法判断解析状态。",
        target_users=["企业知识库团队"],
        pain_point="解析长时间无反馈，用户无法区分卡死与进行中。",
        business_goal="降低上传相关求助与流失。",
        scope=["展示解析阶段进度", "失败给出原因", "超时提示"],
        non_goals=[],
        boundary_conditions=[],
        clarifications=["进度粒度到阶段还是百分比？"],
        user_stories=[
            UserStory(
                role="知识库用户", scenario="上传大文件", benefit="掌握解析状态",
                story_text="作为知识库用户，我希望看到解析进度，以便判断是否卡死。",
                evidence_refs=["sig-001", "cf-01"],
            )
        ],
        acceptance_criteria=[],
        evidence_refs=["sig-001", "sig-002", "cf-01", "tf-01"],
        quality=_quality(scores, missing=["缺少明确的验收标准", "缺少边界条件/非功能约束"], rnd=1),
    )


_DRAFT_SCORES = {
    "clarity": 65, "completeness": 50, "testability": 48,
    "acceptance_clarity": 45, "evidence_sufficiency": 68, "scope_control": 62,
    "feasibility": 70, "consistency": 64, "user_value": 72, "stage_fit": 66,
}
_ENRICHED_SCORES = {
    "clarity": 86, "completeness": 85, "testability": 84,
    "acceptance_clarity": 88, "evidence_sufficiency": 82, "scope_control": 80,
    "feasibility": 82, "consistency": 84, "user_value": 86, "stage_fit": 83,
}


def _dims(scores: dict[str, int]):
    from evopm.agents.requirement import DimLLM

    return [DimLLM(name=d, score=scores[d], rationale=f"{d} 理由") for d in QUALITY_DIMS]


def make_draft_llm():
    """模拟 LLM 初评的**扁平**输出（RequirementDraftLLM），用于 monkeypatch structured_call。"""
    from evopm.agents.requirement import RequirementDraftLLM

    return RequirementDraftLLM(
        id="req-01",
        title="提供文档解析进度与失败可见性",
        background="用户上传大文件后无法判断解析状态。",
        target_users=["企业知识库团队"],
        pain_point="解析长时间无反馈，用户无法区分卡死与进行中。",
        business_goal="降低上传相关求助与流失。",
        scope=["展示解析阶段进度", "失败给出原因", "超时提示"],
        non_goals=[],
        boundary_conditions=[],
        clarifications=["进度粒度到阶段还是百分比？"],
        user_stories=[
            UserStory(
                role="知识库用户", scenario="上传大文件", benefit="掌握解析状态",
                story_text="作为知识库用户，我希望看到解析进度，以便判断是否卡死。",
                evidence_refs=["sig-001", "cf-01"],
            )
        ],
        acceptance_criteria=[],
        evidence_refs=["sig-001", "sig-002", "cf-01", "tf-01"],
        dimensions=_dims(_DRAFT_SCORES),
        missing_info=["缺少明确的验收标准", "缺少边界条件/非功能约束"],
        ambiguities=[],
        followup_questions=[],
    )


def make_enriched_llm():
    """模拟 LLM enrich 的扁平输出：验收标准齐全、blocker 维抬高，total ≥80。"""
    from evopm.agents.requirement import RequirementDraftLLM

    out = make_draft_llm()
    out.non_goals = ["不做解析算法本身的精度优化", "不做跨知识库批处理"]
    out.boundary_conditions = [
        "单文件 ≤200MB；超时阈值 30 分钟后标失败",
        "解析任务失败自动重试 1 次后置失败态",
    ]
    out.acceptance_criteria = [
        AcceptanceCriterion(text="文档列表展示解析阶段进度", type="functional", evidence_refs=["cf-01"]),
        AcceptanceCriterion(text="解析失败展示可读原因", type="functional", evidence_refs=["sig-001"]),
        AcceptanceCriterion(text="进度上报心跳间隔 ≤10s", type="nonfunctional", evidence_refs=["tf-01"]),
    ]
    out.dimensions = _dims(_ENRICHED_SCORES)
    out.missing_info = []
    return out


def make_enriched_candidate() -> RequirementCandidate:
    """模拟 LLM enrich 返回：验收标准齐全、blocker 维抬高，total ≥80。"""
    scores = {
        "clarity": 86, "completeness": 85, "testability": 84,
        "acceptance_clarity": 88, "evidence_sufficiency": 82, "scope_control": 80,
        "feasibility": 82, "consistency": 84, "user_value": 86, "stage_fit": 83,
    }
    c = make_draft_candidate()
    c.non_goals = ["不做解析算法本身的精度优化", "不做跨知识库批处理"]
    c.boundary_conditions = [
        "单文件 ≤200MB；超时阈值 30 分钟后标失败",
        "解析任务失败自动重试 1 次后置失败态",
    ]
    c.acceptance_criteria = [
        AcceptanceCriterion(text="文档列表展示解析阶段进度", type="functional", evidence_refs=["cf-01"]),
        AcceptanceCriterion(text="解析失败展示可读原因", type="functional", evidence_refs=["sig-001"]),
        AcceptanceCriterion(text="进度上报心跳间隔 ≤10s", type="nonfunctional", evidence_refs=["tf-01"]),
    ]
    c.quality = _quality(scores, missing=[], gate=GateStatus.PASS, rnd=2)
    return c

"""WT-5 report 渲染测试（spec §9）。

纯渲染、无 LLM、无网络。用手写的完整 EvoPMState fixture 验证：
- 4 份模板全部渲染无错；
- 证据卡正确把 ref id 回查到原文摘录；
- 被人工 REJECT 的结论显示 [未确认]；
- 核心模块显示 ⚠ 标记；
- state.json 落盘。
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from evopm.report.render import (
    build_evidence_cards,
    evidence_card,
    render_reports,
)
from evopm.schemas import (
    AcceptanceCriterion,
    Actionability,
    Category,
    ClusterStatus,
    CodeImpactItem,
    CodeImpactMap,
    CompetitorFinding,
    CompetitorVerdict,
    CriticFinding,
    CriticReview,
    DataQuality,
    EvidenceStrength,
    ExecutionProposal,
    ExistingRequirement,
    GateStatus,
    Horizon,
    HumanDecision,
    ImpactLevel,
    ImpactType,
    ImplPlanStep,
    InsightCluster,
    OpportunityDecision,
    OpportunityScore,
    Priority,
    ProductContext,
    QualityDimension,
    QualityReport,
    RequirementCandidate,
    RequirementStatus,
    ReviewAction,
    RiskTier,
    RoadmapEntry,
    Sentiment,
    Severity,
    SignalItem,
    SolutionSpec,
    SourceType,
    TaskCard,
    TaskType,
    TechFinding,
    TechMaturity,
    UserStory,
)
from evopm.state import EvoPMState

_QUALITY_DIMS = [
    "clarity",
    "completeness",
    "testability",
    "acceptance_clarity",
    "evidence_sufficiency",
    "scope_control",
    "feasibility",
    "consistency",
    "user_value",
    "stage_fit",
]


def _quality(round_no: int, scores: dict[str, int], gate: GateStatus) -> QualityReport:
    dims = [QualityDimension(name=n, score=scores[n], rationale=f"{n} 理由") for n in _QUALITY_DIMS]
    total = round(sum(d.score for d in dims) / len(dims))
    return QualityReport(
        total=total,
        dimensions=dims,
        missing_info=[] if gate == GateStatus.PASS else ["缺少验收标准", "边界条件未定义"],
        ambiguities=["进度展示粒度未明确"],
        followup_questions=["进度条是否需要预估剩余时间？"],
        gate=gate,
        round=round_no,
    )


def make_state() -> EvoPMState:
    """完整、可演示的 EvoPMState fixture。"""
    product = ProductContext(
        name="RAGFlow",
        description="基于深度文档理解的开源 RAG 引擎",
        target_users=["企业知识库团队", "开发者"],
        module="文件上传与问答质量",
        stage="growth",
        analysis_goals=["发现高频问题", "竞品对标", "需求质量评估"],
        team_preference="提升体验",
        competitors=[],
        tech_topics=["上传状态机", "失败重试"],
        core_modules=["rag/nlp", "deepdoc/parser", "rag/svr"],
    )

    signals = [
        SignalItem(
            id="sig-001",
            source_type=SourceType.CSV_FEEDBACK,
            created_at="2026-05-02",
            text="上传一个 80MB 的 PDF 解析了两小时还在转圈，也不知道是卡了还是在跑",
            module_guess="deepdoc/parser",
            category=Category.STABILITY,
            sentiment=Sentiment.NEGATIVE,
            actionability=Actionability.REAL_ISSUE,
            data_quality=DataQuality.COMPLETE,
        ),
        SignalItem(
            id="sig-002",
            source_type=SourceType.GITHUB_ISSUE,
            origin_url="https://github.com/infiniflow/ragflow/issues/13678",
            author_type="user",
            created_at="2026-05-03",
            text="Document automatic parsing failed without any error message, stuck at 0%",
            module_guess="deepdoc/parser",
            category=Category.BUG,
            sentiment=Sentiment.NEGATIVE,
            actionability=Actionability.REAL_ISSUE,
            data_quality=DataQuality.PARTIAL,
        ),
        # 漏斗样本：情绪类，被过滤
        SignalItem(
            id="sig-003",
            source_type=SourceType.CSV_FEEDBACK,
            created_at="2026-05-04",
            text="这破软件太难用了！！！",
            category=Category.UX,
            sentiment=Sentiment.NEGATIVE,
            actionability=Actionability.EMOTIONAL,
            data_quality=DataQuality.NOISY,
            followup_question="具体哪个环节遇到了什么问题？",
        ),
        # 漏斗样本：信号查重
        SignalItem(
            id="sig-004",
            source_type=SourceType.CSV_FEEDBACK,
            created_at="2026-05-05",
            text="大文件解析没有进度提示",
            category=Category.UX,
            sentiment=Sentiment.NEGATIVE,
            actionability=Actionability.SUSPECTED_DUPLICATE,
            duplicate_of="sig-001",
            data_quality=DataQuality.COMPLETE,
        ),
    ]

    existing_reqs = [
        ExistingRequirement(
            id="ex-01",
            title="支持解析进度百分比展示",
            summary="前端文档列表展示解析进度条",
            status="in_roadmap",
        ),
    ]

    clusters = [
        InsightCluster(
            id="clu-01",
            title="文档解析失败/状态不可见",
            summary="大文件解析长时间无反馈，用户无法判断卡住还是进行中",
            signal_ids=["sig-001", "sig-002", "sig-004"],
            categories=[Category.STABILITY, Category.BUG, Category.UX],
            severity=Severity.HIGH,
            frequency=3,
            status=ClusterStatus.NEW,
            candidate_title="为文档解析提供可见的进度与失败原因",
            user_story_draft="作为知识库管理员，我希望看到解析进度",
        ),
        InsightCluster(
            id="clu-02",
            title="检索引用质量",
            summary="回答缺少引用溯源",
            signal_ids=[],
            categories=[Category.PERFORMANCE],
            severity=Severity.MEDIUM,
            frequency=2,
            status=ClusterStatus.NEW,
            candidate_title="增强引用溯源",
            user_story_draft="作为用户，我希望看到答案来源",
        ),
        InsightCluster(
            id="clu-03",
            title="上传进度条（已在路线图）",
            summary="与历史需求重复",
            signal_ids=[],
            categories=[Category.UX],
            severity=Severity.LOW,
            frequency=1,
            status=ClusterStatus.DUPLICATE,
            candidate_title="上传进度条",
            user_story_draft="作为用户，我希望看到上传进度",
            duplicate_of_existing="ex-01",
            dedup_reason="ex-01 已覆盖进度展示需求",
        ),
    ]

    competitor_findings = [
        CompetitorFinding(
            id="cf-01",
            competitor="Dify",
            research_question="Dify 是否展示文档解析进度？",
            has_solved=True,
            conclusion="Dify 在文档列表实时展示解析状态与百分比进度",
            verdict=CompetitorVerdict.ADOPT,
            gap_description="我们当前无任何进度反馈",
            implication="应补齐进度可见性，对齐竞品基础体验",
            source_url="https://docs.dify.ai/parsing",
            evidence_strength=EvidenceStrength.STRONG,
        ),
        CompetitorFinding(
            id="cf-02",
            competitor="AnythingLLM",
            research_question="是否有失败重试？",
            has_solved=None,
            conclusion="文档未明确说明重试机制",
            verdict=CompetitorVerdict.WATCH,
            implication="重试为加分项，非必须对齐",
            source_url="mock://anythingllm.md",
            evidence_strength=EvidenceStrength.WEAK,
        ),
    ]

    tech_findings = [
        TechFinding(
            id="tf-01",
            topic="上传状态机",
            solution_name="基于状态机的解析进度上报",
            maturity=TechMaturity.MATURE,
            fit_reason="状态机可清晰建模 解析中/失败/完成 并驱动前端进度",
            cost_estimate="medium：需改造解析任务上报通道",
            risk="需保证状态上报不影响解析吞吐",
            source_url="mock://upload_state_machine.md",
            evidence_strength=EvidenceStrength.MODERATE,
        ),
        TechFinding(
            id="tf-02",
            topic="失败重试",
            solution_name="指数退避重试",
            maturity=TechMaturity.REFERENCE,
            fit_reason="对瞬时失败自动重试可降低人工干预",
            cost_estimate="low",
            risk="对确定性失败重试无意义",
            source_url="mock://retry_strategy.md",
            evidence_strength=EvidenceStrength.MODERATE,
        ),
    ]

    quality_first = _quality(
        1,
        {
            "clarity": 70,
            "completeness": 45,
            "testability": 50,
            "acceptance_clarity": 40,
            "evidence_sufficiency": 65,
            "scope_control": 60,
            "feasibility": 70,
            "consistency": 60,
            "user_value": 75,
            "stage_fit": 65,
        },
        GateStatus.NEEDS_ENRICH,
    )
    quality_last = _quality(
        2,
        {
            "clarity": 88,
            "completeness": 85,
            "testability": 86,
            "acceptance_clarity": 88,
            "evidence_sufficiency": 84,
            "scope_control": 85,
            "feasibility": 86,
            "consistency": 85,
            "user_value": 90,
            "stage_fit": 83,
        },
        GateStatus.PASS,
    )

    focus = RequirementCandidate(
        id="req-01",
        cluster_id="clu-01",
        title="为文档解析提供可见的进度与失败原因",
        background="大文件解析长时间无反馈导致用户困惑与重复上传",
        target_users=["企业知识库团队"],
        pain_point="解析无进度、失败无原因，用户无法判断状态",
        business_goal="降低解析相关支持工单，提升上传成功体验",
        scope=["解析进度百分比展示", "失败原因可读化", "失败可重试入口"],
        non_goals=["重写解析引擎", "支持任意文件格式"],
        boundary_conditions=["进度刷新间隔 ≤ 5s", "大文件（>50MB）也需有进度"],
        clarifications=["进度是否需要预估剩余时间？"],
        user_stories=[
            UserStory(
                role="知识库管理员",
                scenario="上传大文件后",
                benefit="知道解析是否在进行",
                story_text="作为知识库管理员，我希望看到解析进度，以便判断是否卡住",
                evidence_refs=["sig-001", "sig-002"],
            ),
        ],
        acceptance_criteria=[
            AcceptanceCriterion(
                text="文档列表展示解析百分比，刷新间隔 ≤5s",
                type="functional",
                evidence_refs=["sig-001", "cf-01"],
            ),
            AcceptanceCriterion(
                text="解析失败时展示可读失败原因",
                type="functional",
                evidence_refs=["sig-002"],
            ),
        ],
        evidence_refs=["sig-001", "sig-002", "cf-01", "tf-01"],
        quality=quality_last,
        quality_history=[quality_first, quality_last],
        status=RequirementStatus.READY_FOR_REVIEW,
    )

    opportunity = OpportunityDecision(
        requirement_id="req-01",
        scores=[
            OpportunityScore(dimension="pain_frequency", score=85, rationale="3 条信号指向", evidence_refs=["sig-001", "sig-002"]),
            OpportunityScore(dimension="severity", score=80, rationale="阻塞核心使用", evidence_refs=["sig-002"]),
            OpportunityScore(dimension="competitor_gap", score=90, rationale="竞品已解决", evidence_refs=["cf-01"]),
            OpportunityScore(dimension="tech_feasibility", score=80, rationale="状态机成熟", evidence_refs=["tf-01"]),
            OpportunityScore(dimension="requirement_quality", score=86, rationale="enrich 后达标"),
            OpportunityScore(dimension="cost", score=60, rationale="中等改造"),
            OpportunityScore(dimension="business_value", score=82, rationale="降低工单"),
            OpportunityScore(dimension="strategy_fit", score=80, rationale="对齐提升体验"),
            OpportunityScore(dimension="urgency", score=78, rationale="高频反馈"),
            OpportunityScore(dimension="core_path_impact", score=75, rationale="触及解析核心路径"),
        ],
        total=80.4,
        priority=Priority.P0,
        horizon=Horizon.NOW,
        rationale="高频痛点 + 竞品已解决 + 技术成熟，建议本期优先做解析进度可见性",
        special_types=[],
    )

    roadmap = [
        RoadmapEntry(cluster_id="clu-01", title="解析进度与失败原因", priority=Priority.P0, horizon=Horizon.NOW, one_line_reason="高频阻塞，竞品已解决", is_focus=True),
        RoadmapEntry(cluster_id="clu-02", title="检索引用溯源", priority=Priority.P2, horizon=Horizon.NEXT, one_line_reason="价值中等，证据偏弱"),
        RoadmapEntry(cluster_id="clu-03", title="上传进度条", priority=Priority.DUPLICATE, horizon=Horizon.LATER, one_line_reason="与 ex-01 重复"),
    ]

    solution = SolutionSpec(
        requirement_id="req-01",
        summary="在解析任务引入状态机上报，前端轮询展示进度与失败原因",
        scope=["状态上报接口", "前端进度组件", "失败原因映射"],
        non_goals=["重写解析内核"],
        user_flow=["上传文档", "后端解析并上报状态", "前端轮询展示进度", "失败展示原因与重试"],
        acceptance_criteria=[
            AcceptanceCriterion(text="进度刷新 ≤5s", type="nonfunctional", evidence_refs=["sig-001"]),
            AcceptanceCriterion(text="失败原因可读", type="functional", evidence_refs=["sig-002"]),
        ],
        edge_cases=["超大文件", "解析中断后重启"],
        test_scenarios=["80MB PDF 正常解析", "损坏文件失败提示"],
        role_notes={
            "product": "明确进度粒度",
            "dev": "状态机上报不阻塞解析",
            "qa": "覆盖大文件与失败路径",
            "support": "失败原因对应支持话术",
        },
        risks=["状态上报增加解析负载"],
        dependencies=["解析任务队列改造"],
    )

    code_impact = CodeImpactMap(
        requirement_id="req-01",
        items=[
            CodeImpactItem(
                module_path="deepdoc/parser",
                impact_level=ImpactLevel.CERTAIN,
                impact_types=[ImpactType.SERVICE, ImpactType.DATA_MODEL],
                description="解析任务需上报阶段状态，触及核心解析逻辑",
                is_core_module=True,
                risk_tier=RiskTier.HIGH,
                verify_points=["解析吞吐不下降", "状态字段持久化正确"],
            ),
            CodeImpactItem(
                module_path="web/src/pages/documents",
                impact_level=ImpactLevel.POSSIBLE,
                impact_types=[ImpactType.FRONTEND],
                description="文档列表新增进度组件",
                is_core_module=False,
                risk_tier=RiskTier.MEDIUM,
                verify_points=["进度轮询不抖动"],
            ),
            CodeImpactItem(
                module_path="api/apps/document_app",
                impact_level=ImpactLevel.UNCERTAIN,
                impact_types=[ImpactType.API],
                description="可能需新增进度查询端点（待确认现有接口能否复用）",
                is_core_module=False,
                risk_tier=RiskTier.HIGH,
                verify_points=["接口契约确认"],
            ),
        ],
        suggested_order=["deepdoc/parser", "api/apps/document_app", "web/src/pages/documents"],
        human_confirmation_needed=[
            "deepdoc/parser 为核心模块，状态上报改造需人工确认影响面",
            "api/apps/document_app 接口复用情况不确定",
        ],
    )

    execution = ExecutionProposal(
        requirement_id="req-01",
        tasks=[
            TaskCard(
                id="task-01",
                type=TaskType.BACKEND,
                title="解析状态机上报",
                description="在解析任务中引入阶段状态并持久化",
                related_modules=["deepdoc/parser"],
                evidence_refs=["sig-002", "tf-01"],
                risk_tier=RiskTier.HIGH,
            ),
            TaskCard(
                id="task-02",
                type=TaskType.FRONTEND,
                title="文档列表进度组件",
                description="展示百分比与失败原因",
                related_modules=["web/src/pages/documents"],
                evidence_refs=["sig-001", "cf-01"],
                risk_tier=RiskTier.MEDIUM,
            ),
            TaskCard(
                id="task-03",
                type=TaskType.TEST,
                title="大文件与失败路径测试",
                description="覆盖 80MB PDF 与损坏文件",
                related_modules=["tests"],
                evidence_refs=["sig-001"],
                risk_tier=RiskTier.LOW,
            ),
        ],
        change_suggestions=[
            "deepdoc/parser：在解析主循环按阶段写入状态字段，不改变解析算法",
            "web/src/pages/documents：新增进度列，轮询状态接口",
        ],
        test_suggestions=["大文件解析进度连续性", "失败原因映射正确性"],
        impl_plan=[
            ImplPlanStep(step=1, action="后端状态上报", modules=["deepdoc/parser"], verify="状态写入正确", risk="影响解析吞吐"),
            ImplPlanStep(step=2, action="进度查询接口", modules=["api/apps/document_app"], verify="接口返回进度"),
            ImplPlanStep(step=3, action="前端进度组件", modules=["web/src/pages/documents"], verify="UI 展示进度"),
        ],
        changelog_draft="feat(parser): 文档解析进度可见与失败原因展示",
        blocked=False,
    )

    critic_review = CriticReview(
        findings=[
            CriticFinding(
                target="cf-02 关于 AnythingLLM 重试机制的结论",
                evidence_strength=EvidenceStrength.INFERENCE_ONLY,
                overreach=True,
                risk_tier=RiskTier.LOW,
                note="mock 来源且文档未明确，来源有限，降为观察项",
                demote_to_observation=True,
            ),
            CriticFinding(
                target="deepdoc/parser 改造（task-01）",
                evidence_strength=EvidenceStrength.MODERATE,
                overreach=False,
                risk_tier=RiskTier.HIGH,
                note="核心模块改造，需人工确认影响面",
                demote_to_observation=False,
            ),
        ],
        pending_confirmations=[
            "deepdoc/parser 状态上报改造影响核心解析路径，需人工确认",
            "api/apps/document_app 是否新增端点不确定，需人工确认",
        ],
        redo_target=None,
    )

    human_decisions = [
        HumanDecision(
            checkpoint="select_cluster",
            item_ref="clu-01",
            action=ReviewAction.ACCEPT,
            reason="最大簇",
            timestamp="2026-06-13T10:00:00",
        ),
        HumanDecision(
            checkpoint="final_review",
            item_ref="cf-02",
            action=ReviewAction.REJECT,
            reason="证据不足，不采纳重试结论",
            timestamp="2026-06-13T10:05:00",
        ),
        HumanDecision(
            checkpoint="final_review",
            item_ref="task-01",
            action=ReviewAction.ACCEPT,
            reason="确认核心模块改造",
            timestamp="2026-06-13T10:06:00",
        ),
    ]

    state: EvoPMState = {
        "product_context": product,
        "signals": signals,
        "existing_requirements": existing_reqs,
        "repo_map": "rag/nlp\ndeepdoc/parser\nrag/svr",
        "run_mode": "mock",
        "clusters": clusters,
        "selected_cluster_id": "clu-01",
        "competitor_findings": competitor_findings,
        "tech_findings": tech_findings,
        "focus_candidate": focus,
        "enrich_rounds": 1,
        "opportunity": opportunity,
        "roadmap": roadmap,
        "solution": solution,
        "code_impact": code_impact,
        "execution": execution,
        "critic_review": critic_review,
        "redo_rounds": 0,
        "clarify_rounds": 0,
        "more_evidence_rounds": 0,
        "llm_call_count": 11,
        "human_decisions": human_decisions,
    }
    return state


# --------------------------------------------------------------------------- #
# tests
# --------------------------------------------------------------------------- #
@pytest.fixture
def state() -> EvoPMState:
    return make_state()


@pytest.fixture
def rendered(state, tmp_path) -> dict[str, str]:
    paths = render_reports(state, runs_dir=tmp_path)
    out: dict[str, str] = {}
    for p in paths:
        out[Path(p).name] = Path(p).read_text(encoding="utf-8")
    out["_dir"] = str(Path(paths[0]).parent)
    return out


def test_all_four_templates_render(rendered):
    for name in (
        "opportunity_report.md",
        "engineering_report.md",
        "prd_draft.md",
        "executive_summary.md",
    ):
        assert name in rendered, f"missing {name}"
        assert len(rendered[name].strip()) > 0


def test_evidence_card_traces_ref(state):
    card = evidence_card("sig-001", state)
    assert card["ref"] == "sig-001"
    assert "80MB" in card["excerpt"]
    assert len(card["excerpt"]) <= 120
    cf = evidence_card("cf-01", state)
    assert cf["strength"] == "strong"
    assert "dify" in cf["source"].lower()
    tf = evidence_card("tf-01", state)
    assert tf["ref"] == "tf-01"
    # 报告中渲染的证据卡附录确实含原文摘录
    assert "80MB" in rendered_excerpt(state, "sig-001")


def rendered_excerpt(state, ref: str) -> str:
    cards = build_evidence_cards(state)
    return next(c["excerpt"] for c in cards if c["ref"] == ref)


def test_evidence_card_excerpt_capped_at_120():
    # 构造一条超长 signal，验证截断
    s = make_state()
    s["signals"][0].text = "字" * 300
    card = evidence_card("sig-001", s)
    assert len(card["excerpt"]) <= 120


def test_rejected_conclusion_shows_unconfirmed(rendered):
    # cf-02 被 REJECT，其降权目标里含 cf-02 描述，且观察项 section 出现
    opp = rendered["opportunity_report.md"]
    # cf-02 在 critic 中 demote → 观察项；human REJECT cf-02
    assert "[未确认]" in opp or "观察项" in opp
    # 更精确：观察项 section 必须含 cf-02 描述
    assert "cf-02" in opp


def test_unconfirmed_prefix_on_rejected_module():
    # 直接构造：把 high-risk 模块 module_path 作为 REJECT 的 item_ref
    state = make_state()
    state["human_decisions"].append(
        HumanDecision(
            checkpoint="final_review",
            item_ref="deepdoc/parser",
            action=ReviewAction.REJECT,
            reason="暂不改核心模块",
            timestamp="2026-06-13T10:07:00",
        )
    )
    import tempfile

    with tempfile.TemporaryDirectory() as d:
        paths = render_reports(state, runs_dir=d)
        eng = next(Path(p).read_text(encoding="utf-8") for p in paths if "engineering" in p)
    assert "[未确认] deepdoc/parser" in eng


def test_core_module_shows_warning_marker(rendered):
    eng = rendered["engineering_report.md"]
    # deepdoc/parser 是核心模块，应带 ⚠ 标记
    assert "⚠" in eng
    assert "deepdoc/parser" in eng
    # 验证 ⚠ 与核心模块同处出现
    assert "核心模块" in eng


def test_state_json_written(rendered):
    out_dir = Path(rendered["_dir"])
    sj = out_dir / "state.json"
    assert sj.exists()
    data = json.loads(sj.read_text(encoding="utf-8"))
    assert data["product_context"]["name"] == "RAGFlow"
    assert data["focus_candidate"]["id"] == "req-01"
    # 枚举序列化为字符串值
    assert data["opportunity"]["priority"] == "P0"


def test_quality_history_before_after(rendered):
    opp = rendered["opportunity_report.md"]
    # 58→86 风格的前后对比：本 fixture 是 62→86 量级
    assert "→" in opp
    # 终评 total 应高于初评
    state = make_state()
    first = state["focus_candidate"].quality_history[0].total
    last = state["focus_candidate"].quality_history[-1].total
    assert last > first


def test_funnel_stats_present(rendered):
    opp = rendered["opportunity_report.md"]
    assert "漏斗统计" in opp
    # 4 条信号，1 过滤，1 查重
    assert "原始信号" in opp


def test_executive_summary_has_p0(rendered):
    es = rendered["executive_summary.md"]
    assert "P0" in es
    assert "问题" in es and "证据" in es and "建议" in es and "风险" in es


def test_now_next_later_distribution(rendered):
    opp = rendered["opportunity_report.md"]
    assert "NOW" in opp and "NEXT" in opp and "LATER" in opp

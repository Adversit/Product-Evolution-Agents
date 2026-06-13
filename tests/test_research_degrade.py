"""ResearchAgent 降级路径单测（T2.1/T2.2 容错合同，spec §11.2/§11.4）。

不需要 API key：monkeypatch ``llm.web_search_call`` 与 ``llm.structured_call``，验证：
- 单项搜索失败 → 仅该项降级 mock，其余照常（§11.4 单项隔离）；
- mock 单元 source_url 强制 ``mock://<文件名>``、evidence_strength 封顶 moderate（§11.2）；
- ``--mock`` 模式完全不触发 web_search；
- prompt（含 {{include:_evidence_rules.md}}）能被 load_prompt 解析。
- 干净导入。
"""

from __future__ import annotations

import pytest

from evopm import llm
from evopm.agents.base import load_prompt
from evopm.agents.research import (
    CompetitorOutput,
    ResearchAgent,
    ResearchQuestions,
    TechOutput,
    _cap_strength,
)
from evopm.schemas import (
    Category,
    ClusterStatus,
    CompetitorConfig,
    CompetitorFinding,
    CompetitorVerdict,
    EvidenceStrength,
    InsightCluster,
    ProductContext,
    Severity,
    TechFinding,
    TechMaturity,
)


# --------------------------------------------------------------------------- #
# fixtures
# --------------------------------------------------------------------------- #
def _cluster() -> InsightCluster:
    return InsightCluster(
        id="clu-01",
        title="解析失败且状态不可见",
        summary="文档解析卡住，用户无法判断进度",
        signal_ids=["sig-001"],
        categories=[Category.BUG, Category.UX],
        severity=Severity.HIGH,
        frequency=6,
        status=ClusterStatus.NEW,
        candidate_title="解析进度可视化与失败重试",
        user_story_draft="作为用户我希望看到解析进度",
    )


def _product_context() -> ProductContext:
    return ProductContext(
        name="RAGFlow",
        description="RAG 引擎",
        target_users=["开发者"],
        module="文件上传与问答质量",
        stage="growth",
        analysis_goals=["竞品对标"],
        team_preference="提升体验",
        competitors=[
            CompetitorConfig(name="Dify", homepage="", mock_file="dify.md"),
            CompetitorConfig(name="Open WebUI", homepage="", mock_file="open_webui.md"),
            CompetitorConfig(name="AnythingLLM", homepage="", mock_file="anythingllm.md"),
        ],
        tech_topics=["上传状态机", "失败重试", "chunk preview"],
    )


def _patch_questions(monkeypatch):
    """把第一步 structured_call（问题生成）固定为 3 个问题。"""

    def fake_structured_call(schema, system, user, model=None, use_cache=True):
        if schema is ResearchQuestions:
            return ResearchQuestions(questions=["Q1", "Q2", "Q3"])
        raise AssertionError("unexpected schema in questions patch")

    monkeypatch.setattr(llm, "structured_call", fake_structured_call)


# --------------------------------------------------------------------------- #
# 1. mock 模式：完全不触发 web_search，全部单元读 mock
# --------------------------------------------------------------------------- #
def test_mock_mode_never_calls_web_search(monkeypatch):
    called = {"n": 0}

    def boom(*a, **k):
        called["n"] += 1
        raise AssertionError("mock 模式不应调用 web_search")

    monkeypatch.setattr(llm, "web_search_call", boom)

    agent = ResearchAgent(mode="competitor")
    units = agent._gather_units(_cluster(), _product_context(), ["Q1"], run_mode="mock")

    assert called["n"] == 0
    assert len(units) == 3
    assert all(u.is_mock for u in units)
    assert {u.key for u in units} == {"Dify", "Open WebUI", "AnythingLLM"}
    # mock 文件名取自 competitor 配置
    assert {u.mock_filename for u in units} == {"dify.md", "open_webui.md", "anythingllm.md"}
    assert all(u.material and "（无" not in u.material for u in units)


# --------------------------------------------------------------------------- #
# 2. 单项搜索失败仅降级该项，其余项保持联网（§11.4 单项隔离）
# --------------------------------------------------------------------------- #
def test_per_item_degradation_isolates_failure(monkeypatch):
    def selective_search(query, count=5):
        if "Open WebUI" in query:
            raise llm.WebSearchUnavailable("boom")
        return [
            llm.SearchResult(title="t", url="https://example.com/x", snippet="live snippet")
        ]

    monkeypatch.setattr(llm, "web_search_call", selective_search)

    agent = ResearchAgent(mode="competitor")
    units = agent._gather_units(_cluster(), _product_context(), ["Q1"], run_mode="live")

    by_key = {u.key: u for u in units}
    assert by_key["Dify"].is_mock is False
    assert by_key["AnythingLLM"].is_mock is False
    assert by_key["Open WebUI"].is_mock is True  # 仅这一项降级
    assert by_key["Open WebUI"].mock_filename == "open_webui.md"


# --------------------------------------------------------------------------- #
# 3. _postprocess：mock 单元 → mock:// + 封顶 moderate
# --------------------------------------------------------------------------- #
def test_postprocess_caps_mock_competitor_findings():
    agent = ResearchAgent(mode="competitor")
    units = agent._gather_units(_cluster(), _product_context(), ["Q1"], run_mode="mock")
    findings = [
        CompetitorFinding(
            id="cf-01",
            competitor="Dify",
            research_question="Q1",
            conclusion="c",
            verdict=CompetitorVerdict.ADOPT,
            implication="i",
            source_url="https://hallucinated.example.com",  # LLM 编的，应被覆盖
            evidence_strength=EvidenceStrength.STRONG,  # 应被封顶
        )
    ]
    agent._postprocess(findings, units)

    assert findings[0].source_url == "mock://dify.md"
    assert findings[0].evidence_strength == EvidenceStrength.MODERATE


def test_postprocess_caps_mock_tech_findings_by_source_url():
    agent = ResearchAgent(mode="tech")
    units = agent._gather_units(_cluster(), _product_context(), ["Q1"], run_mode="mock")
    # tech 模式 topic 可能被 LLM 改写措辞；靠 source_url 已是 mock:// 识别
    findings = [
        TechFinding(
            id="tf-01",
            topic="改写后的措辞",
            solution_name="状态机",
            maturity=TechMaturity.MATURE,
            fit_reason="支持进度展示",
            cost_estimate="medium",
            risk="改动队列",
            source_url="mock://upload_state_machine.md",
            evidence_strength=EvidenceStrength.STRONG,
        )
    ]
    agent._postprocess(findings, units)
    assert findings[0].evidence_strength == EvidenceStrength.MODERATE


def test_postprocess_tech_topic_match_caps():
    """tech 单元 key 与 finding.topic 精确一致时按 key 命中封顶。"""
    agent = ResearchAgent(mode="tech")
    units = agent._gather_units(_cluster(), _product_context(), ["Q1"], run_mode="mock")
    topic = units[0].key
    findings = [
        TechFinding(
            id="tf-01",
            topic=topic,
            solution_name="x",
            maturity=TechMaturity.MATURE,
            fit_reason="r",
            cost_estimate="low",
            risk="r",
            source_url="https://bogus.example.com",
            evidence_strength=EvidenceStrength.STRONG,
        )
    ]
    agent._postprocess(findings, units)
    assert findings[0].source_url.startswith("mock://")
    assert findings[0].evidence_strength == EvidenceStrength.MODERATE


# --------------------------------------------------------------------------- #
# 4. _cap_strength 边界
# --------------------------------------------------------------------------- #
def test_cap_strength_only_lowers_strong():
    assert _cap_strength(EvidenceStrength.STRONG) == EvidenceStrength.MODERATE
    assert _cap_strength(EvidenceStrength.MODERATE) == EvidenceStrength.MODERATE
    assert _cap_strength(EvidenceStrength.WEAK) == EvidenceStrength.WEAK
    assert _cap_strength(EvidenceStrength.NO_DIRECT) == EvidenceStrength.NO_DIRECT


# --------------------------------------------------------------------------- #
# 5. tech 关键词组装：cluster categories + tech_topics 去重保序
# --------------------------------------------------------------------------- #
def test_tech_keywords_dedup_and_order():
    agent = ResearchAgent(mode="tech")
    kws = agent._tech_keywords(_cluster(), _product_context())
    # categories: bug, ux ; tech_topics: 上传状态机/失败重试/chunk preview
    assert kws[0] == "bug"
    assert "上传状态机" in kws
    assert len(kws) == len(set(kws))  # 无重复
    assert len(kws) <= 8


def test_tech_match_note_falls_back_to_all_when_no_match():
    agent = ResearchAgent(mode="tech")
    material, filename = agent._read_mock("完全不存在的关键词zzz", "")
    assert material  # 兜底拼接全部 tech_notes，不为空
    assert filename == "tech_notes/*"


# --------------------------------------------------------------------------- #
# 6. mode 校验 + prompt include 解析
# --------------------------------------------------------------------------- #
def test_invalid_mode_rejected():
    with pytest.raises(ValueError):
        ResearchAgent(mode="bogus")


def test_prompts_load_with_include():
    for fname in ("research_competitor.md", "research_tech.md"):
        text = load_prompt(fname)
        assert "证据引用规则" in text  # include 片段被拼入
        assert "{{include" not in text  # 占位符已被替换


def test_agent_prompt_file_bound_by_mode():
    assert ResearchAgent(mode="competitor").prompt_file == "research_competitor.md"
    assert ResearchAgent(mode="tech").prompt_file == "research_tech.md"
    # system_prompt 属性能成功加载（间接验证 prompt 文件存在）
    assert "竞品" in ResearchAgent(mode="competitor").system_prompt


# --------------------------------------------------------------------------- #
# 7. run() 全流程（patched）：mock 模式下产出并被 postprocess 约束
# --------------------------------------------------------------------------- #
def test_run_mock_end_to_end_with_patched_llm(monkeypatch):
    def fake_structured_call(schema, system, user, model=None, use_cache=True):
        if schema is ResearchQuestions:
            return ResearchQuestions(questions=["Q1", "Q2", "Q3"])
        if schema is CompetitorOutput:
            return CompetitorOutput(
                findings=[
                    CompetitorFinding(
                        id="cf-01",
                        competitor="Dify",
                        research_question="Q1",
                        conclusion="Dify 有分段预览",
                        verdict=CompetitorVerdict.ADOPT,
                        implication="值得对标",
                        source_url="https://leak.example.com",
                        evidence_strength=EvidenceStrength.STRONG,
                    ),
                    CompetitorFinding(
                        id="cf-02",
                        competitor="Open WebUI",
                        research_question="Q2",
                        conclusion="解析较轻",
                        verdict=CompetitorVerdict.WATCH,
                        implication="持续观察",
                        source_url="",
                        evidence_strength=EvidenceStrength.WEAK,
                    ),
                ]
            )
        raise AssertionError(f"unexpected schema {schema}")

    monkeypatch.setattr(llm, "structured_call", fake_structured_call)

    agent = ResearchAgent(mode="competitor")
    out = agent.run(_cluster(), _product_context(), run_mode="mock")

    assert isinstance(out, CompetitorOutput)
    assert len(out.findings) == 2
    # 两条都来自 mock 单元 → source_url mock://、strong 被封顶
    f0 = next(f for f in out.findings if f.competitor == "Dify")
    assert f0.source_url == "mock://dify.md"
    assert f0.evidence_strength == EvidenceStrength.MODERATE
    f1 = next(f for f in out.findings if f.competitor == "Open WebUI")
    assert f1.source_url == "mock://open_webui.md"
    assert f1.evidence_strength == EvidenceStrength.WEAK  # weak 不被抬高


def test_run_tech_mock_end_to_end(monkeypatch):
    def fake_structured_call(schema, system, user, model=None, use_cache=True):
        if schema is ResearchQuestions:
            return ResearchQuestions(questions=["Q1", "Q2", "Q3"])
        if schema is TechOutput:
            return TechOutput(
                findings=[
                    TechFinding(
                        id="tf-01",
                        topic="bug",
                        solution_name="解析状态机",
                        maturity=TechMaturity.MATURE,
                        fit_reason="支持进度展示",
                        cost_estimate="medium 改任务队列",
                        risk="状态模型改动",
                        source_url="https://leak.example.com",
                        evidence_strength=EvidenceStrength.STRONG,
                    )
                ]
            )
        raise AssertionError(f"unexpected schema {schema}")

    monkeypatch.setattr(llm, "structured_call", fake_structured_call)

    agent = ResearchAgent(mode="tech")
    out = agent.run(_cluster(), _product_context(), run_mode="mock")
    assert isinstance(out, TechOutput)
    assert len(out.findings) == 1
    # topic "bug" 是 tech 单元 key → 命中封顶
    assert out.findings[0].source_url.startswith("mock://")
    assert out.findings[0].evidence_strength == EvidenceStrength.MODERATE

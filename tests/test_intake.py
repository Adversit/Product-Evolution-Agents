"""IntakeAgent 单测（T1.2）。

无 key 也能跑的纯代码部分：
- ``load_signals`` 的 sig-NNN id 分配顺序（CSV 先、issues 后）；
- issue 的 html_url 进 origin_url；
- live 模式 GithubUnavailable → 降级读 issues_mock.json；
- ``merge_annotations`` 把标注合并回原信号、duplicate_of 闭包过滤。

需要 ZHIPUAI_API_KEY 的 LLM 标注验收（T1.2 fixture）单独 gate（无 key 自动跳过）。
"""

from __future__ import annotations

import os

import pytest

from evopm.agents import intake as intake_mod
from evopm.agents.intake import (
    IntakeAgent,
    IntakeAnnotation,
    IntakeOutput,
    load_signals,
)
from evopm.config import load_product_context
from evopm.schemas import Actionability, SignalItem, SourceType

DATA_DIR = "data/demo_kb"


# --------------------------------------------------------------------------- #
# 纯代码：id 分配 + 来源字段
# --------------------------------------------------------------------------- #
def test_id_assignment_csv_first_then_issues():
    sigs = load_signals(DATA_DIR, run_mode="mock")
    ids = [s.id for s in sigs]
    # 顺序连续、零填充三位
    assert ids == [f"sig-{i:03d}" for i in range(1, len(sigs) + 1)]
    csv_max = max(i for i, s in enumerate(sigs) if s.source_type == SourceType.CSV_FEEDBACK)
    gh_min = min(i for i, s in enumerate(sigs) if s.source_type == SourceType.GITHUB_ISSUE)
    assert csv_max < gh_min  # 所有 CSV 行排在所有 issue 行之前


def test_csv_rows_count_is_20():
    sigs = load_signals(DATA_DIR, run_mode="mock")
    csv_rows = [s for s in sigs if s.source_type == SourceType.CSV_FEEDBACK]
    assert len(csv_rows) == 20


def test_issue_html_url_goes_to_origin_url():
    sigs = load_signals(DATA_DIR, run_mode="mock")
    issues = [s for s in sigs if s.source_type == SourceType.GITHUB_ISSUE]
    assert issues, "expected mock issues"
    assert all(s.origin_url.startswith("http") for s in issues)
    # text 永不为空且不带 id 列污染
    assert all(s.text for s in issues)


def test_live_mode_degrades_to_mock_on_github_unavailable(monkeypatch):
    def _boom(*a, **k):
        raise intake_mod.GithubUnavailable("offline")

    monkeypatch.setattr(intake_mod, "fetch_issues", _boom)
    live = load_signals(DATA_DIR, run_mode="live")
    mock = load_signals(DATA_DIR, run_mode="mock")
    # 降级后 issue 数量与本地 mock 一致，全链不中断
    live_issues = [s for s in live if s.source_type == SourceType.GITHUB_ISSUE]
    mock_issues = [s for s in mock if s.source_type == SourceType.GITHUB_ISSUE]
    assert len(live_issues) == len(mock_issues) > 0


# --------------------------------------------------------------------------- #
# 纯代码：标注合并 + duplicate_of 闭包
# --------------------------------------------------------------------------- #
def test_merge_annotations_applies_and_preserves_text():
    sigs = [
        SignalItem(id="sig-001", source_type=SourceType.CSV_FEEDBACK, text="原文一"),
        SignalItem(id="sig-002", source_type=SourceType.CSV_FEEDBACK, text="原文二"),
    ]
    out = IntakeOutput(
        signals=[
            IntakeAnnotation(
                id="sig-001",
                category="bug",
                sentiment="negative",
                actionability="real_issue",
                data_quality="complete",
                module_guess="解析",
            ),
            IntakeAnnotation(
                id="sig-002",
                category="ux",
                actionability="suspected_duplicate",
                duplicate_of="sig-001",
            ),
        ]
    )
    merged = IntakeAgent.merge_annotations(sigs, out)
    assert merged[0].category.value == "bug"
    assert merged[0].actionability == Actionability.REAL_ISSUE
    assert merged[0].text == "原文一"  # 原文不变
    assert merged[1].duplicate_of == "sig-001"


def test_merge_annotations_drops_bogus_duplicate_of():
    sigs = [SignalItem(id="sig-001", source_type=SourceType.CSV_FEEDBACK, text="x")]
    out = IntakeOutput(
        signals=[IntakeAnnotation(id="sig-001", duplicate_of="sig-999")]
    )
    merged = IntakeAgent.merge_annotations(sigs, out)
    assert merged[0].duplicate_of is None  # 指向不存在的 id → 丢弃


def test_merge_annotations_drops_self_duplicate():
    sigs = [SignalItem(id="sig-001", source_type=SourceType.CSV_FEEDBACK, text="x")]
    out = IntakeOutput(signals=[IntakeAnnotation(id="sig-001", duplicate_of="sig-001")])
    merged = IntakeAgent.merge_annotations(sigs, out)
    assert merged[0].duplicate_of is None


def test_invalid_enum_value_becomes_none():
    sigs = [SignalItem(id="sig-001", source_type=SourceType.CSV_FEEDBACK, text="x")]
    out = IntakeOutput(signals=[IntakeAnnotation(id="sig-001", category="nonsense")])
    merged = IntakeAgent.merge_annotations(sigs, out)
    assert merged[0].category is None


# --------------------------------------------------------------------------- #
# LLM 标注验收（T1.2，需 ZHIPUAI_API_KEY）
# --------------------------------------------------------------------------- #
@pytest.mark.skipif(
    not os.environ.get("ZHIPUAI_API_KEY"), reason="needs ZHIPUAI_API_KEY"
)
def test_intake_llm_annotation_fixture():
    sigs = load_signals(DATA_DIR, run_mode="mock")
    pc = load_product_context(f"{DATA_DIR}/product.yaml")
    agent = IntakeAgent()
    out = agent.run(product_context=pc, signals=sigs)
    merged = IntakeAgent.merge_annotations(sigs, out)

    # 全部字段非空合法
    for s in merged:
        assert s.category is not None
        assert s.sentiment is not None
        assert s.actionability is not None
        assert s.data_quality is not None

    acts = [s.actionability.value for s in merged]
    emotional_or_misuse = [
        a for a in acts if a in {"emotional", "suspected_misuse"}
    ]
    assert len(emotional_or_misuse) >= 2, "至少 2 条情绪/误用样本"

    dup_pairs = [s for s in merged if s.duplicate_of]
    assert len(dup_pairs) >= 1, "至少 1 对 duplicate_of 关系"

    # 情绪/误用/信息不足必须给 followup_question
    for s in merged:
        if s.actionability and s.actionability.value in {
            "emotional",
            "suspected_misuse",
            "insufficient",
        }:
            assert s.followup_question, f"{s.id} 缺 followup_question"

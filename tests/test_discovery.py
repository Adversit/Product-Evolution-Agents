"""DiscoveryAgent 单测（T1.3）。

无 key 也能跑的纯代码部分：
- ``filter_actionable``（漏斗第一级：剔除 emotional/suspected_misuse/insufficient）；
- 证据闭包：非法 signal_ids 被剔除、frequency 回填对齐。

LLM 聚类验收（T1.3 fixture）单独 gate（无 key 自动跳过）。
"""

from __future__ import annotations

import os

import pytest

from evopm.agents.discovery import (
    DiscoveryAgent,
    DiscoveryOutput,
    filter_actionable,
)
from evopm.agents.intake import IntakeAgent, load_signals
from evopm.config import load_existing_requirements, load_product_context
from evopm.schemas import (
    Actionability,
    Category,
    ClusterStatus,
    InsightCluster,
    Severity,
    SignalItem,
    SourceType,
)

DATA_DIR = "data/demo_kb"


def _sig(sid, act):
    return SignalItem(
        id=sid,
        source_type=SourceType.CSV_FEEDBACK,
        text="t",
        actionability=act,
    )


# --------------------------------------------------------------------------- #
# 纯代码：漏斗过滤
# --------------------------------------------------------------------------- #
def test_filter_actionable_drops_emotional_misuse_insufficient():
    sigs = [
        _sig("sig-001", Actionability.REAL_ISSUE),
        _sig("sig-002", Actionability.EMOTIONAL),
        _sig("sig-003", Actionability.SUSPECTED_MISUSE),
        _sig("sig-004", Actionability.INSUFFICIENT),
        _sig("sig-005", Actionability.SUFFICIENT),
        _sig("sig-006", Actionability.SUSPECTED_DUPLICATE),
    ]
    kept = filter_actionable(sigs)
    kept_ids = {s.id for s in kept}
    assert kept_ids == {"sig-001", "sig-005", "sig-006"}


def test_filter_actionable_keeps_unlabeled():
    sigs = [SignalItem(id="sig-001", source_type=SourceType.CSV_FEEDBACK, text="t")]
    assert len(filter_actionable(sigs)) == 1


# --------------------------------------------------------------------------- #
# 纯代码：闭包校验在 run() 内的逻辑（直接复用 base 的校验，这里验集成路径）
# --------------------------------------------------------------------------- #
def test_closure_drops_illegal_signal_ids_and_realigns_frequency(monkeypatch):
    signals = [
        SignalItem(id="sig-001", source_type=SourceType.CSV_FEEDBACK, text="a"),
        SignalItem(id="sig-002", source_type=SourceType.CSV_FEEDBACK, text="b"),
    ]
    dirty = DiscoveryOutput(
        clusters=[
            InsightCluster(
                id="clu-01",
                title="t",
                summary="s",
                signal_ids=["sig-001", "sig-999", "sig-002"],  # sig-999 非法
                categories=[Category.BUG],
                severity=Severity.HIGH,
                frequency=3,  # 故意与清洗后不符
                status=ClusterStatus.NEW,
                candidate_title="c",
                user_story_draft="u",
            )
        ]
    )
    agent = DiscoveryAgent()
    # 绕过真实 LLM：让 structured_call 直接返回构造的脏输出
    monkeypatch.setattr(agent, "structured_call", lambda schema, user: dirty)
    out = agent.run(signals=signals, existing_requirements=[])

    clu = out.clusters[0]
    assert clu.signal_ids == ["sig-001", "sig-002"]  # 非法 id 剔除
    assert clu.frequency == 2  # 回填对齐清洗后长度
    assert agent.violations and "sig-999" in agent.violations[0]


# --------------------------------------------------------------------------- #
# LLM 聚类验收（T1.3，需 ZHIPUAI_API_KEY）
# --------------------------------------------------------------------------- #
@pytest.mark.skipif(
    not os.environ.get("ZHIPUAI_API_KEY"), reason="needs ZHIPUAI_API_KEY"
)
def test_discovery_llm_clustering_fixture():
    # 真实链路：load → intake 标注 → filter → discovery
    sigs = load_signals(DATA_DIR, run_mode="mock")
    pc = load_product_context(f"{DATA_DIR}/product.yaml")
    intake_out = IntakeAgent().run(product_context=pc, signals=sigs)
    annotated = IntakeAgent.merge_annotations(sigs, intake_out)
    actionable = filter_actionable(annotated)
    existing = load_existing_requirements(f"{DATA_DIR}/existing_requirements.md")

    out = DiscoveryAgent().run(signals=actionable, existing_requirements=existing)
    clusters = out.clusters

    assert 2 <= len(clusters) <= 4

    valid_ids = {s.id for s in actionable}
    for c in clusters:
        assert all(sid in valid_ids for sid in c.signal_ids)  # 闭包合法
        assert c.frequency == len(c.signal_ids)

    # 最大簇应为解析失败/状态不可见
    biggest = max(clusters, key=lambda c: c.frequency)
    blob = (biggest.title + biggest.summary).lower()
    assert any(k in blob for k in ["解析", "parse", "parsing", "状态", "进度"])

    # 至少 1 簇命中历史需求池 → DUPLICATE
    dups = [c for c in clusters if c.status == ClusterStatus.DUPLICATE]
    assert len(dups) >= 1
    assert all(c.duplicate_of_existing for c in dups)

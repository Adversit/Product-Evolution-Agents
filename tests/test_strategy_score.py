"""T3.3 StrategyAgent.score 验收。

- 代码逻辑（monkeypatch）：total 由加权覆写、focus 高分得 P0/P1、DUPLICATE 簇强制 Duplicate、
  roadmap 含全部簇且每簇一条、焦点 is_focus=True 且与 decision 对齐、Now/Next/Later 覆盖 ≥2 档、
  evidence 闭包剔除非法 id。
- 真实 LLM fixture：有 key 才跑。
"""

from __future__ import annotations

import os

import pytest

from conftest import (
    make_enriched_candidate,
    make_findings,
    make_product_context,
)
from evopm import llm
from evopm.agents.strategy import OpportunityOutput, StrategyAgent
from evopm.rules import OPPORTUNITY_DIMS, weighted_opportunity_total
from evopm.schemas import (
    Category,
    ClusterStatus,
    Horizon,
    InsightCluster,
    OpportunityDecision,
    OpportunityScore,
    Priority,
    RoadmapEntry,
    Severity,
)


def _three_clusters() -> list[InsightCluster]:
    base = dict(summary="s", signal_ids=["sig-001"], categories=[Category.UX],
                severity=Severity.HIGH, frequency=1, candidate_title="c",
                user_story_draft="u")
    return [
        InsightCluster(id="clu-01", title="解析失败可见性", status=ClusterStatus.NEW, **base),
        InsightCluster(id="clu-02", title="检索引用质量", status=ClusterStatus.NEW, **base),
        InsightCluster(id="clu-03", title="进度展示(历史重复)", status=ClusterStatus.DUPLICATE, **base),
    ]


def _llm_output(focus_total_high=True) -> OpportunityOutput:
    score_val = 85 if focus_total_high else 50
    decision = OpportunityDecision(
        requirement_id="req-01",
        scores=[
            OpportunityScore(dimension=d, score=score_val, rationale="r", evidence_refs=["cf-01"])
            for d in OPPORTUNITY_DIMS
        ],
        total=12345,  # 故意错值，验证代码覆写
        priority=Priority.P3,  # 故意低，验证下限保护
        horizon=Horizon.NOW,
        rationale="焦点为最大痛点簇",
        special_types=[],
    )
    roadmap = [
        RoadmapEntry(cluster_id="clu-01", title="解析失败可见性", priority=Priority.P3,
                     horizon=Horizon.LATER, one_line_reason="r", is_focus=False),
        RoadmapEntry(cluster_id="clu-02", title="检索引用质量", priority=Priority.P2,
                     horizon=Horizon.NEXT, one_line_reason="r", is_focus=False),
        RoadmapEntry(cluster_id="clu-03", title="进度展示", priority=Priority.P1,
                     horizon=Horizon.NOW, one_line_reason="r", is_focus=False),
    ]
    return OpportunityOutput(decision=decision, roadmap=roadmap)


def _patch(monkeypatch, output: OpportunityOutput):
    def fake(schema, system, user, model=None, use_cache=True):
        assert schema is OpportunityOutput
        return output.model_copy(deep=True)
    monkeypatch.setattr(llm, "structured_call", fake)


def test_score_overwrites_total_with_weights(monkeypatch):
    _patch(monkeypatch, _llm_output(focus_total_high=True))
    clusters = _three_clusters()
    focus = make_enriched_candidate()  # cluster_id=clu-01
    cf, tf = make_findings()
    pc = make_product_context()

    decision, roadmap, _ = StrategyAgent().score(focus, clusters, pc, cf, tf)

    expected = weighted_opportunity_total(decision.scores, pc.opportunity_weights)
    assert decision.total == expected
    assert decision.total != 12345
    # 高分 → 优先级下限保护抬到至少 P1（LLM 建议 P3）
    assert decision.priority in (Priority.P0, Priority.P1)


def test_score_roadmap_covers_all_clusters_one_each(monkeypatch):
    _patch(monkeypatch, _llm_output())
    clusters = _three_clusters()
    focus = make_enriched_candidate()
    decision, roadmap, _ = StrategyAgent().score(focus, clusters, make_product_context())

    ids = [e.cluster_id for e in roadmap]
    assert ids == ["clu-01", "clu-02", "clu-03"]  # 每簇恰一条、按簇序
    focus_entries = [e for e in roadmap if e.is_focus]
    assert len(focus_entries) == 1
    fe = focus_entries[0]
    assert fe.cluster_id == "clu-01"
    assert fe.priority == decision.priority and fe.horizon == decision.horizon


def test_score_duplicate_cluster_forced_duplicate(monkeypatch):
    _patch(monkeypatch, _llm_output())
    clusters = _three_clusters()  # clu-03 是 DUPLICATE
    focus = make_enriched_candidate()
    _, roadmap, _ = StrategyAgent().score(focus, clusters, make_product_context())
    dup = next(e for e in roadmap if e.cluster_id == "clu-03")
    assert dup.priority == Priority.DUPLICATE
    assert dup.horizon == Horizon.LATER


def test_score_horizon_covers_at_least_two_buckets(monkeypatch):
    _patch(monkeypatch, _llm_output())
    clusters = _three_clusters()
    focus = make_enriched_candidate()
    _, roadmap, _ = StrategyAgent().score(focus, clusters, make_product_context())
    horizons = {e.horizon for e in roadmap}
    assert len(horizons) >= 2


def test_score_missing_roadmap_entry_backfilled(monkeypatch):
    out = _llm_output()
    out.roadmap = out.roadmap[:1]  # 只给 clu-01，缺 clu-02/clu-03
    _patch(monkeypatch, out)
    clusters = _three_clusters()
    focus = make_enriched_candidate()
    _, roadmap, _ = StrategyAgent().score(focus, clusters, make_product_context())
    assert {e.cluster_id for e in roadmap} == {"clu-01", "clu-02", "clu-03"}


def test_score_drops_illegal_evidence(monkeypatch):
    out = _llm_output()
    out.decision.scores[0].evidence_refs = ["cf-01", "cf-999"]  # cf-999 非法
    _patch(monkeypatch, out)
    clusters = _three_clusters()
    focus = make_enriched_candidate()
    valid_ids = {"sig-001", "cf-01", "tf-01", "req-01", "clu-01", "clu-02", "clu-03"}
    decision, _, violations = StrategyAgent().score(
        focus, clusters, make_product_context(), valid_ids=valid_ids
    )
    assert "cf-999" not in decision.scores[0].evidence_refs
    assert any("cf-999" in v for v in violations)


# --------------------------------------------------------------------------- #
# 真实 LLM（需 ZHIPUAI_API_KEY）
# --------------------------------------------------------------------------- #
pytestmark_live = pytest.mark.skipif(
    not os.environ.get("ZHIPUAI_API_KEY"), reason="needs ZHIPUAI_API_KEY"
)


@pytestmark_live
def test_score_live():
    clusters = _three_clusters()
    focus = make_enriched_candidate()
    cf, tf = make_findings()
    pc = make_product_context()
    valid_ids = {"sig-001", "cf-01", "tf-01", "req-01", "clu-01", "clu-02", "clu-03"}
    decision, roadmap, _ = StrategyAgent().score(
        focus, clusters, pc, cf, tf, valid_ids=valid_ids, model="glm-4.5-air"
    )
    assert {s.dimension for s in decision.scores} == set(OPPORTUNITY_DIMS)
    assert {e.cluster_id for e in roadmap} == {"clu-01", "clu-02", "clu-03"}
    dup = next(e for e in roadmap if e.cluster_id == "clu-03")
    assert dup.priority == Priority.DUPLICATE

"""T3.1 RequirementAgent.draft_and_score 验收。

- 代码逻辑（无需 LLM，monkeypatch structured_call）：10 维齐全、total 由代码覆写为均值、
  gate=NEEDS_ENRICH、missing_info 非空、quality_history 追加、evidence 闭包剔除非法 id。
- 真实 LLM fixture：有 key 才跑。
"""

from __future__ import annotations

import os

import pytest

from conftest import make_cluster, make_draft_candidate, make_findings
from evopm import llm
from evopm.agents.requirement import RequirementAgent
from evopm.rules import QUALITY_DIMS
from evopm.schemas import Category, GateStatus, RequirementCandidate


def _patch_llm(monkeypatch, returned: RequirementCandidate):
    def fake(schema, system, user, model=None, use_cache=True):
        assert schema is RequirementCandidate
        return returned.model_copy(deep=True)

    monkeypatch.setattr(llm, "structured_call", fake)


def test_draft_overwrites_total_and_gate(monkeypatch):
    _patch_llm(monkeypatch, make_draft_candidate())
    cluster = make_cluster()
    cf, tf = make_findings()
    agent = RequirementAgent()

    cand, violations = agent.draft_and_score(cluster, cf, tf)

    assert cand.quality is not None
    # 10 维齐全且 name 顺序正确
    assert [d.name for d in cand.quality.dimensions] == QUALITY_DIMS
    assert all(d.rationale for d in cand.quality.dimensions)
    # total 由代码覆写为均值（非 LLM 自报的 999）
    expected = round(sum(d.score for d in cand.quality.dimensions) / 10)
    assert cand.quality.total == expected
    assert 55 <= cand.quality.total <= 62  # demo 校准区间
    # 缺验收标准 → NEEDS_ENRICH + missing_info 非空
    assert cand.quality.missing_info
    assert cand.quality.gate == GateStatus.NEEDS_ENRICH
    assert cand.quality.round == 1
    assert violations == []


def test_draft_appends_quality_history(monkeypatch):
    _patch_llm(monkeypatch, make_draft_candidate())
    cluster = make_cluster()
    cand, _ = RequirementAgent().draft_and_score(cluster)
    assert len(cand.quality_history) == 1
    assert cand.quality_history[0].round == 1


def test_draft_route_support_for_docs_misuse_cluster(monkeypatch):
    # 簇类别全为 misuse/docs → decide_gate 走 ROUTE_SUPPORT（即便分数）
    _patch_llm(monkeypatch, make_draft_candidate())
    cluster = make_cluster(categories=[Category.DOCS, Category.MISUSE])
    cand, _ = RequirementAgent().draft_and_score(cluster)
    assert cand.quality.gate == GateStatus.ROUTE_SUPPORT


def test_draft_evidence_closure_drops_illegal_refs(monkeypatch):
    bad = make_draft_candidate()
    bad.evidence_refs = ["sig-001", "sig-999", "cf-01"]  # sig-999 不存在
    _patch_llm(monkeypatch, bad)
    cluster = make_cluster()
    valid_ids = {"sig-001", "sig-002", "sig-003", "cf-01", "tf-01"}
    cand, violations = RequirementAgent().draft_and_score(
        cluster, *make_findings(), valid_ids=valid_ids
    )
    assert "sig-999" not in cand.evidence_refs
    assert any("sig-999" in v for v in violations)


def test_draft_sets_cluster_id(monkeypatch):
    c = make_draft_candidate()
    c.cluster_id = "wrong"  # LLM 填错 → 代码强制对齐选中簇
    _patch_llm(monkeypatch, c)
    cluster = make_cluster(cid="clu-07")
    cand, _ = RequirementAgent().draft_and_score(cluster)
    assert cand.cluster_id == "clu-07"


# --------------------------------------------------------------------------- #
# 真实 LLM（需 ZHIPUAI_API_KEY）
# --------------------------------------------------------------------------- #
pytestmark_live = pytest.mark.skipif(
    not os.environ.get("ZHIPUAI_API_KEY"), reason="needs ZHIPUAI_API_KEY"
)


@pytestmark_live
def test_draft_live():
    cluster = make_cluster()
    cf, tf = make_findings()
    valid_ids = {"sig-001", "sig-002", "sig-003", "cf-01", "tf-01"}
    cand, _ = RequirementAgent().draft_and_score(
        cluster, cf, tf, valid_ids=valid_ids, model="glm-4.7-flash"
    )
    assert cand.quality is not None
    assert [d.name for d in cand.quality.dimensions] == QUALITY_DIMS
    assert cand.quality.missing_info
    assert cand.quality.gate == GateStatus.NEEDS_ENRICH

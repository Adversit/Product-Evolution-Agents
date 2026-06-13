"""T3.2 RequirementAgent.enrich 验收（demo 高光，验收最严）。

- 代码逻辑（monkeypatch）：补全后 acceptance_criteria ≥3 且各有 evidence_refs、含 functional 与
  nonfunctional 两类；round=2；total 由代码覆写；gate=PASS；第二轮 total − 第一轮 ≥15；
  quality_history 含两轮；补全内容的非法 evidence_refs 被剔除。
- 真实 LLM fixture：两阶段 draft→enrich，断言提升 ≥15 且 PASS。
"""

from __future__ import annotations

import os

import pytest

from conftest import (
    make_cluster,
    make_draft_candidate,
    make_enriched_candidate,
    make_findings,
)
from evopm import llm
from evopm.agents.requirement import RequirementAgent
from evopm.rules import QUALITY_DIMS
from evopm.schemas import GateStatus, RequirementCandidate


def _two_phase_agent(monkeypatch):
    """draft 返回低分草稿、enrich 返回高分补全；按 prompt_file 区分。"""
    draft = make_draft_candidate()
    enriched = make_enriched_candidate()

    def fake(schema, system, user, model=None, use_cache=True):
        assert schema is RequirementCandidate
        # enrich.md 的系统提示含 "高光" 字样标识；用 prompt 内容区分两阶段
        if "补全" in system and "高光" in system:
            return enriched.model_copy(deep=True)
        return draft.model_copy(deep=True)

    monkeypatch.setattr(llm, "structured_call", fake)
    return RequirementAgent()


def test_enrich_total_jumps_and_passes(monkeypatch):
    agent = _two_phase_agent(monkeypatch)
    cluster = make_cluster()
    cf, tf = make_findings()

    draft, _ = agent.draft_and_score(cluster, cf, tf)
    enriched, _ = agent.enrich(draft, cluster, cf, tf)

    assert enriched.quality.round == 2
    # total 由代码覆写为均值
    expected = round(sum(d.score for d in enriched.quality.dimensions) / 10)
    assert enriched.quality.total == expected
    assert enriched.quality.total >= 80
    # demo 高光：第二轮 - 第一轮 ≥ 15
    assert enriched.quality.total - draft.quality.total >= 15
    assert enriched.quality.gate == GateStatus.PASS
    assert [d.name for d in enriched.quality.dimensions] == QUALITY_DIMS


def test_enrich_acceptance_criteria_bound_to_evidence(monkeypatch):
    agent = _two_phase_agent(monkeypatch)
    cluster = make_cluster()
    cf, tf = make_findings()
    draft, _ = agent.draft_and_score(cluster, cf, tf)
    enriched, _ = agent.enrich(draft, cluster, cf, tf)

    ac = enriched.acceptance_criteria
    assert len(ac) >= 3
    assert all(a.evidence_refs for a in ac)  # 每条绑证据
    types = {a.type for a in ac}
    assert "functional" in types and "nonfunctional" in types
    assert len(enriched.non_goals) >= 2
    assert len(enriched.boundary_conditions) >= 2


def test_enrich_keeps_two_round_history(monkeypatch):
    agent = _two_phase_agent(monkeypatch)
    cluster = make_cluster()
    draft, _ = agent.draft_and_score(cluster)
    enriched, _ = agent.enrich(draft, cluster)
    rounds = [q.round for q in enriched.quality_history]
    assert rounds == [1, 2]
    assert enriched.id == draft.id


def test_enrich_drops_illegal_evidence_in_criteria(monkeypatch):
    enriched = make_enriched_candidate()
    enriched.acceptance_criteria[0].evidence_refs = ["cf-01", "tf-999"]  # tf-999 非法
    draft = make_draft_candidate()

    def fake(schema, system, user, model=None, use_cache=True):
        return (enriched if ("补全" in system and "高光" in system) else draft).model_copy(deep=True)

    monkeypatch.setattr(llm, "structured_call", fake)
    cluster = make_cluster()
    cf, tf = make_findings()
    valid_ids = {"sig-001", "sig-002", "sig-003", "cf-01", "tf-01"}

    d, _ = RequirementAgent().draft_and_score(cluster, cf, tf, valid_ids=valid_ids)
    e, violations = RequirementAgent().enrich(d, cluster, cf, tf, valid_ids=valid_ids)
    assert "tf-999" not in e.acceptance_criteria[0].evidence_refs
    assert any("tf-999" in v for v in violations)


# --------------------------------------------------------------------------- #
# 真实 LLM（需 ZHIPUAI_API_KEY）
# --------------------------------------------------------------------------- #
pytestmark_live = pytest.mark.skipif(
    not os.environ.get("ZHIPUAI_API_KEY"), reason="needs ZHIPUAI_API_KEY"
)


@pytestmark_live
def test_enrich_live_demo_highlight():
    cluster = make_cluster()
    cf, tf = make_findings()
    valid_ids = {"sig-001", "sig-002", "sig-003", "cf-01", "tf-01"}
    agent = RequirementAgent()
    draft, _ = agent.draft_and_score(cluster, cf, tf, valid_ids=valid_ids, model="glm-4.7-flash")
    enriched, _ = agent.enrich(draft, cluster, cf, tf, valid_ids=valid_ids, model="glm-4.7-flash")
    assert enriched.quality.round == 2
    assert enriched.quality.total - draft.quality.total >= 15
    assert enriched.quality.gate == GateStatus.PASS
    assert len(enriched.acceptance_criteria) >= 3

"""T3.4 StrategyAgent.design 验收。

- 代码逻辑（monkeypatch）：role_notes 四 key 齐全非空、acceptance_criteria 含 functional 与
  nonfunctional、requirement_id 对齐焦点、evidence 闭包剔除非法 id。
- 真实 LLM fixture：有 key 才跑。
"""

from __future__ import annotations

import os

import pytest

from conftest import make_enriched_candidate, make_findings
from evopm import llm
from evopm.agents.strategy import StrategyAgent
from evopm.schemas import (
    AcceptanceCriterion,
    Horizon,
    OpportunityDecision,
    Priority,
    SolutionSpec,
)


def _solution() -> SolutionSpec:
    return SolutionSpec(
        requirement_id="req-01",
        summary="为文档解析提供阶段进度与失败可见性。",
        scope=["阶段进度展示", "失败原因提示"],
        non_goals=["不优化解析精度"],
        user_flow=["上传文件", "进入解析队列", "上报阶段进度", "成功或失败反馈"],
        acceptance_criteria=[
            AcceptanceCriterion(text="展示解析阶段进度", type="functional", evidence_refs=["cf-01"]),
            AcceptanceCriterion(text="进度心跳 ≤10s", type="nonfunctional", evidence_refs=["tf-01"]),
        ],
        edge_cases=["超大文件", "网络中断", "解析超时"],
        test_scenarios=["上传 200MB 文件验证进度", "断网后状态保持", "超时置失败"],
        role_notes={
            "product": "价值在于降低上传相关求助。",
            "dev": "改造任务队列状态上报，参考显式状态机。",
            "qa": "重点验证进度准确性与失败态。",
            "support": "向用户说明进度含义与失败排查。",
        },
        risks=["状态粒度过细增加写压力", "前端进度与后端不同步"],
        dependencies=["任务队列状态上报能力"],
    )


def _opportunity() -> OpportunityDecision:
    return OpportunityDecision(
        requirement_id="req-01", scores=[], total=85.0,
        priority=Priority.P0, horizon=Horizon.NOW, rationale="最大痛点", special_types=[],
    )


def _patch(monkeypatch, solution: SolutionSpec):
    def fake(schema, system, user, model=None, use_cache=True):
        assert schema is SolutionSpec
        return solution.model_copy(deep=True)
    monkeypatch.setattr(llm, "structured_call", fake)


def test_design_role_notes_all_four_keys(monkeypatch):
    _patch(monkeypatch, _solution())
    focus = make_enriched_candidate()
    cf, tf = make_findings()
    solution, _ = StrategyAgent().design(focus, _opportunity(), cf, tf)

    assert set(solution.role_notes) == {"product", "dev", "qa", "support"}
    assert all(v.strip() for v in solution.role_notes.values())


def test_design_acceptance_has_both_types(monkeypatch):
    _patch(monkeypatch, _solution())
    focus = make_enriched_candidate()
    solution, _ = StrategyAgent().design(focus, _opportunity())
    types = {a.type for a in solution.acceptance_criteria}
    assert "functional" in types and "nonfunctional" in types


def test_design_aligns_requirement_id(monkeypatch):
    s = _solution()
    s.requirement_id = "wrong"
    _patch(monkeypatch, s)
    focus = make_enriched_candidate()  # id=req-01
    solution, _ = StrategyAgent().design(focus, _opportunity())
    assert solution.requirement_id == "req-01"


def test_design_drops_illegal_evidence(monkeypatch):
    s = _solution()
    s.acceptance_criteria[0].evidence_refs = ["cf-01", "sig-999"]  # sig-999 非法
    _patch(monkeypatch, s)
    focus = make_enriched_candidate()
    valid_ids = {"sig-001", "cf-01", "tf-01", "req-01"}
    solution, violations = StrategyAgent().design(
        focus, _opportunity(), valid_ids=valid_ids
    )
    assert "sig-999" not in solution.acceptance_criteria[0].evidence_refs
    assert any("sig-999" in v for v in violations)


# --------------------------------------------------------------------------- #
# 真实 LLM（需 ZHIPUAI_API_KEY）
# --------------------------------------------------------------------------- #
pytestmark_live = pytest.mark.skipif(
    not os.environ.get("ZHIPUAI_API_KEY"), reason="needs ZHIPUAI_API_KEY"
)


@pytestmark_live
def test_design_live():
    focus = make_enriched_candidate()
    cf, tf = make_findings()
    valid_ids = {"sig-001", "sig-002", "sig-003", "cf-01", "tf-01", "req-01"}
    solution, _ = StrategyAgent().design(
        focus, _opportunity(), cf, tf, valid_ids=valid_ids, model="glm-4.5-air"
    )
    assert set(solution.role_notes) == {"product", "dev", "qa", "support"}
    assert all(v.strip() for v in solution.role_notes.values())
    types = {a.type for a in solution.acceptance_criteria}
    assert "functional" in types and "nonfunctional" in types

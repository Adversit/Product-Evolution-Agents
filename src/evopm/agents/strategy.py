"""StrategyAgent（WT-3，spec §4 行 score / design）。

- ``score``：一次 LLM 调用同时产出焦点需求的 ``OpportunityDecision``（10 维精评）和覆盖
  **全部簇**的 ``list[RoadmapEntry]``。机会总分 ``total`` 与优先级下限由代码覆写（spec §5.2）：
    - ``total`` = ``rules.weighted_opportunity_total(scores, opportunity_weights)``；
    - ``priority`` = ``rules.enforce_priority_floor(suggested, total, focus_cluster.status)``；
    - DUPLICATE 簇在 roadmap 中强制 ``Priority.DUPLICATE``。
  包装模型 ``OpportunityOutput`` 在本模块定义（不入 schemas.py，spec §4）。
- ``design``：产出 ``SolutionSpec``，四角色 role_notes 必填，验收标准绑证据。
"""

from __future__ import annotations

import json
from typing import Any

from pydantic import BaseModel

from evopm.agents.base import BaseAgent, validate_evidence_refs
from evopm.rules import OPPORTUNITY_DIMS, enforce_priority_floor, weighted_opportunity_total
from evopm.schemas import (
    ClusterStatus,
    CompetitorFinding,
    Horizon,
    InsightCluster,
    OpportunityDecision,
    Priority,
    ProductContext,
    RequirementCandidate,
    RoadmapEntry,
    SolutionSpec,
    TechFinding,
)

_MAX_TEXT = 800


class OpportunityOutput(BaseModel):
    """opportunity 节点单次 LLM 调用的包装产物（spec §4：定义在 agent 模块，非 schemas.py）。"""

    decision: OpportunityDecision
    roadmap: list[RoadmapEntry]


def _finding_brief(findings: list[Any]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for f in findings or []:
        if isinstance(f, CompetitorFinding):
            out.append(
                {
                    "id": f.id,
                    "competitor": f.competitor,
                    "conclusion": f.conclusion[:_MAX_TEXT],
                    "implication": f.implication[:_MAX_TEXT],
                    "verdict": f.verdict.value,
                    "evidence_strength": f.evidence_strength.value,
                }
            )
        elif isinstance(f, TechFinding):
            out.append(
                {
                    "id": f.id,
                    "topic": f.topic,
                    "solution_name": f.solution_name,
                    "maturity": f.maturity.value,
                    "fit_reason": f.fit_reason[:_MAX_TEXT],
                    "cost_estimate": f.cost_estimate,
                    "evidence_strength": f.evidence_strength.value,
                }
            )
    return out


def _cluster_row(c: InsightCluster) -> dict[str, Any]:
    return {
        "id": c.id,
        "title": c.title,
        "severity": c.severity.value,
        "frequency": c.frequency,
        "status": c.status.value,
    }


class StrategyAgent(BaseAgent):
    """机会精评 + 路线图（score）与方案设计（design）。"""

    name = "strategy"
    prompt_file = "opportunity.md"  # design 时临时切换

    def score(
        self,
        focus_candidate: RequirementCandidate,
        clusters: list[InsightCluster],
        product_context: ProductContext,
        competitor_findings: list[CompetitorFinding] | None = None,
        tech_findings: list[TechFinding] | None = None,
        valid_ids: set[str] | None = None,
        model: str | None = None,
    ) -> tuple[OpportunityDecision, list[RoadmapEntry], list[str]]:
        """焦点精评 + 全簇路线图。total/priority 由代码覆写。

        返回 (decision, roadmap, violations)。
        """
        self.prompt_file = "opportunity.md"
        focus_cluster = next(
            (c for c in clusters if c.id == focus_candidate.cluster_id), None
        )
        focus_status = focus_cluster.status if focus_cluster else ClusterStatus.NEW

        payload = {
            "focus_requirement": {
                "id": focus_candidate.id,
                "cluster_id": focus_candidate.cluster_id,
                "title": focus_candidate.title,
                "pain_point": focus_candidate.pain_point[:_MAX_TEXT],
                "quality_total": (
                    focus_candidate.quality.total if focus_candidate.quality else None
                ),
            },
            "all_clusters": [_cluster_row(c) for c in clusters],
            "competitor_findings": _finding_brief(competitor_findings),
            "tech_findings": _finding_brief(tech_findings),
            "weights_context": {
                "team_preference": product_context.team_preference,
                "opportunity_weights": product_context.opportunity_weights,
            },
        }
        user = json.dumps(payload, ensure_ascii=False, indent=2)

        output = self.structured_call(OpportunityOutput, user, model=model)
        assert isinstance(output, OpportunityOutput)

        decision = output.decision
        decision.requirement_id = focus_candidate.id

        violations: list[str] = []
        if valid_ids is not None:
            decision, violations = validate_evidence_refs(decision, valid_ids)

        # 代码侧加权总分覆写 LLM 自报值
        decision.total = weighted_opportunity_total(
            decision.scores, product_context.opportunity_weights
        )
        # 优先级下限保护（焦点簇状态驱动 DUPLICATE 强制 / total>=75 抬到 P1）
        decision.priority = enforce_priority_floor(
            decision.priority, decision.total, focus_status
        )

        roadmap = self._finalize_roadmap(
            output.roadmap, clusters, focus_candidate.cluster_id, decision
        )
        return decision, roadmap, violations

    @staticmethod
    def _finalize_roadmap(
        roadmap: list[RoadmapEntry],
        clusters: list[InsightCluster],
        focus_cluster_id: str,
        decision: OpportunityDecision,
    ) -> list[RoadmapEntry]:
        """代码侧规整 roadmap：

        - 焦点簇条目与 decision 的 priority/horizon 对齐、is_focus=True；
        - DUPLICATE 簇强制 Priority.DUPLICATE + Horizon.LATER；
        - 保证每个簇恰有一条（缺则补、重则去）。
        """
        status_by_id = {c.id: c.status for c in clusters}
        by_id: dict[str, RoadmapEntry] = {}
        for e in roadmap:
            if e.cluster_id in status_by_id and e.cluster_id not in by_id:
                by_id[e.cluster_id] = e

        result: list[RoadmapEntry] = []
        for c in clusters:
            entry = by_id.get(c.id)
            if entry is None:  # LLM 漏了某簇 → 兜底补一条
                entry = RoadmapEntry(
                    cluster_id=c.id,
                    title=c.title,
                    priority=Priority.RESEARCH,
                    horizon=Horizon.LATER,
                    one_line_reason="自动补全：模型未给出该簇路线图条目",
                    is_focus=False,
                )
            if c.id == focus_cluster_id:
                entry.is_focus = True
                entry.priority = decision.priority
                entry.horizon = decision.horizon
            elif status_by_id.get(c.id) == ClusterStatus.DUPLICATE:
                entry.is_focus = False
                entry.priority = Priority.DUPLICATE
                entry.horizon = Horizon.LATER
            else:
                entry.is_focus = False
            result.append(entry)
        return result

    def design(
        self,
        focus_candidate: RequirementCandidate,
        opportunity: OpportunityDecision,
        competitor_findings: list[CompetitorFinding] | None = None,
        tech_findings: list[TechFinding] | None = None,
        valid_ids: set[str] | None = None,
        model: str | None = None,
    ) -> tuple[SolutionSpec, list[str]]:
        """产出 SolutionSpec（四角色 role_notes 必填、验收标准绑证据）。

        返回 (solution, violations)。
        """
        self.prompt_file = "solution.md"
        payload = {
            "focus_requirement": focus_candidate.model_dump(
                mode="json",
                include={
                    "id",
                    "title",
                    "pain_point",
                    "scope",
                    "non_goals",
                    "boundary_conditions",
                    "acceptance_criteria",
                    "user_stories",
                    "evidence_refs",
                },
            ),
            "opportunity": {
                "priority": opportunity.priority.value,
                "horizon": opportunity.horizon.value,
                "total": opportunity.total,
                "rationale": opportunity.rationale[:_MAX_TEXT],
            },
            "competitor_findings": _finding_brief(competitor_findings),
            "tech_findings": _finding_brief(tech_findings),
        }
        user = json.dumps(payload, ensure_ascii=False, indent=2)

        solution = self.structured_call(SolutionSpec, user, model=model)
        assert isinstance(solution, SolutionSpec)
        solution.requirement_id = focus_candidate.id

        violations: list[str] = []
        if valid_ids is not None:
            solution, violations = validate_evidence_refs(solution, valid_ids)
        return solution, violations

    def run(self, **inputs: Any) -> OpportunityDecision:  # noqa: D401
        """便捷入口：默认走 score，返回 decision。"""
        decision, _, _ = self.score(**inputs)
        return decision

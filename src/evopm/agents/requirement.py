"""RequirementAgent（WT-3，spec §4 行 draft_and_score / enrich）。

把选中问题簇 + 调研发现打磨成 RequirementCandidate，并对其做 10 维质量评分。
评分由 LLM 给建议（每维 0-100 + 锚点理由），但 **total / gate / round 与 quality_history
由代码侧控制**（spec §5.1）：

- ``total`` = round(mean(10 维 score))，覆写 LLM 自报值；
- ``gate`` = ``rules.decide_gate(quality, cluster.categories)``，代码覆写；
- 每次评分把 QualityReport 追加进 ``quality_history``。

``draft_and_score``：初评（round=1），刻意缺验收标准 → missing_info 非空、gate=NEEDS_ENRICH。
``enrich``：仅基于 findings 补全 acceptance_criteria / non_goals / boundary_conditions，
复用同一评分路径重评（round=2），目标 total 较初评提升 ≥15 且达 PASS。
"""

from __future__ import annotations

import json
from typing import Any

from pydantic import BaseModel

from evopm.agents.base import BaseAgent, validate_evidence_refs
from evopm.rules import QUALITY_DIMS, decide_gate
from evopm.schemas import (
    AcceptanceCriterion,
    CompetitorFinding,
    GateStatus,
    InsightCluster,
    QualityDimension,
    QualityReport,
    RequirementCandidate,
    TechFinding,
    UserStory,
)

# 注入正文单条裁剪上限（spec §11.3）
_MAX_TEXT = 800


# 弱模型常在 list-of-objects 里漏字段（如漏 score），给默认值兜底：漏 score → 60（中性），
# 漏 rationale → ""，避免整条结构化调用因单维缺字段而 fail。
class DimLLM(BaseModel):
    name: str = ""
    score: int = 60
    rationale: str = ""


# 扁平 LLM 输出 schema：避免弱模型把嵌套 quality 对象 stringify、或乱填 status_history。
# 质量评分维度与 missing_info 等拍平到顶层，code 侧再组装成 RequirementCandidate + QualityReport。
class RequirementDraftLLM(BaseModel):
    id: str = "req-01"
    # title 必填（无默认）：GLM 在限流/截断下可能返回空 tool call，若 title 也有默认值，
    # 整个草稿会被当作合法的「空草稿」静默接受（title="" + 0 维度 → total 0 → 退化空候选）。
    # 设为必填后，空 tool call 触发校验失败 → structured_call 重试反馈 → 穷尽走缓存兜底。
    title: str
    background: str = ""
    target_users: list[str] = []
    pain_point: str = ""
    business_goal: str = ""
    scope: list[str] = []
    non_goals: list[str] = []
    boundary_conditions: list[str] = []
    clarifications: list[str] = []
    user_stories: list[UserStory] = []
    acceptance_criteria: list[AcceptanceCriterion] = []
    evidence_refs: list[str] = []
    # 拍平的质量评分（顶层，不嵌套在 quality 里）；用宽容的 DimLLM 兜底缺字段
    dimensions: list[DimLLM] = []
    missing_info: list[str] = []
    ambiguities: list[str] = []
    followup_questions: list[str] = []


def _assemble_candidate(
    out: RequirementDraftLLM, *, req_id: str, cluster_id: str
) -> RequirementCandidate:
    """把扁平 LLM 输出组装成 RequirementCandidate（quality 由 code 包成对象）。"""
    return RequirementCandidate(
        id=req_id,
        cluster_id=cluster_id,
        title=out.title,
        background=out.background,
        target_users=out.target_users,
        pain_point=out.pain_point,
        business_goal=out.business_goal,
        scope=out.scope,
        non_goals=out.non_goals,
        boundary_conditions=out.boundary_conditions,
        clarifications=out.clarifications,
        user_stories=out.user_stories,
        acceptance_criteria=out.acceptance_criteria,
        evidence_refs=out.evidence_refs,
        quality=QualityReport(
            total=0,
            dimensions=[
                QualityDimension(name=d.name, score=d.score, rationale=d.rationale)
                for d in out.dimensions
            ],
            missing_info=out.missing_info,
            ambiguities=out.ambiguities,
            followup_questions=out.followup_questions,
            gate=GateStatus.NEEDS_ENRICH,
            round=0,
        ),
    )


def _finding_brief(findings: list[Any]) -> list[dict[str, Any]]:
    """竞品/技术发现精简为「结论 + 强度」，省略 source 原文（spec §11.3）。"""
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
                    "risk": f.risk[:_MAX_TEXT],
                    "evidence_strength": f.evidence_strength.value,
                }
            )
    return out


def _cluster_brief(cluster: InsightCluster) -> dict[str, Any]:
    return {
        "id": cluster.id,
        "title": cluster.title,
        "summary": cluster.summary[:_MAX_TEXT],
        "signal_ids": cluster.signal_ids,
        "categories": [c.value for c in cluster.categories],
        "severity": cluster.severity.value,
        "frequency": cluster.frequency,
        "status": cluster.status.value,
        "candidate_title": cluster.candidate_title,
        "user_story_draft": cluster.user_story_draft[:_MAX_TEXT],
    }


def _finalize_quality(
    candidate: RequirementCandidate,
    cluster: InsightCluster,
    round_no: int,
) -> None:
    """代码侧覆写 quality 的 total/gate/round 并追加 quality_history（就地修改）。

    - total = round(mean(各维 score))；维度缺失则按已有维度求均值（不崩）。
    - gate = decide_gate(quality, cluster.categories)。
    - 追加进 quality_history（保留历轮）。
    """
    q = candidate.quality
    if q is None:  # 防御：LLM 漏给 quality 时兜一个空报告
        q = QualityReport(
            total=0,
            dimensions=[],
            missing_info=[],
            ambiguities=[],
            followup_questions=[],
            gate=GateStatus.NEEDS_ENRICH,
            round=round_no,
        )
        candidate.quality = q

    scores = [d.score for d in q.dimensions if d.name in QUALITY_DIMS]
    q.total = round(sum(scores) / len(scores)) if scores else 0
    q.round = round_no
    q.gate = decide_gate(q, cluster.categories)
    candidate.quality_history.append(q.model_copy(deep=True))


class RequirementAgent(BaseAgent):
    """需求起草 + 评分 + 补全重评。两个入口方法共用代码侧评分覆写路径。"""

    name = "requirement"
    prompt_file = "requirement_draft.md"  # enrich 时临时切换

    def draft_and_score(
        self,
        cluster: InsightCluster,
        competitor_findings: list[CompetitorFinding] | None = None,
        tech_findings: list[TechFinding] | None = None,
        human_supplement: str = "",
        valid_ids: set[str] | None = None,
        model: str | None = None,
    ) -> tuple[RequirementCandidate, list[str]]:
        """初评（round=1）。返回 (候选, evidence 闭包 violations)。"""
        self.prompt_file = "requirement_draft.md"
        payload: dict[str, Any] = {
            "cluster": _cluster_brief(cluster),
            "competitor_findings": _finding_brief(competitor_findings),
            "tech_findings": _finding_brief(tech_findings),
        }
        if human_supplement.strip():
            payload["human_supplement"] = human_supplement.strip()[:_MAX_TEXT]
        user = json.dumps(payload, ensure_ascii=False, indent=2)

        out = self.structured_call(RequirementDraftLLM, user, model=model)
        assert isinstance(out, RequirementDraftLLM)
        candidate = _assemble_candidate(out, req_id=out.id or "req-01", cluster_id=cluster.id)

        violations: list[str] = []
        if valid_ids is not None:
            candidate, violations = validate_evidence_refs(candidate, valid_ids)

        _finalize_quality(candidate, cluster, round_no=1)
        return candidate, violations

    def enrich(
        self,
        candidate: RequirementCandidate,
        cluster: InsightCluster,
        competitor_findings: list[CompetitorFinding] | None = None,
        tech_findings: list[TechFinding] | None = None,
        valid_ids: set[str] | None = None,
        model: str | None = None,
    ) -> tuple[RequirementCandidate, list[str]]:
        """补全 acceptance_criteria/non_goals/boundary_conditions 并重评（round=2）。

        返回 (补全后的候选, violations)。补全内容的 evidence_refs 经闭包校验。
        """
        self.prompt_file = "requirement_enrich.md"
        payload = {
            "current_draft": candidate.model_dump(
                mode="json",
                include={
                    "id",
                    "cluster_id",
                    "title",
                    "background",
                    "target_users",
                    "pain_point",
                    "business_goal",
                    "scope",
                    "non_goals",
                    "boundary_conditions",
                    "clarifications",
                    "user_stories",
                    "acceptance_criteria",
                    "evidence_refs",
                },
            ),
            "competitor_findings": _finding_brief(competitor_findings),
            "tech_findings": _finding_brief(tech_findings),
            "cluster_signal_ids": cluster.signal_ids,
        }
        user = json.dumps(payload, ensure_ascii=False, indent=2)

        out = self.structured_call(RequirementDraftLLM, user, model=model)
        assert isinstance(out, RequirementDraftLLM)
        enriched = _assemble_candidate(out, req_id=candidate.id, cluster_id=cluster.id)
        # 保留初评轮的 quality_history（LLM 不回填历史）
        enriched.quality_history = list(candidate.quality_history)

        violations: list[str] = []
        if valid_ids is not None:
            enriched, violations = validate_evidence_refs(enriched, valid_ids)

        _finalize_quality(enriched, cluster, round_no=2)
        return enriched, violations

    def run(self, **inputs: Any) -> RequirementCandidate:  # noqa: D401
        """便捷入口：默认走 draft_and_score。"""
        candidate, _ = self.draft_and_score(**inputs)
        return candidate

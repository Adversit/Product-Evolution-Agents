"""代码侧规则（spec §5）：质量门禁、机会加权评分、风险分级。

这些判定不交给 LLM —— LLM 仅给建议，最终由这里的纯函数覆写，保证确定性与可测。
"""

from __future__ import annotations

from evopm.schemas import (
    Category,
    ClusterStatus,
    CodeImpactItem,
    GateStatus,
    ImpactLevel,
    OpportunityScore,
    Priority,
    QualityReport,
    RiskTier,
)

# §5.1 质量门禁 10 维（固定顺序）
QUALITY_DIMS = [
    "clarity", "completeness", "testability", "acceptance_clarity",
    "evidence_sufficiency", "scope_control", "feasibility", "consistency",
    "user_value", "stage_fit",
]
BLOCKER_DIMS = {"acceptance_clarity", "completeness", "evidence_sufficiency"}

# §5.2 机会评分 10 维（固定顺序）
OPPORTUNITY_DIMS = [
    "pain_frequency", "severity", "competitor_gap", "tech_feasibility",
    "requirement_quality", "cost", "business_value", "strategy_fit",
    "urgency", "core_path_impact",
]

_SUPPORT_CATEGORIES = {Category.MISUSE, Category.DOCS}


# --------------------------------------------------------------------------- #
# §5.1 质量门禁
# --------------------------------------------------------------------------- #
def decide_gate(
    q: QualityReport, cluster_categories: list[Category] | None = None
) -> GateStatus:
    """门禁判定（代码覆写 q.gate）。

    cluster_categories 非空且 ⊆ {misuse, docs} → ROUTE_SUPPORT（转文档/客服）。
    否则：total>=70 且无低分 blocker 维 且无 missing_info → PASS，余则 NEEDS_ENRICH。
    """
    if cluster_categories and set(cluster_categories) <= _SUPPORT_CATEGORIES:
        return GateStatus.ROUTE_SUPPORT
    blockers = [d for d in q.dimensions if d.name in BLOCKER_DIMS and d.score < 60]
    if q.total >= 70 and not blockers and not q.missing_info:
        return GateStatus.PASS
    return GateStatus.NEEDS_ENRICH


# --------------------------------------------------------------------------- #
# §5.2 机会评分
# --------------------------------------------------------------------------- #
def weighted_opportunity_total(
    scores: list[OpportunityScore], weights: dict[str, float]
) -> float:
    """加权总分 = Σ(score·w) / Σ(w)，w 缺省 1.0（等权）。空输入返回 0.0。"""
    num = 0.0
    den = 0.0
    for s in scores:
        w = weights.get(s.dimension, 1.0)
        num += s.score * w
        den += w
    return round(num / den, 2) if den else 0.0


def enforce_priority_floor(
    suggested: Priority, total: float, cluster_status: ClusterStatus
) -> Priority:
    """优先级下限保护：DUPLICATE 簇强制 Duplicate；total>=75 至少 P1（不削弱更强项）。"""
    if cluster_status == ClusterStatus.DUPLICATE:
        return Priority.DUPLICATE
    if total >= 75 and suggested not in (Priority.P0, Priority.P1):
        return Priority.P1
    return suggested


# --------------------------------------------------------------------------- #
# §5.3 风险分级
# --------------------------------------------------------------------------- #
def is_core_module(module_path: str, core_modules: list[str]) -> bool:
    """module_path 前缀命中任一 core_modules → True。"""
    return any(module_path.startswith(p) for p in core_modules)


def risk_tier(item: CodeImpactItem, core_modules: list[str]) -> RiskTier:
    """核心模块 / uncertain → HIGH；possible → MEDIUM；其余 → LOW。"""
    if is_core_module(item.module_path, core_modules):
        return RiskTier.HIGH
    if item.impact_level == ImpactLevel.UNCERTAIN:
        return RiskTier.HIGH
    if item.impact_level == ImpactLevel.POSSIBLE:
        return RiskTier.MEDIUM
    return RiskTier.LOW

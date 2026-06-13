"""EngineeringAgent（节点 engineering，spec §4 / §5.3 / M11+M12）。

SolutionSpec + repo_map + core_modules → CodeImpactMap + ExecutionProposal。

代码侧职责（不交给 LLM）：
- 对每个 CodeImpactItem 用 ``rules`` 覆写 ``is_core_module`` 与 ``risk_tier``；
- 所有 HIGH 项的说明写入 ``CodeImpactMap.human_confirmation_needed``；
- 每张 TaskCard 的 ``risk_tier`` = 其关联影响项 tier 的最大值；
- gate ≠ PASS → 直接返回 ``blocked=True`` 且其余产出为空（**不调用 LLM**，短路）。

LLM 仅产出影响面与计划的初稿（含占位风险值），prompt 明令禁止输出任何代码 diff。
"""

from __future__ import annotations

from pydantic import BaseModel

from evopm import rules
from evopm.agents.base import BaseAgent
from evopm.schemas import (
    CodeImpactMap,
    ExecutionProposal,
    GateStatus,
    RiskTier,
    SolutionSpec,
)

# RiskTier 排序（取 max 用）
_TIER_ORDER = {RiskTier.LOW: 0, RiskTier.MEDIUM: 1, RiskTier.HIGH: 2}


class EngineeringOutput(BaseModel):
    """LLM 结构化输出包装 + 节点写回 state 的载体。"""

    impact: CodeImpactMap
    execution: ExecutionProposal


def _max_tier(tiers: list[RiskTier]) -> RiskTier:
    """关联影响项 tier 的最大值；无关联默认 LOW。"""
    if not tiers:
        return RiskTier.LOW
    return max(tiers, key=lambda t: _TIER_ORDER[t])


def apply_risk_rules(
    output: EngineeringOutput, core_modules: list[str]
) -> EngineeringOutput:
    """用 §5.3 规则覆写 LLM 的风险猜测；填 human_confirmation_needed；TaskCard tier 取 max。

    纯函数，原地不改输入（返回深拷贝），便于无 LLM 单测。
    """
    out = output.model_copy(deep=True)

    # 1) 每个 impact item：代码判定 is_core_module 与 risk_tier
    tier_by_module: dict[str, list[RiskTier]] = {}
    high_notes: list[str] = []
    for item in out.impact.items:
        item.is_core_module = rules.is_core_module(item.module_path, core_modules)
        item.risk_tier = rules.risk_tier(item, core_modules)
        tier_by_module.setdefault(item.module_path, []).append(item.risk_tier)
        if item.risk_tier == RiskTier.HIGH:
            flag = "核心模块" if item.is_core_module else item.impact_level.value
            high_notes.append(f"{item.module_path}（{flag}）：{item.description}")

    # 2) 所有 HIGH 项 → human_confirmation_needed（代码重填，覆盖 LLM 草稿）
    out.impact.human_confirmation_needed = high_notes

    # 3) 每张 TaskCard.risk_tier = max(关联模块的 impact tier)
    for task in out.execution.tasks:
        related_tiers: list[RiskTier] = []
        for mod in task.related_modules:
            related_tiers.extend(tier_by_module.get(mod, []))
        task.risk_tier = _max_tier(related_tiers)

    return out


def _blocked_output(requirement_id: str) -> EngineeringOutput:
    """gate ≠ PASS 时的空产出（blocked=True）。"""
    return EngineeringOutput(
        impact=CodeImpactMap(
            requirement_id=requirement_id,
            items=[],
            suggested_order=[],
            human_confirmation_needed=[],
        ),
        execution=ExecutionProposal(
            requirement_id=requirement_id,
            tasks=[],
            change_suggestions=[],
            test_suggestions=[],
            impl_plan=[],
            changelog_draft="",
            blocked=True,
        ),
    )


class EngineeringAgent(BaseAgent):
    name = "EngineeringAgent"
    prompt_file = "engineering.md"

    def run(  # type: ignore[override]
        self,
        *,
        solution: SolutionSpec,
        repo_map: str,
        core_modules: list[str],
        gate: GateStatus,
        model: str | None = None,
    ) -> EngineeringOutput:
        # 门禁前置：gate ≠ PASS 直接 blocked，不调用 LLM（短路，无需密钥可测）
        if gate != GateStatus.PASS:
            return _blocked_output(solution.requirement_id)

        user = self._build_user(solution, repo_map, core_modules)
        raw = self.structured_call(EngineeringOutput, user, model=model)
        assert isinstance(raw, EngineeringOutput)
        # 对齐 requirement_id（防 LLM 漂移）
        raw.impact.requirement_id = solution.requirement_id
        raw.execution.requirement_id = solution.requirement_id
        raw.execution.blocked = False
        return apply_risk_rules(raw, core_modules)

    @staticmethod
    def _build_user(
        solution: SolutionSpec, repo_map: str, core_modules: list[str]
    ) -> str:
        sol = solution.model_dump(mode="json")
        lines = [
            f"需求 id：{solution.requirement_id}",
            f"方案摘要：{solution.summary}",
            f"范围：{sol['scope']}",
            f"非目标：{sol['non_goals']}",
            f"用户流程：{sol['user_flow']}",
            f"验收标准：{[ac['text'] for ac in sol['acceptance_criteria']]}",
            f"边界/异常：{sol['edge_cases']}",
            f"依赖：{sol['dependencies']}",
            f"风险：{sol['risks']}",
            "",
            f"核心模块前缀（命中即高风险，供参考）：{core_modules}",
            "",
            "仓库目录树（repo_map，唯一可引用的模块来源）：",
            repo_map,
        ]
        return "\n".join(lines)

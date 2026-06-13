"""CriticAgent（节点 critic，spec §4 / §3.2 / §11.1 / M13）。

输入：代码组装的**结论清单 + 各自 evidence_refs + 闭包 violations** + 高风险影响项
+ 当前 redo_rounds（不喂全文）。
输出：CriticReview（对抗性审查 + 待人工确认清单 + 回炉指令）。

**回炉计数所有权（spec §3.2）**：
- 仅当发现严重问题且 redo_rounds < 1 时，LLM 才允许设 redo_target；
- 代码强制不变量：redo_rounds ≥ 1 → redo_target 必为 None（保证最多一轮，router 只读）。
- 实际的 redo_rounds += 1 由图节点（WT-7）在拿到本输出后完成。
"""

from __future__ import annotations

from evopm.agents.base import BaseAgent
from evopm.schemas import CriticReview


class CriticAgent(BaseAgent):
    name = "CriticAgent"
    prompt_file = "critic.md"

    def run(  # type: ignore[override]
        self,
        *,
        conclusions: list[dict],
        violations: list[str],
        high_risk_items: list[str],
        redo_rounds: int,
        model: str | None = None,
    ) -> CriticReview:
        user = self._build_user(conclusions, violations, high_risk_items, redo_rounds)
        review = self.structured_call(CriticReview, user, model=model)
        assert isinstance(review, CriticReview)
        return enforce_redo_ownership(review, redo_rounds)

    @staticmethod
    def _build_user(
        conclusions: list[dict],
        violations: list[str],
        high_risk_items: list[str],
        redo_rounds: int,
    ) -> str:
        lines = ["待审结论清单（结论描述 + 声称的 evidence_refs + 来源）："]
        for i, c in enumerate(conclusions, 1):
            target = c.get("target", "")
            refs = c.get("evidence_refs", [])
            source = c.get("source_url", "")
            src = f"，来源 {source}" if source else ""
            lines.append(f"  {i}. {target}｜证据 {refs}{src}")
        lines.append("")
        lines.append(
            "闭包校验 violations（已被代码剔除的非法引用，相关结论可能因此悬空）："
        )
        lines.extend(f"  - {v}" for v in violations) if violations else lines.append(
            "  （无）"
        )
        lines.append("")
        lines.append("高风险代码影响项（必须全部进 pending_confirmations）：")
        lines.extend(f"  - {h}" for h in high_risk_items) if high_risk_items else (
            lines.append("  （无）")
        )
        lines.append("")
        lines.append(f"当前 redo_rounds（已回炉轮次）：{redo_rounds}")
        if redo_rounds >= 1:
            lines.append("注意：已回炉过一次，本轮 redo_target 必须为 null。")
        return "\n".join(lines)


def enforce_redo_ownership(review: CriticReview, redo_rounds: int) -> CriticReview:
    """代码强制不变量：redo_rounds ≥ 1 → redo_target=None（即使 LLM 误设）。

    返回深拷贝；原对象不改。redo_rounds < 1 时尊重 LLM 的判断（可设或不设）。
    """
    out = review.model_copy(deep=True)
    if redo_rounds >= 1:
        out.redo_target = None
        out.redo_instructions = ""
    return out

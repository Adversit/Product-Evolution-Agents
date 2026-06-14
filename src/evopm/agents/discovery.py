"""DiscoveryAgent（M4，spec §4）：可行动信号 → 2–4 个 InsightCluster。

- 输入：仅**可行动**信号（actionability ∈ {real_issue, sufficient, suspected_duplicate}
  之类，由调用节点过滤后传入；本 Agent 不重复过滤逻辑）+ 历史需求池。
- LLM 在单次响应内分配 ``clu-01..`` 并产出簇；代码随后做证据闭包校验
  （signal_ids 必须 ⊆ 已存在 sig id），非法 id 剔除并记入 violations。
- ``frequency`` 由代码按清洗后的 signal_ids 长度回填，保证与闭包一致。
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel

from evopm.agents.base import (
    BaseAgent,
    collect_valid_ids,
    validate_evidence_refs,
)
from evopm.schemas import ClusterStatus, ExistingRequirement, InsightCluster, SignalItem


class DiscoveryOutput(BaseModel):
    """聚类结果包装（spec §4：DiscoveryOutput(clusters=...)）。"""

    clusters: list[InsightCluster]


# actionability 中"可进入聚类"的档（spec §5.4：emotional/suspected_misuse/insufficient 出局）
_ACTIONABLE = {"real_issue", "sufficient", "suspected_duplicate"}


def filter_actionable(signals: list[SignalItem]) -> list[SignalItem]:
    """漏斗第一级（spec §5.4）：剔除 emotional/suspected_misuse/insufficient。

    actionability 为 None（未标注）的保守保留，交聚类判断。
    """
    kept: list[SignalItem] = []
    for s in signals:
        act = s.actionability.value if s.actionability is not None else None
        if act is None or act in _ACTIONABLE:
            kept.append(s)
    return kept


class DiscoveryAgent(BaseAgent):
    name = "DiscoveryAgent"
    prompt_file = "discovery.md"

    def run(self, **inputs: Any) -> DiscoveryOutput:  # type: ignore[override]
        signals: list[SignalItem] = inputs["signals"]
        existing: list[ExistingRequirement] = inputs.get("existing_requirements", [])
        user = self._build_user(signals, existing)
        raw: DiscoveryOutput = self.structured_call(DiscoveryOutput, user)  # type: ignore[assignment]

        # 证据闭包：signal_ids 必须指向真实存在的 sig id（spec §4 末尾）
        valid_ids = collect_valid_ids(
            {"signals": signals, "existing_requirements": existing}
        )
        clean, violations = validate_evidence_refs(raw, valid_ids)
        clean_out: DiscoveryOutput = clean  # type: ignore[assignment]

        # frequency 与清洗后的 signal_ids 对齐
        for clu in clean_out.clusters:
            clu.frequency = len(clu.signal_ids)
        # 历史查重归一化：duplicate_of_existing 必须指向真实历史需求 id。
        existing_ids = {e.id for e in existing}
        for clu in clean_out.clusters:
            doe = clu.duplicate_of_existing
            if doe and doe not in existing_ids:  # 悬空历史引用 → 清除，不算重复
                clu.duplicate_of_existing = ""
                if clu.status == ClusterStatus.DUPLICATE:
                    clu.status = ClusterStatus.KNOWN
            elif doe:  # 有效历史引用 → 强制标 DUPLICATE（状态与引用一致）
                clu.status = ClusterStatus.DUPLICATE
        self.violations = violations  # 供节点收集后作为 Critic 输入
        return clean_out

    @staticmethod
    def _build_user(
        signals: list[SignalItem], existing: list[ExistingRequirement]
    ) -> str:
        """最小上下文（spec §11.3）：可行动 signals(id+text+category) + 历史需求池。"""
        sig_lines = []
        for s in signals:
            cat = s.category.value if s.category is not None else "?"
            sig_lines.append(f"- id={s.id} | category={cat} | text={s.text[:800]}")
        ex_lines = [
            f"- id={e.id} | {e.title} | status={e.status} | 摘要：{e.summary}"
            for e in existing
        ]
        ex_block = "\n".join(ex_lines) if ex_lines else "（无历史需求）"
        return (
            "可行动信号：\n"
            + "\n".join(sig_lines)
            + "\n\n历史需求池（用于查重 duplicate_of_existing）：\n"
            + ex_block
        )

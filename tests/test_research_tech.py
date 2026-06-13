"""T2.2 验收：ResearchAgent 技术模式（需真实 ZHIPUAI_API_KEY，无 key 自动 skip）。

验收点（tasks.md T2.2）：≥3 条 finding；≥1 条非 mature 档（证明不是无脑推荐）；
每条 fit_reason 非空。mock 模式走本地 tech_notes + 真实 LLM。
"""

from __future__ import annotations

import os

import pytest

from evopm.agents.research import ResearchAgent, TechOutput
from evopm.config import load_product_context
from evopm.schemas import (
    Category,
    ClusterStatus,
    InsightCluster,
    Severity,
    TechMaturity,
)

pytestmark = pytest.mark.skipif(
    not os.environ.get("ZHIPUAI_API_KEY"), reason="needs ZHIPUAI_API_KEY"
)

_MODEL = os.environ.get("EVOPM_MODEL", "glm-4.7-flash")


def _cluster() -> InsightCluster:
    return InsightCluster(
        id="clu-01",
        title="文档解析失败且进度不可见",
        summary="复杂文档解析卡住/失败，用户无法看到解析进度或重试",
        signal_ids=["sig-001"],
        categories=[Category.BUG, Category.PERFORMANCE],
        severity=Severity.HIGH,
        frequency=6,
        status=ClusterStatus.NEW,
        candidate_title="解析进度可视化与失败自动重试",
        user_story_draft="作为知识库管理员，我希望看到文档解析的实时进度与失败原因",
    )


def test_tech_mock_acceptance():
    pc = load_product_context("data/demo_kb/product.yaml")
    agent = ResearchAgent(mode="tech")
    out = agent.run(_cluster(), pc, run_mode="mock", model=_MODEL)

    assert isinstance(out, TechOutput)
    assert len(out.findings) >= 3

    # ≥1 条非 mature 档（防技术热点伪需求）
    non_mature = [f for f in out.findings if f.maturity != TechMaturity.MATURE]
    assert non_mature, "全部 mature，疑似无脑推荐"

    # 每条 fit_reason 非空
    assert all(f.fit_reason.strip() for f in out.findings)

    # mock 来源 evidence_strength 不得高于 moderate
    assert all(
        f.evidence_strength.value in {"moderate", "weak", "no_direct", "inference_only"}
        for f in out.findings
    )

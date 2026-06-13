"""T2.1 验收：ResearchAgent 竞品模式（需真实 ZHIPUAI_API_KEY，无 key 自动 skip）。

验收点（tasks.md T2.1）：mock 模式 fixture——3 竞品各 ≥1 条 finding，mock 来源标 `mock://`；
verdict 三类至少出现两类。这里用 ``--mock``（run_mode="mock"）走本地材料 + 真实 LLM，
不依赖联网搜索。
"""

from __future__ import annotations

import os

import pytest

from evopm.agents.research import CompetitorOutput, ResearchAgent
from evopm.config import load_product_context
from evopm.schemas import (
    Category,
    ClusterStatus,
    InsightCluster,
    Severity,
)

pytestmark = pytest.mark.skipif(
    not os.environ.get("ZHIPUAI_API_KEY"), reason="needs ZHIPUAI_API_KEY"
)

_MODEL = os.environ.get("EVOPM_MODEL", "glm-4.5-air")


def _cluster() -> InsightCluster:
    return InsightCluster(
        id="clu-01",
        title="文档解析失败且进度不可见",
        summary="复杂文档解析卡住/失败，用户无法看到解析进度或重试",
        signal_ids=["sig-001"],
        categories=[Category.BUG, Category.UX],
        severity=Severity.HIGH,
        frequency=6,
        status=ClusterStatus.NEW,
        candidate_title="解析进度可视化与失败自动重试",
        user_story_draft="作为知识库管理员，我希望看到文档解析的实时进度与失败原因",
    )


def test_competitor_mock_acceptance():
    pc = load_product_context("data/demo_kb/product.yaml")
    agent = ResearchAgent(mode="competitor")
    out = agent.run(_cluster(), pc, run_mode="mock", model=_MODEL)

    assert isinstance(out, CompetitorOutput)
    assert len(out.findings) >= 3

    competitors = {f.competitor for f in out.findings}
    expected = {c.name for c in pc.competitors}
    # 3 竞品各 ≥1 条
    assert expected <= competitors, f"缺少竞品：{expected - competitors}"

    # mock 来源标 mock://
    assert all(f.source_url.startswith("mock://") for f in out.findings)
    # mock 来源 evidence_strength 不得高于 moderate
    assert all(
        f.evidence_strength.value in {"moderate", "weak", "no_direct", "inference_only"}
        for f in out.findings
    )
    # verdict 三类至少出现两类
    verdicts = {f.verdict for f in out.findings}
    assert len(verdicts) >= 2, f"verdict 种类不足：{verdicts}"
    # 每条 implication 非空
    assert all(f.implication.strip() for f in out.findings)

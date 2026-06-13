"""CriticAgent 单测（T4.2，spec §4 / §3.2 / §11.1 / M13）。

无 LLM 部分（始终运行）：
- 回炉所有权不变量：redo_rounds ≥ 1 → redo_target=None（即使 LLM 误设）；
  redo_rounds < 1 时尊重 LLM 的取值；
- user 拼装包含 violations / 高风险项 / redo_rounds 语境；
- 干净导入 + load_prompt。

LLM 部分（无 ZHIPUAI_API_KEY 时跳过）：见文件末尾验收 fixture。
"""

import os

import pytest

from evopm.agents.base import load_prompt
from evopm.agents.critic import CriticAgent, enforce_redo_ownership
from evopm.schemas import (
    CriticFinding,
    CriticReview,
    EvidenceStrength,
    RiskTier,
)


def _review(redo_target):
    return CriticReview(
        findings=[
            CriticFinding(
                target="某结论 cf-01",
                evidence_strength=EvidenceStrength.INFERENCE_ONLY,
                overreach=True,
                risk_tier=RiskTier.HIGH,
                note="无证据",
            )
        ],
        pending_confirmations=["deepdoc/parser 高风险，待确认"],
        redo_target=redo_target,
        redo_instructions="重做影响分析" if redo_target else "",
    )


# --------------------------------------------------------------------------- #
# 回炉所有权不变量（无 LLM）
# --------------------------------------------------------------------------- #
def test_redo_target_forced_none_when_rounds_already_one():
    review = _review(redo_target="engineering")
    out = enforce_redo_ownership(review, redo_rounds=1)
    assert out.redo_target is None
    assert out.redo_instructions == ""


def test_redo_target_kept_when_rounds_zero():
    review = _review(redo_target="engineering")
    out = enforce_redo_ownership(review, redo_rounds=0)
    assert out.redo_target == "engineering"
    assert out.redo_instructions == "重做影响分析"


def test_redo_none_stays_none_when_rounds_zero():
    review = _review(redo_target=None)
    out = enforce_redo_ownership(review, redo_rounds=0)
    assert out.redo_target is None


def test_enforce_does_not_mutate_input():
    review = _review(redo_target="engineering")
    enforce_redo_ownership(review, redo_rounds=1)
    assert review.redo_target == "engineering"  # 原对象不变


# --------------------------------------------------------------------------- #
# user 拼装
# --------------------------------------------------------------------------- #
def test_build_user_includes_context():
    user = CriticAgent._build_user(
        conclusions=[{"target": "cf-01 竞品已解决", "evidence_refs": [], "source_url": "mock://dify.md"}],
        violations=["execution.tasks[0].evidence_refs: 剔除非法引用 ['sig-999']"],
        high_risk_items=["deepdoc/parser（核心模块）：改解析"],
        redo_rounds=1,
    )
    assert "cf-01 竞品已解决" in user
    assert "mock://dify.md" in user
    assert "sig-999" in user
    assert "deepdoc/parser" in user
    assert "redo_rounds" in user
    assert "必须为 null" in user  # redo_rounds>=1 的提示


def test_build_user_handles_empty_sections():
    user = CriticAgent._build_user(
        conclusions=[], violations=[], high_risk_items=[], redo_rounds=0
    )
    assert "（无）" in user
    assert "redo_rounds（已回炉轮次）：0" in user


# --------------------------------------------------------------------------- #
# prompt
# --------------------------------------------------------------------------- #
def test_prompt_loads():
    text = load_prompt("critic.md")
    assert "证据引用规则" in text  # include 展开
    assert "redo_target" in text
    assert "来源有限" in text


# --------------------------------------------------------------------------- #
# T4.2 验收 fixture（需真实 LLM）
# --------------------------------------------------------------------------- #
pytestmark_live = pytest.mark.skipif(
    not os.environ.get("ZHIPUAI_API_KEY"), reason="needs ZHIPUAI_API_KEY"
)


@pytestmark_live
def test_critic_acceptance_live():
    """无证据结论 → inference_only+overreach；mock 来源标来源有限；高风险全进 pending；
    redo_rounds=1 时 redo_target=None。"""
    agent = CriticAgent()
    conclusions = [
        {"target": "结论 A：检索质量必将提升 50%（无任何 evidence_refs）",
         "evidence_refs": [], "source_url": ""},
        {"target": "cf-01：Dify 已支持进度展示", "evidence_refs": ["cf-01"],
         "source_url": "mock://dify.md"},
    ]
    review = agent.run(
        conclusions=conclusions,
        violations=["某结论 evidence_refs 剔除 ['sig-999']"],
        high_risk_items=["deepdoc/parser（核心模块）：改解析逻辑"],
        redo_rounds=1,
        model="glm-4.5-air",
    )
    # redo_rounds=1 → 必为 None
    assert review.redo_target is None
    # 高风险项全部进 pending_confirmations
    assert any("deepdoc/parser" in p for p in review.pending_confirmations)
    # 至少有一条无证据结论被判 inference_only + overreach
    assert any(
        f.evidence_strength == EvidenceStrength.INFERENCE_ONLY and f.overreach
        for f in review.findings
    )

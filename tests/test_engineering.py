"""EngineeringAgent 单测（T4.1，spec §4 / §5.3 / M11+M12）。

无 LLM 部分（始终运行）：
- risk_tier / is_core_module 覆写：核心模块 → HIGH → 进 human_confirmation_needed；
- TaskCard.risk_tier = 关联影响项 tier 的 max；
- gate ≠ PASS → blocked=True 短路（不触发 LLM）；
- 干净导入 + load_prompt（prompt 不含 ``` 代码围栏）。

LLM 部分（无 ZHIPUAI_API_KEY 时跳过）：见文件末尾验收 fixture。
"""

import os

import pytest

from evopm.agents.base import load_prompt
from evopm.agents.engineering import (
    EngineeringAgent,
    EngineeringOutput,
    apply_risk_rules,
)
from evopm.schemas import (
    AcceptanceCriterion,
    CodeImpactItem,
    CodeImpactMap,
    ExecutionProposal,
    GateStatus,
    ImpactLevel,
    ImpactType,
    ImplPlanStep,
    RiskTier,
    SolutionSpec,
    TaskCard,
    TaskType,
)

CORE = ["rag/nlp", "deepdoc/parser", "rag/svr"]


def _item(module_path, impact_level, types=None):
    return CodeImpactItem(
        module_path=module_path,
        impact_level=impact_level,
        impact_types=types or [ImpactType.SERVICE],
        description=f"changes in {module_path}",
        is_core_module=False,  # 占位，待规则覆写
        risk_tier=RiskTier.LOW,  # 占位，待规则覆写
        verify_points=["run tests"],
    )


def _output_with_items(items, tasks):
    return EngineeringOutput(
        impact=CodeImpactMap(
            requirement_id="req-01",
            items=items,
            suggested_order=[i.module_path for i in items],
            human_confirmation_needed=["LLM 草稿应被覆盖"],
        ),
        execution=ExecutionProposal(
            requirement_id="req-01",
            tasks=tasks,
            change_suggestions=["改 X 因为 Y"],
            test_suggestions=["加单测"],
            impl_plan=[ImplPlanStep(step=1, action="do", modules=["x"], verify="check")],
            changelog_draft="新增进度展示",
        ),
    )


def _task(task_id, related):
    return TaskCard(
        id=task_id,
        type=TaskType.BACKEND,
        title="t",
        description="d",
        related_modules=related,
        evidence_refs=[],
        risk_tier=RiskTier.LOW,  # 占位
    )


# --------------------------------------------------------------------------- #
# 规则覆写（无 LLM）
# --------------------------------------------------------------------------- #
def test_core_module_item_becomes_high_and_enters_confirmation():
    items = [
        _item("deepdoc/parser", ImpactLevel.CERTAIN),  # 核心 → HIGH
        _item("web/src", ImpactLevel.POSSIBLE),         # 非核心 possible → MEDIUM
        _item("docs/guide", ImpactLevel.CERTAIN),       # 非核心 certain → LOW
    ]
    out = apply_risk_rules(_output_with_items(items, []), CORE)

    by_path = {i.module_path: i for i in out.impact.items}
    assert by_path["deepdoc/parser"].is_core_module is True
    assert by_path["deepdoc/parser"].risk_tier == RiskTier.HIGH
    assert by_path["web/src"].risk_tier == RiskTier.MEDIUM
    assert by_path["docs/guide"].risk_tier == RiskTier.LOW

    # 仅 HIGH 项进 human_confirmation_needed，且 LLM 草稿被覆盖
    assert len(out.impact.human_confirmation_needed) == 1
    assert "deepdoc/parser" in out.impact.human_confirmation_needed[0]
    assert "LLM 草稿应被覆盖" not in out.impact.human_confirmation_needed


def test_uncertain_non_core_item_is_high():
    items = [_item("api/apps", ImpactLevel.UNCERTAIN)]
    out = apply_risk_rules(_output_with_items(items, []), CORE)
    assert out.impact.items[0].risk_tier == RiskTier.HIGH
    assert out.impact.items[0].is_core_module is False


def test_taskcard_risk_tier_is_max_of_related_items():
    items = [
        _item("deepdoc/parser", ImpactLevel.CERTAIN),  # HIGH
        _item("web/src", ImpactLevel.POSSIBLE),         # MEDIUM
        _item("docs/guide", ImpactLevel.CERTAIN),       # LOW
    ]
    tasks = [
        _task("task-01", ["web/src", "docs/guide"]),       # max(MEDIUM, LOW) = MEDIUM
        _task("task-02", ["deepdoc/parser", "web/src"]),   # max(HIGH, MEDIUM) = HIGH
        _task("task-03", ["unknown/module"]),               # 无关联 → LOW
    ]
    out = apply_risk_rules(_output_with_items(items, tasks), CORE)
    by_id = {t.id: t for t in out.execution.tasks}
    assert by_id["task-01"].risk_tier == RiskTier.MEDIUM
    assert by_id["task-02"].risk_tier == RiskTier.HIGH
    assert by_id["task-03"].risk_tier == RiskTier.LOW


def test_apply_risk_rules_does_not_mutate_input():
    items = [_item("deepdoc/parser", ImpactLevel.CERTAIN)]
    src = _output_with_items(items, [])
    apply_risk_rules(src, CORE)
    # 原对象保持占位值
    assert src.impact.items[0].risk_tier == RiskTier.LOW
    assert src.impact.items[0].is_core_module is False


# --------------------------------------------------------------------------- #
# gate ≠ PASS 短路（无 LLM —— run 在调用模型前返回）
# --------------------------------------------------------------------------- #
def _solution():
    return SolutionSpec(
        requirement_id="req-01",
        summary="s",
        scope=["a"],
        non_goals=["b"],
        user_flow=["step1"],
        acceptance_criteria=[AcceptanceCriterion(text="c", type="functional")],
        edge_cases=["e"],
        test_scenarios=["t"],
        role_notes={"product": "p", "dev": "d", "qa": "q", "support": "s"},
        risks=["r"],
        dependencies=["dep"],
    )


@pytest.mark.parametrize(
    "gate",
    [GateStatus.NEEDS_ENRICH, GateStatus.NEEDS_HUMAN, GateStatus.ROUTE_SUPPORT],
)
def test_gate_not_pass_returns_blocked_without_llm(gate, monkeypatch):
    agent = EngineeringAgent()

    def _boom(*a, **k):  # 确保未触发 LLM
        raise AssertionError("gate≠PASS 不应调用 LLM")

    monkeypatch.setattr(agent, "structured_call", _boom)

    out = agent.run(solution=_solution(), repo_map="x", core_modules=CORE, gate=gate)
    assert out.execution.blocked is True
    assert out.impact.items == []
    assert out.execution.tasks == []
    assert out.execution.impl_plan == []
    assert out.impact.requirement_id == "req-01"


# --------------------------------------------------------------------------- #
# prompt：不含代码围栏
# --------------------------------------------------------------------------- #
def test_prompt_loads_and_forbids_code_blocks():
    text = load_prompt("engineering.md")
    assert "证据引用规则" in text  # include 被展开
    assert "```" not in text       # prompt 自身不含三反引号代码块
    assert "禁止" in text or "严禁" in text


# --------------------------------------------------------------------------- #
# T4.1 验收 fixture（需真实 LLM）
# --------------------------------------------------------------------------- #
pytestmark_live = pytest.mark.skipif(
    not os.environ.get("ZHIPUAI_API_KEY"), reason="needs ZHIPUAI_API_KEY"
)


@pytestmark_live
def test_engineering_acceptance_live():
    """影响面 ≥4 模块、三档≥两档、核心 HIGH 进确认、每步有 verify、无代码围栏。"""
    repo_map = (
        "## 目录\n"
        "- deepdoc/parser: 文档解析\n"
        "- rag/nlp: 检索与 NLP\n"
        "- web/src: 前端\n"
        "- api/apps: API 层\n"
        "- conf: 配置\n"
        "## 核心模块\n- rag/nlp\n- deepdoc/parser\n- rag/svr\n"
    )
    agent = EngineeringAgent()
    out = agent.run(
        solution=_solution(), repo_map=repo_map, core_modules=CORE,
        gate=GateStatus.PASS, model="glm-4.7-flash",
    )
    assert out.execution.blocked is False
    assert len(out.impact.items) >= 4
    levels = {i.impact_level for i in out.impact.items}
    assert len(levels) >= 2
    core_items = [i for i in out.impact.items if i.is_core_module]
    for ci in core_items:
        assert ci.risk_tier == RiskTier.HIGH
        assert any(ci.module_path in h for h in out.impact.human_confirmation_needed)
    for step in out.execution.impl_plan:
        assert step.verify.strip()
    assert "```" not in out.execution.changelog_draft

"""风险分级规则单测（T0.6，spec §5.3）。"""

from evopm.rules import is_core_module, risk_tier
from evopm.schemas import CodeImpactItem, ImpactLevel, ImpactType, RiskTier

CORE = ["rag/nlp", "deepdoc/parser", "rag/svr"]


def _item(module_path, impact_level):
    return CodeImpactItem(
        module_path=module_path,
        impact_level=impact_level,
        impact_types=[ImpactType.SERVICE],
        description="d",
        is_core_module=False,  # 占位，规则函数自行判定
        risk_tier=RiskTier.LOW,  # 占位
        verify_points=[],
    )


def test_core_module_prefix_is_high():
    assert risk_tier(_item("rag/nlp", ImpactLevel.CERTAIN), CORE) == RiskTier.HIGH
    # 前缀命中（子目录）也算核心
    assert risk_tier(_item("deepdoc/parser/pdf_parser.py", ImpactLevel.CERTAIN), CORE) == RiskTier.HIGH


def test_uncertain_non_core_is_high():
    assert risk_tier(_item("web/src", ImpactLevel.UNCERTAIN), CORE) == RiskTier.HIGH


def test_possible_non_core_is_medium():
    assert risk_tier(_item("web/src", ImpactLevel.POSSIBLE), CORE) == RiskTier.MEDIUM


def test_certain_non_core_is_low():
    assert risk_tier(_item("web/src", ImpactLevel.CERTAIN), CORE) == RiskTier.LOW


def test_is_core_module_prefix():
    assert is_core_module("rag/svr", CORE) is True
    assert is_core_module("rag/svr/task_executor.py", CORE) is True
    assert is_core_module("api/apps", CORE) is False

"""质量门禁规则单测（T0.6，spec §5.1）：pass / needs_enrich / route_support 三分支。"""

import pytest

from evopm.rules import BLOCKER_DIMS, decide_gate
from evopm.schemas import Category, GateStatus, QualityDimension, QualityReport


def _report(total, dims, missing_info=None):
    return QualityReport(
        total=total,
        dimensions=[QualityDimension(name=n, score=s, rationale="r") for n, s in dims],
        missing_info=missing_info or [],
        ambiguities=[],
        followup_questions=[],
        gate=GateStatus.NEEDS_ENRICH,  # 占位，由 decide_gate 覆写
        round=1,
    )


def _all_good_dims(score=80):
    return [(d, score) for d in BLOCKER_DIMS]


def test_pass_when_high_total_no_blockers_no_missing():
    q = _report(82, _all_good_dims(75))
    assert decide_gate(q) == GateStatus.PASS


def test_needs_enrich_when_total_low():
    q = _report(58, _all_good_dims(75))
    assert decide_gate(q) == GateStatus.NEEDS_ENRICH


def test_needs_enrich_when_blocker_dim_below_60():
    dims = _all_good_dims(75)
    dims[0] = ("acceptance_clarity", 50)  # blocker 维低于 60
    q = _report(80, dims)
    assert decide_gate(q) == GateStatus.NEEDS_ENRICH


def test_needs_enrich_when_missing_info_present():
    q = _report(80, _all_good_dims(75), missing_info=["缺验收标准"])
    assert decide_gate(q) == GateStatus.NEEDS_ENRICH


def test_route_support_when_all_categories_misuse_or_docs():
    q = _report(82, _all_good_dims(75))  # 即便质量达标
    assert decide_gate(q, [Category.MISUSE, Category.DOCS]) == GateStatus.ROUTE_SUPPORT
    assert decide_gate(q, [Category.DOCS]) == GateStatus.ROUTE_SUPPORT


def test_no_route_support_when_categories_mixed():
    q = _report(82, _all_good_dims(75))
    assert decide_gate(q, [Category.MISUSE, Category.BUG]) == GateStatus.PASS


def test_no_route_support_when_categories_none_or_empty():
    q = _report(82, _all_good_dims(75))
    assert decide_gate(q, None) == GateStatus.PASS
    assert decide_gate(q, []) == GateStatus.PASS

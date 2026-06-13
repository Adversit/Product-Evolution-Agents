"""HITL 渲染/解析单测（WT-6 / T6.1，spec §3.3 + §11.5）。

纯 render/parse，无需 API key。所有 input() 用注入的 fake-input，绝不阻塞 stdin。
"""

from __future__ import annotations

import pytest

from evopm import hitl
from evopm.schemas import ReviewAction, RiskTier


# --------------------------------------------------------------------------- #
# fake input：按预设答案序列依次返回；多余调用抛错（暴露死循环）。
# --------------------------------------------------------------------------- #
class FakeAsk:
    def __init__(self, answers: list[str]):
        self._answers = list(answers)
        self.calls: list[str] = []

    def __call__(self, prompt: str = "") -> str:
        self.calls.append(prompt)
        if not self._answers:
            raise AssertionError(f"fake input 已耗尽，意外的额外提问：{prompt!r}")
        return self._answers.pop(0)


# --------------------------------------------------------------------------- #
# payload 构造器
# --------------------------------------------------------------------------- #
def _select_payload():
    return {
        "type": "select_cluster",
        "clusters": [
            {"id": "clu-01", "title": "解析失败/状态不可见", "summary": "s1",
             "frequency": 7, "severity": "high", "status": "new"},
            {"id": "clu-02", "title": "检索质量", "summary": "s2",
             "frequency": 4, "severity": "medium", "status": "new"},
            {"id": "clu-03", "title": "历史重复", "summary": "s3",
             "frequency": 2, "severity": "low", "status": "duplicate"},
        ],
    }


def _clarify_payload():
    return {
        "type": "clarify",
        "missing_info": ["缺少验收标准", "缺少边界条件"],
        "questions": ["目标用户是谁？", "成功指标是什么？"],
    }


def _final_review_payload():
    return {
        "type": "final_review",
        "items": [
            {"ref": "req-01", "description": "焦点需求", "risk_tier": "high",
             "evidence_strength": "moderate"},
            {"ref": "cf-01", "description": "竞品发现", "risk_tier": "medium",
             "evidence_strength": "weak"},
            {"ref": "task-03", "description": "低风险任务", "risk_tier": "low",
             "evidence_strength": "strong"},
            {"ref": "task-04", "description": "另一低风险任务", "risk_tier": "low",
             "evidence_strength": "strong"},
        ],
    }


# --------------------------------------------------------------------------- #
# ① select_cluster
# --------------------------------------------------------------------------- #
def test_select_cluster_valid():
    ask = FakeAsk(["clu-02"])
    out = hitl.parse_select_cluster(_select_payload(), ask=ask)
    assert out == {"cluster_id": "clu-02"}


def test_select_cluster_invalid_then_reprompts():
    ask = FakeAsk(["nope", "clu-99", "clu-01"])
    out = hitl.parse_select_cluster(_select_payload(), ask=ask)
    assert out == {"cluster_id": "clu-01"}
    assert len(ask.calls) == 3  # 两次非法 + 一次合法


def test_handle_interrupt_select_dispatch():
    ask = FakeAsk(["clu-01"])
    out = hitl.handle_interrupt(_select_payload(), ask=ask)
    assert out == {"cluster_id": "clu-01"}


# --------------------------------------------------------------------------- #
# ② clarify
# --------------------------------------------------------------------------- #
def test_clarify_supplement_asks_text():
    ask = FakeAsk(["supplement", "补充：目标用户为企业团队"])
    out = hitl.parse_clarify(_clarify_payload(), ask=ask)
    assert out == {"action": "supplement", "text": "补充：目标用户为企业团队"}


def test_clarify_force_pass_no_text():
    ask = FakeAsk(["force_pass"])
    out = hitl.parse_clarify(_clarify_payload(), ask=ask)
    assert out == {"action": "force_pass", "text": ""}


def test_clarify_route_support():
    ask = FakeAsk(["route_support"])
    out = hitl.parse_clarify(_clarify_payload(), ask=ask)
    assert out == {"action": "route_support", "text": ""}


def test_clarify_invalid_then_reprompts():
    ask = FakeAsk(["maybe", "force_pass"])
    out = hitl.parse_clarify(_clarify_payload(), ask=ask)
    assert out["action"] == "force_pass"
    assert len(ask.calls) == 2


def test_clarify_action_case_insensitive():
    ask = FakeAsk(["FORCE_PASS"])
    out = hitl.parse_clarify(_clarify_payload(), ask=ask)
    assert out["action"] == "force_pass"


# --------------------------------------------------------------------------- #
# ③ final_review
# --------------------------------------------------------------------------- #
def test_final_review_batch_accept_low_risk():
    # 低风险项批量接受（a）；两个非低风险项逐项 accept。
    ask = FakeAsk(["a", "accept", "accept"])
    out = hitl.parse_final_review(_final_review_payload(), ask=ask)
    decisions = out["decisions"]
    # 2 低风险 (批量) + 2 非低风险 = 4 条
    assert len(decisions) == 4
    refs = {d["item_ref"] for d in decisions}
    assert refs == {"req-01", "cf-01", "task-03", "task-04"}
    assert all(d["action"] == ReviewAction.ACCEPT.value for d in decisions)
    # schema 字段齐全（§3.3 resume）
    for d in decisions:
        assert set(["item_ref", "action", "reason", "edited_content"]) <= set(d)


def test_final_review_actions_build_correct_decisions():
    # 批量接受低风险后，对两个非低风险项分别 reject / edit。
    ask = FakeAsk([
        "a",                       # 批量接受 2 个低风险
        "reject", "证据不足",       # req-01：reject + reason
        "edit", "改后的竞品结论",    # cf-01：edit + edited_content（edit 不问 reason）
    ])
    out = hitl.parse_final_review(_final_review_payload(), ask=ask)
    by_ref = {d["item_ref"]: d for d in out["decisions"]}

    assert by_ref["req-01"]["action"] == ReviewAction.REJECT.value
    assert by_ref["req-01"]["reason"] == "证据不足"

    assert by_ref["cf-01"]["action"] == ReviewAction.EDIT.value
    assert by_ref["cf-01"]["edited_content"] == "改后的竞品结论"

    # 低风险项被批量接受
    assert by_ref["task-03"]["action"] == ReviewAction.ACCEPT.value
    assert by_ref["task-04"]["action"] == ReviewAction.ACCEPT.value


def test_final_review_all_five_actions_parse():
    # 覆盖 5 种 ReviewAction：用一个全非低风险的 payload 逐项验证 token 解析。
    payload = {
        "type": "final_review",
        "items": [
            {"ref": "i1", "description": "d", "risk_tier": "high",
             "evidence_strength": "weak"},
            {"ref": "i2", "description": "d", "risk_tier": "high",
             "evidence_strength": "weak"},
            {"ref": "i3", "description": "d", "risk_tier": "high",
             "evidence_strength": "weak"},
            {"ref": "i4", "description": "d", "risk_tier": "high",
             "evidence_strength": "weak"},
            {"ref": "i5", "description": "d", "risk_tier": "high",
             "evidence_strength": "weak"},
        ],
    }
    ask = FakeAsk([
        "accept",
        "reject", "r2",
        "edit", "e3",
        "redo", "r4",
        "more_evidence", "r5",
    ])
    out = hitl.parse_final_review(payload, ask=ask)
    actions = [d["action"] for d in out["decisions"]]
    assert actions == [
        ReviewAction.ACCEPT.value,
        ReviewAction.REJECT.value,
        ReviewAction.EDIT.value,
        ReviewAction.REDO.value,
        ReviewAction.MORE_EVIDENCE.value,
    ]


def test_final_review_invalid_action_reprompts():
    payload = {
        "type": "final_review",
        "items": [
            {"ref": "i1", "description": "d", "risk_tier": "high",
             "evidence_strength": "weak"},
        ],
    }
    ask = FakeAsk(["bogus", "accept"])
    out = hitl.parse_final_review(payload, ask=ask)
    assert out["decisions"][0]["action"] == ReviewAction.ACCEPT.value


def test_final_review_show_then_process_low_items():
    # 不批量接受（回车），逐项处理含低风险项。
    payload = {
        "type": "final_review",
        "items": [
            {"ref": "hi", "description": "d", "risk_tier": "high",
             "evidence_strength": "weak"},
            {"ref": "lo", "description": "d", "risk_tier": "low",
             "evidence_strength": "strong"},
        ],
    }
    ask = FakeAsk(["", "accept", "reject", "低价值"])  # 跳过批量 → hi accept → lo reject
    out = hitl.parse_final_review(payload, ask=ask)
    by_ref = {d["item_ref"]: d for d in out["decisions"]}
    assert by_ref["hi"]["action"] == ReviewAction.ACCEPT.value
    assert by_ref["lo"]["action"] == ReviewAction.REJECT.value
    assert by_ref["lo"]["reason"] == "低价值"


def test_make_decision_fields():
    item = {"ref": "req-01"}
    d = hitl._make_decision(item, ReviewAction.REJECT, "理由", "")
    assert d.checkpoint == "final_review"
    assert d.item_ref == "req-01"
    assert d.action == ReviewAction.REJECT
    assert d.reason == "理由"
    assert d.timestamp  # ISO 时间戳非空


# --------------------------------------------------------------------------- #
# replay 自动应答（§11.5）
# --------------------------------------------------------------------------- #
def test_auto_resume_select_largest_cluster():
    out = hitl.auto_resume(_select_payload())
    assert out == {"cluster_id": "clu-01"}  # frequency=7 最大


def test_auto_resume_clarify_force_pass():
    out = hitl.auto_resume(_clarify_payload())
    assert out == {"action": "force_pass", "text": ""}


def test_auto_resume_review_all_accept():
    out = hitl.auto_resume(_final_review_payload())
    decisions = out["decisions"]
    assert len(decisions) == 4  # 含低风险项全 accept
    assert all(d["action"] == ReviewAction.ACCEPT.value for d in decisions)
    assert {d["item_ref"] for d in decisions} == {
        "req-01", "cf-01", "task-03", "task-04"
    }


def test_auto_resume_unknown_type_raises():
    with pytest.raises(ValueError):
        hitl.auto_resume({"type": "nope"})


def test_handle_interrupt_unknown_type_raises():
    with pytest.raises(ValueError):
        hitl.handle_interrupt({"type": "nope"})


# --------------------------------------------------------------------------- #
# render 不崩（无 assert，仅保证不抛）
# --------------------------------------------------------------------------- #
def test_render_does_not_crash():
    hitl.render_select_cluster(_select_payload())
    hitl.render_clarify(_clarify_payload())
    hitl.render_final_review(_final_review_payload(), show_low=False)
    hitl.render_final_review(_final_review_payload(), show_low=True)


# --------------------------------------------------------------------------- #
# cli.py 导入与构造（graph.py 不存在时也必须干净导入）
# --------------------------------------------------------------------------- #
def test_cli_imports_cleanly():
    from evopm import cli

    assert cli.app is not None


def test_cli_help_runs():
    from typer.testing import CliRunner

    from evopm.cli import app

    result = CliRunner().invoke(app, ["--help"])
    assert result.exit_code == 0
    assert "run" in result.output
    assert "init" in result.output

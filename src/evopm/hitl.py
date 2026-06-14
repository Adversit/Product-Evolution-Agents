"""人工介入（HITL）CLI 渲染与输入解析（WT-6 / T6.1，spec §3.3 + §11.5）。

本模块**只**负责三种 interrupt 的：

1. payload → rich 表格渲染（评委可读）；
2. ``input()`` → 合同规定的 resume dict（schema 见 spec §3.3）；
3. ``final_review`` 的每次操作产出 :class:`HumanDecision`（含 reason）。

它**不**触碰路由状态：``human_review`` 节点（在 ``graph.py`` / WT-7）才负责消费
decisions 并设置补证据标志（research_reentry / more_evidence_rounds / _reentry_target）。

所有 ``input()`` 走可注入的 ``ask`` 形参（``Callable[[str], str]``），默认 :func:`builtins.input`，
以便单测不阻塞 stdin。非法输入 → 重新提示，绝不抛异常。

replay / 离线演示：:func:`auto_resume` 按预设（select=最大簇、clarify=force_pass、
review=全 accept）直接返回 resume dict，无需人工应答。
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Callable

from rich.console import Console
from rich.table import Table

from evopm.schemas import HumanDecision, ReviewAction, RiskTier

# 注入式 input 类型：给一个 prompt 串，返回用户输入（已 strip 与否由实现决定）。
AskFn = Callable[[str], str]

_console = Console()

# final_review 单字符操作 → ReviewAction 映射（用户输入大小写不敏感）。
_ACTION_KEYS: dict[str, ReviewAction] = {
    "accept": ReviewAction.ACCEPT,
    "reject": ReviewAction.REJECT,
    "edit": ReviewAction.EDIT,
    "redo": ReviewAction.REDO,
    "more_evidence": ReviewAction.MORE_EVIDENCE,
    # 简写
    "ac": ReviewAction.ACCEPT,
    "re": ReviewAction.REJECT,
    "ed": ReviewAction.EDIT,
    "rd": ReviewAction.REDO,
    "me": ReviewAction.MORE_EVIDENCE,
}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _print(msg: str) -> None:
    _console.print(msg)


# --------------------------------------------------------------------------- #
# ① select_cluster
# --------------------------------------------------------------------------- #
def render_select_cluster(payload: dict) -> None:
    """渲染候选簇表格供人工选择 focus 簇。"""
    table = Table(title="① 选择焦点问题簇（select_cluster）", show_lines=True)
    table.add_column("id", style="cyan", no_wrap=True)
    table.add_column("标题")
    table.add_column("频次", justify="right")
    table.add_column("严重度")
    table.add_column("状态")
    table.add_column("摘要")
    for c in payload.get("clusters", []):
        table.add_row(
            str(c.get("id", "")),
            str(c.get("title", "")),
            str(c.get("frequency", "")),
            str(c.get("severity", "")),
            str(c.get("status", "")),
            str(c.get("summary", "")),
        )
    _console.print(table)


def parse_select_cluster(payload: dict, ask: AskFn = input) -> dict:
    """读取用户输入的 cluster id，返回 ``{"cluster_id": "clu-01"}``。

    非法（空 / 不在候选 id 中）→ 重新提示，不抛异常。
    """
    valid_ids = {str(c.get("id")) for c in payload.get("clusters", [])}
    while True:
        raw = ask("请输入要深挖的簇 id（如 clu-01）：").strip()
        if raw in valid_ids:
            return {"cluster_id": raw}
        _print(f"[red]无效的簇 id：{raw!r}，请从 {sorted(valid_ids)} 中选择。[/red]")


# --------------------------------------------------------------------------- #
# ② clarify_human
# --------------------------------------------------------------------------- #
def render_clarify(payload: dict) -> None:
    """渲染缺失信息 / 待澄清问题。"""
    table = Table(title="② 人工澄清（clarify）", show_lines=True)
    table.add_column("类型", style="cyan", no_wrap=True)
    table.add_column("内容")
    for item in payload.get("missing_info", []):
        table.add_row("缺失信息", str(item))
    for q in payload.get("questions", []):
        table.add_row("待澄清", str(q))
    _console.print(table)


def parse_clarify(payload: dict, ask: AskFn = input) -> dict:
    """读取澄清动作 → ``{"action": ..., "text": ...}``。

    action ∈ {supplement, force_pass, route_support}。supplement 需再问补充文本；
    其余 text 置空。非法 action → 重新提示。
    """
    valid_actions = {"supplement", "force_pass", "route_support"}
    while True:
        action = ask(
            "选择动作 [supplement=补充信息 / force_pass=强制通过 / route_support=转客服]："
        ).strip().lower()
        if action not in valid_actions:
            _print(
                f"[red]无效动作：{action!r}，请输入 "
                "supplement / force_pass / route_support。[/red]"
            )
            continue
        text = ""
        if action == "supplement":
            text = ask("请输入补充说明文本：").strip()
        return {"action": action, "text": text}


# --------------------------------------------------------------------------- #
# ③ human_review（final_review）
# --------------------------------------------------------------------------- #
def render_final_review(payload: dict, show_low: bool = False) -> None:
    """渲染待评审项表格；默认折叠 RiskTier.LOW 项（show_low=True 时展开）。"""
    items = payload.get("items", [])
    folded = 0
    table = Table(title="③ 最终评审（final_review）", show_lines=True)
    table.add_column("ref", style="cyan", no_wrap=True)
    table.add_column("描述")
    table.add_column("风险")
    table.add_column("证据强度")
    for it in items:
        if not show_low and str(it.get("risk_tier")) == RiskTier.LOW.value:
            folded += 1
            continue
        table.add_row(
            str(it.get("ref", "")),
            str(it.get("description", "")),
            str(it.get("risk_tier", "")),
            str(it.get("evidence_strength", "")),
        )
    _console.print(table)
    if folded:
        _print(
            f"[dim]（已折叠 {folded} 个低风险项；输入 a 批量接受全部，"
            "或 show 展开低风险项）[/dim]"
        )


def _parse_action(token: str) -> ReviewAction | None:
    return _ACTION_KEYS.get(token.strip().lower())


def parse_final_review(payload: dict, ask: AskFn = input) -> dict:
    """逐项收集评审操作 → ``{"decisions": [{item_ref, action, reason, edited_content}]}``。

    - 低风险项默认折叠；输入 ``a`` 批量接受**所有低风险项**（每项产出一条 ACCEPT 决策）。
    - 每项可选动作 accept/reject/edit/redo/more_evidence（5 种 ReviewAction）。
    - edit 追问 edited_content；非 accept 动作追问 reason。
    - 非法动作 → 重新提示该项，不崩溃。

    返回 dict 中 decisions 的每项已是 :class:`HumanDecision` 的 ``model_dump``，
    与 spec §3.3 resume schema（item_ref/action/reason/edited_content）兼容。
    """
    items = payload.get("items", [])
    low_items = [it for it in items if str(it.get("risk_tier")) == RiskTier.LOW.value]
    non_low_items = [
        it for it in items if str(it.get("risk_tier")) != RiskTier.LOW.value
    ]

    render_final_review(payload, show_low=False)
    decisions: list[HumanDecision] = []
    batched_low = False

    # 先处理批量接受低风险项的快捷入口（仅当存在低风险项时提供）。
    if low_items:
        while True:
            choice = ask(
                "低风险项：输入 a 批量接受 / show 展开逐项处理 / 回车跳过批量："
            ).strip().lower()
            if choice == "a":
                for it in low_items:
                    decisions.append(_make_decision(it, ReviewAction.ACCEPT, "", ""))
                batched_low = True
                break
            if choice in ("", "show"):
                break
            _print("[red]请输入 a / show / 回车。[/red]")

    # 逐项处理：非低风险项必处理；低风险项若未批量接受则也逐项处理。
    to_process = non_low_items + ([] if batched_low else low_items)
    for it in to_process:
        decisions.append(_prompt_one_item(it, ask))

    return {"decisions": [d.model_dump() for d in decisions]}


def _prompt_one_item(item: dict, ask: AskFn) -> HumanDecision:
    """对单个评审项反复提示直到拿到合法动作。"""
    ref = str(item.get("ref", ""))
    while True:
        token = ask(
            f"[{ref}] 动作 "
            "[accept/reject/edit/redo/more_evidence]："
        )
        action = _parse_action(token)
        if action is None:
            _print(
                "[red]无效动作，请输入 accept / reject / edit / redo / "
                "more_evidence。[/red]"
            )
            continue
        edited = ""
        reason = ""
        if action == ReviewAction.EDIT:
            # edit 用修改后的内容代替 reason，不再单独追问原因。
            edited = ask("请输入修改后的内容：").strip()
        elif action != ReviewAction.ACCEPT:
            # reject / redo / more_evidence 追问原因（accept 无需理由）。
            reason = ask("请输入原因（可空）：").strip()
        return _make_decision(item, action, reason, edited)


def _make_decision(
    item: dict, action: ReviewAction, reason: str, edited_content: str
) -> HumanDecision:
    return HumanDecision(
        checkpoint="final_review",
        item_ref=str(item.get("ref", "")),
        action=action,
        reason=reason,
        edited_content=edited_content,
        timestamp=_now_iso(),
    )


# --------------------------------------------------------------------------- #
# 统一入口：渲染 + 解析
# --------------------------------------------------------------------------- #
def handle_interrupt(payload: dict, ask: AskFn = input) -> dict:
    """按 payload["type"] 分派到对应 render+parse，返回 resume dict。

    CLI 循环在捕获 ``__interrupt__`` 后调用本函数。
    未知 type → 抛 ValueError（合同外，属集成错误，应 fail-fast）。
    """
    ptype = payload.get("type")
    if ptype == "select_cluster":
        render_select_cluster(payload)
        return parse_select_cluster(payload, ask)
    if ptype == "clarify":
        render_clarify(payload)
        return parse_clarify(payload, ask)
    if ptype == "final_review":
        return parse_final_review(payload, ask)
    raise ValueError(f"未知 interrupt 类型：{ptype!r}")


# --------------------------------------------------------------------------- #
# replay / 离线演示自动应答（spec §11.5）
# --------------------------------------------------------------------------- #
def auto_resume(payload: dict) -> dict:
    """按预设自动应答三种 interrupt（供 --replay / smoke test / 断网演示）。

    预设：select=最大簇（frequency 最大，并列取第一个）、clarify=force_pass、
    review=全 accept（含低风险项）。返回与 §3.3 一致的 resume dict。
    """
    ptype = payload.get("type")
    if ptype == "select_cluster":
        clusters = payload.get("clusters", [])
        if not clusters:
            raise ValueError("select_cluster payload 无候选簇，无法自动选择。")
        # 跳过 duplicate/insufficient（不能作焦点 P0）；无可选时退回全体最大频次。
        selectable = [
            c for c in clusters if c.get("status") not in ("duplicate", "insufficient")
        ]
        largest = max(selectable or clusters, key=lambda c: c.get("frequency", 0))
        return {"cluster_id": str(largest.get("id"))}
    if ptype == "clarify":
        return {"action": "force_pass", "text": ""}
    if ptype == "final_review":
        decisions = [
            _make_decision(it, ReviewAction.ACCEPT, "", "").model_dump()
            for it in payload.get("items", [])
        ]
        return {"decisions": decisions}
    raise ValueError(f"未知 interrupt 类型：{ptype!r}")

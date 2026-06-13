"""IntakeAgent（M1+M3，spec §4）：信号加载 + id 分配 + 一次批量 LLM 标注。

职责边界（spec §2 id 分配责任）：
- ``load_signals`` 由**代码**在调用 LLM 前完成 ``sig-001..sig-NNN`` 顺序分配
  （**先 CSV 后 issues**），并填好 source_type / origin_url / text / created_at /
  author_type 等"原始"字段。LLM 只读这些 id，绝不新增/改 id 或改 text。
- ``IntakeAgent.run`` 把已编号信号喂给一次性 ``structured_call``，LLM 仅补全
  category / sentiment / actionability / module_guess / data_quality /
  duplicate_of / followup_question，然后代码把标注合并回原信号（保 id/text/来源不变）。

数据来源（spec §11.2 降级）：
- ``collect_raw_signals``：CSV 必读本地；issues 在 live 模式走 ``sources.github``，
  ``GithubUnavailable`` / mock 模式 → 读 ``issues_mock.json``。
"""

from __future__ import annotations

import csv
import json
from pathlib import Path
from typing import Any

from pydantic import BaseModel

from evopm.agents.base import BaseAgent
from evopm.schemas import ProductContext, SignalItem, SourceType
from evopm.sources.github import GithubUnavailable, fetch_issues


# 输出包装模型（spec §4：包一层；不放进 schemas.py）
class IntakeAnnotation(BaseModel):
    """LLM 对单条信号的标注（id 用于对回原信号）。"""

    id: str
    module_guess: str = ""
    category: str | None = None
    sentiment: str | None = None
    actionability: str | None = None
    duplicate_of: str | None = None
    data_quality: str | None = None
    followup_question: str = ""


class IntakeOutput(BaseModel):
    """一次批量标注的结果（spec §4：IntakeOutput(signals=...)）。"""

    signals: list[IntakeAnnotation]


# --------------------------------------------------------------------------- #
# 原始信号加载 + id 分配（纯代码，不调用 LLM）
# --------------------------------------------------------------------------- #
def _load_csv_rows(csv_path: Path) -> list[dict]:
    """读 feedback.csv（表头固定 created_at,author_type,text，无 id 列）。"""
    rows: list[dict] = []
    with csv_path.open(encoding="utf-8", newline="") as f:
        for row in csv.DictReader(f):
            rows.append(
                {
                    "created_at": (row.get("created_at") or "").strip(),
                    "author_type": (row.get("author_type") or "user").strip(),
                    "text": (row.get("text") or "").strip(),
                }
            )
    return rows


def _load_issue_rows(
    data_dir: Path, repo: str, run_mode: str, keywords: list[str] | None
) -> list[dict]:
    """live 模式走 GitHub API，失败/mock 模式降级读 issues_mock.json。"""
    mock_path = data_dir / "issues_mock.json"

    def _read_mock() -> list[dict]:
        return json.loads(mock_path.read_text(encoding="utf-8"))

    if run_mode == "live":
        try:
            return fetch_issues(repo, keywords)
        except GithubUnavailable:
            # 降级（spec §11.2）：日志侧由调用方/CLI 负责 WARN，这里静默读 mock
            return _read_mock()
    return _read_mock()


def load_signals(
    data_dir: str | Path,
    repo: str = "infiniflow/ragflow",
    run_mode: str = "mock",
    keywords: list[str] | None = None,
) -> list[SignalItem]:
    """加载 CSV + issues 并分配 ``sig-001..``（先 CSV 后 issues），返回未标注 SignalItem。"""
    data_dir = Path(data_dir)
    raw: list[SignalItem] = []

    # 1) CSV feedback 先编号
    for row in _load_csv_rows(data_dir / "feedback.csv"):
        raw.append(
            SignalItem(
                id="",  # 占位，下面统一编号
                source_type=SourceType.CSV_FEEDBACK,
                origin_url="",
                author_type=row["author_type"] or "user",
                created_at=row["created_at"],
                text=row["text"],
            )
        )

    # 2) issues 后编号；issue number 保留进 origin_url（即 html_url）
    for issue in _load_issue_rows(data_dir, repo, run_mode, keywords):
        title = (issue.get("title") or "").strip()
        body = (issue.get("body") or "").strip()
        text = f"{title}\n{body}".strip() if title else body
        raw.append(
            SignalItem(
                id="",
                source_type=SourceType.GITHUB_ISSUE,
                origin_url=issue.get("html_url", ""),
                author_type="user",
                created_at=issue.get("created_at", ""),
                text=text,
            )
        )

    # 3) 顺序分配 sig-NNN（CSV 先、issues 后），LLM 之前定型
    for i, sig in enumerate(raw, start=1):
        sig.id = f"sig-{i:03d}"
    return raw


# --------------------------------------------------------------------------- #
# Agent
# --------------------------------------------------------------------------- #
def _enum_or_none(enum_cls: Any, value: Any) -> Any:
    """把 LLM 返回的字符串安全转成枚举；非法值 → None（保持字段宽容）。"""
    if value is None:
        return None
    try:
        return enum_cls(value)
    except ValueError:
        return None


class IntakeAgent(BaseAgent):
    name = "IntakeAgent"
    prompt_file = "intake.md"

    def run(self, **inputs: Any) -> IntakeOutput:  # type: ignore[override]
        product_context: ProductContext = inputs["product_context"]
        signals: list[SignalItem] = inputs["signals"]
        user = self._build_user(product_context, signals)
        return self.structured_call(IntakeOutput, user)  # type: ignore[return-value]

    @staticmethod
    def _build_user(pc: ProductContext, signals: list[SignalItem]) -> str:
        """最小上下文（spec §11.3）：产品 name/module/stage + 全部信号行（≤800 字裁剪）。"""
        ctx = (
            f"产品：{pc.name}；被分析模块：{pc.module}；阶段：{pc.stage}。\n"
            f"以下是已编号信号，请逐条标注（保持 id、text、顺序不变）：\n"
        )
        lines = []
        for s in signals:
            text = s.text[:800]
            lines.append(
                f"- id={s.id} | 来源={s.source_type.value} | 作者={s.author_type} | text={text}"
            )
        return ctx + "\n".join(lines)

    @staticmethod
    def merge_annotations(
        signals: list[SignalItem], output: IntakeOutput
    ) -> list[SignalItem]:
        """把 LLM 标注按 id 合并回原信号（id/text/来源字段不可被改）。

        - 只更新可标注字段；
        - ``duplicate_of`` 必须指向输入里真实存在的 sig id，否则丢弃；
        - 返回新列表（原对象不改）。
        """
        from evopm.schemas import (
            Actionability,
            Category,
            DataQuality,
            Sentiment,
        )

        valid_ids = {s.id for s in signals}
        ann_by_id = {a.id: a for a in output.signals}
        merged: list[SignalItem] = []
        for s in signals:
            a = ann_by_id.get(s.id)
            new = s.model_copy(deep=True)
            if a is not None:
                new.module_guess = a.module_guess or new.module_guess
                new.category = _enum_or_none(Category, a.category)
                new.sentiment = _enum_or_none(Sentiment, a.sentiment)
                new.actionability = _enum_or_none(Actionability, a.actionability)
                new.data_quality = _enum_or_none(DataQuality, a.data_quality)
                new.followup_question = a.followup_question or ""
                dup = a.duplicate_of
                # 闭包：duplicate_of 只能指向真实存在且非自身的 sig id
                new.duplicate_of = dup if (dup in valid_ids and dup != s.id) else None
            merged.append(new)
        return merged

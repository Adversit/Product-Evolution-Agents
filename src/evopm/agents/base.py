"""Agent 公共基类与证据闭包校验（spec §4 末尾、§11.3）。

- ``BaseAgent``：加载 prompts/ 下的 .md（支持 ``{{include:文件名}}`` 拼接公共片段，
  如 ``_evidence_rules.md``），包装 ``structured_call``。
- ``collect_valid_ids``：节点现场组装当前 state 中已存在的合法 id 集合。
- ``validate_evidence_refs``：剔除输出里指向不存在 id 的 evidence_refs / signal_ids，
  返回清洗后的副本 + violations 记录（作为 Critic 输入之一）。
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any

from pydantic import BaseModel

from evopm import llm

PROMPTS_DIR = Path(__file__).resolve().parent.parent / "prompts"

# 需要做闭包校验的引用字段名（list[str]，存上游 id）
_REF_FIELDS = {"evidence_refs", "signal_ids"}
_INCLUDE_RE = re.compile(r"\{\{include:\s*([^}]+?)\s*\}\}")


# --------------------------------------------------------------------------- #
# prompt 加载
# --------------------------------------------------------------------------- #
def load_prompt(prompt_file: str) -> str:
    """读取 prompts/<prompt_file>，解析 ``{{include:xxx.md}}`` 为对应片段内容。"""
    text = (PROMPTS_DIR / prompt_file).read_text(encoding="utf-8")

    def _sub(match: re.Match[str]) -> str:
        inc = match.group(1).strip()
        return (PROMPTS_DIR / inc).read_text(encoding="utf-8").strip()

    return _INCLUDE_RE.sub(_sub, text)


class BaseAgent:
    """子类设 ``name`` / ``prompt_file``，实现 ``run(**inputs)``（内部走 structured_call）。"""

    name: str = "base"
    prompt_file: str = ""

    def __init__(self, llm_factory: Any = None) -> None:
        # llm_factory 预留给测试注入；默认走 llm.structured_call
        self.llm_factory = llm_factory

    @property
    def system_prompt(self) -> str:
        return load_prompt(self.prompt_file) if self.prompt_file else ""

    def structured_call(
        self, schema: type[BaseModel], user: str, model: str | None = None
    ) -> BaseModel:
        return llm.structured_call(schema, self.system_prompt, user, model=model)

    def run(self, **inputs: Any) -> BaseModel:  # 子类实现
        raise NotImplementedError


# --------------------------------------------------------------------------- #
# 证据闭包
# --------------------------------------------------------------------------- #
def collect_valid_ids(state: dict[str, Any]) -> set[str]:
    """组装当前 state 中已存在的全部合法 id（signals/clusters/findings/req/tasks/历史需求）。"""
    ids: set[str] = set()

    def _add_each(items: Any) -> None:
        for it in items or []:
            _id = getattr(it, "id", None)
            if _id:
                ids.add(_id)

    _add_each(state.get("signals"))
    _add_each(state.get("clusters"))
    _add_each(state.get("competitor_findings"))
    _add_each(state.get("tech_findings"))
    _add_each(state.get("existing_requirements"))

    focus = state.get("focus_candidate")
    if focus is not None and getattr(focus, "id", None):
        ids.add(focus.id)

    execution = state.get("execution")
    if execution is not None:
        _add_each(getattr(execution, "tasks", None))

    return ids


def _walk(obj: Any, valid_ids: set[str], path: str, violations: list[str]) -> None:
    """递归遍历，原地剔除非法引用并记录 violations。"""
    if isinstance(obj, BaseModel):
        for field_name in obj.__class__.model_fields:
            value = getattr(obj, field_name)
            child_path = f"{path}.{field_name}" if path else field_name
            if field_name in _REF_FIELDS and isinstance(value, list):
                kept = [r for r in value if r in valid_ids]
                dropped = [r for r in value if r not in valid_ids]
                if dropped:
                    violations.append(f"{child_path}: 剔除非法引用 {dropped}")
                    setattr(obj, field_name, kept)
            else:
                _walk(value, valid_ids, child_path, violations)
    elif isinstance(obj, list):
        for i, item in enumerate(obj):
            _walk(item, valid_ids, f"{path}[{i}]", violations)
    elif isinstance(obj, dict):
        for k, v in obj.items():
            _walk(v, valid_ids, f"{path}[{k}]", violations)


def validate_evidence_refs(
    output: BaseModel, valid_ids: set[str]
) -> tuple[BaseModel, list[str]]:
    """剔除 output 中所有指向 valid_ids 之外的 evidence_refs/signal_ids。

    返回 (清洗后的深拷贝, violations 文本列表)。原对象不被修改。
    """
    clean = output.model_copy(deep=True)
    violations: list[str] = []
    _walk(clean, valid_ids, "", violations)
    return clean, violations

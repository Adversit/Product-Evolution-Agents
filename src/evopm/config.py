"""配置与数据加载（spec §7）。

三个 load 函数把 ``data/demo_kb/`` 下的合同格式文件反序列化为 schema 对象 / 文本。
SignalItem 的加载与 id 分配由 intake 节点（WT-1）负责，不在此处。
"""

from __future__ import annotations

import re
from pathlib import Path

import yaml
from dotenv import load_dotenv

from evopm.schemas import ExistingRequirement, ProductContext

load_dotenv()


def load_product_context(path: str | Path) -> ProductContext:
    """读取 product.yaml → ProductContext。"""
    data = yaml.safe_load(Path(path).read_text(encoding="utf-8"))
    return ProductContext.model_validate(data)


def load_existing_requirements(path: str | Path) -> list[ExistingRequirement]:
    """解析 existing_requirements.md（每条一个 H2：``## ex-01 | 标题 | status``）。"""
    text = Path(path).read_text(encoding="utf-8")
    requirements: list[ExistingRequirement] = []
    # 以 H2 标题切块
    blocks = re.split(r"^##\s+", text, flags=re.MULTILINE)[1:]
    for block in blocks:
        lines = block.strip().splitlines()
        if not lines:
            continue
        header = [p.strip() for p in lines[0].split("|")]
        if len(header) < 3:
            continue
        ex_id, title, status = header[0], header[1], header[2]
        body = "\n".join(lines[1:]).strip()
        summary = re.sub(r"^摘要[:：]\s*", "", body).strip()
        requirements.append(
            ExistingRequirement(id=ex_id, title=title, summary=summary, status=status)
        )
    return requirements


def load_repo_map(path: str | Path) -> str:
    """读取 repo_map.md 全文（精简目录树，按 spec §11.3 全文注入）。"""
    return Path(path).read_text(encoding="utf-8")

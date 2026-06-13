"""ResearchAgent：竞品 / 技术双模式调研（spec §4 两行、§6 降级链、§11.4 单项降级）。

流程（两模式同构）：
1. 由选中簇生成 3–5 个调研问题（一次 structured_call）。
2. 逐"调研单元"取材料：
   - competitor 模式：每个 ``product_context.competitors`` 一个单元；
   - tech 模式：cluster 关键词 + ``product_context.tech_topics`` 合并去重后取前 N 个关键词。
   live 模式先 ``llm.web_search_call(query)``；单项 ``WebSearchUnavailable``（或 ``--mock``）
   → 读对应 mock 文件，标记该单元为 mock 来源（spec §11.4 单项降级，互不影响）。
3. 把"问题 + 各单元材料（含 mock 标记）"拼进 user，一次 structured_call 产出 findings。
4. 代码侧硬约束：凡来自 mock 的单元，其 finding ``source_url`` 强制改写为 ``mock://<文件名>``、
   ``evidence_strength`` 封顶 ``moderate``（spec §11.2，不信任 LLM 自觉）。

输出包装模型 ``CompetitorOutput`` / ``TechOutput`` 定义在本模块（不污染 schemas.py）。
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

from pydantic import BaseModel

from evopm import llm
from evopm.agents.base import BaseAgent
from evopm.schemas import (
    CompetitorFinding,
    EvidenceStrength,
    InsightCluster,
    ProductContext,
    TechFinding,
)

# data/demo_kb 根（相对仓库根；CLI 从仓库根运行）
_KB_ROOT = Path("data/demo_kb")
_COMPETITOR_DIR = _KB_ROOT / "competitors"
_TECH_DIR = _KB_ROOT / "tech_notes"

MAX_SEARCHES = 8  # spec §11.4 每节点 ≤8 次搜索软上限
_MOCK_MATERIAL_CAP = 1800  # mock 材料单条裁剪（spec §11.3 大文本裁剪）
_SEARCH_SNIPPET_CAP = 600  # 单条搜索结果裁剪

# mock 来源 evidence_strength 封顶顺序（spec §11.2：不得高于 moderate）
_STRENGTH_RANK = {
    EvidenceStrength.STRONG: 4,
    EvidenceStrength.MODERATE: 3,
    EvidenceStrength.WEAK: 2,
    EvidenceStrength.NO_DIRECT: 1,
    EvidenceStrength.INFERENCE_ONLY: 0,
}


# --------------------------------------------------------------------------- #
# 输出包装模型（本模块私有，不进 schemas.py）
# --------------------------------------------------------------------------- #
class ResearchQuestions(BaseModel):
    """第一步：由簇生成的 3–5 个调研问题。"""

    questions: list[str]


class CompetitorOutput(BaseModel):
    findings: list[CompetitorFinding]


class TechOutput(BaseModel):
    findings: list[TechFinding]


# --------------------------------------------------------------------------- #
# 调研单元：一个竞品 / 一个技术关键词，带取材结果
# --------------------------------------------------------------------------- #
class _Unit(BaseModel):
    """单个调研单元取材后的中间态。"""

    key: str  # 竞品名 或 技术关键词
    is_mock: bool
    mock_filename: str = ""  # is_mock 时的 mock 文件名（用于 mock://<filename>）
    material: str  # 拼进 prompt 的材料文本（搜索摘要 或 mock 全文裁剪）


def _cap_strength(s: EvidenceStrength) -> EvidenceStrength:
    """mock 来源封顶 moderate：strong → moderate，其余原样。"""
    if _STRENGTH_RANK[s] > _STRENGTH_RANK[EvidenceStrength.MODERATE]:
        return EvidenceStrength.MODERATE
    return s


class ResearchAgent(BaseAgent):
    name = "research"

    def __init__(self, mode: str, llm_factory: Any = None) -> None:
        if mode not in ("competitor", "tech"):
            raise ValueError(f"mode 必须是 'competitor' | 'tech'，收到 {mode!r}")
        super().__init__(llm_factory=llm_factory)
        self.mode = mode
        self.prompt_file = (
            "research_competitor.md" if mode == "competitor" else "research_tech.md"
        )

    # ----- 第一步：调研问题 ------------------------------------------------- #
    def _gen_questions(
        self, cluster: InsightCluster, model: str | None
    ) -> list[str]:
        user = (
            f"选中问题簇：\n"
            f"- 标题：{cluster.title}\n"
            f"- 概述：{cluster.summary}\n"
            f"- 候选需求：{cluster.candidate_title}\n"
            f"请围绕该簇生成 3–5 个{self._mode_word()}调研问题。"
        )
        out = llm.structured_call(ResearchQuestions, self.system_prompt, user, model=model)
        qs = [q.strip() for q in out.questions if q.strip()]
        return qs[:5] if qs else [cluster.candidate_title or cluster.title]

    def _mode_word(self) -> str:
        return "竞品对标" if self.mode == "competitor" else "技术可行性"

    # ----- 取材：每单元先搜索，失败降级 mock（单项隔离） ------------------- #
    def _gather_units(
        self,
        cluster: InsightCluster,
        product_context: ProductContext,
        questions: list[str],
        run_mode: str,
    ) -> list[_Unit]:
        force_mock = run_mode == "mock"
        units: list[_Unit] = []
        searches_left = MAX_SEARCHES

        if self.mode == "competitor":
            specs = [
                (c.name, c.mock_file or "")
                for c in product_context.competitors
            ]
        else:
            specs = [(kw, "") for kw in self._tech_keywords(cluster, product_context)]

        query_topic = "；".join(questions[:3])
        for key, mock_file in specs:
            query = f"{key} {query_topic}"
            if not force_mock and searches_left > 0:
                searches_left -= 1
                try:
                    results = llm.web_search_call(query)
                    units.append(
                        _Unit(
                            key=key,
                            is_mock=False,
                            material=self._format_search(results),
                        )
                    )
                    continue
                except llm.WebSearchUnavailable:
                    pass  # 单项降级，落到下面读 mock；其余单元不受影响
            material, filename = self._read_mock(key, mock_file)
            units.append(
                _Unit(key=key, is_mock=True, mock_filename=filename, material=material)
            )
        return units

    def _tech_keywords(
        self, cluster: InsightCluster, product_context: ProductContext
    ) -> list[str]:
        """cluster 关键词（categories + 候选标题词）+ tech_topics，去重保序，限 MAX_SEARCHES。"""
        kws: list[str] = []
        for c in cluster.categories:
            kws.append(c.value)
        kws.extend(product_context.tech_topics)
        seen: set[str] = set()
        ordered: list[str] = []
        for k in kws:
            kk = k.strip()
            if kk and kk not in seen:
                seen.add(kk)
                ordered.append(kk)
        return ordered[:MAX_SEARCHES]

    @staticmethod
    def _format_search(results: list[llm.SearchResult]) -> str:
        lines = []
        for r in results[:5]:
            snippet = (r.snippet or "")[:_SEARCH_SNIPPET_CAP]
            lines.append(f"- [{r.title}]({r.url}) {snippet}".strip())
        return "\n".join(lines)

    def _read_mock(self, key: str, mock_file: str) -> tuple[str, str]:
        """读取 mock 材料，返回 (裁剪后文本, 文件名)。

        competitor：用配置里的 mock_file；tech：按关键词匹配 tech_notes/*.md，匹配不到则
        汇总目录全部笔记（保证始终有材料，不中断）。
        """
        if self.mode == "competitor":
            path = _COMPETITOR_DIR / mock_file if mock_file else None
            if path and path.exists():
                return path.read_text(encoding="utf-8")[:_MOCK_MATERIAL_CAP], path.name
            return f"（无 {key} 的本地材料）", mock_file or f"{key}.md"

        match = self._match_tech_note(key)
        if match is not None:
            return match.read_text(encoding="utf-8")[:_MOCK_MATERIAL_CAP], match.name
        # 兜底：拼接全部 tech_notes 摘要
        notes = sorted(_TECH_DIR.glob("*.md")) if _TECH_DIR.exists() else []
        joined = "\n\n".join(
            p.read_text(encoding="utf-8")[:400] for p in notes
        )
        return joined[:_MOCK_MATERIAL_CAP], "tech_notes/*"

    @staticmethod
    def _match_tech_note(keyword: str) -> Path | None:
        """按关键词在 tech_notes 文件名 / 正文里粗匹配一个最相关笔记。"""
        if not _TECH_DIR.exists():
            return None
        notes = sorted(_TECH_DIR.glob("*.md"))
        kw = keyword.lower()
        # 1) 文件名（去扩展、下划线转空格）含关键词词块
        for p in notes:
            stem = p.stem.lower().replace("_", " ")
            if any(tok and tok in stem for tok in kw.split()):
                return p
        # 2) 正文命中
        for p in notes:
            if kw in p.read_text(encoding="utf-8").lower():
                return p
        return None

    # ----- 第二步：产出 findings ------------------------------------------- #
    def _build_findings_prompt(
        self, cluster: InsightCluster, questions: list[str], units: list[_Unit]
    ) -> str:
        q_block = "\n".join(f"{i + 1}. {q}" for i, q in enumerate(questions))
        unit_label = "竞品" if self.mode == "competitor" else "技术关键词"
        unit_blocks = []
        for u in units:
            tag = "（来源：本地材料 mock）" if u.is_mock else "（来源：联网搜索）"
            unit_blocks.append(f"### {unit_label}：{u.key} {tag}\n{u.material}")
        material_block = "\n\n".join(unit_blocks)
        return (
            f"选中问题簇：{cluster.title}\n"
            f"候选需求：{cluster.candidate_title}\n\n"
            f"调研问题：\n{q_block}\n\n"
            f"各{unit_label}的调研材料如下，请据此（且仅据此）下结论：\n\n"
            f"{material_block}"
        )

    def _postprocess(self, findings: list[Any], units: list[_Unit]) -> None:
        """代码侧硬约束：mock 单元的 finding 强制 mock://<文件名> + 封顶 moderate。"""
        mock_by_key = {u.key: u for u in units if u.is_mock}
        for f in findings:
            key = getattr(f, "competitor", None) or getattr(f, "topic", None) or ""
            unit = mock_by_key.get(key)
            if unit is None:
                # topic 模式下 LLM 可能改写 topic 措辞，按 source_url 已含 mock:// 也视为 mock
                if str(getattr(f, "source_url", "")).startswith("mock://"):
                    f.evidence_strength = _cap_strength(f.evidence_strength)
                continue
            f.source_url = f"mock://{unit.mock_filename}"
            f.evidence_strength = _cap_strength(f.evidence_strength)

    # ----- 入口 ------------------------------------------------------------- #
    def run(  # type: ignore[override]
        self,
        cluster: InsightCluster,
        product_context: ProductContext,
        run_mode: str = "mock",
        model: str | None = None,
    ) -> BaseModel:
        questions = self._gen_questions(cluster, model)
        units = self._gather_units(cluster, product_context, questions, run_mode)
        user = self._build_findings_prompt(cluster, questions, units)
        out_schema = CompetitorOutput if self.mode == "competitor" else TechOutput
        out = llm.structured_call(out_schema, self.system_prompt, user, model=model)
        self._postprocess(out.findings, units)
        return out

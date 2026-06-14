"""LangGraph State 定义（spec §3.1）。

EvoPMState 是全流程共享的 TypedDict。各节点只写自己负责的 key；并行调研用
competitor_findings / tech_findings 两个分写 key 避免 reducer 冲突。所有轮次计数器
在节点函数体内 ``+= 1`` 后写回 state，条件路由函数纯只读（见 spec §3.2 / §11.1）。
"""

from __future__ import annotations

import operator
from typing import Annotated, TypedDict

from evopm.schemas import (
    CodeImpactMap,
    CompetitorFinding,
    CriticReview,
    ExecutionProposal,
    ExistingRequirement,
    HumanDecision,
    InsightCluster,
    OpportunityDecision,
    ProductContext,
    RequirementCandidate,
    RoadmapEntry,
    SignalItem,
    SolutionSpec,
    TechFinding,
)


class EvoPMState(TypedDict, total=False):
    # 输入
    product_context: ProductContext
    signals: list[SignalItem]
    existing_requirements: list[ExistingRequirement]
    repo_map: str  # repo_map.md 全文
    run_mode: str  # "live" | "mock" | "replay"
    # 发现
    clusters: list[InsightCluster]
    selected_cluster_id: str
    # 并行调研（两 key 分写，无 reducer 冲突）
    competitor_findings: list[CompetitorFinding]
    tech_findings: list[TechFinding]
    # 需求
    focus_candidate: RequirementCandidate
    enrich_rounds: int  # 初始 0，enrich 后 +1，上限 1
    # 决策与执行
    opportunity: OpportunityDecision  # 焦点簇精评
    roadmap: list[RoadmapEntry]  # 全部簇（含焦点）的 Now/Next/Later，opportunity 节点一并产出
    solution: SolutionSpec
    code_impact: CodeImpactMap
    execution: ExecutionProposal
    # 治理
    # 各节点证据闭包校验剔除的非法引用，累加（reducer：并行 research 节点都写此 key）→ 喂给 critic
    evidence_violations: Annotated[list[str], operator.add]
    critic_review: CriticReview
    redo_rounds: int  # 初始 0，回炉后 +1，上限 1
    clarify_rounds: int  # interrupt② 人工澄清轮次，初始 0，上限 1（超限降级 ROUTE_SUPPORT 出报告）
    more_evidence_rounds: int  # 评审「补充证据」轮次，初始 0，上限 1
    research_reentry: bool  # 评审后补证据重入调研的标志（路由用，见 §3.2），初始 False
    _reentry_target: str  # "competitor"|"tech"，human_review 节点设置，route_review 读取
    llm_call_count: int  # 仅展示用：report 节点从 llm.get_budget_used() 写入（硬上限在 llm.py，见 §11.1）
    human_decisions: list[HumanDecision]
    # 输出
    report_paths: list[str]

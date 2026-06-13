"""核心数据对象与枚举（spec §1 / §2）。

证据引用约定：所有 ``evidence_refs: list[str]`` 存的是 SignalItem / CompetitorFinding /
TechFinding 的 ``id``。id 格式见 spec §2 顶部。所有枚举用 ``str`` 基类便于序列化。
"""

from __future__ import annotations

from enum import Enum

from pydantic import BaseModel


# --------------------------------------------------------------------------- #
# §1 枚举定义
# --------------------------------------------------------------------------- #
class SourceType(str, Enum):
    CSV_FEEDBACK = "csv_feedback"
    GITHUB_ISSUE = "github_issue"


class Category(str, Enum):  # M4 反馈分类，12 类全量
    BUG = "bug"
    MISSING_FEATURE = "missing_feature"
    UX = "ux"
    PERFORMANCE = "performance"
    DOCS = "docs"
    CONFIG = "config"
    PRICING = "pricing"
    MISUSE = "misuse"
    COMPETITOR_REF = "competitor_ref"
    TECH_UPGRADE = "tech_upgrade"
    SECURITY = "security"
    STABILITY = "stability"


class Actionability(str, Enum):  # M1 可行动性 6 档
    SUFFICIENT = "sufficient"
    INSUFFICIENT = "insufficient"
    SUSPECTED_DUPLICATE = "suspected_duplicate"
    SUSPECTED_MISUSE = "suspected_misuse"
    EMOTIONAL = "emotional"
    REAL_ISSUE = "real_issue"


class Sentiment(str, Enum):
    NEGATIVE = "negative"
    NEUTRAL = "neutral"
    POSITIVE = "positive"


class DataQuality(str, Enum):  # M3 数据质量标注
    COMPLETE = "complete"
    PARTIAL = "partial"
    NOISY = "noisy"


class ClusterStatus(str, Enum):  # M4 问题簇状态 4 档
    NEW = "new"
    KNOWN = "known"
    DUPLICATE = "duplicate"
    INSUFFICIENT = "insufficient"


class Severity(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class CompetitorVerdict(str, Enum):  # M5 竞品结论三分类
    ADOPT = "adopt"
    AVOID = "avoid"
    WATCH = "watch"


class TechMaturity(str, Enum):  # M6 技术成熟度 5 档
    MATURE = "mature"
    REFERENCE = "reference"
    EXPERIMENTAL = "experimental"
    HIGH_RISK = "high_risk"
    UNSUITABLE = "unsuitable"


class EvidenceStrength(str, Enum):  # M13 证据强度 5 档
    STRONG = "strong"
    MODERATE = "moderate"
    WEAK = "weak"
    NO_DIRECT = "no_direct"
    INFERENCE_ONLY = "inference_only"


class GateStatus(str, Enum):  # M8 门禁 3 出口 + 中间态
    PASS = "pass"
    NEEDS_ENRICH = "needs_enrich"
    NEEDS_HUMAN = "needs_human"
    ROUTE_SUPPORT = "route_support"


class Priority(str, Enum):  # M9 优先级 7 级全量
    P0 = "P0"
    P1 = "P1"
    P2 = "P2"
    P3 = "P3"
    SUPPORT = "Support"
    RESEARCH = "Research"
    DUPLICATE = "Duplicate"


class Horizon(str, Enum):
    NOW = "now"
    NEXT = "next"
    LATER = "later"


class SpecialType(str, Enum):  # M9 特殊类型 4 种
    HIGH_FREQ_LOW_VALUE = "high_freq_low_value"
    LOW_FREQ_HIGH_SEVERITY = "low_freq_high_severity"
    COMPETITOR_SOLVED_WE_LACK = "competitor_solved_we_lack"
    TECH_FEASIBLE_EVIDENCE_WEAK = "tech_feasible_evidence_weak"


class ImpactLevel(str, Enum):  # M11 三档影响
    CERTAIN = "certain"
    POSSIBLE = "possible"
    UNCERTAIN = "uncertain"


class ImpactType(str, Enum):  # M11 影响对象 7 类
    FRONTEND = "frontend"
    API = "api"
    SERVICE = "service"
    DATA_MODEL = "data_model"
    CONFIG = "config"
    TESTS = "tests"
    DOCS = "docs"


class TaskType(str, Enum):  # M12 任务类型 7 类
    PRODUCT = "product"
    FRONTEND = "frontend"
    BACKEND = "backend"
    DATA = "data"
    TEST = "test"
    DOC = "doc"
    OPS_SUPPORT = "ops_support"


class RiskTier(str, Enum):  # §4 人工介入分级
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class RequirementStatus(str, Enum):  # M15 12 状态全量定义（demo 实际走 ~6 个）
    NEW_SIGNAL = "new_signal"
    CLUSTERED = "clustered"
    CANDIDATE = "candidate"
    NEEDS_CLARIFICATION = "needs_clarification"
    READY_FOR_REVIEW = "ready_for_review"
    APPROVED = "approved"
    PLANNED = "planned"
    IN_PROGRESS = "in_progress"
    SHIPPED = "shipped"
    REJECTED = "rejected"
    DEFERRED = "deferred"
    MERGED_DUPLICATE = "merged_duplicate"


class ReviewAction(str, Enum):  # M16 评审操作 5 种
    ACCEPT = "accept"
    REJECT = "reject"
    EDIT = "edit"
    REDO = "redo"
    MORE_EVIDENCE = "more_evidence"


# --------------------------------------------------------------------------- #
# §2 核心数据对象
# --------------------------------------------------------------------------- #
class CompetitorConfig(BaseModel):
    name: str
    homepage: str = ""
    mock_file: str = ""  # data/demo_kb/competitors/ 下的兜底材料


class ProductContext(BaseModel):  # ← product.yaml 反序列化
    name: str
    description: str
    target_users: list[str]
    module: str  # 被分析模块，如 "文件上传与问答质量"
    stage: str  # mvp/growth/commercial/mature/oss_commercial
    analysis_goals: list[str]
    team_preference: str  # 快速修复/提升体验/增强商业化/降低维护成本/提升架构质量
    competitors: list[CompetitorConfig]
    tech_topics: list[str]
    github_repo: str = "infiniflow/ragflow"
    opportunity_weights: dict[str, float] = {}  # 维度名→权重，缺省等权
    repo_map_path: str = "data/demo_kb/repo_map.md"
    core_modules: list[str] = []  # 核心模块路径前缀，命中→高风险


class SignalItem(BaseModel):  # M1+M3：Feedback Item 与 Issue Item 合并
    id: str  # sig-001
    source_type: SourceType
    origin_url: str = ""  # GitHub issue URL 或空
    author_type: str = "user"  # user/maintainer/enterprise
    created_at: str = ""  # ISO 日期，可空
    text: str  # 原文，永不修改
    module_guess: str = ""  # LLM 标注以下字段 ↓
    category: Category | None = None
    sentiment: Sentiment | None = None
    actionability: Actionability | None = None
    duplicate_of: str | None = None  # 疑似重复时指向另一 signal id
    data_quality: DataQuality | None = None
    followup_question: str = ""  # 信息不足时的追问建议


class ExistingRequirement(BaseModel):  # ← existing_requirements.md 解析
    id: str  # ex-01
    title: str
    summary: str
    status: str  # known_issue/in_roadmap/shipped


class InsightCluster(BaseModel):  # M4
    id: str  # clu-01
    title: str
    summary: str
    signal_ids: list[str]  # 证据闭包：必须 ⊆ 全体 signal id
    categories: list[Category]
    severity: Severity
    frequency: int  # = len(signal_ids)
    status: ClusterStatus
    candidate_title: str  # 候选需求一句话
    user_story_draft: str
    duplicate_of_existing: str | None = None  # 命中历史需求池时为 ex-xx
    dedup_reason: str = ""


class CompetitorFinding(BaseModel):  # M5
    id: str  # cf-01
    competitor: str
    research_question: str
    has_solved: bool | None = None  # None=不确定
    conclusion: str
    verdict: CompetitorVerdict
    gap_description: str = ""
    implication: str  # 对当前需求意味着什么
    source_url: str = ""  # web_search 来源或 mock 文件名
    evidence_strength: EvidenceStrength


class TechFinding(BaseModel):  # M6
    id: str  # tf-01
    topic: str
    solution_name: str
    maturity: TechMaturity
    fit_reason: str  # 为什么支持该需求
    cost_estimate: str  # low/medium/high + 一句话
    risk: str
    source_url: str = ""
    evidence_strength: EvidenceStrength


class UserStory(BaseModel):
    role: str
    scenario: str
    benefit: str
    story_text: str  # "作为…我希望…以便…"
    evidence_refs: list[str] = []


class QualityDimension(BaseModel):
    name: str  # 10 维之一，见 §5.1
    score: int  # 0-100
    rationale: str


class QualityReport(BaseModel):  # M8
    total: int  # = round(mean(dims))
    dimensions: list[QualityDimension]
    missing_info: list[str]  # blocker 性缺失
    ambiguities: list[str]
    followup_questions: list[str]
    gate: GateStatus  # 由代码规则覆写，LLM 仅建议
    round: int  # 第几轮评估（1=初评，2=enrich 后）


class AcceptanceCriterion(BaseModel):
    text: str
    type: str  # functional / nonfunctional
    evidence_refs: list[str] = []


class StatusChange(BaseModel):
    from_status: RequirementStatus | None
    to_status: RequirementStatus
    by: str  # agent 名或 "human"
    reason: str = ""


class RequirementCandidate(BaseModel):  # M7+M8 合并（11.7+11.8）
    id: str  # req-01
    cluster_id: str
    title: str
    background: str
    target_users: list[str]
    pain_point: str
    business_goal: str
    scope: list[str]
    non_goals: list[str]
    boundary_conditions: list[str]  # 含非功能需求
    clarifications: list[str]  # 待澄清问题
    user_stories: list[UserStory]
    acceptance_criteria: list[AcceptanceCriterion] = []  # enrich 后填充
    evidence_refs: list[str]
    quality: QualityReport | None = None
    quality_history: list[QualityReport] = []
    status: RequirementStatus = RequirementStatus.CANDIDATE
    status_history: list[StatusChange] = []


class OpportunityScore(BaseModel):
    dimension: str  # 10 维之一，见 §5.2
    score: int  # 0-100
    rationale: str
    evidence_refs: list[str] = []


class OpportunityDecision(BaseModel):  # M9 焦点需求精评
    requirement_id: str
    scores: list[OpportunityScore]
    total: float  # 加权总分，代码计算
    priority: Priority
    horizon: Horizon
    rationale: str
    special_types: list[SpecialType] = []


class RoadmapEntry(BaseModel):  # M9/M15：非焦点簇的粗评，供 Now/Next/Later 路线图
    cluster_id: str  # 焦点簇也含一条（priority/horizon 取自 OpportunityDecision）
    title: str
    priority: Priority
    horizon: Horizon
    one_line_reason: str
    is_focus: bool = False


class SolutionSpec(BaseModel):  # M10
    requirement_id: str
    summary: str
    scope: list[str]
    non_goals: list[str]
    user_flow: list[str]  # 有序步骤
    acceptance_criteria: list[AcceptanceCriterion]
    edge_cases: list[str]
    test_scenarios: list[str]
    role_notes: dict[str, str]  # keys: product/dev/qa/support
    risks: list[str]
    dependencies: list[str]


class CodeImpactItem(BaseModel):  # M11
    module_path: str  # repo_map 中的目录，如 "deepdoc/parser"
    impact_level: ImpactLevel
    impact_types: list[ImpactType]
    description: str
    is_core_module: bool  # 代码判定：module_path 前缀命中 core_modules
    risk_tier: RiskTier  # 代码判定规则见 §5.3
    verify_points: list[str]


class CodeImpactMap(BaseModel):
    requirement_id: str
    items: list[CodeImpactItem]
    suggested_order: list[str]  # module_path 有序
    human_confirmation_needed: list[str]  # 所有 uncertain + core 项的说明


class TaskCard(BaseModel):  # M12
    id: str  # task-01
    type: TaskType
    title: str
    description: str
    related_modules: list[str]
    evidence_refs: list[str]
    risk_tier: RiskTier


class ImplPlanStep(BaseModel):
    step: int
    action: str
    modules: list[str]
    verify: str
    risk: str = ""


class ExecutionProposal(BaseModel):  # M12
    requirement_id: str
    tasks: list[TaskCard]
    change_suggestions: list[str]  # 模块级"改什么、为什么"，不含代码
    test_suggestions: list[str]
    impl_plan: list[ImplPlanStep]
    changelog_draft: str
    blocked: bool = False  # 门禁前置：gate != PASS 时为 True 且其余为空


class CriticFinding(BaseModel):  # M13
    target: str  # 被审对象描述 + id 引用
    evidence_strength: EvidenceStrength
    overreach: bool  # 过度推断
    risk_tier: RiskTier
    note: str
    demote_to_observation: bool = False


class CriticReview(BaseModel):
    findings: list[CriticFinding]
    pending_confirmations: list[str]  # 待人工确认清单（人话描述）
    redo_target: str | None = None  # 节点名，触发回炉
    redo_instructions: str = ""


class HumanDecision(BaseModel):  # M16
    checkpoint: str  # select_cluster / clarify / final_review
    item_ref: str  # 被操作对象的 id 或描述
    action: ReviewAction
    reason: str = ""
    edited_content: str = ""
    timestamp: str

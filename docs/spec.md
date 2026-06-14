# EvoPM Agent — 技术规格（spec.md）

**版本：** V1.0 | **上游：** `EvoPM_Demo_MVP_PRD_V1.0.md` | **下游：** `plan.md`、`tasks.md`
**定位：** 并行开发的「合同」。所有 worktree 分支以本文档的 schema、接口签名、文件格式为准；**修改任何合同级定义必须先改本文档并通知所有分支**。

---

## 0. 技术栈与项目骨架

```text
依赖：python>=3.11, langgraph, langchain-openai, langchain-core, pydantic>=2, typer, rich, jinja2, httpx, python-dotenv, pyyaml
```

```text
Product-Evolution-Agents/
├── pyproject.toml  .env.example  .gitignore  README.md
├── data/demo_kb/
│   ├── product.yaml  feedback.csv  issues_mock.json  existing_requirements.md  repo_map.md
│   ├── competitors/{dify.md, open_webui.md, anythingllm.md}
│   └── tech_notes/{upload_state_machine.md, retry_strategy.md, chunk_preview.md, rerank.md, citation_tracing.md}
├── src/evopm/
│   ├── __init__.py  cli.py  graph.py  state.py  schemas.py  config.py  llm.py  hitl.py
│   ├── sources/__init__.py  sources/github.py
│   ├── agents/{__init__,base,intake,discovery,research,requirement,strategy,engineering,critic}.py
│   ├── prompts/{intake,discovery,research_competitor,research_tech,requirement_draft,requirement_enrich,opportunity,solution,engineering,critic}.md
│   └── report/render.py  report/templates/{opportunity_report,engineering_report,prd_draft,executive_summary}.md.j2
├── runs/           # gitignore：输出报告、state dump、LLM 缓存
└── tests/test_smoke.py
```

`.env.example`：
```bash
ZHIPUAI_API_KEY=your-key-here
GITHUB_TOKEN=          # 可选，提升 GitHub API 限流
EVOPM_MODEL=glm-5.1    # 开发期可设 glm-4.5-air
```

`.gitignore` 必含：`.env`、`runs/`、`__pycache__/`、`*.pyc`、`.cache/`。

---

## 1. 枚举定义（schemas.py，全部用 `str` 枚举便于序列化）

```python
class SourceType(str, Enum):
    CSV_FEEDBACK = "csv_feedback"; GITHUB_ISSUE = "github_issue"

class Category(str, Enum):           # M4 反馈分类，12 类全量
    BUG = "bug"; MISSING_FEATURE = "missing_feature"; UX = "ux"
    PERFORMANCE = "performance"; DOCS = "docs"; CONFIG = "config"
    PRICING = "pricing"; MISUSE = "misuse"; COMPETITOR_REF = "competitor_ref"
    TECH_UPGRADE = "tech_upgrade"; SECURITY = "security"; STABILITY = "stability"

class Actionability(str, Enum):      # M1 可行动性 6 档
    SUFFICIENT = "sufficient"; INSUFFICIENT = "insufficient"
    SUSPECTED_DUPLICATE = "suspected_duplicate"; SUSPECTED_MISUSE = "suspected_misuse"
    EMOTIONAL = "emotional"; REAL_ISSUE = "real_issue"

class Sentiment(str, Enum):
    NEGATIVE = "negative"; NEUTRAL = "neutral"; POSITIVE = "positive"

class DataQuality(str, Enum):        # M3 数据质量标注
    COMPLETE = "complete"; PARTIAL = "partial"; NOISY = "noisy"

class ClusterStatus(str, Enum):      # M4 问题簇状态 4 档
    NEW = "new"; KNOWN = "known"; DUPLICATE = "duplicate"; INSUFFICIENT = "insufficient"

class Severity(str, Enum):
    CRITICAL = "critical"; HIGH = "high"; MEDIUM = "medium"; LOW = "low"

class CompetitorVerdict(str, Enum):  # M5 竞品结论三分类
    ADOPT = "adopt"; AVOID = "avoid"; WATCH = "watch"

class TechMaturity(str, Enum):       # M6 技术成熟度 5 档
    MATURE = "mature"; REFERENCE = "reference"; EXPERIMENTAL = "experimental"
    HIGH_RISK = "high_risk"; UNSUITABLE = "unsuitable"

class EvidenceStrength(str, Enum):   # M13 证据强度 5 档
    STRONG = "strong"; MODERATE = "moderate"; WEAK = "weak"
    NO_DIRECT = "no_direct"; INFERENCE_ONLY = "inference_only"

class GateStatus(str, Enum):         # M8 门禁 3 出口 + 中间态
    PASS = "pass"; NEEDS_ENRICH = "needs_enrich"
    NEEDS_HUMAN = "needs_human"; ROUTE_SUPPORT = "route_support"

class Priority(str, Enum):           # M9 优先级 7 级全量
    P0 = "P0"; P1 = "P1"; P2 = "P2"; P3 = "P3"
    SUPPORT = "Support"; RESEARCH = "Research"; DUPLICATE = "Duplicate"

class Horizon(str, Enum):
    NOW = "now"; NEXT = "next"; LATER = "later"

class SpecialType(str, Enum):        # M9 特殊类型 4 种
    HIGH_FREQ_LOW_VALUE = "high_freq_low_value"
    LOW_FREQ_HIGH_SEVERITY = "low_freq_high_severity"
    COMPETITOR_SOLVED_WE_LACK = "competitor_solved_we_lack"
    TECH_FEASIBLE_EVIDENCE_WEAK = "tech_feasible_evidence_weak"

class ImpactLevel(str, Enum):        # M11 三档影响
    CERTAIN = "certain"; POSSIBLE = "possible"; UNCERTAIN = "uncertain"

class ImpactType(str, Enum):         # M11 影响对象 7 类
    FRONTEND = "frontend"; API = "api"; SERVICE = "service"; DATA_MODEL = "data_model"
    CONFIG = "config"; TESTS = "tests"; DOCS = "docs"

class TaskType(str, Enum):           # M12 任务类型 7 类
    PRODUCT = "product"; FRONTEND = "frontend"; BACKEND = "backend"; DATA = "data"
    TEST = "test"; DOC = "doc"; OPS_SUPPORT = "ops_support"

class RiskTier(str, Enum):           # §4 人工介入分级
    LOW = "low"; MEDIUM = "medium"; HIGH = "high"

class RequirementStatus(str, Enum):  # M15 12 状态全量定义（demo 实际走 ~6 个）
    NEW_SIGNAL = "new_signal"; CLUSTERED = "clustered"
    CANDIDATE = "candidate"; NEEDS_CLARIFICATION = "needs_clarification"
    READY_FOR_REVIEW = "ready_for_review"; APPROVED = "approved"
    PLANNED = "planned"; IN_PROGRESS = "in_progress"; SHIPPED = "shipped"
    REJECTED = "rejected"; DEFERRED = "deferred"; MERGED_DUPLICATE = "merged_duplicate"

class ReviewAction(str, Enum):       # M16 评审操作 5 种
    ACCEPT = "accept"; REJECT = "reject"; EDIT = "edit"
    REDO = "redo"; MORE_EVIDENCE = "more_evidence"
```

---

## 2. 核心数据对象（schemas.py，Pydantic v2 BaseModel）

> 证据引用约定：所有 `evidence_refs: list[str]` 存的是 SignalItem / CompetitorFinding / TechFinding 的 `id`。
> id 格式：信号 `sig-001`，簇 `clu-01`，竞品发现 `cf-01`，技术发现 `tf-01`，需求 `req-01`，任务 `task-01`。
>
> **id 分配责任（防 LLM 乱编 id）**：
> - **SignalItem.id 由代码在加载时按顺序分配** `sig-001..sig-NNN`（先 CSV 后 issues），**在调用 intake LLM 之前**就已写入，LLM 只读不改、`duplicate_of` 引用这些 id。CSV 不要求 id 列（有也忽略）；issue 的原始 number 保留在 `origin_url`。
> - clu/cf/tf/req/task 的 id 由对应 Agent **在单次 LLM 调用内**生成（响应内自洽），代码收到后校验：格式正确、响应内唯一；不唯一则带错误重试 1 次（走 structured_call 的校验重试）。
> - `validate_evidence_refs` 的 valid_ids 由节点用 `collect_valid_ids(state)` 现场组装（intake 后 = 全 sig；research 后 += cf/tf；以此类推）。

```python
class CompetitorConfig(BaseModel):
    name: str
    homepage: str = ""
    mock_file: str = ""              # data/demo_kb/competitors/ 下的兜底材料

class ProductContext(BaseModel):     # ← product.yaml 反序列化
    name: str
    description: str
    target_users: list[str]
    module: str                      # 被分析模块，如 "文件上传与问答质量"
    stage: str                       # mvp/growth/commercial/mature/oss_commercial
    analysis_goals: list[str]
    team_preference: str             # 快速修复/提升体验/增强商业化/降低维护成本/提升架构质量
    competitors: list[CompetitorConfig]
    tech_topics: list[str]
    github_repo: str = "infiniflow/ragflow"
    opportunity_weights: dict[str, float] = {}   # 维度名→权重，缺省等权
    repo_map_path: str = "data/demo_kb/repo_map.md"
    core_modules: list[str] = []     # 核心模块路径前缀，命中→高风险

class SignalItem(BaseModel):         # M1+M3：Feedback Item 与 Issue Item 合并
    id: str                          # sig-001
    source_type: SourceType
    origin_url: str = ""             # GitHub issue URL 或空
    author_type: str = "user"        # user/maintainer/enterprise
    created_at: str = ""             # ISO 日期，可空
    text: str                        # 原文，永不修改
    module_guess: str = ""           # LLM 标注以下字段 ↓
    category: Category | None = None
    sentiment: Sentiment | None = None
    actionability: Actionability | None = None
    duplicate_of: str | None = None  # 疑似重复时指向另一 signal id
    data_quality: DataQuality | None = None
    followup_question: str = ""      # 信息不足时的追问建议

class ExistingRequirement(BaseModel):  # ← existing_requirements.md 解析
    id: str                          # ex-01
    title: str
    summary: str
    status: str                      # known_issue/in_roadmap/shipped

class InsightCluster(BaseModel):     # M4
    id: str                          # clu-01
    title: str
    summary: str
    signal_ids: list[str]            # 证据闭包：必须 ⊆ 全体 signal id
    categories: list[Category]
    severity: Severity
    frequency: int                   # = len(signal_ids)
    status: ClusterStatus
    candidate_title: str             # 候选需求一句话
    user_story_draft: str
    duplicate_of_existing: str | None = None   # 命中历史需求池时为 ex-xx
    dedup_reason: str = ""

class CompetitorFinding(BaseModel):  # M5
    id: str                          # cf-01
    competitor: str
    research_question: str
    has_solved: bool | None = None   # None=不确定
    conclusion: str
    verdict: CompetitorVerdict
    gap_description: str = ""
    implication: str                 # 对当前需求意味着什么
    source_url: str = ""             # web_search 来源或 mock 文件名
    evidence_strength: EvidenceStrength

class TechFinding(BaseModel):        # M6
    id: str                          # tf-01
    topic: str
    solution_name: str
    maturity: TechMaturity
    fit_reason: str                  # 为什么支持该需求
    cost_estimate: str               # low/medium/high + 一句话
    risk: str
    source_url: str = ""
    evidence_strength: EvidenceStrength

class UserStory(BaseModel):
    role: str; scenario: str; benefit: str
    story_text: str                  # "作为…我希望…以便…"
    evidence_refs: list[str] = []

class QualityDimension(BaseModel):
    name: str                        # 10 维之一，见 §5.1
    score: int                       # 0-100
    rationale: str

class QualityReport(BaseModel):      # M8
    total: int                       # = round(mean(dims))
    dimensions: list[QualityDimension]
    missing_info: list[str]          # blocker 性缺失
    ambiguities: list[str]
    followup_questions: list[str]
    gate: GateStatus                 # 由代码规则覆写，LLM 仅建议
    round: int                       # 第几轮评估（1=初评，2=enrich 后）

class AcceptanceCriterion(BaseModel):
    text: str
    type: str                        # functional / nonfunctional
    evidence_refs: list[str] = []

class StatusChange(BaseModel):
    from_status: RequirementStatus | None
    to_status: RequirementStatus
    by: str                          # agent 名或 "human"
    reason: str = ""

class RequirementCandidate(BaseModel):   # M7+M8 合并（11.7+11.8）
    id: str                          # req-01
    cluster_id: str
    title: str
    background: str
    target_users: list[str]
    pain_point: str
    business_goal: str
    scope: list[str]
    non_goals: list[str]
    boundary_conditions: list[str]   # 含非功能需求
    clarifications: list[str]        # 待澄清问题
    user_stories: list[UserStory]
    acceptance_criteria: list[AcceptanceCriterion] = []   # enrich 后填充
    evidence_refs: list[str]
    quality: QualityReport | None = None
    quality_history: list[QualityReport] = []
    status: RequirementStatus = RequirementStatus.CANDIDATE
    status_history: list[StatusChange] = []

class OpportunityScore(BaseModel):
    dimension: str                   # 10 维之一，见 §5.2
    score: int                       # 0-100
    rationale: str
    evidence_refs: list[str] = []

class OpportunityDecision(BaseModel):    # M9 焦点需求精评
    requirement_id: str
    scores: list[OpportunityScore]
    total: float                     # 加权总分，代码计算
    priority: Priority
    horizon: Horizon
    rationale: str
    special_types: list[SpecialType] = []

class RoadmapEntry(BaseModel):       # M9/M15：非焦点簇的粗评，供 Now/Next/Later 路线图
    cluster_id: str                  # 焦点簇也含一条（priority/horizon 取自 OpportunityDecision）
    title: str
    priority: Priority
    horizon: Horizon
    one_line_reason: str
    is_focus: bool = False

class SolutionSpec(BaseModel):       # M10
    requirement_id: str
    summary: str
    scope: list[str]
    non_goals: list[str]
    user_flow: list[str]             # 有序步骤
    acceptance_criteria: list[AcceptanceCriterion]
    edge_cases: list[str]
    test_scenarios: list[str]
    role_notes: dict[str, str]       # keys: product/dev/qa/support
    risks: list[str]
    dependencies: list[str]

class CodeImpactItem(BaseModel):     # M11
    module_path: str                 # repo_map 中的目录，如 "deepdoc/parser"
    impact_level: ImpactLevel
    impact_types: list[ImpactType]
    description: str
    is_core_module: bool             # 代码判定：module_path 前缀命中 core_modules
    risk_tier: RiskTier              # 代码判定规则见 §5.3
    verify_points: list[str]

class CodeImpactMap(BaseModel):
    requirement_id: str
    items: list[CodeImpactItem]
    suggested_order: list[str]       # module_path 有序
    human_confirmation_needed: list[str]  # 所有 uncertain + core 项的说明

class TaskCard(BaseModel):           # M12
    id: str                          # task-01
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
    change_suggestions: list[str]    # 模块级"改什么、为什么"，不含代码
    test_suggestions: list[str]
    impl_plan: list[ImplPlanStep]
    changelog_draft: str
    blocked: bool = False            # 门禁前置：gate != PASS 时为 True 且其余为空

class CriticFinding(BaseModel):      # M13
    target: str                      # 被审对象描述 + id 引用
    evidence_strength: EvidenceStrength
    overreach: bool                  # 过度推断
    risk_tier: RiskTier
    note: str
    demote_to_observation: bool = False

class CriticReview(BaseModel):
    findings: list[CriticFinding]
    pending_confirmations: list[str]     # 待人工确认清单（人话描述）
    redo_target: str | None = None       # 节点名，触发回炉
    redo_instructions: str = ""

class HumanDecision(BaseModel):      # M16
    checkpoint: str                  # select_cluster / clarify / final_review
    item_ref: str                    # 被操作对象的 id 或描述
    action: ReviewAction
    reason: str = ""
    edited_content: str = ""
    timestamp: str
```

---

## 3. LangGraph State 与图结构（state.py / graph.py）

### 3.1 State

```python
class EvoPMState(TypedDict, total=False):
    # 输入
    product_context: ProductContext
    signals: list[SignalItem]
    existing_requirements: list[ExistingRequirement]
    repo_map: str                    # repo_map.md 全文
    run_mode: str                    # "live" | "mock" | "replay"
    # 发现
    clusters: list[InsightCluster]
    selected_cluster_id: str
    # 并行调研（两 key 分写，无 reducer 冲突）
    competitor_findings: list[CompetitorFinding]
    tech_findings: list[TechFinding]
    # 需求
    focus_candidate: RequirementCandidate
    enrich_rounds: int               # 初始 0，enrich 后 +1，上限 1
    # 决策与执行
    opportunity: OpportunityDecision     # 焦点簇精评
    roadmap: list[RoadmapEntry]          # 全部簇（含焦点）的 Now/Next/Later，opportunity 节点一并产出
    solution: SolutionSpec
    code_impact: CodeImpactMap
    execution: ExecutionProposal
    # 治理
    critic_review: CriticReview
    redo_rounds: int                 # 初始 0，回炉后 +1，上限 1
    clarify_rounds: int              # interrupt② 人工澄清轮次，初始 0，上限 1（超限降级 ROUTE_SUPPORT 出报告）
    more_evidence_rounds: int        # 评审「补充证据」轮次，初始 0，上限 1
    research_reentry: bool           # 评审后补证据重入调研的标志（路由用，见 §3.2），初始 False
    _reentry_target: str             # "competitor"|"tech"，human_review 节点设置，route_review 读取
    llm_call_count: int              # 仅展示用：report 节点从 llm.get_budget_used() 写入（真正的硬上限在 llm.py 模块级计数器，见 §11.1）
    human_decisions: list[HumanDecision]
    # 输出
    report_paths: list[str]
```

### 3.2 节点与边

```python
NODES = ["intake", "discovery", "select_cluster",
         "competitor_research", "tech_research",
         "quality_gate", "enrich", "clarify_human",
         "opportunity", "solution_design", "engineering",
         "critic", "human_review", "report"]

# 线性边
START → intake → discovery → select_cluster
select_cluster → competitor_research      # fan-out
select_cluster → tech_research            # fan-out

# 条件边 0：调研出边（fan-in / 评审补证据重入，二选一）
# 首轮两节点同 superstep 完成后自动 fan-in 到 quality_gate；
# 评审「补充证据」重入时（research_reentry=True）只重跑被点名的调研节点，
# 完成后直接回 critic 复审 → human_review，绝不重跑 quality_gate→engineering 主链。
def route_research_out(state) -> Literal["quality_gate", "critic"]:
    return "critic" if state.get("research_reentry") else "quality_gate"

# 条件边 1：门禁
def route_gate(state) -> Literal["enrich", "clarify_human", "opportunity", "report"]:
    gate = state["focus_candidate"].quality.gate
    if gate == GateStatus.PASS:          return "opportunity"
    if gate == GateStatus.ROUTE_SUPPORT: return "report"        # 转文档客服，直接出报告
    if state.get("enrich_rounds", 0) == 0: return "enrich"
    if state.get("clarify_rounds", 0) >= 1: return "report"     # 防人工澄清死循环：1 次澄清后仍不达标即降级出报告
    return "clarify_human"
enrich → quality_gate                     # 补全后重评
clarify_human → quality_gate              # 人工补充后重评（resume 注入补充文本，clarify_rounds += 1）

opportunity → solution_design → engineering → critic

# 条件边 2：Critic 回炉（router 只读；redo_rounds 由 critic 节点自增——见下）
def route_critic(state) -> str:
    cr = state["critic_review"]
    if state.get("research_reentry"):     # 补证据重入后的复审：只更新标注，直接交人工
        return "human_review"
    return cr.redo_target or "human_review"   # critic 节点已保证：仅在 redo_rounds<1 时才设 redo_target
# ↑ 计数所有权：critic 节点发现严重问题且 state.redo_rounds<1 时，输出里设 redo_target
#   并 redo_rounds=1；否则 redo_target=None。这样 router 保持纯只读，且天然限一轮。

# 条件边 3：评审后的补证据（router 只读；标志由 human_review 节点设置——见下）
def route_review(state) -> Literal["competitor_research", "tech_research", "report"]:
    if state.get("research_reentry"):     # human_review 节点已据 decisions 设好此标志
        # human_review 已把待补证据的 item_ref 暂存到 state（cf-*/tf-* 决定去向）
        return "competitor_research" if state["_reentry_target"] == "competitor" else "tech_research"
    return "report"
# ↑ 计数所有权：human_review 节点处理 decisions，若含 MORE_EVIDENCE 且 more_evidence_rounds<1，
#   则置 research_reentry=True、more_evidence_rounds=1、_reentry_target=("competitor"|"tech")；否则 research_reentry=False。
report → END
```

**集成接线要点（WT-7 必读，最易出错处）**：
- 两个 research 节点各自挂 `add_conditional_edges(node, route_research_out, {"quality_gate":"quality_gate","critic":"critic"})`。
- **首轮 fan-in**：select_cluster 在同一 superstep 并行派发两个 research 节点；二者均返回 `"quality_gate"`，LangGraph 在下一 superstep 把 quality_gate 去重为**一个**任务执行（标准 fan-in），不会跑两次。quality_gate 读取时 competitor_findings 与 tech_findings 均已就位。
- **enrich/clarify 重入 quality_gate**：此时只有单个前驱在活跃 superstep，quality_gate 正常单次执行；LangGraph 不会阻塞等待未激活的 research 分支。
- **补证据重入**：route_review 只派发**一个** research 节点，research_reentry=True 使 route_research_out 返回 `"critic"`，单路径回 critic→human_review，**绝不重入 quality_gate→…→engineering 主链**（避免重算已确认结论 + 触发预算）。
- 编译：`graph.compile(checkpointer=MemorySaver())`；调用必传 `config={"recursion_limit":50,"configurable":{"thread_id":"evopm-demo"}}`。
- 各计数器（enrich_rounds 等）的 `+=1` 必须在**节点函数体内**完成并返回到 state；路由函数纯只读。

### 3.3 interrupt 协议（hitl.py 负责 CLI 渲染与输入解析）

| # | 节点 | interrupt payload | resume 值 |
|---|---|---|---|
| ① | select_cluster | `{"type":"select_cluster","clusters":[{id,title,summary,frequency,severity,status}]}` | `{"cluster_id": "clu-01"}` |
| ② | clarify_human | `{"type":"clarify","missing_info":[...],"questions":[...]}` | `{"action":"supplement"\|"force_pass"\|"route_support","text":"..."}` |
| ③ | human_review | `{"type":"final_review","items":[{ref,description,risk_tier,evidence_strength}]}` | `{"decisions":[{item_ref,action,reason,edited_content}]}` |

- checkpointer：`MemorySaver`，thread_id 固定 `"evopm-demo"`。
- CLI 循环：`graph.stream(...)` 捕获 `__interrupt__` → hitl 渲染（rich 表格）→ `input()` → `graph.invoke(Command(resume=...))`。
- 低风险项（RiskTier.LOW）在 final_review 默认折叠，输入 `a` 可批量接受。

---

## 4. Agent 契约（agents/*.py）

公共基类 `agents/base.py`：

```python
class BaseAgent:
    name: str
    prompt_file: str                       # prompts/ 下的 .md
    def __init__(self, llm_factory): ...
    def run(self, **inputs) -> BaseModel:  # 子类实现；内部走 structured_call
```

| Agent | 节点 | 输入（state keys） | 输出（写回 state） | 输出 schema | 关键 prompt 约束 |
|---|---|---|---|---|---|
| IntakeAgent | intake | product_context + 原始 CSV/issues 行 | signals | `list[SignalItem]`（包一层 `IntakeOutput(signals=...)`） | 一次批量标注全部信号；疑似重复必须给 duplicate_of；情绪/误用类给 followup_question |
| DiscoveryAgent | discovery | signals(仅可行动的), existing_requirements | clusters | `DiscoveryOutput(clusters=list[InsightCluster])` | 聚 2–4 簇；signal_ids 只能引用真实 id（代码校验闭包）；逐簇对照历史需求池判 duplicate_of_existing |
| ResearchAgent(mode=competitor) | competitor_research | selected cluster, product_context.competitors | competitor_findings | `CompetitorOutput(findings=...)` | 先生成 3–5 个调研问题再回答；只基于搜索结果/材料下结论，不足标 weak；每条必答 implication |
| ResearchAgent(mode=tech) | tech_research | selected cluster, tech_topics | tech_findings | `TechOutput(findings=...)` | 同上；必须解释 fit_reason；防技术热点伪需求（不匹配的标 unsuitable） |
| RequirementAgent.draft_and_score | quality_gate | cluster + 两类 findings (+人工补充文本) | focus_candidate（含 quality） | `RequirementCandidate` | 10 维各给 0-100+锚点理由；缺验收标准/边界 → 列入 missing_info |
| RequirementAgent.enrich | enrich | focus_candidate + findings | focus_candidate（补全后） | `RequirementCandidate` | 只允许基于给定 findings 补全 acceptance_criteria/non_goals/boundary；补全内容 evidence_refs 标注来源 id |
| StrategyAgent.score | opportunity | focus_candidate, **全部 clusters**, findings, product_context | opportunity + roadmap | `OpportunityOutput(decision=OpportunityDecision, roadmap=list[RoadmapEntry])` | 焦点簇 10 维精评（权重由代码算 total）；其余簇一次性粗评出 priority/horizon；roadmap 含全部簇（焦点 is_focus=True）；DUPLICATE 簇强制 Duplicate 不入 Now/Next |
| StrategyAgent.design | solution_design | focus_candidate, opportunity, findings | solution | `SolutionSpec` | 4 角色 role_notes 必填；每条验收标准绑证据 |
| EngineeringAgent | engineering | solution, repo_map, core_modules | code_impact + execution | `EngineeringOutput(impact=..., execution=...)` | 只基于 repo_map 推断；目录中不存在的模块标 uncertain；**不输出任何代码 diff**；gate≠PASS 时直接返回 blocked=True |
| CriticAgent | critic | 全 state 摘要（代码组装）+ 当前 redo_rounds | critic_review (+ redo_rounds) | `CriticReview` | 对抗性：检查 evidence_refs 是否真实支撑结论；宁可多标不确定；mock 来源标"来源有限"。**回炉所有权**：仅当发现严重问题且 redo_rounds<1 时设 redo_target 并令节点把 redo_rounds 置 1；否则 redo_target=None（保证最多一轮，router 只读） |

**证据闭包校验（代码层，agents/base.py 提供）**：每个节点输出后，校验输出中所有 evidence_refs/signal_ids ∈ 上游已存在 id 集合；非法引用剔除并记录到日志，剔除记录作为 Critic 输入之一。

---

## 5. 规则定义（代码实现，不交给 LLM）

### 5.1 质量门禁（M8）

10 维（固定顺序）：`clarity, completeness, testability, acceptance_clarity, evidence_sufficiency, scope_control, feasibility, consistency, user_value, stage_fit`

```python
BLOCKER_DIMS = {"acceptance_clarity", "completeness", "evidence_sufficiency"}
def decide_gate(q: QualityReport, cluster_categories: list[Category] | None = None) -> GateStatus:
    # 全簇为误用/文档类 → ROUTE_SUPPORT（cluster_categories 非空且 ⊆ {misuse, docs}）
    # quality_gate 节点调用时传入选中簇的 categories；不传则退化为仅 PASS/NEEDS_ENRICH。
    if cluster_categories and set(cluster_categories) <= {Category.MISUSE, Category.DOCS}:
        return GateStatus.ROUTE_SUPPORT
    blockers = [d for d in q.dimensions if d.name in BLOCKER_DIMS and d.score < 60]
    if q.total >= 70 and not blockers and not q.missing_info: return GateStatus.PASS
    return GateStatus.NEEDS_ENRICH       # route_gate 再按 enrich_rounds 分流到人工
```

Demo 数据校准目标：初评 total ≈ 55–62（缺验收标准+边界），enrich 后 ≥ 80。

### 5.2 机会评分（M9）

10 维：`pain_frequency, severity, competitor_gap, tech_feasibility, requirement_quality, cost, business_value, strategy_fit, urgency, core_path_impact`

```python
total = sum(score[d] * weights.get(d, 1.0) for d in DIMS) / sum(weights)
# priority 由 LLM 建议 + 代码下限保护：total>=75 → 至少 P1；cluster.status==DUPLICATE → 强制 Duplicate
```

权重来自 `product.yaml: opportunity_weights`，团队偏好仅作为 prompt 语境。

### 5.3 风险分级（§4 原则一）

```python
def risk_tier(item: CodeImpactItem, core_modules: list[str]) -> RiskTier:
    if any(item.module_path.startswith(p) for p in core_modules): return RiskTier.HIGH
    if item.impact_level == ImpactLevel.UNCERTAIN:                return RiskTier.HIGH
    if item.impact_level == ImpactLevel.POSSIBLE:                 return RiskTier.MEDIUM
    return RiskTier.LOW
# TaskCard.risk_tier = max(关联 impact items 的 tier)
# 所有 HIGH 项 → CodeImpactMap.human_confirmation_needed + Critic pending_confirmations
```

低风险结论自动通过；中风险进待确认清单；高风险强制确认且系统不产出代码改动。

### 5.4 漏斗出口（§5 原则二）

| 层级 | 出口规则 | 记录位置 |
|---|---|---|
| 可行动性 | actionability ∈ {emotional, suspected_misuse, insufficient} → 不进聚类，带 followup_question | 报告「已过滤信号」表 |
| 信号查重 | duplicate_of 非空 → 并入主信号计数 | 同上 |
| 历史查重 | cluster.duplicate_of_existing 非空 → status=DUPLICATE，不可被选为 focus | 报告「合并到已有需求」 |
| 门禁 | ROUTE_SUPPORT → 跳过执行链直接出报告 | 报告「转文档/客服」 |
| 优先级 | P2/P3/Support/Research/Duplicate → 不进 engineering（demo 只深挖选中簇，其余簇在 opportunity 节点一并粗评后分流） | 报告 Now/Next/Later |

注：opportunity 节点一次调用同时产出 focus 的 `OpportunityDecision`（精评）和覆盖**全部簇**的 `list[RoadmapEntry]`（焦点簇 + 未选中簇粗评），写入 state.opportunity 与 state.roadmap；report 的 Now/Next/Later 只读 roadmap，保证 3 簇分布。

---

## 6. llm.py 接口规格

```python
def get_chat(model: str | None = None, temperature: float = 0.1) -> ChatOpenAI:
    # base_url="https://open.bigmodel.cn/api/coding/paas/v4/", api_key=env ZHIPUAI_API_KEY
    # model 默认 env EVOPM_MODEL（glm-5.1）；temperature 必须 ∈ (0,1)，禁止 0

def structured_call(schema: type[BaseModel], system: str, user: str,
                    model: str | None = None, use_cache: bool = True) -> BaseModel:
    # 1) replay/缓存：key = sha256(model+system+user)，存 runs/.cache/{key}.json
    #    run_mode=replay 时缓存 miss 直接抛错（保证离线确定性）
    #    缓存文件 json 损坏 → live 当 miss 重新调用并覆盖；replay 报错
    # 2) llm.with_structured_output(schema, method="function_calling", include_raw=True)
    #    ← 禁用 json_schema；include_raw 用于区分「无 tool call」和「校验失败」
    # 3) 单次请求 timeout=120s，SDK 自身 max_retries=0（重试统一由本函数控制）
    # 4) 重试矩阵：
    #    - 429/5xx/网络超时 → 指数退避 4 次（2/6/15/40s）；并发由全局信号量
    #      EVOPM_LLM_CONCURRENCY（默认 2）限流，避免 research fan-out 突发并发触发 429(code 1302)
    #    - Pydantic 校验失败 / 模型未返回 tool call（返回纯文本）→ 把错误信息+原始输出
    #      附到 user 末尾重试 1 次
    #    - 重试穷尽 → mock/live 先走缓存兜底（同 schema 样本，见 §11.2），无样本才抛 LLMCallFailed；
    #      replay 直接抛（精确 key，不兜底）
    # 5) 预算：llm.py 维护模块级计数器；每次「真实」调用（缓存命中不计）前 +1，
    #    超过 30 → 抛 LLMBudgetExceeded。CLI 在每次 run 开始调 reset_budget()。
    #    不通过 state 线程传递（structured_call 看不到 state）。
    # 6) 成功后写缓存

def reset_budget() -> None: ...          # CLI run 入口调用，归零模块级计数器
def get_budget_used() -> int: ...        # report 节点读取，写入 state.llm_call_count 仅供展示

def web_search_call(query: str, count: int = 5) -> list[SearchResult]:
    # SearchResult: {title, url, snippet, publish_date}
    # 实现：GLM chat + extra_body tools=[{"type":"web_search","web_search":{
    #   "enable":True,"search_engine":"search_pro","search_result":True,"count":count}}]
    # 失败（异常/空结果/超时 20s）→ 抛 WebSearchUnavailable，调用方降级 mock
```

降级链：`run_mode=mock` 强制读本地材料；`live` 先 web_search，`WebSearchUnavailable` 时自动降级并在 finding.source_url 标 `mock://文件名`。

> **结构化输出 schema 约定（防御性，新增节点必守）：** 传给 `structured_call` 的 LLM 输出 schema **必须让关键内容字段保持必填**（禁止整个 schema 全字段带默认值）——否则 GLM 在限流/截断下返回的空 `{}` tool call 会被静默校验通过为「空对象」，绕过重试/兜底直接污染下游（如 `RequirementDraftLLM.title` 漏设必填曾致空候选 + total 0）。列表项模型同理关键字段必填；仅纯容错的嵌套项（如 `DimLLM` 单维评分）可全默认，且下游须能过滤退化项（按 `name in QUALITY_DIMS`）。

---

## 7. 数据文件格式（data/demo_kb/）

### product.yaml
```yaml
name: RAGFlow
description: 基于深度文档理解的开源 RAG 引擎
target_users: [企业知识库团队, 开发者]
module: 文件上传与问答质量
stage: growth
analysis_goals: [发现高频问题, 竞品对标, 需求质量评估, 代码影响分析, 生成路线图]
team_preference: 提升体验
github_repo: infiniflow/ragflow
competitors:
  - {name: Dify, homepage: "https://dify.ai", mock_file: dify.md}
  - {name: Open WebUI, homepage: "https://openwebui.com", mock_file: open_webui.md}
  - {name: AnythingLLM, homepage: "https://anythingllm.com", mock_file: anythingllm.md}
tech_topics: [RAG 检索质量, 文档解析, 上传状态机, 失败重试, chunk preview, rerank, 引用溯源]
opportunity_weights: {pain_frequency: 1.2, severity: 1.2, cost: 0.8}
core_modules: [rag/nlp, deepdoc/parser, rag/svr]
```

### feedback.csv（表头固定，**无 id 列**——id 由 intake 代码分配 sig-NNN）
```csv
created_at,author_type,text
2026-05-02,user,"上传一个 80MB 的 PDF 解析了两小时还在转圈，也不知道是卡了还是在跑"
```
20 条构成：≥6 条指向「解析失败/状态不可见」（最大簇）、4–5 条检索/引用质量、3–4 条上传失败、2–3 条情绪/误用（漏斗样本）、1–2 条与历史需求重复。

### issues_mock.json
```json
[{"number": 13678, "title": "[Bug]: Document automatic parsing failed",
  "body": "...", "labels": ["bug"], "state": "open", "created_at": "...",
  "html_url": "https://github.com/infiniflow/ragflow/issues/13678"}]
```
与 GitHub API `GET /repos/{repo}/issues` 返回字段对齐（sources/github.py 输出同构）。

### existing_requirements.md（每条一个 H2）
```markdown
## ex-01 | 支持解析进度百分比展示 | in_roadmap
摘要：前端文档列表展示解析进度条…
```

### repo_map.md
RAGFlow 真实目录树（一级/二级）+ 每目录一句话职责注释 + 末尾 `## 核心模块` 清单（与 product.yaml core_modules 一致）。

### sources/github.py
```python
def fetch_issues(repo: str, keywords: list[str], limit: int = 10) -> list[dict]:
    # GitHub Search API，带 GITHUB_TOKEN 则认证；429/网络错误 → 抛 GithubUnavailable
    # 调用方（intake 节点）捕获后降级 issues_mock.json
```

---

## 8. CLI 规格（cli.py，typer）

```text
evopm init                      # 交互式问答生成 data/<name>/product.yaml（M0 增强）
evopm run [--mock] [--replay] [--model glm-4.5-air] [--data data/demo_kb]
  # --mock：跳过 GitHub API 和 web_search，全用本地材料
  # --replay：LLM 全走缓存（离线演示）
evopm  # 无参 = run --data data/demo_kb
```

运行时每节点打印：`[节点名] Agent 名 → 一行结论摘要（耗时 x.xs）`（rich，评委可读）。
结束打印 4 份报告路径 + 漏斗统计（N 条信号 → M 过滤 → K 簇 → 1 深挖 → P0）。

---

## 9. 报告模板（report/templates/，Jinja2，输出到 runs/<ts>/）

| 模板 | 文件 | 必含 section |
|---|---|---|
| 产品机会报告（评审版） | opportunity_report.md | 执行摘要 / 漏斗统计（过滤·查重·分流记录）/ 问题簇总览 / 焦点需求（用户故事+质量评分前后对比 58→86）/ 竞品对比（verdict 分组）/ 技术方案（按成熟度）/ 机会评分表+优先级 / Now·Next·Later / 证据卡附录 / 人工确认记录 |
| 研发执行报告 | engineering_report.md | 需求摘要+验收标准 / 代码影响面地图（按 impact_level 分组，核心模块⚠标）/ 修改建议 / 任务卡（按 type）/ implementation plan / 测试建议 / Changelog 草稿 / 风险与待确认 |
| PRD 草稿 | prd_draft.md | 背景 / 目标用户与痛点 / 用户故事 / 功能范围 / 非目标 / 边界条件 / 验收标准 / 待澄清问题 / 证据映射 |
| 管理层摘要 | executive_summary.md | 一页：问题 → 证据 → 建议（P0 一句话）→ 投入预估 → 风险 |

渲染规则：被人工驳回/未确认的结论加 `[未确认]` 前缀；`demote_to_observation` 的结论移到「观察项」；证据卡 = evidence_ref → {原文摘录(≤120字), 来源(URL/文件), 强度}。state dump JSON 同目录输出 `state.json`。

---

## 10. 测试规格（tests/test_smoke.py）

1. `test_replay_e2e`：预置缓存 fixture，`run_mode=replay` + 自动 resume（选簇=最大簇、评审=全接受），断言：4 份报告生成、focus_candidate.quality.round==2 且 total 提升、execution.blocked==False、所有 evidence_refs 闭包合法。
2. `test_gate_rule`：decide_gate 单测（pass/needs_enrich/route_support 三分支）。
3. `test_risk_tier`：核心模块前缀命中 → HIGH。
4. `test_loop_caps`：构造 enrich 始终不达标的输入，断言 clarify_rounds 触顶后路由到 report 而非死循环；redo_target 触发后 redo_rounds 触顶不再回炉。
5. `test_degrade`：mock `WebSearchUnavailable` / `GithubUnavailable`，断言对应节点降级本地材料且 source 标 `mock://`，全链不中断。

---

## 11. 执行边界与容错（所有节点共同遵守）

本节是合同的一部分——规定 LangGraph 执行过程中的轮次上限、上下文传递、工具调用失败与降级策略。**节点实现必须遵守，集成（WT-7）按此校验。**

### 11.1 轮次与调用上限（硬性，防失控）

| 计数器 | state key | 上限 | 触顶行为 |
|---|---|---|---|
| 质量门禁自动补全 | enrich_rounds | 1 | 转 clarify_human |
| 人工澄清 | clarify_rounds | 1 | route_gate 降级 → report（ROUTE_SUPPORT 语义） |
| Critic 回炉 | redo_rounds | 1 | 不再回炉 → human_review |
| 评审补充证据 | more_evidence_rounds | 1 | route_review → report |
| 全局 LLM 调用 | llm.py 模块级计数器 | 30 | structured_call 抛 `LLMBudgetExceeded`，CLI 顶层捕获→带半成品 state 进 report 并标注「因调用预算中止」 |
| LangGraph recursion_limit | （编译参数）| 50 | 兜底防环；正常路径远低于此 |

- 正常 mock 全链 LLM 调用约 10–12 次，30 是安全冗余上限。
- `graph.invoke/stream` 必须传 `config={"recursion_limit": 50, "configurable": {"thread_id": "evopm-demo"}}`。
- 所有计数器在节点内 `+= 1` 后写回 state；条件路由函数只读不写。

### 11.2 失败策略：内部 fail-fast，外部可降级

明确区分两类失败，禁止混用：

- **LLM 结构化调用失败**（重试穷尽后）：**mock/live** 先尝试缓存兜底——从 `runs/.cache` 再到打包的 `tests/replay_cache_glm51` 里找一条能通过该 schema 校验的样本顶上，让演示链路不硬崩（`get_fallback_used()` 计数）；**找不到样本 / replay 模式** 才抛 `LLMCallFailed`（fail-fast，不静默兜空对象）。理由：半成品空对象流向下游会污染证据链，宁可用历史真实样本或整条 run 失败并打印是哪个节点哪个 schema。CLI 顶层捕获后给出可读错误 + 提示 `--replay`。
- **外部数据源失败**（GitHub API / web_search）→ **自动降级 mock**，不中断流程：
  - `GithubUnavailable`（intake 节点捕获）→ 读 `issues_mock.json`，日志 WARN，报告「数据来源」标注「issues 来自 mock」。
  - `WebSearchUnavailable`（research 节点捕获）→ 读 `competitors/*`、`tech_notes/*`，finding.source_url 前缀 `mock://`，evidence_strength 不得高于 `moderate`。
  - `--mock` 模式直接走降级路径，不尝试真实调用。

降级是「合同行为」：每个外部调用点都必须实现，缺失视为未完成验收。

### 11.3 节点间上下文传递（LangGraph，非长对话）

本系统**不维护跨节点的对话历史**——每个 Agent 是一次性 `structured_call(system, user)`，user 由节点代码从 state 现场拼装，调用完即弃。这样做的原因与约束：

- **避免上下文膨胀**：GLM 200K 上下文足够，但喂全 state 会稀释指令并增加成本/幻觉。节点只传**本步所需的最小切片**（见下表），不传无关产物。
- **每个 Agent 只见它该见的**：

  | 节点 | 注入 user 的内容（最小集） | 显式不注入 |
  |---|---|---|
  | intake | product_context（name/module/stage）+ 原始信号行 | 任何下游产物 |
  | discovery | 可行动 signals（id+text+category）+ existing_requirements | 竞品/技术/代码 |
  | research(竞品/技术) | 选中 cluster + 对应竞品/关键词 + 搜索结果或 mock 材料 | 其他簇、质量评分 |
  | requirement | 选中 cluster + 两类 findings（精简）+（enrich 时）现有草稿 + 人工补充文本 | repo_map、机会权重 |
  | strategy.score | focus_candidate（标题+痛点+quality.total）+ findings 摘要 + 权重语境 | 完整 impl 细节 |
  | strategy.design | focus_candidate + opportunity + findings | 其他簇 |
  | engineering | solution + repo_map + core_modules | 原始反馈全文 |
  | critic | 代码组装的**结论清单 + 各自 evidence_refs + 闭包 violations**（不是全文） | — |

- **大文本裁剪**：注入信号/issue 正文时单条裁剪到 ≤800 字符；repo_map 全文注入（已是精简目录树，约 1–2K）；findings 注入时省略 source 原文只留结论+强度。
- **证据靠 id 不靠原文**：下游节点引用上游用 id，不复制原文；原文只在 report 渲染证据卡时按 id 回查一次。

### 11.4 工具调用（web_search）失败的细处理

- web_search 是 research 节点**内部**的一次工具调用，不是 LangGraph 工具节点；失败在节点内捕获，不冒泡为图级错误。
- 单个竞品/单个关键词搜索失败 → 只对该项降级 mock，其余项照常（不因一项失败整节点降级）。
- 搜索成功但结果为空 → 等同 `WebSearchUnavailable` 走降级。
- web_search 不计入 llm_call_count（它是搜索计费，非生成调用），但受 research 节点内 ≤8 次搜索的软上限约束。

### 11.5 interrupt 中断与恢复的边界

- 全流程在**单进程内**用 `graph.stream` + `MemorySaver` 完成，进程不退出即不丢 checkpoint；不做跨进程持久化（黑客松不需要）。
- `--replay` + 自动 resume 模式下，三个 interrupt 用预设决策（select=最大簇、clarify=force_pass、review=全 accept）自动应答，供 smoke test 和断网演示。
- resume 值 schema 非法（如 cluster_id 不存在）→ hitl 层重新提示，不进入图。

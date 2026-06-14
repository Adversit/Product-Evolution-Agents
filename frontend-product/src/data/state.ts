// Canonical EvoPM decision dataset — ported verbatim from the `D = {...}` object
// inlined in the Claude Design handoff `EvoPM 决策工作台.dc.html`. This is curated
// glm-5.1 replay content (cross-checked against uploads/sample_state.json + the four
// reports). Static replay; no backend wiring.

export type EvidenceStrength =
  | "strong"
  | "moderate"
  | "partial"
  | "complete"
  | "weak"
  | "no_direct"
  | "inference_only";
export type EvidenceType = "signal" | "competitor" | "tech";

export interface EvidenceEntry {
  type: EvidenceType;
  strength: EvidenceStrength;
  source: string;
  text: string;
}

export interface QualityDim {
  name: string;
  r1: number;
  r2: number;
  rationale: string;
}

export interface UserStory {
  role: string;
  scenario: string;
  benefit: string;
  story_text: string;
  evidence_refs: string[];
}

export interface AcceptanceCriterion {
  type: "functional" | "nonfunctional";
  text: string;
  evidence_refs: string[];
}

export interface Competitor {
  id: string;
  competitor: string;
  verdict: "adopt" | "avoid" | "watch";
  has_solved: boolean | null;
  strength: EvidenceStrength;
  demoted?: boolean;
  conclusion: string;
  implication: string;
}

export interface Tech {
  id: string;
  name: string;
  maturity: "reference" | "experimental" | "high_risk" | "mature";
  topic: string;
  strength: EvidenceStrength;
  demoted?: boolean;
  cost: "low" | "medium" | "high";
  fit: string;
  risk: string;
}

export interface Cluster {
  id: string;
  title: string;
  freq: number;
  severity: "critical" | "high";
  status: "known" | "duplicate";
  focus: boolean;
  priority: string;
  horizon: string;
  signal_count: number;
  categories: string[];
  summary: string;
  candidate: string;
  duplicate_of?: string;
  dedup_reason?: string;
}

export interface FilteredSignal {
  id: string;
  actionability: string;
  text: string;
  followup: string;
}

export interface OppScore {
  dim: string;
  label: string;
  score: number;
  rationale: string;
}

export interface RoadmapItem {
  cluster_id: string;
  title: string;
  priority: string;
  horizon: string;
  focus: boolean;
  reason: string;
}

export interface CodeModule {
  module: string;
  core: boolean;
  risk: "high" | "low" | "medium";
  level: string;
  types: string[];
  desc: string;
  verify: string[];
}

export interface TaskCard {
  id: string;
  type: "data" | "backend" | "frontend";
  title: string;
  risk: "high" | "low" | "medium";
  modules: string[];
  evidence_refs: string[];
  desc: string;
}

export interface DecisionData {
  DIM_LABELS: Record<string, string>;
  FUNNEL: { stage: string; en: string; count: number; note: string }[];
  PRODUCT: { name: string; module: string; stage: string; runMode: string; llmCalls: number };
  QUALITY: {
    total_r1: number;
    total_r2: number;
    gate_r1: string;
    gate_r2: string;
    dims: QualityDim[];
    ambiguities: string[];
    missing_r1: string[];
  };
  FOCUS: {
    id: string;
    cluster_id: string;
    title: string;
    priority: string;
    horizon: string;
    gate: string;
    round: number;
    status: string;
    background: string;
    pain_point: string;
    business_goal: string;
    target_users: string[];
    user_stories: UserStory[];
    acceptance_criteria: AcceptanceCriterion[];
    scope: string[];
    non_goals: string[];
    boundary_conditions: string[];
  };
  COMPETITORS: Competitor[];
  TECH: Tech[];
  CLUSTERS: Cluster[];
  FILTERED_SIGNALS: FilteredSignal[];
  OPPORTUNITY: { total: number; priority: string; horizon: string; rationale: string; scores: OppScore[] };
  ROADMAP: RoadmapItem[];
  CODE_IMPACT: CodeModule[];
  CODE_UNCERTAIN: { module: string; note: string }[];
  SUGGESTED_ORDER: string[];
  TASKS: TaskCard[];
  RISKS: string[];
  CHANGELOG: string;
  EVIDENCE: Record<string, EvidenceEntry>;
}

export const D: DecisionData = {
  DIM_LABELS: {
    clarity: "清晰度",
    completeness: "完整度",
    testability: "可测性",
    acceptance_clarity: "验收明确度",
    evidence_sufficiency: "证据充分度",
    scope_control: "范围控制",
    feasibility: "可行性",
    consistency: "一致性",
    user_value: "用户价值",
    stage_fit: "阶段契合度",
  },
  FUNNEL: [
    { stage: "原始信号", en: "RAW SIGNALS", count: 27, note: "CSV 反馈 + GitHub issues" },
    { stage: "可行动性过滤", en: "FILTERED", count: 5, note: "情绪/误用/信息不足，未进聚类" },
    { stage: "信号查重并入", en: "DEDUPED", count: 9, note: "duplicate_of 非空" },
    { stage: "问题簇", en: "CLUSTERS", count: 3, note: "命中历史需求 1 簇" },
    { stage: "深挖焦点", en: "FOCUS", count: 1, note: "选中簇精评" },
  ],
  PRODUCT: { name: "RAGFlow", module: "文件上传与问答质量", stage: "growth", runMode: "replay", llmCalls: 0 },
  QUALITY: {
    total_r1: 61,
    total_r2: 86,
    gate_r1: "needs_enrich",
    gate_r2: "pass",
    dims: [
      { name: "clarity", r1: 72, r2: 88, rationale: "标题、背景、痛点、范围均清晰表述，根因分析（tf-05/tf-06）将多步骤压缩为单一态的问题链完整描述，业务目标可量化（≥95%成功率）。" },
      { name: "completeness", r1: 48, r2: 85, rationale: "所有必填字段已补齐：验收标准 7 条、非目标 4 条、边界条件 6 条。初评阶段刻意留空，enrich 后补全。" },
      { name: "testability", r1: 45, r2: 86, rationale: "验收标准均含可测条件：状态流转断言、错误分类覆盖验证、重试次数与退避间隔精确值、成功率 7 天窗口 ≥95%。" },
      { name: "acceptance_clarity", r1: 42, r2: 85, rationale: "7 条验收标准（4 functional + 3 nonfunctional），每条含明确 pass/fail 判定与验证方式，全部绑定 evidence_refs。" },
      { name: "evidence_sufficiency", r1: 70, r2: 88, rationale: "31 条 evidence_refs 覆盖 10 个 signals、8 个竞品发现、16 个技术发现，核心方案与风险项证据强度均为 moderate。" },
      { name: "scope_control", r1: 65, r2: 84, rationale: "non_goals 明确排除 4 项，boundary_conditions 用 200MB 上限与重试 3 次封顶防止范围蔓延。" },
      { name: "feasibility", r1: 62, r2: 82, rationale: "核心方案均为 reference 成熟度、成本 low–medium；high_risk 的 GraphRAG 幂等已拆为 non_goal。" },
      { name: "consistency", r1: 68, r2: 86, rationale: "scope、user_stories、acceptance_criteria 三者对齐；边界条件超时阈值与 tf-01/tf-19 描述一致。" },
      { name: "user_value", r1: 76, r2: 88, rationale: "直击 frequency=10、severity=critical 高频痛点；竞品调研证实为行业共性难题且无成熟方案，差异化优势明确。" },
      { name: "stage_fit", r1: 60, r2: 84, rationale: "定位为稳定性 bug 修复 + 工程增强，根因明确、方案成熟、成本可控，适合当前阶段优先推进。" },
    ],
    ambiguities: ["心跳超时阈值的精确数值需联调阶段与运维确认基线，当前默认值为初始参考"],
    missing_r1: [
      "缺少明确的验收标准——需为每个 scope 项定义可测试的通过/失败条件",
      "缺少边界条件/非功能约束——文件大小上限、并发数、心跳频率、超时阈值分档",
      "缺少非目标定义——分块预览、引用溯源、检索质量优化等应明确排除",
      "幂等性保证方案（tf-07/tf-23, high_risk）的技术设计细节缺失",
    ],
  },
  FOCUS: {
    id: "req-01",
    cluster_id: "clu-01",
    title: "解析任务稳定性修复——分阶段状态机、结构化错误透传与自动重试",
    priority: "P0",
    horizon: "now",
    gate: "pass",
    round: 2,
    status: "candidate",
    background:
      "RAGFlow 用户在多种高频场景遭遇解析任务卡死或失败：80–100MB+ 大文件长时间转圈后直接失败（sig-001, sig-003）、GraphRAG 启用后任务队列堆积导致整体卡死（sig-013, sig-014）、docx 文件解析卡在 0%（sig-005）、PDF 解析完成后长期处于 pending 状态（sig-006, sig-007）。竞品调研显示 Dify、AnythingLLM、Open WebUI 同样面临大文件/批量场景的卡死问题且均未给出成熟方案（cf-02, cf-04, cf-06），说明这是行业共性痛点。根因分析（tf-05, tf-06）表明：当前解析流程将多步骤压缩为单一「解析中」状态，worker 崩溃后状态机无法推进到 failed，任务永久卡死。",
    pain_point:
      "用户上传 80–100MB 的大文件后，解析任务经常长时间转圈甚至直接失败（sig-001, sig-003）；失败时没有任何错误原因提示，只看到笼统的「解析失败」，不知道是格式不支持、OCR 超时、还是内存不足。GraphRAG 场景更严重：启用后任务队列堆积、worker 崩溃，任务永久卡在 pending/0%（sig-013, sig-014），用户只能反复重试或重新上传。",
    business_goal:
      "将解析任务成功率提升至 95% 以上（含大文件场景），消除 GraphRAG 任务队列卡死问题；使每个失败任务都能给出结构化错误原因与可操作建议（如「OCR 超时，请重试」「格式不支持，请转换」），降低用户因解析卡死导致的流失率和工单量。",
    target_users: ["文档管理者 / 知识库管理员", "使用 GraphRAG 的 RAG 应用开发者", "处理大批量文档的企业级用户"],
    user_stories: [
      {
        role: "文档管理者 / 知识库管理员",
        scenario: "上传 80–100MB 的大文件后发起解析任务",
        benefit: "无需反复重试和重新上传大文件，节省时间和带宽；失败时能针对性处理而非盲目猜测原因",
        story_text:
          "作为文档管理者，我希望解析任务能够稳定完成，或在失败时给出明确的错误原因（如 OCR 超时、格式不支持、内存不足）和可恢复操作建议，以便我无需反复重试和重新上传大文件。",
        evidence_refs: ["sig-001", "sig-003", "sig-005", "sig-006", "sig-007", "cf-01", "cf-02", "tf-03", "tf-06", "tf-10", "tf-15"],
      },
      {
        role: "使用 GraphRAG 的 RAG 应用开发者",
        scenario: "启用 GraphRAG 后任务队列堆积、worker 崩溃导致任务永久卡在 pending",
        benefit: "单个 worker 崩溃不再导致整个队列停滞，GraphRAG 任务能自动恢复或快速失败并告知原因",
        story_text:
          "作为 GraphRAG 用户，我希望任务队列中的 worker 崩溃能被自动检测（心跳超时），瞬时失败能自动重试（指数退避），确定性失败能快速给出原因码，以便整个队列不会因单点故障永久停滞。",
        evidence_refs: ["sig-013", "sig-014", "sig-021", "sig-022", "tf-01", "tf-02", "tf-07", "tf-19", "tf-21", "tf-23"],
      },
      {
        role: "文档管理者 / 知识库管理员",
        scenario: "等待解析任务完成时无法判断任务是否真的在处理还是已经卡住",
        benefit: "能精确判断卡在哪个环节，减少等待焦虑，也可辅助排查问题",
        story_text:
          "作为文档管理者，我希望看到解析任务的分阶段进度（提取→OCR→分块→嵌入→索引，含已处理 chunk/总 chunk），以便我能判断任务是正常运行还是已经卡住，并预估完成时间。",
        evidence_refs: ["sig-023", "cf-07", "tf-09", "tf-16", "tf-18", "tf-20"],
      },
    ],
    acceptance_criteria: [
      { type: "functional", text: "解析任务必须按枚举阶段流转（uploaded→queued→extracting→ocr→chunking→embedding→indexing→done|failed），每个阶段切换时将当前阶段名、进度、心跳时间戳持久化到状态表；worker 崩溃后，心跳超时检测在 2×阶段阈值内将任务标记为 failed 或触发重试，不再出现永久 pending 状态。", evidence_refs: ["sig-013", "sig-014", "tf-05", "tf-16", "tf-18", "tf-19"] },
      { type: "functional", text: "解析任务失败时，系统必须写入结构化错误记录（error_type/error_stage/error_message/retryable），至少覆盖 OOM、OCR 超时、格式不支持、依赖服务抖动四类错误分类；前端展示用户友好化文案并提供手动重试按钮，错误原因不再是笼统的「解析失败」。", evidence_refs: ["sig-001", "sig-003", "tf-03", "tf-06", "tf-10", "tf-15", "tf-22"] },
      { type: "functional", text: "瞬时错误（网络抖动、依赖 5xx、超时、worker_crash）触发自动重试（指数退避 10s/30s/90s，最多 3 次）；确定性错误（格式不支持、文件损坏）直接落 failed + 原因码，不消耗重试额度。", evidence_refs: ["sig-022", "tf-02", "tf-21"] },
      { type: "functional", text: "前端分阶段进度条展示当前阶段名 + 已处理 chunk/总 chunk，轮询间隔 ≤5s；用户可明确区分「正常处理中」与「卡住」两种状态；无法预估总 chunk 数时降级展示已完成阶段数/总阶段数。", evidence_refs: ["sig-023", "cf-07", "tf-09", "tf-20"] },
      { type: "functional", text: "文件大小超过 200MB 时在上传阶段即被拒绝并返回明确错误提示，不创建解析任务；此校验在客户端预检 + 网关侧 Content-Length 校验双重保障。", evidence_refs: ["tf-15", "cf-02", "sig-001"] },
      { type: "nonfunctional", text: "【性能】心跳超时阈值按文件大小与解析阶段动态配置（≤100MB：extracting 10min/ocr 15min/embedding 5min per 500 chunks；100–200MB 各阶段翻倍），心跳扫描频率 ≤60s，扫描期间数据库写入压力不超过基线 20%。", evidence_refs: ["tf-01", "tf-19", "tf-20"] },
      { type: "nonfunctional", text: "【可观测性】解析任务成功率（done/总任务数）在 7 天滚动窗口内 ≥95%（含 80–100MB 大文件场景）；失败任务中至少 90% 携带结构化错误分类，可按 error_type 聚合查询失败分布。", evidence_refs: ["sig-001", "sig-003", "cf-02", "cf-06", "tf-15", "tf-22"] },
      { type: "nonfunctional", text: "【幂等性】分块写入使用基于文档 hash + 偏移量的稳定 chunk ID；并发重试同一任务时通过任务级排他锁（或状态机 CAS）防止两个 worker 同时执行同一阶段写入，避免数据竞争。", evidence_refs: ["tf-02", "tf-07", "tf-23", "tf-19"] },
    ],
    scope: [
      "解析流程分阶段拆分与状态枚举设计（uploaded→queued→extracting→ocr→chunking→embedding→indexing→done|failed），阶段级状态上报与持久化",
      "Worker 心跳机制 + 动态超时阈值自动检测卡死，超时任务自动标记并触发重试或失败",
      "结构化错误码体系（OOM/超时/格式不支持/依赖抖动等）+ 错误详情全链路透传",
      "可重试 vs 不可重试错误分类 + 指数退避自动重试（含分块/索引幂等写入作为前置）",
      "前端分阶段进度条（含已处理 chunk/总 chunk）+ 失败原因友好化展示 + 手动重试入口",
    ],
    non_goals: [
      "GraphRAG 完整幂等性设计（实体去重、关系合并）：成本 high，拆为独立前置任务，本期仅覆盖分块/索引 upsert 幂等",
      "分块预览解析（大文件冒烟测试）：方案尚处 experimental，推迟到稳定性修复完成后",
      "RAG 检索质量优化（混合检索、reranker、多库分数归一化）：与解析稳定性无关，不在本期",
      "可插拔/备用解析引擎集成（docx→PDF 转换 fallback）：优先级低于核心卡死修复",
    ],
    boundary_conditions: [
      "最大支持文件大小上限 200MB：超限文件在上传阶段即拒绝并给出明确错误提示",
      "心跳超时阈值按文件大小与解析阶段动态设置；超过 2× 阶段阈值无心跳则强制标记 worker_crash",
      "自动重试：最大 3 次，指数退避 10s/30s/90s；确定性错误直接落 failed 不消耗重试额度",
      "进度持久化：节流批量写入（每 500ms 或每 10 个 chunk 取其一），避免并发写入瓶颈",
      "重试幂等：基于文档 hash+偏移量的稳定 chunk ID upsert；重试前清理残留数据",
      "前端进度推送默认轮询（≤5s），SSE/WebSocket 作为后续优化项",
    ],
  },
  COMPETITORS: [
    { id: "cf-01", competitor: "Dify", verdict: "adopt", has_solved: true, strength: "moderate", conclusion: "Dify 文档列表提供「处理中/可用/错误」三态标签，失败文档标红并支持重新处理；但缺乏步骤级进度与具体错误码。", implication: "三态标签 + 标红 + 重新处理是轻量但体感好的设计，RAGFlow 应至少对标此基础层。步骤级进度可视化是双方共同缺口，可作为差异化突破点。" },
    { id: "cf-02", competitor: "Dify", verdict: "avoid", has_solved: false, strength: "moderate", conclusion: "Dify 在超大文件/海量批处理时同样卡在处理中；未提及文件上限、分片上传、流式解析或 OOM 防护。", implication: "大文件卡死是行业共性，Dify 无成熟方案。RAGFlow 应在解析架构层（流式分块、内存控制、超时熔断）做差异化投入。" },
    { id: "cf-03", competitor: "Dify", verdict: "watch", has_solved: null, strength: "no_direct", demoted: true, conclusion: "材料未涉及 Dify 的 GraphRAG / 任务队列调度机制，无法对标。", implication: "GraphRAG 卡死需在自身架构层做设计决策（独立 worker 池、并发上限、失败隔离）。" },
    { id: "cf-04", competitor: "Open WebUI", verdict: "avoid", has_solved: false, strength: "moderate", conclusion: "Open WebUI 上传处理较快但偏黑盒，无细粒度解析进度或步骤可视化，缺乏失败后的结构化反馈。", implication: "应作为「避免成为这样」的警示，优先补齐步骤级进度与结构化错误反馈。" },
    { id: "cf-05", competitor: "Open WebUI", verdict: "watch", has_solved: null, strength: "moderate", conclusion: "Open WebUI 支持接入外部提取引擎（Tika/Docling）增强解析，但无系统级自动 fallback。", implication: "可插拔引擎思路有参考价值，可考虑 fallback 解析器接口，但优先级低于核心卡死修复。" },
    { id: "cf-06", competitor: "AnythingLLM", verdict: "avoid", has_solved: false, strength: "moderate", conclusion: "AnythingLLM 大文件/批量嵌入耗时长且进度反馈粗，无差异化大文件处理机制。", implication: "大文件卡死是行业共性，RAGFlow 应利用深度解析积累率先给出系统级方案，形成壁垒。" },
    { id: "cf-07", competitor: "AnythingLLM", verdict: "watch", has_solved: null, strength: "moderate", conclusion: "AnythingLLM 显示文件级嵌入进度，但缺少解析步骤级细粒度可视化。", implication: "步骤级可视化是行业空白，RAGFlow 率先实现可形成差异化优势，投入产出比高。" },
    { id: "cf-08", competitor: "AnythingLLM", verdict: "watch", has_solved: null, strength: "weak", demoted: true, conclusion: "上传与嵌入两步分离隐含任务解耦，但材料不足以判断是否使用独立 worker 池或消息队列。", implication: "任务队列架构需自行决策：独立 worker 池 + 状态机是业界标准方向。" },
  ],
  TECH: [
    { id: "tf-01", name: "解析状态机 + 心跳超时检测机制", maturity: "reference", topic: "stability", strength: "moderate", cost: "medium", fit: "把多步解析压缩成单一态无法区分「卡住」与「在跑」。引入分阶段状态枚举 + worker 心跳 + 超时阈值判定，直接解决 GraphRAG worker 崩溃后永久 pending。", risk: "心跳阈值需调参：过短误杀正常大文件解析，过长失去检测意义；需按文档类型/文件大小动态设置。" },
    { id: "tf-02", name: "解析失败重试装饰器（指数退避 + 错误分类）", maturity: "reference", topic: "stability", strength: "moderate", cost: "low", fit: "瞬时错误指数退避自动重试，确定性错误直接落 failed + 原因码。对 GraphRAG 嵌入/向量库抖动的间歇性失败尤为有效。", risk: "重试必须幂等：需先实现分块/索引 upsert 或事务回滚作为前置条件。" },
    { id: "tf-03", name: "结构化错误码 + 失败原因透传前端", maturity: "reference", topic: "stability", strength: "moderate", cost: "medium", fit: "每次失败写入结构化错误（类型/阶段/message/可重试标志），前端展示原因，让用户看到「OCR 超时」而非笼统「解析失败」。", risk: "错误分类体系需设计完整；分类不准会导致可重试错误被跳过或浪费重试资源。" },
    { id: "tf-09", name: "分阶段进度条 + 步骤名展示", maturity: "reference", topic: "ux", strength: "moderate", cost: "medium", fit: "把解析拆成可上报阶段，前端按阶段渲染进度条与「已处理 chunk/总 chunk」，缓解卡在 0% 的焦虑。", risk: "进度依赖总 chunk 数预判，某些格式解析完成前无法准确预估，可能进度跳跃。" },
    { id: "tf-10", name: "失败原因展示 + 手动重试入口", maturity: "reference", topic: "ux", strength: "moderate", cost: "low", fit: "失败后前端展示具体原因并提供手动重试入口，用户可针对性处理，大幅减少无效重试。", risk: "原始异常 message 含技术细节，需设计错误码到用户可读文案的映射表。" },
    { id: "tf-15", name: "解析失败根因分类（OOM/超时/格式/依赖抖动）", maturity: "reference", topic: "文档解析", strength: "moderate", cost: "medium", fit: "列举失败原因为错误分类体系提供框架。大文件场景 OOM/OCR 超时高发，特定格式格式不支持常见。", risk: "降级策略（docx→PDF）可能引入格式损失；转换本身也可能失败或超时。" },
    { id: "tf-16", name: "解析流程分阶段拆分（提取→OCR→分块→嵌入→索引）", maturity: "reference", topic: "文档解析", strength: "moderate", cost: "medium", fit: "拆分后可精确定位卡在哪个环节，并为每阶段设置独立超时阈值和重试策略。", risk: "阶段间需保证数据一致性；GraphRAG 额外有实体抽取/关系构建阶段，拆分更多。" },
    { id: "tf-18", name: "完整解析状态枚举设计", maturity: "reference", topic: "上传状态机", strength: "moderate", cost: "medium", fit: "定义从上传到可问答的完整状态流转（含分步 parsing 子状态），是状态机改造、超时检测、阶段进度上报的基础。", risk: "状态枚举需向前兼容——旧任务记录需设计兼容映射。" },
    { id: "tf-19", name: "Worker 心跳 + 超时阈值自动判定卡死", maturity: "reference", topic: "上传状态机", strength: "moderate", cost: "low", fit: "增加「最后心跳时间」字段配合超时判定，是检测 worker 崩溃后永久 pending 的核心机制。", risk: "心跳频率/阈值需平衡——频率过高增加 DB 写入压力，阈值过长检测不及时。" },
    { id: "tf-21", name: "可重试 vs 不可重试错误分类 + 指数退避重试", maturity: "reference", topic: "失败重试", strength: "moderate", cost: "low", fit: "瞬时错误指数退避重试，确定性错误直接落 failed。标准做法可直接落地，退避逻辑可用 tenacity 实现。", risk: "错误分类准确性是关键——误分类会浪费重试或需用户手动干预。" },
    { id: "tf-22", name: "结构化错误数据模型扩展", maturity: "reference", topic: "失败重试", strength: "moderate", cost: "medium", fit: "每次失败写入结构化错误，是自动重试和前端错误展示的数据基础，打通「异常捕获→存储→展示」链路。", risk: "数据模型变更需考虑迁移与向后兼容；历史失败记录需做兼容处理。" },
    { id: "tf-05", name: "解析中间状态压缩为单一态——根因定位", maturity: "experimental", topic: "bug", strength: "moderate", cost: "medium", fit: "明确指出当前把完整流程压缩成单一「解析中」态，导致 worker 崩溃后无法推进到 failed，是卡在 0% 的直接根因。", risk: "阶段拆分后各阶段状态转换需严格保证一致性，防止「状态已推进但数据未写入」。" },
    { id: "tf-06", name: "失败后无结构化错误记录——掩盖真实问题", maturity: "experimental", topic: "bug", strength: "moderate", cost: "low", fit: "当前失败既不记录原因也无自动重试，掩盖真实问题（持续 OOM、依赖故障），开发者无法定位根因。", risk: "异常捕获需覆盖全面——worker 被 OOM Killer 直接杀死时仍需进程级监控兜底。" },
    { id: "tf-04", name: "分块预览解析作为大文件前置验证", maturity: "experimental", topic: "stability", strength: "weak", demoted: true, cost: "medium", fit: "正式全量解析前对前 N 个分块做预览解析，提前发现格式问题。对大文件可避免浪费全量解析资源。", risk: "预览成功不代表全量成功——OOM 和超时可能在全量阶段才暴露，给用户虚假安全感。" },
    { id: "tf-20", name: "阶段进度持久化（已处理 chunk/总 chunk）", maturity: "experimental", topic: "上传状态机", strength: "weak", cost: "medium", fit: "为每阶段写入进度与步骤名，用户能看到「嵌入阶段：已处理 1200/3500 chunk」而非笼统「解析中」。", risk: "高频进度写入可能成为性能瓶颈，需设计批量/节流写入策略。" },
    { id: "tf-07", name: "重试幂等性缺失风险——重复写入脏数据", maturity: "high_risk", topic: "bug", strength: "moderate", cost: "high", fit: "重试需幂等，避免重复写入分块/索引造成脏数据。GraphRAG 图谱构建更易因重复执行产生重复节点和边。", risk: "幂等实现不当导致数据不一致（部分旧数据残留），比不重试更难排查。" },
    { id: "tf-23", name: "重试幂等性保证（分块/索引 upsert + 事务回滚）", maturity: "high_risk", topic: "失败重试", strength: "moderate", cost: "high", fit: "幂等性保证是整个重试机制的安全基石，否则重试会重复创建分块、重复写入向量索引。", risk: "分块 upsert 需稳定 chunk ID；图谱幂等需实体去重和关系合并，实现不当比不重试更危险。" },
    { id: "tf-12", name: "混合检索（BM25+向量）+ reranker", maturity: "mature", topic: "RAG 检索质量", strength: "moderate", cost: "medium", fit: "检索质量优化的成熟能力，但与本簇「解析卡死/失败」无直接关联，仅当稳定性修复完成后再考虑。", risk: "稳定性未解决前引入检索层变更会增加复杂度与排障难度。" },
  ],
  CLUSTERS: [
    { id: "clu-01", title: "解析任务频繁卡死/失败，GraphRAG 与大文件场景尤甚", freq: 10, severity: "critical", status: "known", focus: true, priority: "P0", horizon: "now", signal_count: 10, categories: ["stability", "bug", "ux"], summary: "用户在多种场景遭遇解析卡死或失败：大文件长时间转圈甚至直接失败、GraphRAG 启用后任务队列堆积卡死、docx 卡在 0%、PDF 解析后长期 pending；且失败后缺乏错误原因反馈，只能反复重试或重新上传。", candidate: "修复解析卡死/失败问题——GraphRAG 任务队列与大文件解析优先" },
    { id: "clu-02", title: "缺少解析进度条展示与批量上传失败反馈", freq: 4, severity: "high", status: "duplicate", focus: false, priority: "Duplicate", horizon: "later", signal_count: 4, categories: ["missing_feature", "ux"], summary: "用户无法看到解析进行到哪一步、进度百分比或预计完成时间，界面仅有转圈图标；批量上传时无法得知哪些文件解析失败。", candidate: "文档列表展示解析进度条与批量上传分项失败标记", duplicate_of: "ex-01", dedup_reason: "本簇核心诉求（解析进度百分比/进度条展示）与 ex-01「支持解析进度百分比展示」(in_roadmap) 实质相同，建议在 ex-01 开发时一并覆盖批量失败标记。" },
    { id: "clu-03", title: "多知识库检索召回下降、引用溯源不准、表格解析退化", freq: 8, severity: "high", status: "known", focus: false, priority: "P1", horizon: "next", signal_count: 8, categories: ["bug"], summary: "跨多知识库检索召回质量明显下降并偶发 InfinityException(3052)；引用标注位置与原文不匹配；表格解析准确率较 0.23.1 退化。三者共同导致回答不可信、无法向客户交付。", candidate: "优化多知识库检索召回、引用溯源准确性与表格解析精度" },
  ],
  FILTERED_SIGNALS: [
    { id: "sig-002", actionability: "insufficient", text: "文档解析一直显示解析中，过了一晚上还是没好，也没有任何报错", followup: "能否提供文档类型、页数及服务器配置？是否启用 OCR 或 GraphRAG？" },
    { id: "sig-008", actionability: "insufficient", text: "问答检索回来的内容跟我问的问题不相关，召回质量很差", followup: "请提供具体问答示例、知识库配置（embedding 模型、chunk 策略）。" },
    { id: "sig-018", actionability: "emotional", text: "这破软件根本没法用，纯纯的垃圾", followup: "请问您具体遇到了什么问题？文档解析、文件上传还是问答检索？" },
    { id: "sig-019", actionability: "insufficient", text: "装了半天都装不上，你们的文档写得跟天书一样，气死了", followup: "请问安装方式（Docker / 源码编译）？具体报了什么错误？" },
    { id: "sig-020", actionability: "suspected_misuse", text: "我配置了本地 ollama 但是一直连不上，肯定是你们的 bug", followup: "请提供 Ollama 服务地址端口与 RAGFlow 模型配置。" },
  ],
  OPPORTUNITY: {
    total: 86.57,
    priority: "P0",
    horizon: "now",
    rationale: "解析稳定性是 RAG 产品核心链路入口，频次最高（10）+严重度 critical + 多场景覆盖，且大部分修复方案为成熟工程实践，应立即启动 Now 阶段修复。",
    scores: [
      { dim: "core_path_impact", label: "核心链路影响", score: 95, rationale: "解析是知识库构建核心链路第一步，该环节不稳定则整条 RAG 链路瘫痪，影响面无出其右。" },
      { dim: "severity", label: "严重度", score: 93, rationale: "簇严重度 critical；GraphRAG worker 崩溃后任务永久 pending，知识库无法交付，属生产阻断级故障。" },
      { dim: "pain_frequency", label: "痛点频次", score: 92, rationale: "clu-01 频次达 10（最高档），覆盖大文件卡死、docx 卡 0%、PDF pending、GraphRAG 队列堆积。" },
      { dim: "business_value", label: "业务价值", score: 90, rationale: "解析不稳定则知识库无法交付、下游检索问答全部失效；修复后直接恢复核心可用性，影响付费留存。" },
      { dim: "urgency", label: "紧迫度", score: 90, rationale: "severity=critical + frequency=10，永久卡死阻断日常工作流；不修复将持续恶化口碑。" },
      { dim: "strategy_fit", label: "战略契合", score: 88, rationale: "团队偏好「提升体验」，直击最痛的卡死体验；RAGFlow 以深度解析为核心差异化，修复稳定性巩固壁垒。" },
      { dim: "requirement_quality", label: "需求质量", score: 86, rationale: "需求质量 86 分，痛点清晰、场景具体、技术方案调研充分，可执行性高。" },
      { dim: "tech_feasibility", label: "技术可行性", score: 80, rationale: "核心方案均为 reference 级成熟实践，成本 low–medium；但幂等性保证 high_risk 拉低整体可行性。" },
      { dim: "cost", label: "成本（反向）", score: 75, rationale: "心跳检测与重试装饰器成本 low；状态机拆分与错误透传 medium；幂等性保证 high，是主要成本风险点。" },
      { dim: "competitor_gap", label: "竞品差距", score: 72, rationale: "Dify/AnythingLLM 同样面临大文件卡死属行业共性；Dify 已有三态标签，RAGFlow 连基础状态展示都缺失。" },
    ],
  },
  ROADMAP: [
    { cluster_id: "clu-01", title: "解析任务频繁卡死/失败，GraphRAG 与大文件场景尤甚", priority: "P0", horizon: "now", focus: true, reason: "核心链路入口、频次 10/严重度 critical、竞品也未解决属差异化机会，成熟方案可快速落地。" },
    { cluster_id: "clu-03", title: "多知识库检索召回下降、引用溯源不准、表格解析退化", priority: "P1", horizon: "next", focus: false, reason: "严重度 high + 频次 8，影响检索质量与用户信任，但需在解析稳定性修复完成后推进，避免并行引入回归风险。" },
    { cluster_id: "clu-02", title: "缺少解析进度条展示与批量上传失败反馈", priority: "Duplicate", horizon: "later", focus: false, reason: "状态为 duplicate，核心诉求已被 clu-01 的结构化错误透传与分阶段进度方案覆盖。" },
  ],
  CODE_IMPACT: [
    { module: "rag/svr", core: true, risk: "high", level: "certain", types: ["service", "api", "config", "data_model"], desc: "task_executor 是本次改造核心载体：实现 8 阶段状态机流转与持久化、Worker 心跳定期写入（30s）、结构化异常捕获与 error_type 分类、可重试判定、指数退避重试调度、重试前残留数据清理、进度节流批量写入、动态超时阈值。", verify: ["构造 80MB+ PDF 验证各阶段状态流转且 last_heartbeat_at 持续更新", "模拟 worker crash 验证 2× 阈值内标记 worker_crash 并触发重试或落 failed", "注入 OOM 验证 error_type=oom 且 retryable 判定正确", "验证指数退避 10s/30s/90s 序列与重试上限 3 次后落 failed"] },
    { module: "rag/nlp", core: true, risk: "high", level: "certain", types: ["service", "data_model"], desc: "支持稳定 chunk ID 生成（文档 hash + 偏移量）保证重试 upsert 幂等；embedding 阶段支持进度回调与批次级超时；embedding 调用捕获依赖服务异常并分类为 dependency_error。", verify: ["验证同一文档多次重试后 chunk ID 一致且向量索引无重复", "模拟嵌入模型 5xx 验证分类为 dependency_error 且 retryable=true", "验证 embedding 阶段每 500 chunk 进度回调正确上报"] },
    { module: "deepdoc/parser", core: true, risk: "high", level: "certain", types: ["service"], desc: "extracting 阶段格式解析器（PDF/DOCX/Excel）支持进度回调与阶段心跳写入；大文件解析捕获 OOM 异常并透传 error_type=oom；unsupported_format 在解析入口校验并分类为不可重试。", verify: ["构造 100MB+ PDF 触发内存峰值验证 OOM 被捕获记录 error_type=oom 而非裸 Exception", "上传不支持格式验证 error_type=unsupported_format 且 retryable=false 直接落 failed", "验证 extracting 阶段心跳时间戳持续更新"] },
    { module: "api/db", core: false, risk: "low", level: "certain", types: ["data_model", "service"], desc: "任务状态表新增字段 current_stage/stage_progress/processed_chunks/total_chunks/last_heartbeat_at/error_type/error_stage/error_message/retryable/retry_count/next_retry_at 等。", verify: ["验证 migration 在空库和有存量数据库上均可正常执行", "验证存量 parsing 状态任务被正确映射或标记 failed", "验证任务状态 CAS 操作在并发重试场景下仅一个成功"] },
  ],
  CODE_UNCERTAIN: [
    { module: "rag/flow", note: "管线编排层可能需协调多阶段流转与心跳写入的编排逻辑，具体范围取决于现有编排是否已在 task_executor 内完成阶段切换。需确认是否有独立编排入口。" },
    { module: "rag/graphrag", note: "GraphRAG 自动重试安全性依赖图谱幂等性，本期不在 scope 但需明确策略：禁用自动重试或增加跳过已完成子图的前置检查。" },
  ],
  SUGGESTED_ORDER: ["api/db", "deepdoc/parser", "deepdoc/vision", "rag/app", "rag/nlp", "rag/svr", "rag/llm", "rag/graphrag", "docker", "api/apps", "web/src", "test"],
  TASKS: [
    { id: "task-01", type: "data", title: "任务状态表 schema migration 与存量数据兼容", risk: "low", modules: ["api/db"], evidence_refs: ["tf-18", "tf-22"], desc: "新增任务状态表字段（current_stage, stage_progress, processed_chunks, total_chunks, last_heartbeat_at, error_type 等），含存量数据迁移与回滚脚本。" },
    { id: "task-02", type: "backend", title: "稳定 chunk ID 生成改造（文档 hash + 偏移量）", risk: "high", modules: ["rag/app", "rag/nlp"], evidence_refs: ["tf-02", "tf-07", "tf-23"], desc: "改造分块模板与分词管线使 chunk ID 基于文档 hash + 偏移量确定性生成，保证重试 upsert 幂等。" },
    { id: "task-03", type: "backend", title: "解析状态机与阶段持久化实现", risk: "high", modules: ["rag/svr", "deepdoc/parser", "deepdoc/vision", "rag/nlp"], evidence_refs: ["tf-16", "tf-18", "tf-05", "tf-20"], desc: "在 task_executor 实现 8 阶段枚举状态机，每阶段切换时持久化阶段名、进度、processed/total chunks、心跳时间戳。" },
    { id: "task-04", type: "backend", title: "Worker 心跳机制与超时扫描任务", risk: "high", modules: ["rag/svr", "docker"], evidence_refs: ["tf-01", "tf-19"], desc: "各阶段 30s 心跳写入；定时扫描任务（≤60s）检测超 2× 阶段阈值无心跳标记 worker_crash；动态超时阈值按文件大小配置。" },
  ],
  RISKS: [
    "重试幂等性不完整导致脏数据：本期仅覆盖分块/索引 upsert 幂等，GraphRAG 图谱构建幂等未解决（tf-07/tf-23 cost=high）。缓解：GraphRAG 重试增加「跳过已完成子图」前置检查，或暂时禁用自动重试仅保留手动重试 + 全量清理重建。",
    "心跳超时阈值设置不当导致误杀正常任务：大文件 OCR 单批次可能超预期，阈值过紧会误判卡死。缓解：基于 tf-01/tf-19 参考值在灰度收集实际时长校准；OCR 按批次设超时；误杀后重试幂等不产生脏数据。",
    "进度持久化写入频率与存储方案未完全验证：tf-20 evidence_strength=weak，节流策略在 10+ 大文件并发下能否控制写入压力需性能测试验证。缓解：不达标则引入 Redis 缓存层或异步写入队列。",
    "状态表 schema migration 对存量任务的影响：新增字段需迁移存量记录，存量 parsing 任务可能无法被新心跳检测识别。缓解：上线时先将存量 parsing 标记 failed 提示重发，或提供一次性迁移脚本映射旧状态。",
    "前端轮询模式下 API 并发压力：多用户同时查看大量任务时 ≤5s 轮询可能造成压力。缓解：API 支持批量查询、添加 ETag/304 缓存、限制前端同时轮询数量。",
  ],
  CHANGELOG:
    "【解析任务稳定性增强】\n\n新增功能：\n· 解析任务现支持 8 阶段可视化进度展示（上传→排队→文本提取→OCR→分块→嵌入→索引→完成），每阶段实时显示已处理进度，大文件解析过程一目了然\n· 新增 Worker 心跳超时检测机制，解析任务卡死时系统自动识别并在合理时间内标记失败或自动重试，不再永久卡在「解析中」状态\n· 解析失败时展示结构化错误原因（OOM / OCR 超时 / 格式不支持 / 依赖服务抖动）与可操作建议，并提供手动重试入口\n· 瞬时错误自动重试（指数退避 10s/30s/90s 最多 3 次），确定性错误快速失败并告知原因",
  EVIDENCE: {
    "sig-001": { type: "signal", strength: "partial", source: "csv_feedback", text: "上传一个 80MB 的 PDF 解析了两小时还在转圈，也不知道是卡了还是在跑" },
    "sig-002": { type: "signal", strength: "partial", source: "csv_feedback", text: "文档解析一直显示解析中，过了一晚上还是没好，也没有任何报错" },
    "sig-003": { type: "signal", strength: "partial", source: "csv_feedback · enterprise", text: "解析失败了但是页面没有任何提示，只能看到状态还是 pending，根本不知道发生了什么" },
    "sig-004": { type: "signal", strength: "complete", source: "csv_feedback", text: "不知道解析进行到哪一步了，界面就一个转圈图标，体验很差" },
    "sig-005": { type: "signal", strength: "partial", source: "csv_feedback", text: "大文件解析经常卡住，只能重新上传，又得从头再来一遍" },
    "sig-006": { type: "signal", strength: "partial", source: "csv_feedback", text: "解析任务失败后看不到错误原因，我们只能反复重试，很影响交付" },
    "sig-007": { type: "signal", strength: "partial", source: "csv_feedback", text: "启用 graphrag 之后解析频繁卡死，任务队列一直堆积下不去" },
    "sig-013": { type: "signal", strength: "partial", source: "csv_feedback", text: "上传超过 100MB 的文件直接失败，也没有任何提示说为什么" },
    "sig-014": { type: "signal", strength: "partial", source: "csv_feedback", text: "上传 docx 有时候会卡在 0%，要刷新好几次才动" },
    "sig-021": { type: "signal", strength: "partial", source: "github.com/infiniflow/ragflow/issues/13678", text: "[Bug]: Document automatic parsing failed — After uploading several PDFs the documents stay in an unparsed state." },
    "sig-022": { type: "signal", strength: "partial", source: "github.com/infiniflow/ragflow/issues/8343", text: "[Question]: parsing in stuck when apply — When I apply parsing to a large document the task seems to hang forever." },
    "sig-023": { type: "signal", strength: "partial", source: "github.com/infiniflow/ragflow/issues/7839", text: "[Bug]: parse get stuck frequently when enable graphrag — Enabling GraphRAG makes parsing tasks get stuck very frequently." },
    "cf-01": { type: "competitor", strength: "moderate", source: "mock://dify.md", text: "Dify 文档列表提供「处理中/可用/错误」三态标签，失败文档标红并支持重新处理；但缺乏步骤级进度与具体错误码。" },
    "cf-02": { type: "competitor", strength: "moderate", source: "mock://dify.md", text: "Dify 在超大文件/海量批处理时同样卡在处理中；未提及文件上限、分片上传、流式解析或 OOM 防护机制。" },
    "cf-04": { type: "competitor", strength: "moderate", source: "mock://open_webui.md", text: "Open WebUI 上传处理较快但偏黑盒，无细粒度解析进度或步骤可视化，缺乏失败后的结构化反馈。" },
    "cf-06": { type: "competitor", strength: "moderate", source: "mock://anythingllm.md", text: "AnythingLLM 大文件/批量嵌入耗时长且进度反馈粗，与 RAGFlow 面临同样的大文件性能瓶颈。" },
    "cf-07": { type: "competitor", strength: "moderate", source: "mock://anythingllm.md", text: "AnythingLLM 显示文件级嵌入进度，但缺少解析步骤级细粒度可视化与失败具体原因。" },
    "tf-01": { type: "tech", strength: "moderate", source: "mock://tech_notes/*", text: "解析状态机 + 心跳超时检测机制：分阶段状态枚举 + worker 心跳时间戳 + 超时阈值判定，解决 worker 崩溃后永久 pending。" },
    "tf-02": { type: "tech", strength: "moderate", source: "mock://tech_notes/*", text: "解析失败重试装饰器：瞬时错误指数退避自动重试，确定性错误直接落 failed + 原因码。" },
    "tf-03": { type: "tech", strength: "moderate", source: "mock://tech_notes/*", text: "结构化错误码 + 失败原因透传前端：每次失败写入结构化错误，前端展示原因并提供手动重试入口。" },
    "tf-05": { type: "tech", strength: "moderate", source: "mock://tech_notes/*", text: "根因定位：当前把完整流程压缩成单一「解析中」态，导致 worker 崩溃后状态机无法推进到 failed。" },
    "tf-06": { type: "tech", strength: "moderate", source: "mock://tech_notes/*", text: "失败后无结构化错误记录，掩盖真实问题（持续 OOM、依赖故障），开发者无法定位根因。" },
    "tf-07": { type: "tech", strength: "moderate", source: "mock://tech_notes/*", text: "重试幂等性缺失风险：重试需幂等，避免重复写入分块/索引造成脏数据；GraphRAG 图谱构建更易产生重复节点和边。" },
    "tf-09": { type: "tech", strength: "moderate", source: "mock://tech_notes/*", text: "分阶段进度条 + 步骤名展示：前端按阶段渲染进度条与「已处理 chunk/总 chunk」。" },
    "tf-10": { type: "tech", strength: "moderate", source: "mock://tech_notes/*", text: "失败原因展示 + 手动重试入口：展示「OCR 超时，请重试」等具体原因，减少无效重试。" },
    "tf-15": { type: "tech", strength: "moderate", source: "mock://tech_notes/*", text: "解析失败根因分类（OOM/超时/格式/依赖抖动），为错误分类体系提供框架。" },
    "tf-16": { type: "tech", strength: "moderate", source: "mock://tech_notes/*", text: "解析流程分阶段拆分（提取→OCR→分块→嵌入→索引），可精确定位卡在哪个环节。" },
    "tf-18": { type: "tech", strength: "moderate", source: "mock://tech_notes/*", text: "完整解析状态枚举设计（uploaded→queued→parsing[分步]→done|failed），是状态机改造的基础。" },
    "tf-19": { type: "tech", strength: "moderate", source: "mock://tech_notes/*", text: "Worker 心跳 + 超时阈值自动判定卡死：增加「最后心跳时间」字段配合超时判定。" },
    "tf-20": { type: "tech", strength: "weak", source: "mock://tech_notes/*", text: "阶段进度持久化（已处理 chunk/总 chunk + 当前步骤名），用户能看到精确阶段进度。" },
    "tf-21": { type: "tech", strength: "moderate", source: "mock://retry_strategy.md", text: "可重试 vs 不可重试错误分类 + 指数退避自动重试，退避逻辑可用 tenacity 实现。" },
    "tf-22": { type: "tech", strength: "moderate", source: "mock://retry_strategy.md", text: "结构化错误数据模型扩展：失败写入错误类型/阶段/message/可重试标志，是自动重试与展示的数据基础。" },
    "tf-23": { type: "tech", strength: "moderate", source: "mock://retry_strategy.md", text: "重试幂等性保证（分块/索引 upsert + 事务回滚），是整个重试机制的安全基石。" },
  },
};

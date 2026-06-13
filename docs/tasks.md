# EvoPM Agent — 任务卡（tasks.md）

**版本：** V1.0 | **上游：** `EvoPM_Demo_MVP_PRD_V1.0.md`、`spec.md`、`plan.md`
**用法：** 每个 worktree 新开一个 Claude Code session，告诉它：「按 `docs/tasks.md` 的 WT-x 任务组开发，合同见 `docs/spec.md` 对应章节，不得修改合同文件」。任务完成逐项 commit。

图例：⛔=串行硬依赖 ∥=组内可并行 ⏱=预估

---

## WT-0 foundation（⛔ 必须最先完成并合入 main）

### T0.1 项目骨架 ⏱1h
- 范围：`pyproject.toml`（依赖见 spec §0）、`src/evopm/` 包结构、`.env.example`、`.gitignore`（必含 `.env` `runs/` `__pycache__/` `.cache/`）、`README.md` 占位。
- 验收：`uv sync`（或 pip install -e .）成功；`python -c "import evopm"`。

### T0.2 全部 Pydantic schema + 枚举 ⏱1.5h
- 范围：`schemas.py` 按 spec §1/§2 **逐字段**实现；`state.py` 按 spec §3.1。
- 验收：`python -c "from evopm.schemas import *; from evopm.state import EvoPMState"`；每个模型可用最小字段实例化。

### T0.3 llm.py（GLM 封装） ⏱2h
- 范围：spec §6 三个函数：`get_chat`（base_url/温度约束）、`structured_call`（function_calling 结构化输出 + sha256 磁盘缓存 + replay 模式 + 429 指数退避 3 次 + 校验失败重试 1 次）、`web_search_call`（extra_body web_search + 20s 超时 + `WebSearchUnavailable`）。
- 验收：用 `glm-4.7-flash` 真实调一次 structured_call 返回合法 Pydantic 对象；断网/无 key 时 replay 模式可从缓存读取；单测 mock 验证重试逻辑。

### T0.4 config.py + agents/base.py ⏱1h
- 范围：`load_product_context(path)`（yaml→ProductContext）、`load_existing_requirements`、`load_repo_map`；`BaseAgent`（prompt 文件加载 + structured_call 包装）+ **证据闭包校验函数** `validate_evidence_refs(output, valid_ids) -> (clean_output, violations)`（spec §4 末尾）。
- 验收：校验函数单测：非法 id 被剔除且记录 violations。

### T0.5 mock 数据全套 ⏱2h
- 范围：`data/demo_kb/` 全部文件，格式按 spec §7：
  - `product.yaml`（含 opportunity_weights、core_modules）；
  - `feedback.csv` 20 条（构成比例按 spec §7：最大簇=解析失败/状态不可见 ≥6 条、检索引用 4–5、上传失败 3–4、**情绪/误用 2–3（漏斗样本）**、**与历史需求重复 1–2**；刻意不含验收标准描述，保证门禁初评 55–62）；
  - `issues_mock.json` 5–8 条（从真实 RAGFlow issues 改写：#13678/#8343/#7839/#13671/#15833/#12978，保留真实 URL）；
  - `existing_requirements.md` 4–6 条（其中 1 条与 feedback 重复样本对应，如「解析进度展示已在 roadmap」）；
  - `repo_map.md`（RAGFlow 真实目录树 + 职责注释 + 核心模块清单，底稿见下方附录 A）；
  - `competitors/` 3 个文件（每个 200–400 字：该竞品在上传/解析/引用上的公开能力与已知问题）；
  - `tech_notes/` 5 个文件（上传状态机/失败重试/chunk preview/rerank/引用溯源，各 150–300 字）。
- 验收：config.py 三个 load 函数全部解析成功；csv 行数=20。

### T0.6 规则函数 + 单测 ⏱1h
- 范围：`decide_gate`（spec §5.1）、机会总分加权计算（§5.2）、`risk_tier`（§5.3）放入 `schemas.py` 或独立 `rules.py`；`tests/test_gate_rule.py`、`tests/test_risk_tier.py`。
- 验收：pytest 全过（pass/needs_enrich/route_support 三分支；核心模块前缀→HIGH）。

### T0.7 prompts/_evidence_rules.md 公共片段 ⏱0.5h
- 范围：证据引用规则公共文本（id 格式、「只能引用提供的 id」「不允许编造来源」），供所有 agent prompt include。
- 验收：文件存在，被 base.py 的 prompt 加载逻辑支持拼接。

---

## WT-1 signals（⛔ 依赖 WT-0 ∥ 与 WT-2…6 并行）

### T1.1 sources/github.py ⏱1.5h
- 范围：`fetch_issues(repo, keywords, limit)` 按 spec §7；GITHUB_TOKEN 可选认证；搜索关键词（upload failed/parsing/retrieval/citation）；输出与 issues_mock.json 同构 dict；失败抛 `GithubUnavailable`。
- 验收：真实调用拉回 ≥5 条 RAGFlow issue；断网时异常类型正确。

### T1.2 IntakeAgent + prompt ⏱2h
- 范围：`agents/intake.py` + `prompts/intake.md`。读 CSV+issues（live 模式走 T1.1，失败/--mock 降级 mock json）→ 一次 LLM 批量标注全部 SignalItem 字段（12 类/情绪/可行动性 6 档/数据质量/duplicate_of/followup_question）。
- 验收：fixture 测试——对 mock 数据运行，断言：≥2 条被标 emotional/suspected_misuse；≥1 对 duplicate_of 关系；全部字段非空合法。

### T1.3 DiscoveryAgent + prompt ⏱2h
- 范围：`agents/discovery.py` + `prompts/discovery.md`。输入可行动信号 + 历史需求池 → 2–4 个 InsightCluster（含候选需求/用户故事初稿/历史查重 duplicate_of_existing）；输出过证据闭包校验。
- 验收：fixture 测试——「解析失败/状态不可见」成为 frequency 最大簇；≥1 簇命中历史需求池标 DUPLICATE；signal_ids 全部合法。

---

## WT-2 research（⛔ 依赖 WT-0 ∥）

### T2.1 ResearchAgent 竞品模式 + prompt ⏱2h
- 范围：`agents/research.py`（mode 参数）+ `prompts/research_competitor.md`。流程：根据选中簇生成 3–5 个调研问题 → 每竞品 web_search_call（`WebSearchUnavailable` 或 --mock → 读 mock_file）→ 输出 CompetitorFinding 列表（verdict 三分类/implication/source_url/evidence_strength）。
- 验收：mock 模式 fixture 测试——3 竞品各 ≥1 条 finding，mock 来源标 `mock://`；verdict 三类至少出现两类。

### T2.2 ResearchAgent 技术模式 + prompt ⏱1.5h
- 范围：`prompts/research_tech.md` + tech 模式逻辑。关键词来自 cluster + tech_topics；输出 TechFinding（5 档成熟度/fit_reason/cost/risk）。
- 验收：fixture 测试——≥3 条 finding；≥1 条非 mature 档（证明不是无脑推荐）；每条 fit_reason 非空。

### T2.3 web_search 实测与调参 ⏱1h（增强层，可后置到集成期）
- 范围：live 模式真实 web_search 跑通竞品+技术两模式，检查来源 URL 质量，必要时调 prompt。
- 验收：live 运行产出带真实 URL 的 finding ≥3 条。

---

## WT-3 decision（⛔ 依赖 WT-0 ∥）

### T3.1 RequirementAgent.draft_and_score + prompt ⏱2.5h
- 范围：`agents/requirement.py` + `prompts/requirement_draft.md`。簇+findings（+可选人工补充文本）→ RequirementCandidate（完整草稿字段 + QualityReport 10 维带锚点理由）；gate 字段由 `decide_gate` 代码覆写；quality 追加进 quality_history。
- 验收：fixture 测试（用手写 cluster+findings）——10 维齐全、每维 rationale 非空；对刻意缺验收标准的输入，missing_info 非空且 gate=NEEDS_ENRICH。

### T3.2 RequirementAgent.enrich + prompt ⏱2h
- 范围：`prompts/requirement_enrich.md` + enrich 方法。只允许基于给定 findings 补全 acceptance_criteria/non_goals/boundary_conditions，补全内容带 evidence_refs；补全后自动重评（复用 draft_and_score 的评分段）。
- 验收：fixture 测试——enrich 后 acceptance_criteria ≥3 条且各有 evidence_refs；第二轮 total > 第一轮 total ≥15 分；gate=PASS。**这是 demo 高光，验收最严。**

### T3.3 StrategyAgent.score + prompt ⏱1.5h
- 范围：`agents/strategy.py` + `prompts/opportunity.md`。focus 精评 10 维 + 未选中簇粗评（一次调用）；total 由代码加权；7 级优先级 + Horizon + 特殊类型；DUPLICATE 簇强制 Duplicate。
- 验收：fixture——focus 簇得 P0/P1；重复簇=Duplicate；3 簇覆盖 Now/Next/Later 至少两档。

### T3.4 StrategyAgent.design + prompt ⏱1.5h
- 范围：`prompts/solution.md` + design 方法 → SolutionSpec（4 角色 role_notes 必填、验收标准绑证据、异常/测试场景）。
- 验收：fixture——role_notes 4 个 key 齐全非空；acceptance_criteria 含 functional 和 nonfunctional 两类。

---

## WT-4 execution（⛔ 依赖 WT-0 ∥）

### T4.1 EngineeringAgent + prompt ⏱2.5h
- 范围：`agents/engineering.py` + `prompts/engineering.md`。SolutionSpec+repo_map → CodeImpactMap（三档影响/7 类对象/修改顺序/验证点）+ ExecutionProposal（7 类任务卡/修改建议/测试建议/impl_plan/changelog_draft）；`risk_tier` 代码判定；gate≠PASS → blocked=True 空产出；**prompt 明令禁止输出代码 diff**。
- 验收：fixture——影响面 ≥4 个模块且三档至少出现两档；命中 core_modules 的项 risk_tier=HIGH 并进 human_confirmation_needed；impl_plan 每步有 verify；输出文本不含 ``` diff 代码块。

### T4.2 CriticAgent + prompt ⏱2h
- 范围：`agents/critic.py` + `prompts/critic.md`。输入代码组装的全 state 摘要（含闭包校验 violations）→ CriticReview（5 档证据强度/overreach/降权/pending_confirmations/redo_target）。
- 验收：fixture——对一条故意无证据的结论标 inference_only + overreach；mock 来源的 finding 被标注来源有限；高风险影响项全部进 pending_confirmations。

---

## WT-5 report（⛔ 依赖 WT-0 ∥）

### T5.1 render.py + 证据卡 ⏱1.5h
- 范围：`report/render.py`：state → 模板上下文；证据卡函数（ref id → 原文摘录 ≤120 字 + 来源 + 强度）；`[未确认]`/观察项降权规则；`runs/<ts>/` 输出 + `state.json` dump。
- 验收：用手写的完整 state fixture 渲染不报错，证据卡正确回溯。

### T5.2 四个 Jinja2 模板 ⏱2.5h
- 范围：spec §9 的 4 个模板，section 齐全：opportunity_report（含漏斗统计表、质量评分前后对比）、engineering_report（核心模块⚠）、prd_draft、executive_summary（一页）。
- 验收：fixture 渲染后人工目检：评委 30 秒能从 opportunity_report 执行摘要看懂「问题→证据→P0 建议」。

---

## WT-6 hitl-cli（⛔ 依赖 WT-0 ∥）

### T6.1 hitl.py（3 个 interrupt 的 CLI 交互） ⏱2h
- 范围：spec §3.3 协议——payload→rich 表格渲染、input 解析→resume 值；final_review 支持 5 操作 + 低风险折叠 + `a` 批量接受；所有操作生成 HumanDecision（含 reason）。
- 验收：单测：模拟 payload→构造 resume dict 正确；非法输入重新提示。

### T6.2 cli.py ⏱1.5h
- 范围：typer 应用：`evopm run [--mock|--replay|--model|--data]`（含 stream 循环 + interrupt 处理 + 节点进度打印 + 结束漏斗统计）、`evopm init`（交互式问答生成 product.yaml）。
- 验收：`evopm init` 生成的 yaml 可被 config.py 加载；run 的进度打印格式符合 spec §8。

---

## WT-7 integration（⛔ 依赖 WT-1…6 全部合入）

### T7.1 graph.py 组装 ⏱2h
- 范围：spec §3.2 全部节点/边/三个条件路由/MemorySaver/interrupt 接线；enrich_rounds、redo_rounds 计数。
- 验收：`evopm run --mock --model glm-4.7-flash` 全链跑通，3 个 interrupt 可交互。

### T7.2 门禁剧情校准 ⏱1.5h
- 范围：调 feedback.csv 措辞 / 评分锚点 prompt，使初评 55–62、enrich 后 ≥80。
- 验收：连续 3 次 mock 运行复现「FAIL→enrich→PASS」。

### T7.3 真实数据联调（增强层按序） ⏱2h
- 范围：① 真实 GitHub API（T1.1 live）② web_search 实测（T2.3）③ glm-5.1 全链。每项卡住 >1h 回退 mock。
- 验收：live 运行产出含真实 issue URL 和真实搜索来源的报告。

### T7.4 smoke test + replay fixture ⏱1.5h
- 范围：跑一次成功的 live/mock 运行落缓存 → `tests/test_smoke.py`（spec §10）：replay 模式 + 自动 resume，断言报告/质量提升/证据闭包。
- 验收：断网（或清 API key）状态 `pytest tests/test_smoke.py` 通过。

### T7.5 演示彩排 ⏱1.5h
- 范围：README 快速开始 + 演示话术（十步主线）+ 彩排 ≥3 次掐表。
- 验收：≤3 分钟完整演示；`--replay` 离线演示通过。

---

## 附录 A：repo_map.md 底稿（RAGFlow 真实结构，2026-06 快照）

```text
ragflow/
├── deepdoc/            # 文档深度解析引擎【核心模块】
│   ├── parser/         #   PDF/DOCX/Excel 等格式解析器【核心模块】
│   └── vision/         #   OCR、版面分析、表格结构识别
├── rag/                # RAG 核心管线
│   ├── app/            #   按文档类型的分块(chunking)模板
│   ├── nlp/            #   分词、混合检索打分【核心模块】
│   ├── svr/            #   task_executor 异步解析任务队列【核心模块】
│   ├── llm/            #   嵌入/对话/重排模型适配层
│   ├── flow/ graphrag/ #   管线编排、GraphRAG
│   └── prompts/        #   提示词（含引用注入）
├── api/                # Python 后端服务
│   ├── apps/           #   HTTP 路由：document 上传、kb 管理、chat 问答
│   ├── db/             #   数据模型与 service 层（文档/解析状态）
│   └── ragflow_server.py
├── web/                # React/TS 前端
│   └── src/            #   上传 UI、解析进度展示、引用高亮
├── agent/              # Agent 工作流组件
├── test/               # testcases(API)/unit_test/playwright(E2E)
├── sdk/  mcp/  docker/ docs/
```

核心模块清单（与 product.yaml core_modules 一致）：`rag/nlp`、`deepdoc/parser`、`rag/svr`。

## 附录 B：真实 issue 改写素材（issues_mock.json 用）

| # | 标题 | URL |
|---|---|---|
| 13678 | [Bug]: Document automatic parsing failed | github.com/infiniflow/ragflow/issues/13678 |
| 8343 | [Question]: parsing in stuck when apply | github.com/infiniflow/ragflow/issues/8343 |
| 7839 | [Bug]: parse get stuck frequently when enable graphrag | github.com/infiniflow/ragflow/issues/7839 |
| 13671 | [Bug]: InfinityException(3052) when performing retrieval | github.com/infiniflow/ragflow/issues/13671 |
| 5919 | [Bug]: Data Retrieval Issues with Multiple Knowledge Bases | github.com/infiniflow/ragflow/issues/5919 |
| 12978 | [bug] table parsing accuracy degraded vs 0.23.1 | github.com/infiniflow/ragflow/issues/12978 |
| 15833 | Go: findCitations threshold descent — citation parity | github.com/infiniflow/ragflow/issues/15833 |

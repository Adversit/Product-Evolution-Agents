# EvoPM Agent — 前端 API 契约（frontend_api.md）

**用途：** 给前端可视化演示（review 漏斗/流水线/焦点需求/报告、定位问题）提供后端接口契约。
**面向：** 前端 session + Web 层实现者。所有字段名以 `src/evopm/schemas.py` / `state.py` 为准。

---

## 0. 现状与架构（必读）

- **后端当前是 CLI + 进程内 LangGraph 应用，没有 HTTP 服务**。`evopm run` 在单进程内跑图、用 `interrupt()` + stdin 做人工介入。
- 前端要可视化，需要一层**薄 Web 封装（建议 FastAPI + WebSocket）**包住现有的 `evopm.graph.build_graph()`。本文件定义**这层 Web 服务对前端暴露的接口契约**；Web 层本身尚未实现（可由前端 session 或单独 session 落地，约 1 个文件 `src/evopm/server.py`）。
- Demo 取向：**单会话、无鉴权、无并发**。固定 `thread_id="evopm-demo"`，`MemorySaver` 在进程内保存断点。三种运行模式：`mock`（本地材料 + 真实 LLM）、`replay`（全走缓存，离线）、`live`（真实 GitHub/web_search）。
- 运行模型 `glm-5.1`（主链）/ `glm-4.5-air`（开发期，快）。

### 运行生命周期（前端要驱动的主流程）

```
start(mode) → [流式] 逐节点进度 → interrupt① 选簇 → resume
            → [流式] 调研/门禁/enrich … → interrupt② 澄清(仅未达标时) → resume
            → [流式] 机会/方案/工程/审查 → interrupt③ 终审 → resume
            → done(报告路径) → 读 /state、/reports、/evidence 做可视化
```
- 图共 **14 个节点**：`intake, discovery, select_cluster, competitor_research, tech_research, quality_gate, enrich, clarify_human, opportunity, solution_design, engineering, critic, human_review, report`。
- **3 个人工断点**：`select_cluster`①、`clarify_human`②（只有门禁两轮仍不达标才触发）、`human_review`③。
- `interactive=false` 时服务端用预设自动应答（选最大簇 / force_pass / 全 accept），适合无人值守的纯可视化演示。

---

## 1. 接口总览

| 用途 | 方法 / 通道 | 路径 |
|---|---|---|
| 启动一次运行 | `POST` | `/api/run` |
| 实时流（节点进度 + 断点 + 完成） + 应答断点 | `WebSocket` | `/ws` |
| 取完整运行状态（可视化主数据源） | `GET` | `/api/state` |
| 取漏斗统计 | `GET` | `/api/funnel` |
| 取报告列表 / 单份报告 Markdown | `GET` | `/api/reports`、`/api/reports/{name}` |
| 证据卡回查（id → 原文摘录） | `GET` | `/api/evidence/{ref_id}` |
| 重置（清断点重新开始） | `POST` | `/api/reset` |

> WebSocket 处理「流式进度 + 交互式断点」这一双向场景；其余只读数据用 REST。若前端偏好 SSE，可把 `/ws` 拆成 `GET /api/stream`(SSE) + `POST /api/resume`，事件体一致（见 §5）。

---

## 2. POST /api/run — 启动运行

请求：
```json
{ "mode": "mock", "model": "glm-5.1", "data": "data/demo_kb", "interactive": true }
```
- `mode`: `"mock" | "replay" | "live"`（默认 `mock`）
- `model`: 可选，覆盖模型（如 `glm-4.5-air`）
- `data`: 可选，数据目录（默认 `data/demo_kb`）
- `interactive`: `true`=断点等前端应答；`false`=服务端预设自动应答

响应：
```json
{ "run_id": "evopm-demo", "thread_id": "evopm-demo", "mode": "mock", "status": "started" }
```
> 启动后前端连 `/ws` 接收流；服务端内部 `llm.reset_budget()` + `llm.set_run_mode(mode)` 后开始 `graph.stream(...)`。

---

## 3. WebSocket /ws — 实时流与断点应答

**服务端 → 前端** 事件（每条形如 `{ "event": <type>, ... }`）：

| event | 触发 | 字段 |
|---|---|---|
| `node` | 每个节点跑完 | `node`、`agent`（展示名）、`summary`（一行结论）、`elapsed`（秒） |
| `interrupt` | 图暂停等人工 | `payload`（见 §4，含 `type`） |
| `done` | 跑到 report→END | `report_paths: string[]`、`funnel`（见 §6） |
| `error` | 失败 | `kind`（`llm_failed`/`budget`/...）、`message` |

`node` 事件示例：
```json
{ "event": "node", "node": "quality_gate", "agent": "RequirementAgent.draft", "summary": "质量评分 total=61 gate=needs_enrich", "elapsed": 8.3 }
```
节点→展示名映射（后端 `cli._NODE_AGENT`）：intake→IntakeAgent、discovery→DiscoveryAgent、competitor_research→ResearchAgent(竞品)、tech_research→ResearchAgent(技术)、quality_gate→RequirementAgent.draft、enrich→RequirementAgent.enrich、opportunity→StrategyAgent.score、solution_design→StrategyAgent.design、engineering→EngineeringAgent、critic→CriticAgent、report→ReportRenderer（select_cluster/clarify_human/human_review 为人工节点）。

**前端 → 服务端** 应答（仅在收到 `interrupt` 后发送）：
```json
{ "action": "resume", "value": { ... } }
```
`value` 的结构由断点类型决定（见 §4）。服务端注入 `Command(resume=value)` 继续，并继续推 `node` 事件。

---

## 4. 三个断点协议（interrupt payload + resume value）

后端 `graph.py` 节点实际发出的 payload、以及 resume 期望的结构：

### ① select_cluster（选定焦点簇）
payload（服务端→前端）：
```json
{ "type": "select_cluster",
  "clusters": [ { "id": "clu-01", "title": "...", "summary": "...", "frequency": 7, "severity": "high", "status": "new" } ] }
```
resume value（前端→服务端）：`{ "cluster_id": "clu-01" }`
> DUPLICATE 状态的簇不可被选为焦点（前端可禁用）。

### ② clarify_human（人工澄清，仅门禁两轮仍不达标时出现）
payload：
```json
{ "type": "clarify", "missing_info": ["缺少明确的验收标准", "..."], "questions": ["进度粒度到阶段还是百分比？"] }
```
resume value：`{ "action": "supplement" | "force_pass" | "route_support", "text": "补充说明（supplement 时填）" }`
- `supplement`：带补充文本回门禁重评；`force_pass`：强制通过进入决策；`route_support`：转文档/客服直接出报告。

### ③ human_review（最终评审）
payload：
```json
{ "type": "final_review",
  "items": [ { "ref": "req-01", "description": "...", "risk_tier": "high", "evidence_strength": "moderate" } ] }
```
resume value：
```json
{ "decisions": [ { "item_ref": "req-01", "action": "accept", "reason": "", "edited_content": "" } ] }
```
- `action` ∈ `accept | reject | edit | redo | more_evidence`（`ReviewAction`）。
- 低风险项（`risk_tier=low`）前端可默认折叠 / 一键全 accept。
- 含 `more_evidence` 时后端会重入调研一轮（最多 1 次）再回到本断点。

---

## 5. GET /api/state — 完整运行状态（可视化主数据源）

返回当前 `EvoPMState` 的 JSON（等价于报告目录里的 `state.json`，枚举为字符串值）。前端大部分视图都从这里取数。关键字段（全部字段定义见 `schemas.py`）：

```jsonc
{
  "run_mode": "mock",
  "llm_call_count": 12,
  "signals": [ /* SignalItem: id, source_type, origin_url, author_type, created_at, text,
                  module_guess, category, sentiment, actionability, duplicate_of, data_quality, followup_question */ ],
  "existing_requirements": [ /* id, title, summary, status */ ],
  "clusters": [ /* InsightCluster: id, title, summary, signal_ids[], categories[], severity,
                   frequency, status(new|known|duplicate|insufficient), candidate_title,
                   user_story_draft, duplicate_of_existing, dedup_reason */ ],
  "selected_cluster_id": "clu-01",
  "competitor_findings": [ /* CompetitorFinding: id, competitor, research_question, has_solved,
                              conclusion, verdict(adopt|avoid|watch), gap_description, implication,
                              source_url, evidence_strength */ ],
  "tech_findings": [ /* TechFinding: id, topic, solution_name, maturity(mature|reference|experimental|
                        high_risk|unsuitable), fit_reason, cost_estimate, risk, source_url, evidence_strength */ ],
  "focus_candidate": {
    "id": "req-01", "cluster_id": "clu-01", "title": "...", "background": "...",
    "target_users": [], "pain_point": "...", "business_goal": "...",
    "scope": [], "non_goals": [], "boundary_conditions": [], "clarifications": [],
    "user_stories": [ { "role": "", "scenario": "", "benefit": "", "story_text": "", "evidence_refs": [] } ],
    "acceptance_criteria": [ { "text": "", "type": "functional|nonfunctional", "evidence_refs": [] } ],
    "evidence_refs": [],
    "quality": { "total": 86, "gate": "pass", "round": 2,
                 "dimensions": [ { "name": "clarity", "score": 88, "rationale": "" } ],
                 "missing_info": [], "ambiguities": [], "followup_questions": [] },
    "quality_history": [ /* 同 quality；[0]=初评(round1)、[-1]=enrich后(round2)，用于 58→86 前后对比 */ ],
    "status": "candidate", "status_history": []
  },
  "opportunity": { "requirement_id": "req-01",
    "scores": [ { "dimension": "pain_frequency", "score": 90, "rationale": "", "evidence_refs": [] } ],
    "total": 84.5, "priority": "P0", "horizon": "now", "rationale": "", "special_types": [] },
  "roadmap": [ { "cluster_id": "clu-01", "title": "...", "priority": "P0", "horizon": "now",
                 "one_line_reason": "", "is_focus": true } ],
  "solution": { "requirement_id": "req-01", "summary": "", "scope": [], "non_goals": [],
                "user_flow": [], "acceptance_criteria": [], "edge_cases": [], "test_scenarios": [],
                "role_notes": { "product": "", "dev": "", "qa": "", "support": "" },
                "risks": [], "dependencies": [] },
  "code_impact": { "requirement_id": "req-01",
    "items": [ { "module_path": "rag/svr", "impact_level": "certain|possible|uncertain",
                 "impact_types": ["service"], "description": "", "is_core_module": true,
                 "risk_tier": "high", "verify_points": [] } ],
    "suggested_order": [], "human_confirmation_needed": [] },
  "execution": { "requirement_id": "req-01", "blocked": false,
    "tasks": [ { "id": "task-01", "type": "backend", "title": "", "description": "",
                 "related_modules": [], "evidence_refs": [], "risk_tier": "high" } ],
    "change_suggestions": [], "test_suggestions": [],
    "impl_plan": [ { "step": 1, "action": "", "modules": [], "verify": "", "risk": "" } ],
    "changelog_draft": "" },
  "critic_review": { "findings": [ { "target": "", "evidence_strength": "inference_only",
      "overreach": true, "risk_tier": "medium", "note": "", "demote_to_observation": false } ],
    "pending_confirmations": [], "redo_target": null, "redo_instructions": "" },
  "human_decisions": [ { "checkpoint": "final_review", "item_ref": "req-01", "action": "accept",
                         "reason": "", "edited_content": "", "timestamp": "..." } ],
  "report_paths": [ "runs/<ts>/opportunity_report.md", "...(共 4 份)" ]
}
```

可选便利端点（避免前端自己派生，对应 `render.build_context` 的派生字段）：可在 `/api/state` 响应里附带 `derived`，含 `filtered_signals`、`duplicate_signals`、`verdict_groups`、`tech_by_maturity`、`impact_by_level`、`tasks_by_type`、`roadmap_by_horizon`、`evidence_cards`、`quality_first`、`quality_last`、`rejected_refs`、`observations`。

---

## 6. GET /api/funnel — 漏斗统计

对应 `render._funnel_stats`：
```json
{ "total_signals": 27, "filtered": 5, "duplicates": 2, "clusters": 3, "dup_clusters": 1, "focus": 1 }
```
前端漏斗：`N 条信号 → 过滤 filtered → 去重 duplicates → clusters 簇 → 1 焦点 → 优先级`。

---

## 7. GET /api/reports 与 /api/reports/{name}

- `GET /api/reports` → `{ "reports": [ { "name": "opportunity_report", "path": "runs/<ts>/opportunity_report.md" }, ... ] }`（4 份：`opportunity_report` / `engineering_report` / `prd_draft` / `executive_summary`）。
- `GET /api/reports/{name}` → `{ "name": "...", "markdown": "# ...全文" }`，前端用 markdown 渲染器展示。
- 样例报告（glm-5.1 产出）见 `docs/sample_reports/`，可先用于界面对样式。

---

## 8. GET /api/evidence/{ref_id} — 证据卡回查

对应 `render.evidence_card`。`ref_id` 形如 `sig-001` / `cf-01` / `tf-01`：
```json
{ "ref": "sig-001", "excerpt": "上传一个 80MB 的 PDF 解析了两小时还在转圈…(≤120字)", "source": "csv_feedback", "strength": "moderate" }
```
用于在用户故事/验收标准/机会评分上点击 `evidence_refs` 弹出原文与来源、强度。

---

## 9. 视图 → 数据来源 映射（建议）

| 前端视图 | 数据来源 |
|---|---|
| 流水线 14 节点进度动画 | `/ws` 的 `node` 事件 |
| 漏斗图（信号→过滤→簇→焦点） | `/api/funnel` + `state.filtered_signals/duplicate_signals` |
| 问题簇总览（含 DUPLICATE 标记） | `state.clusters` |
| **焦点需求质量前后对比 58→86** | `focus_candidate.quality_history[0]` vs `[-1]`（10 维雷达 + total） |
| 竞品对比（按 verdict 分组） | `state.competitor_findings` / `derived.verdict_groups` |
| 技术方案（按成熟度） | `state.tech_findings` / `derived.tech_by_maturity` |
| 机会评分表 + 优先级 | `state.opportunity` |
| Now·Next·Later 路线图 | `state.roadmap` / `derived.roadmap_by_horizon` |
| 代码影响面地图（核心模块⚠） | `state.code_impact`（`is_core_module`/`risk_tier`） |
| 任务卡 / 实施计划 | `state.execution`（`tasks`/`impl_plan`/`blocked`） |
| 对抗审查 / 待确认清单 | `state.critic_review`（`findings`/`pending_confirmations`/`demote_to_observation`） |
| 人工介入面板（3 断点） | `/ws` 的 `interrupt` 事件 + resume |
| 人工决策记录 / `[未确认]` 标注 | `state.human_decisions`（`action=reject` 的项前端加 `[未确认]`） |
| 证据卡弹层 | `/api/evidence/{ref_id}` |
| 4 份报告全文 | `/api/reports/*` |

---

## 10. 实现备注（给 Web 层实现者）

- 在 `POST /api/run` 时构建/复用 `graph = build_graph()`，调用 `config={"recursion_limit":50,"configurable":{"thread_id":"evopm-demo"}}`。
- 流式：`for chunk in graph.stream(pending, config)`；`chunk` 普通形如 `{node: state_delta}`→发 `node` 事件；`{"__interrupt__": (Interrupt(value=payload),)}`→发 `interrupt` 事件并等待前端 resume，再以 `Command(resume=value)` 续跑（参考 `cli._drive` / `cli._extract_interrupt_payload`）。
- 自动模式（`interactive=false` / `replay`）用 `hitl.auto_resume(payload)` 生成预设应答。
- `/api/state` 取 `graph.get_state(config).values`，用 `model_dump(mode="json")` 序列化（枚举转字符串）；可直接复用 `report.render` 的 `state.json` dump 逻辑。
- 失败语义（spec §11.2）：`LLMCallFailed`/`LLMBudgetExceeded` 顶层捕获 → 发 `error` 事件，提示可切 `--replay`。
- 跨域：前端独立端口时给服务端开 CORS。
- **离线演示**：`mode="replay"` + `interactive=false` 全程读 `runs/.cache`（或指定 glm-5.1 缓存 `tests/replay_cache_glm51/`，需让服务端指向该 CACHE_DIR），断网可跑。

> 本契约不含鉴权/多租户/分页（demo 不需要）。字段以 `schemas.py` 为唯一真相；如需新增后端字段，先改 `schemas.py`/`spec.md` 再同步本文件。

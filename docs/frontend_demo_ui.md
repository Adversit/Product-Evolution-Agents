# 前端约束（二）：过程演示 / 流水线透视台

**定位：** 把 14 节点 LangGraph 的执行过程**实时、酷炫但清晰**地可视化——让人看清「数据如何被一步步加工」，并能**一眼定位问题出在哪一步**。
**配套：** 接口见 `frontend_api.md`；字段以 `schemas.py` 为准。
**核心张力（用户原话）：** **酷炫，但展示过程清晰；过程的字段要清晰显示。** → 动画服务于「看清过程」，不是噪音；任何时候关键字段都**明文可读**，不能只有炫光没内容。
**与「产品级」的分工：** 本版**刻意暴露工程内部**（节点耗时、LLM 调用数、计数器、路由分支、原始字段、降级/违规标记）——这正是它存在的意义：观测与排障。

---

## 1. 受众与目标

- **受众：** 评委（看多智能体编排深度与可靠性兜底）、开发者（定位 bug）。
- **核心目标：**
  1. 实时看完整条链 14 节点跑完，**过程有节奏感、好看**；
  2. 点任一节点能看清它的**输入切片**与**输出结构化字段**；
  3. **快速定位异常**：哪一步降级了 / 证据闭包违规 / 门禁不达标 / 回炉 / blocked / 悬空引用。

## 2. 设计原则（硬约束）

1. **实时流水线动画**：节点随执行**点亮/脉冲**，边上有数据流动效果；当前活跃节点突出。酷炫感来自**流动与状态变化**，不是花哨配色。
2. **字段永远明文**：每个节点的输入/输出对象以**结构化字段 + 原始 JSON 双视图**呈现；不能用图标/缩写掩盖内容。关键字段（gate、total、verdict、maturity、risk_tier、source_url、evidence_refs）要直接可见。
3. **过程可暂停可回看**：支持暂停在某节点、逐节点回看（时间轴/步进）；不要一闪而过。
4. **问题高亮优先**：异常状态用醒目色 + badge（见 §5），并可点开看「为什么」。排障信息比美观优先级更高。
5. **深色科技感**：建议深色主题 + 高对比强调色（青/紫/琥珀分别表示进行/成功/警告），等宽字体显示字段值。

## 3. 核心视图

> 三栏布局：左=流水线图，中=节点检视，右=实时计数/状态。

### A. 流水线图（主舞台）
- **14 节点 DAG**，按 `intake → discovery → select_cluster →（competitor_research ∥ tech_research）→ quality_gate → enrich/clarify →（条件）→ opportunity → solution_design → engineering → critic → human_review → report` 布局。
- 实时点亮当前节点（来自 `/ws` 的 `node` 事件）；每节点上显示 **agent 名 + 一行结论摘要 + 耗时**（如 `quality_gate · RequirementAgent.draft · total=61 gate=needs_enrich · 8.3s`）。
- **把条件分支画出来并高亮实际走向**：门禁路由（enrich/clarify/opportunity/report）、Critic 回炉（redo→某节点）、评审补证据重入（→competitor/tech 再回 critic）、首轮两调研 fan-in。这是体现编排深度的关键。

### B. 节点检视面板（点击节点展开）
- **输入切片**：该节点喂给 agent 的最小上下文（spec §11.3），明文展示。
- **输出对象**：该节点写回 state 的结构化字段，按节点类型重点呈现——
  - `intake`：每条信号的 12 类 category / sentiment / actionability / duplicate_of / data_quality（表格，过滤项与重复项标色）。
  - `discovery`：簇 + `signal_ids`（标注闭包是否合法）、`duplicate_of_existing`（DUPLICATE 簇标记）。
  - `research`：研究问题 → findings；**`source_url` 为 `mock://` 的标「降级」badge**，evidence_strength 显示。
  - `quality_gate`：**10 维分数条 + 各维 rationale**，blocker 维（acceptance_clarity/completeness/evidence_sufficiency）单独标注，代码判定的 `gate` 醒目显示。
  - `enrich`：**前后 diff**（新增的 acceptance_criteria/non_goals/boundary + total 61→86）。
  - `opportunity`：10 维加权计算明细（score × weight）→ total → priority（代码下限保护是否生效）。
  - `engineering`：代码影响面（`is_core_module`/`risk_tier` 由代码判定，标注）、`blocked` 状态、impl_plan 每步 verify。
  - `critic`：findings（overreach/inference_only 标红）、**闭包 violations**、`pending_confirmations`、`redo_target`。
- **双视图切换**：结构化 ↔ 原始 JSON（来自 `/api/state` 对应字段）。

### C. 实时状态 / 计数侧栏
- **漏斗实时数**：信号→过滤→去重→簇→焦点（`/api/funnel`）。
- **计数器**：`enrich_rounds` / `clarify_rounds` / `redo_rounds` / `more_evidence_rounds`（显示 当前/上限1），`llm_call_count`（当前/预算30），`run_mode`。
- **断点交互**：3 个 interrupt 的 payload **原样展示**（select_cluster 的簇列表、clarify 的 missing_info/questions、final_review 的 items），并就地应答（resume）；replay/auto 模式显示「自动应答：选最大簇 / force_pass / 全 accept」。

## 4. 酷炫 ≠ 噪音（关键平衡）

- 动效只用于：节点激活脉冲、数据流沿边流动、数字滚动、分支高亮、异常闪烁。
- **禁止**：遮挡字段的炫光、过场动画拖慢查看、纯装饰粒子。
- 任何动画都要可**关闭/加速**，方便排障时静态查看。

## 5. 问题定位（这是本版的灵魂）

实时用 badge/高亮标出以下异常，并可点开看原因：

| 异常 | 来源字段 | 视觉 |
|---|---|---|
| 外部降级 mock | finding.`source_url` 前缀 `mock://` | 琥珀 badge「降级」 |
| 证据闭包违规 / 悬空引用 | critic 输入的 violations / 校验剔除记录 | 红色，列出被剔除 id |
| 门禁不达标 | `quality.gate != pass` + 低分 blocker 维 | 红/黄，标出是哪几维 |
| 回炉 | `critic_review.redo_target` 非空、`redo_rounds` | 紫色回环动画 |
| 补证据重入 | `research_reentry` / `more_evidence_rounds` | 高亮重入边 |
| 执行被阻断 | `execution.blocked=true` | 红色锁标 |
| 预算/失败 | `/ws` `error` 事件、`llm_call_count` 接近 30 | 顶部告警条 |
| 被驳回 / 观察项 | `human_decisions.action=reject`、`demote_to_observation` | `[未确认]` / 移入观察区 |

## 6. 数据来源

- 流水线进度 + 断点：`/ws` 的 `node` / `interrupt` / `done` / `error` 事件。
- 节点字段明细：`/api/state` 各字段（结构化 + 原始 JSON）。
- 证据回查：`/api/evidence/{ref_id}`。
- 计数/漏斗：`/api/state`（`*_rounds`、`llm_call_count`）+ `/api/funnel`。

## 7. 验收标准

- [ ] 能实时看完整条链 14 节点跑完，过程有节奏、好看。
- [ ] 任一节点可展开看清其**结构化输入/输出字段**（且能切原始 JSON）。
- [ ] 条件分支（门禁分流 / 回炉 / 补证据重入 / fan-in）在图上可见且高亮实际走向。
- [ ] 门禁 10 维分数、enrich 前后 diff、机会加权明细、risk_tier 代码判定都**字段级可见**。
- [ ] 降级 / 违规 / 不达标 / blocked / 回炉 等异常被**醒目标记**，点开能看原因——「问题在哪一步」一眼可定位。
- [ ] 3 个断点 payload 原样可见并可应答（或显示自动应答）。

> 建议先用 `mode=replay` + `interactive=false`（`tests/replay_cache_glm51/` 缓存）把整条链一镜到底跑顺，再做交互式 `mock` 模式。

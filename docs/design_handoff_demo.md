# Claude Design 交接包 ② — 过程演示 / 流水线透视台

> 用法：把**本文件**拖给 Claude Design；同时附上 `docs/design_handoff_sample_state.json`（真实数据）。先做 Hero（实时流水线），满意后再扩展节点检视/计数栏。
> 完整需求见 `docs/frontend_demo_ui.md`；事件/字段见 `docs/frontend_api.md` §3–§5。

---

## 一、可直接粘贴的 Kickoff Prompt

```
你是资深可视化设计师 + 前端工程师。为「EvoPM Agent — 流水线透视台」做高保真界面，用于现场演示多智能体执行过程并定位问题。

【一句话】把一个 14 节点的 LangGraph 多智能体流水线（信号→过滤聚类→竞品/技术调研→质量门禁→机会评分→研发执行→对抗审查→人工介入→报告）实时可视化。核心张力：酷炫，但过程清晰、字段必须明文可读——动画服务于「看清过程」，不是噪音。

【本次只做 HERO 屏】实时流水线主舞台：
- 14 节点的有向图(DAG)，按执行顺序布局；当前活跃节点脉冲点亮，边上有数据流动动效。
- 每个节点卡显示：节点名 + agent 名 + 一行结论摘要 + 耗时，例如「quality_gate · RequirementAgent.draft · total=61 gate=needs_enrich · 8.3s」。
- 把条件分支画出来并高亮实际走向：门禁分流(enrich/clarify/opportunity/report)、Critic 回炉(redo)、补证据重入(→research 再回 critic)、首轮两个 research 节点并行后 fan-in 到 quality_gate。
- 异常用醒目 badge：降级 mock://(琥珀)、闭包违规(红)、门禁不达标(黄/红)、blocked(锁)、回炉(紫回环)。
- 顶部/侧栏小计数：信号→过滤→簇→焦点 漏斗；enrich_rounds/clarify_rounds/redo_rounds(当前/上限1)；llm_call_count(当前/30)；run_mode。

【数据】用附件 design_handoff_sample_state.json 的真实字段。节点结论摘要可由对应字段拼出（如 quality.total/gate、execution.blocked、competitor verdict）。不要 lorem ipsum。

【视觉】见下方「视觉 Token」。深色科技感 + 高对比强调色；字段值用等宽字体。动效要可暂停/可关闭，方便静态查看。

【技术】单文件 React + Tailwind；图标 lucide-react；流水线图用 React Flow（或手写 SVG DAG）；图表用 Recharts；mock 数据内联，无需后端；自包含可预览；动画用 framer-motion 或 CSS。

先产出 HERO 屏（静态布局 + 一个「播放」按钮模拟节点依次点亮）。完成后我会让你扩展：节点检视面板(点节点看输入切片+输出结构化字段+原始JSON双视图) 与 断点交互面板。
```

## 二、视觉 Token（科技感）

- **主题**：深色。背景 `#0B0E14`/面板 `#11161F`/卡 `#161C28`，边框 `#232A36`。
- **状态色**：进行中/活跃 青 `#22D3EE`；成功 翠 `#34D399`；警告 琥珀 `#FBBF24`；错误/违规 玫红 `#FB7185`；回炉/重入 紫 `#A78BFA`。
- **文本**：主 `#E5E7EB` / 次 `#9CA3AF` / 弱 `#6B7280`。
- **字体**：UI 用 Inter；**字段值/JSON 用 JetBrains Mono / 等宽**。
- **节点**：圆角矩形，活跃态发光描边 + 脉冲；完成态翠色勾；待执行态低饱和。边：贝塞尔曲线 + 流动虚线动画。
- **图表**：门禁 10 维用横向分数条（blocker 维标注）；漏斗分段；计数器用环形/进度条。

## 三、组件清单

DAG 流水线图(节点 + 条件分支边)、节点卡(名/agent/摘要/耗时)、节点检视抽屉(结构化字段表 + JSON 双视图切换)、状态徽章(降级/违规/不达标/blocked/回炉/`[未确认]`)、计数器组(漏斗/rounds/budget)、断点面板(payload 展示 + resume 表单)、时间轴/步进控制(播放/暂停/逐步)、10 维分数条、diff 视图(enrich 前后)。

## 四、要明文显示的关键字段（按节点）

- intake：每条 signal 的 category/sentiment/actionability/duplicate_of/data_quality（表格，过滤项与重复项标色）。
- discovery：簇 + signal_ids(闭包是否合法) + duplicate_of_existing(DUPLICATE)。
- research：research_question → finding(verdict/maturity/evidence_strength)，`source_url=mock://*` 标降级。
- quality_gate：10 维 score + rationale，blocker 维标注，代码判定 gate。
- enrich：前后 diff（新增 acceptance_criteria/non_goals/boundary + total 61→86）。
- opportunity：score×weight 加权明细 → total → priority。
- engineering：code_impact(is_core_module/risk_tier 代码判定)、blocked、impl_plan 每步 verify。
- critic：findings(overreach/inference_only 标红)、闭包 violations、pending_confirmations、redo_target。

## 五、状态清单（问题定位用，别漏）

降级 `mock://`、闭包违规/悬空引用、门禁不达标(哪几维低)、回炉(redo_rounds)、补证据重入(research_reentry/more_evidence_rounds)、`execution.blocked`、预算逼近 30/`error` 事件、被驳回(`action=reject`)、观察项(`demote_to_observation`)。每个都要可点开看「为什么/在哪一步」。

## 六、迭代计划（建议顺序）

1. **Hero**：实时流水线 DAG + 播放动画 + 计数侧栏（静态数据 + 模拟点亮）。
2. 节点检视抽屉（结构化字段表 + JSON 双视图）。
3. 断点交互面板（3 个 interrupt payload + resume）。
4. 异常定位高亮全套 + 时间轴回看。

> 每轮 1–2 个模块，沿用第①轮 Token；强调「酷炫但字段明文、可暂停查看」。

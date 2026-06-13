# Claude Design 交接包 ① — 产品级决策网页

> 用法：把**本文件**拖给 Claude Design；同时附上 `docs/design_handoff_sample_state.json`（真实数据）与 `docs/sample_reports/executive_summary.md`、`opportunity_report.md`（真实内容）。先做 Hero 屏，满意后再扩展。
> 完整需求见 `docs/frontend_product_ui.md`。

---

## 一、可直接粘贴的 Kickoff Prompt

```
你是资深产品设计师 + 前端工程师。为「EvoPM Agent — 产品需求决策工作台」做高保真界面。

【产品一句话】把分散的用户反馈/GitHub issue，经多智能体分析，产出有证据支撑的「产品机会与研发执行建议」。本界面给产品经理/团队看，重审美、可信度、决策导向。

【本次只做 HERO 屏】焦点需求详情页：
- 顶部：需求标题 + 优先级徽章(P0) + 门禁状态(PASS)。
- 核心亮点：质量评分「初评 vs enrich 后」对比 —— 10 维雷达图叠加两条 + 大号 total 从 61 滚动到 86（这是本产品的高光，要最抢眼）。
- 主体：痛点/背景/目标用户、用户故事、验收标准；每条上的 evidence_refs 是可点击标签，点开弹出证据卡（原文摘录+来源+强度）。
- 侧栏：该需求的竞品依据(verdict 分组) + 技术方案(成熟度)摘要。

【数据】用附件 design_handoff_sample_state.json 里的真实字段渲染（focus_candidate / quality_history / competitor_findings / tech_findings / evidence）。不要用 lorem ipsum。

【视觉】见下方「视觉 Token」。气质：Linear / Notion / Vercel 后台——克制、现代、强排版、留白；浅色为主；单一强调色；动效克制（仅数字滚动、雷达过渡、证据弹层）。

【技术】单文件 React + Tailwind；图标用 lucide-react；图表用 Recharts（雷达图）；mock 数据内联，无需后端；自包含可直接预览。

先产出 HERO 屏。完成后我会让你扩展到：概览仪表盘、问题簇总览、机会评分/路线图、研发执行、报告中心。
```

## 二、视觉 Token（把「像 Linear」落地）

- **主题**：浅色为主（背景 `#FAFAFA`/纯白卡 `#FFFFFF`）。
- **强调色**：靛蓝单色 `#4F46E5`（hover `#4338CA`）；成功 `#059669`、警告 `#D97706`、危险 `#DC2626`（仅状态用，克制）。
- **中性色阶**：`#0A0A0A` 文本主 / `#525252` 次 / `#A3A3A3` 弱 / `#E5E5E5` 边框。
- **字体**：Inter（或系统 sans）；字阶 12/14/16/20/28/40；标题紧字距、正文 1.6 行高。
- **间距/圆角**：8pt 栅格；卡片圆角 `12px`、细边框 `1px #E5E5E5`、极轻阴影。
- **图表**：雷达(Recharts RadarChart)双 series（初评浅、终评强调色）；漏斗用横向分段；优先级用色块标签。
- **徽章**：优先级 P0=强调色实心、P1/P2/P3 渐弱；gate PASS=成功色描边；`[未确认]`=灰色斜体降饱和。

## 三、组件清单

卡片(KPI/簇/发现)、徽章(优先级/gate/verdict/成熟度/`[未确认]`)、雷达图、横向漏斗、Now·Next·Later 看板列、数据表(机会评分/任务卡)、证据卡弹层(popover)、Markdown 阅读视图(报告)、左侧导航 + 顶部上下文条、分组筛选器。

## 四、状态清单（别漏）

- 决策状态：gate `pass`/`needs_enrich`/`route_support`；优先级 P0–P3/Support/Research/Duplicate。
- 证据强度：strong/moderate/weak/no_direct/inference_only（弱证据视觉降级）。
- `[未确认]`：`human_decisions.action=reject` 的对象加前缀并降饱和；`demote_to_observation` 移入「观察项」分区。
- 降级来源：`source_url` 前缀 `mock://` → 小字「本地материал」标注（低调，不喧宾夺主）。
- 空/加载/错误态（虽是 demo，hero 屏给出加载骨架即可）。

## 五、迭代计划（建议顺序）

1. **Hero**：焦点需求详情（含 58→86 雷达对比 + 证据弹层）。
2. 概览仪表盘（执行摘要 + 漏斗 KPI）。
3. 问题簇总览（DUPLICATE 标记）。
4. 机会评分表 + Now/Next/Later 看板。
5. 研发执行（代码影响面核心模块⚠ + 任务卡 + 风险）。
6. 报告中心（4 份精排阅读）。

> 每轮只让它做 1–2 屏，带真实数据；统一沿用第①轮定下的 Token 与组件，保证设计一致。

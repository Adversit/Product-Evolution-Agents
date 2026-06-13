# 样例报告（glm-5.1 主链产出）

EvoPM Agent 用主链模型 `glm-5.1` 跑通一次完整 mock 全链后产出的 4 份报告样例，供评审/对照参考。

- 数据：`data/demo_kb/`（RAGFlow「文件上传与问答质量」模块，27 条信号）
- 剧情：漏斗 27→5 过滤→3 簇→1 焦点；质量门禁 **61 → 86**（enrich 后 PASS）；`execution.blocked=False`
- 模型：`glm-5.1`（开发期可用 `glm-4.5-air`）

| 文件 | 内容 |
|---|---|
| `executive_summary.md` | 管理层一页纸：问题 → 证据 → P0 建议 → 投入预估（焦点需求核心投入）→ 风险 |
| `opportunity_report.md` | 产品机会报告（评审版）：漏斗统计 / 问题簇 / 焦点需求质量前后对比 / 竞品分组 / 机会评分 / Now·Next·Later / 证据卡 |
| `engineering_report.md` | 研发执行报告：代码影响面（核心模块⚠）/ 修改建议 / 任务卡 / 实施计划 / 测试建议 / Changelog / 风险与待确认 |
| `prd_draft.md` | PRD 草稿：背景 / 目标用户与痛点 / 用户故事 / 范围 / 非目标 / 边界 / 验收标准 / 证据映射 |

> 可离线重生成：用 `tests/replay_cache_glm51/` 缓存 + `EVOPM_MODEL=glm-5.1` 跑 replay 模式（见该目录 README）。

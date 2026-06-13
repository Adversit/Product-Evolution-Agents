# EvoPM Agent

基于 LangGraph 的多智能体产品需求决策系统（黑客松 Demo）。多源信号导入 → 可行动性过滤 → 聚类 → 竞品/技术调研 → 需求质量门禁 → 机会评分分流 → 研发执行建议 → 对抗式审查 → 分级人工介入 → 报告产出。

> 这是 Demo，不是产品级系统。设计取向：演示路径可靠 > 工程完备。详见 `CLAUDE.md` 与 `docs/`。

## 快速开始

```bash
uv sync                          # 安装依赖
cp .env.example .env             # 填入 ZHIPUAI_API_KEY

evopm run --mock                 # mock 模式全链运行
evopm run --replay               # 离线重放（演示兜底）
evopm run                        # live 模式（真实 GitHub API + web_search）
pytest tests/                    # 规则单测 + replay 冒烟
```

## 文档

开发以 `docs/` 下四份文档为准（优先级从上到下）：`spec.md`（技术合同）、`tasks.md`（任务卡）、`plan.md`（分支与集成）、`EvoPM_Demo_MVP_PRD_V1.0.md`（需求范围）。

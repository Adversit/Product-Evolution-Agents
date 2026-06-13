# EvoPM Agent

## 项目介绍

EvoPM Agent 是一个基于 LangGraph 的多智能体产品需求决策系统（黑客松 Demo）。它把分散的用户反馈与 GitHub issues 等多源信号，经过一条带「淘汰/分流出口」的需求漏斗，转化为有证据支撑的产品机会与研发执行建议：

```text
多源信号导入 → 可行动性过滤 → 聚类 → 历史需求查重 → 竞品/技术调研
→ 需求质量门禁 → 机会评分分流 → 研发执行建议 → 对抗式审查 → 分级人工介入 → 报告产出
```

核心设计原则：

- **人工介入分级**：低风险结论自动通过，中风险进待确认清单，高风险强制人工确认；系统只输出建议文档，**永不产出代码改动**。
- **需求漏斗有出口**：每一级过滤/查重/分流都有记录并在报告中展示。
- **证据闭包**：所有结论引用的 evidence id 都由代码校验必须指向真实上游对象，非法引用剔除并交对抗式审查。
- **稳定运行兜底**：LLM 指数退避重试、结构化输出校验重试、磁盘缓存 + `--replay` 离线重放、外部依赖失败自动降级 mock。

> 这是 Demo，不是产品级系统。设计取向：演示路径可靠 > 工程完备。不做鉴权、多租户、计费、生产写操作。详见 `CLAUDE.md` 与 `docs/`。

技术栈：Python ≥ 3.11 · LangGraph · langchain-openai · Pydantic v2 · Typer/Rich · Jinja2。LLM 用智谱 GLM Coding Plan（OpenAI 兼容订阅端点 `…/api/coding/paas/v4/`），主链 `glm-5.1`，开发调试用轻量的 `glm-4.5-air`。

## 安装

需要 Python ≥ 3.11，推荐用 [uv](https://docs.astral.sh/uv/) 管理依赖。

```bash
# 1. 克隆
git clone https://github.com/Adversit/Product-Evolution-Agents.git
cd Product-Evolution-Agents

# 2. 安装依赖（含开发依赖 pytest）
uv sync --extra dev          # 仅运行可省略 --extra dev

# 3. 配置密钥
cp .env.example .env         # 填入 ZHIPUAI_API_KEY（GITHUB_TOKEN 可选）
```

`.env` 永远不入库。`runs/`（报告输出、state dump、LLM 缓存）同样不入库。

## 使用

全链已实现：14 节点的 LangGraph 编排（信号导入 → 过滤聚类 → 竞品/技术调研 → 质量门禁 → 机会评分 → 执行建议 → 对抗审查 → 分级人工介入 → 报告），含 3 个人工确认断点与 mock/replay 降级兜底。

```bash
# 运行测试（规则单测 + 证据闭包 + 降级 + 渲染 + graph 冒烟）
pytest tests/

evopm run --mock                 # mock 模式：跳过 GitHub API 与 web_search，全用本地材料
evopm run --replay               # 离线重放：LLM 全走缓存（断网演示兜底）
evopm run                        # live 模式：真实 GitHub API + web_search
evopm run --model glm-4.5-air  # 指定开发期轻量模型
evopm run --data data/demo_kb    # 指定数据目录
evopm init                       # 交互式问答生成 data/<name>/product.yaml
```

> **运行真实链路需要 `ZHIPUAI_API_KEY`**（`--mock` 也要，只是跳过 GitHub/web_search）。无 key 时 `pytest tests/` 仍全绿——需要真实 LLM 的 fixture 会自动 skip。

开发与测试遵循 **先 mock 跑通、再接真实 API** 的顺序：先用 `data/demo_kb/` 的本地 mock 数据 + `--mock` + `glm-4.5-air` 跑通全链，稳定后再逐项接真实 GitHub API → web_search → `glm-5.1`。

## 测试

```bash
pytest tests/        # 本机若禁访问全局 temp，可加 --basetemp=runs/_pytmp
```

无 key 时：规则、证据闭包、LLM 重试/缓存/预算、调研降级、报告渲染、HITL 解析、graph 编译与 `test_loop_caps`/`test_degrade` 均通过；需要真实 LLM 的 agent fixture 与 `test_replay_e2e` 自动 skip，放入 key 后即可解封运行。

## 文档

开发以 `docs/` 下四份文档为准（优先级从上到下）：`spec.md`（技术合同：schema/State/Agent 契约/规则/执行边界）、`tasks.md`（任务卡）、`plan.md`（分支划分与集成顺序）、`EvoPM_Demo_MVP_PRD_V1.0.md`（需求范围）。

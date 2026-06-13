# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目定位（必读）

EvoPM Agent：黑客松 Demo —— 基于 LangGraph 的多智能体产品需求决策系统。**这是 Demo，不是产品级系统**：

- ❌ 不做：鉴权、多租户、分发部署、计费、企业权限、生产环境写操作。
- ✅ 必须做（稳定运行兜底）：LLM 429/超时指数退避重试；结构化输出校验失败自动重试一次；LLM 响应磁盘缓存 + `--replay` 离线重放（对抗现场断网）；外部依赖（GitHub API / web_search）失败自动降级 mock；证据引用代码侧校验。
- 设计取向：演示路径可靠 > 工程完备。

## 开发与测试顺序（必须遵守）

**先 mock 跑通，再真实 API 测试。** 任何模块和全链都遵循此顺序：

1. 先用 `data/demo_kb/` 的本地 mock 数据 + `--mock` 模式（跳过 GitHub API 与 web_search）+ 开发期模型 `glm-4.5-air`，把功能/全链跑通并通过 fixture 验收。
2. mock 全链稳定（含门禁 58→86 剧情可复现）后，才按 `docs/plan.md` 的增强层顺序逐项接真实数据：① 真实 GitHub API → ② GLM web_search → ③ `glm-5.1` 全链。
3. 每接一项真实数据若卡住 >1h，立即回退 mock，保证始终有可演示版本。

**Why:** 真实 API 有限流、网络、密钥成本和不确定性；先用确定性的 mock 把逻辑/编排/schema 跑顺，能把调试和 API 问题解耦，避免在不稳定的外部依赖上反复烧时间。

## 文档驱动开发（必须遵守）

开发以 `docs/` 下四份文档为准，**优先级从上到下**：

1. `docs/spec.md` —— 技术合同：schema、State、Agent 契约、规则、文件格式、CLI。**修改任何合同级定义必须先改 spec.md 并 commit 到 main**，禁止在功能分支私自变更。
2. `docs/tasks.md` —— 任务卡（按 worktree 分组 WT-0…WT-7，含验收标准）。
3. `docs/plan.md` —— 分支划分、依赖、集成顺序、里程碑。
4. `docs/EvoPM_Demo_MVP_PRD_V1.0.md` —— 需求范围（做什么/不做什么）。

开发模式：git worktree 按模块并行（WT-0 foundation 必须最先合入 main，WT-1…6 并行，WT-7 集成）。每个 session 只负责自己的 WT 任务组。

## 技术栈与关键约束

- Python ≥3.11，LangGraph + langchain-openai + Pydantic v2 + Typer/Rich + Jinja2。
- **LLM：智谱 GLM Coding Plan**，OpenAI 兼容订阅端点 `https://open.bigmodel.cn/api/coding/paas/v4/`（5 小时滚动 token 配额，避免突发并发触发 429）；主链 `glm-5.1`，开发调试用轻量 `glm-4.5-air`。Coding Plan 仅支持 `glm-5.1/glm-5-turbo/glm-4.7/glm-4.5-air` 四个模型。
- 结构化输出必须用 `with_structured_output(method="function_calling")`，**禁止 json_schema 模式**（GLM 不支持）。
- temperature ∈ (0,1)，统一 0.1，**不能取 0**。
- web_search 用 GLM 内置工具（`extra_body` tools type=web_search，search_pro）。

## 密钥与文件管理（必须遵守）

- `ZHIPUAI_API_KEY`、`GITHUB_TOKEN`（可选）只放 `.env`；`.env` 永远在 `.gitignore` 中，**严禁 commit**；变更环境变量时同步更新 `.env.example`（不含真实值）。
- `runs/`（报告输出、state dump、LLM 缓存）不入库。

## 核心设计原则

1. **人工介入分级**：低风险结论自动通过；中风险进待确认清单；高风险（涉及核心模块/不确定影响面）强制人工确认。**系统只输出建议文档，永不产出代码改动（无 Patch/PR）**。
2. **需求漏斗有出口**：可行动性过滤 → 查重 → 历史需求去重 → 质量门禁 → 优先级分流，每级都有淘汰/分流记录并在报告展示。
3. **证据闭包**：所有 evidence_refs 必须指向真实存在的上游 id，节点输出后代码校验，非法引用剔除并记入 Critic 输入。

## 版本管理（必须遵守）

- 每完成一个独立的功能、修复或文档变更，及时 `git add` + `git commit`，不要积累大量未提交的改动。
- Commit message 使用简洁的祈使句描述改动内容；一次 commit 只做一件事。
- 推送到远程：`git push -u origin main`（首次），之后 `git push`。
- 模块开发使用 git worktree 分支（命名 `feat/<wt-name>`，见 `docs/plan.md` §2），完成后合并回 `main`，其余分支及时 rebase。
- 删除、重构等破坏性操作前，确认当前工作区是干净的（`git status`），以便随时回退。

## 常用命令（代码落地后生效）

```bash
uv sync                          # 安装依赖
evopm run --mock                 # mock 模式全链运行
evopm run --replay               # 离线重放（演示兜底）
evopm run                        # live 模式（真实 GitHub API + web_search）
pytest tests/                    # 规则单测 + replay 冒烟
```

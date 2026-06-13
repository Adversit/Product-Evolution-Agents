# EvoPM Agent — 开发计划（plan.md）

**版本：** V1.0 | **上游：** `EvoPM_Demo_MVP_PRD_V1.0.md`、`spec.md` | **下游：** `tasks.md`
**开发模式：** 文档驱动 + git worktree 按模块并行。每个 worktree 由独立 Claude Code session 按 `tasks.md` 中对应任务组开发，**以 `spec.md` 为合同**，禁止跨分支修改合同级定义（schemas/state/接口签名）——需要改合同时先改 `spec.md`、commit 到 main、各分支 rebase。

---

## 1. 模块依赖图

```text
                ┌─────────────────────────────────────┐
                │  WT-0 foundation（必须最先合入 main）  │
                │  schemas.py / state.py / llm.py /    │
                │  config.py / mock 数据全套 / 骨架      │
                └─────────────────┬───────────────────┘
       ┌──────────┬──────────┬────┴─────┬──────────┬──────────┐
       ▼          ▼          ▼          ▼          ▼          ▼
  WT-1 intake  WT-2      WT-3       WT-4       WT-5       WT-6
  +discovery   research  require-   engineer-  report     hitl+cli
  +github源    (竞品/技术) ment+      ing+critic (4模板+    (3 interrupt
               +websearch strategy              render)    +init)
       └──────────┴──────────┴────┬─────┴──────────┴──────────┘
                                  ▼
                │  WT-7 integration（graph.py 组装 +    │
                │  端到端调试 + smoke test + 演示彩排）   │
```

- WT-1…WT-6 **互相无依赖，可完全并行**：彼此只通过 `spec.md` 定义的 schema 和函数签名交互。
- 每个 agent 分支自带「迷你 fixture 测试」：用手写的输入对象调用自己的 agent，不依赖其他分支。

## 2. Worktree 分支划分

| Worktree | 分支名 | 范围（文件） | 依赖 | 预估 |
|---|---|---|---|---|
| WT-0 foundation | `feat/foundation` | pyproject、.env.example、.gitignore、`schemas.py`、`state.py`、`llm.py`、`config.py`、`data/demo_kb/*` 全套 mock 数据、`agents/base.py`、`tests/test_gate_rule` 等规则单测 | 无 | 0.5 天 |
| WT-1 signals | `feat/signals` | `agents/intake.py`、`agents/discovery.py`、`sources/github.py`、对应 prompts | WT-0 | 0.5 天 |
| WT-2 research | `feat/research` | `agents/research.py`（双模式）、web_search 降级链、对应 prompts | WT-0 | 0.5 天 |
| WT-3 decision | `feat/decision` | `agents/requirement.py`（draft_and_score+enrich）、`agents/strategy.py`（score+design）、5.1/5.2 规则函数、对应 prompts | WT-0 | 0.5–1 天 |
| WT-4 execution | `feat/execution` | `agents/engineering.py`、`agents/critic.py`、5.3 风险分级、对应 prompts | WT-0 | 0.5 天 |
| WT-5 report | `feat/report` | `report/render.py`、4 个 Jinja2 模板、证据卡渲染、`[未确认]` 规则 | WT-0 | 0.5 天 |
| WT-6 hitl-cli | `feat/hitl-cli` | `hitl.py`（3 个 interrupt 的渲染与解析）、`cli.py`（init/run/--mock/--replay） | WT-0 | 0.5 天 |
| WT-7 integration | `feat/integration`（或直接在 main） | `graph.py`、`tests/test_smoke.py`、端到端调参（门禁 58→86 校准）、缓存 fixture、彩排 | WT-1…6 全部合入 | 0.5–1 天 |

**worktree 操作约定**：

```bash
git worktree add ../pea-foundation feat/foundation   # 从 main 切出
# 完成后：PR 或本地 merge 回 main → 其余分支 git rebase main
git worktree remove ../pea-foundation
```

## 3. 集成顺序与验收点

| 序 | 动作 | 验收点 |
|---|---|---|
| 1 | WT-0 合入 main | `pytest tests/`（规则单测过）；`python -c "from evopm.schemas import *"`；mock 数据文件齐全 |
| 2 | WT-1…WT-6 并行开发，各自 rebase main 后合入（顺序不限，建议 1→3→4→2→5→6） | 各分支自带 fixture 测试过；不改动 WT-0 合同文件（CI 可用 `git diff --name-only main` 检查） |
| 3 | WT-7：graph.py 组装 | `evopm run --mock` 全链跑通（flash 模型），3 个 interrupt 可交互 |
| 4 | 门禁剧情校准 | 初评 55–62、enrich 后 ≥80，连续 3 次复现 |
| 5 | 增强联调（按序）：真实 GitHub API → web_search 实测 → glm-5.1 全链 | 各项失败可自动降级 mock；卡住 >1h 回退 |
| 6 | 缓存 + `--replay` + smoke test | 断网状态下完整演示通过 |
| 7 | 彩排 ≥3 次 | ≤3 分钟，零故障 |

## 4. 里程碑（保底层 → 增强层）

| 里程碑 | 内容 | 中断时的可演示物 |
|---|---|---|
| M-A（保底） | WT-0 + WT-1 + 简版报告 | 「多源信号导入 → 过滤 → 聚类 + 证据引用」 |
| M-B（主链） | + WT-2 mock 模式 + WT-3 | 十步演示前七步（含门禁高光） |
| M-C（闭环） | + WT-4 + WT-5 + WT-6 + WT-7 集成 | 十步全通（mock 数据） |
| M-D（真实化） | 真实 GitHub issues + web_search + glm-5.1 | 真实数据演示 |
| M-E（可靠性） | --replay + 彩排 | 断网兜底、3 分钟话术 |

里程碑映射 2 天节奏：D1 上午 M-A、D1 下午 M-B、D2 上午 M-C、D2 下午 M-D+M-E。多 session 并行时 M-A/M-B/M-C 可压缩至 D1。

## 5. 风险与应对

| 风险 | 应对 |
|---|---|
| 并行分支改坏合同 | 合同文件（schemas/state/llm 签名）只在 WT-0 和 spec.md 变更流程中修改；合入前 diff 检查 |
| 门禁剧情不稳定 | feedback.csv 刻意缺验收标准；BLOCKER_DIMS 代码规则；temperature=0.1；WT-7 预留校准时间 |
| GLM flash 并发 429 | 调研双节点并行度=2，退避重试；开发期可串行跑 |
| web_search/GitHub API 不可用 | 降级链是合同的一部分（spec §6/§7），所有外部调用必须实现降级 |
| 评审 interrupt 状态丢失 | MemorySaver 单进程内完成全流程；CLI 不退出进程 |
| 集成时 prompt 互相冲突（如证据 id 格式） | id 格式约定在 spec §2 顶部，所有 prompt 模板引用同一段「证据引用规则」公共片段（prompts/_evidence_rules.md，WT-0 提供） |

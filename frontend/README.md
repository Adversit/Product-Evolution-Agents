# EvoPM Agent · 流水线透视台 (Pipeline Observatory)

![EvoPM Pipeline Observatory](../docs/assets/observatory.gif)

Dark-tech, real-time visualization of the 14-node LangGraph multi-agent pipeline
(信号 → 过滤聚类 → 竞品/技术调研 → 质量门禁 → 机会评分 → 研发执行 → 对抗审查 → 人工介入 → 报告).

Implemented from the Claude Design handoff `EvoPM Pipeline Observatory.dc.html`
(see `design-reference/`). Visual tokens and field requirements come from
`docs/frontend_demo_ui.md` and `docs/claude_design/demo/design_handoff_demo.md`.

## 完成度 / Status

The delivered design file was the **Hero only**. This build implements the Hero
plus the brief's iteration #2 (node-inspection drawer). Mapped against the full
4-iteration plan in `design_handoff_demo.md` §六:

| 简报迭代计划 | 状态 |
|---|---|
| ① Hero — 实时 DAG + 播放动画 + 计数/异常侧栏 | ✅ 完成 |
| ② 节点检视抽屉 — 结构化字段表 + 原始 JSON 双视图 | ✅ 完成 |
| ③ 断点交互面板 — 3 个 interrupt payload 原样展示 + resume 应答 | ⬜ 未实现 |
| ④ 异常定位高亮全套 + 时间轴回看 | ◑ 部分（异常点击定位/环高亮 ✅；时间轴 scrubber ⬜） |
| 后端联调 — `/ws` 事件 + `/api/state` + `/api/funnel` | ✅ 已接入（实时 + 离线样例兜底，见下方 Live backend） |

**一句话：** 对照交付的设计稿与选定范围（Hero + 节点抽屉）是完整的，并已接入真实
后端（DAG 由真实 `node` 事件点亮，抽屉/侧栏读 `/api/state`）；③ 断点面板、④ 时间轴
回看仍是下一步工作。

## Live backend

The app now connects to the live EvoPM backend (**evopm-server**, FastAPI, default
`http://127.0.0.1:8000`; see `docs/frontend_api.md`):

- DAG node lighting is driven by real `/ws` `node` events (14 nodes in execution
  order). Each node card shows the backend's real `summary` / `elapsed`.
- On `done`, the app pulls `/api/state` (full `EvoPMState` + a `derived` block) and
  populates the node-inspection drawer and the sidebar funnel / rounds / budget /
  anomaly panels from real state.
- Header shows a **connection indicator** (`live` / `replay` / `连接中` / `离线样例`)
  and a **重新运行** button (`POST /api/run` then re-streams `/ws`).
- **Graceful fallback:** if the server is unreachable the app falls back to the
  embedded `src/data/sample_state.json` snapshot + the fake play timer, and labels
  itself **离线样例 / offline sample**. It never shows a blank screen.

Override the backend URL with `VITE_API_BASE` (see `.env.example`).

### Run both together

```bash
# 1) backend (repo root) — boots having already auto-run one replay
uvicorn evopm.server:app --port 8000      # or however evopm-server is launched

# 2) frontend (this dir)
cd frontend
npm install
npm run dev      # http://localhost:5173 — auto-connects to :8000
```

## Run

```bash
cd frontend
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production bundle into dist/
npm run preview  # serve the production build
```

## What it shows

- **14-node serpentine DAG** wired to real fields from a glm-5.1 replay run
  (`src/data/sample_state.json`). Each node card shows its name, agent, one-line
  conclusion, duration, and a rich mini-metric (e.g. `quality_gate` carries the
  10-dim score bar R1 61 → R2 86).
- **Conditional branches & loops drawn and labeled** — parallel competitor/tech
  research fanning into the gate, the `needs_enrich → re-eval` loop, the `pass`
  wrap to opportunity, plus the un-taken `clarify` / `redo` / `more_evidence`
  ghost paths (violet dashed).
- **Play simulation** — ▶/⏸ / step / reset / speed (0.5/1/2×) / animation toggle.
  Nodes light up in execution order; edges flow as dashed comets; everything is
  pausable for static field reading.
- **Counter sidebar** — funnel (27→24→3→1), enrich/clarify/redo rounds, LLM
  budget ring (0/30, replay), and a click-to-locate anomaly list that rings the
  offending node.
- **Node-inspection drawer** — click any node to open a structured field view
  (signals table, gate dimension bars, enrich before/after diff, opportunity
  weighting, code-impact risk tiers, critic findings, HITL confirmations …) with
  a **结构化 ↔ 原始 JSON** toggle backed by the real state slice.

## Structure

```
src/
  App.tsx                  shell + live→pipeline bridge (node events drive the DAG)
  hooks/usePipeline.ts     play/step/speed/anim state machine (+ syncTo for live)
  lib/
    api.ts                 backend client (startRun/fetchState/fetchFunnel/openEventStream)
    live.tsx               LiveProvider context: connection, state, node lighting, rerun
    nodeMap.ts             backend node name → frontend card id + DAG step
    graph.ts               node + edge graph definition (ported from the design)
    pipeline.ts            phaseOf() + edgePath() bezier routing
    theme.ts               dark-tech palette + chip styles
  components/
    Header.tsx              controls + connection indicator + 重新运行 button
    Stage.tsx  NodeCard.tsx live summary/elapsed overlay on each card
    Sidebar.tsx             funnel/rounds/budget/anomaly from live state (+derived)
    NodeDrawer.tsx          drawer shell + structured/JSON toggle (reads live state)
    inspectors.tsx          per-node structured field views (state injected)
  data/
    state.ts                typed view over the run state (embedded fallback)
    sample_state.json       real glm-5.1 replay data — offline fallback only
```

## Notes

- **Primary data source = the live API**; the embedded `sample_state.json` is a
  labeled offline fallback only. The DAG geometry, colors, animations, and base
  node copy are ported 1:1 from the design file; live `node` events overlay the
  real per-node `summary` / `elapsed` on top.
- The node-inspection drawer is the brief's iteration #2, built on the same tokens,
  and now renders live `/api/state` when connected.

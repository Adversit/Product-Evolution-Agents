# EvoPM Agent · 流水线透视台 (Pipeline Observatory)

Dark-tech, real-time visualization of the 14-node LangGraph multi-agent pipeline
(信号 → 过滤聚类 → 竞品/技术调研 → 质量门禁 → 机会评分 → 研发执行 → 对抗审查 → 人工介入 → 报告).

Implemented from the Claude Design handoff `EvoPM Pipeline Observatory.dc.html`
(see `design-reference/`). Visual tokens and field requirements come from
`docs/frontend_demo_ui.md` and `docs/claude_design/demo/design_handoff_demo.md`.

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
  App.tsx                  shell: header + stage + sidebar + drawer
  hooks/usePipeline.ts     play/step/speed/anim state machine
  lib/
    graph.ts               14-node + 18-edge graph definition (ported from the design)
    pipeline.ts            phaseOf() + edgePath() bezier routing
    theme.ts               dark-tech palette + chip styles
  components/
    Header.tsx  Stage.tsx  NodeCard.tsx  Sidebar.tsx
    NodeDrawer.tsx          drawer shell + structured/JSON toggle
    inspectors.tsx          per-node structured field views
  data/
    state.ts                typed view over the run state
    sample_state.json       real glm-5.1 replay data
```

## Notes

- This is a demo Hero + node drawer. The pipeline data is a static replay sample;
  there is **no backend wiring yet**. The intended live source (per
  `docs/frontend_api.md`) is `/ws` events + `/api/state` + `/api/funnel`.
- The DAG geometry, colors, animations, and node copy are ported 1:1 from the
  design file to stay pixel-faithful; the node-inspection drawer is the brief's
  iteration #2, built on the same tokens.

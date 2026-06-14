# EvoPM · 决策工作台 (Decision Workbench)

A Linear-style, **light-theme** product-decision workbench over a glm-5.1 replay
run — the product-grade companion to the dark `frontend/` Pipeline Observatory.

Implemented from the Claude Design handoff `EvoPM 决策工作台.dc.html`
(`runs/_design_pkg/evopm-product/`). The design landed (chat2) on the **Linear
light theme**: white bg, near-black ink `#1B1C1E`, hairline grays
`#E6E6E4`/`#ECECEA`, off-white sidebar `#FBFBFA`. Lavender `#5E6AD2` is reserved
for the single data series (radar round-2 layer, 终评 dimension bars, 终评
legend/toggle); green `#1A7F37`/`#E9F6EC` is reserved for semantics (gate PASS,
+25 jump, replay status dot). Brand mark / PM avatar / P0·NOW chips are near-black.

## 6 screens

1. **焦点需求 (HERO)** — req-01 detail: header badges, the `61 → 86` highlight card
   (animated score + 初评/终评 toggle + hand-drawn SVG radar + 10-维明细 strip),
   4 Linear-style collapsible modules (痛点与背景 / 用户故事 / 验收标准 / 范围·非目标·边界),
   and the competitor/tech evidence sidebar.
2. **概览仪表盘** — 4 KPI cards + 27→5→9→3→1 决策漏斗 + P0 建议结论.
3. **问题簇总览** — 3 cluster cards (focus ⭐ / DUPLICATE→ex-01 / known) + 5 已过滤信号.
4. **机会评分 · 路线图** — 10-dim weighted bars (总分 86.6) + Now/Next/Later board.
5. **研发执行** — code-impact core modules (⚠ core / risk tiers + verify points),
   待确认模块, 建议实施顺序, 任务卡 (4 of 12), 风险与缓解 (5).
6. **报告中心** — report list (4 reports) + reading pane.

## Interactions

- Left-nav screen switching with active-state styling.
- **HERO entrance**: radar grows in (`t` 0→1) + total rolls `61→86` on mount, with a
  guaranteed 1.5s final-state fallback so a throttled rAF never sticks mid-tween.
- **初评/终评 toggle**: swaps the emphasized radar polygon, re-tweens the score, and
  updates every axis score label.
- **Collapsible modules** with chevron rotation + 展开全部/收起全部 toolbar.
- **Evidence popovers**: every sig/cf/tf chip is clickable → fixed popover with 类型
  badge, ref, 强度 badge, 原文摘录, 来源 (`mock://` flagged as「本地材料 · 证据强度封顶
  moderate」). weak/no_direct refs render downgraded (dashed). Click-outside closes.

## Run

```bash
cd frontend-product
npm install
npm run dev      # http://localhost:5174
npm run build    # tsc --noEmit + production bundle into dist/
npm run preview  # serve the production build
```

## Structure

```
src/
  App.tsx                shell: sidebar + header + screen switcher
  data/state.ts          typed canonical dataset (the .dc.html `D` object)
  lib/theme.ts           light tokens + strength/type/chip/pill style helpers
  hooks/useEntrance.ts   radar-grow + 61→86 roll + round-toggle tween
  components/
    Sidebar.tsx  Header.tsx  Radar.tsx  Evidence.tsx
  screens/
    Hero.tsx  Overview.tsx  Clusters.tsx  Opportunity.tsx
    Engineering.tsx  Reports.tsx
```

## Notes

- The data is a **static replay sample** curated from a glm-5.1 run (inlined in the
  design's `D` object, cross-checked against `uploads/sample_state.json` + the four
  reports). There is **no backend wiring yet**.
- Geometry, colors, copy, and animations are ported faithfully from the design file
  to stay pixel-faithful. Inline styles match the design's inline-styled approach.

## Status

| Screen / interaction | 状态 |
|---|---|
| 焦点需求 HERO — header + highlight card + radar + 10-dim strip | ✅ |
| HERO 4 collapsible modules + 展开/收起全部 | ✅ |
| 初评/终评 toggle (radar + labels + score) | ✅ |
| HERO entrance animation + fallback | ✅ |
| 概览仪表盘 — KPI + 漏斗 + 建议 | ✅ |
| 问题簇总览 — 3 簇 + 已过滤信号 | ✅ |
| 机会评分 · 路线图 — 10-dim bars + Now/Next/Later | ✅ |
| 研发执行 — 影响面/待确认/顺序/任务/风险 | ✅ |
| 报告中心 — 4 reports + reading pane | ✅ |
| Evidence popovers (sig/cf/tf, mock flag, weak downgrade) | ✅ |
| Left-nav switching + active state | ✅ |
| Backend live data (`/ws` + `/api/state`) | ⬜ static replay only |
```

import type { ChipKind } from "./theme";
import { COLORS } from "./theme";

// Canvas geometry — the DAG is authored at this fixed size then scaled to fit.
export const NODE_W = 214;
export const NODE_H = 116;
export const CANVAS_W = 1334;
export const CANVAS_H = 766;

export interface ScoreBar {
  label: string;
  segs: Array<[number, "c" | "a"]>; // [score 0-100, cyan|amber]
}

export interface NodeDef {
  id: string;
  x: number;
  y: number;
  ac: string; // accent color
  kf: string | null; // pulse keyframe name
  label: string;
  agent: string;
  dur: string;
  conclusion: string;
  steps: number[]; // execution step indices this node belongs to
  chips: Array<[string, ChipKind]>;
  bar?: ScoreBar;
  ghost?: boolean;
}

const { active: C, done: E, warn: A, loop: V, ink3 } = COLORS;

// 14 nodes, two-band serpentine layout — ported 1:1 from EvoPM Pipeline Observatory.dc.html.
export const NODES: NodeDef[] = [
  {
    id: "intake", x: 40, y: 170, ac: C, kf: "pulseCyan", label: "intake",
    agent: "IntakeAgent.classify", dur: "2.1s",
    conclusion: "27 条信号分类，3 条 insufficient 过滤为噪声", steps: [0],
    chips: [["27→24", "cyan"], ["3 过滤", "slate"]],
  },
  {
    id: "discovery", x: 300, y: 170, ac: C, kf: "pulseCyan", label: "discovery",
    agent: "DiscoveryAgent.cluster", dur: "3.4s",
    conclusion: "聚为 3 簇，焦点 clu-01（critical · freq=10）", steps: [1],
    chips: [["clu-01 critical", "rose"], ["clu-02 DUP→ex-01", "violet"], ["clu-03 high", "cyan"]],
  },
  {
    id: "competitor_research", x: 560, y: 30, ac: C, kf: "pulseCyan", label: "competitor_research",
    agent: "CompetitorAgent.research", dur: "6.8s",
    conclusion: "Dify ×3：adopt / avoid / watch（cf-03 信息不足）", steps: [2],
    chips: [["adopt", "emerald"], ["avoid", "rose"], ["watch", "amber"], ["mock://dify.md", "amber"]],
  },
  {
    id: "tech_research", x: 560, y: 310, ac: C, kf: "pulseCyan", label: "tech_research",
    agent: "TechAgent.research", dur: "7.2s",
    conclusion: "4 方案：状态机 · 心跳超时 · 错误码 · 分块预览", steps: [2],
    chips: [["reference ×3", "cyan"], ["experimental ×1", "amber"], ["mock://tech_notes", "amber"]],
  },
  {
    id: "quality_gate", x: 820, y: 170, ac: A, kf: "pulseAmber", label: "quality_gate",
    agent: "RequirementAgent · gate", dur: "8.3s",
    conclusion: "R1 total=61 → needs_enrich；补全后 R2 total=86 → pass", steps: [3, 5],
    bar: {
      label: "10 维 · R1 61 → R2 86",
      segs: [[88, "c"], [85, "a"], [86, "a"], [85, "a"], [88, "c"], [84, "c"], [82, "c"], [86, "c"], [88, "c"], [84, "c"]],
    },
    chips: [["R1 needs_enrich", "amber"], ["R2 pass", "emerald"]],
  },
  {
    id: "enrich", x: 1080, y: 30, ac: E, kf: "pulseEmerald", label: "enrich",
    agent: "RequirementAgent.enrich", dur: "5.1s",
    conclusion: "补全 acceptance / non-goals / boundary，total 61→86", steps: [4],
    chips: [["+7 验收", "emerald"], ["+4 非目标", "emerald"], ["+6 边界", "emerald"], ["Δ +25", "cyan"]],
  },
  {
    id: "clarify", x: 1080, y: 310, ac: ink3, kf: null, label: "clarify",
    agent: "RequirementAgent.clarify", dur: "—", ghost: true,
    conclusion: "门禁分流分支 · 本轮未触发（gate≠clarify）", steps: [],
    chips: [["未触发", "slate"]],
  },
  {
    id: "opportunity", x: 40, y: 540, ac: E, kf: "pulseEmerald", label: "opportunity",
    agent: "OpportunityAgent.score", dur: "4.6s",
    conclusion: "10 维加权 total=86.57 → 优先级 P0 · horizon now", steps: [6],
    chips: [["total 86.57", "emerald"], ["P0", "rose"], ["now", "cyan"]],
  },
  {
    id: "roadmap", x: 300, y: 470, ac: C, kf: "pulseCyan", label: "roadmap",
    agent: "RoadmapAgent.plan", dur: "2.0s",
    conclusion: "3 项排期：clu-01 P0/now · clu-03 P1/next · clu-02 dup", steps: [7],
    chips: [["clu-01 P0 now", "rose"], ["clu-03 P1 next", "cyan"], ["clu-02 dup", "slate"]],
  },
  {
    id: "solution", x: 300, y: 610, ac: C, kf: "pulseCyan", label: "solution",
    agent: "SolutionAgent.design", dur: "9.4s",
    conclusion: "9 scope · 5 non-goal · 5 风险 · 5 依赖", steps: [8],
    chips: [["9 scope", "cyan"], ["5 non-goal", "slate"], ["5 风险", "amber"]],
  },
  {
    id: "code_impact", x: 560, y: 470, ac: A, kf: "pulseAmber", label: "code_impact",
    agent: "EngineeringAgent.analyze", dur: "6.1s",
    conclusion: "4 模块受影响 · 3 个核心模块 risk_tier=high", steps: [9],
    chips: [["rag/svr core", "rose"], ["rag/nlp core", "rose"], ["deepdoc core", "rose"], ["api/db low", "slate"]],
  },
  {
    id: "engineering", x: 560, y: 610, ac: E, kf: "pulseEmerald", label: "engineering",
    agent: "EngineeringAgent.execute", dur: "11.7s",
    conclusion: "4 任务 · blocked=false · impl_plan ×4（每步 verify）", steps: [10],
    chips: [["4 任务", "cyan"], ["blocked=false", "emerald"], ["impl ×4", "slate"]],
  },
  {
    id: "critic", x: 820, y: 540, ac: V, kf: "pulseViolet", label: "critic",
    agent: "CriticAgent.review", dur: "5.5s",
    conclusion: "4 findings · cf-03 demote_to_observation · 闭包 0 违规", steps: [11],
    chips: [["4 findings", "violet"], ["1 demote", "violet"], ["闭包 OK", "emerald"], ["redo 0/1", "slate"]],
  },
  {
    id: "human", x: 1080, y: 470, ac: A, kf: "pulseAmber", label: "human",
    agent: "HITL.interrupt", dur: "待确认",
    conclusion: "5 项 pending_confirmations 等待人工确认（核心模块改造）", steps: [12],
    chips: [["pending ×5", "amber"], ["interrupt", "amber"]],
  },
  {
    id: "report", x: 1080, y: 610, ac: E, kf: "pulseEmerald", label: "report",
    agent: "ReportAgent.compose", dur: "—",
    conclusion: "req-01 解析稳定性修复 · P0 · now · 成功率目标 ≥95%", steps: [13],
    chips: [["req-01", "cyan"], ["P0 · now", "rose"]],
  },
];

export type EdgeKind = "h" | "v" | "loop" | "wrap" | "stub";

export interface EdgeDef {
  from: string;
  to: string;
  kind: EdgeKind;
  label: string;
  taken: boolean;
}

// Conditional branches & loops — ported 1:1. `taken=false` renders as the un-taken violet dashed ghost path.
export const EDGES: EdgeDef[] = [
  { from: "intake", to: "discovery", kind: "h", label: "", taken: true },
  { from: "discovery", to: "competitor_research", kind: "h", label: "", taken: true },
  { from: "discovery", to: "tech_research", kind: "h", label: "", taken: true },
  { from: "competitor_research", to: "quality_gate", kind: "h", label: "fan-in", taken: true },
  { from: "tech_research", to: "quality_gate", kind: "h", label: "fan-in", taken: true },
  { from: "quality_gate", to: "enrich", kind: "h", label: "needs_enrich", taken: true },
  { from: "enrich", to: "quality_gate", kind: "loop", label: "re-eval", taken: true },
  { from: "quality_gate", to: "clarify", kind: "h", label: "clarify", taken: false },
  { from: "quality_gate", to: "opportunity", kind: "wrap", label: "pass", taken: true },
  { from: "opportunity", to: "roadmap", kind: "h", label: "", taken: true },
  { from: "roadmap", to: "solution", kind: "v", label: "", taken: true },
  { from: "solution", to: "code_impact", kind: "h", label: "", taken: true },
  { from: "code_impact", to: "engineering", kind: "v", label: "", taken: true },
  { from: "engineering", to: "critic", kind: "h", label: "", taken: true },
  { from: "critic", to: "engineering", kind: "loop", label: "redo", taken: false },
  { from: "critic", to: "tech_research", kind: "stub", label: "more_evidence", taken: false },
  { from: "critic", to: "human", kind: "h", label: "HITL", taken: true },
  { from: "human", to: "report", kind: "v", label: "", taken: true },
];

// Step index → human-readable name (header step label). 14 entries.
export const STEP_NAMES = [
  "intake", "discovery", "research ×2 (并行)", "quality_gate", "enrich",
  "quality_gate (re-eval)", "opportunity", "roadmap", "solution", "code_impact",
  "engineering", "critic", "human (HITL)", "report",
];
export const TOTAL_STEPS = 14;

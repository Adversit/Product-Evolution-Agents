// Adapter: map the live /api/state (+ derived) response onto the SAME view-model
// shape (`DecisionData`) the 6 screens already consume. Goal — keep the screen
// components unchanged by feeding them an adapted object built here.
//
// The backend schema (schemas.py) names/shapes differ from the design's inlined
// `D` object; this module reconciles them field-by-field. Where the backend lacks
// a field the design showed (Chinese dimension labels, funnel-stage notes), we
// fall back to the stable enumerations carried in the static `D` (data/state.ts),
// which is also the offline sample.
import { D } from "./state";
import type {
  AcceptanceCriterion,
  Cluster,
  CodeModule,
  Competitor,
  DecisionData,
  EvidenceEntry,
  EvidenceStrength,
  EvidenceType,
  FilteredSignal,
  OppScore,
  QualityDim,
  RoadmapItem,
  TaskCard,
  Tech,
  UserStory,
} from "./state";
import type { EvidenceCard, LiveState, QualityBlock } from "../lib/api";

type Obj = Record<string, unknown>;

const str = (v: unknown, d = ""): string => (typeof v === "string" ? v : d);
const num = (v: unknown, d = 0): number => (typeof v === "number" ? v : d);
const arr = <T = unknown>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const strList = (v: unknown): string[] => arr<unknown>(v).map((x) => String(x));

// Chinese labels for the 10 quality dimensions and 10 opportunity dimensions are
// stable enumerations — reuse the ones the static design dataset already carries.
const QUAL_DIM_LABELS: Record<string, string> = D.DIM_LABELS;
const OPP_DIM_LABELS: Record<string, string> = Object.fromEntries(D.OPPORTUNITY.scores.map((s) => [s.dim, s.label]));

// Funnel-stage display copy (stage/en/note) is presentation text the backend
// doesn't carry; reuse the design's, overlay live counts.
function adaptFunnel(live: LiveState): DecisionData["FUNNEL"] {
  const f = live.derived?.funnel || {};
  const counts: Record<string, number> = {
    "RAW SIGNALS": num(f.total_signals, D.FUNNEL[0].count),
    FILTERED: num(f.filtered, D.FUNNEL[1].count),
    DEDUPED: num(f.duplicates, D.FUNNEL[2].count),
    CLUSTERS: num(f.clusters, D.FUNNEL[3].count),
    FOCUS: num(f.focus, D.FUNNEL[4].count),
  };
  return D.FUNNEL.map((s) => ({ ...s, count: counts[s.en] ?? s.count }));
}

// Merge a quality block's two rounds into the per-dimension r1/r2 view-model.
function adaptQualityDims(first?: QualityBlock, last?: QualityBlock): QualityDim[] {
  const lastDims = last?.dimensions || [];
  const firstByName = new Map((first?.dimensions || []).map((d) => [d.name, d.score]));
  return lastDims.map((d) => ({
    name: d.name,
    r1: firstByName.get(d.name) ?? d.score,
    r2: d.score,
    rationale: d.rationale,
  }));
}

// "medium — 需要改动…" → "medium". Backend cost_estimate is a free-form string;
// the design's Tech.cost is a low|medium|high enum.
function costEnum(v: unknown): Tech["cost"] {
  const s = str(v).toLowerCase();
  if (s.startsWith("low")) return "low";
  if (s.startsWith("high")) return "high";
  return "medium";
}

const WEAK = new Set(["weak", "no_direct", "inference_only"]);

function adaptCompetitors(live: LiveState): Competitor[] {
  return arr<Obj>(live.competitor_findings).map((c) => {
    const strength = str(c.evidence_strength, "moderate") as EvidenceStrength;
    return {
      id: str(c.id),
      competitor: str(c.competitor),
      verdict: (str(c.verdict, "watch") as Competitor["verdict"]),
      has_solved: typeof c.has_solved === "boolean" ? (c.has_solved as boolean) : null,
      strength,
      demoted: WEAK.has(strength),
      conclusion: str(c.conclusion),
      implication: str(c.implication),
    };
  });
}

function adaptTech(live: LiveState): Tech[] {
  return arr<Obj>(live.tech_findings).map((t) => {
    const strength = str(t.evidence_strength, "moderate") as EvidenceStrength;
    return {
      id: str(t.id),
      name: str(t.solution_name),
      maturity: (str(t.maturity, "reference") as Tech["maturity"]),
      topic: str(t.topic),
      strength,
      demoted: WEAK.has(strength),
      cost: costEnum(t.cost_estimate),
      fit: str(t.fit_reason),
      risk: str(t.risk),
    };
  });
}

function adaptClusters(live: LiveState): Cluster[] {
  // priority/horizon/focus live on the roadmap; join by cluster_id.
  const roadById = new Map(arr<Obj>(live.roadmap).map((r) => [str(r.cluster_id), r]));
  return arr<Obj>(live.clusters).map((c) => {
    const id = str(c.id);
    const road = roadById.get(id);
    const status = str(c.status, "known");
    const dupOf = str(c.duplicate_of_existing) || undefined;
    return {
      id,
      title: str(c.title),
      freq: num(c.frequency),
      severity: (str(c.severity, "high") as Cluster["severity"]),
      status: (status === "duplicate" ? "duplicate" : "known") as Cluster["status"],
      focus: road ? Boolean(road.is_focus) : id === str(live.selected_cluster_id),
      priority: road ? str(road.priority, "P1") : status === "duplicate" ? "Duplicate" : "P1",
      horizon: road ? str(road.horizon, "next") : "next",
      signal_count: arr(c.signal_ids).length,
      categories: strList(c.categories),
      summary: str(c.summary),
      candidate: str(c.candidate_title),
      duplicate_of: dupOf,
      dedup_reason: str(c.dedup_reason) || undefined,
    };
  });
}

function adaptFilteredSignals(live: LiveState): FilteredSignal[] {
  return arr<Obj>(live.derived?.filtered_signals).map((s) => ({
    id: str(s.id),
    actionability: str(s.actionability),
    text: str(s.text),
    followup: str(s.followup_question),
  }));
}

function adaptUserStories(v: unknown): UserStory[] {
  return arr<Obj>(v).map((s) => ({
    role: str(s.role),
    scenario: str(s.scenario),
    benefit: str(s.benefit),
    story_text: str(s.story_text),
    evidence_refs: strList(s.evidence_refs),
  }));
}

function adaptAcceptance(v: unknown): AcceptanceCriterion[] {
  return arr<Obj>(v).map((a) => ({
    type: (str(a.type, "functional") as AcceptanceCriterion["type"]),
    text: str(a.text),
    evidence_refs: strList(a.evidence_refs),
  }));
}

function adaptOpportunity(live: LiveState): DecisionData["OPPORTUNITY"] {
  const o = (live.opportunity || {}) as Obj;
  const scores: OppScore[] = arr<Obj>(o.scores).map((s) => {
    const dim = str(s.dimension);
    return { dim, label: OPP_DIM_LABELS[dim] || dim, score: num(s.score), rationale: str(s.rationale) };
  });
  return {
    total: num(o.total, D.OPPORTUNITY.total),
    priority: str(o.priority, "P0"),
    horizon: str(o.horizon, "now"),
    rationale: str(o.rationale, D.OPPORTUNITY.rationale),
    scores,
  };
}

function adaptRoadmap(live: LiveState): RoadmapItem[] {
  return arr<Obj>(live.roadmap).map((r) => ({
    cluster_id: str(r.cluster_id),
    title: str(r.title),
    priority: str(r.priority, "P1"),
    horizon: str(r.horizon, "next"),
    focus: Boolean(r.is_focus),
    reason: str(r.one_line_reason),
  }));
}

function adaptCodeImpact(live: LiveState): CodeModule[] {
  const ci = (live.code_impact || {}) as Obj;
  return arr<Obj>(ci.items).map((m) => ({
    module: str(m.module_path),
    core: Boolean(m.is_core_module),
    risk: (str(m.risk_tier, "medium") as CodeModule["risk"]),
    level: str(m.impact_level),
    types: strList(m.impact_types),
    desc: str(m.description),
    verify: strList(m.verify_points),
  }));
}

// human_confirmation_needed is a list of strings like "rag/svr（核心模块）：…".
// Split a leading module token off the front for the {module, note} view-model.
function adaptCodeUncertain(live: LiveState): DecisionData["CODE_UNCERTAIN"] {
  const ci = (live.code_impact || {}) as Obj;
  return strList(ci.human_confirmation_needed).map((line) => {
    const m = line.match(/^([\w./-]+)\s*[（(：:]/);
    if (m) {
      const mod = m[1];
      const note = line.slice(mod.length).replace(/^[（(].*?[)）]\s*[：:]?\s*/, "").replace(/^[：:]\s*/, "");
      return { module: mod, note: note || line };
    }
    return { module: "—", note: line };
  });
}

function adaptTasks(live: LiveState): TaskCard[] {
  const ex = (live.execution || {}) as Obj;
  return arr<Obj>(ex.tasks).map((t) => ({
    id: str(t.id),
    type: (str(t.type, "backend") as TaskCard["type"]),
    title: str(t.title),
    risk: (str(t.risk_tier, "medium") as TaskCard["risk"]),
    modules: strList(t.related_modules),
    evidence_refs: strList(t.evidence_refs),
    desc: str(t.description),
  }));
}

const evTypeOf = (ref: string): EvidenceType =>
  ref.startsWith("cf-") ? "competitor" : ref.startsWith("tf-") ? "tech" : "signal";

function adaptEvidence(cards: EvidenceCard[]): Record<string, EvidenceEntry> {
  const out: Record<string, EvidenceEntry> = {};
  for (const c of cards) {
    out[c.ref] = {
      type: evTypeOf(c.ref),
      strength: (c.strength as EvidenceStrength) || "moderate",
      source: c.source || "",
      text: c.excerpt || "",
    };
  }
  return out;
}

// Build a single live EvidenceEntry from an /api/evidence/{ref} response.
export function evidenceFromCard(c: EvidenceCard): EvidenceEntry {
  return {
    type: evTypeOf(c.ref),
    strength: (c.strength as EvidenceStrength) || "moderate",
    source: c.source || "",
    text: c.excerpt || "",
  };
}

export function adaptState(live: LiveState): DecisionData {
  const fc = (live.focus_candidate || {}) as Obj;
  const ex = (live.execution || {}) as Obj;
  const sol = (live.solution || {}) as Obj;
  const pc = (live.product_context || {}) as Obj;
  const first = live.derived?.quality_first;
  const last = live.derived?.quality_last;
  const dims = adaptQualityDims(first, last);

  return {
    DIM_LABELS: QUAL_DIM_LABELS,
    FUNNEL: adaptFunnel(live),
    PRODUCT: {
      name: str(pc.name, "RAGFlow"),
      module: str(pc.module),
      stage: str(pc.stage),
      runMode: str(live.run_mode, "replay"),
      llmCalls: num(live.llm_call_count),
    },
    QUALITY: {
      total_r1: num(first?.total, D.QUALITY.total_r1),
      total_r2: num(last?.total, D.QUALITY.total_r2),
      gate_r1: str(first?.gate, "needs_enrich"),
      gate_r2: str(last?.gate, "pass"),
      dims,
      ambiguities: strList(last?.ambiguities),
      missing_r1: strList(first?.missing_info),
    },
    FOCUS: {
      id: str(fc.id, "req-01"),
      cluster_id: str(fc.cluster_id),
      title: str(fc.title),
      priority: str((live.opportunity as Obj)?.priority, "P0"),
      horizon: str((live.opportunity as Obj)?.horizon, "now"),
      gate: str(last?.gate, "pass"),
      round: num(last?.round, 2),
      status: str(fc.status, "candidate"),
      background: str(fc.background),
      pain_point: str(fc.pain_point),
      business_goal: str(fc.business_goal),
      target_users: strList(fc.target_users),
      user_stories: adaptUserStories(fc.user_stories),
      acceptance_criteria: adaptAcceptance(fc.acceptance_criteria),
      scope: strList(fc.scope),
      non_goals: strList(fc.non_goals),
      boundary_conditions: strList(fc.boundary_conditions),
    },
    COMPETITORS: adaptCompetitors(live),
    TECH: adaptTech(live),
    CLUSTERS: adaptClusters(live),
    FILTERED_SIGNALS: adaptFilteredSignals(live),
    OPPORTUNITY: adaptOpportunity(live),
    ROADMAP: adaptRoadmap(live),
    CODE_IMPACT: adaptCodeImpact(live),
    CODE_UNCERTAIN: adaptCodeUncertain(live),
    SUGGESTED_ORDER: strList(((live.code_impact || {}) as Obj).suggested_order),
    TASKS: adaptTasks(live),
    RISKS: strList(sol.risks),
    CHANGELOG: str(ex.changelog_draft),
    EVIDENCE: adaptEvidence(live.derived?.evidence_cards || []),
  };
}

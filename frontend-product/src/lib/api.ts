// Live backend client for the EvoPM FastAPI server (evopm-server on :8000).
// Contract: docs/frontend_api.md. VITE_API_BASE overrides the default origin.
//
// Endpoints used by the workbench:
//   GET  /api/state            → full EvoPMState JSON + a `derived` block (main data source)
//   GET  /api/reports          → { reports: [{ name, path }] }
//   GET  /api/reports/{name}   → { name, markdown }
//   GET  /api/evidence/{ref}   → { ref, excerpt, source, strength }
//   POST /api/run              → starts a run (used when /api/state is not ready)
//   GET  /api/status           → run status (polled after /api/run)

export const API_BASE: string =
  (import.meta.env?.VITE_API_BASE as string | undefined)?.replace(/\/$/, "") || "http://127.0.0.1:8000";

async function getJSON<T>(path: string): Promise<T> {
  const res = await fetch(API_BASE + path, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    const err = new Error(`GET ${path} → ${res.status}`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return (await res.json()) as T;
}

// ----- shapes (only the fields the adapter / screens touch; schemas.py is the source of truth) -----

export interface EvidenceCard {
  ref: string;
  excerpt: string;
  source: string;
  strength: string;
}

export interface QualityDimRaw {
  name: string;
  score: number;
  rationale: string;
}
export interface QualityBlock {
  total: number;
  gate: string;
  round: number;
  dimensions: QualityDimRaw[];
  missing_info: string[];
  ambiguities: string[];
  followup_questions: string[];
}

export interface LiveState {
  run_mode: string;
  llm_call_count: number;
  selected_cluster_id: string;
  signals: Record<string, unknown>[];
  clusters: Record<string, unknown>[];
  competitor_findings: Record<string, unknown>[];
  tech_findings: Record<string, unknown>[];
  focus_candidate: Record<string, unknown>;
  opportunity: Record<string, unknown>;
  roadmap: Record<string, unknown>[];
  solution: Record<string, unknown>;
  code_impact: Record<string, unknown>;
  execution: Record<string, unknown>;
  product_context: Record<string, unknown>;
  derived?: {
    funnel?: Record<string, number>;
    filtered_signals?: Record<string, unknown>[];
    duplicate_signals?: Record<string, unknown>[];
    quality_first?: QualityBlock;
    quality_last?: QualityBlock;
    evidence_cards?: EvidenceCard[];
    [k: string]: unknown;
  };
  [k: string]: unknown;
}

export interface ReportMeta {
  name: string;
  path: string;
}

export async function fetchState(): Promise<LiveState> {
  return getJSON<LiveState>("/api/state");
}

export async function fetchReports(): Promise<ReportMeta[]> {
  const r = await getJSON<{ reports: ReportMeta[] }>("/api/reports");
  return r.reports || [];
}

export async function fetchReport(name: string): Promise<string> {
  const r = await getJSON<{ name: string; markdown: string }>(`/api/reports/${name}`);
  return r.markdown || "";
}

export async function fetchEvidence(ref: string): Promise<EvidenceCard | null> {
  try {
    return await getJSON<EvidenceCard>(`/api/evidence/${ref}`);
  } catch {
    return null;
  }
}

export async function startRun(): Promise<void> {
  await fetch(API_BASE + "/api/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "replay", interactive: false }),
  });
}

interface RunStatus {
  status?: string;
  done?: boolean;
}

// Ensure a run exists: if /api/state 409s (no run yet), kick off a replay run and
// poll /api/status until it settles, then return the state. Best-effort; failures
// bubble up so the caller can fall back to the offline sample.
export async function ensureState(): Promise<LiveState> {
  try {
    return await fetchState();
  } catch (e) {
    const status = (e as { status?: number }).status;
    if (status !== 409) throw e;
  }
  await startRun();
  // poll up to ~30s for the run to finish, then read state
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 500));
    try {
      const st = await getJSON<RunStatus>("/api/status");
      const done = st.done === true || st.status === "done" || st.status === "idle" || st.status === "completed";
      if (done) break;
    } catch {
      // /api/status may not exist; just try fetching state below
      break;
    }
  }
  return fetchState();
}

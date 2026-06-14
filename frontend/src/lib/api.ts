// Live backend client for the EvoPM FastAPI server (evopm-server, default :8000).
// Contract: docs/frontend_api.md. All calls are CORS-friendly (server allows all origins).
import type { SampleState } from "../data/state";

export const API_BASE: string =
  import.meta.env.VITE_API_BASE?.replace(/\/$/, "") || "http://127.0.0.1:8000";

const WS_BASE = API_BASE.replace(/^http/, "ws");

export type RunMode = "mock" | "replay" | "live";

export interface RunResponse {
  run_id: string;
  thread_id: string;
  mode: string;
  status: string;
}

export interface FunnelStats {
  total_signals: number;
  filtered: number;
  duplicates: number;
  clusters: number;
  dup_clusters: number;
  focus: number;
}

// /api/state response = full EvoPMState (same field names as SampleState) + a derived block.
export interface Derived {
  funnel: FunnelStats;
  filtered_signals?: unknown[];
  duplicate_signals?: unknown[];
  verdict_groups?: Record<string, unknown[]>;
  tech_by_maturity?: Record<string, unknown[]>;
  impact_by_level?: Record<string, unknown[]>;
  tasks_by_type?: Record<string, unknown[]>;
  roadmap_by_horizon?: Record<string, unknown[]>;
  evidence_cards?: unknown[];
  quality_first?: { total: number } | null;
  quality_last?: { total: number } | null;
  rejected_refs?: unknown[];
  observations?: unknown[];
}

export interface LiveState extends SampleState {
  enrich_rounds?: number;
  research_reentry?: boolean;
  derived?: Derived;
}

export interface EvidenceCard {
  ref: string;
  excerpt: string;
  source: string;
  strength: string;
}

// WebSocket event union (server → client). See frontend_api.md §3.
export type WsEvent =
  | { event: "node"; node: string; agent: string; summary: string; elapsed: number }
  | { event: "interrupt"; payload: Record<string, unknown> }
  | { event: "done"; report_paths: string[]; funnel: FunnelStats }
  | { event: "error"; kind: string; message: string };

async function getJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`${path} → HTTP ${res.status}`);
  return (await res.json()) as T;
}

export async function startRun(
  body: { mode?: RunMode; interactive?: boolean; model?: string } = {},
): Promise<RunResponse> {
  const res = await fetch(`${API_BASE}/api/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "replay", interactive: false, ...body }),
  });
  if (!res.ok) throw new Error(`/api/run → HTTP ${res.status}`);
  return (await res.json()) as RunResponse;
}

export const fetchState = () => getJSON<LiveState>("/api/state");
export const fetchFunnel = () => getJSON<FunnelStats>("/api/funnel");
export const fetchEvidence = (ref: string) =>
  getJSON<EvidenceCard>(`/api/evidence/${encodeURIComponent(ref)}`);

export interface EventStream {
  close: () => void;
}

// Open the /ws stream. The server replays the current run's backlog on connect,
// then streams live events. Returns a handle whose close() tears down the socket.
export function openEventStream(
  onEvent: (ev: WsEvent) => void,
  opts: { onOpen?: () => void; onClose?: () => void; onError?: () => void } = {},
): EventStream {
  let closedByUs = false;
  const ws = new WebSocket(`${WS_BASE}/ws`);
  ws.onopen = () => opts.onOpen?.();
  ws.onmessage = (e) => {
    try {
      onEvent(JSON.parse(e.data) as WsEvent);
    } catch {
      /* ignore malformed frames */
    }
  };
  ws.onerror = () => opts.onError?.();
  ws.onclose = () => {
    if (!closedByUs) opts.onClose?.();
  };
  return {
    close: () => {
      closedByUs = true;
      try {
        ws.close();
      } catch {
        /* noop */
      }
    },
  };
}

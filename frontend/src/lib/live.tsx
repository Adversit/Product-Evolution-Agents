import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  fetchState,
  openEventStream,
  startRun,
  type EventStream,
  type LiveState,
  type WsEvent,
} from "./api";
import { resolveNode } from "./nodeMap";
import { TOTAL_STEPS } from "./graph";

export type Connection = "connecting" | "live" | "replay" | "offline";

export interface NodeRuntime {
  summary: string;
  elapsed: number;
  done: boolean;
}

export interface LiveContextValue {
  // Connection status to the backend.
  connection: Connection;
  // Full /api/state once a run finishes (null until first `done` or initial fetch).
  state: LiveState | null;
  // True while live data drives the DAG; false → embedded fallback + fake timer.
  liveActive: boolean;
  // Live-driven step (backend node lighting). null when not driving the DAG.
  liveStep: number | null;
  // Per-frontend-node-id live summary/elapsed overlay.
  nodeRuntime: Record<string, NodeRuntime>;
  // Trigger a fresh run: POST /api/run then re-stream /ws.
  rerun: () => void;
  // Whether a run is currently streaming.
  streaming: boolean;
}

const LiveContext = createContext<LiveContextValue | null>(null);

export function useLive(): LiveContextValue {
  const ctx = useContext(LiveContext);
  if (!ctx) throw new Error("useLive must be used within <LiveProvider>");
  return ctx;
}

export function LiveProvider({ children }: { children: ReactNode }) {
  const [connection, setConnection] = useState<Connection>("connecting");
  const [state, setState] = useState<LiveState | null>(null);
  const [liveStep, setLiveStep] = useState<number | null>(null);
  const [nodeRuntime, setNodeRuntime] = useState<Record<string, NodeRuntime>>({});
  const [streaming, setStreaming] = useState(false);

  const streamRef = useRef<EventStream | null>(null);
  const seenQualityGate = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      streamRef.current?.close();
    };
  }, []);

  const loadState = useCallback(async () => {
    try {
      const s = await fetchState();
      if (mounted.current) setState(s);
    } catch {
      /* state not ready yet — ignore; embedded fallback covers the drawer */
    }
  }, []);

  const handleEvent = useCallback(
    (ev: WsEvent) => {
      if (ev.event === "node") {
        const info = resolveNode(ev.node, seenQualityGate.current);
        if (ev.node === "quality_gate") seenQualityGate.current = true;
        if (!info) return;
        setLiveStep((prev) => (prev === null ? info.step : Math.max(prev, info.step)));
        if (info.cardId) {
          const cardId = info.cardId;
          setNodeRuntime((prev) => ({
            ...prev,
            [cardId]: { summary: ev.summary, elapsed: ev.elapsed, done: true },
          }));
        }
      } else if (ev.event === "done") {
        setStreaming(false);
        setLiveStep(TOTAL_STEPS - 1);
        void loadState();
      } else if (ev.event === "error") {
        setStreaming(false);
      }
      // `interrupt` is auto-resolved server-side in replay/non-interactive mode.
    },
    [loadState],
  );

  const connectStream = useCallback(
    (mode: Connection) => {
      seenQualityGate.current = false;
      streamRef.current?.close();
      setStreaming(true);
      streamRef.current = openEventStream(handleEvent, {
        onOpen: () => mounted.current && setConnection(mode),
        onError: () => {
          if (mounted.current) {
            setConnection("offline");
            setStreaming(false);
          }
        },
        onClose: () => mounted.current && setStreaming(false),
      });
    },
    [handleEvent],
  );

  // Initial connect: the server may still be running its boot autorun, so /api/state
  // can 409 briefly — retry a few times before giving up. Connect /ws REGARDLESS:
  // the socket resolves the real status (onOpen → live/replay, onError → offline),
  // so an early 409 never strands us permanently offline.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let s: LiveState | null = null;
      for (let i = 0; i < 20 && !cancelled; i++) {
        try {
          s = await fetchState();
          break;
        } catch {
          await new Promise((r) => setTimeout(r, 500));
        }
      }
      if (cancelled) return;
      if (s) setState(s);
      const mode: Connection = s?.run_mode === "live" ? "live" : "replay";
      connectStream(mode);
    })();
    return () => {
      cancelled = true;
    };
    // connectStream is stable for the lifetime via useCallback deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rerun = useCallback(() => {
    setNodeRuntime({});
    setLiveStep(null);
    seenQualityGate.current = false;
    (async () => {
      try {
        const res = await startRun({ mode: "replay", interactive: false });
        const mode: Connection = res.mode === "live" ? "live" : "replay";
        connectStream(mode);
      } catch {
        if (mounted.current) setConnection("offline");
      }
    })();
  }, [connectStream]);

  const liveActive = connection === "live" || connection === "replay";

  const value = useMemo<LiveContextValue>(
    () => ({ connection, state, liveActive, liveStep, nodeRuntime, rerun, streaming }),
    [connection, state, liveActive, liveStep, nodeRuntime, rerun, streaming],
  );

  return <LiveContext.Provider value={value}>{children}</LiveContext.Provider>;
}

// Evidence chip + click-anywhere popover. A chip click anchors a fixed popover
// showing 类型 badge, ref, 强度 badge, 原文摘录, 来源 (mock:// flagged as 「本地材料 ·
// 证据强度封顶 moderate」). Live mode fetches GET /api/evidence/{ref} on open (the
// adapted in-context D.EVIDENCE is the fallback / offline source). Click-outside
// closes. Weak/no_direct refs render as a downgraded chip.
import { createContext, useCallback, useContext, useState } from "react";
import type { ReactNode, MouseEvent } from "react";
import type { EvidenceEntry } from "../data/state";
import { useData } from "../data/DataContext";
import { evidenceFromCard } from "../data/adapt";
import { fetchEvidence } from "../lib/api";
import { chipStyle, isWeak, strengthMeta, typeMeta } from "../lib/theme";

interface EvState {
  ref: string;
  entry: EvidenceEntry;
  x: number;
  y: number;
}

interface EvCtx {
  open: (ref: string, e: MouseEvent, inline?: EvidenceEntry) => void;
}

const Ctx = createContext<EvCtx>({ open: () => {} });

export function useEvidence(): EvCtx {
  return useContext(Ctx);
}

export function EvidenceProvider({ children, offline = false }: { children: ReactNode; offline?: boolean }) {
  const D = useData();
  const [state, setState] = useState<EvState | null>(null);

  const open = useCallback(
    (ref: string, e: MouseEvent, inline?: EvidenceEntry) => {
      const entry = inline || D.EVIDENCE[ref];
      if (!entry) return;
      const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const popped: EvState = { ref, entry, x: r.left, y: r.bottom + 8 };
      setState(popped);
      // Live: refresh from the backend evidence endpoint (best-effort, keeps anchor).
      if (!offline && !inline) {
        fetchEvidence(ref).then((card) => {
          if (!card) return;
          setState((cur) => (cur && cur.ref === ref ? { ...cur, entry: evidenceFromCard(card) } : cur));
        });
      }
    },
    [D, offline],
  );

  const close = useCallback(() => setState(null), []);

  return (
    <Ctx.Provider value={{ open }}>
      {children}
      {state && <Popover state={state} onClose={close} />}
    </Ctx.Provider>
  );
}

function Popover({ state, onClose }: { state: EvState; onClose: () => void }) {
  const { entry, ref } = state;
  const tm = typeMeta(entry.type);
  const sm = strengthMeta(entry.strength);
  const isLocal = (entry.source || "").startsWith("mock://");
  const w = typeof window !== "undefined" ? window.innerWidth : 1280;
  const h = typeof window !== "undefined" ? window.innerHeight : 800;
  const left = Math.max(12, Math.min(state.x, w - 352));
  const top = Math.min(state.y, h - 220);

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 60 }}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "fixed",
          left,
          top,
          width: 340,
          background: "#FFFFFF",
          border: "1px solid #E6E6E4",
          borderRadius: 13,
          boxShadow: "0 12px 38px rgba(0,0,0,.16)",
          padding: "16px 17px",
          animation: "evpop .16s cubic-bezier(.22,.61,.36,1) both",
          zIndex: 61,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 11 }}>
          <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 5, color: "#1B1C1E", background: tm.dot }}>{tm.label}</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#1B1C1E", fontFamily: "'JetBrains Mono',monospace" }}>{ref}</span>
          <span style={{ marginLeft: "auto" }}>
            <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 5, color: sm.color, background: sm.bg, border: "1px solid " + sm.bd }}>强度 · {sm.label}</span>
          </span>
        </div>
        <p style={{ margin: "0 0 13px", fontSize: 13, lineHeight: 1.7, color: "#1B1C1E", textWrap: "pretty" } as object}>{entry.text}</p>
        <div style={{ display: "flex", alignItems: "center", gap: 7, paddingTop: 11, borderTop: "1px solid #ECECEA" }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#8A8F98" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
          <span style={{ fontSize: 11, color: "#8A8F98", fontFamily: "'JetBrains Mono',monospace", wordBreak: "break-all" }}>{entry.source}</span>
        </div>
        {isLocal && <div style={{ marginTop: 8, fontSize: 10.5, color: "#8A8F98", fontStyle: "italic" }}>本地材料 · mock 来源，证据强度封顶 moderate</div>}
      </div>
    </div>
  );
}

// A single evidence ref chip. Uses the global popover via context.
export function EvidenceChip({ refId }: { refId: string }) {
  const D = useData();
  const { open } = useEvidence();
  const [hover, setHover] = useState(false);
  const entry = D.EVIDENCE[refId];
  const weak = entry ? isWeak(entry.strength) : false;
  const tm = typeMeta(entry ? entry.type : "tech");
  return (
    <button
      onClick={(e) => open(refId, e)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={chipStyle(weak, hover)}
    >
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: tm.dot }} />
      {refId}
    </button>
  );
}

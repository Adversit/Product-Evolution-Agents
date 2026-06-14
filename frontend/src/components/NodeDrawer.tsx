import { useMemo, useState } from "react";
import { Braces, Check, Copy, LayoutList, X } from "lucide-react";
import { COLORS } from "../lib/theme";
import { getInspector } from "./inspectors";
import { useLive } from "../lib/live";
import { STATE, type SampleState } from "../data/state";

interface Props {
  nodeId: string;
  onClose: () => void;
}

type View = "structured" | "json";

export default function NodeDrawer({ nodeId, onClose }: Props) {
  const [view, setView] = useState<View>("structured");
  const [copied, setCopied] = useState(false);
  const { state } = useLive();
  const data = (state as SampleState | null) ?? STATE;
  const inspector = useMemo(() => getInspector(nodeId, data), [nodeId, data]);
  const json = useMemo(() => (inspector ? JSON.stringify(inspector.raw, null, 2) : ""), [inspector]);

  if (!inspector) return null;

  const copy = () => {
    navigator.clipboard?.writeText(json).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    });
  };

  return (
    <aside
      style={{
        width: 460, flexShrink: 0, borderLeft: `1px solid ${COLORS.hairline}`,
        background: "#0c1018", display: "flex", flexDirection: "column", minHeight: 0,
        animation: "drawerIn .22s cubic-bezier(.22,.61,.36,1)",
      }}
    >
      {/* header */}
      <div style={{ padding: "16px 18px 12px", borderBottom: `1px solid ${COLORS.hairline}`, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: COLORS.ink, letterSpacing: ".2px" }}>
              {inspector.title}
            </div>
            <div
              style={{
                fontSize: 11, color: COLORS.ink3, marginTop: 4, fontFamily: "'JetBrains Mono',monospace",
                lineHeight: 1.5,
              }}
            >
              {inspector.subtitle}
            </div>
          </div>
          <button
            onClick={onClose}
            title="关闭"
            style={{
              width: 30, height: 30, flexShrink: 0, border: `1px solid ${COLORS.hairline}`, borderRadius: 7,
              background: COLORS.panel, color: COLORS.ink2, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 12 }}>
          <Toggle active={view === "structured"} onClick={() => setView("structured")}>
            <LayoutList size={13} /> 结构化
          </Toggle>
          <Toggle active={view === "json"} onClick={() => setView("json")}>
            <Braces size={13} /> 原始 JSON
          </Toggle>
          {view === "json" && (
            <button
              onClick={copy}
              title="复制 JSON"
              style={{
                marginLeft: "auto", display: "flex", alignItems: "center", gap: 5, height: 28, padding: "0 10px",
                border: `1px solid ${COLORS.hairline}`, borderRadius: 6, background: COLORS.panel,
                color: copied ? COLORS.doneSoft : COLORS.ink2, cursor: "pointer",
                font: "600 11px 'JetBrains Mono',monospace",
              }}
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? "已复制" : "复制"}
            </button>
          )}
        </div>
      </div>

      {/* body */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px 28px", minHeight: 0 }}>
        {view === "structured" ? (
          inspector.body
        ) : (
          <pre
            style={{
              margin: 0, font: "400 11.5px 'JetBrains Mono',monospace", color: "#bcd0e0", lineHeight: 1.55,
              whiteSpace: "pre-wrap", wordBreak: "break-word",
            }}
          >
            {json}
          </pre>
        )}
      </div>
    </aside>
  );
}

function Toggle({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 5, height: 28, padding: "0 11px", borderRadius: 6, cursor: "pointer",
        font: "600 11.5px Inter,sans-serif",
        border: `1px solid ${active ? "rgba(34,211,238,.35)" : COLORS.hairline}`,
        background: active ? "rgba(34,211,238,.08)" : COLORS.panel,
        color: active ? COLORS.activeSoft : COLORS.ink3,
      }}
    >
      {children}
    </button>
  );
}

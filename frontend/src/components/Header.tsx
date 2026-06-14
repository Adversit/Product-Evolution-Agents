import { COLORS } from "../lib/theme";
import type { Pipeline } from "../hooks/usePipeline";
import { useLive, type Connection } from "../lib/live";

interface Props {
  pipeline: Pipeline;
  stepLabel: string;
}

const ctrlBtn: React.CSSProperties = {
  width: 32, height: 32, border: "none", borderRadius: 6,
  background: "#161C28", color: COLORS.ink2, cursor: "pointer", fontSize: 13,
};

// Connection indicator config: [dot color, label].
const CONN: Record<Connection, { color: string; label: string }> = {
  connecting: { color: COLORS.warn, label: "连接中…" },
  live: { color: COLORS.done, label: "live · 实时后端" },
  replay: { color: COLORS.active, label: "replay · 离线重放" },
  offline: { color: COLORS.danger, label: "离线样例 / offline sample" },
};

export default function Header({ pipeline, stepLabel }: Props) {
  const { playing, anim, speed, togglePlay, step1, prev, reset, toggleAnim, cycleSpeed } = pipeline;
  const { connection, streaming, rerun } = useLive();
  const conn = CONN[connection];

  return (
    <header
      style={{
        display: "flex", alignItems: "center", gap: 20, padding: "14px 22px",
        borderBottom: `1px solid ${COLORS.hairline}`,
        background: "linear-gradient(180deg,#11161F,#0d1119)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 11, flexShrink: 0 }}>
        <div
          style={{
            width: 30, height: 30, borderRadius: 7,
            background: "linear-gradient(135deg,#22D3EE,#34D399)", flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: COLORS.canvas, fontWeight: 800, fontSize: 17,
            boxShadow: "0 0 16px rgba(34,211,238,.35)",
          }}
        >
          ⚡
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: ".2px", whiteSpace: "nowrap" }}>
            EvoPM Agent · 流水线透视台
          </div>
          <div style={{ fontSize: 11, color: COLORS.ink3, fontFamily: "'JetBrains Mono',monospace" }}>
            LangGraph · 14-node multi-agent pipeline
          </div>
        </div>
      </div>

      <div
        style={{
          display: "flex", alignItems: "center", gap: 8, padding: "5px 11px",
          border: `1px solid ${COLORS.hairline}`, borderRadius: 7, background: COLORS.panel,
        }}
        title={`后端连接状态：${conn.label}`}
      >
        <span
          style={{
            width: 7, height: 7, borderRadius: "50%", background: conn.color,
            boxShadow: `0 0 8px ${conn.color}`,
            animation: streaming || connection === "connecting" ? "dotPulse 1.8s ease-in-out infinite" : undefined,
          }}
        />
        <span style={{ fontSize: 12, fontFamily: "'JetBrains Mono',monospace", color: conn.color }}>
          {conn.label}
        </span>
      </div>

      <button
        onClick={rerun}
        disabled={streaming || connection === "offline"}
        title={connection === "offline" ? "后端不可达（离线样例模式）" : "重新运行（POST /api/run 并重连 /ws）"}
        style={{
          display: "flex", alignItems: "center", gap: 6, height: 30, padding: "0 12px", borderRadius: 7,
          border: `1px solid ${streaming || connection === "offline" ? COLORS.hairline : "rgba(52,211,153,.4)"}`,
          background: streaming || connection === "offline" ? COLORS.panel : "rgba(52,211,153,.08)",
          color: streaming || connection === "offline" ? COLORS.ink3 : COLORS.doneSoft,
          cursor: streaming || connection === "offline" ? "not-allowed" : "pointer",
          font: "600 12px Inter,sans-serif", whiteSpace: "nowrap", flexShrink: 0,
        }}
      >
        {streaming ? "运行中…" : "↻ 重新运行"}
      </button>

      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
        <div
          style={{
            fontSize: 12, fontFamily: "'JetBrains Mono',monospace", color: COLORS.ink2,
            textAlign: "right", flexShrink: 1, minWidth: 0, overflow: "hidden",
            whiteSpace: "nowrap", textOverflow: "ellipsis",
          }}
        >
          STEP {stepLabel}
        </div>
        <div
          style={{
            display: "flex", alignItems: "center", gap: 6, padding: 5,
            border: `1px solid ${COLORS.hairline}`, borderRadius: 9, background: COLORS.panel, flexShrink: 0,
          }}
        >
          <button onClick={reset} style={{ ...ctrlBtn, fontSize: 14 }} title="重置">↺</button>
          <button onClick={prev} style={ctrlBtn} title="上一步">◀</button>
          <button
            onClick={togglePlay}
            title={playing ? "暂停" : "播放"}
            style={{
              width: 40, height: 32, border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13,
              background: playing ? "#161C28" : COLORS.active,
              color: playing ? COLORS.activeSoft : COLORS.canvas,
              boxShadow: playing ? "none" : "0 0 16px rgba(34,211,238,.4)",
            }}
          >
            {playing ? "⏸" : "▶"}
          </button>
          <button onClick={step1} style={ctrlBtn} title="下一步">▶</button>
        </div>
        <button
          onClick={cycleSpeed}
          title="速度"
          style={{
            height: 32, padding: "0 12px", border: `1px solid ${COLORS.hairline}`, borderRadius: 7,
            background: COLORS.panel, color: COLORS.ink2, cursor: "pointer", fontSize: 12,
            fontFamily: "'JetBrains Mono',monospace", flexShrink: 0,
          }}
        >
          {speed}×
        </button>
        <button
          onClick={toggleAnim}
          title="动画开关"
          style={{
            height: 32, padding: "0 12px", borderRadius: 7, cursor: "pointer", fontSize: 12,
            fontFamily: "'JetBrains Mono',monospace", whiteSpace: "nowrap", flexShrink: 0,
            border: `1px solid ${anim ? "rgba(34,211,238,.35)" : COLORS.hairline}`,
            background: anim ? "rgba(34,211,238,.08)" : COLORS.panel,
            color: anim ? COLORS.activeSoft : COLORS.ink3,
          }}
        >
          {anim ? "动画 ●" : "动画 ○"}
        </button>
      </div>
    </header>
  );
}

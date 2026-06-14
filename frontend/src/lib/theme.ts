// Dark-tech palette — single source of truth for the inline-styled DAG.
// Mirrors design_handoff_demo.md §视觉 Token and the .dc.html constants.
export const COLORS = {
  canvas: "#0B0E14",
  panel: "#11161F",
  card: "#161C28",
  hairline: "#232A36",
  active: "#22D3EE",
  activeSoft: "#67e8f9",
  done: "#34D399",
  doneSoft: "#6ee7b7",
  warn: "#FBBF24",
  warnSoft: "#fcd34d",
  danger: "#FB7185",
  dangerSoft: "#fda4af",
  loop: "#A78BFA",
  loopSoft: "#c4b5fd",
  ink: "#E5E7EB",
  ink2: "#9CA3AF",
  ink3: "#6B7280",
} as const;

export type ChipKind = "cyan" | "emerald" | "amber" | "rose" | "violet" | "slate";

// [text, background, border] — ported from chipStyle() in the design.
const CHIP_MAP: Record<ChipKind, [string, string, string]> = {
  cyan: ["#67e8f9", "rgba(34,211,238,.10)", "rgba(34,211,238,.32)"],
  emerald: ["#6ee7b7", "rgba(52,211,153,.10)", "rgba(52,211,153,.32)"],
  amber: ["#fcd34d", "rgba(251,191,36,.10)", "rgba(251,191,36,.32)"],
  rose: ["#fda4af", "rgba(251,113,133,.10)", "rgba(251,113,133,.32)"],
  violet: ["#c4b5fd", "rgba(167,139,250,.10)", "rgba(167,139,250,.32)"],
  slate: ["#9CA3AF", "rgba(148,163,184,.06)", "#2a3340"],
};

export function chipStyle(kind: ChipKind): React.CSSProperties {
  const m = CHIP_MAP[kind] ?? CHIP_MAP.slate;
  return {
    color: m[0],
    background: m[1],
    border: "1px solid " + m[2],
    borderRadius: "5px",
    padding: "2px 6px",
    font: "600 9.5px 'JetBrains Mono', monospace",
    whiteSpace: "nowrap",
  };
}

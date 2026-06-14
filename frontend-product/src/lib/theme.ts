// Light Linear theme tokens + shared badge/chip style helpers.
// Ported from the helper methods in the .dc.html `class Component` (_strengthMeta,
// _typeMeta, _chip, pill, …). Colors are the design's final landed light theme:
// white bg, near-black ink #1B1C1E, hairline grays, lavender #5E6AD2 reserved for
// the single data series (round-2), green #1A7F37 for semantics only.
import type { CSSProperties } from "react";
import type { EvidenceStrength, EvidenceType } from "../data/state";

export const C = {
  ink: "#1B1C1E",
  ink2: "#56595F",
  ink3: "#8A8F98",
  grayMid: "#A9ACA9",
  grayBar: "#C9C9C7",
  hairline: "#E6E6E4",
  hairline2: "#ECECEA",
  sidebar: "#FBFBFA",
  fill: "#F4F4F3",
  fillSoft: "#FAFAFA",
  white: "#FFFFFF",
  lavender: "#5E6AD2",
  green: "#1A7F37",
  greenBg: "#E9F6EC",
  greenBorder: "#BCE3C4",
} as const;

export interface StrengthMeta {
  label: string;
  color: string;
  bg: string;
  bd: string;
}

export function strengthMeta(s: EvidenceStrength | string): StrengthMeta {
  const map: Record<string, StrengthMeta> = {
    strong: { label: "强", color: "#1B1C1E", bg: "#F4F4F3", bd: "#D8D8D6" },
    moderate: { label: "中", color: "#1B1C1E", bg: "#F4F4F3", bd: "#E6E6E4" },
    partial: { label: "部分", color: "#1B1C1E", bg: "#F4F4F3", bd: "#E6E6E4" },
    complete: { label: "完整", color: "#1B1C1E", bg: "#F4F4F3", bd: "#D8D8D6" },
    weak: { label: "弱", color: "#8A8F98", bg: "#F4F4F3", bd: "#E6E6E4" },
    no_direct: { label: "无直接", color: "#8A8F98", bg: "#F4F4F3", bd: "#E6E6E4" },
    inference_only: { label: "仅推断", color: "#8A8F98", bg: "#F4F4F3", bd: "#E6E6E4" },
  };
  return map[s] || map.moderate;
}

export function typeMeta(t: EvidenceType | string): { label: string; dot: string } {
  if (t === "signal") return { label: "用户信号", dot: "#5E6AD2" };
  if (t === "competitor") return { label: "竞品发现", dot: "#8A8F98" };
  return { label: "技术发现", dot: "#5E6AD2" };
}

export function isWeak(s: EvidenceStrength | string): boolean {
  return s === "weak" || s === "no_direct" || s === "inference_only";
}

// Evidence chip (signal/competitor/tech ref). Weak/no_direct are downgraded:
// dashed border, muted text, reduced opacity.
export function chipStyle(weak: boolean, hover: boolean): CSSProperties {
  const base: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    cursor: "pointer",
    fontFamily: "'JetBrains Mono',monospace",
    fontSize: 10.5,
    fontWeight: 500,
    padding: "3px 8px",
    borderRadius: 6,
  };
  if (weak) {
    return hover
      ? { ...base, color: "#8A8F98", background: "#ECECEA", border: "1px dashed #A9ACA9", opacity: 1 }
      : { ...base, color: "#8A8F98", background: "#FAFAF9", border: "1px dashed #D8D8D6", opacity: 0.85 };
  }
  return hover
    ? { ...base, color: "#1B1C1E", background: "#F4F4F3", border: "1px solid #E6E6E4" }
    : { ...base, color: "#56595F", background: "#F4F4F3", border: "1px solid #E6E6E4" };
}

// Generic pill (priority/severity/status/risk badges).
export function pill(m: { c: string; bg: string; bd: string }): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    whiteSpace: "nowrap",
    fontSize: 10.5,
    fontWeight: 700,
    letterSpacing: ".2px",
    padding: "2px 9px",
    borderRadius: 6,
    color: m.c,
    background: m.bg,
    border: "1px solid " + m.bd,
  };
}

export const priMeta: Record<string, { c: string; bg: string; bd: string }> = {
  P0: { c: "#FFFFFF", bg: "#1B1C1E", bd: "#1B1C1E" },
  P1: { c: "#56595F", bg: "#F4F4F3", bd: "#E6E6E4" },
  Duplicate: { c: "#8A8F98", bg: "#F4F4F3", bd: "#E6E6E4" },
};

// Screen 3 — 问题簇总览. 3 cluster cards (focus ⭐ / DUPLICATE→ex-01 / known) with
// priority/severity/status chips + frequency bar, plus the 5 filtered signals.
import type { CSSProperties } from "react";
import { useData } from "../data/DataContext";
import { pill, priMeta } from "../lib/theme";

const sevMeta: Record<string, { l: string; c: string; bg: string; bd: string }> = {
  critical: { l: "critical", c: "#1B1C1E", bg: "#F4F4F3", bd: "#D8D8D6" },
  high: { l: "high", c: "#8A8F98", bg: "#F4F4F3", bd: "#E6E6E4" },
};
const statusMeta: Record<string, { l: string; c: string; bg: string; bd: string }> = {
  known: { l: "已知 known", c: "#56595F", bg: "#F4F4F3", bd: "#E6E6E4" },
  duplicate: { l: "查重 duplicate", c: "#8A8F98", bg: "#FFFFFF", bd: "#E6E6E4" },
};
const amLabel: Record<string, string> = { insufficient: "信息不足", emotional: "情绪宣泄", suspected_misuse: "疑似误用" };

export default function Clusters() {
  const D = useData();
  return (
    <section style={{ maxWidth: 1180, margin: "0 auto", padding: "30px 34px 64px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".4px", color: "#8A8F98", fontFamily: "'JetBrains Mono',monospace" }}>问题簇 · CLUSTERS</span>
      </div>
      <h1 style={{ fontSize: 23, fontWeight: 700, letterSpacing: "-.4px", margin: "0 0 4px" }}>问题簇总览</h1>
      <p style={{ margin: "0 0 24px", fontSize: 13, color: "#8A8F98", maxWidth: 740, lineHeight: 1.6 }}>
        9 条有效信号聚为 3 簇，其中 1 簇命中历史需求 ex-01 被标记为 <b style={{ color: "#56595F" }}>DUPLICATE</b>。
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 30 }}>
        {D.CLUSTERS.map((c) => {
          const sv = sevMeta[c.severity] || sevMeta.high;
          const pr = priMeta[c.priority] || priMeta.P1;
          const stm = statusMeta[c.status] || statusMeta.known;
          const cardStyle: CSSProperties = c.focus
            ? { background: "#FFFFFF", border: "1.5px solid #D8D8D6", borderRadius: 14, padding: "20px 22px", boxShadow: "0 6px 20px rgba(24,24,27,.07)" }
            : c.status === "duplicate"
            ? { background: "#FCFCFC", border: "1px solid #E6E6E4", borderRadius: 14, padding: "20px 22px", opacity: 0.92 }
            : { background: "#FFFFFF", border: "1px solid #E6E6E4", borderRadius: 14, padding: "20px 22px", boxShadow: "0 1px 2px rgba(0,0,0,.03)" };
          return (
            <div key={c.id} style={cardStyle}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 7, marginBottom: 9 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#8A8F98", fontFamily: "'JetBrains Mono',monospace" }}>{c.id}</span>
                    {c.focus && <span style={{ fontSize: 10.5, fontWeight: 700, color: "#1B1C1E", background: "#F4F4F3", padding: "2px 9px", borderRadius: 6 }}>⭐ 焦点</span>}
                    <span style={pill(pr)}>{c.priority}</span>
                    <span style={pill(sv)}>{sv.l}</span>
                    <span style={pill(stm)}>{stm.l}</span>
                  </div>
                  <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 7px", letterSpacing: "-.2px", lineHeight: 1.4, textWrap: "pretty" } as object}>{c.title}</h2>
                  <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.7, color: "#56595F", textWrap: "pretty" } as object}>{c.summary}</p>
                </div>
                <div style={{ flexShrink: 0, width: 96, textAlign: "center", padding: "4px 0" }}>
                  <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: "-1.5px", lineHeight: 1, color: "#1B1C1E" }}>{c.freq}</div>
                  <div style={{ fontSize: 10.5, color: "#8A8F98", marginTop: 3 }}>频次 frequency</div>
                  <div style={{ marginTop: 9, height: 5, background: "#ECECEA", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ height: 5, background: "#1B1C1E", borderRadius: 3, width: (c.freq / 10) * 100 + "%" }} />
                  </div>
                </div>
              </div>
              <div style={{ marginTop: 13, paddingTop: 13, borderTop: "1px solid #ECECEA", display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 11, color: "#8A8F98" }}>候选需求</span>
                <span style={{ fontSize: 12, color: "#56595F", fontWeight: 500 }}>{c.candidate}</span>
                <span style={{ marginLeft: "auto", fontSize: 10.5, color: "#8A8F98", fontFamily: "'JetBrains Mono',monospace" }}>{c.categories.join(" · ")}</span>
              </div>
              {c.status === "duplicate" && (
                <div style={{ marginTop: 11, padding: "11px 13px", background: "#FAFAF9", border: "1px dashed #D8D8D6", borderRadius: 9, display: "flex", gap: 9 }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#8A8F98" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}><rect width="14" height="14" x="8" y="8" rx="2" /><path d="M4 16V4a2 2 0 0 1 2-2h12" /></svg>
                  <div style={{ fontSize: 11.5, lineHeight: 1.65, color: "#8A8F98", textWrap: "pretty" } as object}>
                    <b style={{ color: "#56595F" }}>查重并入 {c.duplicate_of}：</b>
                    {c.dedup_reason}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* filtered signals */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <span style={{ width: 3, height: 15, background: "#8A8F98", borderRadius: 2 }} />
        <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>已过滤信号</h2>
        <span style={{ fontSize: 11, color: "#8A8F98" }}>5 条 · 可行动性不足，未进聚类</span>
      </div>
      <div style={{ background: "#FFFFFF", border: "1px solid #E6E6E4", borderRadius: 12, overflow: "hidden" }}>
        {D.FILTERED_SIGNALS.map((s, i) => (
          <div key={s.id} style={{ display: "flex", gap: 13, padding: "13px 16px", borderBottom: i === D.FILTERED_SIGNALS.length - 1 ? "none" : "1px solid #ECECEA", alignItems: "flex-start" }}>
            <span style={{ fontSize: 10.5, fontWeight: 700, color: "#8A8F98", fontFamily: "'JetBrains Mono',monospace", flexShrink: 0, paddingTop: 1 }}>{s.id}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, color: "#56595F", lineHeight: 1.6 }}>{s.text}</div>
              <div style={{ fontSize: 11, color: "#8A8F98", marginTop: 5, lineHeight: 1.55 }}>
                <span style={{ color: "#1B1C1E" }}>↳ 追问</span> {s.followup}
              </div>
            </div>
            <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 600, color: "#8A8F98", background: "#F4F4F3", border: "1px solid #E6E6E4", padding: "2px 8px", borderRadius: 5, whiteSpace: "nowrap" }}>{amLabel[s.actionability] || s.actionability}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

// Screen 4 — 机会评分 · 路线图. 10-dim weighted bars (total 86.6) + Now/Next/Later board.
import type { CSSProperties } from "react";
import { D } from "../data/state";
import { pill, priMeta } from "../lib/theme";

const barColor = (score: number) => (score >= 90 ? "#1B1C1E" : score >= 84 ? "#56595F" : "#8A8F98");

const rmMeta: Record<string, { l: string; c: string; dot: string }> = {
  now: { l: "NOW", c: "#1B1C1E", dot: "#5E6AD2" },
  next: { l: "NEXT", c: "#56595F", dot: "#56595F" },
  later: { l: "LATER", c: "#8A8F98", dot: "#8A8F98" },
};

export default function Opportunity() {
  return (
    <section style={{ maxWidth: 1180, margin: "0 auto", padding: "30px 34px 64px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".4px", color: "#8A8F98", fontFamily: "'JetBrains Mono',monospace" }}>机会 · OPPORTUNITY</span>
      </div>
      <h1 style={{ fontSize: 23, fontWeight: 700, letterSpacing: "-.4px", margin: "0 0 4px" }}>机会评分与路线图</h1>
      <p style={{ margin: "0 0 24px", fontSize: 13, color: "#8A8F98", maxWidth: 740, lineHeight: 1.6 }}>十维加权得出机会总分，决定优先级与执行视野（Now / Next / Later）。</p>

      {/* scoring */}
      <div style={{ background: "#FFFFFF", border: "1px solid #E6E6E4", borderRadius: 14, boxShadow: "0 1px 2px rgba(0,0,0,.03)", overflow: "hidden", marginBottom: 26 }}>
        <div style={{ display: "grid", gridTemplateColumns: "240px 1fr" }}>
          <div style={{ padding: 24, borderRight: "1px solid #ECECEA", background: "linear-gradient(180deg,#F4F4F3,#FFFFFF)", display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <div style={{ fontSize: 12, color: "#56595F", fontWeight: 600 }}>加权机会总分</div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 6, marginTop: 8 }}>
              <span style={{ fontSize: 58, fontWeight: 700, letterSpacing: "-2.5px", lineHeight: 0.9, color: "#1B1C1E" }}>86.6</span>
            </div>
            <div style={{ marginTop: 14, display: "flex", gap: 7 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#FFFFFF", background: "#1B1C1E", padding: "4px 12px", borderRadius: 7 }}>P0</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#1B1C1E", background: "#F4F4F3", border: "1px solid #E6E6E4", padding: "4px 12px", borderRadius: 7 }}>NOW</span>
            </div>
            <p style={{ margin: "16px 0 0", fontSize: 11.5, lineHeight: 1.65, color: "#8A8F98" }}>10 维加权评分，核心链路影响（95）与严重度（93）为最高项。</p>
          </div>
          <div style={{ padding: "20px 24px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "13px 30px" }}>
            {D.OPPORTUNITY.scores.map((o) => (
              <div key={o.dim}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 5 }}>
                  <span style={{ fontSize: 12, color: "#56595F", fontWeight: 500 }}>{o.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#1B1C1E", fontFamily: "'JetBrains Mono',monospace" }}>{o.score}</span>
                </div>
                <div style={{ height: 6, background: "#ECECEA", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ height: 6, borderRadius: 3, background: barColor(o.score), width: o.score + "%" }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* kanban */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <span style={{ width: 3, height: 15, background: "#1B1C1E", borderRadius: 2 }} />
        <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Now · Next · Later 路线图</h2>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
        {(["now", "next", "later"] as const).map((h) => {
          const m = rmMeta[h];
          const items = D.ROADMAP.filter((r) => r.horizon === h);
          const headStyle: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 700, letterSpacing: ".5px", color: m.c };
          return (
            <div key={h} style={{ background: "#FFFFFF", border: "1px solid #E6E6E4", borderRadius: 14, padding: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 13, padding: "0 2px" }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: m.dot }} />
                <span style={headStyle}>{m.l}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {items.map((r) => {
                  const pr = priMeta[r.priority] || priMeta.P1;
                  return (
                    <div key={r.cluster_id} style={{ background: "#FFFFFF", border: "1px solid #E6E6E4", borderRadius: 11, padding: 14 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 9 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: "#8A8F98", fontFamily: "'JetBrains Mono',monospace" }}>{r.cluster_id}</span>
                        <span style={pill(pr)}>{r.priority}</span>
                        {r.focus && <span style={{ fontSize: 10, color: "#1B1C1E" }}>⭐</span>}
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.45, color: "#1B1C1E", marginBottom: 8, textWrap: "pretty" } as object}>{r.title}</div>
                      <p style={{ margin: 0, fontSize: 11.5, lineHeight: 1.6, color: "#8A8F98", textWrap: "pretty" } as object}>{r.reason}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

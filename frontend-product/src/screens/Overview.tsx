// Screen 2 — 概览仪表盘. 4 KPI cards + 27→5→9→3→1 decision funnel + P0 结论 card.
import { D } from "../data/state";

export default function Overview() {
  return (
    <section style={{ maxWidth: 1180, margin: "0 auto", padding: "30px 34px 64px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".4px", color: "#8A8F98", fontFamily: "'JetBrains Mono',monospace" }}>概览 · OVERVIEW</span>
      </div>
      <h1 style={{ fontSize: 23, fontWeight: 700, letterSpacing: "-.4px", margin: "0 0 4px" }}>执行摘要仪表盘</h1>
      <p style={{ margin: "0 0 24px", fontSize: 13, color: "#8A8F98", maxWidth: 720, lineHeight: 1.6 }}>本轮分析从 27 条反馈中提炼出 1 个 P0 焦点需求，下方为决策漏斗与关键指标。</p>

      {/* KPI row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24 }}>
        <div style={{ background: "#FFFFFF", border: "1px solid #E8E8E6", borderRadius: 14, padding: 18, color: "#1B1C1E", boxShadow: "0 1px 2px rgba(0,0,0,.04)" }}>
          <div style={{ fontSize: 11.5, opacity: 0.8, fontWeight: 500 }}>机会加权总分</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 6, marginTop: 6 }}>
            <span style={{ fontSize: 38, fontWeight: 700, letterSpacing: "-1.5px", lineHeight: 1 }}>86.6</span>
            <span style={{ fontSize: 12, opacity: 0.85, paddingBottom: 5 }}>/ 100</span>
          </div>
          <div style={{ marginTop: 10, display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, color: "#FFFFFF", background: "#1B1C1E", padding: "3px 9px", borderRadius: 6 }}>P0 · NOW</div>
        </div>
        <div style={{ background: "#FFFFFF", border: "1px solid #E6E6E4", borderRadius: 14, padding: 18, boxShadow: "0 1px 2px rgba(0,0,0,.03)" }}>
          <div style={{ fontSize: 11.5, color: "#8A8F98", fontWeight: 500 }}>焦点需求质量</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 7, marginTop: 6 }}>
            <span style={{ fontSize: 30, fontWeight: 700, color: "#A9ACA9", letterSpacing: "-1px", lineHeight: 1 }}>61</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8A8F98" strokeWidth="2" style={{ marginBottom: 4 }}><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            <span style={{ fontSize: 38, fontWeight: 700, color: "#1B1C1E", letterSpacing: "-1.5px", lineHeight: 1 }}>86</span>
          </div>
          <div style={{ marginTop: 10, display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, color: "#1A7F37", background: "#E9F6EC", padding: "3px 9px", borderRadius: 6 }}>门禁 PASS</div>
        </div>
        <div style={{ background: "#FFFFFF", border: "1px solid #E6E6E4", borderRadius: 14, padding: 18, boxShadow: "0 1px 2px rgba(0,0,0,.03)" }}>
          <div style={{ fontSize: 11.5, color: "#8A8F98", fontWeight: 500 }}>问题簇</div>
          <div style={{ fontSize: 38, fontWeight: 700, letterSpacing: "-1.5px", lineHeight: 1, marginTop: 6, color: "#1B1C1E" }}>3</div>
          <div style={{ marginTop: 10, fontSize: 11, color: "#8A8F98" }}>1 焦点 · 1 查重 · 1 待办</div>
        </div>
        <div style={{ background: "#FFFFFF", border: "1px solid #E6E6E4", borderRadius: 14, padding: 18, boxShadow: "0 1px 2px rgba(0,0,0,.03)" }}>
          <div style={{ fontSize: 11.5, color: "#8A8F98", fontWeight: 500 }}>原始信号 → 焦点</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 7, marginTop: 6 }}>
            <span style={{ fontSize: 38, fontWeight: 700, letterSpacing: "-1.5px", lineHeight: 1, color: "#1B1C1E" }}>27</span>
            <span style={{ fontSize: 13, color: "#8A8F98", paddingBottom: 5 }}>→ 1 深挖</span>
          </div>
          <div style={{ marginTop: 10, fontSize: 11, color: "#8A8F98" }}>LLM 调用 0 · replay</div>
        </div>
      </div>

      {/* funnel */}
      <div style={{ background: "#FFFFFF", border: "1px solid #E6E6E4", borderRadius: 14, padding: "20px 22px", boxShadow: "0 1px 2px rgba(0,0,0,.03)", marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
          <span style={{ width: 3, height: 15, background: "#1B1C1E", borderRadius: 2 }} />
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>决策漏斗</h2>
          <span style={{ fontSize: 11, color: "#8A8F98" }}>过滤 · 查重 · 分流</span>
        </div>
        <div style={{ display: "flex", alignItems: "stretch", gap: 6 }}>
          {D.FUNNEL.map((s, i) => (
            <div key={s.en} style={{ flex: 1, display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ flex: 1, background: "#F4F4F3", borderRadius: 10, padding: "16px 14px", textAlign: "center", border: "1px solid #ECECEA" }}>
                <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-1px", lineHeight: 1, color: "#1B1C1E" }}>{s.count}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#1B1C1E", marginTop: 7 }}>{s.stage}</div>
                <div style={{ fontSize: 10, color: "#8A8F98", fontFamily: "'JetBrains Mono',monospace", marginTop: 2 }}>{s.en}</div>
                <div style={{ fontSize: 10.5, color: "#8A8F98", marginTop: 7, lineHeight: 1.4 }}>{s.note}</div>
              </div>
              {i !== D.FUNNEL.length - 1 && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D8D8D6" strokeWidth="2" style={{ flexShrink: 0 }}><path d="M5 12h14M13 6l6 6-6 6" /></svg>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* recommendation */}
      <div style={{ background: "linear-gradient(135deg,#F4F4F3,#FFFFFF)", border: "1px solid #E6E6E4", borderRadius: 14, padding: "22px 24px", display: "flex", gap: 16, alignItems: "flex-start" }}>
        <div style={{ flexShrink: 0, width: 40, height: 40, borderRadius: 11, background: "#1B1C1E", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2Z" /></svg>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 7 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>P0 建议结论</h2>
            <span style={{ fontSize: 10.5, fontWeight: 700, color: "#FFFFFF", background: "#1B1C1E", padding: "2px 9px", borderRadius: 6 }}>now</span>
          </div>
          <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.7, color: "#56595F", textWrap: "pretty" } as object}>{D.OPPORTUNITY.rationale}</p>
        </div>
      </div>
    </section>
  );
}

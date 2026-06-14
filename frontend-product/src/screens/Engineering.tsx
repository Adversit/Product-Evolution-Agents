// Screen 5 — 研发执行. Code-impact core modules (⚠ core / risk tiers + verify
// points), 待确认模块, 建议实施顺序, 任务卡 (4 of 12), 风险与缓解 (5).
import type { CSSProperties } from "react";
import { useData } from "../data/DataContext";
import { pill } from "../lib/theme";
import { EvidenceChip } from "../components/Evidence";

const riskMeta: Record<string, { l: string; c: string; bg: string; bd: string }> = {
  high: { l: "high risk", c: "#1B1C1E", bg: "#F4F4F3", bd: "#D8D8D6" },
  low: { l: "low risk", c: "#1B1C1E", bg: "#F4F4F3", bd: "#D8D8D6" },
  medium: { l: "med risk", c: "#8A8F98", bg: "#F4F4F3", bd: "#E6E6E4" },
};
const typeMeta: Record<string, { c: string; bg: string; bd: string }> = {
  data: { c: "#1B1C1E", bg: "#F4F4F3", bd: "#E6E6E4" },
  backend: { c: "#1B1C1E", bg: "#F4F4F3", bd: "#E6E6E4" },
  frontend: { c: "#8A8F98", bg: "#F4F4F3", bd: "#E6E6E4" },
};

const sectionMark = (color: string): CSSProperties => ({ width: 3, height: 15, background: color, borderRadius: 2 });

export default function Engineering() {
  const D = useData();
  const risks = D.RISKS.map((r, i) => {
    const ci = r.indexOf("：");
    return { head: ci > 0 ? r.slice(0, ci) : "风险 " + (i + 1), body: ci > 0 ? r.slice(ci + 1) : r, idx: String(i + 1).padStart(2, "0") };
  });

  return (
    <section style={{ maxWidth: 1180, margin: "0 auto", padding: "30px 34px 64px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".4px", color: "#8A8F98", fontFamily: "'JetBrains Mono',monospace" }}>研发 · ENGINEERING</span>
      </div>
      <h1 style={{ fontSize: 23, fontWeight: 700, letterSpacing: "-.4px", margin: "0 0 4px" }}>研发执行报告</h1>
      <p style={{ margin: "0 0 24px", fontSize: 13, color: "#8A8F98", maxWidth: 760, lineHeight: 1.6 }}>代码影响面分析定位 3 个核心模块（需人工确认改造可行性），并拆解为 12 张任务卡按依赖顺序实施。</p>

      {/* code impact */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 13 }}>
        <span style={sectionMark("#1B1C1E")} />
        <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>代码影响面</h2>
        <span style={{ fontSize: 11, color: "#8A8F98" }}>⚠ 标记为核心模块，需人工确认</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 13, marginBottom: 18 }}>
        {D.CODE_IMPACT.map((m) => {
          const rm = riskMeta[m.risk] || riskMeta.medium;
          return (
            <div key={m.module} style={{ background: "#FFFFFF", border: "1px solid " + (m.core ? "#D8D8D6" : "#E6E6E4"), borderRadius: 12, padding: "16px 17px", boxShadow: "0 1px 2px rgba(0,0,0,.03)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#1B1C1E", fontFamily: "'JetBrains Mono',monospace" }}>{m.module}</span>
                {m.core && <span style={{ fontSize: 10, fontWeight: 700, color: "#1B1C1E", background: "#F4F4F3", border: "1px solid #D8D8D6", padding: "2px 7px", borderRadius: 5 }}>⚠ 核心</span>}
                <span style={{ marginLeft: "auto" }} />
                <span style={pill(rm)}>{rm.l}</span>
              </div>
              <p style={{ margin: "0 0 11px", fontSize: 12, lineHeight: 1.65, color: "#56595F", textWrap: "pretty" } as object}>{m.desc}</p>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: ".3px", color: "#8A8F98", marginBottom: 7 }}>{m.types.join(" · ")}</div>
              <div style={{ borderTop: "1px solid #ECECEA", paddingTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                {m.verify.map((v, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, fontSize: 11, lineHeight: 1.55, color: "#8A8F98" }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#8A8F98" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 3 }}><path d="M20 6 9 17l-5-5" /></svg>
                    <span style={{ textWrap: "pretty" } as object}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* uncertain + order */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 13, marginBottom: 30 }}>
        <div style={{ background: "#FFFFFF", border: "1px solid #E6E6E4", borderRadius: 12, padding: "16px 17px" }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 11 }}>
            待确认模块 <span style={{ fontWeight: 500, color: "#8A8F98", fontSize: 11 }}>uncertain</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {D.CODE_UNCERTAIN.map((u) => (
              <div key={u.module} style={{ display: "flex", gap: 9 }}>
                <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 700, color: "#8A8F98", fontFamily: "'JetBrains Mono',monospace", paddingTop: 1 }}>{u.module}</span>
                <span style={{ fontSize: 11.5, lineHeight: 1.6, color: "#8A8F98", textWrap: "pretty" } as object}>{u.note}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ background: "#FFFFFF", border: "1px solid #E6E6E4", borderRadius: 12, padding: "16px 17px" }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 12 }}>建议实施顺序</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
            {D.SUGGESTED_ORDER.map((o) => (
              <span key={o} style={{ fontSize: 11, fontFamily: "'JetBrains Mono',monospace", color: "#56595F", background: "#F4F4F3", border: "1px solid #E6E6E4", padding: "3px 8px", borderRadius: 6 }}>{o}</span>
            ))}
          </div>
        </div>
      </div>

      {/* tasks */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 13 }}>
        <span style={sectionMark("#1B1C1E")} />
        <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>任务卡</h2>
        <span style={{ fontSize: 11, color: "#8A8F98" }}>关键 4 张（共 12 张）</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 11, marginBottom: 30 }}>
        {D.TASKS.slice(0, 4).map((t) => {
          const tm = typeMeta[t.type] || typeMeta.backend;
          const rm = riskMeta[t.risk] || riskMeta.medium;
          return (
            <div key={t.id} style={{ background: "#FFFFFF", border: "1px solid #E6E6E4", borderRadius: 12, padding: "15px 17px", boxShadow: "0 1px 2px rgba(0,0,0,.03)", display: "flex", gap: 14, alignItems: "flex-start" }}>
              <div style={{ flexShrink: 0, fontSize: 11, fontWeight: 700, color: "#8A8F98", fontFamily: "'JetBrains Mono',monospace", background: "#F4F4F3", padding: "4px 8px", borderRadius: 7, marginTop: 1 }}>{t.id}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 7, marginBottom: 7 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 700, color: "#1B1C1E" }}>{t.title}</span>
                  <span style={pill(tm)}>{t.type}</span>
                  <span style={pill(rm)}>{rm.l}</span>
                </div>
                <p style={{ margin: "0 0 9px", fontSize: 12, lineHeight: 1.65, color: "#56595F", textWrap: "pretty" } as object}>{t.desc}</p>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 10.5, color: "#8A8F98", fontFamily: "'JetBrains Mono',monospace" }}>{t.modules.join(" · ")}</span>
                  <span style={{ color: "#E6E6E4" }}>·</span>
                  {t.evidence_refs.map((r) => (
                    <EvidenceChip key={r} refId={r} />
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* risks */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 13 }}>
        <span style={sectionMark("#8A8F98")} />
        <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>风险与缓解</h2>
        <span style={{ fontSize: 11, color: "#8A8F98" }}>5 项</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {risks.map((r) => (
          <div key={r.idx} style={{ background: "#FFFFFF", border: "1px solid #E6E6E4", borderRadius: 11, padding: "14px 16px", display: "flex", gap: 12 }}>
            <div style={{ flexShrink: 0, width: 24, height: 24, borderRadius: 7, background: "#F4F4F3", color: "#8A8F98", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace" }}>{r.idx}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: "#1B1C1E", marginBottom: 4, textWrap: "pretty" } as object}>{r.head}</div>
              <p style={{ margin: 0, fontSize: 11.5, lineHeight: 1.65, color: "#8A8F98", textWrap: "pretty" } as object}>{r.body}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// Screen 1 — 焦点需求 (HERO). req-01 detail: header badges, the 61→86 highlight
// card (score panel + radar + 10-dim strip), 4 collapsible Linear-style modules,
// and the competitor/tech evidence sidebar.
import { useState } from "react";
import type { CSSProperties } from "react";
import { useData } from "../data/DataContext";
import type { Competitor, Tech } from "../data/state";
import Radar from "../components/Radar";
import { EvidenceChip, useEvidence } from "../components/Evidence";
import { useEntrance } from "../hooks/useEntrance";
import { strengthMeta } from "../lib/theme";

export default function Hero() {
  const D = useData();
  const f = D.FOCUS;
  const { t, total, round, switchRound } = useEntrance(D.QUALITY.total_r1, D.QUALITY.total_r2);
  const [open, setOpen] = useState({ pain: true, stories: false, ac: false, scope: false });

  const allOpen = open.pain && open.stories && open.ac && open.scope;
  const toggleAll = () => {
    const v = !allOpen;
    setOpen({ pain: v, stories: v, ac: v, scope: v });
  };

  const tglBase: CSSProperties = { border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 11.5, fontWeight: 600, padding: "4px 12px", borderRadius: 6, whiteSpace: "nowrap" };
  const tglR1: CSSProperties = round === 1 ? { ...tglBase, background: "#FFFFFF", color: "#1B1C1E", boxShadow: "0 1px 2px rgba(0,0,0,.10)" } : { ...tglBase, background: "transparent", color: "#8A8F98" };
  const tglR2: CSSProperties = round === 2 ? { ...tglBase, background: "#FFFFFF", color: "#5E6AD2", boxShadow: "0 1px 2px rgba(0,0,0,.10)" } : { ...tglBase, background: "transparent", color: "#8A8F98" };

  return (
    <section style={{ maxWidth: 1180, margin: "0 auto", padding: "30px 34px 64px" }}>
      {/* requirement header */}
      <div style={{ animation: "fadeup .5s ease both" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 12 }}>
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".4px", color: "#8A8F98", fontFamily: "'JetBrains Mono',monospace" }}>焦点需求 · req-01</span>
          <span style={{ fontSize: 11, color: "#8A8F98" }}>源自簇 clu-01</span>
        </div>
        <h1 style={{ fontSize: 27, lineHeight: 1.28, fontWeight: 700, letterSpacing: "-.5px", margin: 0, maxWidth: 880, textWrap: "pretty" } as object}>{f.title}</h1>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 16 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, whiteSpace: "nowrap", fontSize: 12, fontWeight: 700, color: "#FFFFFF", background: "#1B1C1E", padding: "4px 11px", borderRadius: 7 }}>P0 · NOW</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: "#1A7F37", background: "#E9F6EC", border: "1px solid #BCE3C4", padding: "4px 11px", borderRadius: 7, whiteSpace: "nowrap" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#1A7F37" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
            门禁 PASS
          </span>
          {["候选 candidate", "评审第 2 轮", "机会总分 86.6"].map((b) => (
            <span key={b} style={{ fontSize: 12, fontWeight: 500, color: "#56595F", background: "#F4F4F3", border: "1px solid #E6E6E4", padding: "4px 11px", borderRadius: 7, whiteSpace: "nowrap" }}>{b}</span>
          ))}
        </div>
      </div>

      {/* HIGHLIGHT card */}
      <div style={{ marginTop: 24, background: "#FFFFFF", border: "1px solid #E6E6E4", borderRadius: 16, boxShadow: "0 1px 2px rgba(0,0,0,.04)", overflow: "hidden", animation: "fadeup .55s .05s ease both" }}>
        <div style={{ display: "grid", gridTemplateColumns: "296px 1fr", minHeight: 312 }}>
          {/* left: score panel */}
          <div style={{ padding: "26px 26px 22px", borderRight: "1px solid #ECECEA", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: "#56595F" }}>需求质量评分</div>
              <div style={{ display: "inline-flex", background: "#F4F4F3", border: "1px solid #E6E6E4", borderRadius: 8, padding: 2 }}>
                <button onClick={() => switchRound(1)} style={tglR1}>初评</button>
                <button onClick={() => switchRound(2)} style={tglR2}>终评</button>
              </div>
            </div>

            <div style={{ marginTop: 18, display: "flex", alignItems: "flex-end", gap: 10 }}>
              <div style={{ fontSize: 78, lineHeight: 0.9, fontWeight: 700, letterSpacing: "-3px", color: "#1B1C1E", fontVariantNumeric: "tabular-nums" }}>{total}</div>
              <div style={{ paddingBottom: 12 }}>
                <div style={{ fontSize: 13, color: "#8A8F98", fontWeight: 500 }}>/ 100</div>
              </div>
            </div>

            <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12.5, fontWeight: 700, color: "#1A7F37", background: "#E9F6EC", border: "1px solid #BCE3C4", padding: "3px 9px", borderRadius: 7 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#1A7F37" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 7-7 7 7" /><path d="M12 19V5" /></svg>
                +25
              </span>
              <span style={{ fontSize: 12, color: "#56595F" }}>enrich 后跃升</span>
            </div>

            <div style={{ marginTop: 18, padding: "13px 14px", background: "#FFFFFF", border: "1px solid #ECECEA", borderRadius: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                <span style={{ fontWeight: 600, color: "#8A8F98" }}>needs_enrich</span>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#8A8F98" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
                <span style={{ fontWeight: 700, color: "#1A7F37" }}>pass</span>
                <span style={{ marginLeft: "auto", fontSize: 11, color: "#8A8F98" }}>门禁状态</span>
              </div>
            </div>

            <div style={{ marginTop: "auto", paddingTop: 18, display: "flex", flexDirection: "column", gap: 9 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5, color: "#56595F" }}>
                <span style={{ width: 22, height: 3, borderRadius: 2, background: "#A9ACA9" }} /> 初评 round 1 · 61
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5, color: "#56595F" }}>
                <span style={{ width: 22, height: 3, borderRadius: 2, background: "#5E6AD2" }} /> 终评 round 2 · 86
              </div>
            </div>
          </div>

          {/* right: radar */}
          <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "center", minWidth: 0 }}>
            <Radar dims={D.QUALITY.dims} t={t} round={round} />
          </div>
        </div>

        {/* 10-dim breakdown strip */}
        <div style={{ borderTop: "1px solid #ECECEA", padding: "16px 24px 20px", background: "#F4F4F3" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 13 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".4px", color: "#56595F" }}>10 维明细</div>
            <span style={{ fontSize: 10.5, color: "#8A8F98" }}>初评 → 终评，点击上方切换强调</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(196px, 1fr))", gap: "12px 28px" }}>
            {D.QUALITY.dims.map((d) => (
              <div key={d.name}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", fontSize: 11.5, marginBottom: 4 }}>
                  <span style={{ color: "#1B1C1E", fontWeight: 500 }}>{D.DIM_LABELS[d.name] || d.name}</span>
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10.5 }}>
                    <span style={{ color: "#A9ACA9" }}>{d.r1}</span>
                    <span style={{ color: "#D8D8D6" }}> → </span>
                    <span style={{ color: "#1B1C1E", fontWeight: 600 }}>{d.r2}</span>
                  </span>
                </div>
                <div style={{ position: "relative", height: 5, background: "#ECECEA", borderRadius: 3 }}>
                  <div style={{ position: "absolute", left: 0, top: 0, height: 5, borderRadius: 3, background: "#C9C9C7", width: d.r1 * t + "%" }} />
                  <div style={{ position: "absolute", left: 0, top: 0, height: 5, borderRadius: 3, background: "#5E6AD2", width: d.r2 * t + "%", transition: "width .7s cubic-bezier(.22,.61,.36,1)" }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* body: two column */}
      <div style={{ marginTop: 26, display: "flex", flexWrap: "wrap", gap: 26, alignItems: "flex-start" }}>
        {/* main column */}
        <div style={{ flex: "999 1 440px", minWidth: "min(100%, 440px)", display: "flex", flexDirection: "column", gap: 14 }}>
          <DetailToolbar allOpen={allOpen} onToggle={toggleAll} />
          <PainModule open={open.pain} onToggle={() => setOpen((s) => ({ ...s, pain: !s.pain }))} />
          <StoriesModule open={open.stories} onToggle={() => setOpen((s) => ({ ...s, stories: !s.stories }))} />
          <AcModule open={open.ac} onToggle={() => setOpen((s) => ({ ...s, ac: !s.ac }))} />
          <ScopeModule open={open.scope} onToggle={() => setOpen((s) => ({ ...s, scope: !s.scope }))} />
        </div>

        {/* right sidebar */}
        <div style={{ flex: "1 1 300px", minWidth: 280, display: "flex", flexDirection: "column", gap: 18 }}>
          <CompetitorPanel />
          <TechPanel />
        </div>
      </div>
    </section>
  );
}

/* ---------- shared module shell ---------- */
function ModuleHeader({ title, summary, open, onToggle }: { title: string; summary?: string; open: boolean; onToggle: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onToggle}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", background: hover ? "#FAFAFA" : "transparent", border: "none", cursor: "pointer", fontFamily: "inherit", padding: "14px 18px", textAlign: "left" }}
    >
      <h2 style={{ fontSize: 14.5, fontWeight: 600, margin: 0, letterSpacing: "-.2px", color: "#1B1C1E", whiteSpace: "nowrap", flexShrink: 0 }}>{title}</h2>
      {summary && <span style={{ fontSize: 11.5, color: "#8A8F98", flex: "0 1 auto", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{summary}</span>}
      <span style={{ flex: 1 }} />
      <svg style={{ width: 15, height: 15, transition: "transform .2s cubic-bezier(.22,.61,.36,1)", transform: `rotate(${open ? 0 : -90}deg)`, color: "#8A8F98", flexShrink: 0 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
    </button>
  );
}

const moduleCard: CSSProperties = { background: "#FFFFFF", border: "1px solid #E6E6E4", borderRadius: 12, boxShadow: "0 1px 2px rgba(0,0,0,.03)", overflow: "hidden" };

function DetailToolbar({ allOpen, onToggle }: { allOpen: boolean; onToggle: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
      <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".3px", color: "#8A8F98" }}>需求详情</span>
      <div style={{ flex: 1, height: 1, background: "#E6E6E4" }} />
      <button
        onClick={onToggle}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", background: hover ? "#F4F4F3" : "#FFFFFF", border: "1px solid #E6E6E4", borderRadius: 7, padding: "5px 11px", fontFamily: "inherit", fontSize: 11.5, fontWeight: 500, color: hover ? "#1B1C1E" : "#56595F", whiteSpace: "nowrap" }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m7 15 5 5 5-5M7 9l5-5 5 5" /></svg>
        {allOpen ? "收起全部" : "展开全部"}
      </button>
    </div>
  );
}

function PainModule({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const f = useData().FOCUS;
  return (
    <div style={moduleCard}>
      <ModuleHeader title="痛点与背景" summary="用户痛点 · 背景 · 目标用户" open={open} onToggle={onToggle} />
      {open && (
        <div style={{ borderTop: "1px solid #ECECEA", padding: "16px 18px 18px" }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#1B1C1E", marginBottom: 6 }}>用户痛点</div>
          <p style={{ margin: "0 0 16px", fontSize: 13.5, lineHeight: 1.75, color: "#56595F", textWrap: "pretty" } as object}>{f.pain_point}</p>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#56595F", marginBottom: 6 }}>背景</div>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.75, color: "#56595F", textWrap: "pretty" } as object}>{f.background}</p>
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid #ECECEA" }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#56595F", marginBottom: 9 }}>目标用户</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
              {f.target_users.map((u) => (
                <span key={u} style={{ fontSize: 12, color: "#56595F", background: "#F4F4F3", border: "1px solid #E6E6E4", padding: "5px 11px", borderRadius: 7 }}>{u}</span>
              ))}
            </div>
          </div>
          <div style={{ marginTop: 16, padding: "13px 15px", background: "#F4F4F3", border: "1px solid #E6E6E4", borderRadius: 10 }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: "#1B1C1E", marginBottom: 5 }}>业务目标</div>
            <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.7, color: "#56595F", textWrap: "pretty" } as object}>{f.business_goal}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function StoriesModule({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const f = useData().FOCUS;
  return (
    <div style={moduleCard}>
      <ModuleHeader title="用户故事" summary="3 条 · 角色 / 场景 / 价值" open={open} onToggle={onToggle} />
      {open && (
        <div style={{ borderTop: "1px solid #ECECEA", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
          {f.user_stories.map((s, i) => (
            <div key={i} style={{ background: "#FAFAFA", border: "1px solid #ECECEA", borderRadius: 10, padding: "14px 16px" }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: "#1B1C1E", background: "#F0F0EF", padding: "3px 9px", borderRadius: 6 }}>{s.role}</span>
                <span style={{ fontSize: 11, color: "#8A8F98", background: "#F4F4F3", padding: "3px 9px", borderRadius: 6 }}>{s.scenario}</span>
              </div>
              <p style={{ margin: "0 0 12px", fontSize: 13.5, lineHeight: 1.7, color: "#1B1C1E", textWrap: "pretty" } as object}>{s.story_text}</p>
              <div style={{ display: "flex", gap: 8, padding: "9px 12px", background: "#F4F4F3", borderRadius: 8, marginBottom: 12 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8A8F98" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}><path d="M20 6 9 17l-5-5" /></svg>
                <span style={{ fontSize: 12, color: "#56595F", lineHeight: 1.6 }}>{s.benefit}</span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 10.5, color: "#8A8F98", marginRight: 2 }}>证据</span>
                {s.evidence_refs.map((r) => (
                  <EvidenceChip key={r} refId={r} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AcModule({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const f = useData().FOCUS;
  const acs = f.acceptance_criteria;
  return (
    <div style={moduleCard}>
      <ModuleHeader title="验收标准" summary="7 条 · 4 功能 / 3 非功能" open={open} onToggle={onToggle} />
      {open && (
        <div style={{ borderTop: "1px solid #ECECEA" }}>
          {acs.map((a, i) => {
            const isFn = a.type === "functional";
            const tagBase: CSSProperties = { fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 5 };
            return (
              <div key={i} style={{ display: "flex", gap: 13, padding: "15px 18px", borderBottom: "1px solid " + (i === acs.length - 1 ? "transparent" : "#ECECEA") }}>
                <div style={{ flexShrink: 0, width: 22, height: 22, borderRadius: 7, background: "#F0F0EF", color: "#1B1C1E", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace" }}>{String(i + 1).padStart(2, "0")}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
                    <span style={{ ...tagBase, color: isFn ? "#1B1C1E" : "#8A8F98", background: "#F4F4F3" }}>{isFn ? "功能" : "非功能"}</span>
                  </div>
                  <p style={{ margin: "0 0 9px", fontSize: 12.5, lineHeight: 1.7, color: "#56595F", textWrap: "pretty" } as object}>{a.text}</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {a.evidence_refs.map((r) => (
                      <EvidenceChip key={r} refId={r} />
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ScopeModule({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const f = useData().FOCUS;
  return (
    <div style={moduleCard}>
      <ModuleHeader title="范围 · 非目标 · 边界" open={open} onToggle={onToggle} />
      {open && (
        <div style={{ borderTop: "1px solid #ECECEA", padding: "14px 16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ background: "#FAFAFA", border: "1px solid #ECECEA", borderRadius: 10, padding: "14px 16px" }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 11, color: "#1B1C1E" }}>功能范围</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {f.scope.map((x, i) => (
                <div key={i} style={{ display: "flex", gap: 9, fontSize: 12, lineHeight: 1.6, color: "#56595F" }}>
                  <span style={{ flexShrink: 0, width: 5, height: 5, borderRadius: "50%", background: "#8A8F98", marginTop: 7 }} />
                  <span style={{ textWrap: "pretty" } as object}>{x}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ background: "#FAFAFA", border: "1px solid #ECECEA", borderRadius: 10, padding: "14px 16px" }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 11, color: "#1B1C1E" }}>
              非目标 <span style={{ fontWeight: 500, color: "#8A8F98", fontSize: 11 }}>本期不做</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {f.non_goals.map((x, i) => (
                <div key={i} style={{ display: "flex", gap: 9, fontSize: 12, lineHeight: 1.6, color: "#8A8F98" }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#8A8F98" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 4 }}><path d="M18 6 6 18M6 6l12 12" /></svg>
                  <span style={{ textWrap: "pretty" } as object}>{x}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ gridColumn: "span 2", background: "#FAFAFA", border: "1px solid #ECECEA", borderRadius: 10, padding: "14px 16px" }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 11, color: "#1B1C1E" }}>边界条件</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "9px 20px" }}>
              {f.boundary_conditions.map((x, i) => (
                <div key={i} style={{ display: "flex", gap: 9, fontSize: 12, lineHeight: 1.6, color: "#56595F" }}>
                  <span style={{ flexShrink: 0, width: 5, height: 5, borderRadius: "50%", background: "#8A8F98", marginTop: 7 }} />
                  <span style={{ textWrap: "pretty" } as object}>{x}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- competitor / tech sidebar ---------- */
function StrengthDot({ strength }: { strength: string }) {
  const m = strengthMeta(strength);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 9, fontWeight: 600, color: m.color }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: m.color }} />
      {m.label}
    </span>
  );
}

const vdMeta: Record<string, { label: string; color: string; bg: string; bd: string }> = {
  adopt: { label: "借鉴 ADOPT", color: "#1B1C1E", bg: "#F4F4F3", bd: "#D8D8D6" },
  avoid: { label: "避免 AVOID", color: "#1B1C1E", bg: "#F4F4F3", bd: "#D8D8D6" },
  watch: { label: "观察 WATCH", color: "#8A8F98", bg: "#F4F4F3", bd: "#E6E6E4" },
};
const groupTag = (m: { color: string; bg: string; bd: string }): CSSProperties => ({ display: "inline-flex", alignItems: "center", fontSize: 10, fontWeight: 700, letterSpacing: ".3px", padding: "2px 8px", borderRadius: 5, color: m.color, background: m.bg, border: "1px solid " + m.bd });

function CompetitorPanel() {
  const D = useData();
  const { open } = useEvidence();
  return (
    <div style={{ background: "#FFFFFF", border: "1px solid #E6E6E4", borderRadius: 12, padding: 16, boxShadow: "0 1px 2px rgba(0,0,0,.03)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 13 }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#56595F" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M16 3h5v5M21 3l-7 7M8 21H3v-5M3 21l7-7" /></svg>
        <h3 style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>竞品依据</h3>
        <span style={{ marginLeft: "auto", fontSize: 10.5, color: "#8A8F98" }}>按 verdict</span>
      </div>
      {(["adopt", "avoid", "watch"] as const).map((v) => {
        const items = D.COMPETITORS.filter((c) => c.verdict === v);
        return (
          <div key={v} style={{ marginBottom: 13 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 7 }}>
              <span style={groupTag(vdMeta[v])}>{vdMeta[v].label}</span>
              <span style={{ fontSize: 10.5, color: "#8A8F98" }}>{items.length} 项</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {items.map((c) => (
                <CompetitorCard
                  key={c.id}
                  c={c}
                  onClick={(e) =>
                    open(c.id, e, D.EVIDENCE[c.id] || { type: "competitor", strength: c.strength, source: "mock://", text: c.conclusion })
                  }
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CompetitorCard({ c, onClick }: { c: Competitor; onClick: (e: React.MouseEvent) => void }) {
  const [hover, setHover] = useState(false);
  const short = c.conclusion.length > 60 ? c.conclusion.slice(0, 58) + "…" : c.conclusion;
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ textAlign: "left", cursor: "pointer", background: hover ? "#F4F4F3" : "#FFFFFF", border: "1px solid " + (hover ? "#E6E6E4" : "#ECECEA"), borderRadius: 8, padding: "8px 10px", display: "flex", flexDirection: "column", gap: 3, width: "100%" }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "#1B1C1E" }}>{c.competitor}</span>
        <span style={{ fontSize: 9.5, color: "#8A8F98", fontFamily: "'JetBrains Mono',monospace" }}>{c.id}</span>
        <span style={{ marginLeft: "auto" }}>
          <StrengthDot strength={c.strength} />
        </span>
      </div>
      <div style={{ fontSize: 11, lineHeight: 1.5, color: "#8A8F98", textWrap: "pretty" } as object}>{short}</div>
    </button>
  );
}

const mtMeta: Record<string, { label: string; color: string; bg: string; bd: string }> = {
  reference: { label: "参考实现", color: "#1B1C1E", bg: "#F4F4F3", bd: "#E6E6E4" },
  experimental: { label: "实验性", color: "#8A8F98", bg: "#F4F4F3", bd: "#E6E6E4" },
  high_risk: { label: "高风险", color: "#1B1C1E", bg: "#F4F4F3", bd: "#D8D8D6" },
  mature: { label: "成熟", color: "#1B1C1E", bg: "#F4F4F3", bd: "#D8D8D6" },
};
const costMeta: Record<string, { l: string; c: string }> = { low: { l: "low", c: "#1B1C1E" }, medium: { l: "med", c: "#8A8F98" }, high: { l: "high", c: "#1B1C1E" } };

function TechPanel() {
  const D = useData();
  const { open } = useEvidence();
  return (
    <div style={{ background: "#FFFFFF", border: "1px solid #E6E6E4", borderRadius: 12, padding: 16, boxShadow: "0 1px 2px rgba(0,0,0,.03)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 13 }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#56595F" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2 2 7l10 5 10-5-10-5ZM2 17l10 5 10-5M2 12l10 5 10-5" /></svg>
        <h3 style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>技术方案</h3>
        <span style={{ marginLeft: "auto", fontSize: 10.5, color: "#8A8F98" }}>按成熟度</span>
      </div>
      {(["reference", "experimental", "high_risk", "mature"] as const).map((m) => {
        const items = D.TECH.filter((tt) => tt.maturity === m);
        if (items.length === 0) return null;
        return (
          <div key={m} style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 7 }}>
              <span style={groupTag(mtMeta[m])}>{mtMeta[m].label}</span>
              <span style={{ fontSize: 10.5, color: "#8A8F98" }}>{items.length} 项</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {items.map((tt) => (
                <TechRow
                  key={tt.id}
                  t={tt}
                  onClick={(e) =>
                    open(tt.id, e, D.EVIDENCE[tt.id] || { type: "tech", strength: tt.strength, source: "mock://tech_notes/*", text: tt.fit })
                  }
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TechRow({ t, onClick }: { t: Tech; onClick: (e: React.MouseEvent) => void }) {
  const [hover, setHover] = useState(false);
  const cm = costMeta[t.cost] || costMeta.medium;
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ textAlign: "left", cursor: "pointer", background: hover ? "#FFFFFF" : "transparent", border: "none", borderRadius: 7, padding: "6px 8px", display: "flex", alignItems: "center", gap: 8, width: "100%" }}
    >
      <span style={{ fontSize: 11.5, lineHeight: 1.4, color: "#56595F", flex: 1, textWrap: "pretty" } as object}>{t.name}</span>
      <span style={{ fontSize: 9.5, fontWeight: 600, color: cm.c, flexShrink: 0 }}>{cm.l}</span>
    </button>
  );
}

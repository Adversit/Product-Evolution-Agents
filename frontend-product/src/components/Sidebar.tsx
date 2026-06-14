// Left nav — 6 decision-flow screens, active-state styling, off-white #FBFBFA.
import type { CSSProperties, ReactNode } from "react";
import type { Screen } from "../App";
import { useData } from "../data/DataContext";

const navBase: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  width: "100%",
  border: "none",
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 500,
  fontFamily: "inherit",
  padding: "8px 10px",
  borderRadius: 8,
};
const navOn: CSSProperties = { ...navBase, background: "#ECEBE8", color: "#1B1C1E", fontWeight: 600 };
const navOff: CSSProperties = { ...navBase, background: "transparent", color: "#56595F" };

function NavItem({ active, onClick, icon, label, badge }: { active: boolean; onClick: () => void; icon: ReactNode; label: string; badge?: ReactNode }) {
  return (
    <button onClick={onClick} style={active ? navOn : navOff}>
      {icon}
      <span style={{ flex: 1, textAlign: "left" }}>{label}</span>
      {badge}
    </button>
  );
}

const icons: Record<Screen, ReactNode> = {
  hero: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v8" /><path d="m4.93 10.93 1.41 1.41" /><path d="M2 18h2" /><path d="M20 18h2" /><path d="m19.07 10.93-1.41 1.41" /><path d="M22 22H2" /><path d="m8 22 4-10 4 10" /></svg>
  ),
  overview: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect width="7" height="9" x="3" y="3" rx="1" /><rect width="7" height="5" x="14" y="3" rx="1" /><rect width="7" height="9" x="14" y="12" rx="1" /><rect width="7" height="5" x="3" y="16" rx="1" /></svg>
  ),
  clusters: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="5" r="3" /><circle cx="5" cy="19" r="3" /><circle cx="19" cy="19" r="3" /><path d="M12 8v3M6.5 16.5 10 11M17.5 16.5 14 11" /></svg>
  ),
  opportunity: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18" /><path d="m19 9-5 5-4-4-3 3" /></svg>
  ),
  eng: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="m18 16 4-4-4-4" /><path d="m6 8-4 4 4 4" /><path d="m14.5 4-5 16" /></svg>
  ),
  reports: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><path d="M14 2v5h5" /><path d="M9 13h6M9 17h6" /></svg>
  ),
};

export default function Sidebar({ screen, go }: { screen: Screen; go: (s: Screen) => void }) {
  const p = useData().PRODUCT;
  return (
    <aside style={{ width: 244, flexShrink: 0, background: "#FBFBFA", borderRight: "1px solid #ECECEA", display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ padding: "20px 18px 16px", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: "#1B1C1E", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2 2 7l10 5 10-5-10-5Z" /><path d="m2 17 10 5 10-5" /><path d="m2 12 10 5 10-5" /></svg>
        </div>
        <div style={{ lineHeight: 1.1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: "-.2px" }}>EvoPM</div>
          <div style={{ fontSize: 11, color: "#8A8F98", fontWeight: 500 }}>决策工作台</div>
        </div>
      </div>

      <div style={{ padding: "6px 12px 4px" }}>
        <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: ".6px", color: "#8A8F98", padding: "8px 8px 6px" }}>决策流程</div>
      </div>
      <nav style={{ display: "flex", flexDirection: "column", gap: 2, padding: "0 12px" }}>
        <NavItem active={screen === "hero"} onClick={() => go("hero")} icon={icons.hero} label="焦点需求" badge={<span style={{ fontSize: 10, fontWeight: 700, color: "#FFFFFF", background: "#1B1C1E", padding: "1px 6px", borderRadius: 5 }}>P0</span>} />
        <NavItem active={screen === "overview"} onClick={() => go("overview")} icon={icons.overview} label="概览仪表盘" />
        <NavItem active={screen === "clusters"} onClick={() => go("clusters")} icon={icons.clusters} label="问题簇总览" />
        <NavItem active={screen === "opportunity"} onClick={() => go("opportunity")} icon={icons.opportunity} label="机会评分 · 路线图" />
        <NavItem active={screen === "eng"} onClick={() => go("eng")} icon={icons.eng} label="研发执行" />
        <NavItem active={screen === "reports"} onClick={() => go("reports")} icon={icons.reports} label="报告中心" />
      </nav>

      <div style={{ marginTop: "auto", padding: "14px 18px", borderTop: "1px solid #ECECEA" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "#8A8F98" }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#1A7F37", boxShadow: "0 0 0 3px rgba(24,24,27,.10)" }} />
          {(p.runMode || "replay")} 运行 · LLM 调用 {p.llmCalls}
        </div>
      </div>
    </aside>
  );
}

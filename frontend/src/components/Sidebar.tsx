import { COLORS } from "../lib/theme";
import { useLive } from "../lib/live";
import { STATE, type SampleState } from "../data/state";
import type { FunnelStats } from "../lib/api";

interface Props {
  located: string | null;
  onLocate: (id: string) => void;
}

type AnomalyKind = "amber" | "rose" | "violet" | "emerald";
interface Anomaly {
  label: string;
  detail: string;
  count: string;
  kind: AnomalyKind;
  node: string;
}

const ANOMALY_COLOR: Record<AnomalyKind, string> = {
  amber: COLORS.warn, rose: COLORS.danger, violet: COLORS.loop, emerald: COLORS.done,
};

// Build the problem-locator list from the current state (live /api/state or fallback).
// Counts are derived where cheap; copy stays faithful to the ported design.
function buildAnomalies(s: SampleState): Anomaly[] {
  const mockCount =
    s.competitor_findings.filter((f) => f.source_url?.startsWith("mock://")).length +
    s.tech_findings.filter((f) => f.source_url?.startsWith("mock://")).length;
  const dupClusters = s.clusters.filter((c) => c.duplicate_of_existing);
  const demote = s.critic_review.findings.filter((f) => f.demote_to_observation).length;
  const pending = s.critic_review.pending_confirmations.length;
  const r1 = s.focus_candidate.quality_history?.[0];
  const redo = s.critic_review.redo_target;
  return [
    { label: "mock:// 证据降级", detail: `competitor + tech 共 ${mockCount} 条来源为 mock`, count: String(mockCount), kind: "amber", node: "tech_research" },
    { label: "门禁不达标 (R1)", detail: `R1 total=${r1?.total ?? "—"} → needs_enrich`, count: r1 ? String(r1.total) : "R1", kind: "amber", node: "quality_gate" },
    { label: "簇判重 DUPLICATE", detail: dupClusters[0] ? `${dupClusters[0].id} → ${dupClusters[0].duplicate_of_existing}` : "无", count: String(dupClusters.length), kind: "violet", node: "discovery" },
    { label: "观察项 demote", detail: "critic demote_to_observation", count: String(demote), kind: "violet", node: "critic" },
    { label: "待人工确认 HITL", detail: `${pending} 项 pending_confirmations`, count: String(pending), kind: "amber", node: "human" },
    { label: "回炉 / 重入", detail: redo ? `redo_target=${redo}` : "redo 0/1 · 闭包 0 违规", count: redo ? "redo" : "OK", kind: redo ? "rose" : "emerald", node: "critic" },
  ];
}

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <div
    style={{
      fontSize: 11, fontWeight: 600, letterSpacing: 2, color: COLORS.ink3,
      textTransform: "uppercase", marginBottom: 11,
    }}
  >
    {children}
  </div>
);

const FunnelCell = ({ value, label, focus }: { value: string; label: string; focus?: boolean }) => (
  <div
    style={{
      flex: 1, textAlign: "center", padding: "11px 4px", borderRadius: 8,
      border: `1px solid ${focus ? "rgba(251,113,133,.4)" : COLORS.hairline}`,
      background: focus ? "rgba(251,113,133,.08)" : COLORS.panel,
    }}
  >
    <div style={{ font: "700 19px 'JetBrains Mono',monospace", color: focus ? COLORS.dangerSoft : COLORS.activeSoft }}>
      {value}
    </div>
    <div style={{ fontSize: 10, color: focus ? COLORS.ink2 : COLORS.ink3, marginTop: 2 }}>{label}</div>
  </div>
);

const Chevron = () => <div style={{ display: "flex", alignItems: "center", color: "#3a4250" }}>›</div>;

const RoundChip = ({ name, value, max, lit }: { name: string; value: number; max: number; lit?: boolean }) => (
  <div style={{ flex: 1, padding: 10, border: `1px solid ${COLORS.hairline}`, borderRadius: 8, background: COLORS.panel }}>
    <div style={{ font: "600 12px 'JetBrains Mono',monospace", color: lit ? COLORS.doneSoft : COLORS.ink3 }}>{name}</div>
    <div style={{ font: "700 16px 'JetBrains Mono',monospace", color: lit ? COLORS.ink : COLORS.ink3, marginTop: 3 }}>
      {value}
      <span style={{ color: "#4b5563", fontSize: 12 }}>/{max}</span>
    </div>
  </div>
);

export default function Sidebar({ located, onLocate }: Props) {
  const { state } = useLive();
  const s = (state as SampleState | null) ?? STATE;

  // Funnel: prefer the backend-derived block; otherwise compute from state.
  const live = state as (SampleState & { enrich_rounds?: number; derived?: { funnel?: FunnelStats } }) | null;
  const f: FunnelStats = live?.derived?.funnel ?? {
    total_signals: s.signals.length,
    filtered: s.signals.filter((x) => x.actionability === "insufficient" || x.actionability === "emotional" || x.actionability === "suspected_misuse").length,
    duplicates: s.signals.filter((x) => x.duplicate_of).length,
    clusters: s.clusters.length,
    dup_clusters: s.clusters.filter((c) => c.duplicate_of_existing).length,
    focus: s.selected_cluster_id ? 1 : 0,
  };
  const afterFilter = Math.max(0, f.total_signals - f.filtered);

  const enrichRounds = live?.enrich_rounds ?? (s.focus_candidate.quality_history?.length ?? 1) - 1;
  const redoActive = s.critic_review.redo_target ? 1 : 0;
  const llmCalls = s.llm_call_count ?? 0;
  const budgetMax = 30;
  const budgetDeg = Math.min(360, (llmCalls / budgetMax) * 360);

  const anomalies = buildAnomalies(s);

  return (
    <aside
      style={{
        width: 312, flexShrink: 0, borderLeft: `1px solid ${COLORS.hairline}`,
        background: "#0d1119", overflowY: "auto", padding: "18px 18px 24px",
      }}
    >
      <SectionLabel>漏斗 · Funnel</SectionLabel>
      <div style={{ display: "flex", alignItems: "stretch", gap: 6, marginBottom: 22 }}>
        <FunnelCell value={String(f.total_signals)} label="信号" />
        <Chevron />
        <FunnelCell value={String(afterFilter)} label="过滤后" />
        <Chevron />
        <FunnelCell value={String(f.clusters)} label="簇" />
        <Chevron />
        <FunnelCell value={String(f.focus)} label="焦点" focus />
      </div>

      <SectionLabel>轮次 &amp; 预算</SectionLabel>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <RoundChip name="enrich" value={enrichRounds} max={1} lit={enrichRounds > 0} />
        <RoundChip name="clarify" value={0} max={1} />
        <RoundChip name="redo" value={redoActive} max={1} lit={redoActive > 0} />
      </div>
      <div
        style={{
          display: "flex", alignItems: "center", gap: 13, padding: 13,
          border: `1px solid ${COLORS.hairline}`, borderRadius: 8, background: COLORS.panel, marginBottom: 22,
        }}
      >
        <div
          style={{
            width: 54, height: 54, borderRadius: "50%",
            background: `conic-gradient(#22D3EE ${budgetDeg}deg,#1b2230 ${budgetDeg}deg)`,
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}
        >
          <div
            style={{
              width: 42, height: 42, borderRadius: "50%", background: COLORS.panel,
              display: "flex", alignItems: "center", justifyContent: "center",
              font: "700 12px 'JetBrains Mono',monospace", color: COLORS.activeSoft,
            }}
          >
            {llmCalls}/{budgetMax}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.ink }}>LLM 调用预算</div>
          <div style={{ fontSize: 11, color: COLORS.ink3, marginTop: 3, fontFamily: "'JetBrains Mono',monospace" }}>
            {s.run_mode} 模式 · {llmCalls} 实时调用
          </div>
        </div>
      </div>

      <SectionLabel>异常定位 · click to locate</SectionLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {anomalies.map((a, i) => {
          const c = ANOMALY_COLOR[a.kind];
          const on = located === a.node;
          return (
            <div
              key={i}
              onClick={() => onLocate(a.node)}
              style={{
                display: "flex", alignItems: "center", gap: 10, padding: "10px 11px", borderRadius: 9,
                cursor: "pointer", transition: "border-color .2s, background .2s",
                border: `1px solid ${on ? c : COLORS.hairline}`,
                background: on ? "rgba(251,191,36,.06)" : COLORS.panel,
              }}
            >
              <span style={{ width: 9, height: 9, borderRadius: "50%", flexShrink: 0, background: c, boxShadow: `0 0 8px ${c}` }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: COLORS.ink }}>{a.label}</div>
                <div
                  style={{
                    fontSize: 10.5, color: COLORS.ink3, marginTop: 1, fontFamily: "'JetBrains Mono',monospace",
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  }}
                >
                  {a.detail}
                </div>
              </div>
              <span
                style={{
                  font: "700 12px 'JetBrains Mono',monospace", color: c, background: "rgba(148,163,184,.06)",
                  border: `1px solid ${COLORS.hairline}`, borderRadius: 6, padding: "2px 7px", flexShrink: 0,
                }}
              >
                {a.count}
              </span>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

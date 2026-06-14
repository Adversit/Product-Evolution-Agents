import type { ReactNode } from "react";
import { STATE, type SampleState } from "../data/state";
import { COLORS } from "../lib/theme";

export interface Inspector {
  title: string;
  subtitle: string;
  raw: unknown; // slice rendered in the raw-JSON view
  body: ReactNode; // structured view
}

/* ----------------------------- primitives ----------------------------- */

type Tone = "cyan" | "emerald" | "amber" | "rose" | "violet" | "slate";
const TONE: Record<Tone, [string, string]> = {
  cyan: [COLORS.activeSoft, "rgba(34,211,238,.30)"],
  emerald: [COLORS.doneSoft, "rgba(52,211,153,.30)"],
  amber: [COLORS.warnSoft, "rgba(251,191,36,.32)"],
  rose: [COLORS.dangerSoft, "rgba(251,113,133,.32)"],
  violet: [COLORS.loopSoft, "rgba(167,139,250,.32)"],
  slate: [COLORS.ink2, "#2a3340"],
};

function Badge({ children, tone = "slate" }: { children: ReactNode; tone?: Tone }) {
  const [c, b] = TONE[tone];
  return (
    <span
      style={{
        color: c, border: `1px solid ${b}`, background: "rgba(148,163,184,.05)",
        borderRadius: 5, padding: "1px 6px", font: "600 10px 'JetBrains Mono',monospace", whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

function Section({ title, count, children }: { title: string; count?: number | string; children: ReactNode }) {
  return (
    <section style={{ marginBottom: 18 }}>
      <div
        style={{
          display: "flex", alignItems: "center", gap: 7, marginBottom: 9,
          fontSize: 11, fontWeight: 600, letterSpacing: 1.6, color: COLORS.ink3, textTransform: "uppercase",
        }}
      >
        <span>{title}</span>
        {count !== undefined && (
          <span style={{ font: "600 10px 'JetBrains Mono',monospace", color: COLORS.ink2 }}>· {count}</span>
        )}
      </div>
      {children}
    </section>
  );
}

function Row({ k, v, mono = true, tone }: { k: string; v: ReactNode; mono?: boolean; tone?: Tone }) {
  return (
    <div style={{ display: "flex", gap: 10, padding: "4px 0", alignItems: "baseline" }}>
      <span style={{ font: "500 11px 'JetBrains Mono',monospace", color: COLORS.ink3, minWidth: 116, flexShrink: 0 }}>
        {k}
      </span>
      <span
        style={{
          fontSize: 12, lineHeight: 1.5, color: tone ? TONE[tone][0] : COLORS.ink,
          fontFamily: mono ? "'JetBrains Mono',monospace" : "Inter,sans-serif",
          wordBreak: "break-word",
        }}
      >
        {v}
      </span>
    </div>
  );
}

function Item({ children, accent }: { children: ReactNode; accent?: string }) {
  return (
    <div
      style={{
        border: `1px solid ${COLORS.hairline}`, borderLeft: `3px solid ${accent ?? COLORS.hairline}`,
        borderRadius: 8, background: COLORS.panel, padding: "9px 11px", marginBottom: 7,
      }}
    >
      {children}
    </div>
  );
}

function Prose({ children }: { children: ReactNode }) {
  return <div style={{ fontSize: 12, lineHeight: 1.55, color: "#c2cad6", marginTop: 5 }}>{children}</div>;
}

function Bullets({ items, accent }: { items: unknown[]; accent?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {items.map((it, i) => (
        <div key={i} style={{ display: "flex", gap: 8, fontSize: 12, lineHeight: 1.5, color: "#c2cad6" }}>
          <span style={{ color: accent ?? COLORS.ink3, flexShrink: 0, fontFamily: "'JetBrains Mono',monospace" }}>
            {String(i + 1).padStart(2, "0")}
          </span>
          <span style={{ wordBreak: "break-word" }}>
            {typeof it === "string" ? it : JSON.stringify(it)}
          </span>
        </div>
      ))}
    </div>
  );
}

function Refs({ ids }: { ids: string[] }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
      {ids.map((r) => (
        <span
          key={r}
          style={{
            font: "500 9.5px 'JetBrains Mono',monospace", color: COLORS.ink2,
            border: `1px solid ${COLORS.hairline}`, borderRadius: 4, padding: "1px 5px",
          }}
        >
          {r}
        </span>
      ))}
    </div>
  );
}

const BLOCKER_DIMS = new Set(["acceptance_clarity", "completeness", "evidence_sufficiency"]);

function DimBar({ name, score, blocker }: { name: string; score: number; blocker?: boolean }) {
  const low = score < 60;
  const color = low ? COLORS.danger : blocker ? COLORS.warn : COLORS.active;
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
        <span style={{ font: "500 11px 'JetBrains Mono',monospace", color: blocker ? COLORS.warnSoft : COLORS.ink2 }}>
          {name}
          {blocker && <span style={{ color: COLORS.warn }}> ★</span>}
        </span>
        <span style={{ marginLeft: "auto", font: "700 11px 'JetBrains Mono',monospace", color }}>{score}</span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: "#1b2230", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${score}%`, background: color, borderRadius: 3 }} />
      </div>
    </div>
  );
}

function mockBadge(url: string) {
  return url.startsWith("mock://") ? <Badge tone="amber">降级 mock://</Badge> : <Badge tone="emerald">live</Badge>;
}
const verdictTone = (v: string): Tone => (v === "adopt" ? "emerald" : v === "avoid" ? "rose" : "amber");
const strengthTone = (v: string): Tone => (v === "strong" ? "emerald" : v === "weak" ? "rose" : "amber");
const riskTone = (v: string): Tone => (v === "high" ? "rose" : v === "medium" ? "amber" : "slate");
const priorityTone = (v: string): Tone => (v === "P0" ? "rose" : v === "P1" ? "amber" : "cyan");

/* ----------------------------- inspectors ----------------------------- */

const buildInspectors = (S: SampleState): Record<string, () => Inspector> => ({
  intake: () => ({
    title: "intake · 信号分类",
    subtitle: "IntakeAgent.classify — 12 类 category / sentiment / actionability / data_quality",
    raw: { signals: S.signals },
    body: (
      <Section title="signals" count={`${S.signals.length} 条（样本）· 27→24 过滤`}>
        {S.signals.map((sig) => {
          const filtered = sig.actionability !== "real_issue";
          return (
            <Item key={sig.id} accent={filtered ? COLORS.danger : COLORS.active}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5, alignItems: "center", marginBottom: 4 }}>
                <Badge tone="slate">{sig.id}</Badge>
                <Badge tone="cyan">{sig.category}</Badge>
                <Badge tone={sig.sentiment === "negative" ? "rose" : "slate"}>{sig.sentiment}</Badge>
                <Badge tone={filtered ? "rose" : "emerald"}>{sig.actionability}</Badge>
                <Badge tone={sig.data_quality === "partial" ? "amber" : "slate"}>dq:{sig.data_quality}</Badge>
                {sig.duplicate_of && <Badge tone="violet">dup→{sig.duplicate_of}</Badge>}
              </div>
              <Prose>{sig.text}</Prose>
              <Row k="module_guess" v={sig.module_guess || "—"} />
            </Item>
          );
        })}
      </Section>
    ),
  }),

  discovery: () => ({
    title: "discovery · 聚类去重",
    subtitle: `DiscoveryAgent.cluster — selected_cluster_id = ${S.selected_cluster_id}`,
    raw: { clusters: S.clusters, selected_cluster_id: S.selected_cluster_id, existing_requirements: S.existing_requirements },
    body: (
      <>
        <Section title="clusters" count={S.clusters.length}>
          {S.clusters.map((c) => {
            const dup = !!c.duplicate_of_existing;
            const focus = c.id === S.selected_cluster_id;
            return (
              <Item key={c.id} accent={focus ? COLORS.danger : dup ? COLORS.loop : COLORS.active}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5, alignItems: "center", marginBottom: 4 }}>
                  <Badge tone={focus ? "rose" : "slate"}>{c.id}{focus ? " · 焦点" : ""}</Badge>
                  <Badge tone={c.severity === "critical" ? "rose" : c.severity === "high" ? "amber" : "slate"}>{c.severity}</Badge>
                  <Badge tone="cyan">freq={c.frequency}</Badge>
                  <Badge tone="slate">{c.status}</Badge>
                  {dup && <Badge tone="violet">DUPLICATE → {c.duplicate_of_existing}</Badge>}
                </div>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: COLORS.ink }}>{c.title}</div>
                <Prose>{c.summary}</Prose>
                <Row k="signal_ids" v={`${c.signal_ids.length} 条 · 闭包合法`} />
                <Refs ids={c.signal_ids} />
                {dup && <Row k="dedup_reason" v={c.dedup_reason} mono={false} tone="violet" />}
              </Item>
            );
          })}
        </Section>
        <Section title="existing_requirements" count={S.existing_requirements.length}>
          {S.existing_requirements.map((r) => (
            <Item key={r.id}>
              <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                <Badge tone="slate">{r.id}</Badge>
                <Badge tone={r.status === "in_roadmap" ? "amber" : "slate"}>{r.status}</Badge>
              </div>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: COLORS.ink, marginTop: 4 }}>{r.title}</div>
              <Prose>{r.summary}</Prose>
            </Item>
          ))}
        </Section>
      </>
    ),
  }),

  competitor_research: () => ({
    title: "competitor_research · 竞品调研",
    subtitle: "CompetitorAgent.research — verdict / evidence_strength / source_url",
    raw: { competitor_findings: S.competitor_findings },
    body: (
      <Section title="competitor_findings" count={S.competitor_findings.length}>
        {S.competitor_findings.map((f) => (
          <Item key={f.id} accent={f.verdict === "avoid" ? COLORS.danger : f.verdict === "adopt" ? COLORS.done : COLORS.warn}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, alignItems: "center", marginBottom: 4 }}>
              <Badge tone="slate">{f.id}</Badge>
              <Badge tone="cyan">{f.competitor}</Badge>
              <Badge tone={verdictTone(f.verdict)}>{f.verdict}</Badge>
              <Badge tone={f.has_solved ? "emerald" : "slate"}>has_solved={String(f.has_solved)}</Badge>
              <Badge tone={strengthTone(f.evidence_strength)}>ev:{f.evidence_strength}</Badge>
              {mockBadge(f.source_url)}
            </div>
            <Row k="research_q" v={f.research_question} mono={false} />
            <Prose>{f.conclusion}</Prose>
            <Row k="gap" v={f.gap_description} mono={false} />
            <Row k="implication" v={f.implication} mono={false} />
            <Row k="source_url" v={f.source_url} tone={f.source_url.startsWith("mock://") ? "amber" : "emerald"} />
          </Item>
        ))}
      </Section>
    ),
  }),

  tech_research: () => ({
    title: "tech_research · 技术调研",
    subtitle: "TechAgent.research — maturity / cost / risk / source_url",
    raw: { tech_findings: S.tech_findings },
    body: (
      <Section title="tech_findings" count={S.tech_findings.length}>
        {S.tech_findings.map((f) => (
          <Item key={f.id} accent={f.maturity === "experimental" ? COLORS.warn : COLORS.active}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, alignItems: "center", marginBottom: 4 }}>
              <Badge tone="slate">{f.id}</Badge>
              <Badge tone="cyan">{f.topic}</Badge>
              <Badge tone={f.maturity === "experimental" ? "amber" : "cyan"}>{f.maturity}</Badge>
              <Badge tone={strengthTone(f.evidence_strength)}>ev:{f.evidence_strength}</Badge>
              {mockBadge(f.source_url)}
            </div>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: COLORS.ink }}>{f.solution_name}</div>
            <Prose>{f.fit_reason}</Prose>
            <Row k="cost_estimate" v={f.cost_estimate} mono={false} />
            <Row k="risk" v={f.risk} mono={false} tone="amber" />
            <Row k="source_url" v={f.source_url} tone={f.source_url.startsWith("mock://") ? "amber" : "emerald"} />
          </Item>
        ))}
      </Section>
    ),
  }),

  quality_gate: () => {
    const q = S.focus_candidate.quality;
    const hist = S.focus_candidate.quality_history;
    const r1 = hist[0];
    return {
      title: "quality_gate · 质量门禁",
      subtitle: `RequirementAgent · gate — round ${q.round} · gate=${q.gate}`,
      raw: { quality: q, quality_history: hist },
      body: (
        <>
          <Section title="门禁判定（代码侧）">
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 4 }}>
              <Badge tone={q.gate === "pass" ? "emerald" : "amber"}>gate = {q.gate}</Badge>
              <Badge tone="cyan">R2 total = {q.total}</Badge>
              {r1 && <Badge tone="amber">R1 total = {r1.total} ({r1.gate})</Badge>}
            </div>
          </Section>
          <Section title="10 维分数" count="★ = blocker 维">
            {q.dimensions.map((d) => (
              <DimBar key={d.name} name={d.name} score={d.score} blocker={BLOCKER_DIMS.has(d.name)} />
            ))}
          </Section>
          <Section title="各维 rationale" count={q.dimensions.length}>
            {q.dimensions.map((d) => (
              <Item key={d.name} accent={BLOCKER_DIMS.has(d.name) ? COLORS.warn : COLORS.hairline}>
                <Row k={d.name} v={`score=${d.score}`} tone={d.score < 60 ? "rose" : "cyan"} />
                <Prose>{d.rationale}</Prose>
              </Item>
            ))}
          </Section>
          {q.ambiguities.length > 0 && (
            <Section title="ambiguities" count={q.ambiguities.length}>
              <Bullets items={q.ambiguities} accent={COLORS.warn} />
            </Section>
          )}
        </>
      ),
    };
  },

  enrich: () => {
    const hist = S.focus_candidate.quality_history;
    const r1 = hist[0];
    const r2 = hist[1];
    const fc = S.focus_candidate;
    const delta = r2 && r1 ? r2.total - r1.total : 0;
    return {
      title: "enrich · 补全重评",
      subtitle: "RequirementAgent.enrich — 前后 diff（R1 → R2）",
      raw: { quality_history: hist, acceptance_criteria: fc.acceptance_criteria, non_goals: fc.non_goals, boundary_conditions: fc.boundary_conditions },
      body: (
        <>
          <Section title="total diff">
            <div style={{ display: "flex", gap: 7, alignItems: "center" }}>
              <Badge tone="amber">R1 {r1?.total ?? "—"}</Badge>
              <span style={{ color: COLORS.ink3 }}>→</span>
              <Badge tone="emerald">R2 {r2?.total ?? "—"}</Badge>
              <Badge tone="cyan">Δ +{delta}</Badge>
            </div>
          </Section>
          {r1 && r2 && (
            <Section title="逐维变化" count={`${r2.dimensions.length} 维`}>
              {r2.dimensions.map((d) => {
                const before = r1.dimensions.find((x) => x.name === d.name)?.score ?? d.score;
                const diff = d.score - before;
                return (
                  <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 0", fontSize: 12 }}>
                    <span style={{ font: "500 11px 'JetBrains Mono',monospace", color: COLORS.ink2, minWidth: 150 }}>{d.name}</span>
                    <span style={{ font: "600 11px 'JetBrains Mono',monospace", color: COLORS.ink3 }}>{before} → {d.score}</span>
                    <span style={{ marginLeft: "auto", font: "700 11px 'JetBrains Mono',monospace", color: diff > 0 ? COLORS.doneSoft : COLORS.ink3 }}>
                      {diff > 0 ? `+${diff}` : diff}
                    </span>
                  </div>
                );
              })}
            </Section>
          )}
          <Section title="补全的 acceptance_criteria" count={fc.acceptance_criteria.length}>
            {fc.acceptance_criteria.map((ac, i) => (
              <Item key={i} accent={COLORS.done}>
                <Badge tone={ac.type === "functional" ? "cyan" : "violet"}>{ac.type}</Badge>
                <Prose>{ac.text}</Prose>
                <Refs ids={ac.evidence_refs} />
              </Item>
            ))}
          </Section>
          <Section title="non_goals" count={fc.non_goals.length}>
            <Bullets items={fc.non_goals} accent={COLORS.ink3} />
          </Section>
          <Section title="boundary_conditions" count={fc.boundary_conditions.length}>
            <Bullets items={fc.boundary_conditions} accent={COLORS.active} />
          </Section>
        </>
      ),
    };
  },

  clarify: () => ({
    title: "clarify · 澄清（未触发）",
    subtitle: "RequirementAgent.clarify — gate=pass，本轮分流未走此分支",
    raw: { clarifications: S.focus_candidate.clarifications, gate: S.focus_candidate.quality.gate },
    body: (
      <>
        <Section title="分流状态">
          <Item accent={COLORS.ink3}>
            <Row k="gate" v={S.focus_candidate.quality.gate} tone="emerald" />
            <Prose>门禁判定为 pass（非 clarify），故澄清分支本轮未执行。下方为门禁记录的待澄清点，供 clarify 分支被触发时使用。</Prose>
          </Item>
        </Section>
        <Section title="clarifications（潜在追问）" count={S.focus_candidate.clarifications.length}>
          <Bullets items={S.focus_candidate.clarifications} accent={COLORS.warn} />
        </Section>
      </>
    ),
  }),

  opportunity: () => {
    const o = S.opportunity;
    return {
      title: "opportunity · 机会评分",
      subtitle: `OpportunityAgent.score — total ${o.total} · ${o.priority} · ${o.horizon}`,
      raw: o,
      body: (
        <>
          <Section title="结论">
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
              <Badge tone="emerald">total = {o.total}</Badge>
              <Badge tone={priorityTone(o.priority)}>{o.priority}</Badge>
              <Badge tone="cyan">horizon = {o.horizon}</Badge>
            </div>
            <Prose>{o.rationale}</Prose>
          </Section>
          <Section title="10 维加权" count={o.scores.length}>
            {o.scores.map((s) => (
              <Item key={s.dimension}>
                <Row k={s.dimension} v={`score = ${s.score}`} tone="cyan" />
                <Prose>{s.rationale}</Prose>
                <Refs ids={s.evidence_refs} />
              </Item>
            ))}
          </Section>
        </>
      ),
    };
  },

  roadmap: () => ({
    title: "roadmap · 排期分流",
    subtitle: "RoadmapAgent.plan — priority / horizon / is_focus",
    raw: S.roadmap,
    body: (
      <Section title="roadmap" count={S.roadmap.length}>
        {S.roadmap.map((r) => (
          <Item key={r.cluster_id} accent={r.is_focus ? COLORS.danger : COLORS.active}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, alignItems: "center", marginBottom: 4 }}>
              <Badge tone="slate">{r.cluster_id}</Badge>
              <Badge tone={priorityTone(r.priority)}>{r.priority}</Badge>
              <Badge tone="cyan">{r.horizon}</Badge>
              {r.is_focus && <Badge tone="rose">focus</Badge>}
            </div>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: COLORS.ink }}>{r.title}</div>
            <Prose>{r.one_line_reason}</Prose>
          </Item>
        ))}
      </Section>
    ),
  }),

  solution: () => {
    const sol = S.solution;
    return {
      title: "solution · 方案设计",
      subtitle: "SolutionAgent.design — scope / non_goals / risks / dependencies",
      raw: sol,
      body: (
        <>
          <Section title="summary">
            <Prose>{sol.summary}</Prose>
          </Section>
          <Section title="scope" count={sol.scope.length}>
            <Bullets items={sol.scope} accent={COLORS.active} />
          </Section>
          <Section title="non_goals" count={sol.non_goals.length}>
            <Bullets items={sol.non_goals} accent={COLORS.ink3} />
          </Section>
          <Section title="risks" count={sol.risks.length}>
            <Bullets items={sol.risks} accent={COLORS.warn} />
          </Section>
          <Section title="dependencies" count={sol.dependencies.length}>
            <Bullets items={sol.dependencies} accent={COLORS.loop} />
          </Section>
        </>
      ),
    };
  },

  code_impact: () => {
    const ci = S.code_impact;
    return {
      title: "code_impact · 影响面分析",
      subtitle: "EngineeringAgent.analyze — is_core_module / risk_tier（代码判定）",
      raw: ci,
      body: (
        <>
          <Section title="items" count={ci.items.length}>
            {ci.items.map((it) => (
              <Item key={it.module_path} accent={it.risk_tier === "high" ? COLORS.danger : it.risk_tier === "medium" ? COLORS.warn : COLORS.hairline}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5, alignItems: "center", marginBottom: 4 }}>
                  <Badge tone="cyan">{it.module_path}</Badge>
                  {it.is_core_module && <Badge tone="rose">core</Badge>}
                  <Badge tone={riskTone(it.risk_tier)}>risk={it.risk_tier}</Badge>
                  <Badge tone="slate">{it.impact_level}</Badge>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 4 }}>
                  {it.impact_types.map((t) => <Badge key={t} tone="slate">{t}</Badge>)}
                </div>
                <Prose>{it.description}</Prose>
                <Row k="verify_points" v={`${it.verify_points.length} 项`} />
                <Bullets items={it.verify_points} accent={COLORS.active} />
              </Item>
            ))}
          </Section>
          <Section title="human_confirmation_needed" count={ci.human_confirmation_needed.length}>
            <Bullets items={ci.human_confirmation_needed} accent={COLORS.warn} />
          </Section>
        </>
      ),
    };
  },

  engineering: () => {
    const ex = S.execution;
    return {
      title: "engineering · 研发执行",
      subtitle: `EngineeringAgent.execute — blocked=${ex.blocked} · impl_plan ×${ex.impl_plan.length}`,
      raw: ex,
      body: (
        <>
          <Section title="状态">
            <Badge tone={ex.blocked ? "rose" : "emerald"}>blocked = {String(ex.blocked)}</Badge>
          </Section>
          <Section title="tasks" count={ex.tasks.length}>
            {ex.tasks.map((t) => (
              <Item key={t.id} accent={riskColor(t.risk_tier)}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5, alignItems: "center", marginBottom: 4 }}>
                  <Badge tone="slate">{t.id}</Badge>
                  <Badge tone="cyan">{t.type}</Badge>
                  <Badge tone={riskTone(t.risk_tier)}>risk={t.risk_tier}</Badge>
                  {t.related_modules.map((m) => <Badge key={m} tone="slate">{m}</Badge>)}
                </div>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: COLORS.ink }}>{t.title}</div>
                <Prose>{t.description}</Prose>
                <Refs ids={t.evidence_refs} />
              </Item>
            ))}
          </Section>
          <Section title="impl_plan（每步 verify）" count={ex.impl_plan.length}>
            {ex.impl_plan.map((p) => (
              <Item key={p.step} accent={COLORS.active}>
                <Row k={`step ${p.step}`} v={p.modules.join(", ")} tone="cyan" />
                <Prose>{p.action}</Prose>
                <Row k="risk" v={p.risk} mono={false} tone="amber" />
                <Row k="verify" v={p.verify} mono={false} tone="emerald" />
              </Item>
            ))}
          </Section>
        </>
      ),
    };
  },

  critic: () => {
    const cr = S.critic_review;
    return {
      title: "critic · 对抗审查",
      subtitle: `CriticAgent.review — redo_target=${cr.redo_target ?? "null"} · 闭包 0 违规`,
      raw: cr,
      body: (
        <>
          <Section title="findings" count={cr.findings.length}>
            {cr.findings.map((f, i) => (
              <Item key={i} accent={f.overreach ? COLORS.danger : f.demote_to_observation ? COLORS.loop : COLORS.done}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5, alignItems: "center", marginBottom: 4 }}>
                  <Badge tone="slate">{f.target}</Badge>
                  <Badge tone={f.overreach ? "rose" : "emerald"}>overreach={String(f.overreach)}</Badge>
                  {f.demote_to_observation && <Badge tone="violet">demote_to_observation</Badge>}
                  <Badge tone={strengthTone(f.evidence_strength)}>ev:{f.evidence_strength}</Badge>
                  <Badge tone={riskTone(f.risk_tier)}>risk={f.risk_tier}</Badge>
                </div>
                <Prose>{f.note}</Prose>
              </Item>
            ))}
          </Section>
          <Section title="证据闭包">
            <Item accent={COLORS.done}>
              <Row k="redo_target" v={cr.redo_target ?? "null（无需回炉）"} tone={cr.redo_target ? "rose" : "emerald"} />
              <Row k="violations" v="0（无悬空引用）" tone="emerald" />
            </Item>
          </Section>
          <Section title="pending_confirmations" count={cr.pending_confirmations.length}>
            <Bullets items={cr.pending_confirmations} accent={COLORS.warn} />
          </Section>
        </>
      ),
    };
  },

  human: () => ({
    title: "human · 人工介入 (HITL)",
    subtitle: "HITL.interrupt — pending_confirmations + human_decisions",
    raw: { human_decisions: S.human_decisions, pending_confirmations: S.critic_review.pending_confirmations },
    body: (
      <>
        <Section title="pending_confirmations" count={S.critic_review.pending_confirmations.length}>
          <Bullets items={S.critic_review.pending_confirmations} accent={COLORS.warn} />
        </Section>
        <Section title="human_decisions" count={S.human_decisions.length}>
          {S.human_decisions.map((h, i) => (
            <Item key={i} accent={h.action === "reject" ? COLORS.danger : COLORS.done}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5, alignItems: "center", marginBottom: 4 }}>
                <Badge tone="cyan">{h.checkpoint}</Badge>
                <Badge tone="slate">{h.item_ref}</Badge>
                <Badge tone={h.action === "reject" ? "rose" : h.action === "accept" ? "emerald" : "amber"}>{h.action}</Badge>
              </div>
              {h.reason && <Prose>{h.reason}</Prose>}
              <Row k="timestamp" v={h.timestamp} />
            </Item>
          ))}
        </Section>
      </>
    ),
  }),

  report: () => {
    const fc = S.focus_candidate;
    return {
      title: "report · 报告生成",
      subtitle: "ReportAgent.compose — 最终聚焦需求",
      raw: { report_paths: S.report_paths, focus_candidate: { id: fc.id, title: fc.title, business_goal: fc.business_goal } },
      body: (
        <>
          <Section title="聚焦需求">
            <Item accent={COLORS.done}>
              <Row k="id" v={fc.id} tone="cyan" />
              <div style={{ fontSize: 12.5, fontWeight: 600, color: COLORS.ink, marginTop: 4 }}>{fc.title}</div>
              <Prose>{fc.business_goal}</Prose>
            </Item>
          </Section>
          <Section title="report_paths" count={S.report_paths.length}>
            {S.report_paths.length === 0 ? (
              <Prose>（本 replay 样本未落地报告文件；live 运行会写入 runs/ 下的报告路径。）</Prose>
            ) : (
              <Bullets items={S.report_paths} accent={COLORS.active} />
            )}
          </Section>
        </>
      ),
    };
  },
});

function riskColor(tier: string) {
  return tier === "high" ? COLORS.danger : tier === "medium" ? COLORS.warn : COLORS.hairline;
}

// `state` defaults to the embedded fallback snapshot; pass live /api/state when available.
export function getInspector(nodeId: string, state: SampleState = STATE): Inspector | null {
  const fn = buildInspectors(state)[nodeId];
  return fn ? fn() : null;
}

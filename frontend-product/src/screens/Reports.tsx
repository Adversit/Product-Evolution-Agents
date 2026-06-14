// Screen 6 — 报告中心. Left report list (4 reports) + reading pane rendering the
// selected report's blocks. Ports _reportDoc(key) from the design's Component.
import { useState } from "react";
import type { CSSProperties } from "react";
import { D } from "../data/state";

type ReportKey = "exec" | "opportunity" | "eng" | "prd";

interface Block {
  h: string;
  p?: string;
  list?: string[];
  accent?: boolean;
  mono?: boolean;
}
interface ReportDoc {
  title: string;
  sub: string;
  blocks: Block[];
}

function reportDoc(key: ReportKey): ReportDoc {
  if (key === "exec")
    return {
      title: "管理层摘要 — RAGFlow",
      sub: "模块：文件上传与问答质量 ｜ 阶段：growth ｜ 运行模式：replay",
      blocks: [
        { h: "问题", p: D.FOCUS.pain_point + "（27 条反馈 → 过滤 5 → 3 簇 → 深挖 1 焦点）" },
        { h: "建议（P0 一句话）", p: D.OPPORTUNITY.rationale, accent: true },
        { h: "证据", list: ["上传一个 80MB 的 PDF 解析了两小时还在转圈，也不知道是卡了还是在跑（csv_feedback）", "解析失败了但是页面没有任何提示，只能看到状态还是 pending（csv_feedback）", "大文件解析经常卡住，只能重新上传，又得从头再来一遍（csv_feedback）"] },
        { h: "投入预估", list: ["解析状态机 + 心跳超时检测：medium — task_executor 拆分阶段、扩展状态表，不引入新中间件", "失败重试装饰器（退避 + 错误分类）：low — 包一层错误分类 + 退避，不涉及架构级改动", "结构化错误码 + 失败原因透传：medium — 扩展数据模型并贯通全链路", "任务卡 12 张，实施步骤 12 步"] },
      ],
    };
  if (key === "eng")
    return {
      title: "研发执行报告 — req-01",
      sub: "代码影响面 · 任务卡 · 测试建议 · Changelog",
      blocks: [
        { h: "核心模块（需人工确认）", list: D.CODE_IMPACT.filter((m) => m.core).map((m) => m.module + "⚠ · " + m.desc.slice(0, 56) + "…") },
        { h: "建议实施顺序", p: D.SUGGESTED_ORDER.join(" → ") },
        { h: "测试建议（节选）", list: ["为每种 error_type 构造 mock 异常注入点，断言分类正确", "模拟 worker 在 embedding 阶段 crash，验证 2× 阈值内标记并重试且无重复 chunk", "10+ 个 100MB 文件并发解析，监控写入压力不超过基线 20%", "Playwright E2E：进度条依次高亮 8 阶段并显示 chunk 进度"] },
        { h: "Changelog 草稿", p: D.CHANGELOG, mono: true },
      ],
    };
  if (key === "prd")
    return {
      title: "PRD 草稿 — 解析任务稳定性修复",
      sub: "产品：RAGFlow ｜ 需求 id：req-01 ｜ 状态：candidate",
      blocks: [
        { h: "背景", p: D.FOCUS.background },
        { h: "功能范围", list: D.FOCUS.scope },
        { h: "非目标", list: D.FOCUS.non_goals },
        { h: "边界条件", list: D.FOCUS.boundary_conditions },
        { h: "待澄清问题", list: D.QUALITY.ambiguities },
      ],
    };
  return {
    title: "产品机会报告（评审版）",
    sub: "产品：RAGFlow ｜ 分析模块：文件上传与问答质量 ｜ 阶段：growth",
    blocks: [
      { h: "执行摘要", p: "焦点问题：" + D.FOCUS.title + "。建议优先级 P0（机会总分 86.6，now）。" + D.OPPORTUNITY.rationale, accent: true },
      { h: "漏斗统计", p: D.FUNNEL.map((s) => s.stage + " " + s.count).join(" → ") },
      { h: "问题簇总览", list: D.CLUSTERS.map((c) => (c.focus ? "⭐ " : "") + c.id + " · " + c.title + " · 频次 " + c.freq + " · " + c.severity + " · " + c.status) },
      { h: "质量评分前后对比", p: "61 → 86（第 1 轮 → 第 2 轮，门禁：pass）。十维全面提升，completeness 48→85、testability 45→86、acceptance_clarity 42→85 提升最显著。" },
      { h: "机会评分（加权总分 86.6）", list: D.OPPORTUNITY.scores.map((s) => s.label + "　" + s.score) },
    ],
  };
}

const REPORTS: { key: ReportKey; title: string; en: string; desc: string }[] = [
  { key: "exec", title: "管理层摘要", en: "EXECUTIVE SUMMARY", desc: "一页纸 · 问题/证据/建议/投入/风险" },
  { key: "opportunity", title: "产品机会报告", en: "OPPORTUNITY REPORT", desc: "漏斗/簇/竞品/技术/评分/路线图" },
  { key: "eng", title: "研发执行报告", en: "ENGINEERING REPORT", desc: "代码影响/任务/测试/Changelog" },
  { key: "prd", title: "PRD 草稿", en: "PRD DRAFT", desc: "背景/范围/验收/边界/证据映射" },
];

export default function Reports() {
  const [sel, setSel] = useState<ReportKey>("opportunity");
  const doc = reportDoc(sel);

  const monoP: CSSProperties = { margin: 0, fontFamily: "'JetBrains Mono',monospace", fontSize: 11.5, lineHeight: 1.75, color: "#56595F", whiteSpace: "pre-wrap", background: "#FFFFFF", border: "1px solid #ECECEA", borderRadius: 10, padding: "14px 16px" };
  const accentP: CSSProperties = { margin: 0, fontSize: 13.5, lineHeight: 1.8, color: "#56595F" };
  const normP: CSSProperties = { margin: 0, fontSize: 13, lineHeight: 1.8, color: "#56595F" };

  return (
    <section style={{ maxWidth: 1180, margin: "0 auto", padding: "30px 34px 64px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".4px", color: "#8A8F98", fontFamily: "'JetBrains Mono',monospace" }}>报告 · REPORTS</span>
      </div>
      <h1 style={{ fontSize: 23, fontWeight: 700, letterSpacing: "-.4px", margin: "0 0 24px" }}>报告中心</h1>

      <div style={{ display: "grid", gridTemplateColumns: "256px 1fr", gap: 22, alignItems: "start" }}>
        {/* report list */}
        <div style={{ background: "#FFFFFF", border: "1px solid #E6E6E4", borderRadius: 13, padding: 8, boxShadow: "0 1px 2px rgba(0,0,0,.03)", position: "sticky", top: 8 }}>
          {REPORTS.map((r) => {
            const on = sel === r.key;
            return (
              <button
                key={r.key}
                onClick={() => setSel(r.key)}
                style={{ cursor: "pointer", border: "none", fontFamily: "inherit", textAlign: "left", width: "100%", padding: "11px 13px", borderRadius: 9, background: on ? "#F4F4F3" : "transparent", display: "flex", gap: 11, alignItems: "flex-start" }}
              >
                <div style={{ flexShrink: 0, width: 30, height: 30, borderRadius: 8, background: on ? "#1B1C1E" : "#F4F4F3", display: "flex", alignItems: "center", justifyContent: "center", marginTop: 1 }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={on ? "#FFFFFF" : "#8A8F98"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><path d="M14 2v5h5" /></svg>
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#1B1C1E" }}>{r.title}</div>
                  <div style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: ".3px", color: "#8A8F98", fontFamily: "'JetBrains Mono',monospace", margin: "2px 0 3px" }}>{r.en}</div>
                  <div style={{ fontSize: 10.5, color: "#8A8F98", lineHeight: 1.45 }}>{r.desc}</div>
                </div>
              </button>
            );
          })}
        </div>

        {/* reading pane */}
        <div style={{ background: "#FFFFFF", border: "1px solid #E6E6E4", borderRadius: 14, padding: "30px 34px 34px", boxShadow: "0 1px 2px rgba(0,0,0,.03)", minHeight: 540 }}>
          <div style={{ paddingBottom: 18, borderBottom: "1px solid #ECECEA", marginBottom: 22 }}>
            <h2 style={{ fontSize: 21, fontWeight: 700, letterSpacing: "-.4px", margin: "0 0 6px", textWrap: "pretty" } as object}>{doc.title}</h2>
            <div style={{ fontSize: 11.5, color: "#8A8F98" }}>{doc.sub}</div>
          </div>
          {doc.blocks.map((b, i) => (
            <div key={i} style={b.accent ? { marginBottom: 18, background: "#FFFFFF", border: "1px solid #E6E6E4", borderRadius: 11, padding: "15px 17px" } : { marginBottom: 18 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".4px", color: "#1B1C1E", marginBottom: 10 }}>{b.h}</div>
              {b.p && <div style={b.mono ? monoP : b.accent ? accentP : normP}>{b.p}</div>}
              {b.list && (
                <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                  {b.list.map((li, j) => (
                    <div key={j} style={{ display: "flex", gap: 10, fontSize: 12.5, lineHeight: 1.7, color: "#56595F" }}>
                      <span style={{ flexShrink: 0, width: 5, height: 5, borderRadius: "50%", background: "#1B1C1E", marginTop: 8 }} />
                      <span style={{ textWrap: "pretty" } as object}>{li}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

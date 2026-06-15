// EvoPM Agent — hackathon project deck builder (pptxgenjs)
// Output: docs/submission/EvoPM_Agent_项目文档.pptx
// Run: node docs/submission/build_deck.js

const pptxgen = require("pptxgenjs");
const path = require("path");

const ASSETS = "G:\\AI_projects\\Product-Evolution-Agents\\docs\\assets";
const OUT = path.join(__dirname, "EvoPM_Agent_项目文档.pptx");

// ---- palette (informed by the product's own UI: Observatory dark + Linear violet/green) ----
const NIGHT = "12132E";   // dark slide bg
const NIGHT2 = "1E2050";   // card on dark
const VIOLET = "6D5EF6";   // primary accent (matches product data series)
const VIOLETL = "B7AEFF";
const GREEN = "16A34A";   // PASS / jump semantic
const AMBER = "F59E0B";
const INK = "1E2230";   // main text on light
const MUTED = "6B7280";   // muted text
const HAIR = "E6E8EF";   // hairline
const WHITE = "FFFFFF";
const LIGHT = "F6F7FB";   // light section bg

const HEAD = "Microsoft YaHei";
const BODY = "Microsoft YaHei";
const MONO = "Consolas";

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.33 x 7.5
pres.author = "EvoPM Team";
pres.title = "EvoPM Agent 项目文档";
const W = 13.33, H = 7.5;

const shadow = () => ({ type: "outer", color: "1A1A2E", blur: 9, offset: 3, angle: 135, opacity: 0.16 });

// ---------- helpers ----------
function pageNum(slide, n, dark) {
  slide.addText(`${n}`, { x: W - 0.9, y: H - 0.55, w: 0.5, h: 0.3, fontSize: 10,
    color: dark ? "6E70A8" : MUTED, align: "right", fontFace: BODY, margin: 0 });
  slide.addText("EvoPM Agent", { x: 0.6, y: H - 0.55, w: 3, h: 0.3, fontSize: 10,
    color: dark ? "6E70A8" : MUTED, align: "left", fontFace: BODY, margin: 0 });
}

// little rounded "node" motif marker
function nodeMark(slide, x, y, color = VIOLET, s = 0.16) {
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: s, h: s, fill: { color }, rectRadius: 0.04, line: { type: "none" } });
}

function lightTitle(slide, kicker, title) {
  nodeMark(slide, 0.62, 0.62, VIOLET, 0.2);
  slide.addText(kicker, { x: 0.92, y: 0.5, w: 8, h: 0.32, fontSize: 12, color: VIOLET, bold: true,
    charSpacing: 2, fontFace: BODY, margin: 0 });
  slide.addText(title, { x: 0.6, y: 0.82, w: 12.1, h: 0.8, fontSize: 30, color: INK, bold: true,
    fontFace: HEAD, margin: 0 });
}

function newLight() { const s = pres.addSlide(); s.background = { color: WHITE }; return s; }
function newSoft() { const s = pres.addSlide(); s.background = { color: LIGHT }; return s; }
function newDark() { const s = pres.addSlide(); s.background = { color: NIGHT }; return s; }

// =====================================================================
// 1) COVER (dark)
// =====================================================================
{
  const s = newDark();
  // ambient node dots
  const dots = [[1.1,1.2],[2.4,5.9],[11.9,1.1],[12.4,5.6],[0.8,3.7],[12.7,3.3]];
  dots.forEach(([x,y]) => slide_dot(s,x,y));
  function slide_dot(sl,x,y){ sl.addShape(pres.shapes.OVAL,{x,y,w:0.13,h:0.13,fill:{color:VIOLET,transparency:55},line:{type:"none"}}); }

  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.95, y: 1.5, w: 0.55, h: 0.55, fill: { color: VIOLET }, rectRadius: 0.12, line: { type: "none" } });
  s.addText("E", { x: 0.95, y: 1.5, w: 0.55, h: 0.55, fontSize: 28, bold: true, color: WHITE, align: "center", valign: "middle", fontFace: HEAD, margin: 0 });
  s.addText("EvoPM Agent", { x: 1.65, y: 1.5, w: 9, h: 0.6, fontSize: 22, color: VIOLETL, bold: true, fontFace: HEAD, valign: "middle", margin: 0 });

  s.addText("产品进化智能体", { x: 0.9, y: 2.55, w: 11.5, h: 1.0, fontSize: 52, bold: true, color: WHITE, fontFace: HEAD, margin: 0 });
  s.addText([
    { text: "基于 LangGraph 的多智能体产品需求决策系统", options: { color: "D7D9F2", breakLine: true } },
    { text: "把分散的用户反馈与 GitHub Issue，变成有证据、有出口、可追溯的产品决策", options: { color: "9DA0CF", fontSize: 17 } },
  ], { x: 0.92, y: 3.72, w: 11.6, h: 1.1, fontSize: 22, fontFace: BODY, lineSpacingMultiple: 1.12, margin: 0 });

  // tech chips
  const chips = ["LangGraph", "GLM-5.1", "Pydantic v2", "React + Vite", "14 节点 · 7 Agent"];
  let cx = 0.92;
  chips.forEach((c) => {
    const w = 0.28 + c.length * 0.135;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: cx, y: 5.25, w, h: 0.46, fill: { color: NIGHT2 }, line: { color: "3A3D78", width: 1 }, rectRadius: 0.23 });
    s.addText(c, { x: cx, y: 5.25, w, h: 0.46, fontSize: 12.5, color: VIOLETL, align: "center", valign: "middle", fontFace: BODY, margin: 0 });
    cx += w + 0.22;
  });

  s.addShape(pres.shapes.LINE, { x: 0.95, y: 6.35, w: 11.4, h: 0, line: { color: "33356A", width: 1 } });
  s.addText("SoloVerse · Agent 元宇宙黑客松挑战赛   |   项目文档（背景 · 架构 · 痛点 · 规划）",
    { x: 0.92, y: 6.5, w: 11.5, h: 0.4, fontSize: 13, color: "8A8AAE", fontFace: BODY, margin: 0 });
}

// =====================================================================
// 2) PAIN POINTS (light)
// =====================================================================
{
  const s = newLight();
  lightTitle(s, "PROBLEM · 解决的痛点", "产品团队每天都在做、却很难做好的事");
  s.addText("反馈在涨，决策的质量却没跟上 —— 三个反复出现的困境：",
    { x: 0.62, y: 1.62, w: 12, h: 0.4, fontSize: 15, color: MUTED, fontFace: BODY, margin: 0 });

  const cards = [
    ["01", "淹没", "情绪宣泄、重复提交、用错功能混在一起，成百上千条反馈靠人工根本筛不过来，真问题被噪声淹没。", VIOLET],
    ["02", "拍脑袋", "优先级靠感觉和嗓门决定，缺乏证据支撑。做完了说不清「为什么做这个」，无法向团队和管理层交代。", AMBER],
    ["03", "断链", "需求、竞品、技术可行性、代码影响面各算各的。最终 PRD 无法回溯到底依据了哪条反馈，结论不可追溯。", "EF4444"],
  ];
  const cw = 3.86, gap = 0.36, x0 = 0.62, y0 = 2.3, ch = 3.6;
  cards.forEach(([no, t, d, col], i) => {
    const x = x0 + i * (cw + gap);
    s.addShape(pres.shapes.RECTANGLE, { x, y: y0, w: cw, h: ch, fill: { color: WHITE }, line: { color: HAIR, width: 1 }, shadow: shadow() });
    s.addShape(pres.shapes.RECTANGLE, { x, y: y0, w: cw, h: 0.09, fill: { color: col }, line: { type: "none" } });
    s.addText(no, { x: x + 0.32, y: y0 + 0.34, w: 1.5, h: 0.7, fontSize: 34, bold: true, color: col, fontFace: HEAD, margin: 0 });
    s.addText(t, { x: x + 0.32, y: y0 + 1.18, w: cw - 0.6, h: 0.5, fontSize: 22, bold: true, color: INK, fontFace: HEAD, margin: 0 });
    s.addText(d, { x: x + 0.32, y: y0 + 1.78, w: cw - 0.6, h: 1.6, fontSize: 13.5, color: "475067", fontFace: BODY, lineSpacingMultiple: 1.22, margin: 0, valign: "top" });
  });
  pageNum(s, 2, false);
}

// =====================================================================
// 3) APPROACH — two principles (dark divider)
// =====================================================================
{
  const s = newDark();
  nodeMark(s, 0.62, 0.66, VIOLET, 0.2);
  s.addText("OUR APPROACH · 核心理念", { x: 0.92, y: 0.55, w: 9, h: 0.34, fontSize: 12, color: VIOLETL, bold: true, charSpacing: 2, fontFace: BODY, margin: 0 });
  s.addText("不做更聪明的「分类器」，做一条有纪律的「需求漏斗」", { x: 0.6, y: 0.92, w: 12.1, h: 0.8, fontSize: 28, bold: true, color: WHITE, fontFace: HEAD, margin: 0 });

  const cards = [
    ["漏斗必须有出口", "不是所有反馈都转需求，不是所有需求都值得做。过滤 · 查重 · 门禁 · 分流，每一级都有「淘汰 / 分流」记录，并在报告里展示出来。", "27 → 5 → 3 → 1 → P0"],
    ["所有结论须证据闭包", "每个判断都引用真实上游证据 id，节点输出后由代码层校验合法性；LLM 编造的引用被直接剔除并交对抗式审查。", "evidence_refs 全链校验"],
  ];
  cards.forEach(([t, d, tag], i) => {
    const x = 0.92 + i * 6.0;
    s.addShape(pres.shapes.RECTANGLE, { x, y: 2.1, w: 5.5, h: 3.5, fill: { color: NIGHT2 }, line: { color: "34376E", width: 1 } });
    s.addShape(pres.shapes.RECTANGLE, { x, y: 2.1, w: 0.1, h: 3.5, fill: { color: VIOLET }, line: { type: "none" } });
    s.addText(`${i + 1}`, { x: x + 0.35, y: 2.35, w: 1, h: 0.9, fontSize: 40, bold: true, color: VIOLET, fontFace: HEAD, margin: 0 });
    s.addText(t, { x: x + 0.35, y: 3.25, w: 4.9, h: 0.5, fontSize: 22, bold: true, color: WHITE, fontFace: HEAD, margin: 0 });
    s.addText(d, { x: x + 0.35, y: 3.85, w: 4.85, h: 1.3, fontSize: 14, color: "C2C5EC", fontFace: BODY, lineSpacingMultiple: 1.25, margin: 0, valign: "top" });
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: x + 0.35, y: 5.0, w: 4.0, h: 0.45, fill: { color: "2A2D63" }, line: { type: "none" }, rectRadius: 0.1 });
    s.addText(tag, { x: x + 0.35, y: 5.0, w: 4.0, h: 0.45, fontSize: 13, color: VIOLETL, align: "center", valign: "middle", fontFace: MONO, margin: 0 });
  });
  s.addText("系统只输出建议文档，永不产出代码改动（无 Patch / 无 PR）—— 人工介入分级，执行权始终在人手里。",
    { x: 0.92, y: 6.0, w: 11.5, h: 0.5, fontSize: 14.5, color: "9DA0CF", italic: true, fontFace: BODY, margin: 0 });
  pageNum(s, 3, true);
}

// =====================================================================
// 4) ARCHITECTURE (light) — 14-node LangGraph pipeline
// =====================================================================
{
  const s = newLight();
  lightTitle(s, "TECHNICAL · 技术架构", "14 节点 LangGraph 流水线 · 7 个协作智能体");

  // pipeline as serpentine chips (top row L->R, bottom row R->L)
  const chip = (x, y, w, label, sub, col) => {
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h: 0.82, fill: { color: WHITE }, line: { color: col, width: 1.25 }, rectRadius: 0.08, shadow: shadow() });
    s.addShape(pres.shapes.RECTANGLE, { x, y, w: 0.08, h: 0.82, fill: { color: col }, line: { type: "none" } });
    s.addText(label, { x: x + 0.16, y: y + 0.12, w: w - 0.24, h: 0.34, fontSize: 13, bold: true, color: INK, fontFace: BODY, margin: 0 });
    s.addText(sub, { x: x + 0.16, y: y + 0.46, w: w - 0.24, h: 0.3, fontSize: 9.5, color: MUTED, fontFace: MONO, margin: 0 });
  };
  const arrow = (x, y, w) => s.addShape(pres.shapes.LINE, { x, y, w, h: 0, line: { color: "B9BECC", width: 1.5, endArrowType: "triangle" } });
  const varrow = (x, y, h) => s.addShape(pres.shapes.LINE, { x, y, w: 0, h, line: { color: "B9BECC", width: 1.5, endArrowType: "triangle" } });

  const y1 = 1.95, y2 = 3.55;
  // top row
  chip(0.62, y1, 1.95, "intake", "Intake Agent", VIOLET);
  arrow(2.57, y1 + 0.41, 0.33);
  chip(2.90, y1, 2.15, "discovery 聚类·查重", "Discovery", VIOLET);
  arrow(5.05, y1 + 0.41, 0.33);
  chip(5.38, y1, 1.75, "① 人工选簇", "interrupt", AMBER);
  arrow(7.13, y1 + 0.41, 0.33);
  // parallel research (two stacked)
  chip(7.46, y1 - 0.45, 2.4, "competitor_research", "Research ∥", "0EA5E9");
  chip(7.46, y1 + 0.55, 2.4, "tech_research", "Research ∥", "0EA5E9");
  arrow(9.86, y1 + 0.41, 0.33);
  chip(10.19, y1, 2.5, "quality_gate 门禁", "Requirement · 10维", GREEN);
  // gate -> enrich loop label
  s.addText("FAIL → enrich 补全 → 回炉重评 ×1", { x: 10.19, y: y1 + 0.9, w: 2.95, h: 0.28, fontSize: 9.5, color: GREEN, italic: true, fontFace: BODY, margin: 0 });

  // connector down from quality_gate to bottom row
  varrow(11.44, y1 + 1.28, 0.45);
  // bottom row (right -> left)
  chip(10.19, y2, 2.5, "opportunity 机会评分", "Strategy · 7级优先级", VIOLET);
  arrow(10.04, y2 + 0.41, -0.33);
  chip(7.66, y2, 2.2, "solution_design", "Strategy · 4角色", VIOLET);
  arrow(7.51, y2 + 0.41, -0.33);
  chip(5.26, y2, 2.1, "engineering 影响面", "Engineering", VIOLET);
  arrow(5.11, y2 + 0.41, -0.33);
  chip(3.0, y2, 1.95, "critic 对抗审查", "Critic · 5档证据", "EF4444");
  arrow(2.85, y2 + 0.41, -0.33);
  chip(0.62, y2, 2.1, "③ 最终评审", "interrupt · 5操作", AMBER);
  // critic redo loop note
  s.addText("严重问题 → redo 回炉指定节点（限 1 次）", { x: 3.0, y: y2 + 0.92, w: 3.2, h: 0.3, fontSize: 9, color: "EF4444", italic: true, fontFace: BODY, margin: 0 });
  // report end
  varrow(1.65, y2 + 1.28, 0.4);
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.62, y: y2 + 1.7, w: 2.1, h: 0.7, fill: { color: INK }, line: { type: "none" }, rectRadius: 0.08 });
  s.addText([{ text: "report → END", options: { bold: true, color: WHITE, breakLine: true, fontSize: 13 } }, { text: "Jinja2 · 无 LLM · 4 份报告", options: { color: "B9BECC", fontSize: 9, fontFace: MONO } }],
    { x: 0.62, y: y2 + 1.7, w: 2.1, h: 0.7, align: "center", valign: "middle", fontFace: BODY, margin: 0 });

  // tech stack strip
  const stack = [["编排", "LangGraph + MemorySaver"], ["LLM", "智谱 GLM-5.1 / 4.5-air"], ["结构化", "Pydantic v2 · function_calling"], ["前端", "React + Vite + TS ×2"]];
  let sx = 4.0;
  stack.forEach(([k, v]) => {
    s.addText([{ text: k + "  ", options: { bold: true, color: VIOLET } }, { text: v, options: { color: "475067" } }],
      { x: sx, y: y2 + 1.95, w: 2.3, h: 0.4, fontSize: 10.5, fontFace: BODY, margin: 0 });
    sx += 2.3;
  });
  pageNum(s, 4, false);
}

// =====================================================================
// 5) FUNNEL (light) — 27 -> 5 -> 3 -> 1 -> P0
// =====================================================================
{
  const s = newLight();
  lightTitle(s, "HOW IT WORKS · 需求漏斗", "每一级都有出口：淘汰与分流都看得见");

  // bars shrink in width (funnel shape); each holds only a big number + 2 short lines.
  const steps = [
    ["27", "条原始信号", "用户反馈 CSV + 真实 GitHub Issue 多源导入", 9.6, VIOLET],
    ["5", "条可行动信号", "情绪 / 误用 / 信息不足 → 滤出 22 条", 8.0, VIOLET],
    ["3", "个问题簇", "1 簇经历史需求查重 → DUPLICATE 合并", 6.4, "0EA5E9"],
    ["1", "个焦点需求", "低优先级簇 → 分流 Later", 4.9, GREEN],
    ["P0", "立即启动 · Now", "机会总分 86.6", 3.5, GREEN],
  ];
  let y = 1.85;
  steps.forEach(([big, label, sub, w, col], i) => {
    const x = 0.62;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h: 0.84, fill: { color: col, transparency: i === 4 ? 0 : 8 }, line: { type: "none" }, rectRadius: 0.06 });
    s.addText(big, { x: x + 0.22, y, w: 1.25, h: 0.84, fontSize: 28, bold: true, color: WHITE, align: "center", valign: "middle", fontFace: HEAD, margin: 0 });
    s.addText([
      { text: label, options: { bold: true, fontSize: 15, color: WHITE, breakLine: true } },
      { text: sub, options: { fontSize: 10.5, color: "EFF1FF" } },
    ], { x: x + 1.55, y, w: w - 1.7, h: 0.84, valign: "middle", fontFace: BODY, lineSpacingMultiple: 1.05, margin: 0 });
    y += 1.04;
  });
  // right-side summary callout (fills the funnel's negative space, reinforces the message)
  s.addShape(pres.shapes.RECTANGLE, { x: 10.55, y: 3.05, w: 2.15, h: 2.25, fill: { color: WHITE }, line: { color: HAIR, width: 1 }, shadow: shadow() });
  s.addShape(pres.shapes.RECTANGLE, { x: 10.55, y: 3.05, w: 2.15, h: 0.08, fill: { color: GREEN }, line: { type: "none" } });
  s.addText("漏斗出口", { x: 10.75, y: 3.22, w: 1.8, h: 0.36, fontSize: 13, bold: true, color: INK, fontFace: HEAD, margin: 0 });
  s.addText([
    { text: "22", options: { bold: true, fontSize: 22, color: VIOLET } },
    { text: " 条反馈滤出", options: { fontSize: 12, color: "475067", breakLine: true } },
    { text: "1", options: { bold: true, fontSize: 22, color: "0EA5E9" } },
    { text: " 簇查重合并", options: { fontSize: 12, color: "475067", breakLine: true } },
    { text: "2", options: { bold: true, fontSize: 22, color: AMBER } },
    { text: " 簇分流降级", options: { fontSize: 12, color: "475067" } },
  ], { x: 10.75, y: 3.66, w: 1.85, h: 1.55, valign: "top", fontFace: BODY, lineSpacingMultiple: 1.15, margin: 0 });
  s.addText("演示数据刻意埋入「会被淘汰 / 分流」的样本——漏斗的价值正在于它敢于说「不做」。",
    { x: 0.62, y: 6.75, w: 12, h: 0.4, fontSize: 13, color: INK, italic: true, fontFace: BODY, margin: 0 });
  pageNum(s, 5, false);
}

// =====================================================================
// 6) QUALITY GATE HIGHLIGHT (light) — 61 -> 86 + radar screenshot
// =====================================================================
{
  const s = newLight();
  lightTitle(s, "SIGNATURE · 质量门禁自动回炉", "需求初评 61 分没过线，自动补全证据后跃升 86");

  // left: big numbers
  s.addText("61", { x: 0.7, y: 2.3, w: 2.2, h: 1.3, fontSize: 70, bold: true, color: MUTED, fontFace: HEAD, align: "center", margin: 0 });
  s.addText("初评 · FAIL", { x: 0.7, y: 3.55, w: 2.2, h: 0.4, fontSize: 14, color: MUTED, align: "center", fontFace: BODY, margin: 0 });
  s.addShape(pres.shapes.LINE, { x: 3.05, y: 2.95, w: 0.9, h: 0, line: { color: GREEN, width: 2.5, endArrowType: "triangle" } });
  s.addText("enrich +25", { x: 2.9, y: 2.45, w: 1.3, h: 0.35, fontSize: 12, bold: true, color: GREEN, align: "center", fontFace: BODY, margin: 0 });
  s.addText("86", { x: 4.0, y: 2.1, w: 2.3, h: 1.5, fontSize: 92, bold: true, color: GREEN, fontFace: HEAD, align: "center", margin: 0 });
  s.addText("终评 · PASS", { x: 4.0, y: 3.62, w: 2.3, h: 0.4, fontSize: 15, bold: true, color: GREEN, align: "center", fontFace: BODY, margin: 0 });

  s.addText("代码规则判定门禁（总分 ≥ 70 且无 blocker），不是让 LLM 自己说「过」。FAIL 时系统用竞品 / 技术调研的真实证据自动补全一轮再重评——人工介入前先自我纠偏。",
    { x: 0.7, y: 4.35, w: 5.7, h: 1.6, fontSize: 14, color: "475067", fontFace: BODY, lineSpacingMultiple: 1.3, margin: 0, valign: "top" });

  const tags = ["10 维评分", "锚点描述", "blocker 维度", "回炉计数限 1 次"];
  let tx = 0.7;
  tags.forEach((t) => {
    const w = 0.3 + t.length * 0.16;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: tx, y: 6.05, w, h: 0.42, fill: { color: "EEF0FF" }, line: { type: "none" }, rectRadius: 0.21 });
    s.addText(t, { x: tx, y: 6.05, w, h: 0.42, fontSize: 11, color: VIOLET, align: "center", valign: "middle", fontFace: BODY, margin: 0 });
    tx += w + 0.18;
  });

  // right: workbench radar screenshot (1280x600 -> ratio 2.133)
  const iw = 6.2, ih = iw * 600 / 1280;
  s.addShape(pres.shapes.RECTANGLE, { x: 6.78, y: 2.25, w: iw + 0.16, h: ih + 0.16, fill: { color: WHITE }, line: { color: HAIR, width: 1 }, shadow: shadow() });
  s.addImage({ path: path.join(ASSETS, "workbench.png"), x: 6.86, y: 2.33, w: iw, h: ih });
  s.addText("决策工作台 · 焦点需求质量雷达（10 维）", { x: 6.78, y: 2.25 + ih + 0.28, w: iw, h: 0.35, fontSize: 11.5, color: MUTED, align: "center", fontFace: BODY, margin: 0 });
  pageNum(s, 6, false);
}

// =====================================================================
// 7) FRONTEND — Decision Workbench (light)  full screenshot
// =====================================================================
{
  const s = newLight();
  lightTitle(s, "UX · 决策工作台 Decision Workbench", "给评委与团队看「结论」的成品界面");

  const iw = 7.4, ih = iw * 600 / 1280;
  s.addShape(pres.shapes.RECTANGLE, { x: 0.62, y: 1.95, w: iw + 0.16, h: ih + 0.16, fill: { color: WHITE }, line: { color: HAIR, width: 1 }, shadow: shadow() });
  s.addImage({ path: path.join(ASSETS, "workbench.png"), x: 0.7, y: 2.03, w: iw, h: ih });
  s.addText("浅色 Linear 风 · 6 屏左导航 · 接 glm-5.1 真实 replay 数据", { x: 0.62, y: 1.95 + ih + 0.28, w: iw, h: 0.35, fontSize: 11.5, color: MUTED, align: "left", fontFace: BODY, margin: 0 });

  const feats = [
    ["焦点需求 HERO", "10 维质量雷达 + 总分 61→86 滚动，初评 / 终评切换"],
    ["可点击证据弹层", "原文摘录 + 来源 + 强度，mock:// 标本地材料"],
    ["机会评分 · 路线图", "Now / Next / Later 分流，DUPLICATE 标记"],
    ["研发执行", "核心模块 ⚠ 高风险 + 任务卡 + 风险清单"],
    ["报告中心", "4 份精排报告，[未确认] 结论标注"],
  ];
  let fy = 2.05;
  feats.forEach(([t, d]) => {
    nodeMark(s, 8.5, fy + 0.07, VIOLET, 0.14);
    s.addText([{ text: t + "   ", options: { bold: true, color: INK } }, { text: d, options: { color: "5A6275" } }],
      { x: 8.75, y: fy - 0.03, w: 4.2, h: 0.85, fontSize: 12.5, fontFace: BODY, lineSpacingMultiple: 1.1, margin: 0, valign: "top" });
    fy += 0.92;
  });
  pageNum(s, 7, false);
}

// =====================================================================
// 8) FRONTEND — Pipeline Observatory (dark) full screenshot
// =====================================================================
{
  const s = newDark();
  nodeMark(s, 0.62, 0.66, VIOLET, 0.2);
  s.addText("UX · 流水线透视台 Pipeline Observatory", { x: 0.92, y: 0.55, w: 11, h: 0.34, fontSize: 12, color: VIOLETL, bold: true, charSpacing: 1.5, fontFace: BODY, margin: 0 });
  s.addText("现场演示多智能体执行过程并定位问题", { x: 0.6, y: 0.92, w: 12.1, h: 0.7, fontSize: 28, bold: true, color: WHITE, fontFace: HEAD, margin: 0 });

  const imgY = 1.8, iw = 6.95, ih = iw * 900 / 1440;
  s.addShape(pres.shapes.RECTANGLE, { x: 0.62, y: imgY, w: iw + 0.16, h: ih + 0.16, fill: { color: NIGHT2 }, line: { color: "3A3D78", width: 1 }, shadow: shadow() });
  s.addImage({ path: path.join(ASSETS, "observatory-drawer.png"), x: 0.7, y: imgY + 0.08, w: iw, h: ih });
  s.addText("深色科技风 · 14 节点蛇形 DAG 实时点亮 · 节点检视抽屉", { x: 0.62, y: imgY + ih + 0.26, w: iw + 0.16, h: 0.35, fontSize: 11.5, color: "8A8DC0", fontFace: BODY, margin: 0 });

  const feats = [
    ["14 节点实时点亮", "每个节点显示 agent / 一行结论 / 耗时 / 迷你指标"],
    ["条件分支与回环明示", "并行 fan-in、enrich 回环、未触发的 ghost 路径（紫虚线）"],
    ["播放 + 计数侧栏", "▶ / ⏸ / 单步 / 倍速，漏斗 · rounds · LLM 预算环"],
    ["节点检视抽屉", "结构化字段表 ↔ 原始 JSON 一键切换，异常可定位"],
  ];
  let fy = 2.05;
  feats.forEach(([t, d]) => {
    s.addShape(pres.shapes.RECTANGLE, { x: 8.6, y: fy, w: 4.1, h: 1.0, fill: { color: NIGHT2 }, line: { color: "34376E", width: 1 } });
    s.addShape(pres.shapes.RECTANGLE, { x: 8.6, y: fy, w: 0.07, h: 1.0, fill: { color: VIOLET }, line: { type: "none" } });
    s.addText(t, { x: 8.78, y: fy + 0.12, w: 3.85, h: 0.34, fontSize: 13.5, bold: true, color: WHITE, fontFace: BODY, margin: 0 });
    s.addText(d, { x: 8.78, y: fy + 0.46, w: 3.85, h: 0.5, fontSize: 11, color: "B7BAE6", fontFace: BODY, lineSpacingMultiple: 1.08, margin: 0, valign: "top" });
    fy += 1.12;
  });
  pageNum(s, 8, true);
}

// =====================================================================
// 9) ENGINEERING DEPTH (light) — technical robustness
// =====================================================================
{
  const s = newLight();
  lightTitle(s, "TECHNICAL DEPTH · 工程深度", "复杂的 Agent 逻辑 + 现场可靠的稳定性兜底");

  const items = [
    ["对抗式审查 Critic", "专设审查智能体：5 档证据强度、揪过度推断、弱证据降权为观察项、生成待确认清单；本次跑出 20 条审查发现。", VIOLET],
    ["证据闭包代码校验", "evidence_refs 贯穿全部 schema，每个节点输出后由代码校验引用合法性，LLM 编造的引用被剔除并记入 Critic 输入。", VIOLET],
    ["人工介入分级", "低风险自动通过 / 中风险进待确认 / 高风险（命中核心模块）强制确认；3 个 interrupt 断点，系统永不改代码。", AMBER],
    ["稳定性兜底", "LLM 429 指数退避重试、结构化输出校验重试、磁盘缓存 + --replay 离线重放、外部依赖失败自动降级 mock。", GREEN],
  ];
  const cw = 5.95, gap = 0.32, x0 = 0.62, y0 = 1.95, ch = 2.15;
  items.forEach(([t, d, col], i) => {
    const x = x0 + (i % 2) * (cw + gap);
    const y = y0 + Math.floor(i / 2) * (ch + 0.3);
    s.addShape(pres.shapes.RECTANGLE, { x, y, w: cw, h: ch, fill: { color: WHITE }, line: { color: HAIR, width: 1 }, shadow: shadow() });
    s.addShape(pres.shapes.RECTANGLE, { x, y, w: 0.1, h: ch, fill: { color: col }, line: { type: "none" } });
    s.addText(t, { x: x + 0.4, y: y + 0.28, w: cw - 0.7, h: 0.5, fontSize: 19, bold: true, color: INK, fontFace: HEAD, margin: 0 });
    s.addText(d, { x: x + 0.4, y: y + 0.88, w: cw - 0.7, h: 1.1, fontSize: 13.5, color: "475067", fontFace: BODY, lineSpacingMultiple: 1.28, margin: 0, valign: "top" });
  });
  pageNum(s, 9, false);
}

// =====================================================================
// 10) IMPACT & COMPLETENESS (light) — value + MVP evidence
// =====================================================================
{
  const s = newLight();
  lightTitle(s, "IMPACT & COMPLETENESS · 应用价值与完成度", "可运行的 MVP，且能落到任意活跃产品");

  // left: value
  s.addShape(pres.shapes.RECTANGLE, { x: 0.62, y: 1.95, w: 5.9, h: 4.7, fill: { color: LIGHT }, line: { color: HAIR, width: 1 } });
  s.addText("应用价值", { x: 0.92, y: 2.15, w: 5, h: 0.5, fontSize: 20, bold: true, color: VIOLET, fontFace: HEAD, margin: 0 });
  const vals = [
    "把「读反馈 → 排优先级 → 写 PRD」从数天人工压缩到一次自动化运行，每条结论可追溯。",
    "数据源可插拔：任意有用户反馈 + GitHub 仓库的活跃产品 / 开源项目都能接入（本 Demo 用 82.6k★ 的 RAGFlow）。",
    "证据闭包 + 人工分级，让 AI 决策可审计、可问责——这正是产品团队敢用 Agent 的前提。",
  ];
  let vy = 2.8;
  vals.forEach((t) => {
    nodeMark(s, 0.95, vy + 0.06, VIOLET, 0.14);
    s.addText(t, { x: 1.22, y: vy - 0.05, w: 5.05, h: 1.1, fontSize: 13.5, color: "475067", fontFace: BODY, lineSpacingMultiple: 1.28, margin: 0, valign: "top" });
    vy += 1.22;
  });

  // right: completeness stats grid
  s.addText("完成度 · 可运行证据", { x: 6.95, y: 2.15, w: 6, h: 0.5, fontSize: 20, bold: true, color: GREEN, fontFace: HEAD, margin: 0 });
  const stats = [
    ["14", "节点全链跑通", VIOLET],
    ["137", "测试通过 (10 skip)", GREEN],
    ["2", "套 React 前端", "0EA5E9"],
    ["4", "份 Markdown 报告", VIOLET],
    ["0", "次 LLM 调用 (replay)", GREEN],
    ["100%", "离线可复现", AMBER],
  ];
  const gw = 1.92, gh = 1.32, gx = 6.95, gy = 2.8, ggap = 0.12;
  stats.forEach(([big, lab, col], i) => {
    const x = gx + (i % 3) * (gw + ggap);
    const y = gy + Math.floor(i / 3) * (gh + ggap);
    s.addShape(pres.shapes.RECTANGLE, { x, y, w: gw, h: gh, fill: { color: WHITE }, line: { color: HAIR, width: 1 }, shadow: shadow() });
    s.addText(big, { x: x, y: y + 0.18, w: gw, h: 0.7, fontSize: 33, bold: true, color: col, align: "center", fontFace: HEAD, margin: 0 });
    s.addText(lab, { x: x + 0.06, y: y + 0.92, w: gw - 0.12, h: 0.34, fontSize: 10.5, color: MUTED, align: "center", fontFace: BODY, margin: 0 });
  });
  s.addText("evopm run --replay：断网也能端到端完整演示——演示路径可靠 > 工程完备。",
    { x: 6.95, y: 6.0, w: 5.9, h: 0.6, fontSize: 12.5, color: INK, italic: true, fontFace: BODY, lineSpacingMultiple: 1.2, margin: 0, valign: "top" });
  pageNum(s, 10, false);
}

// =====================================================================
// 11) ROADMAP (light) — future planning
// =====================================================================
{
  const s = newLight();
  lightTitle(s, "ROADMAP · 未来规划", "从 Demo 到能持续进化的产品决策中枢");

  const cols = [
    ["NOW", "打磨 Demo", ["后端实时 API 串联两套前端", "门禁 / 评分权重可视化调参", "更多真实 Issue 样本回归"], GREEN],
    ["NEXT", "走向闭环", ["实时反馈流接入（工单 / 社区 / 应用商店）", "决策落地后的追踪与回环验证", "多产品 / 多模块并行分析"], VIOLET],
    ["LATER", "生态与规模", ["深度集成 SoloVerse 生态工具", "团队协作与评审工作台", "决策知识库沉淀与复用"], "0EA5E9"],
  ];
  const cw = 3.95, gap = 0.3, x0 = 0.62, y0 = 1.95, ch = 4.6;
  cols.forEach(([phase, t, list, col], i) => {
    const x = x0 + i * (cw + gap);
    s.addShape(pres.shapes.RECTANGLE, { x, y: y0, w: cw, h: ch, fill: { color: WHITE }, line: { color: HAIR, width: 1 }, shadow: shadow() });
    s.addShape(pres.shapes.RECTANGLE, { x, y: y0, w: cw, h: 0.7, fill: { color: col }, line: { type: "none" } });
    s.addText(phase, { x: x + 0.3, y: y0 + 0.12, w: cw - 0.6, h: 0.46, fontSize: 18, bold: true, color: WHITE, valign: "middle", fontFace: HEAD, margin: 0 });
    s.addText(t, { x: x + 0.3, y: y0 + 0.9, w: cw - 0.6, h: 0.5, fontSize: 18, bold: true, color: INK, fontFace: HEAD, margin: 0 });
    s.addText(list.map((li, k) => ({ text: li, options: { bullet: { code: "2022", indent: 14 }, color: "475067", breakLine: true, paraSpaceAfter: 10 } })),
      { x: x + 0.32, y: y0 + 1.6, w: cw - 0.62, h: 2.8, fontSize: 13, fontFace: BODY, lineSpacingMultiple: 1.15, margin: 0, valign: "top" });
  });
  pageNum(s, 11, false);
}

// =====================================================================
// 12) CLOSING (dark)
// =====================================================================
{
  const s = newDark();
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 5.55, y: 1.7, w: 0.62, h: 0.62, fill: { color: VIOLET }, rectRadius: 0.14, line: { type: "none" } });
  s.addText("E", { x: 5.55, y: 1.7, w: 0.62, h: 0.62, fontSize: 32, bold: true, color: WHITE, align: "center", valign: "middle", fontFace: HEAD, margin: 0 });
  s.addText("EvoPM Agent", { x: 6.3, y: 1.72, w: 5, h: 0.6, fontSize: 24, bold: true, color: VIOLETL, valign: "middle", fontFace: HEAD, margin: 0 });

  s.addText("让每一个产品决策\n都有证据 · 有出口 · 可追溯", { x: 1, y: 2.7, w: 11.3, h: 1.8, fontSize: 40, bold: true, color: WHITE, align: "center", fontFace: HEAD, lineSpacingMultiple: 1.12, margin: 0 });

  s.addShape(pres.shapes.LINE, { x: 3.5, y: 4.95, w: 6.3, h: 0, line: { color: "33356A", width: 1 } });
  s.addText("基于 LangGraph 的多智能体产品需求决策系统  ·  SoloVerse · Agent 元宇宙黑客松",
    { x: 1, y: 5.2, w: 11.3, h: 0.4, fontSize: 15, color: "9DA0CF", align: "center", fontFace: BODY, margin: 0 });
  s.addText("github.com/Adversit/Product-Evolution-Agents", { x: 1, y: 5.7, w: 11.3, h: 0.4, fontSize: 14, color: VIOLETL, align: "center", fontFace: MONO, margin: 0 });
  s.addText("谢谢观看", { x: 1, y: 6.35, w: 11.3, h: 0.5, fontSize: 18, color: "D7D9F2", align: "center", fontFace: BODY, margin: 0 });
}

pres.writeFile({ fileName: OUT }).then((f) => console.log("WROTE:", f)).catch((e) => { console.error(e); process.exit(1); });

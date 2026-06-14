// Minimal Markdown renderer (no deps) for the report reading pane. Covers the
// constructs the EvoPM reports actually use: ATX headings, bullet/numbered lists,
// fenced code blocks, blockquotes, horizontal rules, bold/italic/inline-code, and
// paragraphs. Styled to the light-Linear theme.
import type { CSSProperties, ReactNode } from "react";

// inline: **bold**, *italic*, `code`
function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*([^*]+)\*\*|`([^`]+)`|\*([^*]+)\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[2] !== undefined) out.push(<strong key={k++} style={{ color: "#1B1C1E", fontWeight: 700 }}>{m[2]}</strong>);
    else if (m[3] !== undefined)
      out.push(
        <code key={k++} style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.88em", background: "#F4F4F3", border: "1px solid #ECECEA", borderRadius: 4, padding: "1px 5px" }}>{m[3]}</code>,
      );
    else if (m[4] !== undefined) out.push(<em key={k++}>{m[4]}</em>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const hStyle = (level: number): CSSProperties => {
  const size = [21, 18, 15.5, 14, 13, 12.5][Math.min(level, 5) - 1] || 13;
  return { fontSize: size, fontWeight: 700, letterSpacing: "-.3px", color: "#1B1C1E", margin: level <= 2 ? "26px 0 12px" : "20px 0 9px", lineHeight: 1.35 };
};

export default function Markdown({ source }: { source: string }) {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    // fenced code block
    if (/^```/.test(line)) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
      i++; // closing fence
      blocks.push(
        <pre key={key++} style={{ margin: "14px 0", fontFamily: "'JetBrains Mono',monospace", fontSize: 11.5, lineHeight: 1.7, color: "#56595F", whiteSpace: "pre-wrap", background: "#FFFFFF", border: "1px solid #ECECEA", borderRadius: 10, padding: "14px 16px", overflowX: "auto" }}>
          {buf.join("\n")}
        </pre>,
      );
      continue;
    }

    // heading
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      blocks.push(<div key={key++} style={hStyle(h[1].length)}>{inline(h[2])}</div>);
      i++;
      continue;
    }

    // horizontal rule
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      blocks.push(<hr key={key++} style={{ border: "none", borderTop: "1px solid #ECECEA", margin: "20px 0" }} />);
      i++;
      continue;
    }

    // GFM table: a header row containing "|" followed by a |---|---| separator row.
    if (line.includes("|") && i + 1 < lines.length && /^\s*\|?[\s:|-]*-[\s:|-]*\|?\s*$/.test(lines[i + 1]) && lines[i + 1].includes("-")) {
      const splitRow = (r: string) =>
        r.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|").map((c) => c.trim());
      const header = splitRow(line);
      i += 2; // header + separator
      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes("|") && lines[i].trim() !== "") {
        rows.push(splitRow(lines[i]));
        i++;
      }
      const cellBase: CSSProperties = { padding: "7px 11px", fontSize: 12, lineHeight: 1.6, textAlign: "left", verticalAlign: "top", borderBottom: "1px solid #ECECEA" };
      blocks.push(
        <div key={key++} style={{ margin: "14px 0", overflowX: "auto", border: "1px solid #E6E6E4", borderRadius: 10 }}>
          <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 360 }}>
            <thead>
              <tr style={{ background: "#F4F4F3" }}>
                {header.map((h, j) => (
                  <th key={j} style={{ ...cellBase, fontWeight: 700, color: "#1B1C1E" }}>{inline(h)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri}>
                  {header.map((_, ci) => (
                    <td key={ci} style={{ ...cellBase, color: "#56595F" }}>{inline(r[ci] ?? "")}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    // blockquote
    if (/^\s*>\s?/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^\s*>\s?/, ""));
      blocks.push(
        <blockquote key={key++} style={{ margin: "14px 0", padding: "8px 14px", borderLeft: "3px solid #E6E6E4", color: "#8A8F98", fontSize: 12.5, lineHeight: 1.7 }}>
          {inline(buf.join(" "))}
        </blockquote>,
      );
      continue;
    }

    // list (unordered or ordered) — consecutive item lines
    if (/^\s*([-*+]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\.\s+/.test(line);
      const items: string[] = [];
      while (i < lines.length && /^\s*([-*+]|\d+\.)\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*([-*+]|\d+\.)\s+/, ""));
        i++;
      }
      const Tag = ordered ? "ol" : "ul";
      blocks.push(
        <Tag key={key++} style={{ margin: "10px 0", paddingLeft: 22, display: "flex", flexDirection: "column", gap: 6 }}>
          {items.map((it, j) => (
            <li key={j} style={{ fontSize: 12.5, lineHeight: 1.7, color: "#56595F" }}>{inline(it)}</li>
          ))}
        </Tag>,
      );
      continue;
    }

    // blank line
    if (line.trim() === "") {
      i++;
      continue;
    }

    // paragraph — gather until blank / block start
    const buf: string[] = [];
    while (i < lines.length && lines[i].trim() !== "" && !/^(#{1,6}\s|```|\s*>|\s*([-*+]|\d+\.)\s|\s*(-{3,}|\*{3,}|_{3,})\s*$)/.test(lines[i])) {
      buf.push(lines[i++]);
    }
    blocks.push(
      <p key={key++} style={{ margin: "10px 0", fontSize: 13, lineHeight: 1.8, color: "#56595F", textWrap: "pretty" } as CSSProperties}>{inline(buf.join(" "))}</p>,
    );
  }

  return <div>{blocks}</div>;
}

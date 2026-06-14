// Hand-drawn SVG quality radar — faithful port of `_radar(dims, t, round)` from the
// design's Component class. 10 axes, grid rings, round-1 gray polygon vs round-2
// lavender polygon. `t` (0..1) grows the polygons on entrance; `round` (1|2)
// emphasizes the active layer and switches axis score labels.
import type { QualityDim } from "../data/state";

const SHORT: Record<string, string> = {
  clarity: "清晰",
  completeness: "完整",
  testability: "可测",
  acceptance_clarity: "验收",
  evidence_sufficiency: "证据",
  scope_control: "范围",
  feasibility: "可行",
  consistency: "一致",
  user_value: "价值",
  stage_fit: "契合",
};

export default function Radar({ dims, t, round }: { dims: QualityDim[]; t: number; round: number }) {
  const N = dims.length;
  const cx = 152;
  const cy = 150;
  const R = 104;
  const angle = (i: number) => ((-90 + i * (360 / N)) * Math.PI) / 180;
  const pt = (i: number, v: number): [number, number] => {
    const r = R * (v / 100) * t;
    return [cx + r * Math.cos(angle(i)), cy + r * Math.sin(angle(i))];
  };
  const polyOf = (key: "r1" | "r2") => dims.map((d, i) => pt(i, d[key]).join(",")).join(" ");
  const ring = (frac: number) => {
    const r = R * frac;
    return dims.map((_, i) => [cx + r * Math.cos(angle(i)), cy + r * Math.sin(angle(i))].join(",")).join(" ");
  };
  const r1Emph = round === 1;

  return (
    <svg width={304} height={300} viewBox="0 0 304 300" style={{ overflow: "visible" }}>
      {[0.25, 0.5, 0.75, 1].map((fr, k) => (
        <polygon key={"g" + k} points={ring(fr)} fill="none" stroke="#E6E6E4" strokeWidth={1} />
      ))}
      {dims.map((_, i) => {
        const x = cx + R * Math.cos(angle(i));
        const y = cy + R * Math.sin(angle(i));
        return <line key={"a" + i} x1={cx} y1={cy} x2={x} y2={y} stroke="#E6E6E4" strokeWidth={1} />;
      })}
      {dims.map((d, i) => {
        const lr = R + 16;
        const x = cx + lr * Math.cos(angle(i));
        const y = cy + lr * Math.sin(angle(i));
        const anchor = Math.abs(Math.cos(angle(i))) < 0.3 ? "middle" : Math.cos(angle(i)) > 0 ? "start" : "end";
        const active = round === 2 ? d.r2 : d.r1;
        return (
          <g key={"l" + i}>
            <text x={x} y={y - 4} textAnchor={anchor} fontSize={11} fontWeight={600} fill="#56595F" fontFamily="Inter,Noto Sans SC,sans-serif">
              {SHORT[d.name] || d.name}
            </text>
            <text x={x} y={y + 8} textAnchor={anchor} fontSize={9} fontWeight={700} fill={round === 2 ? "#5E6AD2" : "#8A8F98"} fontFamily="JetBrains Mono,monospace">
              {String(active)}
            </text>
          </g>
        );
      })}
      <polygon
        points={polyOf("r1")}
        fill="rgba(138,143,152,.10)"
        stroke={r1Emph ? "#8A8F98" : "#A9ACA9"}
        strokeWidth={r1Emph ? 2 : 1.5}
        strokeDasharray={r1Emph ? "0" : "4 3"}
        strokeLinejoin="round"
        style={{ opacity: r1Emph ? 1 : 0.7, transition: "all .4s ease" }}
      />
      <polygon
        points={polyOf("r2")}
        fill={round === 2 ? "rgba(94,106,210,.20)" : "rgba(94,106,210,.08)"}
        stroke="#5E6AD2"
        strokeWidth={round === 2 ? 2.3 : 1.5}
        strokeLinejoin="round"
        style={{ opacity: round === 2 ? 1 : 0.5, transition: "all .4s ease" }}
      />
      {r1Emph &&
        dims.map((d, i) => {
          const [x, y] = pt(i, d.r1);
          return <circle key={"dr1" + i} cx={x} cy={y} r={round === 1 ? 3 : 2} fill="#8A8F98" />;
        })}
      {dims.map((d, i) => {
        const [x, y] = pt(i, d.r2);
        return <circle key={"dr2" + i} cx={x} cy={y} r={round === 2 ? 3 : 2} fill="#5E6AD2" />;
      })}
    </svg>
  );
}

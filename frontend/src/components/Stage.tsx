import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { CANVAS_H, CANVAS_W, EDGES, NODES } from "../lib/graph";
import { edgePath, phaseOf } from "../lib/pipeline";
import { COLORS } from "../lib/theme";
import NodeCard from "./NodeCard";
import type { NodeRuntime } from "../lib/live";

interface Props {
  step: number;
  anim: boolean;
  hover: string | null;
  located: string | null;
  selected: string | null;
  nodeRuntime: Record<string, NodeRuntime>;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
}

interface Fit {
  scale: number;
  offX: number;
  offY: number;
}

function useFit(ref: React.RefObject<HTMLDivElement>): Fit {
  const [fit, setFit] = useState<Fit>({ scale: 0.42, offX: 24, offY: 24 });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth - 40;
      const h = el.clientHeight - 70;
      const scale = Math.min(w / CANVAS_W, h / CANVAS_H, 0.95);
      const offX = Math.max(20, (el.clientWidth - CANVAS_W * scale) / 2);
      const offY = Math.max(18, (el.clientHeight - CANVAS_H * scale) / 2 - 10);
      setFit({ scale, offX, offY });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    const t = setTimeout(measure, 250);
    return () => {
      ro.disconnect();
      clearTimeout(t);
    };
  }, [ref]);

  return fit;
}

const MARKERS = [
  ["arrDim", "#3a4250"],
  ["arrCyan", COLORS.active],
  ["arrEmerald", COLORS.done],
  ["arrViolet", COLORS.loop],
] as const;

export default function Stage({ step, anim, hover, located, selected, nodeRuntime, onHover, onSelect }: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const { scale, offX, offY } = useFit(stageRef);
  const byId = useMemo(() => Object.fromEntries(NODES.map((n) => [n.id, n])), []);

  const { edges, labels } = useMemo(() => {
    const edges: Array<{ d: string; style: React.CSSProperties; marker: string }> = [];
    const labels: Array<{ text: string; style: React.CSSProperties }> = [];

    for (const e of EDGES) {
      const f = byId[e.from];
      const t = byId[e.to];
      if (!f || !t) continue;
      const fP = phaseOf(f, step);
      const tP = phaseOf(t, step);
      const { d, lx, ly } = edgePath(f, t, e.kind);

      let stroke: string = COLORS.hairline, width = 1.4, dash = "1 0", op = 0.55, marker = "url(#arrDim)";
      let flowAnim: string | null = null, lblColor: string = COLORS.ink3, lblBd: string = COLORS.hairline;

      if (!e.taken) {
        stroke = "#5b5378"; width = 1.4; dash = "5 7"; op = 0.5; marker = "url(#arrViolet)";
        lblColor = COLORS.loopSoft; lblBd = "rgba(167,139,250,.3)";
      } else if (tP === "active") {
        stroke = COLORS.active; width = 2.4; dash = "7 7"; op = 1; marker = "url(#arrCyan)";
        flowAnim = "flow .85s linear infinite"; lblColor = COLORS.activeSoft; lblBd = "rgba(34,211,238,.4)";
      } else if (fP === "done" && tP === "done") {
        stroke = COLORS.done; width = 1.8; dash = "7 8"; op = 0.7; marker = "url(#arrEmerald)";
        flowAnim = "flowSlow 2.4s linear infinite"; lblColor = COLORS.doneSoft; lblBd = "rgba(52,211,153,.3)";
      } else if (fP === "done") {
        stroke = "#2f6d63"; width = 1.7; dash = "7 8"; op = 0.6; marker = "url(#arrEmerald)";
      }

      const style: React.CSSProperties = {
        fill: "none", stroke, strokeWidth: width, strokeDasharray: dash, strokeLinecap: "round", opacity: op,
      };
      if (flowAnim && anim) style.animation = flowAnim;
      edges.push({ d, style, marker });

      if (e.label) {
        labels.push({
          text: e.label,
          style: {
            position: "absolute", left: lx, top: ly, transform: "translate(-50%,-50%)",
            font: "600 10px 'JetBrains Mono',monospace", color: lblColor,
            background: "#0d1119", border: `1px solid ${lblBd}`, borderRadius: 5,
            padding: "2px 6px", whiteSpace: "nowrap", pointerEvents: "none", zIndex: 8,
          },
        });
      }
    }
    return { edges, labels };
  }, [step, anim, byId]);

  return (
    <main
      style={{
        flex: 1, position: "relative", minWidth: 0,
        background: "radial-gradient(1200px 600px at 35% 30%,#10151f 0%,#0B0E14 70%)",
      }}
    >
      <div ref={stageRef} style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
        <div
          style={{
            position: "absolute", left: offX, top: offY, width: CANVAS_W, height: CANVAS_H,
            transform: `scale(${scale})`, transformOrigin: "top left",
          }}
        >
          <svg
            width={CANVAS_W}
            height={CANVAS_H}
            style={{ position: "absolute", left: 0, top: 0, overflow: "visible", pointerEvents: "none" }}
          >
            <defs>
              {MARKERS.map(([id, fill]) => (
                <marker key={id} id={id} markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto">
                  <path d="M0,0 L7,3 L0,6 Z" fill={fill} />
                </marker>
              ))}
            </defs>
            {edges.map((e, i) => (
              <path key={i} d={e.d} markerEnd={e.marker} style={e.style} />
            ))}
          </svg>

          {labels.map((lb, i) => (
            <div key={i} style={lb.style}>
              {lb.text}
            </div>
          ))}

          {NODES.map((n) => (
            <NodeCard
              key={n.id}
              node={n}
              phase={phaseOf(n, step)}
              scale={scale}
              anim={anim}
              runtime={nodeRuntime[n.id]}
              isHover={hover === n.id}
              isLocated={located === n.id}
              isSelected={selected === n.id}
              onEnter={() => onHover(n.id)}
              onLeave={() => onHover(null)}
              onClick={() => onSelect(n.id)}
            />
          ))}
        </div>
      </div>

      {/* legend */}
      <div
        style={{
          position: "absolute", left: 18, bottom: 14, display: "flex", alignItems: "center", gap: 16,
          padding: "8px 14px", border: `1px solid ${COLORS.hairline}`, borderRadius: 9,
          background: "rgba(17,22,31,.82)", backdropFilter: "blur(6px)",
          fontSize: 11, fontFamily: "'JetBrains Mono',monospace",
        }}
      >
        <span style={{ color: COLORS.ink3, letterSpacing: ".5px" }}>状态</span>
        <LegendDot color={COLORS.active} glow label="active" />
        <LegendDot color={COLORS.done} label="done" />
        <LegendDot color={COLORS.ink3} label="pending" />
        <span style={{ width: 1, height: 14, background: COLORS.hairline }} />
        <span style={{ color: COLORS.ink3, letterSpacing: ".5px" }}>边</span>
        <span style={{ color: COLORS.activeSoft }}>— 实际走向</span>
        <span style={{ color: COLORS.loopSoft }}>┄ 回环/未触发</span>
      </div>
    </main>
  );
}

function LegendDot({ color, label, glow }: { color: string; label: string; glow?: boolean }) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 5, color: COLORS.ink2 }}>
      <i
        style={{
          width: 8, height: 8, borderRadius: "50%", background: color,
          boxShadow: glow ? `0 0 8px ${color}` : undefined,
        }}
      />
      {label}
    </span>
  );
}

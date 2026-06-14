import { CANVAS_W, NODE_H, NODE_W, type NodeDef } from "../lib/graph";
import { chipStyle, COLORS } from "../lib/theme";
import type { Phase } from "../lib/pipeline";

interface Props {
  node: NodeDef;
  phase: Phase;
  scale: number;
  anim: boolean;
  isHover: boolean;
  isLocated: boolean;
  isSelected: boolean;
  onEnter: () => void;
  onLeave: () => void;
  onClick: () => void;
}

export default function NodeCard({
  node, phase, scale, anim, isHover, isLocated, isSelected, onEnter, onLeave, onClick,
}: Props) {
  const active = phase === "active";
  const done = phase === "done";
  const pending = phase === "pending";
  const ghost = phase === "ghost";

  const dotColor = active ? node.ac : done ? COLORS.done : COLORS.ink3;
  const originX = node.x < CANVAS_W * 0.3 ? "left" : node.x > CANVAS_W * 0.66 ? "right" : "center";
  const originY = node.y < 150 ? "top" : node.y > 300 ? "bottom" : "center";

  const style: React.CSSProperties = {
    position: "absolute", left: node.x, top: node.y, width: NODE_W, minHeight: NODE_H,
    boxSizing: "border-box", padding: "9px 11px 10px", borderRadius: 11,
    border: `1px solid ${active ? node.ac : done ? "#2c3a44" : "#1d2530"}`,
    borderTop: `3px solid ${node.ac}`,
    background: active ? COLORS.card : done ? "#141a25" : "#10141d",
    opacity: ghost ? 0.34 : pending ? 0.5 : 1,
    cursor: "pointer",
    transition: "transform .18s cubic-bezier(.22,.61,.36,1), opacity .25s, box-shadow .25s",
    transformOrigin: `${originX} ${originY}`,
    zIndex: isHover ? 60 : active ? 20 : 5,
  };

  if (ghost) {
    style.borderStyle = "dashed";
    style.borderColor = "#39334d";
    style.borderTopColor = "#5b5378";
  }
  if (active && anim) style.animation = `${node.kf} 2.2s ease-in-out infinite`;
  else if (active) style.boxShadow = `0 0 0 1px ${node.ac}, 0 0 24px rgba(34,211,238,.28)`;
  if (isSelected) style.boxShadow = `0 0 0 2px ${COLORS.active}, 0 0 22px rgba(34,211,238,.42)`;
  if (isLocated) style.boxShadow = "0 0 0 2px #FBBF24, 0 0 26px rgba(251,191,36,.5)";
  if (isHover) {
    style.transform = `scale(${(1 / scale) * 0.92})`;
    style.opacity = 1;
    style.zIndex = 60;
    style.boxShadow = `0 18px 50px rgba(0,0,0,.7), 0 0 0 1px ${node.ac}`;
    style.animation = "none";
  }

  const dotStyle: React.CSSProperties = {
    width: 9, height: 9, borderRadius: "50%", flexShrink: 0, background: dotColor,
  };
  if (active) {
    dotStyle.boxShadow = `0 0 9px ${node.ac}`;
    if (anim) dotStyle.animation = "dotPulse 1.4s ease-in-out infinite";
  }

  return (
    <div style={style} onMouseEnter={onEnter} onMouseLeave={onLeave} onClick={onClick}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
        <span style={dotStyle} />
        <span style={{ font: "700 13px 'JetBrains Mono',monospace", color: "#EDF1F6", letterSpacing: ".2px" }}>
          {node.label}
        </span>
        <span style={{ marginLeft: "auto", font: "500 11px 'JetBrains Mono',monospace", color: COLORS.ink3 }}>
          {node.dur}
        </span>
      </div>
      <div
        style={{
          font: "500 11px 'JetBrains Mono',monospace", color: "#7C8AA0", marginBottom: 5,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}
      >
        {node.agent}
      </div>
      <div style={{ font: "400 11.5px Inter,sans-serif", color: "#aab2bf", lineHeight: 1.36, marginBottom: 7 }}>
        {node.conclusion}
      </div>

      {node.bar && (
        <div style={{ marginBottom: 7 }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 26 }}>
            {node.bar.segs.map(([sc, c], i) => (
              <div
                key={i}
                style={{
                  flex: 1, height: sc * 0.26, borderRadius: "2px 2px 0 0",
                  background:
                    c === "a"
                      ? "linear-gradient(180deg,#FBBF24,#b27d12)"
                      : "linear-gradient(180deg,#22D3EE,#1c7c8c)",
                  opacity: active || done ? 1 : 0.45,
                }}
              />
            ))}
          </div>
          <div style={{ font: "500 9.5px 'JetBrains Mono',monospace", color: COLORS.ink3, marginTop: 3 }}>
            {node.bar.label}
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {node.chips.map(([text, kind], i) => (
          <span key={i} style={chipStyle(kind)}>
            {text}
          </span>
        ))}
      </div>
    </div>
  );
}

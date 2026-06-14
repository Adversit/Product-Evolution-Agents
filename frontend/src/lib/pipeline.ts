import { NODE_W as W, NODE_H as H, CANVAS_H, type EdgeKind, type NodeDef } from "./graph";

export type Phase = "active" | "done" | "pending" | "ghost";

// Which lifecycle phase a node is in at a given step. Ported from phaseOf().
export function phaseOf(n: NodeDef, step: number): Phase {
  if (n.ghost) return "ghost";
  if (n.steps.includes(step)) return "active";
  if (n.steps.length && Math.min(...n.steps) < step) return "done";
  return "pending";
}

export interface EdgeGeom {
  d: string;
  lx: number;
  ly: number;
}

// Bezier routing per edge kind — ported 1:1 from edgePath().
export function edgePath(f: NodeDef, t: NodeDef, kind: EdgeKind): EdgeGeom {
  if (kind === "v") {
    const x1 = f.x + W / 2, y1 = f.y + H, x2 = t.x + W / 2, y2 = t.y;
    return { d: `M${x1},${y1}C${x1},${y1 + 48} ${x2},${y2 - 48} ${x2},${y2}`, lx: (x1 + x2) / 2, ly: (y1 + y2) / 2 };
  }
  if (kind === "loop") {
    const up = f.y < 150;
    const x1 = f.x + W / 2, x2 = t.x + W / 2;
    if (up) {
      const y1 = f.y, y2 = t.y;
      const pk = Math.max(8, Math.min(y1, y2) - 72);
      return { d: `M${x1},${y1}C${x1},${pk} ${x2},${pk} ${x2},${y2}`, lx: (x1 + x2) / 2, ly: pk };
    }
    const y1 = f.y + H, y2 = t.y + H;
    const pk = Math.min(CANVAS_H - 6, Math.max(y1, y2) + 82);
    return { d: `M${x1},${y1}C${x1},${pk} ${x2},${pk} ${x2},${y2}`, lx: (x1 + x2) / 2, ly: pk };
  }
  if (kind === "wrap") {
    const x1 = f.x + W / 2, y1 = f.y + H, x2 = t.x, y2 = t.y + H / 2;
    return { d: `M${x1},${y1}C${x1},${y1 + 150} ${x2},${y2 - 150} ${x2},${y2}`, lx: (x1 + x2) / 2, ly: (y1 + y2) / 2 + 8 };
  }
  if (kind === "stub") {
    const x1 = f.x, y1 = f.y + H / 2, x2 = x1 - 130, y2 = y1 - 74;
    return { d: `M${x1},${y1}C${x1 - 72},${y1} ${x2 + 28},${y2 + 34} ${x2},${y2}`, lx: x2, ly: y2 - 2 };
  }
  // default: horizontal
  const x1 = f.x + W, y1 = f.y + H / 2, x2 = t.x, y2 = t.y + H / 2, cp = Math.max((x2 - x1) * 0.5, 52);
  return { d: `M${x1},${y1}C${x1 + cp},${y1} ${x2 - cp},${y2} ${x2},${y2}`, lx: (x1 + x2) / 2, ly: (y1 + y2) / 2 - 13 };
}

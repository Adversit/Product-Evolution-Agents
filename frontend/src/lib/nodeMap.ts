// Maps backend node names (emitted on /ws as {event:"node", node}) to this app's
// frontend graph node ids and the pipeline `step` index the DAG should advance to.
//
// The 14 backend nodes do not map 1:1 onto the frontend's 15 visual cards: the
// frontend splits some agent stages into extra cards (roadmap, code_impact) and
// renames others (select_cluster→discovery, solution_design→solution,
// human_review→human). quality_gate fires twice (draft then re-eval after enrich).

import { TOTAL_STEPS } from "./graph";

export interface BackendNodeInfo {
  // Frontend NodeDef id to overlay the live summary/elapsed onto (null = no card).
  cardId: string | null;
  // step index to light the DAG up to when this backend node completes.
  step: number;
}

// quality_gate appears twice; we resolve the 2nd occurrence to the re-eval step at runtime.
const MAP: Record<string, BackendNodeInfo> = {
  intake: { cardId: "intake", step: 0 },
  discovery: { cardId: "discovery", step: 1 },
  select_cluster: { cardId: "discovery", step: 1 },
  competitor_research: { cardId: "competitor_research", step: 2 },
  tech_research: { cardId: "tech_research", step: 2 },
  quality_gate: { cardId: "quality_gate", step: 3 },
  enrich: { cardId: "enrich", step: 4 },
  // quality_gate (2nd) → re-eval: handled by occurrence counter → step 5
  opportunity: { cardId: "opportunity", step: 6 },
  solution_design: { cardId: "solution", step: 8 },
  engineering: { cardId: "engineering", step: 10 },
  critic: { cardId: "critic", step: 11 },
  human_review: { cardId: "human", step: 12 },
  report: { cardId: "report", step: TOTAL_STEPS - 1 },
};

const QUALITY_GATE_REEVAL: BackendNodeInfo = { cardId: "quality_gate", step: 5 };

// Resolve a backend node, accounting for the 2nd quality_gate (re-eval) occurrence.
export function resolveNode(node: string, seenQualityGate: boolean): BackendNodeInfo | null {
  if (node === "quality_gate" && seenQualityGate) return QUALITY_GATE_REEVAL;
  return MAP[node] ?? null;
}

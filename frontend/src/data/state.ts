// Typed view over the real glm-5.1 run state (docs/claude_design/demo/sample_state.json).
// Only the fields the node-inspection drawer reads are typed precisely; uncertain
// nested arrays are left as `unknown[]` and rendered generically.
import raw from "./sample_state.json";

export interface Signal {
  id: string;
  source_type: string;
  origin_url: string;
  author_type: string;
  created_at: string;
  text: string;
  module_guess: string;
  category: string;
  sentiment: string;
  actionability: string;
  duplicate_of: string | null;
  data_quality: string;
  followup_question: string;
}

export interface ExistingRequirement {
  id: string;
  title: string;
  summary: string;
  status: string;
}

export interface Cluster {
  id: string;
  title: string;
  summary: string;
  signal_ids: string[];
  categories: string[];
  severity: string;
  frequency: number;
  status: string;
  candidate_title: string;
  user_story_draft: string;
  duplicate_of_existing: string | null;
  dedup_reason: string;
}

export interface CompetitorFinding {
  id: string;
  competitor: string;
  research_question: string;
  has_solved: boolean;
  conclusion: string;
  verdict: string;
  gap_description: string;
  implication: string;
  source_url: string;
  evidence_strength: string;
}

export interface TechFinding {
  id: string;
  topic: string;
  solution_name: string;
  maturity: string;
  fit_reason: string;
  cost_estimate: string;
  risk: string;
  source_url: string;
  evidence_strength: string;
}

export interface QualityDimension {
  name: string;
  score: number;
  rationale: string;
}

export interface Quality {
  dimensions: QualityDimension[];
  total: number;
  gate: string;
  round: number;
  missing_info: string[];
  ambiguities: string[];
  followup_questions: string[];
}

export interface AcceptanceCriterion {
  text: string;
  type: string;
  evidence_refs: string[];
}

export interface FocusCandidate {
  id: string;
  cluster_id: string;
  title: string;
  background: string;
  target_users: string[];
  pain_point: string;
  business_goal: string;
  scope: string[];
  non_goals: string[];
  boundary_conditions: string[];
  clarifications: string[];
  user_stories: unknown[];
  acceptance_criteria: AcceptanceCriterion[];
  evidence_refs: string[];
  quality: Quality;
  quality_history: Quality[];
  status: string;
}

export interface OpportunityScore {
  dimension: string;
  score: number;
  rationale: string;
  evidence_refs: string[];
}

export interface Opportunity {
  requirement_id: string;
  scores: OpportunityScore[];
  total: number;
  priority: string;
  horizon: string;
  rationale: string;
  special_types: string[];
}

export interface RoadmapItem {
  cluster_id: string;
  title: string;
  priority: string;
  horizon: string;
  one_line_reason: string;
  is_focus: boolean;
}

export interface Solution {
  requirement_id: string;
  summary: string;
  scope: string[];
  non_goals: string[];
  user_flow: unknown[];
  acceptance_criteria: unknown[];
  edge_cases: unknown[];
  test_scenarios: unknown[];
  role_notes: Record<string, unknown>;
  risks: unknown[];
  dependencies: unknown[];
}

export interface CodeImpactItem {
  module_path: string;
  is_core_module: boolean;
  risk_tier: string;
  impact_level: string;
  impact_types: string[];
  description: string;
  verify_points: string[];
}

export interface CodeImpact {
  requirement_id: string;
  items: CodeImpactItem[];
  suggested_order: string[];
  human_confirmation_needed: string[];
}

export interface Task {
  id: string;
  title: string;
  type: string;
  description: string;
  related_modules: string[];
  risk_tier: string;
  evidence_refs: string[];
}

export interface ImplStep {
  step: number;
  action: string;
  modules: string[];
  risk: string;
  verify: string;
}

export interface Execution {
  requirement_id: string;
  tasks: Task[];
  change_suggestions: unknown[];
  test_suggestions: unknown[];
  impl_plan: ImplStep[];
  changelog_draft: string;
  blocked: boolean;
}

export interface Finding {
  target: string;
  overreach: boolean;
  demote_to_observation: boolean;
  evidence_strength: string;
  risk_tier: string;
  note: string;
}

export interface CriticReview {
  findings: Finding[];
  pending_confirmations: string[];
  redo_target: string | null;
  redo_instructions: string;
}

export interface HumanDecision {
  checkpoint: string;
  item_ref: string;
  action: string;
  reason: string;
  edited_content: string;
  timestamp: string;
}

export interface SampleState {
  run_mode: string;
  llm_call_count: number;
  signals: Signal[];
  existing_requirements: ExistingRequirement[];
  clusters: Cluster[];
  selected_cluster_id: string;
  competitor_findings: CompetitorFinding[];
  tech_findings: TechFinding[];
  focus_candidate: FocusCandidate;
  opportunity: Opportunity;
  roadmap: RoadmapItem[];
  solution: Solution;
  code_impact: CodeImpact;
  execution: Execution;
  critic_review: CriticReview;
  human_decisions: HumanDecision[];
  report_paths: string[];
}

export const STATE = raw as unknown as SampleState;

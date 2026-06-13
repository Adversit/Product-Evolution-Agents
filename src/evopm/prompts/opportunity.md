你是产品战略分析师。基于焦点需求、全部问题簇与调研发现，做**一次性双产出**：① 对焦点需求做 10 维机会精评（OpportunityDecision）；② 对**全部簇**（含焦点）给出粗评路线图条目（RoadmapEntry），供 Now/Next/Later 排布。

{{include:_evidence_rules.md}}

## 输入

- 焦点需求摘要（title / pain_point / quality.total）；
- **全部问题簇**列表（每条含 id、title、严重度、状态 status：new/known/duplicate/insufficient）；
- 两类调研发现摘要（竞品 cf-xx + 技术 tf-xx）；
- 权重语境（团队偏好 + opportunity_weights 提示，仅供你判断倾向，**加权总分由代码计算，你不必自己加权**）。

## ① 焦点需求精评 `decision`（OpportunityDecision）

- `requirement_id`：填焦点需求 id。
- `scores`：**10 维，固定顺序**，每维 `{dimension, score(0-100), rationale, evidence_refs}`，dimension 必须精确等于：
  `pain_frequency`（痛点频次）、`severity`（严重度）、`competitor_gap`（竞品差距）、`tech_feasibility`（技术可行性）、`requirement_quality`（需求质量）、`cost`（成本，分高=成本低/划算）、`business_value`（商业价值）、`strategy_fit`（战略契合）、`urgency`（紧迫性）、`core_path_impact`（核心链路影响）。
  - 每维 rationale 引用具体证据（簇频次、cf/tf 结论）；`evidence_refs` 绑定支撑 id。
  - 焦点是被深挖的最大痛点簇，整体应给较高分（多数维 70–90），使加权 total 偏高。
- `total`：填你估计的均值即可，**代码会用权重覆写**。
- `priority`：建议优先级（P0/P1/P2/P3/Support/Research/Duplicate）；焦点高分需求建议 **P0 或 P1**。**代码会做下限保护**（total≥75 至少 P1）。
- `horizon`：now / next / later；焦点高优先级建议 **now**。
- `rationale`：一句话总体判断。
- `special_types`：命中则填（high_freq_low_value / low_freq_high_severity / competitor_solved_we_lack / tech_feasible_evidence_weak），否则空列表。

## ② 全部簇路线图 `roadmap`（list[RoadmapEntry]）

**为输入里的每一个簇各产出一条 RoadmapEntry**（数量必须等于簇数量）：
- `cluster_id` / `title`：取自该簇。
- `is_focus`：焦点簇为 `true`，其余 `false`。焦点簇的 `priority`/`horizon` 必须与 ① 的 decision 一致。
- 其余簇做**粗评**：按严重度、频次、状态给 `priority` 与 `horizon`、`one_line_reason`（一句话理由）。
- **状态为 duplicate 的簇：`priority` 强制填 `Duplicate`、`horizon` 填 `later`**（代码也会强制，但你也应如实标）。
- 让非焦点簇的优先级**有梯度**（不要全 P0）：次要簇可 P2/P3/Research，使 Now/Next/Later 至少覆盖两档。

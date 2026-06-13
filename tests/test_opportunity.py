"""机会评分规则单测（T0.6，spec §5.2）：加权总分 + 优先级下限保护。"""

from evopm.rules import OPPORTUNITY_DIMS, enforce_priority_floor, weighted_opportunity_total
from evopm.schemas import ClusterStatus, OpportunityScore, Priority


def _scores(score_map):
    return [OpportunityScore(dimension=d, score=s, rationale="r") for d, s in score_map.items()]


def test_equal_weights_is_plain_mean():
    scores = _scores({d: 80 for d in OPPORTUNITY_DIMS})
    assert weighted_opportunity_total(scores, {}) == 80.0


def test_weighted_total_respects_weights():
    # 两维：a 权重 2.0 得 90，b 权重 1.0 得 60 → (90*2+60)/(2+1)=80
    scores = [
        OpportunityScore(dimension="pain_frequency", score=90, rationale="r"),
        OpportunityScore(dimension="cost", score=60, rationale="r"),
    ]
    weights = {"pain_frequency": 2.0, "cost": 1.0}
    assert weighted_opportunity_total(scores, weights) == 80.0


def test_empty_scores_returns_zero():
    assert weighted_opportunity_total([], {}) == 0.0


def test_duplicate_status_forces_duplicate_priority():
    assert enforce_priority_floor(Priority.P0, 90.0, ClusterStatus.DUPLICATE) == Priority.DUPLICATE


def test_high_total_floors_to_at_least_p1():
    # 建议 P3 但 total>=75 → 抬到 P1
    assert enforce_priority_floor(Priority.P3, 78.0, ClusterStatus.NEW) == Priority.P1


def test_high_total_keeps_stronger_priority():
    # 已是 P0（强于 P1）→ 保持 P0
    assert enforce_priority_floor(Priority.P0, 90.0, ClusterStatus.NEW) == Priority.P0


def test_low_total_keeps_suggestion():
    assert enforce_priority_floor(Priority.P3, 50.0, ClusterStatus.NEW) == Priority.P3

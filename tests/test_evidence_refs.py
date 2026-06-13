"""证据闭包校验单测（T0.4，spec §4 末尾）。"""

from evopm.agents.base import collect_valid_ids, validate_evidence_refs
from evopm.schemas import (
    Category,
    ClusterStatus,
    InsightCluster,
    RequirementCandidate,
    Severity,
    SignalItem,
    SourceType,
    UserStory,
)


def _cluster(signal_ids):
    return InsightCluster(
        id="clu-01",
        title="t",
        summary="s",
        signal_ids=signal_ids,
        categories=[Category.BUG],
        severity=Severity.HIGH,
        frequency=len(signal_ids),
        status=ClusterStatus.NEW,
        candidate_title="c",
        user_story_draft="u",
    )


def test_drops_illegal_signal_ids_and_records_violation():
    valid_ids = {"sig-001", "sig-002"}
    cluster = _cluster(["sig-001", "sig-999", "sig-002"])

    clean, violations = validate_evidence_refs(cluster, valid_ids)

    assert clean.signal_ids == ["sig-001", "sig-002"]
    assert len(violations) == 1
    assert "sig-999" in violations[0]
    # 原对象不被修改
    assert cluster.signal_ids == ["sig-001", "sig-999", "sig-002"]


def test_recurses_into_nested_models():
    valid_ids = {"cf-01", "tf-01"}
    req = RequirementCandidate(
        id="req-01",
        cluster_id="clu-01",
        title="t",
        background="b",
        target_users=["u"],
        pain_point="p",
        business_goal="g",
        scope=[],
        non_goals=[],
        boundary_conditions=[],
        clarifications=[],
        user_stories=[
            UserStory(role="r", scenario="s", benefit="b", story_text="x",
                      evidence_refs=["cf-01", "bogus-1"])
        ],
        evidence_refs=["tf-01", "sig-404"],
    )

    clean, violations = validate_evidence_refs(req, valid_ids)

    assert clean.evidence_refs == ["tf-01"]
    assert clean.user_stories[0].evidence_refs == ["cf-01"]
    assert len(violations) == 2  # 顶层 evidence_refs + 嵌套 user_story


def test_no_violations_when_all_valid():
    cluster = _cluster(["sig-001"])
    clean, violations = validate_evidence_refs(cluster, {"sig-001"})
    assert violations == []
    assert clean.signal_ids == ["sig-001"]


def test_collect_valid_ids_unions_state_collections():
    state = {
        "signals": [SignalItem(id="sig-001", source_type=SourceType.CSV_FEEDBACK, text="x")],
        "clusters": [_cluster(["sig-001"])],
        "existing_requirements": [],
    }
    ids = collect_valid_ids(state)
    assert ids == {"sig-001", "clu-01"}

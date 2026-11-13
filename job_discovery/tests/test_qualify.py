from job_discovery.config import load_profile
from job_discovery.models import Job
from job_discovery.qualify import qualify_rules
from job_discovery.score import factor_scores, score_job, weighted_total

GOOD = (
    "We are hiring a Finance Manager for a retail group. The role owns FP&A, budgeting, "
    "forecasting, management reporting, variance analysis and P&L. 10 years of experience. "
    "On-site in Riyadh, Saudi Arabia."
)


def _job(**overrides) -> Job:
    data = dict(
        job_uid="greenhouse:1",
        source="greenhouse",
        external_id="1",
        title="Finance Manager",
        company="Example Retail Co",
        location="Riyadh, Saudi Arabia",
        description_full=GOOD,
        url="https://boards.greenhouse.io/example/jobs/1",
        apply_url="https://boards.greenhouse.io/example/jobs/1",
        date_published="2026-11-12",
    )
    data.update(overrides)
    return Job(**data)


def test_target_role_in_riyadh_is_qualified():
    profile = load_profile("finance_gcc")
    decision = qualify_rules(_job(), profile)
    assert decision.status == "qualified"
    assert decision.deal_breakers == "false"


def test_junior_title_is_disqualified():
    profile = load_profile("finance_gcc")
    decision = qualify_rules(_job(title="Junior Finance Assistant"), profile)
    assert decision.status == "disqualified"
    assert "junior" in decision.deal_breakers


def test_missing_link_and_citizenship_blocker():
    profile = load_profile("finance_gcc")
    decision = qualify_rules(
        _job(url="", apply_url="", description_full=GOOD + " Saudi nationals only."),
        profile,
    )
    assert decision.status == "disqualified"
    assert "application link" in decision.deal_breakers
    assert "saudi nationals only" in decision.deal_breakers


def test_us_only_remote_is_disqualified():
    profile = load_profile("finance_gcc")
    decision = qualify_rules(
        _job(
            location="Remote - United States",
            description_full="Finance Manager role owning FP&A and budgeting. Applicants must be United States only.",
        ),
        profile,
    )
    assert decision.status == "disqualified"
    assert "restricted" in decision.deal_breakers


def test_scoring_rubric_matches_the_w3_weights():
    profile = load_profile("finance_gcc")
    factors = factor_scores(_job(), profile)
    assert factors["title_role"] == 100
    assert factors["seniority"] == 80
    assert factors["skills"] == 75
    assert factors["experience"] == 90
    assert factors["qualifications"] == 30
    assert factors["industry"] == 100
    assert factors["location"] == 100
    assert factors["remote_work_arrangement"] == 70
    assert factors["compensation"] == 50
    assert weighted_total(factors, profile.scoring["weights"], 110) == 83
    scored = score_job(_job(), profile)
    assert scored.match_score == 83
    assert scored.match_tier == "B"
    assert scored.recommendation == "Apply"
    assert scored.priority == "High"

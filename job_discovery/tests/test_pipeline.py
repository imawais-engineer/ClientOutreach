import json
from datetime import datetime, timezone

from job_discovery.cli import main
from job_discovery.config import load_profile
from job_discovery.http import RunContext
from job_discovery.leads import to_lead
from job_discovery.pipeline import run_pipeline
from job_discovery.stages.detail import merge_detail
from job_discovery.stages.readiness import prepare_application
from job_discovery.models import Job


def test_dry_run_qualifies_fixture_jobs_and_builds_leads():
    profile = load_profile("finance_gcc")
    ctx = RunContext(dry_run=True, now=datetime(2026, 11, 13, tzinfo=timezone.utc))
    result = run_pipeline(profile, ctx)
    assert result.errors == []
    assert result.fetched > 0
    assert result.qualified
    assert result.dropped["expired"] > 0
    assert result.dropped["duplicate"] > 0
    titles = {job.title for job in result.disqualified}
    assert "Junior Finance Assistant" in titles
    uids = {job.job_uid for job in result.qualified}
    assert "linkedin:1000000001" in uids
    assert "greenhouse:501" in uids
    assert "greenhouse:503" not in uids
    assert all(job.qualification_status == "qualified" for job in result.qualified)
    assert all(job.match_score and job.match_score >= 45 for job in result.qualified)
    lead = next(item for item in result.leads if item["details"]["job_uid"] == "greenhouse:501")
    assert lead["platform"] == "Job Boards"
    assert lead["business_key"] == "greenhouse-501"
    assert lead["contact"]["post_url"].startswith("https://")
    assert lead["classification"] in {"priority", "potential", "deprioritize"}
    assert lead["evidence_level"] in {"direct", "plausible", "weak"}
    assert lead["status"] == "qualified"
    assert lead["validation_passed"]["relevance"] is True
    assert lead["weighted_score"] == 83
    assert "London" not in {job.location for job in result.qualified}


def test_detail_merge_rejects_a_login_page():
    job = Job(
        job_uid="linkedin:1",
        source="linkedin",
        external_id="1",
        title="Finance Manager",
        company="Keep Me",
        location="Riyadh",
        url="https://www.linkedin.com/jobs/view/1",
        apply_url="https://www.linkedin.com/jobs/view/1",
        description_full="",
    )
    merge_detail(
        job,
        {"title": "Sign in to continue", "description": "Sign in to continue", "apply_url": "https://www.linkedin.com/login"},
        minimum=80,
    )
    assert job.detail_scrape_status == "failed"
    assert job.company == "Keep Me"


def test_readiness_does_not_invent_employers():
    profile = load_profile("finance_gcc")
    job = Job(
        job_uid="greenhouse:501",
        source="greenhouse",
        external_id="501",
        title="Finance Manager",
        company="Example Retail Co",
        location="Riyadh, Saudi Arabia",
        description_full="FP&A budgeting forecasting management reporting. French fluent required.",
        url="https://example.com/501",
        apply_url="https://example.com/501",
        match_score=83,
    )
    packet = prepare_application(job, profile)
    assert packet["mode"] == "deterministic"
    assert "Example Finance Professional" in packet["cover_letter"]
    assert "French" not in packet["cover_letter"]
    assert "Gaps to leave off" in packet["resume_updates"]
    lead = to_lead(job, profile)
    assert lead["need"] == "Finance Manager"


def test_cli_dry_run_prints_qualified_jobs(capsys):
    code = main(["run", "--profile", "finance_gcc", "--dry-run"])
    assert code == 0
    payload = json.loads(capsys.readouterr().out)
    assert payload["dry_run"] is True
    assert payload["counts"]["qualified"] >= 1
    assert payload["qualified"][0]["source"]

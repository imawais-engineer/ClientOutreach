from datetime import date

from job_discovery.dates import is_recent, parse_date
from job_discovery.filters import dedupe_jobs, matches_location, within_window
from job_discovery.models import Job
from job_discovery.config import load_profile
from job_discovery.stages.recruiters import build_queries, dedupe_recruiters, geography_allows, rank_and_limit


def _job(uid, **overrides) -> Job:
    data = dict(
        job_uid=uid,
        source="greenhouse",
        external_id=uid,
        title="Finance Manager",
        location="Riyadh, Saudi Arabia",
        description_full="finance",
        url="https://example.com/" + uid,
        apply_url="https://example.com/" + uid,
        date_published="2026-11-12",
    )
    data.update(overrides)
    return Job(**data)


def test_dedupe_keeps_first_job_uid_and_blank_uids():
    jobs = [
        _job("greenhouse:1", company="First"),
        _job("greenhouse:1", company="Second"),
        _job("", company="No uid"),
        _job("ashby:9", company="Other"),
    ]
    kept = dedupe_jobs(jobs)
    assert [job.company for job in kept] == ["First", "No uid", "Other"]


def test_dates_and_recency_window():
    assert parse_date("2026-11-12") == date(2026, 11, 12)
    assert parse_date("November 12, 2026") == date(2026, 11, 12)
    assert parse_date("Wed, 12 Nov 2026 09:00:00 +0000") == date(2026, 11, 12)
    assert parse_date(1_762_934_400) is not None
    today = date(2026, 11, 13)
    assert is_recent(date(2026, 11, 6), today=today, max_age_days=7, require_date=True)
    assert not is_recent(date(2026, 11, 5), today=today, max_age_days=7, require_date=True)
    assert not is_recent(None, today=today, max_age_days=7, require_date=True)
    fresh = _job("a")
    stale = _job("b", date_published="2020-01-01")
    expired = _job("c", expired=True)
    assert within_window(fresh, today=today, max_age_days=7, require_date=True)
    assert not within_window(stale, today=today, max_age_days=7, require_date=True)
    assert not within_window(expired, today=today, max_age_days=7, require_date=True)


def test_location_gate_keeps_gcc_and_remote_only():
    profile = load_profile("finance_gcc")
    policy = profile.location_policy
    assert matches_location(_job("a", location="Riyadh, Saudi Arabia"), policy)
    assert matches_location(_job("b", location="الرياض"), policy)
    assert matches_location(_job("c", location="Remote"), policy)
    assert not matches_location(_job("d", location="London, United Kingdom"), policy)


def test_recruiter_rank_dedupe_and_queries():
    settings = load_profile("finance_gcc").recruiter
    assert geography_allows("Riyadh", "Saudi Arabia", "Finance Manager", settings)
    assert geography_allows("Remote", "", "Finance Manager", settings)
    assert not geography_allows("London", "United Kingdom", "Finance Manager", settings)
    job = _job("job-1", company="Example Retail Co", title="Finance Manager", location="Riyadh, Saudi Arabia")
    queries = build_queries(job, settings)
    assert queries
    assert "Example Retail Co" in queries[0]["query"]
    ranked = rank_and_limit(
        [
            {"name": "A", "profile_url": "https://example.com/a", "total_score": 30, "company": "Example"},
            {"name": "B", "profile_url": "https://example.com/b", "total_score": 80, "company": "Example"},
            {"name": "C", "profile_url": "https://example.com/c", "total_score": 50, "disqualified": True, "company": "Example"},
            {"name": "D", "profile_url": "https://example.com/d", "total_score": 60, "company": "Example"},
        ],
        threshold=40,
        max_per=2,
    )
    assert [row["name"] for row in ranked] == ["B", "D"]
    fresh = dedupe_recruiters(
        [
            {"name": "B", "profile_url": "https://example.com/b", "company": "Example"},
            {"name": "E", "profile_url": "https://example.com/e", "company": "Example"},
            {"name": "No Url", "profile_url": "", "company": "Example"},
        ],
        existing=[{"Name": "B", "Profile URL": "https://example.com/b", "Company": "Example"}],
    )
    assert [row["name"] for row in fresh] == ["E"]

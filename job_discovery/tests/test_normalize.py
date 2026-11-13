from datetime import datetime, timezone

from job_discovery.config import load_profile
from job_discovery.http import RunContext
from job_discovery.models import Search
from job_discovery.sources.linkedin import build_search_url, parse_detail_html, parse_search_html
from job_discovery.sources.michaelpage import parse_markdown
from job_discovery.sources.weworkremotely import parse_rss
from job_discovery.text import business_key, normalize_description


def test_html_description_becomes_plain_text():
    raw = "<p>FP&amp;A</p><ul><li>Budgeting</li><li>Forecasting</li></ul>"
    text = normalize_description(raw)
    assert "FP&A" in text
    assert "• Budgeting" in text
    assert "<" not in text


def test_business_key_matches_dashboard_slug():
    assert business_key("LinkedIn:100") == "linkedin-100"
    assert business_key("A & B") == "a-and-b"


def test_linkedin_search_url_uses_age_window_and_keyword():
    url = build_search_url(Search(keyword="Finance Manager", location="Riyadh", country_code="SA"), 7)
    assert "f_TPR=r604800" in url
    assert "Finance" in url
    assert "Riyadh" in url


def test_linkedin_card_parser_and_detail_page():
    now = datetime(2026, 11, 13, tzinfo=timezone.utc)
    ctx = RunContext(dry_run=True, now=now)
    html = ctx.load_text("linkedin")
    jobs = parse_search_html(html, Search(keyword="Finance Manager", country="Saudi Arabia"), ctx)
    assert len(jobs) == 1
    assert jobs[0].job_uid == "linkedin:1000000001"
    assert jobs[0].company == "Example Retail Co"
    assert jobs[0].date_published == "2026-11-12"
    assert jobs[0].detail_scrape_needed is True
    detail = parse_detail_html(ctx.load_text("linkedin_detail"))
    assert detail["title"] == "Finance Manager"
    assert "FP&A" in detail["description"]


def test_michael_page_markdown_extracts_location_and_skips_salary():
    from pathlib import Path

    markdown = (Path(__file__).resolve().parents[1] / "fixtures" / "michaelpage.md").read_text(encoding="utf-8")
    jobs = parse_markdown(markdown)
    assert [job.external_id for job in jobs] == ["jn-123", "jn-999"]
    assert jobs[0].location == "Riyadh"
    assert jobs[0].title == "Finance Manager"
    assert "SAR" not in jobs[0].description_full
    assert jobs[1].location == "London"


def test_wwr_rss_splits_company_from_title():
    now = datetime(2026, 11, 13, tzinfo=timezone.utc)
    ctx = RunContext(dry_run=True, now=now)
    jobs = parse_rss(ctx.load_text("weworkremotely"), Search(keyword="Finance Manager"), ctx)
    assert jobs[0].company == "Northwind"
    assert jobs[0].location == "Remote"
    assert jobs[0].date_published == "2026-11-12"


def test_profile_is_not_hardcoded_inside_the_qualifier_module():
    profile = load_profile("finance_gcc")
    assert profile.candidate["credentials"] == ["CMA", "ACCA"]
    assert profile.source_config("greenhouse")["boards"][0]["token"] == "example-board"

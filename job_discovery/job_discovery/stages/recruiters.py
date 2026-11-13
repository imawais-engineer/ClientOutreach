"""W5 recruiter discovery logic.

Geography, query building, score threshold, and dedupe are ported. Live web
search is optional (BRAVE_SEARCH_API_KEY). Nothing here sends outreach.
Records stay in REVIEW_REQUIRED until a person approves them.
"""

from __future__ import annotations

import re
from datetime import timedelta

from job_discovery.config import Profile
from job_discovery.models import Job


def geography_allows(location: str, country: str, title: str, settings: dict) -> bool:
    hay = f"{location} {country}".casefold()
    remote_allowed = settings.get("remote_allowed", True) is not False
    is_remote = bool(re.search(r"remote|anywhere|work from home|wfh", hay)) or "remote" in title.casefold()
    countries = [str(item).casefold() for item in settings.get("onsite_countries") or []]
    geos = [str(item).casefold() for item in settings.get("geo_keywords") or []]
    onsite = any(item and item in hay for item in countries) or any(item and item in hay for item in geos)
    if remote_allowed and is_remote:
        return True
    return onsite


def build_queries(job: Job, settings: dict) -> list[dict]:
    company = job.company.strip()
    title = job.title.strip()
    if not company or not title:
        return []
    max_searches = int(settings.get("max_searches_per_job") or 8)
    places = [str(item) for item in settings.get("places") or ["finance"]]
    contacts = [str(item) for item in settings.get("priority_contacts") or ["recruiter", "talent acquisition", "hiring manager"]]
    is_remote = bool(re.search(r"remote", f"{job.location} {job.country}", re.I))
    place = "" if is_remote else (job.location.split(",")[0].strip() or job.country)
    hint = " OR ".join(places[:3])
    queries = [{"query_type": "web", "query": f'"{company}" ({hint}) recruiter OR "talent acquisition" {place}'.strip()}]
    for contact in contacts:
        queries.append({"query_type": "web", "query": f'"{company}" "{contact}" {place}'.strip()})
        queries.append({"query_type": "linkedin", "query": f'site:linkedin.com/in "{company}" "{contact}" {place}'.strip()})
    capped = queries[:max_searches]
    for item in capped:
        item.update(
            {
                "job_uid": job.job_uid,
                "job_title": title,
                "company": company,
                "location": job.location,
            }
        )
    return capped


def rank_and_limit(recruiters: list[dict], *, threshold: int, max_per: int) -> list[dict]:
    kept = [row for row in recruiters if not row.get("disqualified") and int(row.get("total_score") or 0) >= threshold]
    kept.sort(key=lambda row: int(row.get("total_score") or 0), reverse=True)
    return kept[:max_per]


def dedupe_recruiters(candidates: list[dict], existing: list[dict] | None = None) -> list[dict]:
    """Dedupe by profile URL, then by name|company. Skip rows with no name or URL."""
    seen: set[str] = set()
    for row in existing or []:
        url = str(row.get("profile_url") or row.get("Profile URL") or "").strip().casefold()
        name = str(row.get("name") or row.get("Name") or "").strip()
        company = str(row.get("company") or row.get("Company") or "").strip()
        if url:
            seen.add(url)
        if name and company:
            seen.add(f"{name}|{company}".casefold())
    fresh: list[dict] = []
    for row in candidates:
        name = str(row.get("name") or "").strip()
        url = str(row.get("profile_url") or "").strip()
        company = str(row.get("company") or "").strip()
        if not name or not url:
            continue
        url_key = url.casefold()
        name_key = f"{name}|{company}".casefold()
        if url_key in seen or name_key in seen:
            continue
        seen.add(url_key)
        seen.add(name_key)
        fresh.append(row)
    return fresh


def follow_up_dates(found_on, days: list[int]) -> list[str]:
    return [(found_on + timedelta(days=int(day))).isoformat() for day in days]


def discover(job: Job, profile: Profile, *, found_on) -> dict:
    """Build the review packet. Live search results are not invented."""
    settings = profile.recruiter
    if not geography_allows(job.location, job.country, job.title, settings):
        return {"job_uid": job.job_uid, "skipped": "geography", "queries": [], "recruiters": []}
    queries = build_queries(job, settings)
    return {
        "job_uid": job.job_uid,
        "queries": queries,
        "recruiters": [],
        "approval_status": "REVIEW_REQUIRED",
        "hitl_required_before_outreach": True,
        "follow_up_on": follow_up_dates(found_on, list(settings.get("followup_days") or [5, 12])),
        "note": "Queries are ready. Pass search results to rank_and_limit. No message is sent.",
    }

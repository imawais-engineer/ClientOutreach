"""Keyword, location, recency, and dedupe rules from W1."""

from __future__ import annotations

from datetime import date

from job_discovery.dates import is_expired_flag, is_recent, parse_date
from job_discovery.models import Job


def passes_keywords(job: Job) -> bool:
    """Include-any / exclude-any match used by the LinkedIn extract node.

    An empty include list keeps the row. Exclude keywords always reject.
    """
    hay = job.haystack().casefold()
    include = [item.casefold() for item in job.filter_keywords if item.strip()]
    exclude = [item.casefold() for item in job.exclude_keywords if item.strip()]
    if include and not any(token in hay for token in include):
        return False
    if any(token in hay for token in exclude):
        return False
    return True


def location_text(job: Job) -> str:
    return " ".join(part for part in (job.location, job.country) if part).casefold()


def matches_location(job: Job, policy: dict) -> bool:
    """Keep GCC (or configured) locations and global-remote postings.

    This is the W1 primary-fields location gate: a location string that
    contains any configured remote marker or any configured place is kept.
    """
    text = location_text(job)
    if not text:
        return False
    places = [str(item).casefold() for item in policy.get("places", []) if str(item).strip()]
    remote_markers = [str(item).casefold() for item in policy.get("remote_markers", []) if str(item).strip()]
    if any(place in text for place in places):
        return True
    if any(marker in text for marker in remote_markers):
        return True
    return False


def within_window(job: Job, *, today: date, max_age_days: int, require_date: bool) -> bool:
    if job.expired or is_expired_flag(job.expired):
        return False
    published = parse_date(job.date_published)
    return is_recent(published, today=today, max_age_days=max_age_days, require_date=require_date)


def dedupe_jobs(jobs: list[Job]) -> list[Job]:
    """Keep the first row for each job_uid. Rows with no uid are preserved."""
    seen: set[str] = set()
    unique: list[Job] = []
    for job in jobs:
        key = (job.job_uid or "").strip()
        if not key:
            unique.append(job)
            continue
        if key in seen:
            continue
        seen.add(key)
        unique.append(job)
    return unique


def has_required_fields(job: Job, *, require_description: bool) -> bool:
    if not (job.job_uid or "").strip():
        return False
    if not (job.title or "").strip():
        return False
    if require_description and not (job.description_full or "").strip():
        return False
    return True

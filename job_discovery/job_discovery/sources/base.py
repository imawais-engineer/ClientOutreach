"""Source interface."""

from __future__ import annotations

from datetime import datetime

from job_discovery.config import Profile
from job_discovery.http import RunContext
from job_discovery.models import Job, Search


class JobSource:
    id: str = ""
    needs_detail: bool = False

    def fetch(self, profile: Profile, ctx: RunContext) -> list[Job]:
        raise NotImplementedError


def scraped_day(ctx: RunContext) -> str:
    moment = ctx.now
    if isinstance(moment, datetime):
        return moment.date().isoformat()
    return str(moment)


def bind_search(job: Job, search: Search | None, ctx: RunContext, *, detail: bool) -> Job:
    job.scraped_at = job.scraped_at or scraped_day(ctx)
    if search is not None:
        job.search_keyword = job.search_keyword or search.keyword
        job.search_location = job.search_location or search.location
        job.filter_keywords = list(search.filter_keywords)
        job.exclude_keywords = list(search.exclude_keywords)
        if not job.country and not job.location:
            job.country = search.country
    job.detail_scrape_needed = detail or not (job.description_full or "").strip()
    if job.detail_scrape_needed:
        job.detail_scrape_status = "pending"
        job.next_action = "detail_scrape"
    else:
        job.detail_scrape_status = job.detail_scrape_status or "skipped"
        job.next_action = "qualification"
    job.pipeline_status = "fetched_job_source_listings"
    return job

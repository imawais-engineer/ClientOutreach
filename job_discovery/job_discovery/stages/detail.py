"""W2 detail scrape.

LinkedIn listing cards have no description, so the job page is fetched and
merged only when it looks like a real posting. Other sources already carry
the description from the listing API and are marked skipped, which is what
the n8n branch did for every source other than LinkedIn.
"""

from __future__ import annotations

import re

from job_discovery.config import Profile
from job_discovery.http import RunContext
from job_discovery.models import Job
from job_discovery.sources.linkedin import parse_detail_html
from job_discovery.text import collapse, normalize_description

_JUNK_URL = ("searchresult", "closedjob=true", "/search", "/login", "/signin", "not-found", "not_found", "/404")
_JUNK_TITLE = re.compile(r"(jobs? in .+(with salaries|september|october|august)|current vacancies|search for jobs|urgent!.*jobs)", re.I)
_JUNK_BODY = re.compile(
    r"(search for jobs posted by all the top employers|current vacancies in .* and abroad|sign in to (view|continue)|create your (free )?account|page not found|this job (is )?(no longer|has expired))",
    re.I,
)
_DEAD = re.compile(
    r"this job is a private listing|no longer accepting applications|this (job|position|posting) (is )?(no longer|has expired|has been filled|is closed)|position (has been )?filled|posting (is )?closed",
    re.I,
)


def enrich(jobs: list[Job], profile: Profile, ctx: RunContext) -> list[Job]:
    minimum = int(profile.raw.get("min_valid_description") or 80)
    for job in jobs:
        if job.source == "linkedin" and (job.detail_scrape_needed or not job.description_full.strip()):
            html = ctx.get_text(job.url or "https://www.linkedin.com/jobs/view/", fixture="linkedin_detail")
            merge_detail(job, parse_detail_html(html), minimum=minimum)
            continue
        if job.description_full.strip():
            job.description_full = normalize_description(job.description_full) or job.description_full
            job.detail_scrape_needed = False
            if job.detail_scrape_status in {"", "pending", "skipped"}:
                job.detail_scrape_status = "not_required"
            job.next_action = "qualification"
        else:
            job.detail_scrape_status = "failed"
            job.last_error = "No description on the listing and no detail scraper for this source"
            job.next_action = "detail_scrape"
    return jobs


def merge_detail(job: Job, parsed: dict, *, minimum: int) -> Job:
    title = collapse(parsed.get("title"))
    company = collapse(parsed.get("company"))
    location = collapse(parsed.get("location"))
    description = parsed.get("description") or ""
    apply_url = collapse(parsed.get("apply_url") or parsed.get("applyLink") or "")
    clean = collapse(normalize_description(description) or description)

    junk_url = any(term in apply_url.casefold() for term in _JUNK_URL)
    junk = junk_url or bool(_JUNK_TITLE.search(title)) or bool(_JUNK_BODY.search(clean))
    dead = bool(_DEAD.search(f"{title} {clean}"))
    valid = (not junk) and bool(title) and len(clean) >= minimum

    if valid:
        job.title = title or job.title
        job.company = company or job.company
        job.location = location or job.location
        job.description_full = normalize_description(description) or clean
        job.detail_scrape_status = "success"
        job.detail_scrape_needed = False
        job.next_action = "qualification"
        job.last_error = ""
    else:
        job.detail_scrape_status = "failed"
        job.detail_scrape_needed = not dead
        job.last_error = (
            "Fetched a search, expired, or login page"
            if junk
            else "Description too short after parse"
            if clean
            else "Page blocked, empty, or parser mismatch"
        )
        job.next_action = "archived" if dead else "detail_scrape"
    if dead:
        job.archived = True
        job.expired = True
        job.detail_scrape_needed = False
    return job

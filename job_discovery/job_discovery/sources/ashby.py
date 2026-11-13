"""Ashby public posting API. Company slugs come from the profile."""

from __future__ import annotations

from job_discovery.config import Profile
from job_discovery.dates import parse_date
from job_discovery.http import RunContext
from job_discovery.models import Job, Search
from job_discovery.sources.base import JobSource, bind_search
from job_discovery.text import normalize_description


class AshbySource(JobSource):
    id = "ashby"

    def fetch(self, profile: Profile, ctx: RunContext) -> list[Job]:
        config = profile.source_config(self.id)
        companies = config.get("companies") or []
        searches = profile.searches()
        anchor = searches[0] if searches else Search(keyword="")
        jobs: list[Job] = []
        for company in companies:
            slug = str(company.get("slug") or "").strip()
            if not slug:
                continue
            name = str(company.get("company") or slug)
            payload = ctx.get_json(
                f"https://api.ashbyhq.com/posting-api/job-board/{slug}",
                fixture=self.id,
                params={"includeCompensation": "true"},
                headers={"Accept": "application/json"},
            )
            for row in payload.get("jobs") or []:
                external_id = str(row.get("id") or "")
                published = parse_date(row.get("publishedAt"))
                apply_url = str(row.get("applyUrl") or "")
                url = str(row.get("jobUrl") or apply_url)
                job = Job(
                    job_uid=f"ashby:{external_id}",
                    source=self.id,
                    external_id=external_id,
                    title=str(row.get("title") or ""),
                    company=name,
                    location=str(row.get("location") or ""),
                    description_full=normalize_description(row.get("descriptionPlain") or row.get("descriptionHtml") or ""),
                    url=url,
                    apply_url=apply_url or url,
                    company_url=f"https://jobs.ashbyhq.com/{slug}",
                    date_published=published.isoformat() if published else "",
                )
                jobs.append(bind_search(job, anchor, ctx, detail=False))
        return jobs

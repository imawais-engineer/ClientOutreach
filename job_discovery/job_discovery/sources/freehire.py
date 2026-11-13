"""FreeHire public job search."""

from __future__ import annotations

from job_discovery.config import Profile
from job_discovery.dates import parse_date
from job_discovery.http import RunContext
from job_discovery.models import Job
from job_discovery.sources.base import JobSource, bind_search
from job_discovery.text import normalize_description


class FreeHireSource(JobSource):
    id = "freehire"

    def fetch(self, profile: Profile, ctx: RunContext) -> list[Job]:
        config = profile.source_config(self.id)
        jobs: list[Job] = []
        for search in profile.searches():
            payload = ctx.get_json(
                "https://freehire.me/api/v1/jobs/search",
                fixture=self.id,
                headers={"Accept": "application/json"},
                params={
                    "q": search.keyword,
                    "countries": config.get("countries") or search.country_code,
                    "work_mode": config.get("work_mode") or "remote,hybrid,onsite",
                    "limit": config.get("limit") or profile.page_size,
                    "offset": 0,
                },
            )
            for row in payload.get("data") or []:
                external_id = str(row.get("external_id") or "")
                published = parse_date(row.get("posted_at"))
                url = str(row.get("url") or "")
                job = Job(
                    job_uid=f"freehire:{external_id}",
                    source=self.id,
                    external_id=external_id,
                    title=str(row.get("title") or ""),
                    company=str(row.get("company") or ""),
                    location=str(row.get("location") or ""),
                    description_full=normalize_description(row.get("description") or ""),
                    url=url,
                    apply_url=url,
                    date_published=published.isoformat() if published else "",
                )
                jobs.append(bind_search(job, search, ctx, detail=False))
        return jobs

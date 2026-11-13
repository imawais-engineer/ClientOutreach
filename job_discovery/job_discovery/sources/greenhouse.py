"""Greenhouse public board API. Board tokens come from the profile."""

from __future__ import annotations

from job_discovery.config import Profile
from job_discovery.dates import parse_date
from job_discovery.http import RunContext
from job_discovery.models import Job, Search
from job_discovery.sources.base import JobSource, bind_search
from job_discovery.text import normalize_description


class GreenhouseSource(JobSource):
    id = "greenhouse"

    def fetch(self, profile: Profile, ctx: RunContext) -> list[Job]:
        config = profile.source_config(self.id)
        boards = config.get("boards") or []
        searches = profile.searches()
        anchor = searches[0] if searches else Search(keyword="")
        jobs: list[Job] = []
        for board in boards:
            token = str(board.get("token") or "").strip()
            if not token:
                continue
            company = str(board.get("company") or token)
            payload = ctx.get_json(
                f"https://boards-api.greenhouse.io/v1/boards/{token}/jobs",
                fixture=self.id,
                params={"content": "true"},
            )
            for row in payload.get("jobs") or []:
                location = row.get("location") or {}
                published = parse_date(row.get("first_published") or row.get("updated_at"))
                external_id = str(row.get("id") or "")
                url = str(row.get("absolute_url") or "")
                job = Job(
                    job_uid=f"greenhouse:{external_id}",
                    source=self.id,
                    external_id=external_id,
                    title=str(row.get("title") or ""),
                    company=str(row.get("company_name") or company),
                    location=str(location.get("name") or ""),
                    description_full=normalize_description(row.get("content") or ""),
                    url=url,
                    apply_url=url,
                    date_published=published.isoformat() if published else "",
                )
                jobs.append(bind_search(job, anchor, ctx, detail=False))
        return jobs

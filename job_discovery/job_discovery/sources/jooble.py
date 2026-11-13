"""Jooble search API. The API key is JOOBLE_API_KEY, never part of the source code."""

from __future__ import annotations

import os

from job_discovery.config import Profile
from job_discovery.dates import parse_date
from job_discovery.http import RunContext, TransportError
from job_discovery.models import Job
from job_discovery.sources.base import JobSource, bind_search
from job_discovery.text import normalize_description


class JoobleSource(JobSource):
    id = "jooble"

    def fetch(self, profile: Profile, ctx: RunContext) -> list[Job]:
        config = profile.source_config(self.id)
        if not ctx.dry_run and not os.environ.get("JOOBLE_API_KEY"):
            raise TransportError("JOOBLE_API_KEY is required for the Jooble source")
        key = os.environ.get("JOOBLE_API_KEY", "dry-run")
        jobs: list[Job] = []
        for search in profile.searches():
            country = str(config.get("country_name") or search.country)
            location = ", ".join(part for part in (search.location, country) if part)
            payload = ctx.post_json(
                f"https://jooble.org/api/{key}",
                {
                    "keywords": search.keyword,
                    "location": location,
                    "radius": int(config.get("radius") or 40),
                    "page": 1,
                    "ResultOnPage": profile.page_size,
                    "SearchMode": 0,
                    "companysearch": False,
                },
                fixture=self.id,
                headers={"Content-Type": "application/json"},
            )
            for row in payload.get("jobs") or []:
                external_id = str(row.get("id") or "")
                published = parse_date(row.get("updated"))
                link = str(row.get("link") or "")
                job = Job(
                    job_uid=f"jooble:{external_id}",
                    source=self.id,
                    external_id=external_id,
                    title=str(row.get("title") or ""),
                    company=str(row.get("company") or ""),
                    location=str(row.get("location") or ""),
                    description_full=normalize_description(row.get("snippet") or ""),
                    url=link,
                    apply_url=link,
                    date_published=published.isoformat() if published else "",
                )
                jobs.append(bind_search(job, search, ctx, detail=False))
        return jobs

"""GCC boards (Bayt, GulfTalent, Foundit, Tanqeeb) via the Apify actor used in final W1.

The earlier actor ymUwdLC4F3GGmZkg4 from the experimental workflow is not used.
A one-off Bayt Firecrawl of a single job URL is not a search and is not ported.
"""

from __future__ import annotations

import os

from job_discovery.config import Profile
from job_discovery.dates import parse_date
from job_discovery.http import RunContext, TransportError
from job_discovery.models import Job, Search
from job_discovery.sources.base import JobSource, bind_search
from job_discovery.text import normalize_description

DEFAULT_ACTOR = "T1LDITQDDdL824BJg"


class GccSource(JobSource):
    id = "gcc"

    def fetch(self, profile: Profile, ctx: RunContext) -> list[Job]:
        config = profile.source_config(self.id)
        actor = str(config.get("actor_id") or DEFAULT_ACTOR)
        token = os.environ.get("APIFY_TOKEN", "")
        if not ctx.dry_run and not token:
            raise TransportError("APIFY_TOKEN is required for the GCC source")
        keywords = list(config.get("keywords") or [])
        if not keywords:
            keywords = [search.keyword for search in profile.searches() if search.keyword]
        searches = profile.searches()
        anchor = searches[0] if searches else Search(keyword="")
        body = {
            "city": config.get("city") or anchor.location,
            "countries": [config.get("country") or anchor.country or "saudi-arabia"],
            "deduplicate": True,
            "enableArabicLabels": False,
            "jobFunction": config.get("job_function") or "",
            "keywords": keywords[:3],
            "maxJobsPerSource": int(config.get("max_jobs_per_source") or 50),
            "remoteOnly": False,
            "sources": list(config.get("board_sources") or ["bayt", "gulftalent", "foundit", "tanqeeb"]),
            "experienceLevel": "any",
            "employmentType": "any",
            "datePostedWithinDays": int(config.get("date_posted_within_days") or 0),
            "proxyConfiguration": {"useApifyProxy": True},
        }
        payload = ctx.post_json(
            f"https://api.apify.com/v2/acts/{actor}/run-sync-get-dataset-items",
            body,
            fixture=self.id,
            headers={"Authorization": f"Bearer {token}"} if token else None,
        )
        rows = payload if isinstance(payload, list) else payload.get("items") or []
        jobs: list[Job] = []
        for row in rows:
            link = str(row.get("link") or "")
            external_id = link.rstrip("/").split("-")[-1] if link else str(row.get("id") or "")
            published = parse_date(row.get("postedDate") or row.get("date_published"))
            job = Job(
                job_uid=f"gcc:{external_id}",
                source="gcc",
                external_id=external_id,
                title=str(row.get("title") or ""),
                company=str(row.get("company") or ""),
                location=str(row.get("location") or row.get("country") or ""),
                description_full=normalize_description(row.get("description") or ""),
                url=link,
                apply_url=link,
                date_published=published.isoformat() if published else "",
            )
            jobs.append(bind_search(job, anchor, ctx, detail=False))
        return jobs

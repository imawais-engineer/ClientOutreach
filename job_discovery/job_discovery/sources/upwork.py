"""Upwork via the Apify actor wired in the final W1 graph."""

from __future__ import annotations

import os

from job_discovery.config import Profile
from job_discovery.dates import parse_date
from job_discovery.http import RunContext, TransportError
from job_discovery.models import Job, Search
from job_discovery.sources.base import JobSource, bind_search
from job_discovery.text import normalize_description

DEFAULT_ACTOR = "QRHJxnLxIAxpfHCcu"


class UpworkSource(JobSource):
    id = "upwork"

    def fetch(self, profile: Profile, ctx: RunContext) -> list[Job]:
        config = profile.source_config(self.id)
        actor = str(config.get("actor_id") or DEFAULT_ACTOR)
        token = os.environ.get("APIFY_TOKEN", "")
        if not ctx.dry_run and not token:
            raise TransportError("APIFY_TOKEN is required for the Upwork source")
        queries = list(config.get("queries") or [])
        if not queries:
            queries = [search.keyword for search in profile.searches() if search.keyword]
        searches = profile.searches()
        anchor = searches[0] if searches else Search(keyword="")
        body = {
            "category": str(config.get("category") or ""),
            "contract_to_hire_roles": False,
            "fixed": True,
            "hourly": True,
            "limit": int(config.get("limit") or 30),
            "query": queries[:8],
            "sort": "newest",
            "update_boolean": False,
            "authentication": "no_authentication",
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
            external_id = str(row.get("upwork_job_id") or row.get("jobId") or row.get("id") or "")
            data = row.get("data") or {}
            description = data.get("description") or row.get("description") or ""
            publish = (((data.get("jobTile") or {}).get("job") or {}).get("publishTime"))
            published = parse_date(publish or row.get("publishedOn") or row.get("date_published"))
            link = str(row.get("link") or row.get("url") or "")
            job = Job(
                job_uid=f"upwork:{external_id}",
                source=self.id,
                external_id=external_id,
                title=str(row.get("title") or ""),
                company=str(row.get("client") or ""),
                location="Remote",
                description_full=normalize_description(description if isinstance(description, str) else ""),
                url=link,
                apply_url=link,
                date_published=published.isoformat() if published else "",
            )
            jobs.append(bind_search(job, anchor, ctx, detail=False))
        return jobs

"""Indeed via the Apify actor used in W1 (kaix/indeed-scraper)."""

from __future__ import annotations

import os

from job_discovery.config import Profile
from job_discovery.dates import parse_date
from job_discovery.http import RunContext, TransportError
from job_discovery.models import Job
from job_discovery.sources.base import JobSource, bind_search
from job_discovery.text import normalize_description

DEFAULT_ACTOR = "BIeK7ZcYUrdxDgOEQ"


class IndeedSource(JobSource):
    id = "indeed"

    def fetch(self, profile: Profile, ctx: RunContext) -> list[Job]:
        config = profile.source_config(self.id)
        actor = str(config.get("actor_id") or DEFAULT_ACTOR)
        token = os.environ.get("APIFY_TOKEN", "")
        if not ctx.dry_run and not token:
            raise TransportError("APIFY_TOKEN is required for the Indeed source")
        jobs: list[Job] = []
        for search in profile.searches():
            body = {
                "country": (search.country_code or "us").lower(),
                "fromDays": str(config.get("from_days") or profile.max_job_age_days),
                "keyword": search.keyword,
                "location": search.location,
                "maxItems": int(config.get("max_items") or 50),
                "radius": str(config.get("radius") or "40"),
                "radiusUnit": "miles",
                "searchMode": "basic",
                "sort": "date",
            }
            payload = _run_actor(ctx, actor, body, token, fixture=self.id)
            rows = payload if isinstance(payload, list) else payload.get("items") or []
            for row in rows:
                external_id = str(row.get("id") or "")
                title = (row.get("title") or {}).get("text") if isinstance(row.get("title"), dict) else row.get("title")
                location = row.get("location") or {}
                place = location.get("formatted") if isinstance(location, dict) else str(location or "")
                company = row.get("company") or {}
                company_name = company.get("name") if isinstance(company, dict) else str(company or "")
                description = row.get("description") or {}
                text = description.get("text") if isinstance(description, dict) else str(description or "")
                urls = row.get("urls") or {}
                apply_url = str(urls.get("apply") or urls.get("view") or "")
                published = parse_date((row.get("dates") or {}).get("posted") if isinstance(row.get("dates"), dict) else None)
                job = Job(
                    job_uid=f"indeed:{external_id}",
                    source=self.id,
                    external_id=external_id,
                    title=str(title or ""),
                    company=str(company_name or ""),
                    location=str(place or ""),
                    description_full=normalize_description(text),
                    url=apply_url,
                    apply_url=apply_url,
                    company_url=str((company.get("urls") or {}).get("indeed") or "") if isinstance(company, dict) else "",
                    date_published=published.isoformat() if published else "",
                )
                jobs.append(bind_search(job, search, ctx, detail=False))
        return jobs


def _run_actor(ctx: RunContext, actor: str, body: dict, token: str, *, fixture: str):
    url = f"https://api.apify.com/v2/acts/{actor}/run-sync-get-dataset-items"
    return ctx.post_json(url, body, fixture=fixture, headers={"Authorization": f"Bearer {token}"} if token else None)

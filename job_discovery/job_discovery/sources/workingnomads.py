"""Working Nomads Elasticsearch listing. Expired documents are dropped."""

from __future__ import annotations

from job_discovery.config import Profile
from job_discovery.dates import is_expired_flag, parse_date
from job_discovery.http import RunContext
from job_discovery.models import Job
from job_discovery.sources.base import JobSource, bind_search
from job_discovery.text import normalize_description


class WorkingNomadsSource(JobSource):
    id = "workingnomads"

    def fetch(self, profile: Profile, ctx: RunContext) -> list[Job]:
        jobs: list[Job] = []
        for search in profile.searches():
            payload = ctx.post_json(
                "https://www.workingnomads.com/jobsapi/_search",
                {
                    "from": 0,
                    "size": profile.page_size,
                    "query": {
                        "multi_match": {
                            "query": search.keyword,
                            "fields": ["title", "description", "tags", "company"],
                        }
                    },
                },
                fixture=self.id,
                headers={"Accept": "application/json", "Content-Type": "application/json"},
            )
            hits = ((payload.get("hits") or {}).get("hits")) or []
            for hit in hits:
                row = hit.get("_source") or {}
                if is_expired_flag(row.get("expired")):
                    continue
                external_id = str(row.get("external_id") or hit.get("_id") or "")
                locations = row.get("locations") or []
                place = str(locations[0]) if locations else "Remote"
                published = parse_date(row.get("pub_date"))
                apply_url = str(row.get("apply_url") or row.get("url") or "")
                job = Job(
                    job_uid=f"workingnomads:{external_id}",
                    source=self.id,
                    external_id=external_id,
                    title=str(row.get("title") or ""),
                    company=str(row.get("company") or ""),
                    location=place,
                    description_full=normalize_description(row.get("description") or ""),
                    url=apply_url,
                    apply_url=apply_url,
                    company_url=str(row.get("company_slug") or ""),
                    date_published=published.isoformat() if published else "",
                    expired=False,
                )
                jobs.append(bind_search(job, search, ctx, detail=False))
        return jobs

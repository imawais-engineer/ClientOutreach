"""NaukriGulf public search API used by the W1 HTTP NaukriGulf node."""

from __future__ import annotations

from job_discovery.config import Profile
from job_discovery.dates import parse_date
from job_discovery.http import RunContext
from job_discovery.models import Job
from job_discovery.sources.base import JobSource, bind_search
from job_discovery.text import normalize_description

_HEADERS = {
    "accept": "application/json",
    "accept-format": "strict",
    "accept-language": "ENGLISH",
    "appId": "205",
    "client-type": "desktop",
    "clientId": "desktop",
    "device-type": "desktop",
    "systemId": "1112",
}


class NaukriGulfSource(JobSource):
    id = "naukrigulf"

    def fetch(self, profile: Profile, ctx: RunContext) -> list[Job]:
        jobs: list[Job] = []
        for search in profile.searches():
            payload = ctx.get_json(
                "https://www.naukrigulf.com/spapi/jobapi/search",
                fixture=self.id,
                headers=_HEADERS,
                params={
                    "Keywords": search.keyword,
                    "Location": search.location,
                    "Limit": profile.page_size,
                    "Offset": 0,
                    "SortPreference": "relevance",
                    "pageNo": 1,
                },
            )
            for row in payload.get("jobs") or []:
                company = row.get("company") or {}
                published = parse_date(row.get("latestPostedDate"))
                path = str(row.get("jdURL") or "")
                url = path if path.startswith("http") else f"https://www.naukrigulf.com/{path.lstrip('/')}"
                company_path = str(company.get("url") or "")
                company_url = ""
                if company_path:
                    company_url = company_path if company_path.startswith("http") else f"https://www.naukrigulf.com/{company_path.lstrip('/')}"
                external_id = str(row.get("jobId") or "")
                job = Job(
                    job_uid=f"naukrigulf:{external_id}",
                    source=self.id,
                    external_id=external_id,
                    title=str(row.get("designation") or ""),
                    company=str(company.get("name") or ""),
                    location=str(row.get("location") or ""),
                    description_full=normalize_description(row.get("jobInfo") or row.get("description") or ""),
                    url=url,
                    apply_url=url,
                    company_url=company_url,
                    date_published=published.isoformat() if published else "",
                )
                jobs.append(bind_search(job, search, ctx, detail=False))
        return jobs

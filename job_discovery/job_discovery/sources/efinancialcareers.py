"""eFinancialCareers job search API."""

from __future__ import annotations

from job_discovery.config import Profile
from job_discovery.dates import parse_date
from job_discovery.http import RunContext
from job_discovery.models import Job
from job_discovery.sources.base import JobSource, bind_search
from job_discovery.text import normalize_description


class EFinancialCareersSource(JobSource):
    id = "efinancialcareers"

    def fetch(self, profile: Profile, ctx: RunContext) -> list[Job]:
        jobs: list[Job] = []
        for search in profile.searches():
            payload = ctx.get_json(
                "https://job-search-api.efinancialcareers.com/v1/efc/jobs/search",
                fixture=self.id,
                headers={
                    "Accept": "application/json",
                    "Accept-Language": "en-US,en;q=0.9",
                    "Origin": "https://www.efinancialcareers.com",
                },
                params={
                    "page": 1,
                    "pageSize": profile.page_size,
                    "q": search.keyword,
                    "location": search.location.lower(),
                    "countryCode2": search.country_code,
                    "culture": "en",
                    "language": "en",
                    "currencyCode": search.currency_code,
                    "includeUnspecifiedSalary": "true",
                    "includeRemote": "true",
                },
            )
            for row in payload.get("data") or []:
                location = row.get("jobLocation") or {}
                place = ", ".join(part for part in (location.get("city"), location.get("country")) if part)
                path = str(row.get("detailsPageUrl") or "")
                url = path if path.startswith("http") else f"https://www.efinancialcareers.com{path}"
                external_id = str(row.get("jobId") or "")
                published = parse_date(row.get("postedDate"))
                job = Job(
                    job_uid=f"efinancialcareers:{external_id}",
                    source=self.id,
                    external_id=external_id,
                    title=str(row.get("fullNormalizedJobTitle") or ""),
                    company=str(row.get("fullCompanyName") or ""),
                    location=place,
                    description_full=normalize_description(row.get("description") or ""),
                    url=url,
                    apply_url=url,
                    date_published=published.isoformat() if published else "",
                )
                jobs.append(bind_search(job, search, ctx, detail=False))
        return jobs

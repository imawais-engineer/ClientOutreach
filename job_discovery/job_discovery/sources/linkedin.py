"""LinkedIn public search HTML. Listing cards have no description, so W2 scrapes the job page."""

from __future__ import annotations

import re
from datetime import timedelta
from urllib.parse import quote

from job_discovery.config import Profile
from job_discovery.http import RunContext
from job_discovery.models import Job, Search
from job_discovery.sources.base import JobSource, bind_search
from job_discovery.text import collapse

_LINK = re.compile(r'base-card__full-link[^"]*" href="([^"]+)"')
_TITLE = re.compile(r"base-search-card__title[^>]*>([\s\S]*?)</h3>")
_COMPANY = re.compile(r"hidden-nested-link[^>]*>([\s\S]*?)</a>")
_LOCATION = re.compile(r"job-search-card__location[^>]*>([\s\S]*?)</span>")
_DATE = re.compile(
    r'<time[^>]*class="[^"]*job-search-card__listdate[^"]*"[^>]*datetime="([^"]*)"[^>]*>([\s\S]*?)</time>'
)


class LinkedInSource(JobSource):
    id = "linkedin"
    needs_detail = True

    def fetch(self, profile: Profile, ctx: RunContext) -> list[Job]:
        jobs: list[Job] = []
        for search in profile.searches():
            url = build_search_url(search, profile.max_job_age_days)
            html = ctx.get_text(url, fixture=self.id, headers=_browser_headers())
            jobs.extend(parse_search_html(html, search, ctx))
        return jobs


def build_search_url(search: Search, max_job_age_days: int) -> str:
    seconds = int(round((max_job_age_days or 7) * 24 * 60 * 60))
    url = f"https://www.linkedin.com/jobs/search/?f_TPR=r{seconds}"
    if search.keyword:
        url += f"&keywords={quote(search.keyword)}"
    if search.location:
        place = f"{search.location}, {search.country_code}" if search.country_code else search.location
        url += f"&location={quote(place)}"
    return url


def parse_search_html(html: str, search: Search, ctx: RunContext) -> list[Job]:
    if not html or len(html) < 80:
        return []
    links = [_decode(item) for item in _LINK.findall(html)]
    titles = [_decode(item) for item in _TITLE.findall(html)]
    companies = [_decode(item) for item in _COMPANY.findall(html)]
    locations = [_decode(item) for item in _LOCATION.findall(html)]
    dates = _DATE.findall(html)
    count = min(len(links), len(titles))
    jobs: list[Job] = []
    for index in range(count):
        title = titles[index]
        url = links[index]
        if not title or not url:
            continue
        external_id = _job_id(url)
        published = _normalize_date(
            dates[index][1] if index < len(dates) else "",
            dates[index][0] if index < len(dates) else "",
            ctx,
        )
        job = Job(
            job_uid=f"linkedin:{external_id}",
            source="linkedin",
            external_id=str(external_id),
            title=title,
            company=companies[index] if index < len(companies) else "",
            location=locations[index] if index < len(locations) else "",
            url=url,
            apply_url=url,
            date_published=published or "",
            description_full="",
            country=search.country,
            search_keyword=search.keyword,
            search_location=search.location,
        )
        jobs.append(bind_search(job, search, ctx, detail=True))
    return jobs


def parse_detail_html(html: str) -> dict:
    """CSS selectors from the W2 HTML extract node, expressed as patterns."""
    title = _first(r"<h1[^>]*>([\s\S]*?)</h1>", html)
    company = _first(r"<a[^>]*>([\s\S]*?)</a>", html)
    location = _first(r"topcard__flavor--bullet[^>]*>([\s\S]*?)</span>", html)
    description = _first(r"description__text--rich[^>]*>([\s\S]*?)</div>", html)
    return {
        "title": collapse(title),
        "company": collapse(company),
        "location": collapse(location),
        "description": description or "",
    }


def _job_id(url: str) -> str:
    match = re.search(r"/jobs/view/[^/]+-(\d+)", url) or re.search(r"-(\d+)(?:\?|$)", url)
    return match.group(1) if match else url


def _normalize_date(value: str, datetime_attr: str, ctx: RunContext) -> str | None:
    if datetime_attr and re.match(r"\d{4}-\d{2}-\d{2}", datetime_attr):
        return datetime_attr[:10]
    text = collapse(value).casefold()
    if not text:
        return None
    today = ctx.now.date()
    if text in {"today", "just now"} or re.search(r"(minute|hour|second)s?\s+ago", text):
        return today.isoformat()
    if text == "yesterday" or re.search(r"\b1\s+day\s+ago\b", text):
        return (today - timedelta(days=1)).isoformat()
    days = re.search(r"(\d+)\s+days?\s+ago", text)
    if days:
        return (today - timedelta(days=int(days.group(1)))).isoformat()
    weeks = re.search(r"(\d+)\s+weeks?\s+ago", text)
    if weeks:
        return (today - timedelta(days=int(weeks.group(1)) * 7)).isoformat()
    return None


def _decode(value: str) -> str:
    return collapse(
        value.replace("&amp;", "&").replace("&#39;", "'").replace("&quot;", '"').replace("&lt;", "<").replace("&gt;", ">")
    )


def _first(pattern: str, html: str) -> str:
    match = re.search(pattern, html, re.I)
    return match.group(1) if match else ""


def _browser_headers() -> dict:
    return {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
    }

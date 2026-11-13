"""We Work Remotely RSS feed."""

from __future__ import annotations

import re
import xml.etree.ElementTree as ET
from urllib.parse import urlparse

from job_discovery.config import Profile
from job_discovery.dates import parse_date
from job_discovery.http import RunContext
from job_discovery.models import Job, Search
from job_discovery.sources.base import JobSource, bind_search
from job_discovery.text import normalize_description


class WeWorkRemotelySource(JobSource):
    id = "weworkremotely"

    def fetch(self, profile: Profile, ctx: RunContext) -> list[Job]:
        raw = ctx.get_text(
            "https://weworkremotely.com/remote-jobs.rss",
            fixture=self.id,
            headers={"Accept": "application/rss+xml, application/xml, text/xml, */*"},
        )
        searches = profile.searches()
        anchor = searches[0] if searches else Search(keyword="")
        # The feed is global. Apply the union of include/exclude terms.
        include: list[str] = []
        exclude: list[str] = []
        for search in searches:
            include.extend(search.filter_keywords)
            exclude.extend(search.exclude_keywords)
        anchor.filter_keywords = list(dict.fromkeys(include))
        anchor.exclude_keywords = list(dict.fromkeys(exclude))
        return parse_rss(raw, anchor, ctx)


def parse_rss(raw: str, search: Search, ctx: RunContext) -> list[Job]:
    root = ET.fromstring(raw)
    jobs: list[Job] = []
    for item in root.findall("./channel/item"):
        title = (item.findtext("title") or "").strip()
        link = (item.findtext("link") or "").strip()
        description = item.findtext("description") or ""
        pub = item.findtext("pubDate") or ""
        published = parse_date(pub)
        external_id = _stable_id(link, title)
        company, _role = _split_title(title)
        job = Job(
            job_uid=f"weworkremotely:{external_id}",
            source="weworkremotely",
            external_id=external_id,
            title=title,
            company=company,
            location="Remote",
            description_full=normalize_description(description),
            url=link,
            apply_url=link,
            date_published=published.isoformat() if published else "",
        )
        jobs.append(bind_search(job, search, ctx, detail=False))
    return jobs


def _split_title(title: str) -> tuple[str, str]:
    """WWR titles look like 'Company: Role'. The n8n node left company as N/A."""
    if ":" in title:
        company, role = title.split(":", 1)
        company = company.strip()
        if company:
            return company, role.strip()
    return "We Work Remotely", title


def _stable_id(link: str, title: str) -> str:
    path = urlparse(link).path.strip("/")
    if path:
        return re.sub(r"[^A-Za-z0-9]+", "-", path).strip("-")[:80]
    return re.sub(r"[^a-z0-9]+", "-", title.casefold()).strip("-")[:80]

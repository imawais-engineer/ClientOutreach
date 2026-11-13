"""Michael Page listing pages via Firecrawl markdown, parsed with the W1 extract rules."""

from __future__ import annotations

import os
import re
from urllib.parse import quote

from job_discovery.config import Profile
from job_discovery.http import RunContext, TransportError
from job_discovery.models import Job, Search
from job_discovery.sources.base import JobSource, bind_search
from job_discovery.text import collapse

_JOB = re.compile(r"(?:^|\n)-\s*###\s*\[([^\]]+)\]\((https?://[^)]+)\)")
_EMPLOYMENT = re.compile(
    r"^(Permanent|Contract|Temporary|Part[\s-]?Time|Full[\s-]?Time|Internship|Freelance|Fixed[\s-]?Term)$",
    re.I,
)
_SALARY = re.compile(
    r"(?:AED|SAR|USD|EUR|GBP|QAR|KWD|OMR|BHD)\s*[\d,.]+|[\d,.]+\s*(?:AED|SAR|USD|EUR|GBP|QAR|KWD|OMR|BHD)",
    re.I,
)


class MichaelPageSource(JobSource):
    id = "michaelpage"

    def fetch(self, profile: Profile, ctx: RunContext) -> list[Job]:
        config = profile.source_config(self.id)
        keyword = str(config.get("keyword") or (profile.searches()[0].keyword if profile.searches() else "jobs"))
        location = str(config.get("location") or (profile.searches()[0].location if profile.searches() else ""))
        base = str(config.get("base_url") or "https://www.michaelpage.ae/jobs").rstrip("/")
        url = f"{base}/{quote(keyword)}/{quote(location)}" if location else f"{base}/{quote(keyword)}"
        if ctx.dry_run:
            markdown = ctx.load_text(self.id)
        else:
            api_key = os.environ.get("FIRECRAWL_API_KEY", "")
            if not api_key:
                raise TransportError("FIRECRAWL_API_KEY is required for the Michael Page source")
            payload = ctx.post_json(
                "https://api.firecrawl.dev/v1/scrape",
                {"url": url, "formats": ["markdown"]},
                fixture=self.id,
                headers={"Authorization": f"Bearer {api_key}"},
            )
            data = payload.get("data") or payload
            markdown = data.get("markdown") or ""
        searches = profile.searches()
        anchor = searches[0] if searches else Search(keyword=keyword, location=location)
        return [bind_search(job, anchor, ctx, detail=False) for job in parse_markdown(markdown)]


def parse_markdown(markdown: str) -> list[Job]:
    if not markdown:
        return []
    matches = list(_JOB.finditer(markdown))
    jobs: list[Job] = []
    for index, match in enumerate(matches):
        end = matches[index + 1].start() if index + 1 < len(matches) else len(markdown)
        block = markdown[match.end() : end]
        job = _parse_block(match.group(1), match.group(2), block)
        if job is not None:
            jobs.append(job)
    return jobs


def _parse_block(title: str, raw_url: str, block: str) -> Job | None:
    url = raw_url.split("?")[0].split("#")[0]
    external = ""
    id_match = re.search(r"/ref/([^/?#]+)", url, re.I)
    if id_match:
        external = id_match.group(1)
    lines = [collapse(line) for line in block.splitlines()]
    lines = [line for line in lines if line]
    related = next((i for i, line in enumerate(lines) if re.search(r"Other users also applied", line, re.I)), -1)
    if related >= 0:
        lines = lines[:related]
    useful = [line for line in lines if not re.match(r"^(Save Job|View Job|Create Job Alert|Search|Cancel)$", line, re.I)]
    index = 0
    location = useful[index] if useful else ""
    if location:
        index += 1
    if index < len(useful) and _EMPLOYMENT.match(useful[index]):
        index += 1
    if index < len(useful) and _SALARY.search(useful[index]):
        index += 1
    bullet = next((i for i, line in enumerate(useful) if i >= index and line.startswith("- ")), len(useful))
    description = collapse(" ".join(useful[index:bullet]))
    if not title or not url:
        return None
    return Job(
        job_uid=f"michaelpage:{external or url}",
        source="michaelpage",
        external_id=external or url,
        title=collapse(title),
        location=location,
        description_full=description,
        url=url,
        apply_url=url,
    )

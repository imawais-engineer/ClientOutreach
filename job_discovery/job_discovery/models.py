"""Unified job schema shared by every source.

Field names follow the n8n Unify Schema node: job_uid, source, external_id,
title, location, description_full, company, company_url, date_published,
apply_url, scraped_at, url.
"""

from __future__ import annotations

from dataclasses import dataclass, field, asdict
from datetime import date, datetime


@dataclass
class Search:
    keyword: str
    location: str = ""
    country: str = ""
    country_code: str = ""
    currency_code: str = ""
    filter_keywords: list[str] = field(default_factory=list)
    exclude_keywords: list[str] = field(default_factory=list)
    title_match_keywords: list[str] = field(default_factory=list)


@dataclass
class Job:
    job_uid: str
    source: str
    external_id: str
    title: str
    company: str = ""
    location: str = ""
    description_full: str = ""
    url: str = ""
    apply_url: str = ""
    company_url: str = ""
    date_published: str = ""
    scraped_at: str = ""
    country: str = ""
    search_keyword: str = ""
    search_location: str = ""
    filter_keywords: list[str] = field(default_factory=list)
    exclude_keywords: list[str] = field(default_factory=list)
    expired: bool = False
    detail_scrape_needed: bool = False
    detail_scrape_status: str = "skipped"
    qualification_status: str = "pending"
    deal_breakers: str = ""
    match_score: int | None = None
    match_tier: str = ""
    recommendation: str = ""
    priority: str = ""
    match_reasons: str = ""
    strengths: str = ""
    gaps: str = ""
    score_breakdown: dict = field(default_factory=dict)
    pipeline_status: str = "fetched_job_source_listings"
    next_action: str = "qualification"
    archived: bool = False
    salary: str = ""
    employment_type: str = ""
    experience_level: str = ""
    last_error: str = ""

    def haystack(self) -> str:
        return " ".join(
            part
            for part in (
                self.title,
                self.company,
                self.location,
                self.country,
                self.description_full,
            )
            if part
        )

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class Qualification:
    status: str
    deal_breakers: str

    @property
    def qualified(self) -> bool:
        return self.status == "qualified"


@dataclass
class Score:
    match_score: int
    match_tier: str
    recommendation: str
    priority: str
    match_reasons: str
    strengths: str
    gaps: str
    breakdown: dict


def stamp(now: datetime | date | None = None) -> str:
    moment = now or datetime.utcnow()
    if isinstance(moment, datetime):
        return moment.date().isoformat()
    return moment.isoformat()

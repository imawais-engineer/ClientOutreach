"""Map a scored job onto POST /api/leads.

business_key is the job uid slug, so a later run updates the same row instead
of collapsing every posting from one company into a single lead. post_url is
the listing URL. platform is Job Boards.
"""

from __future__ import annotations

import json
import os
from urllib.request import Request, urlopen

from job_discovery.config import Profile
from job_discovery.dates import parse_date
from job_discovery.http import TransportError
from job_discovery.models import Job
from job_discovery.text import business_key, normalize_description


CLASSIFICATIONS = {"priority", "potential", "deprioritize"}
EVIDENCE_LEVELS = {"direct", "plausible", "weak"}


def to_lead(job: Job, profile: Profile) -> dict:
    company = (job.company or "").strip() or job.title.strip() or "Unknown company"
    description = normalize_description(job.description_full) or (job.description_full or "").strip()
    published = parse_date(job.date_published)
    recency = published.isoformat() if published else job.scraped_at
    score = job.match_score if job.match_score is not None else 0
    classification = _classification(job)
    evidence = _evidence(description)
    qualified = job.qualification_status == "qualified"
    remote_posting = any(
        marker in f"{job.location} {job.country}".casefold()
        for marker in ("remote", "worldwide", "anywhere", "work from home", "wfh")
    )
    status = _status(job)
    city, country = _place(job)
    why = job.match_reasons or job.deal_breakers or description[:240]
    return {
        "business": company[:200],
        "business_key": business_key(job.job_uid or company),
        "need": (job.title or "Open role")[:300],
        "why_suits": why[:1000],
        "relevant_service": str(profile.raw.get("relevant_service") or "Job search")[:200],
        "contact": {
            "post_url": _url(job.url),
            "application_url": _url(job.apply_url or job.url),
            "website": _url(job.company_url),
            "profile_url": None,
            "dm_link": None,
            "email": None,
            "phone": None,
        },
        "recency": recency,
        "posted_at": recency,
        "platform": "Job Boards",
        "source": job.source[:40],
        "city": city,
        "country": country,
        "remote_eligible_pak": bool(profile.raw.get("remote_eligible_pak")) and "remote" in (job.location or "").casefold(),
        "validation_passed": {
            "remote": remote_posting,
            "recency": bool(published),
            "relevance": qualified,
            "contact": bool(job.url or job.apply_url),
        },
        "score": max(0, min(10, round(score / 10))),
        "weighted_score": max(0, min(100, int(score))),
        "classification": classification,
        "evidence_level": evidence,
        "pitch_angle": (job.strengths or "")[:1000] or None,
        "case_study": None,
        "category": profile.category[:80],
        "status": status,
        "details": {
            "evidence": [
                {
                    "source": job.source,
                    "source_type": "job_board",
                    "url": job.url,
                    "observed_at": job.scraped_at,
                    "summary": (description[:400] or job.title),
                    "classification": classification,
                    "verification": "listing",
                }
            ],
            "scores": {
                name: {"score": value, "weight": _weight(profile, name), "why": job.match_reasons}
                for name, value in (job.score_breakdown or {}).items()
                if name != "weighted_total" and isinstance(value, int)
            },
            "job_uid": job.job_uid,
            "external_id": job.external_id,
            "pipeline_status": job.pipeline_status,
            "next_action": job.next_action,
            "qualification_status": job.qualification_status,
            "deal_breakers": job.deal_breakers,
            "match_tier": job.match_tier,
            "recommendation": job.recommendation,
            "priority": job.priority,
            "gaps": job.gaps,
            "search_keyword": job.search_keyword,
            "search_location": job.search_location,
            "description_full": description[:8000],
        },
    }


def _classification(job: Job) -> str:
    if job.qualification_status != "qualified":
        return "deprioritize"
    score = job.match_score or 0
    if score >= 75:
        return "priority"
    if score >= 45:
        return "potential"
    return "deprioritize"


def _status(job: Job) -> str:
    if job.qualification_status == "disqualified":
        return "disqualified"
    if job.qualification_status == "qualified":
        if (job.match_score or 0) >= 45:
            return "qualified"
        return "nurture"
    return "discovered"


def _evidence(description: str) -> str:
    if len(description) >= 80:
        return "direct"
    if description:
        return "plausible"
    return "weak"


def _place(job: Job) -> tuple[str | None, str | None]:
    parts = [part.strip() for part in (job.location or "").split(",") if part.strip()]
    city = parts[0][:120] if parts else None
    country = (job.country or (parts[-1] if len(parts) > 1 else "") or "").strip()[:120] or None
    if city and country and city.casefold() == country.casefold():
        city = None
    return city, country


def _url(value: str) -> str | None:
    text = (value or "").strip()
    if text.lower().startswith("http://") or text.lower().startswith("https://"):
        return text[:500]
    return None


def _weight(profile: Profile, name: str) -> int:
    weights = {
        "title_role": 25,
        "seniority": 10,
        "skills": 15,
        "experience": 10,
        "qualifications": 10,
        "industry": 10,
        "location": 15,
        "remote_work_arrangement": 10,
        "compensation": 5,
    }
    custom = (profile.scoring.get("weights") or {})
    if name in custom:
        return int(custom[name])
    return weights.get(name, 0)


def push_lead(lead: dict) -> dict:
    base = os.environ.get("CLIENT_OUTREACH_API_URL", "").rstrip("/")
    secret = os.environ.get("API_SECRET", "")
    if not base or not secret:
        raise TransportError("CLIENT_OUTREACH_API_URL and API_SECRET are required to push leads")
    if lead.get("classification") not in CLASSIFICATIONS:
        raise TransportError("refusing to push an invalid classification")
    if lead.get("evidence_level") not in EVIDENCE_LEVELS:
        raise TransportError("refusing to push an invalid evidence_level")
    payload = json.dumps(lead).encode("utf-8")
    request = Request(
        f"{base}/api/leads",
        data=payload,
        headers={
            "Content-Type": "application/json",
            "x-api-secret": secret,
        },
        method="POST",
    )
    with urlopen(request, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))

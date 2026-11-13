"""Deterministic scoring rubric from the W3 Job Scoring agent.

weighted_total = round(sum(factor * weight) / 110)
using half-up rounding so a .5 matches the n8n expression.
"""

from __future__ import annotations

import math
import re

from job_discovery.config import Profile
from job_discovery.models import Job, Score
from job_discovery.qualify import title_phrase_score

DEFAULT_WEIGHTS = {
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
DEFAULT_DIVISOR = 110


def round_half_up(value: float) -> int:
    return int(math.floor(value + 0.5))


def weighted_total(factors: dict[str, int], weights: dict[str, int], divisor: int) -> int:
    total = sum(int(factors[key]) * int(weights[key]) for key in weights)
    return round_half_up(total / divisor)


def score_job(job: Job, profile: Profile) -> Score:
    factors = factor_scores(job, profile)
    scoring = profile.scoring
    weights = dict(DEFAULT_WEIGHTS)
    weights.update({key: int(value) for key, value in (scoring.get("weights") or {}).items() if key in DEFAULT_WEIGHTS})
    divisor = int(scoring.get("divisor") or DEFAULT_DIVISOR)
    total = weighted_total(factors, weights, divisor)
    factors["weighted_total"] = total
    tier = _tier(total)
    recommendation = "Apply" if total >= 70 else "Review" if total >= 45 else "Skip"
    priority = "High" if total >= 75 else "Medium" if total >= 70 else "Low"
    reasons = _reasons(job, factors)
    strengths, gaps = _strengths_and_gaps(job, profile, factors)
    return Score(
        match_score=total,
        match_tier=tier,
        recommendation=recommendation,
        priority=priority,
        match_reasons=reasons,
        strengths=strengths,
        gaps=gaps,
        breakdown=factors,
    )


def factor_scores(job: Job, profile: Profile) -> dict[str, int]:
    candidate = profile.candidate
    title = (job.title or "").casefold()
    blob = job.haystack().casefold()
    location = f"{job.location} {job.country}".casefold()
    return {
        "title_role": title_phrase_score(title, candidate),
        "seniority": _seniority(title),
        "skills": _skills(blob, candidate),
        "experience": _experience(blob, candidate),
        "qualifications": _qualifications(blob, candidate),
        "industry": _industry(blob, candidate),
        "location": _location_score(location, profile),
        "remote_work_arrangement": _arrangement(blob, location, profile),
        "compensation": _compensation(blob),
    }


def _tier(score: int) -> str:
    if score >= 85:
        return "A"
    if score >= 70:
        return "B"
    if score >= 45:
        return "C"
    return "D"


def _seniority(title: str) -> int:
    if re.search(r"\b(chief|cxo|executive|director|head)\b", title):
        return 90
    if re.search(r"\b(senior manager|group|lead)\b", title):
        return 85
    if re.search(r"\b(manager|controller|consultant)\b", title):
        return 80
    if re.search(r"\b(analyst|associate|entry|junior|intern)\b", title):
        return 60
    return 50


def _skills(blob: str, candidate: dict) -> int:
    skills = [str(item).casefold() for item in candidate.get("core_skills") or [] if str(item).strip()]
    if not skills:
        return 10
    hits = sum(1 for skill in skills if skill in blob)
    ratio = hits / len(skills)
    if ratio >= 0.50:
        return 100
    if ratio >= 0.30:
        return 75
    if ratio >= 0.15:
        return 50
    if ratio >= 0.05:
        return 25
    return 10


def _experience(blob: str, candidate: dict) -> int:
    years = int(candidate.get("years_experience") or 0)
    match = re.search(r"(\d+)\s*\+?\s*years?", blob)
    if not match:
        return 70
    required = int(match.group(1))
    if years >= required and required >= years:
        return 100
    if years >= required:
        return 90
    if years >= required - 2:
        return 50
    return 40


def _qualifications(blob: str, candidate: dict) -> int:
    credentials = [str(item).casefold() for item in candidate.get("credentials") or []]
    if not credentials:
        return 30
    hits = [item for item in credentials if re.search(rf"\b{re.escape(item)}\b", blob)]
    if len(hits) >= 2 or (len(credentials) >= 2 and len(hits) == len(credentials)):
        return 100
    if len(hits) == 1:
        return 70
    return 30


def _industry(blob: str, candidate: dict) -> int:
    preferred = [str(item).casefold() for item in candidate.get("preferred_industries") or []]
    secondary = [str(item).casefold() for item in candidate.get("secondary_industries") or []]
    adjacent = [str(item).casefold() for item in candidate.get("adjacent_industries") or []]
    if any(item and item in blob for item in preferred):
        return 100
    if any(item and item in blob for item in secondary):
        return 70
    if any(item and item in blob for item in adjacent):
        return 60
    return 30


def _location_score(location: str, profile: Profile) -> int:
    policy = profile.location_policy
    if any(str(item).casefold() in location for item in policy.get("primary_places") or []):
        return 100
    if any(str(item).casefold() in location for item in policy.get("secondary_places") or []):
        return 80
    if any(str(item).casefold() in location for item in policy.get("remote_markers") or []):
        return 70
    return 40


def _arrangement(blob: str, location: str, profile: Profile) -> int:
    if any(phrase in blob for phrase in ("work from anywhere", "fully remote", "remote worldwide", "worldwide")):
        return 100
    restricted = any(str(item).casefold() in blob for item in profile.candidate.get("remote_restriction_phrases") or [])
    if "remote" in blob and restricted:
        return 60
    if "remote" in blob or "remote" in location:
        return 80
    places = [str(item).casefold() for item in profile.location_policy.get("places") or []]
    if any(place and place in location for place in places):
        return 70
    return 30


def _compensation(blob: str) -> int:
    if re.search(r"\b(competitive|negotiable)\b", blob):
        stated = _salary_amount(blob)
        if stated is None:
            return 60
    amount = _salary_amount(blob)
    if amount is None:
        return 50
    if amount >= 100_000:
        return 100
    if amount >= 80_000:
        return 85
    if amount >= 60_000:
        return 70
    if amount >= 40_000:
        return 50
    return 50


def _salary_amount(blob: str) -> int | None:
    match = re.search(r"(?:[$£€]|usd|aed|sar|gbp|eur)\s*([\d,]{2,})", blob, re.I)
    if not match:
        match = re.search(r"([\d,]{4,})\s*(?:[$£€]|usd|aed|sar|gbp|eur|per year|p.a)", blob, re.I)
    if not match:
        return None
    digits = match.group(1).replace(",", "")
    try:
        return int(digits)
    except ValueError:
        return None


def _reasons(job: Job, factors: dict[str, int]) -> str:
    parts = [
        f"{job.title} at {job.company or 'unknown company'}",
        f"title {factors['title_role']}",
        f"skills {factors['skills']}",
        f"location {factors['location']}",
    ]
    return " | ".join(parts)


def _strengths_and_gaps(job: Job, profile: Profile, factors: dict[str, int]) -> tuple[str, str]:
    strengths: list[str] = []
    gaps: list[str] = []
    credentials = profile.candidate.get("credentials") or []
    if credentials:
        strengths.append("Profile credentials: " + ", ".join(str(item) for item in credentials))
    if factors["skills"] >= 75:
        strengths.append("Core skills are evidenced in the posting")
    elif factors["skills"] <= 25:
        gaps.append("Few core skills are evidenced in the posting")
    if factors["industry"] >= 100:
        strengths.append("Preferred industry is mentioned")
    if factors["location"] < 70:
        gaps.append("Location is outside the preferred geos")
    if factors["qualifications"] == 30:
        gaps.append("Posting does not name the profile credentials")
    return " | ".join(strengths), " | ".join(gaps)

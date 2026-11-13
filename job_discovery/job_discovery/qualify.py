"""Deterministic qualification gate from the W3 Job Qualification agent.

The agent prompt checks two gates, ELIGIBILITY and APPLYABILITY, and returns
{"qualification_status","deal_breakers"}. This module applies those gates from
the active profile so a run does not need an LLM. When LLM_API_KEY is set and
the caller passes use_llm=True, the same prompt is sent and the JSON is used
only if it matches the schema.
"""

from __future__ import annotations

import re

from job_discovery.config import Profile
from job_discovery.filters import matches_location
from job_discovery.models import Job, Qualification
from job_discovery.prompts import qualification_messages


def qualify_job(job: Job, profile: Profile, *, use_llm: bool = False) -> Qualification:
    if use_llm:
        from job_discovery.llm import complete_json

        system, user = qualification_messages(job, profile)
        parsed = complete_json(system, user)
        if parsed and parsed.get("qualification_status") in {"qualified", "disqualified"}:
            status = str(parsed["qualification_status"])
            deal = str(parsed.get("deal_breakers") or ("false" if status == "qualified" else "true"))
            return Qualification(status=status, deal_breakers=deal)
    return qualify_rules(job, profile)


def qualify_rules(job: Job, profile: Profile) -> Qualification:
    reasons: list[str] = []
    candidate = profile.candidate
    title = (job.title or "").casefold()
    blob = job.haystack().casefold()

    if not (job.url or job.apply_url):
        reasons.append("no application link in url or apply_url")

    exclude_titles = [item.casefold() for item in candidate.get("exclude_title_terms") or []]
    if any(term and term in title for term in exclude_titles):
        reasons.append("title is junior, entry-level, or excluded")

    if not _role_fits(title, candidate):
        reasons.append("not a target finance-or-configured leadership role")

    if not matches_location(job, profile.location_policy):
        reasons.append("on-site location is outside the profile geos and the posting is not remote")

    if _remote_restricted(blob, profile):
        reasons.append("remote posting is restricted to a region outside the profile")

    for phrase in candidate.get("hard_block_phrases") or []:
        needle = str(phrase).casefold().strip()
        if needle and needle in blob:
            reasons.append(f"hard blocker: {phrase}")

    if reasons:
        return Qualification(status="disqualified", deal_breakers="true - " + " | ".join(reasons))
    return Qualification(status="qualified", deal_breakers="false")


def _role_fits(title: str, candidate: dict) -> bool:
    if _matches_title_phrase(title, candidate):
        return True
    role_terms = [str(item).casefold() for item in candidate.get("role_terms") or []]
    leadership = [str(item).casefold() for item in candidate.get("leadership_terms") or []]
    has_role = any(term and term in title for term in role_terms)
    has_leadership = any(term and term in title for term in leadership)
    return has_role and has_leadership


def _matches_title_phrase(title: str, candidate: dict) -> bool:
    for band in candidate.get("title_bands") or []:
        for phrase in band.get("titles") or []:
            if str(phrase).casefold() in title:
                return True
    return False


def _remote_restricted(blob: str, profile: Profile) -> bool:
    """Disqualify remote roles that explicitly require another region."""
    if "remote" not in blob:
        return False
    phrases = [str(item).casefold() for item in (profile.candidate.get("remote_restriction_phrases") or [])]
    if not any(phrase and phrase in blob for phrase in phrases):
        return False
    places = [str(item).casefold() for item in profile.location_policy.get("places") or []]
    # A restriction phrase plus a target place ("remote, Riyadh") stays eligible.
    if any(place and place in blob for place in places):
        return False
    return True


def title_phrase_score(title: str, candidate: dict) -> int:
    """Longest matching target-title phrase wins, as in the scoring prompt."""
    best_len = 0
    best_score = 0
    found = False
    for band in candidate.get("title_bands") or []:
        score = int(band.get("score") or 0)
        for phrase in band.get("titles") or []:
            text = str(phrase).casefold().strip()
            if text and text in title and len(text) > best_len:
                best_len = len(text)
                best_score = score
                found = True
            elif text and text in title and len(text) == best_len and score > best_score:
                best_score = score
                found = True
    if found:
        return best_score
    role_terms = [str(item).casefold() for item in candidate.get("role_terms") or []]
    if any(term and term in title for term in role_terms):
        return int(candidate.get("other_role_score") or 50)
    return int(candidate.get("non_role_score") or 20)

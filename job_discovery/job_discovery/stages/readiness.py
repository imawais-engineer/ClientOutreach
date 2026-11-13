"""W4 application readiness.

The deterministic path only rearranges facts already on the profile. It does
not invent employers, metrics, or credentials. An LLM path is used only when
requested and LLM_API_KEY is set; the same no-invention rules are in the prompt.
"""

from __future__ import annotations

import re

from job_discovery.config import Profile
from job_discovery.models import Job
from job_discovery.prompts import readiness_messages


def prepare_application(job: Job, profile: Profile, *, use_llm: bool = False) -> dict:
    if use_llm:
        from job_discovery.llm import complete_json

        system, user = readiness_messages(job, profile)
        parsed = complete_json(system, user)
        if parsed and parsed.get("resume_updates") and parsed.get("cover_letter"):
            return {
                "resume_updates": str(parsed["resume_updates"]),
                "cover_letter": str(parsed["cover_letter"]),
                "mode": "llm",
            }
    return _from_profile(job, profile)


def _from_profile(job: Job, profile: Profile) -> dict:
    resume = profile.resume
    impacts = _lines(resume.get("impacts"))
    competencies = _lines(resume.get("competencies"))
    selected_impacts = _overlap(impacts, job) or impacts[:2]
    selected_skills = _overlap(competencies, job) or competencies[:4]
    missing = _missing(job, profile)
    gap_text = ""
    if missing:
        gap_text = " Gaps to leave off the CV because they are not in the profile: " + ", ".join(missing) + "."
    updates = (
        f"Lead with the summary. Surface these competencies first: {'; '.join(selected_skills) or 'the listed competencies'}. "
        f"Lead the experience section with: {'; '.join(selected_impacts) or 'the listed impacts'}."
        + gap_text
    )
    letter = (
        f"Dear {job.company or 'hiring manager'} team,\n\n"
        f"I am writing about the {job.title} role in {job.location or 'your team'}. "
        f"{resume.get('summary', '').strip()}\n\n"
        f"The parts of my background that match this posting are: {'; '.join(selected_impacts) or 'the experience already listed on my CV'}.\n\n"
        f"Regards,\n{profile.display_name}"
    )
    return {"resume_updates": updates.strip(), "cover_letter": letter.strip(), "mode": "deterministic"}


def _lines(value: object) -> list[str]:
    if not value:
        return []
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    return [part.strip() for part in re.split(r"\n|,\s+(?=[A-Z])", str(value)) if part.strip()]


def _overlap(lines: list[str], job: Job) -> list[str]:
    hay = job.haystack().casefold()
    chosen = []
    for line in lines:
        tokens = [token for token in re.findall(r"[a-z0-9&+]{4,}", line.casefold())]
        if any(token in hay for token in tokens):
            chosen.append(line)
    return chosen[:4]


def _missing(job: Job, profile: Profile) -> list[str]:
    """Terms the posting asks for that the profile never mentions."""
    blob = " ".join(
        str(profile.resume.get(key) or "")
        for key in ("summary", "competencies", "impacts", "experience", "technical_skills", "education")
    ).casefold()
    asked = []
    for term in profile.candidate.get("gap_watch") or []:
        text = str(term).strip()
        if text and text.casefold() in job.haystack().casefold() and text.casefold() not in blob:
            asked.append(text)
    return asked

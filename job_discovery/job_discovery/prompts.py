"""Prompt text ported from the W3 and W4 agent nodes.

The candidate block is filled from the active profile. Nothing in these
templates is a credential or a personal contact.
"""

from __future__ import annotations

from job_discovery.config import Profile
from job_discovery.models import Job


def candidate_block(profile: Profile) -> str:
    candidate = profile.candidate
    credentials = ", ".join(candidate.get("credentials") or [])
    skills = ", ".join(candidate.get("core_skills") or [])
    titles = []
    for band in candidate.get("title_bands") or []:
        titles.extend(band.get("titles") or [])
    return "\n".join(
        [
            f"Name: {profile.display_name}",
            f"Credentials: {credentials}",
            f"Experience: {candidate.get('years_experience')} years; regional experience: {candidate.get('regional_years')} years",
            f"Skills: {skills}",
            "Target titles: " + ", ".join(str(item) for item in titles),
            f"Languages: {', '.join(candidate.get('languages') or [])}",
            f"Citizenship note: {candidate.get('citizenship_note') or ''}",
        ]
    )


def qualification_messages(job: Job, profile: Profile) -> tuple[str, str]:
    system = f"""You are a deterministic Job Qualification Gatekeeper.

Evaluate ONE job against the candidate profile. Check BOTH gates: ELIGIBILITY and APPLYABILITY. Disqualify if either fails. Use ONLY supplied job data. Never invent facts.

CANDIDATE
{candidate_block(profile)}

GATES

ELIGIBILITY:
- Role matches the target titles or a clear leadership equivalent in the profile role family
- Skills, experience and qualifications broadly fit
- On-site must match the profile locations; remote must not be restricted to another region
- Disqualify for hard blockers such as a required citizenship or security clearance the profile lacks, or a mandatory language the profile does not have

APPLYABILITY:
- At least one usable application link must exist in url or apply_url
- If both are missing or empty, disqualify

OUTPUT
Return ONLY valid JSON. No markdown, commentary, or extra fields.

Qualified:
{{"qualification_status":"qualified","deal_breakers":"false"}}

Disqualified:
{{"qualification_status":"disqualified","deal_breakers":"true - reason"}}

For multiple failures, join reasons with " | ".
"""
    user = f"""Evaluate this job using the system rules. Return only the required JSON.

job_uid: {job.job_uid}
title: {job.title}
company: {job.company}
location: {job.location}
url: {job.url}
apply_url: {job.apply_url}

description:
{job.description_full}
"""
    return system, user


def scoring_messages(job: Job, profile: Profile) -> tuple[str, str]:
    system = f"""You are a deterministic Job Scoring Agent.

Score ONE already-qualified job against the candidate profile. Do NOT qualify or disqualify the job. Use ONLY the supplied candidate and job data. Never invent missing facts.

CANDIDATE
{candidate_block(profile)}

Use the title bands, skill ratios, experience, qualification, industry, location, remote arrangement, and compensation weights from the engine profile. Return ONLY JSON with match_score, match_tier, recommendation, priority, match_reasons, strengths, gaps, and score_breakdown.
"""
    user = f"""TITLE: {job.title}
LOCATION: {job.location}
DESCRIPTION:
{job.description_full}
"""
    return system, user


def readiness_messages(job: Job, profile: Profile) -> tuple[str, str]:
    resume = profile.resume
    system = """You are an expert resume writer and cover-letter strategist. You tailor an applicant's existing CV to a specific job.

ABSOLUTE RULES:
- Use ONLY facts present in the applicant profile. NEVER invent employers, titles, dates, metrics, certifications, skills, or achievements.
- If the job asks for something the profile does not contain, say so as a gap inside resume_updates.
- You may rephrase and reorder existing content. The underlying facts must stay true.
- Write the cover letter in first person.
- Return ONLY JSON with exactly two string fields: resume_updates and cover_letter.
"""
    user = f"""TARGET JOB
Title: {job.title}
Company: {job.company}
Location: {job.location}
Description:
{job.description_full}

APPLICANT
{candidate_block(profile)}

Summary:
{resume.get('summary', '')}

Competencies:
{resume.get('competencies', '')}

Impacts:
{resume.get('impacts', '')}

Experience:
{resume.get('experience', '')}

Skills:
{resume.get('technical_skills', '')}

Education:
{resume.get('education', '')}
"""
    return system, user

"""W1 → W2 → W3 runner. W4 and W5 run only when their stage is requested."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone

from job_discovery.config import Profile
from job_discovery.filters import dedupe_jobs, has_required_fields, matches_location, passes_keywords, within_window
from job_discovery.http import RunContext
from job_discovery.leads import to_lead
from job_discovery.models import Job
from job_discovery.notify import format_alert, should_notify
from job_discovery.qualify import qualify_job
from job_discovery.score import score_job
from job_discovery.sources import SOURCE_BY_ID, SOURCES
from job_discovery.stages.detail import enrich
from job_discovery.stages.readiness import prepare_application
from job_discovery.stages.recruiters import discover


@dataclass
class RunResult:
    profile_id: str
    dry_run: bool
    fetched: int = 0
    qualified: list[Job] = field(default_factory=list)
    disqualified: list[Job] = field(default_factory=list)
    dropped: dict = field(default_factory=dict)
    leads: list[dict] = field(default_factory=list)
    alerts: list[str] = field(default_factory=list)
    readiness: list[dict] = field(default_factory=list)
    recruiters: list[dict] = field(default_factory=list)
    errors: list[dict] = field(default_factory=list)


def run_pipeline(
    profile: Profile,
    ctx: RunContext,
    *,
    source_ids: list[str] | None = None,
    stages: set[str] | None = None,
    use_llm: bool = False,
) -> RunResult:
    selected_stages = stages or {"fetch", "detail", "qualify"}
    result = RunResult(profile_id=profile.id, dry_run=ctx.dry_run, dropped={})
    wanted = source_ids or profile.enabled_source_ids()
    sources = [SOURCE_BY_ID[item] for item in wanted if item in SOURCE_BY_ID]
    unknown = [item for item in wanted if item not in SOURCE_BY_ID]
    for name in unknown:
        result.errors.append({"source": name, "error": "unknown source"})

    found: list[Job] = []
    for source in sources:
        try:
            found.extend(source.fetch(profile, ctx))
        except Exception as exc:  # noqa: BLE001 — one board must not abort the others
            result.errors.append({"source": source.id, "error": str(exc)})
    result.fetched = len(found)

    keyword_ok = [job for job in found if passes_keywords(job)]
    result.dropped["keywords"] = len(found) - len(keyword_ok)
    location_ok = [job for job in keyword_ok if matches_location(job, profile.location_policy)]
    result.dropped["location"] = len(keyword_ok) - len(location_ok)
    unique = dedupe_jobs(location_ok)
    result.dropped["duplicate"] = len(location_ok) - len(unique)
    today = ctx.now.date() if isinstance(ctx.now, datetime) else ctx.now
    recent = [
        job
        for job in unique
        if within_window(
            job,
            today=today,
            max_age_days=profile.max_job_age_days,
            require_date=profile.require_published_date,
        )
    ]
    result.dropped["expired"] = len(unique) - len(recent)

    jobs = recent
    if "detail" in selected_stages or "qualify" in selected_stages:
        jobs = enrich(jobs, profile, ctx)

    ready = [job for job in jobs if has_required_fields(job, require_description=True) and not job.archived]
    result.dropped["incomplete"] = len(jobs) - len(ready)

    if "qualify" not in selected_stages and "all" not in selected_stages:
        result.qualified = ready
        result.leads = [to_lead(job, profile) for job in ready]
        return result

    for job in ready:
        decision = qualify_job(job, profile, use_llm=use_llm)
        job.qualification_status = decision.status
        job.deal_breakers = decision.deal_breakers
        if not decision.qualified:
            job.archived = True
            job.pipeline_status = "qualifier_agent_disqualified_this_job"
            job.next_action = "archived"
            result.disqualified.append(job)
            continue
        scored = score_job(job, profile)
        job.match_score = scored.match_score
        job.match_tier = scored.match_tier
        job.recommendation = scored.recommendation
        job.priority = scored.priority
        job.match_reasons = scored.match_reasons
        job.strengths = scored.strengths
        job.gaps = scored.gaps
        job.score_breakdown = scored.breakdown
        job.pipeline_status = "qualified_and_scored"
        job.next_action = "application_readiness"
        result.qualified.append(job)
        if should_notify(job, str((profile.raw.get("notifications") or {}).get("min_priority") or "High")):
            result.alerts.append(format_alert(job))

    result.qualified.sort(key=lambda job: job.match_score or 0, reverse=True)
    result.leads = [to_lead(job, profile) for job in result.qualified]

    if "readiness" in selected_stages or "all" in selected_stages:
        for job in result.qualified:
            packet = prepare_application(job, profile, use_llm=use_llm)
            packet["job_uid"] = job.job_uid
            result.readiness.append(packet)

    if "recruiters" in selected_stages or "all" in selected_stages:
        found_on = today
        for job in result.qualified:
            if (job.match_score or 0) < int(profile.recruiter.get("min_match_score") or 70):
                continue
            result.recruiters.append(discover(job, profile, found_on=found_on))

    return result


def available_sources() -> list[str]:
    return [source.id for source in SOURCES]


def utcnow() -> datetime:
    return datetime.now(timezone.utc)

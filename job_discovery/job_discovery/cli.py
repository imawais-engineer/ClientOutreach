"""Command line entry point.

    python -m job_discovery run --profile finance_gcc --dry-run
"""

from __future__ import annotations

import argparse
import json
import sys

from job_discovery.config import load_profile
from job_discovery.http import RunContext
from job_discovery.leads import push_lead
from job_discovery.notify import send_telegram
from job_discovery.pipeline import available_sources, run_pipeline, utcnow


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="job-discovery")
    sub = parser.add_subparsers(dest="command", required=True)

    run = sub.add_parser("run", help="Fetch, normalize, qualify, and optionally push leads")
    run.add_argument("--profile", default="finance_gcc", help="Profile name or path to a JSON file")
    run.add_argument("--dry-run", action="store_true", help="Use fixture responses and do not call external APIs")
    run.add_argument("--sources", default="", help="Comma-separated source ids (default: enabled sources in the profile)")
    run.add_argument("--stage", default="qualify", choices=["fetch", "qualify", "readiness", "recruiters", "all"])
    run.add_argument("--push", action="store_true", help="POST qualified leads to CLIENT_OUTREACH_API_URL")
    run.add_argument("--notify", action="store_true", help="Send high-priority Telegram alerts when configured")
    run.add_argument("--llm", action="store_true", help="Ask the configured LLM instead of the deterministic rubric")
    run.add_argument("--output", default="", help="Write the JSON result to this path as well as stdout")

    sub.add_parser("sources", help="List ported source ids")

    args = parser.parse_args(argv)
    if args.command == "sources":
        json.dump(available_sources(), sys.stdout, indent=2)
        sys.stdout.write("\n")
        return 0

    profile = load_profile(args.profile)
    source_ids = [item.strip() for item in args.sources.split(",") if item.strip()] or None
    stages = _stages(args.stage)
    ctx = RunContext(dry_run=args.dry_run, now=utcnow())
    result = run_pipeline(profile, ctx, source_ids=source_ids, stages=stages, use_llm=args.llm and not args.dry_run)

    pushed = []
    if args.push:
        if args.dry_run:
            print("Refusing to push during --dry-run", file=sys.stderr)
            return 2
        for lead in result.leads:
            pushed.append(push_lead(lead))
    notified = 0
    if args.notify and not args.dry_run:
        for alert in result.alerts:
            if send_telegram(alert):
                notified += 1

    payload = {
        "profile": result.profile_id,
        "dry_run": result.dry_run,
        "stage": args.stage,
        "counts": {
            "fetched": result.fetched,
            "qualified": len(result.qualified),
            "disqualified": len(result.disqualified),
            "dropped": result.dropped,
            "alerts": len(result.alerts),
            "pushed": len(pushed),
            "notified": notified,
        },
        "errors": result.errors,
        "qualified": [_public_job(job) for job in result.qualified],
        "leads": result.leads,
    }
    if result.readiness:
        payload["readiness"] = result.readiness
    if result.recruiters:
        payload["recruiters"] = result.recruiters
    text = json.dumps(payload, indent=2)
    if args.output:
        with open(args.output, "w", encoding="utf-8") as handle:
            handle.write(text)
            handle.write("\n")
    sys.stdout.write(text)
    sys.stdout.write("\n")
    return 0 if not result.errors else 0


def _stages(name: str) -> set[str]:
    if name == "all":
        return {"fetch", "detail", "qualify", "readiness", "recruiters", "all"}
    if name == "fetch":
        return {"fetch", "detail"}
    if name == "qualify":
        return {"fetch", "detail", "qualify"}
    if name == "readiness":
        return {"fetch", "detail", "qualify", "readiness"}
    if name == "recruiters":
        return {"fetch", "detail", "qualify", "recruiters"}
    return {"fetch", "detail", "qualify"}


def _public_job(job) -> dict:
    return {
        "job_uid": job.job_uid,
        "source": job.source,
        "title": job.title,
        "company": job.company,
        "location": job.location,
        "url": job.url,
        "apply_url": job.apply_url,
        "date_published": job.date_published,
        "match_score": job.match_score,
        "match_tier": job.match_tier,
        "recommendation": job.recommendation,
        "priority": job.priority,
        "qualification_status": job.qualification_status,
        "pipeline_status": job.pipeline_status,
    }

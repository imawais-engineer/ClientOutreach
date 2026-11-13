# Job Discovery System

Python port of the n8n job-discovery workflows. It fetches listings, normalizes them to one schema, drops stale and off-geography rows, qualifies and scores what remains, and can push each job to the dashboard with `POST /api/leads`.

The niche is a JSON profile. `profiles/finance_gcc.json` is the finance example (CMA/ACCA, GCC and remote, the original title bands and score weights). Copy that file to search for any other role.

Source-by-source notes and the pipeline diagram: [docs/PIPELINE.md](docs/PIPELINE.md).

## Run a dry run

No API keys. Fixture responses stand in for LinkedIn, the job APIs, Apify, and Firecrawl.

```bash
cd job_discovery
python3 -m pip install -e ".[dev]"
python3 -m job_discovery run --profile finance_gcc --dry-run
```

Stdout is JSON. `qualified` is the normalized, scored set. `leads` is the body that would be posted to the dashboard. `counts.dropped` shows how many rows the keyword, location, dedupe, and recency rules removed.

```bash
python3 -m job_discovery sources
python3 -m pytest
```

`--stage readiness` adds resume guidance and a cover letter built only from the profile. `--stage recruiters` builds review-only search queries for qualified jobs. `--stage all` runs both. Neither stage contacts anyone.

## Run against live sources

Copy the root `.env.example` values into an untracked env file and export them. Then:

```bash
python3 -m job_discovery run --profile finance_gcc --push --notify
```

`--push` sends qualified leads to `CLIENT_OUTREACH_API_URL` with header `x-api-secret`. `--dry-run` refuses to push. `--llm` replaces the deterministic rubric with the configured chat model; without `LLM_API_KEY` the engine keeps the built-in rules.

`business_key` is the slug of `job_uid` (`greenhouse:501` becomes `greenhouse-501`), so a later run updates the same lead. `contact.post_url` is the listing URL. `platform` is `Job Boards`.

## Profiles

Each profile sets searches, include/exclude keywords, location lists, title bands, score weights, ATS board tokens, and the resume facts used for readiness. Undated listings are dropped when `require_published_date` is true, which matches the original recency filter.

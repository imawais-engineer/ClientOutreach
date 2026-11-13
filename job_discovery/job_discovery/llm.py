"""Optional OpenAI-compatible chat completion. Unused unless LLM_API_KEY is set."""

from __future__ import annotations

import json
import os
import re
from datetime import datetime, timezone

from job_discovery.http import RunContext, TransportError


def llm_configured() -> bool:
    return bool(os.environ.get("LLM_API_KEY"))


def complete_json(system: str, user: str) -> dict | None:
    api_key = os.environ.get("LLM_API_KEY")
    if not api_key:
        return None
    base = os.environ.get("LLM_BASE_URL", "https://api.openai.com/v1").rstrip("/")
    model = os.environ.get("LLM_MODEL", "gpt-4o-mini")
    ctx = RunContext(dry_run=False, now=datetime.now(timezone.utc))
    try:
        payload = ctx.post_json(
            f"{base}/chat/completions",
            {
                "model": model,
                "temperature": 0,
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
            },
            fixture="",
            headers={"Authorization": f"Bearer {api_key}"},
        )
    except TransportError:
        return None
    content = ""
    try:
        content = payload["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError):
        return None
    return _parse_json(content)


def _parse_json(content: str) -> dict | None:
    text = content.strip()
    fenced = re.search(r"\{.*\}", text, re.S)
    if not fenced:
        return None
    try:
        parsed = json.loads(fenced.group(0))
    except json.JSONDecodeError:
        return None
    return parsed if isinstance(parsed, dict) else None

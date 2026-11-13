"""High-priority alerts. Telegram is optional and never required for a dry run."""

from __future__ import annotations

import json
import os
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from job_discovery.models import Job


def format_alert(job: Job) -> str:
    return "\n".join(
        [
            "High-priority job match",
            f"Title: {job.title}",
            f"Company: {job.company}",
            f"Location: {job.location}",
            f"Job score: {job.match_score}/100 Tier: {job.match_tier}",
            f"Job link: {job.apply_url or job.url}",
        ]
    )


def should_notify(job: Job, minimum: str = "High") -> bool:
    order = {"Low": 0, "Medium": 1, "High": 2}
    return order.get(job.priority, -1) >= order.get(minimum, 2)


def send_telegram(text: str) -> bool:
    token = os.environ.get("TELEGRAM_BOT_TOKEN", "")
    chat_id = os.environ.get("TELEGRAM_CHAT_ID", "")
    if not token or not chat_id:
        return False
    body = urlencode({"chat_id": chat_id, "text": text}).encode("utf-8")
    request = Request(
        f"https://api.telegram.org/bot{token}/sendMessage",
        data=body,
        method="POST",
    )
    with urlopen(request, timeout=20) as response:
        payload = json.loads(response.read().decode("utf-8"))
    return bool(payload.get("ok"))

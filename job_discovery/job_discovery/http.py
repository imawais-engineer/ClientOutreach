"""HTTP and fixture loading.

Dry-run never opens a socket. Fixture bodies may contain {{RECENT_*}} tokens
so sample postings stay inside the recency window whenever the suite runs.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from job_discovery.config import FIXTURES_DIR


class TransportError(RuntimeError):
    pass


def render_fixture(text: str, now: datetime) -> str:
    recent = (now.date() - timedelta(days=1))
    stale = (now.date() - timedelta(days=40))
    recent_dt = datetime(recent.year, recent.month, recent.day, 9, 0, tzinfo=timezone.utc)
    stale_dt = datetime(stale.year, stale.month, stale.day, 9, 0, tzinfo=timezone.utc)
    human = f"{recent.strftime('%B')} {recent.day}, {recent.year}"
    stale_human = f"{stale.strftime('%B')} {stale.day}, {stale.year}"
    rss = recent_dt.strftime("%a, %d %b %Y %H:%M:%S +0000")
    replacements = {
        "{{RECENT_ISO}}": recent.isoformat(),
        "{{STALE_ISO}}": stale.isoformat(),
        "{{RECENT_HUMAN}}": human,
        "{{STALE_HUMAN}}": stale_human,
        "{{RECENT_EPOCH}}": str(int(recent_dt.timestamp())),
        "{{STALE_EPOCH}}": str(int(stale_dt.timestamp())),
        "{{RECENT_RSS}}": rss,
    }
    for token, value in replacements.items():
        text = text.replace(token, value)
    return text


@dataclass
class RunContext:
    dry_run: bool
    now: datetime
    fixtures: Path = field(default_factory=lambda: FIXTURES_DIR)
    timeout: int = 60

    def load_text(self, name: str) -> str:
        path = self._fixture_path(name)
        raw = path.read_text(encoding="utf-8")
        return render_fixture(raw, self.now)

    def load_json(self, name: str):
        return json.loads(self.load_text(name))

    def get_text(self, url: str, *, fixture: str, headers: dict | None = None, params: dict | None = None) -> str:
        if self.dry_run:
            return self.load_text(fixture)
        return self._request("GET", url, headers=headers, params=params).decode("utf-8", errors="replace")

    def get_json(self, url: str, *, fixture: str, headers: dict | None = None, params: dict | None = None):
        if self.dry_run:
            return self.load_json(fixture)
        body = self._request("GET", url, headers=headers, params=params)
        return json.loads(body.decode("utf-8"))

    def post_json(self, url: str, payload: dict, *, fixture: str, headers: dict | None = None):
        if self.dry_run:
            return self.load_json(fixture)
        body = self._request("POST", url, headers=headers, json_body=payload)
        return json.loads(body.decode("utf-8"))

    def _fixture_path(self, name: str) -> Path:
        for ext in (".json", ".html", ".xml", ".rss", ".md", ".txt"):
            path = self.fixtures / f"{name}{ext}"
            if path.is_file():
                return path
        raise FileNotFoundError(f"No fixture named {name} in {self.fixtures}")

    def _request(self, method: str, url: str, *, headers: dict | None = None, params: dict | None = None, json_body: dict | None = None) -> bytes:
        if params:
            query = urlencode({key: value for key, value in params.items() if value is not None})
            url = f"{url}{'&' if '?' in url else '?'}{query}"
        data = None
        hdrs = {"User-Agent": "job-discovery/0.1", "Accept": "application/json, text/html, */*"}
        if headers:
            hdrs.update(headers)
        if json_body is not None:
            data = json.dumps(json_body).encode("utf-8")
            hdrs.setdefault("Content-Type", "application/json")
        request = Request(url, data=data, headers=hdrs, method=method)
        try:
            with urlopen(request, timeout=self.timeout) as response:
                return response.read()
        except HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")[:300]
            raise TransportError(f"{method} {_public_url(url)} failed with HTTP {exc.code}: {detail}") from exc
        except URLError as exc:
            raise TransportError(f"{method} {_public_url(url)} failed: {exc.reason}") from exc


def _public_url(url: str) -> str:
    text = re.sub(r"(jooble\.org/api/)[^/?]+", r"\1[redacted]", url)
    text = re.sub(r"([?&](?:token|api_key|apikey)=)[^&]+", r"\1[redacted]", text, flags=re.I)
    return text

"""Profile loading. The finance GCC search is one example, not a hardcoded niche."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

from job_discovery.models import Search

PACKAGE_ROOT = Path(__file__).resolve().parent
PROJECT_ROOT = PACKAGE_ROOT.parent
PROFILES_DIR = PROJECT_ROOT / "profiles"
FIXTURES_DIR = PROJECT_ROOT / "fixtures"


@dataclass
class Profile:
    raw: dict
    path: Path

    @property
    def id(self) -> str:
        return str(self.raw.get("id") or self.path.stem)

    @property
    def display_name(self) -> str:
        return str(self.raw.get("display_name") or self.id)

    @property
    def category(self) -> str:
        return str(self.raw.get("category") or "Job Application")

    @property
    def max_job_age_days(self) -> int:
        return int(self.raw.get("max_job_age_days") or 7)

    @property
    def require_published_date(self) -> bool:
        return bool(self.raw.get("require_published_date", True))

    @property
    def page_size(self) -> int:
        return int(self.raw.get("page_size") or 25)

    @property
    def candidate(self) -> dict:
        return dict(self.raw.get("candidate") or {})

    @property
    def location_policy(self) -> dict:
        return dict(self.raw.get("location_policy") or {})

    @property
    def scoring(self) -> dict:
        return dict(self.raw.get("scoring") or {})

    @property
    def resume(self) -> dict:
        return dict(self.raw.get("resume") or {})

    @property
    def recruiter(self) -> dict:
        return dict(self.raw.get("recruiter") or {})

    def searches(self) -> list[Search]:
        rows = []
        for item in self.raw.get("searches") or []:
            rows.append(
                Search(
                    keyword=str(item.get("keyword") or ""),
                    location=str(item.get("location") or ""),
                    country=str(item.get("country") or ""),
                    country_code=str(item.get("country_code") or ""),
                    currency_code=str(item.get("currency_code") or ""),
                    filter_keywords=_strings(item.get("filter_keywords")),
                    exclude_keywords=_strings(item.get("exclude_keywords")),
                    title_match_keywords=_strings(item.get("title_match_keywords")),
                )
            )
        return rows

    def source_config(self, source_id: str) -> dict:
        sources = self.raw.get("sources") or {}
        config = dict(sources.get(source_id) or {})
        config.setdefault("enabled", False)
        return config

    def enabled_source_ids(self) -> list[str]:
        sources = self.raw.get("sources") or {}
        return [key for key, value in sources.items() if (value or {}).get("enabled")]


def _strings(value: object) -> list[str]:
    if value is None:
        return []
    if isinstance(value, str):
        return [part.strip() for part in value.split(",") if part.strip()]
    if isinstance(value, list):
        return [str(part).strip() for part in value if str(part).strip()]
    return []


def load_profile(name_or_path: str) -> Profile:
    candidate = Path(name_or_path)
    if candidate.is_file():
        path = candidate
    else:
        path = PROFILES_DIR / f"{name_or_path}.json"
        if not path.is_file():
            path = PROFILES_DIR / name_or_path
    if not path.is_file():
        raise FileNotFoundError(f"Profile not found: {name_or_path}")
    raw = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(raw, dict):
        raise ValueError(f"Profile must be a JSON object: {path}")
    return Profile(raw=raw, path=path)

"""Publication dates and the W1 recency window.

The sheet stored dates as 'MMMM d, yyyy'. Sources also emit ISO dates, RSS
pubDates, and Unix seconds. All of those parse to a calendar date.
"""

from __future__ import annotations

import calendar
import re
from datetime import date, datetime, timedelta, timezone

_MONTHS = {name.lower(): index for index, name in enumerate(calendar.month_name) if name}
_MONTHS.update({name.lower(): index for index, name in enumerate(calendar.month_abbr) if name})


def parse_date(value: object) -> date | None:
    if value is None or value is False:
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return _from_epoch(float(value))
    text = str(value).strip()
    if not text or text.lower() in {"n/a", "none", "null"}:
        return None
    if re.fullmatch(r"\d{10,13}", text):
        number = float(text)
        return _from_epoch(number)
    iso = text.replace("Z", "+00:00")
    if re.match(r"\d{4}-\d{2}-\d{2}", iso):
        try:
            return datetime.fromisoformat(iso[:19]).date() if "T" in iso[:19] else date.fromisoformat(iso[:10])
        except ValueError:
            pass
    human = re.fullmatch(r"([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})", text)
    if human:
        month = _MONTHS.get(human.group(1).lower())
        if month:
            try:
                return date(int(human.group(3)), month, int(human.group(2)))
            except ValueError:
                return None
    rss = re.fullmatch(
        r"[A-Za-z]{3},\s+(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})(?:\s+\d{2}:\d{2}:\d{2}\s+[+-]\d{4})?",
        text,
    )
    if rss:
        month = _MONTHS.get(rss.group(2).lower())
        if month:
            try:
                return date(int(rss.group(3)), month, int(rss.group(1)))
            except ValueError:
                return None
    return None


def _from_epoch(number: float) -> date | None:
    seconds = number / 1000 if number > 10_000_000_000 else number
    try:
        return datetime.fromtimestamp(seconds, tz=timezone.utc).date()
    except (OverflowError, OSError, ValueError):
        return None


def is_recent(
    published: date | None,
    *,
    today: date,
    max_age_days: int,
    require_date: bool,
) -> bool:
    """True when the posting is inside the configured window.

    Undated postings are dropped when require_date is set, matching the strict
    RECENT FILTER node. A posting on the cutoff day is kept (afterOrEquals).
    """
    if published is None:
        return not require_date
    cutoff = today - timedelta(days=max_age_days)
    return published >= cutoff


def is_expired_flag(value: object) -> bool:
    if value is True:
        return True
    if isinstance(value, str) and value.strip().lower() in {"true", "1", "yes"}:
        return True
    return False

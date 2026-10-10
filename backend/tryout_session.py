from datetime import datetime, timezone, timedelta
from typing import Optional


def parse_iso(s: Optional[str]) -> Optional[datetime]:
    if not s:
        return None
    try:
        d = datetime.fromisoformat(str(s).replace("Z", "+00:00"))
    except ValueError:
        return None
    return d if d.tzinfo else d.replace(tzinfo=timezone.utc)


def _end(t: dict) -> Optional[datetime]:
    raw = t.get("end_at")
    end = parse_iso(raw)
    if end and len(str(raw)) == 10:
        end += timedelta(days=1)
    return end


def schedule_status(t: dict, now: Optional[datetime] = None) -> str:
    now = now or datetime.now(timezone.utc)
    start, end = parse_iso(t.get("start_at")), _end(t)
    if start and now < start:
        return "upcoming"
    if end and now >= end:
        return "closed"
    return "open"


def remaining_seconds(attempt: dict, tryout: dict, now: Optional[datetime] = None) -> int:
    now = now or datetime.now(timezone.utc)
    started = parse_iso(attempt.get("started_at")) or now
    total = int(attempt.get("duration_minutes") or tryout.get("duration_minutes") or 60) * 60
    left = total - int((now - started).total_seconds())
    end = _end(tryout)
    if end and not attempt.get("bypass_schedule"):
        left = min(left, int((end - now).total_seconds()))
    return max(0, left)


def answered_count(answers: dict) -> int:
    return sum(1 for v in (answers or {}).values() if v and any(str(x).strip() for x in v))

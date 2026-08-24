#!/usr/bin/env python3
"""Comprueba si todavia falta la observacion semanal mas reciente de NOAA."""

from __future__ import annotations

import json
import sys
from datetime import date, datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo


ROOT = Path(__file__).resolve().parents[1]
MANIFEST_PATH = ROOT / "data" / "source_manifest.json"
EASTERN = ZoneInfo("America/New_York")
WEDNESDAY = 2
WEEKLY_SOURCES = ("relative_weekly", "absolute_weekly")


def previous_wednesday(run_date: date) -> date:
    """Devuelve el miercoles estrictamente anterior a la fecha de corrida."""
    days_since_wednesday = (run_date.weekday() - WEDNESDAY) % 7
    if days_since_wednesday == 0:
        days_since_wednesday = 7
    return run_date - timedelta(days=days_since_wednesday)


def target_observation(now: datetime | None = None) -> date:
    """Devuelve el objetivo semanal para una corrida en America/New_York."""
    current = now.astimezone(EASTERN) if now is not None else datetime.now(EASTERN)
    return previous_wednesday(current.date())


def is_pending(manifest_path: Path = MANIFEST_PATH, now: datetime | None = None) -> bool:
    target = target_observation(now)
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        latest = {
            key: date.fromisoformat(manifest["sources"][key]["latest_observation"])
            for key in WEEKLY_SOURCES
        }
    except (OSError, UnicodeError, json.JSONDecodeError, KeyError, TypeError, ValueError) as exc:
        print(f"No se pudo leer el manifiesto: {exc}", file=sys.stderr)
        return True

    pending = any(observation < target for observation in latest.values())
    details = ", ".join(f"{key}={value.isoformat()}" for key, value in latest.items())
    print(f"Objetivo={target.isoformat()}; {details}", file=sys.stderr)
    return pending


def main() -> int:
    pending = is_pending()
    print(f"pendiente={'true' if pending else 'false'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

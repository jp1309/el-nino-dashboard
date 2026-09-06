#!/usr/bin/env python3
"""Snapshot official CPC outlook percentiles and advisory; never infer probabilities."""
from __future__ import annotations

import calendar
import json
import math
import re
import sys
from datetime import date
from html import unescape
from pathlib import Path

try:
    from . import update_data as data
except ImportError:
    import update_data as data

OUTLOOK = data.Source("outlook", "outlook.html", "https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/enso/roni/outlook/")
ADVISORY = data.Source("advisory", "advisory.html", "https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/enso_advisory/ensodisc.shtml")
OUTPUT = data.ROOT / "data" / "outlook.json"
MONTHS = {name: number for number, name in enumerate(calendar.month_name) if name}
PERCENTILES = (5, 15, 25, 50, 75, 85, 95)


def plain(html: str) -> str:
    return " ".join(unescape(re.sub(r"<[^>]+>", " ", html)).split())


def parse_outlook(html: str) -> dict:
    issued = re.search(r"Issued\s+(\w+)\s+(20\d{2})", plain(html))
    if not issued or issued[1] not in MONTHS:
        raise ValueError("No se reconoce la fecha de emision del pronostico")
    month, year = MONTHS[issued[1]], int(issued[2])
    table = re.search(r'<table\b[^>]*id=[\"\']outlook-table[\"\'][^>]*>(.*?)</table>', html, re.S | re.I)
    if not table:
        raise ValueError("No se encuentra la tabla oficial de percentiles")
    header = [plain(cell) for cell in re.findall(r"<th\b[^>]*>(.*?)</th>", table[1], re.S | re.I)][:8]
    if header != ["Season", *[f"{p}%" for p in PERCENTILES]]:
        raise ValueError(f"Columnas de percentiles inesperadas: {header}")
    rows = []
    for row in re.findall(r"<tr\b[^>]*>(.*?)</tr>", table[1], re.S | re.I):
        cells = [plain(cell) for cell in re.findall(r"<t[dh]\b[^>]*>(.*?)</t[dh]>", row, re.S | re.I)]
        if not cells or cells[0].split()[0] not in data.SEASON_MIDDLE_MONTH:
            continue
        season = cells[0].split()[0]
        values = list(map(float, cells[1:]))
        if len(values) != 7 or not all(math.isfinite(v) and -6 <= v <= 6 for v in values) or values != sorted(values):
            raise ValueError(f"Percentiles invalidos: {season}")
        middle = data.SEASON_MIDDLE_MONTH[season]
        offset = len(rows)
        expected_month = (month - 1 + offset) % 12 + 1
        if middle != expected_month:
            raise ValueError("Temporadas incompletas o fuera de orden")
        row_year = year + (month - 1 + offset) // 12
        rows.append({"season": season, "year": row_year, "date": date(row_year, middle, 15).isoformat(),
                     **{f"p{p}": v for p, v in zip(PERCENTILES, values)}})
    if len(rows) != 9:
        raise ValueError(f"Se esperaban 9 temporadas, recibidas {len(rows)}")
    return {"issued_month": f"{year}-{month:02d}", "seasons": rows}


def parse_advisory(html: str) -> dict:
    text = plain(html)
    issued = re.search(r"(\d{1,2})\s+(" + "|".join(MONTHS) + r")\s+(20\d{2})", text)
    status = re.search(r"ENSO Alert System Status:\s*(.*?)\s*Synopsis:", text)
    if not issued or not status:
        raise ValueError("No se reconoce la fecha o el estado del aviso ENSO")
    label = status[1].strip()
    allowed = {"El Niño Advisory", "La Niña Advisory", "El Niño Watch", "La Niña Watch", "Not Active", "Final La Niña Advisory", "Final El Niño Advisory"}
    if not all(part in allowed for part in re.split(r"\s*/\s*", label)):
        raise ValueError(f"Estado del aviso ENSO no reconocido: {label}")
    return {"issued_date": date(int(issued[3]), MONTHS[issued[2]], int(issued[1])).isoformat(), "status": label}


def build(payloads: dict[str, bytes]) -> dict:
    outlook = parse_outlook(payloads["outlook"].decode("utf-8", errors="replace"))
    advisory = parse_advisory(payloads["advisory"].decode("utf-8", errors="replace"))
    if advisory["issued_date"][:7] != outlook["issued_month"]:
        raise ValueError("Aviso y pronostico de meses distintos; se conserva la edicion anterior")
    return {**outlook, "advisory": advisory, "sources": {
        source.key: {"url": source.url, "file": f"data/raw/{source.filename}", "sha256": data.sha256(payloads[source.key])}
        for source in (OUTLOOK, ADVISORY)}}


def due(today: date | None = None) -> bool:
    today = today or date.today()
    # CPC issues the monthly outlook on the second Thursday.
    second_thursday = 1 + (3 - date(today.year, today.month, 1).weekday()) % 7 + 7
    expected = date(today.year, today.month, 1)
    if today.day < second_thursday:
        expected = date(today.year - (today.month == 1), today.month - 1 or 12, 1)
    try:
        return json.loads(OUTPUT.read_text(encoding="utf-8"))["issued_month"] < expected.strftime("%Y-%m")
    except (OSError, ValueError, KeyError):
        return True


def main() -> int:
    if "--if-due" in sys.argv and not due():
        print("Pronostico mensual ya disponible.")
        return 0
    try:
        payloads = {source.key: data.download(source) for source in (OUTLOOK, ADVISORY)}
        result = build(payloads)
        if OUTPUT.exists():
            previous = json.loads(OUTPUT.read_text(encoding="utf-8"))
            if result["advisory"]["issued_date"] < previous["advisory"]["issued_date"]:
                raise ValueError("La descarga retrocede a una edicion anterior del pronostico")
        age = (date.today() - date.fromisoformat(result["advisory"]["issued_date"])).days
        if not 0 <= age <= 62:
            raise ValueError("Fecha de emision futura o de mas de 62 dias")
        for source in (OUTLOOK, ADVISORY):
            data.write_if_changed(data.RAW_DIR / source.filename, payloads[source.key])
        data.write_if_changed(OUTPUT, data.json_bytes(result))
        print(f"Pronostico validado: {result['issued_month']}; 9 temporadas.")
        return 0
    except Exception as exc:
        print(f"ERROR pronostico: {exc}. Se conservan los datos anteriores.", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

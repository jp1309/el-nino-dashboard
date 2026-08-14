#!/usr/bin/env python3
"""Download, validate and publish the NOAA datasets used by the dashboard."""

from __future__ import annotations

import hashlib
import json
import re
import sys
import urllib.request
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = ROOT / "data" / "raw"
OUTPUT_PATH = ROOT / "data" / "enso.json"
MANIFEST_PATH = ROOT / "data" / "source_manifest.json"

REGIONS = ("nino12", "nino3", "nino34", "nino4")
MONTHS = {
    "JAN": 1,
    "FEB": 2,
    "MAR": 3,
    "APR": 4,
    "MAY": 5,
    "JUN": 6,
    "JUL": 7,
    "AUG": 8,
    "SEP": 9,
    "OCT": 10,
    "NOV": 11,
    "DEC": 12,
}
SEASON_MIDDLE_MONTH = {
    "DJF": 1,
    "JFM": 2,
    "FMA": 3,
    "MAM": 4,
    "AMJ": 5,
    "MJJ": 6,
    "JJA": 7,
    "JAS": 8,
    "ASO": 9,
    "SON": 10,
    "OND": 11,
    "NDJ": 12,
}


@dataclass(frozen=True)
class Source:
    key: str
    filename: str
    url: str


SOURCES = (
    Source(
        "relative_weekly",
        "rel_wksst9120.txt",
        "https://www.cpc.ncep.noaa.gov/data/indices/rel_wksst9120.txt",
    ),
    Source(
        "absolute_weekly",
        "wksst9120.for",
        "https://www.cpc.ncep.noaa.gov/data/indices/wksst9120.for",
    ),
    Source(
        "roni",
        "RONI.ascii.txt",
        "https://www.cpc.ncep.noaa.gov/data/indices/RONI.ascii.txt",
    ),
)


def download(source: Source) -> bytes:
    request = urllib.request.Request(
        source.url,
        headers={"User-Agent": "el-nino-dashboard/1.0 (+https://github.com/jp1309/el-nino-dashboard)"},
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        payload = response.read()
    if len(payload) < 1_000:
        raise ValueError(f"{source.key}: respuesta demasiado pequena ({len(payload)} bytes)")
    return payload


def parse_week_date(token: str) -> date:
    match = re.fullmatch(r"(\d{2})([A-Z]{3})(\d{4})", token)
    if not match or match.group(2) not in MONTHS:
        raise ValueError(f"Fecha semanal invalida: {token}")
    return date(int(match.group(3)), MONTHS[match.group(2)], int(match.group(1)))


def parse_relative_weekly(text: str) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    for line in text.splitlines():
        parts = line.split()
        if len(parts) != 5 or not re.fullmatch(r"\d{2}[A-Z]{3}\d{4}", parts[0]):
            continue
        values = [float(value) for value in parts[1:]]
        records.append(
            {
                "date": parse_week_date(parts[0]).isoformat(),
                "nino12": values[0],
                "nino3": values[1],
                "nino34": values[2],
                "nino4": values[3],
            }
        )
    validate_series(records, "relative_weekly", minimum=500)
    for record in records:
        for region in REGIONS:
            if not -10 <= record[region] <= 10:
                raise ValueError(f"relative_weekly: valor fuera de rango en {record['date']}")
    return records


def parse_absolute_weekly(text: str) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    number_pattern = re.compile(r"[-+]?(?:\d+(?:\.\d*)?|\.\d+)")
    for line in text.splitlines():
        match = re.match(r"^\s*(\d{2}[A-Z]{3}\d{4})(.*)$", line)
        if not match:
            continue
        values = [float(value) for value in number_pattern.findall(match.group(2))]
        if len(values) != 8:
            raise ValueError(f"absolute_weekly: se esperaban 8 valores en {match.group(1)}")
        record: dict[str, Any] = {"date": parse_week_date(match.group(1)).isoformat()}
        for index, region in enumerate(REGIONS):
            record[f"{region}_sst"] = values[index * 2]
            record[f"{region}_anom"] = values[index * 2 + 1]
        records.append(record)
    validate_series(records, "absolute_weekly", minimum=500)
    for record in records:
        for region in REGIONS:
            if not 10 <= record[f"{region}_sst"] <= 40:
                raise ValueError(f"absolute_weekly: SST fuera de rango en {record['date']}")
            if not -10 <= record[f"{region}_anom"] <= 10:
                raise ValueError(f"absolute_weekly: anomalia fuera de rango en {record['date']}")
    return records


def parse_roni(text: str) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    for line in text.splitlines():
        parts = line.split()
        if len(parts) != 3 or parts[0] not in SEASON_MIDDLE_MONTH:
            continue
        year = int(parts[1])
        value = float(parts[2])
        if not -5 <= value <= 5:
            raise ValueError(f"roni: valor fuera de rango en {parts[0]} {year}")
        records.append(
            {
                "date": date(year, SEASON_MIDDLE_MONTH[parts[0]], 15).isoformat(),
                "season": parts[0],
                "year": year,
                "value": value,
            }
        )
    validate_series(records, "roni", minimum=500)
    return records


def validate_series(records: list[dict[str, Any]], name: str, minimum: int) -> None:
    if len(records) < minimum:
        raise ValueError(f"{name}: solo se encontraron {len(records)} registros")
    dates = [record["date"] for record in records]
    if dates != sorted(dates) or len(dates) != len(set(dates)):
        raise ValueError(f"{name}: fechas duplicadas o fuera de orden")


def validate_freshness(relative: list[dict[str, Any]], absolute: list[dict[str, Any]], roni: list[dict[str, Any]]) -> None:
    today = date.today()
    relative_age = (today - date.fromisoformat(relative[-1]["date"])).days
    absolute_age = (today - date.fromisoformat(absolute[-1]["date"])).days
    roni_age = (today - date.fromisoformat(roni[-1]["date"])).days
    if relative_age > 21:
        raise ValueError(f"relative_weekly: la ultima semana tiene {relative_age} dias de rezago")
    if absolute_age > 21:
        raise ValueError(f"absolute_weekly: la ultima semana tiene {absolute_age} dias de rezago")
    if roni_age > 100:
        raise ValueError(f"roni: la ultima temporada tiene {roni_age} dias de rezago")


def classify_roni(value: float) -> str:
    if value >= 0.5:
        return "warm"
    if value <= -0.5:
        return "cold"
    return "neutral"


def consecutive_seasons(records: list[dict[str, Any]]) -> int:
    latest_class = classify_roni(records[-1]["value"])
    if latest_class == "neutral":
        return 0
    count = 0
    for record in reversed(records):
        if classify_roni(record["value"]) != latest_class:
            break
        count += 1
    return count


def sha256(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def write_if_changed(path: Path, payload: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists() and path.read_bytes() == payload:
        return
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_bytes(payload)
    temporary.replace(path)


def json_bytes(value: Any) -> bytes:
    return (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode("utf-8")


def build_dataset(
    relative: list[dict[str, Any]],
    absolute: list[dict[str, Any]],
    roni: list[dict[str, Any]],
    hashes: dict[str, str],
) -> dict[str, Any]:
    absolute_by_date = {record["date"]: record for record in absolute}
    aligned_weekly: list[dict[str, Any]] = []
    for relative_record in relative:
        absolute_record = absolute_by_date.get(relative_record["date"])
        record: dict[str, Any] = {"date": relative_record["date"]}
        for region in REGIONS:
            record[region] = relative_record[region]
            if absolute_record:
                record[f"{region}_sst"] = absolute_record[f"{region}_sst"]
                record[f"{region}_anom"] = absolute_record[f"{region}_anom"]
        aligned_weekly.append(record)

    latest_week = aligned_weekly[-1]
    if not all(f"{region}_sst" in latest_week for region in REGIONS):
        raise ValueError("No existe una observacion SST absoluta para la ultima semana relativa")

    latest_roni = roni[-1]
    return {
        "meta": {
            "title": "Temperatura del mar y El Niño",
            "main_observation_date": latest_week["date"],
            "sources": {
                source.key: {
                    "url": source.url,
                    "sha256": hashes[source.key],
                    "latest_observation": (
                        relative[-1]["date"]
                        if source.key == "relative_weekly"
                        else absolute[-1]["date"]
                        if source.key == "absolute_weekly"
                        else latest_roni["date"]
                    ),
                }
                for source in SOURCES
            },
        },
        "current": {
            "weekly": latest_week,
            "roni": {
                **latest_roni,
                "classification": classify_roni(latest_roni["value"]),
                "consecutive_seasons": consecutive_seasons(roni),
            },
        },
        "weekly": aligned_weekly,
        "roni": roni,
    }


def main() -> int:
    try:
        payloads = {source.key: download(source) for source in SOURCES}
        decoded = {key: payload.decode("utf-8", errors="strict") for key, payload in payloads.items()}
        relative = parse_relative_weekly(decoded["relative_weekly"])
        absolute = parse_absolute_weekly(decoded["absolute_weekly"])
        roni = parse_roni(decoded["roni"])
        validate_freshness(relative, absolute, roni)
        hashes = {key: sha256(payload) for key, payload in payloads.items()}
        dataset = build_dataset(relative, absolute, roni, hashes)

        manifest = {
            "sources": {
                source.key: {
                    "url": source.url,
                    "file": f"data/raw/{source.filename}",
                    "sha256": hashes[source.key],
                    "bytes": len(payloads[source.key]),
                    "records": (
                        len(relative)
                        if source.key == "relative_weekly"
                        else len(absolute)
                        if source.key == "absolute_weekly"
                        else len(roni)
                    ),
                    "first_observation": (
                        relative[0]["date"]
                        if source.key == "relative_weekly"
                        else absolute[0]["date"]
                        if source.key == "absolute_weekly"
                        else roni[0]["date"]
                    ),
                    "latest_observation": dataset["meta"]["sources"][source.key]["latest_observation"],
                }
                for source in SOURCES
            }
        }

        for source in SOURCES:
            write_if_changed(RAW_DIR / source.filename, payloads[source.key])
        write_if_changed(OUTPUT_PATH, json_bytes(dataset))
        write_if_changed(MANIFEST_PATH, json_bytes(manifest))
        print(
            "Datos actualizados:",
            f"semana={relative[-1]['date']}",
            f"RONI={roni[-1]['season']} {roni[-1]['year']}",
        )
        return 0
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

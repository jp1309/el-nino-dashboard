#!/usr/bin/env python3
"""Validate tracked raw sources and the derived dashboard dataset."""

from __future__ import annotations

import json
import sys

import update_data


def main() -> int:
    try:
        manifest = json.loads(update_data.MANIFEST_PATH.read_text(encoding="utf-8"))
        dataset = json.loads(update_data.OUTPUT_PATH.read_text(encoding="utf-8"))

        parsed = {}
        for source in update_data.SOURCES:
            raw_path = update_data.RAW_DIR / source.filename
            payload = raw_path.read_bytes()
            expected = manifest["sources"][source.key]
            if update_data.sha256(payload) != expected["sha256"]:
                raise ValueError(f"Hash incorrecto para {source.key}")
            text = payload.decode("utf-8")
            parsed[source.key] = (
                update_data.parse_relative_weekly(text)
                if source.key == "relative_weekly"
                else update_data.parse_absolute_weekly(text)
                if source.key == "absolute_weekly"
                else update_data.parse_roni(text)
            )
            if len(parsed[source.key]) != expected["records"]:
                raise ValueError(f"Conteo incorrecto para {source.key}")

        if dataset["current"]["weekly"]["date"] != parsed["relative_weekly"][-1]["date"]:
            raise ValueError("La fecha principal no coincide con la fuente semanal")
        if dataset["current"]["roni"]["date"] != parsed["roni"][-1]["date"]:
            raise ValueError("El RONI actual no coincide con la fuente")
        if len(dataset["weekly"]) != len(parsed["relative_weekly"]):
            raise ValueError("La serie semanal publicada esta incompleta")
        if len(dataset["roni"]) != len(parsed["roni"]):
            raise ValueError("La serie RONI publicada esta incompleta")

        print(
            "Validacion correcta:",
            f"{len(dataset['weekly'])} semanas,",
            f"{len(dataset['roni'])} temporadas RONI",
        )
        return 0
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())


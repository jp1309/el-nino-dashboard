#!/usr/bin/env python3
"""Validate tracked raw sources and the derived dashboard dataset."""

from __future__ import annotations

import json
import sys

import update_data
import update_outlook
import update_spatial


def main() -> int:
    try:
        update_spatial.validate()
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
            expected_metadata = {
                "url": source.url, "file": f"data/raw/{source.filename}", "bytes": len(payload),
                "first_observation": parsed[source.key][0]["date"],
                "latest_observation": parsed[source.key][-1]["date"],
            }
            if any(expected.get(key) != value for key, value in expected_metadata.items()):
                raise ValueError(f"Metadatos incorrectos para {source.key}")

        rebuilt = update_data.build_dataset(
            parsed["relative_weekly"], parsed["absolute_weekly"], parsed["roni"],
            {key: source["sha256"] for key, source in manifest["sources"].items()},
        )
        if dataset != rebuilt:
            raise ValueError("Los valores publicados no coinciden con la reconstruccion de las fuentes")
        if update_outlook.OUTPUT.exists():
            outlook = json.loads(update_outlook.OUTPUT.read_text(encoding="utf-8"))
            rebuilt_outlook = update_outlook.build({source.key: (update_data.RAW_DIR / source.filename).read_bytes()
                                                   for source in (update_outlook.OUTLOOK, update_outlook.ADVISORY)})
            if outlook != rebuilt_outlook:
                raise ValueError("El pronostico publicado no coincide con sus fuentes originales")

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

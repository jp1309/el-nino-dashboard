#!/usr/bin/env python3
"""Require the public HTML and every release asset/data file to match the build."""
import argparse
import hashlib
import json
import time
import urllib.request
from pathlib import Path


def verify(base_url, expected, fetch):
    marker = json.loads(fetch("version.json"))
    if marker != expected:
        raise ValueError("La edicion publica no coincide con la preparada")
    for path, digest in [("index.html", expected["html_sha256"]),
                         *[(entry["path"], entry["sha256"]) for entry in expected["files"].values()]]:
        if hashlib.sha256(fetch(path)).hexdigest() != digest:
            raise ValueError(f"El archivo publico no coincide: {path}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", required=True)
    parser.add_argument("--site", type=Path, default=Path("_site"))
    parser.add_argument("--attempts", type=int, default=6)
    args = parser.parse_args()
    expected = json.loads((args.site / "version.json").read_text(encoding="utf-8"))
    def fetch(path):
        request = urllib.request.Request(args.url.rstrip("/") + "/" + path + f"?verify={time.time_ns()}",
                                         headers={"Cache-Control": "no-cache"})
        with urllib.request.urlopen(request, timeout=20) as response:
            return response.read()
    for attempt in range(args.attempts):
        try:
            verify(args.url, expected, fetch)
            print(f"Publicacion verificada: {expected['id'][:12]}; HTML y {len(expected['files'])} archivos exactos.")
            return 0
        except Exception as error:
            print(f"Intento {attempt + 1}: {error}", flush=True)
            if attempt + 1 < args.attempts:
                time.sleep(10)
    print("ERROR: no se pudo verificar la publicacion. Revisar el despliegue.")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())

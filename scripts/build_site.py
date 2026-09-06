#!/usr/bin/env python3
"""Build a release whose HTML, scripts and data refer to exact content hashes."""
from __future__ import annotations

import hashlib
import base64
import json
import re
import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ("styles.css", "analytics.js", "release.js", "monitor.js", "app.js")


def sha256(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def build(root: Path = ROOT, destination: Path | None = None) -> dict:
    destination = destination or root / "_site"
    destination.mkdir(parents=True, exist_ok=True)
    (destination / "assets").mkdir(exist_ok=True)
    shutil.copytree(root / "data", destination / "data", dirs_exist_ok=True)
    shutil.copyfile(root / "LICENSE", destination / "LICENSE")
    html = (root / "index.html").read_text(encoding="utf-8")
    files = {}
    for name in (*ASSETS, "data/enso.json", "data/outlook.json"):
        payload = (root / name).read_bytes()
        # Text assets are canonicalized across Windows and Linux checkouts.
        payload = payload.replace(b"\r\n", b"\n")
        digest = sha256(payload)
        source = Path(name)
        folder = "assets" if name in ASSETS else "data"
        path = f"{folder}/{source.stem}.{digest}{source.suffix}"
        (destination / path).write_bytes(payload)
        files[name] = {"path": path, "sha256": digest}
        if name in ASSETS:
            integrity = base64.b64encode(bytes.fromhex(digest)).decode()
            html, count = re.subn(r'((?:src|href)=")' + re.escape(name) + r'(?:\?[^"<>]*)?"',
                                  lambda match: match[1] + path + '" integrity="sha256-' + integrity + '"', html)
            if count != 1:
                raise ValueError(f"Se esperaba una referencia a {name}, recibidas {count}")
        else:
            # Downloads and displayed charts must use the same edition too.
            html = html.replace(f'href="{name}"', f'href="{path}"')
    manifest = {"files": files}
    manifest["id"] = sha256((html + json.dumps(files, sort_keys=True)).encode())
    marker = '<script id="releaseManifest" type="application/json">{}</script>'
    if marker not in html:
        raise ValueError("No se encuentra el manifiesto de publicacion en HTML")
    html = html.replace(marker, '<script id="releaseManifest" type="application/json">'
                        + json.dumps(manifest, separators=(",", ":")) + '</script>')
    (destination / "index.html").write_text(html, encoding="utf-8", newline="\n")
    manifest["html_sha256"] = sha256((destination / "index.html").read_bytes())
    (destination / "version.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8", newline="\n")
    (destination / ".nojekyll").touch()
    return manifest


if __name__ == "__main__":
    # Publish only a dataset that can be rebuilt exactly from the saved sources.
    subprocess.run([__import__("sys").executable, str(ROOT / "scripts/validate_data.py")], check=True)
    release = build()
    print(f"Edicion preparada: {release['id'][:12]}; {len(release['files'])} archivos verificados")

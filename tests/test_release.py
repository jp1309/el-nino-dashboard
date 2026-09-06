import json
import tempfile
import unittest
from pathlib import Path
from scripts import build_site, verify_publication


class ReleaseTests(unittest.TestCase):
    def test_build_is_deterministic_and_verifier_rejects_stale_public_data(self):
        with tempfile.TemporaryDirectory() as directory:
            destination=Path(directory)
            release=build_site.build(destination=destination)
            self.assertEqual(release,build_site.build(destination=destination))
            fetch=lambda path:(destination/path).read_bytes()
            verify_publication.verify('https://example.test/',release,fetch)
            enso=release['files']['data/enso.json']['path']
            original=(destination/enso).read_bytes()
            (destination/enso).write_bytes(b'{"current":{"roni":{"value":0.98}}}')
            with self.assertRaisesRegex(ValueError,'archivo publico no coincide'):
                verify_publication.verify('https://example.test/',release,fetch)
            (destination/enso).write_bytes(original)
            (destination/'index.html').write_text('old page')
            with self.assertRaisesRegex(ValueError,'index.html'):
                verify_publication.verify('https://example.test/',release,fetch)

    def test_manifest_and_download_are_bound_to_content_named_files(self):
        with tempfile.TemporaryDirectory() as directory:
            destination=Path(directory)
            release=build_site.build(destination=destination)
            html=(destination/'index.html').read_text(encoding='utf-8')
            self.assertIn(release['id'],html)
            for entry in release['files'].values():
                self.assertIn(entry['sha256'],entry['path'])
                self.assertIn(entry['path'],html)
            self.assertIn('integrity="sha256-',html)
            self.assertNotIn('href="data/outlook.json"',html)

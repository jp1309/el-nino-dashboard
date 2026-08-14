import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class TranslationContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = (ROOT / "app.js").read_text(encoding="utf-8")
        cls.html = (ROOT / "index.html").read_text(encoding="utf-8")
        translation_block = cls.app.split("const TRANSLATIONS = {", 1)[1].split("\n};", 1)[0]
        cls.es_block, cls.en_block = translation_block.split("\n  en: {", 1)

    @staticmethod
    def translation_keys(block):
        return set(re.findall(r"\b([A-Za-z][A-Za-z0-9]*):\s*\"", block))

    def test_both_languages_have_the_same_keys(self):
        self.assertEqual(self.translation_keys(self.es_block), self.translation_keys(self.en_block))

    def test_static_translation_attributes_have_copy(self):
        html_keys = set(re.findall(r'data-i18n(?:-html|-aria-label)?="([A-Za-z0-9]+)"', self.html))
        missing = html_keys - self.translation_keys(self.es_block)
        self.assertEqual(missing, set(), f"Faltan traducciones estáticas: {sorted(missing)}")

    def test_runtime_translation_calls_have_copy(self):
        runtime_keys = set(re.findall(r'(?<![\w.])t\("([A-Za-z0-9]+)"', self.app))
        missing = runtime_keys - self.translation_keys(self.es_block)
        self.assertEqual(missing, set(), f"Faltan traducciones dinámicas: {sorted(missing)}")

    def test_language_switch_is_shareable(self):
        self.assertIn('id="languageToggle"', self.html)
        self.assertIn('params.set("lang", state.language)', self.app)


if __name__ == "__main__":
    unittest.main()

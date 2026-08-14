import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class DashboardStructureTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html = (ROOT / "index.html").read_text(encoding="utf-8")
        cls.app = (ROOT / "app.js").read_text(encoding="utf-8")
        cls.styles = (ROOT / "styles.css").read_text(encoding="utf-8")

    def test_weekly_chart_is_the_first_content_section(self):
        main = self.html.split('<main id="contenido"', 1)[1]
        self.assertLess(main.index('class="panel pulse-panel"'), main.index('class="route-section"'))
        self.assertIn('id="weeklyUpdated"', main)

    def test_removed_hero_has_no_remaining_contract(self):
        self.assertNotIn('class="hero', self.html)
        self.assertNotIn("renderHeadline", self.app)
        self.assertNotIn(".hero", self.styles)

    def test_long_term_chart_identifies_nino_34(self):
        history = self.html.split('class="panel history-panel"', 1)[1].split('</section>', 1)[0]
        self.assertGreaterEqual(history.count("Niño 3.4"), 4)
        self.assertIn("Niño 3.4 region · three-month average", self.app)

    def test_long_term_chart_defaults_to_1990(self):
        self.assertIn("state.roniStartYear ?? 1990", self.app)
        self.assertIn('populateYearSelect("#roniStartYear", roniYears', self.app)


if __name__ == "__main__":
    unittest.main()

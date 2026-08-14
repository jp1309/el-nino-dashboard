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

    def test_weekly_chart_defaults_to_2017(self):
        self.assertIn("state.weeklyStartYear ?? 2017", self.app)
        self.assertIn('populateYearSelect("#weeklyStartYear", weeklyYears', self.app)

    def test_all_charts_use_half_degree_y_axis_steps(self):
        self.assertIn("stepSize: 0.5", self.app)
        self.assertIn("autoSkip: false", self.app)
        self.assertEqual(self.app.count("ticks: temperatureAxisTicks()"), 3)

    def test_all_charts_share_the_same_five_temperature_bands(self):
        self.assertEqual(self.app.count("plugins: [zonePlugin]"), 3)
        self.assertEqual(self.app.count("ensoZones: { enabled: true }"), 3)
        self.assertIn('pixelForValue(1.5)', self.app)
        self.assertIn('pixelForValue(-1.5)', self.app)
        self.assertIn('"rgba(255, 255, 255, 1)"', self.app)
        self.assertIn('"rgba(211, 60, 47, .16)"', self.app)
        self.assertIn('"rgba(15, 91, 143, .16)"', self.app)

    def test_region_map_follows_the_third_chart(self):
        history = self.html.index('class="panel history-panel"')
        region_map = self.html.index('class="panel map-panel"')
        method = self.html.index('class="method"')
        self.assertLess(history, region_map)
        self.assertLess(region_map, method)
        self.assertEqual(self.html.count('class="map-zone map-zone-'), 4)
        self.assertIn('data-i18n-aria-label="mapAria"', self.html)


if __name__ == "__main__":
    unittest.main()

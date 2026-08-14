import unittest

from scripts import update_data


class ParserTests(unittest.TestCase):
    def test_week_date_is_locale_independent(self):
        self.assertEqual(update_data.parse_week_date("13AUG2026").isoformat(), "2026-08-13")

    def test_roni_classification_thresholds(self):
        self.assertEqual(update_data.classify_roni(0.5), "warm")
        self.assertEqual(update_data.classify_roni(0.49), "neutral")
        self.assertEqual(update_data.classify_roni(-0.5), "cold")

    def test_absolute_fixed_width_values(self):
        rows = ["Weekly SST data", " 02SEP1981     20.6-0.1     24.8-0.1     26.5-0.2     28.3-0.3"]
        with self.assertRaisesRegex(ValueError, "solo se encontraron"):
            update_data.parse_absolute_weekly("\n".join(rows))


if __name__ == "__main__":
    unittest.main()


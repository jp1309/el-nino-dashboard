import unittest

from scripts import update_data


class ParserTests(unittest.TestCase):
    def test_download_cannot_replace_august_roni_with_july(self):
        current = {"weekly": [{"date":"1981-09-09"},{"date":"2026-08-26"}],
                   "roni": [{"date":"1950-01-15"},{"date":"2026-07-15", "value":1.36}]}
        proposed = {**current, "roni": [{"date":"1950-01-15"},{"date":"2026-06-15", "value":.98}]}
        with self.assertRaisesRegex(ValueError,"retrocede"):
            update_data.validate_no_regression(proposed,current)
        # A revision of the same season is legitimate and must remain accepted.
        proposed["roni"][-1] = {"date":"2026-07-15", "value":1.35}
        update_data.validate_no_regression(proposed,current)

    def test_weekly_gaps_are_rejected(self):
        with self.assertRaisesRegex(ValueError, "semanas ausentes"):
            update_data.validate_series([{"date":"2026-01-01"},{"date":"2026-01-15"}], "relative_weekly", 2)

    def test_roni_gaps_are_rejected(self):
        with self.assertRaisesRegex(ValueError, "trimestres ausentes"):
            update_data.validate_series([{"date":"2026-01-15"},{"date":"2026-03-15"}], "roni", 2)

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

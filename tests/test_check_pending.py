import json
import unittest
from datetime import date, datetime
from pathlib import Path
from unittest.mock import patch

from scripts import check_pending


class PendingCheckTests(unittest.TestCase):
    def test_monthly_roni_can_be_pending_with_current_weekly_data(self):
        manifest = {"sources": {
            "relative_weekly": {"latest_observation": "2026-09-02"},
            "absolute_weekly": {"latest_observation": "2026-09-02"},
            "roni": {"latest_observation": "2026-06-15"},
        }}
        run_time = datetime(2026, 9, 7, 8, tzinfo=check_pending.EASTERN)
        with patch.object(Path, "read_text", return_value=json.dumps(manifest)):
            self.assertTrue(check_pending.is_pending(now=run_time))
        manifest["sources"]["roni"]["latest_observation"] = "2026-07-15"
        with patch.object(Path, "read_text", return_value=json.dumps(manifest)):
            self.assertFalse(check_pending.is_pending(now=run_time))

    def test_previous_wednesday_for_monday(self):
        self.assertEqual(
            check_pending.previous_wednesday(date(2026, 8, 24)),
            date(2026, 8, 19),
        )

    def test_previous_wednesday_for_tuesday_in_another_week(self):
        self.assertEqual(
            check_pending.previous_wednesday(date(2026, 9, 1)),
            date(2026, 8, 26),
        )

    def test_missing_manifest_is_pending(self):
        missing = Path("missing-source-manifest.json")
        with patch.object(Path, "read_text", side_effect=OSError("archivo ausente")):
            self.assertTrue(check_pending.is_pending(missing))

    def test_both_weekly_sources_must_reach_target(self):
        manifest = {
            "sources": {
                "relative_weekly": {"latest_observation": "2026-08-19"},
                "absolute_weekly": {"latest_observation": "2026-08-12"},
            }
        }
        run_time = datetime(2026, 8, 24, 8, tzinfo=check_pending.EASTERN)
        with patch.object(Path, "read_text", return_value=json.dumps(manifest)):
            self.assertTrue(check_pending.is_pending(now=run_time))


if __name__ == "__main__":
    unittest.main()

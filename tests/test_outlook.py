import json
import unittest
from datetime import date
from unittest.mock import patch
from scripts import update_outlook as outlook


class OutlookTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html = (outlook.data.RAW_DIR / outlook.OUTLOOK.filename).read_text(encoding="utf-8")

    def test_snapshot_rebuild_and_percentiles(self):
        payloads = {source.key: (outlook.data.RAW_DIR / source.filename).read_bytes() for source in (outlook.OUTLOOK, outlook.ADVISORY)}
        self.assertEqual(outlook.build(payloads), json.loads(outlook.OUTPUT.read_text(encoding="utf-8")))
        parsed = outlook.parse_outlook(self.html)
        self.assertEqual(len(parsed["seasons"]), 9)
        for row in parsed["seasons"]:
            self.assertLessEqual(row["p5"], row["p25"])
            self.assertLessEqual(row["p25"], row["p50"])
            self.assertLessEqual(row["p50"], row["p75"])
            self.assertLessEqual(row["p75"], row["p95"])

    def test_rejects_removed_table_and_unrecognized_advisory(self):
        with self.assertRaises(ValueError):
            outlook.parse_outlook(self.html.replace('id="outlook-table"', 'id="changed"'))
        with self.assertRaises(ValueError):
            outlook.parse_advisory('13 August 2026 ENSO Alert System Status: Unknown Synopsis: Test')

    def test_rejects_unsorted_or_missing_percentiles(self):
        import re
        bad = re.sub(r'<td>[-\d.]+</td>', '<td>5.9</td>', self.html, count=1)
        with self.assertRaises(ValueError):
            outlook.parse_outlook(bad)

    def test_monthly_gate_waits_for_second_thursday(self):
        with patch.object(outlook.Path, 'read_text', return_value='{"issued_month":"2026-08"}'):
            self.assertFalse(outlook.due(date(2026,9,9)))
            self.assertTrue(outlook.due(date(2026,9,10)))

    def test_forecast_year_rollover(self):
        parsed = outlook.parse_outlook(self.html)
        for previous, current in zip(parsed['seasons'], parsed['seasons'][1:]):
            before = previous['year'] * 12 + int(previous['date'][5:7])
            after = current['year'] * 12 + int(current['date'][5:7])
            self.assertEqual(after-before,1)

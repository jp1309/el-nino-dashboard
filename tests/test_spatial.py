import io
import json
import unittest
from datetime import date

import numpy as np
from scripts import update_spatial as S


class SpatialTests(unittest.TestCase):
    def test_leap_day_and_cross_year_week_climatology(self):
        clim=np.arange(365,dtype=float)[:,None,None]
        self.assertEqual(S.day_clim(clim,date(2024,2,29)).item(),58.5)
        self.assertEqual(S.day_clim(clim,date(2024,3,1)).item(),59)
        self.assertEqual(S.week_clim(clim,date(2025,12,28)).item(),sum([361,362,363,364,0,1,2])/7)

    def test_tropical_mean_uses_all_longitudes_area_weights_and_ignores_land(self):
        a=np.zeros((60,360));a[:,180:]=2
        a[np.abs(S.LAT)>=20]=999
        self.assertAlmostEqual(S.tropical_mean(a),1)
        a[:,180:]=np.nan
        self.assertEqual(S.tropical_mean(a),0)
        self.assertAlmostEqual(S.area_mean(np.array([[0.],[10.]]),lat=np.array([0.,60.])),10/3)

    def test_relative_adjustment_removes_uniform_background_and_preserves_missing(self):
        a=np.ones((60,360))*2;a[0,0]=np.nan
        r=S.relative_field(a,np.ones((60,360))*1.5)
        self.assertTrue(np.isnan(r[0,0]))
        np.testing.assert_allclose(r[np.isfinite(r)],0,atol=1e-12)
        a[30,200]=4
        self.assertAlmostEqual(S.relative_field(a,np.ones((60,360))*1.5)[30,200],(4-S.tropical_mean(a))*1.5)

    def test_public_map_rebuilds_exactly_and_preserves_dates_and_land(self):
        result=S.validate()
        self.assertEqual(len(result['frames']),13)
        with np.load(S.RAW) as a:
            f=result['frames'][-1]
            self.assertEqual((date.fromisoformat(f['center'])-date.fromisoformat(f['start'])).days,3)
            self.assertEqual((date.fromisoformat(f['end'])-date.fromisoformat(f['start'])).days,6)
            finite=np.isfinite(a['sst'][-1,:,S.PACIFIC])
            self.assertEqual(sum(v is not None for v in f['sst']),finite.sum())
            self.assertEqual(result['raw_sha256'],S.digest(S.RAW.read_bytes()))

    def test_invalid_grid_and_inconsistent_variance_are_rejected(self):
        with np.load(S.RAW) as a: arrays={k:a[k] for k in a.files}
        meta=json.loads(S.META.read_text())
        arrays['scale']=arrays['scale']*2
        with self.assertRaisesRegex(ValueError,'factor'):
            S.build(S.archive(**arrays),meta)
        arrays['lat']=arrays['lat'][::-1]
        with self.assertRaisesRegex(ValueError,'Coordenadas'):
            S.build(S.archive(**arrays),meta)

    def test_independent_official_indices_detect_wrong_spatial_or_temporal_values(self):
        result=S.validate()
        report=S.compare_cpc(result)
        self.assertGreater(report['sst']['pairs'],0)
        for frame in result['frames']:
            for region in frame['regions']:frame['regions'][region]['sst']+=2
        with self.assertRaisesRegex(ValueError,'indices CPC'):
            S.compare_cpc(result)


if __name__=='__main__':unittest.main()

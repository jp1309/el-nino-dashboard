import io
import json
import tempfile
import unittest
import zipfile
from unittest import mock
from datetime import date
from pathlib import Path

import numpy as np
from scripts import update_spatial as S


class SpatialTests(unittest.TestCase):
    def test_archive_is_stable_across_operating_systems_and_roundtrips_exactly(self):
        with np.load(S.RAW) as a: arrays={k:a[k] for k in a.files}
        encoded=S.archive(**arrays)
        self.assertEqual(encoded,S.RAW.read_bytes())
        with zipfile.ZipFile(io.BytesIO(encoded)) as bundle:
            self.assertTrue(all(entry.create_system==3 and entry.date_time==(1980,1,1,0,0,0) for entry in bundle.infolist()))

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
        with np.load(S.RAW) as a:
            self.assertEqual(len(result['frames']),len(a['starts']))
            self.assertLessEqual(len(result['frames']),S.WEEKS)
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

    def test_expected_week_requires_a_complete_sunday_to_saturday_week(self):
        # 2026-11-01 (Sunday) to 2026-11-07 (Saturday), centered on 2026-11-04.
        self.assertEqual(S.expected_center(date(2026,11,7)),date(2026,10,28))
        self.assertEqual(S.expected_center(date(2026,11,8)),date(2026,11,4))
        self.assertEqual(S.expected_center(date(2026,11,9)),date(2026,11,4))
        self.assertEqual(S.expected_center(date(2026,11,14)),date(2026,11,4))
        self.assertEqual(S.expected_center(date(2027,1,3)),date(2026,12,30))

    def test_if_due_skips_download_only_when_map_holds_latest_week(self):
        with tempfile.TemporaryDirectory() as tmp:
            path=Path(tmp)/'spatial.json'
            self.assertTrue(S.is_due(date(2026,11,9),path))
            path.write_text('{"frames": []}',encoding='utf-8')
            self.assertTrue(S.is_due(date(2026,11,9),path))
            year=lambda last:[{'center':'2025-01-01'}]*(S.WEEKS-1)+[{'center':last}]
            path.write_text(json.dumps({'frames':year('2026-10-28')}),encoding='utf-8')
            self.assertTrue(S.is_due(date(2026,11,9),path))
            self.assertFalse(S.is_due(date(2026,11,7),path))
            path.write_text(json.dumps({'frames':year('2026-11-04')}),encoding='utf-8')
            self.assertFalse(S.is_due(date(2026,11,9),path))
            self.assertTrue(S.is_due(date(2026,11,15),path))
            # A shorter history is completed even when the latest week is present.
            path.write_text(json.dumps({'frames':year('2026-11-04')[-13:]}),encoding='utf-8')
            self.assertTrue(S.is_due(date(2026,11,9),path))

    def test_fileserver_reader_masks_and_decodes_exactly_like_netcdf4(self):
        import h5py
        from netCDF4 import Dataset
        values=np.array([[25.5,-9.96921e36,46.0],[-4.0,28.25,9.96921e36]],dtype=np.float32)
        with tempfile.TemporaryDirectory() as tmp:
            path=Path(tmp)/'sst.nc'
            with Dataset(path,'w') as d:
                d.createDimension('y',2);d.createDimension('x',3)
                v=d.createVariable('sst','f4',('y','x'),fill_value=False)
                v.missing_value=np.float32(-9.96921e36);v.valid_range=np.array([-3,45],dtype=np.float32)
                v.set_auto_maskandscale(False);v[:]=values
            for key in (np.s_[:], np.s_[:,::2]):
                with Dataset(path) as d: expected=d.variables['sst'][key]
                with h5py.File(path,'r') as f: actual=S.H5Variable(f['sst'])[key]
                np.testing.assert_array_equal(actual.mask,expected.mask)
                np.testing.assert_array_equal(actual.filled(np.nan),expected.filled(np.nan))
        # Strided read: 46 °C and -4 °C fall outside valid_range; the default netCDF fill is masked too.
        np.testing.assert_array_equal(actual.mask,[[False,True],[True,True]])

    def test_opendap_refusal_falls_back_to_fileserver_but_data_errors_do_not(self):
        calls=[]
        def fake(opener):
            calls.append(opener)
            if opener is S.opendap_dataset: raise OSError('NetCDF: Access failure (429)')
            return 'leido por fileServer'
        with mock.patch.object(S,'_fetch_inputs',fake):
            self.assertEqual(S.fetch_inputs(),'leido por fileServer')
        self.assertEqual(calls,[S.opendap_dataset,S.FileServerDataset])
        def invalid(opener): raise ValueError('La cuadrícula NOAA ha cambiado')
        with mock.patch.object(S,'_fetch_inputs',invalid):
            with self.assertRaisesRegex(ValueError,'cuadrícula'): S.fetch_inputs()

    def test_range_reader_backs_off_on_rate_limit_and_reads_exact_bytes(self):
        import urllib.error
        payload=bytes(range(256))*40
        class Response:
            status=206
            def __init__(self,start,end): self.data=payload[start:end+1];self.headers={'Content-Range':f'bytes {start}-{end}/{len(payload)}'}
            def read(self): return self.data
            def __enter__(self): return self
            def __exit__(self,*a): return False
        refusals=[urllib.error.HTTPError('u',429,'Too Many Requests',{},None) for _ in range(2)]
        def urlopen(request,timeout):
            if refusals: raise refusals.pop()
            start,end=map(int,request.get_header('Range').split('=')[1].split('-'))
            return Response(start,end)
        sleeps=[]
        with mock.patch('urllib.request.urlopen',urlopen), mock.patch.object(S.time,'sleep',sleeps.append):
            f=S.RangeFile('https://psl.noaa.gov/thredds/fileServer/x.nc',block=1024)
            self.assertEqual(sleeps,[15,30])
            self.assertEqual(f.size,len(payload))
            reader=io.BufferedReader(f,buffer_size=512)
            reader.seek(1000);self.assertEqual(reader.read(100),payload[1000:1100])
            reader.seek(0);self.assertEqual(reader.read(),payload)

    def test_fileserver_reads_the_same_psl_files_only(self):
        self.assertEqual(S.FILESERVER+S.WEEKLY[len(S.DODS):],
                         'https://psl.noaa.gov/thredds/fileServer/Datasets/noaa.oisst.v2.highres/sst.week.mean.nc')
        with self.assertRaisesRegex(ValueError,'PSL'): S.FileServerDataset('https://example.com/sst.nc')

    def test_independent_official_indices_detect_wrong_spatial_or_temporal_values(self):
        result=S.validate()
        report=S.compare_cpc(result)
        self.assertGreater(report['sst']['pairs'],0)
        for frame in result['frames']:
            for region in frame['regions']:frame['regions'][region]['sst']+=2
        with self.assertRaisesRegex(ValueError,'indices CPC'):
            S.compare_cpc(result)


if __name__=='__main__':unittest.main()

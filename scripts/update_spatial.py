#!/usr/bin/env python3
"""Reproducible OISST map; sampled grid and independent relative calculation.

PSL weekly time is Sunday (verified against seven daily OISST fields).
The reference is deliberately fixed to 1991-2020, including variance scaling.
This is an independent reconstruction, not CPC's operational raster.
"""
from __future__ import annotations

import hashlib
import io
import json
import sys
import warnings
from datetime import date, timedelta
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / 'data/raw/spatial.npz'
META = ROOT / 'data/raw/spatial_metadata.json'
OUTPUT = ROOT / 'data/spatial.json'
CACHE = ROOT / '.cache/spatial'
BASE = 'https://psl.noaa.gov/thredds/dodsC/Datasets/noaa.oisst.v2.highres/'
WEEKLY = BASE + 'sst.week.mean.nc'
CLIM = BASE + 'sst.day.mean.ltm.1991-2020.nc'
VERSION = 1
LAT = np.arange(-29.875, 30, 1, dtype=np.float64)
LON = np.arange(.125, 360, 1, dtype=np.float64)
PACIFIC = (LON >= 120) & (LON < 290)
REGIONS = {'nino12': (-10, 0, 270, 280), 'nino3': (-5, 5, 210, 270),
           'nino34': (-5, 5, 190, 240), 'nino4': (-5, 5, 160, 210)}


def digest(payload):
    return hashlib.sha256(payload).hexdigest()


def archive(**arrays):
    stream = io.BytesIO()
    np.savez_compressed(stream, **arrays)
    return stream.getvalue()


def json_bytes(obj):
    return (json.dumps(obj, ensure_ascii=False, separators=(',', ':'), allow_nan=False) + '\n').encode()


def write(path, payload):
    if not path.exists() or path.read_bytes() != payload:
        path.parent.mkdir(parents=True, exist_ok=True)
        temp = path.with_suffix(path.suffix + '.tmp')
        temp.write_bytes(payload)
        temp.replace(path)


def day_clim(clim, d):
    # A 365-day reference: interpolate February 29 explicitly.
    if d.month == 2 and d.day == 29:
        return (clim[58] + clim[59]) / 2
    return clim[(date(2001, d.month, d.day) - date(2001, 1, 1)).days]


def week_clim(clim, start):
    return np.mean([day_clim(clim, start + timedelta(days=i)) for i in range(7)], axis=0)


def area_mean(field, lat=LAT, selection=None):
    mask = np.isfinite(field)
    if selection is not None:
        mask &= selection
    weights = np.broadcast_to(np.cos(np.deg2rad(lat))[:, None], field.shape)
    total = np.sum(np.where(mask, weights, 0))
    if total == 0:
        return float('nan')
    return float(np.sum(np.where(mask, field, 0) * weights) / total)


def tropical_mean(field):
    return area_mean(field, selection=np.broadcast_to((np.abs(LAT) < 20)[:, None], field.shape))


def relative_field(anomaly, scale):
    return (anomaly - tropical_mean(anomaly)) * scale


def encoded(field):
    return [int(round(float(v) * 100)) if np.isfinite(v) else None for v in field[:, PACIFIC].ravel()]


def build(raw, metadata):
    if metadata['algorithm_version'] != VERSION or metadata['reference_period'] != '1991-2020' or metadata['weekly_url'] != WEEKLY or metadata['climatology_url'] != CLIM:
        raise ValueError('Version del calculo espacial incompatible')
    with np.load(io.BytesIO(raw), allow_pickle=False) as a:
        sst, clim, scale = a['sst'], a['clim'], a['scale']
        dates = [date.fromisoformat(str(v)) for v in a['starts']]
        if not np.array_equal(a['lat'], LAT) or not np.array_equal(a['lon'], LON):
            raise ValueError('Coordenadas inesperadas')
        if not 1 <= len(dates) <= 13 or sst.shape != (len(dates), 60, 360) or clim.shape != sst.shape or scale.shape != (60, 360):
            raise ValueError('Dimensiones espaciales invalidas')
        if any(d.weekday() != 6 for d in dates) or any((b-a).days != 7 for a,b in zip(dates,dates[1:])):
            raise ValueError('Semanas incompletas o fuera de orden')
        if np.nanmin(sst) < -3 or np.nanmax(sst) > 45 or np.nanmin(scale) <= 0 or np.nanmax(scale) > 10:
            raise ValueError('Temperaturas o factores fuera de rango')
        if not np.allclose(scale, a['sd_anom']/a['sd_residual'], equal_nan=True, rtol=1e-6):
            raise ValueError('El factor no coincide con las desviaciones de referencia')
        frames = []
        for i,start in enumerate(dates):
            anomaly = sst[i] - clim[i]
            relative = relative_field(anomaly, scale)
            if not np.array_equal(np.isfinite(sst[i]), np.isfinite(clim[i])):
                raise ValueError('Mascaras de observacion y climatologia distintas')
            if np.isfinite(relative[:, PACIFIC]).sum() < 7000:
                raise ValueError('Cobertura oceanica insuficiente')
            if np.nanmax(np.abs(anomaly)) > 15 or np.nanmax(np.abs(relative)) > 15:
                raise ValueError('Anomalia espacial fuera de rango')
            fields = {'sst': sst[i], 'anom': anomaly, 'relative': relative}
            regions = {}
            for key,(south,north,west,east) in REGIONS.items():
                selection = ((LAT[:,None] >= south) & (LAT[:,None] <= north) & (LON[None,:] >= west) & (LON[None,:] <= east))
                regions[key] = {m: round(area_mean(v, selection=selection), 2) for m,v in fields.items()}
            frames.append({'start': start.isoformat(), 'end': (start+timedelta(days=6)).isoformat(),
                           'center': (start+timedelta(days=3)).isoformat(),
                           'tropical_anomaly': round(tropical_mean(anomaly), 3), 'regions': regions,
                           **{m: encoded(v) for m,v in fields.items()}})
        return {'schema': VERSION, 'units': 'degC', 'encoding_scale': .01,
                'grid': {'lat0': float(LAT[0]), 'lon0': float(LON[PACIFIC][0]), 'step': 1, 'rows': 60, 'cols': 170},
                'baseline': '1991-2020', 'method': 'sampled_oisst_independent_relative',
                'raw_sha256': digest(raw), 'sources': metadata, 'frames': frames}


def fetch_inputs():
    from netCDF4 import Dataset, num2date
    CACHE.mkdir(parents=True, exist_ok=True)
    def blocks(dataset, start, stop, label):
        parts=[]
        for first in range(start,stop,12):
            last=min(first+12,stop)
            cached=CACHE/f'{label}-{first}-{last}.npz'
            if cached.exists():
                with np.load(cached) as a: part=a['values']
            else:
                part=np.ma.filled(dataset.variables['sst'][first:last,240:480:4,::4],np.nan)
                write(cached,archive(values=part))
            parts.append(part)
            if (first-start)%120==0: print(f'{label}: {last-start}/{stop-start}',flush=True)
        return np.concatenate(parts)
    with Dataset(CLIM) as d:
        if d.variables['time'].climo_period != '1991/01/01 - 2020/12/31':
            raise ValueError('Climatologia distinta de 1991-2020')
        cache = CACHE / 'clim-1991-2020.npz'
        if cache.exists():
            with np.load(cache) as a: climatology = a['clim']
        else:
            climatology = blocks(d,0,365,'climatology')
            write(cache, archive(clim=climatology))
        if climatology.shape != (365,60,360):
            raise ValueError('Climatologia incompleta')
    with Dataset(WEEKLY) as d:
        if not np.array_equal(d.variables['lat'][240:480:4],LAT) or not np.array_equal(d.variables['lon'][::4],LON):
            raise ValueError('La cuadrícula NOAA ha cambiado')
        times = d.variables['time']
        dates = [date(t.year,t.month,t.day) for t in num2date(times[:],times.units)]
        # Require complete Sunday-Saturday weeks, even if a partial week appears upstream.
        valid = [i for i,t in enumerate(dates) if t+timedelta(days=6) < date.today()]
        last = valid[-1]
        starts = dates[last-12:last+1]
        if (date.today()-starts[-1]).days > 28:
            raise ValueError('La fuente espacial tiene mas de 28 dias de rezago')
        print('Descargando 13 semanas OISST...', flush=True)
        sst = np.ma.filled(d.variables['sst'][last-12:last+1,240:480:4,::4],np.nan)
        ref_cache = CACHE / 'reference-v1.npz'
        if RAW.exists() and META.exists() and '--rebuild-reference' not in sys.argv:
            previous=json.loads(META.read_text(encoding='utf-8'))
            if previous['algorithm_version'] != VERSION or previous['climatology_sample_sha256'] != digest(climatology.astype('<f4').tobytes()):
                raise ValueError('La referencia ha cambiado; requiere recalibracion explicita')
            with np.load(RAW) as a: sd_a,sd_r=a['sd_anom'],a['sd_residual']
            history_hash,count=previous['reference_sst_sha256'],previous['reference_weeks']
        elif ref_cache.exists() and '--rebuild-reference' not in sys.argv:
            with np.load(ref_cache) as a:
                sd_a,sd_r,history_hash,count = a['sd_anom'],a['sd_residual'],str(a['history_sha256']),int(a['count'])
        else:
            ids = [i for i,t in enumerate(dates) if 1991 <= (t+timedelta(days=3)).year <= 2020]
            print('Calculando referencia de variabilidad 1991-2020 (una sola vez)...', flush=True)
            history = blocks(d,ids[0],ids[-1]+1,'reference-1991-2020')
            history_hash = digest(history.astype('<f4').tobytes())
            count = len(ids)
            for j,i in enumerate(ids): history[j] -= week_clim(climatology,dates[i])
            with warnings.catch_warnings():
                warnings.simplefilter('ignore',RuntimeWarning)
                sd_a = np.nanstd(history,axis=0,ddof=1)
                for j in range(count): history[j] -= tropical_mean(history[j])
                sd_r = np.nanstd(history,axis=0,ddof=1)
            write(ref_cache,archive(sd_anom=sd_a,sd_residual=sd_r,history_sha256=history_hash,count=count))
    with np.errstate(invalid='ignore',divide='ignore'):
        scale = sd_a / sd_r
    raw = archive(sst=sst,clim=np.stack([week_clim(climatology,t) for t in starts]),
                  lat=LAT,lon=LON,starts=np.array([t.isoformat() for t in starts]),
                  scale=scale,sd_anom=sd_a,sd_residual=sd_r)
    metadata = {'algorithm_version':VERSION,'weekly_url':WEEKLY,'climatology_url':CLIM,
                'native_resolution_degrees':.25,'sample_stride':4,
                'subset':'sst[time][240:4:479][0:4:1439]; tropical mean uses all longitudes, 20S-20N, cosine latitude weights',
                'reference_period':'1991-2020','reference_weeks':count,'reference_sst_sha256':history_hash,
                'climatology_sample_sha256':digest(climatology.astype('<f4').tobytes()),
                'relative_formula':'(SST - weekly_climatology - tropical_mean_anomaly) * sd_anomaly / sd_residual',
                'reference_note':'Independent variance calibration using weeks centered in 1991-2020; not the CPC operational raster.'}
    return raw,metadata


def validate():
    raw,metadata = RAW.read_bytes(),json.loads(META.read_text(encoding='utf-8'))
    rebuilt = build(raw,metadata)
    if json.loads(OUTPUT.read_text(encoding='utf-8')) != rebuilt:
        raise ValueError('El mapa no coincide con sus extractos NOAA')
    compare_cpc(rebuilt)
    return rebuilt


def compare_cpc(result):
    """Independent spatial/time sanity check against official area indices.

    Tolerances allow a sampled grid, rounded CPC values and independent variance
    calibration. They never calibrate or replace any map value.
    """
    rows={r['date']:r for r in json.loads((ROOT/'data/enso.json').read_text(encoding='utf-8'))['weekly']}
    report={}
    for metric in ['sst','anom','relative']:
        differences=[]
        for frame in result['frames']:
            if frame['center'] not in rows: continue
            for region in REGIONS:
                key=region if metric=='relative' else f'{region}_{metric}'
                official=rows[frame['center']].get(key)
                if official is not None:
                    differences.append(abs(frame['regions'][region][metric]-official))
        if differences:
            report[metric]={'pairs':len(differences),'mean_absolute_difference':round(float(np.mean(differences)),3),'max_absolute_difference':round(max(differences),3)}
            if max(differences) > (.6 if metric=='relative' else .4):
                raise ValueError(f'El campo espacial no concuerda con los indices CPC: {metric}')
    return report


def main():
    if '--validate' in sys.argv:
        result = validate()
    else:
        raw,metadata = fetch_inputs()
        result = build(raw,metadata)
        compare_cpc(result)
        if OUTPUT.exists():
            previous = json.loads(OUTPUT.read_text(encoding='utf-8'))
            if result['frames'][-1]['center'] < previous['frames'][-1]['center']:
                raise ValueError('La fuente espacial retrocede de semana')
        # No canonical write until every downloaded field and derived value passes.
        write(RAW,raw); write(META,json_bytes(metadata)); write(OUTPUT,json_bytes(result))
    print(f"Mapa validado: {len(result['frames'])} semanas; ultima {result['frames'][-1]['center']}")


if __name__ == '__main__':
    try: main()
    except Exception as exc:
        print(f'ERROR mapa: {exc}',file=sys.stderr)
        sys.exit(1)

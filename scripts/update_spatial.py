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
import time
import warnings
import zipfile
from datetime import date, timedelta
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / 'data/raw/spatial.npz'
META = ROOT / 'data/raw/spatial_metadata.json'
OUTPUT = ROOT / 'data/spatial.json'
CACHE = ROOT / '.cache/spatial'
DODS = 'https://psl.noaa.gov/thredds/dodsC/'
FILESERVER = 'https://psl.noaa.gov/thredds/fileServer/'
BASE = DODS + 'Datasets/noaa.oisst.v2.highres/'
WEEKLY = BASE + 'sst.week.mean.nc'
CLIM = BASE + 'sst.day.mean.ltm.1991-2020.nc'
VERSION = 1
WEEKS = 53  # one full year back plus the latest complete week
LAT = np.arange(-29.875, 30, 1, dtype=np.float64)
LON = np.arange(.125, 360, 1, dtype=np.float64)
PACIFIC = (LON >= 120) & (LON < 290)
REGIONS = {'nino12': (-10, 0, 270, 280), 'nino3': (-5, 5, 210, 270),
           'nino34': (-5, 5, 190, 240), 'nino4': (-5, 5, 160, 210)}


def digest(payload):
    return hashlib.sha256(payload).hexdigest()


def archive(**arrays):
    stream = io.BytesIO()
    # Stable ZIP headers across Windows and Linux: identical extracts must not
    # trigger a new publication solely because the producer's OS changed.
    with zipfile.ZipFile(stream,'w',compression=zipfile.ZIP_DEFLATED) as bundle:
        for name,values in arrays.items():
            info=zipfile.ZipInfo(name+'.npy',date_time=(1980,1,1,0,0,0))
            info.create_system=3
            info.compress_type=zipfile.ZIP_DEFLATED
            info.external_attr=0o600 << 16
            with bundle.open(info,'w',force_zip64=True) as target:
                np.lib.format.write_array(target,np.asanyarray(values),allow_pickle=False)
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
        if not 1 <= len(dates) <= WEEKS or sst.shape != (len(dates), 60, 360) or clim.shape != sst.shape or scale.shape != (60, 360):
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


class RangeFile(io.RawIOBase):
    """Read-only file over HTTP byte ranges; small reads share a bounded block cache."""

    def __init__(self, url, block=2**20):
        self.url, self.block, self.pos, self.cache = url, block, 0, {}
        # PSL's fileServer reports a wrong length to HEAD; a one-byte range gives the real size.
        self.size = int(self._get(0, 0)[1].split('/')[-1])

    def _get(self, start, end):
        import urllib.request
        for attempt in range(5):
            try:
                request = urllib.request.Request(self.url, headers={
                    'Range': f'bytes={start}-{end}',
                    'User-Agent': 'el-nino-dashboard/1.0 (+https://github.com/jp1309/el-nino-dashboard)'})
                with urllib.request.urlopen(request, timeout=120) as response:
                    if response.status != 206:
                        raise OSError(f'Respuesta sin rango ({response.status}) en {self.url}')
                    return response.read(), response.headers['Content-Range']
            except OSError as exc:
                if attempt == 4:
                    raise
                # HTTP 429 is PSL asking clients to slow down: wait far longer than for a network blip.
                time.sleep(15 * (attempt + 1) if getattr(exc, 'code', None) == 429 else 2 ** attempt)

    def readable(self):
        return True

    def seekable(self):
        return True

    def tell(self):
        return self.pos

    def seek(self, offset, whence=0):
        self.pos = offset if whence == 0 else self.pos + offset if whence == 1 else self.size + offset
        return self.pos

    def readinto(self, buffer):
        n = min(len(buffer), self.size - self.pos)
        if n <= 0:
            return 0
        start, end = self.pos, self.pos + n
        if n > self.block:  # a data chunk: fetch it directly and keep memory flat
            data = self._get(start, end - 1)[0]
        else:
            data = bytearray()
            for k in range(start // self.block, (end - 1) // self.block + 1):
                if k not in self.cache:
                    if len(self.cache) > 64:
                        self.cache.pop(next(iter(self.cache)))
                    self.cache[k] = self._get(k * self.block, min(self.size, (k + 1) * self.block) - 1)[0]
                data += self.cache[k]
            offset = start - (start // self.block) * self.block
            data = data[offset:offset + n]
        buffer[:n] = data
        self.pos += n
        return n


class H5Variable:
    """netCDF4-style access to an HDF5 dataset: attributes, masking and unpacking."""

    def __init__(self, dataset):
        self.dataset = dataset
        self.attrs = {k: v.decode() if isinstance(v, bytes) else v for k, v in dataset.attrs.items()}

    def __getattr__(self, name):
        try:
            return self.attrs[name]
        except KeyError as exc:
            raise AttributeError(name) from exc

    def __getitem__(self, key):
        raw = np.asarray(self.dataset[key])
        mask = np.zeros(raw.shape, dtype=bool)
        if raw.dtype.kind == 'f':
            # Same rules netCDF4 applies by default: missing/fill values, then the valid range.
            fills = [self.attrs[a] for a in ('missing_value', '_FillValue') if a in self.attrs]
            if '_FillValue' not in self.attrs:
                fills.append(np.float32(9.9692099683868690e+36) if raw.dtype == np.float32 else 9.9692099683868690e+36)
            mask |= np.isin(raw, np.concatenate([np.ravel(f) for f in fills]).astype(raw.dtype))
            low, high = np.ravel(self.attrs.get('valid_range', [self.attrs.get('valid_min', -np.inf), self.attrs.get('valid_max', np.inf)]))[:2]
            mask |= (raw < low) | (raw > high)
        if 'scale_factor' in self.attrs or 'add_offset' in self.attrs:
            raw = raw * self.attrs.get('scale_factor', 1) + self.attrs.get('add_offset', 0)
        return np.ma.masked_array(raw, mask=mask)


class FileServerDataset:
    """Open a PSL OPeNDAP URL through thredds/fileServer, reading only the chunks needed."""

    def __init__(self, url):
        import h5py
        if not url.startswith(DODS):
            raise ValueError(f'URL fuera de PSL THREDDS: {url}')
        self.http = RangeFile(FILESERVER + url[len(DODS):])
        self.file = h5py.File(io.BufferedReader(self.http, buffer_size=2**20), 'r')
        self.variables = {name: H5Variable(self.file[name]) for name in ('time', 'lat', 'lon', 'sst')}

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        self.file.close()


def opendap_dataset(url):
    from netCDF4 import Dataset
    return Dataset(url)


def fetch_inputs():
    """OPeNDAP transfers only the sampled grid; when PSL refuses it (HTTP 429 has
    happened for days at a time), the same files are read by byte ranges instead."""
    try:
        return _fetch_inputs(opendap_dataset)
    except (OSError, RuntimeError) as exc:  # netCDF4: OSError on open, RuntimeError on reads
        print(f'OPeNDAP no disponible ({exc}); se leen los mismos archivos por rangos desde fileServer.', flush=True)
        return _fetch_inputs(FileServerDataset)


def _fetch_inputs(open_dataset):
    from netCDF4 import num2date
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
    with open_dataset(CLIM) as d:
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
    with open_dataset(WEEKLY) as d:
        if not np.array_equal(d.variables['lat'][240:480:4],LAT) or not np.array_equal(d.variables['lon'][::4],LON):
            raise ValueError('La cuadrícula NOAA ha cambiado')
        times = d.variables['time']
        dates = [date(t.year,t.month,t.day) for t in num2date(times[:],times.units)]
        # Require complete Sunday-Saturday weeks, even if a partial week appears upstream.
        valid = [i for i,t in enumerate(dates) if t+timedelta(days=6) < date.today()]
        last = valid[-1]
        starts = dates[last-WEEKS+1:last+1]
        if (date.today()-starts[-1]).days > 28:
            raise ValueError('La fuente espacial tiene mas de 28 dias de rezago')
        print(f'Descargando {len(starts)} semanas OISST...', flush=True)
        sst = np.ma.filled(d.variables['sst'][last-len(starts)+1:last+1,240:480:4,::4],np.nan)
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


def expected_center(today):
    """Center (Wednesday) of the latest complete Sunday-Saturday week before today."""
    saturday = today - timedelta(days=(today.weekday() - 5) % 7 or 7)
    return saturday - timedelta(days=3)


def is_due(today, path=OUTPUT):
    """True unless the published map already holds the full history up to the latest complete week."""
    try:
        frames = json.loads(path.read_text(encoding='utf-8'))['frames']
        latest = date.fromisoformat(frames[-1]['center'])
    except (OSError, UnicodeError, ValueError, KeyError, IndexError, TypeError):
        return True
    return len(frames) < WEEKS or latest < expected_center(today)


def main():
    if '--if-due' in sys.argv and not is_due(date.today()):
        # Avoid querying PSL THREDDS (rate-limited, HTTP 429) when nothing new can exist.
        print(f'Mapa ya actualizado: ultima semana {expected_center(date.today()).isoformat()}')
        return
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

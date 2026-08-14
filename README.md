# El Niño, semana a semana

Dashboard público y reproducible para seguir la evolución de la temperatura superficial del Pacífico tropical con datos oficiales del Climate Prediction Center de NOAA.

El sitio ofrece tres lecturas complementarias:

- **Seguimiento semanal:** diferencias relativas de temperatura OISST v2.1 en Niño 1+2, Niño 3, Niño 3.4 y Niño 4.
- **Comparación anual:** promedios mensuales superpuestos de la región elegida, con selector de año inicial y el año más reciente destacado.
- **Indicador de persistencia:** Relative Oceanic Niño Index (RONI), promedio móvil de tres meses en Niño 3.4 ajustado frente al promedio tropical.

Sitio público: **https://jp1309.github.io/el-nino-dashboard/**

La interfaz está disponible en español e inglés. El selector de idioma conserva la preferencia en el navegador y también la refleja en el parámetro `lang` de la URL.

## Flujo de datos

```text
NOAA/CPC
  ├─ rel_wksst9120.txt  ─┐
  ├─ wksst9120.for      ├─> scripts/update_data.py
  └─ RONI.ascii.txt     ┘        │
                                  ├─ valida esquema, fechas, rangos y duplicados
                                  ├─ conserva data/raw/
                                  ├─ registra SHA-256 en source_manifest.json
                                  └─ publica data/enso.json
                                             │
                                             └─> index.html + app.js ─> GitHub Pages
```

La descarga es transaccional: las tres fuentes deben descargarse y validarse antes de reemplazar cualquier archivo publicado. Si NOAA no cambió, el workflow termina sin crear un commit de datos.

## Actualización automática

El workflow [`.github/workflows/pages.yml`](.github/workflows/pages.yml) se ejecuta:

- todos los **martes a las 14:17 UTC**;
- después de cada `push` a `main`;
- manualmente desde **Actions → Actualizar NOAA y publicar dashboard → Run workflow**.

NOAA publica su evaluación semanal de ENSO los lunes. El martes ofrece un margen prudente para que los archivos OISST y RONI terminen de sincronizarse. Se escogió el minuto 17 para evitar la congestión típica del inicio de cada hora en los cron de GitHub Actions.

El mismo workflow descarga, valida, crea un commit solo cuando los datos cambian y publica el artefacto actualizado en GitHub Pages. Esto evita depender de que un segundo workflow sea activado por un commit realizado con `GITHUB_TOKEN`.

## Fuentes oficiales

| Fuente | Cobertura | Uso |
|---|---|---|
| [SST relativa semanal](https://www.cpc.ncep.noaa.gov/data/indices/rel_wksst9120.txt) | 1981–presente, cuatro regiones Niño | Gráfico principal y tendencia de cuatro semanas |
| [SST semanal](https://www.cpc.ncep.noaa.gov/data/indices/wksst9120.for) | 1981–presente, temperatura y anomalía | Temperatura absoluta mostrada en las tarjetas |
| [RONI](https://www.cpc.ncep.noaa.gov/data/indices/RONI.ascii.txt) | 1950–presente, temporadas móviles | Lectura oceánica persistente e historia ENSO |

El dashboard no declara por sí solo un episodio oficial de El Niño o La Niña. ENSO es un fenómeno acoplado océano-atmósfera y los avisos oficiales incorporan variables atmosféricas, pronósticos y juicio experto.

## Ejecutar localmente

No requiere compilación ni dependencias de aplicación. Sí debe servirse por HTTP porque el navegador carga `data/enso.json` con `fetch`.

```bash
python scripts/update_data.py
python scripts/validate_data.py
python -m unittest discover -s tests -v
python -m http.server 8000
```

Luego abre `http://localhost:8000`.

## Diccionario de datos publicado

`data/enso.json` contiene:

- `meta.main_observation_date`: última semana usada por el gráfico principal.
- `meta.sources`: URL, hash SHA-256 y última observación de cada fuente.
- `current.weekly`: último valor relativo, SST absoluta y anomalía convencional para cada región.
- `current.roni`: último promedio oceánico de tres meses (RONI), clasificación térmica y periodos consecutivos sobre el umbral.
- `weekly[]`: serie semanal alineada por fecha.
- `roni[]`: serie estacional completa desde 1950.

Los campos regionales son `nino12`, `nino3`, `nino34` y `nino4`. Las anomalías y temperaturas están expresadas en grados Celsius.

## Controles de integridad

La actualización falla sin modificar datos canónicos cuando ocurre cualquiera de estas condiciones:

- una fuente no responde o devuelve un archivo inusualmente pequeño;
- el formato deja de contener las columnas esperadas;
- hay fechas duplicadas o fuera de orden;
- aparecen SST o anomalías fuera de rangos físicos amplios;
- la última semana relativa no tiene una observación absoluta equivalente;
- los hashes o conteos procesados no coinciden con el manifiesto.

Para recuperar una publicación incorrecta, revierte el commit de datos afectado con `git revert`, publica nuevamente y ejecuta manualmente el workflow cuando NOAA haya corregido la fuente.

## Arquitectura del frontend

El sitio es HTML, CSS y JavaScript estático. Chart.js se carga en una versión fijada desde jsDelivr; los datos, las fuentes crudas y el manifiesto viven en el repositorio. Los filtros actualizan la URL para que una vista pueda compartirse y la selección visible puede descargarse como CSV.

## Licencia

Código bajo licencia MIT. Los datos pertenecen a NOAA y conservan sus condiciones de uso y atribución originales.

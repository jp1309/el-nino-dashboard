# Mapa semanal del Pacífico

## Fuente y alcance

El mapa es una **elaboración propia**, no una reproducción exacta del raster operativo CPC. Usa los campos semanales OISST v2.1 de NOAA/NCEI distribuidos por NOAA PSL y la climatología diaria 1991–2020 del mismo producto:

- https://psl.noaa.gov/thredds/dodsC/Datasets/noaa.oisst.v2.highres/sst.week.mean.nc
- https://psl.noaa.gov/thredds/dodsC/Datasets/noaa.oisst.v2.highres/sst.day.mean.ltm.1991-2020.nc
- Metodología del ajuste relativo y de su variabilidad por celda: https://www.climate.gov/news-features/blogs/enso/november-2024-enso-update-ask-me-anything
- Comparación visual de referencia, figura 1: https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/enso_disc_jul2026/ensodisc.pdf

OISST tiene resolución nativa de 0,25°. Para limitar las descargas y el peso del sitio, se muestrea cada cuatro puntos, conservando celdas representativas separadas por 1°. No se interpola a partir de los cuatro índices Niño. La visualización no añade resolución mediante suavizado. Las tierras se dibujan con Natural Earth 1:110m (dominio público); su URL y huella están en `data/land.json`.

## Tiempo y cálculo

El tiempo en el archivo semanal PSL corresponde al domingo inicial. Se confirmó con la media de siete observaciones diarias OISST. La fecha mostrada como central es el miércoles, y se muestra también el intervalo completo domingo–sábado. Se excluyen semanas cuyo sábado todavía no ha terminado. La fecha de estos campos puede diferir de la de las tablas CPC del dashboard.

Para cada celda:

1. Temperatura: campo semanal OISST.
2. Anomalía: temperatura menos el promedio de siete días de climatología 1991–2020. Para el 29 de febrero se interpola entre el 28 de febrero y el 1 de marzo.
3. Se calcula la anomalía media de **todos los océanos** entre 20°S y 20°N, ponderada por coseno de latitud y excluyendo tierra y valores ausentes.
4. Anomalía relativa: `(anomalía local − media tropical) × σ_local / σ_residual`. Las dos desviaciones estándar muestrales se calculan sobre las 1.566 semanas centradas en 1991–2020. Esta calibración se mantiene fija y no pretende ser el coeficiente operativo de CPC.

La media regional de un mapa relativo reescalado por celda puede diferir de un índice calculado primero sobre toda la región y luego reescalado. También influyen el muestreo y las revisiones. Los valores oficiales CPC permanecen en los indicadores originales. Las tarjetas del mapa están identificadas como promedios de la malla de elaboración propia.

## Archivos y actualización

`scripts/update_spatial.py` conserva los extractos numéricos muestreados de las últimas 13 semanas, sus climatologías semanales y los coeficientes y desviaciones de referencia en `data/raw/spatial.npz`. No es el NetCDF completo; es un extracto reproducible, identificado por las URLs, coordenadas, paso de muestreo, algoritmo y huellas de la referencia en `spatial_metadata.json`.

El JSON para el navegador almacena centésimas de °C como enteros y `null` para ausencia de datos. Su error de cuantización es como máximo 0,005 °C. Los datos y coordenadas quedan asociados a la misma edición mediante SHA-256. Un error del mapa deja visible un mensaje local sin sustituir los demás indicadores.

La climatología completa muestreada se descarga en bloques acotados y se guarda en `.cache/spatial/`; GitHub Actions reutiliza ese archivo. La referencia de variabilidad se conserva en el extracto publicado, por lo que no se descargan 30 años en cada ejecución. Para recalibrar explícitamente existe `--rebuild-reference`. El código y los metadatos deben revisarse si cambia la referencia.

La actualización del mapa usa los horarios ya existentes del proyecto. Se comprueba independientemente de si las tablas CPC tienen períodos pendientes. Se descargan nuevamente las últimas 13 semanas para recoger revisiones recientes. Una respuesta más antigua, incompleta o inválida no sustituye los datos publicados. Los fallos de red conservan la última edición validada, con su fecha y advertencia visual de rezago después de 14 días.

## Validación inicial · 6 de septiembre de 2026

- 13 semanas centradas entre el 10 de junio y el 2 de septiembre de 2026.
- Coinciden 12 semanas con las tablas CPC disponibles, equivalentes a 48 pares región/semana por medida.
- Diferencias absolutas frente a CPC (°C):

| Medida | Media | Máxima |
|---|---:|---:|
| SST | 0,044 | 0,180 |
| Anomalía convencional | 0,040 | 0,160 |
| Anomalía relativa | 0,091 | 0,230 |

Estas diferencias se reportan; no se corrigen los campos para forzar coincidencia. El mapa del 1 de julio se contrastó visualmente con la figura oficial: franja ecuatorial cálida, mayor intensidad costera y patrón frío al oeste y al sur. Es una comprobación de patrones, no una igualdad píxel a píxel.

Cada validación reconstruye todo el JSON desde los extractos conservados. Comprueba coordenadas, dimensiones, semanas completas y consecutivas, máscaras, rangos físicos, cobertura oceánica, relación de desviaciones y correspondencia regional con los índices CPC que tengan fechas comunes. Tolerancias de control: 0,4 °C para SST/anomalía y 0,6 °C para relativa; un exceso bloquea la actualización para revisión. Las pruebas incluyen febrero bisiesto, cambio de año, ponderación tropical, orientación de la cuadrícula, corrupción de datos y escala fija.

Comandos:

```powershell
python -m pip install -r requirements-spatial.txt
python scripts/update_spatial.py
python scripts/update_spatial.py --validate
python -m unittest discover -s tests -v
node --test tests/analytics.test.cjs tests/release.test.cjs tests/ocean-map.test.cjs
python scripts/build_site.py
```

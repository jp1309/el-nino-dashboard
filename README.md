# Observatorio de El Niño

[**Abrir el dashboard público**](https://jp1309.github.io/el-nino-dashboard/)

Herramienta independiente de monitoreo del Pacífico tropical con observaciones y pronósticos oficiales de NOAA/CPC. Interfaz en español e inglés, adaptable a móviles, sin cuentas ni servicios de pago.

## Qué responde

- **¿Cuál es la señal actual?** Anomalía relativa de Niño 3.4, cambio a cuatro semanas, RONI y número de trimestres consecutivos sobre el umbral cálido o frío. El resumen oceánico se distingue del aviso oficial de NOAA.
- **¿Está aumentando o disminuyendo?** Explorador semanal con ventanas de 6 meses, 12 meses, 3 años o toda la historia; también permite elegir un año inicial. Alterna anomalía relativa, anomalía convencional y temperatura observada, con suavizado opcional de cuatro semanas.
- **¿Dónde se concentra?** Tarjetas de las cuatro zonas, minigráficos de 26 semanas, matriz de anomalías y diferencia entre Niño 1+2 y Niño 3.4. El mapa permite ubicar las zonas y sus solapamientos.
- **¿Es inusual para esta época?** Percentil estacional frente a fechas equivalentes de años anteriores y comparación de todas las observaciones semanales de enero a diciembre.
- **¿Qué espera NOAA?** Nueve trimestres de pronóstico de RONI: mediana e intervalos centrales del 50 % y 90 %, fecha de emisión, aviso oficial, tabla de valores y descarga JSON.
- **¿Cuánto dura?** Ocho trimestres RONI recientes con dos decimales y serie histórica desde 1950, abierta inicialmente desde 1990.

Los filtros se guardan en la URL. El CSV del explorador contiene la medida, regiones, fechas y suavizado seleccionados. Las observaciones completas, el pronóstico y los campos del mapa también pueden descargarse en JSON. El pronóstico de RONI no es un pronóstico de lluvia o de impactos locales en Ecuador.

## Mapa semanal del Pacífico

El explorador espacial añade 13 semanas de campos OISST, selector de temperatura/anomalía convencional/anomalía relativa, reproducción temporal, consulta de celdas y regiones Niño superpuestas. Cada mapa muestra su intervalo completo y su fecha propia. Es una elaboración independiente muestreada a 1°, con referencia 1991–2020; sus promedios no sustituyen los índices oficiales CPC. El procesamiento, las fuentes y la comparación cuantitativa se documentan en [docs/spatial-map.md](docs/spatial-map.md).

Antes de ejecutar validaciones o actualizar el mapa, instalar `python -m pip install -r requirements-spatial.txt`. El flujo de GitHub Actions instala estas dependencias automáticamente y actualiza el mapa con los horarios existentes.

## Fuente → descarga → transformación → publicación

| Fuente oficial | Archivo conservado | Producto |
|---|---|---|
| [Anomalías relativas semanales OISST](https://www.cpc.ncep.noaa.gov/data/indices/rel_wksst9120.txt) | `data/raw/rel_wksst9120.txt` | `data/enso.json`, desde 1981 |
| [SST y anomalías convencionales OISST](https://www.cpc.ncep.noaa.gov/data/indices/wksst9120.for) | `data/raw/wksst9120.for` | Mismas semanas, alineadas por fecha |
| [RONI](https://www.cpc.ncep.noaa.gov/data/indices/RONI.ascii.txt) | `data/raw/RONI.ascii.txt` | `data/enso.json`, desde 1950 |
| [Pronóstico RONI](https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/enso/roni/outlook/) | `data/raw/outlook.html` | `data/outlook.json`, siete percentiles por trimestre |
| [Campos OISST y climatología NOAA PSL](https://psl.noaa.gov/data/gridded/data.noaa.oisst.v2.highres.html) | `data/raw/spatial.npz` y metadatos (extractos numéricos muestreados) | `data/spatial.json`, 13 semanas y tres medidas |
| [Diagnóstico ENSO](https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/enso_advisory/ensodisc.shtml) | `data/raw/advisory.html` | Fecha y estado del aviso en `data/outlook.json` |

`scripts/update_data.py` descarga y valida las tres series antes de reemplazarlas. `scripts/update_outlook.py` extrae la tabla oficial y el aviso: exige nueve temporadas consecutivas, columnas esperadas, percentiles finitos y ordenados, y que aviso y pronóstico correspondan a la misma edición mensual. Ninguna probabilidad se calcula o inventa a partir de la mediana.

`data/source_manifest.json` conserva cobertura, conteos y SHA-256 de las observaciones; `data/outlook.json` incluye las fuentes y sus SHA-256. `.gitattributes` impide que Git cambie los saltos de línea de los archivos originales. La validación reconstruye **todos** los valores publicados desde las fuentes conservadas, incluido el pronóstico, y exige igualdad exacta.

GitHub Pages publica los archivos estáticos y `data/`. El navegador consume exclusivamente esos archivos versionados; no descarga ni interpreta páginas de NOAA en tiempo real.

### Coherencia de la publicación

Solo el flujo de GitHub Actions publica el sitio (`build_type: workflow`); la publicación paralela desde la rama debe permanecer desactivada. `scripts/build_site.py` genera una edición con nombres basados en SHA-256 para el código, estilos y datos. El HTML contiene el manifiesto de esa edición y verifica los scripts y estilos con integridad de subrecursos.

La ingestión también rechaza descargas que retrocedan de temporada o recorten el historial. Se permiten las revisiones de valores del mismo período que realiza NOAA. Un pronóstico de una fecha anterior no puede reemplazar una edición más reciente.

`release.js` comprueba primero la edición publicada y luego la huella de ambos archivos de datos antes de mostrarlos. Si recibe datos distintos, reintenta una vez sin reutilizar caché; si siguen sin coincidir, muestra un error y no renderiza las cifras. El mapa carga después, verifica por separado sus datos y costas contra el mismo manifiesto, y contiene sus errores dentro de su panel. Las pestañas visibles comprueban nuevas ediciones cada cinco minutos y al recuperar visibilidad, y recargan automáticamente conservando los filtros. Un fallo de conexión en esas comprobaciones posteriores conserva la edición ya validada; su fecha de observación sigue visible. Esto evita mezclar ediciones, pero no garantiza disponibilidad de red ni publicación puntual de NOAA.

Después del despliegue, `scripts/verify_publication.py` descarga del sitio público el HTML, el identificador de edición y todos los archivos del manifiesto. El flujo solo termina correctamente si sus contenidos coinciden exactamente con el paquete preparado. No se da por verificada una publicación solo porque responda HTTP 200.

## Definiciones y cálculos

**SST** es temperatura superficial observada. La anomalía convencional resta la climatología local 1991–2020; la relativa ajusta además por la anomalía tropical. Los umbrales de anomalía no se dibujan en el modo SST.

**RONI** es un promedio móvil de tres meses de anomalías de Niño 3.4, ajustado por la anomalía tropical y su variabilidad. Usa ERSST; las series semanales usan OISST. Por tanto, el promedio de cuatro semanas no es el RONI. La fecha de RONI representa el mes central: `2026-07-15` corresponde a junio–agosto. Los valores recientes son revisables. [Definición oficial de NOAA](https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/enso/roni/).

**Persistencia** cuenta trimestres consecutivos con RONI ≥ +0,50 °C o ≤ −0,50 °C del mismo signo. Usa los dos decimales originales, sin redondear antes de comparar: +0,49 no cuenta como +0,50. Se detiene en un trimestre neutral, un cambio de signo o una discontinuidad. Es un conteo local de la serie, no la clasificación oficial de episodios. La referencia de cinco temporadas solapadas no constituye una regla automática para emitir avisos; también interviene la atmósfera.

**Cambio a cuatro semanas** = último valor menos el de exactamente 28 días antes. **Media móvil** = promedio de cuatro observaciones consecutivas separadas por siete días. Si faltan observaciones, no se sustituye el resultado por cero ni se promedian ventanas incompletas.

**Percentil estacional** usa una observación por cada año anterior: la más cercana a la misma fecha del calendario, a una distancia máxima de cuatro días. Se usa un calendario común bisiesto para alinear febrero. En distancias empatadas se conserva la observación anterior. Percentil = 100 × (valores inferiores + 0,5 × valores iguales) / años comparables. La mediana utiliza interpolación lineal. Se calcula sobre todo el historial, independientemente del año inicial de la comparación. No mide probabilidad de ENSO.

**Actualidad**: alerta semanal a partir de más de 14 días desde la observación; RONI a más de 45 días desde el final del trimestre; pronóstico a más de 35 días desde la emisión. Las edades usan días UTC. Son reglas del tablero, no compromisos de publicación de NOAA. Una descarga fallida conserva la edición anterior con su fecha, y el tablero muestra su antigüedad.

## Actualización automática

Se mantienen los intentos cada hora los **lunes y martes, de 08:00 a 22:00, America/New_York**. Se añade una comprobación los **jueves a las 15:00** para la publicación mensual del pronóstico del segundo jueves. La zona horaria ajusta el horario estacional.

`check_pending.py` comprueba las dos series semanales y también la temporada mensual esperada de RONI a partir del día 5. El pronóstico se consulta cuando falta la edición mensual esperada. Si una descarga falla, el flujo emite una advertencia, conserva la última edición validada y permite actualizar la otra fuente. Si la reconstrucción de los datos falla, se bloquea la publicación. Las ejecuciones programadas solo despliegan cuando los datos cambian; los cambios en `main` y las ejecuciones manuales también publican el sitio.

## Desarrollo y verificación

Python estándar para el procesamiento; Node para pruebas de cálculos y exportación. En Windows puede utilizarse `py -3` en lugar de `python`.

```bash
python scripts/update_data.py
python scripts/update_outlook.py
python scripts/validate_data.py
python -m unittest discover -s tests -v
node --test tests/analytics.test.cjs
node --test tests/release.test.cjs
node --check app.js
node --check monitor.js
node --check analytics.js
node --check release.js
python scripts/build_site.py
# Despues de publicar esa misma edicion:
python scripts/verify_publication.py --url https://jp1309.github.io/el-nino-dashboard/
git diff --check
python -m http.server 8765 --bind 127.0.0.1
```

Abrir `http://127.0.0.1:8765/` (no `file://`, porque los datos se cargan con `fetch`). Las pruebas cubren discontinuidades, ventanas completas, umbrales sin redondear, cambios de año, comparaciones estacionales, CSV, edición del pronóstico y reconstrucción de las fuentes. La revisión visual debe comprobar escritorio, móvil, idiomas, filtros y la versión pública después del despliegue.

| Archivo | Responsabilidad |
|---|---|
| `index.html`, `styles.css` | Estructura y diseño adaptable |
| `app.js` | Gráficos históricos, filtros, traducciones y CSV |
| `analytics.js` | Cálculos puros verificables |
| `monitor.js` | Resumen, matriz, contexto histórico, pronóstico y metodología |
| `scripts/` | Actualización, control de pendientes y validación |
| `tests/` | Pruebas Python y Node |

## Atribución

Elaborado por **Juan Pablo Erraez**, con desarrollo asistido por Codex. Código bajo [licencia MIT](LICENSE). Datos y diagnósticos de NOAA/CPC; cartografía de OpenStreetMap. Chart.js y Leaflet se cargan desde sus CDN.

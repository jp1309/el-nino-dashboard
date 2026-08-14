# Temperatura del Pacífico tropical y El Niño

Dashboard público para observar cómo cambia la temperatura superficial del mar en las principales zonas de monitoreo de El Niño. Utiliza datos oficiales del Climate Prediction Center de NOAA y se actualiza automáticamente cada semana.

## Ver el dashboard

### [Abrir el dashboard público](https://jp1309.github.io/el-nino-dashboard/)

No requiere instalación. La interfaz funciona en computadoras y dispositivos móviles y puede cambiarse entre español e inglés desde el botón ubicado en la esquina superior derecha.

## Qué permite analizar

### Evolución semanal por zona

Compara las variaciones recientes de temperatura en las cuatro zonas del Pacífico tropical. La zona Niño 3.4 aparece seleccionada inicialmente porque es la referencia central más utilizada para seguir la evolución oceánica de El Niño y La Niña. El usuario puede activar o desactivar las demás zonas y escoger el año inicial.

### Comparación de meses entre años

Superpone los valores de enero a diciembre para distintos años. Los años anteriores se muestran en gris y el año más reciente en rojo, lo que permite reconocer rápidamente si el calentamiento o enfriamiento actual se aparta de otros años. El usuario puede elegir la zona y desde qué año comparar.

### Evolución de largo plazo en la zona Niño 3.4

Presenta un promedio móvil de tres meses para distinguir cambios persistentes de fluctuaciones breves. El gráfico abre desde 1990, aunque el selector permite consultar la serie completa disponible desde 1950.

### Mapa de las zonas Niño

Ubica las cuatro áreas de monitoreo sobre un esquema del Pacífico tropical, muestra sus coordenadas y hace visibles los solapamientos entre Niño 3, Niño 3.4 y Niño 4. También explica qué aporta cada zona al seguimiento de la señal oceánica.

## Zonas de monitoreo

| Zona | Ubicación | Para qué resulta útil |
|---|---|---|
| **Niño 1+2** | Frente a las costas de Ecuador y Perú | Detectar cambios costeros y calentamientos que pueden aparecer primero en el Pacífico oriental. |
| **Niño 3** | Pacífico tropical oriental | Seguir la extensión del calentamiento o enfriamiento hacia el oeste. |
| **Niño 3.4** | Pacífico tropical central | Observar la señal oceánica central asociada con la evolución de El Niño y La Niña. |
| **Niño 4** | Pacífico tropical centro-occidental | Identificar cambios concentrados más al oeste. |

Los valores positivos indican que el mar está más cálido que la referencia correspondiente; los negativos indican condiciones más frías. El dashboard es una herramienta de seguimiento oceánico y no sustituye los avisos oficiales de NOAA. La declaración de un episodio de El Niño o La Niña también considera la atmósfera, la persistencia y los pronósticos.

## Datos oficiales

| Conjunto de datos | Cobertura | Uso en el dashboard |
|---|---|---|
| [Temperatura relativa semanal OISST v2.1](https://www.cpc.ncep.noaa.gov/data/indices/rel_wksst9120.txt) | Desde 1981; Niño 1+2, 3, 3.4 y 4 | Evolución semanal y comparación anual por zona. |
| [Temperatura semanal OISST v2.1](https://www.cpc.ncep.noaa.gov/data/indices/wksst9120.for) | Desde 1981; cuatro zonas Niño | Temperatura superficial observada y anomalía convencional. |
| [Índice Oceánico Relativo](https://www.cpc.ncep.noaa.gov/data/indices/RONI.ascii.txt) | Desde 1950; zona Niño 3.4 | Promedio móvil de tres meses y evolución de largo plazo. |

Los archivos originales descargados se conservan en [`data/raw/`](data/raw/). Los datos procesados que consume la visualización están en [`data/enso.json`](data/enso.json), y [`data/source_manifest.json`](data/source_manifest.json) registra la cobertura, el número de observaciones y la huella SHA-256 de cada fuente.

## Actualización semanal

GitHub Actions ejecuta la actualización todos los **martes a las 14:17 UTC**, después de la publicación semanal de NOAA de los lunes. Este margen permite que los distintos archivos oficiales terminen de sincronizarse.

En cada ejecución, el proceso:

1. descarga las tres fuentes oficiales;
2. valida su estructura, fechas, rangos y duplicados;
3. reemplaza los datos publicados únicamente si todas las comprobaciones terminan correctamente;
4. registra los cambios cuando NOAA publicó información nueva;
5. vuelve a desplegar el dashboard en GitHub Pages.

También se ejecuta después de cada cambio enviado a la rama `main` y puede iniciarse manualmente desde [GitHub Actions](https://github.com/jp1309/el-nino-dashboard/actions).

## Reproducibilidad y controles

El procesamiento se realiza con Python y no requiere dependencias externas. Para descargar nuevamente las fuentes, validar el resultado y ejecutar las pruebas:

```bash
python scripts/update_data.py
python scripts/validate_data.py
python -m unittest discover -s tests -v
```

La actualización se detiene sin reemplazar los datos vigentes si una fuente no responde, cambia de formato, presenta fechas duplicadas o desordenadas, contiene valores fuera de rangos físicos amplios o no coincide con el manifiesto generado.

## Estructura del proyecto

```text
index.html                 Estructura del dashboard
styles.css                 Diseño adaptable
app.js                     Gráficos, filtros, traducciones y descargas CSV
data/enso.json             Datos procesados para la interfaz
data/source_manifest.json  Procedencia e integridad de las fuentes
data/raw/                  Copias de los archivos originales de NOAA
scripts/update_data.py     Descarga y transformación
scripts/validate_data.py   Validación independiente
tests/                     Pruebas del procesamiento y la interfaz
```

El frontend es estático y usa Chart.js. Los filtros se reflejan en la URL para que una vista específica pueda compartirse, y los datos visibles pueden descargarse como CSV.

## Licencia y atribución

El código se distribuye bajo la [licencia MIT](LICENSE). Los datos pertenecen a NOAA y mantienen sus condiciones de uso y atribución originales.

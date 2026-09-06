"use strict";

const MONITOR_COPY = {
  warmSignal: ["Señal cálida", "Warm signal"], coldSignal: ["Señal fría", "Cold signal"],
  eyebrow: ["OBSERVATORIO DEL PACÍFICO · NOAA / CPC", "PACIFIC OBSERVATORY · NOAA / CPC"],
  title: ["El Niño, bajo observación.", "El Niño, under observation."],
  loading: ["Comprobando datos…", "Checking observations…"],
  navNow: ["Estado actual", "Current state"], navTrend: ["Evolución", "Evolution"], navOutlook: ["Pronóstico", "Outlook"], navCompare: ["Contexto histórico", "Historical context"], navSources: ["Fuentes y método", "Sources & method"],
  range6: ["6 meses", "6 months"], range12: ["12 meses", "12 months"], range36: ["3 años", "3 years"], rangeAll: ["Todo", "All"],
  measure: ["Medida", "Measure"], relative: ["Anomalía relativa", "Relative anomaly"], conventional: ["Anomalía convencional", "Conventional anomaly"], sst: ["Temperatura del mar", "Sea temperature"], smooth: ["Promedio de 4 semanas", "4-week average"],
  spatialKicker: ["EXTENSIÓN DE LA SEÑAL", "EXTENT OF THE SIGNAL"], spatialTitle: ["¿Dónde se concentra el cambio?", "Where is the change concentrated?"],
  heatmapKey: ["Frío ← anomalía relativa → cálido", "Cold ← relative anomaly → warm"],
  heatmapNote: ["Últimas 26 semanas · cada celda muestra la anomalía relativa en °C. Las cuatro zonas se superponen: no son observaciones independientes.", "Last 26 weeks · each cell shows the relative anomaly in °C. The four regions overlap: they are not independent observations."],
  outlookKicker: ["PERSPECTIVA OFICIAL · NOAA / CPC", "OFFICIAL OUTLOOK · NOAA / CPC"],
  outlookTitle: ["Qué se espera en los próximos meses", "What to expect in the coming months"],
  outlookLoading: ["Cargando la edición del pronóstico…", "Loading the outlook edition…"], officialOutlook: ["Consultar NOAA ↗", "Read NOAA ↗"],
  median: ["Mediana", "Median"], range50: ["Intervalo central del 50 %", "Central 50% range"], range90: ["Intervalo central del 90 %", "Central 90% range"],
  outlookTable: ["Ver valores del pronóstico", "View forecast values"], downloadOutlook: ["Descargar pronóstico JSON", "Download forecast JSON"],
  methodology: ["Definiciones, cálculos y límites del monitoreo", "Definitions, calculations and monitoring limits"],
  outlookNote: ["Los intervalos expresan incertidumbre sobre el RONI, no probabilidades de lluvia. La mediana no es un resultado garantizado. Cada punto corresponde a tres meses que se solapan con los siguientes.", "Ranges express uncertainty in RONI, not rainfall probabilities. The median is not a guaranteed outcome. Each point represents three months that overlap with the next season."],
};
const say = (es, en) => state.language === "en" ? en : es;
const metricKey = (region) => state.weeklyMetric === "relative" ? region : `${region}_${state.weeklyMetric}`;
const formatValue = (value, digits = 1) => Number.isFinite(value) ? decimal(value, digits) : "—";
const formatDelta = (value) => Number.isFinite(value) ? `${signed(value)} °C` : "—";

function applyMonitorLanguage() {
  document.querySelectorAll("[data-monitor]").forEach((element) => {
    const copy = MONITOR_COPY[element.dataset.monitor];
    element.textContent = copy[state.language === "en" ? 1 : 0];
  });
  document.querySelector("#weeklyMetric").setAttribute("aria-label", say("Medida del gráfico semanal", "Weekly chart measure"));
  document.querySelector("#outlookChart").setAttribute("aria-label", say("Pronóstico oficial de RONI con intervalos de incertidumbre", "Official RONI outlook with uncertainty ranges"));
  document.querySelector(".section-nav").setAttribute("aria-label", say("Secciones", "Sections"));
  document.querySelector("#rangeControls").setAttribute("aria-label", say("Ventana temporal", "Time range"));
}

function sparkline(rows, key, color) {
  const values = rows.slice(-26).map((row) => row[key]);
  const low = Math.min(...values, 0), high = Math.max(...values, 0.5);
  const y = (value) => 45 - (value - low) / (high - low || 1) * 38;
  const points = values.map((value, index) => `${index / (values.length - 1) * 260},${y(value)}`).join(" ");
  return `<svg viewBox="0 0 260 52" class="sparkline" aria-hidden="true"><path d="M0 ${y(0)}H260" stroke="#d8e1e5" stroke-dasharray="3 4"/><polyline points="${points}" fill="none" stroke="${color}" stroke-width="2.5"/><circle cx="260" cy="${y(values.at(-1))}" r="3" fill="${color}"/></svg>`;
}

function renderMonitor() {
  applyMonitorLanguage();
  const rows = state.data.weekly, latest = rows.at(-1), roni = state.data.current.roni;
  const age = EnsoAnalytics.age(latest.date);
  const stale = age > 14 || age < 0;
  const freshness = document.querySelector("#dataFreshness");
  freshness.classList.toggle("stale", stale);
  freshness.textContent = `${stale ? "◷" : "●"} ${say("Observación semanal", "Weekly observation")}: ${formatDate(latest.date)} · ${age} ${say("días", "days")}`;
  const p = EnsoAnalytics.phase(roni.value);
  const phaseLabel = p === "warm" ? say("Señal oceánica cálida", "Warm ocean signal") : p === "cold" ? say("Señal oceánica fría", "Cold ocean signal") : say("Señal oceánica neutral", "Neutral ocean signal");
  const status = document.querySelector("#oceanStatus");
  status.dataset.phase = p;
  status.innerHTML = `<div><span class="status-dot"></span><strong>${phaseLabel}</strong><span class="status-basis">${say("según el último RONI", "based on the latest RONI")}</span></div><a href="https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/enso_advisory/ensodisc.shtml" target="_blank" rel="noreferrer">${say("Diagnóstico oficial NOAA", "Official NOAA diagnosis")} ↗</a>`;
  const delta = EnsoAnalytics.delta(rows, "nino34", 4);
  const average = EnsoAnalytics.rolling(rows, "nino34").at(-1);
  const count = EnsoAnalytics.persistence(state.data.roni);
  const roniStale = EnsoAnalytics.age(EnsoAnalytics.seasonEnd(roni.date)) > 45;
  const cards = [
    { label: say("NIÑO 3.4 · SEÑAL CENTRAL", "NIÑO 3.4 · CENTRAL SIGNAL"), value: signed(latest.nino34), unit: "°C", detail: say("Anomalía relativa semanal", "Weekly relative anomaly"), bottom: `${say("Media de 4 semanas", "4-week mean")}: <b>${formatValue(average, 2)} °C</b>`, spark: sparkline(rows, "nino34", "#167b96") },
    { label: say("CAMBIO EN 4 SEMANAS", "CHANGE OVER 4 WEEKS"), value: Number.isFinite(delta) ? signed(delta) : "—", unit: "°C", detail: say("Diferencia entre dos observaciones", "Difference between two observations"), bottom: Number.isFinite(delta) ? say("En Niño 3.4 · positivo = calentamiento", "Niño 3.4 · positive = warming") : say("Falta la semana de referencia", "Reference week unavailable"), spark: `<div class="delta-reading">${!Number.isFinite(delta) ? "—" : delta > 0.05 ? "↗" : delta < -0.05 ? "↘" : "→"}<span>${!Number.isFinite(delta) ? say("Sin comparación", "No comparison") : Math.abs(delta) < .05 ? say("Sin cambio neto", "No net change") : delta > 0 ? say("Aumenta la anomalía", "Anomaly increasing") : say("Disminuye la anomalía", "Anomaly decreasing")}</span></div>` },
    { label: "RONI · NIÑO 3.4", value: signed(roni.value, 2), unit: "°C", detail: `${SEASON_LABELS[state.language][roni.season]} ${roni.year}`, bottom: `${roniStale ? say("⚠ Revisar actualización · ", "⚠ Check update · ") : ""}${say("Tres meses · dato revisable", "Three months · subject to revision")}`, spark: `<div class="roni-scale"><span style="left:${Math.max(2, Math.min(98, (roni.value + 3) / 6 * 100))}%"></span></div><div class="scale-labels"><span>−3 °C</span><span>0</span><span>+3 °C</span></div>` },
    { label: say("PERSISTENCIA DEL RONI", "RONI PERSISTENCE"), value: String(count), unit: say("trimestres", "seasons"), detail: say("Consecutivos del mismo signo y fuera de ±0,5 °C", "Consecutive, same-sign seasons beyond ±0.5 °C"), bottom: say("Referencia histórica: 5 trimestres solapados", "Historical reference: 5 overlapping seasons"), spark: `<div class="persistence-track" aria-hidden="true">${Array.from({length:5}, (_, i) => `<i class="${i < count ? p : ""}"></i>`).join("")}</div>` },
  ];
  document.querySelector("#metricGrid").innerHTML = cards.map((card) => `<article class="metric-card"><h2>${card.label}</h2><div class="metric-number">${card.value}<small>${card.unit}</small></div><p>${card.detail}</p>${card.spark}<div class="metric-bottom">${card.bottom}</div></article>`).join("");
  document.querySelector("#monitorReading").innerHTML = `<strong>${say("Cómo leer este estado", "Reading this state")}</strong><p>${say("La semana mide el pulso reciente; el RONI mide la persistencia. Los trimestres comparten meses: no se suman como períodos independientes. El diagnóstico de El Niño también requiere evaluar la atmósfera.", "Weekly data track recent changes; RONI tracks persistence. Seasons share months and cannot be added as independent periods. Diagnosing El Niño also requires assessing the atmosphere.")}${stale ? ` <b>${say("La serie semanal está fuera de la ventana de actualización esperada; no describe las condiciones de hoy.", "The weekly series is outside its expected update window; it does not describe today's conditions.")}</b>` : ""}</p>`;
  renderSpatial();
  renderMethodology();
  renderHistoricalContext();
  renderOutlook();
}

function renderMethodology() {
  document.querySelector("#roniRecent").innerHTML = state.data.roni.slice(-8).map((row) => `<div data-phase="${EnsoAnalytics.phase(row.value)}"><span title="${SEASON_LABELS[state.language][row.season]}">${row.season} ${row.year}</span><strong>${signed(row.value, 2)} °C</strong></div>`).join("");
  document.querySelector("#calculationNotes").innerHTML = say(
    `<p><b>Temperatura y anomalías.</b> La SST es la temperatura superficial observada. La anomalía convencional descuenta la climatología de cada zona y semana (1991–2020). La anomalía relativa descuenta además la señal media tropical. Los gráficos semanales usan OISST y el RONI usa ERSST: el promedio de cuatro semanas no es el RONI.</p><p><b>RONI.</b> Promedio móvil trimestral de la anomalía de Niño 3.4, ajustado por la anomalía tropical (20°N–20°S) y por su variabilidad. La fecha del archivo identifica el mes central, no la fecha de publicación. Los valores recientes pueden revisarse.</p><p><b>Persistencia.</b> Conteo local de trimestres consecutivos con RONI ≥ +0,50 °C o ≤ −0,50 °C, usando los dos decimales del archivo original, sin redondear antes de comparar. Por ejemplo, +0,49 no alcanza el umbral aunque se muestre como +0,5 con un decimal. Los cinco trimestres son una referencia histórica, no una regla automática para emitir avisos.</p><p><b>Estadísticas.</b> El cambio a cuatro semanas resta la observación de exactamente 28 días antes. La media móvil requiere cuatro semanas completas. El percentil compara una observación por año anterior, la más cercana a la fecha calendario (±4 días); los empates cuentan a la mitad. No estima la probabilidad de un episodio.</p><p><b>Actualidad.</b> Se advierte rezago semanal después de 14 días desde la observación, RONI después de 45 días desde el final del trimestre y pronóstico después de 35 días desde su emisión. Son reglas de vigilancia de este tablero; no fechas de publicación prometidas por NOAA. El aviso y el pronóstico conservan siempre su fecha de emisión.</p>`,
    `<p><b>Temperature and anomalies.</b> SST is observed sea surface temperature. Conventional anomalies subtract each region's weekly climatology (1991–2020). Relative anomalies also remove the tropical mean signal. Weekly charts use OISST and RONI uses ERSST: the four-week average is not RONI.</p><p><b>RONI.</b> A three-month running Niño 3.4 anomaly adjusted for the tropical anomaly (20°N–20°S) and its variability. The file date identifies the middle month, not the publication date. Recent values may be revised.</p><p><b>Persistence.</b> A local count of consecutive seasons with RONI ≥ +0.50 °C or ≤ −0.50 °C, using both decimals of the original file, without rounding before comparison. For example, +0.49 does not meet the threshold even if displayed as +0.5 with one decimal. Five seasons are a historical reference, not an automatic rule for issuing advisories.</p><p><b>Statistics.</b> Four-week change subtracts the observation exactly 28 days earlier. The moving average requires four complete weeks. Percentile uses one observation per previous year, nearest to the calendar date (±4 days); ties count as one half. It does not estimate event probability.</p><p><b>Freshness.</b> The dashboard flags weekly data after 14 days from observation, RONI after 45 days from the season end and forecasts after 35 days from issue. These are dashboard monitoring rules, not NOAA's promised release dates. The advisory and outlook always retain their issue date.</p>`
  ) + `<p><a href="https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/enso/roni/" target="_blank" rel="noreferrer">${say("Definición oficial de RONI", "Official RONI definition")} ↗</a> · <a href="${editionDataUrl("data/enso.json")}" download>${say("Descargar todas las observaciones JSON", "Download all observations as JSON")}</a> · <a href="data/source_manifest.json">${say("Procedencia y huellas de las fuentes", "Source provenance and checksums")}</a></p>`;
}

function renderSpatial() {
  const rows = state.data.weekly.slice(-26), latest = rows.at(-1);
  const gap = latest.nino12 - latest.nino34;
  document.querySelector("#coastalReading").innerHTML = `<strong>Niño 1+2: ${signed(latest.nino12)} °C</strong> · Niño 3.4: ${signed(latest.nino34)} °C. ${say("Diferencia costa–centro", "Coast–center difference")}: <strong>${signed(gap)} °C</strong>. ${say("Es una comparación de anomalías relativas; no mide la diferencia de temperatura absoluta ni predice lluvias en Ecuador.", "This compares relative anomalies; it is not an absolute temperature difference or a rainfall forecast for Ecuador.")}`;
  const headers = rows.map((row, i) => `<th scope="col"><span class="${i % 4 === 0 || i === rows.length - 1 ? "" : "sr-only"}">${new Intl.DateTimeFormat(locale(), {day:"numeric",month:"short",timeZone:"UTC"}).format(parseIsoDate(row.date))}</span></th>`).join("");
  const body = ["nino4", "nino34", "nino3", "nino12"].map((key) => `<tr><th scope="row">${regionCopy(key).place.replace(say("Zona ", " region"), "")}</th>${rows.map((row) => {
    const value = row[key];
    const alpha = Math.min(.85, Math.abs(value) / 4 * .85);
    const color = value >= 0 ? `rgba(193, 66, 36, ${alpha})` : `rgba(27, 111, 162, ${alpha})`;
    return `<td style="background:${color};color:${alpha > .58 ? "#fff" : "#183747"}" title="${formatDate(row.date)} · ${signed(value)} °C">${decimal(value)}</td>`;
  }).join("")}</tr>`).join("");
  document.querySelector("#heatmap").innerHTML = `<table class="heatmap"><caption class="sr-only">${say("Anomalía relativa por zona y semana, °C", "Relative anomaly by region and week, °C")}</caption><thead><tr><th>${say("Zona / semana", "Region / week")}</th>${headers}</tr></thead><tbody>${body}</tbody></table>`;
}

function renderHistoricalContext() {
  const key = state.comparisonRegion;
  const rank = EnsoAnalytics.seasonalRank(state.data.weekly, key);
  const latest = state.data.weekly.at(-1);
  document.querySelector("#historicalContext").innerHTML = rank ? `<div class="rank-number">P${Math.round(rank.percentile)}<span>${say("percentil estacional", "seasonal percentile")}</span></div><p><strong>${regionCopy(key).place}: ${signed(latest[key])} °C</strong>. ${say("Comparado con", "Compared with")} ${rank.count} ${say("años anteriores en fechas equivalentes (±4 días). Mediana histórica", "previous years at equivalent calendar dates (±4 days). Historical median")}: <strong>${signed(rank.median)} °C</strong>.<br><small>${say("Usa toda la serie disponible, independientemente del filtro del gráfico. P100 significa que supera todos esos valores; no es una probabilidad de El Niño.", "Uses the full available record, independently of the chart filter. P100 means it exceeds all those values; it is not an El Niño probability.")}</small></p>` : say("Historial insuficiente para comparar.", "Insufficient history to compare.");
}

function renderMetricExplanation() {
  const copy = state.weeklyMetric === "sst" ? say("Temperatura superficial observada, en °C. Incluye el ciclo estacional: un aumento de temperatura no implica por sí solo El Niño.", "Observed sea surface temperature, in °C. Includes the seasonal cycle: a rise in temperature alone does not imply El Niño.") : state.weeklyMetric === "anom" ? say("Anomalía convencional: temperatura menos la climatología local 1991–2020. Cero significa el valor esperado para esa zona y época del año.", "Conventional anomaly: temperature minus the local 1991–2020 climatology. Zero is the expected value for that region and time of year.") : say("Anomalía relativa: anomalía local ajustada por la anomalía media tropical. Aísla la señal regional del calentamiento de fondo de los trópicos; no es un cambio desde la semana anterior.", "Relative anomaly: local anomaly adjusted for the tropical mean anomaly. Separates the regional signal from background tropical warming; it is not a change from the previous week.");
  document.querySelector("#metricExplanation").textContent = copy;
  const note = document.querySelector(".threshold-note");
  note.hidden = state.weeklyMetric === "sst";
  document.querySelector("#weeklyMetric").value = state.weeklyMetric;
  document.querySelector("#smoothWeekly").checked = state.smoothWeekly;
  document.querySelectorAll("[data-range]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.range === state.weeklyRange)));
}

function renderOutlook() {
  const data = state.outlook;
  if (!data) {
    document.querySelector("#outlookSummary").textContent = say("No hay una edición verificable disponible. Consulta el pronóstico directamente en NOAA.", "No verified edition is available. Read the outlook directly at NOAA.");
    document.querySelector(".outlook-layout").hidden = true;
    document.querySelector(".data-details").hidden = true;
    return;
  }
  document.querySelector(".outlook-layout").hidden = false;
  document.querySelector(".data-details").hidden = false;
  const issued = formatDate(data.advisory.issued_date);
  const outdated = EnsoAnalytics.age(data.advisory.issued_date) > 35;
  document.querySelector("#outlookSummary").textContent = `${say("Emisión", "Issued")}: ${issued} · ${say("RONI · 9 trimestres móviles", "RONI · 9 rolling seasons")}${outdated ? say(" · Edición antigua: consulta la actualización oficial", " · Older edition: check the official update") : ""}`;
  const translations = {"El Niño Advisory":"Aviso de El Niño", "La Niña Advisory":"Aviso de La Niña", "El Niño Watch":"Vigilancia de El Niño", "La Niña Watch":"Vigilancia de La Niña", "Not Active":"Sin alerta activa", "Final El Niño Advisory":"Último aviso de El Niño", "Final La Niña Advisory":"Último aviso de La Niña"};
  const first = data.seasons[0];
  document.querySelector("#outlookContext").innerHTML = `<p class="section-kicker">${say("DIAGNÓSTICO OFICIAL", "OFFICIAL DIAGNOSIS")}</p><h3>${state.language === "es" ? data.advisory.status.split(/\s*\/\s*/).map(part => translations[part] || part).join(" / ") : data.advisory.status}</h3><p>${say("Emitido el", "Issued on")} ${issued}</p><hr><p>${SEASON_LABELS[state.language][first.season]} ${first.year}</p><strong class="outlook-value">${signed(first.p50)} °C</strong><p>${say("Mediana prevista", "Forecast median")}<br>90 %: ${signed(first.p5)} ${say("a", "to")} ${signed(first.p95)} °C</p><a href="${data.sources.advisory.url}" target="_blank" rel="noreferrer">${say("Leer el diagnóstico completo", "Read the full diagnosis")} ↗</a>`;
  const labels = data.seasons.map((row) => `${row.season} ${row.year}`);
  const band = (key, color, fill) => ({label:key, data:data.seasons.map((row) => row[key]), borderWidth:0, pointRadius:0, backgroundColor:color, fill, tension:.15});
  const datasets = [band("p5", "transparent", false), band("p95", "rgba(22,123,150,.13)", "-1"), band("p25", "transparent", false), band("p75", "rgba(22,123,150,.28)", "-1"), {label:say("Mediana NOAA", "NOAA median"),data:data.seasons.map((row) => row.p50),borderColor:"#126b83",backgroundColor:"#126b83",borderWidth:3,pointRadius:3,tension:.15}];
  if (state.outlookChart) state.outlookChart.destroy();
  if (window.Chart) state.outlookChart = new Chart(document.querySelector("#outlookChart"), {
    type: "line", data: { labels, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          filter: (item) => item.datasetIndex === 4,
          callbacks: {
            title: (items) => { const row = data.seasons[items[0].dataIndex]; return `${SEASON_LABELS[state.language][row.season]} ${row.year}`; },
            label: (item) => `${say("Mediana", "Median")}: ${signed(item.raw)} °C`,
            afterLabel: (item) => {
              const row = data.seasons[item.dataIndex];
              return [`50 %: ${signed(row.p25)} — ${signed(row.p75)} °C`, `90 %: ${signed(row.p5)} — ${signed(row.p95)} °C`];
            },
          },
        },
      },
      scales: {
        x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: window.innerWidth < 640 ? 4 : 9, font: { size: 11 } } },
        y: { suggestedMin: 0, suggestedMax: 2, ticks: { stepSize: .5 }, title: { display: true, text: "RONI (°C)" } },
      },
    },
  });
  document.querySelector("#outlookTable").innerHTML = `<table class="data-table"><thead><tr><th>${say("Trimestre", "Season")}</th>${[5,15,25,50,75,85,95].map((p)=>`<th>P${p}</th>`).join("")}</tr></thead><tbody>${data.seasons.map((row)=>`<tr><th scope="row">${SEASON_LABELS[state.language][row.season]} ${row.year}</th>${[5,15,25,50,75,85,95].map((p)=>`<td>${decimal(row[`p${p}`],2)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
}

function bindMonitorControls() {
  document.querySelector("#rangeControls").addEventListener("click", (event) => {
    const button = event.target.closest("[data-range]");
    if (!button || !state.data) return;
    state.weeklyRange = button.dataset.range;
    if (state.weeklyRange === "all") state.weeklyStartYear = Number(state.data.weekly[0].date.slice(0,4));
    else {const date = parseIsoDate(state.data.weekly.at(-1).date);date.setUTCMonth(date.getUTCMonth()-Number(state.weeklyRange));state.weeklyStartYear=date.getUTCFullYear();}
    updateControls(); renderWeeklyChart(); syncUrl();
  });
  document.querySelector("#weeklyMetric").addEventListener("change", (event) => {state.weeklyMetric=event.target.value;if(state.data){renderWeeklyChart();syncUrl();}});
  document.querySelector("#smoothWeekly").addEventListener("change", (event) => {state.smoothWeekly=event.target.checked;if(state.data){renderWeeklyChart();syncUrl();}});
}

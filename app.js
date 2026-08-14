"use strict";

const REGION_META = {
  nino12: {
    color: "#f05a47",
    es: { label: "Costa de Ecuador y Perú", place: "Zona Niño 1+2", control: "Costa (Niño 1+2)" },
    en: { label: "Ecuador and Peru coast", place: "Niño 1+2 region", control: "Coast (Niño 1+2)" },
  },
  nino3: {
    color: "#e59b28",
    es: { label: "Pacífico oriental", place: "Zona Niño 3", control: "Este (Niño 3)" },
    en: { label: "Eastern Pacific", place: "Niño 3 region", control: "East (Niño 3)" },
  },
  nino34: {
    color: "#168fbd",
    es: { label: "Pacífico centro-oriental", place: "Zona Niño 3.4", control: "Centro-este (Niño 3.4)" },
    en: { label: "East-central Pacific", place: "Niño 3.4 region", control: "East-central (Niño 3.4)" },
  },
  nino4: {
    color: "#6656c8",
    es: { label: "Pacífico central", place: "Zona Niño 4", control: "Centro (Niño 4)" },
    en: { label: "Central Pacific", place: "Niño 4 region", control: "Central (Niño 4)" },
  },
};

const SOURCE_META = {
  relative_weekly: {
    es: { label: "Cambio semanal frente al promedio tropical", detail: "Cuatro zonas del Pacífico · datos OISST v2.1" },
    en: { label: "Weekly change relative to the tropical average", detail: "Four Pacific regions · OISST v2.1 data" },
  },
  absolute_weekly: {
    es: { label: "Temperatura semanal observada", detail: "Temperatura superficial del mar · datos OISST v2.1" },
    en: { label: "Observed weekly temperature", detail: "Sea surface temperature · OISST v2.1 data" },
  },
  roni: {
    es: { label: "Promedio oceánico de tres meses", detail: "Nombre técnico: RONI · datos ERSST" },
    en: { label: "Three-month ocean average", detail: "Technical name: RONI · ERSST data" },
  },
};

const SEASON_LABELS = {
  es: {
    DJF: "diciembre–febrero", JFM: "enero–marzo", FMA: "febrero–abril",
    MAM: "marzo–mayo", AMJ: "abril–junio", MJJ: "mayo–julio",
    JJA: "junio–agosto", JAS: "julio–septiembre", ASO: "agosto–octubre",
    SON: "septiembre–noviembre", OND: "octubre–diciembre", NDJ: "noviembre–enero",
  },
  en: {
    DJF: "December–February", JFM: "January–March", FMA: "February–April",
    MAM: "March–May", AMJ: "April–June", MJJ: "May–July",
    JJA: "June–August", JAS: "July–September", ASO: "August–October",
    SON: "September–November", OND: "October–December", NDJ: "November–January",
  },
};

const MONTH_LABELS = {
  es: ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"],
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
};

const TRANSLATIONS = {
  es: {
    metaTitle: "Temperatura del mar y El Niño",
    metaDescription: "Dashboard público para observar cuánto se calienta o enfría el Pacífico tropical y si las condiciones asociadas con El Niño persisten.",
    ogDescription: "Seguimiento semanal del Pacífico tropical con datos oficiales de NOAA.",
    skipLink: "Saltar al contenido", navLabel: "Navegación principal", homeLabel: "Inicio",
    brand: "Temperatura del Pacífico tropical", officialSources: "Fuentes oficiales NOAA",
    languageSwitch: "English", languageAria: "Cambiar a inglés",
    weeklyKicker: "Cambio semanal de la temperatura", weeklyTitle: "¿Qué zonas están más cálidas de lo normal?",
    weeklyInitial: "Cada valor indica cuántos grados está una zona por encima o por debajo del promedio tropical.",
    downloadCsv: "Descargar CSV", weeklyControlsAria: "Controles del gráfico semanal", regionsAria: "Regiones Niño",
    regionsLabel: "Regiones", startYear: "Año inicial", weeklyStartYearAria: "Año inicial del gráfico semanal",
    weeklyChartAria: "Gráfico de diferencias semanales de temperatura en cuatro zonas del Pacífico tropical",
    weeklyLoading: "Preparando la serie semanal…",
    thresholdNote: "Las líneas punteadas marcan ±0,5 °C como referencia. Una semana cálida o fría, por sí sola, no confirma El Niño ni La Niña.",
    latestObservation: "Última observación", regionsTitle: "Temperatura por zona del Pacífico",
    comparisonKicker: "Comparación dentro del año", comparisonTitle: "¿Cómo se comporta cada zona de enero a diciembre?",
    comparisonInitial: "Cada línea representa un año. Los datos semanales se resumen en promedios mensuales para facilitar la comparación.",
    comparisonControlsAria: "Controles de la comparación anual", zoneLabel: "Zona",
    comparisonRegionAria: "Zona del Pacífico para comparar", comparisonStartYearAria: "Año inicial de la comparación",
    legendAria: "Leyenda", previousYears: "Años anteriores", currentYearPlaceholder: "Año actual",
    comparisonChartAria: "Comparación de enero a diciembre por años para una zona del Pacífico tropical",
    comparisonLoading: "Preparando la comparación anual…",
    historyKicker: "Evolución de largo plazo", historyTitle: "¿El calentamiento se mantiene durante varios meses?",
    historyDescription: "Este indicador promedia tres meses de temperatura en el Pacífico central y la compara con el resto de los trópicos. NOAA lo denomina Índice Oceánico Relativo, o RONI.",
    historyStartYearAria: "Año inicial del gráfico histórico del promedio oceánico", neutral: "Neutral",
    historyChartAria: "Serie histórica del promedio oceánico de tres meses desde 1950", historyLoading: "Preparando el historial…",
    methodKicker: "Cómo interpretar los datos", methodTitle: "Primero observa dónde cambia.<br>Luego comprueba cuánto dura.",
    step1Title: "Empieza por la costa", step1Body: "La zona Niño 1+2 está frente a Ecuador y Perú. Puede calentarse con fuerza sin que todo el Pacífico esté bajo condiciones de El Niño.",
    step2Title: "Observa si avanza hacia el centro", step2Body: "La zona Niño 3.4 permite saber si el calentamiento también alcanza el Pacífico central, una condición importante para El Niño.",
    step3Title: "Comprueba si dura varios meses", step3Body: "El indicador de tres meses reduce los cambios pasajeros y permite distinguir una variación semanal de una señal oceánica persistente.",
    transparency: "Transparencia", sourcesTitle: "Fuentes y actualización",
    footerSource: "<strong>Monitoreo de temperatura superficial del mar</strong> · Visualización independiente con datos públicos de NOAA/CPC.",
    footerDisclaimer: "El tablero describe la señal oceánica; no sustituye los avisos oficiales ni constituye un pronóstico.",
    loadError: "No fue posible cargar los datos. Intenta nuevamente en unos minutos.",
    lastUpdated: "Datos actualizados al {date}",
    weeklySummary: "{count} semanas desde {year}. Los valores positivos indican más calor de lo normal; los negativos, más frío.",
    differenceAxis: "Diferencia frente a lo normal (°C)", monthAxis: "Mes",
    comparisonSummary: "{region}: {count} líneas, una por año desde {year}. Los años anteriores aparecen en gris y {currentYear} en rojo.",
    threeMonthDataset: "Promedio de tres meses", differenceTooltip: "Diferencia frente a lo normal",
    trendStable: "estable en cuatro semanas", trendRose: "subió <strong>{value} °C</strong> en cuatro semanas", trendFell: "bajó <strong>{value} °C</strong> en cuatro semanas",
    weekOf: "Semana del {date}", relativeToTropics: "Frente al promedio tropical", observedTemperature: "Temperatura observada",
    signalPrefix: "La señal {trend}.", viewSource: "Ver fuente ↗", sourceAsOf: "hasta {date}", seasonYear: "{season} de {year}",
    weeklyError: "No se pudo cargar la serie semanal.", comparisonError: "No se pudo cargar la comparación anual.", historyError: "No se pudo cargar el historial.",
    csvDate: "fecha", csvFilename: "anomalias-nino-desde-{year}.csv",
  },
  en: {
    metaTitle: "Sea surface temperature and El Niño",
    metaDescription: "Public dashboard showing how much the tropical Pacific is warming or cooling and whether conditions associated with El Niño persist.",
    ogDescription: "Weekly monitoring of the tropical Pacific using official NOAA data.",
    skipLink: "Skip to content", navLabel: "Main navigation", homeLabel: "Home",
    brand: "Tropical Pacific temperature", officialSources: "Official NOAA sources",
    languageSwitch: "Español", languageAria: "Switch to Spanish",
    weeklyKicker: "Weekly temperature change", weeklyTitle: "Which regions are warmer than normal?",
    weeklyInitial: "Each value shows how many degrees a region is above or below the tropical average.",
    downloadCsv: "Download CSV", weeklyControlsAria: "Weekly chart controls", regionsAria: "Niño regions",
    regionsLabel: "Regions", startYear: "Start year", weeklyStartYearAria: "Start year for the weekly chart",
    weeklyChartAria: "Chart of weekly temperature differences across four tropical Pacific regions",
    weeklyLoading: "Preparing the weekly series…",
    thresholdNote: "The dotted lines mark ±0.5 °C as a reference. A single warm or cold week does not confirm El Niño or La Niña.",
    latestObservation: "Latest observation", regionsTitle: "Temperature by Pacific region",
    comparisonKicker: "Within-year comparison", comparisonTitle: "How does each region evolve from January to December?",
    comparisonInitial: "Each line represents one year. Weekly data are summarized as monthly averages for easier comparison.",
    comparisonControlsAria: "Annual comparison controls", zoneLabel: "Region",
    comparisonRegionAria: "Pacific region to compare", comparisonStartYearAria: "Start year for the comparison",
    legendAria: "Legend", previousYears: "Previous years", currentYearPlaceholder: "Current year",
    comparisonChartAria: "January-to-December comparison by year for a tropical Pacific region",
    comparisonLoading: "Preparing the annual comparison…",
    historyKicker: "Long-term evolution", historyTitle: "Does the warming persist for several months?",
    historyDescription: "This indicator averages three months of temperature in the central Pacific and compares it with the rest of the tropics. NOAA calls it the Relative Oceanic Niño Index, or RONI.",
    historyStartYearAria: "Start year for the historical ocean-average chart", neutral: "Neutral",
    historyChartAria: "Historical three-month ocean-average series since 1950", historyLoading: "Preparing the historical series…",
    methodKicker: "How to interpret the data", methodTitle: "First, see where it changes.<br>Then, check how long it lasts.",
    step1Title: "Start with the coast", step1Body: "The Niño 1+2 region lies off Ecuador and Peru. It can warm sharply without the entire Pacific experiencing El Niño conditions.",
    step2Title: "See whether it reaches the center", step2Body: "The Niño 3.4 region shows whether warming also reaches the central Pacific, an important condition for El Niño.",
    step3Title: "Check whether it lasts for months", step3Body: "The three-month indicator reduces short-lived changes and helps distinguish a weekly fluctuation from a persistent ocean signal.",
    transparency: "Transparency", sourcesTitle: "Sources and updates",
    footerSource: "<strong>Sea surface temperature monitoring</strong> · Independent visualization using public NOAA/CPC data.",
    footerDisclaimer: "The dashboard describes the ocean signal; it does not replace official advisories and is not a forecast.",
    loadError: "The data could not be loaded. Please try again in a few minutes.",
    lastUpdated: "Data updated through {date}",
    weeklySummary: "{count} weeks since {year}. Positive values mean warmer than normal; negative values mean cooler.",
    differenceAxis: "Difference from normal (°C)", monthAxis: "Month",
    comparisonSummary: "{region}: {count} lines, one per year since {year}. Previous years are gray and {currentYear} is red.",
    threeMonthDataset: "Three-month average", differenceTooltip: "Difference from normal",
    trendStable: "was stable over four weeks", trendRose: "rose <strong>{value} °C</strong> over four weeks", trendFell: "fell <strong>{value} °C</strong> over four weeks",
    weekOf: "Week of {date}", relativeToTropics: "Relative to the tropical average", observedTemperature: "Observed temperature",
    signalPrefix: "The signal {trend}.", viewSource: "View source ↗", sourceAsOf: "through {date}", seasonYear: "{season} {year}",
    weeklyError: "The weekly series could not be loaded.", comparisonError: "The annual comparison could not be loaded.", historyError: "The historical series could not be loaded.",
    csvDate: "date", csvFilename: "nino-anomalies-since-{year}.csv",
  },
};

const state = {
  language: "es",
  data: null,
  regions: new Set(["nino34"]),
  weeklyStartYear: null,
  comparisonRegion: "nino12",
  comparisonStartYear: null,
  roniStartYear: null,
  weeklyChart: null,
  comparisonChart: null,
  roniChart: null,
};

function t(key, values = {}) {
  const template = TRANSLATIONS[state.language][key] ?? TRANSLATIONS.es[key] ?? key;
  return template.replace(/\{(\w+)\}/g, (_match, name) => values[name] ?? `{${name}}`);
}

function locale() {
  return state.language === "en" ? "en-US" : "es-EC";
}

function regionCopy(region) {
  return REGION_META[region][state.language];
}

function sourceCopy(source) {
  return SOURCE_META[source][state.language];
}

function parseIsoDate(value) {
  return new Date(`${value}T00:00:00Z`);
}

function formatDate(value) {
  return new Intl.DateTimeFormat(locale(), { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
    .format(parseIsoDate(value)).replace(".", "");
}

function formatLongDate(value) {
  return new Intl.DateTimeFormat(locale(), { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
    .format(parseIsoDate(value));
}

function loadStateFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const requestedLanguage = params.get("lang");
  let storedLanguage = null;
  try { storedLanguage = localStorage.getItem("enso-language"); } catch (_error) { /* Storage may be unavailable. */ }
  if (["es", "en"].includes(requestedLanguage)) state.language = requestedLanguage;
  else if (["es", "en"].includes(storedLanguage)) state.language = storedLanguage;
  const weeklyStartYear = Number(params.get("desde_semana"));
  const comparisonStartYear = Number(params.get("desde_comparacion"));
  const roniStartYear = Number(params.get("desde_roni"));
  if (Number.isInteger(weeklyStartYear) && weeklyStartYear > 1900) state.weeklyStartYear = weeklyStartYear;
  if (Number.isInteger(comparisonStartYear) && comparisonStartYear > 1900) state.comparisonStartYear = comparisonStartYear;
  if (Number.isInteger(roniStartYear) && roniStartYear > 1900) state.roniStartYear = roniStartYear;
  const comparisonRegion = params.get("comparar");
  if (comparisonRegion in REGION_META) state.comparisonRegion = comparisonRegion;
  const regions = (params.get("regiones") || "").split(",").filter((key) => key in REGION_META);
  if (regions.length) state.regions = new Set(regions);
}

function syncUrl() {
  const params = new URLSearchParams();
  params.set("lang", state.language);
  params.set("desde_semana", state.weeklyStartYear);
  params.set("comparar", state.comparisonRegion);
  params.set("desde_comparacion", state.comparisonStartYear);
  params.set("desde_roni", state.roniStartYear);
  params.set("regiones", [...state.regions].join(","));
  history.replaceState(null, "", `${window.location.pathname}?${params}`);
}

function signed(value) {
  return new Intl.NumberFormat(locale(), { minimumFractionDigits: 1, maximumFractionDigits: 1, signDisplay: "always" })
    .format(value).replace("-", "−");
}

function decimal(value, digits = 1) {
  return new Intl.NumberFormat(locale(), { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
}

function applyLanguage() {
  document.documentElement.lang = state.language;
  document.title = t("metaTitle");
  document.querySelector('meta[name="description"]').content = t("metaDescription");
  document.querySelector('meta[property="og:title"]').content = t("metaTitle");
  document.querySelector('meta[property="og:description"]').content = t("ogDescription");
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = t(element.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-html]").forEach((element) => {
    element.innerHTML = t(element.dataset.i18nHtml);
  });
  document.querySelectorAll("[data-i18n-aria-label]").forEach((element) => {
    element.setAttribute("aria-label", t(element.dataset.i18nAriaLabel));
  });

  const languageToggle = document.querySelector("#languageToggle");
  languageToggle.textContent = t("languageSwitch");
  languageToggle.setAttribute("aria-label", t("languageAria"));
  languageToggle.lang = state.language === "es" ? "en" : "es";

  document.querySelectorAll("#regionControls [data-region]").forEach((button) => {
    button.innerHTML = `<i></i>${regionCopy(button.dataset.region).control}`;
  });
  document.querySelectorAll("#comparisonRegion option").forEach((option) => {
    option.textContent = regionCopy(option.value).control;
  });
  if (!state.data) {
    document.querySelector("#weeklyUpdated").textContent = t("lastUpdated", { date: "—" });
    document.querySelector("#weeklyAsOf").textContent = t("weekOf", { date: "—" });
    document.querySelector("#comparisonCurrentYear").textContent = t("currentYearPlaceholder");
    if (!document.querySelector("#errorBanner").hidden) {
      document.querySelector("#weeklyLoading").textContent = t("weeklyError");
      document.querySelector("#comparisonLoading").textContent = t("comparisonError");
      document.querySelector("#roniLoading").textContent = t("historyError");
    }
  }
}

function getWeeklyWindow() {
  return state.data.weekly.filter((row) => Number(row.date.slice(0, 4)) >= state.weeklyStartYear);
}

function getRoniWindow() {
  return state.data.roni.filter((row) => row.year >= state.roniStartYear);
}

function uniqueYears(rows) {
  return [...new Set(rows.map((row) => Number(row.date.slice(0, 4))))];
}

function populateYearSelect(id, years, selected) {
  const select = document.querySelector(id);
  select.innerHTML = years.map((year) => `<option value="${year}"${year === selected ? " selected" : ""}>${year}</option>`).join("");
}

function initializeYearControls() {
  const weeklyYears = uniqueYears(state.data.weekly);
  const roniYears = uniqueYears(state.data.roni);
  const weeklyMin = weeklyYears[0];
  const weeklyMax = weeklyYears.at(-1);
  const roniMin = roniYears[0];
  const roniMax = roniYears.at(-1);

  state.weeklyStartYear = Math.min(weeklyMax, Math.max(weeklyMin, state.weeklyStartYear ?? weeklyMax - 2));
  state.comparisonStartYear = Math.min(weeklyMax, Math.max(weeklyMin, state.comparisonStartYear ?? weeklyMax - 10));
  state.roniStartYear = Math.min(roniMax, Math.max(roniMin, state.roniStartYear ?? roniMin));
  populateYearSelect("#weeklyStartYear", weeklyYears, state.weeklyStartYear);
  populateYearSelect("#comparisonStartYear", weeklyYears, state.comparisonStartYear);
  populateYearSelect("#roniStartYear", roniYears, state.roniStartYear);
}

const zonePlugin = {
  id: "ensoZones",
  beforeDraw(chart, _args, options) {
    if (!options?.enabled || !chart.chartArea) return;
    const { ctx, chartArea, scales } = chart;
    const yWarm = scales.y.getPixelForValue(0.5);
    const yCold = scales.y.getPixelForValue(-0.5);
    ctx.save();
    ctx.fillStyle = "rgba(240, 90, 71, .055)";
    ctx.fillRect(chartArea.left, chartArea.top, chartArea.right - chartArea.left, yWarm - chartArea.top);
    ctx.fillStyle = "rgba(22, 143, 189, .055)";
    ctx.fillRect(chartArea.left, yCold, chartArea.right - chartArea.left, chartArea.bottom - yCold);
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = "rgba(75, 96, 107, .45)";
    [yWarm, yCold].forEach((y) => {
      ctx.beginPath();
      ctx.moveTo(chartArea.left, y);
      ctx.lineTo(chartArea.right, y);
      ctx.stroke();
    });
    ctx.restore();
  },
};

function chartDefaults() {
  Chart.defaults.color = "#667985";
  Chart.defaults.font.family = '"DM Sans", system-ui, sans-serif';
  Chart.defaults.borderColor = "rgba(16, 43, 58, .09)";
}

function renderWeeklyChart() {
  const rows = getWeeklyWindow();
  const datasets = [...state.regions].map((region) => ({
    label: regionCopy(region).label,
    data: rows.map((row) => row[region]),
    borderColor: REGION_META[region].color,
    backgroundColor: REGION_META[region].color,
    borderWidth: region === "nino34" || region === "nino12" ? 2.4 : 1.9,
    pointRadius: 0,
    pointHoverRadius: 4,
    pointHitRadius: 12,
    tension: 0.22,
  }));

  const config = {
    type: "line",
    data: { labels: rows.map((row) => row.date), datasets },
    plugins: [zonePlugin],
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 350 },
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        ensoZones: { enabled: true },
        tooltip: {
          backgroundColor: "#071f33",
          padding: 12,
          titleFont: { weight: "600" },
          callbacks: {
            title: (items) => formatDate(items[0].label),
            label: (item) => ` ${item.dataset.label}: ${signed(item.raw)} °C`,
          },
        },
        decimation: { enabled: true, algorithm: "min-max" },
      },
      scales: {
        x: {
          grid: { display: false },
          border: { display: false },
          ticks: {
            maxTicksLimit: window.innerWidth < 640 ? 5 : 9,
            maxRotation: 0,
            callback: (_value, index) => {
              const d = parseIsoDate(rows[index].date);
              return d.toLocaleDateString(locale(), { month: "short", year: "2-digit", timeZone: "UTC" }).replace(".", "");
            },
          },
        },
        y: {
          suggestedMin: -2,
          suggestedMax: 2,
          border: { display: false },
          ticks: { callback: (value) => `${value > 0 ? "+" : ""}${value}°` },
          title: { display: true, text: t("differenceAxis"), color: "#667985", font: { size: 11, weight: "500" } },
        },
      },
    },
  };

  if (state.weeklyChart) state.weeklyChart.destroy();
  state.weeklyChart = new Chart(document.querySelector("#weeklyChart"), config);
  document.querySelector("#weeklyLoading").classList.add("hidden");
  document.querySelector("#weeklyUpdated").textContent = t("lastUpdated", {
    date: formatLongDate(state.data.meta.main_observation_date),
  });
  document.querySelector("#weeklySummary").textContent = t("weeklySummary", {
    count: rows.length.toLocaleString(locale()),
    year: state.weeklyStartYear,
  });
}

function getMonthlyComparisonSeries() {
  const byYear = new Map();
  state.data.weekly.forEach((row) => {
    const year = Number(row.date.slice(0, 4));
    if (year < state.comparisonStartYear) return;
    const month = Number(row.date.slice(5, 7)) - 1;
    if (!byYear.has(year)) byYear.set(year, Array.from({ length: 12 }, () => []));
    byYear.get(year)[month].push(row[state.comparisonRegion]);
  });
  return [...byYear.entries()].map(([year, months]) => ({
    year,
    values: months.map((values) => values.length
      ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2))
      : null),
  }));
}

function renderComparisonChart() {
  const series = getMonthlyComparisonSeries();
  const monthLabels = MONTH_LABELS[state.language];
  const currentYear = series.at(-1).year;
  const previousColor = "rgba(102, 121, 133, .34)";
  const currentColor = "#d84335";
  const datasets = series.map(({ year, values }) => ({
    label: String(year),
    data: values,
    borderColor: year === currentYear ? currentColor : previousColor,
    backgroundColor: year === currentYear ? currentColor : previousColor,
    borderWidth: year === currentYear ? 3 : 1.35,
    pointRadius: 0,
    pointHoverRadius: year === currentYear ? 4 : 2.5,
    pointHitRadius: 10,
    tension: 0.32,
    spanGaps: false,
    order: year === currentYear ? 0 : 1,
  }));

  const config = {
    type: "line",
    data: { labels: monthLabels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 350 },
      interaction: { mode: "nearest", intersect: false, axis: "xy" },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#071f33",
          padding: 12,
          mode: "nearest",
          intersect: false,
          callbacks: {
            title: (items) => monthLabels[items[0].dataIndex],
            label: (item) => ` ${item.dataset.label}: ${signed(item.raw)} °C`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          border: { display: false },
          ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: window.innerWidth < 640 ? 4 : 12 },
          title: { display: true, text: t("monthAxis"), color: "#667985", font: { size: 11, weight: "500" } },
        },
        y: {
          suggestedMin: -2.5,
          suggestedMax: 3,
          border: { display: false },
          grid: { color: (context) => context.tick.value === 0 ? "rgba(16, 43, 58, .34)" : "rgba(16, 43, 58, .09)" },
          ticks: { callback: (value) => `${value > 0 ? "+" : ""}${value}°` },
          title: { display: true, text: t("differenceAxis"), color: "#667985", font: { size: 11, weight: "500" } },
        },
      },
    },
  };

  if (state.comparisonChart) state.comparisonChart.destroy();
  state.comparisonChart = new Chart(document.querySelector("#comparisonChart"), config);
  document.querySelector("#comparisonLoading").classList.add("hidden");
  document.querySelector("#comparisonCurrentYear").textContent = String(currentYear);
  document.querySelector("#comparisonSummary").textContent = t("comparisonSummary", {
    region: regionCopy(state.comparisonRegion).label,
    count: series.length.toLocaleString(locale()),
    year: state.comparisonStartYear,
    currentYear,
  });
}

function renderRoniChart() {
  const rows = getRoniWindow();
  const config = {
    type: "line",
    data: {
      labels: rows.map((row) => row.date),
      datasets: [{
        label: t("threeMonthDataset"),
        data: rows.map((row) => row.value),
        borderColor: "#123f58",
        backgroundColor: "#123f58",
        borderWidth: 1.45,
        pointRadius: 0,
        pointHoverRadius: 3.5,
        pointHitRadius: 10,
        tension: 0.12,
      }],
    },
    plugins: [zonePlugin],
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        ensoZones: { enabled: true },
        tooltip: {
          backgroundColor: "#071f33",
          padding: 12,
          callbacks: {
            title: (items) => `${rows[items[0].dataIndex].season} ${rows[items[0].dataIndex].year}`,
            label: (item) => ` ${t("differenceTooltip")}: ${signed(item.raw)} °C`,
          },
        },
        decimation: { enabled: true, algorithm: "min-max" },
      },
      scales: {
        x: {
          grid: { display: false },
          border: { display: false },
          ticks: {
            maxTicksLimit: window.innerWidth < 640 ? 5 : 10,
            maxRotation: 0,
            callback: (_value, index) => rows[index].year,
          },
        },
        y: {
          suggestedMin: -2.5,
          suggestedMax: 2.5,
          border: { display: false },
          ticks: { callback: (value) => `${value > 0 ? "+" : ""}${value}°` },
        },
      },
    },
  };
  if (state.roniChart) state.roniChart.destroy();
  state.roniChart = new Chart(document.querySelector("#roniChart"), config);
  document.querySelector("#roniLoading").classList.add("hidden");
}

function trendCopy(region) {
  const rows = state.data.weekly;
  const current = rows.at(-1)[region];
  const previous = rows.at(-5)?.[region] ?? current;
  const delta = current - previous;
  if (Math.abs(delta) < 0.05) return t("trendStable");
  return t(delta > 0 ? "trendRose" : "trendFell", { value: signed(Math.abs(delta)) });
}

function renderRegions() {
  const current = state.data.current.weekly;
  document.querySelector("#weeklyAsOf").textContent = t("weekOf", { date: formatDate(current.date) });
  const grid = document.querySelector("#regionGrid");
  grid.innerHTML = Object.entries(REGION_META).map(([key, meta]) => `
    <article class="region-card" style="--region-color:${meta.color}">
      <div class="region-name"><h3>${regionCopy(key).label}</h3><span>${regionCopy(key).place}</span></div>
      <div class="region-anomaly">${signed(current[key])}<small>°C</small></div>
      <p class="region-measure">${t("relativeToTropics")}</p>
      <p class="region-sst">${t("observedTemperature")}: <strong>${decimal(current[`${key}_sst`])} °C</strong></p>
      <p class="region-trend">${t("signalPrefix", { trend: trendCopy(key) })}</p>
    </article>
  `).join("");
}

function renderSources() {
  const list = document.querySelector("#sourceList");
  list.innerHTML = Object.entries(state.data.meta.sources).map(([key, source]) => {
    const latest = key === "roni"
      ? t("seasonYear", {
        season: SEASON_LABELS[state.language][state.data.current.roni.season],
        year: state.data.current.roni.year,
      })
      : formatDate(source.latest_observation);
    return `
      <a class="source-item" href="${source.url}" target="_blank" rel="noreferrer">
        <span><strong>${sourceCopy(key).label}</strong>${sourceCopy(key).detail} · ${t("sourceAsOf", { date: latest })}</span>
        <b>${t("viewSource")}</b>
      </a>
    `;
  }).join("");
}

function updateControls() {
  document.querySelectorAll("[data-region]").forEach((button) => {
    button.setAttribute("aria-pressed", state.regions.has(button.dataset.region));
  });
  document.querySelector("#weeklyStartYear").value = String(state.weeklyStartYear);
  document.querySelector("#comparisonRegion").value = state.comparisonRegion;
  document.querySelector("#comparisonStartYear").value = String(state.comparisonStartYear);
  document.querySelector("#roniStartYear").value = String(state.roniStartYear);
}

function bindControls() {
  document.querySelector("#languageToggle").addEventListener("click", () => {
    state.language = state.language === "es" ? "en" : "es";
    try { localStorage.setItem("enso-language", state.language); } catch (_error) { /* Storage may be unavailable. */ }
    applyLanguage();
    updateControls();
    if (state.data) {
      renderWeeklyChart();
      renderComparisonChart();
      renderRoniChart();
      renderRegions();
      renderSources();
    }
    syncUrl();
  });
  document.querySelector("#regionControls").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-region]");
    if (!button) return;
    const region = button.dataset.region;
    if (state.regions.has(region) && state.regions.size === 1) return;
    state.regions.has(region) ? state.regions.delete(region) : state.regions.add(region);
    updateControls();
    syncUrl();
    renderWeeklyChart();
  });
  document.querySelector("#weeklyStartYear").addEventListener("change", (event) => {
    state.weeklyStartYear = Number(event.target.value);
    updateControls();
    syncUrl();
    renderWeeklyChart();
  });
  document.querySelector("#comparisonRegion").addEventListener("change", (event) => {
    state.comparisonRegion = event.target.value;
    updateControls();
    syncUrl();
    renderComparisonChart();
  });
  document.querySelector("#comparisonStartYear").addEventListener("change", (event) => {
    state.comparisonStartYear = Number(event.target.value);
    updateControls();
    syncUrl();
    renderComparisonChart();
  });
  document.querySelector("#roniStartYear").addEventListener("change", (event) => {
    state.roniStartYear = Number(event.target.value);
    updateControls();
    syncUrl();
    renderRoniChart();
  });
  document.querySelector("#downloadCsv").addEventListener("click", downloadCsv);
}

function downloadCsv() {
  const regions = [...state.regions];
  const header = [t("csvDate"), ...regions.map((key) => `${key}_relative_anomaly_c`)];
  const rows = getWeeklyWindow().map((row) => [row.date, ...regions.map((key) => row[key])]);
  const csv = [header, ...rows].map((row) => row.join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = t("csvFilename", { year: state.weeklyStartYear });
  anchor.click();
  URL.revokeObjectURL(url);
}

async function init() {
  loadStateFromUrl();
  applyLanguage();
  bindControls();
  try {
    const response = await fetch("data/enso.json", { cache: "no-cache" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.data = await response.json();
    if (!window.Chart) throw new Error("Chart.js no esta disponible");
    chartDefaults();
    initializeYearControls();
    updateControls();
    renderWeeklyChart();
    renderComparisonChart();
    renderRoniChart();
    renderRegions();
    renderSources();
    syncUrl();
  } catch (error) {
    console.error(error);
    document.querySelector("#errorBanner").hidden = false;
    document.querySelector("#weeklyLoading").textContent = t("weeklyError");
    document.querySelector("#comparisonLoading").textContent = t("comparisonError");
    document.querySelector("#roniLoading").textContent = t("historyError");
  }
}

init();

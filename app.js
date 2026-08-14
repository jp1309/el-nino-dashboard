"use strict";

const REGION_META = {
  nino12: { label: "Niño 1+2", color: "#f05a47", place: "Costa Ecuador–Perú" },
  nino3: { label: "Niño 3", color: "#e59b28", place: "Pacífico oriental" },
  nino34: { label: "Niño 3.4", color: "#168fbd", place: "Pacífico centro-oriental" },
  nino4: { label: "Niño 4", color: "#6656c8", place: "Pacífico central" },
};

const SOURCE_META = {
  relative_weekly: { label: "SST relativa semanal", detail: "OISST v2.1 · cuatro regiones Niño" },
  absolute_weekly: { label: "Temperatura semanal", detail: "OISST v2.1 · SST y anomalía convencional" },
  roni: { label: "Índice RONI estacional", detail: "ERSST · promedio móvil de Niño 3.4" },
};

const state = {
  data: null,
  regions: new Set(["nino12", "nino34"]),
  weeklyStartYear: null,
  roniStartYear: null,
  weeklyChart: null,
  roniChart: null,
};

const number = new Intl.NumberFormat("es-EC", { minimumFractionDigits: 1, maximumFractionDigits: 1, signDisplay: "always" });
const dateFormat = new Intl.DateTimeFormat("es-EC", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

function parseIsoDate(value) {
  return new Date(`${value}T00:00:00Z`);
}

function formatDate(value) {
  return dateFormat.format(parseIsoDate(value)).replace(".", "");
}

function loadStateFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const weeklyStartYear = Number(params.get("desde_semana"));
  const roniStartYear = Number(params.get("desde_roni"));
  if (Number.isInteger(weeklyStartYear) && weeklyStartYear > 1900) state.weeklyStartYear = weeklyStartYear;
  if (Number.isInteger(roniStartYear) && roniStartYear > 1900) state.roniStartYear = roniStartYear;
  const regions = (params.get("regiones") || "").split(",").filter((key) => key in REGION_META);
  if (regions.length) state.regions = new Set(regions);
}

function syncUrl() {
  const params = new URLSearchParams();
  params.set("desde_semana", state.weeklyStartYear);
  params.set("desde_roni", state.roniStartYear);
  params.set("regiones", [...state.regions].join(","));
  history.replaceState(null, "", `${window.location.pathname}?${params}`);
}

function signed(value) {
  return number.format(value).replace("+", "+").replace("-", "−");
}

function classCopy(classification, count) {
  if (classification === "warm") {
    return count >= 5 ? "Señal oceánica cálida persistente" : "Calentamiento oceánico en desarrollo";
  }
  if (classification === "cold") {
    return count >= 5 ? "Señal oceánica fría persistente" : "Enfriamiento oceánico en desarrollo";
  }
  return "Señal oceánica neutral";
}

function renderHeadline() {
  const { current, meta } = state.data;
  const roni = current.roni;
  document.querySelector("#roniValue").textContent = signed(roni.value);
  document.querySelector("#roniStatus").textContent = classCopy(roni.classification, roni.consecutive_seasons);
  const seasonCount = roni.consecutive_seasons || "sin";
  const seasonWord = roni.consecutive_seasons === 1 ? "temporada consecutiva" : "temporadas consecutivas";
  document.querySelector("#roniMeta").textContent = `${roni.season} ${roni.year} · ${seasonCount} ${seasonWord} fuera de neutral`;

  const ageDays = Math.floor((Date.now() - parseIsoDate(meta.main_observation_date)) / 86_400_000);
  const freshness = document.querySelector("#freshnessLabel");
  freshness.textContent = ageDays <= 21 ? "Datos recientes" : "Fuente con rezago";
  freshness.parentElement.classList.toggle("stale", ageDays > 21);
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
  state.roniStartYear = Math.min(roniMax, Math.max(roniMin, state.roniStartYear ?? roniMin));
  populateYearSelect("#weeklyStartYear", weeklyYears, state.weeklyStartYear);
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
    label: REGION_META[region].label,
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
              return d.toLocaleDateString("es-EC", { month: "short", year: "2-digit", timeZone: "UTC" }).replace(".", "");
            },
          },
        },
        y: {
          suggestedMin: -2,
          suggestedMax: 2,
          border: { display: false },
          ticks: { callback: (value) => `${value > 0 ? "+" : ""}${value}°` },
          title: { display: true, text: "Anomalía relativa (°C)", color: "#667985", font: { size: 11, weight: "500" } },
        },
      },
    },
  };

  if (state.weeklyChart) state.weeklyChart.destroy();
  state.weeklyChart = new Chart(document.querySelector("#weeklyChart"), config);
  document.querySelector("#weeklyLoading").classList.add("hidden");
  document.querySelector("#weeklySummary").textContent = `${rows.length.toLocaleString("es-EC")} semanas desde ${state.weeklyStartYear} · anomalía respecto al promedio tropical.`;
}

function renderRoniChart() {
  const rows = getRoniWindow();
  const config = {
    type: "line",
    data: {
      labels: rows.map((row) => row.date),
      datasets: [{
        label: "RONI",
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
            label: (item) => ` RONI: ${signed(item.raw)} °C`,
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
  state.roniChart = new Chart(document.querySelector("#roniChart"), config);
  document.querySelector("#roniLoading").classList.add("hidden");
}

function trendCopy(region) {
  const rows = state.data.weekly;
  const current = rows.at(-1)[region];
  const previous = rows.at(-5)?.[region] ?? current;
  const delta = current - previous;
  if (Math.abs(delta) < 0.05) return "estable en cuatro semanas";
  return `${delta > 0 ? "subió" : "bajó"} <strong>${signed(Math.abs(delta))} °C</strong> en cuatro semanas`;
}

function renderRegions() {
  const current = state.data.current.weekly;
  document.querySelector("#weeklyAsOf").textContent = `Semana del ${formatDate(current.date)}`;
  const grid = document.querySelector("#regionGrid");
  grid.innerHTML = Object.entries(REGION_META).map(([key, meta]) => `
    <article class="region-card" style="--region-color:${meta.color}">
      <div class="region-name"><h3>${meta.label}</h3><span>${meta.place}</span></div>
      <div class="region-anomaly">${signed(current[key])}<small>°C</small></div>
      <p class="region-sst">Temperatura observada: <strong>${current[`${key}_sst`].toFixed(1)} °C</strong></p>
      <p class="region-trend">La señal ${trendCopy(key)}.</p>
    </article>
  `).join("");
}

function renderSources() {
  const list = document.querySelector("#sourceList");
  list.innerHTML = Object.entries(state.data.meta.sources).map(([key, source]) => {
    const latest = key === "roni"
      ? `${state.data.current.roni.season} ${state.data.current.roni.year}`
      : formatDate(source.latest_observation);
    return `
      <a class="source-item" href="${source.url}" target="_blank" rel="noreferrer">
        <span><strong>${SOURCE_META[key].label}</strong>${SOURCE_META[key].detail} · al ${latest}</span>
        <b>Ver fuente ↗</b>
      </a>
    `;
  }).join("");
}

function updateControls() {
  document.querySelectorAll("[data-region]").forEach((button) => {
    button.setAttribute("aria-pressed", state.regions.has(button.dataset.region));
  });
  document.querySelector("#weeklyStartYear").value = String(state.weeklyStartYear);
  document.querySelector("#roniStartYear").value = String(state.roniStartYear);
}

function bindControls() {
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
  document.querySelector("#roniStartYear").addEventListener("change", (event) => {
    state.roniStartYear = Number(event.target.value);
    updateControls();
    syncUrl();
    if (state.roniChart) state.roniChart.destroy();
    renderRoniChart();
  });
  document.querySelector("#downloadCsv").addEventListener("click", downloadCsv);
}

function downloadCsv() {
  const regions = [...state.regions];
  const header = ["fecha", ...regions.map((key) => `${key}_anomalia_relativa_c`)];
  const rows = getWeeklyWindow().map((row) => [row.date, ...regions.map((key) => row[key])]);
  const csv = [header, ...rows].map((row) => row.join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `anomalias-nino-desde-${state.weeklyStartYear}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function init() {
  loadStateFromUrl();
  bindControls();
  try {
    const response = await fetch("data/enso.json", { cache: "no-cache" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.data = await response.json();
    if (!window.Chart) throw new Error("Chart.js no esta disponible");
    chartDefaults();
    initializeYearControls();
    updateControls();
    renderHeadline();
    renderWeeklyChart();
    renderRoniChart();
    renderRegions();
    renderSources();
    syncUrl();
  } catch (error) {
    console.error(error);
    document.querySelector("#errorBanner").hidden = false;
    document.querySelector("#weeklyLoading").textContent = "No se pudo cargar la serie semanal.";
    document.querySelector("#roniLoading").textContent = "No se pudo cargar la historia RONI.";
  }
}

init();

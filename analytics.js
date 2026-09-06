"use strict";

// Pure calculations shared by the dashboard and Node tests. Dates are UTC.
const EnsoAnalytics = (() => {
  const day = 86400000;
  const time = (date) => Date.parse(`${date}T00:00:00Z`);
  const mean = (values) => values.length && values.every(Number.isFinite)
    ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  const phase = (value) => value >= 0.5 ? "warm" : value <= -0.5 ? "cold" : "neutral";
  function delta(rows, key, weeks) {
    const latest = rows.at(-1);
    const previous = rows.find((row) => time(row.date) === time(latest.date) - weeks * 7 * day);
    return previous && Number.isFinite(previous[key]) ? latest[key] - previous[key] : null;
  }
  function rolling(rows, key, count = 4) {
    return rows.map((row, index) => {
      const window = rows.slice(Math.max(0, index - count + 1), index + 1);
      return window.length === count && time(row.date) - time(window[0].date) === (count - 1) * 7 * day
        ? mean(window.map((item) => item[key])) : null;
    });
  }
  function persistence(rows) {
    const currentPhase = phase(rows.at(-1).value);
    if (currentPhase === "neutral") return 0;
    let count = 0;
    let nextMonth = null;
    for (const row of [...rows].reverse()) {
      const month = Number(row.date.slice(0, 4)) * 12 + Number(row.date.slice(5, 7));
      if (phase(row.value) !== currentPhase || (nextMonth !== null && nextMonth - month !== 1)) break;
      count++;
      nextMonth = month;
    }
    return count;
  }
  // One nearest calendar-date observation per previous year, at most 4 days away.
  // Compare season with season; never rank the current week against all months.
  function seasonalRank(rows, key) {
    const latest = rows.at(-1);
    const year = Number(latest.date.slice(0, 4));
    const calendarDay = (date) => Date.UTC(2000, Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10))) / day;
    const target = calendarDay(latest.date);
    const byYear = new Map();
    for (const row of rows) {
      const rowYear = Number(row.date.slice(0, 4));
      if (rowYear >= year || !Number.isFinite(row[key])) continue;
      const distance = Math.abs(calendarDay(row.date) - target);
      if (distance <= 4 && (!byYear.has(rowYear) || distance < byYear.get(rowYear).distance)) {
        byYear.set(rowYear, { value: row[key], distance });
      }
    }
    const values = [...byYear.values()].map((row) => row.value);
    if (!values.length) return null;
    const below = values.filter((value) => value < latest[key]).length;
    const equal = values.filter((value) => value === latest[key]).length;
    return { percentile: 100 * (below + 0.5 * equal) / values.length, count: values.length, median: quantile(values, 0.5) };
  }
  function quantile(values, p) {
    const sorted = [...values].sort((a, b) => a - b);
    const index = (sorted.length - 1) * p;
    const lower = Math.floor(index);
    return sorted[lower] + (sorted[Math.ceil(index)] - sorted[lower]) * (index - lower);
  }
  function seasonEnd(date) {
    const mid = new Date(time(date));
    return new Date(Date.UTC(mid.getUTCFullYear(), mid.getUTCMonth() + 2, 0)).toISOString().slice(0, 10);
  }
  function age(date, now = new Date()) { return Math.floor((now.getTime() - time(date)) / day); }
  return { mean, phase, delta, rolling, persistence, seasonalRank, quantile, seasonEnd, age };
})();
if (typeof module !== "undefined") module.exports = EnsoAnalytics;

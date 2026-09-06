const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const A = require('../analytics.js');

test('four-week change uses a date exactly 28 days earlier, not the fifth row', () => {
  const rows = [{date:'2026-01-01',v:1},{date:'2026-01-08',v:2},{date:'2026-01-15',v:3},{date:'2026-01-22',v:5},{date:'2026-01-29',v:8}];
  assert.equal(A.delta(rows,'v',4),7);
  assert.equal(A.delta(rows.slice(1),'v',4),null);
  rows[0].date='2025-12-31';
  assert.equal(A.delta(rows,'v',4),null);
});
test('moving average has no partial windows and refuses missing weeks or values', () => {
  const rows = ['01','08','15','22','29'].map((d,i)=>({date:`2026-01-${d}`,v:i+1}));
  assert.deepEqual(A.rolling(rows,'v'),[null,null,null,2.5,3.5]);
  assert.equal(A.rolling(rows.filter((_,i)=>i!==1),'v').at(-1),null);
  rows[3].v=undefined;
  assert.equal(A.rolling(rows,'v').at(-1),null);
});
test('persistence resets at neutral, sign changes and missing seasons, across years', () => {
  const rows = [{date:'2025-11-15',value:.49},{date:'2025-12-15',value:.5},{date:'2026-01-15',value:.7}];
  assert.equal(A.persistence(rows),2);
  assert.equal(A.persistence([...rows,{date:'2026-02-15',value:-.5}]),1);
  assert.equal(A.persistence([...rows,{date:'2026-02-15',value:0}]),0);
  assert.equal(A.persistence([...rows,{date:'2026-03-15',value:.9}]),1);
});
test('seasonal percentile uses one value per prior year, excludes other seasons and current year', () => {
  const rows = [{date:'2023-01-01',v:99},{date:'2023-08-23',v:1},{date:'2023-08-30',v:5},{date:'2024-08-25',v:2},{date:'2025-08-20',v:7},{date:'2026-08-19',v:100},{date:'2026-08-26',v:2}];
  assert.deepEqual(A.seasonalRank(rows,'v'),{percentile:75,count:2,median:1.5});
  assert.equal(A.seasonalRank([rows.at(-1)],'v'),null);
});
test('freshness of RONI is measured from the season end, including year rollover', () => {
  assert.equal(A.seasonEnd('2026-07-15'),'2026-08-31');
  assert.equal(A.seasonEnd('2026-12-15'),'2027-01-31');
  assert.equal(A.seasonEnd('2024-01-15'),'2024-02-29');
  assert.equal(A.age('2026-08-31',new Date('2026-09-05T12:00:00Z')),5);
});

const context = vm.createContext({console,Intl,URLSearchParams,Date,Set,Map,Blob});
for (const file of ['analytics.js','monitor.js','app.js']) {
  vm.runInContext(fs.readFileSync(require.resolve(`../${file}`),'utf8').replace(/\ninit\(\);\s*$/,''),context);
}
const run = (code) => vm.runInContext(code,context);
run(`state.data = ${fs.readFileSync(require.resolve('../data/enso.json'),'utf8')}`);
test('range selection restricts observed dates and custom year selection retains old shared URLs', () => {
  run('state.weeklyRange="12"');
  const count=run('getWeeklyWindow().length');
  assert.ok(count>=52 && count<=53);
  run('state.weeklyRange="custom"; state.weeklyStartYear=2026');
  assert.equal(run('getWeeklyWindow().every(row=>row.date.startsWith("2026"))'),true);
  run('state.weeklyRange="all";state.weeklyStartYear=1981');
  assert.equal(run('getWeeklyWindow().length'),run('state.data.weekly.length'));
});
test('CSV matches selected absolute measure and four-week smoothing', async () => {
  let blob;
  context.URL={createObjectURL:(value)=>{blob=value;return 'blob:test';},revokeObjectURL:()=>{}};
  context.document={createElement:()=>({click(){}})};
  run('state.weeklyRange="12";state.regions=new Set(["nino34"]);state.weeklyMetric="sst";state.smoothWeekly=true;downloadCsv()');
  const csv=(await blob.text()).trim().split('\n');
  assert.equal(csv[0],'fecha,nino34_sst_c_4week_mean');
  const dataset=JSON.parse(fs.readFileSync(require.resolve('../data/enso.json'),'utf8'));
  assert.equal(Number(csv.at(-1).split(',')[1]),A.mean(dataset.weekly.slice(-4).map(row=>row.nino34_sst)));
  assert.equal(csv.length-1,run('getWeeklyWindow().length'));
});

test('annual weekly comparison changes data, percentile and chart units independently', () => {
  const nodes = new Map();
  context.document = {querySelector: (selector) => {
    if (!nodes.has(selector)) nodes.set(selector, {classList: {add() {}}});
    return nodes.get(selector);
  }};
  context.Chart = class { constructor(_canvas, config) { this.config = config; } destroy() {} };
  context.window = {innerWidth: 1200};
  run('state.weeklyMetric="relative";state.comparisonStartYear=1990');
  for (const region of ['nino12', 'nino3', 'nino34', 'nino4']) {
    for (const metric of ['relative', 'anom', 'sst']) {
      run(`state.comparisonRegion="${region}";state.comparisonMetric="${metric}";renderComparisonChart()`);
      const key = metric === 'relative' ? region : `${region}_${metric}`;
      assert.equal(run('getWeeklyComparisonSeries().at(-1).values.at(-1).y'), run(`state.data.weekly.at(-1)["${key}"]`));
      assert.equal(run('state.weeklyMetric'), 'relative');
      const config = run('state.comparisonChart.config');
      assert.equal(config.options.plugins.ensoZones.enabled, metric !== 'sst');
      assert.equal(config.options.scales.y.suggestedMin, metric === 'sst' ? undefined : -2.5);
      assert.equal(config.options.scales.y.ticks.callback(25), metric === 'sst' ? '25°' : '+25°');
      const rank = run(`EnsoAnalytics.seasonalRank(state.data.weekly,"${key}")`);
      assert.ok(nodes.get('#historicalContext').innerHTML.includes(`P${Math.round(rank.percentile)}`));
      assert.equal(nodes.get('#comparisonMetricExplanation').textContent, run(`metricDescription("${metric}")`));
    }
  }
});

test('comparison measure survives shared URL reload independently of first chart', () => {
  context.window = {location: {pathname: '/', search: ''}};
  context.history = {replaceState: (_state, _title, url) => {context.window.location.search = url.slice(url.indexOf('?'));}};
  run('state.weeklyMetric="anom";state.comparisonMetric="sst";syncUrl();state.weeklyMetric="relative";state.comparisonMetric="relative";loadStateFromUrl()');
  assert.equal(run('state.weeklyMetric'), 'anom');
  assert.equal(run('state.comparisonMetric'), 'sst');
  context.window.location.search = '?medida_comparacion=invalid';
  run('state.comparisonMetric="relative";loadStateFromUrl()');
  assert.equal(run('state.comparisonMetric'), 'relative');
});

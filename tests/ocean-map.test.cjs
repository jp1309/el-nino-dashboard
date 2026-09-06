const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const M=require('../ocean-map.js');
const read=()=>JSON.parse(fs.readFileSync(require.resolve('../data/spatial.json'),'utf8'));

test('map rejects incomplete weeks, wrong grid and missing cells',()=>{
  const d=read();assert.equal(M.validate(d),d);
  d.frames[0].end=d.frames[0].center;assert.throws(()=>M.validate(d),/period/);
  const b=read();b.grid.lat0=29.875;assert.throws(()=>M.validate(b),/dataset/);
  const c=read();c.frames[0].relative.pop();assert.throws(()=>M.validate(c),/values/);
});
test('geographic lookup preserves the Pacific date line and grid row orientation',()=>{
  const g=read().grid;
  assert.equal(M.locate(120.125,-29.875,g),0);
  assert.equal(M.locate(120.125,29.125,g),59*170);
  assert.equal(M.locate(180.125,.125,g),30*170+60);
  assert.equal(M.locate(290,0,g),-1);
});
test('color scale stays fixed across weeks, handles missing values and absolute temperature',()=>{
  assert.notEqual(M.color(-2,'relative'),M.color(2,'relative'));
  assert.equal(M.color(5,'relative'),M.color(8,'relative'));
  assert.notEqual(M.color(25,'sst'),M.color(25,'relative'));
  assert.equal(M.color(NaN), '#e7edef');
});

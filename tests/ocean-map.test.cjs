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
  // Warm anomalies keep a distinct step per degree up to +6 °C, then saturate.
  const warm=[2.5,3.5,4.5,5.5,6.5].map(v=>M.color(v,'anom'));
  assert.equal(new Set(warm).size,warm.length);
  assert.equal(M.color(6,'relative'),M.color(9,'relative'));
  assert.equal(M.color(-3.5,'anom'),M.color(-6,'anom'));
  // Absolute temperature keeps its own fixed scale.
  assert.equal(M.color(31,'sst'),'#f34d12');
  assert.equal(M.color(33,'sst'),'#98070d');
  assert.notEqual(M.color(25,'sst'),M.color(25,'relative'));
  assert.equal(M.color(NaN), '#e7edef');
});

test('timeline, playback speeds and manual pause stay synchronized without duplicate timers',async()=>{
  const vm=require('node:vm'),elements=new Map(),intervals=new Map(),events={};
  let nextTimer=0;
  const element=id=>{
    if(!elements.has(id))elements.set(id,{
      value:'',textContent:'',innerHTML:'',clientWidth:0,attributes:{},listeners:{},
      style:{setProperty(key,value){this[key]=value;}},classList:{toggle(){}},
      setAttribute(key,value){this.attributes[key]=value;},
      addEventListener(key,fn){this.listeners[key]=fn;},parentElement:{},
    });
    return elements.get(id);
  };
  const document={getElementById:element,querySelectorAll:()=>[],querySelector:()=>element('download'),
    addEventListener:(key,fn)=>events[key]=fn,hidden:false};
  const payload=read();
  const context=vm.createContext({module:{exports:{}},document,window:{location:{search:''}},URLSearchParams,console,
    fetch:async path=>({json:async()=>path.includes('spatial')?payload:{type:'FeatureCollection',features:[{}]}}),
    ResizeObserver:class{observe(){}},setInterval:(fn,ms)=>{intervals.set(++nextTimer,{fn,ms});return nextTimer;},
    clearInterval:id=>intervals.delete(id)});
  vm.runInContext(fs.readFileSync(require.resolve('../ocean-map.js'),'utf8'),context);
  const map=context.module.exports;
  const fire=(id,event,value)=>{if(value!==undefined)element(id).value=String(value);element(id).listeners[event]({target:element(id)});};
  const tick=()=>{assert.equal(intervals.size,1);intervals.values().next().value.fn();};
  const selected=i=>{
    assert.equal(Number(element('oceanTimeline').value),i);
    assert.equal(Number(element('oceanWeek').value),i);
    const params=new URLSearchParams();map.saveFilters(params);
    assert.equal(params.get('mapa_fecha'),i===payload.frames.length-1?null:payload.frames[i].center);
  };
  // Uses the published number of weeks (13 before, 53 now) instead of a fixed count.
  const last=payload.frames.length-1,mid=Math.floor(last/2);
  await map.load({},'es');selected(last);
  fire('oceanPlay','click');selected(0);
  assert.equal(element('oceanPlay').attributes['aria-pressed'],'true');
  assert.equal(intervals.values().next().value.ms,1200);
  tick();selected(1);
  for(const ms of [600,2400,1200]){
    fire('oceanSpeed','change',ms);assert.equal(intervals.size,1);
    assert.equal(intervals.values().next().value.ms,ms);
  }
  for(let i=0;i<last;i++)tick();selected(0);
  fire('oceanTimeline','pointerdown');assert.equal(intervals.size,0);
  fire('oceanTimeline','input',mid);selected(mid);
  assert.equal(element('oceanTimeline').style['--ocean-progress'],`${mid/last*100}%`);
  assert.equal(element('oceanPlay').attributes['aria-pressed'],'false');
  fire('oceanPlay','click');tick();selected(mid+1);
  map.language('en');assert.equal(element('oceanPlayLabel').textContent,'Pause');
  assert.equal(element('oceanPosition').textContent,`Week ${mid+2} of ${last+1}`);
  document.hidden=true;events.visibilitychange();assert.equal(intervals.size,0);
  fire('oceanLatest','click');selected(last);assert.equal(element('oceanNext').disabled,true);
});

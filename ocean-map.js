"use strict";

const OceanMap = (() => {
  const copy = {
    kicker: ['GEOGRAFÍA DEL CALENTAMIENTO', 'GEOGRAPHY OF WARMING'],
    title: ['El Pacífico, semana a semana', 'The Pacific, week by week'],
    intro: ['Explora la extensión de las anomalías y su evolución en las últimas 13 semanas.', 'Explore the extent of anomalies and their evolution over the last 13 weeks.'],
    measure: ['Medida', 'Measure'], relative: ['Anomalía relativa · cálculo propio', 'Relative anomaly · own calculation'],
    anom: ['Anomalía convencional', 'Conventional anomaly'], sst: ['Temperatura del mar', 'Sea temperature'],
    week: ['Semana centrada en', 'Week centered on'], zones: ['Zonas Niño', 'Niño regions'],
    play: ['Reproducir', 'Play'], pause: ['Pausar', 'Pause'], latest: ['Última semana', 'Latest week'],
    previous: ['Semana anterior', 'Previous week'], next: ['Semana siguiente', 'Next week'],
    speed: ['Velocidad', 'Speed'],
    timelineHint: ['Arrastra el deslizador o reproduce la evolución semanal en bucle.', 'Drag the slider or play the weekly evolution on a loop.'],
    download: ['Descargar datos del mapa', 'Download map data'], method: ['Fuente, cálculo y validación', 'Source, calculation and validation'],
    hover: ['Toca el océano o pasa el cursor para consultar una celda.', 'Tap the ocean or hover to inspect a grid cell.'],
    regional: ['Promedios de la malla · cálculo propio', 'Grid averages · own calculation'],
    loading: ['Comprobando el mapa…', 'Checking map data…'],
    reference: ['Comparar con el mapa oficial NOAA ↗', 'Compare with NOAA’s official map ↗'],
  };
  const zones = [
    {key:'nino4',name:'Niño 4',box:[160,210,-5,5]},
    {key:'nino34',name:'Niño 3.4',box:[190,240,-5,5]},
    {key:'nino3',name:'Niño 3',box:[210,270,-5,5]},
    {key:'nino12',name:'Niño 1+2',box:[270,280,-10,0]},
  ];
  const colors = ['#145eb0','#297fd2','#60ace2','#a4d7ef','#e6f5f6','#fff8b0','#ffcf61','#ff942b','#f34d12','#d32012','#98070d'];
  const bounds = [-3,-2,-1,-.5,0,.5,1,2,3];
  let data=null,land=null,lang='es',index=0,metric='relative',timer=null,geometry=null,loaded=false,requested=null;
  let playbackMs=1200;
  const $ = (id) => document.getElementById(id);
  const tr = (key) => copy[key][lang==='en'?1:0];
  const choose = (es,en) => lang==='en'?en:es;
  const number = (v,signed=false) => new Intl.NumberFormat(lang==='en'?'en-US':'es-EC',{minimumFractionDigits:1,maximumFractionDigits:1,signDisplay:signed?'exceptZero':'auto'}).format(v);
  const dateText = (d) => new Date(d+'T00:00:00Z').toLocaleDateString(lang==='en'?'en-US':'es-EC',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});

  function color(value,measure=metric) {
    if (!Number.isFinite(value)) return '#e7edef';
    const limits = measure==='sst' ? [16,18,20,22,24,26,28,30,32] : bounds;
    const bin = limits.findIndex((limit)=>value<limit);
    return colors[bin<0?colors.length-1:bin];
  }

  function validate(payload) {
    const grid=payload.grid;
    if (payload.schema!==1 || payload.encoding_scale!==.01 || payload.baseline!=='1991-2020' ||
        !grid || grid.rows!==60 || grid.cols!==170 || grid.step!==1 || grid.lat0!==-29.875 || grid.lon0!==120.125 ||
        !Array.isArray(payload.frames) || !payload.frames.length || payload.frames.length>13) throw new Error('Invalid spatial dataset');
    let previous=null;
    payload.frames.forEach((frame)=>{
      const center = Date.parse(frame.center+'T00:00:00Z');
      if (!Number.isFinite(center) || (previous!==null && center-previous!==604800000) ||
          Date.parse(frame.start+'T00:00:00Z')!==center-259200000 || Date.parse(frame.end+'T00:00:00Z')!==center+259200000) throw new Error('Invalid map period');
      previous=center;
      ['sst','anom','relative'].forEach((key)=>{
        if (!Array.isArray(frame[key]) || frame[key].length!==grid.rows*grid.cols ||
            frame[key].some(v=>v!==null && (!Number.isInteger(v) || Math.abs(v)>(key==='sst'?4500:1500)))) throw new Error('Invalid map values');
      });
      zones.forEach(zone=>['sst','anom','relative'].forEach(key=>{
        if (!Number.isFinite(frame.regions?.[zone.key]?.[key])) throw new Error('Invalid regional statistic');
      }));
    });
    return payload;
  }

  function locate(lon,lat,grid) {
    const col=Math.floor((lon-grid.lon0)/grid.step+.5),row=Math.floor((lat-grid.lat0)/grid.step+.5);
    return col>=0 && col<grid.cols && row>=0 && row<grid.rows ? row*grid.cols+col : -1;
  }

  function playbackState() {
    if(!$('oceanPlay'))return;
    $('oceanPlayLabel').textContent=tr(timer!==null?'pause':'play');
    $('oceanPlayIcon').textContent=timer!==null?'❚❚':'▶';
    $('oceanPlay').setAttribute('aria-pressed',String(timer!==null));
  }
  function stop() { if(timer!==null)clearInterval(timer);timer=null;playbackState(); }
  function start() {
    if(timer!==null)clearInterval(timer);
    timer=setInterval(()=>show((index+1)%data.frames.length),playbackMs);
    playbackState();
  }
  function show(i) { index=Math.max(0,Math.min(data.frames.length-1,i));render(); }

  function language(value) {
    lang=value;
    document.querySelectorAll('[data-ocean]').forEach(el=>el.textContent=tr(el.dataset.ocean));
    $('oceanPrevious')?.setAttribute('aria-label',tr('previous'));
    $('oceanNext')?.setAttribute('aria-label',tr('next'));
    $('oceanTimeline')?.setAttribute('aria-label',tr('week'));
    if(data) render();
  }

  function draw() {
    if (!data) return;
    const canvas=$('oceanCanvas'), width=canvas.clientWidth;
    if (!width) return;
    const small=width<600,left=small?32:44,right=12,top=20,bottom=32;
    const height=(width-left-right)*60/170+top+bottom,dpr=Math.min(window.devicePixelRatio||1,2);
    canvas.style.height=height+'px';canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
    const ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);
    const w=width-left-right,h=height-top-bottom,g=data.grid;
    const west=g.lon0-.5,east=west+g.cols,south=g.lat0-.5,north=south+g.rows;
    const x=lon=>left+(lon-west)/(east-west)*w,y=lat=>top+(north-lat)/(north-south)*h;
    geometry={left,top,w,h,west,east,south,north};
    ctx.fillStyle='#fff';ctx.fillRect(0,0,width,height);
    const frame=data.frames[index],values=frame[metric];
    for(let r=0;r<g.rows;r++) for(let c=0;c<g.cols;c++) {
      const value=values[r*g.cols+c];ctx.fillStyle=color(value===null?NaN:value/100);
      ctx.fillRect(left+c*w/g.cols,top+(g.rows-1-r)*h/g.rows,w/g.cols+.4,h/g.rows+.4);
    }
    ctx.save();ctx.beginPath();ctx.rect(left,top,w,h);ctx.clip();
    // Unwrap longitude per ring, then draw shifted copies across the date line.
    for(const feature of land.features) {
      const polygons=feature.geometry.type==='Polygon'?[feature.geometry.coordinates]:feature.geometry.coordinates;
      for(const polygon of polygons) {
        const rings=polygon.map(ring=>{
          let previous=ring[0][0];return ring.map(([lon,lat],i)=>{
            if(i) {while(lon-previous>180)lon-=360;while(lon-previous< -180)lon+=360;}
            previous=lon;return [lon,lat];
          });
        });
        for(const shift of [-360,0,360]) {
          ctx.beginPath();for(const ring of rings) ring.forEach(([lon,lat],i)=>i?ctx.lineTo(x(lon+shift),y(lat)):ctx.moveTo(x(lon+shift),y(lat)));
          ctx.fillStyle='#f0f1ed';ctx.fill('evenodd');ctx.strokeStyle='#647983';ctx.lineWidth=.65;ctx.stroke();
        }
      }
    }
    ctx.strokeStyle='rgba(40,65,78,.2)';ctx.lineWidth=.65;
    for(let lon=120;lon<=280;lon+=20){ctx.beginPath();ctx.moveTo(x(lon),top);ctx.lineTo(x(lon),top+h);ctx.stroke();}
    for(let lat=-20;lat<=20;lat+=10){ctx.beginPath();ctx.moveTo(left,y(lat));ctx.lineTo(left+w,y(lat));ctx.stroke();}
    ctx.strokeStyle='rgba(25,48,60,.6)';ctx.beginPath();ctx.moveTo(left,y(0));ctx.lineTo(left+w,y(0));ctx.stroke();
    if($('oceanZones').checked) {
      ctx.font=`600 ${small?9:11}px "DM Sans",sans-serif`;ctx.textAlign='center';
      zones.forEach((zone,i)=>{
        const [a,b,c,d]=zone.box;ctx.strokeStyle='#183847';ctx.lineWidth=1.2;ctx.setLineDash([4,3]);
        ctx.strokeRect(x(a),y(d),x(b)-x(a),y(c)-y(d));ctx.setLineDash([]);
        const xx=x((a+b)/2),yy=y(i===3?-13:i===1?-8:8),label=zone.name;
        const tw=ctx.measureText(label).width;ctx.fillStyle='rgba(255,255,255,.9)';ctx.fillRect(xx-tw/2-4,yy-10,tw+8,15);
        ctx.fillStyle='#183847';ctx.fillText(label,xx,yy+1);
      });
    }
    ctx.font=`600 ${small?9:11}px "DM Sans",sans-serif`;ctx.textAlign='right';ctx.fillStyle='#385363';
    if(!small){ctx.fillText('Ecuador',x(288),y(-2));ctx.fillText(choose('Perú','Peru'),x(288),y(-12));}
    ctx.restore();
    ctx.font=`${small?9:11}px "DM Sans",sans-serif`;ctx.fillStyle='#526873';ctx.textAlign='center';
    for(let lon=120;lon<=280;lon+=small?40:20)ctx.fillText(lon===180?'180°':lon<180?`${lon}°E`:`${360-lon}°W`,x(lon),height-8);
    ctx.textAlign='right';for(let lat=-20;lat<=20;lat+=10)ctx.fillText(lat===0?'0°':`${Math.abs(lat)}°${lat>0?'N':'S'}`,left-6,y(lat)+4);
    canvas.setAttribute('aria-label',`${tr(metric)} · ${tr('week')} ${dateText(frame.center)}. ${tr('regional')}: ${zones.map(z=>`${z.name} ${number(frame.regions[z.key][metric],metric!=='sst')} °C`).join('; ')}.`);
  }

  function render() {
    if(!data)return;
    const frame=data.frames[index],last=data.frames.at(-1),g=data.grid;
    $('oceanWeek').innerHTML=data.frames.map((f,i)=>`<option value="${i}">${dateText(f.center)}</option>`).join('');
    $('oceanWeek').value=index;$('oceanMeasure').value=metric;
    $('oceanTimeline').max=data.frames.length-1;$('oceanTimeline').value=index;
    $('oceanTimeline').setAttribute('aria-valuetext',dateText(frame.center));
    $('oceanTimeline').style.setProperty('--ocean-progress',`${data.frames.length>1?index/(data.frames.length-1)*100:0}%`);
    $('oceanTimeline').disabled=data.frames.length<2;
    $('oceanSelectedDate').textContent=dateText(frame.center);
    $('oceanPosition').textContent=choose(`Semana ${index+1} de ${data.frames.length}`,`Week ${index+1} of ${data.frames.length}`);
    $('oceanTicks').innerHTML=data.frames.map((_,i)=>`<i class="${i<=index?'elapsed':''}"></i>`).join('');
    $('oceanPeriod').textContent=`${dateText(frame.start)} — ${dateText(frame.end)} · ${choose('promedio de 7 días','7-day average')}`;
    $('oceanFirst').textContent=dateText(data.frames[0].center);$('oceanLast').textContent=dateText(last.center);
    const age=Math.floor((Date.now()-Date.parse(last.center+'T00:00:00Z'))/86400000);
    $('oceanFreshness').textContent=`${choose('Último mapa disponible','Latest available map')}: ${dateText(last.center)}${age>14?choose(' · Revisar actualización',' · Check update'):''}`;
    $('oceanFreshness').classList.toggle('stale',age>14);
    $('oceanPrevious').disabled=index===0;$('oceanNext').disabled=index===data.frames.length-1;
    $('oceanPlay').disabled=data.frames.length<2;
    playbackState();
    $('oceanReading').textContent=tr('hover');
    const limits=metric==='sst'?[16,18,20,22,24,26,28,30,32]:bounds;
    $('oceanLegend').innerHTML=`<span>${choose('Escala fija','Fixed scale')} · °C</span><div class="ocean-colorbar">${limits.concat(Infinity).map((v,i)=>`<i style="background:${color(i===0?limits[0]-1:i===limits.length?limits.at(-1)+1:(limits[i-1]+v)/2)}"></i>`).join('')}</div><div class="ocean-legend-labels">${limits.map(v=>`<span>${number(v)}</span>`).join('')}</div>`;
    $('oceanExplanation').textContent=metric==='sst'?choose('Temperatura superficial del mar. El ciclo estacional influye en sus valores.','Sea surface temperature. Values include the seasonal cycle.'):metric==='anom'?choose('Diferencia respecto del promedio local 1991–2020 para la misma semana.','Difference from the local 1991–2020 average for the same week.'):choose('Anomalía local menos el calentamiento medio tropical, ajustada por la variabilidad de cada celda. Reconstrucción propia con referencia 1991–2020; puede diferir del mapa operativo de CPC.','Local anomaly minus tropical mean warming, scaled by each cell’s variability. Independent reconstruction with a 1991–2020 reference; may differ from CPC’s operational map.');
    $('oceanRegional').innerHTML=zones.map(z=>`<div><span>${z.name}</span><strong>${number(frame.regions[z.key][metric],metric!=='sst')} <small>°C</small></strong></div>`).join('');
    $('oceanMethod').textContent=choose(
      'Elaboración propia con OISST v2.1 de NOAA/NCEI, distribuido por NOAA PSL. Malla original de 0,25°, muestreada cada 1° para esta visualización. Semanas de domingo a sábado; la fecha central es el miércoles. Climatología diaria 1991–2020 promediada sobre los siete días. La media tropical usa todos los océanos entre 20°S y 20°N, ponderados por el coseno de la latitud. El ajuste relativo multiplica la anomalía sin la media tropical por la razón de desviaciones estándar local/relativa en 1991–2020. Los promedios de estas celdas no sustituyen los índices oficiales CPC. Los datos recientes pueden revisarse; las fechas del mapa y de los índices se actualizan por separado. Tierras: Natural Earth, dominio público.',
      'Independent visualization using NOAA/NCEI OISST v2.1 distributed by NOAA PSL. Native 0.25° grid sampled every 1° for display. Sunday–Saturday weeks, centered on Wednesday. Daily 1991–2020 climatology averaged over seven days. The tropical mean uses all oceans from 20°S to 20°N, weighted by cosine latitude. Relative adjustment multiplies the anomaly minus tropical mean by the local/relative standard-deviation ratio over 1991–2020. These grid averages do not replace official CPC indices. Recent data can be revised; map and index dates update independently. Land: Natural Earth, public domain.');
    draw();
    if(typeof syncUrl==='function')syncUrl();
  }

  function saveFilters(params) {
    if(data) {
      params.set('mapa_medida',metric);
      if(index!==data.frames.length-1)params.set('mapa_fecha',data.frames[index].center);
    } else if(requested) {
      for(const key of ['mapa_medida','mapa_fecha'])if(requested.has(key))params.set(key,requested.get(key));
    }
  }

  async function load(manifest,languageValue) {
    requested=new URLSearchParams(window.location.search);
    language(languageValue);
    try {
      const get=async path=>manifest.id?ReleaseData.file(manifest.files[path]):(await fetch(path,{cache:'no-store'})).json();
      const [payload,coast]=await Promise.all([get('data/spatial.json'),get('data/land.json')]);
      data=validate(payload);
      if(coast.type!=='FeatureCollection' || !coast.features?.length)throw new Error('Invalid coastline');
      land=coast;index=data.frames.length-1;
      if(['relative','anom','sst'].includes(requested.get('mapa_medida')))metric=requested.get('mapa_medida');
      const requestedIndex=data.frames.findIndex(f=>f.center===requested.get('mapa_fecha'));
      if(requestedIndex>=0)index=requestedIndex;
      const link=document.querySelector('a[download][data-ocean="download"]');
      if(manifest.files?.['data/spatial.json'])link.href=manifest.files['data/spatial.json'].path;
      $('oceanLoading').hidden=true;$('oceanContent').hidden=false;
      if(!loaded) {
        loaded=true;
        $('oceanMeasure').addEventListener('change',e=>{metric=e.target.value;render();});
        $('oceanWeek').addEventListener('change',e=>{stop();show(Number(e.target.value));});
        $('oceanTimeline').addEventListener('input',e=>{stop();show(Number(e.target.value));});
        $('oceanTimeline').addEventListener('pointerdown',stop);
        $('oceanPrevious').addEventListener('click',()=>{stop();show(index-1);});
        $('oceanNext').addEventListener('click',()=>{stop();show(index+1);});
        $('oceanLatest').addEventListener('click',()=>{stop();show(data.frames.length-1);});
        $('oceanZones').addEventListener('change',draw);
        $('oceanPlay').addEventListener('click',()=>{if(timer!==null){stop();return;}show(index===data.frames.length-1?0:index);start();});
        $('oceanSpeed').addEventListener('change',e=>{
          const speed=Number(e.target.value);
          if(![600,1200,2400].includes(speed))return;
          playbackMs=speed;if(timer!==null)start();
        });
        document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
        new ResizeObserver(draw).observe($('oceanCanvas').parentElement);
        const inspect=e=>{
          const rect=$('oceanCanvas').getBoundingClientRect(),p=geometry;if(!p)return;
          const lon=p.west+(e.clientX-rect.left-p.left)/p.w*(p.east-p.west),lat=p.north-(e.clientY-rect.top-p.top)/p.h*(p.north-p.south);
          const cell=locate(lon,lat,data.grid),raw=cell<0?null:data.frames[index][metric][cell];
          if(raw===null){$('oceanReading').textContent=choose('Sin dato oceánico en esta celda.','No ocean data in this cell.');return;}
          const latitude=data.grid.lat0+Math.floor(cell/data.grid.cols),longitude=data.grid.lon0+cell%data.grid.cols;
          $('oceanReading').textContent=`${number(Math.abs(latitude))}°${latitude>=0?'N':'S'} · ${number(longitude>180?360-longitude:longitude)}°${longitude>180?'W':'E'} · ${number(raw/100,metric!=='sst')} °C`;
        };
        $('oceanCanvas').addEventListener('pointermove',inspect);$('oceanCanvas').addEventListener('click',inspect);
        $('oceanCanvas').addEventListener('pointerleave',()=>{$('oceanReading').textContent=tr('hover');});
      }
      render();
    } catch(error) {
      stop();data=null;$('oceanContent').hidden=true;
      $('oceanLoading').hidden=false;$('oceanLoading').textContent=choose('No se pudo verificar el mapa. Los demás indicadores conservan sus propias fechas.','The map could not be verified. Other indicators retain their own dates.');
      console.error(error);
    }
  }
  return {load,language,color,locate,validate,saveFilters};
})();
if(typeof module!=='undefined')module.exports=OceanMap;

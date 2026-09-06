const test = require('node:test');
const assert = require('node:assert/strict');
const {webcrypto, createHash} = require('node:crypto');
const Release = require('../release.js');
const entry = (object, name) => {
  const body=JSON.stringify(object);
  const sha256=createHash('sha256').update(body).digest('hex');
  return {body, path:`data/${name}.${sha256}.json`, sha256};
};
const response = (body) => new Response(body,{status:200});

test('old RONI received at a new URL is rejected, never silently displayed', async () => {
  const fresh=entry({current:{roni:{season:'JJA',value:1.36}}},'enso');
  let attempts=0;
  await assert.rejects(Release.file(fresh,async()=>{attempts++;return response('{"current":{"roni":{"season":"MJJ","value":0.98}}}');},webcrypto), /no corresponde/);
  assert.equal(attempts,2);
});
test('transient cache mismatch retries without cache and accepts only exact bytes', async () => {
  const fresh=entry({value:1.36},'enso');
  const urls=[];
  const parsed=await Release.file(fresh,async(url,options)=>{
    assert.equal(options.cache,'no-store');urls.push(url);
    return response(urls.length===1?'{}':fresh.body);
  },webcrypto);
  assert.equal(parsed.value,1.36);
  assert.match(urls[1],/retry=/);
});
test('old HTML edition is detected before any observation file is loaded', async () => {
  let requests=0;
  await assert.rejects(Release.load({id:'a'.repeat(64)},async(url)=>{
    requests++;assert.match(url,/^version.json\?check=/);
    return response(JSON.stringify({id:'b'.repeat(64)}));
  },webcrypto),error=>error instanceof Release.EditionChanged && error.edition==='b'.repeat(64));
  assert.equal(requests,1);
});
test('observations and forecast are returned only when both hashes pass', async () => {
  const data=entry({roni:[1.36]},'enso'),outlook=entry({issued_month:'2026-08'},'outlook');
  const manifest={id:'a'.repeat(64),files:{'data/enso.json':data,'data/outlook.json':outlook}};
  const fetcher=async(url)=>response(url.startsWith('version.json')?JSON.stringify(manifest):url.startsWith(data.path)?data.body:outlook.body);
  assert.deepEqual(await Release.load(manifest,fetcher,webcrypto),{data:{roni:[1.36]},outlook:{issued_month:'2026-08'}});
  await assert.rejects(Release.load(manifest,async(url)=>url.startsWith(outlook.path)?response('{}'):fetcher(url),webcrypto));
});

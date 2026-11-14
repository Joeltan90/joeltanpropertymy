const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createLocalServer}=require('../lib/local-server.cjs');
const fixture=require('./fixtures/properties.cjs');
test('local server serves the actual API and blocks local configuration and server sources',async t=>{
 const server=createLocalServer({apiOptions:{env:fixture.env,fetchImpl:fixture.createFixtureFetch()}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
 const base=`http://127.0.0.1:${server.address().port}`;
 for(const file of ['/.env.local','/.git/config','/package.json','/node_modules/@supabase/supabase-js/package.json','/lib/properties.cjs','/assets/../.env.local'])assert.equal((await fetch(base+file)).status,404,file);
 const home=await fetch(base+'/');assert.equal(home.status,200);assert.equal(home.headers.get('cache-control'),'no-store');
 assert.equal((await fetch(base+'/property.html?id=1')).status,200);
 const detail=await fetch(base+'/api/property?id=1');assert.equal(detail.status,200);assert.equal((await detail.json()).property.description,'Fixture description');
 const script=await fetch(base+'/assets/js/properties.js?v=cache-check');assert.equal(script.headers.get('content-type'),'text/javascript; charset=utf-8');assert.equal(script.headers.get('cache-control'),'no-store');
 const response=await fetch(base+'/api/properties?q=Forest');assert.equal(response.status,200);const body=await response.json();assert.equal(body.total,1);assert.equal(body.properties[0].title,'Forest City');
 assert.equal((await fetch(base+'/api/properties',{method:'POST'})).status,405);
});

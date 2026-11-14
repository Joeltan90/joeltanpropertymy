const {test}=require('node:test');
const assert=require('node:assert/strict');
const {handleProperties}=require('../lib/properties.cjs');
const fixture=require('./fixtures/properties.cjs');
async function query(search='',options={}){
 const response=await handleProperties(new Request('http://local/api/properties'+search),{env:fixture.env,fetchImpl:fixture.createFixtureFetch(),...options});
 return {response,body:await response.json()};
}
test('published listing API paginates and never returns internal values',async()=>{
 const requests=[];const {response,body}=await query('',{fetchImpl:fixture.createFixtureFetch(fixture.rows,requests)});
 assert.equal(response.status,200);assert.equal(body.total,27);assert.equal(body.properties.length,12);assert.equal(body.totalPages,3);
 assert.equal(body.properties[0].title,'Imperia Condominium');assert.ok(!JSON.stringify(body).includes('bank_value'));assert.ok(!JSON.stringify(body).includes('Unpublished fixture'));
 assert.equal(requests[0].url.searchParams.get('is_published'),'eq.true');assert.equal(requests[0].init.method,'GET');assert.equal(requests[0].init.headers.get('authorization'),null);
 assert.equal(response.headers.get('cache-control'),'no-store');
});
test('search finds a record outside the first database page',async()=>{
 const {body}=await query('?q=Published%20land%2024');assert.equal(body.total,1);assert.equal(body.properties[0].id,27);
});
test('pagination reaches records beyond Supabase default 1000-row cap',async()=>{
 const source=Array.from({length:1305},(_,i)=>({...fixture.rows[0],id:i+1,title:`Row ${i+1}`}));
 const {body}=await query('?page=109&sort=price-asc',{fetchImpl:fixture.createFixtureFetch(source)});
 assert.equal(body.total,1305);assert.equal(body.properties[0].id,1297);assert.equal(body.properties.length,9);
});
test('all filters and price ordering execute before pagination',async()=>{
 const {body}=await query('?city=Johor%20Bahru&type=Single%20Storey&minPrice=400000&maxPrice=700000&beds=3&baths=3&sort=price-desc');assert.equal(body.total,1);assert.equal(body.properties[0].id,3);
 const sorted=await query('?sort=price-asc');assert.equal(sorted.body.properties[0].id,2);
});
test('facets include values beyond the first thousand records',async()=>{
 const source=Array.from({length:1001},(_,i)=>({...fixture.rows[0],id:i+1,city:i===1000?'Last city':'First city',property_type:i===1000?'Last type':'First type'}));
 const {body}=await query('?facets=1',{fetchImpl:fixture.createFixtureFetch(source)});assert.deepEqual(body.cities,['First city','Last city']);assert.deepEqual(body.types,['First type','Last type']);
});
test('invalid parameters and reversed prices are rejected without database calls',async()=>{
 for(const search of ['?page=0','?page=1.5','?minPrice=-1','?minPrice=700000&maxPrice=400000','?is_published=false','?sort=unknown','?page=1&page=2']){
  const {response}=await query(search,{fetchImpl:()=>{throw new Error('Must not call database');}});assert.equal(response.status,400,search);
 }
});
test('facets tolerate a database row cap lower than the requested batch size',async()=>{
 const source=Array.from({length:120},(_,i)=>({...fixture.rows[0],id:i+1,city:i===119?'Last city':'First city'}));
 const transport=fixture.createFixtureFetch(source);
 const {body}=await query('?facets=1',{fetchImpl:(input,init)=>{const url=new URL(input);url.searchParams.set('limit','50');return transport(url.toString(),init);}});
 assert.deepEqual(body.cities,['First city','Last city']);
});
test('keyword punctuation stays inside a quoted filter value',async()=>{
 const requests=[];await query('?q='+encodeURIComponent('x",is_published.eq.false,%_\\'),{fetchImpl:fixture.createFixtureFetch(fixture.rows,requests)});
 assert.equal(requests[0].url.searchParams.get('is_published'),'eq.true');assert.equal(requests[0].url.searchParams.get('or').match(/title\.ilike/g).length,1);
});
test('no visible rows is a valid empty result',async()=>{
 const {response,body}=await query('?q=No%20matching%20fixture');assert.equal(response.status,200);assert.equal(body.total,0);assert.deepEqual(body.properties,[]);
});
test('configuration, permissions and network errors do not leak credentials',async()=>{
 const missing=await query('',{env:{}});assert.equal(missing.response.status,503);
 const denied=await query('',{fetchImpl:async()=>new Response(JSON.stringify({code:'42501',message:fixture.env.SUPABASE_PUBLISHABLE_KEY}),{status:403,headers:{'Content-Type':'application/json'}})});assert.equal(denied.response.status,503);assert.equal(denied.body.error.code,'ACCESS_DENIED');assert.ok(!JSON.stringify(denied.body).includes(fixture.env.SUPABASE_PUBLISHABLE_KEY));
 const offline=await query('',{fetchImpl:async()=>{throw new Error('Private configuration');}});assert.equal(offline.response.status,503);assert.ok(!JSON.stringify(offline.body).includes('Private configuration'));
});
test('write methods are rejected',async()=>{
 const response=await handleProperties(new Request('http://local/api/properties',{method:'POST'}),{});assert.equal(response.status,405);
});
test('a configured Data API suffix is normalized without duplicating rest/v1',async()=>{
 const requests=[];const {response}=await query('',{env:{...fixture.env,SUPABASE_URL:fixture.env.SUPABASE_URL+'/rest/v1'},fetchImpl:fixture.createFixtureFetch(fixture.rows,requests)});
 assert.equal(response.status,200);assert.equal(requests[0].url.pathname,'/rest/v1/properties');
});

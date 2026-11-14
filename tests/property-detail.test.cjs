const {test}=require('node:test');
const assert=require('node:assert/strict');
const {handleProperty}=require('../lib/properties.cjs');
const fixture=require('./fixtures/properties.cjs');
const options={env:fixture.env,fetchImpl:fixture.createFixtureFetch()};
test('detail returns one published property with description and no internal fields',async()=>{
 const response=await handleProperty(new Request('http://local/api/property?id=1'),options);
 assert.equal(response.status,200);const body=await response.json();assert.equal(body.property.id,1);assert.equal(body.property.description,'Fixture description');assert.ok(!('bank_value' in body.property));assert.ok(!JSON.stringify(body).includes(fixture.env.SUPABASE_PUBLISHABLE_KEY));
});
test('unpublished and absent IDs are indistinguishable',async()=>{
 for(const id of [100,999]){const response=await handleProperty(new Request('http://local/api/property?id='+id),options);assert.equal(response.status,404);assert.equal((await response.json()).error.code,'NOT_FOUND');}
});
test('invalid and duplicate IDs do not query the database',async()=>{
 for(const query of ['', '?id=0','?id=-1','?id=1.2','?id=abc','?id=1&id=2','?id=9007199254740992','?id=9223372036854775808','?id=1&select=*']){
  const response=await handleProperty(new Request('http://local/api/property'+query),{fetchImpl:()=>{throw new Error('Must not connect');}});assert.equal(response.status,400,query);
 }
});
test('detail rejects writes and redacts permission/network failures',async()=>{
 assert.equal((await handleProperty(new Request('http://local/api/property?id=1',{method:'POST'}),options)).status,405);
 for(const fetchImpl of [async()=>new Response(JSON.stringify({code:'42501',message:fixture.env.SUPABASE_PUBLISHABLE_KEY}),{status:403,headers:{'Content-Type':'application/json'}}),async()=>{throw new Error(fixture.env.SUPABASE_PUBLISHABLE_KEY);}]){
  const response=await handleProperty(new Request('http://local/api/property?id=1'),{...options,fetchImpl});assert.equal(response.status,503);assert.ok(!(await response.text()).includes(fixture.env.SUPABASE_PUBLISHABLE_KEY));
 }
});

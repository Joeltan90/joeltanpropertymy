const {test}=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const {checkSupabaseConnection}=require('../scripts/check-supabase.cjs');
const fixtureKey='sb_publishable_local_test_fixture';

async function withApi(t,handler){
  const requests=[];
  const server=http.createServer((req,res)=>{
    requests.push({method:req.method,url:req.url,headers:req.headers});
    handler(req,res);
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  return {env:{SUPABASE_URL:`http://127.0.0.1:${server.address().port}`,SUPABASE_PUBLISHABLE_KEY:fixtureKey},requests};
}

test('missing configuration does not send a request',async()=>{
  let requests=0;
  const result=await checkSupabaseConnection({env:{},fetchImpl:()=>{requests++;throw new Error('Must not connect');}});
  assert.equal(result.outcome,'configuration_error');
  assert.equal(requests,0);
});

test('administrator keys are rejected before any connection',async()=>{
  const result=await checkSupabaseConnection({env:{SUPABASE_URL:'https://example.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_secret_test_fixture'}});
  assert.equal(result.outcome,'configuration_error');
});

test('real SDK reads at most one properties row anonymously and does not expose its values',async t=>{
  const {env,requests}=await withApi(t,(req,res)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify([{id:1,title:'Private fixture content',phone:'Do not print this'}]));});
  const result=await checkSupabaseConnection({env});
  assert.equal(result.outcome,'row_read');
  assert.equal(result.rowsRead,1);
  assert.equal(result.anonymousRowReadVerified,true);
  assert.equal(result.rlsPolicyInspected,false);
  assert.deepEqual(result.columns,['id','phone','title']);
  assert.equal(requests.length,1);
  assert.equal(requests[0].method,'GET');
  const url=new URL(requests[0].url,'http://localhost');
  assert.equal(url.pathname,'/rest/v1/properties');
  assert.equal(url.searchParams.get('limit'),'1');
  assert.equal(url.searchParams.get('select'),'*');
  assert.equal(requests[0].headers['accept-profile'],'public');
  assert.equal(requests[0].headers.apikey,fixtureKey);
  assert.equal(requests[0].headers.authorization,undefined);
  assert.ok(!JSON.stringify(result).includes(fixtureKey));
  assert.ok(!JSON.stringify(result).includes('Private fixture content'));
  assert.ok(!JSON.stringify(result).includes('Do not print this'));
});

test('empty result is inconclusive about whether rows are blocked by RLS',async t=>{
  const {env}=await withApi(t,(req,res)=>{res.setHeader('Content-Type','application/json');res.end('[]');});
  const result=await checkSupabaseConnection({env});
  assert.equal(result.outcome,'empty_or_filtered');
  assert.equal(result.anonymousRowReadVerified,false);
});

test('permission denial is reported without echoing server messages or credentials',async t=>{
  const {env}=await withApi(t,(req,res)=>{res.statusCode=403;res.setHeader('Content-Type','application/json');res.end(JSON.stringify({code:'42501',message:fixtureKey,details:'Sensitive fixture detail'}));});
  const result=await checkSupabaseConnection({env});
  assert.equal(result.outcome,'permission_denied');
  assert.equal(result.databaseCode,'42501');
  assert.ok(!JSON.stringify(result).includes(fixtureKey));
  assert.ok(!JSON.stringify(result).includes('Sensitive fixture detail'));
});

test('invalid API key is distinguished from a table permission error',async t=>{
  const {env}=await withApi(t,(req,res)=>{res.statusCode=401;res.setHeader('Content-Type','application/json');res.end(JSON.stringify({message:'Invalid API key'}));});
  assert.equal((await checkSupabaseConnection({env})).outcome,'authentication_failed');
});

test('network exceptions are redacted',async()=>{
  let requests=0;
  const result=await checkSupabaseConnection({env:{SUPABASE_URL:'https://example.supabase.co',SUPABASE_PUBLISHABLE_KEY:fixtureKey},fetchImpl:async()=>{requests++;throw new Error(fixtureKey);}});
  assert.equal(result.outcome,'network_or_timeout');
  assert.equal(requests,1);
  assert.ok(!JSON.stringify(result).includes(fixtureKey));
});

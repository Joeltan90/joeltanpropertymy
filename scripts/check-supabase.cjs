// An isolated anonymous SELECT diagnostic, never imported by the homepage.
const {createClient}=require('@supabase/supabase-js');

async function checkSupabaseConnection({env=process.env,fetchImpl=globalThis.fetch,timeoutMs=10000}={}){
  const base={table:'public.properties',role:'anon',readOnly:true,rlsPolicyInspected:false,anonymousRowReadVerified:false};
  const projectUrl=env.SUPABASE_URL?.trim();
  const key=env.SUPABASE_PUBLISHABLE_KEY?.trim();
  if(!projectUrl||!key)return {...base,outcome:'configuration_error',reason:'SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY are required.'};
  if(!key.startsWith('sb_publishable_'))return {...base,outcome:'configuration_error',reason:'Only a publishable API key is accepted; administrator and legacy keys are not used.'};
  let url;
  try{
    url=new URL(projectUrl);
    const localHttp=url.protocol==='http:'&&['127.0.0.1','localhost','[::1]'].includes(url.hostname);
    if((url.protocol!=='https:'&&!localHttp)||url.username||url.password||url.search||url.hash||!['','/'].includes(url.pathname))throw new Error();
  }catch{return {...base,outcome:'configuration_error',reason:'SUPABASE_URL must be an HTTPS project origin (loopback HTTP is supported for local tests).'};}
  let requestSent=false;
  // Enforce GET-only access to this one table, even if a future SDK change retries
  // or attempts an auth/session request. No cookie/session/admin credential is used.
  const readOnlyFetch=async(input,init={})=>{
    const requestUrl=new URL(typeof input==='string'||input instanceof URL?input:input.url);
    const method=(init.method||(typeof input==='object'&&input.method)||'GET').toUpperCase();
    if(requestSent||method!=='GET'||requestUrl.origin!==url.origin||requestUrl.pathname!=='/rest/v1/properties'||requestUrl.searchParams.get('limit')!=='1'||requestUrl.searchParams.get('select')!=='*')throw new Error('Read-only request restriction');
    requestSent=true;
    const headers=new Headers(init.headers);
    headers.delete('authorization');
    return fetchImpl(input,{...init,headers,redirect:'error'});
  };
  try{
    const client=createClient(url.origin,key,{
      auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
      global:{fetch:readOnlyFetch}
    });
    const {data,error,status}=await client.schema('public').from('properties').select('*').limit(1).retry(false).abortSignal(AbortSignal.timeout(timeoutMs));
    if(error){
      const databaseCode=/^[A-Z0-9]{2,12}$/.test(error.code||'')?error.code:undefined;
      const outcome=status===401?'authentication_failed':status===403||databaseCode==='42501'?'permission_denied':status===404?'table_or_schema_unavailable':status===0?'network_or_timeout':'query_failed';
      return {...base,outcome,httpStatus:status,...(databaseCode?{databaseCode}:{})};
    }
    if(!Array.isArray(data)||data.length>1)return {...base,outcome:'invalid_response',httpStatus:status};
    return {...base,outcome:data.length?'row_read':'empty_or_filtered',httpStatus:status,anonymousRowReadVerified:data.length===1,rowsRead:data.length,columns:data.length?Object.keys(data[0]).sort():[]};
  }catch{return {...base,outcome:'network_or_timeout'};}
}

module.exports={checkSupabaseConnection};
if(require.main===module){
  checkSupabaseConnection().then(result=>{
    console.log(JSON.stringify(result,null,2));
    process.exitCode=result.outcome==='row_read'?0:result.outcome==='empty_or_filtered'?2:1;
  }).catch(()=>{console.error('Read-only diagnostic failed. Credentials and response data were not logged.');process.exitCode=1;});
}

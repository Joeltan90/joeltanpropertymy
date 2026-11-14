const {createClient}=require('@supabase/supabase-js');
const FIELDS=['id','created_at','title','city','township','property_type','price','bedrooms','bathrooms','land_size','listing_type'];
const PAGE_SIZE=12;
const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const json=(body,status=200)=>Response.json(body,{status,headers});

function parameters(url){
 const p=url.searchParams,allowed=new Set(['page','q','city','type','minPrice','maxPrice','beds','baths','sort','facets']);
 for(const key of p.keys())if(!allowed.has(key)||p.getAll(key).length!==1)throw new Error('Invalid query parameters.');
 if(p.has('facets')){if(p.get('facets')!=='1'||[...p.keys()].length!==1)throw new Error('Invalid facet request.');return {facets:true};}
 const number=(key,{integer=false,min=0,max=1e15}={})=>{if(!p.has(key)||p.get(key)==='')return undefined;const value=p.get(key);if(!/^\d+(?:\.\d+)?$/.test(value))throw new Error('Invalid numeric filter.');const n=Number(value);if(!Number.isFinite(n)||n<min||n>max||(integer&&!Number.isInteger(n)))throw new Error('Invalid numeric filter.');return n;};
 const text=(key,max)=>{const value=(p.get(key)||'').trim();if(value.length>max||/[\u0000-\u001f\u007f]/.test(value))throw new Error('Invalid text filter.');return value;};
 const filters={page:number('page',{integer:true,min:1,max:1000000})??1,q:text('q',120),city:text('city',100),type:text('type',100),minPrice:number('minPrice'),maxPrice:number('maxPrice'),beds:number('beds',{integer:true,max:1000}),baths:number('baths',{integer:true,max:1000}),sort:p.get('sort')||'latest'};
 if(!['latest','price-asc','price-desc'].includes(filters.sort))throw new Error('Invalid sort.');
 if(filters.minPrice!==undefined&&filters.maxPrice!==undefined&&filters.minPrice>filters.maxPrice)throw new Error('Minimum price must not exceed maximum price.');
 return filters;
}

function anonymousClient(env,fetchImpl){
 const key=env.SUPABASE_PUBLISHABLE_KEY?.trim();
 if(!key?.startsWith('sb_publishable_'))throw new Error('Missing public configuration.');
 const url=new URL(env.SUPABASE_URL?.trim());
 const loopback=url.protocol==='http:'&&['127.0.0.1','localhost','[::1]'].includes(url.hostname);
 if((url.protocol!=='https:'&&!loopback)||url.username||url.password||url.search||url.hash||!['','/','/rest/v1','/rest/v1/'].includes(url.pathname))throw new Error('Invalid public configuration.');
 return createClient(url.origin,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:async(input,init={})=>{
  const target=new URL(input),method=(init.method||'GET').toUpperCase();
  if(method!=='GET'||target.origin!==url.origin||target.pathname!=='/rest/v1/properties')throw new Error('Read-only database access only.');
  const requestHeaders=new Headers(init.headers);requestHeaders.delete('authorization');
  return fetchImpl(input,{...init,headers:requestHeaders,redirect:'error'});
 }}});
}

async function handleProperties(request,{env=process.env,fetchImpl=globalThis.fetch}={}){
 if(request.method!=='GET')return new Response(JSON.stringify({error:{code:'METHOD_NOT_ALLOWED',message:'Only GET is supported.'}}),{status:405,headers:{...headers,'Content-Type':'application/json',Allow:'GET'}});
 let filters;try{filters=parameters(new URL(request.url));}catch(error){return json({error:{code:'INVALID_QUERY',message:error.message}},400);}
 let client;try{client=anonymousClient(env,fetchImpl);}catch{return json({error:{code:'CONFIGURATION_ERROR',message:'Property service is not configured.'}},503);}
 const signal=AbortSignal.timeout(10000);
 const unavailable=error=>json({error:{code:error?.code==='42501'?'ACCESS_DENIED':'PROPERTIES_UNAVAILABLE',message:'Properties could not be loaded. Please try again or contact Joel.'}},503);
 try{
  if(filters.facets){
   const cities=new Set(),types=new Set();let offset=0;
   while(true){
    const {data,error,count}=await client.schema('public').from('properties').select('id,city,property_type',{count:'exact'}).eq('is_published',true).order('id',{ascending:true}).range(offset,offset+999).retry(false).abortSignal(signal);
    if(error)return unavailable(error);if(!Array.isArray(data)||!Number.isInteger(count))return unavailable();
    for(const row of data){if(typeof row.city==='string'&&row.city.trim())cities.add(row.city);if(typeof row.property_type==='string'&&row.property_type.trim())types.add(row.property_type);}
    offset+=data.length;if(offset>=count)break;if(!data.length)return unavailable();
   }
   return json({cities:[...cities].sort(),types:[...types].sort()});
  }
  let query=client.schema('public').from('properties').select(FIELDS.join(','),{count:'exact'}).eq('is_published',true);
  if(filters.city)query=query.eq('city',filters.city);
  if(filters.type)query=query.eq('property_type',filters.type);
  if(filters.minPrice!==undefined)query=query.gte('price',filters.minPrice);
  if(filters.maxPrice!==undefined)query=query.lte('price',filters.maxPrice);
  if(filters.beds)query=query.gte('bedrooms',filters.beds);
  if(filters.baths)query=query.gte('bathrooms',filters.baths);
  if(filters.q){
   const pattern=JSON.stringify('%'+filters.q.replace(/[\\%_]/g,'\\$&')+'%');
   query=query.or(['title','city','township','description'].map(field=>`${field}.ilike.${pattern}`).join(','));
  }
  if(filters.sort==='latest')query=query.order('created_at',{ascending:false,nullsFirst:false}).order('id',{ascending:false});
  else query=query.order('price',{ascending:filters.sort==='price-asc',nullsFirst:false}).order('id',{ascending:true});
  const offset=(filters.page-1)*PAGE_SIZE;
  const {data,error,count}=await query.range(offset,offset+PAGE_SIZE-1).retry(false).abortSignal(signal);
  if(error)return unavailable(error);
  if(!Array.isArray(data)||!Number.isInteger(count)||count<0)return unavailable();
  const properties=data.map(row=>Object.fromEntries(FIELDS.map(field=>[field,row[field]??null])));
  return json({properties,total:count,page:filters.page,pageSize:PAGE_SIZE,totalPages:Math.max(1,Math.ceil(count/PAGE_SIZE))});
 }catch{return unavailable();}
}
async function handleProperty(request,{env=process.env,fetchImpl=globalThis.fetch}={}){
 if(request.method!=='GET')return new Response(JSON.stringify({error:{code:'METHOD_NOT_ALLOWED',message:'Only GET is supported.'}}),{status:405,headers:{...headers,'Content-Type':'application/json',Allow:'GET'}});
 const params=new URL(request.url).searchParams,id=params.get('id');
 if([...params.keys()].some(key=>key!=='id')||params.getAll('id').length!==1||!id||!/^[1-9]\d{0,18}$/.test(id)||!Number.isSafeInteger(Number(id)))return json({error:{code:'INVALID_ID',message:'A valid property ID is required.'}},400);
 let client;try{client=anonymousClient(env,fetchImpl);}catch{return json({error:{code:'CONFIGURATION_ERROR',message:'Property service is not configured.'}},503);}
 try{
  const fields=[...FIELDS,'description'];
  const {data,error}=await client.schema('public').from('properties').select(fields.join(',')).eq('is_published',true).eq('id',id).limit(1).retry(false).abortSignal(AbortSignal.timeout(10000));
  if(error||!Array.isArray(data))return json({error:{code:'PROPERTY_UNAVAILABLE',message:'Property details could not be loaded.'}},503);
  if(!data.length)return json({error:{code:'NOT_FOUND',message:'This property is not available.'}},404);
  return json({property:Object.fromEntries(fields.map(field=>[field,data[0][field]??null]))});
 }catch{return json({error:{code:'PROPERTY_UNAVAILABLE',message:'Property details could not be loaded.'}},503);}
}
module.exports={handleProperties,handleProperty};

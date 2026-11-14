const originals=[
  {id:1,title:'Imperia Condominium',city:'Iskandar Puteri',township:'Puteri Harbour',property_type:'Condominium',price:1300000,bedrooms:3,bathrooms:4,land_size:null,listing_type:'Sale',created_at:'2026-11-13T03:00:00Z'},
  {id:2,title:'Forest City',city:'Gelang Patah',township:'Forest City',property_type:'Apartment',price:395000,bedrooms:2,bathrooms:2,land_size:null,listing_type:'Sale',created_at:'2026-11-13T02:00:00Z'},
  {id:3,title:'Johor Jaya Anggerik 1-Storey Corner House',city:'Johor Bahru',township:'Taman Johor Jaya',property_type:'Single Storey',price:628000,bedrooms:3,bathrooms:3,land_size:'1,540 sqft',listing_type:'Sale',created_at:'2026-11-13T01:00:00Z'}
].map(row=>({...row,is_published:true,description:'Fixture description',bank_value:999999}));
const rows=[...originals,...Array.from({length:24},(_,i)=>({id:i+4,title:`Published land ${i+1}`,city:'Test District',township:'Fixture township',property_type:'Land',price:10000000,bedrooms:0,bathrooms:0,land_size:'5000',listing_type:'Sale',created_at:'2020-01-01T00:00:00Z',is_published:true,bank_value:999999})),{...originals[0],id:100,title:'Unpublished fixture',is_published:false}];
const env={SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test_fixture'};

// In-memory Data API fixture. This never contacts Supabase or writes any row.
function createFixtureFetch(source=rows,requests=[]){
 return async(input,init={})=>{
  const url=new URL(input),p=url.searchParams;requests.push({url,init});
  let selected=source.filter(row=>p.get('is_published')==='eq.true'?row.is_published===true:true);
  if(p.has('id'))selected=selected.filter(row=>String(row.id)===p.get('id').slice(3));
  for(const [field,op] of [['city','eq.'],['property_type','eq.']])if(p.has(field))selected=selected.filter(row=>row[field]===p.get(field).slice(op.length));
  for(const field of ['price','bedrooms','bathrooms'])for(const filter of p.getAll(field)){
   const [op,value]=filter.split('.');selected=selected.filter(row=>row[field]!=null&&(op==='gte'?Number(row[field])>=Number(value):Number(row[field])<=Number(value)));
  }
  if(p.has('or')){
   const expression=p.get('or');const match=expression.match(/title\.ilike\.("(?:[^"\\]|\\.)*")/);
   const pattern=match?JSON.parse(match[1]):'';const needle=pattern.slice(1,-1).replace(/\\([\\%_])/g,'$1').toLowerCase();
   selected=selected.filter(row=>['title','city','township','description'].some(field=>String(row[field]||'').toLowerCase().includes(needle)));
  }
  const order=(p.get('order')||'id.asc').split(',');selected.sort((a,b)=>{for(const item of order){const [field,dir]=item.split('.');if(a[field]===b[field])continue;if(a[field]==null)return 1;if(b[field]==null)return -1;const result=a[field]<b[field]?-1:1;return dir==='desc'?-result:result;}return 0;});
  const total=selected.length,offset=Number(p.get('offset')||0),limit=Number(p.get('limit')||1000);
  const fields=(p.get('select')||'*').split(',');selected=selected.slice(offset,offset+limit).map(row=>fields[0]==='*'?row:Object.fromEntries(fields.map(field=>[field,row[field]??null])));
  return new Response(JSON.stringify(selected),{status:200,headers:{'Content-Type':'application/json','Content-Range':`${offset}-${offset+selected.length-1}/${total}`}});
 };
}
module.exports={rows,originals,env,createFixtureFetch};

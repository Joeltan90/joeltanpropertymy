/* Published listings are fetched from the same-origin API, never from browser credentials. */
(()=>{
 const grid=document.querySelector('#listings .cards');
 const count=document.getElementById('listing-count'),pagination=document.getElementById('listing-pagination');
 const status=document.getElementById('listing-feedback'),retry=document.getElementById('listing-retry');
 const quick=document.getElementById('quick-search-panel'),address=document.getElementById('address-search-panel');
 const sort=document.getElementById('listing-sort'),feedback=document.getElementById('search-feedback');
 const addressFeedback=document.getElementById('address-feedback');
 const filters={city:'',q:'',type:'',minPrice:'',maxPrice:'',beds:'0',baths:'0'};
 let page=1,sequence=0,controller;
 const money=new Intl.NumberFormat('en-MY',{style:'currency',currency:'MYR',maximumFractionDigits:2});
 const element=(tag,className,text)=>{const item=document.createElement(tag);if(className)item.className=className;if(text!==undefined)item.textContent=text;return item;};
 function card(row){
  const article=element('article','card');article.dataset.propertyId=String(row.id);article.dataset.propertyType=row.property_type||'';
  const details='/property.html?id='+encodeURIComponent(String(row.id));
  const photoLink=element('a');photoLink.href=details;photoLink.setAttribute('aria-label','View details for '+(row.title||'this property'));
  const photo=element('div','photo');
  const image=element('img');image.src='/assets/images/property-placeholder.svg';image.alt='Property photo not supplied';image.loading='lazy';image.decoding='async';
  photo.append(image);if(row.listing_type)photo.append(element('span','tag',row.listing_type));photoLink.append(photo);
  const body=element('div','cardbody');
  const price=row.price!==null&&row.price!==''&&Number.isFinite(Number(row.price))?money.format(Number(row.price)):'Price on request · 询价';
  const heading=element('h3'),titleLink=element('a','',row.title||'Property · 房源');titleLink.href=details;heading.append(titleLink);
  body.append(element('div','price',price),heading,element('p','place',[row.township,row.city].filter(Boolean).join(' · ')||'Location not provided'));
  const features=element('div','features');
  if(row.property_type)features.append(element('span','',row.property_type));
  for(const [field,label] of [['bedrooms','beds'],['bathrooms','baths']])if(row[field]!==null&&row[field]!==undefined)features.append(element('span','',String(row[field])+' '+label));
  if(row.land_size!==null&&row.land_size!=='')features.append(element('span','',`Land area · 土地面积: ${row.land_size}`));
  body.append(features);
  const link=element('a','cardlink');link.href=details;link.append(element('span','','View property details'),element('span','','→'));body.append(link);
  article.append(photoLink,body);return article;
 }
 function pages(totalPages){
  pagination.replaceChildren();pagination.hidden=totalPages<=1;
  if(totalPages<=1)return;
  const previous=element('button','','Previous'),next=element('button','','Next');previous.type=next.type='button';previous.disabled=page===1;next.disabled=page===totalPages;
  previous.addEventListener('click',()=>{page--;load(true)});next.addEventListener('click',()=>{page++;load(true)});
  pagination.append(previous,element('span','listing-page-status',`Page ${page} of ${totalPages}`),next);
 }
 async function load(scroll=false){
  const ticket=++sequence;controller?.abort();
  const currentController=new AbortController();controller=currentController;
  const timer=setTimeout(()=>currentController.abort(),15000);
  grid.setAttribute('aria-busy','true');grid.replaceChildren();pagination.replaceChildren();pagination.hidden=true;status.hidden=false;retry.hidden=true;
  status.textContent='正在加载房源… Loading properties…';count.textContent='Loading published listings…';
  if(scroll)document.getElementById('listings').scrollIntoView({behavior:'smooth',block:'start'});
  const params=new URLSearchParams({page:String(page),sort:sort.value});
  for(const [key,value] of Object.entries(filters))if(value!==''&&value!=='0')params.set(key,value);
  try{
   const response=await fetch('/api/properties?'+params,{signal:currentController.signal,cache:'no-store'});
   const result=await response.json();if(ticket!==sequence)return;
   if(!response.ok||!Array.isArray(result.properties)||!Number.isInteger(result.total)||!Number.isInteger(result.totalPages)||result.totalPages<1)throw new Error('Unavailable');
   if(page>result.totalPages){page=result.totalPages;return load(scroll);}
   const cards=result.properties.map(card);grid.replaceChildren(...cards);
   count.textContent=`${result.total} matching listing${result.total===1?'':'s'} · Page ${page} of ${result.totalPages}`;
   feedback.textContent=addressFeedback.textContent=result.total?`${result.total} matching listing${result.total===1?'':'s'} found.`:'No matching properties. Try another area or fewer filters. 未找到符合条件的房源。';
   status.hidden=result.total>0;status.textContent=result.total?'':'暂无符合条件的已发布房源。No matching published properties.';
   pages(result.totalPages);
  }catch{
   if(ticket!==sequence)return;
   grid.replaceChildren();count.textContent='Properties unavailable · 房源暂时无法加载';status.hidden=false;status.textContent='无法加载房源，请重试或通过 WhatsApp 联系 Joel。Unable to load properties. Please retry or contact Joel.';retry.hidden=false;
  }finally{clearTimeout(timer);if(ticket===sequence)grid.setAttribute('aria-busy','false');}
 }
 const facetMessage=element('p','note');facetMessage.hidden=true;quick.append(facetMessage);
 async function loadChoices(){
  try{
   const response=await fetch('/api/properties?facets=1',{cache:'no-store',signal:AbortSignal.timeout(10000)});const result=await response.json();
   if(!response.ok||!Array.isArray(result.cities)||!Array.isArray(result.types))throw new Error();
   for(const [id,values,label] of [['search-city',result.cities,'All locations'],['search-type',result.types,'All Property Types']]){
    const select=document.getElementById(id),selected=select.value;select.replaceChildren(new Option(label,''),...values.map(value=>new Option(value,value)));select.value=selected;
   }
   facetMessage.hidden=true;
  }catch{facetMessage.hidden=false;facetMessage.textContent='地区／房型选项暂时无法加载；仍可使用关键词和价格搜索。Location/type choices unavailable. Keyword and price search remain available.';}
 }
 document.querySelectorAll('[data-search-tab]').forEach(tab=>tab.addEventListener('click',()=>{
  document.querySelectorAll('[data-search-tab]').forEach(item=>{const active=item===tab;item.classList.toggle('is-active',active);item.setAttribute('aria-selected',String(active));});
  for(const [key,panel] of Object.entries({quick,address,map:document.getElementById('map-search-panel')})){const active=key===tab.dataset.searchTab;panel.hidden=!active;panel.classList.toggle('is-active',active);}
 }));
 const maximum=document.getElementById('max-price'),minimum=document.getElementById('min-price');
 function validateRange(){maximum.setCustomValidity(maximum.value!==''&&minimum.value!==''&&Number(minimum.value)>Number(maximum.value)?'Maximum price must be at least the minimum price. 最高价不能低于最低价。':'');}
 minimum.addEventListener('input',validateRange);maximum.addEventListener('input',validateRange);
 quick.addEventListener('submit',event=>{
  event.preventDefault();validateRange();if(!quick.reportValidity())return;
  for(const [key,id] of Object.entries({city:'search-city',q:'search-query',type:'search-type',minPrice:'min-price',maxPrice:'max-price',beds:'min-beds',baths:'min-baths'}))filters[key]=document.getElementById(id).value;
  page=1;load(true);
 });
 address.addEventListener('submit',event=>{
  event.preventDefault();quick.reset();maximum.setCustomValidity('');Object.assign(filters,{city:'',q:document.getElementById('address-query').value.trim(),type:'',minPrice:'',maxPrice:'',beds:'0',baths:'0'});document.getElementById('search-query').value=filters.q;page=1;load(true);
 });
 sort.addEventListener('change',()=>{page=1;load(true)});
 retry.addEventListener('click',()=>{loadChoices();load()});
 document.getElementById('map-city').addEventListener('change',event=>{document.getElementById('map-search-link').href='https://www.google.com/maps/search/'+encodeURIComponent('property '+event.target.value);});
 loadChoices();load();
})();

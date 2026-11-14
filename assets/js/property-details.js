/* Public property details: data and credentials stay behind the read-only API. */
(()=>{
 const status=document.getElementById('property-status'),retry=document.getElementById('property-retry');
 const article=document.getElementById('property-detail'),params=new URLSearchParams(location.search),id=params.get('id');
 const valid=params.getAll('id').length===1&&id&&/^[1-9]\d{0,18}$/.test(id)&&Number.isSafeInteger(Number(id));
 const set=(name,value)=>{document.getElementById(name).textContent=value;};
 const unavailable=(text,canRetry=false)=>{article.hidden=true;status.hidden=false;status.textContent=text;retry.hidden=!canRetry;document.querySelector('meta[name=robots]').content='noindex,follow';};
 async function load(){
  if(!valid){unavailable('请选择有效房源。A valid property ID is required.');return;}
  article.hidden=true;retry.hidden=true;status.hidden=false;status.textContent='正在加载房源详情… Loading property details…';
  try{
   const response=await fetch('/api/property?'+new URLSearchParams({id}),{cache:'no-store',signal:AbortSignal.timeout(15000)});
   if(response.status===404){unavailable('房源不存在或暂未公开。This property is not available.');return;}
   const result=await response.json();if(!response.ok||!result.property||String(result.property.id)!==id)throw new Error();
   const row=result.property,title=row.title||'Property · 房源';
   set('property-title',title);set('property-location',[row.township,row.city].filter(Boolean).join(' · ')||'Location not provided');
   set('property-price',row.price!==null&&row.price!==''&&Number.isFinite(Number(row.price))?new Intl.NumberFormat('en-MY',{style:'currency',currency:'MYR',maximumFractionDigits:2}).format(Number(row.price)):'Price on request · 询价');
   const missing='Not provided · 未提供';
   for(const [field,target] of [['property_type','property-type'],['listing_type','property-listing-type'],['bedrooms','property-bedrooms'],['bathrooms','property-bathrooms'],['land_size','property-land-size']])set(target,row[field]===null||row[field]===undefined||row[field]===''?missing:String(row[field]));
   set('property-description',row.description||'Description not provided. 暂未提供房源描述。');set('property-reference','Property ID · 房源编号: '+row.id);
   const contact=document.getElementById('property-whatsapp');contact.href='https://wa.me/60177075731?text='+encodeURIComponent(`Hi Joel, I would like to know more about ${title} (property ID: ${row.id}).`);
   document.title=title+' | Joel Tan Property';document.querySelector('meta[name=description]').content=[title,row.township,row.city,'Contact Joel Tan (REN 77649) for details.'].filter(Boolean).join(' · ');
   let canonical=document.querySelector('link[rel=canonical]');if(!canonical){canonical=document.createElement('link');canonical.rel='canonical';document.head.append(canonical);}canonical.href='https://joeltan.my/property.html?'+new URLSearchParams({id});
   document.querySelector('meta[name=robots]').content='index,follow';status.hidden=true;article.hidden=false;
  }catch{unavailable('无法加载详情，请重试或通过 WhatsApp 联系 Joel。Unable to load details. Please retry or contact Joel.',true);}
 }
 retry.addEventListener('click',load);
 // Same mobile navigation and floating-link behavior as the homepage.
 const mobile=matchMedia('(max-width:620px)');
 for(const [container,button,links] of [[document.querySelector('header .nav'),document.getElementById('nav-toggle'),document.getElementById('primary-links')],[document.getElementById('floating-nav'),document.getElementById('floating-nav-toggle'),document.getElementById('floating-nav-links')]]){
  const setOpen=open=>{container.classList.toggle('is-open',open);button.setAttribute('aria-expanded',String(open));button.setAttribute('aria-label',(open?'Close ':'Open ')+(button.id==='nav-toggle'?'navigation':'property links'));button.firstElementChild.textContent=open?'×':'☰';};
  button.addEventListener('click',()=>setOpen(button.getAttribute('aria-expanded')!=='true'));
  links.addEventListener('click',event=>{if(event.target.closest('a'))setOpen(false)});
  document.addEventListener('click',event=>{if(!container.contains(event.target))setOpen(false)});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&button.getAttribute('aria-expanded')==='true'){setOpen(false);button.focus()}});
  mobile.addEventListener('change',()=>setOpen(false));
 }
 function updateViewport(){if(mobile.matches)document.documentElement.style.setProperty('--mobile-viewport-height',(window.visualViewport?.height||innerHeight)+'px');}
 window.addEventListener('resize',updateViewport);window.visualViewport?.addEventListener('resize',updateViewport);updateViewport();
 document.getElementById('year').textContent=new Date().getFullYear();
 load();
})();

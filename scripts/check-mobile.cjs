// Local browser verification: node scripts/check-mobile.cjs
// Uses installed Chrome, serves only this checkout, never contacts deployment APIs.
const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),os=require('node:os');
const {spawn,execFileSync}=require('node:child_process');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8').replace(/\r\n/g,'\n');
const baseline=execFileSync('git',['show','HEAD:index.html'],{cwd:root,encoding:'utf8',maxBuffer:10000000}).replace(/\r\n/g,'\n');
for(const tag of baseline.match(/<article class="card"[\s\S]*?<\/article>/g)) assert.ok(html.includes(tag),'Listing data preserved');
for(const tag of baseline.match(/<meta\b[^>]*>|<link rel="canonical"[^>]*>|<script type="application\/ld\+json">[\s\S]*?<\/script>/g)) assert.ok(html.includes(tag),'SEO preserved');
for(const s of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) s[0].includes('application/ld+json')?JSON.parse(s[1]):new Function(s[1]);
assert.ok(!html.includes('data:image/'),'Images extracted');
for(const m of html.matchAll(/assets\/images\/[\w.-]+/g)) assert.ok(fs.statSync(path.join(root,m[0])).size>0,'Asset exists');
const server=http.createServer((req,res)=>{
  const file=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]==='/'?'/index.html':req.url.split('?')[0]));
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  fs.readFile(file,(err,data)=>{if(err){res.writeHead(404).end();return;}res.setHeader('Content-Type',({'html':'text/html; charset=utf-8','jpg':'image/jpeg','png':'image/png','webp':'image/webp','avif':'image/avif'})[path.extname(file).slice(1)]||'application/octet-stream');res.end(data);});
});
const pause=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const url=`http://127.0.0.1:${server.address().port}/`;
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'joel-mobile-'));
 const chrome=spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',['--headless=new','--disable-gpu','--no-first-run','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore',windowsHide:true});
 let ws;
 try{
  let port;for(let i=0;i<100;i++){try{port=fs.readFileSync(path.join(profile,'DevToolsActivePort'),'utf8').split('\n')[0];break;}catch{await pause(100);}}
  assert.ok(port,'Chrome started');
  const targets=await(await fetch(`http://127.0.0.1:${port}/json`)).json();
  ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);
  await new Promise(r=>ws.addEventListener('open',r,{once:true}));
  let id=0;const pending=new Map(),errors=[];
  ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text);});
  const send=(method,params={})=>new Promise((resolve,reject)=>{const key=++id;pending.set(key,{resolve,reject});ws.send(JSON.stringify({id:key,method,params}));});
  const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});assert.ok(!r.exceptionDetails,JSON.stringify(r.exceptionDetails));return r.result.value;};
  await send('Runtime.enable');await send('Page.enable');
  // External listing images/font services are outside this local layout regression check.
  await send('Network.enable');await send('Network.setBlockedURLs',{urls:['*fonts.googleapis.com*','*fonts.gstatic.com*','*images.unsplash.com*','*img.edgeprop.my*']});
  const outputs=[];
  for(const width of [320,375,390,430,620,768,1440]){
   await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<=620});
   await send('Page.navigate',{url});
   for(let i=0;i<100;i++){if(await evaluate("document.readyState==='complete' && !!document.getElementById('listing-count') && document.getElementById('listing-count').textContent.includes('matching')"))break;await pause(100);}
   const layout=await evaluate(`(()=>{const ids=['home','listings','about','fieldwork'];return {width:innerWidth,scroll:document.documentElement.scrollWidth,sections:[...document.querySelector('main').children].filter(e=>ids.includes(e.id)).map(e=>e.id),filters:getComputedStyle(document.getElementById('more-filters')).display,broken:[...document.images].filter(e=>e.getAttribute('src').startsWith('assets/')&&e.complete&&!e.naturalWidth).map(e=>e.src)}})()`);
   assert.ok(layout.scroll<=width,`Overflow at ${width}: ${JSON.stringify(layout)}`);
   assert.deepEqual(layout.sections,width<=620?['home','listings','about','fieldwork']:['about','fieldwork','home','listings']);
   assert.equal(layout.filters,width<=620?'none':'contents');assert.deepEqual(layout.broken,[]);
   if(width<=620){
    assert.ok(await evaluate("!!document.getElementById('nav-toggle')"),'Mobile navigation toggle exists');
    assert.equal(await evaluate("getComputedStyle(document.getElementById('primary-links')).display"),'none');
    await evaluate("document.getElementById('nav-toggle').click()");
    assert.equal(await evaluate("document.getElementById('nav-toggle').getAttribute('aria-expanded')"),'true');
    assert.equal(await evaluate("getComputedStyle(document.querySelector('#primary-links a:last-child')).display"),'flex');
    await evaluate("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))");
    assert.equal(await evaluate("document.getElementById('nav-toggle').getAttribute('aria-expanded')"),'false');
    assert.ok(await evaluate("(()=>{const e=document.getElementById('floating-nav');return !['fixed','absolute','sticky'].includes(getComputedStyle(e).position)})()"),'Platform links do not overlay inputs');
    await evaluate("document.documentElement.style.scrollBehavior='auto';document.getElementById('max-price').scrollIntoView({block:'center',behavior:'instant'})");
    assert.ok(await evaluate("(()=>{const e=document.getElementById('max-price'),r=e.getBoundingClientRect();return [[r.left+4,r.top+4],[r.right-4,r.bottom-4],[(r.left+r.right)/2,(r.top+r.bottom)/2]].every(([x,y])=>document.elementFromPoint(x,y)===e)})()"),'Price input remains directly clickable');
    await evaluate("document.getElementById('nav-toggle').click();document.querySelector('#primary-links a[href=\"#listings\"]').click()");
    assert.equal(await evaluate("document.getElementById('nav-toggle').getAttribute('aria-expanded')"),'false');
    await evaluate("document.getElementById('more-filters-toggle').click()");
    assert.equal(await evaluate("getComputedStyle(document.getElementById('more-filters')).display"),'grid');
    await evaluate("document.getElementById('min-beds').value='3';document.getElementById('quick-search-panel').requestSubmit()");
    assert.equal(await evaluate("document.querySelectorAll('#listings .card:not([hidden])').length"),2);
    await evaluate("document.getElementById('more-filters-toggle').click()");
    assert.equal(await evaluate("document.getElementById('min-beds').value"),'3');
   }
   for(const mode of ['address','map','quick']){
    await evaluate(`document.querySelector('[data-search-tab="${mode}"]').click()`);
    assert.equal(await evaluate(`document.getElementById('${mode==='quick'?'quick':mode}-search-panel').hidden`),false);
   }
   await evaluate("document.getElementById('map-city').value='Iskandar Puteri, Johor';document.getElementById('map-city').dispatchEvent(new Event('change'))");
   assert.ok(decodeURIComponent(await evaluate("document.getElementById('map-search-link').href")).includes('Iskandar Puteri'));
   const cases=[
    [{},['Imperia Condominium','Forest City','Johor Jaya Anggerik 1-Storey Corner House']],
    [{'search-city':'Iskandar Puteri'},['Imperia Condominium']],
    [{'search-city':'Gelang Patah'},['Forest City']],
    [{'search-city':'Johor Bahru'},['Johor Jaya Anggerik 1-Storey Corner House']],
    [{'search-query':'IMPERIA'},['Imperia Condominium']],
    [{'search-type':'land'},[]],
    [{'min-price':'400000','max-price':'700000'},['Johor Jaya Anggerik 1-Storey Corner House']],
    [{'min-beds':'3','min-baths':'4'},['Imperia Condominium']],
    [{'search-city':'Johor Bahru','max-price':'500000'},[]],
    [{'min-price':'395000','max-price':'395000'},['Forest City']]
   ];
   for(const [values,expected] of cases){
    const actual=await evaluate(`(()=>{const defaults={'search-city':'','search-query':'','search-type':'','min-price':'','max-price':'','min-beds':'0','min-baths':'0'};for(const [id,value] of Object.entries({...defaults,...${JSON.stringify(values)}}))document.getElementById(id).value=value;document.getElementById('quick-search-panel').requestSubmit();return [...document.querySelectorAll('#listings .card:not([hidden]) h3')].map(e=>e.textContent)})()`);
    assert.deepEqual(actual,expected,`Search mismatch at ${width}: ${JSON.stringify(values)}`);
   }
   await evaluate("document.getElementById('max-price').value='500000';document.getElementById('min-beds').value='0';document.getElementById('quick-search-panel').requestSubmit()");
   assert.equal(await evaluate("document.querySelector('#listings .card:not([hidden]) h3').textContent"),'Forest City');
   await evaluate("document.getElementById('address-query').value='Johor Jaya';document.getElementById('address-search-panel').requestSubmit()");
   assert.equal(await evaluate("document.querySelectorAll('#listings .card:not([hidden])').length"),1);
   assert.ok((await evaluate("document.querySelector('.mobile-whatsapp').href")).includes('60177075731'));
   await evaluate("window.open=(url)=>{window.testWhatsApp=url};document.getElementById('name').value='Mobile Buyer';document.getElementById('phone').value='0123456789';document.getElementById('message').value='Johor home';document.getElementById('lead-form').requestSubmit()");
   assert.ok(decodeURIComponent(await evaluate('window.testWhatsApp')).includes('Mobile Buyer'));
   await evaluate('window.scrollTo(0,0)');
   if(width===390||width===1440){const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(profile,`homepage-${width}.png`),Buffer.from(shot.data,'base64'));}
   outputs.push({width,status:'PASS'});
  }
  // Resizing an already-loaded page must restore DOM and filter visibility.
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:900,deviceScaleFactor:1,mobile:true});await pause(150);
  assert.equal(await evaluate("document.querySelector('main>section').id"),'home');
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});await pause(150);
  assert.equal(await evaluate("document.querySelector('main>section').id"),'about');
  assert.equal(await evaluate("getComputedStyle(document.getElementById('more-filters')).display"),'contents');
  const localImages=[...new Set([...html.matchAll(/assets\/images\/[\w.-]+/g)].map(m=>m[0]))];
  const decoded=await evaluate(`Promise.all(${JSON.stringify(localImages)}.map(src=>new Promise(resolve=>{const image=new Image();image.onload=()=>resolve({src,width:image.naturalWidth,height:image.naturalHeight});image.onerror=()=>resolve({src,error:true});image.src=src;})))`);
  assert.ok(decoded.every(image=>!image.error),'All extracted images decode');
  assert.deepEqual(errors,[],'No runtime exceptions');
  console.log(JSON.stringify({checks:outputs,staticChecks:'SEO, listing data, local assets, image decoding, script syntax PASS',runtimeErrors:errors,screenshots:profile,htmlBytes:Buffer.byteLength(html)},null,2));
 }finally{if(ws)ws.close();chrome.kill();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});

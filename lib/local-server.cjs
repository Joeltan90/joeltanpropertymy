const fs=require('node:fs/promises'),http=require('node:http'),path=require('node:path');
const {handleProperties,handleProperty}=require('./properties.cjs');
const root=path.resolve(__dirname,'..');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css','.svg':'image/svg+xml','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.avif':'image/avif','.txt':'text/plain','.xml':'application/xml'};
function createLocalServer({apiOptions={},apiHandler=handleProperties,detailHandler=handleProperty}={}){
 return http.createServer(async(req,res)=>{
  try{
   const url=new URL(req.url,'http://localhost');
   if(url.pathname==='/api/properties'){
    const response=await apiHandler(new Request(url,{method:req.method}),apiOptions);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));return;
   }
   if(url.pathname==='/api/property'){
    const response=await detailHandler(new Request(url,{method:req.method}),apiOptions);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));return;
   }
   if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405).end();return;}
   const name=decodeURIComponent(url.pathname),relative=name==='/'?'index.html':name.slice(1);
   if(!['index.html','property.html','robots.txt','sitemap.xml'].includes(relative)&&!/^assets\/[a-zA-Z0-9_./-]+$/.test(relative)){res.writeHead(404).end();return;}
   const target=path.resolve(root,relative);
   if(!target.startsWith(root+path.sep)||relative.split('/').some(part=>part.startsWith('.'))){res.writeHead(404).end();return;}
   const data=await fs.readFile(target);res.setHeader('Content-Type',mime[path.extname(target)]||'application/octet-stream');res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.end(req.method==='HEAD'?undefined:data);
  }catch(error){res.writeHead(error.code==='ENOENT'?404:500).end();}
 });
}
module.exports={createLocalServer};

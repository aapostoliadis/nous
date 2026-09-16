const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const {status,ask,saveClaudeKey,listModels,audioRequest} = require('./providers.cjs');
const root = __dirname;
const port = Number(process.env.PORT || 4179);
const hosted=process.env.VERCEL==='1';
const hosts=new Set(hosted
  ? [process.env.VERCEL_URL,process.env.VERCEL_PROJECT_PRODUCTION_URL,process.env.VERCEL_BRANCH_URL,...(process.env.NOUS_ALLOWED_HOSTS||'').split(',')].filter(Boolean).map(host=>host.trim().toLowerCase())
  : [`localhost:${port}`,`127.0.0.1:${port}`]);
const publicFiles=new Set(['index.html','app.js','ask.js','connections.js','map-fullscreen.js','style.css','kit-theme.css','dropdowns.css','map-fullscreen.css','ask.css','connections.css','thinking-orbs.js','audio-tools.js','dictation.js','ux-refinements.css','vendor/thinking-orbs/engine.es.js']);
let busy=false;
function json(res,code,data){res.writeHead(code,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));}
async function handler(req,res){
  const host=String(req.headers.host||'').toLowerCase();
  if(!hosts.has(host)) return json(res,403,{error:'Host not allowed.'});
  if(req.headers.origin && (hosted ? req.headers.origin!==`https://${host}` : ![`http://localhost:${port}`,`http://127.0.0.1:${port}`].includes(req.headers.origin))) return json(res,403,{error:'Origin not allowed.'});
  if(req.headers['sec-fetch-site']==='cross-site') return json(res,403,{error:'Origin not allowed.'});
  let url;try{url=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{return json(res,400,{error:'Invalid path.'});}
  if(url==='/api/providers'&&req.method==='GET') return json(res,200,{providers:status(),hosted});
  if(url==='/api/models'&&req.method==='GET') {
    const params=new URL(req.url,'http://localhost').searchParams;
    try{return json(res,200,await listModels(params.get('provider'),{force:params.get('refresh')==='1'}));}
    catch(e){return json(res,e.status||502,{error:e.status?e.message:'Could not reach the model catalogue. Try refreshing.'});}
  }
  if(url==='/api/connections/anthropic'&&req.method==='POST') {
    if(hosted) return json(res,403,{error:'Manage hosted API keys in Vercel environment settings.'});
    if(!req.headers.origin||req.headers['content-type']!=='application/json') return json(res,403,{error:'Save credentials from Nous Connections.'});
    try {
      let raw='',size=0;
      for await(const chunk of req){size+=chunk.length;if(size>2048)return json(res,413,{error:'Invalid key input.'});raw+=chunk;}
      const input=JSON.parse(raw);
      saveClaudeKey(input.key);
      return json(res,200,{saved:true});
    }catch(e){return json(res,e.status||400,{error:e.status?e.message:'Could not save the key.'});}
  }
  if(['/api/ask','/api/audio'].includes(url)&&req.method==='POST') {
    if(url==='/api/audio'&&!req.headers.origin)return json(res,403,{error:'Open Audio tools in Nous.'});
    if(!String(req.headers['content-type']).startsWith('application/json')) return json(res,415,{error:'JSON required.'});
    if(busy) return json(res,409,{error:'Another request is still running. Please wait.'});
    busy=true;
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),90000);
    res.on('close',()=>{if(!res.writableEnded)controller.abort();});
    try {
      let body='',size=0;
      for await(const chunk of req){size+=chunk.length;if(size>(url==='/api/audio'?18000000:350000)){const e=new Error('Workspace exceeds the supported request size.');e.status=413;throw e;}body+=chunk;}
      let input;try{input=JSON.parse(body);}catch{const e=new Error('Invalid JSON request.');e.status=400;throw e;}
      if(url==='/api/ask'&&input.stream===true){
        res.writeHead(200,{'Content-Type':'application/x-ndjson; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
        res.flushHeaders();
        const emit=data=>{if(!res.destroyed)res.write(JSON.stringify(data)+'\n');};
        emit({type:'start'});
        const result=await ask(input,fetch,controller.signal,answer=>emit({type:'answer',answer}));
        emit({type:'complete',result});res.end();
      }else json(res,200,await (url==='/api/audio'?audioRequest:ask)(input,fetch,controller.signal));
    } catch(e) { if(!res.destroyed){const error=e.status?e.message:controller.signal.aborted?'Request timed out or was cancelled. No changes were made.':'Could not reach the provider. No changes were made.';if(res.headersSent)res.end(JSON.stringify({type:'error',error})+'\n');else json(res,e.status||502,{error});} }
    finally{clearTimeout(timeout);busy=false;}
    return;
  }
  if(!['GET','HEAD'].includes(req.method)) return json(res,405,{error:'Method not allowed.'});
  const relative=url==='/'?'index.html':url.slice(1);
  const asset=/^assets\/[a-z0-9_./-]+\.(?:svg|png|woff2)$/i.test(relative)&&!relative.includes('..');
  if(!publicFiles.has(relative)&&!asset) return json(res,404,{error:'Not found.'});
  const file=path.resolve(root,relative);
  if(!file.startsWith(root+path.sep)) return json(res,403,{error:'Invalid path.'});
  let data;try{data=await fs.promises.readFile(file);}catch{return json(res,404,{error:'Not found.'});}
  res.setHeader('Content-Type',({'html':'text/html; charset=utf-8','js':'text/javascript','css':'text/css','svg':'image/svg+xml','png':'image/png','woff2':'font/woff2'})[path.extname(file).slice(1)]);res.setHeader('Cache-Control','no-cache');res.setHeader('X-Content-Type-Options','nosniff');res.end(req.method==='HEAD'?undefined:data);
}
module.exports=handler;
if(require.main===module){
const server=http.createServer(handler);
server.requestTimeout=100000;
server.listen(port,'127.0.0.1',()=>{
  console.log(`Nous is running at http://localhost:${port}`);
  if(process.argv.includes('--open')&&process.platform==='win32') require('node:child_process').execFile('cmd.exe',['/c','start','','http://localhost:'+port]);
});
}

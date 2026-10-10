const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
if(!process.argv.includes('--fixture')){
  for(const mode of ['local','hosted']){
    const run=spawnSync(process.execPath,[__filename,'--fixture',mode],{encoding:'utf8',env:{...process.env,VERCEL:mode==='hosted'?'1':'',PORT:'4179',VERCEL_URL:'nous-preview.vercel.app',VERCEL_PROJECT_PRODUCTION_URL:'nous-production.vercel.app',VERCEL_BRANCH_URL:'nous-main.vercel.app',NOUS_ALLOWED_HOSTS:'thought.example'}});
    assert.equal(run.status,0,run.stdout+run.stderr);process.stdout.write(run.stdout);
  }
}else{
  const hosted=process.argv.at(-1)==='hosted';
  let asks=0,modelKey;
  const userKey='sk-fixture-user-key-0123456789';
  const providerPath=require.resolve('../app/providers.cjs');
  require.cache[providerPath]={id:providerPath,filename:providerPath,loaded:true,exports:{
    status:()=>[{id:'openai',configured:false}],
    listModels:async(provider,opts)=>{modelKey=opts.key;return {models:[]};},
    ask:async(input,fetch,signal,emit)=>{asks++;assert.equal(input.prompt,'Hello');assert.equal(input.key,userKey,'Key must come from the header, not the body');emit?.('First part');await new Promise(r=>setTimeout(r,30));return {answer:'First part, complete.'};},
    audioRequest:async()=>({ok:true})
  }};
  const originalListen=http.Server.prototype.listen;
  http.Server.prototype.listen=()=>{throw Error('Import must not open a listening socket');};
  const handler=require('../app/server.cjs');
  http.Server.prototype.listen=originalListen;
  assert.equal(typeof handler,'function');
  for(const root of ['..','../app']){
    const config=JSON.parse(fs.readFileSync(path.join(__dirname,root,'vercel.json'),'utf8'));
    assert.equal(config.builds[0].src.endsWith('vercel-entry.mjs'),true);
    assert.equal(config.builds[0].config.helpers,false);
    assert.equal(config.routes[0].dest.endsWith('vercel-entry.mjs'),true);
  }
  const server=http.createServer(handler);
  (async()=>{
    await new Promise(r=>server.listen(0,'127.0.0.1',r));
    const host=hosted?'nous-production.vercel.app':'localhost:4179';
    const origin=(hosted?'https://':'http://')+host;
    function request(url,options={}){
      return new Promise((resolve,reject)=>{
        const req=http.request({host:'127.0.0.1',port:server.address().port,path:url,method:options.method||'GET',headers:{Host:host,...options.headers}},res=>{
          let body='';const chunks=[];res.on('data',chunk=>{body+=chunk;chunks.push(chunk.toString());});res.on('end',()=>resolve({status:res.statusCode,body,headers:res.headers,chunks}));
        });req.on('error',reject);req.end(options.body);
      });
    }
    try{
      const home=await request('/');assert.equal(home.status,200);assert.match(home.body,/<html/i);
      const assets=[...home.body.matchAll(/(?:src|href)="([^"#]+\.(?:js|css|svg|woff2)(?:\?[^"#]*)?)"/g)].map(m=>m[1]).filter(p=>!p.includes('://'));
      assert.ok(assets.length>=14,'All script and stylesheet links must be checked');
      for(const asset of assets)assert.equal((await request('/'+asset.replace(/^\//,''))).status,200,asset);
      assert.equal((await request('/',{method:'HEAD'})).body,'');
      for(const privatePath of ['/.env.local','/server.cjs','/providers.cjs','/vercel.json','/../.env.local'])assert.equal((await request(privatePath)).status,404,privatePath);
      assert.equal((await request('/',{headers:{Host:'attacker.example'}})).status,403);
      assert.equal((await request('/api/providers',{headers:{Origin:'https://attacker.example'}})).status,403);
      assert.equal((await request('/api/providers',{headers:{'Sec-Fetch-Site':'cross-site'}})).status,403);
      const linked=await request('/',{headers:{'Sec-Fetch-Site':'cross-site'}});
      assert.equal(linked.status,200,'A link from another site must open the page');
      assert.equal(linked.headers['content-security-policy'],"frame-ancestors 'none'");assert.equal(linked.headers['x-frame-options'],'DENY');
      assert.equal((await request('/api/providers',{headers:{'Sec-Fetch-Site':'cross-site','Sec-Fetch-Mode':'navigate'}})).status,403);
      assert.equal((await request('/app.js',{headers:{'Sec-Fetch-Site':'cross-site','Sec-Fetch-Mode':'no-cors'}})).status,403);
      const status=await request('/api/providers',{headers:{Origin:origin}});assert.equal(status.status,200);assert.equal(JSON.parse(status.body).hosted,hosted);
      assert.equal((await request('/api/connections/anthropic',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:'{"key":"fixture-only"}'})).status,405,'Server-side key saving is removed');
      assert.equal((await request('/api/models?provider=openai',{headers:{Origin:origin,'X-Provider-Key':userKey}})).status,200);assert.equal(modelKey,userKey);
      for(const body of ['null','[]','"text"'])assert.equal((await request('/api/ask',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body})).status,400,body);
      const stream=await request('/api/ask',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','X-Provider-Key':userKey},body:'{"prompt":"Hello","stream":true,"key":"from-body-ignored"}'});
      assert.equal(stream.status,200);assert.equal(asks,1);
      const events=stream.body.trim().split('\n').map(JSON.parse);assert.deepEqual(events.map(e=>e.type),['start','answer','complete']);
      assert.ok(stream.chunks.length>=2,'Response should arrive progressively');
      const together=await Promise.all([1,2].map(()=>request('/api/ask',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','X-Provider-Key':userKey},body:'{"prompt":"Hello"}'})));
      assert.deepEqual(together.map(r=>r.status),[200,200],'One visitor\'s request must not block another\'s');assert.equal(asks,3);
      if(hosted){
        for(const alias of ['nous-preview.vercel.app','nous-main.vercel.app','thought.example'])assert.equal((await request('/',{headers:{Host:alias,Origin:'https://'+alias}})).status,200);
        assert.equal((await request('/',{headers:{Origin:'http://'+host}})).status,403);
        assert.equal((await request('/',{headers:{Origin:'https://nous-preview.vercel.app'}})).status,403);
      }
      console.log(`Hosting ${hosted?'Vercel':'local'}: HTML, ${assets.length} assets, streaming, origins and private routes passed.`);
    }finally{await new Promise(r=>server.close(r));}
  })().catch(error=>{console.error(error);process.exitCode=1;});
}

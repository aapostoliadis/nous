// Runs every tests/verify-*.cjs and syntax-checks every script under app/. A new verify file is picked up without editing package.json.
const {spawnSync}=require('node:child_process'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..'),failures=[];
const run=(label,args)=>{const r=spawnSync(process.execPath,args,{cwd:root,stdio:'inherit'});if(r.status!==0)failures.push(label);};

for(const file of fs.readdirSync(__dirname).filter(f=>/^verify-.+\.cjs$/.test(f)).sort())run(file,[path.join('tests',file)]);

// There is no build step, so this is the only check that the shipped scripts parse.
const skipSyntax=new Set([]);
for(const file of fs.readdirSync(path.join(root,'app')).filter(f=>/\.(js|cjs|mjs)$/.test(f)&&!skipSyntax.has(f)).sort())run('syntax: app/'+file,['--check',path.join('app',file)]);

if(failures.length){console.error('\nFailed: '+failures.join(', '));process.exit(1);}
console.log('\nAll test files and syntax checks passed.');

// Checks the Tech Innovation style: its tokens exist, text and controls meet contrast minimums, and the menu, script and fonts are wired up.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const app=path.join(__dirname,'..','app');
const read=f=>fs.readFileSync(path.join(app,f),'utf8');

const css=read('dark-theme.css');
const block=css.match(/:root\[data-theme=tech\]\{([^}]*)\}/);
assert.ok(block,'dark-theme.css must define :root[data-theme=tech]');
const t={};for(const m of block[1].matchAll(/--([a-z0-9-]+):([^;]+)/g))t[m[1]]=m[2].trim();

// The four theme colours, in their roles.
assert.equal(t.bg,'#1e1e1e');assert.equal(t.ink,'#ffffff');assert.equal(t.accent,'#00ffff');assert.equal(t.solid,'#0066ff');

const lum=h=>{assert.match(h,/^#[0-9a-f]{6}$/,`Expected a 6-digit hex colour, got ${h}`);const c=[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return .2126*c[0]+.7152*c[1]+.0722*c[2]};
const ratio=(a,b)=>{const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
const need=(fg,bg,min)=>{const r=ratio(t[fg],t[bg]);assert.ok(r>=min,`--${fg} on --${bg} is ${r.toFixed(2)}:1, needs ${min}:1`)};

for(const bg of['bg','surface','raised','raised-2']){need('ink',bg,4.5);need('muted',bg,4.5);need('accent',bg,4.5);need('accent-strong',bg,4.5)}
for(const bg of['bg','surface','raised'])need('subtle',bg,4.5);
need('accent-strong','accent-bg',4.5);need('ink','accent-bg',4.5);need('ink','blue-bg',4.5);
need('on-solid','solid',4.5);need('on-solid','solid-hover',4.5);
need('solid','bg',3);need('line-strong','bg',3);

// Fonts: both weights declared, the files exist, and the style uses them.
for(const w of['400','700']){
  const file=`assets/fonts/dejavu-sans-latin-${w}-normal.woff2`;
  assert.ok(css.includes(`url('${file}')`),`dark-theme.css must load ${file}`);
  assert.equal(fs.readFileSync(path.join(app,file)).subarray(0,4).toString('latin1'),'wOF2',`${file} must be a WOFF2 file`);
}
assert.ok(fs.existsSync(path.join(app,'assets/fonts/DejaVu-Sans-LICENSE.txt')),'The DejaVu licence must ship with the font');
assert.match(t.sans,/^'DejaVu Sans',/);assert.match(t.serif,/^'DejaVu Sans',/);

// Wiring.
assert.match(read('theme.js'),/tech:'Tech Innovation'/,'theme.js must list the style');
const html=read('index.html');
const option=html.match(/<button[^>]*data-theme-option="tech"[^>]*>.*?<\/button>/);
assert.ok(option,'index.html must offer the style in #theme-menu');
assert.ok(option[0].includes('class="theme-swatch"'),'The option needs a .theme-swatch; theme.js reads it on click');
assert.ok(option[0].includes('Tech Innovation'));

// Default: run theme.js against stubs and read the style it sets.
const vm=require('node:vm');
const boot=(saved,systemDark=false)=>{
  const root={dataset:{},classList:{add(){},remove(){}}};
  const store=saved instanceof Error?{getItem(){throw saved},setItem(){}}:{getItem:()=>saved,setItem(){}};
  vm.runInNewContext(read('theme.js'),{localStorage:store,matchMedia:q=>({matches:q.includes('dark')&&systemDark,addEventListener(){}}),document:{documentElement:root,getElementById:()=>null,querySelectorAll:()=>[],addEventListener(){}}});
  return root.dataset;
};
assert.deepEqual({...boot(null)},{theme:'tech',mode:'dark'},'No saved choice must open in Tech Innovation');
assert.equal(boot('nonsense').theme,'tech','An unknown saved value must open in Tech Innovation');
assert.equal(boot(new Error('blocked')).theme,'tech','Blocked storage must open in Tech Innovation');
assert.deepEqual({...boot('light')},{theme:'light'},'A saved Light choice must be kept, without data-mode');
assert.equal(boot('warm').theme,'warm','A saved Warm ink choice must be kept');
assert.equal(boot('system',true).theme,'tech','System on a dark system must resolve to Tech Innovation');
assert.equal(boot('system',false).theme,'light','System on a light system must resolve to Light');
for(const old of['dark','graphite','forest'])assert.equal(boot(old).theme,'tech',`The removed style "${old}" must open in Tech Innovation`);

console.log('PASS theme: Tech Innovation tokens, contrast, fonts, menu wiring and default.');

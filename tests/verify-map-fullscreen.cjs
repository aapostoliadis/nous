// Checks that Escape can leave the full screen map in browsers that do not know the :open selector.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'..','app','map-fullscreen.js'),'utf8');

const found=source.match(/function pickerOpen\(\)\{[^\n]*\}/);
assert.ok(found,'map-fullscreen.js must define pickerOpen() on one line');
const build=document=>new Function('document',found[0]+';return pickerOpen;')(document);

// Safari before 26.5 and Firefox before 136 throw on a selector they do not know.
assert.equal(build({querySelector(){throw new SyntaxError('unknown selector');}})(),false,'An unknown selector must read as no picker open');
assert.equal(build({querySelector:()=>null})(),false,'No picker is open');
assert.equal(build({querySelector:selector=>selector==='select:open'?{}:null})(),true,'An open picker must be reported');

assert.equal(source.split('select:open').length-1,1,'The :open selector must appear once, inside pickerOpen()');
assert.ok(source.includes("!document.querySelector('#dialog').open && !pickerOpen()"),'The Escape handler must ask pickerOpen()');
// The map's full screen mode lives in the app viewport. The script never enters native full screen, so it must not carry code to leave it.
assert.equal(source.includes('ownsFullscreen'),false,'The unused ownsFullscreen flag must be gone');
assert.equal(source.includes('exitFullscreen'),false,'The script must not try to leave native full screen');
assert.ok(source.includes("document.addEventListener('fullscreenchange', fitMap);"),'A native full screen change must only refit the map');
console.log('PASS map full screen: Escape works where the :open selector is unknown');

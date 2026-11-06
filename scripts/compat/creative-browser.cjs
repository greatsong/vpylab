const { execFileSync } = require('node:child_process');
const os = require('node:os');
let puppeteer;
try { puppeteer = require('puppeteer'); } catch {
  const globalModules = execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim();
  puppeteer = require(require('node:path').join(globalModules, 'puppeteer'));
}
const fs = require('node:fs'); const path = require('node:path'); const assert = require('node:assert/strict'); const vm = require('node:vm');
const root = process.env.VPYLAB_CREATIVE_ROOT || path.resolve(__dirname, '../..');
const baseURL = process.env.VPYLAB_TEST_URL || 'http://127.0.0.1:4033';
const setCode = vm.runInNewContext(fs.readFileSync(path.join(root,'scripts/compat/browser-harness.mjs'),'utf8').match(/const SET_CODE_FN = (`[\s\S]*?`);/)[1]);
(async()=>{
 const { getTutorial } = await import(path.join(root,'client/src/data/tutorials.js'));
 const browser = await puppeteer.launch({headless:'shell',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--mute-audio']});
 const results=[]; const out=process.env.VPYLAB_TEST_OUT || path.join(os.tmpdir(), 'vpylab-creative-browser'); fs.mkdirSync(out,{recursive:true});
 try {
 const page = await browser.newPage(); await page.bringToFront();
 const waitForFunction=page.waitForFunction.bind(page);page.waitForFunction=(fn,options,...args)=>waitForFunction(fn,{polling:100,...options},...args); await page.setViewport({width:1440,height:1000}); const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error' && /THREE|WebGL|shader|Uncaught/.test(m.text()))errors.push(m.text())});
 await page.evaluateOnNewDocument(()=>{const W=window.Worker;window.__audit=[];window.Worker=class extends W{constructor(...args){super(...args);this.addEventListener('message',e=>{let d=e.data;if(typeof d==='string'){try{d=JSON.parse(d)}catch{return}}window.__audit.push(d);});}};});
 await page.goto(baseURL + '/tutorials',{waitUntil:'domcontentloaded'});
 await page.waitForSelector('main a[href^="/tutorials/"]');
 assert.equal(await page.$$eval('main a[href^="/tutorials/"]',a=>a.length),7);
 await page.goto(baseURL + '/sandbox',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='실행'&&!b.disabled),{timeout:60000});
 async function run(code) {
  const stop=await page.evaluateHandle(()=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='정지'&&!b.disabled)); if(stop.asElement()){await stop.asElement().evaluate(e=>e.click());await new Promise(r=>setTimeout(r,300));}
  await page.evaluate(`(${setCode})(${JSON.stringify(code)})`);await new Promise(r=>setTimeout(r,100));
  await page.evaluate(()=>{window.__audit=[]});
  const button=await page.evaluateHandle(()=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='실행'&&!b.disabled));assert.ok(button.asElement());await button.asElement().evaluate(e=>e.click());
 }
 async function done(){await page.waitForFunction(()=>window.__audit.some(d=>d.type==='done'||d.type==='error'),{timeout:30000});assert.deepEqual(await page.evaluate(()=>window.__audit.filter(d=>d.type==='error')),[]);}
 async function shot(name){await new Promise(r=>setTimeout(r,250));const state=await page.evaluate(async()=>{const b=await import(performance.getEntriesByType('resource').map(e=>e.name).find(name=>new URL(name).pathname.endsWith('/src/engine/vpython-bridge.js')));return ['obj_1','obj_3'].map(id=>{const m=b.getMesh(id);const c=m?.parent?._cameraSystem;return {id,type:m?.userData?.vpType,mesh:m?.position.toArray(),visible:m?.visible,canvas:m?.parent?._vpCanvasId,camera:c?.getState(),aspect:c?.camera?.aspect,projection:c?.camera?.projectionMatrix?.elements,pixels:(()=>{const renderer=m?.parent?._renderer;if(!renderer)return null;const gl=renderer.getContext();if(gl.isContextLost())return -1;const w=gl.drawingBufferWidth,h=gl.drawingBufferHeight;const pixels=new Uint8Array(w*h*4);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,pixels);let count=0;for(let i=0;i<pixels.length;i+=16)if(Math.abs(pixels[i]-pixels[0])+Math.abs(pixels[i+1]-pixels[1])+Math.abs(pixels[i+2]-pixels[2])>15)count++;return count;})()};});});fs.writeFileSync(path.join(out,name+'-state.json'),JSON.stringify(state,null,2));for(const obj of state.filter(x=>x.mesh))assert.ok(obj.pixels>10,name+': geometry must be visible '+JSON.stringify(obj));await page.screenshot({path:path.join(out,name+'.png')});results.push({name,passed:true,visibleObjects:state.filter(x=>x.mesh).map(x=>({id:x.id,canvas:x.canvas,pixels:x.pixels,camera:x.camera}))});console.log(name,'passed');}
 await run(getTutorial('hemisphere').code);await done();
 await page.waitForFunction(async()=>{const r=await import('/src/engine/object-registry.js');return r.getSnapshot().filter(x=>x.type==='triangle').length===256;});await shot('hemisphere');
 await run(getTutorial('signal-lab','sound').code);await done();
 assert.equal(await page.evaluate(()=>window.__audit.filter(d=>d.type==='batch').flatMap(d=>d.commands).filter(c=>c.action==='sound').length),0);
 await page.$eval('[data-vpylab-widgets] button',e=>{e.focus();e.click()});
 await page.waitForFunction(()=>window.__audit.filter(d=>d.type==='batch').flatMap(d=>d.commands).some(c=>c.action==='sound'&&c.name==='C4'));await shot('signal-sound-after-click');
 await run(getTutorial('team-signals').code);await done();
 await page.$$eval('[data-vpylab-widgets] button',b=>b[1].click());await page.waitForFunction(async()=>{const b=await import(performance.getEntriesByType('resource').map(e=>e.name).find(name=>new URL(name).pathname.endsWith('/src/engine/vpython-bridge.js')) || '/src/engine/vpython-bridge.js');return b.getMesh('obj_1').scale.y===1.8;});await shot('team-signal-b');
 const multi=`from vpython import *\na=canvas(range=2,title='FIRST')\nx=sphere(radius=0.3)\ndef first(e):\n    x.pos.x += 0.5\n    print('FIRST_EVENT')\na.bind('keydown',first)\nbutton(text='First only',bind=first)\nb=canvas(range=5,title='SECOND')\ny=box(size=vec(1,1,1))\ndef second(e):\n    y.pos.y += 1\n    print('SECOND_EVENT')\nb.bind('keydown',second)\nbutton(text='Second only',bind=second)\n`;
 for(const repeat of [1,2]){
  await run(multi);await done();await page.waitForFunction(()=>document.querySelectorAll('[data-vpylab-canvas-id]').length===3);
  await page.waitForSelector('[data-vpylab-canvas-id="canvas_1"] button');
  await page.$eval('[data-vpylab-canvas-id="canvas_1"] [data-vpylab-widgets] button',e=>{e.focus();e.click()});
  await page.waitForFunction(async()=>{const b=await import(performance.getEntriesByType('resource').map(e=>e.name).find(name=>new URL(name).pathname.endsWith('/src/engine/vpython-bridge.js')) || '/src/engine/vpython-bridge.js');return b.getMesh('obj_1').position.x===0.5;});
  assert.equal(await page.evaluate(async()=>{const b=await import(performance.getEntriesByType('resource').map(e=>e.name).find(name=>new URL(name).pathname.endsWith('/src/engine/vpython-bridge.js')) || '/src/engine/vpython-bridge.js');return b.getMesh('obj_3').position.y}),0);
  await page.$eval('[data-vpylab-canvas-id="canvas_2"] canvas',e=>{e.focus();e.click()});await page.keyboard.press('ArrowLeft');
  await page.waitForFunction(async()=>{const b=await import(performance.getEntriesByType('resource').map(e=>e.name).find(name=>new URL(name).pathname.endsWith('/src/engine/vpython-bridge.js')) || '/src/engine/vpython-bridge.js');return b.getMesh('obj_3').position.y===1;});
  assert.equal(await page.evaluate(async()=>{const b=await import(performance.getEntriesByType('resource').map(e=>e.name).find(name=>new URL(name).pathname.endsWith('/src/engine/vpython-bridge.js')) || '/src/engine/vpython-bridge.js');return b.getMesh('obj_1').position.x}),0.5);
  await shot('multi-canvas-repeat-'+repeat);
 }
 await run('from vpython import *\nh=helix(size=vec(3,2,4),coils=2.5,thickness=0.2)\nh.ccw=False\nh.size.x=4\n');await done();
 assert.equal(await page.evaluate(async()=>{const b=await import(performance.getEntriesByType('resource').map(e=>e.name).find(name=>new URL(name).pathname.endsWith('/src/engine/vpython-bridge.js')) || '/src/engine/vpython-bridge.js');return b.getMesh('obj_1').geometry.parameters.radius}),0.1);await shot('helix-size');
 const corpus=JSON.parse(fs.readFileSync(path.join(root,'scripts/compat/corpus/corpus.json'),'utf8'));
 await run(corpus.find(c=>c.id==='gsexample:Rug').code);
 await page.waitForFunction(async()=>{const b=await import(performance.getEntriesByType('resource').map(e=>e.name).find(name=>new URL(name).pathname.endsWith('/src/engine/vpython-bridge.js')) || '/src/engine/vpython-bridge.js');return Array.from({length:50},(_,i)=>b.getMesh('obj_'+(i+1))).some(m=>m?.geometry?.getAttribute('position')?.array.some((v,i)=>i%3===2&&Math.abs(v)>0.001))},{timeout:30000});
 assert.equal(await page.evaluate(async()=>{const b=await import(performance.getEntriesByType('resource').map(e=>e.name).find(name=>new URL(name).pathname.endsWith('/src/engine/vpython-bridge.js')) || '/src/engine/vpython-bridge.js');const m=b.getMesh('obj_1');return !!m.material.map&&m.geometry.getAttribute('uv').count===6}),true);await shot('rug-uv-motion');
 assert.deepEqual(await page.evaluate(()=>window.__audit.filter(d=>d.type==='error')),[]);
 assert.deepEqual(errors,[]);
 }finally{const pages=await browser.pages();const last=pages.at(-1);if(last){fs.writeFileSync(path.join(out,'diagnostic.json'),JSON.stringify(await last.evaluate(async()=>({audit:window.__audit,body:document.body.innerText.slice(-3000),mesh:(await import(performance.getEntriesByType('resource').map(e=>e.name).find(name=>new URL(name).pathname.endsWith('/src/engine/vpython-bridge.js')) || '/src/engine/vpython-bridge.js')).getMesh('obj_1')?.scale.toArray()})).catch(e=>({error:String(e)})),null,2));await last.screenshot({path:path.join(out,'last.png')}).catch(()=>{});}fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({generatedAt:new Date().toISOString(),fingerprint:await (await import(path.join(root,'scripts/compat/evidence.mjs'))).compatibilityFingerprint(root),results},null,2));await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});

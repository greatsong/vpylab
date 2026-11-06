const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const puppeteer=require(path.join(execFileSync('npm',['root','-g'],{encoding:'utf8'}).trim(),'puppeteer'));
const root=path.resolve(__dirname,'../..'),dir=process.env.VPYLAB_LIVE_OUT||path.join(require('node:os').tmpdir(),'vpylab-forge-live-20261107'),base='https://vpylab.vercel.app';
const settings=Object.fromEntries(fs.readFileSync(path.join(root,'client/.env.production'),'utf8').split('\n').filter(s=>s.includes('=')).map(s=>{const i=s.indexOf('=');return[s.slice(0,i),s.slice(i+1).trim().replace(/^['"]|['"]$/g,'')]}));
const config={url:settings.VITE_SUPABASE_URL,key:settings.VITE_SUPABASE_ANON_KEY};
const prefix='forge-live-'+Date.now().toString(36),sourceTitle=prefix+' 원본 종',forkTitle=prefix+' 수정한 종',alias='대장간 기능 검증';
const report={startedAt:new Date().toISOString(),origin:base,prefix,scope:'Real account session and production DB via normal UI. No auth stubs, response interception, admin credentials, or unrelated record writes.',results:[],mutations:[],authenticated:false,cleanup:null};
const record=(name,data={})=>{report.results.push({name,passed:true,...data});console.log(name+' passed');};
const pause=ms=>new Promise(r=>setTimeout(r,ms));
let browser,page,sourceId,forkId,error,authReady=false;
async function button(text,scope='body'){
 const handle=await page.evaluateHandle(({text,scope})=>[...document.querySelector(scope).querySelectorAll('button')].find(e=>e.textContent.trim()===text),{text,scope});
 const element=handle.asElement();if(!element)throw Error('Missing button: '+text);await element.evaluate(e=>e.click());await handle.dispose();
}
async function fill(selector,text){await page.$eval(selector,(e,text)=>{e.focus();Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,text);e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));},text);assert(await page.$eval(selector,e=>e.value)===text,'Form did not accept the intended value');}
async function openPublish(){if(!await page.$eval('.forge-publish',e=>e.open))await page.$eval('.forge-publish summary',e=>e.click());}
async function library(tab){if(!await page.$('.forge-library-section'))await page.$eval('.forge-page-tabs button:nth-child(2)',e=>e.click());if(tab)await button(tab,'.forge-library-section');await page.waitForFunction(()=>!document.querySelector('.forge-library-section [role="status"]'),{timeout:20000});}
async function cardButton(title,label){
 await page.waitForFunction(({title,label})=>[...document.querySelectorAll('.forge-library-card')].some(e=>e.querySelector('h3')?.textContent===title&&[...e.querySelectorAll('button')].some(b=>b.textContent.trim()===label)),{timeout:25000},{title,label});
 const handle=await page.evaluateHandle(({title,label})=>[...document.querySelectorAll('.forge-library-card')].find(e=>e.querySelector('h3')?.textContent===title)&&[...[...document.querySelectorAll('.forge-library-card')].find(e=>e.querySelector('h3')?.textContent===title).querySelectorAll('button')].find(b=>b.textContent.trim()===label),{title,label});await handle.asElement().evaluate(e=>e.click());await handle.dispose();
}
async function capture(name){
 if(!page.url().startsWith(base+'/forge'))return;const style=await page.addStyleTag({content:'header button[aria-label="내 계정"] { visibility:hidden !important; }'});try{await page.screenshot({path:path.join(dir,name+'.png')});}finally{await style.evaluate(e=>e.remove());}
}
async function api(params,{anonymous=false,patch}={}){
 return page.evaluate(async({config,params,anonymous,patch})=>{
  const stored=JSON.parse(localStorage.getItem('vpylab-auth')||'null'),token=anonymous?config.key:stored?.access_token;
  if(!token)throw Error('Authenticated session unavailable');
  const query=new URLSearchParams(params);if(!anonymous)query.set('user_id','eq.'+window.__forgeLiveUserId);
  const url=new URL('/rest/v1/vpylab_gallery',config.url);url.search=query;
  const response=await fetch(url,{method:patch?'PATCH':'GET',credentials:'omit',headers:{apikey:config.key,Authorization:'Bearer '+token,...(patch?{'Content-Type':'application/json',Prefer:'return=representation'}:{})},...(patch?{body:JSON.stringify(patch)}:{})});
  const data=await response.json();if(!response.ok)throw Error('Gallery request failed: HTTP '+response.status+' code '+(data.code||'unknown'));
  return{status:response.status,data};
 },{config,params,anonymous,patch});
}
async function mutation(method,check,action){
 const responsePromise=page.waitForResponse(r=>{if(r.request().method()!==method||new URL(r.url()).pathname!=='/rest/v1/vpylab_gallery')return false;try{return check(JSON.parse(r.request().postData()||'{}'),new URL(r.url()))}catch{return false}},{timeout:25000});
 responsePromise.catch(()=>{});await action();const response=await responsePromise;assert(response.ok(),'Real DB mutation returned HTTP '+response.status());const body=await response.json(),data=Array.isArray(body)?body[0]:body;assert(data?.id,'Mutation did not return a record ID');report.mutations.push({method,status:response.status(),id:data.id});return data.id;
}
(async()=>{
 browser=await puppeteer.connect({browserWSEndpoint:fs.readFileSync(path.join(dir,'browser-endpoint'),'utf8'),defaultViewport:null});
 page=await browser.newPage();await page.setViewport({width:1440,height:1000});await page.goto(base+'/forge',{waitUntil:'domcontentloaded'});
 console.log('Waiting for user to complete real account login.');
 await page.waitForSelector('header button[aria-label="내 계정"]',{timeout:0});
 const authenticated=await page.evaluate(async config=>{const session=JSON.parse(localStorage.getItem('vpylab-auth')||'null');if(!session?.access_token)return false;const response=await fetch(new URL('/auth/v1/user',config.url),{credentials:'omit',headers:{apikey:config.key,Authorization:'Bearer '+session.access_token}});if(!response.ok)return false;const user=await response.json();if(!user.id)return false;window.__forgeLiveUserId=user.id;return true;},config);
 assert(authenticated,'Real account session validation failed');authReady=true;report.authenticated=true;record('real-authenticated-user-validated');
 if(!page.url().startsWith(base+'/forge')){await page.goto(base+'/forge',{waitUntil:'domcontentloaded'});await page.waitForSelector('header button[aria-label="내 계정"]');await page.evaluate(()=>{window.__forgeLiveUserId=JSON.parse(localStorage.getItem('vpylab-auth')).user.id;});}
 await page.waitForSelector('.forge-workbench');await page.waitForSelector('[data-forge-preview] canvas');await button('쓸모 있는 물건');await page.$eval('[data-forge-preset="bell"]',e=>e.click());await page.waitForSelector('[data-forge-preview="bell"]');
 await fill('.forge-register input',sourceTitle);await fill('.forge-register input[maxlength="500"]','자동 기능 검증용 원본입니다. 검증 후 비공개로 전환합니다.');await openPublish();await fill('.forge-publish input',alias);
 sourceId=await mutation('POST',body=>body.title===sourceTitle,()=>button('모두의 모듈에 공개 등록'));report.sourceId=sourceId;
 await page.waitForFunction(()=>document.querySelector('.forge-notice[role="status"]')?.textContent.includes('모두의 모듈에 공개했습니다.'),{timeout:20000});
 const original=await api({id:'eq.'+sourceId,select:'id,title,is_public,code,author_alias'});assert(original.data.length===1&&original.data[0].is_public===true,'Source was not publicly stored');record('real-source-created-through-ui',{id:sourceId});
 await library('모두의 모듈');await page.waitForFunction(title=>[...document.querySelectorAll('.forge-library-card h3')].some(e=>e.textContent===title),{timeout:20000},sourceTitle);
 assert(await page.evaluate(title=>![...document.querySelectorAll('.forge-library-card')].find(e=>e.querySelector('h3').textContent===title).querySelector('pre'),sourceTitle),'Public card exposed code by default');
 forkId=await mutation('POST',body=>body.remix_from===sourceId&&body.is_public===false,()=>cardButton(sourceTitle,'포크해서 가져오기 →'));report.forkId=forkId;
 await page.waitForSelector('[data-forge-preview="bell"]');
 const privateFork=await api({id:'eq.'+forkId,select:'id,title,is_public,remix_from,remix_from_title,remix_from_author,code'});
 assert(privateFork.data.length===1,'Private fork not readable by owner');assert(privateFork.data[0].is_public===false,'Fork was not private');assert(privateFork.data[0].remix_from===sourceId,'Fork source ID missing');assert(privateFork.data[0].remix_from_title===sourceTitle,'Fork source title missing');assert(privateFork.data[0].remix_from_author===alias,'Fork source author missing');
 assert((await api({id:'eq.'+forkId,select:'id'},{anonymous:true})).data.length===0,'Anonymous access to private fork was allowed');record('real-fork-private-and-anonymous-denied',{id:forkId});await capture('live-fork-private');
 const width=Number(await page.$eval('#forge-width',e=>e.value));await page.focus('#forge-width');await page.keyboard.press('ArrowRight');const changedWidth=Number(await page.$eval('#forge-width',e=>e.value));assert(changedWidth>width,'Slider edit did not apply');
 await fill('.forge-register input',forkTitle);await fill('.forge-register input[maxlength="500"]','실제 포크 후 너비와 이름을 수정한 검증 모듈입니다.');
 await fill('.forge-credits input[maxlength="100"]','대장간 참고');await fill('.forge-credits input[type="url"]',base+'/forge');await button('참고 기록 추가');await button('내 모듈 보관함에 등록');
 await openPublish();assert(await page.$eval('.forge-publish input',e=>e.value)===alias,'Fork replaced publisher alias');
 const publishedId=await mutation('PATCH',(body,url)=>url.searchParams.get('id')==='eq.'+forkId&&body.is_public===true,()=>button('모두의 모듈에 공개 등록'));assert(publishedId===forkId,'Republish created a different record');
 await page.waitForFunction(()=>document.querySelector('.forge-notice[role="status"]')?.textContent.includes('모두의 모듈에 공개했습니다.'),{timeout:20000});
 const published=await api({id:'eq.'+forkId,select:'id,title,is_public,remix_from,remix_from_title,remix_from_author,author_alias,code'},{anonymous:true});assert(published.data.length===1,'Published fork not visible anonymously');const row=published.data[0];
 const {moduleFromPublishedCode}=await import(path.join(root,'client/src/forge/modules.js'));const module=moduleFromPublishedCode(row.code);assert(module,'Published module did not round-trip');assert(module.recipe.params.width===changedWidth,'Edited width not saved');assert(row.title===forkTitle,'Edited title not saved');assert(row.remix_from===sourceId&&row.remix_from_title===sourceTitle&&row.remix_from_author===alias,'Attribution not preserved');assert(row.author_alias===alias,'Publisher alias not preserved');assert(module.references.some(r=>r.url===base+'/forge'),'Reference link not saved');record('real-edits-and-republication-preserve-source',{id:forkId,widthBefore:width,widthAfter:changedWidth});await capture('live-fork-published');
 await library('모두의 모듈');await page.waitForFunction(title=>[...document.querySelectorAll('.forge-library-card h3')].some(e=>e.textContent===title),{timeout:20000},forkTitle);record('real-public-catalog-shows-published-fork');await capture('live-public-catalog');
 await library('내 모듈');const hiddenId=await mutation('PATCH',(body,url)=>url.searchParams.get('id')==='eq.'+forkId&&body.is_public===false,()=>cardButton(forkTitle,'내 모듈 공개 내리기'));assert(hiddenId===forkId,'Unpublish targeted another record');
 await page.waitForFunction(title=>[...document.querySelectorAll('.forge-library-card')].some(e=>e.querySelector('h3').textContent===title&&[...e.querySelectorAll('p')].some(p=>p.textContent==='비공개')),{timeout:20000},forkTitle);
 const hidden=await api({id:'eq.'+forkId,select:'id,is_public,remix_from'});assert(hidden.data.length===1&&!hidden.data[0].is_public&&hidden.data[0].remix_from===sourceId,'Owner private record or provenance missing after unpublish');assert((await api({id:'eq.'+forkId,select:'id'},{anonymous:true})).data.length===0,'Unpublished module still visible anonymously');record('real-unpublish-hides-fork-and-preserves-private-record');await capture('live-unpublished');
 await mutation('PATCH',(body,url)=>url.searchParams.get('id')==='eq.'+sourceId&&body.is_public===false,()=>cardButton(sourceTitle,'내 모듈 공개 내리기'));record('real-source-unpublished-through-ui');
 await library('모두의 모듈');await page.waitForFunction(prefix=>![...document.querySelectorAll('.forge-library-card h3')].some(e=>e.textContent.startsWith(prefix)),{timeout:20000},prefix);record('real-public-catalog-no-test-modules');
})().catch(e=>{error=e;report.error={name:e.name,message:e.message.replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,'[redacted]')};console.error(report.error.name+': '+report.error.message);process.exitCode=1;}).finally(async()=>{
 try{if(authReady){const rows=await api({title:'like.%'+prefix+'%',select:'id,title,is_public'});const publicRows=rows.data.filter(r=>r.is_public);if(publicRows.length){for(const row of publicRows)await api({id:'eq.'+row.id,select:'id,is_public'},{patch:{is_public:false}});report.cleanupFallback=true;}
 const owner=await api({title:'like.%'+prefix+'%',select:'id,is_public'}),anonymous=await api({title:'like.%'+prefix+'%',select:'id'},{anonymous:true});report.cleanup={privateRecords:owner.data.filter(r=>!r.is_public).length,publicRecords:owner.data.filter(r=>r.is_public).length,anonymousVisible:anonymous.data.length};assert(report.cleanup.publicRecords===0&&report.cleanup.anonymousVisible===0,'Cleanup left public test data');await capture('live-final-private');}}
 catch(e){report.cleanupError=e.message;process.exitCode=1;console.error('Cleanup requires attention: '+e.message);}
 report.completedAt=new Date().toISOString();report.passed=!error&&!report.cleanupError;fs.writeFileSync(path.join(dir,'results.json'),JSON.stringify(report,null,2));if(browser)browser.disconnect();console.log('Live verification finished: '+(report.passed?'PASS':'FAIL'));console.log('Results contain no passwords, access tokens, emails, or account IDs.');
});

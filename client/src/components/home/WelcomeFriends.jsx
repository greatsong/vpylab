import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import * as THREE from 'three';
import { welcomeFriends, welcomeLighting, welcomeTogether, welcomeTogetherLighting, welcomeBounce, welcomeActions } from '../../data/welcome-friends';
import StillFriend from './WelcomeStill';
import { createWelcomeModel } from './welcome-geometry';
import { createWelcomeStage } from './welcome-stage';

export default function WelcomeFriends({ko=true}){
 const [id,setId]=useState('dumpling'),[webgl,setWebgl]=useState(true),[wave,setWave]=useState(0),[stageOn,setStageOn]=useState(true),[motionAllowed,setMotionAllowed]=useState(()=>typeof matchMedia==='function'&&!matchMedia('(prefers-reduced-motion: reduce)').matches);
 const host=useRef(null),runtime=useRef(null),friend=id==='friends'?welcomeTogether:welcomeFriends.find(f=>f.id===id)||welcomeFriends.at(-1);
 const selectedId=friend.id,lighting=selectedId==='friends'?welcomeTogetherLighting:welcomeLighting[selectedId];
 useEffect(()=>{
  let renderer;
  try{renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});}catch{queueMicrotask(()=>setWebgl(false));return;}
  const el=host.current,scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-2,2,2,-2,.1,30);
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));renderer.setClearColor(0x000000,0);renderer.domElement.setAttribute('aria-hidden','true');el.appendChild(renderer.domElement);
  camera.position.set(.9,1.1,7);camera.lookAt(0,.08,0);
  scene.add(new THREE.AmbientLight(0xffffff,.95));const key=new THREE.DirectionalLight(0xfff7ee,1.3),fill=new THREE.DirectionalLight(0xdceaff,.45);key.position.set(-3,5,6);fill.position.set(4,2,2);scene.add(key,fill);
  const stage=createWelcomeStage(scene);
  const reduced=typeof matchMedia==='function'?matchMedia('(prefers-reduced-motion: reduce)'):{matches:true},state={renderer,scene,camera,model:null,frame:0,start:null,reduced,stage,render:null};
  const render=()=>renderer.render(scene,camera);state.render=render;
  state.draw=time=>{if(!state.model)return;if(state.start===null)state.start=time;const elapsed=(time-state.start)/1000,members=state.model.members,playing=!reduced.matches&&elapsed<(members?6:2.4);if(members)members.forEach((m,i)=>m.group.position.copy(m.basePosition).add(new THREE.Vector3(0,playing?welcomeBounce(elapsed,i):0,0)));state.model.animate(playing?elapsed:0);render();el.dataset.motion=playing?'playing':'still';state.frame=playing?requestAnimationFrame(state.draw):0;};
  state.play=()=>{cancelAnimationFrame(state.frame);state.start=null;if(reduced.matches)state.draw(performance.now());else state.frame=requestAnimationFrame(state.draw);};
  const resize=()=>{if(!el.clientWidth||!el.clientHeight)return;const aspect=el.clientWidth/el.clientHeight,r=Math.max(1.75,2.05/aspect);camera.left=-r*aspect;camera.right=r*aspect;camera.top=r;camera.bottom=-r;camera.updateProjectionMatrix();renderer.setSize(el.clientWidth,el.clientHeight);render();};
  const observer=typeof ResizeObserver==='function'?new ResizeObserver(resize):null;observer?.observe(el);window.addEventListener('resize',resize);const motionChanged=()=>{setMotionAllowed(!reduced.matches);state.play();};if(reduced.addEventListener)reduced.addEventListener('change',motionChanged);else reduced.addListener?.(motionChanged);runtime.current=state;resize();
  const lost=e=>{e.preventDefault();cancelAnimationFrame(state.frame);setWebgl(false);};renderer.domElement.addEventListener('webglcontextlost',lost);
  return()=>{cancelAnimationFrame(state.frame);observer?.disconnect();window.removeEventListener('resize',resize);if(reduced.removeEventListener)reduced.removeEventListener('change',motionChanged);else reduced.removeListener?.(motionChanged);renderer.domElement.removeEventListener('webglcontextlost',lost);state.model?.dispose();stage.dispose();renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();runtime.current=null;};
 },[]);
 useEffect(()=>{const r=runtime.current;if(!r)return;cancelAnimationFrame(r.frame);if(r.model){r.scene.remove(r.model.group);r.model.dispose();}r.model=createWelcomeModel(selectedId);r.scene.add(r.model.group);const bounds=new THREE.Box3().setFromObject(r.model.group);r.stage.setGround(bounds.min.y-.05);r.play();},[selectedId]);
 useEffect(()=>{if(wave)runtime.current?.play();},[wave]);
 useEffect(()=>{const r=runtime.current;if(!r)return;r.stage.setLighting(stageOn,lighting);r.render();},[stageOn,lighting]);
 return <section className="welcome-friends" aria-label={ko?'코드로 만든 환영 친구':'A welcome friend made with code'}>
  <p className="welcome-hello" aria-live="polite">{friend.line[ko?'ko':'en']}</p>
  <div className="welcome-stage" data-welcome-friend={selectedId} data-welcome-renderer={webgl?'webgl':'svg'} data-stage-light={stageOn?'on':'off'} data-friends-count={selectedId==='friends'?4:1} role="img" aria-label={friend.label[ko?'ko':'en']}>
   <div ref={host} className="welcome-canvas" style={{visibility:webgl?'visible':'hidden'}}/>
   {!webgl&&<StillFriend id={selectedId}/>}
  </div>
  <div className="welcome-choices" role="group" aria-label={ko?'맞이할 친구 고르기':'Choose a welcome friend'}>{[...welcomeFriends,welcomeTogether].map(f=><button key={f.id} onClick={()=>setId(f.id)} aria-pressed={f.id===selectedId}><span style={{background:f.color||'#b9d8ce'}} aria-hidden="true"/>{f.label[ko?'ko':'en'].replace(' 친구','')}</button>)}</div>
  <div className="welcome-actions"><button disabled={!webgl||!motionAllowed} onClick={()=>setWave(n=>n+1)}>{!webgl||!motionAllowed?(ko?'정적인 인사':'A still hello'):(selectedId==='friends'?(ko?'통통 튀기':'Bounce together'):welcomeActions[selectedId][ko?'ko':'en'])} <span aria-hidden="true">↗</span></button><button aria-pressed={stageOn} onClick={()=>setStageOn(on=>!on)}>{ko?'무대 조명':'Stage lights'} <span aria-hidden="true">{stageOn?'●':'○'}</span></button><Link to={'/tutorials/welcome-friend?step='+selectedId}>{ko?(selectedId==='friends'?'프렌즈, 내 코드로 만들기':'이 친구, 내 코드로 만들기'):'Build with code'} →</Link></div>
  <p className="welcome-motion-guide"><Link to={'/tutorials/welcome-friend?step='+selectedId+'-motion'}>{ko?'이 모션, 내 코드로 만들기':'Build this action with code'} →</Link></p>
  <p className="welcome-light-label">{lighting.label[ko?'ko':'en']}</p>
  <p className="welcome-note">{ko?'작은 도형을 모으면 친구가 돼요. 나도 만들어 볼까요?':'Small shapes make a friend. Try making one yourself.'}</p>
 </section>;
}

import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import * as THREE from 'three';
import { welcomeFriends, welcomeWaveAngle } from '../../data/welcome-friends';
import StillFriend from './WelcomeStill';
import { createWelcomeModel } from './welcome-geometry';

export default function WelcomeFriends({ko=true}){
 const [id,setId]=useState('dumpling'),[webgl,setWebgl]=useState(true),[wave,setWave]=useState(0),[motionAllowed,setMotionAllowed]=useState(()=>typeof matchMedia==='function'&&!matchMedia('(prefers-reduced-motion: reduce)').matches);
 const host=useRef(null),runtime=useRef(null),friend=welcomeFriends.find(f=>f.id===id);
 useEffect(()=>{
  let renderer;
  try{renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});}catch{queueMicrotask(()=>setWebgl(false));return;}
  const el=host.current,scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-2,2,2,-2,.1,30);
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));renderer.setClearColor(0x000000,0);renderer.domElement.setAttribute('aria-hidden','true');el.appendChild(renderer.domElement);
  camera.position.set(1.3,.8,7);camera.lookAt(0,.08,0);
  scene.add(new THREE.AmbientLight(0xffffff,1.6));const key=new THREE.DirectionalLight(0xfff7e5,2),fill=new THREE.DirectionalLight(0xdceaff,.8);key.position.set(-3,5,6);fill.position.set(4,2,2);scene.add(key,fill);
  const shadow=new THREE.Mesh(new THREE.CircleGeometry(1,48),new THREE.MeshBasicMaterial({color:0x829c91,transparent:true,opacity:.14,depthWrite:false}));shadow.rotation.x=-Math.PI/2;shadow.scale.set(1.05,.45,1);shadow.position.y=-1.02;scene.add(shadow);
  const reduced=typeof matchMedia==='function'?matchMedia('(prefers-reduced-motion: reduce)'):{matches:true},state={renderer,scene,camera,model:null,frame:0,start:null,reduced};
  const render=()=>renderer.render(scene,camera);
  state.draw=time=>{if(!state.model)return;if(state.start===null)state.start=time;const elapsed=(time-state.start)/1000;if(!reduced.matches&&elapsed<2.4){state.model.pivot.rotation.z=welcomeWaveAngle(Math.min(71,Math.floor(elapsed*30)));render();state.frame=requestAnimationFrame(state.draw);}else{state.model.pivot.rotation.z=0;state.frame=0;render();}};
  state.play=()=>{cancelAnimationFrame(state.frame);state.start=null;state.frame=requestAnimationFrame(state.draw);};
  const resize=()=>{if(!el.clientWidth||!el.clientHeight)return;const aspect=el.clientWidth/el.clientHeight,r=1.55;camera.left=-r*aspect;camera.right=r*aspect;camera.top=r;camera.bottom=-r;camera.updateProjectionMatrix();renderer.setSize(el.clientWidth,el.clientHeight);render();};
  const observer=typeof ResizeObserver==='function'?new ResizeObserver(resize):null;observer?.observe(el);window.addEventListener('resize',resize);const motionChanged=()=>{setMotionAllowed(!reduced.matches);state.play();};if(reduced.addEventListener)reduced.addEventListener('change',motionChanged);else reduced.addListener?.(motionChanged);runtime.current=state;resize();
  const lost=e=>{e.preventDefault();cancelAnimationFrame(state.frame);setWebgl(false);};renderer.domElement.addEventListener('webglcontextlost',lost);
  return()=>{cancelAnimationFrame(state.frame);observer?.disconnect();window.removeEventListener('resize',resize);if(reduced.removeEventListener)reduced.removeEventListener('change',motionChanged);else reduced.removeListener?.(motionChanged);renderer.domElement.removeEventListener('webglcontextlost',lost);state.model?.dispose();shadow.geometry.dispose();shadow.material.dispose();renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();runtime.current=null;};
 },[]);
 useEffect(()=>{const r=runtime.current;if(!r)return;cancelAnimationFrame(r.frame);if(r.model){r.scene.remove(r.model.group);r.model.dispose();}r.model=createWelcomeModel(id);r.scene.add(r.model.group);r.play();},[id]);
 useEffect(()=>{if(wave)runtime.current?.play();},[wave]);
 return <section className="welcome-friends" aria-label={ko?'코드로 만든 환영 친구':'A welcome friend made with code'}>
  <p className="welcome-hello" aria-live="polite">{friend.line[ko?'ko':'en']}</p>
  <div className="welcome-stage" data-welcome-friend={id} data-welcome-renderer={webgl?'webgl':'svg'} role="img" aria-label={friend.label[ko?'ko':'en']}>
   <div ref={host} className="welcome-canvas" style={{visibility:webgl?'visible':'hidden'}}/>
   {!webgl&&<StillFriend id={id}/>}
  </div>
  <div className="welcome-choices" role="group" aria-label={ko?'맞이할 친구 고르기':'Choose a welcome friend'}>{welcomeFriends.map(f=><button key={f.id} onClick={()=>setId(f.id)} aria-pressed={f.id===id}><span style={{background:f.color}} aria-hidden="true"/>{f.label[ko?'ko':'en'].replace(' 친구','')}</button>)}</div>
  <div className="welcome-actions"><button disabled={!webgl||!motionAllowed} onClick={()=>setWave(n=>n+1)}>{!webgl||!motionAllowed?(ko?'정적인 인사':'A still hello'):(ko?'손 흔들기':'Wave hello')} <span aria-hidden="true">↗</span></button><Link to={'/tutorials/welcome-friend?step='+id}>{ko?'이 친구, 내 코드로 만들기':'Build this friend with code'} →</Link></div>
  <p className="welcome-note">{ko?'작은 도형을 모으면 친구가 돼요. 나도 만들어 볼까요?':'Small shapes make a friend. Try making one yourself.'}</p>
 </section>;
}

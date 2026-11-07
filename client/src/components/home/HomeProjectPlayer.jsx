import { useCallback, useEffect, useRef, useState } from 'react';
import Viewport3D from '../viewport/Viewport3D';
import useAudioState from '../../hooks/useAudioState';
import usePyodide from '../../hooks/usePyodide';
import { clearScene, processBatch } from '../../engine/vpython-bridge';
import { clearRegistry } from '../../engine/object-registry';
import { stopAllSounds } from '../../engine/sound-system';

export default function HomeProjectPlayer({code,ko,onClose}){
 const audio=useAudioState();
 const sceneRef=useRef(null),pending=useRef([]),ran=useRef(false),[messages,setMessages]=useState([]),[failure,setFailure]=useState('');
 const log=useCallback(text=>setMessages(old=>[...old.slice(-7),String(text).slice(0,1000)]),[]);
 const error=useCallback(text=>{stopAllSounds();setFailure(String(text).slice(0,1000));log(text);},[log]);
 const done=useCallback(({stopped}={})=>{if(stopped)stopAllSounds();},[]);
 const batch=useCallback(commands=>{if(sceneRef.current)processBatch(commands,sceneRef.current);else pending.current.push(commands);},[]);
 const {initWorker,runCode,stopExecution,isReady,isRunning,progress,status}=usePyodide({onBatch:batch,onOutput:log,onError:error,onDone:done,locale:ko?'ko':'en'});
 const run=useCallback(()=>{if(!isReady)return;stopAllSounds();if(sceneRef.current){clearScene(sceneRef.current);sceneRef.current._cameraSystem?.onCodeStart();}clearRegistry();setMessages([]);setFailure('');runCode(code);},[isReady,runCode,code]);
 const stop=useCallback(()=>{stopExecution();stopAllSounds();},[stopExecution]);
 const retry=()=>{ran.current=false;setFailure('');initWorker();};
 useEffect(()=>{initWorker();},[initWorker]);
 useEffect(()=>{let active=true;if(isReady&&!ran.current)queueMicrotask(()=>{if(active&&!ran.current){ran.current=true;run();}});return()=>{active=false;};},[isReady,run]);
 useEffect(()=>()=>{stopAllSounds();clearRegistry();},[]);
 const runLabel=status==='stopping'?(ko?'정지 중…':'Stopping…'):isRunning?(ko?'실행 중':'Running'):isReady?(ko?'다시 실행':'Run again'):(ko?'준비 중 ':'Preparing ')+progress+'%';
 return <div className="home-project-player">
  <div className="home-project-controls">{status==='error'?<button type="button" onClick={retry}>{ko?'다시 준비':'Retry setup'}</button>:<button type="button" onClick={run} disabled={!isReady||isRunning}>{runLabel}</button>}{(isRunning||audio.playing)&&<button type="button" onClick={stop} disabled={status==='stopping'}>{ko?'정지':'Stop'}</button>}<button type="button" onClick={onClose}>{ko?'미리보기 닫기':'Close preview'}</button></div>
  {failure&&<p role="alert" className="p-3 text-xs" style={{color:'var(--color-error)'}}>{failure}<br/>{ko?'코드 수정에서 확인하거나 다시 실행해 주세요.':'Check Edit code or try again.'}</p>}
  <div className="home-project-viewport"><Viewport3D sceneRef={sceneRef} onSceneReady={scene=>{for(const commands of pending.current)processBatch(commands,scene);pending.current=[];}} controls={{onRun:run,onStop:stop,isRunning:isRunning||audio.playing,isReady}}/></div>
  {messages.length>0&&<details className="home-project-output"><summary>{ko?'실행 메시지':'Output'}</summary><pre>{messages.join('\n')}</pre></details>}
 </div>;
}

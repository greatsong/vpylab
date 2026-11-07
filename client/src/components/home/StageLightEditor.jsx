import { useState } from 'react';
import { defaultStageLights, normalizeStageLights, STAGE_LIGHT_RANGES, lightHue, lightColorFromHue } from '../../data/stage-lighting';
export default function StageLightEditor({settings,palette,onChange,ko}){
 const [index,setIndex]=useState(0),[error,setError]=useState(''),lights=normalizeStageLights(settings)||defaultStageLights(),light=lights[index];
 const update=(field,value,axis)=>{const next=lights.map((l,i)=>i===index?{...l,[field]:axis===undefined?value:l[field].map((v,j)=>j===axis?value:v)}:l);const result=onChange(next);setError(result?.ok===false?result.error:'');};
 return <details className="welcome-light-editor"><summary>{ko?'조명 조절':'Adjust lighting'}</summary>
  <label className="light-select">{ko?'조명 선택':'Select light'}<select value={index} onChange={e=>setIndex(Number(e.target.value))}><option value={0}>{ko?'조명 1':'Light 1'}</option><option value={1}>{ko?'조명 2':'Light 2'}</option></select></label>
  {['position','rotation'].map(field=><fieldset key={field}><legend>{field==='position'?(ko?'위치':'Position'):(ko?'각도 (°)':'Angle (°)')}</legend>{['X','Y','Z'].map((axis,j)=><label key={axis}><span>{axis}</span><input type="range" aria-label={(field==='position'?(ko?'조명 위치 ':'Light position '):(ko?'조명 각도 ':'Light angle '))+axis} min={STAGE_LIGHT_RANGES[field][j][0]} max={STAGE_LIGHT_RANGES[field][j][1]} step={field==='rotation'?1:.05} value={light[field][j]} onChange={e=>update(field,Number(e.target.value),j)}/><output>{light[field][j].toFixed(field==='rotation'?0:2)}</output></label>)}</fieldset>)}
  {[['size',ko?'빛 크기':'Beam size'],['brightness',ko?'밝기':'Brightness']].map(([field,label])=><label key={field}><span>{label}</span><input type="range" aria-label={label} min={STAGE_LIGHT_RANGES[field][0]} max={STAGE_LIGHT_RANGES[field][1]} step={.05} value={light[field]} onChange={e=>update(field,Number(e.target.value))}/><output>{light[field].toFixed(2)}</output></label>)}
  <label><span>{ko?'색상환':'Hue'}</span><input type="range" aria-label={ko?'조명 색상환':'Light hue'} min={0} max={360} step={1} value={Math.round(lightHue(light.color||(index?palette.right:palette.left)))} onChange={e=>update('color',lightColorFromHue(Number(e.target.value)))}/><output>{Math.round(lightHue(light.color||(index?palette.right:palette.left)))}</output></label>
  <label><span>{ko?'색상':'Color'}</span><input type="color" aria-label={ko?'조명 색상':'Light color'} value={light.color||(index?palette.right:palette.left)} onChange={e=>update('color',e.target.value)}/></label>
  <button type="button" onClick={()=>{const result=onChange(null);setError(result?.ok===false?result.error:'');}}>{ko?'기본 조명으로':'Restore lighting'}</button>{error&&<p role="alert">{error}</p>}
 </details>;
}

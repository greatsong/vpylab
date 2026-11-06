import { useState, useRef, useEffect } from 'react';

// React 텍스트 노드로 그려 예제의 부등호·문자열·주석을 그대로 보존합니다.
function highlightPython(code) {
 const pattern=/("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|#[^\n]*|\b(?:from|import|def|return|for|while|if|else|elif|True|False|None|in|not|and|or|as|raise)\b|\b\d+(?:\.\d*)?\b)/g;
 return code.split(pattern).map((value,index)=>{
  const kind=value.startsWith('#')?'muted':/^["']/.test(value)?'success':/^\d/.test(value)?'warning':/^(from|import|def|return|for|while|if|else|elif|True|False|None|in|not|and|or|as|raise)$/.test(value)?'accent':null;
  return kind?<span key={index} style={{color:`var(--color-${kind==='muted'?'text-muted':kind})`}}>{value}</span>:value;
 });
}
export default function DocCodeBlock({code,copyCode=code,label='Python 예제 코드',locale='ko'}) {
 const ko=locale==='ko';
 const [message,setMessage]=useState('');const timer=useRef(null);
 useEffect(()=>()=>clearTimeout(timer.current),[]);
 const copy=async()=>{
  try{await navigator.clipboard.writeText(copyCode);setMessage(ko?'복사했습니다.':'Copied.');}
  catch{setMessage(copyCode!==code?(ko?'복사하지 못했습니다. 실습에서 열기를 사용하거나 제공 함수를 펼쳐 import와 함께 복사하세요.':'Copy failed. Open in the workspace, or expand and copy the helper together with the import.'):(ko?'복사하지 못했습니다. 코드에 초점을 두고 직접 선택해 복사하세요.':'Copy failed. Focus the code and select it to copy manually.'));}
  clearTimeout(timer.current);timer.current=setTimeout(()=>setMessage(''),4000);
 };
 return <div className="mb-3 min-w-0"><div className="flex items-center justify-between gap-3 mb-2"><span role="status" className="text-xs" style={{color:'var(--color-text-muted)'}}>{message}</span><button type="button" onClick={copy} className="btn-secondary text-xs shrink-0" aria-label={copyCode===code?(ko?'예제 코드 복사':'Copy example code'):(ko?'제공 함수 포함 전체 코드 복사':'Copy complete code with helper')}>{copyCode===code?(ko?'코드 복사':'Copy code'):(ko?'전체 코드 복사':'Copy all code')}</button></div>
  <pre tabIndex={0} aria-label={label} className="overflow-x-auto text-[13px] leading-relaxed p-4 m-0 rounded-lg border" style={{fontFamily:'var(--font-mono)',backgroundColor:'var(--color-bg-secondary)',borderColor:'var(--color-border)',color:'var(--color-text-primary)'}}><code>{highlightPython(code)}</code></pre>
 </div>;
}

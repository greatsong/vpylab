import { useState, useId, useRef } from 'react';
import { originLabels } from '../../data/doc-origins';

export default function DocSidebar({docs,categories,selectedId,onSelect,searchQuery,onSearchChange,t,docsByCategory,locale='ko'}) {
 const listId=useId();
 const searchRef=useRef(null);
 const [collapsed,setCollapsed]=useState({});
 const ko=locale==='ko';
 const item=doc=><li key={doc.id}><button type="button" onClick={()=>onSelect(doc.id)} aria-current={doc.id===selectedId?'page':undefined} data-doc-topic={doc.id} className="w-full text-left rounded-md px-3 py-2 text-sm border-0" style={{backgroundColor:doc.id===selectedId?'var(--color-accent-bg)':'transparent',color:doc.id===selectedId?'var(--color-accent)':'var(--color-text-secondary)'}}><span className="block leading-relaxed">{doc.title?.[locale]||doc.title?.ko||doc.title}</span>{doc.origin==='vpylab'&&<span className="block text-[10px] mt-0.5" style={{color:'var(--color-accent)'}}>{originLabels.vpylab[locale]}</span>}</button></li>;
 return <div className="flex flex-col min-h-0 flex-1">
  <div className="p-3"><div className="flex items-center gap-1 border rounded-lg px-3" style={{borderColor:'var(--color-border)',backgroundColor:'var(--color-bg-secondary)'}}><input ref={searchRef} aria-label={t('docs.search')} type="search" value={searchQuery} onChange={e=>onSearchChange(e.target.value)} placeholder={t('docs.search')} className="w-full min-w-0 text-sm py-2 outline-none border-0 bg-transparent" style={{color:'var(--color-text-primary)'}}/>{searchQuery&&<button type="button" onClick={()=>{onSearchChange('');searchRef.current?.focus();}} aria-label={ko?'검색 지우기':'Clear search'} className="bg-transparent border-0 px-1 py-2" style={{color:'var(--color-text-muted)'}}>×</button>}</div></div>
  <div className="px-4 pb-2 text-[11px] leading-relaxed" style={{color:'var(--color-text-muted)'}}>{ko?'기본 도형은 VPython API · 자체 기능은 VPyLab 확장으로 표시합니다.':'Primitives use VPython API; app additions are labeled VPyLab extensions.'}</div>
  <nav className="flex-1 min-h-0 overflow-y-auto px-2 pb-5" aria-label={ko?'문서 주제':'Documentation topics'}>
   {searchQuery?<><p className="text-xs px-3 mb-2" style={{color:'var(--color-text-muted)'}}>{ko?`검색 결과 ${docs.length}개`:`${docs.length} results`}</p>{docs.length?<ul className="list-none p-0 m-0">{docs.map(item)}</ul>:<p className="text-sm px-3 py-5" style={{color:'var(--color-text-muted)'}}>{t('docs.noResults')}</p>}</>:categories.map(cat=>{
    const entries=docsByCategory[cat.id]||[];if(!entries.length)return null;
    const isCollapsed=collapsed[cat.id]??(cat.id!=='shape-guides'&&!entries.some(d=>d.id===selectedId));
    return <div key={cat.id}><button type="button" aria-expanded={!isCollapsed} aria-controls={`${listId}-${cat.id}`} onClick={()=>setCollapsed(s=>({...s,[cat.id]:!isCollapsed}))} className="w-full text-left border-0 bg-transparent px-3 pt-4 pb-2 text-xs font-semibold" style={{color:'var(--color-text-muted)'}}><span aria-hidden="true">{isCollapsed?'▸':'▾'} {cat.icon} </span>{cat.name}</button>{!isCollapsed&&<ul id={`${listId}-${cat.id}`} className="list-none p-0 m-0">{entries.map(item)}</ul>}</div>;
   })}
  </nav>
 </div>;
}

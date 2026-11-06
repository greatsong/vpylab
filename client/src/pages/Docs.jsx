import { useState, useMemo, useCallback, useRef, useLayoutEffect, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Header from '../components/layout/Header';
import DocSidebar from '../components/docs/DocSidebar';
import DocContent from '../components/docs/DocContent';
import docs, { docCategories, getDocById, searchDocs } from '../data/docs';
import { useI18n } from '../i18n/useI18n';

export default function Docs() {
  const { t, locale } = useI18n();
  const location = useLocation(), navigate = useNavigate();
  let hash;try { hash=decodeURIComponent(location.hash.slice(1)); } catch { hash=location.hash.slice(1); }
  const selectedDocId=hash || 'shape-start';
  const selectedDoc=getDocById(selectedDocId);
  const [searchQuery,setSearchQuery]=useState('');
  const [mobileMenuOpen,setMobileMenuOpen]=useState(false);
  const mainRef=useRef(null),menuButtonRef=useRef(null),mobileRef=useRef(null);
  const ko=locale==='ko';
  const filteredDocs=useMemo(()=>searchQuery?searchDocs(searchQuery,locale):docs,[searchQuery,locale]);
  const categories=useMemo(()=>Object.entries(docCategories).map(([id,c])=>({id,name:c[locale]||c.ko,icon:c.icon})),[locale]);
  const docsByCategory=useMemo(()=>Object.fromEntries(Object.keys(docCategories).map(id=>[id,docs.filter(d=>d.category===id)])),[]);
  const handleSelect=useCallback(id=>{navigate({pathname:'/docs',hash:'#'+id});setSearchQuery('');setMobileMenuOpen(false);},[navigate]);
  useLayoutEffect(()=>{if(mainRef.current)mainRef.current.scrollTop=0;},[selectedDocId]);
  useEffect(()=>{
    if(!mobileMenuOpen)return;
    const previous=document.activeElement;
    mobileRef.current?.querySelector('input')?.focus();
    const keydown=event=>{
      if(event.key==='Escape'){setMobileMenuOpen(false);return;}
      if(event.key==='Tab'){
        const items=[...mobileRef.current.querySelectorAll('button,input,a')].filter(el=>!el.disabled&&el.getClientRects().length);
        const first=items[0],last=items.at(-1);
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
      }
    };
    document.addEventListener('keydown',keydown);
    return()=>{document.removeEventListener('keydown',keydown);previous?.focus();};
  },[mobileMenuOpen]);
  const sidebar=<DocSidebar docs={filteredDocs} categories={categories} selectedId={selectedDocId} onSelect={handleSelect} searchQuery={searchQuery} onSearchChange={setSearchQuery} t={t} docsByCategory={docsByCategory} locale={locale}/>;
  return <div className="min-h-screen" style={{backgroundColor:'var(--color-bg-primary)'}}>
    <Header/>
    <div className="flex" style={{height:'calc(100dvh - 56px)'}}>
      <aside aria-label={ko?'문서 목록':'Documentation topics'} className="hidden md:flex flex-col shrink-0" style={{width:280,borderRight:'1px solid var(--color-border)',backgroundColor:'var(--color-bg-panel)'}}>{sidebar}</aside>
      <main ref={mainRef} className="flex-1 min-w-0 overflow-y-auto px-5 py-6 md:px-10 md:py-8" aria-label={ko?'문서 내용':'Documentation content'}>
        {selectedDoc?<DocContent key={selectedDoc.id} doc={selectedDoc} t={t}/>:<div style={{color:'var(--color-text-secondary)'}}><h1>{ko?'문서를 찾을 수 없습니다.':'Topic not found.'}</h1><button type="button" className="btn-secondary mt-4" onClick={()=>handleSelect('shape-start')}>{ko?'모양 만들기 시작으로':'Start making shapes'}</button></div>}
      </main>
    </div>
    {mobileMenuOpen&&<div className="md:hidden fixed inset-0 z-[100]" style={{backgroundColor:'rgba(0,0,0,.35)'}}>
      <button aria-label={ko?'문서 목록 닫기':'Close topics'} className="absolute inset-0 w-full border-0 bg-transparent" onClick={()=>setMobileMenuOpen(false)}/>
      <div ref={mobileRef} role="dialog" aria-modal="true" aria-label={ko?'문서 목록':'Documentation topics'} className="relative flex flex-col h-full" style={{width:'min(300px, 90vw)',backgroundColor:'var(--color-bg-panel)',boxShadow:'var(--shadow-md)'}}>
        <div className="flex justify-between items-center px-4 py-3 border-b" style={{borderColor:'var(--color-border)',color:'var(--color-text-primary)'}}><span>{t('docs.title')}</span><button type="button" className="btn-secondary" onClick={()=>setMobileMenuOpen(false)} aria-label={ko?'목록 닫기':'Close topic list'}>×</button></div>{sidebar}
      </div>
    </div>}
    <button ref={menuButtonRef} type="button" className="md:hidden fixed z-50 rounded-full px-4 py-3 border-0" style={{bottom:20,right:20,backgroundColor:'var(--color-accent)',color:'white',boxShadow:'var(--shadow-md)'}} onClick={()=>setMobileMenuOpen(true)} aria-expanded={mobileMenuOpen} aria-label={ko?'문서 목록 열기':'Open topic list'}>{ko?'문서 목록':'Topics'}</button>
  </div>;
}

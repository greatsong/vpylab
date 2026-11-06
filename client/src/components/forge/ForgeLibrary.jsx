import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { builtInModule, readForgeShelf } from '../../forge/modules';
import { fetchOwnForgeModules, fetchPublicForgeModules, unpublishForgeModule } from '../../forge/registry';
import { forgePresets } from '../../forge/recipes';
import useAuthStore from '../../stores/authStore';

export default function ForgeLibrary({onChoose,localModules,onRemove}) {
  const owner=useAuthStore(s=>s.user?.id);
  const [tab,setTab]=useState('mine'),[remote,setRemote]=useState([]),[account,setAccount]=useState([]),[page,setPage]=useState(0),[more,setMore]=useState(false),[loading,setLoading]=useState(false),[error,setError]=useState(''),[forking,setForking]=useState(null);
  const local=localModules||readForgeShelf(owner).modules;
  const own=[...new Map([...account,...local.map(module=>{const saved=account.find(m=>m.recordId===module.recordId);return saved?{...module,published:saved.published,ownerId:saved.ownerId,author:saved.author}:module;})].map(m=>[m.recordId||m.id,m])).values()];
  const load=async(next=0)=>{setLoading(true);setError('');try{const data=await fetchPublicForgeModules({page:next});setRemote(old=>next?[...old,...data.modules]:data.modules);setMore(data.hasMore);setPage(next);}catch(e){setError(e.message);}finally{setLoading(false);}};
  const hide=async id=>{setError('');try{await unpublishForgeModule(id);setRemote(old=>old.filter(m=>m.id!==id));setAccount(old=>old.map(m=>m.recordId===id?{...m,published:false}:m));}catch(e){setError(e.message);}};
  useEffect(()=>{let live=true;if(owner)fetchOwnForgeModules().then(data=>{if(live)setAccount(data);}).catch(e=>{if(live)setError(e.message);});return()=>{live=false;};},[owner]);
  const choose=async module=>{setForking(module.id);try{await onChoose(module);}catch(e){setError(e.message);}finally{setForking(null);}};
  const modules=tab==='mine'?own:tab==='public'?remote:forgePresets.map(p=>builtInModule(p.id));
  return <section className="forge-library-section">
    <h2 className="text-lg font-bold mb-3">모듈 보관함</h2>
    <p className="text-sm leading-relaxed mb-5">다른 사람의 모양은 포크해서 내 작업대로 가져옵니다. 포크 기록은 내 계정에 비공개로 남고, 다시 공개할 때 원본 출처가 이어집니다.</p>
    <div className="forge-tabs mb-5" role="group" aria-label="모듈 목록 선택">{[['mine','내 모듈'],['builtin','기본 오브젝트'],['public','모두의 모듈']].map(([key,title])=><button key={key} aria-pressed={tab===key} onClick={()=>{setTab(key);if(key==='public')load();}}>{title}</button>)}</div>
    {loading&&<p role="status">모듈을 불러오는 중입니다.</p>}
    {error&&<p role="alert">{error} {tab==='public'&&<button onClick={()=>load()} className="btn-secondary">다시 시도</button>}</p>}
    {!loading&&!error&&modules.length===0&&<p className="text-sm leading-relaxed py-5">{tab==='mine'?'만든 모양을 내 보관함에 등록하거나 다른 사람의 모듈을 포크하면 여기에 나타납니다.':'아직 공개된 모듈이 없습니다. 첫 모듈을 등록해 보세요.'}</p>}
    <div className="forge-library-grid">{modules.map(module=><article key={module.id} className="forge-library-card">
      <span className="forge-module-icon" style={{color:module.recipe.colors[1]}} aria-hidden="true">{forgePresets.find(p=>p.id===module.recipe.presetId)?.icon}</span><h3 className="font-semibold">{module.title}</h3>
      <p className="text-xs mt-2 leading-relaxed">{module.description||'위치와 크기를 정해 다른 프로젝트에서 재사용할 수 있는 오브젝트입니다.'}</p>
      {tab==='mine'&&module.recordId&&typeof module.published==='boolean'&&<p className="text-xs mt-2">{module.published?'공개 중':'비공개'}</p>}
      {module.author&&<p className="text-xs mt-2">만든 사람 · {module.author}</p>}
      {module.source&&<p className="text-xs mt-3">포크 원본 · <Link to={'/gallery/'+encodeURIComponent(module.source.id)} target="_blank" rel="noopener">{module.source.title}</Link> · {module.source.author}</p>}
      <button disabled={forking!==null} className="btn-secondary mt-4" onClick={()=>choose(module)}>{forking===module.id?'포크 기록 저장 중…':tab==='public'?'포크해서 가져오기':tab==='mine'?'내 모듈 이어 만들기':'이 모양으로 시작'} →</button>
      {module.published&&module.ownerId===owner&&<button className="text-xs underline block mt-4" onClick={()=>hide(module.recordId||module.id)}>내 모듈 공개 내리기</button>}
      {tab==='mine'&&onRemove&&local.some(m=>m.id===module.id)&&<button className="text-xs underline block mt-4" onClick={()=>onRemove(module.id)}>이 브라우저 보관함에서 제거</button>}
    </article>)}</div>
    {tab==='public'&&more&&<button disabled={loading} className="btn-secondary mt-4" onClick={()=>load(page+1)}>더 보기</button>}
  </section>;
}

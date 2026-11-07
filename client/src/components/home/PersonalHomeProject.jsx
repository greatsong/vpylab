import { lazy, Suspense, useState } from 'react';
import { Link } from 'react-router-dom';
import { resumeAndRun } from '../../engine/sound-system';
const Player=lazy(()=>import('./HomeProjectPlayer'));
export default function PersonalHomeProject({project,ko}){
 const [playing,setPlaying]=useState(false);
 return <section className="personal-home-project" aria-label={ko?'내 메인 프로젝트':'My featured project'}>
  <h2>{project.title}</h2>
  {playing?<Suspense fallback={<p role="status">{ko?'실행 화면 준비 중…':'Preparing preview…'}</p>}><Player code={project.code} ko={ko} onClose={()=>setPlaying(false)}/></Suspense>:<div className="home-project-poster">{project.thumbnail?<img src={project.thumbnail} alt={project.title}/>:<div className="home-project-placeholder" aria-hidden="true">◇</div>}<button type="button" className="btn-primary" onClick={()=>resumeAndRun(()=>setPlaying(true))}>{ko?'내 작품 실행':'Run my project'} ▷</button></div>}
  <div className="home-project-links"><Link to="/sandbox" state={{sharedCode:project.code,sharedTitle:project.title,homeDraft:true}}>{ko?'코드 수정':'Edit code'} ↗</Link><span>{ko?'실행 후 마우스·터치로 돌려보세요.':'Run, then drag with a mouse or touch to rotate.'}</span></div>
 </section>;
}

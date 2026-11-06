import { Link } from 'react-router-dom';
import useAppStore from '../../stores/appStore';
import docs, { getDocById } from '../../data/docs';
import { originLabels } from '../../data/doc-origins';
import DocCodeBlock from './DocCodeBlock';

const value=(text,locale)=>typeof text==='object'?(text?.[locale]||text?.ko||text?.en||''):(text??'');
const panel={backgroundColor:'var(--color-bg-secondary)',borderColor:'var(--color-border)'};
function AxesDiagram({ko}) {
 return <figure className="my-5 border rounded-lg p-3" style={panel}><svg viewBox="0 0 360 150" role="img" aria-label={ko?'좌표 방향: x 오른쪽, y 위쪽, z 화면 앞쪽':'Axes: x right, y up, z toward you'} className="w-full max-w-sm h-auto" style={{color:'var(--color-text-secondary)'}}><g fill="none" stroke="currentColor" strokeWidth="2"><path d="M100 105H280l-9 -5m9 5l-9 5M100 105V22l-5 9m5 -9l5 9M100 105l-46 28m0 0l11 -1m-11 1l5 -10"/></g><g fill="currentColor" fontSize="13"><text x="285" y="110">+x</text><text x="91" y="16">+y</text><text x="26" y="145">+z</text><text x="130" y="65">size = vector(x, y, z)</text></g></svg><figcaption className="text-xs" style={{color:'var(--color-text-muted)'}}>{ko?'기본 방향: x는 가로, y는 높이, z는 앞뒤 두께입니다.':'Default orientation: x is length, y height, and z depth.'}</figcaption></figure>;
}
export default function DocContent({doc,t}) {
 const locale=useAppStore(s=>s.locale),ko=locale==='ko';
 if(!doc)return null;
 const text=field=>value(field,locale),guide=doc.origin==='guide';
 const extendedParams=doc.params?.some(p=>p.origin==='vpylab');
 const section=(title,body)=><section className="my-6"><h2 className="font-semibold mb-3 text-base" style={{color:'var(--color-text-primary)'}}>{title}</h2>{body}</section>;
 const docLink=id=>{const target=getDocById(id);return target?<Link key={id} to={`/docs#${id}`} className="inline-block mr-4 mb-2 text-sm" style={{color:'var(--color-accent)'}}>{text(target.title)} →</Link>:null;};
 const example=doc.code||(typeof doc.example==='object'?text(doc.example):doc.example);
 return <article className="max-w-3xl min-w-0 pb-16" data-doc-id={doc.id} style={{color:'var(--color-text-secondary)'}}>
  <div className="flex flex-wrap items-center gap-2 text-xs mb-4"><span className="border rounded px-2 py-1" style={{borderColor:'var(--color-border)',color:'var(--color-accent)'}}>{text(originLabels[doc.origin]||originLabels.vpython)}</span>{extendedParams&&<span>{ko?'일부 VPyLab 확장 포함':'Includes VPyLab extensions'}</span>}{doc.helperNotice&&<span>{ko?'제공 함수 포함':'Includes a supplied function'}</span>}</div>
  <h1 className="font-display text-2xl font-bold mb-4 break-words" style={{color:'var(--color-text-primary)'}}>{text(doc.title)}</h1>
  <p className="text-sm leading-relaxed mb-5">{text(doc.description)}</p>
  {doc.goal&&<p className="border-l-2 pl-4 text-sm leading-relaxed" style={{borderColor:'var(--color-accent)'}}>{ko?'이번에 할 수 있는 것: ':'Your goal: '}{text(doc.goal)}</p>}
  {guide&&<Link to="/forge" className="btn-secondary no-underline inline-flex my-4">{ko?'대장간에서 슬라이더로 만들어 보기':'Try sliders in the forge'} →</Link>}
  {doc.diagram==='axes'&&<AxesDiagram ko={ko}/>}
  {(doc.extensionNotes||[]).map((note,i)=><p key={i} className="border rounded-lg px-4 py-3 text-sm leading-relaxed mb-3" style={panel}>{text(note)}</p>)}
  {doc.predict&&section(ko?'먼저 예상하기':'Predict first',<p className="text-sm leading-relaxed">{text(doc.predict)}</p>)}
  {doc.signature&&<pre tabIndex={0} aria-label={ko?'사용 형식':'Signature'} className="text-[13px] p-4 mb-5 border rounded-lg overflow-x-auto" style={{...panel,fontFamily:'var(--font-mono)',color:'var(--color-text-primary)'}}><code>{doc.signature}</code></pre>}
  {!!doc.params?.length&&section(t('docs.params'),<div role="region" tabIndex={0} aria-label={ko?'인자 설명 표':'Parameter table'} className="overflow-x-auto rounded-lg border" style={{borderColor:'var(--color-border)'}}><table className="w-full min-w-[520px] text-[13px] text-left"><thead style={panel}><tr>{(ko?['이름','타입','기본값','설명']:['Name','Type','Default','Description']).map(h=><th key={h} className="px-3 py-2">{h}</th>)}</tr></thead><tbody>{doc.params.map((p,i)=><tr key={p.name} style={i%2?panel:undefined}><td className="px-3 py-2 font-mono break-words" style={{color:'var(--color-accent)'}}>{p.name}{p.origin==='vpylab'&&<span className="block font-sans text-[11px]">{text(originLabels.vpylab)}</span>}</td><td className="px-3 py-2 font-mono">{p.type}</td><td className="px-3 py-2 font-mono">{p.default??'—'}</td><td className="px-3 py-2 leading-relaxed">{text(p.desc||p.description)}</td></tr>)}</tbody></table></div>)}
  {example&&section(guide?(ko?'실행하고 보기':'Run and observe'):t('docs.example'),<>
    {doc.helperNotice&&<p className="text-sm leading-relaxed mb-4">{text(doc.helperNotice)}</p>}
    <DocCodeBlock code={doc.displayCode||example} copyCode={example} locale={locale}/>
    {doc.supportCode&&<details className="my-4 border rounded-lg p-4" style={{borderColor:'var(--color-border)'}}><summary className="text-sm cursor-pointer">{ko?'제공 함수 펼치기 · 원리 읽기는 선택':'Show supplied function · Derivation is optional'}</summary><div className="mt-4"><DocCodeBlock code={doc.supportCode} locale={locale} label={ko?'제공 함수 코드':'Supplied helper code'}/></div></details>}
    <div className="flex flex-wrap gap-4 items-center mt-4">{doc.code&&<Link to={`/sandbox?doc=${doc.id}`} className="btn-primary no-underline inline-flex">{ko?'실습에서 열기':'Open in workspace'} →</Link>}<span className="text-xs">{ko?'수정한 코드는 이 탭에서 문서를 왕복해도 복원됩니다.':'Edits are restored when you return in this tab.'}</span></div>
   </>)}
  {!!doc.changes?.length&&section(ko?'숫자 하나씩 바꾸기':'Change one thing at a time',<ol className="list-decimal pl-5 space-y-5 text-sm leading-relaxed">{doc.changes.map((step,i)=><li key={i}><p className="font-medium" style={{color:'var(--color-text-primary)'}}>{text(step.instruction)}</p><details className="mt-2"><summary className="cursor-pointer" style={{color:'var(--color-accent)'}}>{ko?'바꾼 뒤 확인하기':'Check after changing'}</summary><p className="mt-2">{text(step.expect)}</p></details></li>)}</ol>)}
  {doc.explain&&section(ko?'왜 이렇게 보일까요?':'Why does it look this way?',<p className="text-sm leading-relaxed">{text(doc.explain)}</p>)}
  {doc.originIndex&&section(ko?'VPyLab이 추가한 기능':'VPyLab additions',<><p className="text-sm mb-4">{ko?'아래 목록은 각 항목의 출처 표기에서 자동으로 모았습니다. 표준 함수에 추가한 인자는 해당 문서의 표를 확인하세요.':'This list comes from each topic’s source metadata. Extended parameters are marked in their topic tables.'}</p><ul className="list-disc pl-5 text-sm">{docs.filter(d=>d.origin==='vpylab').map(d=><li key={d.id}>{docLink(d.id)}</li>)}</ul><h3 className="font-semibold mt-5 mb-3">{ko?'표준 API에 추가한 인자·이름':'Additions to standard API'}</h3><ul className="list-disc pl-5 text-sm">{docs.filter(d=>d.params?.some(p=>p.origin==='vpylab')).map(d=><li key={d.id}>{docLink(d.id)}<span>{d.params.filter(p=>p.origin==='vpylab').map(p=>p.name).join(', ')}</span></li>)}</ul></>)}
  {!!doc.compatibility?.length&&section(ko?'지원 범위와 주의할 점':'Support and limitations',<ul className="list-disc pl-5 text-sm leading-relaxed space-y-2">{doc.compatibility.map((note,i)=><li key={i}>{text(note)}</li>)}</ul>)}
  {guide&&example&&<p className="border rounded-lg p-4 text-sm leading-relaxed my-6" style={panel}>{ko?'정면·옆면·위에서 돌려 보세요. 실행 오류가 없어도 원하는 모양인지 확인하고, 친구에게 바꾼 숫자와 이유를 설명하세요.':'Inspect the front, side, and top. An error-free run does not guarantee the intended shape. Explain your edited value and reason to a peer.'}</p>}
  {!!doc.related?.length&&section(ko?'이어서 보기':'Related topics',<nav aria-label={ko?'관련 문서':'Related topics'}>{doc.related.map(docLink)}</nav>)}
  {guide&&<p className="mt-6 text-sm"><Link to="/tutorials/shape-lab" style={{color:'var(--color-accent)'}}>{ko?'친구와 내 작품으로 이어가기':'Make your own project with a peer'} →</Link></p>}
 </article>;
}

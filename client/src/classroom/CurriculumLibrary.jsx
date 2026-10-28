import { useMemo, useState } from 'react';
import { collection, kinds, labels, curriculumCounts } from './curriculum';

const text = (value) => typeof value === 'string' ? value : value?.ko || '';

export default function CurriculumLibrary({ onStart }) {
  const [kind, setKind] = useState('lesson');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [group, setGroup] = useState('all');
  const groups = [...new Set(collection[kind].map((item) => item.group))];
  const filtered = useMemo(() => collection[kind].filter((item) =>
    (group === 'all' || item.group === group) && `${item.title} ${item.description} ${item.group}`.toLowerCase().includes(query.toLowerCase())), [kind, query, group]);
  const selected = filtered.find((item) => item.id === selectedId) || filtered[0];

  return <section className="cr-library">
    <div className="cr-page-heading"><div><span className="cr-eyebrow">LEARN · EXPERIMENT · EXPLAIN</span><h1>배움의 재료들</h1>
      <p>익숙한 수업 자료를 그대로, 새로운 실험의 출발점으로.</p></div><div className="cr-heading-count">{curriculumCounts.courses}<span>코스</span><b>/</b>{curriculumCounts.lessons}<span>차시</span></div></div>
    <div className="cr-library-controls"><div className="cr-tabs" role="tablist" aria-label="수업 자료 종류">
      {Object.entries(labels).map(([key, label]) => <button key={key} role="tab" aria-selected={kind === key} className={kind === key ? 'active' : ''} style={{ '--tab-accent': kinds[key].accent }}
        onClick={() => { setKind(key); setSelectedId(null); setGroup('all'); }}><i aria-hidden="true" />{label}<span>{collection[key].length}</span></button>)}
    </div><input aria-label="수업 자료 검색" placeholder="제목이나 내용을 검색하세요" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
    <div className="cr-library-layout"><aside className="cr-material-list">
      <label className="cr-field"><span>분류</span><select value={group} onChange={(event) => setGroup(event.target.value)}><option value="all">전체</option>{groups.map((name) => <option key={name}>{name}</option>)}</select></label>
      {filtered.map((item) => <button key={item.id} className={`cr-material-item ${item.id === selected?.id ? 'active' : ''}`} style={{ '--item-accent': item.accent }} onClick={() => setSelectedId(item.id)}>
        <span className="cr-material-type"><i aria-hidden="true">{item.icon}</i>{item.group}</span><strong>{item.title}</strong><span>{item.description}</span>
      </button>)}{!filtered.length && <p className="cr-empty">검색 결과가 없습니다.</p>}
    </aside><article className="cr-material-detail">{selected ? <>
      <div className="cr-material-kicker"><span className="cr-source-chip" style={{ '--chip-accent': selected.accent }}><i aria-hidden="true">{selected.icon}</i><span>{selected.group}</span></span><span>{labels[kind]}</span></div>
      <h2>{selected.title}</h2><p className="cr-material-description">{selected.description}</p>
      {selected.signature && <code className="cr-signature">{selected.signature}</code>}
      {selected.params?.length > 0 && <table className="cr-param-table"><thead><tr><th>속성</th><th>설명</th><th>기본값</th></tr></thead><tbody>{selected.params.map((param) => <tr key={param.name}><td><code>{param.name}</code></td><td>{text(param.desc)}</td><td><code>{param.default}</code></td></tr>)}</tbody></table>}
      <div className="cr-code-heading"><span>{kind === 'mission' ? '시작 코드' : '실험 코드'}</span><button className="cr-button primary" onClick={() => onStart(selected)}>이 자료로 프로젝트 만들기 <span>↗</span></button></div>
      <pre className="cr-source-code">{selected.code || '# 이 항목에는 별도 예제 코드가 없습니다.'}</pre>
      {selected.hints?.length > 0 && <section><h3>생각을 돕는 힌트</h3>{selected.hints.map((hint, index) => <details className="cr-content-detail" key={index}><summary>힌트 {index + 1}</summary><p>{text(hint)}</p></details>)}</section>}
      {selected.solutionCode && <details className="cr-content-detail"><summary>참고 풀이 살펴보기</summary><p className="cr-hint">먼저 자신의 접근을 만들고 비교해보세요.</p><pre className="cr-source-code">{selected.solutionCode}</pre></details>}
      <p className="cr-hint">기존 수업 자료 원문을 재사용합니다. 미션 콘텐츠: CC BY-NC-SA 4.0.</p>
    </> : <div className="cr-empty">다른 검색어나 분류를 선택해주세요.</div>}</article></div>
  </section>;
}

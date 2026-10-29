#!/usr/bin/env node
/**
 * 정적 결과(out/static-results.json)와 브라우저 결과(out/browser-results.json, 있으면)를 합쳐
 * out/summary.md (표)와 out/merged.json 을 만든다. docs/GLOWSCRIPT_COMPAT_REPORT.md 의 부록 표는 여기서 복사한다.
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(here, 'out');

async function readJson(file) {
  try { return JSON.parse(await readFile(path.join(outDir, file), 'utf8')); } catch { return null; }
}

const staticRes = await readJson('static-results.json');
if (!staticRes) throw new Error('out/static-results.json 이 없습니다. 먼저 static-harness.py 를 실행하세요.');
const browserRes = await readJson('browser-results.json');
const shimRes = await readJson('static-shim-results.json');
const shimById = new Map((shimRes?.results || []).map((r) => [r.id, r]));
const corpus = JSON.parse(await readFile(path.join(here, 'corpus/corpus.json'), 'utf8'));
const corpusById = new Map(corpus.map((it) => [it.id, it]));

const SOURCE_LABEL = {
  internal: 'VPyLab 내장(예제·코스·미션)', idiom: '수업 관용구', gsexample: 'GlowScript 공식 예제', docs: 'GlowScript 문서 조각', demos: 'VPython 7 데모(vpython-jupyter)',
};
const CATEGORY_LABEL = {
  pass: '통과', 'unsupported-api': '미지원 API(이름 없음)', 'unsupported-attr': '미지원 속성·메서드', 'unsupported-arg': '미지원 인자·호출 형식',
  'unsupported-module': '미지원 모듈', 'unsupported-bridge': '브릿지 미지원 커맨드', semantic: '의미 차이', silent: '무반응', timeout: '시간 초과(정지 불가)',
  hang: '무응답 뒤 강제 종료', 'activity-timeout': '10초 무응답 종료', error: '실행 오류', warning: '경고', input: 'input() 불가', 'fragment-undefined': '문서 조각 미정의(제외)',
  'glowscript-only': 'Web VPython 전용(제외)', harness: '하네스 오류', lost: '응답 없음',
};
const EXCLUDED = new Set(['fragment-undefined', 'glowscript-only', 'harness']);

/** 브라우저 오류 메시지를 정적 하네스와 같은 범주로 */
function browserCategory(r) {
  if (r.status === 'pass' || r.status === 'stopped') {
    if (r.bridgeWarnings?.length) return 'unsupported-bridge';
    return 'pass';
  }
  if (r.status === 'silent') return 'silent';
  if (r.status === 'hang' || r.status === 'lost') return 'hang';
  if (r.status === 'activity-timeout') return 'activity-timeout';
  if (r.status === 'harness') return 'harness';
  const text = `${r.error?.raw || ''}\n${r.error?.message || ''}`;
  const corpusItem = corpusById.get(r.id);
  if (/SyntaxError/.test(text) && /\$\(|jQuery/.test(corpusItem?.code || '')) return 'glowscript-only';
  if (/NameError: name '(\w+)'/.test(text)) {
    const name = text.match(/NameError: name '(\w+)'/)[1];
    if (staticNameIsGlowScript(name)) return 'unsupported-api';
    return corpusItem?.kind === 'fragment' ? 'fragment-undefined' : 'error';
  }
  if (/AttributeError/.test(text)) return 'unsupported-attr';
  if (/TypeError: .*(unexpected keyword|positional argument|not callable)/.test(text)) return 'unsupported-arg';
  if (/AssertionError/.test(text)) return 'semantic';
  if (/ModuleNotFoundError|ImportError/.test(text)) return 'unsupported-module';
  if (/EOFError|OSError.*input|input\(\)/.test(text)) return 'input';
  return 'error';
}
const staticById = new Map(staticRes.results.map((r) => [r.id, r]));
function staticNameIsGlowScript(name) {
  // 정적 결과가 같은 이름을 unsupported-api 로 분류했으면 GlowScript 전역 이름이다
  return staticRes.results.some((r) => r.category === 'unsupported-api' && r.detail.includes(`\`${name}\``));
}

const merged = corpus.map((it) => {
  const s = staticById.get(it.id);
  const b = browserRes?.results.find((r) => r.id === it.id);
  return {
    id: it.id, source: it.source, kind: it.kind, title: it.title, origin: it.origin, progress: !!it.progress,
    static: s ? { category: s.category, detail: s.detail, line: s.error?.studentLine ?? null, errorType: s.error?.type ?? null, errorMessage: s.error?.message ?? null, commands: s.commands?.total ?? 0 } : null,
    shim: shimById.has(it.id) ? { category: shimById.get(it.id).category, detail: shimById.get(it.id).detail, errorType: shimById.get(it.id).error?.type ?? null, errorMessage: shimById.get(it.id).error?.message ?? null } : null,
    browser: b ? { category: browserCategory(b), status: b.status, meshes: b.meshes, commands: b.commands?.total ?? 0, error: b.error?.message ?? null, raw: (b.error?.raw || '').split('\n').filter(Boolean).slice(-1)[0] ?? null, bridgeWarnings: b.bridgeWarnings ?? [], elapsed: b.elapsed } : null,
  };
});
await writeFile(path.join(outDir, 'merged.json'), JSON.stringify(merged, null, 1));

const esc = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ').slice(0, 140);
const link = (origin) => (origin.startsWith('http') ? `[문서](${origin})` : `\`${origin}\``);
const lines = [];
lines.push('# GlowScript 호환성 점검 요약 (자동 생성)', '');
lines.push(`- 생성: ${new Date().toISOString()}`);
lines.push(`- 정적 하네스: ${staticRes.generatedAt}, CPython ${staticRes.python}, API ${staticRes.api}, ${staticRes.count}개`);
if (browserRes) lines.push(`- 브라우저 하네스: ${browserRes.generatedAt}, ${browserRes.base}, ${browserRes.count}개, 씬 접근 ${browserRes.sceneAccessible ? '가능' : '불가'}`);
if (shimRes) lines.push(`- 심 적용 정적 하네스(즉시 수정 가능 항목을 shim-quickfixes.py 로 덧씌운 what-if): ${shimRes.generatedAt}, ${shimRes.count}개`);
lines.push('');

// 출처별 통과율
lines.push('## 출처별 결과', '', '| 출처 | 개수 | 정적 통과 | 정적 실패 | 제외(문서 조각 미정의 등) | 브라우저 통과 | 브라우저 실패 | 즉시 수정 적용 시 통과 |', '|---|---|---|---|---|---|---|---|');
const sources = [...new Set(corpus.map((it) => it.source))];
for (const src of sources) {
  const rows = merged.filter((m) => m.source === src);
  const sPass = rows.filter((m) => m.static?.category === 'pass').length;
  const sEx = rows.filter((m) => EXCLUDED.has(m.static?.category)).length;
  const sFail = rows.length - sPass - sEx;
  const bRows = rows.filter((m) => m.browser);
  const bPass = bRows.filter((m) => m.browser.category === 'pass').length;
  const bEx = bRows.filter((m) => EXCLUDED.has(m.browser.category)).length;
  const shPass = rows.filter((m) => m.shim?.category === 'pass').length;
  lines.push(`| ${SOURCE_LABEL[src] || src} | ${rows.length} | ${sPass} | ${sFail} | ${sEx} | ${bRows.length ? bPass : '-'} | ${bRows.length ? bRows.length - bPass - bEx : '-'} | ${shimRes ? shPass : '-'} |`);
}
const allPassS = merged.filter((m) => m.static?.category === 'pass').length;
const allExS = merged.filter((m) => EXCLUDED.has(m.static?.category)).length;
const bAll = merged.filter((m) => m.browser);
const bPassAll = bAll.filter((m) => m.browser.category === 'pass').length;
const bExAll = bAll.filter((m) => EXCLUDED.has(m.browser.category)).length;
const shimPassAll = merged.filter((m) => m.shim?.category === 'pass').length;
lines.push(`| **합계** | ${merged.length} | ${allPassS} | ${merged.length - allPassS - allExS} | ${allExS} | ${bAll.length ? bPassAll : '-'} | ${bAll.length ? bAll.length - bPassAll - bExAll : '-'} | ${shimRes ? shimPassAll : '-'} |`, '');

// 범주별
lines.push('## 범주별 건수', '', '| 범주 | 정적 | 브라우저 |', '|---|---|---|');
const cats = [...new Set([...merged.map((m) => m.static?.category), ...merged.map((m) => m.browser?.category)].filter(Boolean))];
for (const c of cats) {
  lines.push(`| ${CATEGORY_LABEL[c] || c} (\`${c}\`) | ${merged.filter((m) => m.static?.category === c).length} | ${bAll.length ? merged.filter((m) => m.browser?.category === c).length : '-'} |`);
}
lines.push('');

// GlowScript 공식 예제 표
lines.push('## GlowScript 공식 예제 (glowscript.org Examples)', '');
const gs = merged.filter((m) => m.source === 'gsexample');
const gsPassS = gs.filter((m) => m.static?.category === 'pass').length;
const gsPassB = gs.filter((m) => m.browser?.category === 'pass').length;
const gsPassShim = gs.filter((m) => m.shim?.category === 'pass').length;
lines.push(`정적 ${gs.length}개 중 통과 ${gsPassS}개${browserRes ? `, 브라우저 ${gs.filter((m) => m.browser).length}개 중 통과 ${gsPassB}개` : ''}${shimRes ? `, 즉시 수정 적용 시 통과 ${gsPassShim}개` : ''}.`, '');
lines.push('| 예제 | 정적 결과 | 브라우저 결과 | 메시 수 | 첫 오류 | 즉시 수정 적용 시 (다음 오류) |', '|---|---|---|---|---|---|');
for (const m of gs) {
  const name = m.id.replace('gsexample:', '');
  const first = m.static?.category === 'pass' ? '' : `${m.static?.errorType || ''}: ${m.static?.errorMessage || m.static?.detail || ''}`;
  const after = !m.shim ? '-' : m.shim.category === 'pass' ? '통과' : `${CATEGORY_LABEL[m.shim.category] || m.shim.category}: ${esc(m.shim.errorMessage || m.shim.detail)}`;
  lines.push(`| [${name}](${m.origin}) | ${CATEGORY_LABEL[m.static?.category] || m.static?.category} | ${m.browser ? CATEGORY_LABEL[m.browser.category] || m.browser.category : '-'} | ${m.browser?.meshes ?? '-'} | ${esc(first)} | ${after} |`);
}
lines.push('');

// 실패 항목 전체
lines.push('## 실패 항목 전체 (정적 기준, 제외 범주 포함)', '', '| id | 출처 | 범주 | 상세 | 줄 | 브라우저 | 근거 |', '|---|---|---|---|---|---|---|');
for (const m of merged) {
  if (!m.static || m.static.category === 'pass') continue;
  lines.push(`| \`${m.id}\` | ${m.source} | ${m.static.category}${m.progress ? ' (진행 중이던 항목)' : ''} | ${esc(m.static.detail || m.static.errorMessage)} | ${m.static.line ?? ''} | ${m.browser ? `${m.browser.category}${m.browser.raw ? ': ' + esc(m.browser.raw) : ''}` : '-'} | ${link(m.origin)} |`);
}
lines.push('');

// 정적은 통과했는데 브라우저에서 실패한 항목
if (browserRes) {
  lines.push('## 정적 통과 · 브라우저 실패 (실행 경로·브릿지 쪽 문제)', '', '| id | 브라우저 범주 | 상태 | 오류 | 브릿지 경고 |', '|---|---|---|---|---|');
  for (const m of merged) {
    if (!m.browser || m.static?.category !== 'pass' || m.browser.category === 'pass') continue;
    lines.push(`| \`${m.id}\` | ${m.browser.category} | ${m.browser.status} | ${esc(m.browser.raw || m.browser.error)} | ${esc(m.browser.bridgeWarnings.join('; '))} |`);
  }
  lines.push('');
}

await writeFile(path.join(outDir, 'summary.md'), lines.join('\n'));
console.log(`요약 → scripts/compat/out/summary.md (정적 통과 ${allPassS}/${merged.length}${bAll.length ? `, 브라우저 통과 ${bPassAll}/${bAll.length}` : ''})`);

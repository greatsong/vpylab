#!/usr/bin/env node
/**
 * 코퍼스의 모든 코드를 실제 앱과 같은 전처리기(client/src/engine/code-preprocessor.js)로 변환해
 * out/preprocessed.json 에 저장한다. 정적 하네스(static-harness.py)가 이 결과를 실행한다.
 * 워커가 vpython 모듈을 등록할 때 쓰는 Python 블록도 pyodide-worker.js 에서 그대로 뽑아 저장한다.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const { preprocessCode } = await import(path.join(root, 'client/src/engine/code-preprocessor.js'));

const corpus = JSON.parse(await readFile(path.join(here, 'corpus/corpus.json'), 'utf8'));
const items = corpus.map((it) => {
  const { code, warnings } = preprocessCode(it.code);
  return { id: it.id, code, warnings };
});

// 워커의 모듈 등록 블록 추출: `import sys\nimport types\nvpython_module = ...` 부터 `sys.modules['vpython'] = vpython_module` 까지
const workerSrc = await readFile(path.join(root, 'client/src/engine/pyodide-worker.js'), 'utf8');
const start = workerSrc.indexOf('vpython_module = types.ModuleType');
const end = workerSrc.indexOf("sys.modules['vpython'] = vpython_module");
if (start < 0 || end < 0) throw new Error('pyodide-worker.js 에서 vpython 모듈 등록 블록을 찾지 못했습니다');
const blockStart = workerSrc.lastIndexOf('import sys', start);
let registration = workerSrc.slice(blockStart, end + "sys.modules['vpython'] = vpython_module".length);
// JS 템플릿 리터럴의 \uXXXX 이스케이프를 실제 문자로
registration = registration.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));

// 브릿지가 아는 객체 타입·액션 (case '...' 라벨) — 정적 하네스가 미지원 커맨드를 표시하는 데 사용
const bridgeSrc = await readFile(path.join(root, 'client/src/engine/vpython-bridge.js'), 'utf8');
const caseLabels = [...bridgeSrc.matchAll(/case '([A-Za-z_0-9]+)':/g)].map((m) => m[1]);

await mkdir(path.join(here, 'out'), { recursive: true });
await writeFile(path.join(here, 'out/preprocessed.json'), JSON.stringify({
  generatedAt: new Date().toISOString(),
  registration,
  bridgeCaseLabels: [...new Set(caseLabels)],
  items,
}, null, 1));
const warned = items.filter((it) => it.warnings.length).length;
console.log(`전처리 ${items.length}개 (경고 있는 코드 ${warned}개) → scripts/compat/out/preprocessed.json`);

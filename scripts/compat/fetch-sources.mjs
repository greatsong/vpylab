#!/usr/bin/env node
/**
 * GlowScript 문서와 vpython-jupyter 데모 노트북을 내려받는다 (재추출이 필요할 때만 사용).
 *
 * 사용법: node scripts/compat/fetch-sources.mjs <저장 디렉터리>
 *   <저장 디렉터리>/docs/*.html   — https://www.glowscript.org/docs/VPythonDocs/
 *   <저장 디렉터리>/demos/*.ipynb — https://github.com/vpython/vpython-jupyter/tree/master/Demos
 *   <저장 디렉터리>/gs-examples/*.json — https://www.glowscript.org/#/user/GlowScriptDemos/folder/Examples/ (API 응답)
 * 내려받은 파일은 저장소에 넣지 않는다. 추출 결과(JSON)만 corpus/에 둔다.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const outDir = process.argv[2];
if (!outDir) {
  console.error('사용법: node scripts/compat/fetch-sources.mjs <저장 디렉터리>');
  process.exit(1);
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'vpylab-compat-harness' } });
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.json();
}

async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  await writeFile(dest, Buffer.from(await res.arrayBuffer()));
}

const docsDir = path.join(outDir, 'docs');
const demosDir = path.join(outDir, 'demos');
const examplesDir = path.join(outDir, 'gs-examples');
await mkdir(docsDir, { recursive: true });
await mkdir(demosDir, { recursive: true });
await mkdir(examplesDir, { recursive: true });

const docList = await fetchJson('https://api.github.com/repos/vpython/glowscript/contents/docs/VPythonDocs');
let count = 0;
for (const entry of docList) {
  if (!entry.name.endsWith('.html')) continue;
  await download(`https://www.glowscript.org/docs/VPythonDocs/${entry.name}`, path.join(docsDir, entry.name));
  count += 1;
}
console.log(`문서 ${count}쪽 → ${docsDir}`);

const demoList = await fetchJson('https://api.github.com/repos/vpython/vpython-jupyter/contents/Demos');
count = 0;
for (const entry of demoList) {
  if (!entry.name.endsWith('.ipynb')) continue;
  await download(entry.download_url, path.join(demosDir, entry.name));
  count += 1;
}
console.log(`데모 ${count}개 → ${demosDir}`);

const EXAMPLES_API = 'https://www.glowscript.org/api/user/GlowScriptDemos/folder/Examples/program/';
const exampleList = await fetchJson(EXAMPLES_API);
count = 0;
for (const program of exampleList.programs || []) {
  await download(EXAMPLES_API + encodeURIComponent(program.name), path.join(examplesDir, `${program.name}.json`));
  count += 1;
}
console.log(`공식 예제 ${count}개 → ${examplesDir}`);

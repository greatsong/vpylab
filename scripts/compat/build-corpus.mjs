#!/usr/bin/env node
/**
 * 점검 코퍼스를 한 파일(corpus/corpus.json)로 모은다.
 *
 * 출처 4종:
 *   internal — client/src/data/{examples,courses,missions}.js 의 모든 Python 코드
 *   idiom    — corpus/idioms.mjs (수업 관용구, 직접 작성)
 *   gsexample — corpus/glowscript-examples.json (glowscript.org 공식 예제 프로그램, extract-glowscript-examples.py 로 추출)
 *   docs     — corpus/glowscript-docs.json (GlowScript 공식 문서 예제, extract-docs.py 로 추출)
 *   demos    — corpus/vpython-demos.json (vpython-jupyter Demos, extract-demos.py 로 추출)
 *
 * 문서 조각(kind=fragment)에는 공통 서문을 붙여 완전한 프로그램으로 만든다.
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const dataDir = path.join(root, 'client/src/data');

/** 문서 조각 앞에 붙이는 서문 — GlowScript 문서가 가정하는 흔한 이름들을 미리 정의 */
export const FRAGMENT_PREAMBLE = `from vpython import *
# --- 문서 조각 공통 서문 (하네스가 추가) ---
x = 0.5; y = 0.25; z = 0.1; t = 0.0; dt = 0.01; N = 5
a = vector(1, 2, 3); b = vector(10, 20, 30); v = vector(1, 0, 0)
theta = 0.5; phi = 0.3; myangle = 0.2; myaxis = vector(0, 1, 0); myorigin = vector(0, 0, 0)
ball = sphere(radius=0.5); mybox = box(); myobject = box(); myobj = box(); mycanvas = scene; scene2 = scene
myvector1 = vector(0, 0, 0); mycolor1 = color.red; myradius1 = 0.1
mypath = [vector(0, 0, 0), vector(0, 1, 0)]; myshape = [(0, 0), (1, 0), (1, 1), (0, 1)]
objectlist = [box(), sphere()]
def myfunction(*args): pass
def myaction(*args): pass
choicelist = ['a', 'b']
# --- 문서 조각 ---
`;

async function loadDataModule(name) {
  const mod = await import(path.join(dataDir, name));
  return mod.default;
}

async function internalCorpus() {
  const items = [];
  const examples = await loadDataModule('examples.js');
  for (const ex of examples) {
    if (!ex.code) continue;
    items.push({
      id: `internal:example:${ex.id}`, source: 'internal', kind: 'program',
      title: `예제 ${ex.title}`, origin: `client/src/data/examples.js#${ex.id}`, code: ex.code,
    });
  }
  const courses = await loadDataModule('courses.js');
  for (const course of courses) {
    for (const lesson of course.lessons || []) {
      if (!lesson.code) continue;
      items.push({
        id: `internal:course:${course.id}:${lesson.id}`, source: 'internal', kind: 'program',
        title: `코스 ${course.title} / ${lesson.title}`, origin: `client/src/data/courses.js#${course.id}/${lesson.id}`, code: lesson.code,
      });
    }
  }
  const missions = await loadDataModule('missions.js');
  for (const m of missions) {
    const title = typeof m.title === 'object' ? m.title.ko : m.title;
    if (m.starterCode) {
      items.push({
        id: `internal:mission:${m.id}:starter`, source: 'internal', kind: 'program',
        title: `미션 ${title} (starter)`, origin: `client/src/data/missions.js#${m.id}`, code: m.starterCode,
      });
    }
    if (m.solutionCode && m.solutionCode !== m.starterCode) {
      items.push({
        id: `internal:mission:${m.id}:solution`, source: 'internal', kind: 'program',
        title: `미션 ${title} (solution)`, origin: `client/src/data/missions.js#${m.id}`, code: m.solutionCode,
      });
    }
  }
  const { creativeLabs, shapeExtensions } = await import(path.join(dataDir, 'creative-labs.js'));
  for (const lab of [...creativeLabs, ...shapeExtensions]) {
    for (const step of lab.variants || [{ id: 'base', code: lab.code }]) {
      items.push({ id: `internal:creative:${lab.id}:${step.id}`, source: 'internal', kind: 'program', title: lab.title.ko, origin: `client/src/data/creative-labs.js#${lab.id}`, code: step.code });
    }
  }
  const docs = await loadDataModule('docs.js');
  const { getGuideVariants } = await import(path.join(dataDir, 'shape-guides.js'));
  for (const doc of docs) {
    if (!doc.code) continue;
    const variants = doc.origin === 'guide' ? getGuideVariants(doc) : [];
    for (const example of [{id: 'base',code:doc.code},...variants]) {
      items.push({id:`internal:doc:${doc.id}:${example.id}`,source:'internal',kind:'program',title:`문서 ${doc.title.ko}`,origin:`client/src/data/docs.js#${doc.id}`,code:example.code});
    }
  }
  return items;
}

async function idiomCorpus() {
  const { default: IDIOMS, DOC_BASE } = await import('./corpus/idioms.mjs');
  return IDIOMS.map((it) => ({
    id: `idiom:${it.id}`, source: 'idiom', kind: 'program', title: it.title,
    origin: `${DOC_BASE}${it.doc}.html`, code: it.code, tags: it.tags || [], progress: !!it.progress,
  }));
}

async function jsonCorpus(file) {
  const raw = JSON.parse(await readFile(path.join(here, 'corpus', file), 'utf8'));
  return raw.map((it) => (it.kind === 'fragment' ? { ...it, code: FRAGMENT_PREAMBLE + it.code } : it));
}

async function showcaseCorpus() {
  const { glowscriptProjects } = await import(path.join(dataDir, 'glowscript-projects.js'));
  const expected = {
    'gs2024-01': { type: 'TypeError', message: "'float' object cannot be interpreted as an integer" },
    'gs2024-06': { type: 'TypeError', message: "'float' object cannot be interpreted as an integer" },
    'gs2024-02': { type: 'SyntaxError', message: "expected ':'" },
    'gs2024-19': { type: 'NameError', message: "name 'speed_f' is not defined" },
    'gs2024-21': { type: 'TypeError', message: 'list indices must be integers or slices, not float' },
  };
  const items = [];
  for (const project of glowscriptProjects) {
    const original = JSON.parse(await readFile(path.join(root, 'client/public', project.sourcePath), 'utf8'));
    items.push({ id: `showcase:${project.id}`, source: 'showcase', kind: project.pythonCheck === 'empty' ? 'empty' : 'program',
      title: project.originalName, origin: project.sourceUrl, code: original.code });
    if (expected[project.id]) {
      const raw = original.source.split(/\r?\n/);
      raw[0] = 'from vpython import *';
      items.push({ id: `showcase-original:${project.id}`, source: 'showcase-original', kind: 'program',
        title: project.originalName, origin: project.sourceUrl, code: raw.join('\n'), expectedError: expected[project.id] });
    }
  }
  const { tutorials } = await import(path.join(dataDir, 'tutorials.js'));
  for (const tutorial of tutorials) items.push({ id: `internal:tutorial:${tutorial.id}`, source: 'internal', kind: 'program', title: tutorial.title.ko, origin: `client/src/data/tutorials.js#${tutorial.id}`, code: tutorial.code });
  return items;
}

const corpus = [
  ...(await internalCorpus()),
  ...(await showcaseCorpus()),
  ...(await idiomCorpus()),
  ...(await jsonCorpus('glowscript-examples.json')),
  ...(await jsonCorpus('glowscript-docs.json')),
  ...(await jsonCorpus('vpython-demos.json')),
];
const ids = new Set();
for (const it of corpus) {
  if (ids.has(it.id)) throw new Error(`id 중복: ${it.id}`);
  ids.add(it.id);
}
const outPath = path.join(here, 'corpus/corpus.json');
await writeFile(outPath, JSON.stringify(corpus, null, 1));
const bySource = {};
for (const it of corpus) bySource[it.source] = (bySource[it.source] || 0) + 1;
console.log(`코퍼스 ${corpus.length}개 → ${path.relative(root, outPath)}`, bySource);

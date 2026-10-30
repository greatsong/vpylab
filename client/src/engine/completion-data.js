/**
 * VPyLab 편집기 자동 완성 데이터
 *
 * 이름을 손으로 두 번 적지 않도록 원본에서 바로 뽑는다.
 *   - 색·텍스처·음 이름·악기·NamedList·함수·메서드: vpython-api.py 원문(?raw)을 정규식으로 읽는다
 *   - 효과음·배경음악 이름: sound-system.js의 SFX_MAP·BGM_PATTERNS
 *   - 함수 설명·서명·인자: data/docs.js (읽기만 한다)
 * 모듈을 처음 불러올 때 한 번만 만들고, 이후에는 같은 객체를 돌려준다.
 */
import apiSource from './vpython-api.py?raw';
import docs from '../data/docs.js';
import { getSfxNames, getBgmNames } from './sound-system.js';

const IDENT = '[\\p{L}_][\\p{L}\\p{N}_]*';

// ───────────────────────── 원문 추출 보조 ─────────────────────────

/** 최상위 class 블록의 본문(들여쓰기된 줄들)을 돌려준다 */
export function extractClassBlock(source, className) {
  const lines = source.split('\n');
  const startRe = new RegExp(`^class ${className}\\b`);
  const start = lines.findIndex((line) => startRe.test(line));
  if (start < 0) return '';
  const body = [];
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '' || /^\s/.test(line)) {
      body.push(line);
      continue;
    }
    break;
  }
  return body.join('\n');
}

/** `name = { ... }` 꼴 딕셔너리 리터럴의 중괄호 안 텍스트를 돌려준다 */
export function extractDictLiteral(text, name) {
  const re = new RegExp(`(?:^|\\s)${name}\\s*=\\s*\\{`, 'u');
  const match = re.exec(text);
  if (!match) return '';
  const open = match.index + match[0].length - 1;
  return sliceBalanced(text, open, '{', '}');
}

/** open 위치의 여는 괄호부터 짝이 맞는 닫는 괄호 직전까지의 안쪽 텍스트 */
function sliceBalanced(text, open, openCh, closeCh) {
  let depth = 0;
  let quote = null;
  for (let i = open; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      if (ch === '\\') i++;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '#') {
      const nl = text.indexOf('\n', i);
      i = nl < 0 ? text.length : nl;
      continue;
    }
    if (ch === "'" || ch === '"') quote = ch;
    else if (ch === openCh) depth++;
    else if (ch === closeCh) {
      depth--;
      if (depth === 0) return text.slice(open + 1, i);
    }
  }
  return text.slice(open + 1);
}

/** `'키': '값'` 또는 `'키': 숫자` 쌍을 순서대로 담은 Map */
export function parseStringDict(inner) {
  const map = new Map();
  const re = /'([^']*)'\s*:\s*(?:'([^']*)'|(-?\d+(?:\.\d+)?))/g;
  for (const m of inner.matchAll(re)) {
    map.set(m[1], m[2] !== undefined ? m[2] : Number(m[3]));
  }
  return map;
}

/** 최상위 쉼표로 나눈다 (괄호 안 쉼표는 무시, 주석 제거) */
function splitTopLevel(text) {
  const cleaned = text.replace(/#[^\n]*/g, '');
  const parts = [];
  let depth = 0;
  let current = '';
  for (const ch of cleaned) {
    if ('([{'.includes(ch)) depth++;
    else if (')]}'.includes(ch)) depth--;
    if (ch === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

/** def 바로 아래 docstring의 첫 줄 */
function docstringAfter(lines, index) {
  for (let i = index; i < Math.min(lines.length, index + 3); i++) {
    const trimmed = lines[i].trim();
    if (trimmed === '') continue;
    if (!trimmed.startsWith('"""')) return '';
    let text = trimmed.slice(3);
    if (text.trim() === '' && i + 1 < lines.length) text = lines[i + 1].trim();
    return text.replace(/"""$/, '').trim();
  }
  return '';
}

export function rgbToHex([r, g, b]) {
  const toHex = (v) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// ───────────────────────── 개별 추출기 ─────────────────────────

/** 색 팔레트: 영어 이름·RGB·한글 이름 맵 */
export function extractPalette(source) {
  const block = extractClassBlock(source, '_ColorPalette');
  const colors = [];
  const re = /^ {4}([a-z]\w*)\s*=\s*(?:vector|_GrayColor)\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)/gm;
  for (const m of block.matchAll(re)) {
    colors.push({ name: m[1], rgb: [Number(m[2]), Number(m[3]), Number(m[4])] });
  }
  const koreanNames = parseStringDict(extractDictLiteral(block, '_name_map'));
  return { colors, koreanNames };
}

/** 텍스처 프리셋 이름 */
export function extractTextures(source) {
  const block = extractClassBlock(source, '_TexturePresets');
  return [...block.matchAll(/^ {4}(\w+)\s*=\s*"preset:(\w+)"/gm)].map((m) => ({ name: m[1], preset: m[2] }));
}

/** note 클래스의 음 이름 → 주파수 */
export function extractNoteConstants(source) {
  const block = extractClassBlock(source, 'note');
  const map = new Map();
  for (const m of block.matchAll(/\b([A-G]\d)\s*=\s*([\d.]+)/g)) map.set(m[1], Number(m[2]));
  return map;
}

/** 클래스의 공개 속성(@property)과 메서드(인자 문자열) */
export function extractMembers(source, className) {
  const block = extractClassBlock(source, className);
  const lines = block.split('\n');
  const props = [];
  const methods = [];
  const defRe = new RegExp(`^    (?:async )?def (${IDENT})\\((.*)\\)`, 'u');
  for (let i = 0; i < lines.length; i++) {
    const m = defRe.exec(lines[i]);
    if (!m || m[1].startsWith('_')) continue;
    const prev = lines[i - 1] || '';
    const isProp = /^\s*@property/.test(prev) || /^\s*@\w+\.setter/.test(prev);
    if (isProp) {
      if (!props.some((p) => p.name === m[1])) props.push({ name: m[1], doc: docstringAfter(lines, i + 1) });
    } else if (!props.some((p) => p.name === m[1]) && !methods.some((f) => f.name === m[1])) {
      methods.push({ name: m[1], args: stripSelf(m[2]), doc: docstringAfter(lines, i + 1) });
    }
  }
  return { props, methods };
}

function stripSelf(args) {
  return splitTopLevel(args)
    .filter((a) => a && a !== 'self' && !a.startsWith('*'))
    .join(', ');
}

/** NamedList 변수들: 항목(색이면 rgb, 음이면 주파수)과 이름 맵, 영어 별칭 */
export function extractNamedLists(source, palette, noteConstants) {
  const lists = [];
  const re = new RegExp(`^(${IDENT}) = NamedList\\(`, 'gmu');
  for (const m of source.matchAll(re)) {
    const open = m.index + m[0].length - 1;
    const inner = sliceBalanced(source, open, '(', ')');
    const itemsOpen = inner.indexOf('[');
    const itemsInner = sliceBalanced(inner, itemsOpen, '[', ']');
    const rest = inner.slice(itemsOpen + itemsInner.length + 2).replace(/^\s*,\s*/, '').trim();
    let names;
    if (rest.startsWith('{')) names = parseStringDict(sliceBalanced(rest, 0, '{', '}'));
    else names = parseStringDict(extractDictLiteral(source, rest.replace(/[^\p{L}\p{N}_]/gu, '')));

    const items = splitTopLevel(itemsInner).map((token) => {
      let colorMatch = /^color\.(\w+)$/.exec(token);
      if (colorMatch) {
        const c = palette.colors.find((x) => x.name === colorMatch[1]);
        return { kind: 'color', rgb: c?.rgb ?? [1, 1, 1], source: token };
      }
      const vec = /^vector\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)$/.exec(token);
      if (vec) return { kind: 'color', rgb: [Number(vec[1]), Number(vec[2]), Number(vec[3])], source: token };
      const note = /^note\.([A-G]\d)$/.exec(token);
      if (note) return { kind: 'note', freq: noteConstants.get(note[1]), source: note[1] };
      return { kind: 'other', source: token };
    });
    const kind = items.every((it) => it.kind === 'color') ? 'color' : items.every((it) => it.kind === 'note') ? 'note' : 'other';
    lists.push({ name: m[1], kind, items, names, aliases: [] });
  }
  // `rainbow = 무지개` 같은 영어 별칭
  for (const list of lists) {
    const aliasRe = new RegExp(`^(${IDENT}) = ${list.name}\\s*(?:#.*)?$`, 'gmu');
    for (const a of source.matchAll(aliasRe)) list.aliases.push(a[1]);
  }
  return lists;
}

/** 최상위 함수·클래스·대입(별칭) */
export function extractTopLevel(source) {
  const lines = source.split('\n');
  const functions = [];
  const classes = [];
  const assignments = [];
  const defRe = new RegExp(`^(?:async )?def (${IDENT})\\((.*)\\)\\s*(?:->[^:]+)?:`, 'u');
  const classRe = new RegExp(`^class (${IDENT})(?:\\(([^)]*)\\))?:`, 'u');
  const assignRe = new RegExp(`^(${IDENT}) = (.+?)\\s*(?:#.*)?$`, 'u');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let m = defRe.exec(line);
    if (m) {
      if (!m[1].startsWith('_')) functions.push({ name: m[1], args: stripSelf(m[2]), doc: docstringAfter(lines, i + 1) });
      continue;
    }
    m = classRe.exec(line);
    if (m) {
      if (m[1].startsWith('_')) continue;
      const block = extractClassBlock(source.slice(source.indexOf(line)), m[1]);
      const init = /^ {4}def __init__\(self(?:,\s*(.*?))?\):/mu.exec(block);
      classes.push({ name: m[1], args: init ? stripSelf(init[1] || '') : null, doc: docstringAfter(lines, i + 1) });
      continue;
    }
    m = assignRe.exec(line);
    if (m && !m[1].startsWith('_') && !m[2].startsWith('NamedList(')) {
      assignments.push({ name: m[1], expr: m[2].trim() });
    }
  }
  return { functions, classes, assignments };
}

// ───────────────────────── 음 이름 ─────────────────────────

const OCTAVES = [3, 4, 5, 6];

/** 음표()·악기()에 넣을 수 있는 음 이름 목록 (한글 먼저, 영어 다음) */
export function buildNoteNames(koreanNoteMap, noteConstants) {
  const result = [];
  const korean = [...koreanNoteMap.entries()];
  // 한글: 옥타브 없는 기본형(4옥타브) → 옥타브 붙은 형
  for (const [kr, en] of korean) {
    const freq = noteConstants.get(`${en}4`);
    result.push({ name: kr, english: `${en}4`, freq, group: 0 });
  }
  for (const octave of OCTAVES) {
    for (const [kr, en] of korean) {
      const freq = noteConstants.get(`${en}${octave}`);
      result.push({ name: `${kr}${octave}`, english: `${en}${octave}`, freq, group: 1 });
    }
  }
  // 영어: C ~ B, #·b
  const englishBases = [...new Set(korean.map(([, en]) => en))];
  for (const en of englishBases) {
    result.push({ name: en, english: `${en}4`, freq: noteConstants.get(`${en}4`), group: 2 });
  }
  for (const octave of OCTAVES) {
    for (const en of englishBases) {
      result.push({ name: `${en}${octave}`, english: `${en}${octave}`, freq: noteConstants.get(`${en}${octave}`), group: 3 });
    }
  }
  return result;
}

// ───────────────────────── docs.js 색인 ─────────────────────────

function firstSignatureLine(signature) {
  return (signature || '').split('\n')[0].split(/\s{2,}(?:또는|#)|\s#\s/)[0].trim();
}

function indexDocs() {
  const bySignatureName = new Map();
  const byId = new Map();
  const sigRe = new RegExp(`^(${IDENT})\\(`, 'u');
  for (const doc of docs) {
    byId.set(doc.id, doc);
    const sig = firstSignatureLine(doc.signature);
    const m = sigRe.exec(sig);
    if (m && !bySignatureName.has(m[1])) bySignatureName.set(m[1], doc);
  }
  return { bySignatureName, byId };
}

/** 함수 이름으로 docs 항목을 찾는다 (서명의 이름 → id 순) */
export function findDoc(name) {
  return DOC_INDEX.bySignatureName.get(name) || DOC_INDEX.byId.get(name) || null;
}

// ───────────────────────── 스니펫 ─────────────────────────

/**
 * `sphere(pos=vector(0,0,0), radius=1.0)` 꼴 서명을 탭 정지가 있는 스니펫으로.
 * positional에 든 이름(예: 음표의 name)은 `name=` 없이 값만 넣어 음표('도4', 0.5)처럼 완성된다.
 */
export function signatureToSnippet(name, argsText, maxArgs = 4, positional = new Set()) {
  const args = splitTopLevel(argsText || '').filter((a) => a && !a.startsWith('*')).slice(0, maxArgs);
  if (args.length === 0) return `${name}()$0`;
  const body = args
    .map((arg, i) => {
      const eq = arg.indexOf('=');
      if (eq > 0 && eq < arg.length - 1) {
        const key = arg.slice(0, eq).trim();
        const def = arg.slice(eq + 1).trim();
        if (positional.has(key)) return `\${${i + 1}:${escapeSnippet(def)}}`;
        return `${key}=\${${i + 1}:${escapeSnippet(def)}}`;
      }
      return `\${${i + 1}:${escapeSnippet(arg.replace(/=$/, '').trim())}}`;
    })
    .join(', ');
  return `${name}(${body})$0`;
}

/** Python def의 인자 문자열에서 기본값이 없는(필수) 인자 이름 집합 */
export function requiredArgNames(argsText) {
  return new Set(
    splitTopLevel(argsText || '')
      .filter((a) => a && !a.startsWith('*') && !a.includes('='))
      .map((a) => a.split(':')[0].trim()),
  );
}

function escapeSnippet(text) {
  return text.replace(/[$}\\]/g, '\\$&');
}

// ───────────────────────── 데이터 조립 ─────────────────────────

const DOC_INDEX = indexDocs();

function koreanLabelFor(englishColor, koreanNames) {
  let best = '';
  for (const [kr, en] of koreanNames) {
    if (en !== englishColor) continue;
    if (kr.length >= 2 && !best) best = kr;
  }
  if (!best) for (const [kr, en] of koreanNames) if (en === englishColor) return kr;
  return best;
}

function buildData(source) {
  const palette = extractPalette(source);
  const noteConstants = extractNoteConstants(source);
  const koreanNoteMap = parseStringDict(extractDictLiteral(source, '_KOREAN_NOTE_MAP'));
  const instrumentMap = parseStringDict(extractDictLiteral(source, '_INSTRUMENT_KR'));
  const textures = extractTextures(source);
  const namedLists = extractNamedLists(source, palette, noteConstants);
  const top = extractTopLevel(source);

  // 색: 영어 속성
  const colors = palette.colors.map((c) => ({
    name: c.name,
    rgb: c.rgb,
    hex: rgbToHex(c.rgb),
    korean: koreanLabelFor(c.name, palette.koreanNames),
  }));
  const colorByName = new Map(colors.map((c) => [c.name, c]));
  // 색: 한글 키 (색상['빨강'])
  const koreanColorKeys = [...palette.koreanNames.entries()].map(([kr, en]) => ({
    key: kr,
    english: en,
    hex: colorByName.get(en)?.hex ?? '#ffffff',
  }));

  const notes = buildNoteNames(koreanNoteMap, noteConstants);
  const instruments = [
    ...[...instrumentMap.entries()].map(([kr, en]) => ({ name: kr, english: en })),
    ...[...new Set(instrumentMap.values())].map((en) => ({ name: en, english: en })),
  ];

  const members = {
    scene: extractMembers(source, '_Scene'),
    camera: extractMembers(source, '_Camera'),
    mouse: extractMembers(source, '_MouseState'),
    vector: extractMembers(source, 'vector'),
    color: extractMembers(source, '_ColorPalette'),
  };
  // 3D 객체 공통 속성: 기반 클래스와 자주 쓰는 객체의 속성을 합친다
  const objectClasses = ['_GObject', '_AxisLength', '_RadiusSize', 'sphere', 'box', 'cylinder', 'arrow', 'cone', 'ring', 'helix', 'label'];
  const objectProps = [];
  const objectMethods = [];
  for (const cls of objectClasses) {
    const { props, methods } = extractMembers(source, cls);
    for (const p of props) if (!objectProps.some((x) => x.name === p.name)) objectProps.push(p);
    for (const f of methods) if (!objectMethods.some((x) => x.name === f.name)) objectMethods.push(f);
  }
  members.object = { props: objectProps, methods: objectMethods };

  // API 함수·객체 (일반 문맥)
  const api = [];
  const seen = new Set();
  const push = (item) => {
    if (seen.has(item.name)) return;
    seen.add(item.name);
    api.push(item);
  };
  const describe = (name, fallbackDoc) => {
    const doc = findDoc(name);
    return {
      detail: doc ? firstSignatureLine(doc.signature) : '',
      documentation: doc?.description?.ko || fallbackDoc || '',
      documented: Boolean(doc),
    };
  };
  const snippetFor = (name, pyArgs) => {
    const doc = findDoc(name);
    const sig = doc ? firstSignatureLine(doc.signature) : '';
    const sigMatch = sig && new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\((.*)\\)$`, 'u').exec(sig);
    if (sigMatch) return signatureToSnippet(name, sigMatch[1], 4, requiredArgNames(pyArgs));
    return signatureToSnippet(name, pyArgs || '', 3);
  };

  for (const cls of top.classes) {
    if (cls.name === 'NamedList') continue;
    const d = describe(cls.name, cls.doc);
    const callable = cls.args !== null;
    push({
      name: cls.name,
      kind: callable ? 'class' : 'module',
      insertText: callable ? snippetFor(cls.name, cls.args) : cls.name,
      isSnippet: callable,
      detail: d.detail || (callable ? `${cls.name}(...)` : cls.name),
      documentation: d.documentation,
      documented: d.documented,
    });
  }
  for (const fn of top.functions) {
    const d = describe(fn.name, fn.doc);
    push({
      name: fn.name,
      kind: 'function',
      insertText: snippetFor(fn.name, fn.args),
      isSnippet: true,
      detail: d.detail || `${fn.name}(${fn.args})`,
      documentation: d.documentation,
      documented: d.documented,
    });
  }
  const apiByName = new Map(api.map((it) => [it.name, it]));
  const listNames = new Set(namedLists.flatMap((l) => [l.name, ...l.aliases]));
  for (const asg of top.assignments) {
    if (seen.has(asg.name)) continue;
    const target = apiByName.get(asg.expr);
    if (target) {
      // 별칭: vec = vector, 산점도 = scatter3d, frame = compound. 별칭 자체의 docs 항목이 있으면 그 설명을 쓴다
      const own = describe(asg.name, '');
      push({
        ...target,
        name: asg.name,
        insertText: target.isSnippet ? target.insertText.replace(target.name, asg.name) : asg.name,
        detail: `${asg.expr}와 같음`,
        documentation: own.documented ? own.documentation : target.documentation,
        documented: target.documented || own.documented,
      });
      continue;
    }
    if (listNames.has(asg.name)) continue; // NamedList 별칭은 아래에서 처리
    const d = describe(asg.name, '');
    const aliasOfVar = top.assignments.find((a) => a.name === asg.expr);
    push({
      name: asg.name,
      kind: 'variable',
      insertText: asg.name,
      isSnippet: false,
      detail: aliasOfVar ? `${asg.expr}의 별칭` : d.detail || asg.expr,
      documentation: d.documentation,
      documented: d.documented || Boolean(aliasOfVar),
    });
  }
  for (const list of namedLists) {
    const first = [...list.names.keys()][0];
    const detail = list.kind === 'color' ? `색 ${list.items.length}개 목록` : `음 ${list.items.length}개 목록`;
    const example = `${list.name}[0] 또는 ${list.name}['${first}']`;
    push({ name: list.name, kind: 'variable', insertText: list.name, isSnippet: false, detail, documentation: example, documented: true });
    for (const alias of list.aliases) {
      push({ name: alias, kind: 'variable', insertText: alias, isSnippet: false, detail: `${list.name}와 같음`, documentation: example, documented: true });
    }
  }
  // math 모듈 이름 (from math import * 로 함께 제공됨)
  const mathDoc = DOC_INDEX.byId.get('math_functions')?.description?.ko || '';
  for (const name of ['sin', 'cos', 'tan', 'sqrt', 'radians', 'degrees', 'floor', 'ceil', 'exp', 'log']) {
    push({ name, kind: 'function', insertText: `${name}(\${1:x})$0`, isSnippet: true, detail: `${name}(x)`, documentation: mathDoc, documented: false, math: true });
  }
  push({ name: 'pi', kind: 'variable', insertText: 'pi', isSnippet: false, detail: '원주율 3.14159…', documentation: mathDoc, documented: false, math: true });

  // 키워드 인자 (docs.js params 중 서명에 `이름=` 꼴로 나오는 것만)
  const kwargs = new Map();
  for (const [name, doc] of DOC_INDEX.bySignatureName) {
    const sig = firstSignatureLine(doc.signature);
    const params = (doc.params || []).filter(
      (p) => /^[\p{L}_][\p{L}\p{N}_]*$/u.test(p.name) && new RegExp(`[(,\\s]${p.name}=`, 'u').test(sig),
    );
    if (params.length) kwargs.set(name, params.map((p) => ({ name: p.name, default: p.default, desc: p.desc?.ko || '' })));
  }
  // 한글 별칭·영어 원본이 같은 인자를 쓰도록 복사 (음표 ↔ play_note 등)
  for (const asg of top.assignments) {
    if (kwargs.has(asg.expr) && !kwargs.has(asg.name)) kwargs.set(asg.name, kwargs.get(asg.expr));
  }

  return {
    colors,
    koreanColorKeys,
    koreanColorNames: palette.koreanNames,
    textures,
    notes,
    noteConstants,
    koreanNoteMap,
    instruments,
    instrumentMap,
    sfxNames: getSfxNames(),
    bgmNames: getBgmNames(),
    namedLists,
    members,
    api,
    kwargs,
  };
}

/** 모듈 로드 때 한 번 만든다 */
const completionData = buildData(apiSource);

export default completionData;

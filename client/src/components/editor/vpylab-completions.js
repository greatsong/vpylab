/**
 * VPyLab 전용 Monaco 자동 완성
 *
 * - analyzeContext(): 커서 앞 텍스트를 읽어 "어떤 자리인가"를 판별한다
 *     색상[  / color.  → 색 이름,  음표("  → 음 이름,  효과음("  → 효과음 이름,  배경음악("  → 배경음악 이름,
 *     textures.  → 텍스처,  scene.  → 씬 속성,  ball.  → 객체 속성,  그 밖에는 API 함수·객체
 * - buildSuggestions(): 문맥에 맞는 항목 목록(Monaco와 무관한 평범한 객체)을 만든다
 * - registerVpylabCompletions(monaco): 위 둘을 Monaco 완성 공급자로 한 번만 등록한다
 */
import data from '../../engine/completion-data.js';
import {
  STARTER_SNIPPETS,
  KOREAN_SEARCH_ALIASES,
  PYTHON_BUILTINS,
  MATH_NAMES,
  RANDOM_MEMBERS,
  IMPORT_RANDOM_HINT,
  LIST_METHODS,
  PYTHON_KEYWORDS,
} from './starter-snippets.js';

const IDENT_RE = /[\p{L}_][\p{L}\p{N}_]*/u;
const DOTTED_TAIL_RE = /([\p{L}_][\p{L}\p{N}_]*(?:\s*\.\s*[\p{L}_][\p{L}\p{N}_]*)*)\s*$/u;
const WORD_TAIL_RE = /[\p{L}\p{N}_]*$/u;
const WORD_HEAD_RE = /^[\p{L}\p{N}_]*/u;
const QUOTED_HEAD_RE = /^(['"])[^'"\n]*\1/u; // 커서 바로 뒤에 놓인 '...' 또는 "..."
const SCAN_WINDOW = 8000;

const COLOR_NAMESPACES = new Set(['color', '색상']);
const TEXTURE_NAMESPACES = new Set(['textures', '텍스처']);
const NOTE_FUNCTIONS = new Set(['음표', 'play_note']);
const INSTRUMENT_FUNCTIONS = new Set(['악기', 'play_instrument']);
const SFX_FUNCTIONS = new Set(['효과음', 'play_sfx', 'sfx']);
const BGM_FUNCTIONS = new Set(['배경음악', 'start_bgm', 'bgm']);
/** 문자열 인자를 받는 함수의 자리: 키워드 이름 → 자리, 위치 → 자리 */
const STRING_SLOTS = [
  { names: NOTE_FUNCTIONS, byKw: { name: 'note' }, byIndex: ['note'] },
  { names: INSTRUMENT_FUNCTIONS, byKw: { instrument: 'instrument', name: 'note' }, byIndex: ['instrument', 'note'] },
  { names: SFX_FUNCTIONS, byKw: { name: 'sfx' }, byIndex: ['sfx'] },
  { names: BGM_FUNCTIONS, byKw: { name: 'bgm' }, byIndex: ['bgm'] },
];
const VECTOR_ATTRS = new Set(['pos', 'axis', 'size', 'velocity', 'center', 'up', 'forward', 'color', 'background', 'ambient']);
const NO_MEMBER_SUGGESTION = new Set(['math', 'np', 'numpy', 'self', 'json', 'time', 'asyncio', 'js']);

export const TRIGGER_CHARACTERS = ['[', "'", '"', '(', '.'];

// ───────────────────────── 문맥 판별 ─────────────────────────

/**
 * 커서 앞 텍스트를 읽어 문맥을 돌려준다.
 * @returns {{
 *   string: { quote: string, content: string } | null,   // 열린 문자열 안이면 따옴표와 지금까지 적은 내용
 *   bracket: { char: string, callee: string, argIndex: number, kw: string | null } | null, // 가장 안쪽의 열린 괄호
 *   member: string | null,   // `scene.` 처럼 점 앞의 식 (점 뒤에서 식별자를 적는 중일 때)
 *   word: string,            // 커서 바로 앞의 식별자 조각
 * }}
 */
export function analyzeContext(textBefore) {
  let start = 0;
  if (textBefore.length > SCAN_WINDOW) {
    start = textBefore.lastIndexOf('\n', textBefore.length - SCAN_WINDOW) + 1;
  }
  const stack = [];
  let string = null; // { quote, start, fstring }
  for (let i = start; i < textBefore.length; i++) {
    const ch = textBefore[i];
    if (string) {
      if (ch === '\\') {
        i++;
      } else if (textBefore.startsWith(string.quote, i)) {
        i += string.quote.length - 1;
        string = null;
      } else if (ch === '\n' && string.quote.length === 1) {
        // 일반 문자열은 줄을 넘지 못한다. 앞 줄의 닫히지 않은 따옴표(학생 오타)가 다음 줄을 삼키지 않게 한다
        string = null;
      } else if (ch === '{' && string.fstring) {
        if (textBefore[i + 1] === '{') {
          i++; // {{ 는 글자 그대로의 중괄호
        } else {
          // f"{color.red}" 의 보간식 안은 문자열 밖이다. 닫는 } 에서 문자열 상태로 돌아간다
          stack.push({ char: '{', callee: '', argIndex: 0, kw: null, fstring: string });
          string = null;
        }
      }
      continue;
    }
    if (ch === '#') {
      const nl = textBefore.indexOf('\n', i);
      if (nl < 0) return { string: null, bracket: null, member: null, word: '', comment: true };
      i = nl;
      continue;
    }
    if (ch === "'" || ch === '"') {
      const triple = ch.repeat(3);
      const quote = textBefore.startsWith(triple, i) ? triple : ch;
      const prefix = /[A-Za-z]{0,2}$/.exec(textBefore.slice(Math.max(start, i - 2), i))[0];
      string = { quote, start: i + quote.length, fstring: /f/i.test(prefix) };
      i += quote.length - 1;
      continue;
    }
    if (ch === '(' || ch === '[' || ch === '{') {
      const calleeMatch = DOTTED_TAIL_RE.exec(textBefore.slice(Math.max(start, i - 200), i));
      stack.push({ char: ch, callee: calleeMatch ? calleeMatch[1].replace(/\s+/g, '') : '', argIndex: 0, kw: null });
      continue;
    }
    if (ch === ')' || ch === ']' || ch === '}') {
      const popped = stack.pop();
      if (popped?.fstring) string = popped.fstring;
      continue;
    }
    if (stack.length && ch === ',') {
      const top = stack[stack.length - 1];
      top.argIndex++;
      top.kw = null;
      continue;
    }
    if (stack.length && ch === '=' && textBefore[i + 1] !== '=' && textBefore[i - 1] !== '=' && !'!<>'.includes(textBefore[i - 1])) {
      const top = stack[stack.length - 1];
      const kwMatch = /([\p{L}_][\p{L}\p{N}_]*)\s*$/u.exec(textBefore.slice(Math.max(start, i - 100), i));
      top.kw = kwMatch ? kwMatch[1] : null;
    }
  }

  const bracket = stack.length ? { ...stack[stack.length - 1] } : null;
  const importsRandom = /^\s*(?:import random\b|from random import)/m.test(textBefore);
  if (string) {
    return { string: { quote: string.quote, content: textBefore.slice(string.start) }, bracket, member: null, word: '', importsRandom };
  }
  const word = WORD_TAIL_RE.exec(textBefore)[0];
  const beforeWord = textBefore.slice(0, textBefore.length - word.length);
  let member = null;
  if (beforeWord.endsWith('.')) {
    const m = DOTTED_TAIL_RE.exec(beforeWord.slice(Math.max(0, beforeWord.length - 200), beforeWord.length - 1));
    member = m ? m[1].replace(/\s+/g, '') : '';
  }
  return { string: null, bracket, member, word, importsRandom };
}

// ───────────────────────── 항목 만들기 ─────────────────────────

function pad(i) {
  return String(i).padStart(4, '0');
}

/**
 * 문자열 값 하나를 완성 항목으로 (따옴표 처리 포함).
 * replaceLength는 커서 왼쪽, replaceAfter는 커서 오른쪽에서 함께 바꿀 글자 수다.
 * 색상['파|랑'] 에서 빨강을 고르면 '랑'과 닫는 따옴표까지 바꿔 색상['빨강'] 이 된다.
 */
function stringItem(name, { ctx, textAfter, quote, detail, documentation, kind, sort, color }) {
  if (ctx.string) {
    const q = ctx.string.quote;
    const closeAt = textAfter.indexOf(q);
    const lineEnd = textAfter.search(/[\n'"\])]/);
    // 닫는 따옴표가 뒤에 있으면 거기까지, 없으면 문자열로 보이는 글자까지 바꾸고 따옴표를 붙인다
    const replaceAfter = closeAt >= 0 && (lineEnd < 0 || closeAt <= lineEnd) ? closeAt + q.length : lineEnd < 0 ? textAfter.length : lineEnd;
    return {
      label: name,
      insertText: `${name}${q}`,
      filterText: name,
      replaceLength: ctx.string.content.length,
      replaceAfter,
      kind,
      detail,
      documentation,
      sortText: sort,
      color,
    };
  }
  // 따옴표를 아직 안 적은 자리: 커서 뒤에 이미 '...' 가 있으면 그것까지 바꾼다 (색상[|''] → 색상['빨강'])
  const quoted = QUOTED_HEAD_RE.exec(textAfter);
  return {
    label: `${quote}${name}${quote}`,
    insertText: `${quote}${name}${quote}`,
    filterText: name,
    replaceLength: ctx.word.length,
    replaceAfter: quoted ? quoted[0].length : ctx.wordAfter,
    kind,
    detail,
    documentation,
    sortText: sort,
    color,
  };
}

function colorKeyItems(ctx, textAfter) {
  const items = [];
  data.koreanColorKeys.forEach((c, i) => {
    // Monaco는 Color 종류 항목의 documentation 맨 앞에 있는 #rrggbb 로 색 견본을 그린다.
    // '빨' 같은 한 글자 키보다 '빨강'이 먼저 오게 한다 (Enter를 치면 색상['빨강'])
    const group = c.key.length >= 2 ? '0' : '1';
    items.push(stringItem(c.key, { ctx, textAfter, quote: "'", kind: 'color', color: c.hex, detail: `${c.key} → color.${c.english}`, documentation: `${c.hex} 색상['${c.key}']`, sort: `${group}${pad(i)}` }));
  });
  data.colors.forEach((c, i) => {
    items.push(stringItem(c.name, { ctx, textAfter, quote: "'", kind: 'color', color: c.hex, detail: c.korean, documentation: `${c.hex} 색상['${c.name}'] 또는 color.${c.name}`, sort: `2${pad(i)}` }));
  });
  return items;
}

function colorAttrItems(ctx, prefix = '') {
  const items = data.colors.map((c, i) => ({
    label: `${prefix}${c.name}`,
    insertText: `${prefix}${c.name}`,
    filterText: `${prefix}${c.name} ${c.korean}`,
    replaceLength: ctx.word.length,
    replaceAfter: ctx.wordAfter,
    kind: 'color',
    color: c.hex,
    detail: c.korean,
    documentation: `${c.hex} color.${c.name} — 한글로는 색상['${c.korean}']`,
    sortText: `0${pad(i)}`,
  }));
  if (!prefix) {
    data.members.color.methods.forEach((m, i) => {
      items.push({
        label: `${m.name}(${m.args})`,
        insertText: `${m.name}(\${1:${m.args}})$0`,
        isSnippet: true,
        filterText: m.name,
        replaceLength: ctx.word.length,
    replaceAfter: ctx.wordAfter,
        kind: 'method',
        detail: `color.${m.name}(${m.args})`,
        documentation: m.doc,
        sortText: `2${pad(i)}`,
      });
    });
  }
  return items;
}

function namedListKeyItems(list, ctx, textAfter) {
  return [...list.names.entries()].map(([key, index], i) => {
    const item = list.items[index];
    const isColor = item?.kind === 'color';
    const hex = isColor ? rgbHex(item.rgb) : null;
    const detail = item?.freq ? `${item.source} ${item.freq}Hz — ${list.name}[${index}]` : `${list.name}[${index}]`;
    const documentation = `${isColor ? `${hex} ` : ''}${list.name}['${key}']`;
    return stringItem(key, { ctx, textAfter, quote: "'", kind: isColor ? 'color' : 'value', color: hex, detail, documentation, sort: pad(i) });
  });
}

function rgbHex(rgb) {
  return `#${rgb.map((v) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0')).join('')}`;
}

function noteItems(ctx, textAfter) {
  return data.notes.map((n, i) =>
    stringItem(n.name, {
      ctx,
      textAfter,
      quote: '"',
      kind: 'value',
      detail: n.freq ? `${n.english} ${n.freq}Hz` : n.english,
      documentation: n.group <= 1 ? '한글 음 이름. 옥타브를 안 적으면 4옥타브' : '영어 음 이름. 옥타브를 안 적으면 4옥타브',
      sort: `${n.group}${pad(i)}`,
    }),
  );
}

function instrumentItems(ctx, textAfter) {
  return data.instruments.map((inst, i) =>
    stringItem(inst.name, { ctx, textAfter, quote: '"', kind: 'value', detail: inst.name === inst.english ? '악기' : `악기 (${inst.english})`, documentation: `악기("${inst.name}", "도")`, sort: pad(i) }),
  );
}

function sfxItems(ctx, textAfter) {
  return data.sfxNames.map((name, i) =>
    stringItem(name, { ctx, textAfter, quote: '"', kind: 'value', detail: '효과음', documentation: `효과음("${name}")`, sort: pad(i) }),
  );
}

function bgmItems(ctx, textAfter) {
  return data.bgmNames.map((name, i) =>
    stringItem(name, { ctx, textAfter, quote: '"', kind: 'value', detail: '배경음악', documentation: `배경음악("${name}")`, sort: pad(i) }),
  );
}

function textureItems(ctx, prefix = '') {
  return data.textures.map((t, i) => ({
    label: `${prefix}${t.name}`,
    insertText: `${prefix}${t.name}`,
    filterText: `${prefix}${t.name}`,
    replaceLength: ctx.word.length,
    replaceAfter: ctx.wordAfter,
    kind: 'value',
    detail: t.preset === t.name ? '텍스처' : `텍스처 (${t.preset}와 같음)`,
    documentation: `box(texture=textures.${t.name})`,
    sortText: pad(i),
  }));
}

function memberItems(group, ctx, ownerLabel) {
  const { props, methods } = group;
  const items = props.map((p, i) => ({
    label: p.name,
    insertText: p.name,
    filterText: p.name,
    replaceLength: ctx.word.length,
    replaceAfter: ctx.wordAfter,
    kind: 'property',
    detail: `${ownerLabel}.${p.name}`,
    documentation: p.doc,
    sortText: `0${pad(i)}`,
  }));
  methods.forEach((m, i) => {
    items.push({
      label: `${m.name}(${m.args})`,
      insertText: m.args ? `${m.name}(\${1:${m.args}})$0` : `${m.name}()$0`,
      isSnippet: true,
      filterText: m.name,
      replaceLength: ctx.word.length,
    replaceAfter: ctx.wordAfter,
      kind: 'method',
      detail: `${ownerLabel}.${m.name}(${m.args})`,
      documentation: m.doc,
      sortText: `1${pad(i)}`,
    });
  });
  return items;
}

function noteConstantItems(ctx) {
  return [...data.noteConstants.entries()].map(([name, freq], i) => ({
    label: name,
    insertText: name,
    filterText: name,
    replaceLength: ctx.word.length,
    replaceAfter: ctx.wordAfter,
    kind: 'value',
    detail: `${freq}Hz`,
    documentation: `note.${name}`,
    sortText: pad(i),
  }));
}

function kwargItems(callee, ctx) {
  const params = data.kwargs.get(callee);
  if (!params) return [];
  return params.map((p, i) => ({
    label: `${p.name}=`,
    insertText: `${p.name}=\${1:${p.default?.replace(/[$}\\]/g, '\\$&') || ''}}`,
    isSnippet: true,
    filterText: p.name,
    replaceLength: ctx.word.length,
    replaceAfter: ctx.wordAfter,
    kind: 'kwarg',
    detail: `${callee}(${p.name}=${p.default})`,
    documentation: p.desc,
    sortText: `0${pad(i)}`,
  }));
}

/** 이름과 한글 검색어를 함께 filterText로. "공" → sphere */
function withAliases(name, aliases) {
  return aliases?.length ? `${name} ${aliases.join(' ')}` : name;
}

/** `name(${1:x})` 꼴 함수 항목 */
function callItem(entry, ctx, { kind = 'function', detailPrefix = '', sort }) {
  const hasArgs = entry.args !== null && entry.args !== undefined;
  const argLabel = hasArgs ? entry.args.replace(/\$\{\d+:([^}]*)\}/g, '$1') : '';
  return {
    label: hasArgs ? `${entry.name}(${argLabel})` : entry.name,
    insertText: hasArgs ? `${entry.name}(${entry.args})$0` : entry.name,
    isSnippet: hasArgs,
    filterText: withAliases(entry.name, entry.aliases),
    replaceLength: ctx.word.length,
    replaceAfter: ctx.wordAfter,
    kind: hasArgs ? kind : 'variable',
    detail: `${detailPrefix}${entry.name}${hasArgs ? `(${argLabel})` : ''}`,
    documentation: entry.documentation,
    sortText: sort,
  };
}

/** API 함수·객체 + 파이썬 내장 함수·math 이름·키워드 (괄호 안에서도 쓰는 한 줄짜리 항목) */
function apiItems(ctx) {
  const items = data.api.map((it, i) => ({
    label: it.name,
    insertText: it.insertText,
    isSnippet: it.isSnippet,
    filterText: withAliases(it.name, KOREAN_SEARCH_ALIASES[it.name]),
    replaceLength: ctx.word.length,
    replaceAfter: ctx.wordAfter,
    kind: it.kind,
    detail: it.detail,
    documentation: it.documentation,
    sortText: `${it.documented ? 1 : 3}${pad(i)}`,
  }));
  PYTHON_BUILTINS.forEach((b, i) => items.push(callItem(b, ctx, { detailPrefix: '파이썬 내장 ', sort: `2${pad(i)}` })));
  MATH_NAMES.forEach((m, i) => items.push(callItem(m, ctx, { detailPrefix: 'math ', sort: `2${pad(100 + i)}` })));
  PYTHON_KEYWORDS.forEach((k, i) => {
    items.push({
      label: k.name,
      insertText: k.name,
      filterText: withAliases(k.name, k.aliases),
      replaceLength: ctx.word.length,
    replaceAfter: ctx.wordAfter,
      kind: 'keyword',
      detail: `키워드 ${k.name}`,
      documentation: k.documentation,
      sortText: `4${pad(i)}`,
    });
  });
  return items;
}

/** 구문·패턴 스니펫 (여러 줄이 있어 괄호 밖 일반 자리에서만) */
function snippetItems(ctx) {
  return STARTER_SNIPPETS.map((sn, i) => ({
    label: sn.label,
    labelDescription: sn.korean,
    insertText: sn.insertText,
    isSnippet: true,
    // Monaco는 filterText에서 일찍 맞는 항목을 앞에 두므로, 한글 검색어를 앞에 둬 "반복"에 rate보다 for/while이 먼저 오게 한다
    filterText: [...(sn.aliases || []), sn.label].join(' '),
    replaceLength: ctx.word.length,
    replaceAfter: ctx.wordAfter,
    kind: 'snippet',
    detail: sn.korean,
    documentation: sn.documentation,
    sortText: `0${pad(i)}`,
  }));
}

/** 일반 자리: 스니펫이 먼저, 그다음 API·내장 함수·키워드 */
function generalItems(ctx) {
  return [...snippetItems(ctx), ...apiItems(ctx)];
}

function randomItems(ctx) {
  const hint = ctx.importsRandom ? '' : ` (${IMPORT_RANDOM_HINT})`;
  return RANDOM_MEMBERS.map((m, i) => {
    const item = callItem(m, ctx, { kind: 'method', detailPrefix: 'random.', sort: pad(i) });
    item.documentation = `${m.documentation}${hint}`;
    return item;
  });
}

function listMethodItems(ctx) {
  return LIST_METHODS.map((m, i) => callItem(m, ctx, { kind: 'method', detailPrefix: '리스트.', sort: `2${pad(i)}` }));
}

/**
 * 문자열 인자 자리의 종류. 키워드(name=, instrument=)가 있으면 이름으로, 없으면 위치(argIndex)로 정한다.
 * 따옴표를 적었든 안 적었든 같은 판별을 쓴다. 해당 없는 자리면 null
 */
export function stringSlot(bracket) {
  if (!bracket) return null;
  if (bracket.char === '[') {
    if (COLOR_NAMESPACES.has(bracket.callee)) return 'colorKey';
    return findNamedList(bracket.callee) ? 'namedList' : null;
  }
  if (bracket.char !== '(') return null;
  const spec = STRING_SLOTS.find((entry) => entry.names.has(bracket.callee));
  if (!spec) return null;
  if (bracket.kw !== null) return spec.byKw[bracket.kw] || null;
  return spec.byIndex[bracket.argIndex] || null;
}

/** 문자열 인자 자리의 항목. 해당 없는 자리면 null */
function slotItems(bracket, ctx, textAfter) {
  switch (stringSlot(bracket)) {
    case 'colorKey': return colorKeyItems(ctx, textAfter);
    case 'namedList': return namedListKeyItems(findNamedList(bracket.callee), ctx, textAfter);
    case 'note': return noteItems(ctx, textAfter);
    case 'instrument': return instrumentItems(ctx, textAfter);
    case 'sfx': return sfxItems(ctx, textAfter);
    case 'bgm': return bgmItems(ctx, textAfter);
    default: return null;
  }
}

function findNamedList(name) {
  return data.namedLists.find((l) => l.name === name || l.aliases.includes(name)) || null;
}

/**
 * 문맥에 맞는 완성 항목 목록.
 * @param {ReturnType<typeof analyzeContext>} ctx
 * @param {{ textAfter?: string, triggerCharacter?: string | null }} options
 *   triggerCharacter가 있으면 사용자가 그 글자를 막 적은 것이므로, 아무 데서나 긴 목록을 띄우지 않는다
 */
export function buildSuggestions(rawCtx, { textAfter = '', triggerCharacter = null } = {}) {
  if (rawCtx.comment) return [];
  // 커서 오른쪽에 붙은 식별자 조각(color.r|ed 의 'ed')도 함께 바꾼다
  const ctx = { ...rawCtx, wordAfter: WORD_HEAD_RE.exec(textAfter)[0].length };
  const { string, bracket, member } = ctx;

  // 1) 문자열 인자 자리 (따옴표를 적은 뒤)
  if (string) return slotItems(bracket, ctx, textAfter) || [];

  // 2) 점 뒤: 네임스페이스·객체 멤버
  if (member !== null) {
    if (!IDENT_RE.test(member)) return [];
    if (COLOR_NAMESPACES.has(member)) return colorAttrItems(ctx);
    if (TEXTURE_NAMESPACES.has(member)) return textureItems(ctx);
    if (member === 'note') return noteConstantItems(ctx);
    if (member === 'scene') return memberItems(data.members.scene, ctx, 'scene');
    if (member === 'scene.camera') return memberItems(data.members.camera, ctx, 'scene.camera');
    if (member === 'scene.mouse') return memberItems(data.members.mouse, ctx, 'scene.mouse');
    if (member === 'vector' || member === 'vec') return memberItems(data.members.vector, ctx, 'vector');
    if (member === 'random') return randomItems(ctx);
    const last = member.split('.').pop();
    if (NO_MEMBER_SUGGESTION.has(last)) return [];
    if (VECTOR_ATTRS.has(last)) return memberItems(data.members.vector, ctx, member);
    // 변수의 종류는 모르니 3D 객체 속성 다음에 리스트 메서드도 보여 준다
    return [...memberItems(data.members.object, ctx, '객체'), ...listMethodItems(ctx)];
  }

  // 3) 괄호 안 (문자열 아님): 아직 따옴표를 안 적은 문자열 자리 → 따옴표까지 넣어 준다.
  //    글자를 적는 중이면(무지개[i], 음표(음계['도'])) 변수·함수도 쓸 수 있으니 API 항목을 뒤에 붙인다
  if (bracket) {
    const slot = slotItems(bracket, ctx, textAfter);
    if (slot) return triggerCharacter ? slot : [...slot, ...apiItems(ctx)];
    if (bracket.char === '(' && bracket.kw !== null) {
      // color=, trail_color= 자리에는 color.빨강, texture= 자리에는 textures.wood 를 먼저 보여 준다
      const lead = /color$/.test(bracket.kw) ? colorAttrItems(ctx, 'color.') : bracket.kw === 'texture' ? textureItems(ctx, 'textures.') : [];
      if (triggerCharacter) return lead;
      return [...lead, ...apiItems(ctx)];
    }
    if (bracket.char === '(' && bracket.kw === null) {
      const kwargs = kwargItems(bracket.callee, ctx);
      if (triggerCharacter) return kwargs; // `sphere(` 를 막 적었을 때는 인자 이름만
      return [...kwargs, ...apiItems(ctx)];
    }
  }

  // 4) 그 밖의 자리: 구문·패턴 스니펫, API 함수·객체·한글 별칭, 내장 함수, 키워드
  if (triggerCharacter) return [];
  return generalItems(ctx);
}

// ───────────────────────── Monaco 등록 ─────────────────────────

let registered = false;

function monacoKind(monaco, kind) {
  const K = monaco.languages.CompletionItemKind;
  switch (kind) {
    case 'color': return K.Color;
    case 'function': return K.Function;
    case 'class': return K.Class;
    case 'module': return K.Module;
    case 'variable': return K.Variable;
    case 'property': return K.Property;
    case 'method': return K.Method;
    case 'kwarg': return K.Field;
    case 'value': return K.EnumMember;
    case 'snippet': return K.Snippet;
    case 'keyword': return K.Keyword;
    default: return K.Text;
  }
}

/** 편집기 마운트 때 한 번만 호출한다. 같은 언어에 두 번 등록되면 항목이 겹쳐 보인다 */
export function registerVpylabCompletions(monaco) {
  if (registered) return;
  registered = true;
  monaco.languages.registerCompletionItemProvider('python', {
    triggerCharacters: TRIGGER_CHARACTERS,
    provideCompletionItems(model, position, context) {
      const textBefore = model.getValueInRange({
        startLineNumber: 1,
        startColumn: 1,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
      });
      const textAfter = model.getLineContent(position.lineNumber).slice(position.column - 1);
      const ctx = analyzeContext(textBefore);
      const triggerCharacter = context.triggerKind === monaco.languages.CompletionTriggerKind.TriggerCharacter ? context.triggerCharacter : null;
      const items = buildSuggestions(ctx, { textAfter, triggerCharacter });
      const lineLength = model.getLineLength(position.lineNumber);
      const suggestions = items.map((it) => {
        const replaceLength = Math.min(it.replaceLength, position.column - 1);
        const replaceAfter = Math.min(it.replaceAfter ?? ctx.wordAfter ?? 0, lineLength + 1 - position.column);
        return {
          label: it.labelDescription ? { label: it.label, description: it.labelDescription } : it.label,
          kind: monacoKind(monaco, it.kind),
          insertText: it.insertText,
          insertTextRules: it.isSnippet ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet : undefined,
          filterText: it.filterText,
          sortText: it.sortText,
          detail: it.detail,
          documentation: it.documentation ? { value: it.documentation } : undefined,
          range: {
            startLineNumber: position.lineNumber,
            startColumn: position.column - replaceLength,
            endLineNumber: position.lineNumber,
            endColumn: position.column + replaceAfter,
          },
        };
      });
      return { suggestions };
    },
  });
}

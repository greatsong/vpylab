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

const IDENT_RE = /[\p{L}_][\p{L}\p{N}_]*/u;
const DOTTED_TAIL_RE = /([\p{L}_][\p{L}\p{N}_]*(?:\s*\.\s*[\p{L}_][\p{L}\p{N}_]*)*)\s*$/u;
const WORD_TAIL_RE = /[\p{L}\p{N}_]*$/u;
const SCAN_WINDOW = 8000;

const COLOR_NAMESPACES = new Set(['color', '색상']);
const TEXTURE_NAMESPACES = new Set(['textures', '텍스처']);
const NOTE_FUNCTIONS = new Set(['음표', 'play_note']);
const INSTRUMENT_FUNCTIONS = new Set(['악기', 'play_instrument']);
const SFX_FUNCTIONS = new Set(['효과음', 'play_sfx', 'sfx']);
const BGM_FUNCTIONS = new Set(['배경음악', 'start_bgm', 'bgm']);
const VECTOR_ATTRS = new Set(['pos', 'axis', 'size', 'velocity', 'center', 'up', 'forward', 'color', 'background', 'ambient']);
const NO_MEMBER_SUGGESTION = new Set(['random', 'math', 'np', 'numpy', 'self', 'json', 'time', 'asyncio', 'js']);

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
  let string = null; // { quote, start }
  for (let i = start; i < textBefore.length; i++) {
    const ch = textBefore[i];
    if (string) {
      if (ch === '\\') {
        i++;
      } else if (textBefore.startsWith(string.quote, i)) {
        i += string.quote.length - 1;
        string = null;
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
      string = { quote, start: i + quote.length };
      i += quote.length - 1;
      continue;
    }
    if (ch === '(' || ch === '[' || ch === '{') {
      const calleeMatch = DOTTED_TAIL_RE.exec(textBefore.slice(Math.max(start, i - 200), i));
      stack.push({ char: ch, callee: calleeMatch ? calleeMatch[1].replace(/\s+/g, '') : '', argIndex: 0, kw: null });
      continue;
    }
    if (ch === ')' || ch === ']' || ch === '}') {
      stack.pop();
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
  if (string) {
    return { string: { quote: string.quote, content: textBefore.slice(string.start) }, bracket, member: null, word: '' };
  }
  const word = WORD_TAIL_RE.exec(textBefore)[0];
  const beforeWord = textBefore.slice(0, textBefore.length - word.length);
  let member = null;
  if (beforeWord.endsWith('.')) {
    const m = DOTTED_TAIL_RE.exec(beforeWord.slice(Math.max(0, beforeWord.length - 200), beforeWord.length - 1));
    member = m ? m[1].replace(/\s+/g, '') : '';
  }
  return { string: null, bracket, member, word };
}

// ───────────────────────── 항목 만들기 ─────────────────────────

function pad(i) {
  return String(i).padStart(4, '0');
}

/** 문자열 값 하나를 완성 항목으로 (따옴표 처리 포함) */
function stringItem(name, { ctx, textAfter, quote, detail, documentation, kind, sort, color }) {
  if (ctx.string) {
    // 따옴표를 이미 적은 뒤: 내용만 넣고, 닫는 따옴표가 뒤에 없으면 붙인다
    const closing = textAfter.startsWith(ctx.string.quote) ? '' : ctx.string.quote;
    return {
      label: name,
      insertText: `${name}${closing}`,
      filterText: name,
      replaceLength: ctx.string.content.length,
      kind,
      detail,
      documentation,
      sortText: sort,
      color,
    };
  }
  return {
    label: `${quote}${name}${quote}`,
    insertText: `${quote}${name}${quote}`,
    filterText: name,
    replaceLength: ctx.word.length,
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
    // Monaco는 Color 종류 항목의 documentation 맨 앞에 있는 #rrggbb 로 색 견본을 그린다
    items.push(stringItem(c.key, { ctx, textAfter, quote: "'", kind: 'color', color: c.hex, detail: `${c.key} → color.${c.english}`, documentation: `${c.hex} 색상['${c.key}']`, sort: `0${pad(i)}` }));
  });
  data.colors.forEach((c, i) => {
    items.push(stringItem(c.name, { ctx, textAfter, quote: "'", kind: 'color', color: c.hex, detail: c.korean, documentation: `${c.hex} 색상['${c.name}'] 또는 color.${c.name}`, sort: `1${pad(i)}` }));
  });
  return items;
}

function colorAttrItems(ctx, prefix = '') {
  const items = data.colors.map((c, i) => ({
    label: `${prefix}${c.name}`,
    insertText: `${prefix}${c.name}`,
    filterText: `${prefix}${c.name} ${c.korean}`,
    replaceLength: ctx.word.length,
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
    kind: 'kwarg',
    detail: `${callee}(${p.name}=${p.default})`,
    documentation: p.desc,
    sortText: `0${pad(i)}`,
  }));
}

function apiItems(ctx) {
  return data.api.map((it, i) => ({
    label: it.name,
    insertText: it.insertText,
    isSnippet: it.isSnippet,
    filterText: it.name,
    replaceLength: ctx.word.length,
    kind: it.kind,
    detail: it.detail,
    documentation: it.documentation,
    sortText: `${it.math ? 3 : it.documented ? 1 : 2}${pad(i)}`,
  }));
}

/** 따옴표를 아직 안 적은 문자열 인자 자리의 항목. 해당 없는 자리면 null */
function slotItems(bracket, ctx, textAfter) {
  if (bracket.char === '[') {
    if (COLOR_NAMESPACES.has(bracket.callee)) return colorKeyItems(ctx, textAfter);
    const list = findNamedList(bracket.callee);
    if (list) return namedListKeyItems(list, ctx, textAfter);
    return null;
  }
  if (bracket.char === '(' && bracket.kw === null) {
    if (NOTE_FUNCTIONS.has(bracket.callee) && bracket.argIndex === 0) return noteItems(ctx, textAfter);
    if (INSTRUMENT_FUNCTIONS.has(bracket.callee) && bracket.argIndex === 0) return instrumentItems(ctx, textAfter);
    if (INSTRUMENT_FUNCTIONS.has(bracket.callee) && bracket.argIndex === 1) return noteItems(ctx, textAfter);
    if (SFX_FUNCTIONS.has(bracket.callee) && bracket.argIndex === 0) return sfxItems(ctx, textAfter);
    if (BGM_FUNCTIONS.has(bracket.callee) && bracket.argIndex === 0) return bgmItems(ctx, textAfter);
  }
  return null;
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
export function buildSuggestions(ctx, { textAfter = '', triggerCharacter = null } = {}) {
  if (ctx.comment) return [];
  const { string, bracket, member } = ctx;

  // 1) 문자열 인자 자리
  if (string) {
    if (!bracket) return [];
    if (bracket.char === '[') {
      if (COLOR_NAMESPACES.has(bracket.callee)) return colorKeyItems(ctx, textAfter);
      const list = findNamedList(bracket.callee);
      if (list) return namedListKeyItems(list, ctx, textAfter);
      return [];
    }
    if (bracket.char === '(') {
      if (NOTE_FUNCTIONS.has(bracket.callee) && bracket.argIndex === 0) return noteItems(ctx, textAfter);
      if (INSTRUMENT_FUNCTIONS.has(bracket.callee)) {
        if (bracket.argIndex === 0 || bracket.kw === 'instrument') return instrumentItems(ctx, textAfter);
        if (bracket.argIndex === 1 || bracket.kw === 'name') return noteItems(ctx, textAfter);
      }
      if (SFX_FUNCTIONS.has(bracket.callee) && bracket.argIndex === 0) return sfxItems(ctx, textAfter);
      if (BGM_FUNCTIONS.has(bracket.callee) && bracket.argIndex === 0) return bgmItems(ctx, textAfter);
    }
    return [];
  }

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
    const last = member.split('.').pop();
    if (NO_MEMBER_SUGGESTION.has(last)) return [];
    if (VECTOR_ATTRS.has(last)) return memberItems(data.members.vector, ctx, member);
    return memberItems(data.members.object, ctx, '객체');
  }

  // 3) 괄호 안 (문자열 아님): 아직 따옴표를 안 적은 문자열 자리 → 따옴표까지 넣어 준다.
  //    글자를 적는 중이면(무지개[i], 음표(음계['도'])) 변수·함수도 쓸 수 있으니 API 항목을 뒤에 붙인다
  if (bracket) {
    const slot = slotItems(bracket, ctx, textAfter);
    if (slot) return triggerCharacter ? slot : [...slot, ...apiItems(ctx)];
    if (bracket.char === '(' && bracket.kw) {
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

  // 4) 그 밖의 자리: API 함수·객체·한글 별칭
  if (triggerCharacter) return [];
  return apiItems(ctx);
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
      const suggestions = items.map((it) => {
        const replaceLength = Math.min(it.replaceLength, position.column - 1);
        return {
          label: it.label,
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
            endColumn: position.column,
          },
        };
      });
      return { suggestions };
    },
  });
}

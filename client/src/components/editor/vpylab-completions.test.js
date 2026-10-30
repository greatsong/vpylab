/**
 * 자동 완성 문맥 판별과 항목 선택 검사 (Monaco 없이 순수 함수만)
 */
import { describe, it, expect, vi } from 'vitest';
import { analyzeContext, buildSuggestions, registerVpylabCompletions, TRIGGER_CHARACTERS } from './vpylab-completions.js';

function suggest(textBefore, options = {}) {
  return buildSuggestions(analyzeContext(textBefore), options);
}
const labels = (items) => items.map((it) => it.label);

describe('analyzeContext', () => {
  it('열린 문자열과 그 호출을 알아낸다', () => {
    const ctx = analyzeContext('ball = sphere()\n음표("도');
    expect(ctx.string).toEqual({ quote: '"', content: '도' });
    expect(ctx.bracket).toMatchObject({ char: '(', callee: '음표', argIndex: 0 });
  });
  it('닫힌 문자열·괄호는 무시한다', () => {
    const ctx = analyzeContext("x = color['red']; y = ");
    expect(ctx.string).toBeNull();
    expect(ctx.bracket).toBeNull();
    expect(ctx.word).toBe('');
  });
  it('쉼표로 인자 순서를, =로 키워드 이름을 센다', () => {
    expect(analyzeContext('악기("피아노", "').bracket).toMatchObject({ callee: '악기', argIndex: 1 });
    expect(analyzeContext('sphere(pos=vector(0, 0, 0), color=').bracket).toMatchObject({ callee: 'sphere', argIndex: 1, kw: 'color' });
    expect(analyzeContext('if a == b and f(').bracket).toMatchObject({ callee: 'f', kw: null });
  });
  it('점 앞의 식과 커서 앞 단어를 돌려준다', () => {
    expect(analyzeContext('scene.ca')).toMatchObject({ member: 'scene', word: 'ca' });
    expect(analyzeContext('scene.camera.')).toMatchObject({ member: 'scene.camera', word: '' });
    expect(analyzeContext('ball.pos.')).toMatchObject({ member: 'ball.pos' });
    expect(analyzeContext('x = 0.')).toMatchObject({ member: '' });
    expect(analyzeContext('sp')).toMatchObject({ member: null, word: 'sp' });
    expect(analyzeContext('색')).toMatchObject({ member: null, word: '색' });
  });
  it('주석과 세 따옴표 문자열을 처리한다', () => {
    expect(analyzeContext('x = 1  # 색상[').comment).toBe(true);
    expect(analyzeContext('"""설명 색상[\n여러 줄 """\n색상[').bracket).toMatchObject({ callee: '색상', char: '[' });
    expect(analyzeContext('"""아직 안 닫힘\n색상[').string).toMatchObject({ quote: '"""' });
  });
  it('아주 긴 텍스트도 줄 경계에서 잘라 읽는다', () => {
    const long = `${'x = 1\n'.repeat(3000)}색상[`;
    expect(analyzeContext(long).bracket).toMatchObject({ callee: '색상' });
  });
});

describe('buildSuggestions — 문맥별 집합', () => {
  it("색상[ 에는 한글 키를 따옴표까지 넣어 준다", () => {
    const items = suggest('ball.color = 색상[');
    expect(labels(items)).toContain("'빨강'");
    expect(labels(items)).toContain("'red'");
    const red = items.find((it) => it.label === "'빨강'");
    expect(red.insertText).toBe("'빨강'");
    expect(red.kind).toBe('color');
    expect(red.documentation.startsWith('#ff0000')).toBe(true);
    expect(red.replaceLength).toBe(0);
  });
  it("색상['빨 처럼 따옴표 뒤에서는 내용만 바꾸고, 닫는 따옴표가 없으면 붙인다", () => {
    const items = suggest("색상['빨", { textAfter: "']" });
    const red = items.find((it) => it.label === '빨강');
    expect(red.insertText).toBe('빨강');
    expect(red.replaceLength).toBe(1);
    const noClose = suggest("색상['빨", { textAfter: '' }).find((it) => it.label === '빨강');
    expect(noClose.insertText).toBe("빨강'");
  });
  it('color[ 와 color. 도 같은 색 집합을 쓴다', () => {
    expect(labels(suggest('color['))).toContain("'파랑'");
    const attrs = suggest('color.');
    expect(labels(attrs)).toContain('blue');
    expect(labels(attrs)).not.toContain("'파랑'");
    expect(attrs.find((it) => it.label === 'blue').detail).toBe('파랑');
    expect(labels(attrs)).toContain('hsv_to_rgb(c)');
    expect(labels(suggest('색상.'))).toContain('skyblue');
  });
  it('무지개[·파스텔[·음계[ 에는 그 목록의 이름을 준다', () => {
    expect(labels(suggest('무지개['))).toEqual(expect.arrayContaining(["'빨강'", "'보라'", "'red'"]));
    expect(labels(suggest('rainbow['))).toContain("'주황'");
    expect(labels(suggest('파스텔['))).toEqual(expect.arrayContaining(["'핑크'", "'하늘'"]));
    expect(labels(suggest("파스텔['"))).not.toContain("'핑크'");
    const scale = suggest('음계[');
    expect(labels(scale)).toEqual(expect.arrayContaining(["'도'", "'높은도'", "'C'"]));
    expect(scale.find((it) => it.label === "'도'").detail).toContain('261.63Hz');
    expect(labels(suggest('기본색['))).toContain("'검정'");
    expect(labels(suggest('따뜻한색[', { triggerCharacter: '[' }))).toEqual(["'빨'", "'주'", "'노'"]);
    // 글자를 적는 중이면(무지개[i]) 변수·함수 항목도 뒤에 온다
    expect(labels(suggest('무지개[i'))).toContain('input');
    expect(labels(suggest('음표(음'))).toEqual(expect.arrayContaining(['"도"', '음계']));
  });
  it('음표(·play_note( 에는 음 이름을 준다', () => {
    const items = suggest('음표("');
    expect(labels(items)).toEqual(expect.arrayContaining(['도', '솔#', '레b', '도5', 'C4', 'A']));
    expect(items[0].label).toBe('도');
    expect(items.find((it) => it.label === '도').detail).toBe('C4 261.63Hz');
    expect(labels(suggest('play_note('))).toContain('"도"');
    expect(labels(suggest("음표('미"))).toContain('미');
    // 두 번째 인자(duration)에는 음 이름을 주지 않는다
    expect(suggest('음표("도", ')).not.toEqual(expect.arrayContaining([expect.objectContaining({ label: '"레"' })]));
  });
  it('악기( 는 첫 인자에 악기, 둘째 인자에 음 이름을 준다', () => {
    expect(labels(suggest('악기("'))).toEqual(expect.arrayContaining(['피아노', '기타', 'piano']));
    expect(labels(suggest('악기("피아노", "'))).toEqual(expect.arrayContaining(['도', '솔4']));
    expect(labels(suggest('play_instrument("guitar", "'))).toContain('미');
  });
  it('효과음(·배경음악( 에는 효과음·배경음악 이름을 준다', () => {
    expect(labels(suggest('효과음("'))).toEqual(expect.arrayContaining(['coin', 'jump', 'explosion']));
    expect(labels(suggest('play_sfx('))).toContain('"coin"');
    expect(labels(suggest('배경음악("'))).toEqual(expect.arrayContaining(['adventure', 'battle']));
    expect(labels(suggest('start_bgm('))).toContain('"peaceful"');
    expect(labels(suggest('bgm("a'))).toContain('adventure');
  });
  it('textures. 에는 텍스처 이름, note. 에는 음 상수, scene. 에는 씬 속성을 준다', () => {
    expect(labels(suggest('box(texture=textures.'))).toEqual(expect.arrayContaining(['wood', 'galaxy']));
    expect(labels(suggest('텍스처.'))).toContain('metal');
    expect(labels(suggest('note.'))).toEqual(expect.arrayContaining(['C4', 'A4', 'C6']));
    const scene = suggest('scene.');
    expect(labels(scene)).toEqual(expect.arrayContaining(['background', 'range', 'center', 'title']));
    expect(labels(scene)).toContain('bind(event_names, handler=None)');
    expect(labels(suggest('scene.camera.'))).toEqual(expect.arrayContaining(['pos', 'axis', 'follow(obj=None)']));
    expect(labels(suggest('scene.mouse.'))).toContain('pick');
  });
  it('객체 변수 뒤의 점에는 공통 속성을, 벡터 속성 뒤에는 x·y·z를 준다', () => {
    expect(labels(suggest('ball.'))).toEqual(expect.arrayContaining(['pos', 'color', 'velocity', 'radius', 'rotate(angle, axis=None, origin=None)']));
    expect(labels(suggest('ball.pos.'))).toEqual(expect.arrayContaining(['x', 'y', 'z', 'mag']));
    expect(labels(suggest('vector.'))).toContain('random()');
    expect(suggest('x = 0.')).toEqual([]);
    expect(suggest('math.')).toEqual([]);
  });
  it('함수 괄호 바로 뒤에는 키워드 인자를, 글자를 적으면 API 항목도 함께 준다', () => {
    const onTrigger = suggest('sphere(', { triggerCharacter: '(' });
    expect(labels(onTrigger)).toEqual(expect.arrayContaining(['pos=', 'radius=', 'color=']));
    expect(labels(onTrigger)).not.toContain('sphere');
    const typed = suggest('sphere(ra');
    expect(labels(typed)).toContain('radius=');
    expect(labels(typed)).toContain('rate');
    expect(suggest('print(', { triggerCharacter: '(' })).toEqual([]);
  });
  it('color= 자리에는 color.빨강 꼴을, texture= 자리에는 textures.wood 꼴을 먼저 준다', () => {
    const items = suggest('sphere(color=', { triggerCharacter: '=' });
    expect(labels(items)[0]).toBe('color.red');
    expect(items[0].documentation.startsWith('#ff0000')).toBe(true);
    expect(labels(suggest('box(texture=', { triggerCharacter: '=' }))).toContain('textures.wood');
    expect(labels(suggest('sphere(color=col'))).toEqual(expect.arrayContaining(['color.red', 'color']));
  });
  it('그 밖의 자리에는 API 함수·객체·한글 별칭을 준다', () => {
    const items = suggest('sp');
    const names = labels(items);
    expect(names).toEqual(expect.arrayContaining(['sphere', 'box', 'rate', 'vector', 'scene', '음표', '효과음', '배경음악', '색상', '무지개', '파스텔', '악기', '산점도']));
    const sphere = items.find((it) => it.label === 'sphere');
    expect(sphere.isSnippet).toBe(true);
    expect(sphere.insertText).toContain('sphere(pos=${1:');
    expect(sphere.documentation).toContain('3D 구');
    expect(sphere.replaceLength).toBe(2);
    expect(items.find((it) => it.label === 'rate').insertText).toBe('rate(${1:fps})$0');
    // 문서 있는 항목이 앞에 온다
    expect(sphere.sortText < items.find((it) => it.label === 'msclock').sortText).toBe(true);
  });
  it('모르는 문자열 안·주석 안·트리거 글자만 적은 빈자리에는 아무것도 주지 않는다', () => {
    expect(suggest('label(text="안')).toEqual([]);
    expect(suggest('print("hello')).toEqual([]);
    expect(suggest('# 색상[')).toEqual([]);
    expect(suggest('x = (', { triggerCharacter: '(' })).toEqual([]);
    expect(suggest('x = "', { triggerCharacter: '"' })).toEqual([]);
  });
});

describe('buildSuggestions — 구문 스니펫·내장 함수·한글 검색', () => {
  it('일반 자리에는 구문·패턴 스니펫이 맨 앞에 온다', () => {
    const items = suggest('');
    const first = labels(items.slice(0, 4));
    expect(first).toEqual(['from vpython import *', 'for i in range(10):', 'while True:', 'if 조건:']);
    const forSnippet = items.find((it) => it.label === 'for i in range(10):');
    expect(forSnippet.isSnippet).toBe(true);
    expect(forSnippet.insertText).toBe('for ${1:i} in range(${2:10}):\n    ${3:pass}');
    expect(forSnippet.labelDescription).toBe('횟수 반복');
    expect(forSnippet.kind).toBe('snippet');
    const whileSnippet = items.find((it) => it.label === 'while True:');
    expect(whileSnippet.insertText).toContain('rate(${1:60})');
    expect(items.find((it) => it.label.startsWith('공 = sphere(')).insertText).toContain("색상['${6:빨강}']");
    expect(items.find((it) => it.label === 'scene.lights = []')).toBeDefined();
    expect(items.find((it) => it.label === '음표("도", 0.3)').insertText).toBe('음표("${1:도}", ${2:0.3})');
    // 스니펫 → 문서 있는 API → 내장 함수 → 나머지 → 키워드 순
    const sortOf = (label) => items.find((it) => it.label === label).sortText;
    expect(sortOf('for i in range(10):') < sortOf('sphere')).toBe(true);
    expect(sortOf('sphere') < sortOf('range(10)')).toBe(true);
    expect(sortOf('range(10)') < sortOf('msclock')).toBe(true);
    expect(sortOf('msclock') < sortOf('True')).toBe(true);
  });
  it('한글 접두 검색어가 filterText에 들어간다: 반복→for/while, 공→sphere, 빛→local_light, 소리→음표', () => {
    const items = suggest('');
    const matching = (word) => items.filter((it) => it.filterText.split(' ').some((t) => t.startsWith(word))).map((it) => it.label);
    expect(matching('반복')).toEqual(expect.arrayContaining(['for i in range(10):', 'while True:', 'rate', 'break']));
    expect(matching('조건')).toEqual(expect.arrayContaining(['if 조건:', 'elif 조건:', 'else:']));
    expect(matching('공')).toEqual(expect.arrayContaining(['sphere', "공 = sphere(pos=vector(0, 0, 0), radius=0.5, color=색상['빨강'])"]));
    expect(matching('상자')).toContain('box');
    expect(matching('빛')).toEqual(expect.arrayContaining(['local_light', 'scene.lights = []']));
    expect(matching('소리')).toEqual(expect.arrayContaining(['음표', '효과음', '음표("도", 0.3)', '효과음("coin")']));
    expect(matching('출력')).toContain('print(값)');
  });
  it('파이썬 내장 함수·math 이름·키워드를 한국어 설명과 함께 준다', () => {
    const items = suggest('x = ');
    const range = items.find((it) => it.label === 'range(10)');
    expect(range.insertText).toBe('range(${1:10})$0');
    expect(range.documentation).toContain('0부터 9까지');
    expect(labels(items)).toEqual(expect.arrayContaining(['len(리스트)', 'int(값)', 'round(x, 2)', 'max(a, b)', 'sum(리스트)', 'sin(x)', 'sqrt(x)', 'pi']));
    expect(items.find((it) => it.label === 'pi').isSnippet).toBe(false);
    expect(items.find((it) => it.label === 'True').kind).toBe('keyword');
    expect(labels(items)).toEqual(expect.arrayContaining(['False', 'and', 'or', 'not', 'in', 'break']));
    // input은 vpython-api.py가 다시 정의한 것 하나만
    expect(labels(items).filter((l) => l === 'input' || l.startsWith('input(')).length).toBe(1);
    // 괄호 안(print(len( 같은 자리)에서도 내장 함수는 나오지만 여러 줄 스니펫은 나오지 않는다
    const inside = suggest('print(le');
    expect(labels(inside)).toContain('len(리스트)');
    expect(labels(inside)).not.toContain('for i in range(10):');
  });
  it('random. 뒤에는 random 함수만, import random이 없으면 안내를 붙인다', () => {
    const noImport = suggest('x = random.');
    expect(labels(noImport)).toEqual(['randint(1, 6)', 'uniform(-5, 5)', 'choice(리스트)', 'random()', 'shuffle(리스트)']);
    expect(noImport[0].documentation).toContain('맨 위에 import random 필요');
    expect(noImport[0].insertText).toBe('randint(${1:1}, ${2:6})$0');
    const withImport = suggest('import random\nx = random.');
    expect(withImport[0].documentation).not.toContain('import random 필요');
    expect(labels(suggest('import random\nx = random.ra'))).toContain('randint(1, 6)');
  });
  it('변수 뒤 점에는 객체 속성 다음에 리스트 메서드(append·pop·index)가 온다', () => {
    const items = suggest('목록.');
    expect(labels(items)).toEqual(expect.arrayContaining(['append(값)', 'pop()', 'index(값)']));
    expect(items.find((it) => it.label === 'append(값)').sortText > items.find((it) => it.label === 'pos').sortText).toBe(true);
    expect(labels(items)).not.toContain('upper()');
  });
  it('엔진 내부 이름(_로 시작)은 어느 자리에서도 제안하지 않는다', () => {
    for (const text of ['', 'x = ', 'scene.', 'ball.', 'color.', 'random.', 'sphere(', '음표(']) {
      for (const it of suggest(text)) expect(it.label.startsWith('_'), `${text} → ${it.label}`).toBe(false);
    }
  });
});

describe('registerVpylabCompletions', () => {
  function fakeMonaco() {
    const register = vi.fn();
    return {
      register,
      monaco: {
        languages: {
          registerCompletionItemProvider: register,
          CompletionItemKind: { Color: 1, Function: 2, Class: 3, Module: 4, Variable: 5, Property: 6, Method: 7, Field: 8, EnumMember: 9, Snippet: 11, Keyword: 12, Text: 10 },
          CompletionItemInsertTextRule: { InsertAsSnippet: 4 },
          CompletionTriggerKind: { Invoke: 0, TriggerCharacter: 1 },
        },
      },
    };
  }
  function fakeModel(lines) {
    return {
      getValueInRange: ({ endLineNumber, endColumn }) => {
        const before = lines.slice(0, endLineNumber - 1);
        return [...before, lines[endLineNumber - 1].slice(0, endColumn - 1)].join('\n');
      },
      getLineContent: (n) => lines[n - 1],
    };
  }

  it('python 언어에 한 번만 등록하고, 항목에 범위와 종류를 붙인다', () => {
    const { monaco, register } = fakeMonaco();
    registerVpylabCompletions(monaco);
    registerVpylabCompletions(monaco);
    expect(register).toHaveBeenCalledTimes(1);
    const [language, provider] = register.mock.calls[0];
    expect(language).toBe('python');
    expect(provider.triggerCharacters).toEqual(TRIGGER_CHARACTERS);

    const model = fakeModel(['from vpython import *', "ball.color = 색상['빨']"]);
    const { suggestions } = provider.provideCompletionItems(model, { lineNumber: 2, column: 19 }, { triggerKind: 0 });
    const red = suggestions.find((s) => s.label === '빨강');
    expect(red.kind).toBe(1);
    expect(red.insertText).toBe('빨강');
    expect(red.range).toEqual({ startLineNumber: 2, startColumn: 18, endLineNumber: 2, endColumn: 19 });
    expect(red.documentation.value.startsWith('#ff0000')).toBe(true);

    const model2 = fakeModel(['sp']);
    const result = provider.provideCompletionItems(model2, { lineNumber: 1, column: 3 }, { triggerKind: 0 });
    const sphere = result.suggestions.find((s) => s.label === 'sphere');
    expect(sphere.insertTextRules).toBe(4);
    expect(sphere.range.startColumn).toBe(1);

    const forSnippet = result.suggestions.find((s) => s.label?.label === 'for i in range(10):');
    expect(forSnippet.label.description).toBe('횟수 반복');
    expect(forSnippet.kind).toBe(11);

    const model3 = fakeModel(['x = (']);
    expect(provider.provideCompletionItems(model3, { lineNumber: 1, column: 6 }, { triggerKind: 1, triggerCharacter: '(' }).suggestions).toEqual([]);
  });
});

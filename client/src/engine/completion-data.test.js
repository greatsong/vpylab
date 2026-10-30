/**
 * 자동 완성 데이터가 원본(vpython-api.py·sound-system.js·docs.js)과 어긋나지 않는지 검사한다.
 * python3가 있으면 실제 vpython-api.py를 CPython으로 실행해 이름 목록을 받아 정규식 추출 결과와 대조한다.
 */
import { describe, it, expect } from 'vitest';
import data, {
  extractClassBlock,
  extractDictLiteral,
  parseStringDict,
  signatureToSnippet,
  requiredArgNames,
  rgbToHex,
} from './completion-data.js';
import docs from '../data/docs.js';
import { getSfxNames, getBgmNames, hasSfx, hasBgm } from './sound-system.js';
import { hasPython, runPythonJobs } from '../test/python-runner.js';

describe('원문 추출 보조', () => {
  const source = `class A:\n    x = 1\n\n    _m = {\n        'a': 'b', '가': 'c',\n    }\nclass B:\n    y = 2\n`;
  it('클래스 블록을 다음 최상위 줄 전까지 자른다', () => {
    expect(extractClassBlock(source, 'A')).toContain('x = 1');
    expect(extractClassBlock(source, 'A')).not.toContain('y = 2');
    expect(extractClassBlock(source, 'Z')).toBe('');
  });
  it('딕셔너리 리터럴을 읽는다', () => {
    const map = parseStringDict(extractDictLiteral(source, '_m'));
    expect([...map.entries()]).toEqual([['a', 'b'], ['가', 'c']]);
    expect(parseStringDict("'도': 0, '레': 1").get('레')).toBe(1);
  });
  it('서명을 스니펫으로 바꾼다', () => {
    expect(signatureToSnippet('rate', 'fps')).toBe('rate(${1:fps})$0');
    expect(signatureToSnippet('sphere', 'pos=vector(0,0,0), radius=1.0')).toBe('sphere(pos=${1:vector(0,0,0)}, radius=${2:1.0})$0');
    expect(signatureToSnippet('음표', "name='도4', duration=0.5", 4, new Set(['name']))).toBe("음표(${1:'도4'}, duration=${2:0.5})$0");
    expect(signatureToSnippet('stop_bgm', '')).toBe('stop_bgm()$0');
    expect(requiredArgNames("name, duration=0.5, *args, **kwargs")).toEqual(new Set(['name']));
  });
  it('RGB를 16진 색으로 바꾼다', () => {
    expect(rgbToHex([1, 0, 0])).toBe('#ff0000');
    expect(rgbToHex([0.53, 0.81, 0.92])).toBe('#87cfeb');
  });
});

describe('완성 데이터 (정적 검사)', () => {
  it('팔레트 30색과 한글 이름을 모두 읽는다', () => {
    expect(data.colors.length).toBe(30);
    expect(data.colors.map((c) => c.name)).toContain('skyblue');
    expect(data.koreanColorNames.get('빨강')).toBe('red');
    // 한글 이름이 가리키는 영어 색은 모두 팔레트에 있어야 한다
    const names = new Set(data.colors.map((c) => c.name));
    for (const en of data.koreanColorNames.values()) expect(names.has(en), en).toBe(true);
    expect(data.koreanColorKeys.find((k) => k.key === '하늘').hex).toBe('#87cfeb');
    expect(data.colors.find((c) => c.name === 'red').korean).toBe('빨강');
  });

  it('효과음·배경음악 이름은 sound-system의 실제 키와 같다', () => {
    expect(data.sfxNames).toEqual(getSfxNames());
    expect(data.bgmNames).toEqual(getBgmNames());
    expect(data.sfxNames).toContain('coin');
    expect(data.bgmNames).toContain('adventure');
    for (const name of data.sfxNames) expect(hasSfx(name)).toBe(true);
    for (const name of data.bgmNames) expect(hasBgm(name)).toBe(true);
  });

  it('음 이름은 한글(도~시, #·b)과 영어, 옥타브 3~6을 모두 담는다', () => {
    const names = data.notes.map((n) => n.name);
    for (const kr of ['도', '레', '미', '파', '솔', '라', '시', '도#', '시b', '도3', '솔#5', '시6']) expect(names).toContain(kr);
    for (const en of ['C', 'F#', 'Bb', 'C4', 'A5', 'C6']) expect(names).toContain(en);
    expect(data.notes.find((n) => n.name === '도').freq).toBe(261.63);
    expect(data.notes.find((n) => n.name === '라').english).toBe('A4');
    expect(new Set(names).size).toBe(names.length);
  });

  it('악기·텍스처·NamedList를 읽는다', () => {
    expect(data.instruments.map((i) => i.name)).toEqual(expect.arrayContaining(['피아노', '기타', 'piano', 'chiptune']));
    expect(data.textures.map((t) => t.name)).toEqual(expect.arrayContaining(['wood', 'metal', 'galaxy', 'checker']));
    const names = data.namedLists.map((l) => l.name);
    expect(names).toEqual(expect.arrayContaining(['무지개', '파스텔', '따뜻한색', '차가운색', '기본색', '음계', '높은음계', '낮은음계']));
    const rainbow = data.namedLists.find((l) => l.name === '무지개');
    expect(rainbow.kind).toBe('color');
    expect(rainbow.items.length).toBe(7);
    expect(rainbow.names.get('파랑')).toBe(5);
    expect(rainbow.aliases).toEqual(['rainbow']);
    const pastel = data.namedLists.find((l) => l.name === '파스텔');
    expect(pastel.items[0].rgb).toEqual([1, 0.7, 0.7]);
    const scale = data.namedLists.find((l) => l.name === '음계');
    expect(scale.kind).toBe('note');
    expect(scale.items[0].freq).toBe(261.63);
    expect(scale.names.get('높은도')).toBe(7);
  });

  it('씬·객체·벡터 멤버를 읽는다', () => {
    expect(data.members.scene.props.map((p) => p.name)).toEqual(expect.arrayContaining(['background', 'range', 'center', 'width', 'title', 'camera']));
    expect(data.members.scene.methods.map((m) => m.name)).toEqual(expect.arrayContaining(['bind', 'waitfor', 'pause']));
    expect(data.members.object.props.map((p) => p.name)).toEqual(expect.arrayContaining(['pos', 'color', 'velocity', 'radius', 'size', 'axis']));
    expect(data.members.object.methods.map((m) => m.name)).toEqual(expect.arrayContaining(['rotate', 'clone']));
    expect(data.members.vector.props.map((p) => p.name)).toEqual(expect.arrayContaining(['x', 'y', 'z', 'mag']));
    expect(data.members.color.methods.map((m) => m.name)).toEqual(['hsv_to_rgb', 'rgb_to_hsv']);
  });

  it('docs.js의 함수 항목은 모두 완성 항목이 있고 한국어 설명을 쓴다', () => {
    const byName = new Map(data.api.map((it) => [it.name, it]));
    const sigRe = /^([\p{L}_][\p{L}\p{N}_]*)\(/u;
    let checked = 0;
    const seenNames = new Set();
    for (const doc of docs) {
      if (doc.id === 'math_functions') continue; // math 이름은 손으로 적은 목록(starter-snippets.js)에서 온다
      const m = sigRe.exec((doc.signature || '').split('\n')[0]);
      if (!m) continue;
      const item = byName.get(m[1]);
      expect(item, `${doc.id}: ${m[1]}`).toBeDefined();
      // 같은 이름으로 시작하는 서명이 둘이면(vector·custom-rgb) 먼저 나온 항목의 설명을 쓴다
      if (!seenNames.has(m[1])) expect(item.documentation, doc.id).toBe(doc.description.ko);
      seenNames.add(m[1]);
      checked++;
    }
    expect(checked).toBeGreaterThan(50);
    expect(byName.get('sphere').insertText).toBe('sphere(pos=${1:vector(0,0,0)}, radius=${2:1.0}, color=${3:color.white})$0');
    expect(byName.get('음표').insertText).toBe("음표(${1:'도4'}, duration=${2:0.5}, type=${3:'sine'}, volume=${4:0.4})$0");
    expect(byName.get('색상').detail).toBe('color의 별칭');
    expect(byName.get('vec').detail).toBe('vector와 같음');
    expect(byName.get('rainbow').detail).toBe('무지개와 같음');
    expect(byName.get('scene').kind).toBe('variable');
    expect(byName.get('note').kind).toBe('module');
    // 내부 이름은 들어가지 않는다
    for (const it of data.api) expect(it.name.startsWith('_'), it.name).toBe(false);
    expect(byName.has('NamedList')).toBe(false);
  });

  it('키워드 인자는 docs.js의 params에서 온다', () => {
    expect(data.kwargs.get('sphere').map((p) => p.name)).toEqual(expect.arrayContaining(['pos', 'radius', 'color']));
    expect(data.kwargs.get('box').find((p) => p.name === 'size').desc).toContain('크기');
    expect(data.kwargs.has('mag')).toBe(false); // 위치 인자뿐인 함수에는 키워드 인자를 제안하지 않는다
  });
});

// ───────── CPython으로 실제 모듈을 실행해 대조 ─────────
const DUMP_CODE = `
import json
g = 음표.__globals__
palette = g['_ColorPalette']
colors = [n for n in dir(palette) if not n.startswith('_') and isinstance(getattr(palette, n), g['vector'])]
tex = g['_TexturePresets']
lists = {}
for name in ['무지개', '파스텔', '따뜻한색', '차가운색', '기본색', '음계', '높은음계', '낮은음계']:
    obj = g[name]
    lists[name] = {'len': len(obj), 'names': list(obj._name_map.keys())}
scene_cls = type(scene)
scene_props = [n for n, v in vars(scene_cls).items() if isinstance(v, property) and not n.startswith('_')]
sphere_props = [n for n, v in vars(sphere).items() if isinstance(v, property) and not n.startswith('_')]
print(json.dumps({
    'colors': colors,
    'korean_colors': list(palette._name_map.keys()),
    'textures': sorted(n for n in dir(tex) if not n.startswith('_') and isinstance(getattr(tex, n), str)),
    'notes': list(g['_KOREAN_NOTE_MAP'].keys()),
    'instruments': list(g['_INSTRUMENT_KR'].keys()),
    'note_consts': {n: v for n, v in vars(g['note']).items() if not n.startswith('_')},
    'lists': lists,
    'scene_props': scene_props,
    'sphere_props': sphere_props,
    'public': sorted(n for n, v in g.items() if not n.startswith('_') and callable(v) and getattr(v, '__module__', None) in ('__vpylab_api__', None)),
}, ensure_ascii=False))
`;

describe.skipIf(!hasPython())('완성 데이터 (CPython 대조)', () => {
  const result = runPythonJobs([{ id: 'completion', label: 'dump', code: DUMP_CODE }]).get('completion:dump');
  if (!result?.ok) throw new Error(`vpython-api.py 실행 실패: ${result?.error}`);
  const actual = JSON.parse(result.stdout.trim().split('\n').pop());

  it('색 이름(영어·한글)이 실제 팔레트와 같다', () => {
    expect(data.colors.map((c) => c.name).sort()).toEqual([...actual.colors].sort());
    expect([...data.koreanColorNames.keys()]).toEqual(actual.korean_colors);
  });
  it('텍스처·음 이름·악기가 실제 모듈과 같다', () => {
    expect(data.textures.map((t) => t.name).sort()).toEqual(actual.textures);
    expect([...data.koreanNoteMap.keys()]).toEqual(actual.notes);
    expect(data.instruments.filter((i) => i.name !== i.english).map((i) => i.name)).toEqual(actual.instruments);
    expect(Object.fromEntries(data.noteConstants)).toEqual(actual.note_consts);
  });
  it('NamedList의 길이와 이름 키가 실제와 같다', () => {
    for (const [name, info] of Object.entries(actual.lists)) {
      const list = data.namedLists.find((l) => l.name === name);
      expect(list, name).toBeDefined();
      expect(list.items.length).toBe(info.len);
      expect([...list.names.keys()]).toEqual(info.names);
    }
  });
  it('scene·sphere 속성이 실제 클래스와 같다', () => {
    expect(data.members.scene.props.map((p) => p.name).sort()).toEqual([...actual.scene_props].sort());
    for (const name of actual.sphere_props) expect(data.members.object.props.map((p) => p.name)).toContain(name);
  });
  it('실제 모듈의 공개 함수·클래스는 모두 완성 항목에 있다', () => {
    const names = new Set(data.api.map((it) => it.name));
    const missing = actual.public.filter((n) => !names.has(n) && n !== 'NamedList');
    expect(missing).toEqual([]);
  });
});

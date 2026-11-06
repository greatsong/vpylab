import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { hasPython, runPythonJobs } from '../test/python-runner';
import { clearScene, getMesh, isEventBound, processBatch, registerCanvasScene } from './vpython-bridge';

const run = (code, events) => runPythonJobs([{ id: 'canvas', label: 'case', code: `from vpython import *\n${code}`, events }]).get('canvas:case');
const root = new THREE.Scene();
afterEach(() => { clearScene(root); document.body.replaceChildren(); vi.restoreAllMocks(); });

describe.skipIf(!hasPython())('독립된 VPython canvas', () => {
  it('생성·선택·명시적 canvas와 objects·카메라 값이 독립적이며 객체를 다른 캔버스로 옮긴다', () => {
    const r = run(`a=canvas(range=2)
b=canvas(range=5)
assert a is not b and a is not scene
assert canvas.get_selected() is b
x=sphere(canvas=a)
y=box()
assert x.canvas is a and y.canvas is b
assert a.objects == [x] and b.objects == [y] and scene.objects == []
a.select()
z=sphere()
assert z.canvas is a
assert a.range == 2 and b.range == 5
x.canvas=b
assert a.objects == [z] and b.objects == [x,y]
`);
    expect(r.error).toBeNull();
    const children = new Map();
    root._canvasHost = { create(cmd) { const child = new THREE.Scene(); children.set(cmd.canvas_id, child); registerCanvasScene(root, cmd.canvas_id, child); } };
    processBatch(r.commands, root);
    expect(getMesh('obj_1').parent).toBe(children.get('canvas_2'));
    expect(getMesh('obj_2').parent).toBe(children.get('canvas_2'));
    expect(getMesh('obj_3').parent).toBe(children.get('canvas_1'));
    clearScene(root);
    expect([...children.values()].every(scene => scene.children.length === 0)).toBe(true);
  });

  it('다른 화면의 같은 이름 이벤트는 해당 핸들러에만 전달된다', () => {
    const r = run(`a=canvas()
b=canvas()
def one(e):
    assert e.canvas is a
    print('one')
def two(e):
    assert e.canvas is b
    print('two')
a.bind('click',one)
b.bind('click',two)
`, [{ name: 'click', canvas_id: 'canvas_1' }, { name: 'click', canvas_id: 'canvas_2' }]);
    expect(r.error).toBeNull();
    expect(r.stdout).toBe('one\ntwo\n');
    root._canvasHost = { create: cmd => registerCanvasScene(root, cmd.canvas_id, new THREE.Scene()) };
    processBatch(r.commands, root);
    expect(isEventBound('click', 'canvas_1')).toBe(true);
    expect(isEventBound('click', 'scene')).toBe(false);
  });

  it('다른 캔버스를 선택한 뒤에도 명시한 제목·캡션 앵커로 글자와 위젯이 간다', () => {
    const r = run(`a=canvas()
b=canvas()
w=wtext(text='A title',pos=a.title_anchor)
button(text='A button',pos=a.caption_anchor)
w.text='A changed'
`.replace(/^\+/gm, ''));
    expect(r.error).toBeNull();
    expect(r.commands.filter(c => ['wtext_create','wtext_update','widget_create'].includes(c.action)).every(c => c.canvas_id === 'canvas_1')).toBe(true);
  });

  it('뷰포트가 늦게 준비되어도 명령을 보관하고 새 실행에서는 과거 큐를 버린다', () => {
    root._canvasHost = { create: vi.fn(), reset: vi.fn() };
    processBatch([{ action: 'canvas_create', canvas_id: 'canvas_1' }, { action: 'create', type: 'sphere', id: 'late', canvas_id: 'canvas_1' }], root);
    expect(getMesh('late')).toBeUndefined();
    const child = new THREE.Scene();
    registerCanvasScene(root, 'canvas_1', child);
    expect(getMesh('late').parent).toBe(child);
    clearScene(root);
    processBatch([{ action: 'create', type: 'sphere', id: 'next' }], root);
    expect(getMesh('next').parent).toBe(root);
  });

  it('위젯과 그래프는 각 화면에 놓이며 canvas.delete가 다른 화면의 객체를 지우지 않는다', () => {
    const ctx = Object.fromEntries(['scale','clearRect','fillRect','strokeRect','beginPath','moveTo','lineTo','stroke','fillText','arc','fill'].map(k => [k, vi.fn()]));
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx);
    for (const id of ['scene','canvas_1','canvas_2']) {
      const host = document.createElement('div'); host.dataset.vpylabCanvasId=id; host.dataset.vpylabViewport=''; document.body.append(host);
    }
    root._canvasHost = { create: cmd => registerCanvasScene(root, cmd.canvas_id, new THREE.Scene()), remove: vi.fn() };
    const r = run(`a=canvas()
sphere()
button(text='one')
graph()
b=canvas()
box()
button(text='two')
graph()
`);
    expect(r.error).toBeNull();
    processBatch(r.commands, root);
    for (const id of ['canvas_1','canvas_2']) {
      const host = document.querySelector(`[data-vpylab-canvas-id="${id}"]`);
      expect(host.querySelector('[data-vpylab-widgets] button')).toBeTruthy();
      expect(host.querySelector('[data-vpylab-graphs] canvas')).toBeTruthy();
    }
    const second = getMesh('obj_4');
    processBatch([{ action: 'scene', property: 'delete', canvas_id: 'canvas_1' }], root);
    expect(getMesh('obj_1')).toBeUndefined();
    expect(getMesh('obj_4')).toBe(second);
    expect(second.parent).toBeTruthy();
    expect(document.querySelector('[data-vpylab-canvas-id="canvas_2"] button')).toBeTruthy();
  });
});

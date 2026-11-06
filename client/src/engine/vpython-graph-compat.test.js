import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { hasPython, runPythonJobs } from '../test/python-runner';
import { clearGraphs2D } from './graph2d-system';
import { processBatch } from './vpython-bridge';

const run = code => runPythonJobs([{ id: 'graph', label: 'check', code: `from vpython import *\n${code}` }]).get('graph:check');

describe.skipIf(!hasPython())('VPython 그래프 호출·값·실제 Canvas 명령 호환', () => {
  let context;
  beforeEach(() => {
    context = Object.fromEntries(['scale', 'clearRect', 'fillRect', 'strokeRect', 'beginPath', 'moveTo', 'lineTo', 'stroke', 'fillText', 'arc', 'fill'].map(name => [name, vi.fn()]));
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context);
  });
  afterEach(() => { clearGraphs2D(); vi.restoreAllMocks(); });

  it('공식 plot 호출 형식들이 정확한 좌표로 전달되고 기존 x/y 목록 형식도 유지된다', () => {
    const result = run(`g = gcurve()
g.plot(1, 2)
g.plot(pos=(3, 4))
g.plot(data=[(5, 6), (7, 8)])
g.plot(9, 10, 11, 12)
g.plot([13, 14])
g.plot([(15, 16)])
g.plot([17, 19], [18, 20])
assert g.data == [[i, i+1] for i in range(1, 20, 2)]
`);
    expect(result.error).toBeNull();
    expect(result.commands.filter(c => c.action === 'graph_series_plot').flatMap(c => c.points))
      .toEqual(Array.from({ length: 10 }, (_, i) => [i * 2 + 1, i * 2 + 2]));
  });

  it('data 대입은 점을 교체하고 clear는 Python의 읽기 결과도 비운다', () => {
    const result = run(`g = gdots(data=[(1, 2)])
g.data = [(3, 4)]
copy = g.data
copy.append([5, 6])
assert g.data == [[3, 4]]
g.clear()
assert g.data == []
`);
    expect(result.error).toBeNull();
    expect(result.commands.filter(c => c.action === 'graph_series_clear')).toHaveLength(3);
  });

  it('점 반지름·색·숨김 변경이 Python 속성에만 머물지 않고 실제 렌더러에 반영된다', () => {
    const result = run(`g = gdots(radius=3, data=[(1, 2), (3, 4)])
assert g.radius == 3 and g.size == 6
g.radius = 5
g.color = color.green
g.visible = False
g.visible = True
`);
    expect(result.error).toBeNull();
    processBatch(result.commands, new THREE.Scene());
    expect(document.querySelector('[data-vpylab-graphs] canvas')).toBeTruthy();
    expect(context.arc.mock.calls.slice(-2).map(call => call[2])).toEqual([5, 5]);
    expect(context.fillStyle).toBe('rgb(0, 255, 0)');
  });

  it('잘못된 입력으로 일부 점만 들어가거나 기존 데이터가 사라지지 않는다', () => {
    const result = run(`g = gcurve(data=[(1, 2)])
for bad in [lambda: g.plot(1,2,3), lambda: g.plot(1,2,pos=(3,4)), lambda: g.plot([1,2],[3]), lambda: g.plot(data=[(3,4),(5,6,7)])]:
    try:
        bad()
    except (TypeError, ValueError):
        pass
    else:
        raise AssertionError('잘못된 입력을 받아들임')
assert g.data == [[1, 2]]
`);
    expect(result.error).toBeNull();
  });

  it('삭제한 그래프는 get_selected에서 제외하고 새 실행에서는 선택이 초기화된다', () => {
    const results = runPythonJobs([
      { id: 'first', label: 'selected', code: 'from vpython import *\na=graph()\nb=graph()\nassert graph.get_selected() is b\nb.delete()\nassert graph.get_selected() is a\na.delete()\nassert graph.get_selected() is None' },
      { id: 'second', label: 'selected', code: 'from vpython import *\nassert graph.get_selected() is None' },
    ]);
    for (const result of results.values()) expect(result.error).toBeNull();
  });
});

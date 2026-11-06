import { describe, expect, it } from 'vitest';
import { creativeLabs, shapeExtensions, getCreativeLab } from './creative-labs';
import { getTutorial } from './tutorials';
import { hasPython, runPythonJobs } from '../test/python-runner';

describe.skipIf(!hasPython())('창작 활동: 실행·수정·이벤트의 의미', () => {
  it('모든 단계와 제공 함수가 실제 API로 실행되며, 곡면은 바닥이 닫힌 삼각형 메시다', () => {
    const jobs = [...creativeLabs, ...shapeExtensions].flatMap(lab => (lab.variants || [{ id: 'base', code: lab.code }]).map(step => ({ id: lab.id, label: step.id, code: step.code })));
    const runs = runPythonJobs(jobs);
    for (const r of runs.values()) {
      expect(r.error, `${r.id}:${r.label}`).toBeNull();
      expect(r.stopped).toBe(false);
      expect(r.pendingTasks).toBe(0);
      expect(r.commands.filter(c => c.action === 'sound')).toHaveLength(0);
    }
    const mesh = runs.get('hemisphere:base').commands.filter(c => c.type === 'triangle');
    expect(mesh).toHaveLength(256);
    expect(mesh.flatMap(c => c.vertices).every(v => v.pos[1] >= -1e-12)).toBe(true);
    expect(mesh.filter(c => c.vertices.every(v => Math.abs(v.pos[1]) < 1e-12))).toHaveLength(16);
  });

  it('신호 단계에서 버튼을 눌러야 모양·빛·소리가 순서대로 추가된다', () => {
    const results = runPythonJobs(['shape', 'light', 'sound'].map(step => ({ id: step, label: 'press', code: getTutorial('signal-lab', step).code, events: [{ name: 'widget', widget: 'obj_2' }] })));
    for (const step of ['shape', 'light', 'sound']) {
      const result = results.get(`${step}:press`);
      expect(result.error).toBeNull();
      expect(result.commands.some(c => c.action === 'update' && c.radius === 0.9)).toBe(true);
      expect(result.commands.some(c => c.action === 'update' && c.emissive)).toBe(step !== 'shape');
      expect(result.commands.filter(c => c.action === 'sound')).toHaveLength(step === 'sound' ? 1 : 0);
    }
  });

  it('팀 신호는 버튼을 번갈아 눌러도 가로·세로 모양으로 구별되고 소리에 의존하지 않는다', () => {
    const result = runPythonJobs([{ id: 'team', label: 'buttons', code: getCreativeLab('team-signals').code, events: [{ name: 'widget', widget: 'obj_2' }, { name: 'widget', widget: 'obj_3' }, { name: 'widget', widget: 'obj_2' }] }]).get('team:buttons');
    expect(result.error).toBeNull();
    expect(result.commands.filter(c => c.action === 'update' && c.size).map(c => c.size)).toEqual([[1.8, 0.5, 0.5], [0.5, 1.8, 0.5], [1.8, 0.5, 0.5]]);
  });

  it('돔의 높이·해상도를 바꾸면 실제 표면과 면 수가 바뀌고 잘못된 크기는 거부된다', () => {
    const code = getTutorial('hemisphere').code;
    const result = runPythonJobs([{ id: 'dome', label: 'low', code: code.replace('\nmake_dome(radius=1, height=1, segments=16)', '\nmake_dome(radius=1, height=0.5, segments=4)') }]).get('dome:low');
    expect(result.error).toBeNull();
    const faces = result.commands.filter(c => c.type === 'triangle');
    expect(faces).toHaveLength(16);
    expect(Math.max(...faces.flatMap(c => c.vertices.map(v => v.pos[1])))).toBeCloseTo(0.5);
    const invalid = runPythonJobs([{ id: 'dome', label: 'invalid', code: code + '\nmake_dome(segments=1000)' }]).get('dome:invalid');
    expect(invalid.error).toContain('4~32');
  });
});

it('선택 활동과 단계는 기존 체험 조회를 통해 열리며 없는 단계는 시작 단계로 돌아간다', () => {
  expect(getTutorial('shape-lab').id).toBe('shape-lab');
  expect(getTutorial('signal-lab', 'missing').activeStep).toBe('shape');
  expect(getTutorial('hemisphere').supportCode).toContain('def make_dome');
});

import { describe, expect, it } from 'vitest';
import { tutorials, getTutorial } from './tutorials';
import { hasPython, runPythonJobs } from '../test/python-runner';

describe.skipIf(!hasPython())('기능 체험의 실제 Python API 실행', () => {
  it('네 체험과 안내한 수정이 오류 없이 끝난다', () => {
    const edits = {
      shape: code => code.replace('radius=0.5', 'radius=1'),
      'light-sound': code => code.replace('음표("도")', '음표("솔")'),
      motion: code => code.replace('vector(0.03, 0, 0)', 'vector(-0.03, 0, 0)'),
      interaction: code => code.replace("색상['노랑']", "색상['보라']") + '\n바꾸기(None)\n',
    };
    const jobs = tutorials.flatMap(item => [
      { id: item.id, label: 'base', code: item.code },
      { id: item.id, label: 'changed', code: edits[item.id](item.code) },
    ]);
    const runs = runPythonJobs(jobs);
    for (const run of runs.values()) {
      expect(run.error, `${run.id}:${run.label}`).toBeNull();
      expect(run.stopped).toBe(false);
      expect(run.pendingTasks).toBe(0);
    }
    expect(runs.get('shape:changed').commands.find(c => c.action === 'create').radius).toBe(1);
    expect(runs.get('light-sound:base').commands.find(c => c.action === 'sound').name).toBe('C4');
    expect(runs.get('light-sound:changed').commands.find(c => c.action === 'sound').name).toBe('G4');
    const movements = runs.get('motion:changed').commands.filter(c => c.action === 'update' && c.pos);
    expect(movements.at(-1).pos[0]).toBeCloseTo(-1.8);
    expect(runs.get('interaction:changed').commands.some(c => c.action === 'update' && c.color)).toBe(true);
  });
});

it('없는 체험 ID를 다른 체험으로 대체하지 않는다', () => {
  expect(getTutorial('missing')).toBeUndefined();
});

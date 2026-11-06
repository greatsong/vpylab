import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { glowscriptProjects } from './glowscript-projects';
import { hasPython, runPythonJobs } from '../test/python-runner';

const assets = join(dirname(fileURLToPath(import.meta.url)), '../../public/projects/glowscript');
const project = id => JSON.parse(readFileSync(join(assets, `${id}.json`), 'utf8'));

describe.skipIf(!hasPython())('보존 원본과 실행용 수정본의 원인별 회귀 검사', { timeout: 60000 }, () => {
  it('실행 가능으로 표시한 31개 전체가 Pyodide와 같은 Python 3.12 경로에서 초기 실행된다', () => {
    const jobs = glowscriptProjects.filter(item => item.pythonCheck === 'ready').map(item => ({
      id: item.id, label: 'all', code: project(item.id).code, rateLimit: 100,
    }));
    expect(jobs).toHaveLength(31);
    for (const result of runPythonJobs(jobs).values()) expect(result.error, result.id).toBeNull();
  });

  it('기본 range와 리스트 인덱스의 Python 규칙은 바뀌지 않는다', () => {
    const code = 'try:\n    range(0,1,0.1)\nexcept TypeError:\n    pass\nelse:\n    raise AssertionError("range가 변함")\ntry:\n    [1,2][1.0]\nexcept TypeError:\n    pass\nelse:\n    raise AssertionError("인덱스 규칙이 변함")';
    const result = runPythonJobs([{ id: 'python', label: 'strict', code }]).get('python:strict');
    expect(result.error).toBeNull();
  });

  it('다섯 원본의 오류는 재현되며 수정본은 해당 오류 없이 실행된다', () => {
    const ids = ['gs2024-01', 'gs2024-02', 'gs2024-06', 'gs2024-19', 'gs2024-21'];
    const jobs = ids.flatMap(id => {
      const item = project(id);
      const lines = item.source.split(/\r?\n/); lines[0] = 'from vpython import *';
      return [{ id, label: 'original', code: lines.join('\n'), rateLimit: 100 }, { id, label: 'adapted', code: item.code, rateLimit: 100 }];
    });
    const runs = runPythonJobs(jobs);
    for (const id of ids) {
      expect(runs.get(`${id}:original`).error).toBeTruthy();
      expect(runs.get(`${id}:adapted`).error, id).toBeNull();
    }
  });

  it('군집화는 실제 RUN 경로에서 초기 선택과 빈 군집·동률도 처리한다', () => {
    const code = project('gs2024-02').code;
    const cases = [0, 2, 17].map(seed => ({ id: String(seed), label: 'run', code: `import random\nrandom.seed(${seed})\n${code}\nrun_button()\n`, rateLimit: 4000 }));
    cases.push({ id: 'ties', label: 'run', code: `${code}\nc1.pos=vec(50,50,50)\nc2.pos=vec(50,50,50)\nc3.pos=vec(50,50,50)\nrun_button()\n`, rateLimit: 4000 });
    for (const result of runPythonJobs(cases).values()) {
      expect(result.error, result.id).toBeNull();
      expect(result.stopped).toBe(false);
      expect(result.stdout).toContain('Finished');
      expect(result.rateCalls).toBe(3240);
    }
  });

  it('과학 작품의 슬라이더 콜백은 수평속도를 실제로 바꾼다', () => {
    const code = project('gs2024-19').code.replace('while True :', 'for frame in range(2):');
    const result = runPythonJobs([{ id: 'slider', label: 'callback', code: code + '\nspeed_slider.value = 7\nspeed_f(speed_slider)\nassert ball2.v.x == 7\n' }]).get('slider:callback');
    expect(result.error).toBeNull();
  });

  it('테트리스는 벽 4개로 시작하며 키 입력 후 좌표를 정수로 조회한다', () => {
    const code = project('gs2024-21').code;
    const result = runPythonJobs([{ id: 'tetris', label: 'game', code: `import random\nrandom.seed(0)\n${code}\nclass Key:\n    key='left'\nkeyInput(Key())\n`, rateLimit: 200 }]).get('tetris:game');
    expect(result.error).toBeNull();
    expect(result.stdout).toContain('Game Over');
    expect(result.commands.filter(command => command.action === 'create')).toHaveLength(12);
  });
});

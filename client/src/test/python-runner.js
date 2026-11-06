/**
 * 테스트에서 학생 코드를 CPython으로 실행한다 (src/test/run-vpython.py).
 * Worker와 같은 경로(ast 변환 → 새 학생 전역에서 모듈 수준 실행 → 남은 태스크 대기)를 거치되
 * rate()/sleep()의 실제 대기는 가상 시계로 대체한다. python3가 없으면 hasPython()이 false다.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';

// vitest는 client/ 디렉터리에서 실행된다 (npm --prefix client run test:run)
const RUNNER = path.resolve(globalThis.process?.cwd?.() ?? '.', 'src/test/run-vpython.py');

// Pyodide 0.27과 같은 Python 3.12를 우선한다. 3.11은 randint(실수)를 받아 차이를 숨긴다.
const candidates = globalThis.process?.env?.VPYLAB_TEST_PYTHON
  ? [globalThis.process.env.VPYLAB_TEST_PYTHON] : ['python3.12', 'python3'];
const python = candidates.find(command => spawnSync(command, ['--version'], { encoding: 'utf8' }).status === 0);

export function hasPython() {
  return Boolean(python);
}

/**
 * 여러 코드를 한 번의 python3 호출로 실행
 * @param {{ id: string, label: string, code: string }[]} jobs - code는 학생 코드 그대로 (변환은 Python 쪽)
 * @returns {Map<string, object>} `${id}:${label}` → { ok, stopped, error, stdout, commands, heartbeats, pendingTasks }
 */
export function runPythonJobs(jobs) {
  const proc = spawnSync(python, ['-I', RUNNER], {
    input: JSON.stringify(jobs),
    encoding: 'utf8',
    maxBuffer: 1 << 28,
    timeout: 60000,
  });
  if (proc.status !== 0) {
    throw new Error(`run-vpython.py 실패:\n${proc.stderr}`);
  }
  const map = new Map();
  for (const result of JSON.parse(proc.stdout)) {
    map.set(`${result.id}:${result.label}`, result);
  }
  return map;
}

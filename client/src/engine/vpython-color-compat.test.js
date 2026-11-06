import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { runInNewContext } from 'node:vm';
import { generateStandaloneHTML } from '../utils/export-html';
import transform from './student-code-transform.py?raw';
import { hasPython, runPythonJobs } from '../test/python-runner';

const code = `from vpython import *
assert color.green == vector(0, 1, 0)
assert color.purple == vector(0.4, 0.2, 0.6)
assert 색상['초록'] == color.green
assert 색상['보라'] == color.purple
sphere(color=color.green)
sphere(color=color.purple)
`;

describe.skipIf(!hasPython())('공식 VPython 색상 상수와 공유 HTML 일치', () => {
  it('편집기와 실제 내려받는 HTML이 같은 공식 RGB 값을 사용한다', () => {
    const editor = runPythonJobs([{ id: 'colors', label: 'editor', code }]).get('colors:editor');
    expect(editor.error).toBeNull();
    const html = generateStandaloneHTML(code);
    const match = html.match(/const vpythonApi = (`[\s\S]*?`);/);
    expect(match).not.toBeNull();
    const api = runInNewContext(match[1]);
    const result = spawnSync('python3', ['-I', 'src/test/run-export-python.py'], {
      input: JSON.stringify({ api, transform, jobs: [{ id: 'colors', code }] }) + '\n',
      encoding: 'utf8', timeout: 15000,
    });
    expect(result.status, result.stderr).toBe(0);
    const exported = JSON.parse(result.stdout)[0];
    expect(exported.error).toBeNull();
    const colors = commands => commands.filter(c => c.action === 'create').map(c => c.color);
    expect(colors(editor.commands)).toEqual([[0, 1, 0], [0.4, 0.2, 0.6]]);
    expect(colors(exported.commands)).toEqual(colors(editor.commands));
  });
});

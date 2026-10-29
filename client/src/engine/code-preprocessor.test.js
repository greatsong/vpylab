/**
 * 학생 코드 변환기 테스트 — student-code-transform.py
 *
 * 변환은 Worker 안의 Python(ast)이 맡는다. 이 테스트는 같은 파일을 CPython으로 실행해
 * 변환 결과(ast.unparse)와 경고를 검사한다. 구조 문제(D1·D2)와 대기 함수(B2·B3·C3) 사례를 포함한다.
 * python3가 없는 환경에서는 건너뛴다 (CI는 Python 3.12를 설치한다).
 */
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const TRANSFORM = path.resolve(globalThis.process?.cwd?.() ?? '.', 'src/engine/student-code-transform.py');

const DRIVER = `
import json, sys, importlib.util
spec = importlib.util.spec_from_file_location('student_code_transform', sys.argv[1])
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
out = []
for source in json.loads(sys.stdin.read()):
    try:
        code, warnings = module.unparse_student_code(source)
        out.append({'code': code, 'warnings': warnings})
    except SyntaxError as exc:
        out.append({'syntaxError': f'{exc.msg} (line {exc.lineno})', 'filename': exc.filename})
sys.stdout.write(json.dumps(out, ensure_ascii=False))
`;

function findPython() {
  for (const candidate of ['python3.12', 'python3']) {
    const probe = spawnSync(candidate, ['-c', 'import sys; assert sys.version_info >= (3, 9)'], { encoding: 'utf8' });
    if (probe.status === 0) return candidate;
  }
  return null;
}

const python = findPython();

/** 여러 코드를 한 번의 python 호출로 변환한다 */
function transformAll(sources) {
  const proc = spawnSync(python, ['-I', '-c', DRIVER, TRANSFORM], { input: JSON.stringify(sources), encoding: 'utf8' });
  if (proc.status !== 0) throw new Error(`변환기 실행 실패:\n${proc.stderr}`);
  return JSON.parse(proc.stdout);
}

const transform = (source) => transformAll([source])[0];
const lines = (code) => code.split('\n').map((line) => line.trim()).filter(Boolean);

describe.skipIf(!python)('학생 코드 변환기 — 기본 변환', () => {
  it('rate()·sleep()·악기()·input()을 await로 바꾸고 모듈 수준에 둔다 (함수로 감싸지 않는다)', () => {
    const { code, warnings } = transform('rate(30)\nsleep(1)\n악기("피아노", "도")\nname = input("이름: ")');
    expect(lines(code)).toEqual(['await rate(30)', 'await sleep(1)', "await 악기('피아노', '도')", "name = await input('이름: ')"]);
    expect(code).not.toContain('async def __vpylab_main__');
    expect(warnings).toEqual([]);
  });

  it('import 문은 제자리에 남고 줄 순서가 바뀌지 않는다', () => {
    const { code } = transform('ball = sphere()\nimport math\nwhile True:\n    rate(30)\n    ball.pos = ball.pos + spd');
    expect(lines(code)).toEqual(['ball = sphere()', 'import math', 'while True:', 'await rate(30)', 'ball.pos = ball.pos + spd']);
  });

  it('이미 await가 있으면 중복하지 않는다', () => {
    const { code } = transform('await rate(30)\nasync def f():\n    await sleep(1)\nf()');
    expect(code).not.toContain('await await');
    expect(code).toContain('await f()');
  });

  it('문자열·주석 안의 rate()는 건드리지 않는다', () => {
    const { code } = transform('print("rate(30)")  # rate(30)\nx = """\nrate(1)\n"""\nprint(\'sleep(1)\')');
    expect(code).not.toContain('await');
  });

  it('time.sleep()·generate()·내악기()처럼 이름이 다른 호출은 바꾸지 않는다', () => {
    const { code } = transform('import time\ntime.sleep(1)\ngenerate(10)\n내악기(1)\nsleep(1)');
    expect(code).toContain('time.sleep(1)');
    expect(code).toContain('generate(10)');
    expect(code).toContain('내악기(1)');
    expect(code).toContain('await sleep(1)');
    expect(code).not.toContain('await time.sleep');
  });

  it('rate/sleep가 없는 코드는 그대로다', () => {
    expect(transform('x = 1\nprint(x)').code).toBe('x = 1\nprint(x)');
    expect(transform('').code).toBe('');
  });

  it('모듈 별칭(vp.rate)과 이름 별칭(from vpython import sleep as zz)도 인식한다 (D3)', () => {
    const { code } = transform('import vpython as vp\nfrom vpython import sleep as zz\nvp.rate(30)\nvp.scene.pause()\nzz(1)');
    expect(code).toContain('await vp.rate(30)');
    expect(code).toContain('await vp.scene.pause()');
    expect(code).toContain('await zz(1)');
  });

  it('SyntaxError는 학생 파일 이름과 줄 번호로 올라온다', () => {
    const result = transform('x = (\ny = 2');
    expect(result.syntaxError).toContain('line 1');
    expect(result.filename).toBe('<student>');
  });
});

describe.skipIf(!python)('D1 — 함수·메서드 안의 rate()', () => {
  it('rate()가 든 def를 async def로 바꾸고 호출에 await를 붙인다', () => {
    const { code, warnings } = transform('def step(n):\n    for i in range(n):\n        rate(50)\n        ball.pos += v*dt\nstep(20)');
    expect(code).toContain('async def step(n):');
    expect(code).toContain('await rate(50)');
    expect(code).toContain('await step(20)');
    expect(warnings).toEqual([]);
  });

  it('호출 그래프를 따라 전파한다 — rate()를 부르는 함수를 부르는 함수도 async', () => {
    const { code } = transform('def wait():\n    sleep(1)\ndef twice():\n    wait()\n    wait()\ndef nothing():\n    return 1\ntwice()\nnothing()');
    expect(code).toContain('async def wait():');
    expect(code).toContain('async def twice():');
    expect(code).toContain('await wait()');
    expect(code).toContain('await twice()');
    expect(code).toContain('def nothing():');
    expect(code).not.toContain('async def nothing');
    expect(code).toContain('\nnothing()');
  });

  it('중첩 함수도 바꾼다', () => {
    const { code } = transform('def outer():\n    def inner():\n        sleep(1)\n    inner()\n    return 1\nouter()');
    expect(code).toContain('async def outer():');
    expect(code).toContain('async def inner():');
    expect(code).toContain('await inner()');
    expect(code).toContain('await outer()');
  });

  it('클래스 메서드와 인스턴스·self 호출을 바꾼다', () => {
    const source = [
      'class Ball:',
      '    def __init__(self):',
      '        self.s = sphere()',
      '    def step(self):',
      '        rate(60)',
      '        self.helper()',
      '    def helper(self):',
      '        pass',
      '    def run(self):',
      '        self.step()',
      'b = Ball()',
      'b.run()',
      'for x in balls:',
      '    x.step()',
      'd = {}',
      'd.update(a=1)',
    ].join('\n');
    const { code } = transform(source);
    expect(code).toContain('async def step(self):');
    expect(code).toContain('async def run(self):');
    expect(code).toContain('await self.step()');
    expect(code).toContain('await b.run()');
    expect(code).toContain('await x.step()');
    expect(code).toContain('def helper(self):');
    expect(code).not.toContain('async def helper');
    expect(code).toContain('self.helper()');
    expect(code).not.toContain('await self.helper');
    expect(code).toContain('d.update(a=1)');
    expect(code).not.toContain('await d.update');
  });

  it('재귀와 rate(fps, callback) 형식(공식 예제 Bounce-Callbacks)을 처리한다', () => {
    const { code } = transform('def move():\n    rate(200, move)\n    ball.pos = ball.pos + 1\nmove()');
    expect(code).toContain('async def move():');
    expect(code).toContain('await rate(200, move)');
    expect(code).toContain('await move()');
  });

  it('데코레이터로 등록한 핸들러도 async가 된다', () => {
    const { code } = transform("@scene.bind('click')\ndef on_click(ev):\n    rate(10)");
    expect(code).toContain("@scene.bind('click')\nasync def on_click(ev):");
  });

  it('lambda 안의 rate()는 바꾸지 않고 경고한다', () => {
    const { code, warnings } = transform('f = lambda: rate(10)\nprint("ok")');
    expect(code).toContain('lambda: rate(10)');
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('lambda');
    expect(warnings[0]).toContain('1번 줄');
  });

  it('yield가 있는 함수와 __init__ 안의 rate()는 바꾸지 못하고 경고한다', () => {
    const gen = transform('def gen():\n    for i in range(3):\n        rate(1)\n        yield i');
    expect(gen.code).toContain('def gen():');
    expect(gen.code).not.toContain('async def');
    expect(gen.warnings[0]).toContain('yield');
    const init = transform('class A:\n    def __init__(self):\n        rate(1)');
    expect(init.code).not.toContain('async def');
    expect(init.warnings[0]).toContain('__init__');
  });

  it('학생이 같은 이름의 함수를 정의하면 그 함수로 본다', () => {
    const { code } = transform('def input(x):\n    return 5\ny = input(3)');
    expect(code).toContain('y = input(3)');
    expect(code).not.toContain('await');
  });
});

describe.skipIf(!python)('D2 — 모듈 전역과 global 선언', () => {
  it('프로그램을 함수로 감싸지 않으므로 global을 쓰는 함수가 그대로 남는다', () => {
    const { code } = transform('score = 0\ndef hit():\n    global score\n    score += 1\nfor i in range(3):\n    rate(60)\n    hit()');
    expect(lines(code)).toEqual(['score = 0', 'def hit():', 'global score', 'score += 1', 'for i in range(3):', 'await rate(60)', 'hit()']);
  });
});

describe.skipIf(!python)('B2·B3·C3 — scene.pause()·scene.waitfor()·input()', () => {
  it('scene.waitfor와 scene.pause 호출에 await를 붙이고, 그 안에 든 함수도 async로 바꾼다', () => {
    const { code } = transform("ev = scene.waitfor('click')\nscene.pause()\ndef wait_key():\n    return scene.waitfor('keydown')\nk = wait_key()");
    expect(code).toContain("ev = await scene.waitfor('click')");
    expect(code).toContain('await scene.pause()');
    expect(code).toContain('async def wait_key():');
    expect(code).toContain("return await scene.waitfor('keydown')");
    expect(code).toContain('k = await wait_key()');
  });

  it('scene을 다른 이름에 담아도 인식하고, 다른 객체의 pause()는 바꾸지 않는다', () => {
    const { code } = transform('s = scene\ns.pause()\nplayer.pause()');
    expect(code).toContain('await s.pause()');
    expect(code).toContain('\nplayer.pause()');
    expect(code).not.toContain('await player.pause');
  });

  it('input()은 키워드 인자 형식도 await를 붙이고, 함수 안이면 그 함수를 async로 바꾼다', () => {
    const { code } = transform("def ask():\n    return input(prompt='나이: ')\nage = ask()");
    expect(code).toContain('async def ask():');
    expect(code).toContain("return await input(prompt='나이: ')");
    expect(code).toContain('age = await ask()');
  });
});

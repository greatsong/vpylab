/**
 * 코드 전처리기 단위 테스트
 * rate()/sleep() → await 변환의 엣지 케이스 검증
 */
import { describe, it, expect } from 'vitest';
import { preprocessCode } from './code-preprocessor';

describe('preprocessCode', () => {
  // === 기본 변환 ===

  it('rate()를 await rate()로 변환한다', () => {
    const { code } = preprocessCode('rate(30)');
    expect(code).toContain('await rate(30)');
  });

  it('sleep()를 await sleep()로 변환한다', () => {
    const { code } = preprocessCode('sleep(1)');
    expect(code).toContain('await sleep(1)');
  });

  it('같은 줄에 rate()와 sleep()가 모두 있으면 둘 다 변환한다', () => {
    const input = 'rate(30)\nsleep(0.5)';
    const { code } = preprocessCode(input);
    expect(code).toContain('await rate(30)');
    expect(code).toContain('await sleep(0.5)');
  });

  it('변환 시 async def __vpylab_main__()으로 감싼다', () => {
    const { code } = preprocessCode('rate(30)');
    expect(code).toContain('async def __vpylab_main__():');
    expect(code).toContain('await __vpylab_main__()');
  });

  // === 스킵 조건 ===

  it('이미 await가 있으면 중복 변환하지 않는다', () => {
    const { code } = preprocessCode('await rate(30)');
    expect(code).not.toContain('await await');
  });

  it('문자열 내부의 rate()는 변환하지 않는다', () => {
    const { code } = preprocessCode('print("rate(30)")');
    expect(code).not.toContain('await rate');
    // async 래핑도 하지 않아야 함
    expect(code).not.toContain('async def __vpylab_main__');
  });

  it("작은따옴표 문자열 내부의 sleep()는 변환하지 않는다", () => {
    const { code } = preprocessCode("print('sleep(1)')");
    expect(code).not.toContain('await sleep');
  });

  it('주석 내부의 rate()는 변환하지 않는다', () => {
    const { code } = preprocessCode('x = 1 # rate(30) 호출');
    expect(code).not.toContain('await rate');
  });

  it('lambda 내부의 rate()는 변환하지 않고 경고를 출력한다', () => {
    const { warnings } = preprocessCode('f = lambda: rate(30)');
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0]).toContain('lambda');
  });

  // === 엣지 케이스 ===

  it('rate 앞에 다른 단어가 붙으면(예: generate) 변환하지 않는다', () => {
    const { code } = preprocessCode('generate(10)');
    expect(code).not.toContain('await generate');
  });

  it('여러 줄에 걸쳐 rate()가 있으면 모두 변환한다', () => {
    const input = 'rate(30)\nx += 1\nrate(60)';
    const { code } = preprocessCode(input);
    const matches = code.match(/await rate/g);
    expect(matches).toHaveLength(2);
  });

  it('rate 앞에 공백이 있어도 변환한다 (들여쓰기)', () => {
    const { code } = preprocessCode('    rate(30)');
    expect(code).toContain('await rate(30)');
  });

  it('rate()와 sleep() 사이에 공백이 있어도 변환한다', () => {
    const { code } = preprocessCode('rate  (30)');
    expect(code).toContain('await rate  (30)');
  });

  it('rate/sleep가 없는 코드는 async 래핑하지 않는다', () => {
    const { code } = preprocessCode('x = 1\nprint(x)');
    expect(code).not.toContain('async def');
    expect(code).toBe('x = 1\nprint(x)');
  });

  it('빈 코드를 처리한다', () => {
    const { code, warnings } = preprocessCode('');
    expect(code).toBe('');
    expect(warnings).toHaveLength(0);
  });

  // === import 분리 (P0 버그 수정) ===

  it('async 래핑 시 import문은 함수 바깥에 유지한다', () => {
    const input = 'from vpython import *\nrate(30)';
    const { code } = preprocessCode(input);
    // import문이 async def 앞에 있어야 함
    const importIdx = code.indexOf('from vpython import *');
    const asyncIdx = code.indexOf('async def __vpylab_main__');
    expect(importIdx).toBeLessThan(asyncIdx);
    // import문이 들여쓰기 되지 않아야 함
    expect(code).toContain('\nfrom vpython import *\n');
  });

  it('import math도 함수 바깥에 유지한다', () => {
    const input = 'import math\nfrom vpython import *\nrate(30)';
    const { code } = preprocessCode(input);
    expect(code.indexOf('import math')).toBeLessThan(code.indexOf('async def'));
    expect(code.indexOf('from vpython import *')).toBeLessThan(code.indexOf('async def'));
  });

  it('삼중 따옴표 문자열 내부의 rate()는 변환하지 않는다', () => {
    const input = '"""rate(30) 호출"""\nrate(60)';
    const { code } = preprocessCode(input);
    // 삼중따옴표 내 rate는 변환 안됨, 밖의 rate만 변환
    const matches = code.match(/await rate/g);
    expect(matches).toHaveLength(1);
    expect(code).toContain('await rate(60)');
  });
});

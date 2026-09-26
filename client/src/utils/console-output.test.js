/**
 * 콘솔 출력 누적 헬퍼 단위 테스트
 */
import { describe, it, expect } from 'vitest';
import { appendOutput, MAX_CONSOLE_LINES } from './console-output';

describe('appendOutput', () => {
  it('새 줄을 text/type과 함께 끝에 추가한다', () => {
    const next = appendOutput([], 'hello', 'log');
    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({ text: 'hello', type: 'log' });
  });

  it('이전 배열을 변경하지 않는다', () => {
    const prev = [{ text: 'a', type: 'log', id: 1 }];
    appendOutput(prev, 'b', 'log');
    expect(prev).toHaveLength(1);
  });

  it('최대 줄 수를 넘으면 오래된 줄부터 버린다', () => {
    let outputs = [];
    for (let i = 0; i < MAX_CONSOLE_LINES + 5; i++) {
      outputs = appendOutput(outputs, `line ${i}`, 'log');
    }
    expect(outputs).toHaveLength(MAX_CONSOLE_LINES);
    expect(outputs[0].text).toBe('line 5');
    expect(outputs[outputs.length - 1].text).toBe(`line ${MAX_CONSOLE_LINES + 4}`);
  });
});

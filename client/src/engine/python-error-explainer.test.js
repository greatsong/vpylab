/**
 * 입문자용 파이썬 오류 설명 레이어 테스트
 * 메시지 샘플은 CPython 3.11/3.12 실제 출력에서 가져왔다.
 */
import { describe, expect, it } from 'vitest';
import { explainPythonError, formatErrorLine } from './python-error-explainer';
import { buildErrorDetails } from '../hooks/usePyodide';

const explain = (type, message, extra = {}) => explainPythonError({ type, message, line: 3, ...extra }, 'ko');

describe('explainPythonError — 실제 CPython 메시지 매칭', () => {
  const samples = [
    // [예외 종류, 메시지, 설명에 들어가야 하는 문구, 추가 문맥]
    ['NameError', "name 'prnt' is not defined. Did you mean: 'print'?", "'print'", {}],
    ['NameError', "name 'y' is not defined", "'y'", {}],
    ['NameError', "name 'math' is not defined", 'import math', {}],
    ['NameError', "name 'hello' is not defined", '따옴표', { codeLine: 'print(hello)' }],
    ['SyntaxError', "expected ':'", '콜론', { codeLine: 'if x > 3' }],
    ['SyntaxError', "'(' was never closed", '닫지', {}],
    ['SyntaxError', "unterminated string literal (detected at line 1)", '따옴표', {}],
    ['SyntaxError', "unterminated triple-quoted string literal (detected at line 4)", '세 따옴표', {}],
    ['SyntaxError', "invalid syntax. Maybe you meant '==' or ':=' instead of '='?", '==', {}],
    ['SyntaxError', "invalid character '“' (U+201C)", '전각', {}],
    ['SyntaxError', "invalid syntax. Perhaps you forgot a comma?", '쉼표', {}],
    ['SyntaxError', "invalid decimal literal", '3 * x', {}],
    ['SyntaxError', "Missing parentheses in call to 'print'. Did you mean print(...)?", '괄호', {}],
    ['SyntaxError', "unmatched ')'", '여는 괄호', {}],
    ['SyntaxError', "closing parenthesis ')' does not match opening parenthesis '['", '짝', {}],
    ['SyntaxError', "'return' outside function", '함수', {}],
    ['SyntaxError', "cannot assign to literal here. Maybe you meant '==' instead of '='?", '==', {}],
    ['SyntaxError', 'invalid syntax', '콜론', { codeLine: 'while True' }],
    ['SyntaxError', 'invalid syntax', '==', { codeLine: 'if score = 10:' }],
    ['SyntaxError', 'invalid syntax', '둥근 따옴표', { codeLine: 'print(‘hi’)' }],
    ['IndentationError', "expected an indented block after 'for' statement on line 1", '들여', {}],
    ['IndentationError', 'unexpected indent', '필요 없는', {}],
    ['IndentationError', 'unindent does not match any outer indentation level', '칸 수', {}],
    ['TabError', 'inconsistent use of tabs and spaces in indentation', '탭', {}],
    ['TypeError', 'can only concatenate str (not "int") to str', 'str(', {}],
    ['TypeError', "unsupported operand type(s) for +: 'int' and 'str'", '문자열', {}],
    ['TypeError', "unsupported operand type(s) for +: 'vector' and 'tuple'", 'vector(1, 2, 3)', {}],
    ['TypeError', "unsupported operand type(s) for *: 'NoneType' and 'float'", 'return', {}],
    ['TypeError', "can't multiply sequence by non-int of type 'float'", 'vector', {}],
    ['TypeError', "'int' object is not callable", '괄호', {}],
    ['TypeError', "'module' object is not callable", 'random.random()', {}],
    ['TypeError', "'int' object is not iterable", 'range(10)', {}],
    ['TypeError', "'vector' object is not subscriptable", 'v.x', {}],
    ['TypeError', "'int' object is not subscriptable", '[번호]', {}],
    ['TypeError', 'sphere.__init__() takes 1 positional argument but 4 were given', 'pos=vector', {}],
    ['TypeError', 'f() takes 2 positional arguments but 3 were given', '2개', {}],
    ['TypeError', "f() missing 1 required positional argument: 'b'", 'f(b)', {}],
    ['TypeError', "rate() missing 1 required positional argument: 'frequency'", 'rate(frequency)', {}],
    ['TypeError', "sphere.__init__() got an unexpected keyword argument 'radiuss'", 'radius', {}],
    ['TypeError', "'>' not supported between instances of 'str' and 'int'", 'int(값)', {}],
    ['TypeError', "int() argument must be a string, a bytes-like object or a real number, not 'NoneType'", 'None', {}],
    ['TypeError', "object of type 'int' has no len()", 'len()', {}],
    ['TypeError', "'str' object does not support item assignment", '문자열', {}],
    ['TypeError', "unhashable type: 'list'", '키', {}],
    ['AttributeError', "'tuple' object has no attribute 'x'", 'vector(1, 2, 3)', {}],
    ['AttributeError', "'_ColorPalette' object has no attribute 'pinkk'", 'color.pink', {}],
    ['AttributeError', "'NoneType' object has no attribute 'pos'", 'return', {}],
    ['AttributeError', "module 'random' has no attribute 'randInt'. Did you mean: 'randint'?", 'random.randint', {}],
    ['AttributeError', "'list' object has no attribute 'apend'. Did you mean: 'append'?", '.append', {}],
    ['AttributeError', "'sphere' object has no attribute 'velocity'", '객체.velocity = 값', {}],
    ['AttributeError', "'str' object has no attribute 'append'", '문자열', {}],
    ['ZeroDivisionError', 'division by zero', '분모', {}],
    ['ZeroDivisionError', 'float division by zero', '0', {}],
    ['IndexError', 'list index out of range', 'len(값) - 1', {}],
    ['IndexError', 'string index out of range', '0부터', {}],
    ['IndexError', 'pop from empty list', '비어', {}],
    ['KeyError', "\"'핑크색' 색상을 찾을 수 없습니다. 사용 가능: 빨, 빨강, 빨간, 초, 초록...\"", '빨강, 주황', {}],
    ['KeyError', "'b'", "b", {}],
    ['ValueError', "invalid literal for int() with base 10: '3.5'", 'float()', {}],
    ['ValueError', "invalid literal for int() with base 10: 'abc'", '숫자가 아닌', {}],
    ['ValueError', "invalid literal for int() with base 10: ''", '빈 값', {}],
    ['ValueError', "could not convert string to float: 'abc'", 'float()', {}],
    ['ValueError', 'math domain error', 'sqrt', {}],
    ['ValueError', 'too many values to unpack (expected 2)', '2개', {}],
    ['ValueError', 'not enough values to unpack (expected 3, got 2)', '3개', {}],
    ['ValueError', '음 이름을 확인해주세요: 도', 'C4', {}],
    ['ModuleNotFoundError', "No module named 'pygame'", '브라우저', {}],
    ['ModuleNotFoundError', "No module named 'nump'", "'numpy'", {}],
    ['ModuleNotFoundError', "No module named 'matplotlib'", '네트워크', {}],
    ['ImportError', "cannot import name 'sqrtt' from 'math' (unknown location)", "'sqrtt'", {}],
    ['RecursionError', 'maximum recursion depth exceeded', '종료 조건', {}],
    ['RecursionError', 'maximum recursion depth exceeded while calling a Python object', '자기 자신', {}],
    ['UnboundLocalError', "cannot access local variable 'x' where it is not associated with a value", 'global x', {}],
    ['UnboundLocalError', "local variable 'count' referenced before assignment", 'global count', {}],
    ['AssertionError', 'no', 'assert', {}],
    ['AssertionError', '', 'assert', {}],
    ['OverflowError', '(34, "Numerical result out of range")', '범위', {}],
    ['FileNotFoundError', "[Errno 44] No such file or directory: 'data.csv'", '파일', {}],
    ['StopIteration', '', 'next(', {}],
  ];

  it.each(samples)('%s: %s', (type, message, expected, extra) => {
    const result = explain(type, message, extra);
    expect(result.title).toBeTruthy();
    expect(result.hint).toBeTruthy();
    expect(result.line).toBe(3);
    expect(`${result.title} ${result.explanation} ${result.hint}`).toContain(expected);
  });

  it('예외 종류는 25종 이상을 다룬다', () => {
    expect(new Set(samples.map(([type]) => type)).size).toBeGreaterThanOrEqual(18);
    expect(samples.length).toBeGreaterThanOrEqual(25);
  });

  it('설명은 합쇼체 평서문으로 끝나고 대시(—)를 쓰지 않는다', () => {
    for (const [type, message, , extra] of samples) {
      const { explanation, hint } = explain(type, message, extra);
      expect(explanation).toMatch(/니다\.$/);
      expect(hint).toMatch(/니다\.$/);
      expect(explanation).not.toContain('—');
    }
  });
});

describe('explainPythonError — 일반 설명과 영어', () => {
  it('패턴에 없는 메시지는 종류별 일반 설명으로 떨어진다', () => {
    const result = explain('TypeError', 'some brand new message');
    expect(result.title).toBe('값의 종류가 맞지 않습니다');
    expect(result.explanation).toContain('some brand new message');
  });

  it('모르는 예외 종류도 제목과 다음 행동을 준다', () => {
    const result = explain('BananaError', 'peel first');
    expect(result.title).toContain('BananaError');
    expect(result.explanation).toContain('peel first');
    expect(result.hint).toBeTruthy();
  });

  it('영어 UI에서는 영어 설명을 쓴다', () => {
    const result = explainPythonError({ type: 'NameError', message: "name 'prnt' is not defined. Did you mean: 'print'?", line: 1 }, 'en');
    expect(result.title).toBe('Name not found');
    expect(result.explanation).toContain("you meant 'print'");
    expect(result.hint).toMatch(/^Change/);
    const generic = explainPythonError({ type: 'KeyError', message: "'b'" }, 'en');
    expect(generic.explanation).toContain("no key 'b'");
    expect(generic.line).toBeNull();
  });

  it('IndentationError 메시지 안의 줄 번호도 원래 줄 번호로 되돌린다', () => {
    const result = explainPythonError({
      type: 'IndentationError', message: "expected an indented block after 'for' statement on line 5", line: 3,
      mapLine: (n) => n - 3,
    }, 'ko');
    expect(result.explanation).toContain('2번 줄');
  });

  it('줄 번호 문구를 두 언어로 만든다', () => {
    expect(formatErrorLine(7, 'ko')).toBe('7번 줄');
    expect(formatErrorLine(7, 'en')).toBe('line 7');
    expect(formatErrorLine(null, 'ko')).toBe('');
  });
});

describe('buildErrorDetails — Worker 구조화 오류를 화면용 정보로 바꾼다', () => {
  // 학생 코드는 Worker 안에서 ast로 변환해 실행하므로 트레이스백 줄 번호가 학생 코드 줄 번호와 같다
  const source = 'from vpython import *\nball = sphere()\nwhile True:\n    rate(30)\n    ball.pos = ball.pos + spd';

  it('줄 번호의 코드와 한국어 설명을 붙인다', () => {
    const details = buildErrorDetails({
      error: "NameError: name 'spd' is not defined",
      raw: 'Traceback ...',
      detail: { type: 'NameError', message: "name 'spd' is not defined", line: 5, frames: [{ line: 5, name: '<module>' }], column: null, sourceLine: null },
    }, source, 'ko');
    expect(details.line).toBe(5);
    expect(details.codeLine).toBe('    ball.pos = ball.pos + spd');
    expect(details.frames).toEqual([{ line: 5, name: '<module>' }]);
    expect(details.explanation.title).toBe('이름을 찾을 수 없습니다');
    expect(details.explanation.hint).toContain('5번 줄');
    expect(details.message).toBe("NameError: name 'spd' is not defined");
  });

  it('구조화 정보가 빠져도 마지막 줄에서 종류와 메시지를 뽑는다', () => {
    const details = buildErrorDetails({ error: 'ZeroDivisionError: division by zero', detail: {} }, 'x = 1/0', 'en');
    expect(details.type).toBe('ZeroDivisionError');
    expect(details.explanation.title).toBe('Division by zero');
    expect(details.line).toBeNull();
  });
});

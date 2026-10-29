/**
 * 입문자용 파이썬 오류 설명 레이어
 *
 * Worker가 구조화해 보낸 예외(종류·메시지·줄 번호·해당 줄 코드)를 받아
 * 한국어(또는 영어) 설명과 다음 행동 한 줄을 만든다.
 * 메시지 패턴은 정규식 표(RULES)로 두고, 맞는 패턴이 없으면 종류별 일반 설명으로 떨어진다.
 *
 * GlowScript(untrusted/run.js)의 "At or near line N: <원래 줄>" 방식을 따라
 * 줄 번호와 함께 학생이 쓴 그 줄의 코드를 설명에 포함한다.
 */

const VPYTHON_OBJECTS = new Set([
  'sphere', 'box', 'cylinder', 'arrow', 'cone', 'ring', 'helix', 'pyramid', 'ellipsoid',
  'label', 'text', 'curve', 'points', 'compound', 'extrusion', 'vertex', 'triangle', 'quad',
  'graph', 'gcurve', 'gdots', 'gvbars', 'ghbars', 'slider', 'button', 'checkbox', 'radio', 'menu', 'winput',
  'local_light', 'distant_light',
]);

const MODULE_HINTS = {
  math: 'import math', random: 'import random', time: 'import time', np: 'import numpy as np',
  numpy: 'import numpy', pd: 'import pandas as pd', json: 'import json', sys: 'import sys',
};

const INSTALLABLE = ['numpy', 'pandas', 'matplotlib', 'scipy', 'sympy', 'sklearn'];
const STDLIB_SAMPLES = ['math', 'random', 'time', 'json', 'statistics', 'itertools', 'collections', 'datetime'];
const KNOWN_MODULES = [...INSTALLABLE, ...STDLIB_SAMPLES, 'vpython', 'js', 'os', 'sys', 're', 'csv', 'copy', 'functools'];

const COLOR_NAMES_KO = '빨강, 주황, 노랑, 초록, 파랑, 남색, 보라, 분홍, 하늘, 청록, 연두, 민트, 갈색, 금색, 은색, 회색, 흰색, 검정';
const COLOR_NAMES_EN = 'red, orange, yellow, green, blue, navy, purple, pink, skyblue, cyan, lime, mint, brown, gold, silver, gray, white, black';

const TITLES = {
  NameError: { ko: '이름을 찾을 수 없습니다', en: 'Name not found' },
  SyntaxError: { ko: '문법이 맞지 않습니다', en: 'Syntax problem' },
  IndentationError: { ko: '들여쓰기가 맞지 않습니다', en: 'Indentation problem' },
  TabError: { ko: '탭과 공백이 섞였습니다', en: 'Tabs mixed with spaces' },
  TypeError: { ko: '값의 종류가 맞지 않습니다', en: 'Type mismatch' },
  AttributeError: { ko: '그런 속성이 없습니다', en: 'Attribute not found' },
  ZeroDivisionError: { ko: '0으로 나누었습니다', en: 'Division by zero' },
  IndexError: { ko: '순서 번호가 범위를 벗어났습니다', en: 'Index out of range' },
  KeyError: { ko: '그런 이름(키)이 없습니다', en: 'Key not found' },
  ValueError: { ko: '값이 올바르지 않습니다', en: 'Invalid value' },
  ImportError: { ko: '가져올 수 없습니다', en: 'Import failed' },
  ModuleNotFoundError: { ko: '모듈을 찾을 수 없습니다', en: 'Module not found' },
  RecursionError: { ko: '함수가 자기 자신을 너무 많이 불렀습니다', en: 'Too much recursion' },
  UnboundLocalError: { ko: '함수 안에서 변수를 쓰기 전에 사용했습니다', en: 'Local variable used before assignment' },
  AssertionError: { ko: 'assert 조건이 거짓입니다', en: 'Assertion failed' },
  OverflowError: { ko: '숫자가 너무 커졌습니다', en: 'Number too large' },
  FileNotFoundError: { ko: '파일을 찾을 수 없습니다', en: 'File not found' },
  StopIteration: { ko: '더 꺼낼 값이 없습니다', en: 'Nothing left to iterate' },
  MemoryError: { ko: '메모리가 부족합니다', en: 'Out of memory' },
  RuntimeError: { ko: '실행 중 오류가 났습니다', en: 'Runtime error' },
};

const GENERIC = {
  NameError: {
    ko: (m) => ({ explanation: `${m.name ? `'${m.name}'이라는 ` : ''}변수나 함수를 파이썬이 알지 못합니다. 아직 만들지 않았거나, 철자나 대소문자가 다르거나, 만든 줄보다 먼저 사용했을 때 생깁니다.`, hint: '이 이름을 처음 만든 줄이 이 줄보다 위에 있는지, 철자가 같은지 확인합니다.' }),
    en: (m) => ({ explanation: `Python does not know ${m.name ? `'${m.name}'` : 'this name'}. It is not created yet, spelled differently, or used before the line that creates it.`, hint: 'Check that the line creating this name is above this line and spelled the same way.' }),
  },
  SyntaxError: {
    ko: () => ({ explanation: '이 줄을 파이썬 문법대로 읽을 수 없습니다. 괄호나 따옴표가 짝이 맞지 않거나, 쉼표나 콜론(:)이 빠졌거나, 영어가 아닌 기호가 섞였을 때 생깁니다.', hint: '이 줄과 바로 위 줄의 괄호·따옴표·쉼표·콜론을 확인합니다.' }),
    en: () => ({ explanation: 'Python cannot read this line. Usually a bracket or quote is unbalanced, a comma or colon is missing, or a non-ASCII symbol slipped in.', hint: 'Check brackets, quotes, commas and colons on this line and the line above.' }),
  },
  IndentationError: {
    ko: () => ({ explanation: '들여쓰기 칸 수가 맞지 않습니다. 파이썬은 줄 앞의 공백으로 블록을 구분합니다.', hint: '같은 블록의 줄은 공백 4칸씩 같은 깊이로 맞춥니다.' }),
    en: () => ({ explanation: 'The indentation does not line up. Python uses leading spaces to group lines into blocks.', hint: 'Indent every line of the same block by the same 4 spaces.' }),
  },
  TabError: {
    ko: () => ({ explanation: '들여쓰기에 탭과 공백이 섞여 있습니다. 파이썬은 둘을 다른 것으로 봅니다.', hint: '줄 앞의 공백을 지우고 스페이스 4칸으로 다시 들여씁니다.' }),
    en: () => ({ explanation: 'Indentation mixes tabs and spaces. Python treats them differently.', hint: 'Delete the leading whitespace and re-indent with 4 spaces.' }),
  },
  TypeError: {
    ko: (m) => ({ explanation: `서로 맞지 않는 종류의 값을 함께 사용했습니다. 파이썬 메시지는 "${m.message}"입니다.`, hint: '이 줄에서 숫자·문자열·리스트·vector가 올바른 자리에 있는지 확인합니다.' }),
    en: (m) => ({ explanation: `Values of incompatible types were used together. (${m.message})`, hint: 'Check that numbers, strings, lists and vectors are in the right places on this line.' }),
  },
  AttributeError: {
    ko: (m) => ({ explanation: `값에 없는 속성이나 메서드를 사용했습니다. 파이썬 메시지는 "${m.message}"입니다.`, hint: '점(.) 뒤의 이름 철자와 점 앞 값의 종류를 확인합니다.' }),
    en: (m) => ({ explanation: `The value has no such attribute or method. (${m.message})`, hint: 'Check the spelling after the dot and the type of the value before it.' }),
  },
  ZeroDivisionError: {
    ko: () => ({ explanation: '어떤 수를 0으로 나누었습니다. 나누는 값(분모)이 0이 되는 순간이 있습니다.', hint: '나누기 전에 분모가 0이 아닌지 if문으로 확인하거나, 분모의 초기값을 바꿉니다.' }),
    en: () => ({ explanation: 'A number was divided by zero. The divisor becomes 0 at some point.', hint: 'Check the divisor with an if statement before dividing, or change its starting value.' }),
  },
  IndexError: {
    ko: () => ({ explanation: '리스트나 문자열의 길이보다 큰 순서 번호를 사용했습니다. 순서 번호는 0부터 시작하고 마지막은 len(값) - 1입니다.', hint: '순서 번호가 0 이상 len(값) - 1 이하인지 확인하고, 반복문이면 range(len(값))을 사용합니다.' }),
    en: () => ({ explanation: 'The index is larger than the list or string. Indexes start at 0 and the last one is len(value) - 1.', hint: 'Keep the index between 0 and len(value) - 1; in loops use range(len(value)).' }),
  },
  KeyError: {
    ko: (m) => ({ explanation: `딕셔너리에 ${m.key ? `'${m.key}'라는 ` : '그 '}키가 없습니다.`, hint: '키 철자를 확인하거나, 값.get(키, 기본값)으로 읽거나, "키 in 값"으로 먼저 확인합니다.' }),
    en: (m) => ({ explanation: `The dictionary has no key ${m.key ? `'${m.key}'` : 'like that'}.`, hint: 'Check the spelling, use value.get(key, default), or test "key in value" first.' }),
  },
  ValueError: {
    ko: (m) => ({ explanation: `값의 종류는 맞지만 내용이 올바르지 않습니다. 파이썬 메시지는 "${m.message}"입니다.`, hint: '함수에 넣은 값이 허용되는 범위와 형식인지 확인합니다.' }),
    en: (m) => ({ explanation: `The type is right but the content is not acceptable. (${m.message})`, hint: 'Check that the value passed is in the allowed range and format.' }),
  },
  ImportError: {
    ko: (m) => ({ explanation: `가져오기에 실패했습니다. 파이썬 메시지는 "${m.message}"입니다.`, hint: 'import 뒤의 모듈 이름과 from ... import 뒤의 이름 철자를 확인합니다.' }),
    en: (m) => ({ explanation: `The import failed. (${m.message})`, hint: 'Check the module name after import and the names after from ... import.' }),
  },
  RecursionError: {
    ko: () => ({ explanation: '함수가 자기 자신을 끝없이 호출했습니다. 멈추는 조건이 없거나 그 조건에 도달하지 못합니다.', hint: '함수 맨 앞에 "if 조건: return 값" 같은 종료 조건을 두고, 호출할 때마다 조건에 가까워지는지 확인합니다.' }),
    en: () => ({ explanation: 'A function kept calling itself. There is no base case, or it is never reached.', hint: 'Put a base case like "if condition: return value" at the top and make sure each call moves toward it.' }),
  },
  UnboundLocalError: {
    ko: (m) => ({ explanation: `함수 안에서 '${m.name || '변수'}'에 값을 넣는 줄이 있어서 파이썬이 이 변수를 함수 안의 지역 변수로 봅니다. 그런데 값을 넣기 전에 먼저 읽었습니다.`, hint: `함수 밖의 변수를 바꾸려면 함수 첫 줄에 "global ${m.name || '변수'}"를 적고, 아니면 함수 안에서 먼저 값을 만듭니다.` }),
    en: (m) => ({ explanation: `'${m.name || 'The variable'}' is assigned inside the function, so Python treats it as local, but it is read before any value is assigned.`, hint: `Add "global ${m.name || 'name'}" as the first line of the function, or assign it inside the function first.` }),
  },
  AssertionError: {
    ko: (m) => ({ explanation: `assert 뒤의 조건이 거짓이었습니다.${m.message ? ` 메시지는 "${m.message}"입니다.` : ''}`, hint: '조건에 들어가는 값을 print로 찍어 보고, 조건이나 계산을 고칩니다.' }),
    en: (m) => ({ explanation: `The condition after assert was false.${m.message ? ` (${m.message})` : ''}`, hint: 'Print the values used in the condition and fix the condition or the calculation.' }),
  },
  OverflowError: {
    ko: () => ({ explanation: '계산 결과가 파이썬 실수가 표현할 수 있는 범위를 넘었습니다. 거듭제곱이나 반복 곱셈이 커졌을 때 생깁니다.', hint: '값이 커지는 반복에 상한을 두거나, 지수와 곱하는 횟수를 줄입니다.' }),
    en: () => ({ explanation: 'The result is larger than a Python float can hold, usually from powers or repeated multiplication.', hint: 'Cap the growing value or reduce the exponent and the number of multiplications.' }),
  },
  FileNotFoundError: {
    ko: () => ({ explanation: '브라우저 안의 파이썬에는 컴퓨터의 파일이 없습니다. 그 경로의 파일을 찾을 수 없습니다.', hint: '파일 대신 코드 안에 데이터를 리스트나 문자열로 직접 적습니다.' }),
    en: () => ({ explanation: 'Python in the browser cannot see files on your computer, so the path was not found.', hint: 'Put the data directly in the code as a list or string instead of reading a file.' }),
  },
  StopIteration: {
    ko: () => ({ explanation: 'next()로 꺼낼 값이 더 없습니다.', hint: 'for문으로 반복하거나 next(값, 기본값)으로 기본값을 줍니다.' }),
    en: () => ({ explanation: 'next() has nothing left to return.', hint: 'Use a for loop or next(value, default).' }),
  },
  MemoryError: {
    ko: () => ({ explanation: '리스트나 객체를 너무 많이 만들어 브라우저 메모리가 부족합니다.', hint: '반복문 안에서 만드는 객체와 리스트 항목 수를 줄입니다.' }),
    en: () => ({ explanation: 'Too many lists or objects were created and the browser ran out of memory.', hint: 'Create fewer objects inside loops.' }),
  },
  default: {
    ko: (m) => ({ explanation: `${m.type} 오류가 발생했습니다.${m.message ? ` 파이썬 메시지는 "${m.message}"입니다.` : ''}`, hint: '오류 메시지의 낱말을 검색해 보거나, 이 줄의 값을 print로 확인합니다.' }),
    en: (m) => ({ explanation: `A ${m.type} occurred.${m.message ? ` Message: ${m.message}` : ''}`, hint: 'Search the error message, or print the values used on this line.' }),
  },
};

/** 괄호 이름 */
const BRACKET_KO = { '(': '소괄호 (', '[': '대괄호 [', '{': '중괄호 {' };
const CLOSE_OF = { '(': ')', '[': ']', '{': '}' };

function stripQuotes(text) {
  if (!text) return '';
  const first = text[0];
  const last = text[text.length - 1];
  if (text.length >= 2 && ((first === '"' && last === '"') || (first === "'" && last === "'"))) return text.slice(1, -1);
  return text;
}

function editDistance(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return dp[a.length][b.length];
}

function closest(name, candidates) {
  let best = null;
  let bestDistance = 3;
  for (const candidate of candidates) {
    const distance = editDistance(name.toLowerCase(), candidate.toLowerCase());
    if (distance < bestDistance) { best = candidate; bestDistance = distance; }
  }
  return best;
}

/** 'sphere.__init__()' → 'sphere()' 처럼 함수 이름을 보기 좋게 정리 */
function cleanFunctionName(raw) {
  return String(raw || '').replace(/\.__init__$/, '').replace(/\(\)$/, '');
}

function blockKeywordWithoutColon(codeLine) {
  if (!codeLine) return false;
  const stripped = codeLine.replace(/#.*$/, '').trimEnd();
  return /^\s*(if|elif|else|while|for|def|class|try|except|finally|with)\b/.test(stripped) && !stripped.endsWith(':');
}

/**
 * 메시지 패턴 표. 위에서부터 첫 번째로 맞는 규칙을 사용한다.
 * 각 규칙의 ko/en은 (정규식 매치, 문맥) → { explanation, hint, title? }
 */
const RULES = [
  // === NameError ===
  {
    type: 'NameError', pattern: /^name '(.+?)' is not defined\. Did you mean: '(.+?)'\?/,
    ko: (m) => ({ explanation: `'${m[1]}'이라는 이름이 없습니다. 철자가 비슷한 '${m[2]}'를 쓰려던 것으로 보입니다.`, hint: `'${m[1]}'을 '${m[2]}'로 고칩니다.` }),
    en: (m) => ({ explanation: `There is no name '${m[1]}'. It looks like you meant '${m[2]}'.`, hint: `Change '${m[1]}' to '${m[2]}'.` }),
  },
  {
    type: 'NameError', pattern: /^name '(.+?)' is not defined/, when: (m) => Boolean(MODULE_HINTS[m[1]]),
    ko: (m) => ({ explanation: `'${m[1]}' 모듈을 아직 가져오지 않았습니다. 모듈은 import 문으로 가져온 뒤에 사용할 수 있습니다.`, hint: `코드 맨 위에 "${MODULE_HINTS[m[1]]}"를 추가합니다.` }),
    en: (m) => ({ explanation: `The module '${m[1]}' has not been imported yet. Modules must be imported before use.`, hint: `Add "${MODULE_HINTS[m[1]]}" at the top of the code.` }),
  },
  {
    // print(hello) 처럼 따옴표 없이 글자를 그대로 쓴 경우
    type: 'NameError', pattern: /^name '(.+?)' is not defined/, when: (m, ctx) => new RegExp(`^\\s*print\\(\\s*${escapeRegExp(m[1])}\\s*\\)`).test(ctx.codeLine || ''),
    ko: (m) => ({ explanation: `'${m[1]}'이라는 변수가 없습니다. 글자 그대로 출력하거나 비교하려면 따옴표로 감싸 문자열로 만들어야 합니다.`, hint: `문자열이면 "${m[1]}"처럼 따옴표를 붙이고, 변수면 먼저 ${m[1]} = 값 으로 만듭니다.` }),
    en: (m) => ({ explanation: `There is no variable '${m[1]}'. To use it as text, wrap it in quotes to make a string.`, hint: `Write "${m[1]}" with quotes for text, or create the variable first with ${m[1]} = value.` }),
  },
  {
    type: 'NameError', pattern: /^name '(.+?)' is not defined/,
    ko: (m, ctx) => ({ explanation: `'${m[1]}'이라는 변수나 함수를 파이썬이 알지 못합니다. 아직 만들지 않았거나, 철자나 대소문자가 다르거나, 만든 줄보다 먼저 사용했을 때 생깁니다.`, hint: `${ctx.line ? `${ctx.line}번 줄보다 ` : ''}위쪽에 "${m[1]} = 값" 또는 "def ${m[1]}():"가 있는지, 철자가 같은지 확인합니다.` }),
    en: (m, ctx) => ({ explanation: `Python does not know '${m[1]}'. It is not created yet, spelled differently, or used before the line that creates it.`, hint: `Check for "${m[1]} = value" or "def ${m[1]}():" above ${ctx.line ? `line ${ctx.line}` : 'this line'} with the same spelling.` }),
  },

  // === SyntaxError ===
  {
    type: 'SyntaxError', pattern: /^'([([{])' was never closed/,
    ko: (m) => ({ explanation: `${BRACKET_KO[m[1]]} 를 열고 닫지 않았습니다. 닫는 ${CLOSE_OF[m[1]]} 가 빠졌거나 줄이 끊겼습니다.`, hint: `이 줄 끝에 ${CLOSE_OF[m[1]]} 를 추가하고, 여는 괄호와 닫는 괄호 수가 같은지 셉니다.` }),
    en: (m) => ({ explanation: `A '${m[1]}' was opened but never closed. The matching '${CLOSE_OF[m[1]]}' is missing.`, hint: `Add '${CLOSE_OF[m[1]]}' at the end of this line and count opening and closing brackets.` }),
  },
  {
    type: 'SyntaxError', pattern: /^unmatched '([)\]}])'/,
    ko: (m) => ({ explanation: `닫는 ${m[1]} 는 있는데 짝이 되는 여는 괄호가 없습니다. 괄호를 하나 더 닫았습니다.`, hint: `이 줄에서 ${m[1]} 하나를 지우거나 앞쪽에 여는 괄호를 넣습니다.` }),
    en: (m) => ({ explanation: `A closing '${m[1]}' has no matching opening bracket. One bracket too many was closed.`, hint: `Remove one '${m[1]}' on this line or add the opening bracket before it.` }),
  },
  {
    type: 'SyntaxError', pattern: /^closing parenthesis '(.)' does not match opening parenthesis '(.)'/,
    ko: (m) => ({ explanation: `여는 괄호 ${m[2]} 를 ${m[1]} 로 닫았습니다. 괄호는 같은 종류끼리 짝을 맞춰야 합니다.`, hint: `${m[1]} 를 ${CLOSE_OF[m[2]] || '짝이 맞는 괄호'} 로 바꿉니다.` }),
    en: (m) => ({ explanation: `'${m[2]}' was closed with '${m[1]}'. Brackets must be closed with the same kind.`, hint: `Change '${m[1]}' to '${CLOSE_OF[m[2]] || 'the matching bracket'}'.` }),
  },
  {
    type: 'SyntaxError', pattern: /^unterminated (triple-quoted )?string literal/,
    ko: (m) => ({ explanation: m[1] ? '세 따옴표(""" 또는 \'\'\')로 연 문자열을 닫지 않았습니다.' : '따옴표로 연 문자열을 같은 줄에서 닫지 않았습니다. 문자열은 여는 따옴표와 같은 따옴표로 끝나야 합니다.', hint: m[1] ? '문자열 끝에 같은 세 따옴표를 추가합니다.' : '문자열 끝에 같은 따옴표를 추가하고, 작은따옴표와 큰따옴표를 섞지 않았는지 확인합니다.' }),
    en: (m) => ({ explanation: m[1] ? 'A triple-quoted string was opened but not closed.' : 'A string was opened but not closed on the same line. A string must end with the same quote it started with.', hint: m[1] ? 'Add the same triple quotes at the end of the string.' : 'Add the matching quote at the end and do not mix single and double quotes.' }),
  },
  {
    type: 'SyntaxError', pattern: /^invalid character '(.)' \(U\+([0-9A-F]{4})\)/,
    ko: (m) => ({ title: '영어 기호가 아닌 글자가 섞였습니다', explanation: `'${m[1]}' (U+${m[2]})는 파이썬이 쓰는 기호가 아닙니다. 워드나 메신저에서 복사하거나 한글 입력 상태에서 치면 따옴표·쉼표·괄호가 전각 문자로 바뀝니다.`, hint: `'${m[1]}'를 지우고 영문 입력 상태에서 ${suggestAsciiKo(m[1])} 다시 입력합니다.` }),
    en: (m) => ({ title: 'Non-ASCII symbol in code', explanation: `'${m[1]}' (U+${m[2]}) is not a Python symbol. Copying from a word processor or chat often turns quotes, commas and brackets into fancy characters.`, hint: `Delete '${m[1]}' and retype ${suggestAsciiEn(m[1])} with a plain keyboard.` }),
  },
  {
    type: 'SyntaxError', pattern: /^invalid non-printable character U\+([0-9A-F]{4})/,
    ko: (m) => ({ explanation: `눈에 보이지 않는 글자(U+${m[1]})가 들어 있습니다. 웹이나 문서에서 복사할 때 따라오는 특수 공백입니다.`, hint: '이 줄을 지우고 직접 다시 입력합니다.' }),
    en: (m) => ({ explanation: `An invisible character (U+${m[1]}) is in the code, usually pasted from a web page or document.`, hint: 'Delete this line and retype it.' }),
  },
  {
    type: 'SyntaxError', pattern: /^expected ':'/,
    ko: (m, ctx) => ({ explanation: `${keywordOf(ctx.codeLine) ? `${keywordOf(ctx.codeLine)} 문의 ` : ''}줄 끝에 콜론(:)이 빠졌습니다. if, for, while, def, class, else 같은 줄은 반드시 콜론으로 끝나야 합니다.`, hint: '이 줄 끝에 : 를 추가합니다.' }),
    en: (m, ctx) => ({ explanation: `The colon (:) is missing at the end of ${keywordOf(ctx.codeLine) ? `the ${keywordOf(ctx.codeLine)} line` : 'this line'}. Lines starting with if, for, while, def, class or else must end with a colon.`, hint: 'Add : at the end of this line.' }),
  },
  {
    type: 'SyntaxError', pattern: /Maybe you meant '==' or ':=' instead of '='|cannot assign to (?:.+) here\. Maybe you meant '==' instead of '='/,
    ko: () => ({ explanation: '비교하는 자리에 = 하나를 썼습니다. = 는 값을 넣는 기호이고, 같은지 비교할 때는 == 를 씁니다.', hint: 'if나 while 조건의 = 를 == 로 바꿉니다.' }),
    en: () => ({ explanation: 'A single = was used where a comparison belongs. = assigns a value; == compares two values.', hint: 'Change = to == in the if or while condition.' }),
  },
  {
    type: 'SyntaxError', pattern: /^cannot assign to (literal|expression|function call|attribute here|operator)/,
    ko: (m) => ({ explanation: `= 왼쪽에는 변수 이름만 올 수 있는데 ${m[1] === 'literal' ? '숫자나 문자열' : m[1] === 'function call' ? '함수 호출' : '계산식'}이 있습니다. 값을 넣을 변수가 왼쪽, 넣을 값이 오른쪽입니다.`, hint: '좌우를 바꾸거나, 비교하려던 것이면 = 를 == 로 바꿉니다.' }),
    en: (m) => ({ explanation: `Only a variable name can be on the left of =, but there is ${m[1] === 'literal' ? 'a number or string' : m[1] === 'function call' ? 'a function call' : 'an expression'}. The variable goes left, the value right.`, hint: 'Swap the sides, or use == if you meant to compare.' }),
  },
  {
    type: 'SyntaxError', pattern: /^Missing parentheses in call to 'print'/,
    ko: () => ({ explanation: 'print 뒤에 괄호가 없습니다. 파이썬 3에서는 print("내용")처럼 괄호 안에 넣어야 합니다.', hint: 'print 뒤의 내용을 괄호로 감쌉니다.' }),
    en: () => ({ explanation: 'print has no parentheses. In Python 3 you must write print("text").', hint: 'Wrap what follows print in parentheses.' }),
  },
  {
    type: 'SyntaxError', pattern: /^invalid syntax\. Perhaps you forgot a comma\?/,
    ko: () => ({ explanation: '값과 값 사이에 쉼표(,)가 빠진 것으로 보입니다. 함수 인자나 리스트 항목은 쉼표로 구분합니다.', hint: '표시된 자리 앞뒤의 두 값 사이에 , 를 넣습니다.' }),
    en: () => ({ explanation: 'A comma seems to be missing between two values. Arguments and list items are separated by commas.', hint: 'Insert , between the two values near the marked spot.' }),
  },
  {
    type: 'SyntaxError', pattern: /^invalid decimal literal/,
    ko: () => ({ explanation: '숫자 바로 뒤에 글자가 붙어 있습니다. 3x 같은 표현은 파이썬에서 쓸 수 없고, 변수 이름은 숫자로 시작할 수 없습니다.', hint: '곱셈이면 3 * x 처럼 * 를 넣고, 변수 이름이면 글자로 시작하게 바꿉니다.' }),
    en: () => ({ explanation: 'A letter follows a number directly. 3x is not valid, and names cannot start with a digit.', hint: 'Write 3 * x for multiplication, or start the name with a letter.' }),
  },
  {
    type: 'SyntaxError', pattern: /^leading zeros in decimal integer literals/,
    ko: () => ({ explanation: '정수는 0으로 시작할 수 없습니다. 007 같은 표기는 쓸 수 없습니다.', hint: '앞의 0을 지웁니다.' }),
    en: () => ({ explanation: 'Integers cannot start with 0, so 007 is not allowed.', hint: 'Remove the leading zeros.' }),
  },
  {
    type: 'SyntaxError', pattern: /^'(return|break|continue|yield|await)' outside (function|loop|async function)/,
    ko: (m) => ({ explanation: `${m[1]}은 ${m[2] === 'loop' ? 'for나 while 반복문' : '함수(def)'} 안에서만 쓸 수 있는데 바깥에 있습니다. 들여쓰기가 풀려서 밖으로 나갔을 수도 있습니다.`, hint: `${m[1]} 줄의 들여쓰기를 ${m[2] === 'loop' ? '반복문' : '함수'} 안쪽으로 맞추거나 이 줄을 지웁니다.` }),
    en: (m) => ({ explanation: `${m[1]} only works inside ${m[2] === 'loop' ? 'a for or while loop' : 'a function'}, but it is outside one. Its indentation may have been lost.`, hint: `Indent the ${m[1]} line into the ${m[2] === 'loop' ? 'loop' : 'function'}, or remove it.` }),
  },
  {
    type: 'SyntaxError', pattern: /^positional argument follows keyword argument/,
    ko: () => ({ explanation: '이름을 붙인 인자(pos=...) 뒤에 이름 없는 인자가 왔습니다. 이름 없는 인자가 먼저, 이름 붙인 인자가 나중이어야 합니다.', hint: '이름 없는 값을 앞으로 옮기거나 그 값에도 이름을 붙입니다.' }),
    en: () => ({ explanation: 'A plain argument came after a keyword argument (pos=...). Plain arguments must come first.', hint: 'Move the plain value first, or give it a keyword too.' }),
  },
  {
    type: 'SyntaxError', pattern: /^expected 'except' or 'finally' block/,
    ko: () => ({ explanation: 'try 블록 뒤에 except나 finally가 없습니다. try는 혼자 쓸 수 없습니다.', hint: 'try 블록이 끝난 뒤 "except Exception as e:" 블록을 추가합니다.' }),
    en: () => ({ explanation: 'A try block has no except or finally after it. try cannot stand alone.', hint: 'Add an "except Exception as e:" block after the try block.' }),
  },
  {
    type: 'SyntaxError', pattern: /^invalid syntax/, when: (m, ctx) => blockKeywordWithoutColon(ctx.codeLine),
    ko: (m, ctx) => ({ explanation: `${keywordOf(ctx.codeLine)} 문의 줄 끝에 콜론(:)이 빠졌습니다.`, hint: '이 줄 끝에 : 를 추가합니다.' }),
    en: (m, ctx) => ({ explanation: `The ${keywordOf(ctx.codeLine)} line is missing its colon (:).`, hint: 'Add : at the end of this line.' }),
  },
  {
    type: 'SyntaxError', pattern: /^invalid syntax/, when: (m, ctx) => /^\s*(if|elif|while)\b[^=]*[^=!<>]=[^=]/.test(ctx.codeLine || ''),
    ko: () => ({ explanation: '조건문에서 = 하나를 썼습니다. = 는 값을 넣는 기호이고, 같은지 비교할 때는 == 를 씁니다.', hint: '조건의 = 를 == 로 바꿉니다.' }),
    en: () => ({ explanation: 'A single = is used inside a condition. = assigns; == compares.', hint: 'Change = to == in the condition.' }),
  },
  {
    type: 'SyntaxError', pattern: /^invalid syntax/, when: (m, ctx) => /[“”‘’]/.test(ctx.codeLine || ''),
    ko: () => ({ title: '한글 따옴표가 섞였습니다', explanation: '“ ” 나 ‘ ’ 같은 둥근 따옴표는 파이썬 따옴표가 아닙니다. 워드나 메신저에서 복사하면 생깁니다.', hint: '둥근 따옴표를 지우고 영문 입력 상태에서 " 또는 \' 를 다시 입력합니다.' }),
    en: () => ({ title: 'Curly quotes in code', explanation: '“ ” and ‘ ’ are not Python quotes. They appear when copying from a word processor or chat.', hint: 'Replace the curly quotes with plain " or \'.' }),
  },
  {
    type: 'SyntaxError', pattern: /^invalid syntax/, when: (m, ctx) => /^\s*(elif|else|except|finally)\b/.test(ctx.codeLine || ''),
    ko: (m, ctx) => ({ explanation: `${keywordOf(ctx.codeLine)}가 짝이 되는 if나 try와 같은 들여쓰기 깊이에 있지 않거나, 그 사이에 다른 줄이 끼어 있습니다.`, hint: `${keywordOf(ctx.codeLine)} 줄의 들여쓰기를 짝이 되는 if(try) 줄과 같게 맞춥니다.` }),
    en: (m, ctx) => ({ explanation: `${keywordOf(ctx.codeLine)} is not at the same indentation as its if or try, or another line sits between them.`, hint: `Align the ${keywordOf(ctx.codeLine)} line with its matching if (or try).` }),
  },
  {
    type: 'SyntaxError', pattern: /^(invalid syntax|unexpected EOF while parsing)/,
    ko: () => ({ explanation: '이 줄을 파이썬 문법대로 읽을 수 없습니다. 괄호나 따옴표가 짝이 맞지 않거나, 쉼표나 콜론(:)이 빠졌거나, 영어가 아닌 기호가 섞였을 때 생깁니다.', hint: '표시된 위치 주변의 괄호·따옴표·쉼표·콜론을 확인하고, 바로 위 줄도 살펴봅니다.' }),
    en: () => ({ explanation: 'Python cannot read this line. Usually a bracket or quote is unbalanced, a comma or colon is missing, or a non-ASCII symbol slipped in.', hint: 'Check brackets, quotes, commas and colons near the marked spot, and look at the line above too.' }),
  },

  // === IndentationError / TabError ===
  {
    type: 'IndentationError', pattern: /^expected an indented block after '(.+?)' statement on line (\d+)/,
    ko: (m, ctx) => ({ explanation: `${ctx.mapLine(Number(m[2])) ?? m[2]}번 줄의 ${m[1]} 문 다음 줄은 안쪽으로 들여 써야 하는데 들여쓰기가 없습니다.`, hint: `${m[1]} 문 아래 줄들을 공백 4칸 들여 씁니다. 아직 내용이 없으면 pass 를 한 줄 넣습니다.` }),
    en: (m, ctx) => ({ explanation: `The line after the ${m[1]} statement on line ${ctx.mapLine(Number(m[2])) ?? m[2]} must be indented, but it is not.`, hint: `Indent the lines under the ${m[1]} statement by 4 spaces, or put pass there.` }),
  },
  {
    type: 'IndentationError', pattern: /^expected an indented block/,
    ko: () => ({ explanation: '콜론(:)으로 끝난 줄 다음에는 안쪽으로 들여 쓴 줄이 와야 하는데 없습니다.', hint: '콜론 아래 줄들을 공백 4칸 들여 씁니다. 아직 내용이 없으면 pass 를 넣습니다.' }),
    en: () => ({ explanation: 'A line ending with : must be followed by an indented line, but there is none.', hint: 'Indent the lines under the colon by 4 spaces, or put pass there.' }),
  },
  {
    type: 'IndentationError', pattern: /^unexpected indent/,
    ko: () => ({ explanation: '들여쓰기가 필요 없는 줄이 안쪽으로 들어가 있습니다. 바로 위 줄이 콜론(:)으로 끝나지 않으면 들여 쓸 수 없습니다.', hint: '이 줄 앞의 공백을 지워 위 줄과 같은 깊이로 맞춥니다.' }),
    en: () => ({ explanation: 'This line is indented but nothing asked for it. You can only indent after a line ending with :.', hint: 'Remove the leading spaces so this line lines up with the line above.' }),
  },
  {
    type: 'IndentationError', pattern: /^unindent does not match any outer indentation level/,
    ko: () => ({ explanation: '들여쓰기를 줄였는데 그 깊이가 위쪽 어느 블록과도 맞지 않습니다. 공백 칸 수가 하나 어긋났습니다.', hint: '이 줄의 공백을 위쪽 블록 중 하나와 똑같은 칸 수(보통 0, 4, 8칸)로 맞춥니다.' }),
    en: () => ({ explanation: 'This line dedents to a depth that matches no enclosing block. The space count is off by a few.', hint: 'Make the leading spaces match one of the blocks above (usually 0, 4 or 8 spaces).' }),
  },
  {
    type: 'TabError', pattern: /inconsistent use of tabs and spaces/,
    ko: () => ({ explanation: '들여쓰기에 탭과 공백이 섞여 있습니다. 보기에는 같아도 파이썬은 다른 것으로 봅니다.', hint: '이 줄과 주변 줄의 앞 공백을 모두 지우고 스페이스 4칸으로 다시 들여씁니다.' }),
    en: () => ({ explanation: 'The indentation mixes tabs and spaces. They look alike but Python treats them differently.', hint: 'Delete the leading whitespace on this and nearby lines and re-indent with 4 spaces.' }),
  },

  // === TypeError ===
  {
    type: 'TypeError', pattern: /^unsupported operand type\(s\) for ([^:]+): '(vector)' and '(tuple|list)'|^unsupported operand type\(s\) for ([^:]+): '(tuple|list)' and '(vector)'/,
    ko: () => ({ title: 'vector 대신 튜플을 사용했습니다', explanation: '(1, 2, 3) 같은 튜플은 vector와 계산할 수 없습니다. 위치·속도·색은 vector(1, 2, 3)으로 만들어야 더하기와 곱하기가 됩니다.', hint: '괄호 앞에 vector를 붙여 vector(1, 2, 3) 형태로 바꿉니다.' }),
    en: () => ({ title: 'Tuple used instead of vector', explanation: 'A tuple like (1, 2, 3) cannot be combined with a vector. Positions, velocities and colors must be vector(1, 2, 3).', hint: 'Write vector(1, 2, 3) instead of (1, 2, 3).' }),
  },
  {
    type: 'TypeError', pattern: /^unsupported operand type\(s\) for ([^:]+): '(str)' and '(int|float)'|^unsupported operand type\(s\) for ([^:]+): '(int|float)' and '(str)'|^can only concatenate str \(not "(int|float)"\) to str/,
    ko: () => ({ explanation: '문자열과 숫자를 함께 계산했습니다. input()으로 받은 값은 문자열이라 숫자와 바로 더하거나 비교할 수 없습니다.', hint: '숫자로 쓰려면 int(값) 또는 float(값)으로 바꾸고, 글자로 이어 붙이려면 str(숫자)로 바꿉니다.' }),
    en: () => ({ explanation: 'A string and a number were combined. Values from input() are strings and cannot be added to numbers directly.', hint: 'Convert with int(value) or float(value) for math, or str(number) to join text.' }),
  },
  {
    type: 'TypeError', pattern: /^unsupported operand type\(s\) for ([^:]+): '(.+?)' and '(.+?)'/,
    ko: (m) => ({ explanation: `${describeTypeKo(m[2])}과 ${describeTypeKo(m[3])} 사이에는 ${m[1]} 계산을 할 수 없습니다.${m[2] === 'NoneType' || m[3] === 'NoneType' ? ' None은 보통 값을 return하지 않은 함수의 결과입니다.' : ''}`, hint: m[2] === 'NoneType' || m[3] === 'NoneType' ? '그 값을 만든 함수에 return 이 있는지, 변수에 값이 들어갔는지 print로 확인합니다.' : '두 값을 print로 찍어 종류를 확인하고 같은 종류로 맞춥니다.' }),
    en: (m) => ({ explanation: `You cannot use ${m[1]} between ${describeTypeEn(m[2])} and ${describeTypeEn(m[3])}.${m[2] === 'NoneType' || m[3] === 'NoneType' ? ' None usually comes from a function without return.' : ''}`, hint: m[2] === 'NoneType' || m[3] === 'NoneType' ? 'Check that the function returns a value and the variable was assigned.' : 'Print both values to see their types and make them match.' }),
  },
  {
    type: 'TypeError', pattern: /^can't multiply sequence by non-int of type '(.+?)'/,
    ko: () => ({ title: 'vector 대신 튜플·리스트를 사용했습니다', explanation: '튜플이나 리스트에 소수를 곱할 수 없습니다. 위치나 속도처럼 수를 곱해야 하는 값은 vector로 만들어야 합니다.', hint: '(1, 2, 3)을 vector(1, 2, 3)으로 바꿉니다.' }),
    en: () => ({ title: 'Tuple or list used instead of vector', explanation: 'A tuple or list cannot be multiplied by a decimal. Values you scale, like position or velocity, must be vectors.', hint: 'Change (1, 2, 3) to vector(1, 2, 3).' }),
  },
  {
    type: 'TypeError', pattern: /^'(.+?)' object is not callable/,
    ko: (m) => ({ explanation: m[1] === 'module' ? '모듈 이름 뒤에 바로 괄호를 붙였습니다. 모듈 안의 함수는 모듈.함수() 형태로 부릅니다.' : `${describeTypeKo(m[1])}은 함수가 아닌데 뒤에 괄호 ()를 붙였습니다. 함수와 같은 이름의 변수를 만들어 함수를 덮어썼을 때 자주 생깁니다.`, hint: m[1] === 'module' ? '예: random() 대신 random.random() 처럼 모듈.함수() 로 씁니다.' : '괄호 앞 이름이 변수인지 함수인지 확인하고, 함수 이름(list, sphere, print 등)을 변수 이름으로 쓰지 않습니다.' }),
    en: (m) => ({ explanation: m[1] === 'module' ? 'Parentheses were put right after a module name. Call functions as module.function().' : `${describeTypeEn(m[1])} is not a function, but () was added after it. This often happens after a variable overwrote a function name.`, hint: m[1] === 'module' ? 'Write random.random() instead of random().' : 'Check whether the name before () is a variable or a function, and avoid variable names like list, sphere or print.' }),
  },
  {
    type: 'TypeError', pattern: /^'vector' object is not subscriptable/,
    ko: () => ({ explanation: 'vector의 성분은 v[0]처럼 번호로 꺼낼 수 없습니다.', hint: 'v.x, v.y, v.z 처럼 점 뒤에 성분 이름을 씁니다.' }),
    en: () => ({ explanation: 'Vector components cannot be read with v[0].', hint: 'Use v.x, v.y and v.z.' }),
  },
  {
    type: 'TypeError', pattern: /^'(.+?)' object is not subscriptable/,
    ko: (m) => ({ explanation: `${describeTypeKo(m[1])}에는 [번호]로 항목을 꺼낼 수 없습니다.${m[1] === 'NoneType' ? ' None은 보통 값을 return하지 않은 함수의 결과입니다.' : m[1] === 'int' || m[1] === 'float' ? ' 숫자를 리스트처럼 다뤘습니다.' : ''}`, hint: m[1] === 'NoneType' ? '그 값을 만든 함수에 return 이 있는지 확인합니다.' : '대괄호 앞의 값이 리스트·문자열·딕셔너리인지 print로 확인합니다.' }),
    en: (m) => ({ explanation: `${describeTypeEn(m[1])} does not support [index].${m[1] === 'NoneType' ? ' None usually comes from a function without return.' : ''}`, hint: m[1] === 'NoneType' ? 'Check that the function returns a value.' : 'Print the value before the brackets to confirm it is a list, string or dict.' }),
  },
  {
    type: 'TypeError', pattern: /^'(.+?)' object is not iterable/,
    ko: (m) => ({ explanation: `${describeTypeKo(m[1])}은 for 문으로 하나씩 꺼낼 수 없습니다.${m[1] === 'int' ? ' 숫자만큼 반복하려면 range()가 필요합니다.' : ''}`, hint: m[1] === 'int' ? 'for i in 10: 을 for i in range(10): 으로 바꿉니다.' : 'for 뒤의 값이 리스트·문자열·range인지 확인합니다.' }),
    en: (m) => ({ explanation: `${describeTypeEn(m[1])} cannot be looped over with for.${m[1] === 'int' ? ' To repeat N times, use range().' : ''}`, hint: m[1] === 'int' ? 'Change for i in 10: to for i in range(10):.' : 'Make sure the value after for is a list, string or range.' }),
  },
  {
    type: 'TypeError', pattern: /^(\S+?)\(\) takes (\d+) positional arguments? but (\d+) (?:was|were) given/, when: (m) => VPYTHON_OBJECTS.has(cleanFunctionName(m[1])),
    ko: (m) => ({ title: 'VPython 객체는 이름 붙인 인자가 필요합니다', explanation: `${cleanFunctionName(m[1])}()에 값을 순서대로 넣었습니다. VPython 객체는 어떤 값인지 이름을 붙여야 합니다.`, hint: `${cleanFunctionName(m[1])}(pos=vector(0, 0, 0), radius=1, color=color.red) 처럼 이름=값 형태로 씁니다.` }),
    en: (m) => ({ title: 'VPython objects need keyword arguments', explanation: `${cleanFunctionName(m[1])}() received positional values. VPython objects need each value named.`, hint: `Write ${cleanFunctionName(m[1])}(pos=vector(0, 0, 0), radius=1, color=color.red).` }),
  },
  {
    type: 'TypeError', pattern: /^(\S+?)\(\) takes (\d+) positional arguments? but (\d+) (?:was|were) given/,
    ko: (m) => ({ explanation: `${cleanFunctionName(m[1])}()는 값을 ${m[2]}개 받는데 ${m[3]}개를 넣었습니다.`, hint: `${cleanFunctionName(m[1])}()의 def 줄에 적힌 매개변수 수에 맞게 값을 줄입니다.` }),
    en: (m) => ({ explanation: `${cleanFunctionName(m[1])}() takes ${m[2]} value(s) but received ${m[3]}.`, hint: `Match the number of values to the parameters in the def line of ${cleanFunctionName(m[1])}().` }),
  },
  {
    type: 'TypeError', pattern: /^(\S+?)\(\) missing (\d+) required positional arguments?: (.+)/,
    ko: (m) => ({ explanation: `${cleanFunctionName(m[1])}()를 부를 때 꼭 필요한 값 ${m[3]}을(를) 넣지 않았습니다.`, hint: `${cleanFunctionName(m[1])}(${m[3].replace(/'/g, '').replace(/ and /g, ', ')}) 처럼 빠진 값을 괄호 안에 넣습니다.` }),
    en: (m) => ({ explanation: `${cleanFunctionName(m[1])}() was called without required value(s) ${m[3]}.`, hint: `Pass the missing value(s): ${cleanFunctionName(m[1])}(${m[3].replace(/'/g, '').replace(/ and /g, ', ')}).` }),
  },
  {
    type: 'TypeError', pattern: /^(\S+?)\(\) got an unexpected keyword argument '(.+?)'/,
    ko: (m) => ({ explanation: `${cleanFunctionName(m[1])}()에는 '${m[2]}'라는 옵션이 없습니다. 옵션 이름의 철자가 다르거나 다른 객체의 옵션을 썼을 때 생깁니다.${VPYTHON_OBJECTS.has(cleanFunctionName(m[1])) ? ' 자주 쓰는 옵션은 pos, radius, size, axis, color, opacity, length입니다.' : ''}`, hint: `'${m[2]}'의 철자를 확인하고 있는 옵션 이름으로 고칩니다.` }),
    en: (m) => ({ explanation: `${cleanFunctionName(m[1])}() has no option named '${m[2]}'. The name may be misspelled or belong to another object.${VPYTHON_OBJECTS.has(cleanFunctionName(m[1])) ? ' Common options are pos, radius, size, axis, color, opacity and length.' : ''}`, hint: `Check the spelling of '${m[2]}' and use an existing option name.` }),
  },
  {
    type: 'TypeError', pattern: /^(\S+?)\(\) got multiple values for argument '(.+?)'/,
    ko: (m) => ({ explanation: `${cleanFunctionName(m[1])}()에 '${m[2]}' 값을 두 번 넣었습니다. 순서로 한 번, 이름으로 한 번 들어갔습니다.`, hint: `둘 중 하나만 남기고 '${m[2]}' 값을 한 번만 넣습니다.` }),
    en: (m) => ({ explanation: `${cleanFunctionName(m[1])}() received '${m[2]}' twice, once by position and once by name.`, hint: `Pass '${m[2]}' only once.` }),
  },
  {
    type: 'TypeError', pattern: /^'(.+?)' not supported between instances of '(.+?)' and '(.+?)'/,
    ko: (m) => ({ explanation: `${describeTypeKo(m[2])}과 ${describeTypeKo(m[3])}은 ${m[1]} 로 비교할 수 없습니다.${m[2] === 'str' || m[3] === 'str' ? ' input()으로 받은 값은 문자열입니다.' : ''}`, hint: m[2] === 'str' || m[3] === 'str' ? '비교하기 전에 int(값) 또는 float(값)으로 숫자로 바꿉니다.' : '두 값을 print로 확인해 같은 종류로 맞춥니다.' }),
    en: (m) => ({ explanation: `${describeTypeEn(m[2])} and ${describeTypeEn(m[3])} cannot be compared with ${m[1]}.${m[2] === 'str' || m[3] === 'str' ? ' input() returns a string.' : ''}`, hint: m[2] === 'str' || m[3] === 'str' ? 'Convert with int(value) or float(value) before comparing.' : 'Print both values and make their types match.' }),
  },
  {
    type: 'TypeError', pattern: /^(int|float)\(\) argument must be a string(?:, a bytes-like object)? or a (?:real )?number, not '(.+?)'/,
    ko: (m) => ({ explanation: `${m[1]}()에는 문자열이나 숫자만 넣을 수 있는데 ${describeTypeKo(m[2])}을 넣었습니다.${m[2] === 'NoneType' ? ' None은 보통 값을 return하지 않은 함수의 결과입니다.' : ''}`, hint: `${m[1]}() 안의 값을 print로 확인합니다.` }),
    en: (m) => ({ explanation: `${m[1]}() accepts a string or number, but received ${describeTypeEn(m[2])}.`, hint: `Print the value inside ${m[1]}().` }),
  },
  {
    type: 'TypeError', pattern: /^object of type '(.+?)' has no len\(\)/,
    ko: (m) => ({ explanation: `len()은 리스트·문자열처럼 길이가 있는 값에만 쓸 수 있는데 ${describeTypeKo(m[1])}을 넣었습니다.`, hint: 'len() 안의 값이 리스트나 문자열인지 확인합니다.' }),
    en: (m) => ({ explanation: `len() works on lists and strings, but received ${describeTypeEn(m[1])}.`, hint: 'Check that the value inside len() is a list or string.' }),
  },
  {
    type: 'TypeError', pattern: /^'(.+?)' object does not support item assignment/,
    ko: (m) => ({ explanation: `${describeTypeKo(m[1])}은 값[번호] = 새 값 으로 바꿀 수 없습니다.${m[1] === 'str' ? ' 문자열은 한 번 만들면 바뀌지 않습니다.' : m[1] === 'tuple' ? ' 튜플은 바뀌지 않는 값입니다.' : ''}`, hint: m[1] === 'str' ? '새 문자열을 만들어 변수에 다시 넣거나 list(문자열)로 바꾼 뒤 수정합니다.' : '리스트로 바꾸어 수정합니다.' }),
    en: (m) => ({ explanation: `${describeTypeEn(m[1])} cannot be changed with value[index] = new.`, hint: m[1] === 'str' ? 'Build a new string, or convert with list(text) first.' : 'Convert it to a list before changing items.' }),
  },
  {
    type: 'TypeError', pattern: /^unhashable type: '(.+?)'/,
    ko: (m) => ({ explanation: `${describeTypeKo(m[1])}은 딕셔너리의 키나 집합의 항목으로 쓸 수 없습니다.`, hint: '키로 쓰려면 튜플이나 문자열로 바꿉니다.' }),
    en: (m) => ({ explanation: `${describeTypeEn(m[1])} cannot be a dictionary key or set item.`, hint: 'Use a tuple or string as the key instead.' }),
  },
  {
    type: 'TypeError', pattern: /^bad operand type for unary (.): '(.+?)'/,
    ko: (m) => ({ explanation: `${describeTypeKo(m[2])} 앞에 ${m[1]} 를 붙일 수 없습니다. 숫자가 아닌 값에 부호를 붙였습니다.`, hint: '값을 print로 확인하고 숫자로 바꿉니다.' }),
    en: (m) => ({ explanation: `${m[1]} cannot be applied to ${describeTypeEn(m[2])}.`, hint: 'Print the value and convert it to a number.' }),
  },

  // === AttributeError ===
  {
    type: 'AttributeError', pattern: /^'(tuple|list)' object has no attribute '([xyz])'/,
    ko: () => ({ title: 'vector 대신 튜플·리스트를 사용했습니다', explanation: '(1, 2, 3) 같은 튜플에는 .x .y .z 성분이 없습니다. 위치·속도·색은 vector(1, 2, 3)으로 만들어야 성분을 읽고 계산할 수 있습니다.', hint: '값을 만든 줄에서 (1, 2, 3)을 vector(1, 2, 3)으로 바꿉니다.' }),
    en: () => ({ title: 'Tuple or list used instead of vector', explanation: 'A tuple like (1, 2, 3) has no .x .y .z. Positions, velocities and colors must be vector(1, 2, 3).', hint: 'Change (1, 2, 3) to vector(1, 2, 3) where the value is created.' }),
  },
  {
    type: 'AttributeError', pattern: /^'_ColorPalette' object has no attribute '(.+?)'/,
    ko: (m) => ({ title: '색 이름이 없습니다', explanation: `color.${m[1]} 이라는 색은 없습니다. 쓸 수 있는 영어 이름은 ${COLOR_NAMES_EN}입니다.`, hint: `color.${closest(m[1], COLOR_NAMES_EN.split(', ')) || 'red'} 처럼 있는 이름으로 바꾸거나 vector(r, g, b)로 직접 만듭니다. 각 값은 0에서 1 사이입니다.` }),
    en: (m) => ({ title: 'Unknown color name', explanation: `There is no color.${m[1]}. Available names: ${COLOR_NAMES_EN}.`, hint: `Use color.${closest(m[1], COLOR_NAMES_EN.split(', ')) || 'red'} or build one with vector(r, g, b) (each 0 to 1).` }),
  },
  {
    type: 'AttributeError', pattern: /^'NoneType' object has no attribute '(.+?)'/,
    ko: (m) => ({ explanation: `값이 None인 변수에 .${m[1]} 을 썼습니다. None은 값을 return하지 않은 함수의 결과이거나, 리스트의 append·sort처럼 결과를 돌려주지 않는 메서드를 변수에 넣었을 때 생깁니다.`, hint: '점 앞의 변수를 print로 확인하고, 그 값을 만든 함수에 return 을 넣습니다.' }),
    en: (m) => ({ explanation: `.${m[1]} was used on a variable that is None. None comes from a function without return, or from assigning the result of append or sort.`, hint: 'Print the variable before the dot and add return to the function that made it.' }),
  },
  {
    type: 'AttributeError', pattern: /^module '(.+?)' has no attribute '(.+?)'(?:\. Did you mean: '(.+?)'\?)?/,
    ko: (m) => ({ explanation: `${m[1]} 모듈에는 ${m[2]} 라는 함수가 없습니다.${m[3] ? ` '${m[3]}'를 쓰려던 것으로 보입니다.` : ''}`, hint: m[3] ? `${m[1]}.${m[2]} 를 ${m[1]}.${m[3]} 으로 고칩니다.` : `${m[1]} 모듈의 함수 이름(예: random.randint, math.sqrt)을 확인합니다.` }),
    en: (m) => ({ explanation: `Module ${m[1]} has no function ${m[2]}.${m[3] ? ` You probably meant '${m[3]}'.` : ''}`, hint: m[3] ? `Change ${m[1]}.${m[2]} to ${m[1]}.${m[3]}.` : `Check the function names in ${m[1]} (for example random.randint, math.sqrt).` }),
  },
  {
    type: 'AttributeError', pattern: /^'(.+?)' object has no attribute '(.+?)'\. Did you mean: '(.+?)'\?/,
    ko: (m) => ({ explanation: `${describeTypeKo(m[1])}에는 ${m[2]} 가 없습니다. 철자가 비슷한 '${m[3]}'를 쓰려던 것으로 보입니다.`, hint: `.${m[2]} 를 .${m[3]} 으로 고칩니다.` }),
    en: (m) => ({ explanation: `${describeTypeEn(m[1])} has no attribute ${m[2]}. You probably meant '${m[3]}'.`, hint: `Change .${m[2]} to .${m[3]}.` }),
  },
  {
    type: 'AttributeError', pattern: /^'(.+?)' object has no attribute '(.+?)'/, when: (m) => VPYTHON_OBJECTS.has(m[1]),
    ko: (m) => ({ explanation: `${m[1]} 객체에는 아직 ${m[2]} 라는 속성이 없습니다. 기본 속성(pos, radius, size, axis, color, opacity)이 아니면 먼저 값을 넣어 주어야 읽을 수 있습니다.`, hint: `철자를 확인하고, 직접 만든 속성이면 객체.${m[2]} = 값 을 먼저 씁니다.` }),
    en: (m) => ({ explanation: `The ${m[1]} object has no attribute ${m[2]} yet. Besides built-in ones (pos, radius, size, axis, color, opacity) you must assign it before reading it.`, hint: `Check the spelling, or assign object.${m[2]} = value first.` }),
  },
  {
    type: 'AttributeError', pattern: /^'(.+?)' object has no attribute '(.+?)'/,
    ko: (m) => ({ explanation: `${describeTypeKo(m[1])}에는 ${m[2]} 라는 속성이나 메서드가 없습니다. 점 앞 값의 종류가 생각과 다르거나 이름 철자가 다릅니다.`, hint: '점 앞의 값을 print로 확인하고, 그 종류에 있는 메서드 이름으로 고칩니다.' }),
    en: (m) => ({ explanation: `${describeTypeEn(m[1])} has no attribute or method ${m[2]}. The value before the dot may not be what you expect, or the name is misspelled.`, hint: 'Print the value before the dot and use a method that its type has.' }),
  },

  // === ZeroDivisionError ===
  {
    type: 'ZeroDivisionError', pattern: /division by zero|modulo by zero/,
    ko: (m, ctx) => ({ explanation: `${ctx.codeLine ? `이 줄의 ${/%/.test(ctx.codeLine) && !/[/]/.test(ctx.codeLine) ? '나머지 연산' : '나누기'}에서 ` : ''}나누는 값(분모)이 0입니다. 변수가 0으로 시작했거나 계산 중에 0이 되었습니다.`, hint: '나누기 전에 "if 분모 != 0:" 으로 확인하거나, 분모가 되는 변수의 초기값을 0이 아닌 값으로 바꿉니다.' }),
    en: () => ({ explanation: 'The divisor is 0 on this line. The variable started at 0 or became 0 during the calculation.', hint: 'Guard with "if divisor != 0:" before dividing, or give the divisor a non-zero starting value.' }),
  },

  // === IndexError ===
  {
    type: 'IndexError', pattern: /^(list|string|tuple|range object) index out of range/,
    ko: (m) => ({ explanation: `${describeTypeKo(m[1].replace(' object', ''))}의 길이보다 큰 순서 번호를 썼습니다. 순서 번호는 0부터 시작하고 마지막은 len(값) - 1입니다. 빈 리스트의 [0]도 이 오류입니다.`, hint: '번호가 0 이상 len(값) - 1 이하인지 확인하고, 반복문이면 range(len(값))을 씁니다.' }),
    en: (m) => ({ explanation: `The index is beyond the end of the ${m[1].replace(' object', '')}. Indexes start at 0 and end at len(value) - 1. [0] on an empty list also fails.`, hint: 'Keep the index between 0 and len(value) - 1; in loops use range(len(value)).' }),
  },
  {
    type: 'IndexError', pattern: /^pop from empty list/,
    ko: () => ({ explanation: '빈 리스트에서 pop()으로 값을 꺼내려 했습니다.', hint: 'pop() 전에 "if len(리스트) > 0:" 으로 비어 있지 않은지 확인합니다.' }),
    en: () => ({ explanation: 'pop() was called on an empty list.', hint: 'Check "if len(items) > 0:" before pop().' }),
  },
  {
    type: 'IndexError', pattern: /^list assignment index out of range/,
    ko: () => ({ explanation: '리스트에 없는 번호 자리에 값을 넣으려 했습니다. 리스트는 [번호] = 값 으로 길이를 늘릴 수 없습니다.', hint: '리스트 끝에 추가하려면 리스트.append(값)을 씁니다.' }),
    en: () => ({ explanation: 'You assigned to an index that does not exist yet. A list cannot grow with [index] = value.', hint: 'Use items.append(value) to add at the end.' }),
  },

  // === KeyError ===
  {
    type: 'KeyError', pattern: /^'(.+?)' 색상을 찾을 수 없습니다/,
    ko: (m) => ({ title: '색 이름이 없습니다', explanation: `'${m[1]}'이라는 색은 팔레트에 없습니다. 쓸 수 있는 한글 이름: ${COLOR_NAMES_KO}. 영어로는 color.red 처럼 씁니다.`, hint: `색상['${closest(m[1], COLOR_NAMES_KO.split(', ')) || '빨강'}'] 처럼 있는 이름으로 바꾸거나 vector(r, g, b)로 직접 만듭니다. 각 값은 0에서 1 사이입니다.` }),
    en: (m) => ({ title: 'Unknown color name', explanation: `'${m[1]}' is not in the palette. Korean names: ${COLOR_NAMES_KO}. English: color.red and so on (${COLOR_NAMES_EN}).`, hint: `Use one of the listed names, or build a color with vector(r, g, b) (each 0 to 1).` }),
  },
  {
    type: 'KeyError', pattern: /^'(.+?)' 이름을 찾을 수 없습니다\. 사용 가능: \[(.*)\]/,
    ko: (m) => ({ explanation: `'${m[1]}'이라는 항목이 없습니다. 쓸 수 있는 이름: ${m[2].replace(/'/g, '')}.`, hint: '목록에 있는 이름으로 바꿉니다.' }),
    en: (m) => ({ explanation: `There is no item named '${m[1]}'. Available names: ${m[2].replace(/'/g, '')}.`, hint: 'Use one of the listed names.' }),
  },
  {
    type: 'KeyError', pattern: /^(.+)$/s,
    ko: (m) => ({ explanation: `딕셔너리에 '${stripQuotes(m[1])}'라는 키가 없습니다. 키 철자나 대소문자가 다르거나, 아직 넣지 않은 키입니다.`, hint: '키 철자를 확인하거나, 값.get(키, 기본값)으로 읽거나, "키 in 값"으로 먼저 확인합니다.' }),
    en: (m) => ({ explanation: `The dictionary has no key '${stripQuotes(m[1])}'. The spelling or case differs, or the key was never added.`, hint: 'Check the spelling, use value.get(key, default), or test "key in value" first.' }),
  },

  // === ValueError ===
  {
    type: 'ValueError', pattern: /^invalid literal for int\(\) with base 10: '(.*)'/,
    ko: (m) => ({ explanation: `int()는 '${m[1]}'을 정수로 바꿀 수 없습니다. ${/^\s*-?\d+\.\d+\s*$/.test(m[1]) ? '소수점이 있는 값은 int()로 바로 바꿀 수 없습니다.' : m[1].trim() === '' ? '빈 값(아무것도 입력하지 않음)입니다.' : '숫자가 아닌 글자나 공백이 들어 있습니다.'}`, hint: /^\s*-?\d+\.\d+\s*$/.test(m[1]) ? 'int() 대신 float()을 쓰거나 int(float(값))으로 바꿉니다.' : '입력값이 숫자인지 확인하고, 아니면 값.strip()이나 값.isdigit()으로 거릅니다.' }),
    en: (m) => ({ explanation: `int() cannot convert '${m[1]}' to an integer. ${/^\s*-?\d+\.\d+\s*$/.test(m[1]) ? 'A value with a decimal point needs float().' : m[1].trim() === '' ? 'The value is empty.' : 'It contains non-digit characters or spaces.'}`, hint: /^\s*-?\d+\.\d+\s*$/.test(m[1]) ? 'Use float() or int(float(value)).' : 'Check the input is numeric, or filter with value.strip() or value.isdigit().' }),
  },
  {
    type: 'ValueError', pattern: /^could not convert string to float: '(.*)'/,
    ko: (m) => ({ explanation: `float()는 '${m[1]}'을 숫자로 바꿀 수 없습니다. 숫자가 아닌 글자, 쉼표, 단위가 섞여 있거나 빈 값입니다.`, hint: '숫자만 남기고 쉼표·단위를 지우거나 입력값을 확인합니다.' }),
    en: (m) => ({ explanation: `float() cannot convert '${m[1]}'. It contains letters, commas or units, or it is empty.`, hint: 'Keep only digits and a decimal point, or check the input.' }),
  },
  {
    type: 'ValueError', pattern: /^math domain error/,
    ko: () => ({ explanation: '수학 함수에 허용되지 않는 값을 넣었습니다. 음수의 제곱근(sqrt), 0이나 음수의 로그(log), 범위 밖의 asin·acos가 대표적입니다.', hint: '함수에 넣는 값을 print로 확인하고, 음수이면 abs()를 쓰거나 조건을 붙입니다.' }),
    en: () => ({ explanation: 'A math function received a value outside its domain, such as sqrt of a negative, log of 0, or asin beyond 1.', hint: 'Print the value passed in; use abs() or a condition if it can be negative.' }),
  },
  {
    type: 'ValueError', pattern: /^not enough values to unpack \(expected (\d+), got (\d+)\)|^too many values to unpack \(expected (\d+)(?:, got (\d+))?\)/,
    ko: (m) => ({ explanation: `변수 ${m[1] || m[3]}개에 나누어 넣으려 했는데 값은 ${m[2] || (m[4] ? m[4] : '그보다 많이')}개입니다. 왼쪽 변수 수와 오른쪽 값 수가 같아야 합니다.`, hint: '왼쪽 변수 수를 오른쪽 값 수에 맞추거나, 값 전체를 변수 하나에 넣습니다.' }),
    en: (m) => ({ explanation: `You tried to unpack into ${m[1] || m[3]} variables but there are ${m[2] || (m[4] ? m[4] : 'more')} values. Both sides must match.`, hint: 'Match the number of variables to the number of values, or assign the whole value to one variable.' }),
  },
  {
    type: 'ValueError', pattern: /^(.+) is not in list|^list\.remove\(x\): x not in list/,
    ko: (m) => ({ explanation: `${m[1] ? `${m[1]} 은(는) ` : '그 값은 '}리스트에 없습니다. index()나 remove()는 없는 값을 찾으면 오류를 냅니다.`, hint: '"값 in 리스트" 로 먼저 확인한 뒤 index()나 remove()를 씁니다.' }),
    en: (m) => ({ explanation: `${m[1] ? `${m[1]} is` : 'The value is'} not in the list. index() and remove() fail on missing values.`, hint: 'Test "value in items" before calling index() or remove().' }),
  },
  {
    type: 'ValueError', pattern: /^substring not found/,
    ko: () => ({ explanation: '문자열 안에 찾는 글자가 없습니다. index()는 없는 글자를 찾으면 오류를 냅니다.', hint: '오류 대신 -1을 돌려주는 find()를 쓰거나 "글자 in 문자열"로 먼저 확인합니다.' }),
    en: () => ({ explanation: 'The substring is not in the string. index() fails when nothing is found.', hint: 'Use find(), which returns -1, or test "part in text" first.' }),
  },
  {
    type: 'ValueError', pattern: /^음 이름을 확인해주세요: (.+)/,
    ko: (m) => ({ title: '음 이름이 올바르지 않습니다', explanation: `'${m[1]}'은 음 이름이 아닙니다. 음 이름은 C4, D4, E4 처럼 영어 음이름(C D E F G A B)과 옥타브 숫자로 씁니다. 반음은 C#4, Bb3 처럼 씁니다.`, hint: "play_note('C4') 처럼 음이름 + 옥타브 형식으로 고칩니다." }),
    en: (m) => ({ title: 'Invalid note name', explanation: `'${m[1]}' is not a note name. Use a letter (C D E F G A B) plus octave, like C4 or D4; sharps and flats are C#4 or Bb3.`, hint: "Write play_note('C4') with a letter and octave." }),
  },
  {
    type: 'ValueError', pattern: /^range\(\) arg 3 must not be zero/,
    ko: () => ({ explanation: 'range()의 세 번째 값(간격)이 0입니다. 간격이 0이면 반복이 끝나지 않으므로 허용되지 않습니다.', hint: '간격을 1이나 -1처럼 0이 아닌 값으로 바꿉니다.' }),
    en: () => ({ explanation: 'The step of range() is 0, which would never finish.', hint: 'Use a non-zero step like 1 or -1.' }),
  },

  // === ImportError / ModuleNotFoundError ===
  {
    type: 'ModuleNotFoundError', pattern: /^No module named '(.+?)'/,
    ko: (m) => {
      const name = m[1].split('.')[0];
      const guess = closest(name, KNOWN_MODULES);
      if (guess && guess !== name) return { explanation: `'${name}'이라는 모듈은 없습니다. '${guess}'를 쓰려던 것으로 보입니다.`, hint: `import ${name} 을 import ${guess} 로 고칩니다.` };
      if (INSTALLABLE.includes(name)) return { explanation: `'${name}' 패키지를 설치하지 못했습니다. 패키지는 실행할 때 인터넷에서 내려받으므로 네트워크가 막혀 있으면 실패합니다.`, hint: '네트워크 연결을 확인한 뒤 다시 실행합니다.' };
      return { explanation: `'${name}' 모듈은 브라우저 안의 파이썬에서 쓸 수 없습니다. 표준 라이브러리(${STDLIB_SAMPLES.join(', ')} 등)와 ${INSTALLABLE.join(', ')}는 쓸 수 있습니다.`, hint: `import ${name} 줄을 지우고, 3D·소리·그래프는 VPyLab의 내장 함수(sphere, play_note, graph 등)를 사용합니다.` };
    },
    en: (m) => {
      const name = m[1].split('.')[0];
      const guess = closest(name, KNOWN_MODULES);
      if (guess && guess !== name) return { explanation: `There is no module '${name}'. You probably meant '${guess}'.`, hint: `Change import ${name} to import ${guess}.` };
      if (INSTALLABLE.includes(name)) return { explanation: `The package '${name}' could not be installed. Packages are downloaded when you run, so a blocked network makes this fail.`, hint: 'Check the network connection and run again.' };
      return { explanation: `'${name}' is not available in the browser Python. Available: the standard library (${STDLIB_SAMPLES.join(', ')} ...) and ${INSTALLABLE.join(', ')}.`, hint: `Remove import ${name}; use VPyLab's built-in functions (sphere, play_note, graph ...) for 3D, sound and graphs.` };
    },
  },
  {
    type: 'ImportError', pattern: /^cannot import name '(.+?)' from '(.+?)'(?:.*Did you mean: '(.+?)'\?)?/s,
    ko: (m) => ({ explanation: `${m[2]} 모듈에는 '${m[1]}'이라는 이름이 없습니다.${m[3] ? ` '${m[3]}'를 쓰려던 것으로 보입니다.` : ''}`, hint: m[3] ? `import 뒤의 ${m[1]} 을 ${m[3]} 으로 고칩니다.` : `${m[2]} 모듈에 있는 이름인지 철자를 확인합니다.` }),
    en: (m) => ({ explanation: `Module ${m[2]} has no name '${m[1]}'.${m[3] ? ` You probably meant '${m[3]}'.` : ''}`, hint: m[3] ? `Change ${m[1]} to ${m[3]} after import.` : `Check the spelling against the names in ${m[2]}.` }),
  },

  // === RecursionError ===
  {
    type: 'RecursionError', pattern: /maximum recursion depth exceeded/,
    ko: () => ({ explanation: '함수가 자기 자신을 끝없이 호출했습니다. 멈추는 조건(기저 조건)이 없거나 그 조건에 도달하지 못합니다.', hint: '함수 맨 앞에 "if 조건: return 값" 같은 종료 조건을 두고, 호출할 때마다 인자가 그 조건에 가까워지는지 확인합니다.' }),
    en: () => ({ explanation: 'A function kept calling itself without end. There is no base case, or it is never reached.', hint: 'Put a base case like "if condition: return value" at the top and make each call move toward it.' }),
  },

  // === UnboundLocalError ===
  {
    type: 'UnboundLocalError', pattern: /^cannot access local variable '(.+?)' where it is not associated with a value|^local variable '(.+?)' referenced before assignment/,
    ko: (m) => { const name = m[1] || m[2]; return { explanation: `함수 안에서 '${name}'에 값을 넣는 줄이 있어서 파이썬이 이 변수를 함수 안의 지역 변수로 봅니다. 그런데 값을 넣기 전에 먼저 읽었습니다. 함수 밖의 변수를 함수 안에서 바꿀 때 자주 생깁니다.`, hint: `함수 밖의 변수를 바꾸려면 함수 첫 줄에 "global ${name}"을 적고, 아니면 함수 안에서 ${name} = 값 을 먼저 씁니다.` }; },
    en: (m) => { const name = m[1] || m[2]; return { explanation: `'${name}' is assigned somewhere inside the function, so Python treats it as local, but it is read before any value is assigned. This often happens when changing an outer variable inside a function.`, hint: `Add "global ${name}" as the first line of the function, or assign ${name} = value inside the function first.` }; },
  },
];

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function keywordOf(codeLine) {
  const match = (codeLine || '').match(/^\s*(if|elif|else|while|for|def|class|try|except|finally|with)\b/);
  return match ? match[1] : '';
}

function suggestAsciiKo(char) {
  if ('“”„'.includes(char)) return '큰따옴표(")를';
  if ('‘’‚'.includes(char)) return '작은따옴표(\')를';
  if ('，、'.includes(char)) return '쉼표(,)를';
  if ('（）'.includes(char)) return '괄호를';
  if ('：'.includes(char)) return '콜론(:)을';
  if ('－—–'.includes(char)) return '빼기 기호(-)를';
  return '같은 기호를';
}

function suggestAsciiEn(char) {
  if ('“”„'.includes(char)) return 'a plain double quote (")';
  if ('‘’‚'.includes(char)) return "a plain single quote (')";
  if ('，、'.includes(char)) return 'a plain comma (,)';
  if ('（）'.includes(char)) return 'plain parentheses';
  if ('：'.includes(char)) return 'a plain colon (:)';
  if ('－—–'.includes(char)) return 'a plain minus (-)';
  return 'the plain symbol';
}

const TYPE_NAMES_KO = {
  str: '문자열', int: '정수', float: '실수', list: '리스트', tuple: '튜플', dict: '딕셔너리', set: '집합',
  NoneType: 'None', bool: '참/거짓 값', vector: 'vector', function: '함수', module: '모듈', range: 'range', string: '문자열',
};
const TYPE_NAMES_EN = {
  str: 'a string', int: 'an integer', float: 'a decimal number', list: 'a list', tuple: 'a tuple', dict: 'a dictionary', set: 'a set',
  NoneType: 'None', bool: 'a boolean', vector: 'a vector', function: 'a function', module: 'a module', range: 'a range', string: 'a string',
};

function describeTypeKo(type) {
  return TYPE_NAMES_KO[type] || `${type} 값`;
}

function describeTypeEn(type) {
  return TYPE_NAMES_EN[type] || `a ${type} value`;
}

/**
 * 구조화된 파이썬 오류를 입문자용 설명으로 바꾼다.
 * @param {{ type?: string, message?: string, line?: number|null, codeLine?: string|null, column?: number|null, mapLine?: (n:number)=>number|null }} error
 * @param {'ko'|'en'} [locale]
 * @returns {{ title: string, explanation: string, hint: string, line: number|null }}
 */
export function explainPythonError(error, locale = 'ko') {
  const lang = locale === 'en' ? 'en' : 'ko';
  const type = String(error?.type || 'Error');
  let message = String(error?.message ?? '').trim();
  if (type === 'KeyError') message = stripQuotes(message);
  const line = Number.isInteger(error?.line) ? error.line : null;
  const ctx = {
    line,
    codeLine: typeof error?.codeLine === 'string' ? error.codeLine : '',
    column: error?.column ?? null,
    mapLine: typeof error?.mapLine === 'function' ? error.mapLine : (n) => n,
  };
  const baseTitle = TITLES[type]?.[lang] || (lang === 'ko' ? `${type} 오류가 발생했습니다` : `${type} occurred`);

  for (const rule of RULES) {
    if (rule.type !== type) continue;
    const match = message.match(rule.pattern);
    if (!match) continue;
    if (rule.when && !rule.when(match, ctx)) continue;
    const result = rule[lang](match, ctx);
    return { title: result.title || baseTitle, explanation: result.explanation, hint: result.hint, line };
  }

  const generic = (GENERIC[type] || GENERIC.default)[lang];
  const nameMatch = message.match(/'(.+?)'/);
  const result = generic({ type, message, name: nameMatch?.[1], key: type === 'KeyError' ? message : undefined });
  return { title: baseTitle, explanation: result.explanation, hint: result.hint, line };
}

/** 줄 번호 표시 문구 */
export function formatErrorLine(line, locale = 'ko') {
  if (!Number.isInteger(line)) return '';
  return locale === 'en' ? `line ${line}` : `${line}번 줄`;
}

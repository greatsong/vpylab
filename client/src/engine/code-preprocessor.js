/**
 * VPyLab 코드 전처리기
 * rate() → await rate(), sleep() → await sleep() 변환
 *
 * 기술 리뷰 결과 반영:
 * - 단순 regex 금지 → 라인 파서 방식
 * - 문자열 리터럴 내부 스킵
 * - 주석 내부 스킵
 * - 이미 await가 앞에 있으면 스킵
 * - lambda 내부에서는 변환 금지 (경고 출력)
 */

/**
 * 문자열이 따옴표 안에 있는지 확인
 * @param {string} line - 코드 라인
 * @param {number} pos - 검사할 위치
 * @returns {boolean}
 */
function isInsideString(line, pos) {
  let inSingle = false;
  let inDouble = false;
  let inTripleSingle = false;
  let inTripleDouble = false;

  for (let i = 0; i < pos; i++) {
    const c = line[i];
    const next2 = line.slice(i, i + 3);

    if (!inSingle && !inDouble) {
      if (next2 === '"""' && !inTripleSingle) {
        if (inTripleDouble) { inTripleDouble = false; i += 2; continue; }
        inTripleDouble = true; i += 2; continue;
      }
      if (next2 === "'''" && !inTripleDouble) {
        if (inTripleSingle) { inTripleSingle = false; i += 2; continue; }
        inTripleSingle = true; i += 2; continue;
      }
    }

    if (inTripleSingle || inTripleDouble) continue;

    if (c === '"' && !inSingle) { inDouble = !inDouble; continue; }
    if (c === "'" && !inDouble) { inSingle = !inSingle; continue; }

    // 이스케이프 문자
    if (c === '\\' && (inSingle || inDouble)) { i++; continue; }
  }

  return inSingle || inDouble || inTripleSingle || inTripleDouble;
}

/**
 * 주석 위치 확인
 * @param {string} line
 * @returns {number} 주석 시작 위치 (-1이면 주석 없음)
 */
function findCommentStart(line) {
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '#' && !isInsideString(line, i)) {
      return i;
    }
  }
  return -1;
}

/**
 * lambda 내부인지 확인
 * @param {string} line
 * @param {number} pos
 * @returns {boolean}
 */
function isInsideLambda(line, pos) {
  // 간단한 휴리스틱: pos 앞에 'lambda'가 있고, ':' 뒤에 있으면 lambda 본문
  const before = line.slice(0, pos);
  const lambdaIdx = before.lastIndexOf('lambda');
  if (lambdaIdx === -1) return false;
  const colonIdx = before.indexOf(':', lambdaIdx);
  return colonIdx !== -1 && colonIdx < pos;
}

/**
 * 변환된 코드의 줄 번호를 학생이 쓴 원래 줄 번호로 되돌린다.
 * @param {(number|null)[]} lineMap - 변환 코드의 i번째 줄(0부터)이 원래 몇 번째 줄(1부터)인지. 삽입된 줄은 null
 * @param {number} generatedLine - 변환 코드의 줄 번호(1부터)
 * @returns {number|null} 원래 줄 번호. 삽입된 줄이거나 범위를 벗어나면 null
 */
export function mapGeneratedLine(lineMap, generatedLine) {
  if (!Array.isArray(lineMap) || !Number.isInteger(generatedLine)) return null;
  return lineMap[generatedLine - 1] ?? null;
}

/**
 * 코드 전처리: rate(), sleep() → await rate(), await sleep()
 * @param {string} code - 학생 Python 코드
 * @returns {{ code: string, warnings: string[], lineMap: (number|null)[] }}
 *   lineMap[i]는 변환 코드 i+1번째 줄에 해당하는 원래 줄 번호(1부터). 삽입된 줄은 null.
 */
export function preprocessCode(code) {
  const lines = code.split('\n');
  const warnings = [];
  // async \ud568\uc218\ub9cc \ud3ec\ud568 \u2014 sync\ub85c \ubcc0\uacbd\ub41c \uc74c\ud45c/\ud654\uc74c\uc740 \uc81c\uc678 (\uc790\ub3d9 \uc21c\ucc28 \ub300\uae30\ub294 \ub0b4\ubd80 time.sleep\uc73c\ub85c \ucc98\ub9ac)
  const ASYNC_FUNCTIONS = ['rate', 'sleep', '\uc545\uae30'];

  const processedLines = lines.map((line, lineNum) => {
    const commentStart = findCommentStart(line);
    // 주석 이전 부분만 처리
    const codePart = commentStart >= 0 ? line.slice(0, commentStart) : line;
    const commentPart = commentStart >= 0 ? line.slice(commentStart) : '';

    let processed = codePart;

    for (let fi = 0; fi < ASYNC_FUNCTIONS.length; fi++) {
      const fn = ASYNC_FUNCTIONS[fi];
      // 앞에 단어문자·점·한글이 있으면 제외 — time.sleep(), 내악기() 오탐 방지
      const pattern = new RegExp(`(?<![\\w.가-힣])(${fn}\\s*\\()`, 'g');
      let match;

      while ((match = pattern.exec(processed)) !== null) {
        const pos = match.index;

        // 문자열 내부면 스킵
        if (isInsideString(processed, pos)) continue;

        // 이미 await가 앞에 있으면 스킵
        const before = processed.slice(0, pos).trimEnd();
        if (before.endsWith('await')) continue;

        // lambda 내부면 경고 + 스킵
        if (isInsideLambda(processed, pos)) {
          warnings.push(`${lineNum + 1}번 줄: lambda 내부의 ${fn}()은 await로 변환할 수 없습니다.`);
          continue;
        }

        // await 삽입
        processed = processed.slice(0, pos) + 'await ' + processed.slice(pos);
        // 패턴 위치 조정 (await + 공백 = 6자)
        pattern.lastIndex = pos + 6 + match[0].length;
      }
    }

    return processed + commentPart;
  });

  // 전체 코드를 async 함수로 감싸기
  const hasAsyncCall = ASYNC_FUNCTIONS.some(fn => {
    const pattern = new RegExp(`await\\s+${fn}\\s*\\(`);
    return pattern.test(processedLines.join('\n'));
  });

  let finalCode = processedLines.join('\n');
  // 감싸지 않으면 줄 번호가 그대로 대응한다.
  let lineMap = processedLines.map((_, index) => index + 1);

  if (hasAsyncCall) {
    // import 문은 모듈 레벨에 유지 (async 함수 안에서 `from X import *`는 SyntaxError)
    const importLines = [];
    const bodyLines = [];

    processedLines.forEach((line, index) => {
      const trimmed = line.trimStart();
      // 모듈 레벨(들여쓰기 없는) import만 추출 — 함수/클래스 내부 import는 그대로 둠
      const isTopLevel = line === trimmed || line.length === trimmed.length;
      const isImport =
        trimmed.startsWith('import ') ||
        (trimmed.startsWith('from ') && trimmed.includes('import'));
      if (isTopLevel && isImport) {
        importLines.push({ text: line, origin: index + 1 });
      } else {
        bodyLines.push({ text: line ? '    ' + line : line, origin: index + 1 });
      }
    });

    // 오류 줄 번호를 되돌릴 수 있도록 생성 줄마다 원래 줄 번호를 기록한다.
    const generated = [
      { text: 'import asyncio', origin: null },
      ...(importLines.length ? importLines : [{ text: '', origin: null }]),
      { text: 'async def __vpylab_main__():', origin: null },
      ...bodyLines,
      { text: '', origin: null },
      { text: 'await __vpylab_main__()', origin: null },
    ];
    finalCode = generated.map(entry => entry.text).join('\n');
    lineMap = generated.map(entry => entry.origin);
  }

  return { code: finalCode, warnings, lineMap };
}

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
 * 코드 전처리: rate(), sleep() → await rate(), await sleep()
 * @param {string} code - 학생 Python 코드
 * @returns {{ code: string, warnings: string[] }}
 */
export function preprocessCode(code) {
  const lines = code.split('\n');
  const warnings = [];
  const ASYNC_FUNCTIONS = ['rate', 'sleep', '\uc74c\ud45c', '\uc545\uae30'];

  // 패턴: 독립적인 rate( 또는 sleep( (앞에 다른 단어 문자가 없는 경우)
  const patterns = ASYNC_FUNCTIONS.map(fn =>
    new RegExp(`(?<!\\w)${fn}\\s*\\(`, 'g')
  );

  const processedLines = lines.map((line, lineNum) => {
    const commentStart = findCommentStart(line);
    // 주석 이전 부분만 처리
    const codePart = commentStart >= 0 ? line.slice(0, commentStart) : line;
    const commentPart = commentStart >= 0 ? line.slice(commentStart) : '';

    let processed = codePart;

    for (let fi = 0; fi < ASYNC_FUNCTIONS.length; fi++) {
      const fn = ASYNC_FUNCTIONS[fi];
      const pattern = new RegExp(`(?<!\\w)(${fn}\\s*\\()`, 'g');
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

  if (hasAsyncCall) {
    // import 문은 모듈 레벨에 유지 (async 함수 안에서 `from X import *`는 SyntaxError)
    const importLines = [];
    const bodyLines = [];

    for (const line of processedLines) {
      const trimmed = line.trimStart();
      if (
        trimmed.startsWith('import ') ||
        trimmed.startsWith('from ') && trimmed.includes('import')
      ) {
        importLines.push(line);
      } else {
        bodyLines.push(line);
      }
    }

    const imports = importLines.join('\n');
    const indented = bodyLines.map(l => l ? '    ' + l : l).join('\n');
    finalCode = `import asyncio\n${imports}\nasync def __vpylab_main__():\n${indented}\n\nawait __vpylab_main__()`;
  }

  return { code: finalCode, warnings };
}

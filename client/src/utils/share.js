/**
 * VPyLab — 코드 공유 유틸리티
 * LZ-String URL 인코딩 + 보안 검증
 *
 * 보안 감사 결과 반영:
 * - 디코딩 후 50KB 상한 검증
 * - 외부 코드 경고 표시
 */

import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';

const MAX_CODE_SIZE = 50_000; // 50KB 상한

/**
 * 코드를 URL 해시로 인코딩
 * @param {string} code
 * @returns {string} 공유 URL
 */
export function encodeCodeToURL(code) {
  if (code.length > MAX_CODE_SIZE) {
    throw new Error('코드가 너무 깁니다 (50KB 초과)');
  }
  const compressed = compressToEncodedURIComponent(code);
  return `${window.location.origin}/sandbox#code=${compressed}`;
}

/**
 * URL 해시에서 코드 디코딩
 * @returns {{ code: string|null, isExternal: boolean }}
 */
export function decodeCodeFromURL() {
  const hash = window.location.hash;
  if (!hash || !hash.startsWith('#code=')) {
    return { code: null, isExternal: false };
  }

  try {
    const compressed = hash.slice(6); // '#code=' 제거
    const decoded = decompressFromEncodedURIComponent(compressed);

    if (!decoded) {
      return { code: null, isExternal: false };
    }

    // 보안: 50KB 상한 검증
    if (decoded.length > MAX_CODE_SIZE) {
      console.warn('[Share] 코드 크기 초과:', decoded.length);
      return { code: null, isExternal: false, error: 'tooLarge' };
    }

    return { code: decoded, isExternal: true };
  } catch (err) {
    console.warn('[Share] URL 디코딩 실패:', err);
    return { code: null, isExternal: false };
  }
}

/**
 * 코드 URL을 클립보드에 복사
 * @param {string} code
 * @returns {Promise<boolean>}
 */
export async function copyCodeLink(code) {
  try {
    const url = encodeCodeToURL(code);
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    return false;
  }
}

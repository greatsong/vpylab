/**
 * VPyLab — 코드 공유 유틸리티
 * 짧은 URL 방식 (/s/abc12345) + LZ-String 하위 호환
 */

import { nanoid } from 'nanoid';
import { supabase } from '../lib/supabase';
import { decompressFromEncodedURIComponent } from 'lz-string';

const MAX_CODE_SIZE = 50_000; // 50KB 상한
const SHARE_ID_LENGTH = 8;

/**
 * 코드를 Supabase에 저장하고 짧은 URL 반환
 * @param {string} code
 * @param {string} [title]
 * @returns {Promise<{ url: string|null, error: string|null }>}
 */
export async function createShareLink(code, title = '제목 없음') {
  if (code.length > MAX_CODE_SIZE) {
    return { url: null, error: '코드가 너무 깁니다 (50KB 초과)' };
  }

  // 현재 로그인 사용자 (없으면 null)
  const { data: { user } } = await supabase.auth.getUser();

  // nanoid로 짧은 ID 생성, 충돌 시 재시도
  for (let attempt = 0; attempt < 3; attempt++) {
    const id = nanoid(SHARE_ID_LENGTH);
    const { error } = await supabase
      .from('vpylab_shares')
      .insert({ id, code, title, user_id: user?.id || null });

    if (!error) {
      const url = `${window.location.origin}/s/${id}`;
      return { url, error: null };
    }

    // PK 충돌이면 재시도, 다른 에러면 반환
    if (!error.message?.includes('duplicate')) {
      return { url: null, error: error.message };
    }
  }

  return { url: null, error: '공유 링크 생성 실패' };
}

/**
 * 공유 ID로 코드 조회
 * @param {string} shareId
 * @returns {Promise<{ code: string|null, title: string|null, error: string|null }>}
 */
export async function loadSharedCode(shareId) {
  const { data, error } = await supabase
    .from('vpylab_shares')
    .select('code, title')
    .eq('id', shareId)
    .single();

  if (error || !data) {
    return { code: null, title: null, error: '공유 코드를 찾을 수 없습니다' };
  }

  return { code: data.code, title: data.title, error: null };
}

/**
 * 코드 공유 URL을 클립보드에 복사
 * @param {string} code
 * @param {string} [title]
 * @returns {Promise<boolean>}
 */
export async function copyCodeLink(code, title) {
  const { url, error } = await createShareLink(code, title);
  if (error || !url) return false;

  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * URL 해시에서 코드 디코딩 (LZ-String 하위 호환)
 * 기존 #code= 형식 링크가 여전히 동작하도록 유지
 * @returns {{ code: string|null, isExternal: boolean }}
 */
export function decodeCodeFromURL() {
  const hash = window.location.hash;
  if (!hash || !hash.startsWith('#code=')) {
    return { code: null, isExternal: false };
  }

  try {
    const compressed = hash.slice(6);
    const decoded = decompressFromEncodedURIComponent(compressed);

    if (!decoded) {
      return { code: null, isExternal: false };
    }

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

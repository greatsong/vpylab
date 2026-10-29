/**
 * 임베드(iframe) 주소와 코드.
 * /embed/:id 는 갤러리 작품(uuid) 또는 공유 코드(nanoid 8자)를 3D 화면만으로 보여 줍니다.
 */
export const PUBLIC_ORIGIN = 'https://vpylab.vercel.app';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isGalleryId(id) {
  return UUID.test(String(id || ''));
}

/** 배포 주소를 기본으로 쓰고, 로컬 개발 서버에서는 현재 출처를 써서 바로 확인할 수 있게 합니다. */
export function shareOrigin() {
  if (typeof window === 'undefined') return PUBLIC_ORIGIN;
  const host = window.location?.hostname || '';
  if (/^(localhost|127\.0\.0\.1|\[::1\])$/.test(host) || host.endsWith('.local')) return window.location.origin;
  return PUBLIC_ORIGIN;
}

/** 작품·공유 코드의 일반 페이지 주소 (/gallery/:id 또는 /s/:id) */
export function workUrl(id, origin = shareOrigin()) {
  const path = isGalleryId(id) ? `/gallery/${id}` : `/s/${encodeURIComponent(id)}`;
  return `${origin}${path}`;
}

export function embedUrl(id, origin = shareOrigin()) {
  return `${origin}/embed/${encodeURIComponent(id)}`;
}

export function embedCode(id, { width = 800, height = 500, origin } = {}) {
  return `<iframe src="${embedUrl(id, origin)}" width="${width}" height="${height}" allow="autoplay; fullscreen" loading="lazy" title="VPyLab"></iframe>`;
}

export async function copyEmbedCode(id, options) {
  try {
    await navigator.clipboard.writeText(embedCode(id, options));
    return true;
  } catch {
    return false;
  }
}

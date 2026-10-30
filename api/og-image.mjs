/**
 * GET /api/og-image?id=<갤러리 uuid>
 * 갤러리 썸네일이 data URI로 저장되어 있을 때 og:image가 가리키는 실제 이미지 URL입니다.
 * 디코드해 저장된 MIME(JPEG·PNG·WebP) 그대로 돌려주고 하루 캐시합니다. URL 썸네일은 그쪽으로 보냅니다.
 * 비공개·없는 작품은 기본 카드 이미지로 보냅니다.
 */
import { DEFAULT_CARD, UUID, fetchRow, requestOrigin, requestQuery } from './_lib/og.mjs';

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_DATA_URI_LENGTH = 3 * 1024 * 1024; // 디코딩 전에 문자열 길이부터 막습니다.
const DATA_URI = /^data:(image\/(?:png|jpeg|jpg|webp));base64,([A-Za-z0-9+/=\s]+)$/;

/** 디코드한 바이트가 선언한 형식의 실제 이미지인지(매직 바이트) 확인합니다. */
export function matchesMagic(mime, buffer) {
  if (!buffer || buffer.length < 12) return false;
  if (mime === 'image/png') return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (mime === 'image/jpeg') return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (mime === 'image/webp') return buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  return false;
}

function redirect(res, location) {
  res.statusCode = 302;
  res.setHeader('Location', location);
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300');
  res.end();
}

export function createOgImageHandler({ env = process.env, fetchImpl = globalThis.fetch, cwd = process.cwd() } = {}) {
  return async function handler(req, res) {
    const { id } = requestQuery(req);
    const fallback = `${requestOrigin(req)}${DEFAULT_CARD.imagePath}`;
    if (typeof id !== 'string' || !UUID.test(id)) return redirect(res, fallback);

    const row = await fetchRow({ table: 'vpylab_gallery', id, select: 'thumbnail', filter: '&is_public=eq.true', env, cwd, fetchImpl });
    const thumbnail = typeof row?.thumbnail === 'string' ? row.thumbnail.trim() : '';
    if (/^https:\/\//.test(thumbnail)) return redirect(res, thumbnail);

    if (thumbnail.length > MAX_DATA_URI_LENGTH) return redirect(res, fallback);
    const match = DATA_URI.exec(thumbnail);
    if (!match) return redirect(res, fallback);
    const mime = match[1] === 'image/jpg' ? 'image/jpeg' : match[1];
    let buffer;
    try {
      buffer = Buffer.from(match[2].replace(/\s+/g, ''), 'base64');
    } catch {
      return redirect(res, fallback);
    }
    if (!buffer.length || buffer.length > MAX_IMAGE_BYTES || !matchesMagic(mime, buffer)) return redirect(res, fallback);

    res.statusCode = 200;
    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Length', String(buffer.length));
    // 비공개 전환·삭제가 반영되도록 한 시간만 캐시합니다(메신저 쪽 캐시는 별도).
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.end(buffer);
  };
}

export default createOgImageHandler();

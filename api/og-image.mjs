/**
 * GET /api/og-image?id=<갤러리 uuid>
 * 갤러리 썸네일이 data URI로 저장되어 있을 때 og:image가 가리키는 실제 이미지 URL입니다.
 * 디코드해 저장된 MIME(JPEG·PNG·WebP) 그대로 돌려주고 하루 캐시합니다. URL 썸네일은 그쪽으로 보냅니다.
 * 비공개·없는 작품은 기본 카드 이미지로 보냅니다.
 */
import { DEFAULT_CARD, UUID, fetchRow, requestOrigin, requestQuery } from './_lib/og.mjs';

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const DATA_URI = /^data:(image\/(?:png|jpeg|jpg|webp));base64,([A-Za-z0-9+/=\s]+)$/;

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

    const match = DATA_URI.exec(thumbnail);
    if (!match) return redirect(res, fallback);
    const mime = match[1] === 'image/jpg' ? 'image/jpeg' : match[1];
    let buffer;
    try {
      buffer = Buffer.from(match[2].replace(/\s+/g, ''), 'base64');
    } catch {
      return redirect(res, fallback);
    }
    if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) return redirect(res, fallback);

    res.statusCode = 200;
    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Length', String(buffer.length));
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.end(buffer);
  };
}

export default createOgImageHandler();

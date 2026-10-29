/**
 * 공유 미리보기 카드(Open Graph) 공통 모듈 — Vercel 서버리스 함수 api/og.mjs, api/og-image.mjs가 씁니다.
 *
 * /s/:id(공유 코드)와 /gallery/:id(갤러리 작품)를 카카오톡·구글 클래스룸·Slack에 붙였을 때
 * 제목·설명·그림이 보이도록, 빌드된 index.html의 <head>에 og:* 메타만 주입해 돌려줍니다.
 * 사람 브라우저에는 같은 HTML이 앱 셸로 동작하므로 클라이언트 라우팅은 그대로입니다.
 *
 * Supabase는 공개 anon 키로 읽기만 합니다(RLS가 공개 작품만 허용). 비공개·삭제된 작품은 기본 카드만 보여 줍니다.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const SITE_ORIGIN = 'https://vpylab.vercel.app';
export const DEFAULT_CARD = Object.freeze({
  title: 'VPyLab — Python으로 만드는 3D 세계',
  description: '설치 없이 브라우저에서 바로 실행하고 링크 하나로 공유하는 3D 프로그래밍 교육 플랫폼',
  imagePath: '/brand/og-default.png',
});

export const SHARE_ID = /^[A-Za-z0-9_-]{4,32}$/;
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const FETCH_TIMEOUT_MS = 3000;
const MAX_DESCRIPTION = 200;

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

let fileEnvCache = null;

/**
 * 빌드용 Supabase 값은 커밋된 client/.env.production(공개 anon 키)에서 오므로, Vercel 프로젝트
 * 환경변수가 없을 때는 함수 번들에 포함한 그 파일을 읽습니다. cwd를 넘길 때만 읽습니다.
 */
export function fileEnv(cwd) {
  if (!cwd) return {};
  if (fileEnvCache) return fileEnvCache;
  const out = {};
  for (const candidate of ['client/.env.production', '.env.production']) {
    try {
      for (const line of readFileSync(resolve(cwd, candidate), 'utf8').split(/\r?\n/)) {
        const match = /^\s*(VITE_SUPABASE_URL|VITE_SUPABASE_ANON_KEY)\s*=\s*(.*?)\s*$/.exec(line);
        if (match && !(match[1] in out)) out[match[1]] = match[2].replace(/^["']|["']$/g, '');
      }
      break;
    } catch { /* 다음 후보 */ }
  }
  fileEnvCache = out;
  return out;
}

/** Vercel 환경변수(VITE_ 접두어 또는 SUPABASE_*)를 먼저 쓰고, 없으면 번들의 .env.production을 씁니다. */
export function supabaseEnv(env = process.env, cwd) {
  const fallback = fileEnv(cwd);
  const url = (env.VITE_SUPABASE_URL || env.SUPABASE_URL || fallback.VITE_SUPABASE_URL || '').trim().replace(/\/$/, '');
  const key = (env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || fallback.VITE_SUPABASE_ANON_KEY || '').trim();
  return url && key ? { url, key } : null;
}

/** 요청 출처(https://host). Vercel은 x-forwarded-host를 둡니다. */
export function requestOrigin(req) {
  const host = req.headers?.['x-forwarded-host'] || req.headers?.host;
  if (!host) return SITE_ORIGIN;
  const proto = req.headers?.['x-forwarded-proto'] || 'https';
  return `${proto}://${host}`;
}

export function requestQuery(req) {
  if (req.query && typeof req.query === 'object') return req.query;
  try {
    const url = new URL(req.url || '/', 'http://localhost');
    return Object.fromEntries(url.searchParams.entries());
  } catch {
    return {};
  }
}

/** Supabase REST에서 한 행을 읽습니다. 실패·시간 초과·없음은 모두 null입니다. */
export async function fetchRow({ table, id, select, filter = '', env, cwd, fetchImpl = globalThis.fetch }) {
  const supabase = supabaseEnv(env, cwd);
  if (!supabase || typeof fetchImpl !== 'function') return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const url = `${supabase.url}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}&select=${encodeURIComponent(select)}${filter}&limit=1`;
    const res = await fetchImpl(url, {
      headers: { apikey: supabase.key, Authorization: `Bearer ${supabase.key}`, Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const rows = await res.json();
    return Array.isArray(rows) && rows[0] && typeof rows[0] === 'object' ? rows[0] : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function clip(text, max = MAX_DESCRIPTION) {
  const flat = String(text || '').replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

/**
 * 카드 정보를 만듭니다.
 * @returns {Promise<{ title, description, image, url, found: boolean }>}
 */
export async function buildCard({ kind, id, origin = SITE_ORIGIN, env, cwd, fetchImpl }) {
  const fallback = {
    title: DEFAULT_CARD.title,
    description: DEFAULT_CARD.description,
    image: `${origin}${DEFAULT_CARD.imagePath}`,
    url: origin,
    found: false,
  };

  if (kind === 'share' && SHARE_ID.test(id || '')) {
    const row = await fetchRow({ table: 'vpylab_shares', id, select: 'title', env, cwd, fetchImpl });
    if (!row) return fallback;
    return {
      title: `${clip(row.title, 80) || '제목 없음'} · VPyLab`,
      description: '공유된 Python 3D 코드입니다. 링크를 열면 VPyLab에서 바로 실행됩니다.',
      image: fallback.image,
      url: `${origin}/s/${id}`,
      found: true,
    };
  }

  if (kind === 'gallery' && UUID.test(id || '')) {
    const row = await fetchRow({
      table: 'vpylab_gallery', id, select: 'title,description,thumbnail,author_alias', filter: '&is_public=eq.true', env, cwd, fetchImpl,
    });
    if (!row) return fallback;
    const thumbnail = typeof row.thumbnail === 'string' ? row.thumbnail : '';
    let image = fallback.image;
    if (/^https:\/\//.test(thumbnail)) image = thumbnail;
    else if (thumbnail.startsWith('data:image/')) image = `${origin}/api/og-image?id=${encodeURIComponent(id)}`;
    const author = clip(row.author_alias, 40);
    return {
      title: `${clip(row.title, 80) || '제목 없음'} · VPyLab`,
      description: clip(row.description) || (author ? `${author}님이 VPyLab 갤러리에 공개한 3D 작품입니다.` : 'VPyLab 갤러리에 공개된 3D 작품입니다.'),
      image,
      url: `${origin}/gallery/${id}`,
      found: true,
    };
  }

  return fallback;
}

export function renderMetaTags(card) {
  const t = escapeHtml(card.title);
  const d = escapeHtml(card.description);
  const i = escapeHtml(card.image);
  const u = escapeHtml(card.url);
  return [
    '<meta property="og:type" content="website" />',
    '<meta property="og:site_name" content="VPyLab" />',
    `<meta property="og:title" content="${t}" />`,
    `<meta property="og:description" content="${d}" />`,
    `<meta property="og:image" content="${i}" />`,
    `<meta property="og:url" content="${u}" />`,
    '<meta name="twitter:card" content="summary_large_image" />',
    `<meta name="twitter:title" content="${t}" />`,
    `<meta name="twitter:description" content="${d}" />`,
    `<meta name="twitter:image" content="${i}" />`,
  ].join('\n    ');
}

/** index.html의 기본 og/twitter 메타·제목·설명을 카드 값으로 바꿉니다. */
export function injectMeta(html, card) {
  let out = String(html)
    .replace(/[ \t]*<meta\s+(?:property|name)="(?:og|twitter):[^"]*"[^>]*\/?>\s*\n?/g, '')
    .replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(card.title)}</title>`)
    .replace(/<meta\s+name="description"\s+content="[^"]*"\s*\/?>/, `<meta name="description" content="${escapeHtml(card.description)}" />`);
  const tags = `    ${renderMetaTags(card)}\n`;
  if (out.includes('</head>')) out = out.replace('</head>', `${tags}  </head>`);
  else out = tags + out;
  return out;
}

let shellCache = null;

/** 빌드된 index.html. 함수 번들(includeFiles)에서 먼저 찾고, 없으면 배포 자체에서 받아 옵니다. */
export async function loadShell({ origin = SITE_ORIGIN, fetchImpl = globalThis.fetch, cwd = process.cwd(), cache = true } = {}) {
  if (cache && shellCache) return shellCache;
  for (const candidate of ['client/dist/index.html', 'dist/index.html', 'index.html']) {
    try {
      const html = readFileSync(resolve(cwd, candidate), 'utf8');
      if (html.includes('<div id="root">')) {
        if (cache) shellCache = html;
        return html;
      }
    } catch { /* 다음 후보 */ }
  }
  try {
    const res = await fetchImpl(`${origin}/index.html`, { headers: { Accept: 'text/html' } });
    if (res.ok) {
      const html = await res.text();
      if (html.includes('<div id="root">')) {
        if (cache) shellCache = html;
        return html;
      }
    }
  } catch { /* 아래에서 최소 HTML로 대체 */ }
  return null;
}

/** 앱 셸을 못 찾았을 때의 최소 HTML. 메타는 넣고 사람은 홈으로 보냅니다. */
export function minimalShell(card) {
  return `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(card.title)}</title>
    <meta name="description" content="${escapeHtml(card.description)}" />
    ${renderMetaTags(card)}
  </head>
  <body>
    <p><a href="${escapeHtml(card.url)}">${escapeHtml(card.title)}</a></p>
  </body>
</html>
`;
}

export function resetShellCache() { shellCache = null; fileEnvCache = null; }

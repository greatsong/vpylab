/**
 * GET /api/og?kind=share|gallery&id=…
 * vercel.json이 /s/:id와 /gallery/:id를 이 함수로 보냅니다. 빌드된 index.html에 작품의 og:* 메타를 주입해
 * 돌려주므로 메신저에는 카드가, 사람에게는 앱이 그대로 보입니다.
 */
import { buildCard, injectMeta, loadShell, minimalShell, requestOrigin, requestQuery } from './_lib/og.mjs';

export function createOgHandler({ env = process.env, fetchImpl = globalThis.fetch, cwd = process.cwd() } = {}) {
  return async function handler(req, res) {
    const { kind, id } = requestQuery(req);
    const origin = requestOrigin(req);
    const card = await buildCard({ kind, id: typeof id === 'string' ? id : '', origin, env, cwd, fetchImpl });
    const shell = await loadShell({ origin, fetchImpl, cwd });
    const html = shell ? injectMeta(shell, card) : minimalShell(card);

    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    // 앱 셸은 배포마다 바뀌므로 짧게만 엣지에 둡니다(Vercel 캐시는 배포 단위로 분리됩니다).
    res.setHeader('Cache-Control', card.found
      ? 'public, max-age=0, s-maxage=60, stale-while-revalidate=300'
      : 'public, max-age=0, s-maxage=30');
    res.setHeader('X-VPyLab-Card', card.found ? 'found' : 'default');
    res.end(html);
  };
}

export default createOgHandler();

/**
 * VPyLab — GitHub Pages 발행 API
 *
 * 보안 설계:
 * - GitHub token은 DB에 저장하지 않음 (요청 시 전송, 메모리에서만 사용)
 * - 리포 이름 sanitize (특수문자 제거, 슬래시 인젝션 방지)
 * - HTML 내용 크기 제한 (500KB)
 * - rate-limit: 사용자당 분당 3회
 * - GitHub API 호출은 서버에서만 (클라이언트에 token 노출 최소화)
 */

import { Router } from 'express';
import rateLimit from 'express-rate-limit';

const router = Router();

// 발행 전용 rate-limit (분당 3회)
const publishLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 3,
  message: { error: '잠시 후 다시 시도해주세요. (분당 3회 제한)' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * 리포지토리 이름 sanitize
 * 보안: 경로 순회(../) 및 특수문자 인젝션 방지
 */
function sanitizeRepoName(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s-]/g, '')  // 영문/숫자/한글/공백/하이픈만 허용
    .replace(/\s+/g, '-')               // 공백 → 하이픈
    .replace(/-+/g, '-')                // 연속 하이픈 제거
    .replace(/^-|-$/g, '')              // 앞뒤 하이픈 제거
    .slice(0, 50)                       // 최대 50자
    || 'vpylab-project';                // 빈 문자열 방지
}

/**
 * 코드 내 민감 정보 검사
 * 보안: API 키, 이메일, 비밀번호 패턴 경고
 */
function checkSensitiveContent(code) {
  const warnings = [];

  // API 키 패턴
  if (/(?:api[_-]?key|secret|token|password)\s*[=:]\s*['"][^'"]{10,}/i.test(code)) {
    warnings.push('코드에 API 키 또는 비밀번호가 포함된 것 같습니다.');
  }

  // 이메일 패턴
  if (/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g.test(code)) {
    warnings.push('코드에 이메일 주소가 포함되어 있습니다.');
  }

  return warnings;
}

/**
 * GitHub API 호출 헬퍼 (에러 처리 포함)
 */
async function githubFetch(url, token, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg = body.message || `GitHub API ${res.status}`;
    throw new Error(msg);
  }

  return res.json();
}

/**
 * POST /api/publish
 * Body: { code, title, githubToken }
 * Returns: { githubUrl, githubRepo, warnings }
 */
router.post('/', publishLimiter, async (req, res) => {
  try {
    const { code, title, githubToken } = req.body;

    // === 입력 검증 ===
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: '코드가 비어있습니다.' });
    }
    if (!title || typeof title !== 'string') {
      return res.status(400).json({ error: '제목을 입력해주세요.' });
    }
    if (!githubToken || typeof githubToken !== 'string') {
      return res.status(401).json({ error: 'GitHub 로그인이 필요합니다.' });
    }

    // HTML 콘텐츠 크기 제한 (클라이언트가 생성한 HTML을 보냄, ~500KB 이내)
    if (code.length > 500 * 1024) {
      return res.status(400).json({ error: '코드가 너무 큽니다. (최대 500KB)' });
    }

    // 민감 정보 검사
    const warnings = checkSensitiveContent(code);

    // === 1단계: GitHub 사용자 정보 확인 ===
    const user = await githubFetch('https://api.github.com/user', githubToken);
    const owner = user.login;

    // === 2단계: 리포 이름 결정 ===
    const repoName = `vpylab-${sanitizeRepoName(title)}`;

    // === 3단계: 리포 확인/생성 ===
    let repoExists = false;
    try {
      await githubFetch(`https://api.github.com/repos/${owner}/${repoName}`, githubToken);
      repoExists = true;
    } catch {
      // 리포 없음 → 생성
    }

    if (!repoExists) {
      await githubFetch('https://api.github.com/user/repos', githubToken, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: repoName,
          description: `VPyLab — ${title}`,
          homepage: `https://${owner}.github.io/${repoName}/`,
          auto_init: true,         // README 자동 생성 (빈 리포 방지)
          has_issues: false,
          has_wiki: false,
        }),
      });

      // 리포 생성 직후 약간의 딜레이 (GitHub 내부 처리)
      await new Promise(r => setTimeout(r, 1500));
    }

    // === 4단계: index.html 커밋 ===
    // 기존 파일이 있으면 sha 필요 (업데이트)
    let existingSha = null;
    try {
      const existing = await githubFetch(
        `https://api.github.com/repos/${owner}/${repoName}/contents/index.html`,
        githubToken,
      );
      existingSha = existing.sha;
    } catch {
      // 파일 없음 (새 생성)
    }

    // HTML 생성은 클라이언트에서 했으므로 코드만 받아서 간단한 래퍼 사용
    // 실제로는 클라이언트에서 generateStandaloneHTML() 결과를 보내야 함
    // 여기서는 code 필드에 이미 완성된 HTML이 들어온다고 가정
    const htmlContent = code;
    const contentBase64 = Buffer.from(htmlContent, 'utf-8').toString('base64');

    const commitBody = {
      message: `🚀 VPyLab에서 발행: ${title}`,
      content: contentBase64,
      branch: 'main',
    };
    if (existingSha) {
      commitBody.sha = existingSha;  // 기존 파일 업데이트
    }

    await githubFetch(
      `https://api.github.com/repos/${owner}/${repoName}/contents/index.html`,
      githubToken,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(commitBody),
      },
    );

    // === 5단계: GitHub Pages 활성화 ===
    try {
      await githubFetch(
        `https://api.github.com/repos/${owner}/${repoName}/pages`,
        githubToken,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            source: { branch: 'main', path: '/' },
          }),
        },
      );
    } catch {
      // 이미 Pages가 활성화된 경우 무시 (409 Conflict)
    }

    // === 결과 반환 ===
    const githubUrl = `https://${owner}.github.io/${repoName}/`;
    const githubRepo = `${owner}/${repoName}`;

    res.json({
      success: true,
      githubUrl,
      githubRepo,
      warnings,
    });
  } catch (err) {
    console.error('[Publish] 오류:', err.message);

    // GitHub token 관련 에러
    if (err.message.includes('Bad credentials') || err.message.includes('401')) {
      return res.status(401).json({ error: 'GitHub 인증이 만료되었습니다. 다시 로그인해주세요.' });
    }
    // GitHub rate limit
    if (err.message.includes('rate limit')) {
      return res.status(429).json({ error: 'GitHub API 한도에 도달했습니다. 잠시 후 다시 시도해주세요.' });
    }

    res.status(500).json({ error: '발행 중 오류가 발생했습니다.' });
  }
});

/**
 * GET /api/publish/fetch
 * GitHub 리포에서 index.html을 읽어 Python 코드를 추출
 * Query: repo=owner/repoName&githubToken=xxx
 */
router.get('/fetch', async (req, res) => {
  try {
    const { repo, githubToken } = req.query;

    if (!repo || !githubToken) {
      return res.status(400).json({ error: 'repo와 githubToken이 필요합니다.' });
    }

    // index.html 읽기
    const file = await githubFetch(
      `https://api.github.com/repos/${repo}/contents/index.html`,
      githubToken,
    );

    const html = Buffer.from(file.content, 'base64').toString('utf-8');

    // Base64로 임베딩된 Python 코드 추출
    const match = html.match(/atob\('([A-Za-z0-9+/=]+)'\)/);
    let code = '';
    if (match) {
      code = Buffer.from(match[1], 'base64').toString('utf-8');
    }

    // 제목 추출
    const titleMatch = html.match(/<title>(.+?)(?:\s*[—·-]\s*VPyLab)?<\/title>/);
    const title = titleMatch ? titleMatch[1].trim() : '';

    res.json({ code, title, sha: file.sha });
  } catch (err) {
    console.error('[Fetch] 오류:', err.message);
    if (err.message.includes('Bad credentials') || err.message.includes('401')) {
      return res.status(401).json({ error: 'GitHub 인증이 만료되었습니다.' });
    }
    res.status(500).json({ error: '코드를 가져오는 중 오류가 발생했습니다.' });
  }
});

/**
 * PUT /api/publish/update
 * 기존 GitHub 리포의 index.html을 업데이트
 * Body: { githubRepo, title, code (완성 HTML), githubToken }
 */
router.put('/update', publishLimiter, async (req, res) => {
  try {
    const { githubRepo, title, code, githubToken } = req.body;

    if (!githubRepo || !code || !githubToken) {
      return res.status(400).json({ error: '필수 항목이 누락되었습니다.' });
    }

    if (code.length > 500 * 1024) {
      return res.status(400).json({ error: '코드가 너무 큽니다. (최대 500KB)' });
    }

    // 기존 파일 sha 조회
    let existingSha = null;
    try {
      const existing = await githubFetch(
        `https://api.github.com/repos/${githubRepo}/contents/index.html`,
        githubToken,
      );
      existingSha = existing.sha;
    } catch {
      // 파일이 없으면 새로 생성
    }

    const contentBase64 = Buffer.from(code, 'utf-8').toString('base64');
    const commitBody = {
      message: `✏️ VPyLab에서 업데이트: ${title || '작품 수정'}`,
      content: contentBase64,
      branch: 'main',
    };
    if (existingSha) commitBody.sha = existingSha;

    await githubFetch(
      `https://api.github.com/repos/${githubRepo}/contents/index.html`,
      githubToken,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(commitBody),
      },
    );

    const [owner, repoName] = githubRepo.split('/');
    res.json({
      success: true,
      githubUrl: `https://${owner}.github.io/${repoName}/`,
    });
  } catch (err) {
    console.error('[Update] 오류:', err.message);
    if (err.message.includes('Bad credentials') || err.message.includes('401')) {
      return res.status(401).json({ error: 'GitHub 인증이 만료되었습니다.' });
    }
    res.status(500).json({ error: '업데이트 중 오류가 발생했습니다.' });
  }
});

/**
 * POST /api/publish/fork
 * 다른 사용자의 리포를 fork
 * Body: { sourceRepo, githubToken }
 */
router.post('/fork', publishLimiter, async (req, res) => {
  try {
    const { sourceRepo, githubToken } = req.body;

    if (!sourceRepo || !githubToken) {
      return res.status(400).json({ error: '필수 항목이 누락되었습니다.' });
    }

    // Fork API
    const forked = await githubFetch(
      `https://api.github.com/repos/${sourceRepo}/forks`,
      githubToken,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      },
    );

    // fork 완료 대기 (GitHub 비동기 처리)
    await new Promise(r => setTimeout(r, 2000));

    // GitHub Pages 활성화
    try {
      await githubFetch(
        `https://api.github.com/repos/${forked.full_name}/pages`,
        githubToken,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ source: { branch: 'main', path: '/' } }),
        },
      );
    } catch {
      // 이미 활성화된 경우
    }

    res.json({
      success: true,
      forkedRepo: forked.full_name,
      githubUrl: `https://${forked.owner.login}.github.io/${forked.name}/`,
    });
  } catch (err) {
    console.error('[Fork] 오류:', err.message);
    if (err.message.includes('Bad credentials') || err.message.includes('401')) {
      return res.status(401).json({ error: 'GitHub 인증이 만료되었습니다.' });
    }
    res.status(500).json({ error: 'Fork 중 오류가 발생했습니다.' });
  }
});

export default router;

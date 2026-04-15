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
import crypto from 'crypto';
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
    const err = new Error(msg);
    err.status = res.status;
    err.githubErrors = body.errors; // GitHub API 상세 에러
    throw err;
  }

  return res.json();
}

/**
 * GitHub Contents API로 단일 파일 커밋 헬퍼
 * 기존 파일이 있으면 업데이트, 없으면 생성
 */
async function commitFile(owner, repoName, path, content, message, token) {
  let existingSha = null;
  try {
    const existing = await githubFetch(
      `https://api.github.com/repos/${owner}/${repoName}/contents/${path}`,
      token,
    );
    existingSha = existing.sha;
  } catch { /* 파일 없음 */ }

  const body = {
    message,
    content: Buffer.from(content, 'utf-8').toString('base64'),
    branch: 'main',
  };
  if (existingSha) body.sha = existingSha;

  await githubFetch(
    `https://api.github.com/repos/${owner}/${repoName}/contents/${path}`,
    token,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
}

/**
 * README.md 자동 생성
 */
function generateReadme(title, description, owner, repoName, remixFrom) {
  let readme = `# ${title}\n\n> VPyLab에서 만든 3D Python 작품\n\n${description || ''}\n\n`;
  readme += `## 실행하기\n[VPyLab에서 열기](https://vpylab.com) | [GitHub Pages](https://${owner}.github.io/${repoName}/)\n\n`;
  if (remixFrom) {
    readme += `## 원본\n이 작품은 [원본 작품](${remixFrom})에서 영감을 받았습니다.\n\n`;
  }
  readme += `---\n*VPyLab — 3D 프로그래밍 교육 플랫폼*\n`;
  return readme;
}

/**
 * vpylab.json 메타데이터 생성
 */
function generateMeta(title, category, remixFrom) {
  return JSON.stringify({
    title,
    category: category || 'free',
    remixFrom: remixFrom || null,
    vpylabVersion: '1.0',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }, null, 2);
}

/**
 * POST /api/publish
 * Body: { code, pythonCode, title, description, category, remixFrom, existingRepo, githubToken }
 * Returns: { githubUrl, githubRepo, warnings }
 */
router.post('/', publishLimiter, async (req, res) => {
  try {
    const { code, pythonCode, title, description, category, remixFrom, existingRepo, githubToken } = req.body;

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
    if (pythonCode) {
      warnings.push(...checkSensitiveContent(pythonCode));
    }

    // === 1단계: GitHub 사용자 정보 확인 ===
    const user = await githubFetch('https://api.github.com/user', githubToken);
    const owner = user.login;

    // === 2단계: 리포 이름 결정 (기존 리포가 있으면 재사용) ===
    let repoName;
    if (existingRepo) {
      repoName = existingRepo.split('/').pop();
    } else {
      const uid = crypto.randomUUID().slice(0, 6);
      repoName = `vpylab-${sanitizeRepoName(title)}-${uid}`;
    }

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
          description: `VPyLab 3D Python 작품 — ${title}`,
          homepage: `https://${owner}.github.io/${repoName}/`,
          auto_init: true,         // README 자동 생성 (빈 리포 방지)
          has_issues: true,
          has_wiki: false,
        }),
      });

      // 리포 생성 직후 약간의 딜레이 (GitHub 내부 처리)
      await new Promise(r => setTimeout(r, 1500));
    }

    // === 4단계: 멀티 파일 커밋 ===
    const commitMsg = repoExists
      ? `✏️ VPyLab에서 업데이트: ${title}`
      : `🚀 VPyLab에서 발행: ${title}`;

    // main.py — 순수 Python 소스 (있으면 커밋)
    if (pythonCode) {
      await commitFile(owner, repoName, 'main.py', pythonCode, commitMsg, githubToken);
    }

    // vpylab.json — 메타데이터
    await commitFile(owner, repoName, 'vpylab.json', generateMeta(title, category, remixFrom), commitMsg, githubToken);

    // README.md — 자동 생성
    await commitFile(owner, repoName, 'README.md', generateReadme(title, description, owner, repoName, remixFrom), commitMsg, githubToken);

    // index.html — 완성 HTML (기존과 동일)
    await commitFile(owner, repoName, 'index.html', code, commitMsg, githubToken);

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
    console.error('[Publish] 오류:', err.message, err.githubErrors || '');

    // GitHub token 관련 에러
    if (err.status === 401 || err.message.includes('Bad credentials')) {
      return res.status(401).json({ error: 'GitHub 인증이 만료되었습니다. 다시 로그인해주세요.' });
    }
    // GitHub rate limit
    if (err.status === 429 || err.message.includes('rate limit')) {
      return res.status(429).json({ error: 'GitHub API 한도에 도달했습니다. 잠시 후 다시 시도해주세요.' });
    }
    // GitHub 403 (scope 부족 등)
    if (err.status === 403) {
      return res.status(403).json({ error: `GitHub 권한이 부족합니다: ${err.message}` });
    }
    // GitHub 422 (유효성 에러)
    if (err.status === 422) {
      const detail = err.githubErrors?.map(e => e.message).join(', ') || err.message;
      return res.status(422).json({ error: `GitHub 요청 오류: ${detail}` });
    }

    res.status(500).json({ error: `발행 중 오류: ${err.message}` });
  }
});

/**
 * POST /api/publish/fetch
 * GitHub 리포에서 index.html을 읽어 Python 코드를 추출
 * Body: { repo, githubToken }
 * 보안: 토큰을 URL 쿼리스트링이 아닌 POST body로 전달
 */
router.post('/fetch', publishLimiter, async (req, res) => {
  try {
    const { repo, githubToken } = req.body;

    if (!repo || !githubToken) {
      return res.status(400).json({ error: 'repo와 githubToken이 필요합니다.' });
    }

    // main.py 우선 시도
    let code = '';
    let title = '';
    try {
      const mainPy = await githubFetch(
        `https://api.github.com/repos/${repo}/contents/main.py`,
        githubToken,
      );
      code = Buffer.from(mainPy.content, 'base64').toString('utf-8');
    } catch {
      // main.py 없음 → index.html fallback
    }

    if (!code) {
      // 기존 index.html 방식 (하위 호환)
      const file = await githubFetch(
        `https://api.github.com/repos/${repo}/contents/index.html`,
        githubToken,
      );
      const html = Buffer.from(file.content, 'base64').toString('utf-8');

      // Base64로 임베딩된 Python 코드 추출
      const match = html.match(/atob\('([A-Za-z0-9+/=]+)'\)/);
      if (match) {
        code = Buffer.from(match[1], 'base64').toString('utf-8');
      }

      // 제목 추출 (HTML fallback)
      const titleMatch = html.match(/<title>(.+?)(?:\s*[—·-]\s*VPyLab)?<\/title>/);
      if (titleMatch) title = titleMatch[1].trim();
    }

    // vpylab.json에서 메타데이터 읽기 시도
    try {
      const meta = await githubFetch(
        `https://api.github.com/repos/${repo}/contents/vpylab.json`,
        githubToken,
      );
      const metaContent = JSON.parse(Buffer.from(meta.content, 'base64').toString('utf-8'));
      if (!title && metaContent.title) title = metaContent.title;
    } catch { /* 없으면 무시 */ }

    res.json({ code, title });
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
 * 기존 GitHub 리포의 파일들을 업데이트
 * Body: { githubRepo, title, description, category, remixFrom, code (완성 HTML), pythonCode, githubToken }
 */
router.put('/update', publishLimiter, async (req, res) => {
  try {
    const { githubRepo, title, description, category, remixFrom, code, pythonCode, githubToken } = req.body;

    if (!githubRepo || !code || !githubToken) {
      return res.status(400).json({ error: '필수 항목이 누락되었습니다.' });
    }

    if (code.length > 500 * 1024) {
      return res.status(400).json({ error: '코드가 너무 큽니다. (최대 500KB)' });
    }

    const [owner, repoName] = githubRepo.split('/');
    const commitMsg = `✏️ VPyLab에서 업데이트: ${title || '작품 수정'}`;

    // main.py — 순수 Python 소스 (있으면 커밋)
    if (pythonCode) {
      await commitFile(owner, repoName, 'main.py', pythonCode, commitMsg, githubToken);
    }

    // vpylab.json — 메타데이터
    await commitFile(owner, repoName, 'vpylab.json', generateMeta(title || '작품', category, remixFrom), commitMsg, githubToken);

    // README.md — 자동 생성
    await commitFile(owner, repoName, 'README.md', generateReadme(title || '작품', description, owner, repoName, remixFrom), commitMsg, githubToken);

    // index.html — 완성 HTML
    await commitFile(owner, repoName, 'index.html', code, commitMsg, githubToken);

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

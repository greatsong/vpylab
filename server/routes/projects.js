/**
 * VPyLab — 프로젝트 중심 GitHub API (Phase 4-A, Plan C 후속)
 *
 * 새 모델: VPyLab 프로젝트 = GitHub 레포 1:1.
 *   - 프로젝트 생성 시 GitHub 레포 + 첫 commit + Pages 자동 활성화
 *   - 저장(💾) 시 같은 레포에 main.py + history.md commit
 *   - 멤버 1명이면 개인, 다수면 팀 (인터페이스 동일)
 *
 * 보안:
 *   - GitHub OAuth token은 매 요청마다 클라이언트가 전송, 서버 저장 X
 *   - rate-limit: 분당 10회
 *   - 코드 크기 100KB 상한
 *   - Supabase 행 INSERT/UPDATE는 클라이언트가 자기 JWT로 수행 (RLS 그대로 적용)
 */
import { Router } from 'express';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import { generateStandaloneHTML } from '../utils/export-html.js';

const router = Router();

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: '잠시 후 다시 시도해주세요. (분당 10회)' },
  standardHeaders: true,
  legacyHeaders: false,
});

const MAX_CODE_BYTES = 100 * 1024;
const MAX_HISTORY_BYTES = 256 * 1024;
const MAX_HTML_BYTES = 1024 * 1024;
const APP_URL = process.env.PUBLIC_APP_URL || 'https://vpylab.vercel.app';

// ========================================
// 헬퍼
// ========================================

function sanitizeRepoName(title) {
  return (title || '')
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
    || 'project';
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function encodeBase64Url(s) {
  return Buffer.from(String(s), 'utf-8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function buildOpenInVpylabUrl(code) {
  return `${APP_URL}/sandbox?autorun=1#b64=${encodeBase64Url(code)}`;
}

async function ghFetch(url, token, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  let body = {};
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { message: text };
    }
  }
  if (!res.ok) {
    const err = new Error(body.message || `GitHub API ${res.status}`);
    err.status = res.status;
    err.githubErrors = body.errors;
    throw err;
  }
  return body;
}

async function commitFile(owner, repo, path, content, message, token, branch = 'main') {
  let existingSha = null;
  try {
    const existing = await ghFetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${branch}`,
      token,
    );
    existingSha = existing.sha;
  } catch (e) {
    if (e.status !== 404) throw e;
    // 파일이 아직 없으면 새로 생성합니다. repo 접근성은 commit 라우트에서 먼저 확인합니다.
  }

  const body = {
    message,
    content: Buffer.from(content, 'utf-8').toString('base64'),
    branch,
  };
  if (existingSha) body.sha = existingSha;

  const result = await ghFetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`,
    token,
    { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
  );
  return result.commit?.sha || null;
}

function parseRepoFullName(repoFullName) {
  if (!repoFullName || typeof repoFullName !== 'string') return null;
  const [owner, repo] = repoFullName.split('/');
  if (!owner || !repo || repoFullName.split('/').length !== 2) return null;
  return { owner, repo };
}

async function getRepoAccess(owner, repo, token) {
  const info = await ghFetch(`https://api.github.com/repos/${owner}/${repo}`, token);
  const permissions = info.permissions || {};
  const canPush = !!(permissions.admin || permissions.maintain || permissions.push);
  return {
    fullName: info.full_name || `${owner}/${repo}`,
    defaultBranch: info.default_branch || 'main',
    isPrivate: !!info.private,
    canAdmin: !!permissions.admin,
    canMaintain: !!(permissions.admin || permissions.maintain),
    canPush,
  };
}

function sanitizeGithubUsername(username) {
  const trimmed = String(username || '').trim().replace(/^@/, '');
  return /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/.test(trimmed)
    ? trimmed
    : '';
}

function buildPagesHtml({ title, code, htmlContent, owner, repo }) {
  if (typeof htmlContent === 'string' && htmlContent.trim()) {
    return htmlContent;
  }
  try {
    return generateStandaloneHTML(code, title || repo || 'VPyLab');
  } catch (e) {
    console.warn('[projects] 실행형 HTML 생성 실패, 정적 fallback 사용:', e.message);
    return generateIndexHtml({ title: title || repo || 'VPyLab', code, owner, repo });
  }
}

function versionedPagesUrl(owner, repo, sha) {
  const base = `https://${owner}.github.io/${repo}/`;
  return sha ? `${base}?v=${sha.slice(0, 12)}` : base;
}

async function ensurePagesEnabled(owner, repo, token) {
  try {
    const page = await ghFetch(`https://api.github.com/repos/${owner}/${repo}/pages`, token);
    return {
      active: true,
      status: page.status || null,
      htmlUrl: page.html_url || null,
    };
  } catch (e) {
    if (e.status !== 404) throw e;
    const page = await ghFetch(`https://api.github.com/repos/${owner}/${repo}/pages`, token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: { branch: 'main', path: '/' } }),
    });
    return {
      active: true,
      status: page.status || 'building',
      htmlUrl: page.html_url || null,
    };
  }
}

async function requestPagesBuild(owner, repo, token) {
  try {
    await ghFetch(`https://api.github.com/repos/${owner}/${repo}/pages/builds`, token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    return { requested: true, warning: null };
  } catch (e) {
    // 일부 Pages 설정에서는 자동 배포만 지원하고 수동 build 요청 API가 거절될 수 있습니다.
    return { requested: false, warning: e.message };
  }
}

/**
 * 깔끔한 레포 이름 생성: vpylab-{slug} 우선, 충돌 시 -2/-3, 최후 6자 랜덤.
 * 반환: 실제 만들어진 repo 객체 (full_name, name, owner.login 등)
 */
async function createUniqueRepo(githubToken, baseName, description) {
  const tryNames = [
    baseName,
    `${baseName}-2`,
    `${baseName}-3`,
    `${baseName}-4`,
    `${baseName}-${crypto.randomUUID().slice(0, 6)}`,
  ];
  let lastErr = null;
  for (const name of tryNames) {
    try {
      const created = await ghFetch('https://api.github.com/user/repos', githubToken, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description: description.slice(0, 350),
          auto_init: true,
          has_issues: true,
          has_wiki: false,
          private: false,  // GitHub Pages를 디폴트로 쓰려면 public
        }),
      });
      return created;
    } catch (e) {
      lastErr = e;
      // 422 = name already exists 또는 validation error → 다음 후보 시도
      if (e.status !== 422) throw e;
    }
  }
  throw lastErr || new Error('레포 생성 실패');
}

// ========================================
// 콘텐츠 생성기
// ========================================

function generateReadme({ title, description, code, owner, repo, isTeam }) {
  const teamBadge = isTeam ? '\n> 👥 **팀 프로젝트**입니다. 여러 명이 함께 작업합니다.\n' : '';
  const openInVpylabUrl = buildOpenInVpylabUrl(code || '');
  return `# ${title}

> VPyLab에서 만든 3D Python 작품입니다.
${teamBadge}
${description ? description + '\n' : ''}
## 빠르게 보기

- 🌐 [GitHub Pages 실행 페이지](https://${owner}.github.io/${repo}/)
- ▶️ [VPyLab에서 이 코드 실행](${openInVpylabUrl})

## 파일

- \`main.py\` — 최신 코드 (저장할 때마다 갱신)
- \`history.md\` — 저장 시점·메시지·작성자 누적 기록
- \`index.html\` — GitHub Pages용 독립 실행 페이지

## git log로 이력 보기

\`\`\`
git log --oneline -- main.py
\`\`\`

또는 GitHub에서 [\`Commits\`](https://github.com/${owner}/${repo}/commits/main) 탭 클릭.

---
*VPyLab — Python으로 3D 세계를 만드는 교육 플랫폼*
`;
}

function generateInitialHistory(title, authorLabel) {
  const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);
  return `# 📜 작업 이력

이 파일은 \`${title}\` 프로젝트의 저장 시점들을 시간 역순으로 누적합니다.
새로운 저장이 위쪽에 추가됩니다.

---

## ${ts}

- 메시지: 🌱 프로젝트 생성
- 작성자: ${authorLabel || '익명'}
- 출처: project-create
`;
}

async function appendHistory(owner, repo, entry, token, branch = 'main') {
  let prev = '';
  try {
    const ex = await ghFetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/history.md?ref=${branch}`,
      token,
    );
    prev = Buffer.from(ex.content, 'base64').toString('utf-8');
    if (prev.length > MAX_HISTORY_BYTES) {
      prev = prev.slice(0, Math.floor(MAX_HISTORY_BYTES / 2));
    }
  } catch {
    prev = '# 📜 작업 이력\n\n';
  }

  const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const newSection = `## ${ts}

- 메시지: ${entry.message || '(메시지 없음)'}
- 작성자: ${entry.authorLabel || '익명'}
- 출처: ${entry.source || 'manual'}
${entry.revisionId ? `- VPyLab revision: \`${entry.revisionId}\`\n` : ''}
`;

  // 첫 헤더 다음에 새 섹션 끼워넣기 (역순)
  let combined;
  if (prev.startsWith('# ')) {
    const idx = prev.indexOf('---\n');
    if (idx >= 0) {
      combined = prev.slice(0, idx + 4) + '\n' + newSection + prev.slice(idx + 4);
    } else {
      combined = prev + '\n---\n\n' + newSection;
    }
  } else {
    combined = newSection + prev;
  }

  return commitFile(owner, repo, 'history.md', combined, `📜 history: ${entry.message || '저장'}`, token, branch);
}

function generateIndexHtml({ title, code, owner, repo }) {
  const openInVpylabUrl = buildOpenInVpylabUrl(code);

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} — VPyLab</title>
  <style>
    *{box-sizing:border-box}
    body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;max-width:760px;margin:32px auto;padding:0 20px;color:#0f172a;line-height:1.6;background:#fafafa}
    h1{margin:0 0 8px;font-size:1.8rem}
    .muted{color:#64748b}
    .actions{margin:20px 0;display:flex;gap:12px;flex-wrap:wrap}
    .btn{display:inline-flex;align-items:center;gap:6px;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600;font-size:0.95rem}
    .btn--primary{background:#2da44e;color:#fff}
    .btn--secondary{background:#0969da;color:#fff}
    .btn--ghost{background:#fff;color:#0969da;border:1px solid #d0d7de}
    pre{background:#0d1117;color:#e6edf3;border-radius:10px;padding:18px;overflow:auto;font-size:0.9rem;line-height:1.5}
    code{font-family:'JetBrains Mono','SF Mono',Menlo,monospace}
    h2{font-size:1.1rem;margin-top:32px}
    footer{margin-top:48px;padding-top:16px;border-top:1px solid #e2e8f0;color:#94a3b8;font-size:0.85rem}
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <p class="muted">VPyLab에서 만든 3D Python 작품입니다. 아래에서 코드를 보거나 VPyLab에서 직접 실행할 수 있어요.</p>

  <div class="actions">
    <a class="btn btn--primary" href="${escapeHtml(openInVpylabUrl)}" target="_blank" rel="noopener">▶ VPyLab에서 이 코드 열기</a>
    <a class="btn btn--secondary" href="https://github.com/${owner}/${repo}" target="_blank" rel="noopener">📂 GitHub 코드</a>
    <a class="btn btn--ghost" href="https://github.com/${owner}/${repo}/commits/main" target="_blank" rel="noopener">📜 작업 이력</a>
  </div>

  <h2>코드</h2>
  <pre><code>${escapeHtml(code)}</code></pre>

  <footer>
    이 페이지는 GitHub Pages로 자동 배포되었습니다. 코드가 갱신되면 잠시 후 이 페이지도 자동 갱신됩니다.<br>
    Powered by <a href="${APP_URL}" rel="noopener" style="color:inherit">VPyLab</a>.
  </footer>
</body>
</html>
`;
}

// ========================================
// POST /api/projects/setup
// 프로젝트 신규 생성: GitHub 레포 + 초기 파일 + Pages 활성화
// ========================================
router.post('/setup', limiter, async (req, res) => {
  let createdRepoFullName = null;
  try {
    const { title, description = '', code, htmlContent, githubToken, authorLabel = '익명', isTeam = false } = req.body;

    if (!title || typeof title !== 'string') return res.status(400).json({ error: '제목을 입력해주세요.' });
    if (!code || typeof code !== 'string') return res.status(400).json({ error: '코드가 비어있습니다.' });
    if (Buffer.byteLength(code, 'utf-8') > MAX_CODE_BYTES)
      return res.status(413).json({ error: `코드가 너무 큽니다 (최대 ${MAX_CODE_BYTES / 1024}KB).` });
    if (htmlContent != null && typeof htmlContent !== 'string')
      return res.status(400).json({ error: 'GitHub Pages HTML 형식이 올바르지 않습니다.' });
    if (typeof htmlContent === 'string' && Buffer.byteLength(htmlContent, 'utf-8') > MAX_HTML_BYTES)
      return res.status(413).json({ error: `GitHub Pages HTML이 너무 큽니다 (최대 ${MAX_HTML_BYTES / 1024}KB).` });
    if (!githubToken) return res.status(401).json({ error: 'GitHub 로그인이 필요합니다.' });

    const ghUser = await ghFetch('https://api.github.com/user', githubToken);
    const owner = ghUser.login;
    const baseName = `vpylab-${sanitizeRepoName(title)}`;
    const repo = await createUniqueRepo(githubToken, baseName, `VPyLab — ${title.slice(0, 100)}`);
    const repoName = repo.name;
    createdRepoFullName = `${owner}/${repoName}`;

    // GitHub 내부 처리 대기
    await new Promise(r => setTimeout(r, 1500));

    const pageHtml = buildPagesHtml({ title, code, htmlContent, owner, repo: repoName });
    if (Buffer.byteLength(pageHtml, 'utf-8') > MAX_HTML_BYTES) {
      return res.status(413).json({ error: `GitHub Pages HTML이 너무 큽니다 (최대 ${MAX_HTML_BYTES / 1024}KB).` });
    }

    // 초기 commit 묶음
    await commitFile(owner, repoName, 'main.py', code, `🌱 프로젝트 시작: ${title}`, githubToken);
    await commitFile(owner, repoName, 'README.md', generateReadme({ title, description, code, owner, repo: repoName, isTeam }), '📚 README', githubToken);
    await commitFile(owner, repoName, 'history.md', generateInitialHistory(title, authorLabel), '📜 history', githubToken);
    const pageSha = await commitFile(
      owner,
      repoName,
      'index.html',
      pageHtml,
      '🌐 GitHub Pages 실행 페이지',
      githubToken,
    );

    // GitHub Pages 활성화/배포 요청
    let pagesInfo = { active: false, status: null };
    let pagesWarning = null;
    try {
      pagesInfo = await ensurePagesEnabled(owner, repoName, githubToken);
      await requestPagesBuild(owner, repoName, githubToken);
    } catch (e) {
      console.warn('[projects/setup] Pages 활성화 실패:', e.message);
      pagesWarning = e.message;
    }

    res.json({
      success: true,
      repoFullName: `${owner}/${repoName}`,
      repoUrl: `https://github.com/${owner}/${repoName}`,
      pagesUrl: versionedPagesUrl(owner, repoName, pageSha),
      pagesActivated: pagesInfo.active,
      pagesStatus: pagesInfo.status,
      pagesWarning,
      pageCommitSha: pageSha,
      pageCommitUrl: pageSha ? `https://github.com/${owner}/${repoName}/commit/${pageSha}` : null,
    });
  } catch (e) {
    console.error('[projects/setup]', e.message, e.githubErrors || '');
    if (e.status === 401) return res.status(401).json({ error: 'GitHub 인증이 만료되었습니다.', repoFullName: createdRepoFullName });
    if (e.status === 403) return res.status(403).json({ error: `GitHub 권한 부족: ${e.message}`, repoFullName: createdRepoFullName });
    if (e.status === 422) {
      const detail = e.githubErrors?.map(x => x.message).join(', ') || e.message;
      return res.status(422).json({ error: `GitHub 요청 오류: ${detail}`, repoFullName: createdRepoFullName });
    }
    res.status(500).json({ error: e.message, repoFullName: createdRepoFullName });
  }
});

// ========================================
// POST /api/projects/access
// 현재 GitHub 토큰이 프로젝트 레포에 쓰기 권한을 갖는지 확인
// ========================================
router.post('/access', limiter, async (req, res) => {
  try {
    const { repoFullName, githubToken } = req.body;
    const parsed = parseRepoFullName(repoFullName);
    if (!parsed) return res.status(400).json({ error: 'GitHub 저장소 연결 정보가 없습니다.', code: 'missing_repo' });
    if (!githubToken) return res.status(401).json({ error: 'GitHub 인증 필요', code: 'github_auth_required' });

    const access = await getRepoAccess(parsed.owner, parsed.repo, githubToken);
    if (!access.canPush) {
      return res.status(403).json({
        error: `${access.fullName}에 커밋할 GitHub 쓰기 권한이 없습니다. VPyLab 초대 코드와 GitHub collaborator 권한은 별도입니다. 저장소 소유자가 GitHub Collaborators에 이 계정을 추가해야 합니다.`,
        code: 'github_write_permission_required',
        repoFullName: access.fullName,
        canPush: false,
      });
    }

    res.json({ ok: true, ...access });
  } catch (e) {
    console.error('[projects/access]', e.message);
    if (e.status === 401) return res.status(401).json({ error: 'GitHub 인증이 만료되었습니다.', code: 'github_auth_required' });
    if (e.status === 404) {
      return res.status(404).json({
        error: 'GitHub 저장소를 찾을 수 없거나 이 GitHub 계정에 접근 권한이 없습니다.',
        code: 'repo_not_accessible',
      });
    }
    res.status(500).json({ error: e.message, code: 'github_access_check_failed' });
  }
});

// ========================================
// POST /api/projects/collaborators/invite
// 저장소 소유자가 팀원의 GitHub 계정을 collaborator로 초대
// ========================================
router.post('/collaborators/invite', limiter, async (req, res) => {
  try {
    const { repoFullName, username, githubToken } = req.body;
    const parsed = parseRepoFullName(repoFullName);
    const safeUsername = sanitizeGithubUsername(username);
    if (!parsed) return res.status(400).json({ error: 'GitHub 저장소 연결 정보가 없습니다.', code: 'missing_repo' });
    if (!safeUsername) return res.status(400).json({ error: 'GitHub 사용자명을 확인해주세요.', code: 'invalid_github_username' });
    if (!githubToken) return res.status(401).json({ error: 'GitHub 인증 필요', code: 'github_auth_required' });

    const access = await getRepoAccess(parsed.owner, parsed.repo, githubToken);
    if (!access.canAdmin) {
      return res.status(403).json({
        error: 'GitHub collaborator를 초대하려면 저장소 관리자 권한이 필요합니다. 저장소 소유자 계정으로 다시 시도해주세요.',
        code: 'github_admin_permission_required',
      });
    }

    const invitation = await ghFetch(
      `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/collaborators/${encodeURIComponent(safeUsername)}`,
      githubToken,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permission: 'push' }),
      },
    );

    res.json({
      ok: true,
      username: safeUsername,
      repoFullName: access.fullName,
      invitationUrl: invitation.html_url || null,
    });
  } catch (e) {
    console.error('[projects/collaborators/invite]', e.message);
    if (e.status === 401) return res.status(401).json({ error: 'GitHub 인증이 만료되었습니다.', code: 'github_auth_required' });
    if (e.status === 403) return res.status(403).json({ error: `GitHub 권한 부족: ${e.message}`, code: 'github_forbidden' });
    if (e.status === 404) {
      return res.status(404).json({
        error: 'GitHub 저장소 또는 사용자를 찾을 수 없습니다. 저장소와 GitHub 사용자명을 확인해주세요.',
        code: 'repo_or_user_not_found',
      });
    }
    if (e.status === 422) {
      return res.status(422).json({
        error: '이미 초대되었거나 collaborator 추가 요청이 처리되지 않았습니다. GitHub 저장소 설정을 확인해주세요.',
        code: 'github_invite_unprocessable',
      });
    }
    res.status(500).json({ error: e.message, code: 'github_invite_failed' });
  }
});

// ========================================
// POST /api/projects/commit
// 기존 프로젝트에 코드 변경 commit + history.md 갱신 + index.html 갱신
// ========================================
router.post('/commit', limiter, async (req, res) => {
  try {
    const {
      repoFullName, code, htmlContent, title, message, githubToken,
      authorLabel = '익명', source = 'manual', revisionId, updateIndex = true,
    } = req.body;

    const parsed = parseRepoFullName(repoFullName);
    if (!parsed) return res.status(400).json({ error: 'GitHub 저장소 연결 정보가 없습니다.', code: 'missing_repo' });
    if (!code) return res.status(400).json({ error: '코드 비어있음' });
    if (Buffer.byteLength(code, 'utf-8') > MAX_CODE_BYTES)
      return res.status(413).json({ error: `코드가 너무 큽니다 (최대 ${MAX_CODE_BYTES / 1024}KB).` });
    if (htmlContent != null && typeof htmlContent !== 'string')
      return res.status(400).json({ error: 'GitHub Pages HTML 형식이 올바르지 않습니다.' });
    if (typeof htmlContent === 'string' && Buffer.byteLength(htmlContent, 'utf-8') > MAX_HTML_BYTES)
      return res.status(413).json({ error: `GitHub Pages HTML이 너무 큽니다 (최대 ${MAX_HTML_BYTES / 1024}KB).` });
    if (!githubToken) return res.status(401).json({ error: 'GitHub 인증 필요' });

    const { owner, repo } = parsed;
    const access = await getRepoAccess(owner, repo, githubToken);
    if (!access.canPush) {
      return res.status(403).json({
        error: `${access.fullName}에 커밋할 GitHub 쓰기 권한이 없습니다. VPyLab 초대 코드와 GitHub collaborator 권한은 별도입니다. 저장소 소유자가 GitHub Collaborators에 이 계정을 추가해야 합니다.`,
        code: 'github_write_permission_required',
      });
    }

    const finalMsg = (message || '저장').slice(0, 200);
    const commitMsg = `${finalMsg}\n\n— ${authorLabel} via VPyLab`;

    const mainSha = await commitFile(owner, repo, 'main.py', code, commitMsg, githubToken);
    let pageSha = null;
    let pagesInfo = { active: false, status: null };
    let pagesBuildRequested = false;
    let pagesWarning = null;

    if (updateIndex) {
      const pageHtml = buildPagesHtml({ title: title || repo, code, htmlContent, owner, repo });
      if (Buffer.byteLength(pageHtml, 'utf-8') > MAX_HTML_BYTES) {
        return res.status(413).json({ error: `GitHub Pages HTML이 너무 큽니다 (최대 ${MAX_HTML_BYTES / 1024}KB).` });
      }
      pageSha = await commitFile(
        owner,
        repo,
        'index.html',
        pageHtml,
        '🌐 page 갱신',
        githubToken,
      );

      try {
        pagesInfo = await ensurePagesEnabled(owner, repo, githubToken);
        const build = await requestPagesBuild(owner, repo, githubToken);
        pagesBuildRequested = build.requested;
      } catch (e) {
        console.warn('[projects/commit] Pages 배포 확인 실패:', e.message);
        pagesWarning = e.message;
      }
    }

    try {
      await appendHistory(owner, repo, { message: finalMsg, authorLabel, source, revisionId }, githubToken);
    } catch (e) {
      console.warn('[projects/commit] history.md 갱신 실패:', e.message);
    }

    res.json({
      success: true,
      commitSha: mainSha,
      pageCommitSha: pageSha,
      repoUrl: `https://github.com/${owner}/${repo}`,
      pagesUrl: versionedPagesUrl(owner, repo, pageSha || mainSha),
      commitUrl: mainSha ? `https://github.com/${owner}/${repo}/commit/${mainSha}` : null,
      pageCommitUrl: pageSha ? `https://github.com/${owner}/${repo}/commit/${pageSha}` : null,
      pagesActivated: pagesInfo.active,
      pagesStatus: pagesInfo.status,
      pagesBuildRequested,
      pagesWarning,
    });
  } catch (e) {
    console.error('[projects/commit]', e.message);
    if (e.status === 401) return res.status(401).json({ error: 'GitHub 인증이 만료되었습니다.', code: 'github_auth_required' });
    if (e.status === 404) {
      return res.status(404).json({
        error: 'GitHub 저장소를 찾을 수 없거나 이 GitHub 계정에 접근 권한이 없습니다. 저장소 소유자 계정으로 저장하거나 GitHub collaborator 권한을 추가해주세요.',
        code: 'repo_not_accessible',
      });
    }
    if (e.status === 403) return res.status(403).json({ error: `GitHub 권한 부족: ${e.message}`, code: 'github_forbidden' });
    res.status(500).json({ error: e.message, code: 'github_commit_failed' });
  }
});

export default router;

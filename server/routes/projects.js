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
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(body.message || `GitHub API ${res.status}`);
    err.status = res.status;
    err.githubErrors = body.errors;
    throw err;
  }
  return res.json();
}

async function commitFile(owner, repo, path, content, message, token, branch = 'main') {
  let existingSha = null;
  try {
    const existing = await ghFetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${branch}`,
      token,
    );
    existingSha = existing.sha;
  } catch { /* 없으면 새로 생성 */ }

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

function generateReadme({ title, description, owner, repo, isTeam }) {
  const teamBadge = isTeam ? '\n> 👥 **팀 프로젝트**입니다. 여러 명이 함께 작업합니다.\n' : '';
  return `# ${title}

> VPyLab에서 만든 3D Python 작품입니다.
${teamBadge}
${description ? description + '\n' : ''}
## 빠르게 보기

- 🌐 [GitHub Pages 미리보기](https://${owner}.github.io/${repo}/)
- ▶️ [VPyLab에서 직접 실행](${APP_URL})

## 파일

- \`main.py\` — 최신 코드 (저장할 때마다 갱신)
- \`history.md\` — 저장 시점·메시지·작성자 누적 기록
- \`index.html\` — GitHub Pages용 미리보기

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
    <a class="btn btn--primary" href="${APP_URL}" target="_blank" rel="noopener">▶ VPyLab에서 실행</a>
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
  try {
    const { title, description = '', code, githubToken, authorLabel = '익명', isTeam = false } = req.body;

    if (!title || typeof title !== 'string') return res.status(400).json({ error: '제목을 입력해주세요.' });
    if (!code || typeof code !== 'string') return res.status(400).json({ error: '코드가 비어있습니다.' });
    if (Buffer.byteLength(code, 'utf-8') > MAX_CODE_BYTES)
      return res.status(413).json({ error: `코드가 너무 큽니다 (최대 ${MAX_CODE_BYTES / 1024}KB).` });
    if (!githubToken) return res.status(401).json({ error: 'GitHub 로그인이 필요합니다.' });

    const ghUser = await ghFetch('https://api.github.com/user', githubToken);
    const owner = ghUser.login;
    const baseName = `vpylab-${sanitizeRepoName(title)}`;
    const repo = await createUniqueRepo(githubToken, baseName, `VPyLab — ${title.slice(0, 100)}`);
    const repoName = repo.name;

    // GitHub 내부 처리 대기
    await new Promise(r => setTimeout(r, 1500));

    // 초기 commit 묶음
    await commitFile(owner, repoName, 'main.py', code, `🌱 프로젝트 시작: ${title}`, githubToken);
    await commitFile(owner, repoName, 'README.md', generateReadme({ title, description, owner, repo: repoName, isTeam }), '📚 README', githubToken);
    await commitFile(owner, repoName, 'history.md', generateInitialHistory(title, authorLabel), '📜 history', githubToken);
    await commitFile(owner, repoName, 'index.html', generateIndexHtml({ title, code, owner, repo: repoName }), '🌐 GitHub Pages 미리보기', githubToken);

    // GitHub Pages 활성화 (실패해도 치명적이지 않음 — 무료 plan + private 등은 추후 업그레이드 안내)
    let pagesActivated = false;
    try {
      await ghFetch(`https://api.github.com/repos/${owner}/${repoName}/pages`, githubToken, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: { branch: 'main', path: '/' } }),
      });
      pagesActivated = true;
    } catch (e) {
      console.warn('[projects/setup] Pages 활성화 실패:', e.message);
    }

    res.json({
      success: true,
      repoFullName: `${owner}/${repoName}`,
      repoUrl: `https://github.com/${owner}/${repoName}`,
      pagesUrl: `https://${owner}.github.io/${repoName}/`,
      pagesActivated,
    });
  } catch (e) {
    console.error('[projects/setup]', e.message, e.githubErrors || '');
    if (e.status === 401) return res.status(401).json({ error: 'GitHub 인증이 만료되었습니다.' });
    if (e.status === 403) return res.status(403).json({ error: `GitHub 권한 부족: ${e.message}` });
    if (e.status === 422) {
      const detail = e.githubErrors?.map(x => x.message).join(', ') || e.message;
      return res.status(422).json({ error: `GitHub 요청 오류: ${detail}` });
    }
    res.status(500).json({ error: e.message });
  }
});

// ========================================
// POST /api/projects/commit
// 기존 프로젝트에 코드 변경 commit + history.md 갱신 + index.html 갱신
// ========================================
router.post('/commit', limiter, async (req, res) => {
  try {
    const {
      repoFullName, code, title, message, githubToken,
      authorLabel = '익명', source = 'manual', revisionId, updateIndex = true,
    } = req.body;

    if (!repoFullName) return res.status(400).json({ error: 'repoFullName 누락' });
    if (!code) return res.status(400).json({ error: '코드 비어있음' });
    if (Buffer.byteLength(code, 'utf-8') > MAX_CODE_BYTES)
      return res.status(413).json({ error: `코드가 너무 큽니다 (최대 ${MAX_CODE_BYTES / 1024}KB).` });
    if (!githubToken) return res.status(401).json({ error: 'GitHub 인증 필요' });

    const [owner, repo] = repoFullName.split('/');
    const finalMsg = (message || '저장').slice(0, 200);
    const commitMsg = `${finalMsg}\n\n— ${authorLabel} via VPyLab`;

    const mainSha = await commitFile(owner, repo, 'main.py', code, commitMsg, githubToken);

    if (updateIndex) {
      try {
        await commitFile(owner, repo, 'index.html', generateIndexHtml({ title: title || repo, code, owner, repo }), '🌐 page 갱신', githubToken);
      } catch (e) {
        console.warn('[projects/commit] index.html 갱신 실패:', e.message);
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
      repoUrl: `https://github.com/${owner}/${repo}`,
      pagesUrl: `https://${owner}.github.io/${repo}/`,
      commitUrl: mainSha ? `https://github.com/${owner}/${repo}/commit/${mainSha}` : null,
    });
  } catch (e) {
    console.error('[projects/commit]', e.message);
    if (e.status === 401) return res.status(401).json({ error: 'GitHub 인증이 만료되었습니다.' });
    if (e.status === 404) return res.status(404).json({ error: 'GitHub 레포를 찾을 수 없습니다.' });
    res.status(500).json({ error: e.message });
  }
});

export default router;

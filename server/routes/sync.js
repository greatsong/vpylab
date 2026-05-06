/**
 * VPyLab — GitHub 동기화 API (Phase 3, Plan C)
 *
 * 목적:
 *   학생이 "이 코드를 GitHub로 보내기"를 누를 때마다 자기(혹은 팀의) 레포에 commit.
 *   publish.js와 다른 점: HTML 갤러리 발행이 아니라, **단순 main.py + history.md** 형태로
 *   학생 본인이 자기 레포에서 git log로 이력을 추적할 수 있도록 한다.
 *
 * 보안:
 *   - GitHub token은 클라이언트가 매 요청마다 전송 (서버 저장 X)
 *   - 코드 크기 100KB 제한
 *   - rate-limit: 분당 10회 (publish의 3회보다 완화 — 자주 누를 수 있음)
 *   - 리포 이름 sanitize는 publish.js와 동일 규칙 사용
 */
import { Router } from 'express';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';

const router = Router();

const syncLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: '잠시 후 다시 시도해주세요. (분당 10회 제한)' },
  standardHeaders: true,
  legacyHeaders: false,
});

const MAX_CODE_BYTES = 100 * 1024;        // 100KB
const MAX_HISTORY_BYTES = 256 * 1024;     // history.md 누적 상한

function sanitizeRepoName(title) {
  return (title || '')
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50)
    || 'vpylab-project';
}

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
    const err = new Error(body.message || `GitHub API ${res.status}`);
    err.status = res.status;
    err.githubErrors = body.errors;
    throw err;
  }
  return res.json();
}

/**
 * 단일 파일을 commit. 기존 파일이 있으면 SHA를 가져와 덮어쓰기.
 * 반환: 새 commit의 SHA (commit.sha)
 */
async function commitFile(owner, repoName, path, content, message, token, branch = 'main') {
  let existingSha = null;
  try {
    const existing = await githubFetch(
      `https://api.github.com/repos/${owner}/${repoName}/contents/${encodeURIComponent(path)}?ref=${branch}`,
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

  const result = await githubFetch(
    `https://api.github.com/repos/${owner}/${repoName}/contents/${encodeURIComponent(path)}`,
    token,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
  return result.commit?.sha || null;
}

/**
 * history.md 누적 갱신 — 매 commit마다 한 줄 prepend.
 */
async function appendHistoryEntry(owner, repoName, entry, token, branch = 'main') {
  let prevContent = '';
  try {
    const existing = await githubFetch(
      `https://api.github.com/repos/${owner}/${repoName}/contents/history.md?ref=${branch}`,
      token,
    );
    prevContent = Buffer.from(existing.content, 'base64').toString('utf-8');
    if (prevContent.length > MAX_HISTORY_BYTES) {
      // 너무 커지면 앞쪽(오래된)을 잘라낸다
      prevContent = prevContent.slice(0, Math.floor(MAX_HISTORY_BYTES / 2));
    }
  } catch {
    prevContent = '# VPyLab — 작업 이력\n\n저장한 시점들이 시간 역순으로 쌓입니다.\n\n';
  }

  const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const newSection = `## ${ts}\n\n- 메시지: ${entry.message || '(메시지 없음)'}\n- 작성자: ${entry.authorLabel || '익명'}\n- 출처: ${entry.source || 'manual'}\n${entry.revisionId ? `- VPyLab revision: \`${entry.revisionId}\`\n` : ''}\n`;

  // 기존 헤더 라인을 분리해서 헤더 다음에 새 섹션을 끼워넣음
  let combined;
  if (prevContent.startsWith('# ')) {
    const idx = prevContent.indexOf('\n\n');
    if (idx >= 0) {
      combined = prevContent.slice(0, idx + 2) + newSection + prevContent.slice(idx + 2);
    } else {
      combined = prevContent + '\n\n' + newSection;
    }
  } else {
    combined = newSection + prevContent;
  }

  return commitFile(owner, repoName, 'history.md', combined, `📜 history: ${entry.message || '저장'}`, token, branch);
}

function generateReadme(title, owner, repoName) {
  return `# ${title}

> VPyLab에서 만든 3D Python 작품입니다.

## 빠르게 보기

- [VPyLab에서 열기](https://vpylab.com)
- [GitHub Pages](https://${owner}.github.io/${repoName}/) *(활성화한 경우)*

## 파일

- \`main.py\` — 최신 코드 (VPyLab 저장 시 갱신)
- \`history.md\` — 저장 시점별 작업 메시지 누적
- \`vpylab.json\` — 메타데이터

## 어떻게 동작하나요?

VPyLab에서 작업하다 \`📤 GitHub로 보내기\` 버튼을 누르면, 이 레포의 \`main.py\`가
새로운 코드로 갱신되고 \`history.md\`에 한 줄이 추가됩니다. \`git log\`를 열어 보면
지금까지의 모든 저장 기록이 시간순으로 보입니다.

---
*VPyLab — 3D 프로그래밍 교육 플랫폼*
`;
}

function generateMeta(title, codeId, projectId) {
  return JSON.stringify({
    title,
    codeId: codeId || null,
    projectId: projectId || null,
    vpylabVersion: '1.0',
    syncedAt: new Date().toISOString(),
  }, null, 2);
}

/**
 * POST /api/sync/github
 * Body:
 *   - code (string, required) — 현재 main.py에 들어갈 Python 코드
 *   - title (string, required) — 코드/프로젝트 제목
 *   - message (string, optional) — commit 메시지(없으면 자동 생성)
 *   - existingRepo (string, optional) — "owner/repo" 형식 (재사용)
 *   - githubToken (string, required) — 학생/팀원의 GitHub OAuth 토큰
 *   - revisionId (string, optional) — VPyLab revision 추적용
 *   - codeId (string, optional) — vpylab_saved_code.id
 *   - projectId (string, optional) — 팀 프로젝트 id
 *   - source (string, optional) — 'manual' | 'restore' | 'mission_submit'
 *   - authorLabel (string, optional) — 작성자 표시명
 *   - repoKind (string, optional) — 'personal' | 'team' (레포 이름 prefix만 다름)
 *
 * Returns: { repoFullName, commitSha, repoUrl }
 */
router.post('/github', syncLimiter, async (req, res) => {
  try {
    const {
      code,
      title,
      message,
      existingRepo,
      githubToken,
      revisionId,
      codeId,
      projectId,
      source = 'manual',
      authorLabel = '익명',
      repoKind = 'personal',
    } = req.body;

    // === 입력 검증 ===
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: '코드가 비어있습니다.' });
    }
    if (Buffer.byteLength(code, 'utf-8') > MAX_CODE_BYTES) {
      return res.status(413).json({ error: `코드가 너무 큽니다. (최대 ${MAX_CODE_BYTES / 1024}KB)` });
    }
    if (!title || typeof title !== 'string') {
      return res.status(400).json({ error: '제목이 비어있습니다.' });
    }
    if (!githubToken || typeof githubToken !== 'string') {
      return res.status(401).json({ error: 'GitHub 로그인이 필요합니다.' });
    }

    // === GitHub 사용자 확인 ===
    const ghUser = await githubFetch('https://api.github.com/user', githubToken);
    const owner = ghUser.login;

    // === 리포 이름 결정 ===
    let repoName;
    if (existingRepo) {
      const parts = existingRepo.split('/');
      repoName = parts[1] || parts[0];
    } else {
      const prefix = repoKind === 'team' ? 'vpylab-team' : 'vpylab';
      const uid = crypto.randomUUID().slice(0, 6);
      repoName = `${prefix}-${sanitizeRepoName(title)}-${uid}`;
    }

    // === 리포 확인/생성 ===
    let repoExists = false;
    try {
      await githubFetch(`https://api.github.com/repos/${owner}/${repoName}`, githubToken);
      repoExists = true;
    } catch { /* 없으면 생성 */ }

    if (!repoExists) {
      await githubFetch('https://api.github.com/user/repos', githubToken, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: repoName,
          description: `VPyLab 작업 이력 — ${title}`,
          auto_init: true,        // README 자동 생성으로 빈 리포 회피
          has_issues: true,
          has_wiki: false,
        }),
      });
      // GitHub 내부 처리 대기
      await new Promise(r => setTimeout(r, 1500));
    }

    // === 파일 commit ===
    const finalMessage = (message || `📝 ${title} 저장`).slice(0, 200);
    const commitMsg = `${finalMessage}\n\n— ${authorLabel} via VPyLab`;

    // main.py
    const mainCommitSha = await commitFile(owner, repoName, 'main.py', code, commitMsg, githubToken);

    // README.md (없거나 갱신 필요할 때만 — 매번 덮어쓰면 noise. 첫 생성에만 작성)
    if (!repoExists) {
      try {
        await commitFile(owner, repoName, 'README.md', generateReadme(title, owner, repoName), '📚 README', githubToken);
      } catch { /* 무시 */ }
    }

    // vpylab.json
    try {
      await commitFile(owner, repoName, 'vpylab.json', generateMeta(title, codeId, projectId), '🏷️ meta', githubToken);
    } catch { /* 무시 */ }

    // history.md (누적)
    try {
      await appendHistoryEntry(owner, repoName, {
        message: finalMessage,
        authorLabel,
        source,
        revisionId,
      }, githubToken);
    } catch (e) {
      console.warn('[sync/github] history.md 갱신 실패:', e.message);
    }

    // === 결과 반환 ===
    res.json({
      success: true,
      repoFullName: `${owner}/${repoName}`,
      repoUrl: `https://github.com/${owner}/${repoName}`,
      commitSha: mainCommitSha,
      isNewRepo: !repoExists,
    });
  } catch (err) {
    console.error('[sync/github] 오류:', err.message, err.githubErrors || '');
    if (err.status === 401 || err.message?.includes('Bad credentials')) {
      return res.status(401).json({ error: 'GitHub 인증이 만료되었습니다. 다시 로그인해주세요.' });
    }
    if (err.status === 403) {
      return res.status(403).json({ error: `GitHub 권한이 부족합니다: ${err.message}` });
    }
    if (err.status === 422) {
      const detail = err.githubErrors?.map(e => e.message).join(', ') || err.message;
      return res.status(422).json({ error: `GitHub 요청 오류: ${detail}` });
    }
    if (err.status === 429) {
      return res.status(429).json({ error: 'GitHub API 한도에 도달했습니다.' });
    }
    res.status(500).json({ error: `GitHub 동기화 중 오류: ${err.message}` });
  }
});

export default router;

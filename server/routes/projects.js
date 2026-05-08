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
const GITHUB_API_TIMEOUT_MS = Number(process.env.GITHUB_API_TIMEOUT_MS || 20_000);

// ========================================
// 헬퍼
// ========================================

function sanitizeRepoName(title) {
  const rawTitle = String(title || 'project');
  const asciiBase = rawTitle
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^\x00-\x7F]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 32)
    .replace(/-$/g, '')
    || 'project';

  const suffix = crypto
    .createHash('sha1')
    .update(rawTitle, 'utf8')
    .digest('hex')
    .slice(0, 6);

  return `${asciiBase}-${suffix}`;
}

function normalizeRepoNameInput(name) {
  return String(name || '')
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^\x00-\x7F]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50)
    .replace(/-$/g, '');
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

function buildOpenInVpylabUrl({ code = '', owner, repo } = {}) {
  if (owner && repo) {
    return `${APP_URL}/sandbox?repo=${encodeURIComponent(`${owner}/${repo}`)}&autorun=1`;
  }
  return `${APP_URL}/sandbox?autorun=1#b64=${encodeBase64Url(code)}`;
}

async function ghFetch(url, token, options = {}) {
  const { timeoutMs = GITHUB_API_TIMEOUT_MS, headers = {}, ...fetchOptions } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...headers,
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
  } catch (e) {
    if (e.name === 'AbortError') {
      const err = new Error(`GitHub API 응답 시간이 ${Math.round(timeoutMs / 1000)}초를 넘었습니다.`);
      err.status = 504;
      throw err;
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

// 중첩 경로(docs/voyage/2026-05-08.md)를 안전하게 인코딩.
// encodeURIComponent는 '/'까지 %2F로 바꿔 GitHub Contents API에서 가끔 거절되므로
// 세그먼트별로 인코딩 후 '/'로 다시 이어붙입니다.
function encodeContentsPath(path) {
  return String(path)
    .split('/')
    .filter(Boolean)
    .map(encodeURIComponent)
    .join('/');
}

function buildContentsUrl(owner, repo, path, branch) {
  const encoded = encodeContentsPath(path);
  const base = `https://api.github.com/repos/${owner}/${repo}/contents/${encoded}`;
  return branch ? `${base}?ref=${branch}` : base;
}

// 파일을 읽어 { sha, text }를 반환. 없으면 null.
async function getContentsFile(owner, repo, path, token, branch = 'main') {
  try {
    const res = await ghFetch(buildContentsUrl(owner, repo, path, branch), token);
    return {
      sha: res.sha,
      text: Buffer.from(res.content || '', 'base64').toString('utf-8'),
    };
  } catch (e) {
    if (e.status === 404) return null;
    throw e;
  }
}

async function commitFile(owner, repo, path, content, message, token, branch = 'main') {
  let existingSha = null;
  try {
    const existing = await ghFetch(buildContentsUrl(owner, repo, path, branch), token);
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
    buildContentsUrl(owner, repo, path),
    token,
    { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
  );
  return result.commit?.sha || null;
}

const REPO_READY_RETRY_DELAYS_MS = [500, 1500, 3000, 5000];

// 새 레포는 auto_init=true로 기본 브랜치를 먼저 만들고, 초기 파일은 Contents API로
// 순서대로 올립니다. 그래도 GitHub 내부 ref/object DB 반영이 늦을 수 있어
// 아래 신호들은 propagation 지연으로 보고 backoff 재시도합니다.
function isRepoStillPreparing(e) {
  if (!e) return false;
  // 명확한 propagation 신호
  if (e.status === 404 || e.status === 409) return true;
  // GitHub이 422/500 + 메시지로 알려주는 케이스도 같이
  const msg = String(e.message || '').toLowerCase();
  if (msg.includes('git repository is empty')) return true;
  if (msg.includes('repository is empty')) return true;
  if (e.status === 422 && msg.includes('reference')) return true; // ref 미존재
  return false;
}

async function createInitialCommit(owner, repo, files, message, token, branch = 'main') {
  let lastErr = null;
  for (let attempt = 0; attempt <= REPO_READY_RETRY_DELAYS_MS.length; attempt++) {
    try {
      let lastCommitSha = null;
      for (const file of files) {
        lastCommitSha = await commitFile(owner, repo, file.path, file.content, message, token, branch);
      }

      if (attempt > 0) {
        console.log(`[createInitialCommit] ${attempt + 1}회 시도 성공 (이전 ${attempt}회 propagation 대기)`);
      }
      return lastCommitSha;
    } catch (e) {
      lastErr = e;
      const stillPreparing = isRepoStillPreparing(e);
      const isLastAttempt = attempt === REPO_READY_RETRY_DELAYS_MS.length;
      if (!stillPreparing || isLastAttempt) {
        if (stillPreparing && isLastAttempt) {
          console.warn(`[createInitialCommit] 재시도 한도 초과: ${e.status} ${e.message}`);
        }
        throw e;
      }
      const waitMs = REPO_READY_RETRY_DELAYS_MS[attempt];
      console.log(`[createInitialCommit] propagation 대기 ${waitMs}ms 후 재시도 (시도 ${attempt + 1}, 사유: ${e.status} ${e.message})`);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }
  throw lastErr || new Error('초기 커밋 생성 재시도 한도 초과');
}

// ─────────────────────────────────────────────────────────
// 항해 일지 (voyage) — docs/voyage/YYYY-MM-DD.md append
// ─────────────────────────────────────────────────────────

// 클라이언트가 보낸 로컬 날짜 검증.
// 글로벌 학교를 위해 클라이언트 로컬 날짜를 신뢰하되, 형식과 합리성만 확인합니다.
function isValidLocalDate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const match = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const t = Date.UTC(year, month - 1, day);
  const d = new Date(t);
  if (
    d.getUTCFullYear() !== year
    || d.getUTCMonth() !== month - 1
    || d.getUTCDate() !== day
  ) {
    return false;
  }

  // 클라이언트 로컬 날짜는 시차를 고려해 오늘 기준 ±2일까지만 허용합니다.
  const slack = 2 * 24 * 60 * 60 * 1000;
  const now = new Date();
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.abs(t - todayUtc) <= slack;
}

function isValidLocalTime(s) {
  if (typeof s !== 'string') return false;
  const match = s.match(/^(\d{2}):(\d{2})$/);
  if (!match) return false;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
}

function isValidTimezoneOffset(n) {
  return Number.isInteger(n) && n >= -12 * 60 && n <= 14 * 60;
}

function sanitizeVoyageText(s, maxLen = 500) {
  if (typeof s !== 'string') return '';
  // 마크다운 잠재적 깨짐 방지: 앞 헤더만 제거하고 길이 제한
  return s.replace(/^[ \t]*#{1,6}\s+/gm, '').slice(0, maxLen).trim();
}

function validateVoyageEntryInput(entry) {
  if (!entry || typeof entry !== 'object') return 'voyageEntry가 비어있습니다.';
  if (entry.kind !== 'quick' && entry.kind !== 'detailed') {
    return 'voyageEntry.kind는 quick 또는 detailed여야 합니다.';
  }
  if (!sanitizeVoyageText(entry.title, 100)) {
    return '항해 일지 제목을 입력해주세요.';
  }
  if (entry.kind === 'detailed' && !sanitizeVoyageText(entry.did, 500)) {
    return '자세히 저장에는 "한 일"이 필요합니다.';
  }
  if (!isValidLocalDate(entry.localDate)) {
    return 'voyageEntry.localDate 형식 또는 범위가 올바르지 않습니다.';
  }
  if (!isValidLocalTime(entry.localTime)) {
    return 'voyageEntry.localTime 형식 또는 범위가 올바르지 않습니다.';
  }
  if (!isValidTimezoneOffset(entry.tzOffset)) {
    return 'voyageEntry.tzOffset 범위가 올바르지 않습니다.';
  }
  return null;
}

function formatVoyageDetailedBlock(entry) {
  const time = isValidLocalTime(entry.localTime) ? entry.localTime : '';
  const title = sanitizeVoyageText(entry.title, 100) || '저장';
  const author = sanitizeVoyageText(entry.authorLabel, 60) || '익명';
  const did = sanitizeVoyageText(entry.did, 500);
  const blocker = sanitizeVoyageText(entry.blocker, 500);
  const next = sanitizeVoyageText(entry.next, 500);
  const codeLines = Number.isFinite(entry.codeLines) ? entry.codeLines : null;
  const lineDelta = Number.isFinite(entry.lineDelta) ? entry.lineDelta : null;
  const revisionId = typeof entry.revisionId === 'string' ? entry.revisionId.slice(0, 80) : '';

  const lines = [`## ${time ? `${time} — ` : ''}${title}`, ''];
  lines.push(`- 작성자: ${author}`);
  if (did) lines.push(`- 한 일: ${did}`);
  if (blocker) lines.push(`- 막힌 점: ${blocker}`);
  if (next) lines.push(`- 다음 할 일: ${next}`);
  if (codeLines != null) {
    const delta = lineDelta != null ? ` (${lineDelta >= 0 ? '+' : ''}${lineDelta})` : '';
    lines.push(`- 코드: ${codeLines}줄${delta}`);
  }
  if (revisionId) lines.push(`- VPyLab revision: \`${revisionId}\``);
  return lines.join('\n') + '\n';
}

function formatVoyageQuickBlock(entry) {
  const time = isValidLocalTime(entry.localTime) ? entry.localTime : '';
  const title = sanitizeVoyageText(entry.title, 80) || '빠른 저장';
  const author = sanitizeVoyageText(entry.authorLabel, 60) || '익명';
  const lineDelta = Number.isFinite(entry.lineDelta) ? entry.lineDelta : null;
  const deltaPart = lineDelta != null ? `, 코드 ${lineDelta >= 0 ? '+' : ''}${lineDelta}줄` : '';
  return `- ${time ? `${time} ` : ''}${title}${deltaPart}, ${author}\n`;
}

// 같은 파일에 동시 PUT 시 GitHub은 409/422를 돌려줌 → 최신 sha 다시 받아 재시도.
const VOYAGE_RETRY_DELAYS_MS = [200, 500, 1200];

async function appendVoyageEntry(owner, repo, voyageEntry, token, branch = 'main') {
  if (!voyageEntry || typeof voyageEntry !== 'object') {
    throw new Error('voyageEntry가 비어있습니다.');
  }
  if (!isValidLocalDate(voyageEntry.localDate)) {
    throw new Error('voyageEntry.localDate 형식이 올바르지 않습니다 (YYYY-MM-DD)');
  }

  const kind = voyageEntry.kind === 'quick' ? 'quick' : 'detailed';
  const path = `docs/voyage/${voyageEntry.localDate}.md`;
  const formatter = kind === 'quick' ? formatVoyageQuickBlock : formatVoyageDetailedBlock;
  const newBlock = formatter(voyageEntry);
  const titleForCommit = sanitizeVoyageText(voyageEntry.title, 80) || (kind === 'quick' ? '빠른 저장' : '저장');

  for (let attempt = 0; attempt <= VOYAGE_RETRY_DELAYS_MS.length; attempt++) {
    try {
      const existing = await getContentsFile(owner, repo, path, token, branch);
      const isNewDay = !existing;
      let prev = existing?.text;
      if (!prev || !prev.startsWith('# ')) {
        prev = `# 항해 일지: ${voyageEntry.localDate}\n\n`;
      }
      const sep = prev.endsWith('\n\n') ? '' : (prev.endsWith('\n') ? '\n' : '\n\n');
      const updated = prev + sep + newBlock;

      const body = {
        message: `📔 voyage(${kind}): ${titleForCommit}`,
        content: Buffer.from(updated, 'utf-8').toString('base64'),
        branch,
      };
      if (existing?.sha) body.sha = existing.sha;

      const result = await ghFetch(
        buildContentsUrl(owner, repo, path),
        token,
        { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
      );
      return {
        commitSha: result.commit?.sha || null,
        path,
        kind,
        isNewDay,
      };
    } catch (e) {
      const conflict = e.status === 409 || e.status === 422;
      if (!conflict || attempt === VOYAGE_RETRY_DELAYS_MS.length) throw e;
      const wait = VOYAGE_RETRY_DELAYS_MS[attempt];
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
  }
  throw new Error('voyage append 재시도 한도 초과');
}

// 새 날짜의 첫 voyage 파일이 생긴 직후, history.md 인덱스에 한 줄 추가.
// 같은 날짜가 이미 인덱스에 있으면 아무것도 안 함.
async function ensureHistoryIndexEntry(owner, repo, localDate, token, branch = 'main') {
  const link = `- [${localDate}](docs/voyage/${localDate}.md)`;
  const RETRY = [200, 500];

  for (let attempt = 0; attempt <= RETRY.length; attempt++) {
    try {
      const existing = await getContentsFile(owner, repo, 'history.md', token, branch);
      const prev = existing?.text || '';

      if (prev.includes(`docs/voyage/${localDate}.md`)) {
        return { commitSha: null, alreadyIndexed: true };
      }

      let updated;
      if (!existing || !prev.startsWith('# ')) {
        // 첫 인덱스 생성
        updated = `# 항해 일지 인덱스\n\n${link}\n`;
      } else {
        // 헤더 바로 다음 빈 줄 뒤에 최신 링크를 끼움
        const lines = prev.split('\n');
        const headerIdx = lines.findIndex((l) => l.startsWith('# '));
        let insertAt = headerIdx + 1;
        while (insertAt < lines.length && lines[insertAt].trim() === '') insertAt++;
        lines.splice(insertAt, 0, link);
        updated = lines.join('\n');
      }

      const body = {
        message: `📜 voyage 인덱스: ${localDate}`,
        content: Buffer.from(updated, 'utf-8').toString('base64'),
        branch,
      };
      if (existing?.sha) body.sha = existing.sha;

      const result = await ghFetch(
        buildContentsUrl(owner, repo, 'history.md'),
        token,
        { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
      );
      return { commitSha: result.commit?.sha || null, alreadyIndexed: false };
    } catch (e) {
      const conflict = e.status === 409 || e.status === 422;
      if (!conflict || attempt === RETRY.length) throw e;
      await new Promise((resolve) => setTimeout(resolve, RETRY[attempt]));
    }
  }
  throw new Error('history 인덱스 재시도 한도 초과');
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
  try {
    return generateStandaloneHTML(code, title || repo || 'VPyLab', {
      openInVpylabUrl: buildOpenInVpylabUrl({ owner, repo }),
      repoUrl: owner && repo ? `https://github.com/${owner}/${repo}` : null,
    });
  } catch (e) {
    console.warn('[projects] 실행형 HTML 생성 실패, 정적 fallback 사용:', e.message);
    if (typeof htmlContent === 'string' && htmlContent.trim()) {
      return htmlContent;
    }
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
  const openInVpylabUrl = buildOpenInVpylabUrl({ code, owner, repo });
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
  const openInVpylabUrl = buildOpenInVpylabUrl({ code, owner, repo });

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
  // 단계별 timing 측정: Railway 로그에 [setup] +Xms (총 Yms) <단계>로 남깁니다.
  // 5분 hang 같은 사고 시 어느 단계에서 멎었는지 즉시 식별 가능.
  const t0 = Date.now();
  let lastT = t0;
  const step = (label) => {
    const now = Date.now();
    console.log(`[setup] +${now - lastT}ms (총 ${now - t0}ms): ${label}`);
    lastT = now;
  };

  try {
    const {
      title, description = '', code, htmlContent, githubToken,
      authorLabel = '익명', isTeam = false, repoName: requestedRepoName,
    } = req.body;

    if (!title || typeof title !== 'string') return res.status(400).json({ error: '제목을 입력해주세요.' });
    if (!code || typeof code !== 'string') return res.status(400).json({ error: '코드가 비어있습니다.' });
    if (Buffer.byteLength(code, 'utf-8') > MAX_CODE_BYTES)
      return res.status(413).json({ error: `코드가 너무 큽니다 (최대 ${MAX_CODE_BYTES / 1024}KB).` });
    if (htmlContent != null && typeof htmlContent !== 'string')
      return res.status(400).json({ error: 'GitHub Pages HTML 형식이 올바르지 않습니다.' });
    if (typeof htmlContent === 'string' && Buffer.byteLength(htmlContent, 'utf-8') > MAX_HTML_BYTES)
      return res.status(413).json({ error: `GitHub Pages HTML이 너무 큽니다 (최대 ${MAX_HTML_BYTES / 1024}KB).` });
    if (!githubToken) return res.status(401).json({ error: 'GitHub 로그인이 필요합니다.' });
    step('validation 통과');

    const ghUser = await ghFetch('https://api.github.com/user', githubToken);
    const owner = ghUser.login;
    step(`GitHub /user 조회 (owner=${owner})`);

    const hasCustomRepoName = typeof requestedRepoName === 'string' && requestedRepoName.trim().length > 0;
    const customRepoName = hasCustomRepoName ? normalizeRepoNameInput(requestedRepoName) : '';
    if (hasCustomRepoName && !customRepoName) {
      return res.status(400).json({
        error: 'GitHub 저장소 이름은 영문 소문자, 숫자, 하이픈(-)으로 입력해주세요.',
        code: 'invalid_repo_name',
      });
    }

    const baseName = customRepoName || `vpylab-${sanitizeRepoName(title)}`;
    const repo = await createUniqueRepo(githubToken, baseName, `VPyLab — ${title.slice(0, 100)}`);
    const repoName = repo.name;
    createdRepoFullName = `${owner}/${repoName}`;
    step(`레포 생성 (${repoName})`);

    const pageHtml = buildPagesHtml({ title, code, htmlContent, owner, repo: repoName });
    if (Buffer.byteLength(pageHtml, 'utf-8') > MAX_HTML_BYTES) {
      return res.status(413).json({ error: `GitHub Pages HTML이 너무 큽니다 (최대 ${MAX_HTML_BYTES / 1024}KB).` });
    }
    step('Pages HTML 생성');

    const initialCommitSha = await createInitialCommit(
      owner,
      repoName,
      [
        { path: 'main.py', content: code },
        { path: 'README.md', content: generateReadme({ title, description, code, owner, repo: repoName, isTeam }) },
        { path: 'history.md', content: generateInitialHistory(title, authorLabel) },
        { path: 'index.html', content: pageHtml },
      ],
      `🌱 프로젝트 시작: ${title}`,
      githubToken,
    );
    step(`초기 commit (${initialCommitSha?.slice(0, 7)})`);

    // GitHub Pages 활성화/배포 요청
    let pagesInfo = { active: false, status: null };
    let pagesWarning = null;
    try {
      pagesInfo = await ensurePagesEnabled(owner, repoName, githubToken);
      step(`Pages 활성화 (${pagesInfo.status || 'unknown'})`);
      await requestPagesBuild(owner, repoName, githubToken);
      step('Pages build 요청');
    } catch (e) {
      console.warn('[projects/setup] Pages 활성화 실패:', e.message);
      pagesWarning = e.message;
      step(`Pages 단계 실패: ${e.message}`);
    }

    console.log(`[setup] 완료: 총 ${Date.now() - t0}ms (${owner}/${repoName})`);
    res.json({
      success: true,
      repoFullName: `${owner}/${repoName}`,
      repoUrl: `https://github.com/${owner}/${repoName}`,
      pagesUrl: versionedPagesUrl(owner, repoName, initialCommitSha),
      pagesActivated: pagesInfo.active,
      pagesStatus: pagesInfo.status,
      pagesWarning,
      pageCommitSha: initialCommitSha,
      pageCommitUrl: initialCommitSha ? `https://github.com/${owner}/${repoName}/commit/${initialCommitSha}` : null,
      timingMs: Date.now() - t0,
    });
  } catch (e) {
    console.error(`[projects/setup] 실패 @ 총 ${Date.now() - t0}ms:`, e.message, e.githubErrors || '');
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
      // 항해 일지 옵션 — 클라이언트가 새 모달을 통해 보낼 수 있음.
      // 미전송이면 기존 history.md 누적 흐름을 유지(하위 호환).
      voyageEntry,
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
    if (voyageEntry) {
      const voyageInputError = validateVoyageEntryInput(voyageEntry);
      if (voyageInputError) {
        return res.status(400).json({ error: voyageInputError, code: 'invalid_voyage_entry' });
      }
    }

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

    let voyageInfo = null;
    let historyWarning = null;
    if (voyageEntry) {
      // 새 흐름: 항해 일지 + 인덱스 갱신.
      try {
        const enriched = { ...voyageEntry, authorLabel, revisionId };
        const result = await appendVoyageEntry(owner, repo, enriched, githubToken);
        voyageInfo = {
          path: result.path,
          kind: result.kind,
          commitSha: result.commitSha,
          commitUrl: result.commitSha
            ? `https://github.com/${owner}/${repo}/commit/${result.commitSha}`
            : null,
        };
        if (result.isNewDay) {
          try {
            await ensureHistoryIndexEntry(owner, repo, voyageEntry.localDate, githubToken);
          } catch (e) {
            console.warn('[projects/commit] history 인덱스 갱신 실패:', e.message);
            historyWarning = e.message;
          }
        }
      } catch (e) {
        console.warn('[projects/commit] voyage append 실패:', e.message);
        const conflict = e.status === 409 || e.status === 422;
        return res.status(conflict ? 409 : 502).json({
          error: conflict
            ? '팀원이 동시에 저장 중이어서 항해 일지를 기록하지 못했습니다. 코드와 실행 페이지는 저장됐을 수 있습니다. 잠시 후 다시 저장해주세요.'
            : `항해 일지를 GitHub에 기록하지 못했습니다. 코드와 실행 페이지는 저장됐을 수 있습니다: ${e.message}`,
          code: 'voyage_append_failed',
          partial: true,
          commitSha: mainSha,
          pageCommitSha: pageSha,
          repoUrl: `https://github.com/${owner}/${repo}`,
          pagesUrl: versionedPagesUrl(owner, repo, pageSha || mainSha),
          commitUrl: mainSha ? `https://github.com/${owner}/${repo}/commit/${mainSha}` : null,
          pageCommitUrl: pageSha ? `https://github.com/${owner}/${repo}/commit/${pageSha}` : null,
          voyageEntry: { error: e.message },
        });
      }
    } else {
      // 하위 호환: 기존 history.md 누적 흐름.
      try {
        await appendHistory(owner, repo, { message: finalMsg, authorLabel, source, revisionId }, githubToken);
      } catch (e) {
        console.warn('[projects/commit] history.md 갱신 실패:', e.message);
        historyWarning = e.message;
      }
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
      voyageEntry: voyageInfo,
      historyWarning,
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

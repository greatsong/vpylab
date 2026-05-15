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
import { createClient } from '@supabase/supabase-js';
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
const GITHUB_PAGES_API_TIMEOUT_MS = Math.min(GITHUB_API_TIMEOUT_MS, 8_000);
const PAGES_ENABLE_RETRY_DELAYS_MS = [0, 1_000, 2_500, 5_000, 9_000];
let _supabase = null;

// ========================================
// 헬퍼
// ========================================

function getSupabase() {
  if (_supabase) return _supabase;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY 미설정');
  }
  _supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _supabase;
}

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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

function isGithubTwoFactorRequired(error) {
  const text = [
    error?.message,
    ...(Array.isArray(error?.githubErrors)
      ? error.githubErrors.map((item) => `${item?.message || ''} ${item?.code || ''}`)
      : []),
  ]
    .filter(Boolean)
    .join(' ');

  return /two[-\s]?factor|2FA|2-factor|2단계 인증|2요소 인증|enable two-factor|restricted from account actions/i.test(text);
}

function getGithubTwoFactorFailure(actionLabel = 'GitHub 작업') {
  return {
    status: 403,
    code: 'github_2fa_required',
    error: `${actionLabel}이 GitHub 계정의 2단계 인증(2FA) 요구 때문에 막혔습니다. GitHub 보안 설정에서 2FA를 켠 뒤 다시 시도해주세요. VPyLab 내부 프로젝트와 코드는 GitHub와 별도로 저장됩니다.`,
  };
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
  let existing = null;
  try {
    existing = await ghFetch(buildContentsUrl(owner, repo, path, branch), token);
  } catch (e) {
    if (e.status !== 404) throw e;
    // 파일이 아직 없으면 새로 생성합니다. repo 접근성은 commit 라우트에서 먼저 확인합니다.
  }

  if (existing?.content) {
    const current = Buffer.from(existing.content || '', 'base64').toString('utf-8');
    if (current === content) {
      console.log(`[projects] ${owner}/${repo}:${path} 변경 없음, commit 생략`);
      return null;
    }
  }

  const body = {
    message,
    content: Buffer.from(content, 'utf-8').toString('base64'),
    branch,
  };
  if (existing?.sha) body.sha = existing.sha;

  const result = await ghFetch(
    buildContentsUrl(owner, repo, path),
    token,
    { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
  );
  return result.commit?.sha || null;
}

const COMMIT_RETRY_DELAYS_MS = [200, 500, 1200];

async function commitFilesAtomic(owner, repo, files, message, token, branch = 'main') {
  const cleanFiles = (files || [])
    .filter((file) => file?.path && typeof file.content === 'string');
  if (cleanFiles.length === 0) return null;

  const headSha = await getBranchHeadSha(owner, repo, token, branch);
  const baseTreeSha = await getCommitTreeSha(owner, repo, headSha, token);

  const changedFiles = [];
  await Promise.all(cleanFiles.map(async (file) => {
    const existing = await getContentsFile(owner, repo, file.path, token, branch);
    if (existing?.text === file.content) return;
    changedFiles.push(file);
  }));
  if (changedFiles.length === 0) {
    console.log(`[projects] ${owner}/${repo} 변경 없음, commit 생략`);
    return null;
  }

  const treeResult = await ghFetch(
    `https://api.github.com/repos/${owner}/${repo}/git/trees`,
    token,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        base_tree: baseTreeSha,
        tree: changedFiles.map((file) => ({
          path: file.path,
          mode: '100644',
          type: 'blob',
          content: file.content,
        })),
      }),
    },
  );

  const commitResult = await ghFetch(
    `https://api.github.com/repos/${owner}/${repo}/git/commits`,
    token,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        tree: treeResult.sha,
        parents: [headSha],
      }),
    },
  );

  await ghFetch(
    `https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${encodeURIComponent(branch)}`,
    token,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sha: commitResult.sha, force: false }),
    },
  );

  return commitResult.sha;
}

async function commitGeneratedFiles(owner, repo, token, message, buildFiles, branch = 'main') {
  let lastErr = null;
  for (let attempt = 0; attempt <= COMMIT_RETRY_DELAYS_MS.length; attempt++) {
    const built = await buildFiles();
    try {
      const commitSha = await commitFilesAtomic(owner, repo, built.files, message, token, branch);
      return { ...built, commitSha };
    } catch (e) {
      lastErr = e;
      const conflict = e.status === 409 || e.status === 422;
      if (!conflict || attempt === COMMIT_RETRY_DELAYS_MS.length) throw e;
      await new Promise((resolve) => setTimeout(resolve, COMMIT_RETRY_DELAYS_MS[attempt]));
    }
  }
  throw lastErr || new Error('GitHub commit 재시도 한도 초과');
}

async function getBranchHeadSha(owner, repo, token, branch = 'main') {
  const ref = await ghFetch(
    `https://api.github.com/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(branch)}`,
    token,
  );
  return ref.object?.sha || null;
}

async function getCommitTreeSha(owner, repo, commitSha, token) {
  const commit = await ghFetch(
    `https://api.github.com/repos/${owner}/${repo}/git/commits/${encodeURIComponent(commitSha)}`,
    token,
  );
  return commit.tree?.sha || null;
}

async function bootstrapEmptyRepoWithContents(owner, repo, file, message, token) {
  const result = await ghFetch(
    buildContentsUrl(owner, repo, file.path),
    token,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        content: Buffer.from(file.content, 'utf-8').toString('base64'),
      }),
    },
  );
  return result.commit?.sha || null;
}

const REPO_READY_RETRY_DELAYS_MS = [500, 1500, 3000, 5000];

// 새 레포는 빈 상태로 만든 뒤 Git Data API로 main 브랜치 첫 commit을 한 번에 만듭니다.
// GitHub 내부 ref/object DB 반영이 늦을 수 있어 아래 신호들은 propagation 지연으로 보고 재시도합니다.
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

async function createInitialCommitOnce(owner, repo, files, message, token, branch = 'main') {
  let parentSha = null;
  let baseTreeSha = null;

  try {
    parentSha = await getBranchHeadSha(owner, repo, token, branch);
    if (parentSha) {
      baseTreeSha = await getCommitTreeSha(owner, repo, parentSha, token);
    }
  } catch (e) {
    const msg = String(e.message || '').toLowerCase();
    const isEmptyRepo = e.status === 404
      || e.status === 409
      || msg.includes('git repository is empty')
      || msg.includes('repository is empty');
    if (!isEmptyRepo) throw e;
  }

  let treeResult = null;
  try {
    treeResult = await ghFetch(
      `https://api.github.com/repos/${owner}/${repo}/git/trees`,
      token,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(baseTreeSha ? { base_tree: baseTreeSha } : {}),
          tree: files.map((file) => ({
            path: file.path,
            mode: '100644',
            type: 'blob',
            content: file.content,
          })),
        }),
      },
    );
  } catch (e) {
    if (parentSha || !isRepoStillPreparing(e)) throw e;

    // GitHub은 새 public repo가 완전히 빈 상태일 때 Git Data API의 tree 생성도
    // 409 "Git Repository is empty"로 거절할 수 있습니다. Contents API로 첫 파일을
    // 만들어 main 브랜치를 세운 뒤 Git Data API로 전체 초기 파일을 맞춥니다.
    parentSha = await bootstrapEmptyRepoWithContents(
      owner,
      repo,
      files[0],
      `${message} (bootstrap)`,
      token,
    );
    if (!parentSha) throw e;
    if (files.length === 1) return parentSha;

    baseTreeSha = await getCommitTreeSha(owner, repo, parentSha, token);
    treeResult = await ghFetch(
      `https://api.github.com/repos/${owner}/${repo}/git/trees`,
      token,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(baseTreeSha ? { base_tree: baseTreeSha } : {}),
          tree: files.map((file) => ({
            path: file.path,
            mode: '100644',
            type: 'blob',
            content: file.content,
          })),
        }),
      },
    );
  }

  const commitResult = await ghFetch(
    `https://api.github.com/repos/${owner}/${repo}/git/commits`,
    token,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        tree: treeResult.sha,
        parents: parentSha ? [parentSha] : [],
      }),
    },
  );

  if (parentSha) {
    await ghFetch(
      `https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${encodeURIComponent(branch)}`,
      token,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sha: commitResult.sha, force: false }),
      },
    );
  } else {
    await ghFetch(
      `https://api.github.com/repos/${owner}/${repo}/git/refs`,
      token,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: commitResult.sha }),
      },
    );
  }

  return commitResult.sha;
}

async function createInitialCommit(owner, repo, files, message, token, branch = 'main') {
  let lastErr = null;
  for (let attempt = 0; attempt <= REPO_READY_RETRY_DELAYS_MS.length; attempt++) {
    try {
      const commitSha = await createInitialCommitOnce(owner, repo, files, message, token, branch);

      if (attempt > 0) {
        console.log(`[createInitialCommit] ${attempt + 1}회 시도 성공 (이전 ${attempt}회 propagation 대기)`);
      }
      return commitSha;
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

async function buildVoyageFileUpdate(owner, repo, voyageEntry, token, branch = 'main') {
  if (!voyageEntry || typeof voyageEntry !== 'object') {
    throw new Error('voyageEntry가 비어있습니다.');
  }
  if (!isValidLocalDate(voyageEntry.localDate)) {
    throw new Error('voyageEntry.localDate 형식이 올바르지 않습니다 (YYYY-MM-DD)');
  }

  const kind = voyageEntry.kind === 'quick' ? 'quick' : 'detailed';
  const path = `docs/voyage/${voyageEntry.localDate}.md`;
  const formatter = kind === 'quick' ? formatVoyageQuickBlock : formatVoyageDetailedBlock;
  const existing = await getContentsFile(owner, repo, path, token, branch);
  const isNewDay = !existing;
  let prev = existing?.text;
  if (!prev || !prev.startsWith('# ')) {
    prev = `# 항해 일지: ${voyageEntry.localDate}\n\n`;
  }
  const sep = prev.endsWith('\n\n') ? '' : (prev.endsWith('\n') ? '\n' : '\n\n');
  return {
    file: { path, content: prev + sep + formatter(voyageEntry) },
    path,
    kind,
    isNewDay,
  };
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

async function buildHistoryIndexFileUpdate(owner, repo, localDate, token, branch = 'main') {
  const link = `- [${localDate}](docs/voyage/${localDate}.md)`;
  const existing = await getContentsFile(owner, repo, 'history.md', token, branch);
  const prev = existing?.text || '';

  if (prev.includes(`docs/voyage/${localDate}.md`)) {
    return { file: null, alreadyIndexed: true };
  }

  let updated;
  if (!existing || !prev.startsWith('# ')) {
    updated = `# 항해 일지 인덱스\n\n${link}\n`;
  } else {
    const lines = prev.split('\n');
    const headerIdx = lines.findIndex((l) => l.startsWith('# '));
    let insertAt = headerIdx + 1;
    while (insertAt < lines.length && lines[insertAt].trim() === '') insertAt++;
    lines.splice(insertAt, 0, link);
    updated = lines.join('\n');
  }

  return {
    file: { path: 'history.md', content: updated },
    alreadyIndexed: false,
  };
}

function parseRepoFullName(repoFullName) {
  if (!repoFullName || typeof repoFullName !== 'string') return null;
  const match = repoFullName.match(
    /^([A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?)\/([A-Za-z0-9._-]{1,100})$/,
  );
  if (!match) return null;
  const [, owner, repo] = match;
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

async function getStaleCodeRevisionInfo({ revisionId, projectId, codeId }) {
  if (!revisionId) return null;

  try {
    const supabase = getSupabase();
    const { data: revision, error: revisionError } = await supabase
      .from('vpylab_code_revisions')
      .select('id, project_id, code_id, created_at')
      .eq('id', revisionId)
      .maybeSingle();
    if (revisionError || !revision?.code_id) {
      if (revisionError) console.warn('[projects/commit] revision 조회 실패:', revisionError.message);
      return null;
    }

    if (projectId && revision.project_id && revision.project_id !== projectId) {
      return {
        stale: true,
        reason: 'project_mismatch',
        latestRevisionId: null,
      };
    }

    const targetCodeId = codeId || revision.code_id;
    const { data: latest, error: latestError } = await supabase
      .from('vpylab_code_revisions')
      .select('id, created_at')
      .eq('code_id', targetCodeId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latestError || !latest?.id) {
      if (latestError) console.warn('[projects/commit] 최신 revision 조회 실패:', latestError.message);
      return null;
    }

    return latest.id !== revisionId
      ? {
          stale: true,
          reason: 'newer_revision_exists',
          latestRevisionId: latest.id,
          latestCreatedAt: latest.created_at,
        }
      : null;
  } catch (e) {
    console.warn('[projects/commit] stale revision 확인 실패:', e.message);
    return null;
  }
}

function sanitizeGithubUsername(username) {
  const trimmed = String(username || '').trim().replace(/^@/, '');
  return /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/.test(trimmed)
    ? trimmed
    : '';
}

function normalizeGithubUsernames(input) {
  const rawUsernames = Array.isArray(input) ? input : [input];
  const normalized = [];
  const seen = new Set();

  for (const raw of rawUsernames) {
    const safe = sanitizeGithubUsername(raw);
    if (!safe || seen.has(safe.toLowerCase())) continue;
    seen.add(safe.toLowerCase());
    normalized.push(safe);
  }

  return normalized;
}

function extractGithubUsernameFromAuthUser(user) {
  const githubIdentity = user?.identities?.find((identity) => identity.provider === 'github');
  const candidates = [
    user?.user_metadata?.user_name,
    user?.user_metadata?.preferred_username,
    githubIdentity?.identity_data?.user_name,
    githubIdentity?.identity_data?.preferred_username,
  ];
  return candidates.map(sanitizeGithubUsername).find(Boolean) || '';
}

function getGithubInviteFailure(e) {
  if (e.status === 401) {
    return { status: 401, code: 'github_auth_required', error: 'GitHub 인증이 만료되었습니다.' };
  }
  if (e.status === 403 && isGithubTwoFactorRequired(e)) {
    return getGithubTwoFactorFailure('GitHub collaborator 초대');
  }
  if (e.status === 403) {
    return { status: 403, code: 'github_forbidden', error: `GitHub 권한 부족: ${e.message}` };
  }
  if (e.status === 404) {
    return {
      status: 404,
      code: 'repo_or_user_not_found',
      error: 'GitHub 저장소 또는 사용자를 찾을 수 없습니다. 저장소와 GitHub 사용자명을 확인해주세요.',
    };
  }
  if (e.status === 422) {
    return {
      status: 422,
      code: 'github_invite_unprocessable',
      error: '이미 초대되었거나 collaborator 추가 요청이 처리되지 않았습니다. GitHub 저장소 설정을 확인해주세요.',
    };
  }
  return { status: 500, code: 'github_invite_failed', error: e.message };
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

function isRetryablePagesActivationError(error) {
  const status = error?.status;
  const text = [
    error?.message,
    ...(Array.isArray(error?.githubErrors)
      ? error.githubErrors.map((item) => `${item?.message || ''} ${item?.code || ''}`)
      : []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if ([404, 409, 422, 503, 504].includes(status)) return true;
  return /not ready|not yet|pending|building|repository is empty|git repository is empty|pages is not enabled|page build/i.test(text);
}

function getPagesActivationWarning(error) {
  if (!error) return null;
  if (error.status === 401) {
    return 'GitHub 로그인이 만료되어 Pages 배포 확인을 마치지 못했습니다. VPyLab 저장은 완료됐고, GitHub로 다시 로그인한 뒤 저장하면 Pages를 다시 확인합니다.';
  }
  if (error.status === 403 && isGithubTwoFactorRequired(error)) {
    return 'GitHub 계정의 2단계 인증(2FA) 요구 때문에 Pages 배포 확인을 마치지 못했습니다. GitHub에서 2FA를 켠 뒤 다시 저장해주세요.';
  }
  if (error.status === 403) {
    return 'GitHub Pages를 켤 권한이 부족합니다. 저장소 Settings → Pages 권한을 확인하거나, 저장소 소유자가 GitHub로 다시 로그인한 뒤 저장해주세요.';
  }
  return 'GitHub Pages 배포 확인이 아직 끝나지 않았습니다. README 링크가 404로 보이면 1~2분 뒤 새로고침하거나, VPyLab에서 GitHub로 다시 로그인한 뒤 저장해주세요.';
}

async function ensurePagesEnabledOnce(owner, repo, token) {
  try {
    const page = await ghFetch(`https://api.github.com/repos/${owner}/${repo}/pages`, token, {
      timeoutMs: GITHUB_PAGES_API_TIMEOUT_MS,
    });
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
      timeoutMs: GITHUB_PAGES_API_TIMEOUT_MS,
    });
    return {
      active: true,
      status: page.status || 'building',
      htmlUrl: page.html_url || null,
    };
  }
}

async function ensurePagesEnabled(owner, repo, token) {
  let lastError = null;
  for (let attempt = 0; attempt < PAGES_ENABLE_RETRY_DELAYS_MS.length; attempt += 1) {
    const waitMs = PAGES_ENABLE_RETRY_DELAYS_MS[attempt];
    if (waitMs) await sleep(waitMs);
    try {
      const page = await ensurePagesEnabledOnce(owner, repo, token);
      if (attempt > 0) {
        console.log(`[pages] ${owner}/${repo} 활성화 확인 성공 (재시도 ${attempt}회)`);
      }
      return page;
    } catch (e) {
      lastError = e;
      const canRetry = attempt < PAGES_ENABLE_RETRY_DELAYS_MS.length - 1
        && isRetryablePagesActivationError(e);
      if (!canRetry) throw e;
      console.log(`[pages] ${owner}/${repo} 활성화 재시도 예정 (${attempt + 1}/${PAGES_ENABLE_RETRY_DELAYS_MS.length - 1}, 사유: ${e.status || 'ERR'} ${e.message})`);
    }
  }
  throw lastError || new Error('GitHub Pages 활성화 확인 실패');
}

async function requestPagesBuild(owner, repo, token) {
  try {
    await ghFetch(`https://api.github.com/repos/${owner}/${repo}/pages/builds`, token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      timeoutMs: GITHUB_PAGES_API_TIMEOUT_MS,
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
async function createUniqueRepo(githubToken, baseName, description, { allowFallbackNames = true } = {}) {
  const tryNames = allowFallbackNames
    ? [
      baseName,
      `${baseName}-2`,
      `${baseName}-3`,
      `${baseName}-4`,
      `${baseName}-${crypto.randomUUID().slice(0, 6)}`,
    ]
    : [baseName];
  let lastErr = null;
  for (const name of tryNames) {
    try {
      const created = await ghFetch('https://api.github.com/user/repos', githubToken, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description: description.slice(0, 350),
          auto_init: false,
          has_issues: true,
          has_wiki: false,
          private: false,  // GitHub Pages를 디폴트로 쓰려면 public
        }),
      });
      return created;
    } catch (e) {
      lastErr = e;
      if (!allowFallbackNames && e.status === 422) {
        e.code = 'repo_name_unavailable';
        e.userMessage = `GitHub 저장소 이름 "${name}"은 이미 사용 중이거나 만들 수 없습니다. 다른 이름을 입력해주세요.`;
        throw e;
      }
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

> 처음 만든 직후에는 GitHub Pages 배포가 1~2분 걸릴 수 있습니다. 링크가 404로 보이면 잠시 뒤 새로고침하거나, VPyLab에서 GitHub로 다시 로그인한 뒤 프로젝트를 한 번 저장해주세요.

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

async function buildHistoryFileUpdate(owner, repo, entry, token, branch = 'main') {
  let prev = '';
  const existing = await getContentsFile(owner, repo, 'history.md', token, branch);
  if (existing?.text) {
    prev = existing.text;
    if (prev.length > MAX_HISTORY_BYTES) {
      prev = prev.slice(0, Math.floor(MAX_HISTORY_BYTES / 2));
    }
  } else {
    prev = '# 📜 작업 이력\n\n';
  }

  const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const newSection = `## ${ts}

- 메시지: ${entry.message || '(메시지 없음)'}
- 작성자: ${entry.authorLabel || '익명'}
- 출처: ${entry.source || 'manual'}
${entry.revisionId ? `- VPyLab revision: \`${entry.revisionId}\`\n` : ''}
`;

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

  return { path: 'history.md', content: combined };
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
    const repo = await createUniqueRepo(
      githubToken,
      baseName,
      `VPyLab — ${title.slice(0, 100)}`,
      { allowFallbackNames: !hasCustomRepoName },
    );
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
      pagesWarning = getPagesActivationWarning(e);
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
    if (e.status === 401) return res.status(401).json({ error: 'GitHub 인증이 만료되었습니다.', code: 'github_auth_required', repoFullName: createdRepoFullName });
    if (e.status === 403 && isGithubTwoFactorRequired(e)) {
      const failure = getGithubTwoFactorFailure('GitHub 저장소 생성/초기 저장');
      return res.status(failure.status).json({ error: failure.error, code: failure.code, repoFullName: createdRepoFullName });
    }
    if (e.status === 403) return res.status(403).json({ error: `GitHub 권한 부족: ${e.message}`, code: 'github_forbidden', repoFullName: createdRepoFullName });
    if (e.code === 'repo_name_unavailable') {
      return res.status(409).json({ error: e.userMessage || e.message, code: e.code, repoFullName: createdRepoFullName });
    }
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
    if (e.status === 403 && isGithubTwoFactorRequired(e)) {
      const failure = getGithubTwoFactorFailure('GitHub 저장 권한 확인');
      return res.status(failure.status).json({ error: failure.error, code: failure.code });
    }
    if (e.status === 403) {
      return res.status(403).json({ error: `GitHub 권한 부족: ${e.message}`, code: 'github_forbidden' });
    }
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
// POST /api/projects/members/github-usernames
// 프로젝트 멤버의 GitHub OAuth username 조회
// ========================================
router.post('/members/github-usernames', limiter, async (req, res) => {
  try {
    const { projectId, accessToken } = req.body;
    if (!projectId) return res.status(400).json({ error: '프로젝트 ID가 없습니다.', code: 'missing_project_id' });
    if (!accessToken) return res.status(401).json({ error: '로그인이 필요합니다.', code: 'auth_required' });

    const supabase = getSupabase();
    const { data: authData, error: authError } = await supabase.auth.getUser(accessToken);
    const requester = authData?.user;
    if (authError || !requester) {
      return res.status(401).json({ error: '로그인이 만료되었습니다.', code: 'auth_expired' });
    }

    const { data: project, error: projectError } = await supabase
      .from('vpylab_projects')
      .select('id, owner_id')
      .eq('id', projectId)
      .single();
    if (projectError || !project) {
      return res.status(404).json({ error: '프로젝트를 찾을 수 없습니다.', code: 'project_not_found' });
    }
    if (project.owner_id !== requester.id) {
      return res.status(403).json({ error: 'GitHub 권한 초대 정보는 프로젝트 소유자만 볼 수 있습니다.', code: 'owner_required' });
    }

    const { data: members, error: memberError } = await supabase
      .from('vpylab_project_members')
      .select('user_id, role')
      .eq('project_id', projectId);
    if (memberError) {
      return res.status(500).json({ error: memberError.message, code: 'members_lookup_failed' });
    }

    const githubUsernames = {};
    await Promise.all((members || []).map(async (member) => {
      if (member.role === 'owner') return;
      const { data, error } = await supabase.auth.admin.getUserById(member.user_id);
      if (error) {
        console.warn(`[projects/members/github-usernames] ${member.user_id} 조회 실패: ${error.message}`);
        return;
      }
      const username = extractGithubUsernameFromAuthUser(data?.user);
      if (username) githubUsernames[member.user_id] = username;
    }));

    res.json({ ok: true, githubUsernames });
  } catch (e) {
    console.error('[projects/members/github-usernames]', e.message);
    res.status(500).json({ error: e.message, code: 'github_usernames_failed' });
  }
});

// ========================================
// POST /api/projects/collaborators/invite
// 저장소 소유자가 팀원의 GitHub 계정을 collaborator로 초대
// ========================================
router.post('/collaborators/invite', limiter, async (req, res) => {
  try {
    const { repoFullName, username, usernames, githubToken } = req.body;
    const parsed = parseRepoFullName(repoFullName);
    const safeUsernames = normalizeGithubUsernames(usernames || username);
    if (!parsed) return res.status(400).json({ error: 'GitHub 저장소 연결 정보가 없습니다.', code: 'missing_repo' });
    if (safeUsernames.length === 0) return res.status(400).json({ error: 'GitHub 사용자명을 확인해주세요.', code: 'invalid_github_username' });
    if (!githubToken) return res.status(401).json({ error: 'GitHub 인증 필요', code: 'github_auth_required' });

    const access = await getRepoAccess(parsed.owner, parsed.repo, githubToken);
    if (!access.canAdmin) {
      return res.status(403).json({
        error: 'GitHub collaborator를 초대하려면 저장소 관리자 권한이 필요합니다. 저장소 소유자 계정으로 다시 시도해주세요.',
        code: 'github_admin_permission_required',
      });
    }

    const invited = [];
    const failed = [];

    for (const safeUsername of safeUsernames) {
      try {
        const invitation = await ghFetch(
          `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/collaborators/${encodeURIComponent(safeUsername)}`,
          githubToken,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ permission: 'push' }),
          },
        );

        invited.push({
          username: safeUsername,
          invitationUrl: invitation.html_url || null,
          alreadyCollaborator: !invitation.id && !invitation.html_url,
        });
      } catch (e) {
        const failure = getGithubInviteFailure(e);
        failed.push({
          username: safeUsername,
          error: failure.error,
          code: failure.code,
          status: failure.status,
        });
      }
    }

    if (invited.length === 0 && failed.length === 1 && safeUsernames.length === 1) {
      const failure = failed[0];
      return res.status(failure.status || 500).json({
        error: failure.error,
        code: failure.code,
        username: failure.username,
        repoFullName: access.fullName,
        invited,
        failed,
      });
    }

    if (invited.length === 0 && failed.length > 0) {
      const firstFailure = failed[0];
      if (firstFailure.code === 'github_2fa_required') {
        return res.status(firstFailure.status || 403).json({
          error: firstFailure.error,
          code: firstFailure.code,
          repoFullName: access.fullName,
          invited,
          failed,
        });
      }
      return res.status(422).json({
        error: 'GitHub collaborator 초대가 모두 실패했습니다.',
        code: 'github_invite_all_failed',
        repoFullName: access.fullName,
        invited,
        failed,
      });
    }

    res.json({
      ok: true,
      repoFullName: access.fullName,
      invited,
      failed,
      username: invited[0]?.username || null,
      invitationUrl: invited[0]?.invitationUrl || null,
    });
  } catch (e) {
    console.error('[projects/collaborators/invite]', e.message);
    const failure = getGithubInviteFailure(e);
    res.status(failure.status).json({ error: failure.error, code: failure.code });
  }
});

// ========================================
// POST /api/projects/collaborators/pending
// 저장소의 "보류 중" GitHub 초대 목록을 반환. owner에게 "지금 누가 초대받았고
// 아직 수락 안 했는지" 가시화합니다 — UI에서 "저장이 안 됐나?" 착각을 막는 핵심.
//
// POST로 한 이유: GitHub OAuth token을 body로 받아야 해서 (URL에 토큰 노출 금지).
// ========================================
router.post('/collaborators/pending', limiter, async (req, res) => {
  try {
    const { repoFullName, githubToken } = req.body;
    const parsed = parseRepoFullName(repoFullName);
    if (!parsed) return res.status(400).json({ error: 'GitHub 저장소 연결 정보가 없습니다.', code: 'missing_repo' });
    if (!githubToken) return res.status(401).json({ error: 'GitHub 인증 필요', code: 'github_auth_required' });

    const invitations = await ghFetch(
      `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/invitations?per_page=100`,
      githubToken,
    );
    const items = Array.isArray(invitations) ? invitations.map((inv) => ({
      id: inv.id,
      invitee: inv.invitee?.login || null,
      inviter: inv.inviter?.login || null,
      permissions: inv.permissions || null,        // "write" | "admin" | ...
      created_at: inv.created_at || null,
      expired: !!inv.expired,
      htmlUrl: inv.html_url || null,
    })) : [];
    res.json({ ok: true, repoFullName: `${parsed.owner}/${parsed.repo}`, count: items.length, invitations: items });
  } catch (e) {
    if (e.status === 401) return res.status(401).json({ error: 'GitHub 인증이 만료되었습니다.', code: 'github_auth_required' });
    if (e.status === 403 && isGithubTwoFactorRequired(e)) {
      const failure = getGithubTwoFactorFailure('GitHub 초대 목록 조회');
      return res.status(failure.status).json({ error: failure.error, code: failure.code });
    }
    if (e.status === 403) return res.status(403).json({ error: `GitHub 권한 부족: ${e.message}`, code: 'github_forbidden' });
    if (e.status === 404) return res.status(404).json({ error: 'GitHub 저장소를 찾을 수 없습니다.', code: 'missing_repo' });
    console.error('[projects/collaborators/pending]', e.message);
    res.status(e.status || 500).json({ error: e.message, code: 'github_pending_list_failed' });
  }
});

// ========================================
// POST /api/projects/collaborators/cancel
// 보류 중인 GitHub collaborator 초대를 owner가 취소.
// (DELETE 메서드를 쓰면 URL에 invitationId가 들어가는데 토큰을 body로 보내는 패턴과
//  맞추기 위해 POST + invitationId를 body로 받습니다.)
// ========================================
router.post('/collaborators/cancel', limiter, async (req, res) => {
  try {
    const { repoFullName, invitationId, githubToken } = req.body;
    const parsed = parseRepoFullName(repoFullName);
    const idNum = Number(invitationId);
    if (!parsed) return res.status(400).json({ error: 'GitHub 저장소 연결 정보가 없습니다.', code: 'missing_repo' });
    if (!Number.isInteger(idNum) || idNum <= 0) return res.status(400).json({ error: '초대 id가 올바르지 않습니다.', code: 'invalid_invitation_id' });
    if (!githubToken) return res.status(401).json({ error: 'GitHub 인증 필요', code: 'github_auth_required' });

    await ghFetch(
      `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/invitations/${idNum}`,
      githubToken,
      { method: 'DELETE' },
    );
    res.json({ ok: true, cancelled: idNum });
  } catch (e) {
    if (e.status === 401) return res.status(401).json({ error: 'GitHub 인증이 만료되었습니다.', code: 'github_auth_required' });
    if (e.status === 403 && isGithubTwoFactorRequired(e)) {
      const failure = getGithubTwoFactorFailure('GitHub 초대 취소');
      return res.status(failure.status).json({ error: failure.error, code: failure.code });
    }
    if (e.status === 403) return res.status(403).json({ error: `GitHub 권한 부족: ${e.message}`, code: 'github_forbidden' });
    if (e.status === 404) return res.status(404).json({ error: '이미 취소되었거나 존재하지 않는 초대입니다.', code: 'invitation_not_found' });
    console.error('[projects/collaborators/cancel]', e.message);
    res.status(e.status || 500).json({ error: e.message, code: 'github_invite_cancel_failed' });
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
      recordOnly = false,
      projectId,
      codeId,
      // 항해 일지 옵션 — 클라이언트가 새 모달을 통해 보낼 수 있음.
      // 미전송이면 기존 history.md 누적 흐름을 유지(하위 호환).
      voyageEntry,
    } = req.body;

    const parsed = parseRepoFullName(repoFullName);
    if (!parsed) return res.status(400).json({ error: 'GitHub 저장소 연결 정보가 없습니다.', code: 'missing_repo' });
    if (recordOnly && !voyageEntry) {
      return res.status(400).json({ error: '기록만 저장하려면 항해 일지 내용이 필요합니다.', code: 'missing_voyage_entry' });
    }
    if (!recordOnly && !code) return res.status(400).json({ error: '코드 비어있음' });
    if (!recordOnly && Buffer.byteLength(code, 'utf-8') > MAX_CODE_BYTES)
      return res.status(413).json({ error: `코드가 너무 큽니다 (최대 ${MAX_CODE_BYTES / 1024}KB).` });
    if (!recordOnly && htmlContent != null && typeof htmlContent !== 'string')
      return res.status(400).json({ error: 'GitHub Pages HTML 형식이 올바르지 않습니다.' });
    if (!recordOnly && typeof htmlContent === 'string' && Buffer.byteLength(htmlContent, 'utf-8') > MAX_HTML_BYTES)
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

    if (!recordOnly && revisionId) {
      const staleInfo = await getStaleCodeRevisionInfo({ revisionId, projectId, codeId });
      if (staleInfo?.stale) {
        const headSha = await getBranchHeadSha(owner, repo, githubToken).catch(() => null);
        console.log(
          `[projects/commit] 오래된 revision 반영 생략: ${owner}/${repo} `
          + `revision=${revisionId} latest=${staleInfo.latestRevisionId || 'unknown'}`,
        );
        return res.json({
          success: true,
          skipped: true,
          staleRevision: true,
          staleReason: staleInfo.reason,
          latestRevisionId: staleInfo.latestRevisionId,
          commitSha: headSha,
          repoUrl: `https://github.com/${owner}/${repo}`,
          pagesUrl: versionedPagesUrl(owner, repo, headSha),
          commitUrl: headSha ? `https://github.com/${owner}/${repo}/commit/${headSha}` : null,
          pageCommitUrl: null,
          pagesActivated: false,
          pagesStatus: null,
          pagesBuildRequested: false,
          pagesWarning: '더 최신 코드 저장이 있어 이전 코드의 GitHub 덮어쓰기를 건너뛰었습니다.',
          voyageEntry: null,
          historyWarning: null,
        });
      }
    }

    const finalMsg = (message || '저장').slice(0, 200);
    const commitMsg = `${finalMsg}\n\n— ${authorLabel} via VPyLab`;

    let mainSha = null;
    let pageSha = null;
    let pagesInfo = { active: false, status: null };
    let pagesBuildRequested = false;
    let pagesWarning = null;
    let voyageInfo = null;
    let historyWarning = null;
    let historySha = null;

    if (recordOnly) {
      try {
        const recordCommit = await commitGeneratedFiles(
          owner,
          repo,
          githubToken,
          `📔 voyage: ${finalMsg}`,
          async () => {
            const enriched = { ...voyageEntry, authorLabel, revisionId };
            const voyageUpdate = await buildVoyageFileUpdate(owner, repo, enriched, githubToken);
            const files = [voyageUpdate.file];
            let indexUpdated = false;

            if (voyageUpdate.isNewDay) {
              const indexUpdate = await buildHistoryIndexFileUpdate(owner, repo, voyageEntry.localDate, githubToken);
              if (indexUpdate.file) {
                files.push(indexUpdate.file);
                indexUpdated = true;
              }
            }

            return { files, voyageUpdate, indexUpdated };
          },
        );
        voyageInfo = {
          path: recordCommit.voyageUpdate.path,
          kind: recordCommit.voyageUpdate.kind,
          commitSha: recordCommit.commitSha,
          commitUrl: recordCommit.commitSha
            ? `https://github.com/${owner}/${repo}/commit/${recordCommit.commitSha}`
            : null,
        };
        if (recordCommit.indexUpdated) historySha = recordCommit.commitSha;
      } catch (e) {
        console.warn('[projects/commit] voyage append 실패:', e.message);
        const conflict = e.status === 409 || e.status === 422;
        return res.status(conflict ? 409 : 502).json({
          error: conflict
            ? '팀원이 동시에 저장 중이어서 항해 일지를 기록하지 못했습니다. 잠시 후 다시 저장해주세요.'
            : `항해 일지를 GitHub에 기록하지 못했습니다: ${e.message}`,
          code: 'voyage_append_failed',
          partial: false,
          commitSha: null,
          pageCommitSha: null,
          repoUrl: `https://github.com/${owner}/${repo}`,
          pagesUrl: versionedPagesUrl(owner, repo, null),
          commitUrl: null,
          pageCommitUrl: null,
          voyageEntry: { error: e.message },
        });
      }
    } else {
      const codeCommit = await commitGeneratedFiles(
        owner,
        repo,
        githubToken,
        commitMsg,
        async () => {
          const files = [{ path: 'main.py', content: code }];
          let pageIncluded = false;
          let historyIncluded = false;
          let voyageUpdate = null;
          let indexUpdated = false;

          if (updateIndex) {
            const pageHtml = buildPagesHtml({ title: title || repo, code, htmlContent, owner, repo });
            if (Buffer.byteLength(pageHtml, 'utf-8') > MAX_HTML_BYTES) {
              const sizeError = new Error(`GitHub Pages HTML이 너무 큽니다 (최대 ${MAX_HTML_BYTES / 1024}KB).`);
              sizeError.status = 413;
              throw sizeError;
            }
            files.push({ path: 'index.html', content: pageHtml });
            pageIncluded = true;
          }

          if (voyageEntry) {
            const enriched = { ...voyageEntry, authorLabel, revisionId };
            voyageUpdate = await buildVoyageFileUpdate(owner, repo, enriched, githubToken);
            files.push(voyageUpdate.file);
            if (voyageUpdate.isNewDay) {
              const indexUpdate = await buildHistoryIndexFileUpdate(owner, repo, voyageEntry.localDate, githubToken);
              if (indexUpdate.file) {
                files.push(indexUpdate.file);
                indexUpdated = true;
              }
            }
          } else {
            files.push(await buildHistoryFileUpdate(owner, repo, { message: finalMsg, authorLabel, source, revisionId }, githubToken));
            historyIncluded = true;
          }

          return { files, pageIncluded, historyIncluded, voyageUpdate, indexUpdated };
        },
      );

      mainSha = codeCommit.commitSha;
      pageSha = codeCommit.pageIncluded ? codeCommit.commitSha : null;
      historySha = codeCommit.historyIncluded || codeCommit.indexUpdated ? codeCommit.commitSha : null;
      if (codeCommit.voyageUpdate) {
        voyageInfo = {
          path: codeCommit.voyageUpdate.path,
          kind: codeCommit.voyageUpdate.kind,
          commitSha: codeCommit.commitSha,
          commitUrl: codeCommit.commitSha
            ? `https://github.com/${owner}/${repo}/commit/${codeCommit.commitSha}`
            : null,
        };
      }

      if (updateIndex) {
        try {
          pagesInfo = await ensurePagesEnabled(owner, repo, githubToken);
          const build = await requestPagesBuild(owner, repo, githubToken);
          pagesBuildRequested = build.requested;
        } catch (e) {
          console.warn('[projects/commit] Pages 배포 확인 실패:', e.message);
          pagesWarning = getPagesActivationWarning(e);
        }
      }
    }

    const effectiveCommitSha = mainSha
      || pageSha
      || voyageInfo?.commitSha
      || historySha
      || await getBranchHeadSha(owner, repo, githubToken);

    console.log(
      `[projects/commit] 완료: ${owner}/${repo} `
      + `main=${mainSha ? mainSha.slice(0, 7) : 'skip'} `
      + `page=${pageSha ? pageSha.slice(0, 7) : 'skip'} `
      + `voyage=${voyageInfo?.commitSha ? voyageInfo.commitSha.slice(0, 7) : 'skip'} `
      + `history=${historySha ? historySha.slice(0, 7) : 'skip'}`,
    );

    res.json({
      success: true,
      recordOnly,
      commitSha: effectiveCommitSha,
      pageCommitSha: pageSha,
      repoUrl: `https://github.com/${owner}/${repo}`,
      pagesUrl: versionedPagesUrl(owner, repo, pageSha || effectiveCommitSha),
      commitUrl: effectiveCommitSha ? `https://github.com/${owner}/${repo}/commit/${effectiveCommitSha}` : null,
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
    if (e.status === 403 && isGithubTwoFactorRequired(e)) {
      const failure = getGithubTwoFactorFailure('GitHub 코드 반영');
      return res.status(failure.status).json({ error: failure.error, code: failure.code });
    }
    if (e.status === 404) {
      return res.status(404).json({
        error: 'GitHub 저장소를 찾을 수 없거나 이 GitHub 계정에 접근 권한이 없습니다. 저장소 소유자 계정으로 저장하거나 GitHub collaborator 권한을 추가해주세요.',
        code: 'repo_not_accessible',
      });
    }
    if (e.status === 413) return res.status(413).json({ error: e.message, code: 'github_content_too_large' });
    if (e.status === 403) return res.status(403).json({ error: `GitHub 권한 부족: ${e.message}`, code: 'github_forbidden' });
    res.status(500).json({ error: e.message, code: 'github_commit_failed' });
  }
});

export default router;

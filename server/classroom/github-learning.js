import { createHash } from 'node:crypto';

const digest = value => createHash('sha256').update(value).digest('hex');
const text = (value, max) => typeof value === 'string' ? value.slice(0, max) : '';
const numericId = value => Number.isSafeInteger(value) && value > 0 ? value : null;
const validSha = value => /^[a-f\d]{40,64}$/i.test(value || '') ? value : null;
const timestamp = (value, fallback) => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : fallback;
export const LOCAL_GITHUB_IDENTITIES = { teacher: { id: 910000001, login: 'demo-teacher' }, 'student-a': { id: 910000002, login: 'demo-student-a' }, 'student-b': { id: 910000003, login: 'demo-student-b' } };

export function initGitHubLearningSchema(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS github_learning_events(
    id TEXT PRIMARY KEY,project_id TEXT NOT NULL REFERENCES projects(id),source_key TEXT NOT NULL,
    repository_id INTEGER,installation_id INTEGER,kind TEXT NOT NULL,action TEXT NOT NULL,
    title TEXT NOT NULL,body TEXT NOT NULL,url TEXT,sha TEXT,github_author_id INTEGER,github_author_login TEXT,
    occurred_at TEXT NOT NULL,received_at TEXT NOT NULL,source TEXT NOT NULL,metadata TEXT NOT NULL,
    UNIQUE(project_id,source_key));
    CREATE INDEX IF NOT EXISTS github_learning_project ON github_learning_events(project_id,occurred_at DESC,id);
    CREATE TABLE IF NOT EXISTS github_learning_sync(project_id TEXT PRIMARY KEY REFERENCES projects(id),data TEXT NOT NULL);`);
}

// 원문 링크는 연결된 저장소의 HTTPS 웹 주소만 허용하고 API·외부·스크립트 URL은 버립니다.
export function safeGitHubEvidenceUrl(value, binding) {
  if (typeof value !== 'string' || value.length > 2048) return null;
  try {
    const url = new URL(value);
    const prefix = `/${binding.owner}/${binding.repo}`.toLowerCase();
    if (url.protocol !== 'https:' || url.hostname !== 'github.com' || url.port || url.username || url.password || !url.pathname.toLowerCase().startsWith(`${prefix}/`)) return null;
    if (!/^\/(?:commit\/[a-f\d]{40,64}|pull\/\d+(?:\/files)?|issues\/\d+|compare\/[\w.%/-]+)$/.test(url.pathname.slice(prefix.length))) return null;
    url.search = '';
    return url.href;
  } catch { return null; }
}

export function learningEventFromRow(row) {
  return { id: row.id, projectId: row.project_id, sourceKey: row.source_key, repositoryId: row.repository_id, installationId: row.installation_id, kind: row.kind, action: row.action, title: row.title, body: row.body, url: row.url, sha: row.sha, githubAuthorId: row.github_author_id, githubAuthorLogin: row.github_author_login, occurredAt: row.occurred_at, receivedAt: row.received_at, source: row.source, metadata: JSON.parse(row.metadata || '{}') };
}

export function appendLearningEvent(db, { projectId, binding, kind, action, entityId, title = '', body = '', url, sha, author, occurredAt, receivedAt, source, metadata = {} }) {
  const authorId = numericId(author?.id), login = text(author?.login || author?.username, 100) || null;
  const safeTitle = text(title, 300), safeBody = text(body, 10_000), occurred = timestamp(occurredAt, receivedAt), safeSha = validSha(sha);
  const revision = digest(JSON.stringify([safeTitle, body, safeSha, authorId, login, metadata.state || null]));
  const sourceKey = `github:${binding.repositoryId || binding.key}:${kind}:${String(entityId).slice(0, 200)}:${text(action, 80)}:${occurred}:${revision}`;
  const id = `gh-${digest(`${projectId}:${sourceKey}`).slice(0, 40)}`;
  const data = { ...metadata, entityId: String(entityId).slice(0, 200), bodyTruncated: typeof body === 'string' && body.length > 10_000, titleTruncated: typeof title === 'string' && title.length > 300 };
  const inserted = db.prepare('INSERT OR IGNORE INTO github_learning_events VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(id, projectId, sourceKey, binding.repositoryId || null, binding.installationId || null, kind, text(action, 80), safeTitle, safeBody, safeGitHubEvidenceUrl(url, binding), safeSha, authorId, login, occurred, receivedAt, source, JSON.stringify(data));
  return { id, inserted: inserted.changes === 1 };
}

export function normalizeGitHubLearningEvent(db, { projectId, binding, event, payload, source = 'webhook', receivedAt, deliveryId = null, context = {} }) {
  const common = { projectId, binding, source, receivedAt };
  const action = payload.action || (event === 'push' ? 'pushed' : 'snapshot');
  const metadata = { ...context, ...(deliveryId ? { deliveryId } : {}), ...(source === 'simulator' ? { simulated: true } : {}) };
  const records = [];
  const add = item => records.push(appendLearningEvent(db, { ...common, ...item, metadata: { ...metadata, ...item.metadata } }));
  if (event === 'push') {
    const head = payload.head_commit || payload.commits?.at(-1);
    add({ kind: 'push', action, entityId: `${payload.ref}:${payload.before || ''}:${payload.after || ''}`, title: `브랜치 변경: ${text(payload.ref, 200)}`, body: head?.message || '', url: payload.compare || head?.url, sha: payload.after, author: payload.sender, occurredAt: head?.timestamp || payload.repository?.pushed_at, metadata: { ref: text(payload.ref, 250), forced: payload.forced === true, deleted: payload.deleted === true, authorRole: 'pusher', commitsIncluded: Math.min(payload.commits?.length || 0, 200), commitsOmitted: Math.max(0, (payload.commits?.length || 0) - 200) } });
    for (const commit of (payload.commits || []).slice(0, 200)) {
      if (!validSha(commit.id)) continue;
      // push의 username·이메일로 학생을 추측하지 않습니다. 숫자 작성자 ID가 없으면 미분류입니다.
      add({ kind: 'commit', action: 'observed', entityId: commit.id, title: text(commit.message, 300).split('\n')[0], body: commit.message, url: commit.url, sha: commit.id, author: commit.author, occurredAt: commit.timestamp, metadata: { ref: text(payload.ref, 250), authorRole: 'commit_author', numericAuthorUnavailable: !numericId(commit.author?.id) } });
    }
  } else if (event === 'pull_request' && numericId(payload.pull_request?.id || payload.pull_request?.number)) {
    const item = payload.pull_request;
    add({ kind: 'pull_request', action, entityId: item.id || item.number, title: item.title, body: item.body || '', url: item.html_url, sha: item.head?.sha, author: item.user, occurredAt: item.updated_at || item.created_at, metadata: { number: item.number, state: item.state, merged: item.merged === true, baseSha: validSha(item.base?.sha), baseRef: text(item.base?.ref, 250), headRef: text(item.head?.ref, 250), actorId: numericId(payload.sender?.id) } });
  } else if (event === 'pull_request_review' && numericId(payload.review?.id)) {
    const item = payload.review;
    if (item.state === 'PENDING') return [];
    add({ kind: 'review', action, entityId: item.id, title: `PR #${payload.pull_request?.number || ''} 검토`, body: item.body || '', url: item.html_url, sha: item.commit_id, author: item.user, occurredAt: item.submitted_at || item.updated_at, metadata: { number: payload.pull_request?.number || null, state: item.state, actorId: numericId(payload.sender?.id) } });
  } else if (event === 'issues' && numericId(payload.issue?.id || payload.issue?.number) && !payload.issue.pull_request) {
    const item = payload.issue;
    add({ kind: 'issue', action, entityId: item.id || item.number, title: item.title, body: item.body || '', url: item.html_url, author: item.user, occurredAt: item.updated_at || item.created_at, metadata: { number: item.number, state: item.state, actorId: numericId(payload.sender?.id) } });
  } else if (['issue_comment', 'pull_request_review_comment'].includes(event) && numericId(payload.comment?.id)) {
    const item = payload.comment;
    const reviewComment = event === 'pull_request_review_comment';
    add({ kind: reviewComment ? 'review_comment' : 'issue_comment', action, entityId: item.id, title: reviewComment ? `PR #${payload.pull_request?.number || ''} 코드 의견` : `질문·PR #${payload.issue?.number || ''} 대화`, body: item.body || '', url: item.html_url, sha: item.commit_id || item.original_commit_id, author: item.user, occurredAt: item.updated_at || item.created_at, metadata: { number: payload.pull_request?.number || payload.issue?.number || null, path: text(item.path, 500), line: Number.isSafeInteger(item.line) ? item.line : null, actorId: numericId(payload.sender?.id), deleted: action === 'deleted' } });
  } else if (event === 'commit') {
    const item = payload.commit;
    if (validSha(item?.sha)) add({ kind: 'commit', action: 'snapshot', entityId: item.sha, title: text(item.commit?.message, 300).split('\n')[0], body: item.commit?.message || '', url: item.html_url, sha: item.sha, author: item.author, occurredAt: item.commit?.author?.date || item.commit?.committer?.date, metadata: { authorRole: 'commit_author' } });
  }
  return records;
}

export function nextGitHubPage(link, binding, expectedPath) {
  const value = /<([^>]+)>;\s*rel="next"/.exec(link || '')?.[1];
  if (!value) return null;
  const parsed = new URL(value);
  const root = `/repos/${encodeURIComponent(binding.owner)}/${encodeURIComponent(binding.repo)}`;
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'api.github.com' || parsed.port || parsed.username || parsed.password || ![`${root}${expectedPath}`, `/repositories/${binding.repositoryId}${expectedPath}`].includes(parsed.pathname) || [...parsed.searchParams.keys()].some(key => !['page', 'per_page', 'state', 'sort', 'direction', 'sha'].includes(key)) || Number(parsed.searchParams.get('per_page')) > 100 || !/^\d{1,5}$/.test(parsed.searchParams.get('page') || '')) throw new Error('unsafe_github_pagination');
  return `${expectedPath}${parsed.search}`;
}

export async function backfillGitHubLearning({ binding, requestPage, record, maxRequests = 24, maxPagesPerEndpoint = 2, maxPullReviews = 10, onProgress = () => {} }) {
  const stats = { requests: 0, imported: 0, partial: false, coverage: [], errorCode: null };
  const pulls = new Map();
  async function collect(endpoint, query, event, convert = item => ({ [event]: item })) {
    let path = `${endpoint}?${new URLSearchParams({ per_page: '50', page: '1', ...query })}`, pages = 0;
    while (path) {
      if (stats.requests >= maxRequests || pages >= maxPagesPerEndpoint) { stats.partial = true; return; }
      stats.requests++; const response = await requestPage(path); pages++;
      if (!Array.isArray(response.data)) throw Object.assign(new Error('invalid_github_response'), { code: 'invalid_github_response' });
      for (const item of response.data.slice(0, 100)) {
        if (event === 'pull_request') pulls.set(item.number, item);
        stats.imported += record(event, convert(item)).filter(result => result.inserted).length;
      }
      path = nextGitHubPage(response.link, binding, endpoint);
      onProgress(stats);
    }
    stats.coverage.push(endpoint);
  }
  try {
    await collect('/commits', { sha: binding.branch }, 'commit');
    await collect('/pulls', { state: 'all', sort: 'updated', direction: 'desc' }, 'pull_request', item => ({ pull_request: item, action: 'snapshot' }));
    await collect('/issues', { state: 'all', sort: 'updated', direction: 'desc' }, 'issues', item => ({ issue: item, action: 'snapshot' }));
    await collect('/issues/comments', { sort: 'updated', direction: 'desc' }, 'issue_comment', item => ({ comment: item, action: 'snapshot', issue: { number: Number(/\/(\d+)$/.exec(item.issue_url || '')?.[1]) || null } }));
    await collect('/pulls/comments', { sort: 'updated', direction: 'desc' }, 'pull_request_review_comment', item => ({ comment: item, action: 'snapshot', pull_request: { number: Number(/\/(\d+)$/.exec(item.pull_request_url || '')?.[1]) || null } }));
    const selected = [...pulls.values()].slice(0, maxPullReviews);
    if (selected.length < pulls.size) stats.partial = true;
    for (const pull of selected) await collect(`/pulls/${pull.number}/reviews`, {}, 'pull_request_review', item => ({ review: item, pull_request: pull, action: 'snapshot' }));
  } catch (error) { stats.errorCode = typeof error.code === 'string' ? error.code : 'github_sync_failed'; stats.partial = true; }
  return stats;
}

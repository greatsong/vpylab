import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, generateKeyPairSync, randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createStore } from './store.js';
import { createGitHubService } from './github.js';
import { backfillGitHubLearning, nextGitHubPage, safeGitHubEvidenceUrl } from './github-learning.js';

const repository = { key: 'school-team', owner: 'school', repo: 'team', installationId: 100, repositoryId: 200, branch: 'main', path: 'main.py' };
const SHA = 'a'.repeat(40), NEXT = 'b'.repeat(40), AT = '2026-10-28T01:00:00.000Z';
const a = { id: 910000002, login: 'student-a' }, b = { id: 910000003, login: 'student-b' };
const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const response = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers });

function fixture({ mode = 'live', filename = ':memory:', fetchImpl } = {}) {
  const store = createStore({ localMode: true, filename });
  const teacher = store.user('teacher'), student = store.user('student-a'), project = store.listProjects(teacher)[0];
  const service = createGitHubService({ store, localMode: true, config: { mode, repositories: [repository], webhookSecret: 'evidence-secret', appId: 'Iv1.test', privateKey }, fetchImpl, pause: async () => {} });
  if (mode === 'live') service.bind(project.id, teacher, repository.key);
  return { store, service, teacher, student, project };
}

function deliver(f, event, payload, deliveryId = `${event}-${randomUUID()}`) {
  const raw = Buffer.from(JSON.stringify({ repository: { id: repository.repositoryId }, installation: { id: repository.installationId }, ...payload }));
  const signature = `sha256=${createHmac('sha256', 'evidence-secret').update(raw).digest('hex')}`;
  return f.service.webhook(raw, { 'x-github-event': event, 'x-github-delivery': deliveryId, 'x-hub-signature-256': signature });
}

const pull = { id: 301, number: 1, title: '조건을 바꾸는 실험', body: '가설과 관찰을 비교해주세요.', html_url: 'https://github.com/school/team/pull/1', user: a, created_at: AT, updated_at: AT, head: { sha: SHA, ref: 'experiment' }, base: { sha: NEXT, ref: 'main' }, state: 'open' };
const issue = { id: 302, number: 2, title: '마찰 가정이 필요한가요?', body: '마찰을 추가하는 반례를 검토합니다.', html_url: 'https://github.com/school/team/issues/2', user: b, created_at: AT, updated_at: AT, state: 'open' };

test('서명된 여섯 Webhook 이벤트와 push commit을 원문 근거로 보존하고 ID만으로 작성자를 표현한다', t => {
  const f = fixture(); t.after(() => f.store.close());
  const push = { ref: 'refs/heads/experiment', before: NEXT, after: SHA, sender: a, commits: [{ id: SHA, message: '조건별 실험 추가', url: `https://github.com/school/team/commit/${SHA}`, timestamp: AT, author: { username: a.login, email: '학생 이메일은 저장하지 않음' } }], head_commit: { timestamp: AT, message: '조건별 실험 추가' } };
  assert.equal(deliver(f, 'push', push, 'learning-push').recorded, 2);
  deliver(f, 'pull_request', { action: 'opened', pull_request: pull });
  deliver(f, 'pull_request_review', { action: 'submitted', pull_request: pull, review: { id: 303, body: '질량을 바꾸는 반례도 확인해주세요.', state: 'CHANGES_REQUESTED', user: b, submitted_at: AT, commit_id: SHA, html_url: 'https://github.com/school/team/pull/1#pullrequestreview-303' } });
  deliver(f, 'issues', { action: 'opened', issue });
  deliver(f, 'issue_comment', { action: 'created', issue, comment: { id: 304, body: '반례를 다음 실험에서 확인하겠습니다.', user: a, created_at: AT, updated_at: AT, html_url: 'https://github.com/school/team/issues/2#issuecomment-304' } });
  deliver(f, 'pull_request_review_comment', { action: 'created', pull_request: pull, comment: { id: 305, body: '반복 간격도 비교해주세요.', user: b, path: 'main.py', line: 12, commit_id: SHA, created_at: AT, updated_at: AT, html_url: 'https://github.com/school/team/pull/1#discussion_r305' } });
  const events = f.service.listLearningEvents(f.project.id, f.teacher).events;
  assert.deepEqual(new Set(events.map(event => event.kind)), new Set(['push', 'commit', 'pull_request', 'review', 'issue', 'issue_comment', 'review_comment']));
  assert.equal(events.find(event => event.kind === 'commit').githubAuthorId, null);
  assert.equal(events.find(event => event.kind === 'push').githubAuthorId, a.id);
  assert.equal(events.find(event => event.kind === 'review').githubAuthorId, b.id);
  assert.equal(events.find(event => event.kind === 'review').sha, SHA);
  assert.equal(events.find(event => event.kind === 'review').occurredAt, AT);
  assert.ok(events.every(event => event.receivedAt && event.sourceKey && event.id));
  assert.equal(JSON.stringify(events).includes('학생 이메일'), false);
  assert.equal(deliver(f, 'push', push, 'learning-push').duplicate, true);
  assert.equal(f.service.listLearningEvents(f.project.id, f.teacher).events.length, 7);
});

test('수정·삭제는 이전 본문을 바꾸지 않고 별도 근거로 추가하며 다른 저장소·설치를 거부한다', t => {
  const f = fixture(); t.after(() => f.store.close());
  const comment = { id: 401, body: '첫 번째 관찰', user: { id: 999, login: a.login }, updated_at: AT, html_url: 'https://evil.example/school/team/issues/2' };
  deliver(f, 'issue_comment', { action: 'created', issue, comment });
  deliver(f, 'issue_comment', { action: 'edited', issue, comment: { ...comment, body: '수정한 관찰' } });
  deliver(f, 'issue_comment', { action: 'deleted', issue, comment: { ...comment, body: '수정한 관찰' } });
  const before = f.service.listLearningEvents(f.project.id, f.teacher).events;
  assert.deepEqual(new Set(before.map(event => event.action)), new Set(['created', 'edited', 'deleted']));
  assert.ok(before.some(event => event.body === '첫 번째 관찰'));
  assert.ok(before.every(event => event.githubAuthorId === 999 && event.url === null));
  assert.equal(before.some(event => event.githubAuthorId === a.id), false);
  assert.equal(deliver(f, 'issue_comment', { action: 'created', issue, comment, repository: { id: 201 } }).matched, 0);
  assert.equal(deliver(f, 'issue_comment', { action: 'created', issue, comment, installation: { id: 101 } }).matched, 0);
  assert.equal(f.service.listLearningEvents(f.project.id, f.teacher).events.length, 3);
});

test('Webhook 기록 실패 시 delivery와 모든 근거를 함께 rollback하여 같은 전송을 재시도할 수 있다', t => {
  const f = fixture(); t.after(() => f.store.close());
  f.store.db.exec("CREATE TRIGGER fail_learning BEFORE INSERT ON github_learning_events BEGIN SELECT RAISE(ABORT,'모의 저장 실패'); END");
  assert.throws(() => deliver(f, 'pull_request', { action: 'opened', pull_request: pull }, 'retry-evidence'));
  assert.equal(f.store.db.prepare('SELECT COUNT(*) AS n FROM github_webhook_deliveries').get().n, 0);
  f.store.db.exec('DROP TRIGGER fail_learning');
  assert.equal(deliver(f, 'pull_request', { action: 'opened', pull_request: pull }, 'retry-evidence').recorded, 1);
  assert.equal(f.service.listLearningEvents(f.project.id, f.teacher).events.length, 1);
});

test('근거 URL은 연결된 저장소의 HTTPS 원문만 허용하고 본문·제목은 표시 한도를 보존한다', t => {
  assert.equal(safeGitHubEvidenceUrl('javascript:alert(1)', repository), null);
  assert.equal(safeGitHubEvidenceUrl('https://github.com/other/team/pull/1', repository), null);
  assert.equal(safeGitHubEvidenceUrl('https://github.com/school/team.evil/pull/1', repository), null);
  assert.equal(safeGitHubEvidenceUrl('https://user:password@github.com/school/team/pull/1', repository), null);
  assert.equal(safeGitHubEvidenceUrl('https://github.com/school/team/pull/1#discussion_r10', repository), 'https://github.com/school/team/pull/1#discussion_r10');
  assert.equal(safeGitHubEvidenceUrl('https://github.com/school/team/pull/1?token=private#discussion_r10', repository), 'https://github.com/school/team/pull/1#discussion_r10');
  const f = fixture(); t.after(() => f.store.close());
  deliver(f, 'issues', { action: 'opened', issue: { ...issue, title: '제'.repeat(400), body: '본'.repeat(12_000) } });
  const saved = f.service.listLearningEvents(f.project.id, f.teacher).events[0];
  assert.equal(saved.title.length, 300); assert.equal(saved.body.length, 10_000);
  assert.equal(saved.metadata.bodyTruncated, true); assert.equal(saved.metadata.titleTruncated, true);
});

test('backfill은 commit·PR·review·Issue·대화·코드 의견을 읽고 재실행해도 중복되지 않는다', async t => {
  const calls = [];
  const f = fixture({ fetchImpl: async (url, options) => {
    const path = new URL(url).pathname; calls.push({ path, method: options.method });
    if (path === '/app/installations/100/access_tokens') return response({ token: 'server-only', expires_at: new Date(Date.now() + 3_600_000).toISOString() }, 201);
    if (path === '/repos/school/team') return response({ id: 200, name: 'team', owner: { login: 'school' }, private: true });
    if (path.endsWith('/commits')) return response([{ sha: SHA, html_url: `https://github.com/school/team/commit/${SHA}`, author: a, commit: { message: '조건별 실험', author: { date: AT } } }]);
    if (path.endsWith('/pulls')) return response([pull]);
    if (path.endsWith('/issues')) return response([issue, { ...pull, pull_request: {} }]);
    if (path.endsWith('/issues/comments')) return response([{ id: 501, body: '다음 실험에서 비교하겠습니다.', user: a, created_at: AT, updated_at: AT, html_url: 'https://github.com/school/team/issues/2#issuecomment-501', issue_url: 'https://api.github.com/repos/school/team/issues/2' }]);
    if (path.endsWith('/pulls/comments')) return response([{ id: 502, body: '간격을 검증해주세요.', user: b, created_at: AT, updated_at: AT, commit_id: SHA, html_url: 'https://github.com/school/team/pull/1#discussion_r502', pull_request_url: 'https://api.github.com/repos/school/team/pulls/1' }]);
    if (path.endsWith('/pulls/1/reviews')) return response([{ id: 503, body: '반례를 확인했습니다.', state: 'APPROVED', user: b, submitted_at: AT, commit_id: SHA, html_url: 'https://github.com/school/team/pull/1#pullrequestreview-503' }, { id: 504, state: 'PENDING', body: '아직 제출하지 않은 의견', user: b }]);
    throw new Error('예상하지 않은 API');
  } }); t.after(() => f.store.close());
  const first = await f.service.syncLearningEvents(f.project.id, f.student);
  assert.equal(first.sync.state, 'complete'); assert.equal(first.events.length, 6);
  assert.ok(first.events.every(event => event.source === 'backfill'));
  assert.equal(first.events.some(event => event.body.includes('아직 제출하지 않은')), false);
  const second = await f.service.syncLearningEvents(f.project.id, f.student);
  assert.equal(second.events.length, 6); assert.equal(second.sync.imported, 0);
  assert.ok(calls.every(call => call.method === 'GET' || call.path.endsWith('/access_tokens')));
  assert.equal(JSON.stringify(first).includes('server-only'), false);
});

test('bounded pagination은 남은 페이지와 API 실패를 partial로 표시하고 안전한 next 링크만 따른다', async () => {
  const paths = [], records = [];
  const stats = await backfillGitHubLearning({ binding: repository, maxRequests: 3, maxPagesPerEndpoint: 2, record: (event, payload) => { records.push({ event, payload }); return [{ inserted: true }]; }, requestPage: async path => {
    paths.push(path); const parsed = new URL(`https://api.github.com/repos/school/team${path}`);
    if (parsed.pathname.endsWith('/commits')) return { data: [{ sha: SHA }], link: `<https://api.github.com/repositories/200/commits?page=${Number(parsed.searchParams.get('page')) + 1}&per_page=50&sha=main>; rel="next"` };
    return { data: [], link: null };
  } });
  assert.equal(stats.partial, true); assert.equal(stats.requests, 3); assert.equal(paths.length, 3); assert.equal(records.length, 2);
  assert.equal(nextGitHubPage('<https://api.github.com/repositories/200/issues?page=2>; rel="next"', repository, '/issues'), '/issues?page=2');
  assert.throws(() => nextGitHubPage('<https://evil.example/repos/school/team/issues?page=2>; rel="next"', repository, '/issues'));
  assert.throws(() => nextGitHubPage('<https://api.github.com/repositories/999/issues?page=2>; rel="next"', repository, '/issues'));
  const failed = await backfillGitHubLearning({ binding: repository, record: () => [], requestPage: async () => { throw Object.assign(new Error('인증 원문은 노출하지 않음'), { code: 'github_auth_required' }); } });
  assert.equal(failed.errorCode, 'github_auth_required'); assert.equal(failed.partial, true);
});

test('모의 협력 기록은 교사만 추가하며 같은 fixture 재호출에도 안정된 근거 ID를 유지한다', async t => {
  const f = fixture({ mode: 'simulator' }); t.after(() => f.store.close());
  assert.throws(() => f.service.simulateLearningEvents(f.project.id, f.student), { code: 'access_denied' });
  const first = f.service.simulateLearningEvents(f.project.id, f.teacher), ids = first.events.map(event => event.id).sort();
  assert.equal(first.events.length, 7); assert.ok(first.events.every(event => event.source === 'simulator' && event.metadata.simulated && event.url === null));
  const second = f.service.simulateLearningEvents(f.project.id, f.teacher); assert.deepEqual(second.events.map(event => event.id).sort(), ids);
  assert.ok(second.events.some(event => event.githubAuthorId === a.id)); assert.ok(second.events.some(event => event.githubAuthorId === b.id));
  assert.ok(second.events.some(event => event.kind === 'commit' && event.githubAuthorId === null));
  f.store.addMember(f.project.id, f.teacher, f.student.id, 'viewer');
  await assert.rejects(f.service.syncLearningEvents(f.project.id, f.student), { code: 'access_denied' });
});

test('원문 근거는 서버 재시작 후에도 보존되고 다른 프로젝트에서는 조회되지 않는다', t => {
  const directory = mkdtempSync(join(tmpdir(), 'vpylab-learning-')); t.after(() => rmSync(directory, { recursive: true, force: true }));
  const filename = join(directory, 'classroom.sqlite'), first = fixture({ filename });
  deliver(first, 'pull_request', { action: 'opened', pull_request: pull }, 'persisted-evidence');
  const id = first.service.listLearningEvents(first.project.id, first.teacher).events[0].id;
  const another = first.store.createProject(first.teacher, { title: '다른 팀', code: '' });
  assert.equal(first.service.listLearningEvents(another.id, first.teacher).events.length, 0);
  first.store.close();
  const second = fixture({ filename }); t.after(() => second.store.close());
  assert.equal(second.service.listLearningEvents(first.project.id, second.teacher).events[0].id, id);
});

test('긴 동기화의 재요청은 running 상태를 반환하고 종료 시 수집을 취소한 뒤 DB 사용을 끝낸다', async t => {
  let markStarted;
  const started = new Promise(resolve => { markStarted = resolve; });
  let commitRequests = 0;
  const f = fixture({ fetchImpl: async (url, options) => {
    const path = new URL(url).pathname;
    if (path.includes('/access_tokens')) return response({ token: 'server-only', expires_at: new Date(Date.now() + 3_600_000).toISOString() }, 201);
    if (path === '/repos/school/team') return response({ id: 200, name: 'team', owner: { login: 'school' }, private: true });
    if (path.endsWith('/commits')) {
      commitRequests++; markStarted();
      return new Promise((resolve, reject) => options.signal.addEventListener('abort', () => reject(new Error('모의 요청 취소')), { once: true }));
    }
    return response([]);
  } }); t.after(() => f.store.close());
  const first = f.service.syncLearningEvents(f.project.id, f.teacher);
  await started;
  const replay = await f.service.syncLearningEvents(f.project.id, f.teacher);
  assert.equal(replay.sync.state, 'running'); assert.equal(commitRequests, 1);
  const stopped = f.service.stopWorker();
  await assert.rejects(f.service.syncLearningEvents(f.project.id, f.teacher), { code: 'service_stopping' });
  const result = await first; await stopped;
  assert.equal(result.sync.state, 'failed'); assert.equal(result.sync.errorCode, 'github_network');
  assert.equal(commitRequests, 1);
  assert.equal(f.store.db.prepare('SELECT COUNT(*) AS n FROM github_learning_sync').get().n, 1);
});

test('기존 모의 PR은 job 출처와 실제 요청자를 별도로 연결하고 재수집해도 같은 근거를 유지한다', async t => {
  const f = fixture({ mode: 'simulator' }); t.after(() => f.store.close());
  const state = f.service.status(f.project.id, f.teacher), input = { code: 'print("추가 실험")', title: '다른 조건으로 실험', message: '관찰한 차이를 검토해주세요.', baseSha: state.remote.sha };
  const job = f.service.enqueueProposal(f.project.id, f.student, input);
  assert.equal((await f.service.runOnce()).state, 'succeeded');
  const first = f.service.listLearningEvents(f.project.id, f.teacher).events[0];
  assert.equal(first.kind, 'pull_request'); assert.equal(first.metadata.jobId, job.id);
  assert.equal(first.metadata.requestedByUserId, f.student.id); assert.equal(first.metadata.requestedByRole, 'requester');
  assert.equal(first.githubAuthorId, 910000002); assert.equal(first.source, 'simulator');
  f.store.db.prepare('DELETE FROM github_learning_events WHERE project_id=?').run(f.project.id);
  const recovered = await f.service.syncLearningEvents(f.project.id, f.teacher);
  assert.equal(recovered.events[0].id, first.id); assert.equal(recovered.events.length, 1);
});

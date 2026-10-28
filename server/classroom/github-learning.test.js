import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, createHmac, generateKeyPairSync, randomUUID } from 'node:crypto';
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

function fixture({ mode = 'live', filename = ':memory:', fetchImpl, repositories = [repository] } = {}) {
  const store = createStore({ localMode: true, filename });
  const teacher = store.user('teacher'), student = store.user('student-a'), project = store.listProjects(teacher)[0];
  const service = createGitHubService({ store, localMode: true, config: { mode, repositories, webhookSecret: 'evidence-secret', appId: 'Iv1.test', privateKey }, fetchImpl, pause: async () => {} });
  if (mode === 'live') service.bind(project.id, teacher, repositories[0].key);
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
    if (path.endsWith('/pulls/1/commits')) return response([{ sha: NEXT, html_url: `https://github.com/school/team/commit/${NEXT}`, author: b, commit: { message: '아직 병합하지 않은 동료의 수정', author: { date: AT } } }]);
    if (path.endsWith('/commits')) return response([{ sha: SHA, html_url: `https://github.com/school/team/commit/${SHA}`, author: a, commit: { message: '조건별 실험', author: { date: AT } } }]);
    if (path.endsWith('/pulls')) return response([pull]);
    if (path.endsWith('/issues')) return response([issue, { ...pull, pull_request: {} }]);
    if (path.endsWith('/issues/comments')) return response([{ id: 501, body: '다음 실험에서 비교하겠습니다.', user: a, created_at: AT, updated_at: AT, html_url: 'https://github.com/school/team/issues/2#issuecomment-501', issue_url: 'https://api.github.com/repos/school/team/issues/2' }]);
    if (path.endsWith('/pulls/comments')) return response([{ id: 502, body: '간격을 검증해주세요.', user: b, created_at: AT, updated_at: AT, commit_id: SHA, html_url: 'https://github.com/school/team/pull/1#discussion_r502', pull_request_url: 'https://api.github.com/repos/school/team/pulls/1' }]);
    if (path.endsWith('/pulls/1/reviews')) return response([{ id: 503, body: '반례를 확인했습니다.', state: 'APPROVED', user: b, submitted_at: AT, commit_id: SHA, html_url: 'https://github.com/school/team/pull/1#pullrequestreview-503' }, { id: 504, state: 'PENDING', body: '아직 제출하지 않은 의견', user: b }]);
    throw new Error('예상하지 않은 API');
  } }); t.after(() => f.store.close());
  const first = await f.service.syncLearningEvents(f.project.id, f.student);
  assert.equal(first.sync.state, 'complete'); assert.equal(first.events.length, 7);
  assert.equal(first.events.find(event => event.kind === 'commit' && event.sha === NEXT)?.githubAuthorId, b.id);
  assert.ok(calls.some(call => call.path === '/repos/school/team/pulls/1/commits'));
  assert.ok(first.events.every(event => event.source === 'backfill'));
  assert.equal(first.events.some(event => event.body.includes('아직 제출하지 않은')), false);
  const second = await f.service.syncLearningEvents(f.project.id, f.student);
  assert.equal(second.events.length, 7); assert.equal(second.sync.imported, 0);
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
  input.checkpointId = f.store.saveCheckpoint(f.project.id, f.student, { code: input.code, message: input.message, baseVersion: f.project.version }).id;
  assert.equal((await f.service.runOnce()).kind, 'checkpoint');
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


function seedTrackedJob(f, { projectId = f.project.id, kind = 'proposal', number = 1, state = 'succeeded', bindingKey = repository.key, repositoryId = repository.repositoryId, code = 'print("팀 실험")' } = {}) {
  const job = f.store.enqueueJob({ projectId, kind, payload: { bindingKey, repositoryId, authorId: f.student.id, code, title: '팀의 실험', message: '팀이 만든 근거', body: '팀의 질문', baseSha: SHA }, dedupeKey: `scope-${randomUUID()}` });
  const branch = `vpylab/proposal-${job.id}-${createHash('sha256').update(code).digest('hex').slice(0, 10)}`;
  f.store.db.prepare('UPDATE github_jobs SET state=? WHERE id=?').run(state, job.id);
  f.store.db.prepare('INSERT INTO github_job_progress VALUES(?,?)').run(job.id, JSON.stringify({ result: { number, branch, sha: NEXT, url: `https://github.com/school/team/${kind === 'proposal' ? 'pull' : 'issues'}/${number}` } }));
  return { ...job, branch };
}

test('project 범위 backfill은 성공한 이 교실 Issue·PR과 미병합 커밋만 읽고 다른 팀·실패 작업을 수집하지 않는다', async t => {
  const calls = [];
  const f = fixture({ repositories: [{ ...repository, learningScope: 'project' }], fetchImpl: async url => {
    const path = new URL(url).pathname; calls.push(path);
    if (path.endsWith('/access_tokens')) return response({ token: 'server-only', expires_at: new Date(Date.now() + 3_600_000).toISOString() }, 201);
    if (path === '/repos/school/team') return response({ id: 200, name: 'team', owner: { login: 'school' }, private: true });
    if (path.endsWith('/issues/2')) return response(issue);
    if (path.endsWith('/pulls/1')) return response(pull);
    if (path.endsWith('/pulls/1/commits')) return response([{ sha: NEXT, author: b, commit: { message: '미병합 PR의 학생 B 수정', author: { date: AT } }, html_url: `https://github.com/school/team/commit/${NEXT}` }]);
    if (path.endsWith('/pulls/1/reviews')) return response([{ id: 801, user: b, state: 'APPROVED', commit_id: NEXT, submitted_at: AT, html_url: 'https://github.com/school/team/pull/1#pullrequestreview-801' }]);
    if (path.endsWith('/pulls/1/comments')) return response([{ id: 802, user: b, body: '반례를 확인했습니다.', commit_id: NEXT, created_at: AT, html_url: 'https://github.com/school/team/pull/1#discussion_r802' }]);
    if (path.endsWith('/issues/1/comments') || path.endsWith('/issues/2/comments')) return response([]);
    throw new Error(`다른 팀 기록에 요청함: ${path}`);
  } }); t.after(() => f.store.close());
  seedTrackedJob(f, { kind: 'issue', number: 2 });
  seedTrackedJob(f);
  seedTrackedJob(f, { number: 11, state: 'pending' });
  seedTrackedJob(f, { number: 12, state: 'blocked' });
  seedTrackedJob(f, { number: 13, state: 'failed' });
  seedTrackedJob(f, { number: 14, bindingKey: 'other-binding' });
  seedTrackedJob(f, { number: 15, repositoryId: 999 });
  const another = f.store.createProject(f.teacher, { title: '같은 저장소를 사용하는 다른 팀', code: '' });
  f.service.bind(another.id, f.teacher, repository.key);
  seedTrackedJob(f, { projectId: another.id, number: 21 });
  const first = await f.service.syncLearningEvents(f.project.id, f.teacher);
  assert.equal(first.sync.state, 'complete'); assert.equal(first.sync.requests, 7);
  const backfill = first.events.filter(event => event.source === 'backfill');
  assert.deepEqual(new Set(backfill.map(event => event.kind)), new Set(['issue', 'pull_request', 'commit', 'review', 'review_comment']));
  assert.equal(backfill.find(event => event.sha === NEXT && event.kind === 'commit').githubAuthorId, b.id);
  assert.equal(backfill.find(event => event.kind === 'pull_request').metadata.number, 1);
  assert.equal(first.events.some(event => [11, 12, 13, 14, 15, 21].includes(event.metadata.number)), false);
  assert.ok(first.coverageNotice.includes('이 교실이 만든'));
  assert.equal(calls.some(path => ['/repos/school/team/commits', '/repos/school/team/pulls', '/repos/school/team/issues', '/repos/school/team/issues/comments', '/repos/school/team/pulls/comments'].includes(path)), false);
  const repeated = await f.service.syncLearningEvents(f.project.id, f.teacher);
  assert.equal(repeated.sync.imported, 0); assert.deepEqual(repeated.events.map(event => event.id).sort(), first.events.map(event => event.id).sort());
});

test('project 범위의 빈 작업 이력은 repository 전체 수집으로 되돌아가지 않는다', async t => {
  const calls = [];
  const f = fixture({ repositories: [{ ...repository, learningScope: 'project' }], fetchImpl: async url => {
    const path = new URL(url).pathname; calls.push(path);
    if (path.endsWith('/access_tokens')) return response({ token: 'server-only', expires_at: new Date(Date.now() + 3_600_000).toISOString() }, 201);
    if (path === '/repos/school/team') return response({ id: 200, name: 'team', owner: { login: 'school' }, private: true });
    throw new Error('빈 이력에서 전체 저장소를 요청하면 안 됩니다.');
  } }); t.after(() => f.store.close());
  const result = await f.service.syncLearningEvents(f.project.id, f.teacher);
  assert.equal(result.events.length, 0); assert.equal(result.sync.state, 'complete'); assert.equal(result.sync.requests, 0);
  assert.deepEqual(calls, ['/app/installations/100/access_tokens', '/repos/school/team']);
});

test('project 범위 Webhook은 같은 저장소의 다른 팀 Issue·PR·리뷰·대화·push를 학습 근거에 섞지 않는다', t => {
  const f = fixture({ repositories: [{ ...repository, learningScope: 'project' }] }); t.after(() => f.store.close());
  const mine = seedTrackedJob(f);
  seedTrackedJob(f, { kind: 'issue', number: 2 });
  const other = f.store.createProject(f.teacher, { title: '다른 팀', code: '' });
  f.service.bind(other.id, f.teacher, repository.key);
  const theirs = seedTrackedJob(f, { projectId: other.id, number: 11 });
  seedTrackedJob(f, { projectId: other.id, kind: 'issue', number: 12 });
  const kinds = ['pull_request', 'pull_request_review', 'pull_request_review_comment', 'issues', 'issue_comment'];
  function payloadFor(event, pullNumber, issueNumber, marker) {
    const targetPull = { ...pull, id: 1000 + pullNumber, number: pullNumber };
    const targetIssue = { ...issue, id: 1000 + issueNumber, number: issueNumber };
    if (event === 'pull_request') return { action: 'opened', pull_request: targetPull };
    if (event === 'pull_request_review') return { action: 'submitted', pull_request: targetPull, review: { id: marker, state: 'APPROVED', body: '팀별 검토', user: b, commit_id: NEXT, submitted_at: AT } };
    if (event === 'pull_request_review_comment') return { action: 'created', pull_request: targetPull, comment: { id: marker, body: '팀별 코드 의견', user: b, commit_id: NEXT, created_at: AT } };
    if (event === 'issues') return { action: 'opened', issue: targetIssue };
    return { action: 'created', issue: targetIssue, comment: { id: marker, body: '팀별 대화', user: a, created_at: AT } };
  }
  for (const [index, event] of kinds.entries()) {
    assert.equal(deliver(f, event, payloadFor(event, 1, 2, 900 + index)).recorded, 1);
    assert.equal(deliver(f, event, payloadFor(event, 11, 12, 950 + index)).recorded, 1);
  }
  // PR 일반 대화는 issues 이벤트 구조로 전달되어도 PR 번호로 소속을 확인합니다.
  assert.equal(deliver(f, 'issue_comment', { action: 'created', issue: { number: 1, pull_request: {} }, comment: { id: 980, body: '우리 PR 대화', user: b, created_at: AT } }).recorded, 1);
  const push = branch => ({ ref: `refs/heads/${branch}`, before: SHA, after: NEXT, sender: a, head_commit: { timestamp: AT }, commits: [{ id: NEXT, author: { id: a.id, login: a.login }, message: '팀 브랜치 변경', timestamp: AT }] });
  assert.equal(deliver(f, 'push', push(mine.branch)).recorded, 2);
  assert.equal(deliver(f, 'push', push(theirs.branch)).recorded, 2);
  assert.equal(deliver(f, 'push', push('vpylab/proposal-unknown')).recorded, 0);
  assert.equal(deliver(f, 'push', push('main')).recorded, 0);
  assert.equal(deliver(f, 'issues', { action: 'opened', issue: { ...issue, id: 2000, number: 2000 } }).recorded, 0);
  const mineEvents = f.service.listLearningEvents(f.project.id, f.teacher).events.filter(event => event.source === 'webhook');
  const theirEvents = f.service.listLearningEvents(other.id, f.teacher).events.filter(event => event.source === 'webhook');
  assert.equal(mineEvents.length, 8); assert.equal(theirEvents.length, 7);
  assert.equal(mineEvents.some(event => [11, 12].includes(event.metadata.number)), false);
  assert.equal(theirEvents.some(event => [1, 2].includes(event.metadata.number)), false);
  assert.deepEqual(mineEvents.filter(event => event.kind === 'push').map(event => event.metadata.ref), [`refs/heads/${mine.branch}`]);
  assert.deepEqual(theirEvents.filter(event => event.kind === 'push').map(event => event.metadata.ref), [`refs/heads/${theirs.branch}`]);
});

test('project 범위는 성공하지 않은 PR 번호를 믿지 않으며 알려진 실행 중 제안 브랜치 push만 허용한다', t => {
  const f = fixture({ repositories: [{ ...repository, learningScope: 'project' }] }); t.after(() => f.store.close());
  const pending = seedTrackedJob(f, { number: 31, state: 'running' });
  const blocked = seedTrackedJob(f, { number: 32, state: 'blocked' });
  assert.equal(deliver(f, 'pull_request', { action: 'opened', pull_request: { ...pull, number: 31 } }).recorded, 0);
  assert.equal(deliver(f, 'pull_request_review', { pull_request: { number: 32 }, review: { id: 990, state: 'APPROVED', user: b } }).recorded, 0);
  const push = branch => ({ ref: `refs/heads/${branch}`, after: NEXT, sender: a, commits: [], head_commit: { timestamp: AT } });
  assert.equal(deliver(f, 'push', push(pending.branch)).recorded, 1);
  assert.equal(deliver(f, 'push', push(blocked.branch)).recorded, 0);
});

test('project 범위의 페이지·전체 요청·PR 수 제한은 partial로 남기고 허용 번호 밖의 엔드포인트를 요청하지 않는다', async () => {
  const paths = [], recorded = [];
  const bounded = await backfillGitHubLearning({ binding: repository, trackedEntities: { issues: [2, 2, -1, '3'], pulls: [1, 11] }, maxRequests: 3, record: (event, payload) => { recorded.push({ event, payload }); return [{ inserted: true }]; }, requestPage: async path => {
    paths.push(path);
    if (path === '/issues/2') return { data: issue };
    if (path === '/pulls/1') return { data: pull };
    return { data: [] };
  } });
  assert.equal(bounded.requests, 3); assert.equal(bounded.partial, true); assert.equal(bounded.errorCode, null);
  assert.deepEqual(paths.map(path => path.split('?')[0]), ['/issues/2', '/issues/2/comments', '/pulls/1']);
  assert.equal(recorded.length, 2);
  const pagedPaths = [];
  const paged = await backfillGitHubLearning({ binding: repository, trackedEntities: { issues: [], pulls: [1, 11] }, maxPagesPerEndpoint: 2, maxPullReviews: 1, record: () => [], requestPage: async path => {
    pagedPaths.push(path);
    if (path === '/pulls/1') return { data: pull };
    if (path.startsWith('/pulls/1/commits?')) {
      const page = Number(new URL(`https://api.github.com${path}`).searchParams.get('page'));
      return { data: [], link: `<https://api.github.com/repositories/200/pulls/1/commits?page=${page + 1}&per_page=50>; rel="next"` };
    }
    return { data: [] };
  } });
  assert.equal(paged.partial, true); assert.equal(paged.errorCode, null); assert.equal(paged.requests, 6);
  assert.equal(pagedPaths.filter(path => path.startsWith('/pulls/1/commits?')).length, 2);
  assert.equal(paged.coverage.includes('/pulls/1/commits'), false);
  assert.equal(pagedPaths.some(path => path.includes('/11')), false);
  const malformed = await backfillGitHubLearning({ binding: repository, trackedEntities: { issues: [], pulls: [1] }, record: () => [], requestPage: async () => ({ data: [] }) });
  assert.equal(malformed.partial, true); assert.equal(malformed.errorCode, 'invalid_github_response');
});

test('project 수집 범위는 서버 설정만 허용하고 기존 repository 기본 범위는 유지한다', t => {
  assert.throws(() => fixture({ repositories: [{ ...repository, learningScope: 'browser-selected' }] }), { code: 'invalid_repository_config' });
  const f = fixture(); t.after(() => f.store.close());
  deliver(f, 'issues', { action: 'opened', issue: { ...issue, number: 99 } });
  assert.equal(f.service.listLearningEvents(f.project.id, f.teacher).events[0].metadata.number, 99);
  assert.ok(f.service.listLearningEvents(f.project.id, f.teacher).coverageNotice.includes('기본 브랜치'));
});

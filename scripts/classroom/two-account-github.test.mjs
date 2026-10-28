import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { AUTHOR, TEST_REPOSITORY, cliEnvironment, createRequester, ensureReview, findMarkedReview, guardedServiceFetch, parseArguments, preflight, runTrial } from './two-account-github.mjs';

// GitHub 응답은 메모리 안의 모의 자료입니다. 전체 흐름 한 건만 임시 DB·localhost 임시 포트를 사용합니다.
const root = `/repos/${TEST_REPOSITORY.owner}/${TEST_REPOSITORY.repo}`;
const sha = 'a'.repeat(40), marker = '<!-- vpylab-two-account:synthetic:APPROVE -->';
const review = { id: 1234, html_url: `https://github.com/${TEST_REPOSITORY.owner}/${TEST_REPOSITORY.repo}/pull/3#pullrequestreview-1234`, user: { id: 270214046 }, body: marker, commit_id: sha, state: 'APPROVED' };

test('기본은 읽기 전용이며 두 번째 아이디가 없거나 동일하면 선행 조건에서 멈춘다', () => {
  assert.deepEqual(parseArguments(['--reviewer', 'greatsong-danggok']), { command: '--check', reviewer: 'greatsong-danggok' });
  assert.throws(() => parseArguments([]), { code: 'reviewer_required' });
  assert.throws(() => parseArguments(['--reviewer', 'greatsong']), { code: 'different_account_required' });
  assert.throws(() => parseArguments(['--run', '--check', '--reviewer', 'greatsong-danggok']), { code: 'invalid_arguments' });
  assert.throws(() => parseArguments(['--reviewer', '--run']), { code: 'reviewer_required' });
});

test('자식 gh에만 공통 환경 토큰을 제거하고 원본 환경은 보존한다', () => {
  const env = { PATH: 'synthetic-bin', GH_TOKEN: 'one', GITHUB_TOKEN: 'two', GH_ENTERPRISE_TOKEN: 'three', GITHUB_ENTERPRISE_TOKEN: 'four' };
  assert.deepEqual(cliEnvironment(env), { PATH: 'synthetic-bin' });
  assert.equal(env.GH_TOKEN, 'one');
});

function preflightOptions(overrides = {}) {
  const calls = [];
  return { calls, options: { reviewer: 'greatsong-danggok', tokenFor: async login => login, requestFor: ({ token }) => async path => {
    calls.push({ token, path });
    if (path === '/user') return { login: token, id: token === AUTHOR.login ? AUTHOR.id : 270214046, ...overrides.identity };
    if (path === root) return { id: TEST_REPOSITORY.repositoryId, private: true, owner: { login: TEST_REPOSITORY.owner }, name: TEST_REPOSITORY.repo, permissions: { pull: true, push: true }, ...overrides.repository };
    if (path === `${root}/git/ref/heads/main`) return { object: { sha } };
    throw new Error('예상하지 않은 요청');
  } } };
}

test('두 실제 인증 신원과 같은 비공개 저장소·쓰기 역할·기준 SHA를 읽기만 확인한다', async () => {
  const { calls, options } = preflightOptions(), accounts = await preflight(options);
  assert.equal(accounts.author.id, AUTHOR.id); assert.equal(accounts.reviewer.id, 270214046);
  assert.equal(calls.length, 6); assert.ok(calls.every(call => ['/user', root, `${root}/git/ref/heads/main`].includes(call.path)));
});

test('사전 확인은 공개 저장소·다른 저장소 ID·쓰기 권한 부재·다른 인증 아이디를 거부한다', async () => {
  for (const repository of [{ private: false }, { id: 1 }]) await assert.rejects(preflight(preflightOptions({ repository }).options), { code: 'repository_mismatch' });
  await assert.rejects(preflight(preflightOptions({ repository: { permissions: { pull: true, push: false } } }).options), { code: 'repository_permission_required' });
  await assert.rejects(preflight(preflightOptions({ identity: { login: 'unexpected' } }).options), { code: 'github_identity_mismatch' });
  const setup = preflightOptions();
  const original = setup.options.requestFor;
  setup.options.requestFor = config => async path => { const response = await original(config)(path); return path === '/user' && config.token !== AUTHOR.login ? { ...response, id: AUTHOR.id } : response; };
  await assert.rejects(preflight(setup.options), { code: 'different_account_required' });
});

test('읽기 요청자는 외부 저장소·main 변경·리뷰 쓰기를 fetch 전에 차단한다', async () => {
  let requests = 0;
  const request = createRequester({ token: 'synthetic-private', fetchImpl: async () => { requests++; return Response.json({}); } });
  await assert.rejects(request('/repos/elsewhere/repo'), { code: 'repository_not_allowed' });
  await assert.rejects(request(`${root}/git/refs/heads/main`, { method: 'PATCH', body: { sha } }), { code: 'write_not_allowed' });
  await assert.rejects(request(`${root}/pulls/3/reviews`, { method: 'POST', body: {} }), { code: 'write_not_allowed' });
  assert.equal(requests, 0);
});

test('인증 정보가 포함된 외부 오류 본문·예외를 밖으로 출력할 오류에 넣지 않는다', async () => {
  const secret = 'synthetic-private-secret';
  for (const fetchImpl of [async () => Response.json({ message: secret }, { status: 503 }), async () => { throw new Error(secret); }]) {
    const request = createRequester({ token: secret, fetchImpl });
    await assert.rejects(request(root), error => !error.message.includes(secret) && ['github_read_failed', 'github_read_rejected'].includes(error.code));
  }
});

test('기존 리뷰 표식은 숫자 작성자·SHA·승인 상태가 모두 맞아야 재사용한다', async () => {
  const expected = { number: 3, marker, authorId: review.user.id, sha, state: 'APPROVED' };
  assert.equal((await findMarkedReview(async () => [review], expected)).id, review.id);
  for (const changed of [{ user: { id: 1 } }, { commit_id: 'b'.repeat(40) }, { state: 'DISMISSED' }]) await assert.rejects(findMarkedReview(async () => [{ ...review, ...changed }], expected), { code: 'review_marker_conflict' });
  await assert.rejects(findMarkedReview(async () => [review, { ...review, id: 1235 }], expected), { code: 'duplicate_review' });
});

test('승인 응답 유실 뒤 같은 표식 재발견은 POST 없이 저널을 복구한다', async () => {
  let writes = 0, saves = 0; const journal = { phase: 'uncertain' };
  const result = await ensureReview({ request: async (path, options = {}) => { if (options.method === 'POST') writes++; return [review]; }, number: 3, authorId: review.user.id, sha, event: 'APPROVE', marker, text: '검토', journal, save: () => saves++ });
  assert.equal(result.id, review.id); assert.equal(writes, 0); assert.equal(saves, 1); assert.equal(journal.phase, 'confirmed');
});

test('불명확한 전송·거절 후 리뷰가 없으면 blind 재전송을 하지 않는다', async () => {
  for (const phase of ['uncertain', 'sending', 'rejected', 'confirmed']) {
    let writes = 0;
    await assert.rejects(ensureReview({ request: async (path, options = {}) => { if (options.method === 'POST') writes++; return []; }, number: 3, authorId: review.user.id, sha, event: 'APPROVE', marker, text: '검토', journal: { phase }, save: () => {} }), { code: 'review_needs_reconciliation' });
    assert.equal(writes, 0);
  }
});

test('최초 전송 전 sending을 저장하고 응답 유실 시 uncertain을 남긴다', async () => {
  const journal = {}, phases = []; let writes = 0;
  const options = { request: async (path, request = {}) => { if (!request.method) return []; assert.equal(journal.phase, 'sending'); writes++; throw Object.assign(new Error('응답 유실'), { code: 'github_write_uncertain' }); }, number: 3, authorId: review.user.id, sha, event: 'APPROVE', marker, text: '검토', journal, save: () => phases.push(journal.phase) };
  await assert.rejects(ensureReview(options), { code: 'github_write_uncertain' });
  assert.deepEqual(phases, ['sending', 'uncertain']); assert.equal(writes, 1);
});

test('서비스 fetch는 고유 제안 브랜치만 허용하고 main 변경·병합·외부 호스트를 차단한다', async () => {
  let calls = 0; const fetchImpl = guardedServiceFetch(async () => { calls++; return Response.json({}); });
  for (const [url, options] of [
    [`https://example.com${root}`, {}],
    [`https://api.github.com${root}/git/refs/heads/main`, { method: 'PATCH', body: JSON.stringify({ sha }) }],
    [`https://api.github.com${root}/pulls/3/merge`, { method: 'PUT', body: '{}' }],
    [`https://api.github.com${root}/git/refs`, { method: 'POST', body: JSON.stringify({ ref: 'refs/heads/main', sha }) }],
    [`https://api.github.com${root}/issues`, { method: 'POST', body: '{}' }],
  ]) await assert.rejects(fetchImpl(url, options));
  assert.equal(calls, 0);
  await fetchImpl(`https://api.github.com${root}/git/refs`, { method: 'POST', body: JSON.stringify({ ref: 'refs/heads/vpylab/proposal-11111111-1111-1111-1111-111111111111-0123456789', sha }) });
  assert.equal(calls, 1);
});

test('모의 GitHub+임시 SQLite 전체 흐름과 재개: PR 1개·리뷰 2개·두 학생 분리·피드백 공개 범위', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'vpylab-two-account-mock-'));
  const baseSha = 'a'.repeat(40), headSha = 'b'.repeat(40), time = '2026-10-28T02:00:00Z';
  const originalCode = 'from vpython import *\nball = sphere(radius=0.5)\n';
  const records = { pulls: [], reviews: [], writes: [], reads: [], commits: [], code: originalCode, branch: null };
  const author = { login: AUTHOR.login, id: AUTHOR.id }, reviewer = { login: 'greatsong-danggok', id: 270214046 };
  const fetchImpl = async (url, options = {}) => {
    const parsed = new URL(url), method = options.method || 'GET', path = parsed.pathname.slice(root.length);
    assert.equal(parsed.origin, 'https://api.github.com'); assert.ok(parsed.pathname.startsWith(root));
    const body = JSON.parse(options.body || '{}');
    const token = new Headers(options.headers).get('authorization');
    const actor = token === 'Bearer mock-author' ? author : reviewer;
    if (method === 'GET') records.reads.push({ path, query: parsed.search });
    if (method !== 'GET') records.writes.push({ method, path, actorId: actor.id });
    if (method === 'GET' && path === '') return Response.json({ id: TEST_REPOSITORY.repositoryId, private: true, name: TEST_REPOSITORY.repo, owner: { login: TEST_REPOSITORY.owner } });
    if (method === 'GET' && path === '/git/ref/heads/main') return Response.json({ object: { sha: baseSha } });
    if (method === 'GET' && path.startsWith('/git/ref/heads/vpylab/')) return records.branch ? Response.json({ object: { sha: headSha } }) : Response.json({}, { status: 404 });
    if (method === 'GET' && path === '/contents/main.py') {
      const code = parsed.searchParams.get('ref') === headSha ? records.code : originalCode;
      return Response.json({ type: 'file', encoding: 'base64', content: Buffer.from(code).toString('base64'), size: Buffer.byteLength(code) });
    }
    if (method === 'GET' && path.startsWith('/git/commits/')) return Response.json({ sha: path.endsWith(baseSha) ? baseSha : headSha, tree: { sha: 'c'.repeat(40) }, parents: [{ sha: baseSha }] });
    if (method === 'POST' && path === '/git/trees') { records.code = body.tree[0].content; return Response.json({ sha: 'd'.repeat(40) }); }
    if (method === 'POST' && path === '/git/commits') {
      records.commits.push({
        sha: headSha,
        html_url: `https://github.com/${TEST_REPOSITORY.owner}/${TEST_REPOSITORY.repo}/commit/${headSha}`,
        author: actor,
        committer: actor,
        commit: { message: body.message, author: { name: actor.login, date: time }, committer: { name: actor.login, date: time }, tree: { sha: body.tree } },
        parents: body.parents.map(sha => ({ sha })),
      });
      return Response.json({ sha: headSha });
    }
    if (method === 'POST' && path === '/git/refs') { records.branch = body.ref.slice('refs/heads/'.length); return Response.json({ object: { sha: headSha } }); }
    if (method === 'POST' && path === '/pulls') {
      const pull = { id: 5678, number: 3, title: body.title, body: body.body, user: actor, html_url: `https://github.com/${TEST_REPOSITORY.owner}/${TEST_REPOSITORY.repo}/pull/3`, head: { sha: headSha, ref: body.head }, base: { sha: baseSha, ref: 'main', repo: { id: TEST_REPOSITORY.repositoryId } }, state: 'open', merged: false, created_at: time, updated_at: time };
      records.pulls.push(pull); return Response.json(pull, { status: 201 });
    }
    if (method === 'GET' && path === '/pulls') return Response.json(records.pulls);
    if (method === 'GET' && path === '/pulls/3') return Response.json(records.pulls[0]);
    if (method === 'GET' && path === '/pulls/3/commits') return Response.json(records.commits);
    if (path === '/pulls/3/reviews') {
      if (method === 'GET') return Response.json(records.reviews);
      const item = { id: 1234 + records.reviews.length, user: actor, body: body.body, commit_id: body.commit_id, state: body.event === 'APPROVE' ? 'APPROVED' : 'COMMENTED', submitted_at: time, html_url: `https://github.com/${TEST_REPOSITORY.owner}/${TEST_REPOSITORY.repo}/pull/3#pullrequestreview-${1234 + records.reviews.length}` };
      records.reviews.push(item); return Response.json(item);
    }
    if (method === 'GET' && path === '/commits') return Response.json([{ sha: baseSha, author, html_url: `https://github.com/${TEST_REPOSITORY.owner}/${TEST_REPOSITORY.repo}/commit/${baseSha}`, commit: { message: '합성 기준 코드', author: { date: time } } }]);
    if (method === 'GET' && path === '/issues') return Response.json(records.pulls.map(pull => ({ ...pull, pull_request: { url: `${root}/pulls/3` } })));
    if (method === 'GET' && ['/issues/comments', '/pulls/comments'].includes(path)) return Response.json([]);
    throw new Error(`예상하지 않은 모의 GitHub 요청: ${method} ${path}`);
  };
  const accounts = { author: { ...author, token: 'mock-author', request: createRequester({ token: 'mock-author', fetchImpl }) }, reviewer: { ...reviewer, token: 'mock-reviewer' } };
  const options = { directory, port: 0, fetchImpl, output: () => {} };
  try {
    await runTrial(accounts, options);
    const state = JSON.parse(readFileSync(join(directory, 'state.json'), 'utf8'));
    assert.ok(state.completedAt); assert.equal(records.pulls.length, 1); assert.equal(records.reviews.length, 2);
    assert.equal(state.outputs.evidenceAndFeedback.feedback.length, 6);
    assert.ok(state.outputs.evidenceAndFeedback.studentAEvents > 0); assert.equal(state.outputs.evidenceAndFeedback.studentBEvents, 2);
    assert.equal(records.commits.length, 1);
    assert.equal(records.commits[0].sha, headSha); assert.equal(records.commits[0].author.id, author.id);
    const commitReads = records.reads.filter(read => read.path === '/pulls/3/commits');
    assert.equal(commitReads.length, 2);
    assert.ok(commitReads.every(read => new URLSearchParams(read.query).get('page') === '1' && new URLSearchParams(read.query).get('per_page') === '50'));
    function learningSnapshot() {
      const database = new DatabaseSync(join(directory, 'classroom.sqlite'), { readOnly: true });
      try { return database.prepare('SELECT id,kind,sha,github_author_id FROM github_learning_events WHERE project_id=? ORDER BY id').all(state.projectId); }
      finally { database.close(); }
    }
    const evidence = learningSnapshot();
    const headEvidence = evidence.filter(item => item.kind === 'commit' && item.sha === headSha);
    assert.equal(headEvidence.length, 1); assert.equal(headEvidence[0].github_author_id, author.id);
    assert.equal(statSync(directory).mode & 0o777, 0o700); assert.equal(statSync(join(directory, 'state.json')).mode & 0o777, 0o600);
    const writes = records.writes.length;
    await runTrial(accounts, options);
    assert.equal(records.writes.length, writes); assert.equal(records.pulls[0].state, 'open'); assert.equal(records.pulls[0].merged, false);
    assert.equal(records.reads.filter(read => read.path === '/pulls/3/commits').length, commitReads.length);
    assert.deepEqual(learningSnapshot(), evidence);
    assert.ok(records.writes.every(write => write.method === 'POST' && !write.path.includes('merge') && !write.path.endsWith('main')));
    assert.deepEqual(records.reviews.map(item => item.user.id), [reviewer.id, reviewer.id]);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

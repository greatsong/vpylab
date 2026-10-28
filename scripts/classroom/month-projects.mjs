import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { chmodSync, closeSync, existsSync, mkdirSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStore } from '../../server/classroom/store.js';
import { createClassroomApp } from '../../server/classroom/app.js';
import { createGitHubService } from '../../server/classroom/github.js';
import { preflight, TEST_REPOSITORY, guardedServiceFetch, createRequester, ensureReview } from './two-account-github.mjs';

// 사용자에게 허가받은 비공개 시험 저장소, 합성 두 학생, 별도 DB만 사용합니다.
const root = fileURLToPath(new URL('../../', import.meta.url));
const directory = resolve(root, '.local/month-projects');
const publicDirectory = resolve(root, 'demos/month-projects');
const repoPath = `/repos/${TEST_REPOSITORY.owner}/${TEST_REPOSITORY.repo}`;
const backendOrigin = 'http://127.0.0.1:4084';
const frontendOrigin = 'http://127.0.0.1:4083';
const ids = ['original', 'course', 'remix'];
const digest = value => createHash('sha256').update(value).digest('hex');
const read = path => readFileSync(path, 'utf8');
const json = path => JSON.parse(read(path));
const bindings = ids.map(id => ({ ...TEST_REPOSITORY, key: `month-${id}`, learningScope: 'project' }));
const command = process.argv[2];
assert.ok(['--run', '--serve', '--quality'].includes(command), '사용법: node scripts/classroom/month-projects.mjs --run|--serve|--quality');
mkdirSync(directory, { recursive: true, mode: 0o700 }); chmodSync(directory, 0o700);
const statePath = resolve(directory, 'state.json');
const database = resolve(directory, 'classroom.sqlite');
const lockPath = resolve(directory, 'run.lock');
let store, service, server, lock;
let state;
const save = () => {
  const temporary = `${statePath}.${process.pid}.tmp`;
  writeFileSync(temporary, JSON.stringify(state, null, 2) + '\n', { mode: 0o600 });
  renameSync(temporary, statePath);
};
async function close() {
  await service?.stopWorker();
  if (server?.listening) await new Promise(done => server.close(done));
  store?.close(); store = null;
  if (lock !== undefined) { closeSync(lock); unlinkSync(lockPath); lock = undefined; }
}
function publishSummary() {
  const summary = { schema: 1, verifiedAt: new Date().toISOString(), synthetic: true, repository: `${TEST_REPOSITORY.owner}/${TEST_REPOSITORY.repo}`, mainUnchanged: true, checks: state.checks, teams: Object.fromEntries(ids.map(id => { const team = state.teams[id]; return [id, { projectId: team.project.id, title: team.project.title, issue: { number: team.issue.number, url: team.issue.url }, pull: { number: team.pull.number, url: team.pull.url, sha: team.finalSha }, approval: team.approval, evidence: team.evidence, ...(team.quality ? { finalQualityCheck: { sha: team.quality.sha, localVersion: team.quality.checkpoint?.version } } : {}) }]; })) };
  writeFileSync(resolve(publicDirectory, 'verification.json'), JSON.stringify(summary, null, 2) + '\n');
}

async function main() {
  const accounts = await preflight({ reviewer: 'greatsong-danggok' });
  state = existsSync(statePath) ? json(statePath) : { schema: 1, runId: randomUUID(), repositoryId: TEST_REPOSITORY.repositoryId, baseSha: accounts.author.headSha, teams: {}, reviews: {}, checks: [] };
  assert.equal(state.repositoryId, TEST_REPOSITORY.repositoryId);
  assert.equal(state.baseSha, accounts.author.headSha, '시험 중 main이 바뀌었습니다. 자동 반영하지 않습니다.');
  lock = openSync(lockPath, 'wx', 0o600);
  writeFileSync(lock, JSON.stringify({ pid: process.pid, command }) + '\n');
  save();
  const fresh = !existsSync(database);
  store = createStore({ filename: database, localMode: fresh });
  if (fresh) store.transaction(() => {
    store.db.prepare('DELETE FROM github_identities').run();
    for (const [id, account] of [['student-a', accounts.author], ['student-b', accounts.reviewer]]) store.db.prepare('INSERT INTO github_identities VALUES(?,?,?,?,?)').run(id, account.id, account.login, 'github_cli_test', new Date().toISOString());
  });
  for (const [id, account] of [['student-a', accounts.author], ['student-b', accounts.reviewer]]) assert.equal(store.githubIdentity(id)?.githubId, account.id);
  for (const file of [database, `${database}-wal`, `${database}-shm`]) if (existsSync(file)) chmodSync(file, 0o600);
  const fetchForService = async (url, options = {}) => {
    const parsed = new URL(url), method = options.method || 'GET';
    // 기존 PR 가드에 Issue 생성 한 종류만 더합니다. main·병합·권한 변경은 금지합니다.
    if (method === 'POST' && parsed.origin === 'https://api.github.com' && parsed.pathname === `${repoPath}/issues`) return fetch(url, options);
    return guardedServiceFetch()(url, options);
  };
  service = createGitHubService({ store, localMode: true, config: { mode: 'live', repositories: bindings }, fetchImpl: fetchForService, installationTokenProvider: async binding => {
    assert.equal(binding.repositoryId, TEST_REPOSITORY.repositoryId);
    return accounts.author.token;
  } });
  const runtime = createClassroomApp({ store, localMode: true, githubService: service, allowedOrigins: [frontendOrigin, backendOrigin] });
  server = runtime.app.listen(4084, '127.0.0.1');
  await new Promise((done, reject) => { server.once('listening', done); server.once('error', reject); });
  if (command === '--serve') {
    assert.ok(state.completedAt, '먼저 세 팀 시험을 완료해주세요.');
    service.startWorker();
    process.stdout.write(`완성 작품: ${frontendOrigin}/month-projects.html\n세 팀의 실제 GitHub 기록·교사 피드백: 별도 로컬 교실 DB\n`);
    process.once('SIGINT', () => void close()); process.once('SIGTERM', () => void close());
    return;
  }
  const cookies = Object.fromEntries(['teacher', 'student-a', 'student-b'].map(id => [id, `vpylab_v2_session=${store.createSession(id)}`]));
  async function api(user, path, { method = 'GET', body, key = '' } = {}, expected = 200) {
    const response = await fetch(`${backendOrigin}/api/v2${path}`, { method, signal: AbortSignal.timeout(90000), headers: { Origin: backendOrigin, Cookie: cookies[user], 'X-Classroom-User': user, ...(body ? { 'Content-Type': 'application/json' } : {}), ...(method !== 'GET' ? { 'Idempotency-Key': digest(JSON.stringify([state.runId, user, path, key, body])) } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const data = await response.json();
    assert.equal(response.status, expected, `${method} ${path}: ${data.code || ''}`);
    return data;
  }
  function pass(name) { if (!state.checks.includes(name)) state.checks.push(name); save(); process.stdout.write(`통과: ${name}\n`); }
  async function stage(team, name, action) {
    if (team[name] !== undefined) return team[name];
    team[name] = await action(); save(); return team[name];
  }
  async function drain(id, jobId) {
    for (let n = 0; n < 40; n++) {
      const job = service.jobs(id).find(item => item.id === jobId);
      if (job?.state === 'succeeded') return job.result;
      assert.ok(!['failed', 'blocked'].includes(job?.state), `GitHub 전송 실패: ${job?.state}`);
      const worked = await service.runOnce();
      assert.ok(worked, '전송 재시도 시각을 기다려야 합니다. 자동 재전송하지 않습니다.');
    }
    throw new Error('전송 작업이 끝나지 않았습니다.');
  }
  let lastWrite = 0;
  async function github(role, path, { method = 'GET', body } = {}) {
    assert.ok(path.startsWith(`${repoPath}/`));
    if (method === 'GET') return accounts[role].request(path);
    const subpath = path.slice(repoPath.length);
    const permitted = method === 'POST' && (['/git/trees', '/git/commits'].includes(subpath) || /^\/issues\/\d+\/comments$/.test(subpath)) || method === 'PATCH' && (subpath.startsWith('/git/refs/heads/vpylab/proposal-') || /^\/issues\/\d+$/.test(subpath));
    assert.ok(permitted, '시험에서 허용한 쓰기 경로가 아닙니다.');
    if (method === 'PATCH' && subpath.startsWith('/git/refs')) {
      const branch = subpath.slice('/git/refs/heads/'.length);
      assert.ok(Object.values(state.teams).some(team => team.pull?.branch === branch));
      assert.equal(body.force, false);
    }
    if (/^\/issues\//.test(subpath)) assert.ok(Object.values(state.teams).some(team => team.issue?.number === Number(subpath.split('/')[2])));
    await new Promise(done => setTimeout(done, Math.max(0, 1100 - (Date.now() - lastWrite)))); lastWrite = Date.now();
    let response;
    try { response = await fetch(`https://api.github.com${path}`, { method, redirect: 'error', signal: AbortSignal.timeout(30000), headers: { Authorization: `Bearer ${accounts[role].token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2026-03-10', 'Content-Type': 'application/json', 'User-Agent': 'VPyLab-Month-Project-Test' }, body: JSON.stringify(body) }); }
    catch { throw new Error('GitHub 전송 결과가 불명확합니다. 재전송 전 표식과 브랜치를 확인해야 합니다.'); }
    assert.ok(response.ok, `GitHub ${method} HTTP ${response.status}. 자동 재전송하지 않습니다.`);
    return response.json();
  }
  const reviewRequest = createRequester({ token: accounts.reviewer.token, allowWrites: true });
  if (command === '--quality') {
    assert.ok(state.completedAt, '8차시 검증이 완료된 뒤에만 최종 화면 수정을 반영합니다.');
    const team = state.teams.original, code = read(resolve(publicDirectory, 'original/main.py'));
    assert.equal(code, read(resolve(publicDirectory, 'original/milestones/08.py')));
    const path = `/projects/${team.project.id}`;
    if (team.quality && team.quality.hash !== digest(code)) {
      assert.ok(team.quality.sha && team.quality.review?.phase === 'confirmed', '앞선 화면 수정의 전송과 승인이 끝난 뒤 새 수정을 기록합니다.');
      (team.qualityHistory ||= []).push(team.quality);
      delete team.quality;
    }
    const quality = team.quality ||= { hash: digest(code), baseVersion: store.getProject(team.project.id).version, parentSha: team.finalSha }; save();
    assert.equal(quality.hash, digest(code), '화면 수정 전송 중 코드가 다시 바뀌었습니다.');
    await stage(quality, 'checkpoint', async () => {
      const { proposal } = await api('student-a', `${path}/proposals`, { method: 'POST', body: { title: '최종 QA · 결과표와 범례를 읽기 좋게 배치', code, baseVersion: quality.baseVersion, evidence: { hypothesis: '라벨을 같은 평면에 넓게 배치하면 결과표를 정확히 읽을 수 있다.', observation: '실제 브라우저 캡처에서 제목·수치·범례가 겹쳐 좌표와 시야를 조정했다.', reasoning: '계산 규칙을 유지하고 표시 위치만 바꾸어 수치 비교의 의미를 보존한다.', nextStep: '기본 조건 3전략 결과가 32.7/17.1/20.3초로 유지되는지 재검증한다.', aiUse: '개발 도구가 만든 합성 검증 시나리오이며 실제 학생 평가가 아니다.' } } }, 201);
      await api('student-b', `${path}/proposals/${proposal.id}/reviews`, { method: 'POST', body: { decision: 'approve', comment: '색 범례·시간·대기 수치를 겹침 없이 읽고 같은 계산 결과인지 비교합니다.' } }, 201);
      return (await api('student-a', `${path}/proposals/${proposal.id}/merge`, { method: 'POST', body: {} })).checkpoint;
    });
    if (!quality.sha) {
      assert.ok(!quality.sending, '화면 수정 커밋의 전송 결과를 확인해야 합니다.');
      const parent = await github('author', `${repoPath}/git/commits/${quality.parentSha}`);
      const tree = await github('author', `${repoPath}/git/trees`, { method: 'POST', body: { base_tree: parent.tree.sha, tree: [{ path: 'main.py', mode: '100644', type: 'blob', content: code }] } });
      quality.sending = true; save();
      const commit = await github('author', `${repoPath}/git/commits`, { method: 'POST', body: { message: `최종 QA: 결과표·범례 화면 배치 개선\n\n계산 규칙과 세 전략 수치는 유지합니다.\n[vpylab-month:${state.runId}:original:quality]`, tree: tree.sha, parents: [quality.parentSha] } });
      quality.sha = commit.sha; save();
    }
    const head = await github('author', `${repoPath}/git/ref/heads/${team.pull.branch}`);
    if (head.object.sha !== quality.sha) {
      assert.equal(head.object.sha, quality.parentSha);
      await github('author', `${repoPath}/git/refs/heads/${team.pull.branch}`, { method: 'PATCH', body: { sha: quality.sha, force: false } });
    }
    const final = await github('author', `${repoPath}/contents/main.py?ref=${quality.sha}`);
    assert.equal(Buffer.from(final.content, 'base64').toString('utf8'), code);
    const journal = quality.review ||= {}; save();
    team.approval = await ensureReview({ request: reviewRequest, number: team.pull.number, authorId: accounts.reviewer.id, sha: quality.sha, event: 'APPROVE', marker: `<!-- vpylab-month:${state.runId}:original:quality:${quality.hash} -->`, text: '최종 화면 배치 수정까지 포함한 최신 커밋을 다시 승인합니다. 합성 프로젝트 검증입니다.', journal, save });
    team.finalSha = quality.sha;
    const commits = await github('author', `${repoPath}/pulls/${team.pull.number}/commits?per_page=100`);
    assert.equal(commits.length, quality.baseVersion + 1);
    team.evidence.commits = commits.map(item => ({ sha: item.sha, authorId: item.author.id, author: item.author.login }));
    await api('teacher', `${path}/github/learning/sync`, { method: 'POST', body: {} });
    const data = await api('teacher', `${path}/learning`);
    assert.equal(data.sync.state, 'complete');
    assert.ok(data.events.some(item => item.kind === 'review' && item.sha === quality.sha && item.githubAuthorId === accounts.reviewer.id && item.metadata.state === 'APPROVED'));
    team.evidence.trackedEventCount = data.events.length;
    while (store.getJobs(team.project.id).some(item => item.state === 'pending')) assert.ok(await service.runOnce());
    assert.equal((await accounts.author.request(`${repoPath}/git/ref/heads/main`)).object.sha, state.baseSha);
    state.qualityVerifiedAt = new Date().toISOString();
    pass(`original · 8차시 후 화면 QA·${commits.length}번째 커밋·최신 SHA 재승인`);
    publishSummary(); await close(); return;
  }
  if (state.completedAt) {
    // 완료된 시나리오는 새 전송 없이 실제 최종본과 승인만 다시 확인합니다.
    for (const id of ids) {
      const team = state.teams[id], code = read(resolve(publicDirectory, id, 'main.py'));
      const pull = await github('author', `${repoPath}/pulls/${team.pull.number}`);
      assert.equal(pull.head.sha, team.finalSha);
      const file = await github('author', `${repoPath}/contents/main.py?ref=${team.finalSha}`);
      assert.equal(Buffer.from(file.content, 'base64').toString('utf8'), code);
      assert.equal(store.getProject(team.project.id).code, code);
      const reviews = await github('author', `${repoPath}/pulls/${team.pull.number}/reviews?per_page=100`);
      assert.ok(reviews.some(item => item.id === team.approval.id && item.commit_id === team.finalSha && item.user.id === accounts.reviewer.id && item.state === 'APPROVED'));
      const commits = await github('author', `${repoPath}/pulls/${team.pull.number}/commits?per_page=100`);
      assert.ok(commits.length >= 8);
      assert.deepEqual(commits.map(item => item.sha), team.evidence.commits.map(item => item.sha));
      process.stdout.write(`재확인: ${id} · 최종 코드·최신 승인·${commits.length}커밋 일치, 외부 쓰기 0\n`);
    }
    state.lastReadOnlyVerifiedAt = new Date().toISOString(); save(); publishSummary(); await close(); return;
  }
  for (const id of ids) {
    const learning = json(resolve(publicDirectory, id, 'learning.json'));
    const milestones = Array.from({ length: 8 }, (_, index) => read(resolve(publicDirectory, id, 'milestones', `${String(index + 1).padStart(2, '0')}.py`)));
    const finalCode = read(resolve(publicDirectory, id, 'main.py'));
    assert.equal(milestones[7], finalCode);
    assert.equal(learning.lessons.length, 8);
    assert.equal(new Set(milestones.map(digest)).size, 8);
    const team = state.teams[id] ||= { steps: {}, hash: digest(milestones.join('\n')) };
    assert.equal(team.hash, digest(milestones.join('\n')), '전송 중 작품 코드가 바뀌었습니다. 새 시험으로 구분해야 합니다.');
    save();
    const project = await stage(team, 'project', async () => {
      const result = await api('teacher', '/projects', { method: 'POST', body: { title: `[8차시 합성] ${learning.title}`, code: '# 팀의 문제와 원리를 먼저 정의합니다.\n', aiPolicy: id === 'course' ? 'optional' : 'disabled', problem: learning.lessons[0].question, successCriteria: learning.features.join('\n'), ...(id === 'course' ? { source: { kind: 'lesson', id: 'beg-melody-5', courseId: 'beg-melody', title: '소리에 그림 입히기' } } : {}) } }, 201);
      for (const userId of ['student-a', 'student-b']) await api('teacher', `/projects/${result.project.id}/members`, { method: 'POST', body: { userId, role: 'editor' } });
      await api('teacher', `/projects/${result.project.id}/github`, { method: 'PUT', body: { repositoryKey: `month-${id}` } });
      return result.project;
    });
    const path = `/projects/${project.id}`;
    const remote = await stage(team, 'remote', async () => (await api('student-a', `${path}/github/fetch`, { method: 'POST', body: {} })).remote);
    assert.equal(remote.sha, state.baseSha);
    await stage(team, 'issue', async () => {
      const title = `[8차시 ${id}] ${learning.title}의 문제와 실험 계획`;
      const body = `합성 학생 프로젝트 · 실제 수업 기간/성취의 기록이 아닙니다.\n\n${learning.lessons[0].question}\n\n${learning.lessons.map((lesson, index) => `${index + 1}차시: ${lesson.title}`).join('\n')}\n\n색·음악·접근성을 함께 검증합니다.\n\n시험 표식: ${state.runId}:${id}`;
      const { issue } = await api('student-a', `${path}/issues`, { method: 'POST', body: { title, body } }, 201);
      const { job } = await api('student-a', `${path}/github/issues`, { method: 'POST', body: { issueId: issue.id, title, body } }, 202);
      return drain(project.id, job.id);
    });
    for (let index = 0; index < 8; index++) {
      const lesson = learning.lessons[index];
      const author = index % 2 === 0 ? 'student-a' : 'student-b';
      const reviewer = author === 'student-a' ? 'student-b' : 'student-a';
      const step = team.steps[index + 1] ||= {}; save();
      const checkpoint = await stage(step, 'checkpoint', async () => {
        const evidence = Object.fromEntries(['hypothesis', 'observation', 'reasoning', 'nextStep'].map(key => [key, lesson[key] || lesson.title]));
        evidence.aiUse = id === 'course' ? '선택 사용 수업 시나리오. 이 자동 검증은 AI 호출 없이 진행합니다.' : 'AI 미사용 수업 시나리오. 기본 문법과 동료 검토로 진행합니다.';
        const { proposal } = await api(author, `${path}/proposals`, { method: 'POST', body: { title: `${index + 1}차시 · ${lesson.title}`, code: milestones[index], baseVersion: index, evidence } }, 201);
        await api(author, `${path}/proposals/${proposal.id}/reviews`, { method: 'POST', body: { decision: 'approve', comment: '자기 승인은 거절되어야 합니다.' } }, 403);
        if (index === 3) {
          await api(reviewer, `${path}/proposals/${proposal.id}/reviews`, { method: 'POST', body: { decision: 'request_changes', comment: '색만으로 설명하지 말고 수치·번호·음소거 상태도 확인해주세요.' } }, 201);
          await api(author, `${path}/proposals/${proposal.id}/merge`, { method: 'POST', body: {} }, 403);
        }
        await api(reviewer, `${path}/proposals/${proposal.id}/reviews`, { method: 'POST', body: { decision: 'approve', comment: lesson.reviewerComment || '변경의 가정과 경계 조건을 확인했습니다.' } }, 201);
        const merged = await api(author, `${path}/proposals/${proposal.id}/merge`, { method: 'POST', body: {}, key: 'after-peer-approval' });
        assert.equal(merged.checkpoint.code, milestones[index]);
        assert.equal(merged.checkpoint.version, index + 1);
        await api(reviewer, `${path}/checkpoints`, { method: 'POST', body: { code: '# 오래된 초안\n', baseVersion: index, message: '충돌 검증' } }, 409);
        return merged.checkpoint;
      });
      if (index === 0) await stage(team, 'pull', async () => {
        const { job } = await api('student-a', `${path}/github/proposals`, { method: 'POST', body: { title: `[8차시 ${id}] ${learning.title}`, code: checkpoint.code, checkpointId: checkpoint.id, baseSha: remote.sha, message: `합성 팀 프로젝트의 8개 발전 커밋을 이 PR에서 검토합니다.\n\n${learning.subtitle}\n\n문제 정의: ${team.issue.url}\n원본 및 재사용: ${JSON.stringify(learning.provenance)}\n\n운영 서비스 교체는 하지 않습니다.\n시험 표식: ${state.runId}:${id}` } }, 202);
        return drain(project.id, job.id);
      });
      if (index > 0) await stage(step, 'commit', async () => {
        const role = author === 'student-a' ? 'author' : 'reviewer';
        const parent = index === 1 ? team.pull.sha : team.steps[index].commit.sha;
        const marker = `[vpylab-month:${state.runId}:${id}:${index + 1}]`;
        const journal = step.git ||= {}; save();
        if (!journal.sha) {
          assert.ok(!journal.sending, '커밋 전송 결과를 확인해야 합니다.');
          const base = await github(role, `${repoPath}/git/commits/${parent}`);
          const treeFiles = [{ path: 'main.py', mode: '100644', type: 'blob', content: milestones[index] }];
          if (index === 7) {
            treeFiles.push({ path: 'learning.json', mode: '100644', type: 'blob', content: JSON.stringify(learning, null, 2) + '\n' });
            if (id === 'remix') {
              treeFiles.push({ path: 'ATTRIBUTION.md', mode: '100644', type: 'blob', content: read(resolve(publicDirectory, id, 'ATTRIBUTION.md')) });
              treeFiles.push({ path: 'LICENSE.original.txt', mode: '100644', type: 'blob', content: read(resolve(publicDirectory, id, 'LICENSE.txt')) });
            }
          }
          const tree = await github(role, `${repoPath}/git/trees`, { method: 'POST', body: { base_tree: base.tree.sha, tree: treeFiles } });
          journal.sending = true; save();
          const commit = await github(role, `${repoPath}/git/commits`, { method: 'POST', body: { message: `${index + 1}차시: ${lesson.title}\n\n${lesson.reasoning}\n\n${marker}`, tree: tree.sha, parents: [parent] } });
          journal.sha = commit.sha; save();
        }
        const head = await github(role, `${repoPath}/git/ref/heads/${team.pull.branch}`);
        if (head.object.sha !== journal.sha) {
          assert.equal(head.object.sha, parent, '제안 브랜치가 외부에서 변경되었습니다.');
          await github(role, `${repoPath}/git/refs/heads/${team.pull.branch}`, { method: 'PATCH', body: { sha: journal.sha, force: false } });
        }
        return { sha: journal.sha, number: index + 1, expectedAuthorId: accounts[role].id };
      });
      await stage(step, 'comment', async () => {
        const marker = `<!-- vpylab-month:${state.runId}:${id}:lesson-${index + 1} -->`;
        const comments = await github('author', `${repoPath}/issues/${team.issue.number}/comments?per_page=100`);
        const existing = comments.find(item => item.body?.includes(marker));
        if (existing) return { id: existing.id, url: existing.html_url };
        assert.ok(!step.commentSending, '진행 의견의 전송 결과를 확인해야 합니다.');
        step.commentSending = true; save();
        const item = await github(reviewer === 'student-b' ? 'reviewer' : 'author', `${repoPath}/issues/${team.issue.number}/comments`, { method: 'POST', body: { body: `### ${index + 1}차시 동료 검토 (합성 시나리오)\n${lesson.reviewerComment}\n\n판단: ${lesson.reasoning}\n다음 실험: ${lesson.nextStep}\n\n${marker}` } });
        return { id: item.id, url: item.html_url };
      });
      pass(`${id} · ${index + 1}차시 저장·동료 검토·충돌 방지·GitHub 기록`);
    }
    const pull = await github('author', `${repoPath}/pulls/${team.pull.number}`);
    const commits = await github('author', `${repoPath}/pulls/${team.pull.number}/commits?per_page=100`);
    assert.equal(commits.length, 8);
    const file = await github('author', `${repoPath}/contents/main.py?ref=${pull.head.sha}`);
    assert.equal(Buffer.from(file.content, 'base64').toString('utf8'), finalCode);
    for (let index = 1; index < 8; index++) assert.equal(commits[index].author?.id, team.steps[index + 1].commit.expectedAuthorId);
    team.finalSha = pull.head.sha; save();
    for (const [event, name, text] of [['COMMENT', 'comment', '음악·색·무음·초기화·조건 비교를 최종 코드에서 확인하는 검토입니다. 합성 수업 검증이며 실제 학생 평가가 아닙니다.'], ['APPROVE', 'approval', '8개 단계의 발전, 출처, 조건 비교와 접근성 설계를 확인했습니다. 별도 계정의 최신 커밋 승인입니다.']]) {
      const journal = state.reviews[`${id}:${name}`] ||= {}; save();
      team[name] = await ensureReview({ request: reviewRequest, number: team.pull.number, authorId: accounts.reviewer.id, sha: team.finalSha, event, marker: `<!-- vpylab-month:${state.runId}:${id}:${name} -->`, text, journal, save }); save();
    }
    await stage(team, 'issueClosed', async () => {
      const issue = await github('author', `${repoPath}/issues/${team.issue.number}`);
      if (issue.state !== 'closed') await github('author', `${repoPath}/issues/${team.issue.number}`, { method: 'PATCH', body: { state: 'closed', state_reason: 'completed' } });
      return true;
    });
    await api('teacher', `${path}/github/learning/sync`, { method: 'POST', body: {} });
    const learningData = await api('teacher', `${path}/learning`);
    assert.equal(learningData.sync.state, 'complete');
    const events = learningData.events;
    for (const item of commits) assert.ok(events.some(event => event.kind === 'commit' && event.sha === item.sha && event.githubAuthorId === item.author.id));
    assert.ok(events.some(event => event.kind === 'review' && event.githubAuthorId === accounts.reviewer.id && event.sha === team.finalSha && event.metadata.state === 'APPROVED'));
    assert.ok(events.filter(event => event.metadata.number).every(event => [team.issue.number, team.pull.number].includes(event.metadata.number)), '다른 팀의 근거가 섞였습니다.');
    await stage(team, 'feedback', async () => {
      const created = [];
      for (const user of ['student-a', 'student-b']) {
        const own = events.filter(event => event.githubAuthorId === accounts[user === 'student-a' ? 'author' : 'reviewer'].id);
        assert.ok(own.length > 0);
        for (const visibility of ['student', 'private']) created.push((await api('teacher', `${path}/feedback`, { method: 'POST', body: { studentId: user, visibility, evidenceIds: [own[0].id], comment: visibility === 'private' ? `[교사 개인 관찰 · 합성] ${learning.title}: 코드 변경 건수로 점수화하지 않고, 직접 설명하는지 다음 수업에서 확인합니다.` : `[개별 피드백 · 합성] ${learning.title}: ${user === 'student-a' ? '조건을 통제하며 구현한 이유를 근거와 연결했습니다. 다음에는 예상과 다른 결과를 하나 골라 설명해보세요.' : '동료의 코드와 최신 커밋을 검토했습니다. 다음에는 음악·색을 끈 조건에서도 설명이 가능한지 반례를 제안해보세요.'}`, criteria: { experiment: '한 번에 한 조건을 바꾸는 비교', collaboration: '다른 계정의 의견과 승인 근거 확인', nextStep: '예상과 다른 사례를 직접 재현하고 설명하기' } } }, 201)).feedback);
      }
      return created.map(item => ({ id: item.id, studentId: item.studentId, visibility: item.visibility }));
    });
    for (const user of ['student-a', 'student-b']) {
      const own = await api(user, `${path}/student-evidence/${user}`);
      assert.ok(own.events.some(event => event.kind === 'commit'));
      await api(user, `${path}/student-evidence/${user === 'student-a' ? 'student-b' : 'student-a'}`, {}, 403);
      for (const suffix of ['', '/export']) {
        const detail = await api(user, path + suffix);
        assert.ok(detail.feedback.every(item => item.visibility === 'team' || item.visibility === 'student' && item.studentId === user));
        assert.equal(detail.project.code, finalCode);
        assert.equal(detail.proposals.length, 8);
        assert.ok(detail.proposals.every(item => item.state === 'merged'));
      }
    }
    team.evidence = { commits: commits.map(item => ({ sha: item.sha, authorId: item.author.id, author: item.author.login })), trackedEventCount: events.length, sync: learningData.sync.state, feedbackPrivacy: 'passed' };
    save(); pass(`${id} · 실제 8커밋·두 계정·최종 승인·학생별 귀속·교사 기록 보호`);
  }
  assert.equal((await accounts.author.request(`${repoPath}/git/ref/heads/main`)).object.sha, state.baseSha);
  for (const account of Object.values(accounts)) for (const file of [statePath, database, `${database}-wal`, `${database}-shm`]) if (existsSync(file)) assert.equal(readFileSync(file).includes(Buffer.from(account.token)), false);
  pass('세 팀 완료 후 main 보존·자격증명 저장 없음');
  state.completedAt ||= new Date().toISOString(); save();
  publishSummary();
  process.stdout.write(`세 팀 완료: ${state.checks.length}개 검증 묶음\n${ids.map(id => `${id}: ${state.teams[id].pull.url}`).join('\n')}\n`);
  await close();
}

main().catch(async error => {
  if (state && lock !== undefined) { state.failure = { at: new Date().toISOString(), name: error.name }; save(); }
  process.stderr.write(`세 팀 시험을 중단했습니다: ${error instanceof assert.AssertionError ? error.message : '전송 상태·브랜치·로컬 파일을 확인해주세요. 원문 인증 오류는 출력하지 않습니다.'}\n`);
  process.exitCode = 1; await close();
});

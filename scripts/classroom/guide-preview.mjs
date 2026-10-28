import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStore } from '../../server/classroom/store.js';
import { createClassroomApp } from '../../server/classroom/app.js';
import { createGitHubService } from '../../server/classroom/github.js';
import { snapshotDatabase, verifyDatabase } from './backup.mjs';
import { TEST_REPOSITORY } from './two-account-github.mjs';

// 안내서용 화면은 실제 시험의 일관된 복사본으로만 실행합니다.
const root = fileURLToPath(new URL('../../', import.meta.url));
const sourceDirectory = resolve(root, '.local/github-two-account');
const sourceDatabase = resolve(sourceDirectory, 'classroom.sqlite');
const state = JSON.parse(readFileSync(resolve(sourceDirectory, 'state.json'), 'utf8'));
const projectId = state.projectId;
assert.ok(typeof projectId === 'string' && projectId === state.outputs?.project?.id, '완료된 두 계정 시험의 프로젝트를 확인해주세요.');
assert.equal(state.repository?.repositoryId, TEST_REPOSITORY.repositoryId);

const captureRoot = resolve(root, '.local/guide-capture');
const captureDirectory = resolve(captureRoot, `${new Date().toISOString().replaceAll(':', '-')}-${randomUUID().slice(0, 8)}`);
mkdirSync(captureDirectory, { recursive: true, mode: 0o700 });
chmodSync(captureRoot, 0o700);
chmodSync(captureDirectory, 0o700);
const database = resolve(captureDirectory, 'classroom.sqlite');
const originalFingerprint = verifyDatabase(sourceDatabase).fingerprint;
const snapshot = await snapshotDatabase({ source: sourceDatabase, destination: database, manifest: false });
assert.equal(snapshot.fingerprint, originalFingerprint, '복사 중 원본이 변경되어 촬영을 중단했습니다.');

const backendPort = 4074, frontendPort = 4073;
const backendOrigin = `http://127.0.0.1:${backendPort}`;
const previewOrigin = `http://127.0.0.1:${frontendPort}`;
const blockExternal = async () => { throw new Error('안내 화면 복사본에서는 외부 통신과 자격증명 사용을 차단합니다.'); };
let store, service, server, frontend;
let fixturesAdded;
let closing = false;
async function close() {
  if (closing) return;
  closing = true;
  frontend?.kill('SIGTERM');
  await service?.stopWorker();
  if (server?.listening) await new Promise(done => server.close(done));
  store?.close();
}

try {
  // 원본의 실계정 매핑을 보존합니다. localMode 시드는 매핑을 데모 계정으로 바꿉니다.
  store = createStore({ filename: database, localMode: false });
  assert.equal(store.githubIdentity('student-a')?.githubId, state.identities.author.id);
  assert.equal(store.githubIdentity('student-b')?.githubId, state.identities.reviewer.id);
  assert.ok(store.getProject(projectId), '복사본에서 시험 프로젝트를 찾을 수 없습니다.');
  const githubEvidenceBefore = JSON.stringify(store.db.prepare('SELECT * FROM github_learning_events ORDER BY rowid').all());
  store.transaction(() => {
    store.db.exec('DELETE FROM sessions; DELETE FROM operations;');
    store.db.prepare('UPDATE projects SET title=?,problem=?,success_criteria=? WHERE id=?').run(
      '반지름과 충돌 조건 탐구',
      '공의 반지름을 바꾸면 바닥에 닿는 순간과 움직임이 어떻게 달라질까요? 한 번에 한 조건을 바꾸고 동료와 관찰 결과를 비교해봅시다.',
      '변경 전후의 실행 결과를 비교하고, 동료가 제시한 반례를 검토한 뒤 선택 이유를 Issue·PR·리뷰 근거와 연결해 설명합니다.',
      projectId,
    );
    const feedback = store.db.prepare('SELECT id,student_id,visibility FROM feedback WHERE project_id=? ORDER BY created_at,id').all(projectId);
    assert.equal(feedback.length, 6, '두 계정 시험의 합성 피드백 6개를 확인해주세요.');
    for (const row of feedback) {
      assert.ok(['student-a', 'student-b'].includes(row.student_id));
      const author = row.student_id === 'student-a';
      const comments = {
        private: author
          ? '교사 관찰: 반지름을 바꾼 이유를 PR에 설명했습니다. 다음 면담에서 바닥과 공의 거리 조건을 자신의 말로 설명하는지 확인합니다.'
          : '교사 관찰: 동료의 코드에서 경계 조건을 짚어 검토 의견을 남겼습니다. 다음에는 직접 실행한 반례도 함께 제시하도록 돕습니다.',
        student: author
          ? '반지름을 바꾸기 전후를 비교한 점이 좋습니다. 다음 실험에서는 바닥에 닿는 높이를 예측하고, 실행 결과와 다른 이유를 적어보세요.'
          : '동료의 변경 사항을 확인하고 검토 의견을 남겼습니다. 승인 이유에 직접 실행한 조건과 관찰 결과를 한 문장 더해보세요.',
        team: author
          ? '팀 피드백: 변경 이유를 Issue와 PR에 연결했습니다. 다음에는 같은 조건으로 두 번 실행해 결과가 일관되는지 함께 확인해보세요.'
          : '팀 피드백: 작성자와 검토자의 역할을 나누어 협력했습니다. 다음 실험에서는 역할을 바꾸고 서로의 설명을 확인해봅시다.',
      };
      assert.ok(comments[row.visibility], '피드백 공개 범위를 확인해주세요.');
      store.db.prepare('UPDATE feedback SET comment=? WHERE id=?').run(comments[row.visibility], row.id);
    }
    const studentA = store.user('student-a'), studentB = store.user('student-b');
    const checkpoint = store.checkpoint(projectId);
    const issue = store.addIssue(projectId, studentA, {
      title: '반지름을 키우면 같은 거리에서도 더 빨리 만날까요?',
      body: '반지름 외에 출발 위치와 관찰 시간을 같게 두고 비교하고 싶어요.',
    });
    const proposal = store.addProposal(projectId, studentA, {
      title: '두 반지름을 같은 조건에서 비교하기',
      code: checkpoint.code + '\n# 다음 실험: 관찰 시간을 같게 두고 비교합니다.\n',
      baseVersion: store.getProject(projectId).version,
      evidence: { hypothesis: '반지름이 큰 공이 더 이른 시점에 바닥에 닿을 것으로 예상합니다.', observation: '다음 실험에서 출발 위치와 관찰 시간을 같게 두고 비교합니다.', reasoning: '반지름 외의 조건을 같게 두어 변화의 원인을 구분합니다.', nextStep: '관찰 시간을 5초로 통일해 두 조건을 비교합니다.' },
    });
    const review = store.addReview(projectId, proposal.id, studentB, {
      decision: 'approve',
      comment: '반지름 이외의 조건을 같게 둔 점이 좋아요. 다음에는 관찰 시간을 5초로 통일해 비교해봐요.',
    });
    fixturesAdded = { source: 'guide_capture_local_synthetic', issueId: issue.id, proposalId: proposal.id, reviewId: review.id, merged: false, publishedToGitHub: false, description: '안내 화면 촬영을 위해 복사본에만 추가한 로컬 질문·변경 제안·동료 검토입니다. 실제 GitHub Issue·PR·리뷰가 아닙니다.' };
  });
  assert.equal(JSON.stringify(store.db.prepare('SELECT * FROM github_learning_events ORDER BY rowid').all()), githubEvidenceBefore, '실제 GitHub 근거 원문은 수정할 수 없습니다.');
  assert.equal(verifyDatabase(sourceDatabase).fingerprint, originalFingerprint, '원본 시험 데이터가 변경되었습니다.');
  for (const filename of [database, `${database}-wal`, `${database}-shm`]) if (existsSync(filename)) chmodSync(filename, 0o600);

  service = createGitHubService({ store, localMode: true, config: { mode: 'live', repositories: [TEST_REPOSITORY] }, fetchImpl: blockExternal, installationTokenProvider: blockExternal });
  const runtime = createClassroomApp({ store, localMode: true, githubService: service, allowedOrigins: [previewOrigin, backendOrigin], verifyToken: blockExternal });
  server = runtime.app.listen(backendPort, '127.0.0.1');
  await new Promise((done, reject) => { server.once('listening', done); server.once('error', reject); });

  // 자격증명 조회와 GitHub worker 실행은 하지 않습니다.
  const guideCopyMetadata = {
    projectId,
    snapshotDatabase: relative(root, database),
    ports: { frontend: frontendPort, backend: backendPort },
    originalFingerprint,
    sanitizedFixture: true,
    externalNetworkBlocked: true,
    workerStarted: false,
    fixturesAdded,
    createdAt: new Date().toISOString(),
    description: '실제 두 계정 시험의 SQLite online backup 복사본입니다. 세션·재요청 캐시를 비우고 프로젝트 설명과 합성 교사 피드백 6개를 안내용으로 정리했습니다. 로컬 질문·변경 제안·동료 검토 각 1개는 복사본 전용 합성 자료입니다. 실제 GitHub 근거 ID·URL·작성자·SHA·원문은 보존했습니다. 원본 DB·GitHub·운영 서비스는 변경하지 않습니다.',
  };
  const latestPath = resolve(captureRoot, 'latest.json');
  writeFileSync(latestPath, JSON.stringify(guideCopyMetadata, null, 2) + '\n', { mode: 0o600 });
  chmodSync(latestPath, 0o600);

  const frontendEnvironment = Object.fromEntries(['PATH', 'HOME', 'TMPDIR', 'LANG', 'LC_ALL', 'SYSTEMROOT'].filter(key => process.env[key] !== undefined).map(key => [key, process.env[key]]));
  frontend = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--config', 'vite.classroom.config.js'], {
    cwd: resolve(root, 'client'), stdio: 'inherit',
    env: { ...frontendEnvironment, CLASSROOM_PREVIEW_PORT: String(frontendPort), CLASSROOM_API_PORT: String(backendPort) },
  });
  frontend.once('error', () => { process.exitCode = 1; void close(); });
  frontend.once('exit', code => { if (code && !closing) process.exitCode = code; void close(); });
  process.once('SIGINT', () => { void close(); });
  process.once('SIGTERM', () => { void close(); });
  process.stdout.write(`안내용 격리 복사본: ${previewOrigin}/classroom.html#/projects/${projectId}/process\n원본 보존·외부 GitHub 통신 차단·worker 미실행\n`);
} catch (error) {
  await close();
  throw error;
}

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { closeSync, existsSync, openSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStore } from '../../server/classroom/store.js';
import { createClassroomApp } from '../../server/classroom/app.js';
import { createGitHubService } from '../../server/classroom/github.js';
import { preflight, TEST_REPOSITORY } from './two-account-github.mjs';

// 완료된 두 계정 시험을 대화형으로 엽니다. --run의 생성·리뷰·승인 검사는 반복하지 않습니다.
const root = fileURLToPath(new URL('../../', import.meta.url));
const directory = resolve(root, '.local/github-two-account');
const database = resolve(directory, 'classroom.sqlite');
const lockPath = resolve(directory, 'run.lock');
const frontendPort = 4063, backendPort = 4064;
const previewOrigin = `http://127.0.0.1:${frontendPort}`;
const backendOrigin = `http://127.0.0.1:${backendPort}`;
let store, service, server, frontend, lock, token;
let closing = false;
async function close() {
  if (closing) return;
  closing = true;
  frontend?.kill('SIGTERM');
  await service?.stopWorker();
  if (server?.listening) await new Promise(done => server.close(done));
  store?.close();
  token = null;
  if (lock !== undefined) { closeSync(lock); unlinkSync(lockPath); }
}

async function main() {
  assert.ok(existsSync(database), '먼저 두 계정 시험을 완료해주세요. 기존 DB를 새로 만들지 않습니다.');
  const state = JSON.parse(readFileSync(resolve(directory, 'state.json'), 'utf8'));
  assert.ok(state.completedAt && state.projectId === state.outputs?.project?.id, '완료된 두 계정 시험의 프로젝트가 필요합니다.');
  assert.equal(state.repository.repositoryId, TEST_REPOSITORY.repositoryId);
  const accounts = await preflight({ reviewer: state.identities.reviewer.login });
  assert.equal(accounts.author.id, state.identities.author.id);
  assert.equal(accounts.reviewer.id, state.identities.reviewer.id);
  token = accounts.author.token;
  try { lock = openSync(lockPath, 'wx', 0o600); }
  catch { throw new Error('두 계정 시험 또는 대화형 서버가 이미 실행 중입니다. 기존 실행을 종료한 뒤 다시 열어주세요.'); }
  writeFileSync(lock, JSON.stringify({ pid: process.pid, mode: 'interactive', startedAt: new Date().toISOString() }) + '\n');
  // 기존 실제 계정 귀속을 유지하며 데모 신원 시드를 다시 적용하지 않습니다.
  store = createStore({ filename: database, localMode: false });
  assert.equal(store.githubIdentity('student-a')?.githubId, accounts.author.id);
  assert.equal(store.githubIdentity('student-b')?.githubId, accounts.reviewer.id);
  assert.ok(store.getProject(state.projectId));
  service = createGitHubService({ store, localMode: true, config: { mode: 'live', repositories: [TEST_REPOSITORY] }, installationTokenProvider: async binding => {
    assert.equal(binding.repositoryId, TEST_REPOSITORY.repositoryId);
    assert.equal(binding.owner, TEST_REPOSITORY.owner);
    assert.equal(binding.repo, TEST_REPOSITORY.repo);
    return token;
  } });
  const runtime = createClassroomApp({ store, localMode: true, githubService: service, allowedOrigins: [previewOrigin, backendOrigin] });
  server = runtime.app.listen(backendPort, '127.0.0.1');
  await new Promise((done, reject) => { server.once('listening', done); server.once('error', reject); });
  const jobs = store.getJobs(state.projectId);
  const pending = jobs.filter(job => ['pending', 'running'].includes(job.state)).length;
  service.startWorker();
  const environment = Object.fromEntries(['PATH', 'HOME', 'TMPDIR', 'LANG', 'LC_ALL', 'SYSTEMROOT'].filter(key => process.env[key] !== undefined).map(key => [key, process.env[key]]));
  frontend = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--config', 'vite.classroom.config.js'], { cwd: resolve(root, 'client'), stdio: 'inherit', env: { ...environment, CLASSROOM_PREVIEW_PORT: String(frontendPort), CLASSROOM_API_PORT: String(backendPort) } });
  frontend.once('error', () => { process.exitCode = 1; void close(); });
  frontend.once('exit', code => { if (code && !closing) process.exitCode = code; void close(); });
  process.once('SIGINT', () => { void close(); });
  process.once('SIGTERM', () => { void close(); });
  process.stdout.write(`직접 테스트: ${previewOrigin}/classroom.html#/projects/${state.projectId}/process\n기존 두 계정 기록·개별 피드백 유지, 시작 시 미완료 작업 ${pending}개\n실제 비공개 시험 저장소 연결입니다. Issue·PR 제출은 이 시험 저장소에 반영됩니다.\n운영 서비스·운영 DB·원본 저장소에는 연결하지 않습니다.\n`);
}

main().catch(async () => {
  process.stderr.write('두 계정 대화형 교실을 열지 못했습니다. 기존 CLI 로그인·완료된 시험 DB·포트·실행 잠금을 확인해주세요. 인증값과 원문 오류는 출력하지 않습니다.\n');
  process.exitCode = 1;
  await close();
});

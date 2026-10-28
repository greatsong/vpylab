import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { projectDir } from '../project-paths.mjs';
import { createStore } from '../../server/classroom/store.js';
import { createClassroomApp } from '../../server/classroom/app.js';
import { createGitHubService } from '../../server/classroom/github.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const training = projectDir('vpylab-teacher-training');
const directory = join(root, '.local/teacher-training');
mkdirSync(directory, { recursive: true, mode: 0o700 });
const lockPath = join(directory, 'serve.lock');
let lock, store, service, server, frontend, closing = false;
async function close() {
  if (closing) return; closing = true;
  frontend?.kill('SIGTERM'); await service?.stopWorker();
  if (server?.listening) await new Promise(done => server.close(done));
  store?.close();
  if (lock !== undefined) { closeSync(lock); unlinkSync(lockPath); }
}
async function main() {
  lock = openSync(lockPath, 'wx', 0o600); writeFileSync(lock, String(process.pid));
  const database = join(directory, 'classroom.sqlite');
  store = createStore({ filename: database, localMode: true });
  const statePath = join(directory, 'state.json');
  let state = existsSync(statePath) ? JSON.parse(readFileSync(statePath, 'utf8')) : { schema: 1, projects: {} };
  assert.equal(state.schema, 1);
  for (const [id, title, source, aiPolicy = 'disabled'] of [['math', '수학 연수 · 짝과 비례 실험', 'math/proportion.py'], ['science', '과학 연수 · 짝과 이동 실험', 'science/motion.py'], ['no-ai-math', '3차시 AI 미사용 · 비례 실험', 'math/proportion.py'], ['no-ai-sound', '3차시 AI 미사용 · 소리 실험', 'science/sound-steps.py'], ['ai-math', '3차시 AI 사용 · 비례 실험', 'math/proportion.py', 'optional'], ['ai-sound', '3차시 AI 사용 · 소리 실험', 'science/sound-steps.py', 'optional']]) {
    if (state.projects[id]) { assert.ok(store.getProject(state.projects[id].id)); continue; }
    const project = store.createProject(store.user('teacher'), { title, code: readFileSync(join(training, source), 'utf8'), aiPolicy, problem: '한 조건만 바꾸면 어떤 차이가 나타날까요?', successCriteria: '변경 전 예상, 같은 조건의 실행, 동료의 구체적 검토와 수정 이유를 남깁니다.' });
    for (const userId of ['student-a', 'student-b']) store.addMember(project.id, store.user('teacher'), userId, 'editor');
    state.projects[id] = { id: project.id, title: project.title, inviteCode: project.inviteCode };
    const temporary = `${statePath}.tmp`; writeFileSync(temporary, JSON.stringify(state, null, 2) + '\n', { mode: 0o600 }); renameSync(temporary, statePath);
  }
  // 연수에서는 기존 CLI 인증·운영 환경을 읽지 않고 GitHub 외부 요청을 차단합니다.
  service = createGitHubService({ store, localMode: true, config: { mode: 'offline', repositories: [] }, fetchImpl: async () => { throw new Error('연수 기본 환경은 외부 GitHub에 연결하지 않습니다.'); } });
  const runtime = createClassroomApp({ store, localMode: true, githubService: service, sessionCookieName: 'vpylab_teacher_training_session', allowedOrigins: ['http://127.0.0.1:4093', 'http://127.0.0.1:4094'] });
  server = createServer((req, res) => {
    if (req.url === '/api/training-info' && req.method === 'GET' && ['127.0.0.1:4093', '127.0.0.1:4094', 'localhost:4093', 'localhost:4094'].includes(req.headers.host)) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.setHeader('Cache-Control', 'no-store');
      return res.end(JSON.stringify({ schema: 1, mode: 'offline', externalGitHubWrites: false, projects: state.projects }));
    }
    runtime.app(req, res);
  }).listen(4094, '127.0.0.1');
  await new Promise((done, reject) => { server.once('listening', done); server.once('error', reject); });
  service.startWorker();
  if (!process.argv.includes('--api-only')) {
    const environment = Object.fromEntries(['PATH', 'HOME', 'TMPDIR', 'LANG', 'LC_ALL', 'GREATSONG_ROOT'].filter(key => process.env[key] !== undefined).map(key => [key, process.env[key]]));
    const command = ['node_modules/vite/bin/vite.js', ...(process.argv.includes('--preview') ? ['preview'] : []), '--config', 'vite.training.config.js'];
    frontend = spawn(process.execPath, command, { cwd: join(root, 'client'), env: environment, stdio: 'inherit' });
    frontend.once('error', () => { process.exitCode = 1; void close(); });
    frontend.once('exit', code => { if (code && !closing) process.exitCode = code; void close(); });
  }
  process.once('SIGINT', () => void close()); process.once('SIGTERM', () => void close());
  process.stdout.write('교사 연수: http://127.0.0.1:4093/training.html\n연수 협력 교실: http://127.0.0.1:4093/classroom.html\n별도 연수 DB · GitHub 연결 전 · 운영 DB와 분리\n');
}
main().catch(async error => { process.stderr.write(`연수 환경을 열지 못했습니다: ${error.code === 'EEXIST' ? '이미 실행 중인지 잠금을 확인해주세요.' : '폴더 등록·기존 상태·포트를 확인해주세요.'}\n`); process.exitCode = 1; await close(); });

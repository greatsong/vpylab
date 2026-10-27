import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 22 || (major === 22 && minor < 16)) {
  process.stderr.write('새 교실은 Node.js 22.16 이상이 필요합니다.\n');
  process.exit(1);
}
for (const path of ['client/node_modules/vite/bin/vite.js', 'server/node_modules/express/package.json']) {
  if (!existsSync(resolve(root, path))) {
    process.stderr.write('먼저 npm --prefix client ci 및 npm --prefix server ci 를 실행해주세요.\n');
    process.exit(1);
  }
}
const children = [
  spawn(process.execPath, ['server/classroom/index.js'], { cwd: root, stdio: 'inherit', env: { ...process.env, CLASSROOM_MODE: 'local', CLASSROOM_GITHUB_MODE: 'simulator', CLASSROOM_PORT: '4044' } }),
  spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--config', 'vite.classroom.config.js'], { cwd: resolve(root, 'client'), stdio: 'inherit', env: process.env }),
];
let stopping = false;
function close(code = 0) { if (stopping) return; stopping = true; process.exitCode = code; for (const child of children) if (child.exitCode === null) child.kill('SIGTERM'); }
for (const child of children) {
  child.on('error', (error) => { process.stderr.write(`${error.message}\n`); close(1); });
  child.on('exit', (code) => { if (!stopping) close(code || 0); });
}
process.on('SIGINT', () => close()); process.on('SIGTERM', () => close());
process.stdout.write('\n새 교실 테스트: http://127.0.0.1:4043/classroom.html\n운영 서버·운영 데이터와 연결되지 않는 로컬 시뮬레이터입니다.\n\n');

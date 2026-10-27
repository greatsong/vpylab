import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const reference = '605d7c8';
const files = ['client/src/data/courses.js', 'client/src/data/missions.js', 'client/src/data/examples.js', 'client/src/data/docs.js', 'docs/VPYTHON_API.md'];
const hash = (content) => createHash('sha256').update(content).digest('hex');
for (const file of files) {
  const original = execFileSync('git', ['show', `${reference}:${file}`], { cwd: root });
  const current = readFileSync(new URL(file, `file://${root}`));
  if (hash(original) !== hash(current)) { process.stderr.write(`수업 자료 변경 감지: ${file}\n`); process.exit(1); }
}
process.stdout.write(`수업 자료 ${files.length}개 원본 파일의 SHA-256 일치 확인 (${reference}).\n`);

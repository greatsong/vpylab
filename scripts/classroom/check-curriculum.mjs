import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/**
 * 새 교실(classroom v2) 코드를 고치는 변경이 수업 자료 원본까지 건드리지 않는지 확인한다.
 * 수업 자료만 고치는 변경(참고 문서 추가, 미션 조건 보강 등)은 허용한다.
 *
 * 비교 기준: CURRICULUM_BASE 환경 변수 > PR의 base 브랜치(GITHUB_BASE_REF) > 직전 커밋(HEAD~1)
 */
const root = fileURLToPath(new URL('../../', import.meta.url));
const curriculumFiles = ['client/src/data/courses.js', 'client/src/data/missions.js', 'client/src/data/examples.js', 'client/src/data/docs.js', 'docs/VPYTHON_API.md'];
const classroomPrefixes = ['client/src/classroom/', 'server/classroom/', 'scripts/classroom/'];
const selfPath = 'scripts/classroom/check-curriculum.mjs';

const base = process.env.CURRICULUM_BASE
  || (process.env.GITHUB_BASE_REF ? `origin/${process.env.GITHUB_BASE_REF}` : 'HEAD~1');

function git(args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' });
}

let changed;
try {
  changed = git(['diff', '--name-only', base, 'HEAD']).split('\n').map((line) => line.trim()).filter(Boolean);
} catch (error) {
  process.stderr.write(`비교 기준 ${base}을(를) 읽지 못했습니다: ${error.message}\n`);
  process.exit(1);
}

const curriculumChanged = changed.filter((file) => curriculumFiles.includes(file));
const classroomChanged = changed.filter((file) => file !== selfPath && classroomPrefixes.some((prefix) => file.startsWith(prefix)));

if (curriculumChanged.length && classroomChanged.length) {
  process.stderr.write(`새 교실 코드와 수업 자료가 같은 변경에 섞여 있습니다. 수업 자료는 별도 변경으로 나눠 주세요.\n  수업 자료: ${curriculumChanged.join(', ')}\n  교실 코드: ${classroomChanged.slice(0, 5).join(', ')}${classroomChanged.length > 5 ? ' 외' : ''}\n`);
  process.exit(1);
}

if (curriculumChanged.length) {
  process.stdout.write(`수업 자료 변경 ${curriculumChanged.length}개 확인 (교실 코드 변경 없음, 기준 ${base}): ${curriculumChanged.join(', ')}\n`);
} else {
  process.stdout.write(`수업 자료 원본 ${curriculumFiles.length}개 변경 없음 (기준 ${base}).\n`);
}

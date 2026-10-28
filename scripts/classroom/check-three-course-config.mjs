import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { projectDir } from '../project-paths.mjs';

const root = projectDir('vpylab-teacher-training');
const origin = 'http://127.0.0.1:4093';
const checks = [];
function check(name, condition) { assert.ok(condition, name); checks.push(name); }
const digest = path => createHash('sha256').update(readFileSync(join(root, path))).digest('hex');
const originals = ['common/hello.py', 'math/proportion.py', 'science/sound-steps.py'];
const sourceHashes = Object.fromEntries(originals.map(path => [path, digest(path)]));
for (const [id, policy] of [['three-no-ai', 'disabled'], ['three-ai', 'optional']]) {
  const path = `variants/${id}.json`, program = JSON.parse(readFileSync(join(root, path), 'utf8'));
  sourceHashes[path] = digest(path);
  check(`${id}: separate policy and 150-minute course`, program.id === id && program.aiPolicy === policy && program.policyLocked === true && program.sessionCount === 3 && program.totalMinutes === 150 && program.planSession === 3);
  check(`${id}: exactly three 50-minute sessions`, program.sessions.length === 3 && program.sessions.every((session, index) => session.id === index + 1 && session.timeline.reduce((sum, item) => sum + item.minutes, 0) === 50));
  check(`${id}: first success and one chosen activity`, program.sessions[0].activities.join() === 'first-light' && program.sessions.slice(1).every(session => session.activities.join() === 'sound-steps,math-proportion'));
  check(`${id}: visible support, collaboration and evidence`, program.sessions.every(session => session.supportSteps.length >= 3 && session.collaborationSteps.length >= 3 && session.evidenceChecklist.length >= 3));
  if (id === 'three-ai') check(`${id}: questions, direct verification and fallback`, program.sessions.every(session => ['aiPrompt', 'aiVerification', 'aiFallback'].every(key => typeof session[key] === 'string' && session[key].length > 10)));
}
const metadata = await fetch(`${origin}/api/training-info`).then(response => response.json());
check('GitHub stays offline', metadata.mode === 'offline' && metadata.externalGitHubWrites === false);
const login = await fetch(`${origin}/api/v2/session/local`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: 'teacher' }) });
assert.equal(login.status, 200);
const cookie = login.headers.get('set-cookie')?.split(';')[0];
check('Training uses its own session cookie', cookie?.startsWith('vpylab_teacher_training_session='));
for (const [prefix, policy] of [['no-ai', 'disabled'], ['ai', 'optional']]) {
  for (const [subject, codeFile] of [['math', 'math/proportion.py'], ['sound', 'science/sound-steps.py']]) {
    const key = `${prefix}-${subject}`, project = metadata.projects[key];
    check(`${key}: separate classroom exists`, Boolean(project?.id));
    const response = await fetch(`${origin}/api/v2/projects/${project.id}`, { headers: { Cookie: cookie, 'X-Classroom-User': 'teacher' } });
    assert.equal(response.status, 200); const detail = await response.json();
    check(`${key}: correct policy and original code`, detail.project.aiPolicy === policy && detail.project.code === readFileSync(join(root, codeFile), 'utf8'));
  }
}
check('Four new classrooms are distinct from the six-session classrooms', new Set(['math', 'science', 'no-ai-math', 'no-ai-sound', 'ai-math', 'ai-sound'].map(key => metadata.projects[key].id)).size === 6);
const report = { passed: true, testedAt: new Date().toISOString(), checksPassed: checks.length, checks, sourceHashes, externalGitHubWrites: 0, scope: 'Saved curriculum invariants and actual local classroom policies. No participant learning-effect or live AI-provider verification.' };
writeFileSync(join(root, 'validation/three-session-config-validation.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ passed: true, checks: checks.length, externalGitHubWrites: 0 }));

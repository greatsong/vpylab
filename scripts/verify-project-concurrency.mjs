import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
if (!args.includes('--write')) {
  console.log('실제 DB 동시성 검사: --write [--credentials-root 프로젝트경로]');
  console.log('새 합성 계정과 프로젝트에서만 검사한 뒤 정리합니다. 기존 작품과 계정은 변경하지 않습니다.');
  process.exit(0);
}
const credentialsRoot = args.includes('--credentials-root') ? args[args.indexOf('--credentials-root') + 1] : root;
const require = createRequire(join(root, 'server/package.json'));
const { createClient } = require('@supabase/supabase-js'), dotenv = require('dotenv');
const config = dotenv.parse(await readFile(join(credentialsRoot, 'server/.env')));
const pub = dotenv.parse(await readFile(join(root, 'client/.env.production')));
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, options);
const runId = `project-concurrency-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${randomBytes(3).toString('hex')}`;
const users = [], report = { runId, checks: [], cleanup: [] };
const unwrap = ({ data, error }) => { if (error) throw new Error(error.message); return data; };
const checked = name => { report.checks.push({ name, status: 'passed' }); console.log(`PASS ${name}`); };
async function actor(label) {
  const email = `${runId}-${label}@example.invalid`, password = randomBytes(30).toString('base64url');
  const { user } = unwrap(await admin.auth.admin.createUser({ email, password, email_confirm: true }));
  users.push(user.id);
  const client = createClient(config.SUPABASE_URL, pub.VITE_SUPABASE_ANON_KEY, options);
  unwrap(await client.auth.signInWithPassword({ email, password }));
  return { id: user.id, client };
}
try {
  const [a, b, outsider] = await Promise.all([actor('a'), actor('b'), actor('outsider')]);
  const project = unwrap(await a.client.from('vpylab_projects').insert({ owner_id: a.id, title: '동시 저장 검증용 작품' }).select().single());
  unwrap(await b.client.rpc('vpylab_join_project_by_invite', { p_invite_code: project.invite_code }));
  const row = unwrap(await a.client.from('vpylab_saved_code').insert({ user_id: a.id, project_id: project.id, title: project.title, code: 'speed = 1' }).select().single());
  const current = async () => unwrap(await a.client.from('vpylab_saved_code').select('id,code,project_id,mission_id').eq('id', row.id).single());
  const count = async () => {
    const result = await a.client.from('vpylab_code_revisions').select('id', { count: 'exact', head: true }).eq('code_id', row.id);
    if (result.error) throw result.error;
    return result.count;
  };
  const body = (expected, code, id = randomUUID()) => ({ p_code_id: row.id, p_project_id: project.id,
    p_client_save_id: id, p_expected_code: expected, p_code: code, p_title: project.title,
    p_message: '동시 저장 검증', p_source: 'manual' });
  let expected = 'speed = 1';
  for (let round = 0; round < 12; round++) {
    const inputs = [body(expected, `speed = ${round * 2 + 2}`), body(expected, `speed = ${round * 2 + 3}`)];
    const results = await Promise.all([a.client.rpc('vpylab_save_project_code', inputs[0]), b.client.rpc('vpylab_save_project_code', inputs[1])]);
    const winner = results.findIndex(result => !result.error), loser = 1 - winner;
    assert(winner >= 0, '둘 다 실패했습니다: ' + JSON.stringify(results.map(result => result.error)));
    assert.equal(results[loser].error?.code, 'PT409');
    assert.equal(results[loser].error?.message, 'saved_code_conflict');
    assert.equal((await current()).code, inputs[winner].p_code);
    assert.equal(await count(), round + 1);
    const winnerClient = winner === 0 ? a.client : b.client;
    const repeated = unwrap(await winnerClient.rpc('vpylab_save_project_code', inputs[winner]));
    assert.equal(repeated.revision.id, results[winner].data.revision.id);
    assert.equal(await count(), round + 1);
    expected = inputs[winner].p_code;
    checked(`동일 줄 동시 저장 ${round + 1}: 한 요청만 반영, 다른 편집본은 충돌, 재전송 이력 중복 없음`);
  }
  const beforeInvalid = await count();
  const invalid = await a.client.rpc('vpylab_save_project_code', { ...body(expected, 'invalid-change'), p_source: 'invalid' });
  assert.equal(invalid.error?.code, 'PT400');
  assert.equal((await current()).code, expected); assert.equal(await count(), beforeInvalid);
  checked('잘못된 저장 종류는 본문과 이력을 바꾸지 않음');
  for (const payload of [{ code: 'legacy-overwrite' }, { project_id: null, code: 'detach-overwrite' }, { id: randomUUID() }]) {
    const result = await a.client.from('vpylab_saved_code').update(payload).eq('id', row.id);
    assert.equal(result.error?.code, 'PT409'); assert.equal((await current()).code, expected);
  }
  checked('이전 REST·projectId 분리·행 ID 교체로 공동 저장 보호를 우회할 수 없음');
  const denied = await outsider.client.rpc('vpylab_save_project_code', body(expected, 'outsider'));
  assert.equal(denied.error?.code, '42501');
  unwrap(await a.client.from('vpylab_project_members').update({ role: 'viewer' }).eq('project_id', project.id).eq('user_id', b.id));
  const viewer = await b.client.rpc('vpylab_save_project_code', body(expected, 'viewer'));
  assert.equal(viewer.error?.code, '42501');
  assert.equal((await current()).code, expected);
  checked('비멤버·읽기 전용 멤버가 RPC로도 본문을 바꿀 수 없음');
  const anon = createClient(config.SUPABASE_URL, pub.VITE_SUPABASE_ANON_KEY, options);
  assert((await anon.rpc('vpylab_save_project_code', body(expected, 'anonymous'))).error);
  checked('비로그인 호출은 RPC 실행 거부');
  unwrap(await a.client.from('vpylab_saved_code').update({ github_last_pushed_at: new Date().toISOString() }).eq('id', row.id));
  const restored = unwrap(await a.client.rpc('vpylab_save_project_code', { ...body(expected, 'speed = 1'), p_source: 'restore' }));
  assert.equal(restored.revision.source, 'restore'); assert.equal((await current()).code, 'speed = 1');
  checked('GitHub 표시 시각 변경 후에도 복원 본문과 이력을 함께 저장');
  const original = body('speed = 1', 'speed = 8');
  const initial = unwrap(await a.client.rpc('vpylab_save_project_code', original));
  unwrap(await a.client.rpc('vpylab_save_project_code', body('speed = 8', 'speed = 9')));
  const late = unwrap(await a.client.rpc('vpylab_save_project_code', original));
  assert(late.superseded); assert.equal(late.latest_code, 'speed = 9'); assert.equal(late.revision.id, initial.revision.id);
  assert.equal((await current()).code, 'speed = 9');
  checked('응답 유실 후 제3의 저장이 있어도 재전송은 최신 코드를 덮어쓰지 않고 알려줌');
  unwrap(await a.client.from('vpylab_projects').delete().eq('id', project.id));
  assert.equal((await current()).project_id, null);
  checked('정상 프로젝트 삭제의 FK 해제는 보호 트리거가 막지 않음');
  report.status = 'passed';
} catch (error) {
  report.status = 'failed'; report.error = error.message; process.exitCode = 1;
  console.error('검증 실패: ' + error.message);
} finally {
  for (const id of users.reverse()) {
    const { error } = await admin.auth.admin.deleteUser(id);
    report.cleanup.push({ fixture: 'synthetic-user', status: error ? 'failed' : 'removed' });
    if (error) process.exitCode = 1;
  }
  const directory = join(root, 'docs/collaboration'); await mkdir(directory, { recursive: true });
  await writeFile(join(directory, runId + '.json'), JSON.stringify(report, null, 2) + '\n');
  console.log('검증 기록: ' + join(directory, runId + '.json'));
}

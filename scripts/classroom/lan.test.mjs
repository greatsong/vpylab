import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { downloadPackages, parseArgs } from './lan.mjs';
import { PYODIDE_LOCK_FILE, pyodidePackageDir, resolvePackageClosure, rewriteLockFile } from '../../client/scripts/pyodide-assets.mjs';

const lock = JSON.parse(readFileSync(join(pyodidePackageDir(), PYODIDE_LOCK_FILE), 'utf8'));

test('옵션은 기본 포트 4077과 패키지 목록을 해석한다', () => {
  assert.deepEqual(parseArgs([]), { port: 4077, host: '0.0.0.0', packages: [], skipBuild: false, buildOnly: false, qr: true });
  assert.deepEqual(parseArgs(['--port', '4090', '--packages', 'numpy, matplotlib', '--skip-build', '--no-qr']).packages, ['numpy', 'matplotlib']);
  assert.throws(() => parseArgs(['--port', '80']), /1024~65535/);
  assert.throws(() => parseArgs(['--what']), /알 수 없는 옵션/);
});

test('패키지 닫힌 집합은 의존 패키지와 micropip을 포함하고 lock 경로를 로컬로 남긴다', () => {
  const closure = resolvePackageClosure(lock, ['matplotlib']);
  for (const key of ['matplotlib', 'numpy', 'micropip', 'packaging', 'matplotlib-pyodide']) assert.ok(closure.has(key), key);
  const rewritten = rewriteLockFile(lock, { bundledPackages: closure });
  assert.equal(rewritten.packages.numpy.file_name, lock.packages.numpy.file_name);
  assert.match(rewritten.packages.scipy.file_name, /^https:\/\/cdn\.jsdelivr\.net\/pyodide\/v0\.27\.0\/full\//);
  assert.throws(() => resolvePackageClosure(lock, ['no-such-package']), /lock 파일에 없는 패키지/);
});

test('휠은 sha256을 검증하며 받고 이미 있는 파일은 다시 받지 않는다', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'vpylab-wheels-'));
  try {
    const tiny = { packages: { micropip: { name: 'micropip', file_name: 'micropip-test.whl', sha256: createHash('sha256').update('wheel').digest('hex'), depends: [], imports: ['micropip'] } } };
    let calls = 0;
    const fetchImpl = async () => { calls += 1; return { ok: true, arrayBuffer: async () => new TextEncoder().encode('wheel').buffer }; };
    const first = await downloadPackages([], { lock: tiny, cacheDir: dir, fetchImpl, log: () => {} });
    assert.equal(first.files.get('micropip'), join(dir, 'micropip-test.whl'));
    assert.equal(calls, 1);
    await downloadPackages([], { lock: tiny, cacheDir: dir, fetchImpl, log: () => {} });
    assert.equal(calls, 1);
    const corrupted = { packages: { micropip: { ...tiny.packages.micropip, sha256: 'ff'.repeat(32) } } };
    await assert.rejects(downloadPackages([], { lock: corrupted, cacheDir: dir, fetchImpl, log: () => {} }), /sha256 불일치/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

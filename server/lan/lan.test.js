import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createLanApp, lanAddresses, startLanServer } from './index.js';

function fakeDist() {
  const dir = mkdtempSync(join(tmpdir(), 'vpylab-lan-'));
  mkdirSync(join(dir, 'assets')); mkdirSync(join(dir, 'pyodide/v0.27.0'), { recursive: true });
  writeFileSync(join(dir, 'index.html'), '<!doctype html><title>VPyLab</title><div id="root"></div>');
  writeFileSync(join(dir, 'assets/app-abc12345.js'), 'console.log(1)');
  writeFileSync(join(dir, 'pyodide/v0.27.0/pyodide.js'), '// pyodide');
  writeFileSync(join(dir, 'pyodide/v0.27.0/pyodide.asm.wasm'), Buffer.from([0, 0x61, 0x73, 0x6d]));
  return dir;
}

test('빌드 산출물이 없으면 안내 메시지로 멈춘다', () => {
  assert.throws(() => createLanApp({ distDir: join(tmpdir(), 'no-such-dist') }), /npm run classroom:lan/);
});

test('앱 셸·해시 산출물·Pyodide 파일을 제공하고 API는 교실 모드 안내로 답한다', async (t) => {
  const dist = fakeDist();
  const runtime = await startLanServer({ distDir: dist, port: 0, host: '127.0.0.1' });
  t.after(async () => { await runtime.close(); rmSync(dist, { recursive: true, force: true }); });
  const origin = `http://127.0.0.1:${runtime.port}`;

  const shell = await fetch(`${origin}/mission/CT-1`);
  assert.equal(shell.status, 200);
  assert.match(shell.headers.get('content-type'), /text\/html/);
  assert.equal(shell.headers.get('cache-control'), 'no-cache, no-store, must-revalidate');
  assert.match(await shell.text(), /id="root"/);
  const csp = shell.headers.get('content-security-policy');
  assert.match(csp, /script-src 'self' 'unsafe-eval' 'wasm-unsafe-eval' blob:/);
  assert.match(csp, /worker-src 'self' blob:/);
  assert.equal(shell.headers.get('strict-transport-security'), null);

  const asset = await fetch(`${origin}/assets/app-abc12345.js`);
  assert.equal(asset.status, 200);
  assert.match(asset.headers.get('cache-control'), /max-age=31536000, immutable/);

  const wasm = await fetch(`${origin}/pyodide/v0.27.0/pyodide.asm.wasm`);
  assert.equal(wasm.status, 200);
  assert.match(wasm.headers.get('content-type'), /application\/wasm/);
  assert.match(wasm.headers.get('cache-control'), /immutable/);
  // 없는 Pyodide 파일은 앱 셸이 아니라 404여야 Worker가 CDN으로 넘어갑니다.
  assert.equal((await fetch(`${origin}/pyodide/v0.27.0/missing.whl`)).status, 404);

  const api = await fetch(`${origin}/api/share`, { method: 'POST' });
  assert.equal(api.status, 503);
  assert.equal((await api.json()).code, 'lan_mode_unavailable');
});

test('LAN 주소 목록은 내부 주소를 빼고 사설 주소를 앞에 둔다', () => {
  for (const { address } of lanAddresses()) {
    assert.notEqual(address, '127.0.0.1');
    assert.match(address, /^\d+\.\d+\.\d+\.\d+$/);
  }
});

#!/usr/bin/env node
/**
 * 브라우저(실제 실행 경로) 호환성 하네스.
 *
 * Playwright 로 개발 서버의 /sandbox 를 열고, 코퍼스의 코드를 Monaco 에디터에 넣고 실행 버튼을 눌러
 * Worker 메시지(batch/stdout/stderr/error/done)·브릿지 경고·3D 씬의 메시 수·실행 시간 초과를 기록한다.
 * 앱 코드는 바꾸지 않고, Worker 생성자를 가로채 메시지를 엿본다.
 *
 * 사용법:
 *   node scripts/compat/browser-harness.mjs [--url http://127.0.0.1:4095] [--port 4095] [--filter idiom:] [--limit 20]
 *                                            [--run-timeout 6000] [--headed] [--out scripts/compat/out/browser-results.json]
 *   --url 이 없으면 client 개발 서버를 --port 로 직접 띄우고 끝나면 내린다.
 * 사전 준비: npm --prefix scripts/compat install && npx --prefix scripts/compat playwright install chromium
 */
import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

function parseArgs(argv) {
  const args = { port: 4095, filter: '', limit: 0, runTimeout: 6000, headed: false, url: '', out: path.join(here, 'out/browser-results.json') };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === '--url') args.url = next();
    else if (a === '--port') args.port = Number(next());
    else if (a === '--filter') args.filter = next();
    else if (a === '--limit') args.limit = Number(next());
    else if (a === '--run-timeout') args.runTimeout = Number(next());
    else if (a === '--headed') args.headed = true;
    else if (a === '--out') args.out = path.resolve(next());
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 개발 서버를 띄우고 준비될 때까지 기다린다 */
async function startDevServer(port) {
  const child = spawn('npm', ['run', 'dev', '--', '--port', String(port), '--strictPort', '--host', '127.0.0.1'], {
    cwd: path.join(root, 'client'), stdio: ['ignore', 'pipe', 'pipe'], detached: true, env: { ...process.env, BROWSER: 'none' },
  });
  let output = '';
  const ready = new Promise((resolve, reject) => {
    const onData = (buf) => {
      output += buf.toString();
      if (/Local:\s+http/.test(output) || output.includes(`:${port}/`)) resolve();
      if (/Port \d+ is already in use|EADDRINUSE/.test(output)) reject(new Error(`포트 ${port} 사용 중`));
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('exit', (code) => reject(new Error(`개발 서버 종료 (code ${code})\n${output.slice(-500)}`)));
    setTimeout(() => reject(new Error(`개발 서버가 60초 안에 뜨지 않음\n${output.slice(-500)}`)), 60_000);
  });
  await ready;
  return {
    url: `http://127.0.0.1:${port}`,
    stop() { try { process.kill(-child.pid, 'SIGTERM'); } catch { /* 이미 종료 */ } },
  };
}

/** 페이지 로드 전에 Worker 를 가로채 메시지를 window.__compat.log 에 쌓는다 */
const INIT_SCRIPT = `(() => {
  const log = [];
  window.__compat = { log, workers: 0 };
  const Orig = window.Worker;
  window.Worker = class extends Orig {
    constructor(...a) {
      super(...a);
      window.__compat.workers += 1;
      this.addEventListener('message', (e) => {
        let d = e.data;
        if (typeof d === 'string') { try { d = JSON.parse(d); } catch { return; } }
        if (!d || typeof d !== 'object' || !d.type) return;
        const entry = { t: performance.now(), type: d.type, runId: d.runId ?? null };
        if (d.type === 'batch') {
          const cmds = d.commands || [];
          entry.n = cmds.length;
          entry.creates = cmds.filter((c) => c.action === 'create').map((c) => c.type);
          entry.actions = cmds.map((c) => c.action);
        } else if (d.type === 'stdout' || d.type === 'stderr') {
          entry.text = String(d.text ?? '').slice(0, 2000);
        } else if (d.type === 'error') {
          entry.error = d.error; entry.raw = String(d.raw ?? '').slice(0, 3000); entry.details = d.details ?? d.explain ?? null;
        } else if (d.type === 'done') {
          entry.stopped = !!d.stopped;
        }
        log.push(entry);
      });
    }
  };
})();`;

/** 페이지 안에서 Monaco 에디터 내용을 바꾼다 — 사전 번들된 monaco 모듈 → React fiber 순으로 시도 */
const SET_CODE_FN = `async (code) => {
  const tryMonaco = async () => {
    const urls = performance.getEntriesByType('resource').map((e) => e.name).filter((n) => /\\/deps\\/monaco-editor(\\.js|_)/.test(n));
    for (const u of urls) {
      try {
        const m = await import(u);
        const api = m.editor ? m : (m.default && m.default.editor ? m.default : null);
        if (api && api.editor && api.editor.getEditors) {
          const ed = api.editor.getEditors()[0];
          if (ed) { ed.setValue(code); return 'monaco'; }
        }
      } catch { /* 다음 후보 */ }
    }
    return null;
  };
  const tryFiber = () => {
    const el = document.querySelector('.monaco-editor');
    if (!el) return null;
    const key = Object.keys(el).find((k) => k.startsWith('__reactFiber$'));
    let fiber = el[key];
    const seen = new Set();
    while (fiber) {
      let hook = fiber.memoizedState;
      while (hook && typeof hook === 'object') {
        const s = hook.memoizedState;
        if (s && typeof s === 'object' && s.current && typeof s.current.setValue === 'function' && typeof s.current.getModel === 'function') {
          s.current.setValue(code); return 'fiber';
        }
        if (seen.has(hook)) break;
        seen.add(hook);
        hook = hook.next;
      }
      fiber = fiber.return;
    }
    return null;
  };
  return (await tryMonaco()) || tryFiber();
}`;

/** React fiber 를 거슬러 올라가 THREE.Scene 을 찾아 메시 수를 센다 */
const COUNT_MESHES_FN = `() => {
  const canvas = document.querySelector('canvas');
  if (!canvas) return { found: false, meshes: 0 };
  // 렌더러 캔버스는 React 가 만든 요소가 아니므로 fiber 가 달린 가장 가까운 조상에서 시작
  let el = canvas;
  let key = null;
  while (el && !key) {
    key = Object.keys(el).find((k) => k.startsWith('__reactFiber$')) || null;
    if (!key) el = el.parentElement;
  }
  if (!el) return { found: false, meshes: 0 };
  let fiber = el[key];
  let scene = null;
  while (fiber && !scene) {
    const props = fiber.memoizedProps;
    if (props && props.sceneRef && props.sceneRef.current && props.sceneRef.current.isScene) { scene = props.sceneRef.current; break; }
    let hook = fiber.memoizedState;
    let guard = 0;
    while (hook && typeof hook === 'object' && guard++ < 200) {
      const s = hook.memoizedState;
      if (s && typeof s === 'object' && s.current && s.current.isScene) { scene = s.current; break; }
      hook = hook.next;
    }
    fiber = fiber.return;
  }
  if (!scene) return { found: false, meshes: 0 };
  let meshes = 0; let lights = 0; let sprites = 0; let lines = 0;
  scene.traverse((o) => {
    if (o.isSprite) sprites += 1;
    else if (o.isMesh) meshes += 1;
    else if (o.isLine || o.isLineSegments || o.isPoints) lines += 1;
    else if (o.isLight) lights += 1;
  });
  return { found: true, meshes, sprites, lines, lights };
}`;

const CONSOLE_LINES_FN = `() => Array.from(document.querySelectorAll('.animate-slide-up')).map((el) => el.textContent.trim()).slice(-40)`;

// 학생 코드는 실행마다 새 전역(_vpylab_run의 네임스페이스)에서 돌므로 전역 스냅샷·정리는 필요 없다.
// 항목 사이에 짧은 프로그램을 한 번 돌려 Worker 가 응답하는지만 확인한다.
const SNAPSHOT_CODE = `print('[compat] ready')
`;
const RESET_CODE = `pass
`;
const DRAW_CALL = /\b(sphere|box|cylinder|arrow|cone|ring|helix|pyramid|ellipsoid|label|text|curve|points|compound|extrusion|local_light|distant_light|graph|gcurve|gdots|gvbars|ghbars|slider|button|checkbox|radio|menu|winput|triangle|quad)\s*\(/;

async function logSince(page, mark) {
  return page.evaluate((m) => window.__compat.log.slice(m), mark);
}

async function waitForMessage(page, mark, types, timeoutMs) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const entries = await logSince(page, mark);
    const hit = entries.find((e) => types.includes(e.type));
    if (hit) return hit;
    await sleep(100);
  }
  return null;
}

/** 코드 하나를 실행하고 관측값을 돌려준다 */
async function runProgram(page, code, runTimeout, consoleSink) {
  const mark = await page.evaluate(() => window.__compat.log.length);
  consoleSink.length = 0;
  const how = await page.evaluate(`(${SET_CODE_FN})(${JSON.stringify(code)})`);
  if (!how) throw new Error('에디터에 코드를 넣지 못했습니다 (monaco/fiber 모두 실패)');
  await sleep(60);
  const runBtn = page.locator('.toolbar-btn.--run');
  await runBtn.waitFor({ state: 'visible', timeout: 10_000 });
  if (await runBtn.isDisabled()) {
    // 이전 실행이 아직 끝나지 않은 경우 — 정지 후 대기
    await page.locator('.toolbar-btn.--stop').click().catch(() => {});
    await waitForMessage(page, mark, ['done', 'ready'], 15_000);
  }
  const started = Date.now();
  await runBtn.click();
  let final = await waitForMessage(page, mark, ['done', 'error'], runTimeout);
  let status = 'pass';
  let hardStopped = false;
  if (!final) {
    // 시간 안에 끝나지 않음 → 정지 버튼 (rate 가 있으면 soft stop, 없으면 10초 무응답 뒤 Worker 재시작)
    await page.locator('.toolbar-btn.--stop').click().catch(() => {});
    final = await waitForMessage(page, mark, ['done', 'error'], 4_000);
    if (final) status = final.type === 'error' ? 'error' : 'stopped';
    else {
      const restarted = await waitForMessage(page, mark, ['ready'], 90_000);
      hardStopped = true;
      status = restarted ? 'hang' : 'lost';
    }
  } else if (final.type === 'error') {
    status = 'error';
  } else if (final.stopped) {
    status = 'stopped';
  }
  await sleep(150);
  const entries = await logSince(page, mark);
  const batches = entries.filter((e) => e.type === 'batch');
  const createTypes = {};
  const actions = {};
  let total = 0;
  for (const b of batches) {
    total += b.n;
    for (const t of b.creates) createTypes[t] = (createTypes[t] || 0) + 1;
    for (const a of b.actions) actions[a] = (actions[a] || 0) + 1;
  }
  const err = entries.find((e) => e.type === 'error');
  const stdout = entries.filter((e) => e.type === 'stdout').map((e) => e.text).join('\n').slice(-2000);
  const stderr = entries.filter((e) => e.type === 'stderr').map((e) => e.text).join('\n').slice(-2000);
  const scene = await page.evaluate(`(${COUNT_MESHES_FN})()`).catch(() => ({ found: false, meshes: 0 }));
  const consoleLines = await page.evaluate(`(${CONSOLE_LINES_FN})()`).catch(() => []);
  const timeoutLine = consoleLines.find((l) => l.includes('실행 시간 초과'));
  if (timeoutLine && status === 'pass') status = 'activity-timeout';
  return {
    status, hardStopped, elapsed: Date.now() - started, error: err ? { message: err.error, raw: err.raw, details: err.details } : null,
    commands: { total, createTypes, actions }, scene, stdout, stderr, consoleLines,
    pageConsole: consoleSink.slice(0, 20), setCodeVia: how,
  };
}

async function main() {
  const corpus = JSON.parse(await readFile(path.join(here, 'corpus/corpus.json'), 'utf8'));
  let items = corpus.filter((it) => it.id.includes(args.filter));
  if (args.limit) items = items.slice(0, args.limit);

  const server = args.url ? null : await startDevServer(args.port);
  const base = args.url || server.url;
  console.log(`브라우저 하네스: ${items.length}개 실행 @ ${base}/sandbox`);

  const browser = await chromium.launch({
    headless: !args.headed,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  await context.addInitScript(INIT_SCRIPT);
  const page = await context.newPage();
  const consoleSink = [];
  page.on('console', (msg) => {
    if (['warning', 'error'].includes(msg.type())) consoleSink.push(`[${msg.type()}] ${msg.text().slice(0, 300)}`);
  });
  page.on('pageerror', (e) => consoleSink.push(`[pageerror] ${String(e).slice(0, 300)}`));

  const results = [];
  const meta = { generatedAt: new Date().toISOString(), base, count: items.length, summary: {} };
  try {
    await page.goto(`${base}/sandbox`, { waitUntil: 'domcontentloaded' });
    const ready = await waitForMessage(page, 0, ['ready'], 120_000);
    if (!ready) throw new Error('Pyodide 가 120초 안에 준비되지 않음');
    await page.locator('.toolbar-btn.--run').waitFor({ state: 'visible', timeout: 30_000 });
    await sleep(500);
    const baseline = await page.evaluate(`(${COUNT_MESHES_FN})()`).catch(() => ({ found: false, meshes: 0 }));
    console.log('씬 접근:', baseline.found ? `가능 (기본 메시 ${baseline.meshes})` : '불가 — 커맨드 수로 대신 판정');
    meta.baselineMeshes = baseline.meshes || 0;
    meta.sceneAccessible = !!baseline.found;

    let snap = await runProgram(page, SNAPSHOT_CODE, 10_000, consoleSink);
    console.log('전역 스냅샷:', snap.status, snap.stdout.trim());

    for (let i = 0; i < items.length; i += 1) {
      const it = items[i];
      let r;
      try {
        r = await runProgram(page, it.code, args.runTimeout, consoleSink);
      } catch (e) {
        r = { status: 'harness', error: { message: String(e) }, commands: { total: 0, createTypes: {}, actions: {} }, scene: { found: false, meshes: 0 }, stdout: '', stderr: '', consoleLines: [], pageConsole: [] };
      }
      const meshes = r.scene.found ? Math.max(0, r.scene.meshes - meta.baselineMeshes) : null;
      let status = r.status;
      if (status === 'pass' && r.commands.total === 0 && DRAW_CALL.test(it.code) && !r.stdout.trim()) status = 'silent';
      const bridgeWarnings = r.pageConsole.filter((l) => l.includes('[Bridge]') || l.includes('[widget') || l.includes('[graph') || l.includes('[series'));
      results.push({
        id: it.id, source: it.source, kind: it.kind, title: it.title, origin: it.origin, progress: !!it.progress,
        status, error: r.error, meshes, sceneCounts: r.scene, commands: r.commands, stdout: r.stdout, stderr: r.stderr,
        bridgeWarnings, pageConsole: r.pageConsole, consoleLines: r.consoleLines, elapsed: r.elapsed, hardStopped: !!r.hardStopped,
      });
      meta.summary[status] = (meta.summary[status] || 0) + 1;
      const mark = status === 'pass' || status === 'stopped' ? '✓' : '✗';
      console.log(`  [${i + 1}/${items.length}] ${mark} ${it.id} — ${status}${r.error ? ' ' + String(r.error.message).slice(0, 90) : ''}${meshes != null ? ` (mesh ${meshes})` : ''}`);

      // 전역 정리 — Worker 가 재시작됐으면 스냅샷부터 다시
      if (r.hardStopped) {
        snap = await runProgram(page, SNAPSHOT_CODE, 10_000, consoleSink);
      } else {
        const reset = await runProgram(page, RESET_CODE, 10_000, consoleSink);
        if (reset.status !== 'pass') console.log('    (전역 정리 실패:', reset.status, reset.error?.message, ')');
      }
      if ((i + 1) % 10 === 0) await writeFile(args.out, JSON.stringify({ ...meta, partial: true, results }, null, 1));
    }
  } finally {
    await mkdir(path.dirname(args.out), { recursive: true });
    await writeFile(args.out, JSON.stringify({ ...meta, results }, null, 1));
    await browser.close();
    server?.stop();
  }
  console.log('요약:', JSON.stringify(meta.summary));
  console.log(`→ ${path.relative(root, args.out)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

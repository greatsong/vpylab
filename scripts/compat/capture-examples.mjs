#!/usr/bin/env node
/**
 * GlowScript 공식 예제를 /sandbox 에서 실행해 3D 화면을 PNG 로 저장한다 (PR 첨부·육안 확인용).
 *
 * 사용법:
 *   node scripts/compat/capture-examples.mjs --url http://127.0.0.1:4033 [--names Conch,Car] [--wait 6000]
 *                                             [--out docs/screenshots/glowscript-compat] [--headed]
 * 사전 준비: npm --prefix scripts/compat install && npx --prefix scripts/compat playwright install chromium
 * 코드는 corpus/glowscript-examples.json 에서 제목으로 찾는다.
 */
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

function parseArgs(argv) {
  const args = {
    url: 'http://127.0.0.1:4033', names: 'Conch,Stonehenge,Car,RotatingCurve,ScrollingText',
    wait: 6000, out: path.join(root, 'docs/screenshots/glowscript-compat'), headed: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === '--url') args.url = next();
    else if (a === '--names') args.names = next();
    else if (a === '--wait') args.wait = Number(next());
    else if (a === '--out') args.out = path.resolve(next());
    else if (a === '--headed') args.headed = true;
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 페이지 안에서 Monaco 에디터 내용을 바꾼다 (browser-harness.mjs 와 같은 방법) */
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

// Worker 메시지를 엿봐 ready/done/error 를 기록한다
const INIT_SCRIPT = `
(() => {
  window.__cap = { log: [] };
  const Orig = window.Worker;
  window.Worker = function (...a) {
    const w = new Orig(...a);
    w.addEventListener('message', (ev) => {
      const d = ev.data || {};
      if (['ready', 'done', 'error', 'stdout', 'stderr'].includes(d.type)) {
        window.__cap.log.push({ type: d.type, text: d.text || d.error || d.message || '' });
      }
    });
    return w;
  };
  window.Worker.prototype = Orig.prototype;
})();`;

async function waitFor(page, mark, types, timeoutMs) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const hit = await page.evaluate(([m, t]) => window.__cap.log.slice(m).find((e) => t.includes(e.type)) || null, [mark, types]);
    if (hit) return hit;
    await sleep(100);
  }
  return null;
}

async function main() {
  const examples = JSON.parse(await readFile(path.join(here, 'corpus/glowscript-examples.json'), 'utf8'));
  const items = Array.isArray(examples) ? examples : (examples.items || []);
  const wanted = args.names.split(',').map((s) => s.trim()).filter(Boolean);
  await mkdir(args.out, { recursive: true });

  const browser = await chromium.launch({
    headless: !args.headed,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 1 });
  await context.addInitScript(INIT_SCRIPT);
  const page = await context.newPage();
  const consoleSink = [];
  page.on('console', (msg) => {
    if (['warning', 'error'].includes(msg.type())) consoleSink.push(`[${msg.type()}] ${msg.text().slice(0, 300)}`);
  });

  const report = [];
  try {
    await page.goto(`${args.url}/sandbox`, { waitUntil: 'domcontentloaded' });
    const ready = await waitFor(page, 0, ['ready'], 180_000);
    if (!ready) throw new Error('Pyodide 가 180초 안에 준비되지 않음');
    await page.locator('.toolbar-btn.--run').waitFor({ state: 'visible', timeout: 30_000 });
    await sleep(500);

    for (const name of wanted) {
      const item = items.find((it) => (it.title || it.id || '').includes(name));
      if (!item) { console.log(`[건너뜀] ${name}: 코퍼스에 없음`); continue; }
      consoleSink.length = 0;
      const mark = await page.evaluate(() => window.__cap.log.length);
      const how = await page.evaluate(`(${SET_CODE_FN})(${JSON.stringify(item.code)})`);
      if (!how) throw new Error('에디터에 코드를 넣지 못했습니다');
      await sleep(80);
      const runBtn = page.locator('.toolbar-btn.--run');
      if (await runBtn.isDisabled()) {
        await page.locator('.toolbar-btn.--stop').click().catch(() => {});
        await waitFor(page, mark, ['done', 'ready'], 15_000);
      }
      await runBtn.click();
      const finished = await waitFor(page, mark, ['done', 'error'], args.wait);
      await sleep(finished ? 800 : 300);
      const file = path.join(args.out, `${name}.png`);
      const viewport = page.locator('[data-vpylab-viewport]');
      await viewport.screenshot({ path: file });
      // 실행 중이면 정지
      await page.locator('.toolbar-btn.--stop').click().catch(() => {});
      await waitFor(page, mark, ['done'], 5_000);
      const log = await page.evaluate((m) => window.__cap.log.slice(m), mark);
      const err = log.find((e) => e.type === 'error');
      const stdout = log.filter((e) => e.type === 'stdout').map((e) => e.text).join('').trim().slice(0, 400);
      const entry = {
        name, file: path.relative(root, file), status: err ? 'error' : (finished ? 'done' : 'running(stopped)'),
        error: err ? String(err.text).slice(0, 300) : null, stdout, console: consoleSink.slice(0, 8),
      };
      report.push(entry);
      console.log(`[${entry.status}] ${name} → ${entry.file}${err ? `\n    ${entry.error}` : ''}${stdout ? `\n    stdout: ${stdout.slice(0, 160)}` : ''}`);
      for (const line of entry.console) console.log(`    ${line}`);
    }
  } finally {
    await browser.close();
  }
  await writeFile(path.join(args.out, 'capture-report.json'), JSON.stringify(report, null, 1));
}

main().catch((e) => { console.error(e); process.exit(1); });

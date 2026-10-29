/**
 * 교실 LAN 서버 모드 — `npm run classroom:lan`
 *
 * 교사 맥북에서 앱을 빌드하고, Pyodide 핵심 파일(과 선택 패키지)을 함께 LAN IP로 제공합니다.
 * 학생은 같은 와이파이에서 http://<맥북 LAN IP>:<포트> 로 접속하며 Python은 각자 브라우저에서 실행됩니다.
 *
 * 옵션
 *   --port <번호>        기본 4077 (greatsong-project 포트 표 기준 빈 번호)
 *   --host <주소>        기본 0.0.0.0 (모든 인터페이스)
 *   --packages a,b       numpy,matplotlib 처럼 micropip 패키지를 함께 제공 (처음 한 번 인터넷 필요)
 *   --skip-build         이미 만든 client/dist-lan 을 그대로 제공
 *   --build-only         빌드와 패키지 준비만 하고 서버는 띄우지 않음
 *   --no-qr              QR 코드 출력 생략
 * 자세한 절차: docs/CLASSROOM_LAN_MODE.md
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import { PYODIDE_CDN_BASES, PYODIDE_LOCK_FILE, PYODIDE_VERSION, preparePyodideAssets, pyodidePackageDir, resolvePackageClosure } from '../../client/scripts/pyodide-assets.mjs';
import { LAN_DEFAULT_PORT, lanAddresses, startLanServer } from '../../server/lan/index.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const clientDir = resolve(root, 'client');
const distDir = resolve(clientDir, 'dist-lan');
const packageCacheDir = resolve(root, '.local/pyodide-packages', `v${PYODIDE_VERSION}`);

export function parseArgs(argv) {
  const options = { port: LAN_DEFAULT_PORT, host: '0.0.0.0', packages: [], skipBuild: false, buildOnly: false, qr: true };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => { i += 1; if (argv[i] === undefined) throw new Error(`${arg} 값이 필요합니다.`); return argv[i]; };
    if (arg === '--port') options.port = Number(next());
    else if (arg === '--host') options.host = next();
    else if (arg === '--packages') options.packages = next().split(',').map((x) => x.trim()).filter(Boolean);
    else if (arg === '--skip-build') options.skipBuild = true;
    else if (arg === '--build-only') options.buildOnly = true;
    else if (arg === '--no-qr') options.qr = false;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else throw new Error(`알 수 없는 옵션입니다: ${arg}`);
  }
  if (!Number.isSafeInteger(options.port) || options.port < 1024 || options.port > 65535) throw new Error('포트는 1024~65535 사이여야 합니다.');
  return options;
}

function ensureDependencies() {
  for (const path of ['client/node_modules/vite/bin/vite.js', 'client/node_modules/pyodide/package.json', 'server/node_modules/express/package.json', 'server/node_modules/qrcode-terminal/package.json']) {
    if (!existsSync(resolve(root, path))) throw new Error('먼저 npm --prefix client ci 및 npm --prefix server ci 를 실행해주세요.');
  }
}

function buildClient() {
  process.stdout.write('\n[1/3] 교실 모드로 앱을 빌드합니다 (외부 글꼴·로그인 제외)...\n');
  const result = spawnSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--mode', 'lan', '--outDir', 'dist-lan'], {
    cwd: clientDir, stdio: 'inherit', env: { ...process.env, VITE_LAN_MODE: '1' },
  });
  if (result.status !== 0) throw new Error('빌드에 실패했습니다.');
}

/** lock 파일의 sha256으로 검증하면서 CDN에서 휠을 받아 .local 캐시에 둡니다. */
export async function downloadPackages(names, { lock, cacheDir = packageCacheDir, fetchImpl = fetch, log = (m) => process.stdout.write(m) } = {}) {
  const closure = resolvePackageClosure(lock, names);
  mkdirSync(cacheDir, { recursive: true });
  const files = new Map();
  for (const key of closure) {
    const pkg = lock.packages[key];
    const target = join(cacheDir, pkg.file_name);
    if (!existsSync(target) || sha256(readFileSync(target)) !== pkg.sha256) {
      let lastError;
      for (const base of PYODIDE_CDN_BASES) {
        try {
          const response = await fetchImpl(base + pkg.file_name);
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const bytes = Buffer.from(await response.arrayBuffer());
          if (sha256(bytes) !== pkg.sha256) throw new Error('sha256 불일치');
          writeFileSync(target, bytes);
          lastError = null;
          break;
        } catch (error) { lastError = error; }
      }
      if (lastError) throw new Error(`${pkg.file_name} 내려받기 실패: ${lastError.message}. 인터넷 연결을 확인하거나 --packages 없이 실행해주세요.`);
      log(`  내려받음 ${pkg.file_name}\n`);
    }
    files.set(key, target);
  }
  return { closure, files };
}

function sha256(bytes) { return createHash('sha256').update(bytes).digest('hex'); }

async function bundlePackages(names) {
  const lock = JSON.parse(readFileSync(join(pyodidePackageDir(), PYODIDE_LOCK_FILE), 'utf8'));
  process.stdout.write(`\n[2/3] 패키지 ${names.join(', ')} 와 의존 패키지를 준비합니다...\n`);
  const { closure, files } = await downloadPackages(names, { lock });
  const result = preparePyodideAssets({ publicDir: distDir, bundledPackages: closure, resolvePackageFile: (key) => files.get(key) });
  process.stdout.write(`  ${closure.size}개 패키지, Pyodide 파일 합계 ${(result.bytes / 1024 / 1024).toFixed(1)}MB\n`);
}

function printAddresses(port, qr) {
  const addresses = lanAddresses();
  process.stdout.write('\n[3/3] 교실 서버를 시작했습니다.\n\n');
  if (addresses.length === 0) process.stdout.write('  와이파이 연결을 확인해주세요. 지금은 이 맥북에서만 http://localhost 로 열 수 있습니다.\n');
  for (const { name, address } of addresses) process.stdout.write(`  학생 접속 주소: http://${address}:${port}   (${name})\n`);
  process.stdout.write(`  교사 확인 주소: http://localhost:${port}\n`);
  if (qr && addresses.length > 0) {
    const require = createRequire(resolve(root, 'server/package.json'));
    const qrcode = require('qrcode-terminal');
    process.stdout.write('\n');
    qrcode.generate(`http://${addresses[0].address}:${port}`, { small: true }, (code) => process.stdout.write(`${code}\n`));
  }
  process.stdout.write('\n종료: Ctrl+C. 로그인·갤러리·GitHub 저장은 교실 모드에서 쓸 수 없습니다(docs/CLASSROOM_LAN_MODE.md).\n\n');
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) { process.stdout.write(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('*/')[0].replace(/^\/\*\*\n/, '').replace(/^ \* ?/gm, '')); return; }
  ensureDependencies();
  if (!options.skipBuild) buildClient();
  else if (!existsSync(join(distDir, 'index.html'))) throw new Error('client/dist-lan 이 없습니다. --skip-build 없이 실행해주세요.');
  if (options.packages.length > 0) await bundlePackages(options.packages);
  else process.stdout.write('\n[2/3] 선택 패키지 없음 (numpy 등은 인터넷이 있을 때만 CDN에서 받습니다. --packages numpy,matplotlib 로 함께 제공 가능)\n');
  if (options.buildOnly) { process.stdout.write(`\n빌드만 마쳤습니다: ${distDir}\n`); return; }
  const runtime = await startLanServer({ distDir, port: options.port, host: options.host });
  printAddresses(runtime.port, options.qr);
  const stop = () => runtime.close().then(() => process.exit(0));
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { process.stderr.write(`\n${error.message}\n`); process.exit(1); });
}

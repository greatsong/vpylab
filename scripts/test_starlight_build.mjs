// 에듀플로 starlightGenerator를 직접 호출해 vpylab-beg-shapes 1건만 빌드.
// generateStarlightProject는 .starlight-build/ 소스 트리만 만든다.
// node_modules 준비 + astro build는 deployment.js의 _buildStarlight 흐름을 모사한다.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: 'inherit', ...opts });
    p.on('error', reject);
    p.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`${cmd} exit ${code}`)));
  });
}
import { cp, mkdir, readFile, rm, writeFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { generateStarlightProject } from '/Users/greatsong/greatsong-project/eduflow-deploy/server/services/starlightGenerator.js';

const PROJECT_PATH = '/Users/greatsong/greatsong-project/eduflow-deploy/projects/vpylab-beg-shapes';
const CACHE_NM = '/Users/greatsong/greatsong-project/eduflow-deploy/server/services/starlight-cache/node_modules';

const t0 = Date.now();
console.log('[1/4] generateStarlightProject 호출…');
const res = await generateStarlightProject({
  projectPath: PROJECT_PATH,
  siteName: '도형 친구들 만나기',
  creator: '석리송',
  colorTheme: 'sky',
  basePath: '/',
});
console.log('  buildDir:', res.buildDir);
console.log('  chapterCount:', res.chapterCount, ' imageCount:', res.imageCount);

// astro.config.mjs placeholder 치환 (siteUrl 없으면 site 라인 제거)
const cfgPath = join(res.buildDir, 'astro.config.mjs');
let cfg = await readFile(cfgPath, 'utf-8');
cfg = cfg.replace(/^\s*site:\s*'__SITE__',?\s*\n/m, '');
cfg = cfg.replaceAll('__BASE__', '/');
await writeFile(cfgPath, cfg, 'utf-8');

console.log('[2/4] 공용 node_modules 복사…');
const nm = join(res.buildDir, 'node_modules');
if (!existsSync(CACHE_NM)) throw new Error('캐시 node_modules 없음: ' + CACHE_NM);
// macOS cp -r/-R 은 명령행 인자가 심볼릭 링크일 때 따라간다.
// .bin/* 의 심볼릭 링크가 일반 파일로 복사되어 npx astro 실행 실패. -P로 보존.
await mkdir(nm, { recursive: true });
await run('cp', ['-RP', CACHE_NM + '/.', nm + '/']);

console.log('[3/4] astro build…');
await run('npx', ['astro', 'build'], { cwd: res.buildDir, shell: true });

const dist = join(res.buildDir, 'dist');
if (!existsSync(dist)) throw new Error('dist/ 없음');

const sitePath = join(PROJECT_PATH, 'site');
console.log('[4/4] dist → site/ 교체…');
await rm(sitePath, { recursive: true, force: true });
await cp(dist, sitePath, { recursive: true });
await writeFile(join(sitePath, '.nojekyll'), '', 'utf-8');

// 빌드 디렉토리 정리 (선택)
await rm(res.buildDir, { recursive: true, force: true });

console.log(`\n완료 (${((Date.now()-t0)/1000).toFixed(1)}s) → ${sitePath}`);

// 7개 vpylab-* 프로젝트를 일괄 Starlight 빌드.
// 각 프로젝트의 config.json에서 deployment.colorTheme 자동 추출.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { cp, mkdir, readFile, rm, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { generateStarlightProject } from '/Users/greatsong/greatsong-project/eduflow-deploy/server/services/starlightGenerator.js';

const PROJECTS_ROOT = '/Users/greatsong/greatsong-project/eduflow-deploy/projects';
const CACHE_NM = '/Users/greatsong/greatsong-project/eduflow-deploy/server/services/starlight-cache/node_modules';

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: 'inherit', ...opts });
    p.on('error', reject);
    p.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`${cmd} exit ${code}`)));
  });
}

async function buildOne(projectId) {
  const t0 = Date.now();
  const projectPath = join(PROJECTS_ROOT, projectId);
  const cfg = JSON.parse(await readFile(join(projectPath, 'config.json'), 'utf-8'));
  const title = cfg.title || projectId;
  const author = cfg.author || '석리송';
  const colorTheme = cfg.deployment?.colorTheme || 'sky';

  console.log(`\n══ ${projectId} (${colorTheme}) ══`);
  const res = await generateStarlightProject({
    projectPath,
    siteName: title,
    creator: author,
    colorTheme,
    basePath: '/',
  });
  console.log(`  ${res.chapterCount}챕터 / ${res.imageCount}이미지`);

  const cfgPath = join(res.buildDir, 'astro.config.mjs');
  let astroCfg = await readFile(cfgPath, 'utf-8');
  astroCfg = astroCfg.replace(/^\s*site:\s*'__SITE__',?\s*\n/m, '');
  astroCfg = astroCfg.replaceAll('__BASE__', '/');
  await writeFile(cfgPath, astroCfg, 'utf-8');

  const nm = join(res.buildDir, 'node_modules');
  if (!existsSync(CACHE_NM)) throw new Error('캐시 node_modules 없음');
  await mkdir(nm, { recursive: true });
  await run('cp', ['-RP', CACHE_NM + '/.', nm + '/']);

  await run('npx', ['astro', 'build'], { cwd: res.buildDir, shell: true });

  const dist = join(res.buildDir, 'dist');
  if (!existsSync(dist)) throw new Error('dist/ 없음');
  const sitePath = join(projectPath, 'site');
  await rm(sitePath, { recursive: true, force: true });
  await cp(dist, sitePath, { recursive: true });
  await writeFile(join(sitePath, '.nojekyll'), '', 'utf-8');
  await rm(res.buildDir, { recursive: true, force: true });

  const dt = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`  ✓ ${dt}s → ${sitePath}`);
  return { projectId, seconds: parseFloat(dt) };
}

const allDirs = (await readdir(PROJECTS_ROOT, { withFileTypes: true }))
  .filter((d) => d.isDirectory() && d.name.startsWith('vpylab-'))
  .map((d) => d.name)
  .sort();

console.log(`총 ${allDirs.length}개 프로젝트 빌드 시작`);
const results = [];
const failures = [];
for (const id of allDirs) {
  try {
    results.push(await buildOne(id));
  } catch (e) {
    console.error(`✗ ${id}: ${e.message}`);
    failures.push({ id, error: e.message });
  }
}

console.log('\n══════ 요약 ══════');
for (const r of results) console.log(`  ✓ ${r.projectId} ${r.seconds}s`);
for (const f of failures) console.log(`  ✗ ${f.id} — ${f.error}`);
console.log(`\n성공 ${results.length} / 실패 ${failures.length}`);
process.exit(failures.length > 0 ? 1 : 0);

import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { projectDir } from '../project-paths.mjs';

const training = projectDir('vpylab-teacher-training');
const captures = join(training, 'captures');
const validation = join(training, 'validation');
mkdirSync(captures, { recursive: true });
mkdirSync(validation, { recursive: true });
const url = new URL(process.env.VPYLAB_TRAINING_URL || 'http://127.0.0.1:4093/training.html');
assert.equal(url.protocol, 'http:');
assert.equal(url.hostname, '127.0.0.1');
const program = JSON.parse(readFileSync(join(training, 'program.json'), 'utf8'));
const activities = ['common', 'math', 'science'].flatMap(folder => JSON.parse(readFileSync(join(training, folder, 'activities.json'), 'utf8')));
const automation = await import(process.env.VPYLAB_PLAYWRIGHT_MODULE ? pathToFileURL(resolve(process.env.VPYLAB_PLAYWRIGHT_MODULE)).href : 'playwright');
const browser = await (automation.default || automation).chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio'] });
const context = await browser.newContext({ viewport: { width: 1580, height: 1200 }, deviceScaleFactor: 1.5, locale: 'ko-KR', timezoneId: 'Asia/Seoul' });
await context.route(/^https:\/\/(?:api\.)?github\.com\//, route => route.abort());
const page = await context.newPage();
page.setDefaultTimeout(25000);
const results = { testedAt: new Date().toISOString(), scope: 'Focused actual-browser verification after opt-in camera translation and final training UI changes; no repeat of the entire 17-run workbook suite.', cases: [], screenshots: [], pageErrors: [] };
page.on('pageerror', error => results.pageErrors.push(error.message));
const save = () => writeFileSync(join(validation, 'browser-camera-validation.json'), JSON.stringify(results, null, 2) + '\n');
async function ready() {
  await page.waitForFunction(() => [...document.querySelectorAll('button')].some(button => button.textContent === '▶ 실행' && !button.disabled), null, { timeout: 120000 });
}
async function select(activity) {
  await page.getByRole('button', { name: '실습 워크북', exact: true }).click();
  await page.locator('aside.tr-session-nav').getByRole('button', { name: new RegExp(program.sessions[activity.session - 1].title) }).click();
  await page.locator('.tr-activity-tabs').getByRole('button', { name: new RegExp(activity.title) }).click();
  await ready();
}
async function shot(file, title, practice = true) {
  if (practice) {
    await page.locator('.tr-activity-heading').evaluate(element => element.scrollIntoView({ block: 'start' }));
    await page.evaluate(() => {
      window.scrollBy(0, -25);
      const editor = document.querySelector('.tr-editor');
      if (editor) { editor.scrollTop = 0; editor.scrollLeft = 0; }
      const output = document.querySelector('.runtime-console-output');
      if (output) output.scrollTop = output.scrollHeight;
    });
  } else await page.evaluate(() => window.scrollTo(0, 0));
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: join(captures, file), animations: 'disabled', caret: 'hide' });
  results.screenshots.push({ file, title, pixels: { width: 2370, height: 1800 }, finalTrainingUi: true });
  save();
}
async function run(activity, source, expected, name = '원본') {
  await page.getByLabel('Python 코드', { exact: true }).fill(source);
  await ready();
  await page.getByRole('button', { name: '기록 비우기', exact: true }).click();
  await page.waitForFunction(() => !document.querySelector('.runtime-console-output')?.textContent.includes('실행을 마쳤습니다.'));
  await page.getByRole('button', { name: '▶ 실행', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.runtime-console-output')?.textContent.includes('실행을 마쳤습니다.') || document.querySelector('.runtime-error'), null, { timeout: 60000 });
  const text = await page.getByLabel('실행 출력', { exact: true }).innerText();
  assert.equal(await page.locator('.runtime-error').count(), 0, text);
  for (const item of expected) assert.ok(text.includes(item), `${activity.id}: missing ${item}`);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const camera = await page.evaluate(async () => {
    const registry = await import('/src/engine/object-registry.js');
    const bridge = await import('/src/engine/vpython-bridge.js');
    const objects = registry.getSnapshot();
    let scene = bridge.getMesh(objects[0].id);
    while (scene?.parent) scene = scene.parent;
    const system = scene._cameraSystem;
    const camera = scene._camera;
    const target = system.controls.target;
    const project = (x, y, z) => camera.position.clone().set(x, y, z).project(camera).toArray();
    return {
      enabled: system.options.preserveDirectionOnCenter,
      position: camera.position.toArray(), target: target.toArray(),
      direction: camera.position.clone().sub(target).normalize().toArray(),
      distance: camera.position.distanceTo(target),
      origin: project(0, 0, 0), xUnit: project(1, 0, 0), yUnit: project(0, 1, 0),
      objectCount: objects.length,
    };
  });
  assert.equal(camera.enabled, true);
  assert.ok(Math.abs(camera.direction[0]) < 1e-6 && Math.abs(camera.direction[1]) < 1e-6 && Math.abs(camera.direction[2] - 1) < 1e-6, JSON.stringify(camera));
  assert.ok(Math.abs(camera.xUnit[1] - camera.origin[1]) < 1e-6, 'World x axis must project horizontally');
  assert.ok(Math.abs(camera.yUnit[0] - camera.origin[0]) < 1e-6, 'World y axis must project vertically');
  assert.ok(camera.xUnit[0] > camera.origin[0] && camera.yUnit[1] > camera.origin[1]);
  assert.deepEqual(results.pageErrors, []);
  results.cases.push({ id: activity.id, name, status: 'pass', output: text.split('\n').filter(Boolean), camera });
  save();
  process.stdout.write(`정면 표시 통과: ${activity.id} · ${name}\n`);
}

try {
  await page.goto(url.href);
  await page.getByRole('heading', { name: program.title, exact: true }).waitFor();
  await shot('01-overview.png', '최종 6차시 연수 안내', false);
  for (const id of ['first-light', 'math-coordinates', 'math-proportion', 'math-affine', 'science-motion', 'science-gravity', 'sound-steps']) {
    const activity = activities.find(item => item.id === id);
    await select(activity);
    const original = readFileSync(join(training, activity.codeFile), 'utf8');
    await run(activity, original, activity.check.outputIncludes);
    if (id === 'first-light') await shot('02-first-code.png', '예측 질문과 파란 구의 첫 실행');
    if (id === 'math-proportion') {
      await run(activity, original.replace('k = 1', 'k = 2'), ['0 0', '4 8'], 'k 두 배 수정 후 재실행');
      await shot('03-math.png', '정면 좌표축과 비례상수 비교');
    }
    if (id === 'science-motion') await shot('04-motion.png', '수평 위치와 모형 시간의 등속운동');
    if (id === 'sound-steps') await shot('05-sound.png', '정면에서 비교하는 3색·높이·주파수');
  }
  await page.getByRole('button', { name: '나의 수업안', exact: true }).click();
  await page.getByLabel('교과', { exact: true }).fill('수학 (브라우저 시험용 합성 수업안)');
  await page.getByLabel('학생이 이해할 교과 개념', { exact: true }).fill('비례상수만 두 배로 바꾸면 같은 x의 y가 두 배가 됨을 출력으로 설명한다.');
  await page.getByLabel('학생이 수정할 1~3줄', { exact: true }).fill('k = 1을 k = 2로 바꾸는 한 줄');
  await page.getByLabel('바꿀 조건과 유지할 조건', { exact: true }).fill('변경 k, 고정 x 범위·축·반복 횟수');
  await shot('06-lesson-plan.png', '교과 질문과 한 줄 수정 과제를 담는 수업안', false);
  results.status = 'pass'; results.passed = results.cases.length; results.completedAt = new Date().toISOString();
  save();
  process.stdout.write(JSON.stringify({ status: 'pass', cases: results.passed, screenshots: results.screenshots.length, pageErrors: results.pageErrors.length }) + '\n');
} catch (error) {
  results.status = 'fail'; results.failure = { message: error.message, stack: error.stack, url: page.url() }; results.completedAt = new Date().toISOString();
  save(); process.stderr.write(`${error.stack}\n`); process.exitCode = 1;
} finally { await browser.close(); }

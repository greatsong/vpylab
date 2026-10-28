import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { projectDir } from '../project-paths.mjs';

// Fresh test profile only. This script does not read account credentials or write to GitHub.
const training = projectDir('vpylab-teacher-training');
const output = join(training, 'validation');
const captures = join(training, 'captures');
const downloads = join(output, 'browser-downloads');
for (const directory of [output, captures, downloads]) mkdirSync(directory, { recursive: true });
const url = new URL(process.env.VPYLAB_TRAINING_URL || 'http://127.0.0.1:4093/training.html');
assert.equal(url.protocol, 'http:');
assert.equal(url.hostname, '127.0.0.1');
assert.equal(url.pathname, '/training.html');
const program = JSON.parse(readFileSync(join(training, 'program.json'), 'utf8'));
const activities = ['common', 'math', 'science'].flatMap(folder => JSON.parse(readFileSync(join(training, folder, 'activities.json'), 'utf8')));
const sourceFor = activity => readFileSync(join(training, activity.codeFile), 'utf8');
const variantFor = {
  'first-light': { before: 'radius = 0.6', after: 'radius = 0.9', outputIncludes: ['반지름: 0.9'] },
  'moving-dot': { before: 'step = 0.2', after: 'step = 0.1', outputIncludes: ['이동 횟수: 30', '마지막 x: -1.0'] },
  'math-coordinates': { before: 'x = 2', after: 'x = 3', outputIncludes: ['점 P의 x, y: 3 1'] },
  'math-proportion': { before: 'k = 1', after: 'k = 2', outputIncludes: ['0 0', '1 2', '2 4', '3 6', '4 8'] },
  'math-affine': { before: 'b = 1', after: 'b = 2', outputIncludes: ['0 0 2', '1 1 3', '2 2 4', '3 3 5', '4 4 6'] },
  'science-motion': { before: 'speed = 2', after: 'speed = 3', outputIncludes: ['0 s : 0 m', '4 s : 12 m'] },
  'science-gravity': { before: 'g = 9.8', after: 'g = 1.6', outputIncludes: ['0.0 s : 10.0 m', '1.0 s : 9.2 m'] },
  'sound-steps': { before: 'frequencies = [220, 440, 880]', after: 'frequencies = [220, 330, 880]', outputIncludes: ['220 Hz, 기준 220 Hz의 1.0 배', '330 Hz, 기준 220 Hz의 1.5 배', '880 Hz, 기준 220 Hz의 4.0 배'] },
};
const automation = await import(process.env.VPYLAB_PLAYWRIGHT_MODULE ? pathToFileURL(resolve(process.env.VPYLAB_PLAYWRIGHT_MODULE)).href : 'playwright');
const browser = await (automation.default || automation).chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio'] });
const context = await browser.newContext({ viewport: { width: 1580, height: 1200 }, deviceScaleFactor: 1.5, locale: 'ko-KR', timezoneId: 'Asia/Seoul', acceptDownloads: true });
await context.route(/^https:\/\/(?:api\.)?github\.com\//, route => route.abort());
const page = await context.newPage();
page.setDefaultTimeout(25000);
const results = {
  testedAt: new Date().toISOString(), url: url.href,
  method: 'Fresh Chromium profile + actual Pyodide Python + WebGL object registry + WebAudio state',
  scope: 'Workbook and lesson-plan browser verification. Collaboration classroom is tested separately. This is not participant learning-effect research.',
  audioScope: 'Checks actual WebAudio voices and mute state; does not claim human listening or acoustic quality measurement.',
  activities: [], checks: [], screenshots: [], pageErrors: [], apiMutations: [],
};
page.on('pageerror', error => results.pageErrors.push(error.message));
page.on('request', request => {
  if (request.url().startsWith(url.origin + '/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) results.apiMutations.push({ method: request.method(), path: new URL(request.url()).pathname });
});
const save = () => writeFileSync(join(output, 'browser-validation.json'), JSON.stringify(results, null, 2) + '\n');
const pass = name => { results.checks.push(name); process.stdout.write(`통과: ${name}\n`); save(); };
const editor = () => page.getByLabel('Python 코드', { exact: true });
async function ready() {
  await page.waitForFunction(() => [...document.querySelectorAll('button')].some(button => button.textContent === '▶ 실행' && !button.disabled), null, { timeout: 120000 });
}
async function instrument() {
  await page.evaluate(async () => {
    window.__trainingRegistry = await import('/src/engine/object-registry.js');
    window.__trainingSound = await import('/src/engine/sound-system.js');
    window.__trainingAudio ||= [];
    if (!window.__trainingAudioUnsubscribe) window.__trainingAudioUnsubscribe = window.__trainingSound.subscribeAudioState(state => window.__trainingAudio.push({ ...state }));
  });
}
async function openActivity(activity) {
  await page.getByRole('button', { name: '실습 워크북', exact: true }).click();
  await page.locator('aside.tr-session-nav').getByRole('button', { name: new RegExp(program.sessions[activity.session - 1].title) }).click();
  await page.locator('.tr-activity-tabs').getByRole('button', { name: new RegExp(activity.title) }).click();
  await page.locator('.tr-activity-heading h2').filter({ hasText: activity.title }).waitFor();
  assert.ok((await editor().inputValue()).trim().length > 0, `Missing source: ${activity.id}`);
  await ready();
  await instrument();
}
async function shot(file, title, practice = true) {
  if (practice) {
    await page.locator('.tr-activity-heading').scrollIntoViewIfNeeded();
    await page.locator('.tr-activity-heading').evaluate(element => element.scrollIntoView({ block: 'start' }));
    await page.evaluate(() => window.scrollBy(0, -25));
  } else await page.evaluate(() => window.scrollTo(0, 0));
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: join(captures, file), animations: 'disabled', caret: 'hide' });
  results.screenshots.push({ file, title, pixels: { width: 2370, height: 1800 } });
  save();
}
async function execute(activity, kind, source, expected) {
  await editor().fill(source);
  await ready();
  await page.getByRole('button', { name: '기록 비우기', exact: true }).click();
  await page.waitForFunction(() => !document.querySelector('.runtime-console-output')?.textContent.includes('실행을 마쳤습니다.'));
  await page.evaluate(() => { window.__trainingAudio.length = 0; });
  const started = Date.now();
  await page.getByRole('button', { name: '▶ 실행', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.runtime-console-output')?.textContent.includes('실행을 마쳤습니다.') || document.querySelector('.runtime-error'), null, { timeout: 60000 });
  const outputText = await page.getByLabel('실행 출력', { exact: true }).innerText();
  assert.equal(await page.locator('.runtime-error').count(), 0, outputText);
  assert.doesNotMatch(outputText, /Traceback|NameError|SyntaxError|IndentationError|\[event handler error\]/);
  for (const text of expected.outputIncludes) assert.ok(outputText.includes(text), `${activity.id} ${kind}: expected ${text}\n${outputText}`);
  await page.waitForFunction(() => document.querySelector('.runtime-status')?.textContent === '실행 준비 완료', null, { timeout: 10000 });
  const snapshot = await page.evaluate(() => window.__trainingRegistry.getSnapshot());
  assert.ok(snapshot.length > 0, `${activity.id}: no rendered objects`);
  if (expected.objectCount !== undefined) assert.equal(snapshot.length, expected.objectCount, `${activity.id} object count`);
  const audio = await page.evaluate(() => window.__trainingAudio);
  const record = { id: activity.id, kind, status: 'pass', durationMs: Date.now() - started, output: outputText.split('\n').filter(Boolean), objectCount: snapshot.length, objectTypes: Object.fromEntries([...new Set(snapshot.map(item => item.type))].map(type => [type, snapshot.filter(item => item.type === type).length])), audioVoiceObserved: audio.some(state => state.voiceCount > 0), snapshot };
  results.activities.push(record);
  assert.deepEqual(results.pageErrors, []);
  pass(`${activity.id} · ${kind} 실제 실행·출력·장면`);
  return record;
}
async function download(buttonName, filename) {
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: buttonName, exact: true }).click();
  const file = await pending;
  assert.equal(file.suggestedFilename(), filename);
  const destination = join(downloads, basename(filename));
  await file.saveAs(destination);
  return readFileSync(destination, 'utf8');
}

try {
  await page.goto(url.href);
  await page.getByRole('heading', { name: program.title, exact: true }).waitFor();
  assert.equal(await page.getByLabel('AI 사용 방식').inputValue(), 'disabled');
  await shot('01-overview.png', '파이썬 첫 학습자를 위한 6차시 연수 안내', false);
  pass('연수 안내·기본 AI 미사용·6차시 구성');

  for (const activity of activities) {
    await openActivity(activity);
    const original = sourceFor(activity);
    assert.equal(await editor().inputValue(), original, `${activity.id}: imported code differs from source`);
    const baseline = await execute(activity, '원본', original, activity.check);
    if (activity.id === 'first-light') await shot('02-first-code.png', '8줄 코드의 첫 실행과 파란 구');
    if (activity.id === 'sound-steps') {
      assert.deepEqual(baseline.snapshot.filter(item => item.type === 'box').map(item => item.props.size[1]), [1, 2, 4]);
      assert.equal(new Set(baseline.snapshot.filter(item => item.type === 'box').map(item => JSON.stringify(item.props.color))).size, 3);
      assert.equal(baseline.audioVoiceObserved, true);
      pass('3색·3높이·주파수 문자·실제 WebAudio 발음');
      await shot('05-sound.png', '음악·색·높이로 주파수 비율 비교');
    }
    const variant = variantFor[activity.id];
    assert.ok(variant, `Missing variant: ${activity.id}`);
    assert.equal(original.split('\n').filter(line => line === variant.before).length, 1);
    const changed = original.replace(variant.before, variant.after);
    const modified = await execute(activity, '한 줄 수정', changed, { ...activity.check, outputIncludes: variant.outputIncludes });
    if (activity.id === 'math-proportion') await shot('03-math.png', '비례상수 한 줄을 바꾼 다섯 점 실험');
    if (activity.id === 'science-motion') await shot('04-motion.png', '같은 4초에서 속력 한 줄을 바꾼 운동 실험');
    if (activity.id === 'sound-steps') assert.deepEqual(modified.snapshot.filter(item => item.type === 'box').map(item => item.props.size[1]), [1, 1.5, 4]);
    if (activity.id === 'first-light') {
      await page.getByLabel('실행 전 예상', { exact: true }).fill('반지름을 0.9로 바꾸면 위치는 같고 크기만 커질 것이다. (합성 브라우저 시험 기록)');
      await page.getByLabel('실행 후 관찰', { exact: true }).fill('출력 반지름 0.9, 원점 위치 유지.');
      await page.getByLabel('짝이 남긴 검토', { exact: true }).fill('바꾼 줄 1개와 출력 수치를 확인했습니다. (시험용 기록)');
      await page.getByRole('button', { name: '첫 힌트 보기', exact: true }).click();
      await page.getByRole('button', { name: '다음 힌트 보기', exact: true }).click();
      await page.getByRole('button', { name: '다음 힌트 보기', exact: true }).click();
      assert.equal(await page.locator('.tr-hints p').count(), 3);
      assert.equal(await page.getByRole('button', { name: '다음 힌트 보기', exact: true }).isDisabled(), true);
      pass('힌트 1→2→3 순차 공개');
      await page.getByRole('button', { name: '기본 코드로 돌아가기', exact: true }).click();
      assert.equal(await editor().inputValue(), original);
      await page.getByRole('button', { name: '복원 전 코드 되돌리기', exact: true }).click();
      assert.equal(await editor().inputValue(), changed);
      pass('기본 코드 복원·복원 전 수정 코드 되돌리기');
      await page.locator('.tr-checkout input[type="checkbox"]').check();
      await page.reload();
      await openActivity(activity);
      assert.equal(await editor().inputValue(), changed);
      assert.match(await page.getByLabel('실행 전 예상', { exact: true }).inputValue(), /합성 브라우저 시험 기록/);
      assert.equal(await page.getByLabel('실행 후 관찰', { exact: true }).inputValue(), '출력 반지름 0.9, 원점 위치 유지.');
      assert.equal(await page.locator('.tr-checkout input[type="checkbox"]').isChecked(), true);
      pass('수정 코드·실험 기록·차시 자기 확인 저장 후 새로고침 복원');
    }
  }

  const soundActivity = activities.find(activity => activity.id === 'sound-steps');
  await openActivity(soundActivity);
  await page.getByRole('button', { name: '음소거', exact: true }).click();
  assert.equal(await page.getByRole('button', { name: '소리 켜기', exact: true }).getAttribute('aria-pressed'), 'true');
  const muted = await execute(soundActivity, '음소거 실행', sourceFor(soundActivity), soundActivity.check);
  assert.equal(muted.audioVoiceObserved, false);
  assert.equal(muted.objectTypes.box, 3);
  pass('음소거 상태에서도 소리 실습의 숫자·세 막대 유지');
  await page.getByRole('button', { name: '소리 켜기', exact: true }).click();

  await page.getByRole('button', { name: '연수 안내', exact: true }).click();
  await page.getByLabel('AI 사용 방식').selectOption('optional');
  await openActivity(activities.find(activity => activity.id === 'math-coordinates'));
  await page.getByText('AI를 선택해서 쓸 때의 질문', { exact: true }).click();
  assert.equal(await page.getByText('AI를 선택해서 쓸 때의 질문', { exact: true }).isVisible(), true);
  await page.getByRole('button', { name: '연수 안내', exact: true }).click();
  await page.getByLabel('AI 사용 방식').selectOption('disabled');
  await openActivity(activities.find(activity => activity.id === 'math-coordinates'));
  assert.equal(await page.getByText('AI를 선택해서 쓸 때의 질문', { exact: true }).count(), 0);
  pass('AI 미사용·선택 사용 전환 및 선택 질문 노출');

  for (let number = 1; number <= 5; number++) {
    await page.getByRole('button', { name: '실습 워크북', exact: true }).click();
    const target = page.locator('aside.tr-session-nav').getByRole('button', { name: new RegExp(program.sessions[number - 1].title) });
    await target.click();
    assert.equal(await target.getAttribute('aria-current'), 'step');
    assert.equal(await page.locator('.tr-session-intro h1').innerText(), program.sessions[number - 1].title);
  }
  await page.locator('aside.tr-session-nav').getByRole('button', { name: new RegExp(program.sessions[5].title) }).click();
  await page.getByRole('heading', { name: '내 교과의 한 차시로 바꾸기', exact: true }).waitFor();
  pass('6개 차시 탐색·6차시 수업안 연결');

  await page.getByLabel('교과', { exact: true }).fill('수학 (브라우저 시험용 합성 수업안)');
  await page.getByLabel('학생이 이해할 교과 개념', { exact: true }).fill('비례상수만 두 배로 바꾸면 같은 x의 y가 두 배가 됨을 출력으로 설명한다.');
  await page.getByLabel('학생이 수정할 1~3줄', { exact: true }).fill('k = 1을 k = 2로 바꾸는 한 줄');
  await page.getByLabel('바꿀 조건과 유지할 조건', { exact: true }).fill('변경 k, 고정 x 범위·축·반복 횟수');
  await page.getByLabel('학생의 이해를 확인할 질문', { exact: true }).fill('원점은 왜 그대로인가요? 출력 수치 하나를 근거로 설명하세요.');
  await page.getByRole('button', { name: '시연·짝 피드백 확인하기', exact: true }).click();
  await shot('06-lesson-plan.png', '학생 수정 한 줄과 비교 질문을 담은 교과 수업안', false);
  const markdown = await download('나의 수업안 받기 ↓', 'vpylab-my-lesson-plan.md');
  assert.match(markdown, /브라우저 시험용 합성 수업안/);
  assert.match(markdown, /k = 1을 k = 2로 바꾸는 한 줄/);
  assert.match(markdown, /AI 사용 방식: 미사용/);
  const records = JSON.parse(await download('내 연수 기록 받기 ↓', 'vpylab-my-training.json'));
  assert.equal(records.schema, 1);
  assert.equal(records.aiPolicy, 'disabled');
  assert.equal(records.activities['first-light'].code.includes('radius = 0.9'), true);
  assert.equal(records.activities['first-light'].prediction.includes('합성 브라우저 시험 기록'), true);
  assert.equal(records.activities['sound-steps'].run.status, 'completed');
  assert.ok(records.completed.includes(1) && records.completed.includes(6));
  assert.match(records.plan.subject, /브라우저 시험용 합성 수업안/);
  pass('수업안 Markdown·전체 코드와 실험 기록 JSON 실제 다운로드');
  await page.reload();
  await page.getByRole('button', { name: '나의 수업안', exact: true }).click();
  assert.equal(await page.getByLabel('교과', { exact: true }).inputValue(), '수학 (브라우저 시험용 합성 수업안)');
  pass('교과 수업안 저장 후 새로고침 복원');

  assert.deepEqual(results.pageErrors, []);
  assert.deepEqual(results.apiMutations, []);
  results.status = 'pass';
  results.completedAt = new Date().toISOString();
  results.passed = results.checks.length;
  results.executionCount = results.activities.length;
  results.failed = 0;
  save();
  process.stdout.write(JSON.stringify({ status: results.status, checks: results.passed, executionCount: results.executionCount, screenshots: results.screenshots.length }) + '\n');
} catch (error) {
  results.status = 'fail';
  results.failed = 1;
  results.failure = { message: error.message, stack: error.stack, url: page.url() };
  results.completedAt = new Date().toISOString();
  results.lastOutput = await page.getByLabel('실행 출력', { exact: true }).innerText().catch(() => 'No runtime output');
  await page.screenshot({ path: join(captures, 'browser-failure.png'), fullPage: true }).catch(() => {});
  save();
  process.stderr.write(`${error.stack}\n`);
  process.exitCode = 1;
} finally { await browser.close(); }

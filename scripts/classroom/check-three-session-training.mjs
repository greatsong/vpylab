import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { projectDir } from '../project-paths.mjs';

// 새 프로필의 합성 기록만 사용합니다. 외부 AI 호출·GitHub 쓰기를 하지 않습니다.
const training = projectDir('vpylab-teacher-training');
const output = join(training, 'validation', 'three-session-browser-validation.json');
const captures = join(training, 'captures');
mkdirSync(captures, { recursive: true });
mkdirSync(join(training, 'validation'), { recursive: true });
const origin = 'http://127.0.0.1:4093';
const followUpOnly = process.argv.includes('--ai-follow-up-only');
const programs = ['three-no-ai', 'three-ai'].map(id => JSON.parse(readFileSync(join(training, 'variants', `${id}.json`), 'utf8')));
const activities = ['common', 'math', 'science'].flatMap(folder => JSON.parse(readFileSync(join(training, folder, 'activities.json'), 'utf8')));
const activityFor = id => activities.find(activity => activity.id === id);
const sourceFor = id => readFileSync(join(training, activityFor(id).codeFile), 'utf8');
const storageKey = id => `vpylab:teacher-training:v1:${id}`;
const legacyKey = 'vpylab:teacher-training:v1';
const variants = {
  'first-light': { before: 'radius = 0.6', after: 'radius = 0.9', outputIncludes: ['반지름: 0.9'] },
  'math-proportion': { before: 'k = 1', after: 'k = 2', outputIncludes: ['0 0', '1 2', '2 4', '3 6', '4 8'] },
  'sound-steps': { before: 'frequencies = [220, 440, 880]', after: 'frequencies = [220, 330, 880]', outputIncludes: ['220 Hz, 기준 220 Hz의 1.0 배', '330 Hz, 기준 220 Hz의 1.5 배', '880 Hz, 기준 220 Hz의 4.0 배'] },
};
const changedFor = id => sourceFor(id).replace(variants[id].before, variants[id].after);
const results = followUpOnly ? JSON.parse(readFileSync(output, 'utf8')) : {
  schema: 1, startedAt: new Date().toISOString(), status: 'running', synthetic: true,
  method: '새 Chromium 프로필·실제 Pyodide·WebGL 객체·WebAudio 상태·실제 파일 다운로드',
  scope: '두 3차시 과정의 실행·폼·저장·차시/과정 격리 검증. 두 선택 예제를 모두 실행한 것은 테스트 범위이며 참가자 필수 활동이 아닙니다.',
  aiScope: '실제 AI 응답 상태를 포함한 폼 선택지는 명시적인 합성 입력으로 검사했습니다. 외부 AI 응답을 생성하거나 호출한 결과가 아닙니다.',
  audioScope: 'WebAudio 음원과 음소거 상태 검사입니다. 자동화 브라우저의 스피커는 음소거했으며 실제 청취·음질 평가는 포함하지 않습니다.',
  checks: [], executions: [], screenshots: [], pageErrors: [], apiMutations: [], blockedRequests: [], mobile: [], courses: [],
};
const save = () => writeFileSync(output, JSON.stringify({ ...results, checksPassed: results.checks.length, executionCount: results.executions.length }, null, 2) + '\n');
const pass = (name, detail = {}) => { results.checks.push({ name, ...detail }); save(); console.log(`통과: ${name}`); };
const automation = await import(process.env.VPYLAB_PLAYWRIGHT_MODULE ? pathToFileURL(resolve(process.env.VPYLAB_PLAYWRIGHT_MODULE)).href : 'playwright');
const browser = await (automation.default || automation).chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio'] });
const context = await browser.newContext({ viewport: { width: 1580, height: 1200 }, deviceScaleFactor: 1.5, locale: 'ko-KR', timezoneId: 'Asia/Seoul', acceptDownloads: true });
await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin });
await context.route('**/*', async route => {
  const request = route.request(), url = new URL(request.url());
  const provider = /(^|\.)(github\.com|openai\.com|anthropic\.com|generativelanguage\.googleapis\.com|api\.upstage\.ai)$/.test(url.hostname);
  if (provider || !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) {
    results.blockedRequests.push({ method: request.method(), url: url.origin + url.pathname });
    return route.abort();
  }
  return route.continue();
});
const page = await context.newPage();
page.setDefaultTimeout(25000);
page.on('pageerror', error => results.pageErrors.push(error.message));
page.on('request', request => { if (request.url().startsWith(origin + '/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) results.apiMutations.push({ method: request.method(), path: new URL(request.url()).pathname }); });
let program;
const editor = () => page.getByLabel('Python 코드', { exact: true });
const field = title => page.getByLabel(title, { exact: true });
async function ready() { await page.waitForFunction(() => [...document.querySelectorAll('button')].some(button => button.textContent === '▶ 실행' && !button.disabled), null, { timeout: 120000 }); }
async function openSession(number, id) {
  await page.getByRole('button', { name: '실습 워크북', exact: true }).click();
  await page.locator('aside.tr-session-nav').getByRole('button', { name: new RegExp(program.sessions[number - 1].title) }).click();
  if (id) await page.locator('.tr-activity-tabs').getByRole('button', { name: activityFor(id).title, exact: true }).click();
  await editor().waitFor();
  assert.equal(await page.locator('.tr-session-intro h1').innerText(), program.sessions[number - 1].title);
}
async function instrument() {
  await page.evaluate(async () => {
    window.__threeRegistry = await import('/src/engine/object-registry.js');
    window.__threeSound = await import('/src/engine/sound-system.js');
    window.__threeAudioUnsubscribe?.();
    window.__threeAudio = [];
    window.__threeAudioUnsubscribe = window.__threeSound.subscribeAudioState(state => window.__threeAudio.push({ ...state }));
  });
}
async function execute(id, stage, code, expected, { muted = false } = {}) {
  await editor().fill(code); await ready(); await instrument();
  await page.getByRole('button', { name: '기록 비우기', exact: true }).click();
  await page.waitForFunction(() => !document.querySelector('.runtime-console-output')?.textContent.includes('실행을 마쳤습니다.'));
  await page.evaluate(() => { window.__threeAudio.length = 0; });
  const startedAt = Date.now();
  await page.getByRole('button', { name: '▶ 실행', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.runtime-console-output')?.textContent.includes('실행을 마쳤습니다.') || document.querySelector('.runtime-error'), null, { timeout: 60000 });
  const outputText = await page.getByLabel('실행 출력', { exact: true }).innerText();
  assert.equal(await page.locator('.runtime-error').count(), 0, outputText);
  assert.doesNotMatch(outputText, /Traceback|NameError|SyntaxError|IndentationError|\[event handler error\]/);
  for (const expectedText of expected.outputIncludes) assert.ok(outputText.includes(expectedText), `${id}/${stage}: ${expectedText}`);
  await page.waitForFunction(() => document.querySelector('.runtime-status')?.textContent === '실행 준비 완료', null, { timeout: 10000 });
  const snapshot = await page.evaluate(() => window.__threeRegistry.getSnapshot());
  const audio = await page.evaluate(() => window.__threeAudio);
  assert.ok(snapshot.length > 0);
  const boxes = snapshot.filter(item => item.type === 'box');
  if (id === 'first-light') assert.equal(snapshot.filter(item => item.type === 'sphere').length, 1);
  if (id === 'math-proportion') assert.equal(snapshot.filter(item => item.type === 'sphere').length, 5);
  if (id === 'sound-steps') {
    assert.deepEqual(boxes.map(item => item.props.size[1]), stage === '원본' ? [1, 2, 4] : [1, 1.5, 4]);
    assert.equal(new Set(boxes.map(item => JSON.stringify(item.props.color))).size, 3);
    assert.equal(audio.some(state => state.voiceCount > 0), !muted);
  }
  results.executions.push({ courseId: program.id, activityId: id, stage, durationMs: Date.now() - startedAt, output: outputText.split('\n').filter(Boolean), objectCount: snapshot.length, snapshot, audioVoiceObserved: audio.some(state => state.voiceCount > 0), muted });
  pass(`${program.id} · ${id} · ${stage} 실제 Python 실행`);
}
async function shot(file, title, selector) {
  if (selector) await page.locator(selector).evaluate(element => element.scrollIntoView({ block: 'start' }));
  else await page.evaluate(() => scrollTo(0, 0));
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: join(captures, file), animations: 'disabled', caret: 'hide' });
  results.screenshots.push({ file, title, viewport: { width: 1580, height: 1200 }, pixels: { width: 2370, height: 1800 } }); save();
}
async function readState(id) { return page.evaluate(key => JSON.parse(localStorage.getItem(key)), id === 'intro-6' ? legacyKey : storageKey(id)); }
async function download(button, name) {
  const pending = page.waitForEvent('download'); await page.getByRole('button', { name: button, exact: true }).click();
  const item = await pending; assert.equal(item.suggestedFilename(), name);
  return readFileSync(await item.path(), 'utf8');
}
async function expandAiRecords() {
  const summary = page.getByText('응답을 받고, 확인한 근거 기록하기', { exact: true });
  if ((await summary.locator('..').getAttribute('open')) === null) await summary.click();
}
async function recordAi({ status, tool, response, verification, decision, reason }) {
  await field('AI 사용 상태').selectOption(status);
  await field('사용한 AI 도구·도움 출처').fill(tool);
  await expandAiRecords();
  await field('받은 AI 응답·검토 예시').fill(response);
  await field('AI 답을 확인한 실행·수치').fill(verification);
  await field('AI 도움에 대한 판단').selectOption(decision);
  await field('채택·거절한 이유').fill(reason);
}

try {
  if (followUpOnly) {
    assert.ok(results.status === 'pass' || results.fullRunStatus === 'pass', '전체 실행 검증을 먼저 완료해주세요.');
    results.fullRunStatus = 'pass';
    results.checks = results.checks.filter(item => !item.name.startsWith('후속 ·'));
    results.screenshots = results.screenshots.filter(item => item.file !== 'three-ai-06-follow-up.png');
    program = programs.find(item => item.id === 'three-ai');
    await page.goto(origin + '/training.html?course=three-ai');
    await page.getByRole('button', { name: '1차시 시작하기 →', exact: true }).click();
    assert.equal(await page.getByRole('button', { name: 'AI 질문 복사', exact: true }).isDisabled(), true);
    const prediction = '후속 합성 검증: 반지름만 커지고 위치는 그대로일 것이다.';
    await field('실행 전 예상').fill(prediction);
    const copiedPrompt = await field('AI에게 할 질문').inputValue();
    await page.getByRole('button', { name: 'AI 질문 복사', exact: true }).click();
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), copiedPrompt);
    assert.equal((await readState('three-ai')).activities['1:first-light'].aiPrompt, copiedPrompt);
    const exported = JSON.parse(await download('내 연수 기록 받기 ↓', 'vpylab-my-training.json'));
    assert.equal(exported.activities['1:first-light'].aiPrompt, copiedPrompt);
    assert.ok(exported.activities['1:first-light'].aiPrompt.includes(prediction));
    pass('후속 · 기본 AI 질문 복사 후 실제 질문의 저장·JSON 다운로드');
    await page.reload(); await openSession(1, 'first-light');
    assert.equal(await field('AI에게 할 질문').inputValue(), copiedPrompt);
    pass('후속 · 복사한 AI 질문 새로고침 복원');
    for (let number = 1; number <= 3; number++) {
      await openSession(number, number === 1 ? 'first-light' : 'sound-steps');
      const summary = page.getByText('AI 연결이 어려울 때의 검토 연습', { exact: true });
      await summary.click();
      const text = await summary.locator('..').innerText();
      assert.ok(text.includes(program.sessions[number - 1].aiResponseExample.text), `AI ${number}차시의 정확한 강사 예시가 필요합니다.`);
      assert.match(text, /실제 AI 응답/);
      pass(`후속 · AI ${number}차시 정확한 강사 예시·출처 표시`);
    }
    const previousVerification = '[합성 폼 입력] 앞선 전체 실행 검증의 330Hz·막대1.5를 대조하는 기록';
    await recordAi({ status: 'example-only', tool: '강사 작성 검토 예시 · 응답 교체 폼 시험', response: '[합성 폼 시험] 가운데 값만 바뀐다.', verification: previousVerification, decision: 'adopted', reason: '응답 교체 전의 채택 상태를 확인하는 합성 입력' });
    assert.equal(await field('AI 도움에 대한 판단').inputValue(), 'adopted');
    await field('받은 AI 응답·검토 예시').fill('[합성 폼 시험 · 변경 응답] 모든 막대 높이가 같아진다.');
    assert.equal(await field('AI 도움에 대한 판단').inputValue(), 'pending');
    assert.equal(await field('AI 답을 확인한 실행·수치').inputValue(), previousVerification);
    assert.equal(await page.getByText('질문이나 응답이 바뀌어 판단을 보류했습니다. 남겨 둔 실행 근거를 현재 질문·응답과 다시 대조한 뒤 판단하세요.', { exact: true }).isVisible(), true);
    const changedResponse = JSON.parse(await download('내 연수 기록 받기 ↓', 'vpylab-my-training.json')).activities['3:sound-steps'];
    assert.equal(changedResponse.aiDecision, 'pending'); assert.equal(changedResponse.aiVerificationNeedsReview, true); assert.equal(changedResponse.aiVerification, previousVerification);
    await page.reload(); await openSession(3, 'sound-steps'); await expandAiRecords();
    assert.equal(await field('AI 도움에 대한 판단').inputValue(), 'pending'); assert.equal(await field('AI 답을 확인한 실행·수치').inputValue(), previousVerification);
    pass('후속 · 채택된 응답 교체 시 판단 보류·이전 실행 근거 보존·다운로드·복원');
    await shot('three-ai-06-follow-up.png', 'AI 질문 보존·3차시별 정확한 강사 예시의 후속 검증', '.tr-ai-workflow');
    assert.deepEqual(results.pageErrors, []); assert.deepEqual(results.apiMutations, []); assert.deepEqual(results.blockedRequests, []);
    results.aiFollowUp = { status: 'pass', completedAt: new Date().toISOString(), targets: ['기본 질문 복사 시 실제 질문을 저장·내보내기·복원', '차시별 aiResponseExample.text와 출처 표시', '응답 교체 시 판단 보류·이전 검증 근거 보존'], additionalPythonExecutions: 0 };
    results.status = 'pass'; results.completedAt = new Date().toISOString(); save();
    console.log(JSON.stringify({ status: 'pass', followUpOnly: true, checksPassed: results.checks.length, executionCount: results.executions.length, screenshots: results.screenshots.length + results.mobile.length, pageErrors: results.pageErrors.length }));
  } else {
  await page.goto(origin + '/training.html');
  await field('연수 과정 선택').waitFor();
  const legacy = { schema: 1, aiPolicy: 'disabled', activities: { 'first-light': { code: sourceFor('first-light').replace('radius = 0.6', 'radius = 0.7'), prediction: '기존 6차시 기록 보존 · 합성 검증' } }, completed: [1], plan: { subject: '기존 6차시 수업안 · 합성 검증' } };
  await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: legacyKey, value: legacy });

  for (program of programs) {
    const ai = program.id === 'three-ai', prefix = ai ? 'three-ai' : 'three-no-ai';
    await page.goto(`${origin}/training.html?course=${program.id}`);
    await page.getByRole('heading', { name: program.title, exact: true }).waitFor();
    assert.equal(await field('연수 과정 선택').inputValue(), program.id);
    assert.equal(await field('AI 사용 방식').count(), 0);
    assert.equal(await page.locator('.tr-session-cards>button').count(), 3);
    assert.match(await page.locator('.tr-hero').innerText(), /150분/);
    await shot(`${prefix}-01-overview.png`, `${program.shortTitle} 안내·150분·독립 과정`);
    pass(`${program.id} · 직접 URL·3차시·고정 AI 정책`);

    await page.getByRole('button', { name: '1차시 시작하기 →', exact: true }).click();
    assert.equal((await editor().inputValue()).trimEnd().split('\n').length, 8);
    assert.equal(await editor().inputValue(), sourceFor('first-light'));
    assert.equal(await page.locator('.tr-ai-workflow').count(), ai ? 1 : 0);
    if (ai) assert.equal(await page.getByRole('button', { name: 'AI 질문 복사', exact: true }).isDisabled(), true);
    const prediction1 = `${program.id} · 합성 예상1: 반지름만 커지고 원점은 유지된다.`;
    await field('실행 전 예상').fill(prediction1);
    if (ai) {
      assert.equal(await page.getByRole('button', { name: 'AI 질문 복사', exact: true }).isDisabled(), false);
      await page.getByRole('button', { name: 'AI 질문 복사', exact: true }).click();
      const copied = await page.evaluate(() => navigator.clipboard.readText());
      assert.ok(copied.includes(prediction1));
      pass('three-ai · 사전 예상 전 복사 차단·예상 포함 질문 복사');
    }
    await execute('first-light', '원본', sourceFor('first-light'), activityFor('first-light').check);
    await execute('first-light', '한 줄 수정', changedFor('first-light'), variants['first-light']);
    await field('실행 후 관찰').fill(`${program.id} 관찰1: 반지름 출력 0.9, 위치 원점 유지.`);
    await field('짝이 남긴 검토').fill(`${program.id} 짝 검토1 · 합성 폼 기록: 한 줄과 출력 대조.`);
    await page.locator('.tr-checkout input[type="checkbox"]').check();
    if (ai) await recordAi({ status: 'used', tool: '검증용 가상 AI 도구 · 외부 호출 없는 합성 입력', response: '[합성 폼 시험 · 실제 AI 응답 아님] radius가 0.9가 되면 위치도 바뀐다.', verification: '실제 실행: 반지름 0.9, sphere 위치 [0,0,0].', decision: 'rejected', reason: '위치는 유지되므로 위치도 바뀐다는 주장을 거절한다.' });
    await page.reload(); await openSession(1, 'first-light');
    assert.equal(await editor().inputValue(), changedFor('first-light'));
    assert.equal(await field('실행 전 예상').inputValue(), prediction1);
    assert.equal(await page.locator('.tr-checkout input[type="checkbox"]').isChecked(), true);
    if (ai) { await expandAiRecords(); assert.equal(await field('AI 사용 상태').inputValue(), 'used'); assert.equal(await field('AI 도움에 대한 판단').inputValue(), 'rejected'); }
    pass(`${program.id} · 1차시 코드·예상·관찰·검토·판단 새로고침 복원`);

    await openSession(2);
    assert.equal(await page.locator('.tr-activity-heading h2').innerText(), activityFor('sound-steps').title);
    assert.equal(await field('실행 전 예상').inputValue(), '');
    const prediction2 = `${program.id} · 합성 예상2: 가운데 주파수만 바뀌고 나머지는 유지된다.`;
    await field('실행 전 예상').fill(prediction2);
    await execute('sound-steps', '원본', sourceFor('sound-steps'), activityFor('sound-steps').check);
    await execute('sound-steps', '한 줄 수정', changedFor('sound-steps'), variants['sound-steps']);
    await page.getByRole('button', { name: '음소거', exact: true }).click();
    await execute('sound-steps', '무음', changedFor('sound-steps'), variants['sound-steps'], { muted: true });
    await page.getByRole('button', { name: '소리 켜기', exact: true }).click();
    await field('실행 후 관찰').fill(`${program.id} 관찰2: 220/330/880Hz, 막대 1/1.5/4, 무음도 동일.`);
    await field('짝이 남긴 검토').fill(`${program.id} 짝 검토2 · 합성: 첫째·셋째 값 고정.`);
    if (ai) {
      await recordAi({ status: 'unavailable', tool: '연결 없음 · 도움말 검산 경로의 합성 폼 시험', response: '', verification: '직접 실행으로 330Hz와 막대 1.5를 확인함.', decision: 'pending', reason: '외부 AI 응답이 없어 AI 주장 판단은 보류함.' });
      assert.equal((await readState(program.id)).activities['2:sound-steps'].aiUseStatus, 'unavailable');
      pass('three-ai · AI 연결 어려움 출처와 직접 검증 경로');
      await recordAi({ status: 'example-only', tool: '강사 작성 검토 예시 · 실제 AI 응답 아님', response: program.sessions[1].aiResponseExample.text, verification: '실제 출력 220/330/880Hz·막대1/1.5/4. 음 길이0.45는 고정.', decision: 'partly-adopted', reason: '가운데 높이1.5는 확인했고 음 길이도 바뀐다는 주장은 코드로 거절함.' });
    }
    await shot(`${prefix}-02-practice.png`, `${program.shortTitle} · 주파수 한 값 수정·3색·무음 재현`, '.tr-activity-heading');

    await openSession(2, 'math-proportion');
    await field('실행 전 예상').fill(`${program.id} 선택 경로 합성 예상: 같은 x의 y가 두 배, 원점 유지.`);
    await execute('math-proportion', '원본', sourceFor('math-proportion'), activityFor('math-proportion').check);
    await execute('math-proportion', '한 줄 수정', changedFor('math-proportion'), variants['math-proportion']);
    pass(`${program.id} · 비례 대체 경로·다섯 점과 원점 확인`);
    await openSession(2, 'sound-steps');
    assert.equal(await field('실행 전 예상').inputValue(), prediction2);
    assert.equal(await editor().inputValue(), changedFor('sound-steps'));
    await page.locator('.tr-checkout input[type="checkbox"]').check();

    await page.getByRole('button', { name: '다음 차시 →', exact: true }).click();
    assert.equal(await page.locator('.tr-session-intro h1').innerText(), program.sessions[2].title);
    assert.equal(await page.locator('.tr-activity-heading h2').innerText(), activityFor('sound-steps').title);
    assert.equal(await editor().inputValue(), changedFor('sound-steps'));
    for (const title of ['실행 전 예상', '실행 후 관찰', '짝이 남긴 검토']) assert.equal(await field(title).inputValue(), '');
    pass(`${program.id} · 3차시 선택 유지·코드만 상속·개인 기록 분리`);
    if (ai) {
      await expandAiRecords(); assert.equal(await field('받은 AI 응답·검토 예시').inputValue(), '');
      await page.getByText('지난 차시의 응답을 다시 검토하기', { exact: true }).click();
      await page.getByRole('button', { name: '지난 응답을 가져와 재검토', exact: true }).click();
      assert.equal(await field('받은 AI 응답·검토 예시').inputValue(), program.sessions[1].aiResponseExample.text);
      assert.equal(await field('AI 도움에 대한 판단').inputValue(), 'pending');
      assert.equal(await field('AI 답을 확인한 실행·수치').inputValue(), '');
      pass('three-ai · 이전 응답 읽기·명시적 재사용·판단과 검증 새 기록');
    }
    const prediction3 = `${program.id} · 합성 예상3: 동료도 같은 조건에서 330Hz를 재현한다.`;
    await field('실행 전 예상').fill(prediction3);
    await execute('sound-steps', '3차시 재현', changedFor('sound-steps'), variants['sound-steps']);
    await field('실행 후 관찰').fill(`${program.id} 관찰3: 실제 재실행에서 330Hz·막대1.5 확인.`);
    await field('판단한 이유').fill('가운데 값만 바꿔 고정한 첫째·셋째와 비교했다.');
    await field('짝이 남긴 검토').fill(`${program.id} 짝 검토3 · 자동화가 입력한 합성 폼 예시이며 실제 교사 활동 아님.`);
    await field('다음에 확인할 것').fill('학생에게 같은 조건을 다시 실행하게 하고 이유를 묻는다.');
    if (ai) await recordAi({ status: 'example-only', tool: '강사 작성 검토 예시 · 실제 AI 응답 아님', response: program.sessions[2].aiResponseExample.text, verification: '같은 코드의 실제 재실행에서 330Hz·1.5 높이를 확인. 동료 수행은 합성 폼 검증과 구별.', decision: 'rejected', reason: '한 줄 수정이어도 동료가 직접 같은 조건을 재현해야 하므로 무실행 승인은 거절한다.' });
    const info = await (await page.request.get(origin + '/api/training-info')).json();
    const targetPrefix = ai ? 'ai' : 'no-ai';
    for (const [kind, title] of [['math', '비례 실험 팀 열기 ↗'], ['sound', '소리 실험 팀 열기 ↗']]) {
      const expected = info.projects[`${targetPrefix}-${kind}`]; assert.ok(expected?.id);
      assert.equal(await page.getByRole('link', { name: title, exact: true }).getAttribute('href'), `/classroom.html#/projects/${expected.id}`);
    }
    assert.equal(info.mode, 'offline');
    await page.getByText('교실로 옮길 변경 제안 문장 보기', { exact: true }).click();
    assert.match(await page.locator('.tr-collaboration .tr-proposal-summary').innerText(), new RegExp(program.id));
    await shot(`${prefix}-03-collaboration.png`, `${program.shortTitle} · 제안 문장·짝 검토·전용 팀 연결`, '.tr-collaboration');
    pass(`${program.id} · 협력 순서·제안 문장·별도 팀 연결·외부전송 OFF`);
    await page.locator('.tr-checkout input[type="checkbox"]').check();
    const beforePlan = await readState(program.id);
    assert.equal(beforePlan.activities['2:sound-steps'].prediction, prediction2);
    assert.equal(beforePlan.activities['3:sound-steps'].prediction, prediction3);
    assert.ok(beforePlan.activities['1:first-light'].code.includes('radius = 0.9'));
    assert.equal(beforePlan.activities['3:sound-steps'].run.status, 'completed');
    await page.getByRole('button', { name: '수업안 작성으로 →', exact: true }).click();
    await page.getByRole('heading', { name: '내 교과의 한 차시로 바꾸기', exact: true }).waitFor();
    const subject = `${program.id} · 합성 수업안: 주파수와 표현`;
    await page.getByText('연수 뒤 보완할 항목·기존 세부 기록', { exact: true }).click();
    await field('교과').fill(subject);
    await field('대상·교과 개념·예측 질문').fill('한 변인 비교·주파수 수치와 막대 표현의 관계');
    await field('교사가 제공할 코드와 도움').fill('실행 골격과 단계별 힌트, 막대·라벨·재생은 제공');
    await field('제공 코드·학생이 수정할 1~3줄').fill('frequencies 가운데 440을 330으로 변경');
    await field('비교 조건 A·B·고정 조건').fill('가운데 주파수 변경, 처음·끝 주파수와 음 길이는 고정');
    await field('처음 줄 발판·거둘 기준').fill('먼저 값 후보 제공, 짝 재현과 수치 설명 후 후보 철회');
    if (ai) { await page.getByText('AI 도움 범위의 추가 기록', { exact: true }).click(); await field('AI에게 맡긴 일과 직접 판단한 일').fill('합성 폼 시험이며 실제 AI 호출 없음. 강사 예시의 주장을 직접 실행한330Hz·막대1.5로 검증함.'); }
    await page.getByRole('button', { name: '시연·짝 피드백 확인하기', exact: true }).click();
    await shot(`${prefix}-04-plan.png`, `${program.shortTitle} · 학생 수정 한 줄·발판·교과 수업안`);
    const markdown = await download('나의 수업안 받기 ↓', 'vpylab-my-lesson-plan.md');
    assert.ok(markdown.includes(subject)); assert.ok(markdown.includes(program.shortTitle));
    assert.match(markdown, ai ? /AI 사용 방식: 선택 사용/ : /AI 사용 방식: 미사용/);
    if (ai) assert.match(markdown, /합성 폼 시험이며 실제 AI 호출 없음/);
    const exported = JSON.parse(await download('내 연수 기록 받기 ↓', 'vpylab-my-training.json'));
    assert.equal(exported.courseId, program.id); assert.equal(exported.sessionCount, 3);
    assert.equal(exported.aiPolicy, ai ? 'optional' : 'disabled');
    assert.equal(exported.activities['2:sound-steps'].prediction, prediction2); assert.equal(exported.activities['3:sound-steps'].prediction, prediction3);
    assert.equal(exported.activities['3:sound-steps'].codeFile, 'science/sound-steps.py');
    if (ai) { assert.equal(exported.activities['3:sound-steps'].aiDecision, 'rejected'); assert.equal(exported.activities['3:sound-steps'].aiReusedFromSession, 2); }
    else assert.ok(Object.values(exported.activities).every(value => !value.aiResponse && !value.aiTool));
    assert.deepEqual(exported.completed.sort(), [1, 2, 3]);
    pass(`${program.id} · 코드·차시별 성찰·AI출처·수업안 실제 다운로드`);
    await page.reload(); await page.getByRole('button', { name: '나의 수업안', exact: true }).click();
    assert.equal(await field('교과').inputValue(), subject);
    await openSession(3, 'sound-steps'); assert.equal(await field('실행 전 예상').inputValue(), prediction3);
    pass(`${program.id} · 최종 수업안과 3차시 기록 새로고침 복원`);
    results.courses.push({ courseId: program.id, storageKey: storageKey(program.id), aiPolicy: exported.aiPolicy, recordKeys: Object.keys(exported.activities), completed: exported.completed, subject, downloadedMarkdown: true, downloadedJson: true });
  }

  for (const target of results.courses) {
    await field('연수 과정 선택').selectOption(target.courseId);
    await page.waitForURL(`**/training.html?course=${target.courseId}`);
    await page.getByRole('button', { name: '나의 수업안', exact: true }).click();
    assert.equal(await field('교과').inputValue(), target.subject);
    const current = await readState(target.courseId); assert.equal(current.plan.subject, target.subject);
  }
  pass('두 3차시 과정 전환 시 코드·성찰·수업안·AI 정책 격리');
  await field('연수 과정 선택').selectOption('intro-6'); await page.waitForURL('**/training.html');
  assert.equal(await page.locator('.tr-session-cards>button').count(), 6);
  assert.equal(await field('AI 사용 방식').inputValue(), 'disabled');
  await page.getByRole('button', { name: '1차시 시작하기 →', exact: true }).click();
  assert.match(await editor().inputValue(), /radius = 0.7/);
  assert.equal(await field('실행 전 예상').inputValue(), legacy.activities['first-light'].prediction);
  await page.getByRole('button', { name: '나의 수업안', exact: true }).click();
  assert.equal(await field('교과').inputValue(), legacy.plan.subject);
  pass('기존 6차시 안내·원래 저장키·수정 코드·수업안 보존');

  const mobile = await context.newPage(); mobile.on('pageerror', error => results.pageErrors.push(error.message));
  await mobile.setViewportSize({ width: 390, height: 844 });
  for (const target of programs) {
    await mobile.goto(`${origin}/training.html?course=${target.id}`);
    await mobile.getByRole('heading', { name: target.title, exact: true }).waitFor(); await mobile.evaluate(() => document.fonts.ready);
    const size = await mobile.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
    assert.equal(size.document, 390); assert.equal(size.body, 390);
    await mobile.screenshot({ path: join(captures, `${target.id}-05-mobile.png`), animations: 'disabled' });
    results.mobile.push({ courseId: target.id, ...size, screenshot: `${target.id}-05-mobile.png` });
    pass(`${target.id} · 390px 안내 수평 넘침 없음`);
  }
  await mobile.close();
  assert.deepEqual(results.pageErrors, []); assert.deepEqual(results.apiMutations, []); assert.deepEqual(results.blockedRequests, []);
  pass('페이지 오류·API 변경 요청·외부 AI/GitHub 호출 0');
  results.status = 'pass'; results.fullRunStatus = 'pass'; results.completedAt = new Date().toISOString(); save();
  console.log(JSON.stringify({ status: results.status, checksPassed: results.checks.length, executionCount: results.executions.length, screenshots: results.screenshots.length + results.mobile.length, pageErrors: results.pageErrors.length }));
  }
} catch (error) {
  results.status = 'fail'; results.failure = { message: error.message, stack: error.stack, url: page.url() }; results.completedAt = new Date().toISOString();
  await page.screenshot({ path: join(captures, 'three-browser-failure.png'), fullPage: true }).catch(() => {}); save();
  console.error(error.stack); process.exitCode = 1;
} finally { await browser.close(); }

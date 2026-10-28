import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { projectDir } from '../project-paths.mjs';

// A fresh browser and synthetic records only; no live AI or GitHub writes.
const root = projectDir('vpylab-teacher-training');
const origin = 'http://127.0.0.1:4093';
const report = { status: 'running', testedAt: new Date().toISOString(), synthetic: true, checks: [], executions: [], screenshots: [], errors: [], blockedRequests: [] };
const save = () => writeFileSync(join(root, 'validation/three-way-follow-up-validation.json'), JSON.stringify(report, null, 2) + '\n');
const pass = name => { report.checks.push(name); save(); console.log(`통과: ${name}`); };
const automation = await import(process.env.VPYLAB_PLAYWRIGHT_MODULE ? pathToFileURL(resolve(process.env.VPYLAB_PLAYWRIGHT_MODULE)).href : 'playwright');
const browser = await (automation.default || automation).chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, locale: 'ko-KR', acceptDownloads: true });
await context.route('**/*', async route => {
  const request = route.request(), host = new URL(request.url()).hostname;
  if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method()) || /(^|\.)(github\.com|openai\.com|anthropic\.com|generativelanguage\.googleapis\.com)$/.test(host)) {
    report.blockedRequests.push({ method: request.method(), host }); return route.abort();
  }
  return route.continue();
});
const page = await context.newPage();
page.setDefaultTimeout(60000);
page.on('pageerror', error => report.errors.push(error.message));
const field = name => page.getByLabel(name, { exact: true });
const storageKey = course => 'vpylab:teacher-training:v1' + (course === 'intro-6' ? '' : ':' + course);
async function download(name, json = false) {
  const pending = page.waitForEvent('download'); await page.getByRole('button', { name, exact: true }).click();
  const text = readFileSync(await (await pending).path(), 'utf8'); return json ? JSON.parse(text) : text;
}
async function shot(file, selector) {
  if (selector) await page.locator(selector).scrollIntoViewIfNeeded(); else await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: join(root, 'captures', file), animations: 'disabled', caret: 'hide' });
  report.screenshots.push('captures/' + file); save();
}
try {
  await page.goto(origin + '/training.html');
  await field('연수 과정 선택').waitFor();
  for (const course of ['intro-6', 'three-no-ai', 'three-ai']) {
    const record = { schema: 1, aiPolicy: 'disabled', completed: [], activities: {}, plan: { subject: course + ' 기존 교과 기록', question: '기존 예측 질문', aiBoundary: '기존 AI 도움 기록' } };
    await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: storageKey(course), value: record });
  }
  for (const course of ['three-no-ai', 'three-ai']) {
    await page.goto(`${origin}/training.html?course=${course}`);
    await page.getByRole('button', { name: '나의 수업안', exact: true }).click();
    assert.equal(await page.locator('textarea:visible').count(), 6);
    await field('대상·교과 개념·예측 질문').fill(course + ' · 중학교 비례 / 같은 x에서 y는?');
    await field('제공 코드·학생이 수정할 1~3줄').fill('math/proportion.py의 k=1을 2로');
    await field('비교 조건 A·B·고정 조건').fill('k 1/2 비교; x와 축 유지');
    await field('처음 줄 발판·거둘 기준').fill('첫 계산을 제공하고 같은 x의 y를 설명하면 후보 철회');
    await field(course === 'three-ai' ? '실행 수치·AI 주장 검증·도움 채택/거절 근거' : '소리·색 외에 확인할 수치·모형의 한계').fill('x=4, y=8; 원점 유지; 다섯 점의 모형');
    await field('짝 재현·이해 확인 기준').fill('짝이 같은 조건에서 x=0과 x=4를 실행');
    const plan = await download('나의 수업안 받기 ↓');
    assert.ok(plan.includes(course + ' · 중학교 비례')); assert.ok(plan.includes(course + ' 기존 교과 기록')); assert.ok(plan.includes('기존 예측 질문'));
    if (course === 'three-ai') assert.ok(plan.includes('기존 AI 도움 기록'));
    await page.reload(); await page.getByRole('button', { name: '나의 수업안', exact: true }).click();
    assert.equal(await page.locator('textarea:visible').count(), 6);
    assert.ok((await field('대상·교과 개념·예측 질문').inputValue()).includes(course));
    await page.getByText('연수 뒤 보완할 항목·기존 세부 기록', { exact: true }).click();
    assert.equal(await field('교과').inputValue(), course + ' 기존 교과 기록');
    assert.equal(await field('실행 전에 던질 예측 질문').inputValue(), '기존 예측 질문');
    await page.getByText('연수 뒤 보완할 항목·기존 세부 기록', { exact: true }).click();
    await shot(course + '-07-reviewed-plan.png');
    pass(course + ' · 핵심 6칸 작성·다운로드·새로고침·기존 세부 기록 보존');
    await page.getByRole('button', { name: '실습 워크북', exact: true }).click();
    await page.locator('.tr-session-nav button').nth(2).click();
    assert.match(await page.locator('.tr-collaboration').innerText(), /한 조는 제안 하나/);
    assert.match(await page.locator('.tr-collaboration').innerText(), /마지막 시연/);
    await shot(course + '-08-reviewed-collaboration.png', '.tr-collaboration');
    pass(course + ' · 한 제안의 A/B 분담·기존 변경 기본·새 실험 선택 안내');
  }
  await page.goto(origin + '/training.html'); await page.getByRole('button', { name: '나의 수업안', exact: true }).click();
  assert.equal(await page.locator('textarea:visible').count(), 11);
  assert.equal(await field('교과').inputValue(), 'intro-6 기존 교과 기록');
  pass('기존 6차시 수업안 11칸과 저장 기록 보존');

  await page.goto(origin + '/training.html?course=three-ai'); await page.getByRole('button', { name: '1차시 시작하기 →', exact: true }).click();
  await field('실행 전 예상').fill('[합성] 반지름 변경에서 위치는 유지될 것이다.');
  await page.getByText('응답을 받고, 확인한 근거 기록하기', { exact: true }).click();
  await field('받은 AI 응답·검토 예시').fill('[합성 폼 시험] 위치는 유지됩니다.');
  await field('AI 답을 확인한 실행·수치').fill('[합성] 기존 근거: 0.9에서 좌표 0,0,0');
  await field('채택·거절한 이유').fill('[합성] 이전 판단 이유');
  await field('AI 도움에 대한 판단').selectOption('adopted');
  await field('AI에게 할 질문').fill('[합성 폼 시험] 색만 바꾸면 무엇이 달라지나요?');
  assert.equal(await field('AI 도움에 대한 판단').inputValue(), 'pending');
  assert.ok((await field('받은 AI 응답·검토 예시').inputValue()).includes('위치는 유지'));
  assert.ok((await field('AI 답을 확인한 실행·수치').inputValue()).includes('기존 근거'));
  assert.match(await page.locator('.tr-ai-workflow').innerText(), /질문이나 응답이 바뀌어 판단을 보류/);
  const exported = await download('내 연수 기록 받기 ↓', true);
  assert.equal(exported.activities['1:first-light'].aiDecision, 'pending');
  assert.equal(exported.activities['1:first-light'].aiVerificationNeedsReview, true);
  await page.reload(); await page.getByRole('button', { name: '1차시 시작하기 →', exact: true }).click();
  await page.getByText('응답을 받고, 확인한 근거 기록하기', { exact: true }).click();
  assert.equal(await field('AI 도움에 대한 판단').inputValue(), 'pending');
  assert.ok((await field('채택·거절한 이유').inputValue()).includes('이전'));
  await shot('three-ai-09-question-review.png', '.tr-ai-workflow');
  pass('AI 질문만 변경: 채택 보류·이전 응답/근거/이유 보존·JSON 다운로드·복원');

  await page.locator('.tr-session-nav button').nth(1).click();
  await page.locator('.tr-activity-tabs button').filter({ hasText: '다섯 점' }).click();
  const source = readFileSync(join(root, 'math/proportion.py'), 'utf8');
  const diagnostic = '\nprint("색 확인 cyan", color.cyan.x, color.cyan.y, color.cyan.z)\nprint("색 확인 teal", color.teal.x, color.teal.y, color.teal.z)\nprint("색 확인 gray", color.gray.x, color.gray.y, color.gray.z)\n';
  for (const k of [1, 2]) {
    await field('Python 코드').fill(source.replace('k = 1', 'k = ' + k) + diagnostic);
    const run = page.getByRole('button', { name: '▶ 실행', exact: true });
    await run.waitFor(); await page.waitForFunction(() => [...document.querySelectorAll('button')].some(item => item.textContent === '▶ 실행' && !item.disabled), null, { timeout: 120000 });
    await page.getByRole('button', { name: '기록 비우기', exact: true }).click();
    await page.waitForFunction(() => !document.querySelector('.runtime-console-output')?.textContent.includes('실행을 마쳤습니다.'));
    await run.click();
    await page.waitForFunction(() => document.querySelector('.runtime-console-output')?.textContent.includes('실행을 마쳤습니다.') || document.querySelector('.runtime-error'), null, { timeout: 60000 });
    const output = await page.getByLabel('실행 출력', { exact: true }).innerText();
    assert.equal(await page.locator('.runtime-error').count(), 0, output);
    assert.ok(output.includes('4 ' + 4 * k)); assert.ok(output.includes('0 0'));
    for (const expected of ['cyan 0.0 1.0 1.0', 'teal 0.0 0.5 0.5', 'gray 0.5 0.5 0.5']) assert.ok(output.includes(expected), output);
    await page.waitForFunction(() => document.querySelector('.runtime-status')?.textContent === '실행 준비 완료');
    report.executions.push({ activity: 'math-proportion', k, output });
    pass('실제 Python k=' + k + ' · 비례 출력·cyan/teal/gray 상수');
  }
  await shot('three-ai-10-color-runtime.png', '.tr-practice-grid');
  assert.deepEqual(report.errors, []); assert.deepEqual(report.blockedRequests, []);
  pass('페이지 오류·외부 AI/GitHub 호출·API 변경 요청 0');
  report.status = 'pass'; report.completedAt = new Date().toISOString(); save();
} catch (error) { report.status = 'fail'; report.failure = error.stack; save(); console.error(error.stack); process.exitCode = 1; }
finally { await browser.close(); }

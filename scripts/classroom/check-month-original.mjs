import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const runtimeModule = process.env.VPYLAB_PLAYWRIGHT_MODULE || process.env.CODEX_PLAYWRIGHT_PATH;
const automation = await import(runtimeModule ? pathToFileURL(resolve(runtimeModule)).href : 'playwright');
const { chromium } = automation.default || automation;
const baseUrl = process.env.MONTH_PROJECTS_URL || 'http://127.0.0.1:4083';
const outputDirectory = fileURLToPath(new URL('../../docs/month-projects/2026-10-28/screenshots/', import.meta.url));
await mkdir(outputDirectory, { recursive: true });
const report = { project: 'original', url: `${baseUrl}/month-projects.html#original`, kind: 'fresh-headless-browser-real-Pyodide-Three-WebAudio', completedAt: null, checks: [], pageErrors: [], consoleErrors: [], hmrEvents: [], screenshots: [], limitations: ['Chromium을 --mute-audio로 실행하므로 실제 스피커 청감 평가는 하지 않습니다. Web Audio 상태·음소거·예약음 처리를 검사합니다.', '합성 프로젝트의 모형 시간·결정적 수치를 확인하며 실제 수업 시간이나 재난 안전을 입증하지 않습니다.'] };
let browser, page;
function record(name, details) { report.checks.push({ name, passed: true, ...(details ? { details } : {}) }); console.log('PASS', name); }
try {
  validation: {
  browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio', '--disable-dev-shm-usage'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 2 });
  page = await context.newPage();
  page.on('pageerror', error => report.pageErrors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') report.consoleErrors.push(message.text());
    if (message.text().includes('[vite] hot updated') || message.text().includes('ReactDOMClient.createRoot()')) {
      report.hmrEvents.push(message.text());
      void page.evaluate(() => { window.__monthTestHmr = true; }).catch(() => {});
    }
  });
  let documentLoads = 0;
  page.on('framenavigated', frame => { if (frame === page.mainFrame()) documentLoads++; });
  const snapshot = () => page.evaluate(async () => (await import('/src/engine/object-registry.js')).getSnapshot());
  const audioState = () => page.evaluate(async () => (await import('/src/engine/sound-system.js')).getAudioState());
  const output = () => page.getByLabel('실행 출력').innerText();
  const waitLabel = async (part, timeout = 15_000) => page.waitForFunction(async part => (await import('/src/engine/object-registry.js')).getSnapshot().some(item => item.type === 'label' && String(item.props.text).includes(part)), part, { timeout });
  const widgets = () => page.locator('[data-vpylab-widgets]');
  const click = text => widgets().getByRole('button', { name: text, exact: true }).click();
  const picture = async (name, target = page.locator('.classroom-runtime')) => {
    const file = `original-${name}.png`;
    await target.screenshot({ path: join(outputDirectory, file) }); report.screenshots.push(file);
  };
  const chooseConditions = async (count, interval) => {
    const ranges = widgets().locator('input[type=range]');
    await ranges.nth(0).fill(String(count)); await ranges.nth(0).dispatchEvent('input');
    await ranges.nth(1).fill(String(interval)); await ranges.nth(1).dispatchEvent('input');
    await waitLabel(`조건 변경: ${count}명 / 출구별 ${Number(interval)}초`);
  };
  const waitResultCount = async count => {
    await page.waitForFunction(count => window.__monthTestHmr || (document.querySelector('[aria-label="실행 출력"]')?.textContent.match(/RESULT\|original\|/g) || []).length >= count, count, { timeout: 85_000 });
    assert.equal(report.hmrEvents.length, 0, '실행 도중 HMR이 발생했습니다. 파일 변경 종료 후 새 브라우저로 다시 검증해야 합니다.');
  };
  await page.goto(report.url, { waitUntil: 'domcontentloaded' });
  const run = page.getByRole('button', { name: '▶ 실행', exact: true });
  await run.waitFor({ timeout: 180_000 });
  await page.waitForFunction(() => { const button = [...document.querySelectorAll('button')].find(node => node.textContent === '▶ 실행'); return button && !button.disabled; }, null, { timeout: 180_000 });
  await run.click();
  await widgets().getByRole('button', { name: '세 전략 자동 비교', exact: true }).waitFor({ timeout: 45_000 });
  await waitLabel('처음 상태입니다');
  let initial = await snapshot();
  const people = initial.filter(item => item.type === 'sphere');
  assert.equal(people.length, 48); assert.equal(people.filter(item => item.props.visible !== false).length, 36);
  report.initialObjectCount = initial.length; report.personIds = people.map(item => item.id);
  record('Python·3D 실제 실행 및 기본 36명/48개 객체 생성');
  assert.equal((await audioState()).playing, false); record('프로젝트 기본 무음 상태');
  await picture('01-ready');

  await click('실험 시작');
  await waitLabel('모형 시간 3.');
  await click('일시정지');
  await waitLabel('일시정지:');
  const paused = (await snapshot()).filter(item => item.type === 'sphere' || (item.type === 'label' && String(item.props.text).includes('모형 시간')));
  await page.waitForTimeout(850);
  const still = (await snapshot()).filter(item => item.type === 'sphere' || (item.type === 'label' && String(item.props.text).includes('모형 시간')));
  assert.deepEqual(still.map(item => ({ id: item.id, pos: item.props.pos, text: item.props.text })), paused.map(item => ({ id: item.id, pos: item.props.pos, text: item.props.text })));
  assert.equal(await widgets().locator('select').isDisabled(), true);
  record('일시정지 시 모형 시간·48개 위치 보존 및 조건 잠금');
  await picture('02-paused');
  await click('계속하기'); await waitLabel('모형 시간 6.');
  assert.notDeepEqual((await snapshot()).filter(item => item.type === 'sphere').map(item => item.props.pos), people.map(item => item.props.pos));
  record('계속하기 후 실제 위치 이동');
  const moving = await snapshot();
  report.movingColors = [...new Set(moving.filter(item => item.type === 'sphere' && item.props.visible !== false).map(item => JSON.stringify(item.props.color)))];
  await click('처음으로'); await waitLabel('모형 시간 0초');
  record('실행 중 초기화·통과 수와 시각 0 복원');

  await click('세 전략 자동 비교'); await waitResultCount(3);
  await waitLabel('집중 → 분산: 완료 시간 차이');
  const lines = (await output()).split('\n').filter(line => line.startsWith('RESULT|original|'));
  assert.equal(lines.length, 3);
  const expected = [32.7, 17.1, 20.3];
  for (let index = 0; index < 3; index++) assert.equal(Number(/\|time=([\d.]+)/.exec(lines[index])?.[1]), expected[index]);
  report.defaultResults = lines;
  const completed = await snapshot();
  assert.deepEqual(completed.filter(item => item.type === 'sphere').map(item => item.id), report.personIds);
  assert.equal(completed.length, report.initialObjectCount);
  assert.equal(completed.filter(item => item.type === 'sphere' && item.props.visible !== false).length, 36);
  assert.ok(completed.filter(item => item.type === 'sphere' && item.props.visible !== false).every(item => JSON.stringify(item.props.color) === JSON.stringify([0.6, 1, 0.8])));
  record('세 전략 끝까지 실행·32.7/17.1/20.3초 검증', lines);
  record('완료 민트색·전체 객체 수 유지·48개 사람 ID 재사용');
  await picture('03-comparison-complete');
  if (process.env.MONTH_PROJECTS_CHECK === 'visual') {
    assert.equal(report.pageErrors.length, 0); assert.equal(report.consoleErrors.length, 0); assert.equal(report.hmrEvents.length, 0);
    assert.equal((await output()).includes('[event handler error]'), false);
    report.passed = true; report.mode = 'final-presentation-and-default-three-strategies';
    record('최종 표시 좌표에서 세 전략·오류 0 재확인');
    break validation;
  }

  await widgets().locator('select').selectOption('두 출구 분산');
  await waitLabel('전략 선택: 두 출구 분산');
  await chooseConditions(24, 0.4);
  const reset = await snapshot();
  assert.equal(reset.filter(item => item.type === 'sphere' && item.props.visible !== false).length, 24);
  assert.ok(reset.some(item => item.type === 'label' && String(item.props.text).includes('아직 측정하지 않음')));
  await click('실험 시작'); await waitResultCount(4); await waitLabel('완료: 모든 사람');
  const boundaryLow = (await output()).split('\n').filter(line => line.startsWith('RESULT|original|')).at(-1);
  assert.ok(boundaryLow.includes('|people=24|interval=0.4|'));
  record('전략 선택·24명/0.4초 경계 조건 완료·이전 비교표 제거', boundaryLow);
  await chooseConditions(48, 1.2);
  await click('실험 시작'); await waitResultCount(5); await waitLabel('완료: 모든 사람');
  const boundaryHigh = (await output()).split('\n').filter(line => line.startsWith('RESULT|original|')).at(-1);
  assert.ok(boundaryHigh.includes('|people=48|interval=1.2|'));
  const high = await snapshot();
  assert.equal(high.filter(item => item.type === 'sphere' && item.props.visible !== false).length, 48);
  assert.deepEqual(high.filter(item => item.type === 'sphere').map(item => item.id), report.personIds);
  record('48명/1.2초 경계 조건 완료·동일 객체 재사용', boundaryHigh);
  await picture('04-boundary-48');

  await click('소리: 꺼짐');
  await widgets().getByRole('button', { name: '소리: 켜짐', exact: true }).waitFor();
  await page.waitForFunction(async () => (await import('/src/engine/sound-system.js')).getAudioState().playing, null, { timeout: 5_000 });
  record('프로젝트 소리 켜기: 실제 Web Audio 재생 상태');
  report.audioEnabled = await audioState();
  for (const mode of ['한 출구 집중', '두 출구 분산', '분산 + 출발 시차']) {
    await widgets().locator('select').selectOption(mode);
    await waitLabel(`전략 선택: ${mode}`);
    await click('선택 전략 음형 듣기');
    await waitLabel('전략 음형:');
    await page.waitForFunction(async () => (await import('/src/engine/sound-system.js')).getAudioState().playing, null, { timeout: 5_000 });
    const state = await audioState(); assert.ok(state.voiceCount > 0 || state.pendingCount > 0);
    report.checks.push({ name: `전략 음형 ${mode}`, passed: true, details: state });
    await page.waitForFunction(async () => !(await import('/src/engine/sound-system.js')).getAudioState().playing, null, { timeout: 5_000 });
  }
  await page.getByRole('button', { name: '음소거', exact: true }).click();
  await page.waitForFunction(async () => (await import('/src/engine/sound-system.js')).getAudioState().muted);
  await click('선택 전략 음형 듣기');
  await page.waitForTimeout(250);
  assert.equal((await audioState()).playing, false);
  assert.equal((await audioState()).muted, true);
  record('마스터 음소거에서 프로젝트 음형 요청도 무음·예약음 정지');
  await picture('05-master-muted');
  await page.getByRole('button', { name: '소리 켜기', exact: true }).click();
  await click('소리: 켜짐');
  await widgets().getByRole('button', { name: '소리: 꺼짐', exact: true }).waitFor();
  await chooseConditions(36, 0.8);
  await widgets().locator('select').selectOption('한 출구 집중');
  await click('처음으로');
  await waitLabel('처음 상태입니다');
  record('시험 후 기본 조건·프로젝트 무음·초기 상태 복원');
  const errorOutput = await output();
  assert.equal(errorOutput.includes('[event handler error]'), false);
  assert.equal(errorOutput.includes('Traceback'), false);
  assert.equal(report.pageErrors.length, 0);
  assert.equal(report.consoleErrors.length, 0);
  assert.equal(documentLoads, 1, 'HMR/재탐색으로 시험이 중간 초기화됨');
  record('pageerror·콘솔 오류·이벤트 핸들러 오류·Traceback 0');
  report.boundaryResults = [boundaryLow, boundaryHigh]; report.documentLoads = documentLoads;
  await picture('06-final-restored');
  report.passed = true; report.mode = 'full-interaction-boundaries-audio';
  }
} catch (error) {
  report.passed = false; report.failure = error.stack || String(error); console.error(report.failure); process.exitCode = 1;
  if (page && !page.isClosed()) {
    report.failureOutput = await page.getByLabel('실행 출력').innerText().catch(() => null);
    report.failureSnapshot = await page.evaluate(async () => (await import('/src/engine/object-registry.js')).getSnapshot()).catch(() => null);
    await page.screenshot({ path: join(outputDirectory, 'original-failure.png') }).catch(() => {});
  }
} finally {
  report.completedAt = new Date().toISOString();
  await writeFile(join(outputDirectory, 'original-browser-validation.json'), JSON.stringify(report, null, 2));
  await writeFile(join(outputDirectory, `original-browser-validation-${report.completedAt.replaceAll(/[:.]/g, '-')}.json`), JSON.stringify(report, null, 2));
  await browser?.close();
}

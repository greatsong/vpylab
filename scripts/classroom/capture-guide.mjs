import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// 별도 브라우저 프로필과 안내용 복사본만 사용합니다. 로그인 정보는 가져오지 않습니다.
const root = fileURLToPath(new URL('../../', import.meta.url));
const metadata = JSON.parse(readFileSync(resolve(root, '.local/guide-capture/latest.json'), 'utf8'));
assert.equal(metadata.externalNetworkBlocked, true);
assert.equal(metadata.workerStarted, false);
const origin = `http://127.0.0.1:${metadata.ports.frontend}`;
assert.equal(origin, 'http://127.0.0.1:4073');
const workspace = `${origin}/classroom.html#/projects/${metadata.projectId}`;
const output = resolve(root, 'docs/guide-captures/2026-10-28');
mkdirSync(output, { recursive: true });
const playwrightModule = process.env.VPYLAB_PLAYWRIGHT_MODULE;
const automation = await import(playwrightModule ? pathToFileURL(resolve(playwrightModule)).href : 'playwright');
const { chromium } = automation.default || automation;
const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 2, locale: 'ko-KR', timezoneId: 'Asia/Seoul', colorScheme: 'light' });
const captureClientId = `guide-capture-${Date.now()}`;
await context.addInitScript(clientId => sessionStorage.setItem('vpylab:v2:client', clientId), captureClientId);
await context.route(/^https:\/\/(api\.)?github\.com\//, route => route.abort());
const page = await context.newPage();
const failures = [], mutations = [], shots = [];
page.on('pageerror', error => failures.push(error.message));
page.on('request', request => {
  if (request.url().startsWith(origin + '/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) mutations.push({ method: request.method(), path: new URL(request.url()).pathname });
});
page.setDefaultTimeout(20000);
const saveManifest = () => writeFileSync(resolve(output, 'manifest.json'), JSON.stringify({ capturedAt: new Date().toISOString(), viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 2, projectId: metadata.projectId, source: 'isolated-guide-copy', originalFingerprint: metadata.originalFingerprint, fixturesAdded: metadata.fixturesAdded, externalGitHubWrites: 0, screenshots: shots }, null, 2) + '\n');
async function shot(file, title, role, purpose, { top = true } = {}) {
  if (top) await page.evaluate(() => window.scrollTo(0, 0));
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: resolve(output, file), animations: 'disabled', caret: 'hide' });
  shots.push({ file, title, role, purpose, url: page.url(), pixels: { width: 2880, height: 2200 } });
  saveManifest();
  process.stdout.write(`캡처 ${shots.length}: ${file} · ${title}\n`);
}
async function switchRole(name) {
  const menu = page.getByRole('button', { name: /계정 메뉴/ });
  if (await menu.count()) await menu.click();
  await page.getByRole('button', { name, exact: true }).click();
  await page.getByRole('heading', { name: name === '선생님' ? '함께 자라는 프로젝트' : '오늘, 어떤 생각을 실험할까요?' }).waitFor();
}
async function openProject(process = false) {
  await page.goto(workspace + (process ? '/process' : ''));
  await page.getByRole('heading', { name: /반지름과 충돌 조건 탐구/ }).waitFor();
}
async function tab(name) {
  const button = page.getByRole('tab', { name });
  await button.click();
  assert.equal(await button.getAttribute('aria-selected'), 'true');
}

try {
  await page.goto(origin + '/classroom.html');
  await page.getByRole('heading', { name: '어떤 역할로 살펴볼까요?' }).waitFor();
  await shot('00-welcome.png', '교실에 들어가기', '입장 전', '로컬 안내용 역할 선택 화면입니다. 실제 GitHub OAuth 로그인 화면과 구분합니다.');
  await switchRole('학생 가');
  await shot('01-project-home.png', '프로젝트와 팀 참여', '학생 가', '내 프로젝트를 열거나 초대 코드로 팀에 참여합니다.');

  await page.getByRole('button', { name: /새 프로젝트/ }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('프로젝트 이름').fill('반지름과 충돌 조건 탐구');
  await dialog.getByLabel('해결하고 싶은 문제').fill('공의 반지름을 바꾸면 접촉 조건은 어떻게 달라질까요?');
  await dialog.getByLabel('성공했다고 판단할 기준').fill('한 조건씩 바꿔 실행하고 동료가 제시한 반례를 검토합니다.');
  await shot('02-new-project-policy.png', '문제와 수업 방식 정하기', '학생 가', 'AI 선택 사용과 AI 미사용 수업 중 수업 방식을 선택할 수 있습니다. 프로젝트는 제출하지 않았습니다.');
  await dialog.getByRole('button', { name: '닫기', exact: true }).click();

  await page.getByRole('link', { name: '수업 자료', exact: true }).click();
  await page.getByRole('heading', { name: '배움의 재료들' }).waitFor();
  await shot('03-course-materials.png', '수업 자료에서 출발하기', '학생 가', '기존 코스·차시·미션·예제를 살려 새로운 프로젝트의 재료로 사용합니다.');

  const projectResponse = await context.request.get(`${origin}/api/v2/projects/${metadata.projectId}`, { headers: { 'X-Classroom-User': 'student-a' } });
  assert.equal(projectResponse.status(), 200);
  const { project } = await projectResponse.json();
  const guideCode = 'from vpython import *\n\n# 반지름만 바꾸고 다른 조건은 같게 두어요.\nscene.title = "반지름을 바꾸면 무엇이 달라질까?"\nleft = sphere(pos=vector(-1.4, 0.6, 0), radius=0.5, color=color.blue)\nright = sphere(pos=vector(1.4, 0.8, 0), radius=0.8, color=color.cyan)\nground = box(pos=vector(0, -0.1, 0), size=vector(6, 0.2, 3), color=color.white)\n\nplay_note("C5", 0.4, "musicbox")\nsleep(0.5)\nplay_note("E5", 0.4, "musicbox")\nprint("두 반지름을 같은 조건에서 비교해요.")\n';
  const draftPath = `/api/v2/projects/${metadata.projectId}/drafts`;
  const draftResponse = await context.request.put(origin + draftPath, { headers: { Origin: origin, 'X-Classroom-User': 'student-a' }, data: { clientId: captureClientId, clientSequence: 1, baseVersion: project.version, code: guideCode } });
  assert.equal(draftResponse.status(), 200);
  mutations.push({ method: 'PUT', path: draftPath, purpose: '안내 복사본의 학생 개인 초안 준비' });
  await openProject();
  await tab(/문제와 질문/);
  await shot('04-problem-and-question.png', '문제를 정의하고 질문 남기기', '학생 가', '성공 기준과 AI 미사용 정책을 확인하고 팀의 질문을 기록합니다. 질문은 안내용 복사본의 합성 자료입니다.');

  await tab(/제작과 실험/);
  const editor = page.locator('.monaco-editor textarea').first();
  await editor.waitFor();
  assert.match(await page.locator('.monaco-editor .view-lines').innerText(), /left/);
  await page.getByRole('button', { name: '▶ 실행', exact: true }).waitFor({ state: 'visible', timeout: 60000 });
  await page.waitForFunction(() => [...document.querySelectorAll('button')].some(button => button.textContent === '▶ 실행' && !button.disabled), null, { timeout: 120000 });
  await page.getByRole('button', { name: '▶ 실행', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.runtime-console-output')?.textContent.includes('두 반지름을 같은 조건에서 비교해요.') || document.querySelector('.runtime-error'), null, { timeout: 60000 });
  assert.match(await page.getByLabel('실행 출력').innerText(), /두 반지름을 같은 조건에서 비교해요\./);
  await shot('05-python-3d-sound.png', 'Python·3D·소리를 함께 실험하기', '학생 가', '개인 초안에서 두 반지름을 비교하는 코드가 실제로 실행된 화면입니다. 소리 조절 UI를 포함하며 정지 이미지는 음질 검증을 뜻하지 않습니다.');

  await page.getByRole('button', { name: '변경 제안 ↗', exact: true }).click();
  await dialog.getByLabel('제안 제목').fill('두 반지름을 같은 조건에서 비교하기');
  await dialog.getByLabel('예상과 가설').fill('반지름이 큰 공이 더 이른 시점에 다른 물체와 만날 것으로 예상했어요.');
  await dialog.getByLabel('실험과 관찰').fill('출발 위치는 같게 두고 반지름 0.5와 0.8을 비교했어요.');
  await dialog.getByLabel('판단한 이유').fill('반지름 외의 조건을 같게 두어 변화의 원인을 구분했어요.');
  await dialog.getByLabel('다음에 확인할 것').fill('다음에는 관찰 시간을 5초로 통일해 비교해요.');
  await shot('06-proposal-evidence.png', '변경 이유와 실험 근거 남기기', '학생 가', '가설·관찰·판단·다음 실험을 적는 교실 안 변경 제안입니다. 모달은 촬영 뒤 취소했습니다.');
  await dialog.getByRole('button', { name: '닫기', exact: true }).click();
  await tab(/함께 검토/);
  await page.getByRole('heading', { name: '두 반지름을 같은 조건에서 비교하기', exact: true }).waitFor();
  await shot('07-local-peer-review.png', '교실 안에서 동료와 검토하기', '학생 가', '복사본의 합성 로컬 제안·승인입니다. 화면 안내처럼 GitHub PR 리뷰와 별도입니다.');

  await tab('팀·연결');
  await page.getByText('greatsong/vpylab-private-classroom-e2e-20261028', { exact: true }).waitFor();
  await page.getByRole('link', { name: 'PR 열기 ↗', exact: true }).waitFor();
  await shot('08-github-team-connection.png', 'GitHub 저장소와 PR 상태 확인하기', '학생 가', '실제 시험 저장소와 완료된 PR #3의 원문 링크입니다. 외부 전송·동기화 버튼은 누르지 않았습니다.');

  await switchRole('선생님');
  await openProject(true);
  await page.getByRole('heading', { name: '협력 과정 기록', exact: true }).waitFor();
  await page.getByLabel('관찰할 학생').selectOption('student-b');
  await page.getByText(/GitHub @greatsong-danggok/).waitFor();
  await shot('09-teacher-github-process.png', '실제 GitHub 협력을 학생별로 살펴보기', '선생님', '실제 두 계정 시험의 PR·검토 의견·승인과 학생 나의 검증된 숫자 계정 연결을 표시합니다.');

  const checkboxes = page.getByRole('checkbox', { name: /피드백 근거로 선택: PR #3 검토/ });
  await checkboxes.first().check();
  await page.getByLabel('관찰한 사실과 다음 피드백').fill('동료의 변경 이유를 확인하고 관찰 시간이라는 새 조건을 제안했습니다. 다음에는 직접 실행한 반례를 설명하는지 확인합니다.');
  await page.getByRole('heading', { name: '근거를 연결해 기록하기', exact: true }).scrollIntoViewIfNeeded();
  assert.equal(await page.getByLabel('기록 공개 범위').inputValue(), 'private');
  await shot('10-teacher-private-note.png', '근거를 연결해 교사 개인 기록 작성하기', '선생님', '기본 비공개와 근거 선택을 보여줍니다. 작성 중 문장은 복사본의 임시 메모이며 저장·전달하지 않았습니다.', { top: false });

  await switchRole('학생 가');
  await openProject(true);
  await page.getByRole('heading', { name: '나의 과정과 다음 질문', exact: true }).waitFor();
  await page.getByLabel('기록 범위').selectOption('mine');
  await page.getByText('다음에 함께 생각할 질문', { exact: true }).click();
  await page.locator('.cr-process-grid').evaluate(element => element.scrollIntoView({ block: 'start' }));
  await page.evaluate(() => window.scrollBy(0, -90));
  assert.equal(await page.getByLabel('기록 공개 범위').count(), 0);
  assert.equal(await page.getByText('나만 보는 교사 기록', { exact: true }).count(), 0);
  await shot('11-student-a-feedback.png', '작성자의 과정과 전달된 피드백', '학생 가', '학생 가의 PR 근거와 개인·팀 피드백입니다. 교사 개인 기록과 학생 나의 개별 피드백은 표시하지 않습니다.', { top: false });

  await switchRole('학생 나');
  await openProject(true);
  await page.getByRole('heading', { name: '나의 과정과 다음 질문', exact: true }).waitFor();
  await page.getByLabel('기록 범위').selectOption('mine');
  await page.getByText(/GitHub @greatsong-danggok/).waitFor();
  await page.getByText('다음에 함께 생각할 질문', { exact: true }).click();
  await page.locator('.cr-process-grid').evaluate(element => element.scrollIntoView({ block: 'start' }));
  await page.evaluate(() => window.scrollBy(0, -90));
  assert.equal(await page.getByText('나만 보는 교사 기록', { exact: true }).count(), 0);
  await shot('12-student-b-review-feedback.png', '검토자의 리뷰와 다음 질문', '학생 나', '학생 나의 실제 검토 의견·승인 기록과 전달된 피드백입니다. 작성자와 검토자의 과정이 각각 연결됩니다.', { top: false });

  await tab(/기록과 성찰/);
  await page.getByRole('heading', { name: '실험의 발자국', exact: true }).waitFor();
  await shot('13-journal-and-recovery.png', '실험의 발자국과 복구', '학생 나', '확정 버전의 실험 근거를 돌아보고 필요하면 개인 초안으로 복원합니다. 복원·내보내기는 실행하지 않았습니다.');
  await switchRole('선생님');
  await page.getByRole('link', { name: '교사 관찰실', exact: true }).click();
  await page.getByRole('heading', { name: '교사 관찰실', exact: true }).waitFor();
  await page.getByRole('heading', { name: '반지름과 충돌 조건 탐구', exact: true }).waitFor();
  await shot('14-teacher-observation.png', '교사 관찰실에서 과정 살펴보기', '선생님', '저장 횟수보다 문제·가설·수정·동료 의견·다음 실험을 관찰합니다.');
  assert.equal(failures.length, 0, failures.join('\n'));
  assert.equal(mutations.some(request => request.path.includes('/github/')), false, 'GitHub 작업을 요청하지 않아야 합니다.');
  writeFileSync(resolve(output, 'capture-validation.json'), JSON.stringify({ completedAt: new Date().toISOString(), screenshots: shots.length, pageErrors: failures, localMutations: mutations, externalGitHubWrites: 0, runtimeActuallyExecuted: true, studentPrivateNotesAbsent: true }, null, 2) + '\n');
  process.stdout.write(`완료: ${shots.length}장, 실제 Python 실행·학생 화면 비공개 기록 제외 확인\n`);
} catch (error) {
  const diagnosticDirectory = resolve(root, '.local/guide-capture');
  await page.screenshot({ path: resolve(diagnosticDirectory, 'capture-failure.png'), animations: 'disabled' });
  writeFileSync(resolve(diagnosticDirectory, 'capture-failure.json'), JSON.stringify({ message: error.message, body: await page.locator('body').innerText(), pageErrors: failures }, null, 2));
  process.stderr.write((await page.locator('.runtime-console-output').textContent().catch(() => '')) + '\n');
  throw error;
} finally {
  saveManifest();
  await browser.close();
}

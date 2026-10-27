import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

// 외부 요청과 인증은 호출자가 담당합니다. 이 모듈은 격리한 로컬 교실 API만 검사합니다.
export async function verifyLocalLearning({ api, projectId, issueTitle, prTitle, reviewText, expectedGithubId, report }) {
  assert.equal(typeof api, 'function', '로컬 API 호출 함수를 지정해주세요.');
  assert.ok(typeof projectId === 'string' && projectId, '검증할 프로젝트 ID가 필요합니다.');
  assert.ok(Array.isArray(report), '검증 보고서는 배열이어야 합니다.');
  const githubId = Number(expectedGithubId);
  assert.ok(Number.isSafeInteger(githubId) && githubId > 0, '실제 GitHub 숫자 사용자 ID가 필요합니다.');
  const root = `/projects/${encodeURIComponent(projectId)}`;
  const runId = `live-feedback-${randomUUID()}`;
  const pass = (name, details) => report.push({ name, passed: true, ...(details ? { details } : {}) });
  async function request(userId, path, options, status = 200) {
    const result = await api(userId, path, options);
    assert.equal(result.status, status, `${userId} ${options?.method || 'GET'} ${path}: HTTP ${status} 예상, ${result.status} 수신 (${result.data?.code || '오류 코드 없음'})`);
    assert.ok(result.data && typeof result.data === 'object', `${path}: JSON 응답 본문이 없습니다.`);
    return result.data;
  }
  const teacherLearning = await request('teacher', `${root}/learning`);
  assert.equal(teacherLearning.mode, 'live', '실제 GitHub 연동의 live 모드가 아닙니다.');
  assert.ok(Array.isArray(teacherLearning.events), '수집한 GitHub 사건 배열이 없습니다.');
  const events = teacherLearning.events;
  const issue = events.find(event => event.kind === 'issue' && event.title === issueTitle);
  const pull = events.find(event => event.kind === 'pull_request' && event.title === prTitle);
  const review = events.find(event => event.kind === 'review' && event.body.includes(reviewText));
  const issueComment = events.find(event => event.kind === 'issue_comment');
  const reviewComment = events.find(event => event.kind === 'review_comment');
  for (const [name, event] of Object.entries({ issue, pull, review, issueComment, reviewComment })) {
    assert.ok(event, `실제 GitHub 기록을 수집하지 못했습니다: ${name}`);
    assert.notEqual(event.source, 'simulator', `${name} 기록이 실제 GitHub 기록이 아닌 모의 자료입니다.`);
    assert.ok(event.id && event.url?.startsWith('https://github.com/'), `${name} 기록의 근거 ID 또는 GitHub 원문 URL이 없습니다.`);
  }
  pass('실제 GitHub Issue·PR·리뷰·대화·코드 의견 수집', Object.fromEntries(Object.entries({ issue, pull, review, issueComment, reviewComment }).map(([name, event]) => [name, { id: event.id, url: event.url, githubAuthorId: event.githubAuthorId }])));

  const realAuthorEvents = events.filter(event => event.githubAuthorId === githubId);
  assert.ok(realAuthorEvents.length > 0, '실제 GitHub 숫자 작성자 ID를 가진 사건이 없습니다.');
  for (const event of realAuthorEvents) assert.equal(event.authorUserId, 'student-a', `${event.kind}: 실제 GitHub 작성자의 학생 가 귀속이 잘못되었습니다.`);
  assert.ok(events.every(event => event.authorUserId !== 'student-b'), '실제 GitHub 1개 계정이 학생 나에게 잘못 연결되었습니다.');
  const aEvidence = await request('student-a', `${root}/student-evidence/student-a`);
  const bEvidence = await request('student-b', `${root}/student-evidence/student-b`);
  assert.equal(aEvidence.githubIdentity?.githubId, githubId, '학생 가의 숫자 GitHub ID 매핑이 다릅니다.');
  assert.ok(aEvidence.events.some(event => event.githubAuthorId === githubId), '학생 가의 개인 근거에 실제 GitHub 작성 기록이 없습니다.');
  assert.equal(bEvidence.events.length, 0, '실제 GitHub 활동이 없는 합성 학생 나의 개인 근거는 비어 있어야 합니다.');
  await request('student-b', `${root}/student-evidence/student-a`, undefined, 403);
  await request('student-a', `${root}/student-evidence/student-b`, undefined, 403);
  pass('숫자 GitHub ID 귀속과 타 학생 개인 근거 접근 차단', { githubId, studentAEvents: aEvidence.events.length, studentBEvents: bEvidence.events.length, limitation: '실제 GitHub 1개 계정을 합성 학생 가에 매핑한 시험입니다. 서로 다른 두 학생의 실제 GitHub 로그인·Supabase identity 검증을 입증하지 않습니다.' });

  const evidenceIds = [pull.id, review.id];
  assert.equal(new Set(evidenceIds).size, 2, '피드백에 연결할 두 GitHub 근거가 중복되었습니다.');
  const created = {};
  for (const visibility of ['private', 'student', 'team']) {
    const body = { studentId: 'student-a', comment: `${runId}: ${visibility} 관찰과 다음 탐구 질문`, visibility, evidenceIds, criteria: { reasoning: 'PR의 선택 이유와 동료 검토를 연결해 설명해주세요.', nextStep: '조건을 하나 바꾸었을 때 설명이 유지되는지 확인해주세요.' } };
    const options = { method: 'POST', body, headers: { 'Idempotency-Key': `${runId}:${visibility}` } };
    const first = await request('teacher', `${root}/feedback`, options, 201);
    const replay = await request('teacher', `${root}/feedback`, options, 201);
    assert.ok(first.feedback?.id, `${visibility} 피드백 ID가 없습니다.`);
    assert.deepEqual(replay.feedback, first.feedback, `${visibility} 피드백의 동일 요청 키 재전송 결과가 다릅니다.`);
    const feedback = first.feedback;
    assert.equal(feedback.teacherId, 'teacher', '피드백 작성 교사 ID가 다릅니다.');
    assert.equal(feedback.visibility, visibility, '서버가 보존한 피드백 공개 범위가 다릅니다.');
    assert.deepEqual(feedback.evidenceIds, evidenceIds, '서버가 보존한 피드백 근거 ID가 다릅니다.');
    assert.equal(feedback.evidence?.length, 2, '피드백의 두 근거 스냅샷이 보존되지 않았습니다.');
    for (const snapshot of feedback.evidence) {
      const source = events.find(event => event.id === snapshot.id);
      assert.ok(source, '근거 스냅샷이 현재 프로젝트의 사건과 연결되지 않습니다.');
      assert.equal(snapshot.url, source.url, '근거 스냅샷의 원문 URL이 바뀌었습니다.');
      assert.equal(snapshot.sha, source.sha, '근거 스냅샷의 SHA가 바뀌었습니다.');
      assert.equal(snapshot.title, source.title, '근거 스냅샷의 제목이 바뀌었습니다.');
      assert.equal(snapshot.kind, source.kind, '근거 스냅샷의 종류가 바뀌었습니다.');
      assert.ok(/^https:\/\/github\.com\//.test(snapshot.url || ''), '근거 스냅샷의 GitHub 원문 URL이 유효하지 않습니다.');
      if (snapshot.sha !== null) assert.match(snapshot.sha, /^[a-f\d]{40,64}$/i, '근거 스냅샷의 SHA 형식이 유효하지 않습니다.');
    }
    created[visibility] = feedback;
  }
  pass('근거 두 개를 연결한 교사 기록·학생 피드백·팀 피드백과 중복 요청 방지', Object.fromEntries(Object.entries(created).map(([visibility, feedback]) => [visibility, feedback.id])));

  const createdIds = new Set(Object.values(created).map(feedback => feedback.id));
  const expectedIds = { teacher: [created.private.id, created.student.id, created.team.id], 'student-a': [created.student.id, created.team.id], 'student-b': [created.team.id] };
  for (const userId of ['teacher', 'student-a', 'student-b']) {
    for (const suffix of ['', '/export', '/learning']) {
      const data = await request(userId, `${root}${suffix}`);
      const feedback = suffix === '/learning' ? (data.students || []).flatMap(student => student.feedback || []) : data.feedback;
      assert.ok(Array.isArray(feedback), `${userId} ${suffix || '/detail'}: 피드백 목록이 없습니다.`);
      const ownIds = [...new Set(feedback.filter(item => createdIds.has(item.id)).map(item => item.id))].sort();
      assert.deepEqual(ownIds, [...expectedIds[userId]].sort(), `${userId} ${suffix || '/detail'}: 교사 개인 기록·개별 피드백·팀 피드백의 공개 범위가 잘못되었습니다.`);
      for (const id of ownIds) assert.equal(feedback.filter(item => item.id === id).length, suffix === '/learning' && id === created.team.id && userId === 'teacher' ? data.students.length : 1, `${userId} ${suffix || '/detail'}: 피드백이 중복 저장되었거나 예상 밖에 중복 표시되었습니다.`);
    }
  }
  pass('detail·export·학생별 learning 응답의 피드백 공개 범위', { private: '작성 교사만', student: '대상 학생과 참여 교사', team: '프로젝트 참여자', limitation: '다른 실제 교사 계정의 인증 시험은 이 합성 3인 API 계약에 포함되지 않습니다.' });

  const foreign = await request('teacher', '/projects', { method: 'POST', body: { title: `${runId} 근거 격리 시험`, code: '', aiPolicy: 'disabled' }, headers: { 'Idempotency-Key': `${runId}:foreign-project` } }, 201);
  assert.ok(foreign.project?.id, '다른 프로젝트의 근거 격리 시험용 프로젝트를 만들지 못했습니다.');
  const rejected = await request('teacher', `/projects/${encodeURIComponent(foreign.project.id)}/feedback`, { method: 'POST', body: { comment: `${runId} 다른 팀 근거 연결 시도`, visibility: 'team', evidenceIds } }, 422);
  assert.equal(rejected.code, 'invalid_feedback_evidence', '다른 프로젝트의 근거 참조가 근거 격리 검증으로 차단되지 않았습니다.');
  pass('다른 프로젝트의 GitHub 근거 연결 차단', { foreignProjectId: foreign.project.id, code: rejected.code });

  const original = await request('teacher', root);
  const studentB = original.members?.find(member => member.id === 'student-b');
  assert.ok(studentB && studentB.role !== 'owner', '관찰자 권한 시험을 위해 학생 나가 프로젝트의 일반 참여자여야 합니다.');
  const originalRole = studentB.role;
  await request('teacher', `${root}/members`, { method: 'POST', body: { userId: 'student-b', role: 'viewer' }, headers: { 'Idempotency-Key': `${runId}:viewer-role` } });
  try {
    await request('student-b', `${root}/issues`, { method: 'POST', body: { title: `${runId} 관찰자 질문`, body: '허용되면 안 됩니다.' } }, 403);
    await request('student-b', `${root}/proposals`, { method: 'POST', body: { title: `${runId} 관찰자 제안`, code: 'print("관찰자")', baseVersion: original.project.version, evidence: {} } }, 403);
    await request('student-b', `${root}/github/issues`, { method: 'POST', body: { title: `${runId} 관찰자 GitHub Issue`, body: '', issueId: 'viewer-denied' } }, 403);
    await request('student-b', `${root}/github/proposals`, { method: 'POST', body: { title: `${runId} 관찰자 GitHub PR`, code: '', baseSha: '0'.repeat(40) } }, 403);
    await request('student-b', `${root}/github/learning/sync`, { method: 'POST', body: {} }, 403);
  } finally {
    await request('teacher', `${root}/members`, { method: 'POST', body: { userId: 'student-b', role: originalRole }, headers: { 'Idempotency-Key': `${runId}:restore-role` } });
    const restored = await request('teacher', root);
    assert.equal(restored.members?.find(member => member.id === 'student-b')?.role, originalRole, '관찰자 권한 시험 후 학생 나의 실제 서버 역할이 복구되지 않았습니다.');
  }
  pass('관찰자의 로컬·GitHub 질문·제안·동기화 쓰기 차단과 역할 복구', { restoredRole: originalRole });
  return { feedback: created, evidenceIds, foreignProjectId: foreign.project.id };
}

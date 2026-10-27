import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { archiveDraft, chooseDraft, draftKey, otherClientDrafts, readDraft, recoveryDrafts, writeDraft } from './draft-journal';

const scope = ['student-a', 'project-a', 'tab-a'];
const draft = (code, clientSequence = 1, baseVersion = 2) => ({ code, clientSequence, baseVersion });

describe('계정과 프로젝트별 개인 초안 일지', () => {
  beforeEach(() => {
    const entries = new Map();
    vi.stubGlobal('localStorage', { get length() { return entries.size; }, key: (index) => [...entries.keys()][index] ?? null, getItem: (key) => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value) });
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('사용자·프로젝트·편집 창을 모두 분리한다', () => {
    writeDraft(localStorage, scope, draft('학생 가의 작업'));
    expect(readDraft(localStorage, scope).code).toBe('학생 가의 작업');
    for (const other of [['student-b', 'project-a', 'tab-a'], ['student-a', 'project-b', 'tab-a'], ['student-a', 'project-a', 'tab-b']]) expect(readDraft(localStorage, other)).toBeNull();
  });

  it('손상된 데이터와 다른 범위의 정체성을 거부한다', () => {
    for (const value of ['{', JSON.stringify(draft('잘못된 순번', -1)), JSON.stringify({ ...draft('다른 학생'), userId: 'student-b' })]) {
      localStorage.setItem(draftKey(...scope), value);
      expect(readDraft(localStorage, scope)).toBeNull();
    }
  });

  it('초안이 없으면 최신 수업 기준으로 시작하며 빈 코드도 유지한다', () => {
    expect(chooseDraft(null, null, { code: '수업 시작 코드', version: 4 })).toEqual({ code: '수업 시작 코드', baseVersion: 4, clientSequence: 0 });
    expect(chooseDraft(draft('', 2), draft('이전 코드', 1), null).code).toBe('');
  });

  it('같은 순번의 다른 코드는 로컬 코드를 새 순번으로 보존한다', () => {
    const local = draft('내 작업', 5); const remote = draft('다른 창 작업', 5);
    expect(chooseDraft(local, remote, null)).toMatchObject({ code: '내 작업', clientSequence: 6 });
    expect(local.clientSequence).toBe(5);
    expect(chooseDraft(local, { ...local }, null).clientSequence).toBe(5);
    expect(chooseDraft(local, draft('서버 최신', 8), null)).toMatchObject({ code: '서버 최신', clientSequence: 8 });
  });

  it('비운 코드도 복구하며 동일한 내용은 중복 없이 최근 8개를 유지한다', () => {
    archiveDraft(localStorage, scope, draft('', 1));
    expect(recoveryDrafts(localStorage, scope)[0].code).toBe('');
    for (let index = 0; index < 10; index++) archiveDraft(localStorage, scope, draft(`버전 ${index}`, index));
    archiveDraft(localStorage, scope, draft('버전 9', 20));
    expect(recoveryDrafts(localStorage, scope)).toHaveLength(8);
    expect(recoveryDrafts(localStorage, scope).filter((entry) => entry.code === '버전 9')).toHaveLength(1);
  });

  it('다른 창의 초안은 같은 계정과 프로젝트만 작성 시각순으로 찾는다', () => {
    writeDraft(localStorage, [scope[0], scope[1], 'old-tab'], { ...draft('어제 작업', 100), updatedAt: '2026-10-27T09:00:00Z' });
    writeDraft(localStorage, [scope[0], scope[1], 'new-tab'], { ...draft('오늘 작업', 2), updatedAt: '2026-10-28T09:00:00Z' });
    writeDraft(localStorage, ['student-b', scope[1], 'other-account'], { ...draft('다른 학생의 개인 코드'), updatedAt: '2026-10-29T09:00:00Z' });
    writeDraft(localStorage, [scope[0], 'project-b', 'other-project'], { ...draft('다른 프로젝트 코드'), updatedAt: '2026-10-29T09:00:00Z' });
    archiveDraft(localStorage, [scope[0], scope[1], 'new-tab'], draft('일반 초안이 아닌 복구 기록'));
    const candidates = otherClientDrafts(localStorage, scope);
    expect(candidates.map((entry) => entry.code)).toEqual(['오늘 작업', '어제 작업']);
    expect(candidates.map((entry) => entry.recoveredFromClientId)).toEqual(['new-tab', 'old-tab']);
  });

  it('다른 창 검색은 키의 범위와 본문의 소유자가 모두 일치해야 복구한다', () => {
    localStorage.setItem(draftKey(scope[0], scope[1], 'wrong-owner'), JSON.stringify({ ...draft('다른 학생 데이터'), userId: 'student-b', projectId: scope[1], clientId: 'wrong-owner' }));
    localStorage.setItem(draftKey(scope[0], scope[1], 'missing-owner'), JSON.stringify(draft('소유자 확인 불가')));
    expect(otherClientDrafts(localStorage, scope)).toEqual([]);
  });
});

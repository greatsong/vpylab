import { beforeEach, expect, it } from 'vitest';
import { readPracticeDraft, writePracticeDraft } from './practice-drafts';
beforeEach(() => sessionStorage.clear());
it('서로 다른 활동·단계·사용자의 초안을 섞지 않고 빈 코드도 복원한다', () => {
  expect(writePracticeDraft('tutorial/signal/shape', '', 'start')).toBe(true);
  writePracticeDraft('tutorial/signal/sound', 'sound edit', 'start');
  writePracticeDraft('tutorial/signal/shape', 'signed in edit', 'start', 'user-a');
  expect(readPracticeDraft('tutorial/signal/shape')).toBe('');
  expect(readPracticeDraft('tutorial/signal/sound')).toBe('sound edit');
  expect(readPracticeDraft('tutorial/signal/shape', 'user-a')).toBe('signed in edit');
  expect(readPracticeDraft('tutorial/signal/shape', 'user-b')).toBeNull();
});
it('시작 코드로 되돌리면 수정 초안이 지워진다', () => {
  writePracticeDraft('lesson/one','edit','base');
  writePracticeDraft('lesson/one','base','base');
  expect(readPracticeDraft('lesson/one')).toBeNull();
});
it('저장 실패·손상·한도 초과는 성공으로 표시하지 않는다', () => {
  const fail={getItem(){throw new Error('blocked');},setItem(){throw new Error('blocked');}};
  expect(writePracticeDraft('one','edit','base',null,fail)).toBe(false);
  expect(readPracticeDraft('one',null,fail)).toBeNull();
  expect(writePracticeDraft('one','가'.repeat(20000),'base')).toBe(false);
});
it('다수 활동을 열어도 최근 24개만 보관한다', () => {
  for(let i=0;i<25;i++) writePracticeDraft(`lesson/${i}`,`edit ${i}`,'base');
  expect(readPracticeDraft('lesson/0')).toBeNull();
  expect(readPracticeDraft('lesson/24')).toBe('edit 24');
});

import { describe, expect, it } from 'vitest';
import course from './light-sound-course';
import { getCourseById, getLesson } from './courses';
import { hasPython, runPythonJobs } from '../test/python-runner';

describe('빛과 소리 입문 코스 연결', () => {
  it('교재와 실습이 같은 차시 코드를 사용하며 기존 입문 코스도 찾을 수 있다', () => {
    expect(getCourseById(course.id)).toBe(course);
    expect(getCourseById('beg-first-steps')).toBeTruthy();
    for (const lesson of course.lessons) expect(getLesson(course.id, lesson.id)).toBe(lesson);
  });
});

describe.skipIf(!hasPython())('입문 교재의 실제 Python 실행', () => {
  it('모든 차시가 정지 신호나 오류 없이 끝나며 남은 태스크가 없다', () => {
    const results = runPythonJobs(course.lessons.map(lesson => ({ id: lesson.id, label: 'base', code: lesson.code })));
    for (const result of results.values()) {
      expect(result.error, result.id).toBeNull();
      expect(result.stopped, result.id).toBe(false);
      expect(result.pendingTasks, result.id).toBe(0);
    }
  });

  it('반복 횟수를 바꾸어도 반복 밖의 마무리 음은 한 번만 난다', () => {
    const code = course.lessons[4].code.replace('range(3)', 'range(5)');
    const result = runPythonJobs([{ id: 'repeat', label: 'five', code }]).get('repeat:five');
    expect(result.error).toBeNull();
    const notes = result.commands.filter(command => command.action === 'sound');
    expect(notes.map(note => note.name)).toEqual(['A4', 'A4', 'A4', 'A4', 'A4', 'C4']);
  });

  it('조건문의 경계와 이하로 바꾸는 과제가 설명대로 두 상태를 선택한다', () => {
    const base = course.lessons[5].code;
    const jobs = [39, 40, 41, 49, 50, 51].map(value => ({
      id: `less-${value}`, label: 'boundary', code: base.replace('water = 30', `water = ${value}`),
    }));
    for (const value of [39, 40, 41]) jobs.push({
      id: `inclusive-${value}`, label: 'boundary',
      code: base.replace('water = 30', `water = ${value}`).replace('water < 50', 'water <= 40'),
    });
    for (const result of runPythonJobs(jobs).values()) {
      expect(result.error).toBeNull();
      const value = Number(result.id.split('-')[1]);
      const warning = result.id.startsWith('inclusive') ? value <= 40 : value < 50;
      const note = result.commands.find(command => command.action === 'sound');
      const size = result.commands.find(command => command.radius && command.action === 'update');
      expect(note.name, result.id).toBe(warning ? 'G4' : 'C4');
      expect(size.radius, result.id).toBe(warning ? 0.9 : 0.5);
    }
  });

  it('리스트 항목을 추가하면 연주 순서가 바뀌고 같은 공을 계속 사용한다', () => {
    const code = course.lessons[6].code.replace('["도", "미", "솔", "미"]', '["도", "미", "솔", "미", "도"]');
    const result = runPythonJobs([{ id: 'melody', label: 'added', code }]).get('melody:added');
    expect(result.error).toBeNull();
    expect(result.commands.filter(command => command.action === 'sound').map(command => command.name))
      .toEqual(['C4', 'E4', 'G4', 'E4', 'C4']);
    expect(result.commands.filter(command => command.action === 'create')).toHaveLength(1);
  });

  it('최종 작품은 상태에 맞는 크기를 유지하고 선택된 음을 세 번 반복한다', () => {
    const jobs = [30, 80].map(value => ({ id: String(value), label: 'project', code: course.lessons[7].code.replace('water = 30', `water = ${value}`) }));
    for (const result of runPythonJobs(jobs).values()) {
      expect(result.error).toBeNull();
      const expected = result.id === '30' ? 'G4' : 'C4';
      expect(result.commands.filter(command => command.action === 'sound').map(command => command.name)).toEqual([expected, expected, expected]);
    }
  });

  it('소리 없는 대안도 같은 공으로 목록 순서를 보여 주고 종료한다', () => {
    const code = course.lessons[6].guide.accessibleCode;
    const results = runPythonJobs([
      { id: 'sizes', label: 'base', code },
      { id: 'sizes', label: 'reverse', code: code.replace('[0.4, 0.6, 0.9, 0.6]', '[0.6, 0.9, 0.6, 0.4]') },
    ]);
    for (const [key, expected] of [['sizes:base', [0.4, 0.6, 0.9, 0.6]], ['sizes:reverse', [0.6, 0.9, 0.6, 0.4]]]) {
      const result = results.get(key);
      expect(result.error).toBeNull();
      expect(result.pendingTasks).toBe(0);
      expect(result.commands.filter(command => command.action === 'sound')).toHaveLength(0);
      expect(result.commands.filter(command => command.action === 'create')).toHaveLength(1);
      expect(result.commands.filter(command => command.action === 'update' && command.radius != null).map(command => command.radius)).toEqual(expected);
    }
  });
});

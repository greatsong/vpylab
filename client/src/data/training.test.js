import { expect, it } from 'vitest';
import { trainingCourses, trainingSteps, getTrainingPosition } from './training';
import { getCourseById } from './courses';
import { getMissionById } from './missions';

it('코스와 연습은 기존 자료 ID로 연결되고 옛 링크도 유지된다', () => {
  for (const course of trainingCourses) expect(getCourseById(course.id)?.lessons).toHaveLength(course.sessions);
  for (const step of trainingSteps) expect(getMissionById(step.missionId)).toBeTruthy();
  expect(getCourseById('beg-first-steps')).toBeTruthy();
  expect(getMissionById('SC-5')).toBeTruthy();
});

it('조건 다음 리스트로 진행하고 마지막 연습 뒤 다른 옛 미션으로 넘어가지 않는다', () => {
  expect(getTrainingPosition('CT-13').nextId).toBe('CT-11');
  expect(getTrainingPosition(trainingSteps.at(-1).missionId).nextId).toBeNull();
  expect(getTrainingPosition('SC-5')).toBeNull();
});

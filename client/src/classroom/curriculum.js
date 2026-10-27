import courses from '../data/courses';
import missions, { categories } from '../data/missions';
import examples from '../data/examples';
import docs from '../data/docs';

const text = (value) => typeof value === 'string' ? value : value?.ko || '';
const lessons = courses.flatMap((course) => course.lessons.map((lesson) => ({
  ...lesson, kind: 'lesson', code: lesson.code, title: text(lesson.title),
  description: lesson.summary, group: text(course.title), courseId: course.id,
})));
export const collection = {
  lesson: lessons,
  mission: missions.map((mission) => ({ ...mission, kind: 'mission', title: text(mission.title), description: text(mission.description), group: text(categories[mission.category]?.name || mission.category), code: mission.starterCode })),
  example: examples.map((item) => ({ ...item, kind: 'example', group: item.category })),
  reference: docs.map((item) => ({ ...item, kind: 'reference', title: text(item.title), description: text(item.description), group: item.category })),
};
export const labels = { lesson: '코스·차시', mission: '미션', example: '예제', reference: 'API 문서' };
export const curriculumCounts = { courses: courses.length, lessons: lessons.length, missions: missions.length, examples: examples.length, docs: docs.length };

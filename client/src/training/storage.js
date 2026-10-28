export const TRAINING_KEY = 'vpylab:teacher-training:v1';
export const emptyPlan = { subject: '', grade: '', goal: '', question: '', provided: '', studentChange: '', control: '', evidence: '', support: '', assessment: '', nextClass: '' };
export function trainingKey(courseId = 'intro-6') { return courseId === 'intro-6' ? TRAINING_KEY : `${TRAINING_KEY}:${courseId}`; }
export function loadTraining(storage, course = {}) {
  try {
    const value = JSON.parse(storage.getItem(trainingKey(course.id)) || 'null');
    if (value?.schema !== 1 || !value.activities || typeof value.activities !== 'object' || Array.isArray(value.activities)) return null;
    return { schema: 1, aiPolicy: course.policyLocked ? course.aiPolicy : value.aiPolicy === 'optional' ? 'optional' : 'disabled', activities: value.activities, completed: Array.isArray(value.completed) ? value.completed.filter(number => Number.isInteger(number) && number >= 1 && number <= (course.sessionCount || 6)) : [], plan: { ...emptyPlan, ...(value.plan || {}) } };
  } catch { return null; }
}
export function newTraining(course = {}) { return { schema: 1, aiPolicy: course.aiPolicy || 'disabled', activities: {}, completed: [], plan: { ...emptyPlan } }; }
export function persistTraining(storage, value, course = {}) {
  try { storage.setItem(trainingKey(course.id), JSON.stringify({ ...value, savedAt: new Date().toISOString() })); return true; }
  catch { return false; }
}

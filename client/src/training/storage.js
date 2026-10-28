export const TRAINING_KEY = 'vpylab:teacher-training:v1';
export const emptyPlan = { subject: '', grade: '', goal: '', question: '', provided: '', studentChange: '', control: '', evidence: '', support: '', assessment: '', nextClass: '' };
export function loadTraining(storage) {
  try {
    const value = JSON.parse(storage.getItem(TRAINING_KEY) || 'null');
    if (value?.schema !== 1 || !value.activities || typeof value.activities !== 'object' || Array.isArray(value.activities)) return null;
    return { schema: 1, aiPolicy: value.aiPolicy === 'optional' ? 'optional' : 'disabled', activities: value.activities, completed: Array.isArray(value.completed) ? value.completed.filter(number => Number.isInteger(number) && number >= 1 && number <= 6) : [], plan: { ...emptyPlan, ...(value.plan || {}) } };
  } catch { return null; }
}
export function newTraining() { return { schema: 1, aiPolicy: 'disabled', activities: {}, completed: [], plan: { ...emptyPlan } }; }
export function persistTraining(storage, value) {
  try { storage.setItem(TRAINING_KEY, JSON.stringify({ ...value, savedAt: new Date().toISOString() })); return true; }
  catch { return false; }
}

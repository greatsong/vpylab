/**
 * 항해 일지(voyage)의 클라이언트 상태 헬퍼.
 * - "마지막 detailed 저장 시각" → 4필드 강제 여부 판단
 * - "마지막 저장 시점의 코드 줄 수" → lineDelta 계산
 *
 * 모두 localStorage 사용. 키는 projectId + userId 기준이라 같은 브라우저에서
 * 사용자 전환·프로젝트 전환에 자연스럽게 분리됩니다.
 */

const FORCE_THRESHOLD_MS = 30 * 60 * 1000; // 30분

function lastDetailedKey(projectId, userId) {
  return `vpylab:voyage:lastDetailedAt:${projectId}:${userId}`;
}

function lastLinesKey(projectId, userId) {
  return `vpylab:voyage:lastCodeLines:${projectId}:${userId}`;
}

function safeRead(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeWrite(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // 사파리 사적 모드 등에서 실패 가능 — 조용히 무시
  }
}

/**
 * 지금 저장하려는 시점에 4필드(detailed)를 강제해야 하는지.
 *  - 처음 저장(localStorage 비어있음) → true
 *  - 마지막 detailed 저장이 30분 이상 지남 → true
 *  - 그 외 → false (학생이 빠른 저장 vs 자세히 저장 선택 가능)
 */
export function shouldForceDetailed(projectId, userId) {
  if (!projectId || !userId) return true;
  const raw = safeRead(lastDetailedKey(projectId, userId));
  if (!raw) return true;
  const t = Number(raw);
  if (!Number.isFinite(t)) return true;
  return Date.now() - t >= FORCE_THRESHOLD_MS;
}

/**
 * detailed 저장이 성공한 직후에만 호출. GitHub commit/voyage append 실패 시
 * 호출하면 안 됨(실제 기록은 없는데 강제가 풀려 학생 회고가 텅 비게 됨).
 */
export function markDetailedSaved(projectId, userId) {
  if (!projectId || !userId) return;
  safeWrite(lastDetailedKey(projectId, userId), String(Date.now()));
}

export function readLastCodeLines(projectId, userId) {
  if (!projectId || !userId) return null;
  const raw = safeRead(lastLinesKey(projectId, userId));
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function writeLastCodeLines(projectId, userId, lines) {
  if (!projectId || !userId) return;
  if (!Number.isFinite(lines)) return;
  safeWrite(lastLinesKey(projectId, userId), String(lines));
}

/**
 * 코드 줄 수 계산. 빈 줄도 한 줄로 셈(편집기에서 보이는 줄 수와 일치).
 */
export function countCodeLines(code) {
  if (typeof code !== 'string' || code.length === 0) return 0;
  return code.split('\n').length;
}

/**
 * 현재 시각으로부터 voyage payload용 localDate / localTime / tzOffset을 생성.
 * 클라이언트 로컬 시간을 따른다(글로벌 학교 대응).
 */
export function nowLocalParts() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return {
    localDate: `${yyyy}-${mm}-${dd}`,
    localTime: `${hh}:${mi}`,
    tzOffset: -d.getTimezoneOffset(), // 한국이면 540
  };
}

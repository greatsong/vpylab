/**
 * VPy Lab 객체 레지스트리
 * 모든 VPython 객체를 추적하고 좌표 히스토리를 기록한다.
 * 채점 엔진이 이 데이터를 사용하여 궤적 비교/변수 검증을 수행한다.
 */

let nextId = 0;
const registry = new Map();

/**
 * 새 객체를 레지스트리에 등록
 * @param {string} type - 객체 타입 ('sphere', 'box', 'arrow' 등)
 * @param {object} props - 초기 속성 { pos, color, radius, ... }
 * @returns {string} 객체 ID
 */
export function registerObject(type, props = {}) {
  const id = `obj_${nextId++}`;
  registry.set(id, {
    id,
    type,
    props: { ...props },
    history: [], // 좌표 히스토리 [{ t, pos, vel, ... }]
    createdAt: performance.now(),
  });
  return id;
}

/**
 * 객체 속성 업데이트 + 히스토리 기록
 * @param {string} id
 * @param {object} updates - { pos: [x,y,z], color: [r,g,b], ... }
 * @param {number} t - 시뮬레이션 시간
 */
export function updateObject(id, updates, t = performance.now()) {
  const obj = registry.get(id);
  if (!obj) return;

  Object.assign(obj.props, updates);

  // 좌표 히스토리 기록 (pos가 변경된 경우만)
  if (updates.pos) {
    obj.history.push({
      t,
      pos: [...updates.pos],
      vel: updates.vel ? [...updates.vel] : undefined,
    });

    // 히스토리 최대 10,000 포인트
    if (obj.history.length > 10000) {
      obj.history = obj.history.slice(-5000);
    }
  }
}

/**
 * 객체 조회
 * @param {string} id
 * @returns {object|undefined}
 */
export function getObject(id) {
  return registry.get(id);
}

/**
 * 전체 객체 목록
 * @returns {Map}
 */
export function getAllObjects() {
  return registry;
}

/**
 * 특정 타입 객체만 조회
 * @param {string} type
 * @returns {object[]}
 */
export function getObjectsByType(type) {
  return Array.from(registry.values()).filter(o => o.type === type);
}

/**
 * 객체 삭제
 * @param {string} id
 */
export function removeObject(id) {
  registry.delete(id);
}

/**
 * 전체 레지스트리 초기화
 */
export function clearRegistry() {
  registry.clear();
  nextId = 0;
}

/**
 * 채점용: 특정 객체의 궤적 데이터 추출
 * @param {string} id
 * @returns {{ positions: number[][], times: number[] }}
 */
export function getTrajectory(id) {
  const obj = registry.get(id);
  if (!obj) return { positions: [], times: [] };

  return {
    positions: obj.history.map(h => h.pos),
    times: obj.history.map(h => h.t),
    velocities: obj.history.filter(h => h.vel).map(h => h.vel),
  };
}

/**
 * 채점용: 현재 모든 객체의 스냅샷
 * @returns {object[]}
 */
export function getSnapshot() {
  return Array.from(registry.values()).map(obj => ({
    id: obj.id,
    type: obj.type,
    props: { ...obj.props },
    historyLength: obj.history.length,
  }));
}

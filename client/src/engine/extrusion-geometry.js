/**
 * VPyLab — extrusion 지오메트리
 * 2D 단면(외곽선 + 구멍)을 3D 경로를 따라 쓸어(sweep) BufferGeometry를 만든다.
 *
 * GlowScript extrusion과 같은 규칙:
 * - 단면의 y축은 경로의 up(기본 (0,1,0)) 방향, x축은 tangent × up 방향(원 경로에서는 바깥쪽)
 * - 꺾이는 점에서는 각의 이등분면에 단면을 놓고 마이터(miter)로 늘려 모서리가 끊기지 않게 한다
 * - 경로의 첫 점과 끝 점이 같으면 닫힌 고리로 잇고 끝면을 만들지 않는다
 * - 열린 경로는 양 끝을 삼각분할한 면으로 막는다 (start_face_color / end_face_color)
 * - scale(숫자 또는 경로 점마다의 배율)과 colors(경로 점마다의 색)를 받는다
 */

import * as THREE from 'three';

const EPS = 1e-9;

/** 한 extrusion이 만들 수 있는 정점 수 상한 (경로 2000점 × 단면 250점 정도) */
export const MAX_EXTRUSION_VERTICES = 3_000_000;

/** 외곽선 끝에 반복된 첫 점을 떼고 숫자 쌍으로 맞춘다. */
function cleanContour(contour) {
  const pts = (contour || [])
    .filter((p) => Array.isArray(p) && p.length >= 2)
    .map((p) => [Number(p[0]) || 0, Number(p[1]) || 0]);
  while (pts.length > 1) {
    const a = pts[0];
    const b = pts[pts.length - 1];
    if (Math.abs(a[0] - b[0]) < EPS && Math.abs(a[1] - b[1]) < EPS) pts.pop();
    else break;
  }
  return pts;
}

/** 외곽선 둘레 길이 비율 (텍스처 u 좌표용) */
function arcFractions(pts) {
  const lengths = [0];
  let total = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    total += Math.hypot(b[0] - a[0], b[1] - a[1]);
    lengths.push(total);
  }
  return lengths.map((l) => (total > 0 ? l / total : 0));
}

/**
 * 경로 각 점의 좌표계(tangent, up, right)와 마이터 정보
 */
function buildFrames(P, closed, upRef) {
  const n = P.length;
  const frames = [];
  for (let i = 0; i < n; i++) {
    const prev = closed ? P[(i - 1 + n) % n] : P[Math.max(i - 1, 0)];
    const next = closed ? P[(i + 1) % n] : P[Math.min(i + 1, n - 1)];
    const tIn = new THREE.Vector3().subVectors(P[i], prev);
    const tOut = new THREE.Vector3().subVectors(next, P[i]);
    if (tIn.lengthSq() < EPS) tIn.copy(tOut);
    if (tOut.lengthSq() < EPS) tOut.copy(tIn);
    if (tIn.lengthSq() < EPS) tIn.set(1, 0, 0);
    if (tOut.lengthSq() < EPS) tOut.set(1, 0, 0);
    tIn.normalize();
    tOut.normalize();

    const t = new THREE.Vector3().addVectors(tIn, tOut);
    let miter = 1;
    const miterDir = new THREE.Vector3().subVectors(tOut, tIn);
    if (t.lengthSq() < 1e-12) {
      // 되돌아가는 경로 — 들어오는 방향을 쓴다
      t.copy(tOut);
      miter = 1;
      miterDir.set(0, 0, 0);
    } else {
      // 이등분면에 놓인 단면은 cos(θ/2)만큼 늘려야 두 변이 만난다 (너무 뾰족하면 5배까지만)
      miter = 1 / Math.max(0.2, t.length() / 2);
      t.normalize();
      if (miterDir.lengthSq() > 1e-12) miterDir.normalize();
    }

    let up = upRef.clone().addScaledVector(t, -upRef.dot(t));
    if (up.lengthSq() < 1e-6) {
      const alt = Math.abs(t.z) < 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0);
      up = alt.addScaledVector(t, -alt.dot(t));
    }
    up.normalize();
    const right = new THREE.Vector3().crossVectors(t, up).normalize();
    frames.push({ t, up, right, miter, miterDir });
  }
  return frames;
}

/**
 * 단면을 경로를 따라 쓸어 지오메트리를 만든다.
 * @param {number[][]} path  [[x,y,z], ...]
 * @param {number[][][][]} solids  [[outer, hole, ...], ...] — 외곽선은 [[x,y], ...]
 * @param {object} options { scale, colors, color, up, showStartFace, showEndFace, startFaceColor, endFaceColor, center }
 * @returns {{ geometry: THREE.BufferGeometry, vertexColored: boolean } | null}
 */
export function buildExtrusionGeometry(path, solids, options = {}) {
  const P = (path || [])
    .filter((p) => Array.isArray(p) && p.length >= 2)
    .map((p) => new THREE.Vector3(Number(p[0]) || 0, Number(p[1]) || 0, Number(p[2]) || 0));
  let closed = P.length > 2 && P[0].distanceTo(P[P.length - 1]) < 1e-9;
  if (closed) P.pop();
  if (P.length < 2) return null;
  const n = P.length;

  const center = options.center
    ? new THREE.Vector3(...options.center)
    : new THREE.Vector3();
  for (const p of P) p.sub(center);

  const upRef = new THREE.Vector3(...(options.up || [0, 1, 0]));
  if (upRef.lengthSq() < EPS) upRef.set(0, 1, 0);
  upRef.normalize();
  const frames = buildFrames(P, closed, upRef);

  // scale: 없으면 1, 주어진 값은 0도 그대로 (Number(v) || 1 로 쓰면 0이 1이 된다)
  const asScale = (v) => {
    const n = Number(v);
    return v === undefined || v === null || !Number.isFinite(n) ? 1 : n;
  };
  const scaleAt = (i) => {
    const s = options.scale;
    if (Array.isArray(s)) return asScale(s[Math.min(i, s.length - 1)]);
    return asScale(s);
  };
  const baseColor = Array.isArray(options.color) ? options.color : [1, 1, 1];
  const colorAt = (i) => {
    const c = options.colors;
    if (Array.isArray(c) && c.length > 0) return c[Math.min(i, c.length - 1)] || baseColor;
    return baseColor;
  };
  const vertexColored = Array.isArray(options.colors) && options.colors.length > 0
    || Array.isArray(options.startFaceColor) || Array.isArray(options.endFaceColor);

  const positions = [];
  const uvs = [];
  const colors = [];

  const ringPoint = (i, x, y) => {
    const f = frames[i];
    const s = scaleAt(i);
    const off = new THREE.Vector3()
      .addScaledVector(f.right, x * s)
      .addScaledVector(f.up, y * s);
    if (f.miter !== 1 && f.miterDir.lengthSq() > 0) {
      off.addScaledVector(f.miterDir, off.dot(f.miterDir) * (f.miter - 1));
    }
    return off.add(P[i]);
  };

  const pushVertex = (v, u, w, col) => {
    positions.push(v.x, v.y, v.z);
    uvs.push(u, w);
    colors.push(col[0], col[1], col[2]);
  };

  const segmentCount = closed ? n : n - 1;
  const cleanedSolids = (solids || []).map((solid) => (solid || []).map(cleanContour).filter((c) => c.length >= 3));

  // 정점 수 상한 — 메인 스레드에서 만드는 지오메트리가 너무 커지지 않게 한다
  const contourPoints = cleanedSolids.reduce((sum, solid) => sum + solid.reduce((s2, c) => s2 + c.length, 0), 0);
  const estimatedVertices = segmentCount * contourPoints * 6 + (closed ? 0 : contourPoints * 6);
  const limit = options.maxVertices ?? MAX_EXTRUSION_VERTICES;
  if (estimatedVertices > limit) {
    const error = new Error(
      `extrusion이 너무 큽니다: 정점 약 ${estimatedVertices.toLocaleString()}개 (상한 ${limit.toLocaleString()}개). `
      + 'path 점 수나 shape의 np를 줄이세요.',
    );
    error.code = 'EXTRUSION_TOO_LARGE';
    throw error;
  }

  for (const solid of cleanedSolids) {
    // --- 옆면: 외곽선과 구멍 모두 ---
    for (const contour of solid) {
      const m = contour.length;
      const fractions = arcFractions(contour);
      for (let i = 0; i < segmentCount; i++) {
        const j = (i + 1) % n;
        const vI = i / Math.max(1, segmentCount);
        const vJ = (i + 1) / Math.max(1, segmentCount);
        const cI = colorAt(i);
        const cJ = colorAt(j);
        for (let k = 0; k < m; k++) {
          const k2 = (k + 1) % m;
          const a = ringPoint(i, contour[k][0], contour[k][1]);
          const b = ringPoint(i, contour[k2][0], contour[k2][1]);
          const c = ringPoint(j, contour[k2][0], contour[k2][1]);
          const d = ringPoint(j, contour[k][0], contour[k][1]);
          const uA = fractions[k];
          const uB = fractions[k + 1];
          // 두 삼각형 (a, b, c), (a, c, d)
          pushVertex(a, uA, vI, cI); pushVertex(b, uB, vI, cI); pushVertex(c, uB, vJ, cJ);
          pushVertex(a, uA, vI, cI); pushVertex(c, uB, vJ, cJ); pushVertex(d, uA, vJ, cJ);
        }
      }
    }

    // --- 끝면: 열린 경로만 ---
    if (!closed && solid.length > 0) {
      const outer = solid[0].map(([x, y]) => new THREE.Vector2(x, y));
      const holes = solid.slice(1).map((h) => h.map(([x, y]) => new THREE.Vector2(x, y)));
      let triangles = [];
      try {
        triangles = THREE.ShapeUtils.triangulateShape(outer, holes);
      } catch {
        triangles = [];
      }
      const flat = [...outer, ...holes.flat()];
      const xs = flat.map((p) => p.x);
      const ys = flat.map((p) => p.y);
      const minX = Math.min(...xs); const maxX = Math.max(...xs);
      const minY = Math.min(...ys); const maxY = Math.max(...ys);
      const uvOf = (p) => [
        maxX > minX ? (p.x - minX) / (maxX - minX) : 0,
        maxY > minY ? (p.y - minY) / (maxY - minY) : 0,
      ];
      const addCap = (ringIndex, faceColor, flip) => {
        const col = Array.isArray(faceColor) ? faceColor : colorAt(ringIndex);
        for (const tri of triangles) {
          const order = flip ? [tri[0], tri[2], tri[1]] : tri;
          for (const idx of order) {
            const p = flat[idx];
            const [u, w] = uvOf(p);
            pushVertex(ringPoint(ringIndex, p.x, p.y), u, w, col);
          }
        }
      };
      if (options.showStartFace !== false) addCap(0, options.startFaceColor, true);
      if (options.showEndFace !== false) addCap(n - 1, options.endFaceColor, false);
    }
  }

  if (positions.length === 0) return null;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  if (vertexColored) {
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  }
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return { geometry, vertexColored };
}

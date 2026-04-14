/**
 * VPyLab — 3D 차트 시스템
 * Three.js 기반 미디어아트 스타일 차트 렌더링
 * Plotly 스타일 모던 미학: 글로우 재질, 그라디언트 컬러맵, 부드러운 애니메이션
 */

import * as THREE from 'three';

// ============================================================
// 컬러맵 (0~1 입력 → [r, g, b] 출력, 각 채널 0~1)
// ============================================================

/**
 * 선형 보간 헬퍼
 */
function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * 컬러 스톱 배열에서 t(0~1)에 해당하는 색상을 보간
 * stops: [[pos, r, g, b], ...] (pos 오름차순)
 */
function interpolateStops(stops, t) {
  t = Math.max(0, Math.min(1, t));
  if (t <= stops[0][0]) return [stops[0][1], stops[0][2], stops[0][3]];
  if (t >= stops[stops.length - 1][0])
    return [
      stops[stops.length - 1][1],
      stops[stops.length - 1][2],
      stops[stops.length - 1][3],
    ];

  for (let i = 0; i < stops.length - 1; i++) {
    if (t >= stops[i][0] && t <= stops[i + 1][0]) {
      const local = (t - stops[i][0]) / (stops[i + 1][0] - stops[i][0]);
      return [
        lerp(stops[i][1], stops[i + 1][1], local),
        lerp(stops[i][2], stops[i + 1][2], local),
        lerp(stops[i][3], stops[i + 1][3], local),
      ];
    }
  }
  return [stops[0][1], stops[0][2], stops[0][3]];
}

// --- viridis: 보라 → 청록 → 노랑 (과학 표준) ---
const VIRIDIS_STOPS = [
  [0.0, 0.267, 0.004, 0.329],
  [0.25, 0.282, 0.14, 0.458],
  [0.5, 0.127, 0.566, 0.551],
  [0.75, 0.544, 0.773, 0.247],
  [1.0, 0.993, 0.906, 0.144],
];

function viridis(t) {
  return interpolateStops(VIRIDIS_STOPS, t);
}

// --- plasma: 보라 → 주황 → 노랑 ---
const PLASMA_STOPS = [
  [0.0, 0.05, 0.03, 0.53],
  [0.25, 0.494, 0.012, 0.658],
  [0.5, 0.798, 0.28, 0.47],
  [0.75, 0.973, 0.585, 0.253],
  [1.0, 0.94, 0.975, 0.131],
];

function plasma(t) {
  return interpolateStops(PLASMA_STOPS, t);
}

// --- rainbow: 빨 → 주 → 노 → 초 → 시안 → 파 → 보라 ---
const RAINBOW_STOPS = [
  [0.0, 1.0, 0.0, 0.0],
  [0.167, 1.0, 0.5, 0.0],
  [0.333, 1.0, 1.0, 0.0],
  [0.5, 0.0, 1.0, 0.0],
  [0.667, 0.0, 1.0, 1.0],
  [0.833, 0.0, 0.0, 1.0],
  [1.0, 0.6, 0.0, 1.0],
];

function rainbow(t) {
  return interpolateStops(RAINBOW_STOPS, t);
}

// --- coolwarm: 파랑 → 흰 → 빨강 ---
const COOLWARM_STOPS = [
  [0.0, 0.23, 0.3, 0.75],
  [0.5, 0.97, 0.97, 0.97],
  [1.0, 0.71, 0.015, 0.15],
];

function coolwarm(t) {
  return interpolateStops(COOLWARM_STOPS, t);
}

// --- ocean: 진한 파랑 → 시안 → 초록 ---
const OCEAN_STOPS = [
  [0.0, 0.0, 0.07, 0.28],
  [0.33, 0.0, 0.27, 0.53],
  [0.67, 0.0, 0.69, 0.76],
  [1.0, 0.32, 0.87, 0.46],
];

function ocean(t) {
  return interpolateStops(OCEAN_STOPS, t);
}

// 컬러맵 레지스트리
const COLORMAPS = { viridis, plasma, rainbow, coolwarm, ocean };

/**
 * 이름으로 컬러맵 함수 가져오기
 */
function getColormap(name) {
  return COLORMAPS[name] || COLORMAPS.rainbow;
}

// ============================================================
// 차트 객체 관리
// ============================================================

/**
 * isChart 태그가 붙은 모든 객체 제거 (메모리 해제 포함)
 */
export function clearCharts(scene) {
  const toRemove = [];
  scene.traverse((child) => {
    if (child.userData?.isChart) toRemove.push(child);
  });
  toRemove.forEach((obj) => {
    scene.remove(obj);
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
      else obj.material.dispose();
    }
  });
}

/**
 * 생성한 메시에 차트 태그 부착
 */
function tagChart(mesh) {
  mesh.userData.isChart = true;
  return mesh;
}

// ============================================================
// 차트 타입 구현
// ============================================================

/**
 * 1. 3D 산점도 — InstancedMesh 기반 고성능 렌더링
 */
function renderScatter3d(cmd, scene) {
  const points = cmd.points || [];
  if (points.length === 0) return;

  const radius = cmd.size ?? 0.08;
  const opacity = cmd.opacity ?? 0.9;
  const cmap = getColormap(cmd.colormap || 'rainbow');

  // z값 범위 계산 (컬러맵 정규화용)
  let zMin = Infinity;
  let zMax = -Infinity;
  for (const p of points) {
    if (p[2] < zMin) zMin = p[2];
    if (p[2] > zMax) zMax = p[2];
  }
  const zRange = zMax - zMin || 1;

  const geometry = new THREE.SphereGeometry(radius, 16, 12);
  const material = new THREE.MeshStandardMaterial({
    roughness: 0.3,
    metalness: 0.15,
    transparent: opacity < 1,
    opacity,
    emissive: new THREE.Color(0.05, 0.05, 0.1),
    emissiveIntensity: 0.4,
  });

  const mesh = new THREE.InstancedMesh(geometry, material, points.length);
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();

  for (let i = 0; i < points.length; i++) {
    const [x, y, z] = points[i];
    dummy.position.set(x, y, z);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);

    // 색상 결정: 사용자 지정 or 컬러맵
    if (cmd.colors && cmd.colors[i]) {
      const c = cmd.colors[i];
      color.setRGB(c[0], c[1], c[2]);
    } else {
      const t = (z - zMin) / zRange;
      const [r, g, b] = cmap(t);
      color.setRGB(r, g, b);
    }
    mesh.setColorAt(i, color);
  }

  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

  tagChart(mesh);
  scene.add(mesh);
}

/**
 * 2. 3D 표면 그래프 — PlaneGeometry + 정점 색상
 */
function renderSurface3d(cmd, scene) {
  const zData = cmd.z_data || [];
  if (zData.length === 0) return;

  const rows = zData.length;
  const cols = zData[0].length;
  const xRange = cmd.x_range || [-5, 5];
  const yRange = cmd.y_range || [-5, 5];
  const opacity = cmd.opacity ?? 0.85;
  const cmap = getColormap(cmd.colormap || 'viridis');
  const showWireframe = cmd.wireframe !== false;

  // z 범위 계산
  let zMin = Infinity;
  let zMax = -Infinity;
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const z = zData[i][j];
      if (z < zMin) zMin = z;
      if (z > zMax) zMax = z;
    }
  }
  const zRange = zMax - zMin || 1;

  // PlaneGeometry 생성 (세분화 = 데이터 해상도)
  const width = xRange[1] - xRange[0];
  const height = yRange[1] - yRange[0];
  const geometry = new THREE.PlaneGeometry(
    width,
    height,
    cols - 1,
    rows - 1,
  );

  // 정점 위치 & 색상 설정
  const positions = geometry.attributes.position;
  const vertexCount = positions.count;
  const colors = new Float32Array(vertexCount * 3);

  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const idx = i * cols + j;
      const z = zData[i][j];

      // PlaneGeometry는 XY 평면 → z값을 Z 위치에 설정
      positions.setZ(idx, z);

      // 컬러맵 적용
      const t = (z - zMin) / zRange;
      const [r, g, b] = cmap(t);
      colors[idx * 3] = r;
      colors[idx * 3 + 1] = g;
      colors[idx * 3 + 2] = b;
    }
  }

  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();

  // 표면 재질 — 정점 색상 + 반투명 + 미세 글로우
  const surfaceMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    side: THREE.DoubleSide,
    roughness: 0.35,
    metalness: 0.1,
    transparent: opacity < 1,
    opacity,
    emissive: new THREE.Color(0.02, 0.02, 0.05),
    emissiveIntensity: 0.3,
  });

  const surfaceMesh = new THREE.Mesh(geometry, surfaceMaterial);
  // PlaneGeometry는 기본적으로 XY 평면 → XZ 평면으로 회전
  surfaceMesh.rotation.x = -Math.PI / 2;
  // 중심 위치 보정
  surfaceMesh.position.set(
    (xRange[0] + xRange[1]) / 2,
    0,
    (yRange[0] + yRange[1]) / 2,
  );

  tagChart(surfaceMesh);
  scene.add(surfaceMesh);

  // 와이어프레임 오버레이
  if (showWireframe) {
    const wireMaterial = new THREE.MeshBasicMaterial({
      color: 0x111122,
      wireframe: true,
      transparent: true,
      opacity: 0.12,
    });
    const wireMesh = new THREE.Mesh(geometry.clone(), wireMaterial);
    wireMesh.rotation.x = -Math.PI / 2;
    wireMesh.position.copy(surfaceMesh.position);
    tagChart(wireMesh);
    scene.add(wireMesh);
  }
}

/**
 * 3. 3D 선 그래프 — TubeGeometry + CatmullRomCurve3
 */
function renderLine3d(cmd, scene) {
  const points = cmd.points || [];
  if (points.length < 2) return;

  const lineColor = cmd.color || [0, 0.8, 1];
  const tubeRadius = cmd.width ?? 0.03;

  // 경로 생성
  const curvePoints = points.map(
    (p) => new THREE.Vector3(p[0], p[1], p[2]),
  );
  const curve = new THREE.CatmullRomCurve3(curvePoints, false, 'centripetal');

  // 세그먼트 수 = 포인트 * 8 (부드러운 곡선)
  const segments = Math.max(points.length * 8, 64);
  const geometry = new THREE.TubeGeometry(curve, segments, tubeRadius, 8, false);

  const color = new THREE.Color(lineColor[0], lineColor[1], lineColor[2]);
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.25,
    metalness: 0.2,
    emissive: color.clone().multiplyScalar(0.35),
    emissiveIntensity: 0.6,
  });

  const mesh = new THREE.Mesh(geometry, material);
  tagChart(mesh);
  scene.add(mesh);
}

/**
 * 4. 3D 막대 그래프 — BoxGeometry
 */
function renderBar3d(cmd, scene) {
  const values = cmd.values || [];
  if (values.length === 0) return;

  const barWidth = cmd.bar_width ?? 0.6;
  const cmap = getColormap(cmd.colormap || 'plasma');

  // 값 범위 (컬러맵 정규화)
  let vMin = Infinity;
  let vMax = -Infinity;
  for (const v of values) {
    if (v < vMin) vMin = v;
    if (v > vMax) vMax = v;
  }
  const vRange = vMax - vMin || 1;

  const spacing = barWidth * 1.4;

  for (let i = 0; i < values.length; i++) {
    const h = values[i];
    const geometry = new THREE.BoxGeometry(barWidth, Math.abs(h), barWidth);

    // 색상: 사용자 지정 or 컬러맵
    let r, g, b;
    if (cmd.colors && cmd.colors[i]) {
      [r, g, b] = cmd.colors[i];
    } else {
      const t = (h - vMin) / vRange;
      [r, g, b] = cmap(t);
    }

    const color = new THREE.Color(r, g, b);
    const material = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.3,
      metalness: 0.15,
      emissive: color.clone().multiplyScalar(0.2),
      emissiveIntensity: 0.4,
    });

    const mesh = new THREE.Mesh(geometry, material);
    // x축 따라 배치, y는 높이의 절반 (바닥 기준)
    const xPos = (i - (values.length - 1) / 2) * spacing;
    mesh.position.set(xPos, Math.abs(h) / 2, 0);

    tagChart(mesh);
    scene.add(mesh);
  }
}

// ============================================================
// 축 & 그리드 헬퍼
// ============================================================

/**
 * 차트 축 및 바닥 그리드 렌더링
 */
function renderChartAxes(cmd, scene) {
  // 바닥 그리드
  const gridSize = 10;
  const gridDivisions = 20;
  const grid = new THREE.GridHelper(gridSize, gridDivisions, 0x444466, 0x333355);
  grid.material.opacity = 0.15;
  grid.material.transparent = true;
  tagChart(grid);
  scene.add(grid);

  // 축 라인 (X=빨, Y=초, Z=파) — 미세 글로우
  const axisLength = gridSize / 2;
  const axisConfigs = [
    { dir: [1, 0, 0], color: [0.9, 0.2, 0.2] },  // X — 빨강
    { dir: [0, 1, 0], color: [0.2, 0.9, 0.2] },  // Y — 초록
    { dir: [0, 0, 1], color: [0.2, 0.2, 0.9] },  // Z — 파랑
  ];

  for (const axis of axisConfigs) {
    const points = [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(
        axis.dir[0] * axisLength,
        axis.dir[1] * axisLength,
        axis.dir[2] * axisLength,
      ),
    ];
    const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
    const lineMaterial = new THREE.LineBasicMaterial({
      color: new THREE.Color(axis.color[0], axis.color[1], axis.color[2]),
      linewidth: 1,
      transparent: true,
      opacity: 0.6,
    });
    const line = new THREE.Line(lineGeometry, lineMaterial);
    tagChart(line);
    scene.add(line);
  }
}

// ============================================================
// 메인 진입점
// ============================================================

/**
 * 차트 렌더링 — 커맨드에 따라 적절한 차트 타입 호출
 */
export function renderChart(cmd, scene) {
  // 이전 차트 제거
  clearCharts(scene);

  switch (cmd.chart_type) {
    case 'scatter3d':
      renderScatter3d(cmd, scene);
      break;
    case 'surface3d':
      renderSurface3d(cmd, scene);
      break;
    case 'line3d':
      renderLine3d(cmd, scene);
      break;
    case 'bar3d':
      renderBar3d(cmd, scene);
      break;
    default:
      console.warn(`[ChartSystem] 알 수 없는 차트 타입: ${cmd.chart_type}`);
      return;
  }

  // 축 & 그리드 표시
  if (cmd.show_axes !== false) {
    renderChartAxes(cmd, scene);
  }
}

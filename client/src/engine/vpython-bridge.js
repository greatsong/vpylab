/**
 * VPyLab — JS 측 VPython 브릿지
 * Worker에서 받은 JSON 커맨드를 Three.js 씬에 적용
 * 커맨드 배칭: 프레임당 단일 postMessage에서 받은 배치를 처리
 */

import * as THREE from 'three';
import {
  registerObject,
  updateObject,
  clearRegistry,
  registerNote,
} from './object-registry';
import { processSoundCommand, setNotePlayCallback } from './sound-system';

// 음표 재생 시 레지스트리에 기록
setNotePlayCallback((name, duration) => registerNote(name, duration));
import { renderChart, clearCharts } from './chart-system';
import {
  createWidget, updateWidget, deleteWidget, clearWidgets,
} from './widgets-system';
import {
  createGraph, deleteGraph,
  createSeries, deleteSeries, plotSeries,
  clearGraphs2D,
} from './graph2d-system';

// 메인 스레드에서 디스패치 활성화된 이벤트 이름들
const sceneBoundEvents = new Set();
export function isEventBound(name) { return sceneBoundEvents.has(name); }
export function getBoundEvents() { return new Set(sceneBoundEvents); }

// Three.js 메시 레지스트리 (id → Three.js Mesh)
const meshRegistry = new Map();

// 궤적(trail) 레지스트리 (id → { line, positions, material, maxPoints })
const trailRegistry = new Map();

// curve/points 동적 라인 레지스트리 (id → { line, positions, kind })
const curveRegistry = new Map();

// 기본 재질 설정
const DEFAULT_MATERIAL_PARAMS = {
  roughness: 0.4,
  metalness: 0.1,
};

const DEFAULT_OBJECT_PROPS = {
  sphere: { radius: 1 },
  box: { size: [1, 1, 1] },
  cylinder: { radius: 1, axis: [1, 0, 0] },
  arrow: { axis: [1, 0, 0], shaftwidth: 0.1 },
  cone: { radius: 1, axis: [1, 0, 0] },
  ring: { radius: 1, thickness: 0.1 },
  pyramid: { size: [1, 1, 1], axis: [1, 0, 0] },
  ellipsoid: { size: [1, 1, 1] },
  helix: { radius: 1, axis: [1, 0, 0], length: 1, coils: 5, thickness: 0.05 },
  local_light: { intensity: 1 },
  distant_light: { direction: [0, -1, 0], intensity: 1 },
};

function cloneDefaultProps(type) {
  const defaults = DEFAULT_OBJECT_PROPS[type] || {};
  return Object.fromEntries(
    Object.entries(defaults).map(([key, value]) => [
      key,
      Array.isArray(value) ? [...value] : value,
    ]),
  );
}

/**
 * VPython 색상 배열 [r,g,b] (0~1) → Three.js Color
 */
function toThreeColor(arr) {
  return new THREE.Color(arr[0], arr[1], arr[2]);
}

/**
 * 채점 레지스트리에 저장할 객체 속성 추출
 */
function getRegistryProps(cmd) {
  const props = {
    pos: cmd.pos || [0, 0, 0],
    color: cmd.color || [1, 1, 1],
    visible: cmd.visible !== false,
    opacity: cmd.opacity ?? 1,
    ...cloneDefaultProps(cmd.type),
  };

  for (const key of ['radius', 'size', 'axis', 'thickness', 'shaftwidth', 'intensity', 'direction', 'emissive']) {
    if (cmd[key] !== undefined) props[key] = cmd[key];
  }

  return props;
}

function cloneThreeColor(color) {
  return typeof color?.clone === 'function'
    ? color.clone()
    : new THREE.Color(color?.r ?? 0, color?.g ?? 0, color?.b ?? 0);
}

function setMaterialEmissive(material, enabled) {
  if (!material || !('emissive' in material)) return;
  material.emissive = enabled ? cloneThreeColor(material.color) : new THREE.Color(0, 0, 0);
  material.emissiveIntensity = enabled ? 0.8 : 0;
  material.needsUpdate = true;
}

function updateMaterialColor(material, color) {
  if (!material) return;
  material.color = color;
  if ('emissiveIntensity' in material && material.emissiveIntensity > 0) {
    material.emissive = cloneThreeColor(color);
  }
}

/**
 * 라벨 스프라이트 생성 — Canvas 텍스처를 Sprite에 적용해 항상 카메라를 향함
 */
function createLabelSprite(cmd) {
  const text = String(cmd.text ?? '');
  const fontPx = cmd.height || 16;
  const padding = 6;

  // 측정용 캔버스
  const measureCanvas = document.createElement('canvas');
  const measureCtx = measureCanvas.getContext('2d');
  measureCtx.font = `${fontPx * 2}px "DM Sans", "Noto Sans KR", sans-serif`;
  const metrics = measureCtx.measureText(text || ' ');
  const textWidth = Math.ceil(metrics.width) + padding * 2;
  const textHeight = Math.ceil(fontPx * 2 * 1.4) + padding * 2;

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(textWidth, 32);
  canvas.height = Math.max(textHeight, 32);
  const ctx = canvas.getContext('2d');

  // 배경
  if (cmd.background) {
    const [r, g, b] = cmd.background;
    ctx.fillStyle = `rgba(${Math.round(r*255)}, ${Math.round(g*255)}, ${Math.round(b*255)}, 0.85)`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // 테두리
  if (cmd.border > 0) {
    ctx.strokeStyle = '#888';
    ctx.lineWidth = cmd.border;
    ctx.strokeRect(0, 0, canvas.width, canvas.height);
  }

  // 텍스트
  const [r, g, b] = cmd.color || [1, 1, 1];
  ctx.fillStyle = `rgb(${Math.round(r*255)}, ${Math.round(g*255)}, ${Math.round(b*255)})`;
  ctx.font = `${fontPx * 2}px "DM Sans", "Noto Sans KR", sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;

  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    opacity: cmd.opacity ?? 1,
    depthTest: false,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(material);
  // 월드 단위 크기 — fontPx 기준 비례 (1 단위 = 약 32px)
  const worldScale = fontPx / 32;
  sprite.scale.set((canvas.width / canvas.height) * worldScale, worldScale, 1);
  sprite.userData = { isLabel: true, text, fontPx, color: cmd.color, background: cmd.background, border: cmd.border };
  return sprite;
}

/**
 * 라벨 스프라이트 텍스처를 갱신 (text/color 변경 시)
 */
function updateLabelSprite(sprite, cmd) {
  const merged = {
    text: cmd.text ?? sprite.userData.text,
    height: sprite.userData.fontPx,
    color: cmd.color || sprite.userData.color,
    background: sprite.userData.background,
    border: sprite.userData.border,
    opacity: cmd.opacity ?? (sprite.material?.opacity ?? 1),
  };
  // 새 sprite를 만들어 texture/scale을 옮겨붙임
  const fresh = createLabelSprite(merged);
  // 기존 텍스처/재질 정리
  if (sprite.material?.map) sprite.material.map.dispose();
  if (sprite.material) sprite.material.dispose();
  sprite.material = fresh.material;
  sprite.scale.copy(fresh.scale);
  sprite.userData = fresh.userData;
}

/**
 * 3D 객체 생성
 */
function createObject(cmd, scene) {
  let geometry;
  let material;
  let mesh;

  const col = toThreeColor(cmd.color || [1, 1, 1]);
  material = new THREE.MeshStandardMaterial({
    color: col,
    emissive: cmd.emissive ? cloneThreeColor(col) : new THREE.Color(0, 0, 0),
    emissiveIntensity: cmd.emissive ? 0.8 : 0,
    ...DEFAULT_MATERIAL_PARAMS,
    transparent: cmd.opacity < 1,
    opacity: cmd.opacity ?? 1,
  });

  switch (cmd.type) {
    case 'sphere':
      geometry = new THREE.SphereGeometry(cmd.radius ?? DEFAULT_OBJECT_PROPS.sphere.radius, 32, 16);
      mesh = new THREE.Mesh(geometry, material);
      break;

    case 'box': {
      const size = cmd.size || [1, 1, 1];
      geometry = new THREE.BoxGeometry(size[0], size[1], size[2]);
      mesh = new THREE.Mesh(geometry, material);
      break;
    }

    case 'cylinder': {
      const r = cmd.radius ?? DEFAULT_OBJECT_PROPS.cylinder.radius;
      const axis = cmd.axis || DEFAULT_OBJECT_PROPS.cylinder.axis;
      const len = Math.sqrt(axis[0] ** 2 + axis[1] ** 2 + axis[2] ** 2) || 1;
      geometry = new THREE.CylinderGeometry(r, r, len, 32);
      mesh = new THREE.Mesh(geometry, material);
      // 실린더를 축 방향으로 회전
      if (axis) {
        const dir = new THREE.Vector3(...axis).normalize();
        const up = new THREE.Vector3(0, 1, 0);
        mesh.quaternion.setFromUnitVectors(up, dir);
      }
      break;
    }

    case 'arrow': {
      const axis = cmd.axis || DEFAULT_OBJECT_PROPS.arrow.axis;
      const len = Math.sqrt(axis[0] ** 2 + axis[1] ** 2 + axis[2] ** 2) || 1;
      const sw = cmd.shaftwidth ?? DEFAULT_OBJECT_PROPS.arrow.shaftwidth;

      // 화살대 + 화살촉 그룹
      const group = new THREE.Group();

      const shaftGeom = new THREE.CylinderGeometry(sw / 2, sw / 2, len * 0.8, 8);
      const shaft = new THREE.Mesh(shaftGeom, material);
      shaft.position.y = len * 0.4;
      group.add(shaft);

      const headGeom = new THREE.ConeGeometry(sw * 1.5, len * 0.2, 8);
      const head = new THREE.Mesh(headGeom, material);
      head.position.y = len * 0.9;
      group.add(head);

      // 방향 설정
      const dir = new THREE.Vector3(...axis).normalize();
      const up = new THREE.Vector3(0, 1, 0);
      group.quaternion.setFromUnitVectors(up, dir);

      mesh = group;
      break;
    }

    case 'cone': {
      const r = cmd.radius ?? DEFAULT_OBJECT_PROPS.cone.radius;
      const axis = cmd.axis || DEFAULT_OBJECT_PROPS.cone.axis;
      const len = Math.sqrt(axis[0] ** 2 + axis[1] ** 2 + axis[2] ** 2) || 1;
      geometry = new THREE.ConeGeometry(r, len, 32);
      mesh = new THREE.Mesh(geometry, material);
      const dir = new THREE.Vector3(...axis).normalize();
      const up = new THREE.Vector3(0, 1, 0);
      mesh.quaternion.setFromUnitVectors(up, dir);
      break;
    }

    case 'ring': {
      const r = cmd.radius ?? DEFAULT_OBJECT_PROPS.ring.radius;
      const t = cmd.thickness ?? DEFAULT_OBJECT_PROPS.ring.thickness;
      geometry = new THREE.TorusGeometry(r, t, 16, 48);
      mesh = new THREE.Mesh(geometry, material);
      break;
    }

    case 'pyramid': {
      // 사각뿔 — ConeGeometry(radialSegments=4) 사용
      const size = cmd.size || DEFAULT_OBJECT_PROPS.pyramid.size;
      const axis = cmd.axis || DEFAULT_OBJECT_PROPS.pyramid.axis;
      // size = [length(축방향 높이), height(상하), width(좌우)] 단순화: 평균 반경 사용
      const baseRadius = Math.max(size[1], size[2]) / 2 || 0.5;
      const height = size[0] || 1;
      geometry = new THREE.ConeGeometry(baseRadius, height, 4);
      mesh = new THREE.Mesh(geometry, material);
      // Cone 기본 축은 +Y, axis 방향으로 회전
      const dir = new THREE.Vector3(...axis).normalize();
      const up = new THREE.Vector3(0, 1, 0);
      mesh.quaternion.setFromUnitVectors(up, dir);
      break;
    }

    case 'ellipsoid': {
      // 타원체 — sphere를 size로 비균등 스케일링
      const size = cmd.size || DEFAULT_OBJECT_PROPS.ellipsoid.size;
      geometry = new THREE.SphereGeometry(0.5, 32, 16);
      mesh = new THREE.Mesh(geometry, material);
      mesh.scale.set(size[0], size[1], size[2]);
      break;
    }

    case 'helix': {
      // 나선 — 파라메트릭 곡선을 BufferGeometry + Line으로
      const r = cmd.radius ?? DEFAULT_OBJECT_PROPS.helix.radius;
      const axis = cmd.axis || DEFAULT_OBJECT_PROPS.helix.axis;
      const length = cmd.length ?? DEFAULT_OBJECT_PROPS.helix.length;
      const coils = cmd.coils ?? DEFAULT_OBJECT_PROPS.helix.coils;
      const segments = Math.max(64, coils * 32);

      const positions = [];
      for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const angle = t * coils * Math.PI * 2;
        // 기본 축은 +X — 진행축 X, 반경은 Y/Z 평면
        const x = t * length;
        const y = r * Math.cos(angle);
        const z = r * Math.sin(angle);
        positions.push(x, y, z);
      }
      const helixGeom = new THREE.BufferGeometry();
      helixGeom.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(positions, 3),
      );
      const helixMat = new THREE.LineBasicMaterial({
        color: col,
        transparent: cmd.opacity < 1,
        opacity: cmd.opacity ?? 1,
      });
      mesh = new THREE.Line(helixGeom, helixMat);
      // axis 방향으로 회전 (기본 X축 → axis)
      const dir = new THREE.Vector3(...axis).normalize();
      const xAxis = new THREE.Vector3(1, 0, 0);
      mesh.quaternion.setFromUnitVectors(xAxis, dir);
      break;
    }

    case 'label': {
      // 항상 카메라를 향하는 텍스트 스프라이트 (Canvas 텍스처)
      const sprite = createLabelSprite(cmd);
      mesh = sprite;
      break;
    }

    case 'curve': {
      // 동적으로 점이 추가되는 폴리라인
      const initialPoints = (cmd.points || []).flat();
      const cgeom = new THREE.BufferGeometry();
      cgeom.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(initialPoints, 3),
      );
      const cmat = new THREE.LineBasicMaterial({
        color: col,
        transparent: cmd.opacity < 1,
        opacity: cmd.opacity ?? 1,
      });
      mesh = new THREE.Line(cgeom, cmat);
      curveRegistry.set(cmd.id, {
        line: mesh,
        positions: initialPoints.slice(),
        kind: 'curve',
      });
      break;
    }

    case 'points': {
      // 점 집합 — THREE.Points
      const initialPoints = (cmd.points || []).flat();
      const pgeom = new THREE.BufferGeometry();
      pgeom.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(initialPoints, 3),
      );
      const pmat = new THREE.PointsMaterial({
        color: col,
        size: (cmd.size ?? 5) * 0.02,
        sizeAttenuation: true,
        transparent: cmd.opacity < 1,
        opacity: cmd.opacity ?? 1,
      });
      mesh = new THREE.Points(pgeom, pmat);
      curveRegistry.set(cmd.id, {
        line: mesh,
        positions: initialPoints.slice(),
        kind: 'points',
      });
      break;
    }

    case 'triangle':
    case 'quad': {
      const verts = cmd.vertices || [];
      const positions = [];
      const colors = [];
      // triangle: 3정점 1면, quad: 4정점 2면(0,1,2)+(0,2,3)
      const indices = cmd.type === 'triangle' ? [0, 1, 2] : [0, 1, 2, 0, 2, 3];
      for (const i of indices) {
        const v = verts[i] || { pos: [0, 0, 0], color: [1, 1, 1] };
        positions.push(v.pos[0], v.pos[1], v.pos[2]);
        colors.push(v.color[0], v.color[1], v.color[2]);
      }
      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      geom.computeVertexNormals();
      const mat = new THREE.MeshStandardMaterial({
        vertexColors: true,
        side: THREE.DoubleSide,
        roughness: 0.5,
        metalness: 0.05,
      });
      mesh = new THREE.Mesh(geom, mat);
      break;
    }

    case 'extrusion': {
      // 단순화된 extrusion: 2D 단면(shape)을 path 첫→끝 방향으로 압출
      const path = cmd.path || [];
      const shape = cmd.shape || [];
      if (path.length >= 2 && shape.length >= 3) {
        const shape2D = new THREE.Shape();
        shape2D.moveTo(shape[0][0], shape[0][1]);
        for (let i = 1; i < shape.length; i++) {
          shape2D.lineTo(shape[i][0], shape[i][1]);
        }
        shape2D.closePath();

        const curve3 = new THREE.CatmullRomCurve3(
          path.map((p) => new THREE.Vector3(p[0], p[1], p[2] ?? 0)),
        );
        const extrudeSettings = {
          steps: Math.max(path.length * 4, 12),
          extrudePath: curve3,
        };
        geometry = new THREE.ExtrudeGeometry(shape2D, extrudeSettings);
      } else {
        // path/shape가 부실하면 1x1x1 box로 대체
        geometry = new THREE.BoxGeometry(1, 1, 1);
      }
      mesh = new THREE.Mesh(geometry, material);
      break;
    }

    case 'local_light': {
      const light = new THREE.PointLight(
        toThreeColor(cmd.color || [1, 1, 1]),
        cmd.intensity ?? 1,
        50, // distance
      );
      if (cmd.pos) light.position.set(cmd.pos[0], cmd.pos[1], cmd.pos[2]);
      scene.add(light);
      meshRegistry.set(cmd.id, light);
      registerObject('local_light', getRegistryProps(cmd), cmd.id);
      return;
    }

    case 'distant_light': {
      const light = new THREE.DirectionalLight(
        toThreeColor(cmd.color || [1, 1, 1]),
        cmd.intensity ?? 1,
      );
      const dir = cmd.direction || [0, -1, 0];
      // DirectionalLight의 position = -direction (빛이 오는 방향)
      light.position.set(-dir[0] * 10, -dir[1] * 10, -dir[2] * 10);
      light.target.position.set(0, 0, 0);
      scene.add(light);
      scene.add(light.target);
      meshRegistry.set(cmd.id, light);
      registerObject('distant_light', getRegistryProps({ ...cmd, direction: dir }), cmd.id);
      return;
    }

    default:
      console.warn(`[Bridge] 알 수 없는 객체 타입: ${cmd.type}`);
      return;
  }

  // 위치 설정
  if (cmd.pos) {
    mesh.position.set(cmd.pos[0], cmd.pos[1], cmd.pos[2]);
  }

  // 가시성
  mesh.visible = cmd.visible !== false;

  // 픽 식별용 — raycasting 시 mesh.userData.vpId로 VPython id 복원
  mesh.userData = mesh.userData || {};
  mesh.userData.vpId = cmd.id;

  // 씬에 추가
  scene.add(mesh);
  meshRegistry.set(cmd.id, mesh);

  // 궤적(trail) 생성
  if (cmd.make_trail) {
    createTrail(cmd, scene);
  }

  // 객체 레지스트리에 등록 (Python Worker의 cmd.id를 그대로 사용)
  registerObject(cmd.type, getRegistryProps(cmd), cmd.id);
}

/**
 * 궤적(trail) 라인 생성
 */
function createTrail(cmd, scene) {
  const trailColor = cmd.trail_color
    ? toThreeColor(cmd.trail_color)
    : toThreeColor(cmd.color || [1, 1, 1]);
  const trailMaterial = new THREE.LineBasicMaterial({ color: trailColor });
  const trailGeometry = new THREE.BufferGeometry();
  const positions = [];
  // 초기 위치를 첫 포인트로 추가
  if (cmd.pos) {
    positions.push(cmd.pos[0], cmd.pos[1], cmd.pos[2]);
  }
  trailGeometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3),
  );
  const trailLine = new THREE.Line(trailGeometry, trailMaterial);
  scene.add(trailLine);
  trailRegistry.set(cmd.id, {
    line: trailLine,
    positions: positions,
    maxPoints: 10000,
  });
}

/**
 * 궤적 업데이트 — 새 위치 추가
 */
function updateTrail(cmd) {
  const trail = trailRegistry.get(cmd.id);
  if (!trail) return;
  trail.positions.push(cmd.pos[0], cmd.pos[1], cmd.pos[2]);
  // 최대 길이 제한
  if (trail.positions.length > trail.maxPoints * 3) {
    trail.positions.splice(0, 3);
  }
  trail.line.geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(trail.positions, 3),
  );
  trail.line.geometry.computeBoundingSphere();
}

/**
 * 객체 속성 업데이트
 */
function updateMesh(cmd) {
  const mesh = meshRegistry.get(cmd.id);
  if (!mesh) return;

  const registryUpdates = {};

  if (cmd.pos) {
    mesh.position.set(cmd.pos[0], cmd.pos[1], cmd.pos[2]);
    registryUpdates.pos = cmd.pos;
  }

  if (cmd.color) {
    if (mesh.isLight) {
      mesh.color = toThreeColor(cmd.color);
    } else if (mesh.isGroup) {
      // compound(Group) — 모든 자식 재질 색상 변경
      mesh.traverse((child) => {
        if (child.material) updateMaterialColor(child.material, toThreeColor(cmd.color));
      });
    } else if (mesh.material) {
      updateMaterialColor(mesh.material, toThreeColor(cmd.color));
    }
    registryUpdates.color = cmd.color;
  }

  if (cmd.intensity !== undefined && mesh.isLight) {
    mesh.intensity = cmd.intensity;
    registryUpdates.intensity = cmd.intensity;
  }

  if (cmd.direction !== undefined && mesh.isDirectionalLight) {
    mesh.position.set(-cmd.direction[0] * 10, -cmd.direction[1] * 10, -cmd.direction[2] * 10);
    registryUpdates.direction = cmd.direction;
  }

  if (cmd.visible !== undefined) {
    mesh.visible = cmd.visible;
    registryUpdates.visible = cmd.visible;
  }

  if (cmd.opacity !== undefined) {
    if (mesh.isGroup) {
      // compound(Group) — 모든 자식 재질 투명도 변경
      mesh.traverse((child) => {
        if (child.material) {
          child.material.opacity = cmd.opacity;
          child.material.transparent = cmd.opacity < 1;
        }
      });
    } else if (mesh.material) {
      mesh.material.opacity = cmd.opacity;
      mesh.material.transparent = cmd.opacity < 1;
    }
    registryUpdates.opacity = cmd.opacity;
  }

  if (cmd.emissive !== undefined && !mesh.isLight) {
    if (mesh.isGroup) {
      mesh.traverse((child) => {
        if (child.material) setMaterialEmissive(child.material, cmd.emissive);
      });
    } else if (mesh.material) {
      setMaterialEmissive(mesh.material, cmd.emissive);
    }
    registryUpdates.emissive = cmd.emissive;
  }

  if (cmd.radius !== undefined && mesh.geometry) {
    registryUpdates.radius = cmd.radius;
    // geometry 재생성 (sphere, cone, cylinder, ring)
    let newGeom;
    if (mesh.geometry.type === 'SphereGeometry') {
      newGeom = new THREE.SphereGeometry(cmd.radius, 32, 16);
    } else if (mesh.geometry.type === 'ConeGeometry') {
      const h = mesh.geometry.parameters?.height || 1;
      newGeom = new THREE.ConeGeometry(cmd.radius, h, 32);
    } else if (mesh.geometry.type === 'CylinderGeometry') {
      const h = mesh.geometry.parameters?.height || 1;
      newGeom = new THREE.CylinderGeometry(cmd.radius, cmd.radius, h, 32);
    } else if (mesh.geometry.type === 'TorusGeometry') {
      const t = mesh.geometry.parameters?.tube || 0.1;
      newGeom = new THREE.TorusGeometry(cmd.radius, t, 16, 48);
    }
    if (newGeom) {
      mesh.geometry.dispose();
      mesh.geometry = newGeom;
    }
  }

  if (cmd.size !== undefined && mesh.geometry) {
    registryUpdates.size = cmd.size;
    const s = cmd.size;
    if (mesh.geometry.type === 'BoxGeometry') {
      const newGeom = new THREE.BoxGeometry(s[0], s[1], s[2]);
      mesh.geometry.dispose();
      mesh.geometry = newGeom;
    } else if (mesh.geometry.type === 'SphereGeometry') {
      // ellipsoid는 sphere + scale로 표현하므로 size 갱신은 scale 변경
      mesh.scale.set(s[0], s[1], s[2]);
    }
  }

  // 라벨 텍스트/색상 갱신 — Sprite를 새 캔버스 텍스처로 교체
  if (mesh.isSprite && (cmd.text !== undefined || cmd.color !== undefined)) {
    if (cmd.text !== undefined) registryUpdates.text = cmd.text;
    updateLabelSprite(mesh, cmd);
  }

  if (cmd.thickness !== undefined) {
    registryUpdates.thickness = cmd.thickness;
  }

  if (cmd.thickness !== undefined && mesh.geometry?.type === 'TorusGeometry') {
    // ring의 경우 geometry 재생성
    const r = mesh.geometry.parameters?.radius || 1;
    const newGeom = new THREE.TorusGeometry(r, cmd.thickness, 16, 48);
    mesh.geometry.dispose();
    mesh.geometry = newGeom;
  }

  if (cmd.axis !== undefined) {
    const dir = new THREE.Vector3(...cmd.axis).normalize();
    const up = new THREE.Vector3(0, 1, 0);
    mesh.quaternion.setFromUnitVectors(up, dir);
    registryUpdates.axis = cmd.axis;
  }

  if (cmd.shaftwidth !== undefined) {
    registryUpdates.shaftwidth = cmd.shaftwidth;
  }

  if (Object.keys(registryUpdates).length > 0) {
    updateObject(cmd.id, registryUpdates);
  }
}

/**
 * 배치 커맨드 처리 (커맨드 배칭 패턴)
 */
export function processBatch(commands, scene) {
  for (const cmd of commands) {
    switch (cmd.action) {
      case 'create':
        createObject(cmd, scene);
        break;
      case 'update':
        updateMesh(cmd);
        break;
      case 'scene':
        if (cmd.property === 'background' && cmd.value) {
          scene.background = toThreeColor(cmd.value);
        } else if (cmd.property === 'range' && scene._cameraSystem) {
          scene._cameraSystem.setExplicitRange(Number(cmd.value));
        } else if (cmd.property === 'center' && scene._cameraSystem) {
          const c = cmd.value;
          scene._cameraSystem.setExplicitCenter(c[0], c[1], c[2]);
        } else if (cmd.property === 'autoscale' && scene._cameraSystem) {
          scene._cameraSystem.setAutoscale(Boolean(cmd.value));
        }
        break;
      case 'trail_update':
        updateTrail(cmd);
        break;
      case 'trail_clear': {
        const trail = trailRegistry.get(cmd.id);
        if (trail) {
          trail.positions.length = 0;
          trail.line.geometry.setAttribute(
            'position',
            new THREE.Float32BufferAttribute([], 3),
          );
          trail.line.geometry.computeBoundingSphere();
        }
        break;
      }
      case 'trail_attach': {
        // 기존 trail이 없으면 새로 만든다
        if (!trailRegistry.has(cmd.id) && meshRegistry.has(cmd.id)) {
          createTrail({
            id: cmd.id,
            pos: cmd.pos || [0, 0, 0],
            color: [1, 1, 1],
            trail_color: cmd.trail_color,
          }, scene);
          if (cmd.retain) {
            const t = trailRegistry.get(cmd.id);
            if (t) t.maxPoints = cmd.retain;
          }
        }
        break;
      }
      case 'curve_append': {
        const c = curveRegistry.get(cmd.id);
        if (c) {
          c.positions.push(cmd.pos[0], cmd.pos[1], cmd.pos[2]);
          c.line.geometry.setAttribute(
            'position',
            new THREE.Float32BufferAttribute(c.positions, 3),
          );
          c.line.geometry.computeBoundingSphere();
        }
        break;
      }
      case 'curve_clear': {
        const c = curveRegistry.get(cmd.id);
        if (c) {
          c.positions.length = 0;
          c.line.geometry.setAttribute(
            'position',
            new THREE.Float32BufferAttribute([], 3),
          );
          c.line.geometry.computeBoundingSphere();
        }
        break;
      }
      case 'compound': {
        const group = new THREE.Group();
        // 기존 메시를 그룹으로 이동
        for (const subId of cmd.sub_ids) {
          const subMesh = meshRegistry.get(subId);
          if (subMesh) {
            scene.remove(subMesh);
            group.add(subMesh);
          }
        }
        if (cmd.pos) group.position.set(cmd.pos[0], cmd.pos[1], cmd.pos[2]);
        if (cmd.color) {
          group.traverse((child) => {
            if (child.material) child.material.color = toThreeColor(cmd.color);
          });
        }
        if (cmd.opacity !== undefined && cmd.opacity < 1) {
          group.traverse((child) => {
            if (child.material) {
              child.material.opacity = cmd.opacity;
              child.material.transparent = true;
            }
          });
        }
        group.visible = cmd.visible !== false;
        scene.add(group);
        meshRegistry.set(cmd.id, group);

        // compound 궤적 생성
        if (cmd.make_trail) {
          createTrail(cmd, scene);
        }

        registerObject('compound', getRegistryProps(cmd), cmd.id);
        break;
      }
      case 'sound':
        try { processSoundCommand(cmd); } catch { /* 사운드 에러가 3D 렌더링을 막지 않도록 */ }
        break;
      case 'chart':
        renderChart(cmd, scene);
        break;

      // === 위젯 ===
      case 'widget_create':
        try { createWidget(cmd); } catch (e) { console.warn('[widget create]', e); }
        break;
      case 'widget_update':
        try { updateWidget(cmd); } catch (e) { console.warn('[widget update]', e); }
        break;
      case 'widget_delete':
        try { deleteWidget(cmd); } catch (e) { console.warn('[widget delete]', e); }
        break;

      // === 2D 그래프 ===
      case 'graph_create':
        try { createGraph(cmd); } catch (e) { console.warn('[graph create]', e); }
        break;
      case 'graph_delete':
        try { deleteGraph(cmd); } catch (e) { console.warn('[graph delete]', e); }
        break;
      case 'graph_series_create':
        try { createSeries(cmd); } catch (e) { console.warn('[series create]', e); }
        break;
      case 'graph_series_delete':
        try { deleteSeries(cmd); } catch (e) { console.warn('[series delete]', e); }
        break;
      case 'graph_series_plot':
        try { plotSeries(cmd); } catch (e) { console.warn('[series plot]', e); }
        break;

      // === 이벤트 바인딩 신호 ===
      case 'scene_bind':
        for (const name of (cmd.events || [])) sceneBoundEvents.add(name);
        break;
      case 'scene_unbind':
        for (const name of (cmd.events || [])) sceneBoundEvents.delete(name);
        break;
      default:
        console.warn(`[Bridge] 알 수 없는 액션: ${cmd.action}`);
    }
  }
}

/**
 * 씬 초기화 (모든 VPython 객체 제거)
 */
export function clearScene(scene) {
  // 메시 레지스트리 정리
  for (const [, mesh] of meshRegistry) {
    scene.remove(mesh);
    if (mesh.geometry) mesh.geometry.dispose();
    if (mesh.material) mesh.material.dispose();
    // Group(compound)의 자식도 정리
    if (mesh.isGroup) {
      mesh.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
      });
    }
  }
  meshRegistry.clear();

  // 궤적(trail) 레지스트리 정리
  for (const [, trail] of trailRegistry) {
    scene.remove(trail.line);
    trail.line.geometry.dispose();
    trail.line.material.dispose();
  }
  trailRegistry.clear();

  // curve/points 레지스트리 정리 (line 자체는 meshRegistry와 공유)
  curveRegistry.clear();

  // 위젯·2D 그래프 DOM 정리
  clearWidgets();
  clearGraphs2D();

  // 이벤트 바인딩 초기화
  sceneBoundEvents.clear();

  // 차트 객체 정리
  clearCharts(scene);

  clearRegistry();
}

/**
 * 메시 레지스트리 조회
 */
export function getMesh(id) {
  return meshRegistry.get(id);
}

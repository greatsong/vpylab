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

// Three.js 메시 레지스트리 (id → Three.js Mesh)
const meshRegistry = new Map();

// 궤적(trail) 레지스트리 (id → { line, positions, material, maxPoints })
const trailRegistry = new Map();

// 기본 재질 설정
const DEFAULT_MATERIAL_PARAMS = {
  roughness: 0.4,
  metalness: 0.1,
};

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
      geometry = new THREE.SphereGeometry(cmd.radius || 0.5, 32, 16);
      mesh = new THREE.Mesh(geometry, material);
      break;

    case 'box': {
      const size = cmd.size || [1, 1, 1];
      geometry = new THREE.BoxGeometry(size[0], size[1], size[2]);
      mesh = new THREE.Mesh(geometry, material);
      break;
    }

    case 'cylinder': {
      const r = cmd.radius || 0.5;
      const axis = cmd.axis || [1, 0, 0];
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
      const axis = cmd.axis || [1, 0, 0];
      const len = Math.sqrt(axis[0] ** 2 + axis[1] ** 2 + axis[2] ** 2) || 1;
      const sw = cmd.shaftwidth || 0.1;

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
      const r = cmd.radius || 0.5;
      const axis = cmd.axis || [1, 0, 0];
      const len = Math.sqrt(axis[0] ** 2 + axis[1] ** 2 + axis[2] ** 2) || 1;
      geometry = new THREE.ConeGeometry(r, len, 32);
      mesh = new THREE.Mesh(geometry, material);
      const dir = new THREE.Vector3(...axis).normalize();
      const up = new THREE.Vector3(0, 1, 0);
      mesh.quaternion.setFromUnitVectors(up, dir);
      break;
    }

    case 'ring': {
      const r = cmd.radius || 1;
      const t = cmd.thickness || 0.1;
      geometry = new THREE.TorusGeometry(r, t, 16, 48);
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
    // box의 경우 geometry 재생성
    const s = cmd.size;
    const newGeom = new THREE.BoxGeometry(s[0], s[1], s[2]);
    mesh.geometry.dispose();
    mesh.geometry = newGeom;
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
        }
        break;
      case 'trail_update':
        updateTrail(cmd);
        break;
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

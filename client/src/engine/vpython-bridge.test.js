/**
 * VPython 브릿지 통합 테스트
 * Worker에서 온 JSON 커맨드 → Three.js 씬 적용 검증
 * P0 버그: sphere() 생성 시 3D 뷰포트에 구가 안 보이는 문제
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// chart-system과 sound-system을 mock (복잡한 Three.js 의존성 회피)
vi.mock('./chart-system', () => ({
  renderChart: vi.fn(),
  clearCharts: vi.fn(),
}));
vi.mock('./sound-system', () => ({
  processSoundCommand: vi.fn(),
  setNotePlayCallback: vi.fn(),
}));

// Three.js를 mock — jsdom에서는 WebGL 불가
vi.mock('three', () => {
  class Color {
    constructor(r, g, b) {
      if (typeof r === 'number' && g === undefined) {
        // hex color
        this.r = r; this.g = 0; this.b = 0;
      } else {
        this.r = r ?? 0; this.g = g ?? 0; this.b = b ?? 0;
      }
    }
  }

  class Vector3 {
    constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
    normalize() { return this; }
  }

  class Quaternion {
    setFromUnitVectors() { return this; }
  }

  class Geometry {
    dispose() {}
  }

  class Material {
    constructor(params = {}) {
      Object.assign(this, params);
    }
    dispose() {}
  }

  class Mesh {
    constructor(geometry, material) {
      this.geometry = geometry;
      this.material = material;
      this.position = { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; } };
      this.quaternion = new Quaternion();
      this.visible = true;
    }
  }

  class Group {
    constructor() {
      this.children = [];
      this.position = { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; } };
      this.quaternion = new Quaternion();
      this.visible = true;
    }
    add(child) { this.children.push(child); }
  }

  class Light {
    constructor(color, intensity) {
      this.color = color || new Color(1, 1, 1);
      this.intensity = intensity ?? 1;
      this.position = { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; } };
      this.visible = true;
      this.isLight = true;
    }
  }

  class PointLight extends Light {
    constructor(color, intensity, distance) {
      super(color, intensity);
      this.distance = distance;
      this.isPointLight = true;
    }
  }

  class DirectionalLight extends Light {
    constructor(color, intensity) {
      super(color, intensity);
      this.isDirectionalLight = true;
      this.target = { position: { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; } } };
    }
  }

  class Scene {
    constructor() {
      this.children = [];
      this.background = null;
    }
    add(obj) { this.children.push(obj); }
    remove(obj) {
      const idx = this.children.indexOf(obj);
      if (idx >= 0) this.children.splice(idx, 1);
    }
    traverse(callback) {
      callback(this);
      for (const child of this.children) {
        callback(child);
        if (child.children) {
          for (const gc of child.children) callback(gc);
        }
      }
    }
  }

  return {
    Color,
    Vector3,
    Mesh,
    Group,
    PointLight,
    DirectionalLight,
    SphereGeometry: class extends Geometry {},
    BoxGeometry: class extends Geometry {},
    CylinderGeometry: class extends Geometry {},
    ConeGeometry: class extends Geometry {},
    TorusGeometry: class extends Geometry {},
    MeshStandardMaterial: class extends Material {},
    Scene,
  };
});

import { processBatch, clearScene, getMesh } from './vpython-bridge';
import { gradeA } from './grading-engine';
import { getSnapshot } from './object-registry';
import * as THREE from 'three';

describe('vpython-bridge: processBatch', () => {
  let scene;

  beforeEach(() => {
    scene = new THREE.Scene();
    clearScene(scene);
  });

  // === P0 핵심 테스트: sphere 생성 → 씬에 mesh 존재 ===

  it('sphere create 커맨드 → 씬에 mesh가 추가된다', () => {
    const commands = [{
      action: 'create',
      id: 'obj_1',
      type: 'sphere',
      pos: [0, 0, 0],
      color: [1, 0, 0],
      visible: true,
      opacity: 1,
      radius: 0.5,
    }];

    processBatch(commands, scene);

    // 씬에 mesh가 추가되었는지 확인
    expect(scene.children.length).toBe(1);
    // meshRegistry에 등록되었는지 확인
    const mesh = getMesh('obj_1');
    expect(mesh).toBeDefined();
    expect(mesh.visible).toBe(true);
  });

  it('sphere 위치가 정확히 설정된다', () => {
    processBatch([{
      action: 'create',
      id: 'obj_1',
      type: 'sphere',
      pos: [3, 2, 1],
      color: [1, 1, 1],
      visible: true,
      opacity: 1,
      radius: 1,
    }], scene);

    const mesh = getMesh('obj_1');
    expect(mesh.position.x).toBe(3);
    expect(mesh.position.y).toBe(2);
    expect(mesh.position.z).toBe(1);
  });

  // === 다른 객체 타입 ===

  it('box create 커맨드 → 씬에 추가', () => {
    processBatch([{
      action: 'create', id: 'obj_2', type: 'box',
      pos: [0, 0, 0], color: [0, 1, 0], visible: true, opacity: 1,
      size: [2, 1, 1],
    }], scene);

    expect(getMesh('obj_2')).toBeDefined();
    expect(scene.children.length).toBe(1);
  });

  it('cylinder create 커맨드 → 씬에 추가', () => {
    processBatch([{
      action: 'create', id: 'obj_3', type: 'cylinder',
      pos: [0, 0, 0], color: [0, 0, 1], visible: true, opacity: 1,
      radius: 0.3, axis: [0, 1, 0],
    }], scene);

    expect(getMesh('obj_3')).toBeDefined();
  });

  it('arrow create 커맨드 → Group으로 생성', () => {
    processBatch([{
      action: 'create', id: 'obj_4', type: 'arrow',
      pos: [0, 0, 0], color: [1, 1, 0], visible: true, opacity: 1,
      axis: [1, 0, 0], shaftwidth: 0.1,
    }], scene);

    const mesh = getMesh('obj_4');
    expect(mesh).toBeDefined();
    // arrow는 Group (shaft + head)
    expect(mesh.children).toBeDefined();
    expect(mesh.children.length).toBe(2);
  });

  it('ring create 커맨드 → 씬에 추가', () => {
    processBatch([{
      action: 'create', id: 'obj_5', type: 'ring',
      pos: [0, 0, 0], color: [1, 0, 1], visible: true, opacity: 1,
      radius: 1, thickness: 0.1,
    }], scene);

    expect(getMesh('obj_5')).toBeDefined();
  });

  it('cone create 커맨드 → 씬에 추가', () => {
    processBatch([{
      action: 'create', id: 'obj_6', type: 'cone',
      pos: [0, 0, 0], color: [0, 1, 1], visible: true, opacity: 1,
      radius: 0.5, axis: [0, 1, 0],
    }], scene);

    expect(getMesh('obj_6')).toBeDefined();
  });

  // === update 커맨드 ===

  it('update 커맨드로 위치를 변경한다', () => {
    processBatch([
      { action: 'create', id: 'obj_1', type: 'sphere', pos: [0, 0, 0], color: [1, 1, 1], visible: true, opacity: 1 },
      { action: 'update', id: 'obj_1', pos: [5, 3, 1] },
    ], scene);

    const mesh = getMesh('obj_1');
    expect(mesh.position.x).toBe(5);
    expect(mesh.position.y).toBe(3);
  });

  it('update로 visible을 false로 설정한다', () => {
    processBatch([
      { action: 'create', id: 'obj_1', type: 'sphere', pos: [0, 0, 0], color: [1, 1, 1], visible: true, opacity: 1 },
      { action: 'update', id: 'obj_1', visible: false },
    ], scene);

    expect(getMesh('obj_1').visible).toBe(false);
  });

  // === 배치 처리 ===

  it('여러 커맨드를 한 배치에서 처리한다', () => {
    const commands = [
      { action: 'create', id: 'obj_1', type: 'sphere', pos: [0, 0, 0], color: [1, 0, 0], visible: true, opacity: 1 },
      { action: 'create', id: 'obj_2', type: 'box', pos: [3, 0, 0], color: [0, 1, 0], visible: true, opacity: 1 },
      { action: 'create', id: 'obj_3', type: 'cylinder', pos: [0, 3, 0], color: [0, 0, 1], visible: true, opacity: 1 },
    ];

    processBatch(commands, scene);

    expect(scene.children.length).toBe(3);
    expect(getMesh('obj_1')).toBeDefined();
    expect(getMesh('obj_2')).toBeDefined();
    expect(getMesh('obj_3')).toBeDefined();
  });

  // === scene 커맨드 ===

  it('scene background 커맨드로 배경색을 변경한다', () => {
    processBatch([{
      action: 'scene',
      property: 'background',
      value: [0, 0, 0],
    }], scene);

    expect(scene.background).toBeDefined();
  });

  // === clearScene ===

  it('clearScene으로 모든 객체를 제거한다', () => {
    processBatch([
      { action: 'create', id: 'obj_1', type: 'sphere', pos: [0, 0, 0], color: [1, 1, 1], visible: true, opacity: 1 },
      { action: 'create', id: 'obj_2', type: 'box', pos: [1, 0, 0], color: [1, 1, 1], visible: true, opacity: 1 },
    ], scene);

    expect(scene.children.length).toBe(2);

    clearScene(scene);

    expect(scene.children.length).toBe(0);
    expect(getMesh('obj_1')).toBeUndefined();
    expect(getMesh('obj_2')).toBeUndefined();
  });

  // === 알 수 없는 타입/액션 (경고만, 에러 없음) ===

  it('알 수 없는 객체 타입은 무시하고 에러를 던지지 않는다', () => {
    expect(() => {
      processBatch([{
        action: 'create', id: 'obj_x', type: 'unknown',
        pos: [0, 0, 0], color: [1, 1, 1], visible: true, opacity: 1,
      }], scene);
    }).not.toThrow();

    expect(scene.children.length).toBe(0);
  });

  it('존재하지 않는 객체 update는 무시한다', () => {
    expect(() => {
      processBatch([{ action: 'update', id: 'nonexistent', pos: [1, 1, 1] }], scene);
    }).not.toThrow();
  });

  // === Python API가 보내는 실제 커맨드 형식 검증 ===

  it('Python sphere()가 보내는 형식과 일치하는 커맨드를 처리한다', () => {
    // vpython-api.py에서 sphere(pos=vector(1,2,3), color=color.red, radius=0.5) 호출 시:
    const pythonCommand = {
      action: 'create',
      id: 'obj_1',
      type: 'sphere',
      pos: [1, 2, 3],
      color: [1, 0, 0],
      visible: true,
      opacity: 1.0,
      radius: 0.5,
    };

    processBatch([pythonCommand], scene);

    const mesh = getMesh('obj_1');
    expect(mesh).toBeDefined();
    expect(mesh.position.x).toBe(1);
    expect(mesh.position.y).toBe(2);
    expect(mesh.position.z).toBe(3);
  });

  it('create 커맨드의 채점 속성을 레지스트리에 저장한다', () => {
    processBatch([{
      action: 'create',
      id: 'obj_1',
      type: 'sphere',
      pos: [1, 2, 3],
      color: [1, 0, 0],
      visible: true,
      opacity: 0.8,
      radius: 0.5,
    }], scene);

    const [snapshot] = getSnapshot();
    expect(snapshot.props.radius).toBe(0.5);
    expect(snapshot.props.opacity).toBe(0.8);

    const result = gradeA([
      { type: 'sphere', property: 'radius', operator: '==', value: 0.5 },
    ]);
    expect(result.passed).toBe(true);
  });

  it('update 커맨드의 색상과 크기 변경을 레지스트리에 반영한다', () => {
    processBatch([
      {
        action: 'create',
        id: 'obj_1',
        type: 'sphere',
        pos: [0, 0, 0],
        color: [1, 0, 0],
        visible: true,
        opacity: 1,
        radius: 0.5,
      },
      { action: 'update', id: 'obj_1', color: [0, 0.8, 0], radius: 2 },
    ], scene);

    const result = gradeA([
      { type: 'sphere', property: 'color.g', operator: '==', value: 0.8, tolerance: 0.01 },
      { type: 'sphere', property: 'radius', operator: '==', value: 2 },
    ]);

    expect(result.passed).toBe(true);
  });

  it('emissive 생성/업데이트를 재질과 레지스트리에 반영한다', () => {
    processBatch([
      {
        action: 'create',
        id: 'obj_1',
        type: 'sphere',
        pos: [0, 0, 0],
        color: [1, 0, 0],
        radius: 0.5,
        emissive: true,
      },
      { action: 'update', id: 'obj_1', emissive: false },
    ], scene);

    const mesh = getMesh('obj_1');
    expect(mesh.material.emissiveIntensity).toBe(0);

    const result = gradeA([
      { type: 'sphere', property: 'emissive', operator: '==', value: false },
    ]);

    expect(result.passed).toBe(true);
  });

  // === 조명 객체 ===

  it('local_light create → PointLight가 씬에 추가된다', () => {
    processBatch([{
      action: 'create', id: 'light_1', type: 'local_light',
      pos: [3, 5, 0], color: [1, 1, 0.8], intensity: 2,
    }], scene);

    const light = getMesh('light_1');
    expect(light).toBeDefined();
    expect(light.isPointLight).toBe(true);
    expect(light.intensity).toBe(2);
    expect(light.position.x).toBe(3);
    expect(light.position.y).toBe(5);
  });

  it('distant_light create → DirectionalLight가 씬에 추가된다', () => {
    processBatch([{
      action: 'create', id: 'light_2', type: 'distant_light',
      direction: [1, -1, 0], color: [1, 1, 1], intensity: 0.5,
    }], scene);

    const light = getMesh('light_2');
    expect(light).toBeDefined();
    expect(light.isDirectionalLight).toBe(true);
    expect(light.intensity).toBe(0.5);
  });

  it('local_light update로 위치와 intensity를 변경한다', () => {
    processBatch([
      { action: 'create', id: 'light_1', type: 'local_light', pos: [0, 0, 0], color: [1, 1, 1], intensity: 1 },
      { action: 'update', id: 'light_1', pos: [10, 5, 0], intensity: 3 },
    ], scene);

    const light = getMesh('light_1');
    expect(light.position.x).toBe(10);
    expect(light.intensity).toBe(3);
  });

  it('light의 color를 update할 수 있다', () => {
    processBatch([
      { action: 'create', id: 'light_1', type: 'local_light', pos: [0, 0, 0], color: [1, 1, 1], intensity: 1 },
      { action: 'update', id: 'light_1', color: [1, 0, 0] },
    ], scene);

    const light = getMesh('light_1');
    expect(light.color.r).toBe(1);
    expect(light.color.g).toBe(0);
  });
});

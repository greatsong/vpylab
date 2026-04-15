import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import CameraSystem, { MODE } from './camera-system';

function createControls() {
  return {
    target: new THREE.Vector3(0, 0, 0),
    domElement: {
      addEventListener() {},
      removeEventListener() {},
    },
  };
}

function createCamera() {
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
  camera.position.set(0, 0, 8);
  camera.lookAt(0, 0, 0);
  return camera;
}

describe('camera-system', () => {
  it('추적 모드에서는 Group의 앵커 위치를 중심으로 사용한다', () => {
    const scene = new THREE.Scene();
    const camera = createCamera();
    const controls = createControls();

    const group = new THREE.Group();
    group.position.set(4, 0, 0);

    const child = new THREE.Mesh(
      new THREE.BoxGeometry(2, 2, 2),
      new THREE.MeshBasicMaterial(),
    );
    child.position.set(2, 0, 0);
    group.add(child);
    scene.add(group);

    const system = new CameraSystem(camera, controls, scene, {
      followCenterDeadzone: 0.001,
    });

    system.mode = MODE.FOLLOW;
    system._targetCenter.set(0, 0, 0);
    system._currentCenter.set(0, 0, 0);

    system.update();

    expect(system._targetCenter.x).toBeCloseTo(4, 5);
  });

  it('추적 중 미세한 중심 변화는 무시한다', () => {
    const scene = new THREE.Scene();
    const camera = createCamera();
    const controls = createControls();

    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial(),
    );
    scene.add(mesh);

    const system = new CameraSystem(camera, controls, scene, {
      followCenterDeadzone: 0.05,
    });

    system.mode = MODE.FOLLOW;
    system._targetCenter.set(0, 0, 0);
    system._currentCenter.set(0, 0, 0);

    mesh.position.set(0.02, 0, 0);
    system.update();

    expect(system._targetCenter.x).toBeCloseTo(0, 5);
  });

  it('추적 중 미세한 크기 변화로는 줌하지 않는다', () => {
    const scene = new THREE.Scene();
    const camera = createCamera();
    const controls = createControls();

    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial(),
    );
    scene.add(mesh);

    const system = new CameraSystem(camera, controls, scene, {
      followZoomEnabled: true,
      zoomThreshold: 0.2,
    });

    system.resetToAutoFit();
    const initialDistance = system._targetDistance;
    system.mode = MODE.FOLLOW;

    mesh.geometry.dispose();
    mesh.geometry = new THREE.BoxGeometry(1.05, 1, 1);
    system.update();

    expect(system._targetDistance).toBeCloseTo(initialDistance, 5);

    mesh.geometry.dispose();
    mesh.geometry = new THREE.BoxGeometry(4, 4, 4);
    system.update();

    expect(system._targetDistance).toBeGreaterThan(initialDistance);
  });

  it('기본값에서는 추적 중 자동 줌을 고정한다', () => {
    const scene = new THREE.Scene();
    const camera = createCamera();
    const controls = createControls();

    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial(),
    );
    scene.add(mesh);

    const system = new CameraSystem(camera, controls, scene);

    system.resetToAutoFit();
    const initialDistance = system._targetDistance;
    system.mode = MODE.FOLLOW;

    mesh.geometry.dispose();
    mesh.geometry = new THREE.BoxGeometry(4, 4, 4);
    system.update();

    expect(system.isFollowZoomEnabled()).toBe(false);
    expect(system._targetDistance).toBeCloseTo(initialDistance, 5);
  });

  it('자동 줌을 다시 켜면 추적 거리 계산을 재개한다', () => {
    const scene = new THREE.Scene();
    const camera = createCamera();
    const controls = createControls();

    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial(),
    );
    scene.add(mesh);

    const system = new CameraSystem(camera, controls, scene);

    system.resetToAutoFit();
    const initialDistance = system._targetDistance;
    system.mode = MODE.FOLLOW;

    mesh.geometry.dispose();
    mesh.geometry = new THREE.BoxGeometry(4, 4, 4);
    system.setFollowZoomEnabled(true);

    expect(system.isFollowZoomEnabled()).toBe(true);
    expect(system._targetDistance).toBeGreaterThan(initialDistance);
  });
});

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
  it('기본 중심 설정은 기존 카메라 위치를 유지한다', () => {
    const camera = createCamera();
    const controls = createControls();
    const system = new CameraSystem(camera, controls, new THREE.Scene());
    const original = camera.position.clone();

    system.setExplicitCenter(2, 4, 0);

    expect(camera.position.equals(original)).toBe(true);
    expect(controls.target.toArray()).toEqual([2, 4, 0]);
    expect(system.getMode()).toBe(MODE.MANUAL);
  });

  it('좌표 수업의 중심 이동은 정면 방향과 확대 거리를 보존하고 반복 호출로 밀리지 않는다', () => {
    const camera = createCamera();
    const controls = createControls();
    const system = new CameraSystem(camera, controls, new THREE.Scene(), { preserveDirectionOnCenter: true });
    system.setExplicitRange(6);
    const distance = camera.position.distanceTo(controls.target);

    system.setExplicitCenter(2, 4, 0);
    expect(camera.position.toArray()).toEqual([2, 4, distance]);
    expect(camera.position.clone().sub(controls.target).normalize().toArray()).toEqual([0, 0, 1]);
    expect(camera.position.distanceTo(controls.target)).toBeCloseTo(distance, 10);

    const firstPosition = camera.position.clone();
    system.setExplicitCenter(2, 4, 0);
    expect(camera.position.equals(firstPosition)).toBe(true);

    system.setExplicitCenter(0, 0, 0);
    expect(camera.position.toArray()).toEqual([0, 0, distance]);
  });

  it('선택한 평행이동은 사용자가 회전한 방향을 보존하고 해제하면 기존 동작으로 돌아온다', () => {
    const camera = createCamera();
    const controls = createControls();
    camera.position.set(4, 3, 8);
    controls.target.set(-1, 1, 0);
    const system = new CameraSystem(camera, controls, new THREE.Scene());
    const offset = camera.position.clone().sub(controls.target);
    system.setPreserveDirectionOnCenter(true);

    system.setExplicitCenter(2, 4, 1);
    expect(camera.position.clone().sub(controls.target).toArray()).toEqual(offset.toArray());
    expect(controls.target.toArray()).toEqual([2, 4, 1]);

    system.setPreserveDirectionOnCenter(false);
    const previousPosition = camera.position.clone();
    system.setExplicitCenter(0, 0, 0);
    expect(camera.position.equals(previousPosition)).toBe(true);
  });

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
      zoomLocked: false,
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

    expect(system.isZoomLocked()).toBe(true);
    expect(system._targetDistance).toBeCloseTo(initialDistance, 5);
  });

  it('줌 고정 해제하면 거리 계산을 재개한다', () => {
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
    system.setZoomLocked(false);

    expect(system.isZoomLocked()).toBe(false);
    expect(system._targetDistance).toBeGreaterThan(initialDistance);
  });
});

describe('camera-system: GlowScript 호환 카메라 제어', () => {
  function createSystem(aspect = 1) {
    const camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
    camera.position.set(0, 0, 8);
    camera.lookAt(0, 0, 0);
    const controls = createControls();
    const system = new CameraSystem(camera, controls, new THREE.Scene());
    return { camera, controls, system };
  }

  it('scene.range는 화면 짧은 변 방향 시야의 절반이다 (가로가 넓을 때 세로 기준)', () => {
    const { camera, system } = createSystem(2);
    system.setExplicitRange(3);
    const expected = 3 / Math.tan((45 * Math.PI / 180) / 2);
    expect(camera.position.length()).toBeCloseTo(expected, 5);
    expect(system.getRange()).toBeCloseTo(3, 5);
    expect(system.getMode()).toBe(MODE.MANUAL);
  });

  it('세로가 더 길면 range는 가로 기준이 되어 거리가 종횡비만큼 늘어난다', () => {
    const { camera, system } = createSystem(0.5);
    system.setExplicitRange(3);
    const expected = (3 / 0.5) / Math.tan((45 * Math.PI / 180) / 2);
    expect(camera.position.length()).toBeCloseTo(expected, 5);
    expect(system.getRange()).toBeCloseTo(3, 5);
  });

  it('scene.forward는 중심과 거리를 유지한 채 보는 방향만 바꾼다', () => {
    const { camera, controls, system } = createSystem();
    controls.target.set(1, 1, 1);
    camera.position.set(1, 1, 9);
    system.setForward(0, -1, 0);
    expect(camera.position.x).toBeCloseTo(1, 5);
    expect(camera.position.y).toBeCloseTo(9, 5);
    expect(camera.position.z).toBeCloseTo(1, 5);
    expect(controls.target.toArray()).toEqual([1, 1, 1]);
    expect(system.getState().forward.map((v) => Math.round(v * 1000) / 1000)).toEqual([0, -1, 0]);
  });

  it('scene.camera.pos는 카메라를 옮기고 중심도 같이 평행이동한다', () => {
    const { camera, controls, system } = createSystem();
    system.setCameraPos(5, 0, 8);
    expect(camera.position.toArray()).toEqual([5, 0, 8]);
    expect(controls.target.toArray()).toEqual([5, 0, 0]);
    expect(system.getMode()).toBe(MODE.MANUAL);
  });

  it('scene.camera.axis는 카메라를 두고 중심을 pos + axis로 옮기며 range를 다시 계산한다', () => {
    const { camera, controls, system } = createSystem();
    system.setCameraAxis(0, 0, -4);
    expect(camera.position.toArray()).toEqual([0, 0, 8]);
    expect(controls.target.toArray()).toEqual([0, 0, 4]);
    expect(system.getRange()).toBeCloseTo(4 * Math.tan((45 * Math.PI / 180) / 2), 5);
  });

  it('scene.fov를 바꾸면 명시한 range가 그대로 보이도록 거리를 다시 계산한다', () => {
    const { camera, system } = createSystem();
    system.setExplicitRange(3);
    system.setFov(Math.PI / 3);
    expect(camera.fov).toBeCloseTo(60, 5);
    expect(camera.position.length()).toBeCloseTo(3 / Math.tan(Math.PI / 6), 5);
  });

  it('scene.camera.follow(obj)는 매 프레임 객체 위치를 중심으로 삼고 거리를 유지한다', () => {
    const { camera, controls, system } = createSystem();
    const scene = system.scene;
    const target = new THREE.Object3D();
    target.position.set(3, 0, 0);
    scene.add(target);
    system.followObject(target);
    system.update();
    expect(controls.target.toArray()).toEqual([3, 0, 0]);
    expect(camera.position.distanceTo(controls.target)).toBeCloseTo(8, 5);
    target.position.set(3, 2, 0);
    system.update();
    expect(controls.target.toArray()).toEqual([3, 2, 0]);
    system.followObject(null);
    expect(system.getMode()).toBe(MODE.MANUAL);
  });

  it('scene.range는 추적을 끊지 않고 거리만 바꾼다', () => {
    const { camera, controls, system } = createSystem();
    const target = new THREE.Object3D();
    target.position.set(-4, 0, 0);
    system.scene.add(target);
    system.followObject(target);
    system.setExplicitRange(3);
    system.update();
    expect(controls.target.toArray()).toEqual([-4, 0, 0]);
    expect(camera.position.distanceTo(controls.target)).toBeCloseTo(3 / Math.tan((45 * Math.PI / 180) / 2), 5);
  });

  it('새 실행이 시작되면 추적 대상과 명시 range가 해제된다', () => {
    const { system } = createSystem();
    const target = new THREE.Object3D();
    system.scene.add(target);
    system.setExplicitRange(2);
    system.followObject(target);
    system.onCodeStart();
    expect(system._followTarget).toBeNull();
    expect(system._explicitRange).toBeNull();
    expect(system.getMode()).toBe(MODE.AUTO_FIT);
    system.dispose();
  });
});

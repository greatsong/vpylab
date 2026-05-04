/**
 * VPyLab — 하이브리드 카메라 시스템
 *
 * Phase 1: Auto-Fit — 모든 물체를 감싸도록 자동 줌
 * Phase 2: Smooth Follow — 물체 중심을 부드럽게 추적
 * Phase 3: Manual — 사용자가 마우스로 조작하면 자동 해제
 * Phase 4: 더블클릭 → 다시 Auto-Fit
 *
 * 사용법:
 *   const cam = new CameraSystem(camera, controls, scene);
 *   cam.update();          // 매 프레임 호출
 *   cam.resetToAutoFit();  // 더블클릭 등에서 호출
 *   cam.dispose();         // 정리
 */

import * as THREE from 'three';

// 카메라 모드
const MODE = {
  AUTO_FIT: 'auto-fit',     // 전체 물체를 감싸는 자동 줌
  FOLLOW: 'follow',          // 물체 중심 부드러운 추적
  MANUAL: 'manual',          // 사용자 수동 조작
};

// 기본 설정
const DEFAULTS = {
  // Auto-Fit
  fitPadding: 1.8,           // 바운딩 박스 대비 여유 공간 배율
  fitMinDistance: 4,          // 최소 카메라 거리
  fitMaxDistance: 40,         // 최대 카메라 거리
  fitDelay: 300,              // 코드 실행 후 Auto-Fit까지 딜레이 (ms)

  // Smooth Follow
  followUpdateInterval: 1,   // 추적 모드에서 바운딩 갱신 주기 (프레임)
  zoomLocked: true,            // 추적 모드 기본값: 줌 고정
  lerpFactor: 0.05,          // 카메라 이동 보간 속도 (0=안움직임, 1=즉시)
  zoomLerpFactor: 0.03,      // 줌 보간 속도
  followThreshold: 0.01,     // Auto-Fit → Follow 전환 감지 임계값
  followCenterDeadzone: 0.03, // 추적 중 이 이하 미세 중심 변화는 무시
  zoomThreshold: 0.08,       // 추적 중 이 이하 거리 변화율은 무시

  // 기본 카메라
  defaultDistance: 8,         // 물체 없을 때 기본 거리
  defaultFov: 45,

  // 씬 내 VPython 객체 판별
  ignoreTypes: ['GridHelper', 'AxesHelper', 'AmbientLight', 'DirectionalLight', 'PointLight'],
};

export default class CameraSystem {
  constructor(camera, controls, scene, options = {}) {
    this.camera = camera;
    this.controls = controls;
    this.scene = scene;
    this.options = { ...DEFAULTS, ...options };

    this.mode = MODE.AUTO_FIT;
    this._targetCenter = new THREE.Vector3(0, 0, 0);
    this._targetDistance = this.options.defaultDistance;
    this._currentCenter = new THREE.Vector3(0, 0, 0);
    this._currentDistance = this.options.defaultDistance;
    this._lastBounds = null;
    this._userInteracted = false;
    this._fitTimer = null;
    this._frameCount = 0;

    // 추적 모드용: 이전 프레임의 물체 위치 기록
    this._prevPositions = new Map(); // object.uuid → Vector3
    this._followZoomLocked = false;   // Follow 모드 내부 줌 고정 플래그

    // 사용자 조작 감지 — 마우스 이벤트로 수동 모드 전환
    this._onUserInteraction = () => {
      if (this.mode !== MODE.MANUAL) {
        this.mode = MODE.MANUAL;
        this._userInteracted = true;
      }
    };

    const domElement = controls.domElement;
    if (domElement) {
      domElement.addEventListener('pointerdown', this._onUserInteraction);
      domElement.addEventListener('wheel', this._onUserInteraction);
    }
  }

  /**
   * 씬에서 VPython 객체만 필터링 (조명, 그리드 등 제외)
   */
  _getVPythonObjects() {
    const objects = [];
    const ignoreTypes = this.options.ignoreTypes;

    this.scene.traverse((child) => {
      // Mesh, Group만 대상 (Light, Helper 제외)
      if (child === this.scene) return;
      if (child.isLight) return;
      if (ignoreTypes.some(t => child.constructor.name === t)) return;
      if (child.type === 'GridHelper' || child.type === 'AxesHelper') return;

      // Group은 최상위만, Mesh는 Group 바깥의 독립 객체만 추적 대상으로 사용
      if (child.isGroup && child.parent === this.scene) {
        objects.push(child);
        return;
      }

      if (child.isMesh && !child.parent?.isGroup) {
        objects.push(child);
      }
    });

    return objects;
  }

  /**
   * 단일 객체의 실제 렌더 바운딩 박스를 합친다.
   */
  _expandBoxByObject(box, obj) {
    let expanded = false;

    if (obj.isGroup) {
      obj.traverse((child) => {
        if (!child.isMesh || !child.geometry) return;
        child.geometry.computeBoundingBox();
        if (!child.geometry.boundingBox) return;
        const childBox = child.geometry.boundingBox.clone();
        childBox.applyMatrix4(child.matrixWorld);
        box.union(childBox);
        expanded = true;
      });
      return expanded;
    }

    if (obj.isMesh && obj.geometry) {
      obj.geometry.computeBoundingBox();
      if (!obj.geometry.boundingBox) return false;
      const meshBox = obj.geometry.boundingBox.clone();
      meshBox.applyMatrix4(obj.matrixWorld);
      box.union(meshBox);
      return true;
    }

    return false;
  }

  /**
   * 카메라 프레이밍용 상태 계산
   * @returns {{ center: THREE.Vector3, size: THREE.Vector3, radius: number } | null}
   */
  _computeCameraState() {
    const objects = this._getVPythonObjects();
    if (objects.length === 0) return null;

    const frameBox = new THREE.Box3();
    let hasFrameBounds = false;

    for (const obj of objects) {
      hasFrameBounds = this._expandBoxByObject(frameBox, obj) || hasFrameBounds;
    }

    if (!hasFrameBounds || frameBox.isEmpty()) return null;

    const center = new THREE.Vector3();
    const size = new THREE.Vector3();
    frameBox.getCenter(center);
    frameBox.getSize(size);

    return {
      center,
      size,
      radius: size.length() / 2,
    };
  }

  /**
   * 추적 모드용: 움직이는 물체만의 바운딩 박스 계산
   * 이전 프레임과 위치를 비교해 이동한 물체를 감지한다.
   * 움직이는 물체가 없으면 전체 물체 상태를 반환한다.
   */
  _computeMovingObjectsState() {
    const objects = this._getVPythonObjects();
    if (objects.length === 0) return null;

    const MOVE_THRESHOLD = 0.001; // 이 이상 이동하면 '움직이는 물체'로 판정
    const worldPos = new THREE.Vector3();
    const movingObjects = [];
    const currentPositions = new Map();

    for (const obj of objects) {
      obj.getWorldPosition(worldPos);
      currentPositions.set(obj.uuid, worldPos.clone());

      const prev = this._prevPositions.get(obj.uuid);
      if (prev && prev.distanceTo(worldPos) > MOVE_THRESHOLD) {
        movingObjects.push(obj);
      }
    }

    // 현재 위치를 다음 프레임 비교용으로 저장
    this._prevPositions = currentPositions;

    // 움직이는 물체가 있으면 그것들만으로 바운딩 계산
    const targetObjects = movingObjects.length > 0 ? movingObjects : objects;

    const box = new THREE.Box3();
    let hasBounds = false;
    for (const obj of targetObjects) {
      hasBounds = this._expandBoxByObject(box, obj) || hasBounds;
    }

    if (!hasBounds || box.isEmpty()) return null;

    const size = new THREE.Vector3();
    box.getSize(size);

    // 추적 중심은 렌더 바운딩 중심이 아니라 객체 앵커 위치를 사용한다.
    // Group 내부 자식 위치가 치우쳐도 학생이 움직이는 주 객체를 따라가게 하기 위함.
    const anchorCenter = new THREE.Vector3();
    const anchorPos = new THREE.Vector3();
    for (const obj of targetObjects) {
      obj.getWorldPosition(anchorPos);
      anchorCenter.add(anchorPos);
    }
    anchorCenter.divideScalar(targetObjects.length);

    return {
      center: anchorCenter,
      size,
      radius: size.length() / 2,
      hasMovingObjects: movingObjects.length > 0,
    };
  }

  /**
   * 바운딩 박스에 맞는 카메라 거리 계산
   */
  _distanceForBounds(radius) {
    const fov = this.camera.fov * (Math.PI / 180);
    const aspect = this.camera.aspect;
    const effectiveFov = Math.min(fov, fov * aspect);
    let distance = (radius * this.options.fitPadding) / Math.tan(effectiveFov / 2);

    // 범위 제한
    distance = Math.max(distance, this.options.fitMinDistance);
    distance = Math.min(distance, this.options.fitMaxDistance);

    return distance;
  }

  /**
   * Auto-Fit: 모든 물체에 맞춰 카메라 줌
   */
  _autoFit() {
    this.scene.updateMatrixWorld(true);
    const state = this._computeCameraState();
    if (!state) {
      this._targetCenter.set(0, 0, 0);
      this._targetDistance = this.options.defaultDistance;
      return;
    }

    this._targetCenter.copy(state.center);
    this._targetDistance = this._distanceForBounds(state.radius);
    this._lastBounds = state;
  }

  /**
   * 매 프레임 호출 — 카메라를 부드럽게 목표로 이동
   */
  update() {
    this._frameCount++;

    // 수동 모드면 아무것도 하지 않음
    if (this.mode === MODE.MANUAL) return;

    // Auto-Fit은 매 프레임, Follow는 더 자주 측정해 계단식 움직임을 줄인다.
    const shouldUpdateState = this.mode === MODE.AUTO_FIT
      || this._frameCount % this.options.followUpdateInterval === 0;

    if (shouldUpdateState) {
      this.scene.updateMatrixWorld(true);

      if (this.mode === MODE.AUTO_FIT) {
        // 자동 모드: 전체 물체가 항상 화면 안에 담기도록 중심 + 줌 조절
        const state = this._computeCameraState();
        if (state) {
          this._targetCenter.copy(state.center);
          if (!this.options.zoomLocked) {
            this._targetDistance = this._distanceForBounds(state.radius);
          }
          this._lastBounds = state;
        }
      } else if (this.mode === MODE.FOLLOW) {
        // 추적 모드: 움직이는 물체의 중심만 따라감 (줌은 고정)
        const state = this._computeMovingObjectsState();
        if (state) {
          const centerDiff = state.center.distanceTo(this._targetCenter);
          if (centerDiff > this.options.followCenterDeadzone) {
            this._targetCenter.copy(state.center);
          }
          if (!this.options.zoomLocked) {
            const nextDistance = this._distanceForBounds(state.radius);
            const distanceDiffRatio = Math.abs(nextDistance - this._targetDistance)
              / Math.max(this._targetDistance, 1);
            if (distanceDiffRatio > this.options.zoomThreshold) {
              this._targetDistance = nextDistance;
            }
          }
          this._lastBounds = state;
        }
      }
    }

    // 부드럽게 보간
    const lerpFactor = this.mode === MODE.AUTO_FIT
      ? 0.12  // Auto-Fit은 좀 더 빠르게
      : this.options.lerpFactor;

    this._currentCenter.lerp(this._targetCenter, lerpFactor);
    this._currentDistance += (this._targetDistance - this._currentDistance) * this.options.zoomLerpFactor;

    // 카메라 방향을 타겟 업데이트 전에 저장
    const direction = new THREE.Vector3();
    direction.subVectors(this.camera.position, this.controls.target);

    // 방향 벡터가 너무 짧으면 기본 z축 (정면)
    if (direction.lengthSq() < 0.001) {
      direction.set(0, 0, 1);
    } else {
      direction.normalize();
    }

    // OrbitControls 타겟 업데이트
    this.controls.target.copy(this._currentCenter);

    // 카메라 위치: 보던 방향 유지 + 거리 조절
    this.camera.position.copy(this._currentCenter).addScaledVector(direction, this._currentDistance);
  }

  /**
   * Auto-Fit으로 리셋 (더블클릭, 리셋 버튼 등)
   */
  resetToAutoFit() {
    this.mode = MODE.AUTO_FIT;
    this._userInteracted = false;
    this._autoFit();
  }

  /**
   * Follow 모드로 전환 (UI 버튼 등)
   */
  switchToFollow() {
    this.mode = MODE.FOLLOW;
    this._userInteracted = false;
    // 이전 위치 기록 초기화 (다음 프레임부터 이동 감지 시작)
    this._prevPositions.clear();
    // 현재 전체 상태에서 추적 시작점 설정
    this.scene.updateMatrixWorld(true);
    const state = this._computeCameraState();
    if (state) {
      this._targetCenter.copy(state.center);
    }
  }

  /**
   * 코드 실행 시작 시 호출 — 딜레이 후 Auto-Fit
   */
  onCodeStart() {
    this.mode = MODE.AUTO_FIT;
    this._userInteracted = false;
    this._frameCount = 0;
    this._prevPositions.clear();

    // 약간의 딜레이 후 Auto-Fit (물체 생성 시간 확보)
    clearTimeout(this._fitTimer);
    this._fitTimer = setTimeout(() => {
      this._autoFit();
    }, this.options.fitDelay);
  }

  /**
   * 현재 카메라 모드
   */
  getMode() {
    return this.mode;
  }

  /**
   * 줌 고정 설정
   */
  setZoomLocked(locked) {
    this.options.zoomLocked = Boolean(locked);

    // 줌 고정 해제 시 현재 상태에 맞게 거리 재계산
    if (!locked) {
      this.scene.updateMatrixWorld(true);
      const state = this._computeCameraState();
      if (state) {
        this._targetDistance = this._distanceForBounds(state.radius);
      }
    }
  }

  /**
   * 줌 고정 상태 조회
   */
  isZoomLocked() {
    return this.options.zoomLocked;
  }

  /**
   * scene.range = N — VPython 호환: 시야 반경 N. MANUAL 모드로 전환.
   */
  setExplicitRange(range) {
    if (!Number.isFinite(range) || range <= 0) return;
    this.mode = MODE.MANUAL;
    this._userInteracted = true;
    // FOV 기반으로 거리 계산: tan(fov/2) = range/distance
    const fov = this.camera.fov * (Math.PI / 180);
    const distance = range / Math.tan(fov / 2);
    this._targetDistance = distance;
    this._currentDistance = distance;

    // 즉시 적용
    const direction = new THREE.Vector3();
    direction.subVectors(this.camera.position, this.controls.target);
    if (direction.lengthSq() < 0.001) direction.set(0, 0, 1);
    else direction.normalize();
    this.camera.position.copy(this._currentCenter).addScaledVector(direction, distance);
  }

  /**
   * scene.center = vec — 카메라 타겟 중심점 설정. MANUAL 모드로 전환.
   */
  setExplicitCenter(x, y, z) {
    this.mode = MODE.MANUAL;
    this._userInteracted = true;
    this._targetCenter.set(x, y, z);
    this._currentCenter.set(x, y, z);
    this.controls.target.copy(this._currentCenter);
  }

  /**
   * scene.autoscale = bool — true면 Auto-Fit으로 복귀, false면 MANUAL 유지
   */
  setAutoscale(enabled) {
    if (enabled) {
      this.resetToAutoFit();
    } else {
      this.mode = MODE.MANUAL;
      this._userInteracted = true;
    }
  }

  /**
   * 정리
   */
  dispose() {
    clearTimeout(this._fitTimer);
    const domElement = this.controls?.domElement;
    if (domElement) {
      domElement.removeEventListener('pointerdown', this._onUserInteraction);
      domElement.removeEventListener('wheel', this._onUserInteraction);
    }
  }
}

export { MODE };

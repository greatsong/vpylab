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
  lerpFactor: 0.03,          // 카메라 이동 보간 속도 (0=안움직임, 1=즉시)
  zoomLerpFactor: 0.03,      // 줌 보간 속도
  followThreshold: 2.0,      // 바운딩 중심이 이 이상 변해야 카메라 추적 시작
  snapThreshold: 0.002,      // 이 이하면 즉시 스냅 (떨림 방지)

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

      // Mesh 또는 Group (arrow는 Group)
      if (child.isMesh || (child.isGroup && child.parent === this.scene)) {
        objects.push(child);
      }
    });

    return objects;
  }

  /**
   * 모든 VPython 객체의 바운딩 박스 계산
   * @returns {{ center: THREE.Vector3, size: THREE.Vector3, radius: number } | null}
   */
  _computeBounds() {
    const objects = this._getVPythonObjects();
    if (objects.length === 0) return null;

    const box = new THREE.Box3();
    for (const obj of objects) {
      if (obj.isGroup) {
        // Group은 자식들의 바운딩 박스를 합침
        obj.traverse((child) => {
          if (child.isMesh) {
            child.geometry.computeBoundingBox();
            const childBox = child.geometry.boundingBox.clone();
            childBox.applyMatrix4(child.matrixWorld);
            box.union(childBox);
          }
        });
      } else if (obj.isMesh && obj.geometry) {
        obj.geometry.computeBoundingBox();
        const meshBox = obj.geometry.boundingBox.clone();
        meshBox.applyMatrix4(obj.matrixWorld);
        box.union(meshBox);
      }
    }

    if (box.isEmpty()) return null;

    const center = new THREE.Vector3();
    const size = new THREE.Vector3();
    box.getCenter(center);
    box.getSize(size);

    const radius = size.length() / 2;

    return { center, size, radius };
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
    const bounds = this._computeBounds();
    if (!bounds) {
      this._targetCenter.set(0, 0, 0);
      this._targetDistance = this.options.defaultDistance;
      return;
    }

    this._targetCenter.copy(bounds.center);
    this._targetDistance = this._distanceForBounds(bounds.radius);
    this._lastBounds = bounds;
  }

  /**
   * 매 프레임 호출 — 카메라를 부드럽게 목표로 이동
   */
  update() {
    this._frameCount++;

    // 수동 모드면 아무것도 하지 않음
    if (this.mode === MODE.MANUAL) return;

    // Auto-Fit / Follow 모드: 바운딩 박스 업데이트 (매 10프레임)
    if (this._frameCount % 10 === 0 || this.mode === MODE.AUTO_FIT) {
      const bounds = this._computeBounds();

      if (bounds) {
        this._targetCenter.copy(bounds.center);
        this._targetDistance = this._distanceForBounds(bounds.radius);

        // 물체가 움직이고 있으면 Follow 모드로 전환
        if (this.mode === MODE.AUTO_FIT && this._lastBounds) {
          const centerDiff = bounds.center.distanceTo(this._lastBounds.center);
          if (centerDiff > this.options.followThreshold) {
            this.mode = MODE.FOLLOW;
          }
        }

        this._lastBounds = bounds;
      }
    }

    // 카메라 방향을 보간 전에 먼저 저장 (피드백 루프 방지)
    const direction = new THREE.Vector3();
    direction.subVectors(this.camera.position, this.controls.target);

    if (direction.lengthSq() < 0.001) {
      direction.set(0, 0, 1);
    } else {
      direction.normalize();
    }

    // 부드럽게 보간 — 목표에 충분히 가까우면 스냅
    const lerpFactor = this.mode === MODE.AUTO_FIT
      ? 0.12
      : this.options.lerpFactor;

    const centerDist = this._currentCenter.distanceTo(this._targetCenter);
    const zoomDiff = Math.abs(this._targetDistance - this._currentDistance);

    if (centerDist < this.options.snapThreshold) {
      this._currentCenter.copy(this._targetCenter);
    } else {
      this._currentCenter.lerp(this._targetCenter, lerpFactor);
    }

    if (zoomDiff < this.options.snapThreshold) {
      this._currentDistance = this._targetDistance;
    } else {
      this._currentDistance += (this._targetDistance - this._currentDistance) * this.options.zoomLerpFactor;
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
   * 코드 실행 시작 시 호출 — 딜레이 후 Auto-Fit
   */
  onCodeStart() {
    this.mode = MODE.AUTO_FIT;
    this._userInteracted = false;
    this._frameCount = 0;

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

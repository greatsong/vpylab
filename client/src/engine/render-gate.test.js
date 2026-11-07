import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createRenderGate } from './render-gate';

describe('정지 장면 그리기', () => {
  it('정지 장면은 보정 주기만 그리되 카메라·명령·투영 변화는 바로 반영한다', () => {
    const camera = new THREE.PerspectiveCamera();
    const gate = createRenderGate();
    expect(gate(0, camera)).toBe(true);
    expect(gate(16, camera)).toBe(false);
    expect(gate(499, camera)).toBe(false);
    expect(gate(500, camera)).toBe(true);
    camera.position.x = 1;
    expect(gate(516, camera)).toBe(true);
    camera.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.1);
    expect(gate(532, camera)).toBe(true);
    camera.aspect = 2; camera.updateProjectionMatrix();
    expect(gate(548, camera)).toBe(true);
    expect(gate(564, camera, true)).toBe(true);
    expect(gate(580, camera)).toBe(false);
  });
});

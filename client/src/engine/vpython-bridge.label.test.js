import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import CameraSystem from './camera-system';

vi.mock('./chart-system', () => ({ renderChart: vi.fn(), clearCharts: vi.fn() }));
vi.mock('./sound-system', () => ({ processSoundCommand: vi.fn(), setNotePlayCallback: vi.fn(), setSoundEventCallback: vi.fn() }));

import { clearScene, getMesh, processBatch } from './vpython-bridge';

describe('VPython label 화면 글자', () => {
  let scene;
  let contexts;

  beforeEach(() => {
    scene = new THREE.Scene();
    clearScene(scene);
    contexts = [];
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => {
      const context = {
        measureText: vi.fn(text => ({ width: Array.from(text).length * 16 })),
        fillText: vi.fn(), fillRect: vi.fn(), strokeRect: vi.fn(),
      };
      contexts.push(context);
      return context;
    });
  });

  afterEach(() => {
    clearScene(scene);
    vi.restoreAllMocks();
  });

  function createLabel(overrides = {}) {
    processBatch([{
      action: 'create', type: 'label', id: 'label-1', text: '가설과 관찰',
      height: 15, pos: [0, 0, 0], color: [0.2, 0.8, 1], ...overrides,
    }], scene);
    return getMesh('label-1');
  }

  function renderAt(sprite, camera, viewportHeight) {
    const renderer = { getSize: target => target.set(900, viewportHeight) };
    sprite.onBeforeRender(renderer, scene, camera);
    return sprite.scale.y * Math.abs(camera.projectionMatrix.elements[5]) * viewportHeight / 2;
  }

  it('한국어 줄바꿈과 빈 줄을 각각 측정하고 다른 높이에 그린다', () => {
    const sprite = createLabel({ text: '한 줄\r\n\r\n더 긴 마지막 줄' });
    const [measure, draw] = contexts;
    expect(measure.measureText.mock.calls.map(call => call[0])).toEqual(['한 줄', ' ', '더 긴 마지막 줄']);
    expect(draw.fillText.mock.calls.map(call => call[0])).toEqual(['한 줄', '', '더 긴 마지막 줄']);
    const positions = draw.fillText.mock.calls.map(call => call[2]);
    expect(positions[1] - positions[0]).toBe(positions[2] - positions[1]);
    expect(positions[1]).toBeGreaterThan(positions[0]);
    expect(sprite.material.map.image.width).toBe('더 긴 마지막 줄'.length * 16 + 16);
    expect(sprite.material.map.image.height).toBe((20 * 3 + 8) * 2);
  });

  it('작은 height도 최소 12 CSS px 글자로 그린다', () => {
    const sprite = createLabel({ height: 7 });
    expect(sprite.userData.fontPx).toBe(12);
    expect(contexts[1].font).toMatch(/^24px /);
    expect(sprite.material.sizeAttenuation).toBe(false);
  });

  it('카메라 거리와 줌, 뷰포트 크기가 달라도 화면 픽셀 높이를 유지한다', () => {
    const sprite = createLabel();
    const camera = new THREE.PerspectiveCamera(45, 1.5, 0.1, 1000);
    const desiredPixels = sprite.userData.labelPixelHeight;
    camera.position.z = 8;
    expect(renderAt(sprite, camera, 600)).toBeCloseTo(desiredPixels, 8);
    const firstScale = sprite.scale.y;
    camera.position.z = 180;
    camera.updateMatrixWorld();
    expect(renderAt(sprite, camera, 600)).toBeCloseTo(desiredPixels, 8);
    expect(sprite.scale.y).toBeCloseTo(firstScale, 8);
    camera.zoom = 2;
    camera.updateProjectionMatrix();
    expect(renderAt(sprite, camera, 600)).toBeCloseTo(desiredPixels, 8);
    expect(sprite.scale.y).toBeCloseTo(firstScale / 2, 8);
    expect(renderAt(sprite, camera, 1200)).toBeCloseTo(desiredPixels, 8);
    expect(sprite.scale.y).toBeCloseTo(firstScale / 4, 8);
    expect(sprite.matrixWorld.elements[0]).toBeCloseTo(sprite.scale.x, 8);
  });

  it('직교 카메라에서도 줄 수를 포함한 화면 크기를 유지한다', () => {
    const sprite = createLabel({ text: '다음 목표\n3 미\n성공 2' });
    const camera = new THREE.OrthographicCamera(-20, 20, 12, -12, 0.1, 1000);
    expect(renderAt(sprite, camera, 720)).toBeCloseTo(sprite.userData.labelPixelHeight, 8);
    camera.zoom = 3;
    camera.updateProjectionMatrix();
    expect(renderAt(sprite, camera, 720)).toBeCloseTo(sprite.userData.labelPixelHeight, 8);
  });

  it('동일한 텍스트·색 반복은 텍스처를 만들거나 글자색을 이중 적용하지 않는다', () => {
    const sprite = createLabel();
    const texture = sprite.material.map;
    const dispose = vi.spyOn(texture, 'dispose');
    const originalContexts = contexts.length;
    for (let i = 0; i < 60; i++) {
      processBatch([{ action: 'update', id: 'label-1', text: '가설과 관찰', color: [0.2, 0.8, 1] }], scene);
    }
    expect(sprite.material.map).toBe(texture);
    expect(dispose).not.toHaveBeenCalled();
    expect(contexts).toHaveLength(originalContexts);
    expect(sprite.material.color).toEqual(new THREE.Color(1, 1, 1));
  });

  it('내용 변경과 종료에서 이전 텍스처·재질을 해제하고 객체 식별자를 보존한다', () => {
    const sprite = createLabel();
    const oldTexture = sprite.material.map;
    const oldMaterial = sprite.material;
    const disposeTexture = vi.spyOn(oldTexture, 'dispose');
    const disposeMaterial = vi.spyOn(oldMaterial, 'dispose');
    const renderHook = sprite.onBeforeRender;
    processBatch([{ action: 'update', id: 'label-1', text: '관찰 결과\n충돌 8회' }], scene);
    expect(disposeTexture).toHaveBeenCalledOnce();
    expect(disposeMaterial).toHaveBeenCalledOnce();
    expect(sprite.userData.vpId).toBe('label-1');
    expect(sprite.userData.text).toBe('관찰 결과\n충돌 8회');
    expect(sprite.onBeforeRender).toBe(renderHook);
    const finalDispose = vi.spyOn(sprite.material.map, 'dispose');
    clearScene(scene);
    expect(finalDispose).toHaveBeenCalledOnce();
    expect(scene.children).not.toContain(sprite);
  });

  it('멀리 있는 큰 라벨이 실제 물체의 자동 카메라 범위를 바꾸지 않는다', () => {
    const camera = new THREE.PerspectiveCamera(45, 1.5, 0.1, 1000);
    const controls = {
      target: new THREE.Vector3(),
      domElement: { addEventListener() {}, removeEventListener() {} },
    };
    processBatch([{ action: 'create', id: 'box-1', type: 'box', size: [2, 2, 2], pos: [0, 0, 0] }], scene);
    const system = new CameraSystem(camera, controls, scene);
    scene.updateMatrixWorld();
    const before = system._computeCameraState();
    const sprite = createLabel({ pos: [10000, 10000, 0], height: 100, text: '큰 제목\n새 실험' });
    renderAt(sprite, camera, 100);
    scene.updateMatrixWorld();
    const after = system._computeCameraState();
    expect(after.center).toEqual(before.center);
    expect(after.size).toEqual(before.size);
    expect(after.radius).toBe(before.radius);
  });
});

/**
 * GlowScript 호환 객체 브릿지 테스트 — group, compound 회전/복제, curve/points 점별 색,
 * extrusion 스윕 지오메트리, 3D text, 궤적 종류, scene.visible/delete, wtext.
 * jsdom에서 실제 Three.js를 사용한다(WebGL 없이 지오메트리·그룹만 검사).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';

vi.mock('./chart-system', () => ({ renderChart: vi.fn(), clearCharts: vi.fn() }));
vi.mock('./sound-system', () => ({ processSoundCommand: vi.fn(), setNotePlayCallback: vi.fn(), setSoundEventCallback: vi.fn() }));

import { clearScene, getMesh, processBatch, updateBillboards } from './vpython-bridge';
import { getSnapshot } from './object-registry';
import { buildExtrusionGeometry } from './extrusion-geometry';
import { whenTextReady, setTextFontLoader, hasMissingGlyph, billboardCount } from './text3d-system';

// 테스트용 최소 글꼴 — 라틴 글자 몇 개만 가진 가짜 Font (TextGeometry는 실제 모듈)
const FAKE_FONT_DATA = {
  glyphs: {
    H: { ha: 700, o: 'm 0 0 l 600 0 l 600 700 l 0 700 z' },
    i: { ha: 300, o: 'm 0 0 l 200 0 l 200 500 l 0 500 z' },
    a: { ha: 600, o: 'm 0 0 l 500 0 l 500 500 l 0 500 z' },
  },
  familyName: 'fake', resolution: 1000,
  boundingBox: { xMin: 0, xMax: 700, yMin: -200, yMax: 800 },
  underlineThickness: 50,
};

function installFakeFont() {
  const loader = Promise.all([
    import('three/addons/loaders/FontLoader.js'),
    import('three/addons/geometries/TextGeometry.js'),
  ]).then(([{ Font }, { TextGeometry }]) => ({ font: new Font(FAKE_FONT_DATA), TextGeometry }));
  setTextFontLoader(loader);
}

function create(scene, cmd) {
  processBatch([{ action: 'create', visible: true, opacity: 1, color: [1, 1, 1], ...cmd }], scene);
  return getMesh(cmd.id);
}

describe('GlowScript 호환 객체 브릿지', () => {
  let scene;

  beforeEach(() => {
    scene = new THREE.Scene();
    clearScene(scene);
    installFakeFont();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => ({
      measureText: vi.fn((text) => ({ width: Array.from(text).length * 16 })),
      fillText: vi.fn(), fillRect: vi.fn(), strokeRect: vi.fn(),
    }));
  });

  afterEach(() => {
    clearScene(scene);
    vi.restoreAllMocks();
  });

  // === group ===
  describe('group', () => {
    it('group= 으로 만든 객체는 그룹 안에 들어가고 씬 최상위에서는 빠진다', () => {
      const g = create(scene, { id: 'g1', type: 'group', pos: [0, 0, 0], axis: [1, 0, 0], up: [0, 1, 0] });
      const b = create(scene, { id: 'b1', type: 'box', pos: [1, 0, 0], size: [1, 1, 1], group: 'g1' });
      expect(g.isGroup).toBe(true);
      expect(b.parent).toBe(g);
      expect(scene.children).toContain(g);
      expect(scene.children).not.toContain(b);
      expect(b.position.x).toBe(1);
    });

    it('g.pos는 그룹을 옮기고 하위 객체는 상대 좌표를 유지한다 (회전은 Python이 하위 객체마다 보낸다)', () => {
      const g = create(scene, { id: 'g1', type: 'group', pos: [0, 0, 0] });
      const b = create(scene, { id: 'b1', type: 'box', pos: [1, 0, 0], size: [1, 1, 1], group: 'g1' });
      processBatch([{ action: 'update', id: 'g1', pos: [5, 0, 0] }], scene);
      expect(g.position.x).toBe(5);
      expect(b.position.x).toBe(1);
      g.updateMatrixWorld(true);
      expect(b.getWorldPosition(new THREE.Vector3()).x).toBeCloseTo(6, 6);
      // GlowScript group.rotate: 하위 객체의 상대 pos·axis가 바뀐 값으로 update가 온다
      processBatch([{ action: 'update', id: 'b1', pos: [0, 0, -1], axis: [0, 0, -1], up: [0, 1, 0] }], scene);
      g.updateMatrixWorld(true);
      const world = b.getWorldPosition(new THREE.Vector3());
      expect(world.x).toBeCloseTo(5, 6);
      expect(world.z).toBeCloseTo(-1, 6);
      processBatch([{ action: 'update', id: 'g1', visible: false }], scene);
      expect(g.visible).toBe(false);
    });

    it('compound와 curve도 group 안에 들어간다', () => {
      create(scene, { id: 'g1', type: 'group', pos: [0, 0, 0] });
      create(scene, { id: 's1', type: 'sphere', pos: [0, 0, 0], radius: 1 });
      processBatch([{ action: 'compound', id: 'c1', sub_ids: ['s1'], pos: [0, 0, 0], group: 'g1' }], scene);
      create(scene, { id: 'cv1', type: 'curve', points: [[0, 0, 0], [1, 0, 0]], group: 'g1' });
      const g = getMesh('g1');
      expect(getMesh('c1').parent).toBe(g);
      expect(getMesh('cv1').parent).toBe(g);
    });
  });

  // === compound ===
  describe('compound', () => {
    it('axis/up 갱신이 그룹 방향을 바꾸고 레지스트리에 기록된다', () => {
      create(scene, { id: 's1', type: 'sphere', pos: [1, 0, 0], radius: 0.5 });
      create(scene, { id: 's2', type: 'sphere', pos: [-1, 0, 0], radius: 0.5 });
      processBatch([{ action: 'compound', id: 'c1', sub_ids: ['s1', 's2'], pos: [0, 0, 0], axis: [1, 0, 0], up: [0, 1, 0] }], scene);
      const c = getMesh('c1');
      expect(c.userData.vpType).toBe('compound');
      expect(c.children.length).toBe(2);
      processBatch([{ action: 'update', id: 'c1', pos: [0, 2, 0], axis: [0, 1, 0], up: [-1, 0, 0] }], scene);
      c.updateMatrixWorld(true);
      const world = c.children[0].getWorldPosition(new THREE.Vector3());
      expect(world.x).toBeCloseTo(0, 6);
      expect(world.y).toBeCloseTo(3, 6);
      const [snap] = getSnapshot().filter((o) => o.id === 'c1');
      expect(snap.props.axis).toEqual([0, 1, 0]);
    });

    it('center로 부품을 그룹 원점 기준으로 옮기고 scale로 크기를 바꾼다 (compound.length)', () => {
      create(scene, { id: 's1', type: 'sphere', pos: [2, 0, 0], radius: 0.5 });
      create(scene, { id: 's2', type: 'sphere', pos: [4, 0, 0], radius: 0.5 });
      processBatch([{ action: 'compound', id: 'c1', sub_ids: ['s1', 's2'], pos: [3, 0, 0], center: [3, 0, 0] }], scene);
      const c = getMesh('c1');
      expect(c.position.x).toBe(3);
      expect(c.children[0].position.x).toBe(-1);
      expect(c.children[1].position.x).toBe(1);
      c.updateMatrixWorld(true);
      expect(c.children[1].getWorldPosition(new THREE.Vector3()).x).toBeCloseTo(4, 6);
      processBatch([{ action: 'update', id: 'c1', scale: [2, 1, 1] }], scene);
      expect(c.scale.x).toBe(2);
      c.updateMatrixWorld(true);
      expect(c.children[1].getWorldPosition(new THREE.Vector3()).x).toBeCloseTo(5, 6);
    });

    it('emissive·texture 지정이 모든 자식 재질에 적용된다', () => {
      create(scene, { id: 's1', type: 'sphere', pos: [0, 0, 0], radius: 0.5 });
      processBatch([{ action: 'compound', id: 'c1', sub_ids: ['s1'], pos: [0, 0, 0], emissive: true }], scene);
      const child = getMesh('c1').children[0];
      expect(child.material.emissiveIntensity).toBeGreaterThan(0);
    });
  });

  // === curve / points ===
  describe('curve / points', () => {
    it('점마다의 색을 정점 색으로 그리고 append·set·clear를 반영한다', () => {
      const c = create(scene, {
        id: 'cv', type: 'curve', color: [1, 1, 0],
        points: [[0, 0, 0], [1, 0, 0]], colors: [[1, 0, 0], [0, 1, 0]], radii: [0, 0],
      });
      expect(c.material.vertexColors).toBe(true);
      expect(Array.from(c.geometry.getAttribute('color').array)).toEqual([1, 0, 0, 0, 1, 0]);
      processBatch([{ action: 'curve_append', id: 'cv', points: [[2, 0, 0]], colors: [[0, 0, 1]], radii: [0.1] }], scene);
      expect(c.geometry.getAttribute('position').count).toBe(3);
      expect(Array.from(c.geometry.getAttribute('color').array).slice(6)).toEqual([0, 0, 1]);
      // 옛 형식(pos 하나)도 받는다 — 곡선 기본색으로
      processBatch([{ action: 'curve_append', id: 'cv', pos: [3, 0, 0] }], scene);
      expect(Array.from(c.geometry.getAttribute('color').array).slice(9)).toEqual([1, 1, 0]);
      processBatch([{ action: 'curve_set', id: 'cv', points: [[9, 9, 9]], colors: [[0.5, 0.5, 0.5]] }], scene);
      expect(c.geometry.getAttribute('position').count).toBe(1);
      expect(c.geometry.getAttribute('position').getX(0)).toBe(9);
      processBatch([{ action: 'update', id: 'cv', color: [0, 1, 1] }], scene);
      expect(Array.from(c.geometry.getAttribute('color').array)).toEqual([0, 1, 1]);
      processBatch([{ action: 'curve_clear', id: 'cv' }], scene);
      expect(c.geometry.getAttribute('position').count).toBe(0);
    });

    it('origin·axis 갱신은 점을 두고 선 전체를 옮기고 돌린다 (c.rotate)', () => {
      const c = create(scene, { id: 'cv', type: 'curve', points: [[1, 0, 0]], origin: [0, 0, 0] });
      processBatch([{ action: 'update', id: 'cv', origin: [0, 5, 0], axis: [0, 0, -1], up: [0, 1, 0] }], scene);
      expect(c.position.y).toBe(5);
      const p = new THREE.Vector3(1, 0, 0).applyQuaternion(c.quaternion);
      expect(p.z).toBeCloseTo(-1, 6);
      expect(c.geometry.getAttribute('position').getX(0)).toBe(1);
    });

    it('points는 size_units=world면 radius로, 아니면 픽셀 size로 크기를 정한다', () => {
      const pw = create(scene, { id: 'p1', type: 'points', points: [[0, 0, 0]], radii: [0.05], size_units: 'world' });
      expect(pw.isPoints).toBe(true);
      expect(pw.material.size).toBeCloseTo(0.1, 6);
      const pp = create(scene, { id: 'p2', type: 'points', points: [[0, 0, 0]], size: 10 });
      expect(pp.material.size).toBeCloseTo(0.2, 6);
      processBatch([{ action: 'update', id: 'p2', size: 20 }], scene);
      expect(pp.material.size).toBeCloseTo(0.4, 6);
    });
  });

  // === extrusion ===
  describe('extrusion', () => {
    const square = [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5], [-0.5, -0.5]];

    it('열린 경로는 옆면과 양 끝면을 만들고 지오메트리는 경로 중심 기준이다', () => {
      const built = buildExtrusionGeometry([[0, 0, 0], [2, 0, 0]], [[square]], { center: [1, 0, 0] });
      const pos = built.geometry.getAttribute('position');
      // 옆면 4변 × 1구간 × 6정점 = 24, 끝면 2개 × 2삼각형 × 3정점 = 12
      expect(pos.count).toBe(36);
      built.geometry.computeBoundingBox();
      expect(built.geometry.boundingBox.min.x).toBeCloseTo(-1, 6);
      expect(built.geometry.boundingBox.max.x).toBeCloseTo(1, 6);
      expect(built.geometry.getAttribute('uv')).toBeDefined();
      expect(built.vertexColored).toBe(false);
    });

    it('닫힌 경로(첫 점 == 끝 점)는 끝면 없이 고리로 잇는다', () => {
      const ring = [[1, 0, 0], [0, 0, -1], [-1, 0, 0], [0, 0, 1], [1, 0, 0]];
      const built = buildExtrusionGeometry(ring, [[square]], {});
      // 4구간 × 4변 × 6정점 = 96, 끝면 없음
      expect(built.geometry.getAttribute('position').count).toBe(96);
    });

    it('구멍이 있는 단면은 안쪽 벽도 만들고 끝면은 구멍을 비운다', () => {
      const inner = [[-0.2, -0.2], [0.2, -0.2], [0.2, 0.2], [-0.2, 0.2], [-0.2, -0.2]];
      const solid = buildExtrusionGeometry([[0, 0, 0], [1, 0, 0]], [[square]], {});
      const hollow = buildExtrusionGeometry([[0, 0, 0], [1, 0, 0]], [[square, inner]], {});
      expect(hollow.geometry.getAttribute('position').count).toBeGreaterThan(solid.geometry.getAttribute('position').count);
      // 끝면 삼각형 수: 꽉 찬 사각형 2개 → 구멍 뚫린 사각형 8개 (각 면)
      const sideSolid = 4 * 6; const sideHollow = 8 * 6;
      expect(solid.geometry.getAttribute('position').count - sideSolid).toBe(2 * 2 * 3);
      expect(hollow.geometry.getAttribute('position').count - sideHollow).toBe(2 * 8 * 3);
    });

    it('단면의 y는 up(0,1,0) 방향, x는 tangent × up 방향에 놓인다', () => {
      const built = buildExtrusionGeometry([[0, 0, 0], [0, 0, -2]], [[square]], {});
      built.geometry.computeBoundingBox();
      const bb = built.geometry.boundingBox;
      expect(bb.max.y - bb.min.y).toBeCloseTo(1, 6);
      expect(bb.max.x - bb.min.x).toBeCloseTo(1, 6);
      expect(bb.max.z - bb.min.z).toBeCloseTo(2, 6);
    });

    it('경로 점마다의 scale·color를 반영한다', () => {
      const built = buildExtrusionGeometry([[0, 0, 0], [1, 0, 0]], [[square]], {
        scale: [1, 2], colors: [[1, 0, 0], [0, 0, 1]],
      });
      expect(built.vertexColored).toBe(true);
      built.geometry.computeBoundingBox();
      expect(built.geometry.boundingBox.max.y).toBeCloseTo(1, 6);   // 끝 고리는 2배
      const colors = built.geometry.getAttribute('color');
      expect(colors.count).toBe(built.geometry.getAttribute('position').count);
    });

    it('scale=0은 1이 아니라 0으로 적용되고, 정점 상한을 넘으면 오류를 던진다', () => {
      const built = buildExtrusionGeometry([[0, 0, 0], [1, 0, 0], [2, 0, 0]], [[square]], { scale: [1, 0, 1] });
      const pos = built.geometry.getAttribute('position');
      // 가운데 고리(x=1)의 모든 정점이 경로 점으로 모인다
      let collapsed = 0;
      for (let i = 0; i < pos.count; i++) {
        if (Math.abs(pos.getX(i) - 1) < 1e-9 && Math.abs(pos.getY(i)) < 1e-9 && Math.abs(pos.getZ(i)) < 1e-9) collapsed++;
      }
      expect(collapsed).toBeGreaterThan(0);
      expect(() => buildExtrusionGeometry([[0, 0, 0], [1, 0, 0]], [[square]], { maxVertices: 10 }))
        .toThrow(/extrusion이 너무 큽니다/);
      // 브릿지는 오류를 삼키고 그리지 않는다
      const warn = vi.spyOn(console, 'error').mockImplementation(() => {});
      const bigPath = Array.from({ length: 2000 }, (_, i) => [i * 0.01, 0, 0]);
      const bigShape = [Array.from({ length: 400 }, (_, i) => [Math.cos(i / 400 * 2 * Math.PI), Math.sin(i / 400 * 2 * Math.PI)])];
      create(scene, { id: 'ebig', type: 'extrusion', path: bigPath, shape: [bigShape] });
      expect(getMesh('ebig')).toBeUndefined();
      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
    });

    it('create 커맨드는 pos를 메시 위치로, axis/up을 방향으로 쓰고 clone 뒤 rotate가 적용된다', () => {
      const e = create(scene, {
        id: 'e1', type: 'extrusion', pos: [1, 0, 0],
        path: [[0, 0, 0], [2, 0, 0]], shape: [[square]], axis: [1, 0, 0], up: [0, 1, 0],
      });
      expect(e.position.x).toBe(1);
      expect(e.material.side).toBe(THREE.DoubleSide);
      processBatch([{ action: 'update', id: 'e1', pos: [1, 3, 0], axis: [0, 1, 0], up: [-1, 0, 0] }], scene);
      const dir = new THREE.Vector3(1, 0, 0).applyQuaternion(e.quaternion);
      expect(dir.y).toBeCloseTo(1, 6);
      expect(e.position.y).toBe(3);
    });

    it('옛 형식의 단일 외곽선 shape도 받는다', () => {
      const e = create(scene, { id: 'e2', type: 'extrusion', path: [[0, 0, 0], [0, 1, 0]], shape: square });
      expect(e.geometry.getAttribute('position').count).toBeGreaterThan(0);
      expect(e.position.y).toBeCloseTo(0.5, 6);
    });
  });

  // === text ===
  describe('text (3D 입체 글자)', () => {
    it('라틴 글자는 두께 있는 TextGeometry 메시가 되고 align=center면 가운데 정렬된다', async () => {
      const t = create(scene, {
        id: 't1', type: 'text', text: 'Hi', pos: [0, 0, 0], height: 1, depth: 0.3, align: 'center',
        axis: [1, 0, 0], up: [0, 1, 0], latin: true,
      });
      expect(t.isGroup).toBe(true);
      await whenTextReady(t);
      const mesh = t.children[0];
      expect(mesh.isMesh).toBe(true);
      mesh.geometry.computeBoundingBox();
      const bb = mesh.geometry.boundingBox;
      expect(bb.max.x).toBeCloseTo(-bb.min.x, 5);              // 가운데 정렬
      expect(bb.max.z).toBeCloseTo(0, 6);                       // 앞면이 z=0
      expect(bb.min.z).toBeCloseTo(-0.3, 6);                    // 두께는 뒤쪽
      expect(bb.max.y - bb.min.y).toBeCloseTo(0.7, 3);          // H 높이 = 700/1000 × height
      expect(t.userData.textFallback).toBe(false);
    });

    it('글꼴에 없는 글자(한글)는 2D 라벨 스프라이트로 대체된다', async () => {
      const t = create(scene, { id: 't2', type: 'text', text: '안녕', pos: [0, 0, 0], height: 1, latin: false });
      await whenTextReady(t);
      expect(t.userData.textFallback).toBe(true);
      expect(t.children[0].isSprite).toBe(true);
    });

    it('text·length 갱신과 billboard·axis 방향을 반영한다', async () => {
      const t = create(scene, { id: 't3', type: 'text', text: 'Hi', pos: [0, 0, 0], height: 1, depth: 0.2, latin: true });
      await whenTextReady(t);
      processBatch([{ action: 'update', id: 't3', text: 'Ha' }], scene);
      await whenTextReady(t);
      expect(t.children.length).toBe(1);
      const width = t.userData.textWidth;
      processBatch([{ action: 'update', id: 't3', length: width * 2 }], scene);
      expect(t.children[0].scale.x).toBeCloseTo(2, 6);
      processBatch([{ action: 'update', id: 't3', billboard: true }], scene);
      expect(typeof t.onBeforeRender).toBe('function');
      processBatch([{ action: 'update', id: 't3', axis: [0, 0, -1], up: [0, 1, 0] }], scene);
      const dir = new THREE.Vector3(1, 0, 0).applyQuaternion(t.quaternion);
      expect(dir.z).toBeCloseTo(-1, 6);
      const [snap] = getSnapshot().filter((o) => o.id === 't3');
      expect(snap.props.text).toBe('Ha');
    });

    it('billboard 글자는 updateBillboards(camera)로 카메라를 향하고 씬을 비우면 목록에서 빠진다', async () => {
      const t = create(scene, { id: 'tb', type: 'text', text: 'Hi', pos: [0, 0, 0], height: 1, billboard: true, latin: true });
      await whenTextReady(t);
      expect(billboardCount()).toBe(1);
      const camera = new THREE.PerspectiveCamera();
      camera.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 3);
      updateBillboards(camera);
      expect(t.quaternion.angleTo(camera.quaternion)).toBeCloseTo(0, 6);
      processBatch([{ action: 'update', id: 'tb', billboard: false }], scene);
      await whenTextReady(t);
      expect(billboardCount()).toBe(0);
      processBatch([{ action: 'update', id: 'tb', billboard: true }], scene);
      await whenTextReady(t);
      clearScene(scene);
      expect(billboardCount()).toBe(0);
    });

    it('글꼴을 기다리는 동안 바뀐 색·투명도가 완성된 글자에 반영된다', async () => {
      let release;
      const gate = new Promise((resolve) => { release = resolve; });
      const real = Promise.all([
        import('three/addons/loaders/FontLoader.js'),
        import('three/addons/geometries/TextGeometry.js'),
      ]).then(([{ Font }, { TextGeometry }]) => ({ font: new Font(FAKE_FONT_DATA), TextGeometry }));
      setTextFontLoader(gate.then(() => real));
      const t = create(scene, { id: 'td', type: 'text', text: 'Hi', pos: [0, 0, 0], height: 1, latin: true, color: [1, 1, 1] });
      expect(t.children.length).toBe(0);
      processBatch([{ action: 'update', id: 'td', color: [1, 0, 0], opacity: 0.5 }], scene);
      release();
      await whenTextReady(t);
      const mesh = t.children[0];
      expect(mesh.isMesh).toBe(true);
      expect(mesh.material.color.r).toBeCloseTo(1, 6);
      expect(mesh.material.color.g).toBeCloseTo(0, 6);
      expect(mesh.material.opacity).toBeCloseTo(0.5, 6);
      expect(mesh.material.transparent).toBe(true);
    });

    it('글꼴 로딩이 실패하면 2D 라벨로 대체하고, 한글은 글꼴을 기다리지 않는다', async () => {
      setTextFontLoader(Promise.reject(new Error('network')));
      const t = create(scene, { id: 'tf', type: 'text', text: 'Hi', pos: [0, 0, 0], height: 1, latin: true });
      await whenTextReady(t);
      expect(t.userData.textFallback).toBe(true);
      expect(t.children[0].isSprite).toBe(true);
      // 한글: 글꼴 로딩 없이 즉시 라벨
      setTextFontLoader(new Promise(() => {}));   // 영원히 끝나지 않는 로더
      const k = create(scene, { id: 'tk', type: 'text', text: '안녕', pos: [0, 0, 0], height: 1, latin: false });
      expect(k.children[0].isSprite).toBe(true);
      expect(k.userData.textFallback).toBe(true);
    });

    it('hasMissingGlyph는 글꼴 밖 글자를 찾는다', () => {
      const font = { data: FAKE_FONT_DATA };
      expect(hasMissingGlyph(font, 'Hi a')).toBe(false);
      expect(hasMissingGlyph(font, 'Hi 안')).toBe(true);
    });
  });

  // === 궤적 ===
  describe('궤적 종류·간격', () => {
    it("trail_type='points'는 Points로 그리고 interval은 n번째 이동만 남긴다", () => {
      create(scene, {
        id: 'b1', type: 'sphere', pos: [0, 0, 0], radius: 0.2,
        make_trail: true, trail_type: 'points', interval: 2, trail_radius: 0.05,
      });
      const trail = scene.children.find((o) => o.isPoints);
      expect(trail).toBeDefined();
      expect(trail.material.size).toBeCloseTo(0.1, 6);
      for (let i = 1; i <= 4; i++) processBatch([{ action: 'trail_update', id: 'b1', pos: [i, 0, 0] }], scene);
      // 처음 점 1 + 2·4번째 이동 2개
      expect(trail.geometry.getAttribute('position').count).toBe(3);
    });

    it('pps는 초당 점 수를 제한한다', () => {
      const now = vi.spyOn(performance, 'now');
      now.mockReturnValue(0);
      create(scene, { id: 'b1', type: 'sphere', pos: [0, 0, 0], radius: 0.2, make_trail: true, pps: 10 });
      const trail = scene.children.find((o) => o.isLine);
      processBatch([{ action: 'trail_update', id: 'b1', pos: [1, 0, 0] }], scene);   // t=0: 기록
      now.mockReturnValue(50);
      processBatch([{ action: 'trail_update', id: 'b1', pos: [2, 0, 0] }], scene);   // 50ms: 건너뜀
      now.mockReturnValue(150);
      processBatch([{ action: 'trail_update', id: 'b1', pos: [3, 0, 0] }], scene);   // 150ms: 기록
      expect(trail.geometry.getAttribute('position').count).toBe(3);
    });

    it('trail_attach는 함수형 attach_trail 인자(type·retain)를 반영한다', () => {
      create(scene, { id: 'b1', type: 'sphere', pos: [0, 0, 0], radius: 0.2 });
      processBatch([{ action: 'trail_attach', id: 'b1', pos: [0, 0, 0], trail_color: [0, 1, 0], retain: 3, trail_type: 'points' }], scene);
      const trail = scene.children.find((o) => o.isPoints);
      expect(trail).toBeDefined();
      for (let i = 1; i <= 5; i++) processBatch([{ action: 'trail_update', id: 'b1', pos: [i, 0, 0] }], scene);
      expect(trail.geometry.getAttribute('position').count).toBe(3);
    });
  });

  // === scene.visible / delete / wtext ===
  describe('scene.visible · scene.delete() · wtext', () => {
    it('scene.visible=False는 씬을 숨기고 새 실행에서 되돌린다', () => {
      processBatch([{ action: 'scene', property: 'visible', value: false }], scene);
      expect(scene.visible).toBe(false);
      clearScene(scene);
      expect(scene.visible).toBe(true);
    });

    it('scene.delete()는 객체·궤적을 모두 지우고 레지스트리에는 보이지 않음으로 남긴다', () => {
      create(scene, { id: 'b1', type: 'sphere', pos: [0, 0, 0], radius: 1, make_trail: true });
      create(scene, { id: 'cv', type: 'curve', points: [[0, 0, 0]] });
      processBatch([{ action: 'scene', property: 'delete', value: true }], scene);
      expect(scene.children.filter((o) => o.userData?.vpId).length).toBe(0);
      expect(getMesh('b1')).toBeUndefined();
      const [snap] = getSnapshot().filter((o) => o.id === 'b1');
      expect(snap.props.visible).toBe(false);
    });

    it('wtext 커맨드는 오버레이의 setWidgetText/removeWidgetText로 전달된다', () => {
      const overlay = { setWidgetText: vi.fn(), removeWidgetText: vi.fn(), clear: vi.fn() };
      scene._overlay = overlay;
      processBatch([
        { action: 'wtext_create', id: 'w1', text: '0.0', anchor: 'caption' },
        { action: 'wtext_update', id: 'w1', text: '1.5' },
        { action: 'wtext_create', id: 'w2', text: 'T', anchor: 'title' },
        { action: 'wtext_delete', id: 'w2' },
      ], scene);
      expect(overlay.setWidgetText).toHaveBeenNthCalledWith(1, 'w1', '0.0', 'caption');
      expect(overlay.setWidgetText).toHaveBeenNthCalledWith(2, 'w1', '1.5', undefined);
      expect(overlay.setWidgetText).toHaveBeenNthCalledWith(3, 'w2', 'T', 'title');
      expect(overlay.removeWidgetText).toHaveBeenCalledWith('w2');
    });
  });
});

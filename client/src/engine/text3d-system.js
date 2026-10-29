/**
 * VPyLab — 3D 입체 글자(text) 시스템
 * Three.js TextGeometry와 번들 글꼴(helvetiker, 라틴 문자)로 두께 있는 글자를 만든다.
 * 글꼴 모듈과 글꼴 JSON은 처음 text()를 만들 때 동적으로 불러온다(코드 분할).
 * 글꼴에 없는 글자(한글 등)가 있으면 카메라를 향하는 2D 라벨 스프라이트로 대체한다.
 */

import * as THREE from 'three';

let fontPromise = null;

/** 글꼴·TextGeometry 모듈을 한 번만 불러온다. */
export function loadTextFont() {
  if (!fontPromise) {
    fontPromise = Promise.all([
      import('three/addons/loaders/FontLoader.js'),
      import('three/addons/geometries/TextGeometry.js'),
      import('three/examples/fonts/helvetiker_regular.typeface.json'),
    ]).then(([{ Font }, { TextGeometry }, fontModule]) => {
      const data = fontModule.default ?? fontModule;
      return { font: new Font(data), TextGeometry };
    });
  }
  return fontPromise;
}

/** 테스트에서 글꼴 로더를 바꿔 끼울 때 사용 */
export function setTextFontLoader(promise) {
  fontPromise = promise;
}

/** 글꼴에 없는 글자가 있는가 (줄바꿈·공백 제외) */
export function hasMissingGlyph(font, text) {
  const glyphs = font?.data?.glyphs || {};
  for (const ch of String(text)) {
    if (ch === '\n' || ch === '\r' || ch === ' ') continue;
    if (!glyphs[ch]) return true;
  }
  return false;
}

/** 커맨드에서 글자 사양만 뽑는다 */
export function pickTextSpec(cmd, previous = {}) {
  const height = cmd.height !== undefined ? Number(cmd.height) || 1 : (previous.height ?? 1);
  return {
    text: cmd.text !== undefined ? String(cmd.text) : (previous.text ?? ''),
    height,
    depth: cmd.depth !== undefined ? Number(cmd.depth) || 0 : (previous.depth ?? 0.2 * height),
    align: cmd.align !== undefined ? String(cmd.align) : (previous.align ?? 'left'),
    billboard: cmd.billboard !== undefined ? Boolean(cmd.billboard) : (previous.billboard ?? false),
    latin: cmd.latin !== undefined ? Boolean(cmd.latin) : (previous.latin ?? true),
    length: cmd.length !== undefined ? (cmd.length === null ? null : Number(cmd.length)) : (previous.length ?? null),
    color: cmd.color || previous.color || [1, 1, 1],
    opacity: cmd.opacity !== undefined ? Number(cmd.opacity) : (previous.opacity ?? 1),
    startFaceColor: cmd.start_face_color ?? previous.startFaceColor ?? null,
    endFaceColor: cmd.end_face_color ?? previous.endFaceColor ?? null,
  };
}

function disposeChildren(holder) {
  for (const child of [...holder.children]) {
    holder.remove(child);
    child.geometry?.dispose?.();
    const mats = Array.isArray(child.material) ? child.material : [child.material];
    for (const mat of mats) {
      if (!mat || mat === holder.userData.textMaterial) continue;
      mat.map?.dispose?.();
      mat.dispose?.();
    }
  }
}

function billboardBeforeRender(_renderer, _scene, camera) {
  this.quaternion.copy(camera.quaternion);
}

/**
 * 글자 메시를 (다시) 만든다. 비동기로 글꼴을 받은 뒤 holder에 자식 메시를 넣는다.
 * @param {THREE.Group} holder  userData.textSpec·textMaterial·createLabel 을 가진 그룹
 * @returns {Promise<void>}
 */
export function rebuildText3D(holder) {
  const spec = holder.userData.textSpec;
  const material = holder.userData.textMaterial;
  holder.onBeforeRender = spec.billboard ? billboardBeforeRender : null;
  const generation = (holder.userData.textGeneration = (holder.userData.textGeneration || 0) + 1);

  const promise = loadTextFont().then(({ font, TextGeometry }) => {
    if (holder.userData.textGeneration !== generation) return; // 더 새 요청이 있다
    disposeChildren(holder);
    holder.userData.textFallback = false;

    if (!spec.latin || hasMissingGlyph(font, spec.text)) {
      // 글꼴에 없는 글자 — 2D 라벨 스프라이트로 대체 (높이는 월드 단위를 픽셀로 어림)
      const createLabel = holder.userData.createLabel;
      if (typeof createLabel === 'function') {
        const sprite = createLabel({
          text: spec.text,
          height: Math.max(12, Math.round(spec.height * 32)),
          color: spec.color,
          opacity: spec.opacity,
        });
        holder.add(sprite);
      }
      holder.userData.textFallback = true;
      holder.userData.textWidth = 0;
      return;
    }

    const geometry = new TextGeometry(spec.text, {
      font,
      size: spec.height,
      depth: Math.max(0, spec.depth),
      curveSegments: 6,
      bevelEnabled: false,
    });
    geometry.computeBoundingBox();
    const bb = geometry.boundingBox;
    const width = bb.max.x - bb.min.x;
    let dx = -bb.min.x;
    if (spec.align === 'center') dx -= width / 2;
    else if (spec.align === 'right') dx -= width;
    // 앞면을 기준 평면(z=0)에 두고 두께는 뒤쪽으로
    geometry.translate(dx, 0, -Math.max(0, spec.depth));
    geometry.computeBoundingSphere();

    let meshMaterial = material;
    if (Array.isArray(spec.startFaceColor) || Array.isArray(spec.endFaceColor)) {
      // ExtrudeGeometry 그룹 0 = 앞·뒷면, 그룹 1 = 옆면
      const faceColor = spec.startFaceColor || spec.endFaceColor;
      const faceMaterial = material.clone();
      faceMaterial.color = new THREE.Color(faceColor[0], faceColor[1], faceColor[2]);
      if ('emissive' in faceMaterial && faceMaterial.emissiveIntensity > 0) faceMaterial.emissive = faceMaterial.color.clone();
      meshMaterial = [faceMaterial, material];
    }
    const mesh = new THREE.Mesh(geometry, meshMaterial);
    mesh.userData = { isText3DMesh: true };
    if (spec.length && width > 0) mesh.scale.x = spec.length / width;
    holder.add(mesh);
    holder.userData.textWidth = width;
  }).catch((err) => {
    console.warn('[text] 입체 글자 생성 실패:', err);
  });
  holder.userData.textReady = promise;
  return promise;
}

/** 길이만 바뀔 때 — 글자 메시의 가로 배율만 조정 */
export function applyTextLength(holder) {
  const spec = holder.userData.textSpec;
  const width = holder.userData.textWidth;
  for (const child of holder.children) {
    if (!child.userData?.isText3DMesh) continue;
    child.scale.x = spec.length && width > 0 ? spec.length / width : 1;
  }
}

/** 테스트·검증용: 글자 메시가 준비될 때까지 기다린다 */
export function whenTextReady(holder) {
  return holder?.userData?.textReady || Promise.resolve();
}

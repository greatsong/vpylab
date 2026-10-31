/**
 * VPyLab — 3D 입체 글자(text) 시스템
 * Three.js TextGeometry와 번들 글꼴(helvetiker, 라틴 문자)로 두께 있는 글자를 만든다.
 * 글꼴 모듈과 글꼴 JSON은 처음 text()를 만들 때 동적으로 불러온다(코드 분할).
 * 글꼴에 없는 글자(한글 등)가 있으면 글꼴을 기다리지 않고 바로 카메라를 향하는 2D 라벨 스프라이트로 대체한다.
 * 글꼴 로딩이 실패해도 2D 라벨로 대체하고, 다음 text()에서 다시 시도한다.
 */

import * as THREE from 'three';

let fontPromise = null;

// billboard=True 인 글자 — Three.js는 Group의 onBeforeRender를 부르지 않으므로
// 뷰포트가 렌더 직전에 updateBillboards(camera)로 방향을 맞춘다
const billboardHolders = new Set();

/** 글꼴·TextGeometry 모듈을 한 번만 불러온다. 실패하면 캐시를 비워 다음에 다시 시도한다. */
export function loadTextFont() {
  if (!fontPromise) {
    fontPromise = Promise.all([
      import('three/addons/loaders/FontLoader.js'),
      import('three/addons/geometries/TextGeometry.js'),
      import('three/examples/fonts/helvetiker_regular.typeface.json'),
    ]).then(([{ Font }, { TextGeometry }, fontModule]) => {
      const data = fontModule.default ?? fontModule;
      return { font: new Font(data), TextGeometry };
    }).catch((err) => {
      fontPromise = null;
      throw err;
    });
  }
  return fontPromise;
}

/** 테스트에서 글꼴 로더를 바꿔 끼울 때 사용 (null이면 기본 로더로 되돌린다) */
export function setTextFontLoader(promise) {
  fontPromise = promise;
  if (promise && typeof promise.catch === 'function') {
    promise.catch(() => { if (fontPromise === promise) fontPromise = null; });
  }
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

/** 커맨드에서 글자 사양만 뽑는다 (previous: 갱신 전 사양) */
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

/** 글꼴을 쓸 수 없을 때 — 2D 라벨 스프라이트로 대체 (높이는 월드 단위를 픽셀로 어림) */
function buildFallbackLabel(holder) {
  const spec = holder.userData.textSpec;
  const createLabel = holder.userData.createLabel;
  disposeChildren(holder);
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
}

function setBillboard(holder, enabled) {
  if (enabled) billboardHolders.add(holder);
  else billboardHolders.delete(holder);
}

/** billboard 글자가 카메라를 향하도록 — 뷰포트가 renderer.render 직전에 부른다 */
export function updateBillboards(camera) {
  if (!camera || billboardHolders.size === 0) return;
  for (const holder of billboardHolders) holder.quaternion.copy(camera.quaternion);
}

/** 씬에서 지울 때 billboard 목록에서도 뺀다 */
export function unregisterText3D(holder) {
  billboardHolders.delete(holder);
}

/** 테스트용: billboard 목록 크기 */
export function billboardCount() {
  return billboardHolders.size;
}

/**
 * 글자 메시를 (다시) 만든다. 라틴 글자는 글꼴을 받은 뒤 자식 메시를 채우고, 그 밖은 바로 라벨로 대체한다.
 * 재질(textMaterial)은 하나를 계속 쓰므로 글꼴을 기다리는 동안 바뀐 색·투명도도 완성된 글자에 반영된다.
 * @param {THREE.Group} holder  userData.textSpec·textMaterial·createLabel 을 가진 그룹
 * @returns {Promise<void>}
 */
export function rebuildText3D(holder) {
  const spec = holder.userData.textSpec;
  const material = holder.userData.textMaterial;
  setBillboard(holder, spec.billboard);
  const generation = (holder.userData.textGeneration = (holder.userData.textGeneration || 0) + 1);

  if (!spec.latin) {
    // 글꼴에 없는 글자(한글 등) — 글꼴을 기다리지 않는다
    buildFallbackLabel(holder);
    holder.userData.textReady = Promise.resolve();
    return holder.userData.textReady;
  }

  const promise = loadTextFont().then(({ font, TextGeometry }) => {
    if (holder.userData.textGeneration !== generation) return; // 더 새 요청이 있다
    const current = holder.userData.textSpec;   // 기다리는 동안 바뀐 최신 사양
    if (!current.latin || hasMissingGlyph(font, current.text)) {
      buildFallbackLabel(holder);
      return;
    }
    disposeChildren(holder);
    holder.userData.textFallback = false;

    const geometry = new TextGeometry(current.text, {
      font,
      size: current.height,
      depth: Math.max(0, current.depth),
      curveSegments: 6,
      bevelEnabled: false,
    });
    geometry.computeBoundingBox();
    const bb = geometry.boundingBox;
    const width = bb.max.x - bb.min.x;
    let dx = -bb.min.x;
    if (current.align === 'center') dx -= width / 2;
    else if (current.align === 'right') dx -= width;
    // 앞면을 기준 평면(z=0)에 두고 두께는 뒤쪽으로
    geometry.translate(dx, 0, -Math.max(0, current.depth));
    geometry.computeBoundingSphere();

    let meshMaterial = material;
    if (Array.isArray(current.startFaceColor) || Array.isArray(current.endFaceColor)) {
      // ExtrudeGeometry 그룹 0 = 앞·뒷면, 그룹 1 = 옆면
      const faceColor = current.startFaceColor || current.endFaceColor;
      const faceMaterial = material.clone();
      faceMaterial.color = new THREE.Color(faceColor[0], faceColor[1], faceColor[2]);
      if ('emissive' in faceMaterial && faceMaterial.emissiveIntensity > 0) faceMaterial.emissive = faceMaterial.color.clone();
      meshMaterial = [faceMaterial, material];
    }
    const mesh = new THREE.Mesh(geometry, meshMaterial);
    mesh.userData = { isText3DMesh: true };
    if (current.length && width > 0) mesh.scale.x = current.length / width;
    holder.add(mesh);
    holder.userData.textWidth = width;
  }).catch((err) => {
    // 글꼴 로딩 실패 — 글자가 사라지지 않도록 2D 라벨로 대체한다 (다음 text()는 다시 시도)
    console.warn('[text] 입체 글자 글꼴을 불러오지 못해 2D 라벨로 표시합니다:', err?.message || err);
    if (holder.userData.textGeneration === generation) buildFallbackLabel(holder);
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

/** 글꼴을 기다리는 동안 바뀐 색·투명도 — 사양과 라벨 대체본에 반영 (3D 메시는 공유 재질이 이미 바뀌어 있다) */
export function applyTextAppearance(holder, cmd) {
  const spec = holder.userData.textSpec;
  if (!spec) return;
  if (cmd.color) spec.color = cmd.color;
  if (cmd.opacity !== undefined) spec.opacity = Number(cmd.opacity);
  if (holder.userData.textFallback && (cmd.color || cmd.opacity !== undefined)) buildFallbackLabel(holder);
}

/** 테스트·검증용: 글자 메시가 준비될 때까지 기다린다 */
export function whenTextReady(holder) {
  return holder?.userData?.textReady || Promise.resolve();
}

import * as THREE from 'three';

// 공유 정점을 참조하는 각 면에 최종 좌표·법선·UV·색을 다시 싣습니다.
export function buildMeshGeometry(type, vertices) {
  const indices = type === 'quad' ? [0, 1, 2, 0, 2, 3] : [0, 1, 2];
  const attributes = { position: [], normal: [], color: [], uv: [], vpOpacity: [], vpShininess: [], vpEmissive: [] };
  for (const i of indices) {
    const v = vertices[i];
    attributes.position.push(...v.pos);
    attributes.normal.push(...(v.normal || [0, 0, 1]));
    attributes.color.push(...(v.color || [1, 1, 1]));
    attributes.uv.push(...(v.texpos || [0, 0]).slice(0, 2));
    attributes.vpOpacity.push(v.opacity ?? 1);
    attributes.vpShininess.push(v.shininess ?? 0.6);
    attributes.vpEmissive.push(v.emissive ? 1 : 0);
  }
  const geometry = new THREE.BufferGeometry();
  for (const [name, values] of Object.entries(attributes)) {
    geometry.setAttribute(name, new THREE.Float32BufferAttribute(values, name === 'uv' ? 2 : name.startsWith('vp') ? 1 : 3));
  }
  geometry.computeBoundingSphere();
  return geometry;
}

export function configureMeshMaterial(material, vertices) {
  if (!material.userData?.vpInCompound) material.color.setRGB(1, 1, 1);
  material.vertexColors = true;
  material.side = THREE.DoubleSide;
  const transparent = material.opacity < 1 || vertices.some(v => (v.opacity ?? 1) < 1);
  if (material.transparent !== transparent) material.needsUpdate = true;
  material.transparent = transparent;
  material.depthWrite = !transparent;
  material.userData ||= {};
  const overrides = material.userData.vpVertexOverrides ||= { shininess: { value: -1 }, emissive: { value: -1 } };
  // VPython의 정점별 투명도·광택·발광을 보간합니다. THREE의 조명/텍스처 계산은 유지합니다.
  material.onBeforeCompile = shader => {
    shader.uniforms ||= {};
    shader.uniforms.vpShininessOverride = overrides.shininess;
    shader.uniforms.vpEmissiveOverride = overrides.emissive;
    const varyings = 'varying float vVpOpacity;\nvarying float vVpShininess;\nvarying float vVpEmissive;\n';
    shader.vertexShader = 'attribute float vpOpacity;\nattribute float vpShininess;\nattribute float vpEmissive;\n' + varyings + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvVpOpacity = vpOpacity; vVpShininess = vpShininess; vVpEmissive = vpEmissive;');
    shader.fragmentShader = 'uniform float vpShininessOverride;\nuniform float vpEmissiveOverride;\n' + varyings + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.a *= vVpOpacity;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = max(0.05, 1.0 - clamp(vpShininessOverride >= 0.0 ? vpShininessOverride : vVpShininess, 0.0, 1.0));');
    shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', 'outgoingLight = mix(outgoingLight, diffuseColor.rgb, clamp(vpEmissiveOverride >= 0.0 ? vpEmissiveOverride : vVpEmissive, 0.0, 1.0));\n#include <opaque_fragment>');
  };
  material.customProgramCacheKey = () => 'vpylab-mesh-vertices-v2';
  material.needsUpdate = true;
}

export function buildHelixGeometry({ size, coils = 5, thickness = 0.05, ccw = true }) {
  const turns = Math.max(-256, Math.min(256, Number(coils)));
  const path = new THREE.Curve();
  path.getPoint = (t, target = new THREE.Vector3()) => {
    const angle = t * turns * Math.PI * 2 * (ccw ? 1 : -1);
    return target.set(t * size[0], size[1] / 2 * Math.cos(angle), size[2] / 2 * Math.sin(angle));
  };
  return new THREE.TubeGeometry(path, Math.max(64, Math.ceil(Math.abs(turns) * 32)), Math.max(0.00001, thickness / 2), 8, false);
}

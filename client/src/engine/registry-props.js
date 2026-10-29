/**
 * VPyLab — 채점 레지스트리용 객체 속성 추출 (순수 함수)
 *
 * Worker가 보낸 JSON 커맨드에서 채점 엔진이 볼 속성만 뽑아낸다.
 * Three.js에 의존하지 않으므로 브릿지(vpython-bridge.js)와
 * 테스트용 커맨드 재생기(command-replay.js)가 같은 규칙을 공유한다.
 */

export const DEFAULT_OBJECT_PROPS = {
  sphere: { radius: 1 },
  box: { size: [1, 1, 1], axis: [1, 0, 0], up: [0, 1, 0] },
  cylinder: { radius: 1, axis: [1, 0, 0] },
  arrow: { axis: [1, 0, 0], shaftwidth: 0.1 },
  cone: { radius: 1, axis: [1, 0, 0] },
  ring: { radius: 1, thickness: 0.1 },
  pyramid: { size: [1, 1, 1], axis: [1, 0, 0] },
  ellipsoid: { size: [1, 1, 1] },
  helix: { radius: 1, axis: [1, 0, 0], length: 1, coils: 5, thickness: 0.05 },
  local_light: { intensity: 1 },
  distant_light: { direction: [0, -1, 0], intensity: 1 },
};

export function cloneDefaultProps(type) {
  const defaults = DEFAULT_OBJECT_PROPS[type] || {};
  return Object.fromEntries(
    Object.entries(defaults).map(([key, value]) => [
      key,
      Array.isArray(value) ? [...value] : value,
    ]),
  );
}

export function asNumber(value, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

export function asVectorArray(value, fallback = [0, 0, 0]) {
  if (!Array.isArray(value)) return [...fallback];
  return [
    asNumber(value[0], fallback[0] ?? 0),
    asNumber(value[1], fallback[1] ?? 0),
    asNumber(value[2], fallback[2] ?? 0),
  ];
}

/**
 * box 크기 결정 — VPython 규약: size = vector(length, height, width)
 * length/height/width 개별 인자가 있으면 해당 성분만 덮어쓴다.
 */
export function resolveBoxSize(cmd, fallback = DEFAULT_OBJECT_PROPS.box.size) {
  const base = Array.isArray(cmd.size) ? cmd.size : fallback;
  const size = [
    asNumber(base?.[0], DEFAULT_OBJECT_PROPS.box.size[0]),
    asNumber(base?.[1], DEFAULT_OBJECT_PROPS.box.size[1]),
    asNumber(base?.[2], DEFAULT_OBJECT_PROPS.box.size[2]),
  ];
  if (cmd.length !== undefined) size[0] = asNumber(cmd.length, size[0]);
  if (cmd.height !== undefined) size[1] = asNumber(cmd.height, size[1]);
  if (cmd.width !== undefined) size[2] = asNumber(cmd.width, size[2]);
  return size;
}

/** 채점 레지스트리에 함께 저장하는 생성 시 속성 키 */
const CREATE_PROP_KEYS = [
  'radius', 'size', 'axis', 'up', 'length', 'height', 'width', 'thickness',
  'shaftwidth', 'intensity', 'direction', 'emissive', 'texture', 'text', 'points',
];

/**
 * 생성 커맨드 → 채점 레지스트리에 저장할 객체 속성
 */
export function getRegistryProps(cmd) {
  const props = {
    pos: cmd.pos || [0, 0, 0],
    color: cmd.color || [1, 1, 1],
    visible: cmd.visible !== false,
    opacity: cmd.opacity ?? 1,
    ...cloneDefaultProps(cmd.type),
  };

  if (cmd.type === 'box') {
    props.size = resolveBoxSize(cmd, props.size);
  }

  for (const key of CREATE_PROP_KEYS) {
    if (cmd.type === 'box' && key === 'size') continue;
    if (cmd[key] !== undefined) props[key] = cmd[key];
  }

  return props;
}

/**
 * 갱신 커맨드 → 채점 레지스트리에 반영할 속성 변경분
 * 브릿지(updateMesh)가 레지스트리에 기록하는 규칙과 같다.
 *
 * @param {object} cmd - { action: 'update', id, pos?, color?, ... }
 * @param {{ type: string, props: object }} obj - 레지스트리의 현재 객체
 */
export function getRegistryUpdates(cmd, obj) {
  const updates = {};
  const type = obj?.type;
  const isLight = type === 'local_light' || type === 'distant_light';
  const isBox = type === 'box';

  if (cmd.pos) updates.pos = cmd.pos;
  if (cmd.color) updates.color = cmd.color;
  if (cmd.intensity !== undefined && isLight) updates.intensity = cmd.intensity;
  if (cmd.direction !== undefined && type === 'distant_light') updates.direction = cmd.direction;
  if (cmd.visible !== undefined) updates.visible = cmd.visible;
  if (cmd.opacity !== undefined) updates.opacity = cmd.opacity;
  if (cmd.texture !== undefined) updates.texture = cmd.texture || null;
  if (cmd.emissive !== undefined && !isLight) updates.emissive = cmd.emissive;
  if (cmd.radius !== undefined) updates.radius = cmd.radius;

  if (cmd.size !== undefined || (isBox && (cmd.length !== undefined || cmd.height !== undefined || cmd.width !== undefined))) {
    updates.size = isBox
      ? resolveBoxSize(cmd, obj?.props?.size || DEFAULT_OBJECT_PROPS.box.size)
      : cmd.size;
  }

  if (type === 'label' && cmd.text !== undefined) updates.text = cmd.text;
  if (cmd.thickness !== undefined) updates.thickness = cmd.thickness;
  if (cmd.axis !== undefined) updates.axis = cmd.axis;
  if (cmd.up !== undefined && isBox) updates.up = cmd.up;
  if (cmd.shaftwidth !== undefined) updates.shaftwidth = cmd.shaftwidth;

  return updates;
}

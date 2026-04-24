// VPyLab API 문서 데이터
// VPython 3D 프로그래밍 교육 플랫폼용 레퍼런스

// ─── 카테고리 정의 ───────────────────────────────────────────
export const docCategories = {
  objects:  { ko: '3D 객체',       en: '3D Objects',       icon: '📦' },
  vectors:  { ko: '벡터와 수학',   en: 'Vectors & Math',   icon: '📐' },
  scene:    { ko: '씬 제어',       en: 'Scene Controls',   icon: '⚙️' },
  colors:   { ko: '색상표',        en: 'Color Reference',  icon: '🎨' },
  sound:    { ko: '사운드 / 음악', en: 'Sound & Music',    icon: '🎵' },
  charts:   { ko: '3D 차트',       en: '3D Charts',        icon: '📊' },
};

// ─── 문서 항목 ──────────────────────────────────────────────
const docs = [
  // ━━━ objects ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  {
    id: 'sphere',
    category: 'objects',
    title: { ko: '구 (sphere)', en: 'sphere' },
    description: {
      ko: '3D 구를 생성합니다. 위치, 반지름, 색상 등을 지정할 수 있습니다.',
      en: 'Creates a 3D sphere. You can set position, radius, color, and more.',
    },
    signature: "sphere(pos=vector(0,0,0), radius=1.0, color=color.white)",
    params: [
      { name: 'pos',         type: 'vector',  default: 'vector(0,0,0)', desc: { ko: '위치', en: 'Position' } },
      { name: 'radius',      type: 'number',  default: '1.0',          desc: { ko: '반지름', en: 'Radius' } },
      { name: 'color',       type: 'vector',  default: 'color.white',  desc: { ko: '색상', en: 'Color' } },
      { name: 'opacity',     type: 'number',  default: '1.0',          desc: { ko: '불투명도 (0~1)', en: 'Opacity (0–1)' } },
      { name: 'emissive',    type: 'boolean', default: 'False',        desc: { ko: '색상으로 스스로 빛나게 표시', en: 'Glow using the object color' } },
      { name: 'make_trail',  type: 'boolean', default: 'False',        desc: { ko: '궤적 표시 여부', en: 'Show trail' } },
      { name: 'trail_color',  type: 'vector',  default: 'color.white',  desc: { ko: '궤적 색상', en: 'Trail color' } },
      { name: 'velocity',    type: 'vector',  default: 'vector(0,0,0)', desc: { ko: '속도 벡터 (시뮬레이션용)', en: 'Velocity vector (for simulation)' } },
      { name: 'visible',     type: 'boolean', default: 'True',         desc: { ko: '화면 표시 여부', en: 'Visibility' } },
    ],
    code: `from vpython import *
ball = sphere(pos=vector(1, 0, 0), radius=0.8, color=color.red)
ball.velocity = vector(-1, 0, 0)`,
    tags: ['3d', 'object', 'geometry', 'sphere', 'ball'],
  },
  {
    id: 'box',
    category: 'objects',
    title: { ko: '상자 (box)', en: 'box' },
    description: {
      ko: '3D 직육면체를 생성합니다. size 벡터로 가로, 세로, 깊이를 지정합니다.',
      en: 'Creates a 3D box. Use the size vector to set width, height, and depth.',
    },
    signature: "box(pos=vector(0,0,0), size=vector(1,1,1), color=color.white)",
    params: [
      { name: 'pos',        type: 'vector',  default: 'vector(0,0,0)', desc: { ko: '위치', en: 'Position' } },
      { name: 'size',       type: 'vector',  default: 'vector(1,1,1)', desc: { ko: '크기 (가로, 세로, 깊이)', en: 'Size (width, height, depth)' } },
      { name: 'color',      type: 'vector',  default: 'color.white',   desc: { ko: '색상', en: 'Color' } },
      { name: 'opacity',    type: 'number',  default: '1.0',           desc: { ko: '불투명도 (0~1)', en: 'Opacity (0–1)' } },
      { name: 'emissive',   type: 'boolean', default: 'False',         desc: { ko: '색상으로 스스로 빛나게 표시', en: 'Glow using the object color' } },
      { name: 'make_trail', type: 'boolean', default: 'False',         desc: { ko: '궤적 표시 여부', en: 'Show trail' } },
      { name: 'visible',    type: 'boolean', default: 'True',          desc: { ko: '화면 표시 여부', en: 'Visibility' } },
    ],
    code: `from vpython import *
ground = box(pos=vector(0, -0.5, 0), size=vector(4, 0.1, 4), color=color.green)
cube = box(pos=vector(0, 0.5, 0), size=vector(1, 1, 1), color=color.blue)`,
    tags: ['3d', 'object', 'geometry', 'box', 'cube', 'rectangle'],
  },
  {
    id: 'cylinder',
    category: 'objects',
    title: { ko: '원기둥 (cylinder)', en: 'cylinder' },
    description: {
      ko: '3D 원기둥을 생성합니다. axis 벡터로 방향과 길이를 지정합니다.',
      en: 'Creates a 3D cylinder. The axis vector sets direction and length.',
    },
    signature: "cylinder(pos=vector(0,0,0), axis=vector(1,0,0), radius=1.0, color=color.white)",
    params: [
      { name: 'pos',     type: 'vector',  default: 'vector(0,0,0)', desc: { ko: '밑면 중심 위치', en: 'Base center position' } },
      { name: 'axis',    type: 'vector',  default: 'vector(1,0,0)', desc: { ko: '축 방향과 길이', en: 'Axis direction and length' } },
      { name: 'radius',  type: 'number',  default: '1.0',          desc: { ko: '반지름', en: 'Radius' } },
      { name: 'color',   type: 'vector',  default: 'color.white',  desc: { ko: '색상', en: 'Color' } },
      { name: 'opacity', type: 'number',  default: '1.0',          desc: { ko: '불투명도 (0~1)', en: 'Opacity (0–1)' } },
      { name: 'emissive', type: 'boolean', default: 'False',       desc: { ko: '색상으로 스스로 빛나게 표시', en: 'Glow using the object color' } },
      { name: 'visible', type: 'boolean', default: 'True',         desc: { ko: '화면 표시 여부', en: 'Visibility' } },
    ],
    code: `from vpython import *
pole = cylinder(pos=vector(0, 0, 0), axis=vector(0, 3, 0), radius=0.1, color=color.brown)
disk = cylinder(pos=vector(0, 3, 0), axis=vector(0, 0.05, 0), radius=0.8, color=color.gold)`,
    tags: ['3d', 'object', 'geometry', 'cylinder', 'tube', 'pipe'],
  },
  {
    id: 'arrow',
    category: 'objects',
    title: { ko: '화살표 (arrow)', en: 'arrow' },
    description: {
      ko: '3D 화살표를 생성합니다. 힘, 속도 등 벡터 시각화에 유용합니다.',
      en: 'Creates a 3D arrow. Useful for visualizing vectors like force and velocity.',
    },
    signature: "arrow(pos=vector(0,0,0), axis=vector(1,0,0), shaftwidth=0.1, color=color.white)",
    params: [
      { name: 'pos',        type: 'vector',  default: 'vector(0,0,0)', desc: { ko: '시작 위치', en: 'Start position' } },
      { name: 'axis',       type: 'vector',  default: 'vector(1,0,0)', desc: { ko: '방향과 길이', en: 'Direction and length' } },
      { name: 'shaftwidth', type: 'number',  default: '0.1',          desc: { ko: '몸통 두께', en: 'Shaft width' } },
      { name: 'color',      type: 'vector',  default: 'color.white',  desc: { ko: '색상', en: 'Color' } },
      { name: 'opacity',    type: 'number',  default: '1.0',          desc: { ko: '불투명도 (0~1)', en: 'Opacity (0–1)' } },
      { name: 'emissive',   type: 'boolean', default: 'False',        desc: { ko: '색상으로 스스로 빛나게 표시', en: 'Glow using the object color' } },
      { name: 'visible',    type: 'boolean', default: 'True',         desc: { ko: '화면 표시 여부', en: 'Visibility' } },
    ],
    code: `from vpython import *
ball = sphere(pos=vector(0, 0, 0), radius=0.3, color=color.cyan)
vel = arrow(pos=ball.pos, axis=vector(2, 1, 0), shaftwidth=0.08, color=color.yellow)`,
    tags: ['3d', 'object', 'geometry', 'arrow', 'vector', 'force', 'velocity'],
  },
  {
    id: 'cone',
    category: 'objects',
    title: { ko: '원뿔 (cone)', en: 'cone' },
    description: {
      ko: '3D 원뿔을 생성합니다. axis 벡터가 꼭짓점 방향을 결정합니다.',
      en: 'Creates a 3D cone. The axis vector determines the direction of the apex.',
    },
    signature: "cone(pos=vector(0,0,0), axis=vector(1,0,0), radius=1.0, color=color.white)",
    params: [
      { name: 'pos',     type: 'vector',  default: 'vector(0,0,0)', desc: { ko: '밑면 중심 위치', en: 'Base center position' } },
      { name: 'axis',    type: 'vector',  default: 'vector(1,0,0)', desc: { ko: '꼭짓점 방향과 높이', en: 'Apex direction and height' } },
      { name: 'radius',  type: 'number',  default: '1.0',          desc: { ko: '밑면 반지름', en: 'Base radius' } },
      { name: 'color',   type: 'vector',  default: 'color.white',  desc: { ko: '색상', en: 'Color' } },
      { name: 'opacity', type: 'number',  default: '1.0',          desc: { ko: '불투명도 (0~1)', en: 'Opacity (0–1)' } },
      { name: 'emissive', type: 'boolean', default: 'False',       desc: { ko: '색상으로 스스로 빛나게 표시', en: 'Glow using the object color' } },
      { name: 'visible', type: 'boolean', default: 'True',         desc: { ko: '화면 표시 여부', en: 'Visibility' } },
    ],
    code: `from vpython import *
tree_trunk = cylinder(pos=vector(0, 0, 0), axis=vector(0, 1, 0), radius=0.15, color=color.brown)
tree_top = cone(pos=vector(0, 1, 0), axis=vector(0, 1.5, 0), radius=0.7, color=color.green)`,
    tags: ['3d', 'object', 'geometry', 'cone', 'pyramid'],
  },
  {
    id: 'ring',
    category: 'objects',
    title: { ko: '링 (ring)', en: 'ring' },
    description: {
      ko: '3D 링(도넛 형태)을 생성합니다. 궤도나 장식 표현에 유용합니다.',
      en: 'Creates a 3D ring (torus shape). Useful for orbits and decorations.',
    },
    signature: "ring(pos=vector(0,0,0), radius=1.0, thickness=0.1, color=color.white)",
    params: [
      { name: 'pos',       type: 'vector',  default: 'vector(0,0,0)', desc: { ko: '중심 위치', en: 'Center position' } },
      { name: 'radius',    type: 'number',  default: '1.0',          desc: { ko: '링의 반지름', en: 'Ring radius' } },
      { name: 'thickness', type: 'number',  default: '0.1',          desc: { ko: '링의 두께', en: 'Ring thickness' } },
      { name: 'color',     type: 'vector',  default: 'color.white',  desc: { ko: '색상', en: 'Color' } },
      { name: 'opacity',   type: 'number',  default: '1.0',          desc: { ko: '불투명도 (0~1)', en: 'Opacity (0–1)' } },
      { name: 'emissive',  type: 'boolean', default: 'False',        desc: { ko: '색상으로 스스로 빛나게 표시', en: 'Glow using the object color' } },
      { name: 'visible',   type: 'boolean', default: 'True',         desc: { ko: '화면 표시 여부', en: 'Visibility' } },
    ],
    code: `from vpython import *
planet = sphere(pos=vector(0, 0, 0), radius=0.5, color=color.blue)
orbit = ring(pos=vector(0, 0, 0), radius=2, thickness=0.03, color=color.gray)`,
    tags: ['3d', 'object', 'geometry', 'ring', 'torus', 'orbit'],
  },
  {
    id: 'compound',
    category: 'objects',
    title: { ko: '복합 객체 (compound)', en: 'compound' },
    description: {
      ko: '여러 객체를 하나로 합쳐 함께 움직이게 합니다. 로봇, 자동차 등 복잡한 모양을 만들 수 있습니다.',
      en: 'Combines multiple objects into one so they move together. Build robots, cars, and complex shapes.',
    },
    signature: "compound(objects, pos=vector(0,0,0), color=color.white)",
    params: [
      { name: 'objects',    type: 'list',    default: '[]',            desc: { ko: '합칠 객체 리스트', en: 'List of objects to combine' } },
      { name: 'pos',        type: 'vector',  default: 'vector(0,0,0)', desc: { ko: '위치', en: 'Position' } },
      { name: 'color',      type: 'vector',  default: 'color.white',   desc: { ko: '색상 (전체 덮어쓰기)', en: 'Color (overrides all)' } },
      { name: 'opacity',    type: 'number',  default: '1.0',           desc: { ko: '불투명도 (0~1)', en: 'Opacity (0–1)' } },
      { name: 'emissive',   type: 'boolean', default: 'False',         desc: { ko: '색상으로 스스로 빛나게 표시', en: 'Glow using the object color' } },
      { name: 'make_trail', type: 'boolean', default: 'False',         desc: { ko: '궤적 표시 여부', en: 'Show trail' } },
      { name: 'visible',    type: 'boolean', default: 'True',          desc: { ko: '화면 표시 여부', en: 'Visibility' } },
    ],
    code: `from vpython import *
body = box(pos=vector(0, 0, 0), size=vector(2, 0.5, 1), color=color.blue)
head = sphere(pos=vector(1.2, 0.4, 0), radius=0.3, color=color.red)
car = compound([body, head], pos=vector(0, 0, 0))`,
    tags: ['3d', 'object', 'compound', 'group', 'combine', 'robot', 'car'],
  },

  // ━━━ vectors ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  {
    id: 'vector',
    category: 'vectors',
    title: { ko: '벡터 (vector)', en: 'vector' },
    description: {
      ko: '3D 벡터를 생성합니다. 위치, 속도, 힘 등을 표현하는 기본 수학 도구입니다. vec()로 짧게 쓸 수도 있습니다.',
      en: 'Creates a 3D vector. The fundamental math tool for position, velocity, force, etc. vec() is a shorthand alias.',
    },
    signature: "vector(x, y, z)  # 또는 vec(x, y, z)",
    params: [
      { name: 'x', type: 'number', default: '0', desc: { ko: 'x 성분', en: 'x component' } },
      { name: 'y', type: 'number', default: '0', desc: { ko: 'y 성분', en: 'y component' } },
      { name: 'z', type: 'number', default: '0', desc: { ko: 'z 성분', en: 'z component' } },
    ],
    code: `from vpython import *
v = vector(3, 4, 0)
print(v.x, v.y, v.z)  # 3 4 0
print(v.mag)           # 5.0
print(v.hat)           # <0.6, 0.8, 0>

# vec()는 vector()의 단축 별칭
w = vec(1, 2, 3)
print(w)               # <1, 2, 3>`,
    tags: ['math', 'vector', 'vec', 'position', 'direction', 'mag', 'hat'],
  },
  {
    id: 'mag',
    category: 'vectors',
    title: { ko: '크기 (mag)', en: 'mag' },
    description: {
      ko: '벡터의 크기(길이)를 반환합니다. 거리 계산에 사용합니다.',
      en: 'Returns the magnitude (length) of a vector. Used for distance calculations.',
    },
    signature: "mag(v)",
    params: [
      { name: 'v', type: 'vector', default: '-', desc: { ko: '벡터', en: 'Vector' } },
    ],
    code: `from vpython import *
v = vector(3, 4, 0)
print(mag(v))     # 5.0
print(v.mag)      # 5.0 (속성으로도 가능)
print(v.mag2)     # 25.0 (크기의 제곱)`,
    tags: ['math', 'vector', 'magnitude', 'length', 'distance'],
  },
  {
    id: 'hat',
    category: 'vectors',
    title: { ko: '단위벡터 (hat)', en: 'hat' },
    description: {
      ko: '벡터의 단위벡터(크기가 1인 방향 벡터)를 반환합니다.',
      en: 'Returns the unit vector (direction with magnitude 1) of a vector.',
    },
    signature: "hat(v)",
    params: [
      { name: 'v', type: 'vector', default: '-', desc: { ko: '벡터', en: 'Vector' } },
    ],
    code: `from vpython import *
v = vector(3, 4, 0)
u = hat(v)
print(u)        # <0.6, 0.8, 0>
print(mag(u))   # 1.0`,
    tags: ['math', 'vector', 'unit', 'direction', 'normalize'],
  },
  {
    id: 'dot',
    category: 'vectors',
    title: { ko: '내적 (dot)', en: 'dot' },
    description: {
      ko: '두 벡터의 내적(스칼라곱)을 반환합니다. 두 벡터가 같은 방향인지 판단하는 데 유용합니다.',
      en: 'Returns the dot product of two vectors. Useful for checking alignment.',
    },
    signature: "dot(a, b)",
    params: [
      { name: 'a', type: 'vector', default: '-', desc: { ko: '첫 번째 벡터', en: 'First vector' } },
      { name: 'b', type: 'vector', default: '-', desc: { ko: '두 번째 벡터', en: 'Second vector' } },
    ],
    code: `from vpython import *
a = vector(1, 0, 0)
b = vector(0, 1, 0)
print(dot(a, b))    # 0 (직각)
print(a.dot(b))     # 0 (메서드 방식)`,
    tags: ['math', 'vector', 'dot', 'product', 'scalar', 'angle'],
  },
  {
    id: 'cross',
    category: 'vectors',
    title: { ko: '외적 (cross)', en: 'cross' },
    description: {
      ko: '두 벡터의 외적(벡터곱)을 반환합니다. 수직 방향 벡터를 구할 때 사용합니다.',
      en: 'Returns the cross product of two vectors. Used to find perpendicular directions.',
    },
    signature: "cross(a, b)",
    params: [
      { name: 'a', type: 'vector', default: '-', desc: { ko: '첫 번째 벡터', en: 'First vector' } },
      { name: 'b', type: 'vector', default: '-', desc: { ko: '두 번째 벡터', en: 'Second vector' } },
    ],
    code: `from vpython import *
a = vector(1, 0, 0)
b = vector(0, 1, 0)
c = cross(a, b)
print(c)            # <0, 0, 1>
print(a.cross(b))   # <0, 0, 1>`,
    tags: ['math', 'vector', 'cross', 'product', 'perpendicular', 'normal'],
  },
  {
    id: 'norm',
    category: 'vectors',
    title: { ko: '정규화 (norm)', en: 'norm' },
    description: {
      ko: 'hat과 같습니다. 벡터를 단위벡터로 변환합니다.',
      en: 'Same as hat. Normalizes a vector to unit length.',
    },
    signature: "norm(v)",
    params: [
      { name: 'v', type: 'vector', default: '-', desc: { ko: '벡터', en: 'Vector' } },
    ],
    code: `from vpython import *
v = vector(0, 5, 0)
print(norm(v))   # <0, 1, 0>
print(hat(v))    # <0, 1, 0> (동일)`,
    tags: ['math', 'vector', 'normalize', 'unit', 'direction'],
  },

  // ━━━ scene ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  {
    id: 'rate',
    category: 'scene',
    title: { ko: '프레임 속도 (rate)', en: 'rate' },
    description: {
      ko: '초당 프레임 수를 제어합니다. VPyLab 편집기에서는 rate()만 써도 자동으로 await rate()로 변환됩니다.',
      en: 'Controls frame rate. In the VPyLab editor, rate() is automatically converted to await rate().',
    },
    signature: "rate(fps)",
    params: [
      { name: 'fps', type: 'number', default: '60', desc: { ko: '초당 프레임 수', en: 'Frames per second' } },
    ],
    code: `from vpython import *
ball = sphere(color=color.red)
ball.velocity = vector(1, 0, 0)
for i in range(100):
    rate(30)
    ball.pos += ball.velocity * 0.05`,
    tags: ['scene', 'animation', 'loop', 'frame', 'fps', 'rate'],
  },
  {
    id: 'sleep',
    category: 'scene',
    title: { ko: '대기 (sleep)', en: 'sleep' },
    description: {
      ko: '지정한 시간(초) 동안 실행을 멈춥니다. VPyLab 편집기에서는 sleep()만 써도 자동으로 await sleep()로 변환됩니다.',
      en: 'Pauses execution for the given seconds. In the VPyLab editor, sleep() is automatically converted to await sleep().',
    },
    signature: "sleep(seconds)",
    params: [
      { name: 'seconds', type: 'number', default: '-', desc: { ko: '대기 시간 (초)', en: 'Wait time (seconds)' } },
    ],
    code: `from vpython import *
sphere(color=color.red)
sleep(2)
sphere(pos=vector(2, 0, 0), color=color.blue)`,
    tags: ['scene', 'pause', 'wait', 'delay', 'sleep', 'time'],
  },
  {
    id: 'scene_background',
    category: 'scene',
    title: { ko: '배경색 (scene_background)', en: 'scene_background' },
    description: {
      ko: '3D 씬의 배경색을 설정합니다.',
      en: 'Sets the background color of the 3D scene.',
    },
    signature: "scene_background(color)",
    params: [
      { name: 'color', type: 'vector', default: '-', desc: { ko: '배경색', en: 'Background color' } },
    ],
    code: `from vpython import *
scene_background(color.skyblue)
sphere(pos=vector(0, 1, 0), color=color.yellow, radius=0.5)
box(pos=vector(0, -0.5, 0), size=vector(5, 0.1, 5), color=color.green)`,
    tags: ['scene', 'background', 'sky', 'color'],
  },
  {
    id: 'local_light',
    category: 'scene',
    title: { ko: '점 조명 (local_light)', en: 'local_light' },
    description: {
      ko: '특정 위치에서 사방으로 빛을 내는 점 조명을 생성합니다.',
      en: 'Creates a point light that emits light in all directions from a position.',
    },
    signature: "local_light(pos=vector(0,0,0), color=color.white, intensity=1.0)",
    params: [
      { name: 'pos',       type: 'vector', default: 'vector(0,0,0)', desc: { ko: '조명 위치', en: 'Light position' } },
      { name: 'color',     type: 'vector', default: 'color.white',   desc: { ko: '조명 색상', en: 'Light color' } },
      { name: 'intensity', type: 'number', default: '1.0',           desc: { ko: '밝기 (0~...)', en: 'Intensity (0–...)' } },
    ],
    code: `from vpython import *
scene_background(color.black)
local_light(pos=vector(2, 3, 0), color=color.yellow, intensity=1.5)
sphere(radius=0.5, color=color.white)`,
    tags: ['scene', 'light', 'point', 'local', 'lighting'],
  },
  {
    id: 'distant_light',
    category: 'scene',
    title: { ko: '방향 조명 (distant_light)', en: 'distant_light' },
    description: {
      ko: '무한히 먼 곳에서 한 방향으로 비추는 조명입니다. 햇빛과 비슷합니다.',
      en: 'A directional light from infinitely far away. Similar to sunlight.',
    },
    signature: "distant_light(direction=vector(0,-1,0), color=color.white, intensity=1.0)",
    params: [
      { name: 'direction', type: 'vector', default: 'vector(0,-1,0)', desc: { ko: '빛의 방향', en: 'Light direction' } },
      { name: 'color',     type: 'vector', default: 'color.white',    desc: { ko: '조명 색상', en: 'Light color' } },
      { name: 'intensity', type: 'number', default: '1.0',            desc: { ko: '밝기 (0~...)', en: 'Intensity (0–...)' } },
    ],
    code: `from vpython import *
scene_background(color.skyblue)
distant_light(direction=vector(1, -1, -0.5), color=color.white, intensity=1.2)
box(size=vector(2, 0.5, 2), color=color.orange)`,
    tags: ['scene', 'light', 'directional', 'distant', 'sun', 'lighting'],
  },

  // ━━━ colors ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  {
    id: 'color-palette',
    category: 'colors',
    title: { ko: '색상 팔레트', en: 'Color Palette' },
    description: {
      ko: 'VPyLab에서 사용할 수 있는 30가지 기본 색상입니다. color.이름 형식으로 사용합니다.',
      en: '30 built-in colors available in VPyLab. Use the color.name format.',
    },
    signature: "color.red, color.green, color.blue, ...",
    params: [
      { name: 'color.red',      type: 'vector', default: 'vector(1,0,0)',           desc: { ko: '빨강', en: 'Red' } },
      { name: 'color.green',    type: 'vector', default: 'vector(0,0.8,0)',         desc: { ko: '초록', en: 'Green' } },
      { name: 'color.blue',     type: 'vector', default: 'vector(0,0,1)',           desc: { ko: '파랑', en: 'Blue' } },
      { name: 'color.yellow',   type: 'vector', default: 'vector(1,1,0)',           desc: { ko: '노랑', en: 'Yellow' } },
      { name: 'color.cyan',     type: 'vector', default: 'vector(0,1,1)',           desc: { ko: '시안', en: 'Cyan' } },
      { name: 'color.magenta',  type: 'vector', default: 'vector(1,0,1)',           desc: { ko: '마젠타', en: 'Magenta' } },
      { name: 'color.orange',   type: 'vector', default: 'vector(1,0.6,0)',         desc: { ko: '주황', en: 'Orange' } },
      { name: 'color.white',    type: 'vector', default: 'vector(1,1,1)',           desc: { ko: '흰색', en: 'White' } },
      { name: 'color.black',    type: 'vector', default: 'vector(0,0,0)',           desc: { ko: '검정', en: 'Black' } },
      { name: 'color.gray',     type: 'vector', default: 'vector(0.5,0.5,0.5)',     desc: { ko: '회색', en: 'Gray' } },
      { name: 'color.purple',   type: 'vector', default: 'vector(0.5,0,0.5)',       desc: { ko: '보라', en: 'Purple' } },
      { name: 'color.pink',     type: 'vector', default: 'vector(1,0.75,0.8)',      desc: { ko: '분홍', en: 'Pink' } },
      { name: 'color.brown',    type: 'vector', default: 'vector(0.6,0.3,0.1)',     desc: { ko: '갈색', en: 'Brown' } },
      { name: 'color.gold',     type: 'vector', default: 'vector(1,0.84,0)',        desc: { ko: '금색', en: 'Gold' } },
      { name: 'color.silver',   type: 'vector', default: 'vector(0.75,0.75,0.75)',  desc: { ko: '은색', en: 'Silver' } },
      { name: 'color.navy',     type: 'vector', default: 'vector(0,0,0.5)',         desc: { ko: '남색', en: 'Navy' } },
      { name: 'color.skyblue',  type: 'vector', default: 'vector(0.53,0.81,0.92)',  desc: { ko: '하늘색', en: 'Sky Blue' } },
      { name: 'color.lime',     type: 'vector', default: 'vector(0.5,1,0)',         desc: { ko: '라임', en: 'Lime' } },
      { name: 'color.olive',    type: 'vector', default: 'vector(0.5,0.5,0)',       desc: { ko: '올리브', en: 'Olive' } },
      { name: 'color.coral',    type: 'vector', default: 'vector(1,0.5,0.31)',      desc: { ko: '코랄', en: 'Coral' } },
      { name: 'color.salmon',   type: 'vector', default: 'vector(0.98,0.5,0.45)',   desc: { ko: '살몬', en: 'Salmon' } },
      { name: 'color.violet',   type: 'vector', default: 'vector(0.56,0,1)',        desc: { ko: '바이올렛', en: 'Violet' } },
      { name: 'color.indigo',   type: 'vector', default: 'vector(0.29,0,0.51)',     desc: { ko: '인디고', en: 'Indigo' } },
      { name: 'color.beige',    type: 'vector', default: 'vector(0.96,0.96,0.86)',  desc: { ko: '베이지', en: 'Beige' } },
      { name: 'color.mint',     type: 'vector', default: 'vector(0.6,1,0.8)',       desc: { ko: '민트', en: 'Mint' } },
      { name: 'color.peach',    type: 'vector', default: 'vector(1,0.85,0.73)',     desc: { ko: '복숭아', en: 'Peach' } },
      { name: 'color.lavender', type: 'vector', default: 'vector(0.71,0.49,0.86)',  desc: { ko: '라벤더', en: 'Lavender' } },
      { name: 'color.maroon',   type: 'vector', default: 'vector(0.5,0,0)',         desc: { ko: '마룬', en: 'Maroon' } },
      { name: 'color.teal',     type: 'vector', default: 'vector(0,0.5,0.5)',       desc: { ko: '틸', en: 'Teal' } },
      { name: 'color.ivory',    type: 'vector', default: 'vector(1,1,0.94)',        desc: { ko: '아이보리', en: 'Ivory' } },
    ],
    code: `from vpython import *
colors_list = [color.red, color.orange, color.yellow, color.green, color.blue, color.purple]
for i, c in enumerate(colors_list):
    sphere(pos=vector(i - 2.5, 0, 0), radius=0.4, color=c)`,
    tags: ['color', 'palette', 'reference', 'list'],
  },
  {
    id: 'korean-colors',
    category: 'colors',
    title: { ko: '한글 색상 (색상)', en: 'Korean Color Aliases' },
    description: {
      ko: "한글로 색상을 지정할 수 있습니다. 색상['빨강'] 또는 색상['빨'] 형식으로 사용합니다.",
      en: "Colors can be specified in Korean. Use 색상['빨강'] or 색상['빨'] format.",
    },
    signature: "색상['빨강'], 색상['빨'], 색상['초록'], 색상['파랑'], ...",
    params: [
      { name: "색상['빨강'] / 색상['빨'] / 색상['빨간']", type: 'vector', default: 'color.red', desc: { ko: '빨강', en: 'Red' } },
      { name: "색상['주황'] / 색상['주']",    type: 'vector', default: 'color.orange',  desc: { ko: '주황', en: 'Orange' } },
      { name: "색상['노랑'] / 색상['노']",    type: 'vector', default: 'color.yellow',  desc: { ko: '노랑', en: 'Yellow' } },
      { name: "색상['초록'] / 색상['초'] / 색상['녹색']", type: 'vector', default: 'color.green', desc: { ko: '초록', en: 'Green' } },
      { name: "색상['파랑'] / 색상['파']",    type: 'vector', default: 'color.blue',    desc: { ko: '파랑', en: 'Blue' } },
      { name: "색상['보라'] / 색상['보']",    type: 'vector', default: 'color.purple',  desc: { ko: '보라', en: 'Purple' } },
      { name: "색상['흰색'] / 색상['흰']",    type: 'vector', default: 'color.white',   desc: { ko: '흰색', en: 'White' } },
      { name: "색상['검정'] / 색상['검']",    type: 'vector', default: 'color.black',   desc: { ko: '검정', en: 'Black' } },
      { name: "색상['분홍'] / 색상['분']",    type: 'vector', default: 'color.pink',    desc: { ko: '분홍', en: 'Pink' } },
      { name: "색상['하늘'] / 색상['하늘색']", type: 'vector', default: 'color.skyblue', desc: { ko: '하늘색', en: 'Sky Blue' } },
      { name: "색상['청록'] / 색상['시안']",   type: 'vector', default: 'color.cyan',    desc: { ko: '청록', en: 'Cyan' } },
      { name: "색상['갈색'] / 색상['갈']",    type: 'vector', default: 'color.brown',   desc: { ko: '갈색', en: 'Brown' } },
      { name: "색상['회색'] / 색상['회']",    type: 'vector', default: 'color.gray',    desc: { ko: '회색', en: 'Gray' } },
      { name: "색상['금색'] / 색상['황금']",   type: 'vector', default: 'color.gold',    desc: { ko: '금색', en: 'Gold' } },
      { name: "색상['민트'] / 색상['라벤더']", type: 'vector', default: '-',             desc: { ko: '확장 색상도 한글 이름으로 접근 가능', en: 'Extended colors are available by Korean names too' } },
    ],
    code: `from vpython import *
sphere(pos=vector(-1, 0, 0), radius=0.5, color=색상['빨'])
sphere(pos=vector(0, 0, 0), radius=0.5, color=색상['초록'])
sphere(pos=vector(1, 0, 0), radius=0.5, color=색상['파랑'])`,
    tags: ['color', 'korean', 'hangul', '색상', '한글'],
  },
  {
    id: 'custom-rgb',
    category: 'colors',
    title: { ko: '사용자 정의 색상 (RGB)', en: 'Custom RGB Color' },
    description: {
      ko: 'vector(r, g, b) 형식으로 나만의 색상을 만듭니다. 각 값은 0~1 범위입니다.',
      en: 'Create custom colors with vector(r, g, b). Each value ranges from 0 to 1.',
    },
    signature: "vector(r, g, b)  # r, g, b: 0.0 ~ 1.0",
    params: [
      { name: 'r', type: 'number', default: '0', desc: { ko: '빨강 (0~1)', en: 'Red (0–1)' } },
      { name: 'g', type: 'number', default: '0', desc: { ko: '초록 (0~1)', en: 'Green (0–1)' } },
      { name: 'b', type: 'number', default: '0', desc: { ko: '파랑 (0~1)', en: 'Blue (0–1)' } },
    ],
    code: `from vpython import *
my_color = vector(0.2, 0.6, 0.9)
sphere(pos=vector(0, 0, 0), radius=0.8, color=my_color)
sphere(pos=vector(2, 0, 0), radius=0.5, color=vector(1, 0.4, 0.7))`,
    tags: ['color', 'custom', 'rgb', 'vector'],
  },
  {
    id: 'color-lists',
    category: 'colors',
    title: { ko: '색상 리스트 (무지개)', en: 'Color Lists' },
    description: {
      ko: '자주 쓰는 색상 묶음입니다. 번호로 꺼내거나 한글 이름으로 꺼낼 수 있어 미디어아트 예제에 좋습니다.',
      en: 'Ready-made color groups. Access by index or Korean color name; useful for media-art examples.',
    },
    signature: "무지개[0], 무지개['빨강'], 파스텔['하늘'], 따뜻한색[1]",
    params: [
      { name: '무지개 / rainbow', type: 'NamedList', default: '빨-주-노-초-하늘-파-보', desc: { ko: '무지개 7색', en: 'Seven rainbow colors' } },
      { name: '따뜻한색 / warm_colors', type: 'NamedList', default: '빨-주-노', desc: { ko: '따뜻한 계열 색상', en: 'Warm colors' } },
      { name: '차가운색 / cool_colors', type: 'NamedList', default: '하늘-파-보', desc: { ko: '차가운 계열 색상', en: 'Cool colors' } },
      { name: '기본색 / basic_colors', type: 'NamedList', default: '흰-검-빨-초-파', desc: { ko: '가장 기본적인 5색', en: 'Five basic colors' } },
      { name: '파스텔 / pastel_colors', type: 'NamedList', default: '핑크-주황-노랑-초록-하늘-보라-자홍', desc: { ko: '부드러운 파스텔 색상', en: 'Soft pastel colors' } },
    ],
    code: `from vpython import *
scene_background(색상['검정'])

for i in range(7):
    sphere(
        pos=vector(i - 3, 0, 0),
        radius=0.35,
        color=무지개[i],
        emissive=True
    )

sphere(pos=vector(0, 1.2, 0), radius=0.45, color=파스텔['하늘'])`,
    tags: ['color', 'palette', 'korean', 'hangul', '무지개', '파스텔', '따뜻한색', '차가운색', '기본색'],
  },

  // ━━━ sound ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  {
    id: 'korean-sound-quickstart',
    category: 'sound',
    title: { ko: '한글 사운드 빠른 시작', en: 'Korean Sound Quickstart' },
    description: {
      ko: 'VPyLab은 영어 함수와 함께 한글 함수명을 제공합니다. 수업 예제에서는 한글 이름을 먼저 쓰고, 필요할 때 영어 별칭을 함께 보여주는 방식을 권장합니다.',
      en: 'VPyLab provides Korean sound functions alongside English aliases. For classes, prefer Korean names first and introduce English aliases when useful.',
    },
    signature: '소리(), 음표(), 화음(), 효과음(), 배경음악(), 배경음악정지(), 악기()',
    params: [
      { name: '소리(frequency, duration)', type: 'function', default: '440, 0.3', desc: { ko: '주파수로 단순한 소리 재생', en: 'Play a tone by frequency' } },
      { name: "음표('도4', duration)", type: 'async function', default: "'도4', 0.5", desc: { ko: '음표 이름으로 재생하고 자동으로 기다림', en: 'Play a named note and wait automatically' } },
      { name: '화음([freq...], duration)', type: 'function', default: '-', desc: { ko: '여러 음을 동시에 재생', en: 'Play several notes at once' } },
      { name: "효과음('coin')", type: 'function', default: '-', desc: { ko: '내장 게임 효과음 재생', en: 'Play a built-in game sound effect' } },
      { name: "배경음악('peaceful')", type: 'function', default: '-', desc: { ko: '내장 BGM 시작', en: 'Start built-in background music' } },
      { name: "악기('피아노', '도4')", type: 'async function', default: '-', desc: { ko: '악기 음색으로 음표 재생', en: 'Play a note with an instrument preset' } },
    ],
    code: `from vpython import *

배경음악("peaceful")

음표("도4", 0.3)
음표("미4", 0.3)
음표("솔4", 0.5)
화음([음계['도'], 음계['미'], 음계['솔']], 1.0)

효과음("success")
배경음악정지()`,
    tags: ['sound', 'audio', 'music', 'korean', 'hangul', '소리', '음표', '화음', '효과음', '배경음악', '악기'],
  },
  {
    id: 'play_sound',
    category: 'sound',
    title: { ko: '소리 재생 (소리 / sound)', en: 'sound / play_sound' },
    description: {
      ko: '주파수를 지정하여 소리를 재생합니다. 한글 별칭 소리(), 짧은 영어 별칭 sound(), 전체 이름 play_sound()를 모두 사용할 수 있습니다.',
      en: 'Plays a tone with the specified frequency. You can use the Korean alias 소리(), short English alias sound(), or full name play_sound().',
    },
    signature: "소리(frequency=440, duration=0.3, type='sine', volume=0.3)",
    params: [
      { name: 'frequency', type: 'number', default: '440',    desc: { ko: '주파수 (Hz)', en: 'Frequency (Hz)' } },
      { name: 'duration',  type: 'number', default: '0.3',    desc: { ko: '재생 시간 (초)', en: 'Duration (seconds)' } },
      { name: 'type',      type: 'string', default: "'sine'",  desc: { ko: "파형 ('sine'|'square'|'sawtooth'|'triangle')", en: "Waveform ('sine'|'square'|'sawtooth'|'triangle')" } },
      { name: 'volume',    type: 'number', default: '0.3',    desc: { ko: '음량 (0~1)', en: 'Volume (0–1)' } },
    ],
    code: `from vpython import *
소리(440, 0.4)
sleep(0.5)
sound(660, 0.4, type='square')
sleep(0.5)
play_sound(880, 0.4, type='triangle')`,
    tags: ['sound', 'audio', 'tone', 'frequency', 'beep', '소리'],
  },
  {
    id: 'play_note',
    category: 'sound',
    title: { ko: '음표 재생 (음표)', en: '음표 / play_note' },
    description: {
      ko: "음표 이름으로 소리를 재생합니다. 음표()는 재생 시간만큼 자동으로 기다리므로 멜로디를 만들 때 가장 편합니다. 영문('C4')과 한글('도4')을 모두 지원합니다.",
      en: "Plays a note by name. The Korean 음표() helper waits automatically for the note duration, making melodies easier. English ('C4') and Korean ('도4') notation both work.",
    },
    signature: "음표(name='도4', duration=0.5, type='sine', volume=0.4)",
    params: [
      { name: 'name',     type: 'string', default: "'도4'",   desc: { ko: "음표 이름 ('도4', '레4', 'C4', 'C#4', '도#4')", en: "Note name ('도4', '레4', 'C4', 'C#4', '도#4')" } },
      { name: 'duration', type: 'number', default: '0.5',    desc: { ko: '재생 시간 (초)', en: 'Duration (seconds)' } },
      { name: 'type',     type: 'string', default: "'sine'",  desc: { ko: '파형', en: 'Waveform' } },
      { name: 'volume',   type: 'number', default: '0.4',    desc: { ko: '음량 (0~1)', en: 'Volume (0–1)' } },
    ],
    code: `from vpython import *
# 도레미파솔라시도
notes = ['도4', '레4', '미4', '파4', '솔4', '라4', '시4', '도5']
for n in notes:
    음표(n, 0.3)`,
    tags: ['sound', 'audio', 'note', 'music', 'melody', 'korean', '도레미', '음표'],
  },
  {
    id: 'play_chord',
    category: 'sound',
    title: { ko: '화음 재생 (화음)', en: '화음 / chord' },
    description: {
      ko: '여러 주파수를 동시에 재생하여 화음을 만듭니다. 음계 리스트와 함께 쓰면 숫자 주파수를 외우지 않아도 됩니다.',
      en: 'Plays multiple frequencies simultaneously to create a chord. Use it with scale lists so students do not need to memorize numeric frequencies.',
    },
    signature: "화음([음계['도'], 음계['미'], 음계['솔']], duration=1.0)",
    params: [
      { name: 'frequencies', type: 'list',   default: '-',      desc: { ko: '주파수 리스트 (Hz)', en: 'List of frequencies (Hz)' } },
      { name: 'duration',    type: 'number', default: '1.0',    desc: { ko: '재생 시간 (초)', en: 'Duration (seconds)' } },
      { name: 'type',        type: 'string', default: "'sine'",  desc: { ko: '파형', en: 'Waveform' } },
      { name: 'volume',      type: 'number', default: '0.25',   desc: { ko: '음량 (0~1)', en: 'Volume (0–1)' } },
    ],
    code: `from vpython import *
# 밝은 느낌: 도-미-솔
화음([음계['도'], 음계['미'], 음계['솔']], 1.0)
sleep(1.2)

# 다른 느낌: 라-도-미
화음([음계['라'], 높은음계['도'], 높은음계['미']], 1.0)`,
    tags: ['sound', 'audio', 'chord', 'harmony', 'music', '화음', '음계'],
  },
  {
    id: 'play_sequence',
    category: 'sound',
    title: { ko: '멜로디 재생 (play_sequence)', en: 'play_sequence' },
    description: {
      ko: '음표 리스트를 순서대로 재생하여 멜로디를 만듭니다.',
      en: 'Plays a list of notes in sequence to create a melody.',
    },
    signature: "play_sequence(notes)",
    params: [
      { name: 'notes', type: 'list', default: '-', desc: { ko: "음표 리스트 [{freq, duration, type, volume}, ...]", en: "List of note objects [{freq, duration, type, volume}, ...]" } },
    ],
    code: `from vpython import *
melody = [
    {'freq': 음계['도'], 'duration': 0.3},
    {'freq': 음계['레'], 'duration': 0.3},
    {'freq': 음계['미'], 'duration': 0.3},
    {'freq': 음계['파'], 'duration': 0.3},
    {'freq': 음계['솔'], 'duration': 0.6},
]
play_sequence(melody)`,
    tags: ['sound', 'audio', 'sequence', 'melody', 'music', 'song', '음계'],
  },
  {
    id: 'play_sfx',
    category: 'sound',
    title: { ko: '효과음 재생 (효과음)', en: '효과음 / sfx' },
    description: {
      ko: '내장 효과음을 재생합니다. 게임, 장면 전환, 미디어아트 피드백에 유용합니다. 효과음(), sfx(), play_sfx()를 모두 사용할 수 있습니다.',
      en: 'Plays a built-in sound effect. Useful for games, scene changes, and media-art feedback. 효과음(), sfx(), and play_sfx() are all supported.',
    },
    signature: "효과음(name)",
    params: [
      { name: 'name', type: 'string', default: '-', desc: {
        ko: "효과음 이름: 'jump', 'coin', 'powerup', 'power_up', 'death', 'fireball', 'pipe', '1up', 'oneup', 'select', 'warning', 'explosion', 'laser', 'success', 'error', 'hint', 'run', 'levelup', 'level_up'",
        en: "SFX name: 'jump', 'coin', 'powerup', 'power_up', 'death', 'fireball', 'pipe', '1up', 'oneup', 'select', 'warning', 'explosion', 'laser', 'success', 'error', 'hint', 'run', 'levelup', 'level_up'",
      } },
    ],
    code: `from vpython import *
효과음("coin")
sleep(0.5)
효과음("success")
sleep(0.5)
효과음("explosion")`,
    tags: ['sound', 'audio', 'sfx', 'effect', 'game', 'coin', 'jump', 'explosion', '효과음'],
  },
  {
    id: 'bgm',
    category: 'sound',
    title: { ko: '배경음악 (배경음악 / 배경음악정지)', en: 'BGM' },
    description: {
      ko: '내장 배경음악을 반복 재생하거나 정지합니다. 작품의 분위기를 빠르게 만들 수 있어 갤러리 예제에 잘 어울립니다.',
      en: 'Starts or stops a built-in background music loop. Great for giving gallery pieces an immediate mood.',
    },
    signature: "배경음악(name)  /  배경음악정지()",
    params: [
      { name: 'name', type: 'string', default: '-', desc: {
        ko: "배경음악 이름: 'adventure', 'explore', 'battle', 'peaceful', 'victory'",
        en: "BGM name: 'adventure', 'explore', 'battle', 'peaceful', 'victory'",
      } },
    ],
    code: `from vpython import *
배경음악("adventure")
sphere(color=color.gold, radius=0.5)
sleep(5)
배경음악정지()`,
    tags: ['sound', 'audio', 'bgm', 'music', 'background', 'loop', '배경음악'],
  },
  {
    id: 'note-constants',
    category: 'sound',
    title: { ko: '음계와 노트 상수', en: 'Scales and Note Constants' },
    description: {
      ko: '숫자 주파수를 직접 쓰지 않도록 note 상수와 한글 음계 리스트를 제공합니다. 음계, 높은음계, 낮은음계는 번호와 이름으로 모두 접근할 수 있습니다.',
      en: 'Use note constants and Korean scale lists instead of raw frequencies. 음계, 높은음계, and 낮은음계 work with both indexes and names.',
    },
    signature: "음계['도'], 높은음계['솔'], 낮은음계[0], note.C4",
    params: [
      { name: "음계['도'] / scale['C']", type: 'number', default: 'note.C4', desc: { ko: '가운데 옥타브 도', en: 'Middle octave C' } },
      { name: "높은음계['도']", type: 'number', default: 'note.C5', desc: { ko: '높은 도', en: 'High C' } },
      { name: "낮은음계['도']", type: 'number', default: 'note.C3', desc: { ko: '낮은 도', en: 'Low C' } },
      { name: 'note.C3',  type: 'number', default: '130.81',  desc: { ko: '도3', en: 'C3' } },
      { name: 'note.C4',  type: 'number', default: '261.63',  desc: { ko: '도4 (가온다)', en: 'C4 (middle C)' } },
      { name: 'note.D4',  type: 'number', default: '293.66',  desc: { ko: '레4', en: 'D4' } },
      { name: 'note.E4',  type: 'number', default: '329.63',  desc: { ko: '미4', en: 'E4' } },
      { name: 'note.F4',  type: 'number', default: '349.23',  desc: { ko: '파4', en: 'F4' } },
      { name: 'note.G4',  type: 'number', default: '392.00',  desc: { ko: '솔4', en: 'G4' } },
      { name: 'note.A4',  type: 'number', default: '440.00',  desc: { ko: '라4 (기준음)', en: 'A4 (concert pitch)' } },
      { name: 'note.B4',  type: 'number', default: '493.88',  desc: { ko: '시4', en: 'B4' } },
      { name: 'note.C5',  type: 'number', default: '523.25',  desc: { ko: '도5', en: 'C5' } },
      { name: 'note.C6',  type: 'number', default: '1046.50', desc: { ko: '도6', en: 'C6' } },
    ],
    code: `from vpython import *
for n in ['도', '미', '솔', '높은도']:
    소리(음계[n], 0.25)
    sleep(0.3)

화음([낮은음계['도'], 음계['솔'], 높은음계['도']], 1.0)`,
    tags: ['sound', 'audio', 'note', 'constant', 'frequency', 'pitch', '음계', '높은음계', '낮은음계'],
  },
  {
    id: 'instrument',
    category: 'sound',
    title: { ko: '악기 음색 (악기)', en: 'Instrument Presets' },
    description: {
      ko: '피아노, 기타, 플루트, 칩튠 같은 악기 느낌으로 음표를 재생합니다. 악기()는 음표()처럼 자동으로 기다립니다.',
      en: 'Plays notes with instrument-like presets such as piano, guitar, flute, and chiptune. 악기() waits automatically like 음표().',
    },
    signature: "악기(instrument, name, duration=0.5, volume=None)",
    params: [
      { name: 'instrument', type: 'string', default: "'피아노'", desc: { ko: "악기 이름: '피아노', '오르간', '기타', '플루트', '트럼펫', '베이스', '칩튠', '신스'", en: "Instrument: 'piano', 'organ', 'guitar', 'flute', 'trumpet', 'bass', 'chiptune', 'synth'" } },
      { name: 'name', type: 'string', default: "'도4'", desc: { ko: "음표 이름 ('도4', '솔#4', 'C4')", en: "Note name ('도4', '솔#4', 'C4')" } },
      { name: 'duration', type: 'number', default: '0.5', desc: { ko: '재생 시간 (초)', en: 'Duration (seconds)' } },
      { name: 'volume', type: 'number', default: 'None', desc: { ko: '직접 지정하지 않으면 악기별 기본 음량 사용', en: 'Uses the preset volume unless specified' } },
    ],
    code: `from vpython import *
악기("피아노", "도4", 0.4)
악기("기타", "미4", 0.4)
악기("칩튠", "솔4", 0.4)

화음([음계['도'], 음계['미'], 음계['솔']], 1.0, type='triangle')`,
    tags: ['sound', 'audio', 'instrument', 'music', '악기', '피아노', '기타', '칩튠'],
  },

  // ━━━ charts ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  {
    id: 'scatter3d',
    category: 'charts',
    title: { ko: '3D 산점도 (scatter3d)', en: 'scatter3d' },
    description: {
      ko: '3D 공간에 데이터 포인트를 표시합니다. 한글 별명: 산점도',
      en: 'Plots data points in 3D space. Korean alias: 산점도',
    },
    signature: "산점도(points, colors=None, size=0.08, colormap='rainbow', opacity=0.9, show_axes=True)",
    params: [
      { name: 'points',    type: 'list',    default: '-',          desc: { ko: '3D 좌표 리스트 [[x,y,z], ...]', en: '3D coordinate list [[x,y,z], ...]' } },
      { name: 'colors',    type: 'list',    default: 'None',       desc: { ko: '각 점의 색상 리스트', en: 'Color list for each point' } },
      { name: 'size',      type: 'number',  default: '0.08',       desc: { ko: '점 크기', en: 'Point size' } },
      { name: 'colormap',  type: 'string',  default: "'rainbow'",  desc: { ko: '색상맵', en: 'Colormap' } },
      { name: 'opacity',   type: 'number',  default: '1.0',        desc: { ko: '불투명도 (0~1)', en: 'Opacity (0–1)' } },
      { name: 'show_axes', type: 'boolean', default: 'True',       desc: { ko: '축 표시 여부', en: 'Show axes' } },
    ],
    code: `from vpython import *
import random
points = [[random.uniform(-2,2), random.uniform(-2,2), random.uniform(-2,2)] for _ in range(50)]
산점도(points, colormap='rainbow', size=0.1)`,
    tags: ['chart', 'graph', 'scatter', 'data', 'visualization', '산점도'],
  },
  {
    id: 'surface3d',
    category: 'charts',
    title: { ko: '3D 표면 그래프 (surface3d)', en: 'surface3d' },
    description: {
      ko: '2D 배열 데이터를 3D 표면으로 시각화합니다. 한글 별명: 표면그래프',
      en: 'Visualizes 2D array data as a 3D surface. Korean alias: 표면그래프',
    },
    signature: "표면그래프(z_data, x_range=None, y_range=None, colormap='viridis', wireframe=True, opacity=0.85, show_axes=True)",
    params: [
      { name: 'z_data',    type: 'list',    default: '-',           desc: { ko: '2D 높이 데이터', en: '2D height data' } },
      { name: 'x_range',   type: 'list',    default: 'None',        desc: { ko: 'x축 범위 [min, max]', en: 'x-axis range [min, max]' } },
      { name: 'y_range',   type: 'list',    default: 'None',        desc: { ko: 'y축 범위 [min, max]', en: 'y-axis range [min, max]' } },
      { name: 'colormap',  type: 'string',  default: "'viridis'",   desc: { ko: '색상맵', en: 'Colormap' } },
      { name: 'wireframe', type: 'boolean', default: 'False',       desc: { ko: '와이어프레임 표시', en: 'Show wireframe' } },
      { name: 'opacity',   type: 'number',  default: '1.0',         desc: { ko: '불투명도 (0~1)', en: 'Opacity (0–1)' } },
    ],
    code: `from vpython import *
import math
z = []
for i in range(20):
    row = []
    for j in range(20):
        x, y = (i - 10) * 0.3, (j - 10) * 0.3
        row.append(math.sin(math.sqrt(x**2 + y**2)))
    z.append(row)
표면그래프(z, colormap='viridis')`,
    tags: ['chart', 'graph', 'surface', 'data', 'visualization', 'heatmap', '표면그래프'],
  },
  {
    id: 'line3d',
    category: 'charts',
    title: { ko: '3D 선 그래프 (line3d)', en: 'line3d' },
    description: {
      ko: '3D 공간에 선을 그려 데이터의 흐름을 표현합니다. 한글 별명: 선그래프',
      en: 'Draws lines in 3D space to show data trends. Korean alias: 선그래프',
    },
    signature: "선그래프(points, color=color.white, width=0.03, show_axes=True)",
    params: [
      { name: 'points',    type: 'list',    default: '-',          desc: { ko: '3D 좌표 리스트 [[x,y,z], ...]', en: '3D coordinate list [[x,y,z], ...]' } },
      { name: 'color',     type: 'vector',  default: 'color.white', desc: { ko: '선 색상', en: 'Line color' } },
      { name: 'width',     type: 'number',  default: '0.03',       desc: { ko: '선 두께', en: 'Line width' } },
      { name: 'show_axes', type: 'boolean', default: 'True',       desc: { ko: '축 표시 여부', en: 'Show axes' } },
    ],
    code: `from vpython import *
import math
points = [[t * 0.1, math.sin(t * 0.1), math.cos(t * 0.1)] for t in range(60)]
선그래프(points, color=색상['하늘'], width=0.05)`,
    tags: ['chart', 'graph', 'line', 'data', 'visualization', 'curve', '선그래프'],
  },
  {
    id: 'bar3d',
    category: 'charts',
    title: { ko: '3D 막대 그래프 (bar3d)', en: 'bar3d' },
    description: {
      ko: '3D 공간에 막대 그래프를 그립니다. 한글 별명: 막대그래프',
      en: 'Draws a 3D bar chart. Korean alias: 막대그래프',
    },
    signature: "막대그래프(values, labels=None, colors=None, colormap='plasma', bar_width=0.6, show_axes=True)",
    params: [
      { name: 'values',    type: 'list',    default: '-',          desc: { ko: '막대 높이 리스트', en: 'List of bar heights' } },
      { name: 'labels',    type: 'list',    default: 'None',       desc: { ko: '각 막대의 이름', en: 'Label for each bar' } },
      { name: 'colors',    type: 'list',    default: 'None',       desc: { ko: '각 막대의 색상', en: 'Color for each bar' } },
      { name: 'colormap',  type: 'string',  default: "'plasma'",   desc: { ko: '색상맵', en: 'Colormap' } },
      { name: 'bar_width', type: 'number',  default: '0.6',        desc: { ko: '막대 폭', en: 'Bar width' } },
      { name: 'show_axes', type: 'boolean', default: 'True',       desc: { ko: '축 표시 여부', en: 'Show axes' } },
    ],
    code: `from vpython import *
values = [3, 7, 2, 5, 9, 4]
labels = ['월', '화', '수', '목', '금', '토']
막대그래프(values, labels=labels, colormap='plasma')`,
    tags: ['chart', 'graph', 'bar', 'data', 'visualization', 'column', '막대그래프'],
  },
];

// ─── 유틸리티 함수 ──────────────────────────────────────────

/**
 * 카테고리 ID로 해당 문서 항목 필터링
 * @param {string} catId - 카테고리 키 (예: 'objects')
 * @returns {Array} 해당 카테고리의 문서 배열
 */
export function getDocsByCategory(catId) {
  return docs.filter((d) => d.category === catId);
}

/**
 * ID로 문서 항목 검색
 * @param {string} id - 문서 고유 ID (예: 'sphere')
 * @returns {Object|undefined} 문서 객체 또는 undefined
 */
export function getDocById(id) {
  return docs.find((d) => d.id === id);
}

/**
 * 검색어로 문서를 검색하고 관련도 순으로 정렬
 * @param {string} query - 검색어
 * @param {string} locale - 'ko' 또는 'en'
 * @returns {Array} 관련도 점수가 높은 순으로 정렬된 문서 배열
 */
export function searchDocs(query, locale = 'ko') {
  if (!query || !query.trim()) return [];

  const tokens = query
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  const scored = docs.map((doc) => {
    let score = 0;

    const titleText = (doc.title[locale] || doc.title.en || '').toLowerCase();
    const descText = (doc.description[locale] || doc.description.en || '').toLowerCase();
    const sigText = (doc.signature || '').toLowerCase();
    const idText = doc.id.toLowerCase();

    for (const token of tokens) {
      // id 정확 일치: +10
      if (idText === token) score += 10;

      // title 포함: +10
      if (titleText.includes(token)) score += 10;

      // signature 포함: +8
      if (sigText.includes(token)) score += 8;

      // description 포함: +5
      if (descText.includes(token)) score += 5;

      // tags 정확 일치: +6
      if (doc.tags && doc.tags.some((t) => t.toLowerCase() === token)) score += 6;

      // params 이름 포함: +3
      if (doc.params && doc.params.some((p) => p.name.toLowerCase().includes(token))) score += 3;
    }

    return { ...doc, _score: score };
  });

  return scored
    .filter((d) => d._score > 0)
    .sort((a, b) => b._score - a._score);
}

export default docs;

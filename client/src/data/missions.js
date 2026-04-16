/**
 * VPyLab MVP 미션 데이터 (10개)
 *
 * 카테고리: CT(2) + CR(2) + MA(2) + SC(2) + AR(2)
 * 난이도: Lv.1~2
 *
 * 미션 구조:
 * - id: 카테고리-번호 (예: CT-1)
 * - category: CT | CR | MA | SC | AR | AI
 * - level: 1~4 (따라하기 | 변형하기 | 설계하기 | 창작하기)
 * - gradeType: 'A' (정적 검사) | 'B' (궤적 비교) | 'A+B' (복합)
 * - starterCode: 학생 시작 코드
 * - solutionCode: 모범 답안 (교사 전용)
 * - assertions: A등급 채점 조건
 * - referenceTrajectory: B등급 모범 궤적 (해당 시)
 * - hints: 단계별 힌트
 */

const missions = [
  // ═══════════════════════════════════════════
  // CT: Computational Thinking (컴퓨팅 사고)
  // ═══════════════════════════════════════════
  {
    id: 'CT-1',
    category: 'CT',
    level: 1,
    title: {
      ko: '첫 번째 구',
      en: 'Your First Sphere',
    },
    description: {
      ko: '빨간색 구를 만들어 보세요. VPyLab에서의 첫 3D 프로그래밍입니다!',
      en: 'Create a red sphere. Your first 3D programming in VPyLab!',
    },
    gradeType: 'A',
    starterCode: `from vpython import *

# 빨간색 구를 만들어 보세요
# sphere(color=color.red)
`,
    solutionCode: `from vpython import *

sphere(color=color.red)
`,
    assertions: [
      { type: 'sphere', property: 'color.r', operator: '==', value: 1 },
      { type: 'sphere', property: 'color.g', operator: '==', value: 0 },
      { type: 'sphere', property: 'color.b', operator: '==', value: 0 },
    ],
    hints: [
      { ko: 'sphere() 함수를 사용하면 구를 만들 수 있어요.', en: 'Use the sphere() function to create a sphere.' },
      { ko: '색상은 color.red, color.blue 등으로 지정합니다.', en: 'Colors are set with color.red, color.blue, etc.' },
    ],
  },

  {
    id: 'CT-2',
    category: 'CT',
    level: 1,
    title: {
      ko: '신호등 만들기',
      en: 'Traffic Light',
    },
    description: {
      ko: '빨강·노랑·초록 구 3개를 세로로 쌓아 신호등을 만드세요.',
      en: 'Stack 3 spheres (red, yellow, green) vertically to create a traffic light.',
    },
    gradeType: 'A',
    starterCode: `from vpython import *

# 빨간 구 (위)
sphere(pos=vector(0, 2, 0), color=color.red, radius=0.4)

# 노란 구 (가운데)
# 여기에 코드를 작성하세요

# 초록 구 (아래)
# 여기에 코드를 작성하세요
`,
    solutionCode: `from vpython import *

sphere(pos=vector(0, 2, 0), color=color.red, radius=0.4)
sphere(pos=vector(0, 1, 0), color=color.yellow, radius=0.4)
sphere(pos=vector(0, 0, 0), color=color.green, radius=0.4)
`,
    assertions: [
      { type: 'sphere', property: 'color.r', operator: '==', value: 1, index: 0 },
      { type: 'sphere', property: 'pos.y', operator: '==', value: 1, index: 1 },
      { type: 'sphere', property: 'color.g', operator: '==', value: 1, index: 2 },
    ],
    hints: [
      { ko: '각 구의 y 좌표를 다르게 설정하세요.', en: 'Set different y positions for each sphere.' },
      { ko: 'color.yellow, color.green을 사용하세요.', en: 'Use color.yellow and color.green.' },
    ],
  },

  {
    id: 'CT-3',
    category: 'CT',
    level: 2,
    title: {
      ko: '함수로 도형 찍기',
      en: 'Stamp Shapes with Functions',
    },
    description: {
      ko: '함수를 만들어 원하는 위치에 나무를 "찍는" 도장을 만드세요. def로 함수를 정의하면 코드를 재사용할 수 있습니다.',
      en: 'Create a function that "stamps" trees at any position. Use def to define reusable code.',
    },
    gradeType: 'A',
    starterCode: `from vpython import *

# 나무를 만드는 함수를 정의하세요
def 나무(x, z):
    # 줄기
    cylinder(pos=vector(x, 0, z), axis=vector(0, 2, 0), radius=0.2, color=color.orange)
    # 잎
    cone(pos=vector(x, 2, z), axis=vector(0, 2, 0), radius=1, color=color.green)

# 바닥
box(pos=vector(0, -0.1, 0), size=vector(20, 0.2, 20), color=vector(0.3, 0.6, 0.2))

# 함수를 호출하여 나무 3그루를 심으세요
나무(0, 0)      # 중앙
# 여기에 2그루 더 심으세요 (위치를 바꿔서)
`,
    solutionCode: `from vpython import *

def 나무(x, z):
    cylinder(pos=vector(x, 0, z), axis=vector(0, 2, 0), radius=0.2, color=color.orange)
    cone(pos=vector(x, 2, z), axis=vector(0, 2, 0), radius=1, color=color.green)

box(pos=vector(0, -0.1, 0), size=vector(20, 0.2, 20), color=vector(0.3, 0.6, 0.2))

나무(0, 0)
나무(-4, 3)
나무(5, -2)
`,
    assertions: [
      { type: 'cone', property: 'pos.y', operator: '==', value: 2, index: 0 },
      { type: 'cone', property: 'pos.y', operator: '==', value: 2, index: 2 },
      { type: 'cylinder', property: 'pos.x', operator: '!=', value: 0, index: 1 },
    ],
    hints: [
      { ko: '나무(-4, 3)처럼 x, z 좌표를 바꿔서 호출하세요.', en: 'Call 나무(-4, 3) with different x, z coordinates.' },
      { ko: 'def 함수이름(매개변수): 로 함수를 정의합니다.', en: 'Define functions with def name(params):' },
    ],
  },

  {
    id: 'CT-4',
    category: 'CT',
    level: 2,
    title: {
      ko: '함수로 색상 결정하기',
      en: 'Choose Colors with Functions',
    },
    description: {
      ko: '높이에 따라 색상을 반환하는 함수를 만들고, 20개의 구를 무지개 탑으로 쌓으세요.',
      en: 'Create a function that returns colors based on height, then stack 20 spheres as a rainbow tower.',
    },
    gradeType: 'A',
    starterCode: `from vpython import *

# 높이(y)에 따라 색상을 반환하는 함수
def 높이색상(y):
    if y < 3:
        return color.red
    elif y < 6:
        return color.yellow
    else:
        return color.cyan

# 20개 구를 쌓으세요
for i in range(20):
    y = i * 0.5
    c = 높이색상(y)
    # 여기에 sphere를 만드세요
`,
    solutionCode: `from vpython import *

def 높이색상(y):
    if y < 3:
        return color.red
    elif y < 6:
        return color.yellow
    else:
        return color.cyan

for i in range(20):
    y = i * 0.5
    c = 높이색상(y)
    sphere(pos=vector(0, y, 0), radius=0.3, color=c)
`,
    assertions: [
      { type: 'sphere', property: 'color.r', operator: '==', value: 1, index: 0 },
      { type: 'sphere', property: 'color.r', operator: '==', value: 1, index: 5 },
      { type: 'sphere', property: 'pos.y', operator: 'approx', value: 9.5, index: 19 },
    ],
    hints: [
      { ko: 'sphere(pos=vector(0, y, 0), color=c)로 구를 쌓으세요.', en: 'Stack with sphere(pos=vector(0, y, 0), color=c).' },
      { ko: 'c = 높이색상(y)로 함수를 호출하여 색상을 받습니다.', en: 'Call c = ��이색상(y) to get the color.' },
    ],
  },

  {
    id: 'CT-5',
    category: 'CT',
    level: 3,
    title: {
      ko: '파티클 폭죽',
      en: 'Particle Fireworks',
    },
    description: {
      ko: '랜덤 방향으로 50개의 파티클을 발사하고, 중력으로 떨어지게 만드세요. 리스트에 파티클을 저장하고 반복문으로 업데이트합니다.',
      en: 'Launch 50 particles in random directions, then let them fall with gravity. Store particles in a list and update with loops.',
    },
    gradeType: 'A',
    starterCode: `from vpython import *
import random

# 50개 파티클을 랜덤 방향으로 발사
particles = []
velocities = []

for i in range(50):
    # 랜덤 방향, 랜덤 색상
    vx = random.uniform(-3, 3)
    vy = random.uniform(3, 8)  # 위쪽으로
    vz = random.uniform(-3, 3)
    c = vector(random.random(), random.random(), random.random())

    p = sphere(pos=vector(0, 0, 0), radius=0.1, color=c, make_trail=True)
    particles.append(p)
    velocities.append(vector(vx, vy, vz))

# 애니메이션: 중력으로 떨어지기
g = vector(0, -9.8, 0)
dt = 0.02

for frame in range(150):
    rate(60)
    for i in range(len(particles)):
        # 여기에 속도/위치 업데이트 코드를 작성하세요
        # velocities[i] = velocities[i] + g * dt
        # particles[i].pos = particles[i].pos + velocities[i] * dt
        pass

효과음("fireball")
print("폭죽 완성!")
`,
    solutionCode: `from vpython import *
import random

particles = []
velocities = []

for i in range(50):
    vx = random.uniform(-3, 3)
    vy = random.uniform(3, 8)
    vz = random.uniform(-3, 3)
    c = vector(random.random(), random.random(), random.random())
    p = sphere(pos=vector(0, 0, 0), radius=0.1, color=c, make_trail=True)
    particles.append(p)
    velocities.append(vector(vx, vy, vz))

g = vector(0, -9.8, 0)
dt = 0.02

for frame in range(150):
    rate(60)
    for i in range(len(particles)):
        velocities[i] = velocities[i] + g * dt
        particles[i].pos = particles[i].pos + velocities[i] * dt

효과음("fireball")
print("폭죽 완성!")
`,
    assertions: [
      { type: 'sphere', property: 'pos.y', operator: '<', value: 0, index: 0 },
      { type: 'sphere', property: 'pos.y', operator: '<', value: 0, index: 49 },
    ],
    hints: [
      { ko: 'velocities[i] = velocities[i] + g * dt 로 속도를 업데이트합니다.', en: 'Update velocity: velocities[i] = velocities[i] + g * dt' },
      { ko: 'particles[i].pos = particles[i].pos + velocities[i] * dt 로 위치를 이동합니다.', en: 'Update position: particles[i].pos = particles[i].pos + velocities[i] * dt' },
      { ko: 'pass를 지우고 위 두 줄을 작성하세요.', en: 'Remove pass and write the two lines above.' },
    ],
  },

  // ═══════════════════════════════════════════
  // CR: Creative (창작)
  // ═══════════════════════════════════════════
  {
    id: 'CR-1',
    category: 'CR',
    level: 1,
    title: {
      ko: '눈사람 만들기',
      en: 'Build a Snowman',
    },
    description: {
      ko: '큰 구, 중간 구, 작은 구를 쌓아 눈사람을 만드세요.',
      en: 'Stack 3 white spheres of decreasing size to build a snowman.',
    },
    gradeType: 'A',
    starterCode: `from vpython import *

# 몸통 (가장 큰 구)
sphere(pos=vector(0, 0, 0), radius=1, color=color.white)

# 배 (중간 구)
# 여기에 코드를 작성하세요

# 머리 (가장 작은 구)
# 여기에 코드를 작성하세요
`,
    solutionCode: `from vpython import *

sphere(pos=vector(0, 0, 0), radius=1, color=color.white)
sphere(pos=vector(0, 1.3, 0), radius=0.7, color=color.white)
sphere(pos=vector(0, 2.2, 0), radius=0.4, color=color.white)
`,
    assertions: [
      // 구가 3개 이상 있어야 함
      { type: 'sphere', property: 'pos.y', operator: '>=', value: 0, index: 0 },
      { type: 'sphere', property: 'pos.y', operator: '>', value: 0, index: 1 },
      { type: 'sphere', property: 'pos.y', operator: '>', value: 1, index: 2 },
    ],
    hints: [
      { ko: '아래에서 위로 갈수록 y 값을 높이세요.', en: 'Increase y values from bottom to top.' },
      { ko: '위로 갈수록 radius를 줄이세요.', en: 'Decrease radius as you go up.' },
    ],
  },

  {
    id: 'CR-2',
    category: 'CR',
    level: 2,
    title: {
      ko: '로봇 만들기',
      en: 'Build a Robot',
    },
    description: {
      ko: 'box와 sphere, cylinder를 조합하여 간단한 로봇을 만드세요. 몸통, 머리, 팔이 있어야 합니다.',
      en: 'Combine box, sphere, and cylinder to build a simple robot with a body, head, and arms.',
    },
    gradeType: 'A',
    starterCode: `from vpython import *

# 몸통 (box)
box(pos=vector(0, 0, 0), size=vector(2, 3, 1), color=color.blue)

# 머리 (sphere)
# 여기에 코드를 작성하세요

# 왼팔 (cylinder)
# 여기에 코드를 작성하세요

# 오른팔 (cylinder)
# 여기에 코드를 작성하세요
`,
    solutionCode: `from vpython import *

box(pos=vector(0, 0, 0), size=vector(2, 3, 1), color=color.blue)
sphere(pos=vector(0, 2.2, 0), radius=0.6, color=color.gray)
cylinder(pos=vector(-1.5, 0.5, 0), axis=vector(-1, 0, 0), radius=0.2, color=color.red)
cylinder(pos=vector(1.5, 0.5, 0), axis=vector(1, 0, 0), radius=0.2, color=color.red)
`,
    assertions: [
      { type: 'box', property: 'pos.x', operator: '==', value: 0, index: 0 },
      { type: 'sphere', property: 'pos.y', operator: '>', value: 1, index: 0 },
      { type: 'cylinder', property: 'pos.x', operator: '!=', value: 0, index: 0 },
    ],
    hints: [
      { ko: 'sphere()로 머리를 몸통 위에 놓으세요.', en: 'Place a sphere head above the body.' },
      { ko: 'cylinder()의 axis로 팔의 방향을 정하세요.', en: 'Use cylinder axis to set arm direction.' },
    ],
  },

  {
    id: 'CR-3',
    category: 'CR',
    level: 2,
    title: {
      ko: '나무 만들기',
      en: 'Build a Tree',
    },
    description: {
      ko: 'cylinder로 줄기, cone으로 잎을 만들어 나무를 완성하세요.',
      en: 'Use cylinder for trunk and cone for leaves to build a tree.',
    },
    gradeType: 'A',
    starterCode: `from vpython import *

# 줄기 (cylinder)
cylinder(pos=vector(0, 0, 0), axis=vector(0, 3, 0), radius=0.3, color=color.orange)

# 잎 (cone) — 줄기 위에 올려주세요
# cone(pos=..., axis=..., radius=..., color=color.green)
`,
    solutionCode: `from vpython import *

cylinder(pos=vector(0, 0, 0), axis=vector(0, 3, 0), radius=0.3, color=color.orange)
cone(pos=vector(0, 3, 0), axis=vector(0, 3, 0), radius=1.5, color=color.green)
`,
    assertions: [
      { type: 'cylinder', property: 'pos.y', operator: '==', value: 0, index: 0 },
      { type: 'cone', property: 'pos.y', operator: '>=', value: 2, index: 0 },
      { type: 'cone', property: 'color.g', operator: '>', value: 0, index: 0 },
    ],
    hints: [
      { ko: 'cone(pos=vector(0, 3, 0))으로 줄기 위에 올리세요.', en: 'Place cone at pos=vector(0, 3, 0) above trunk.' },
      { ko: 'axis=vector(0, 3, 0)으로 위를 향하게 하세요.', en: 'Use axis=vector(0, 3, 0) pointing up.' },
    ],
  },

  {
    id: 'CR-4',
    category: 'CR',
    level: 2,
    title: {
      ko: '집 만들기',
      en: 'Build a House',
    },
    description: {
      ko: 'box로 벽, pyramid(cone)로 지붕, cylinder로 굴뚝을 만들어 집을 완성하세요.',
      en: 'Use box for walls, cone for roof, cylinder for chimney.',
    },
    gradeType: 'A',
    starterCode: `from vpython import *

# 벽 (box)
box(pos=vector(0, 1, 0), size=vector(4, 2, 3), color=color.white)

# 지붕 (cone) — 벽 위에
# 여기에 코드를 작성하세요

# 굴뚝 (cylinder) — 지붕 옆에
# 여기에 코드를 작성하세요

# 문 (box) — 벽 앞에 작은 box
box(pos=vector(0, 0.5, 1.51), size=vector(0.8, 1, 0.1), color=color.orange)
`,
    solutionCode: `from vpython import *

box(pos=vector(0, 1, 0), size=vector(4, 2, 3), color=color.white)
cone(pos=vector(0, 2, 0), axis=vector(0, 2, 0), radius=2.5, color=color.red)
cylinder(pos=vector(1.2, 2.5, -0.5), axis=vector(0, 1.5, 0), radius=0.2, color=color.gray)
box(pos=vector(0, 0.5, 1.51), size=vector(0.8, 1, 0.1), color=color.orange)
`,
    assertions: [
      { type: 'box', property: 'pos.y', operator: '==', value: 1, index: 0 },
      { type: 'cone', property: 'pos.y', operator: '>=', value: 2, index: 0 },
      { type: 'cylinder', property: 'pos.y', operator: '>', value: 2, index: 0 },
    ],
    hints: [
      { ko: 'cone(pos=vector(0, 2, 0))으로 벽 위에 지붕을 올리세요.', en: 'Place cone at y=2 for the roof.' },
      { ko: 'cylinder로 굴뚝을 지붕 옆에 세우세요.', en: 'Use cylinder for a chimney beside the roof.' },
    ],
  },

  {
    id: 'CR-5',
    category: 'CR',
    level: 3,
    title: {
      ko: '태양계 모형',
      en: 'Solar System Model',
    },
    description: {
      ko: '태양(노란 구)과 4개 행성을 만드세요. 각 행성은 태양으로부터 다른 거리에 놓이고, 크기와 색이 다릅니다.',
      en: 'Create a sun and 4 planets at different distances, each with unique size and color.',
    },
    gradeType: 'A',
    starterCode: `from vpython import *

# 태양
sphere(pos=vector(0, 0, 0), radius=1.5, color=color.yellow, emissive=True)

# 수성 — 작고 회색, 거리 3
# 여기에 코드를 작성하세요

# 금성 — 중간, 주황, 거리 5
# 여기에 코드를 작성하세요

# 지구 — 중간, 파랑+초록, 거리 7
# 여기에 코드를 작성하세요

# 화성 — 작고 빨강, 거리 9
# 여기에 코드를 작성하세요

# 궤도 링 (선택)
for r in [3, 5, 7, 9]:
    ring(pos=vector(0, 0, 0), axis=vector(0, 1, 0), radius=r, thickness=0.02, color=color.gray)
`,
    solutionCode: `from vpython import *

sphere(pos=vector(0, 0, 0), radius=1.5, color=color.yellow, emissive=True)
sphere(pos=vector(3, 0, 0), radius=0.3, color=color.gray)
sphere(pos=vector(5, 0, 0), radius=0.6, color=color.orange)
sphere(pos=vector(7, 0, 0), radius=0.65, color=color.cyan)
sphere(pos=vector(9, 0, 0), radius=0.4, color=color.red)

for r in [3, 5, 7, 9]:
    ring(pos=vector(0, 0, 0), axis=vector(0, 1, 0), radius=r, thickness=0.02, color=color.gray)
`,
    assertions: [
      { type: 'sphere', property: 'color.r', operator: '==', value: 1, index: 0 },
      { type: 'sphere', property: 'pos.x', operator: '==', value: 3, index: 1 },
      { type: 'sphere', property: 'pos.x', operator: '==', value: 9, index: 4 },
    ],
    hints: [
      { ko: '각 행성을 sphere(pos=vector(거리, 0, 0))로 만드세요.', en: 'Create each planet with sphere(pos=vector(dist, 0, 0)).' },
      { ko: '태양은 emissive=True로 빛나게 합니다.', en: 'Use emissive=True for the glowing sun.' },
    ],
  },

  // ═══════════════════════════════════════════
  // MA: Mathematics (수학)
  // ═══════════════════════════════════════════
  {
    id: 'MA-1',
    category: 'MA',
    level: 1,
    title: {
      ko: '3D 보물찾기',
      en: '3D Treasure Hunt',
    },
    description: {
      ko: '보물 상자가 (3, 2, 1)에 숨어 있습니다. 빨간 구를 보물 위치로 이동시켜 찾으세요!',
      en: 'A treasure chest is hidden at (3, 2, 1). Move the red sphere to find it!',
    },
    gradeType: 'A',
    starterCode: `from vpython import *

# 보물 상자 (움직이지 마세요!)
box(pos=vector(3, 2, 1), size=vector(0.5, 0.5, 0.5), color=color.yellow)

# 탐색 구: 보물 위치 (3, 2, 1)로 옮기세요
# vector(x, y, z) → x: 오른쪽, y: 위, z: 앞
sphere(pos=vector(0, 0, 0), radius=0.3, color=color.red)
`,
    solutionCode: `from vpython import *

box(pos=vector(3, 2, 1), size=vector(0.5, 0.5, 0.5), color=color.yellow)
sphere(pos=vector(3, 2, 1), radius=0.3, color=color.red)
`,
    assertions: [
      { type: 'sphere', property: 'pos.x', operator: '==', value: 3 },
      { type: 'sphere', property: 'pos.y', operator: '==', value: 2 },
      { type: 'sphere', property: 'pos.z', operator: '==', value: 1 },
    ],
    hints: [
      { ko: 'vector(3, 2, 1)로 위치를 지정하세요.', en: 'Use vector(3, 2, 1) for position.' },
      { ko: 'x는 오른쪽, y는 위쪽, z는 앞쪽입니다.', en: 'x is right, y is up, z is forward.' },
    ],
  },

  {
    id: 'MA-2',
    category: 'MA',
    level: 2,
    title: {
      ko: '정다각형 꼭짓점',
      en: 'Regular Polygon Vertices',
    },
    description: {
      ko: '반복문을 사용하여 원 위에 6개의 구를 배치하세요. 정육각형의 꼭짓점입니다.',
      en: 'Use a loop to place 6 spheres on a circle, forming hexagon vertices.',
    },
    gradeType: 'A',
    starterCode: `from vpython import *
import math

# 반지름 3인 원 위에 6개의 구를 배치하세요
R = 3
N = 6

for i in range(N):
    angle = 2 * math.pi * i / N
    x = R * math.cos(angle)
    z = R * math.sin(angle)
    # 여기에 sphere를 만드세요
`,
    solutionCode: `from vpython import *
import math

R = 3
N = 6

for i in range(N):
    angle = 2 * math.pi * i / N
    x = R * math.cos(angle)
    z = R * math.sin(angle)
    sphere(pos=vector(x, 0, z), radius=0.3, color=color.yellow)
`,
    assertions: [
      // 첫 번째 구는 (3, 0, 0) 근처
      { type: 'sphere', property: 'pos.x', operator: 'approx', value: 3, index: 0 },
      // 6개 구가 존재 (5번 인덱스가 있는지)
      { type: 'sphere', property: 'pos.y', operator: '==', value: 0, index: 5 },
    ],
    hints: [
      { ko: 'sphere(pos=vector(x, 0, z))로 구를 생성하세요.', en: 'Create sphere with pos=vector(x, 0, z).' },
      { ko: 'cos과 sin을 사용하여 원 위의 좌표를 계산합니다.', en: 'Use cos and sin for circle coordinates.' },
    ],
  },

  {
    id: 'MA-3',
    category: 'MA',
    level: 2,
    title: {
      ko: '나선 계단',
      en: 'Spiral Staircase',
    },
    description: {
      ko: '삼각함수와 반복문으로 나선형 계단을 만드세요. 구가 나선을 따라 올라갑니다.',
      en: 'Use trigonometry and loops to create a spiral staircase of spheres.',
    },
    gradeType: 'A',
    starterCode: `from vpython import *
import math

# 나선 계단: 30개 구가 나선을 그리며 올라감
R = 3      # 나선 반지름
N = 30     # 구 개수

for i in range(N):
    angle = i * 0.4        # 점점 회전
    y = i * 0.3            # 점점 위로
    x = R * math.cos(angle)
    z = R * math.sin(angle)
    # 여기에 sphere를 만드세요
`,
    solutionCode: `from vpython import *
import math

R = 3
N = 30

for i in range(N):
    angle = i * 0.4
    y = i * 0.3
    x = R * math.cos(angle)
    z = R * math.sin(angle)
    sphere(pos=vector(x, y, z), radius=0.2, color=color.cyan)
`,
    assertions: [
      { type: 'sphere', property: 'pos.y', operator: '==', value: 0, index: 0 },
      { type: 'sphere', property: 'pos.y', operator: '>', value: 5, index: 29 },
    ],
    hints: [
      { ko: 'sphere(pos=vector(x, y, z))로 구를 만드세요.', en: 'Create sphere(pos=vector(x, y, z)).' },
      { ko: 'cos과 sin으로 원형 궤적, y로 높이를 올립니다.', en: 'cos/sin for circular path, y for height.' },
    ],
  },

  {
    id: 'MA-4',
    category: 'MA',
    level: 3,
    title: {
      ko: '3D 함수 그래프',
      en: '3D Function Graph',
    },
    description: {
      ko: 'z = sin(x) * cos(y) 함수를 3D 구슬 격자로 시각화하세요.',
      en: 'Visualize z = sin(x) * cos(y) as a 3D grid of spheres.',
    },
    gradeType: 'A',
    starterCode: `from vpython import *
import math

# z = sin(x) * cos(y) 시각화
# -3 <= x <= 3, -3 <= y <= 3 범위

for i in range(15):
    for j in range(15):
        x = -3 + i * 0.4
        y = -3 + j * 0.4
        z = math.sin(x) * math.cos(y)
        # 여기에 sphere를 만드세요
        # z 값에 따라 색상을 바꿔보세요
`,
    solutionCode: `from vpython import *
import math

for i in range(15):
    for j in range(15):
        x = -3 + i * 0.4
        y = -3 + j * 0.4
        z = math.sin(x) * math.cos(y)
        c = vector((z + 1) / 2, 0.3, (1 - z) / 2)
        sphere(pos=vector(x, z, y), radius=0.12, color=c)
`,
    assertions: [
      { type: 'sphere', property: 'pos.x', operator: 'approx', value: -3, index: 0 },
      { type: 'sphere', property: 'pos.x', operator: '>', value: 2, index: 224 },
    ],
    hints: [
      { ko: 'z 값을 y 축에 놓으면 입체적으로 보입니다.', en: 'Map z values to the y-axis for 3D effect.' },
      { ko: 'vector((z+1)/2, 0.3, (1-z)/2)로 높이에 따른 색상을 만드세요.', en: 'Use vector((z+1)/2, 0.3, (1-z)/2) for height-based color.' },
    ],
  },

  {
    id: 'MA-5',
    category: 'MA',
    level: 3,
    title: {
      ko: '피보나치 나선',
      en: 'Fibonacci Spiral',
    },
    description: {
      ko: '피보나치 수열의 비율(황금비)로 꽃잎 배치 패턴을 3D로 구현하세요.',
      en: 'Create a sunflower-like pattern using the golden ratio from the Fibonacci sequence.',
    },
    gradeType: 'A',
    starterCode: `from vpython import *
import math

# 해바라기 씨앗 패턴 (페르마 나선)
# 황금각 = 137.508도
golden_angle = 137.508 * math.pi / 180

for i in range(200):
    r = 0.3 * math.sqrt(i)  # 반지름: sqrt(i)에 비례
    theta = i * golden_angle  # 각도: 황금각만큼 회전
    x = r * math.cos(theta)
    z = r * math.sin(theta)
    # 여기에 sphere를 만드세요 (radius=0.1)
`,
    solutionCode: `from vpython import *
import math

golden_angle = 137.508 * math.pi / 180

for i in range(200):
    r = 0.3 * math.sqrt(i)
    theta = i * golden_angle
    x = r * math.cos(theta)
    z = r * math.sin(theta)
    sphere(pos=vector(x, 0, z), radius=0.1, color=color.yellow)
`,
    assertions: [
      { type: 'sphere', property: 'pos.x', operator: '==', value: 0, index: 0 },
      { type: 'sphere', property: 'pos.y', operator: '==', value: 0, index: 199 },
    ],
    hints: [
      { ko: 'sphere(pos=vector(x, 0, z), radius=0.1)로 씨앗을 배치하세요.', en: 'Place seeds with sphere(pos=vector(x, 0, z), radius=0.1).' },
      { ko: '황금각(137.508도)이 핵심입니다.', en: 'The golden angle (137.508 degrees) is the key.' },
    ],
  },

  // ═══════════════════════════════════════════
  // SC: Science (과학)
  // ═══════════════════════════════════════════
  {
    id: 'SC-1',
    category: 'SC',
    level: 1,
    title: {
      ko: '등속 직선 운동',
      en: 'Uniform Linear Motion',
    },
    description: {
      ko: '구를 오른쪽으로 일정한 속도로 이동시키세요. rate()를 사용하여 애니메이션합니다.',
      en: 'Move a sphere to the right at constant velocity using rate() for animation.',
    },
    gradeType: 'A+B',
    starterCode: `from vpython import *

ball = sphere(pos=vector(-5, 0, 0), color=color.red, radius=0.3)
v = vector(1, 0, 0)   # 속도: 오른쪽으로 1
dt = 0.01

while ball.pos.x < 5:
    rate(100)
    # 공의 위치를 업데이트하세요
    # ball.pos = ball.pos + v * dt
`,
    solutionCode: `from vpython import *

ball = sphere(pos=vector(-5, 0, 0), color=color.red, radius=0.3)
v = vector(1, 0, 0)
dt = 0.01

while ball.pos.x < 5:
    rate(100)
    ball.pos = ball.pos + v * dt
`,
    assertions: [
      { type: 'sphere', property: 'pos.x', operator: '>', value: 0 },
    ],
    referenceTrajectory: (() => {
      const t = [];
      for (let x = -5; x <= 5; x += 0.01) {
        t.push([x, 0, 0]);
      }
      return t;
    })(),
    hints: [
      { ko: 'ball.pos = ball.pos + v * dt 로 위치를 업데이트하세요.', en: 'Update position: ball.pos = ball.pos + v * dt' },
      { ko: 'rate(100)은 초당 100회 반복합니다.', en: 'rate(100) means 100 iterations per second.' },
    ],
  },

  {
    id: 'SC-2',
    category: 'SC',
    level: 2,
    title: {
      ko: '자유 낙하',
      en: 'Free Fall',
    },
    description: {
      ko: '중력 가속도 g=9.8로 공을 자유 낙하시키세요.',
      en: 'Drop a ball with gravitational acceleration g=9.8.',
    },
    gradeType: 'A+B',
    starterCode: `from vpython import *

ball = sphere(pos=vector(0, 10, 0), color=color.orange, radius=0.3)
v = vector(0, 0, 0)   # 초기 속도: 0
g = vector(0, -9.8, 0) # 중력 가속도
dt = 0.01

while ball.pos.y > 0:
    rate(100)
    # 속도와 위치를 업데이트하세요
    # v = v + g * dt
    # ball.pos = ball.pos + v * dt
`,
    solutionCode: `from vpython import *

ball = sphere(pos=vector(0, 10, 0), color=color.orange, radius=0.3)
v = vector(0, 0, 0)
g = vector(0, -9.8, 0)
dt = 0.01

while ball.pos.y > 0:
    rate(100)
    v = v + g * dt
    ball.pos = ball.pos + v * dt
`,
    assertions: [
      { type: 'sphere', property: 'pos.y', operator: '<', value: 5 },
    ],
    referenceTrajectory: (() => {
      const t = [];
      let y = 10, vy = 0;
      while (y > 0) {
        t.push([0, y, 0]);
        vy += -9.8 * 0.01;
        y += vy * 0.01;
      }
      return t;
    })(),
    hints: [
      { ko: '속도: v = v + g * dt', en: 'Velocity: v = v + g * dt' },
      { ko: '위치: ball.pos = ball.pos + v * dt', en: 'Position: ball.pos = ball.pos + v * dt' },
    ],
  },

  {
    id: 'SC-3',
    category: 'SC',
    level: 2,
    title: {
      ko: '포물선 운동',
      en: 'Projectile Motion',
    },
    description: {
      ko: '공을 45도 각도로 발사하여 포물선 운동을 시뮬레이션하세요.',
      en: 'Launch a ball at 45 degrees to simulate projectile motion.',
    },
    gradeType: 'A+B',
    starterCode: `from vpython import *
import math

# 바닥
box(pos=vector(0, -0.1, 0), size=vector(20, 0.2, 4), color=color.green)

ball = sphere(pos=vector(-8, 0, 0), color=color.red, radius=0.3, make_trail=True)

# 45도 발사, 초속 10
angle = 45 * math.pi / 180
speed = 10
vx = speed * math.cos(angle)
vy = speed * math.sin(angle)
v = vector(vx, vy, 0)
g = vector(0, -9.8, 0)
dt = 0.01

while ball.pos.y >= 0:
    rate(100)
    # 속도와 위치를 업데이트하세요
    # v = v + g * dt
    # ball.pos = ball.pos + v * dt
`,
    solutionCode: `from vpython import *
import math

box(pos=vector(0, -0.1, 0), size=vector(20, 0.2, 4), color=color.green)
ball = sphere(pos=vector(-8, 0, 0), color=color.red, radius=0.3, make_trail=True)

angle = 45 * math.pi / 180
speed = 10
vx = speed * math.cos(angle)
vy = speed * math.sin(angle)
v = vector(vx, vy, 0)
g = vector(0, -9.8, 0)
dt = 0.01

while ball.pos.y >= 0:
    rate(100)
    v = v + g * dt
    ball.pos = ball.pos + v * dt
`,
    assertions: [
      { type: 'sphere', property: 'pos.x', operator: '>', value: -5 },
      { type: 'sphere', property: 'pos.y', operator: '<=', value: 0 },
    ],
    referenceTrajectory: (() => {
      const t = [];
      let x = -8, y = 0, vx = 10 * Math.cos(Math.PI/4), vy = 10 * Math.sin(Math.PI/4);
      while (y >= 0 || t.length === 0) {
        t.push([x, y, 0]);
        vy += -9.8 * 0.01;
        x += vx * 0.01;
        y += vy * 0.01;
        if (t.length > 2000) break;
      }
      return t;
    })(),
    hints: [
      { ko: 'v = v + g * dt, ball.pos = ball.pos + v * dt', en: 'v = v + g * dt, ball.pos = ball.pos + v * dt' },
      { ko: 'make_trail=True로 궤적을 볼 수 있어요.', en: 'make_trail=True shows the path.' },
    ],
  },

  {
    id: 'SC-4',
    category: 'SC',
    level: 2,
    title: {
      ko: '용수철 진동',
      en: 'Spring Oscillation',
    },
    description: {
      ko: '훅의 법칙(F = -kx)으로 용수철에 매달린 공의 진동을 시뮬레이션하세요.',
      en: "Simulate spring oscillation using Hooke's law (F = -kx).",
    },
    gradeType: 'A+B',
    starterCode: `from vpython import *

# 고정점
box(pos=vector(0, 5, 0), size=vector(2, 0.2, 2), color=color.gray)

ball = sphere(pos=vector(0, 2, 0), radius=0.4, color=color.red)
spring = cylinder(pos=vector(0, 5, 0), axis=vector(0, -3, 0), radius=0.05, color=color.yellow)

v = vector(0, 0, 0)
rest_y = 3  # 평형 위치
k = 10      # 용수철 상수
m = 1       # 질량
dt = 0.01

for i in range(500):
    rate(100)
    # 훅의 법칙: F = -k * (y - rest_y)
    displacement = ball.pos.y - rest_y
    F = vector(0, -k * displacement, 0)
    # 여기에 가속도, 속도, 위치를 업데이트하세요
    # a = F / m
    # v = v + a * dt
    # ball.pos = ball.pos + v * dt

    # 용수철 연결 업데이트
    spring.axis = ball.pos - vector(0, 5, 0)
`,
    solutionCode: `from vpython import *

box(pos=vector(0, 5, 0), size=vector(2, 0.2, 2), color=color.gray)
ball = sphere(pos=vector(0, 2, 0), radius=0.4, color=color.red)
spring = cylinder(pos=vector(0, 5, 0), axis=vector(0, -3, 0), radius=0.05, color=color.yellow)

v = vector(0, 0, 0)
rest_y = 3
k = 10
m = 1
dt = 0.01

for i in range(500):
    rate(100)
    displacement = ball.pos.y - rest_y
    F = vector(0, -k * displacement, 0)
    a = F / m
    v = v + a * dt
    ball.pos = ball.pos + v * dt
    spring.axis = ball.pos - vector(0, 5, 0)
`,
    assertions: [
      { type: 'sphere', property: 'pos.y', operator: '<', value: 3 },
    ],
    referenceTrajectory: (() => {
      const t = [];
      let y = 2, vy = 0;
      for (let i = 0; i < 500; i++) {
        t.push([0, y, 0]);
        const F = -10 * (y - 3);
        vy += F * 0.01;
        y += vy * 0.01;
      }
      return t;
    })(),
    hints: [
      { ko: 'a = F / m, v = v + a * dt, ball.pos = ball.pos + v * dt', en: 'a = F/m, v = v + a*dt, pos = pos + v*dt' },
      { ko: '변위 = 현재 위치 - 평형 위치', en: 'displacement = current position - equilibrium' },
    ],
  },

  {
    id: 'SC-5',
    category: 'SC',
    level: 3,
    title: {
      ko: '행성 공전',
      en: 'Planetary Orbit',
    },
    description: {
      ko: '만유인력으로 행성이 태양 주위를 공전하는 시뮬레이션을 만드세요.',
      en: 'Simulate a planet orbiting a star using gravitational force.',
    },
    gradeType: 'A+B',
    starterCode: `from vpython import *

# 태양
sun = sphere(pos=vector(0, 0, 0), radius=0.5, color=color.yellow, emissive=True)

# 행성 (원궤도 초기조건)
planet = sphere(pos=vector(5, 0, 0), radius=0.2, color=color.cyan, make_trail=True)
v = vector(0, 0, 1.4)  # 초기 속도 (접선 방향)

G = 10  # 중력 상수 (간소화)
M = 10  # 태양 질량
dt = 0.01

for i in range(2000):
    rate(200)
    # 태양→행성 방향 벡터
    r_vec = planet.pos - sun.pos
    r = r_vec.mag  # 거리
    # 만유인력: F = -G*M / r^2 방향
    F = -G * M / (r * r) * (r_vec / r)
    # 여기에 속도와 위치를 업데이트하세요
    # v = v + F * dt
    # planet.pos = planet.pos + v * dt
`,
    solutionCode: `from vpython import *

sun = sphere(pos=vector(0, 0, 0), radius=0.5, color=color.yellow, emissive=True)
planet = sphere(pos=vector(5, 0, 0), radius=0.2, color=color.cyan, make_trail=True)
v = vector(0, 0, 1.4)

G = 10
M = 10
dt = 0.01

for i in range(2000):
    rate(200)
    r_vec = planet.pos - sun.pos
    r = r_vec.mag
    F = -G * M / (r * r) * (r_vec / r)
    v = v + F * dt
    planet.pos = planet.pos + v * dt
`,
    assertions: [
      { type: 'sphere', property: 'pos.x', operator: '!=', value: 5, index: 1 },
    ],
    referenceTrajectory: (() => {
      const t = [];
      let px = 5, py = 0, pz = 0, vx = 0, vy = 0, vz = 1.4;
      for (let i = 0; i < 2000; i++) {
        if (i % 5 === 0) t.push([px, py, pz]);
        const r = Math.sqrt(px*px + py*py + pz*pz);
        const F = -10 * 10 / (r * r);
        const fx = F * px / r, fy = F * py / r, fz = F * pz / r;
        vx += fx * 0.01; vy += fy * 0.01; vz += fz * 0.01;
        px += vx * 0.01; py += vy * 0.01; pz += vz * 0.01;
      }
      return t;
    })(),
    hints: [
      { ko: 'v = v + F * dt, planet.pos = planet.pos + v * dt', en: 'v = v + F * dt, planet.pos = planet.pos + v * dt' },
      { ko: 'r_vec.mag는 거리, r_vec/r은 단위벡터입니다.', en: 'r_vec.mag is distance, r_vec/r is unit vector.' },
    ],
  },

  // ═══════════════════════════════════════════
  // AR: Art (예술)
  // ═══════════════════════════════════════════
  {
    id: 'AR-1',
    category: 'AR',
    level: 1,
    title: {
      ko: '무지개 구슬',
      en: 'Rainbow Beads',
    },
    description: {
      ko: '7개의 구를 일렬로 놓고 무지개 색상을 입히세요.',
      en: 'Place 7 spheres in a row and color them with rainbow colors.',
    },
    gradeType: 'A',
    starterCode: `from vpython import *

# 무지개 7색
colors = [color.red, color.orange, color.yellow, color.green,
          color.cyan, color.blue, color.purple]

# 7개의 구를 x = -3 ~ 3에 배치하세요
for i in range(7):
    x = -3 + i
    # 여기에 sphere를 만드세요
`,
    solutionCode: `from vpython import *

colors = [color.red, color.orange, color.yellow, color.green,
          color.cyan, color.blue, color.purple]

for i in range(7):
    x = -3 + i
    sphere(pos=vector(x, 0, 0), radius=0.4, color=colors[i])
`,
    assertions: [
      { type: 'sphere', property: 'pos.x', operator: '==', value: -3, index: 0 },
      { type: 'sphere', property: 'color.r', operator: '==', value: 1, index: 0 },
      { type: 'sphere', property: 'pos.x', operator: '==', value: 3, index: 6 },
    ],
    hints: [
      { ko: 'sphere(pos=vector(x, 0, 0), color=colors[i])', en: 'sphere(pos=vector(x, 0, 0), color=colors[i])' },
      { ko: '인덱스 i로 색상을 선택하세요.', en: 'Use index i to pick the color.' },
    ],
  },

  {
    id: 'AR-2',
    category: 'AR',
    level: 2,
    title: {
      ko: '정육면체 꼭짓점',
      en: 'Cube Vertices',
    },
    description: {
      ko: '8개의 구를 리스트에 저장하여 정육면체 꼭짓점을 완성하세요. 리스트와 반복문을 함께 사용합니다.',
      en: 'Store 8 spheres in a list to form cube vertices. Practice using lists with loops.',
    },
    gradeType: 'A',
    starterCode: `from vpython import *
import math

# 정육면체 8개 꼭짓점 좌표
vertices = [
    vector(-1, -1, -1), vector(1, -1, -1),
    vector(-1, 1, -1),  vector(1, 1, -1),
    vector(-1, -1, 1),  vector(1, -1, 1),
    vector(-1, 1, 1),   vector(1, 1, 1),
]

# 각 꼭짓점에 구를 만드세요
balls = []
for v in vertices:
    # 여기에 코드를 작성하세요
    pass
`,
    solutionCode: `from vpython import *
import math

vertices = [
    vector(-1, -1, -1), vector(1, -1, -1),
    vector(-1, 1, -1),  vector(1, 1, -1),
    vector(-1, -1, 1),  vector(1, -1, 1),
    vector(-1, 1, 1),   vector(1, 1, 1),
]

balls = []
for v in vertices:
    b = sphere(pos=v, radius=0.2, color=color.cyan)
    balls.append(b)
`,
    assertions: [
      { type: 'sphere', property: 'pos.x', operator: '==', value: -1, index: 0 },
      { type: 'sphere', property: 'pos.x', operator: '==', value: 1, index: 7 },
      // 8개 구가 존재
      { type: 'sphere', property: 'pos.y', operator: '==', value: 1, index: 7 },
    ],
    hints: [
      { ko: 'sphere(pos=v, radius=0.2)로 각 꼭짓점에 구를 만드세요.', en: 'Create sphere(pos=v, radius=0.2) at each vertex.' },
      { ko: 'balls.append(b)로 리스트에 저장하세요.', en: 'Store in list with balls.append(b).' },
    ],
  },
  {
    id: 'AR-4',
    category: 'AR',
    level: 2,
    title: {
      ko: '별이 빛나는 밤',
      en: 'Starry Night',
    },
    description: {
      ko: '랜덤 위치에 200개의 작은 구를 배치하여 별이 빛나는 밤하늘을 만드세요.',
      en: 'Place 200 small spheres at random positions to create a starry night sky.',
    },
    gradeType: 'A',
    starterCode: `from vpython import *
import random

# 배경을 검정으로
scene_background(색상['검정'])

# 200개 별 만들기
for i in range(200):
    x = random.uniform(-10, 10)
    y = random.uniform(0, 10)
    z = random.uniform(-10, 10)
    크기 = random.uniform(0.02, 0.1)
    밝기 = random.uniform(0.5, 1.0)
    # 여기에 sphere를 만드세요
    # emissive=True로 빛나게 하세요
`,
    solutionCode: `from vpython import *
import random

scene_background(색상['검정'])

for i in range(200):
    x = random.uniform(-10, 10)
    y = random.uniform(0, 10)
    z = random.uniform(-10, 10)
    크기 = random.uniform(0.02, 0.1)
    밝기 = random.uniform(0.5, 1.0)
    sphere(pos=vector(x, y, z), radius=크기, color=vector(밝기, 밝기, 밝기), emissive=True)
`,
    assertions: [
      { type: 'sphere', property: 'pos.y', operator: '>=', value: 0, index: 0 },
      { type: 'sphere', property: 'pos.y', operator: '>=', value: 0, index: 199 },
    ],
    hints: [
      { ko: 'sphere(pos=vector(x,y,z), radius=크기, emissive=True)', en: 'sphere(pos=vector(x,y,z), radius=size, emissive=True)' },
      { ko: 'color=vector(밝기,밝기,밝기)로 밝기를 조절하세요.', en: 'Use color=vector(b,b,b) to vary brightness.' },
    ],
  },

  {
    id: 'AR-5',
    category: 'AR',
    level: 3,
    title: {
      ko: 'DNA 이중나선',
      en: 'DNA Double Helix',
    },
    description: {
      ko: '두 개의 나선을 만들고 가로대로 연결하여 DNA 이중나선 구조를 시각화하세요.',
      en: 'Create two helices connected by rungs to visualize a DNA double helix.',
    },
    gradeType: 'A',
    starterCode: `from vpython import *
import math

# DNA 이중나선
N = 40  # 점 개수

for i in range(N):
    t = i * 0.3
    y = i * 0.3 - 6

    # 나선 1
    x1 = 1.5 * math.cos(t)
    z1 = 1.5 * math.sin(t)
    sphere(pos=vector(x1, y, z1), radius=0.15, color=color.cyan)

    # 나선 2 (180도 반대편)
    x2 = 1.5 * math.cos(t + math.pi)
    z2 = 1.5 * math.sin(t + math.pi)
    sphere(pos=vector(x2, y, z2), radius=0.15, color=color.orange)

    # 5개마다 가로대(cylinder)로 연결
    if i % 5 == 0:
        pass  # 여기에 cylinder를 만드세요
        # cylinder(pos=vector(x1, y, z1), axis=vector(x2-x1, 0, z2-z1), radius=0.05, color=color.white)
`,
    solutionCode: `from vpython import *
import math

N = 40
for i in range(N):
    t = i * 0.3
    y = i * 0.3 - 6
    x1 = 1.5 * math.cos(t)
    z1 = 1.5 * math.sin(t)
    sphere(pos=vector(x1, y, z1), radius=0.15, color=color.cyan)
    x2 = 1.5 * math.cos(t + math.pi)
    z2 = 1.5 * math.sin(t + math.pi)
    sphere(pos=vector(x2, y, z2), radius=0.15, color=color.orange)
    if i % 5 == 0:
        cylinder(pos=vector(x1, y, z1), axis=vector(x2-x1, 0, z2-z1), radius=0.05, color=color.white)
`,
    assertions: [
      { type: 'sphere', property: 'pos.y', operator: '<', value: -5, index: 0 },
      { type: 'cylinder', property: 'pos.y', operator: '<', value: 0, index: 0 },
    ],
    hints: [
      { ko: 'cylinder(pos=..., axis=vector(x2-x1, 0, z2-z1))로 연결하세요.', en: 'Connect with cylinder(pos=..., axis=vector(x2-x1, 0, z2-z1)).' },
      { ko: 'cos(t + pi)는 180도 반대편입니다.', en: 'cos(t + pi) is the opposite side.' },
    ],
  },

  // ═══════════════════════════════════════════
  // SN: Sound (사운드)
  // ═══════════════════════════════════════════
  {
    id: 'SN-1',
    category: 'SN',
    level: 1,
    title: {
      ko: '첫 번째 소리',
      en: 'Your First Sound',
    },
    description: {
      ko: 'sound() 또는 음표()를 사용하여 도-미-솔 3개 음을 차례로 재생하세요.',
      en: 'Use sound() to play 3 sounds (Do-Mi-Sol) in sequence.',
    },
    gradeType: 'notes',
    expectedNotes: ['C4', 'E4', 'G4'],
    starterCode: `from vpython import *

# sound(주파수, 길이) — 소리 재생
# 음표("노트이름", 길이) — 노트 이름으로 재생
# 한글도 됩니다: 음표("도4", 0.5)

# 도(C4)를 재생하세요
음표("도4", 0.5)

# 미(E4)를 재생하세요
# 여기에 코드를 작성하세요

# 솔(G4)를 재생하세요
# 여기에 코드를 작성하세요

print("도-미-솔 완성!")
`,
    solutionCode: `from vpython import *

음표("도4", 0.5)
음표("미4", 0.5)
음표("솔4", 0.5)

print("도-미-솔 완성!")
`,
    assertions: [],
    hints: [
      { ko: '음표("미4", 0.5) 로 미를 재생하세요.', en: 'Use play_note("E4", 0.5) for E4.' },
      { ko: '영어 이름도 가능해요: play_note("G4", 0.5)', en: 'English names work too: play_note("G4", 0.5).' },
    ],
  },

  {
    id: 'SN-2',
    category: 'SN',
    level: 1,
    title: {
      ko: '게임 효과음 탐험',
      en: 'Game SFX Explorer',
    },
    description: {
      ko: '효과음()으로 다양한 게임 효과음을 재생해 보세요. 점프, 코인, 파워업, 폭발 등!',
      en: 'Explore game sound effects with sfx(): jump, coin, powerup, explosion!',
    },
    gradeType: 'code',
    codeChecks: [
      { pattern: '효과음\\s*\\(|sfx\\s*\\(', minCount: 3, message: '효과음()을 3종류 이상 사용하세요' },
    ],
    starterCode: `from vpython import *

# 효과음(이름) 또는 sfx(이름) — 게임 효과음 재생
# 사용 가능: jump, coin, powerup, death,
#            fireball, pipe, 1up, select,
#            warning, explosion, laser,
#            success, error, levelup

# 점프 효과음
효과음("jump")

# 코인 효과음 재생 후 잠시 대기
sleep(0.3)
# 여기에 코인 효과음 코드를 작성하세요

# 파워업 효과음
sleep(0.5)
# 여기에 파워업 효과음 코드를 작성하세요

# 나만의 효과음 조합을 만들어 보세요!
sleep(0.5)
# 여기에 자유롭게 효과음을 추가하세요

print("효과음 탐험 완료!")
`,
    solutionCode: `from vpython import *

효과음("jump")
sleep(0.3)
효과음("coin")
sleep(0.5)
효과음("powerup")
sleep(0.5)
효과음("explosion")

print("효과음 탐험 완료!")
`,
    assertions: [],
    hints: [
      { ko: '효과음("coin")으로 코인 효과음을 재생하세요.', en: 'Use sfx("coin") for coin sound.' },
      { ko: 'sleep(0.5)로 효과음 사이에 간격을 주세요.', en: 'Use sleep(0.5) to add delay between sounds.' },
    ],
  },

  {
    id: 'SN-3',
    category: 'SN',
    level: 2,
    title: {
      ko: '학교 종이 땡땡땡',
      en: 'School Bell Melody',
    },
    description: {
      ko: '음표()를 사용하여 "학교 종이 땡땡땡" 멜로디를 연주하세요. 한글 노트 이름을 사용합니다!',
      en: 'Play the melody of a school bell song using play_note().',
    },
    gradeType: 'notes',
    expectedNotes: [
      'G4', 'G4', 'A4', 'A4', 'G4', 'G4', 'E4',
      'G4', 'G4', 'E4', 'E4', 'D4', 'D4', 'C4',
    ],
    starterCode: `from vpython import *

# 음표("노트이름", 길이) — 한글 노트 이름 지원!
# 도레미파솔라시 + 옥타브 번호
# 예: 음표("도4", 0.4), 음표("솔#5", 0.3)

# "학교 종이 땡땡땡" 멜로디
# 솔 솔 라 라 | 솔 솔 미 |
음표("솔4", 0.4)
음표("솔4", 0.4)
음표("라4", 0.4)
음표("라4", 0.4)
음표("솔4", 0.4)
음표("솔4", 0.4)
음표("미4", 0.8)

# 솔 솔 미 미 | 레 레 도 |
# 여기에 이어서 작성하세요

print("멜로디 연주 완료!")
`,
    solutionCode: `from vpython import *

# 솔 솔 라 라 | 솔 솔 미 |
음표("솔4", 0.4)
음표("솔4", 0.4)
음표("라4", 0.4)
음표("라4", 0.4)
음표("솔4", 0.4)
음표("솔4", 0.4)
음표("미4", 0.8)

# 솔 솔 미 미 | 레 레 도 |
음표("솔4", 0.4)
음표("솔4", 0.4)
음표("미4", 0.4)
음표("미4", 0.4)
음표("레4", 0.4)
음표("레4", 0.4)
음표("도4", 0.8)

print("멜로디 연주 완료!")
`,
    assertions: [],
    hints: [
      { ko: '음표("솔4", 0.4)로 솔을 연주하세요.', en: 'Use play_note("G4", 0.4) for G note.' },
      { ko: '영어도 가능: play_note("G4", 0.4)', en: 'English: play_note("G4", 0.4).' },
    ],
  },

  {
    id: 'SN-4',
    category: 'SN',
    level: 2,
    title: {
      ko: '3D 피아노',
      en: '3D Piano',
    },
    description: {
      ko: '3D 건반을 만들고, 각 건반 위치에서 소리를 재생하는 시각화를 만드세요.',
      en: 'Create 3D piano keys and play sounds at each key position.',
    },
    gradeType: 'code',
    starterCode: `from vpython import *

# 흰 건반 7개 (도레미파솔라시)
notes_freq = [note.C4, note.D4, note.E4, note.F4, note.G4, note.A4, note.B4]
colors_list = [color.red, color.orange, color.yellow, color.green,
               color.cyan, color.blue, color.purple]

for i in range(7):
    # 건반 상자 만들기
    key = box(
        pos=vector(i * 1.2 - 3.6, 0, 0),
        size=vector(1, 0.3, 2),
        color=colors_list[i]
    )
    # 각 건반의 소리를 재생하세요
    sound(notes_freq[i], 0.4)
    sleep(0.2)

# 마지막에 도-미-솔 화음을 연주하세요
sleep(0.5)
# 화음([note.C4, note.E4, note.G4], 1.0)
# 위 줄의 주석을 해제하세요

print("3D 피아노 완성!")
`,
    solutionCode: `from vpython import *

notes_freq = [note.C4, note.D4, note.E4, note.F4, note.G4, note.A4, note.B4]
colors_list = [color.red, color.orange, color.yellow, color.green,
               color.cyan, color.blue, color.purple]

for i in range(7):
    key = box(
        pos=vector(i * 1.2 - 3.6, 0, 0),
        size=vector(1, 0.3, 2),
        color=colors_list[i]
    )
    sound(notes_freq[i], 0.4)
    sleep(0.2)

sleep(0.5)
화음([note.C4, note.E4, note.G4], 1.0)

print("3D 피아노 완성!")
`,
    codeChecks: [
      { pattern: '화음\\s*\\(|chord\\s*\\(', minCount: 1, message: '화음()을 사용하여 도-미-솔 화음을 연주하세요' },
      { pattern: 'sound\\s*\\(|음표\\s*\\(', minCount: 3, message: '3개 이상의 음을 재생하세요' },
    ],
    hints: [
      { ko: 'note.C4, note.D4 등으로 주파수 상수를 사용하세요.', en: 'Use note.C4, note.D4 etc. for frequency constants.' },
      { ko: '화음([note.C4, note.E4, note.G4], 1.0)으로 화음을 연주하세요.', en: 'Use chord([note.C4, note.E4, note.G4], 1.0) for chords.' },
    ],
  },

  {
    id: 'SN-5',
    category: 'SN',
    level: 3,
    title: {
      ko: '움직이는 공 + BGM',
      en: 'Bouncing Ball + BGM',
    },
    description: {
      ko: '공이 바닥에 튈 때마다 효과음이 나고, BGM이 흐르는 시뮬레이션을 만드세요.',
      en: 'Create a bouncing ball simulation with sound effects on each bounce and BGM.',
    },
    gradeType: 'A+B',
    starterCode: `from vpython import *

# 배경음악(이름) 또는 bgm(이름) — BGM 시작
# 사용 가능: adventure, explore, battle, peaceful, victory
배경음악("adventure")

# 바닥
box(pos=vector(0, -5, 0), size=vector(10, 0.2, 4), color=color.green)

ball = sphere(pos=vector(0, 5, 0), color=color.red, radius=0.4)
v = vector(0, 0, 0)
g = vector(0, -9.8, 0)
dt = 0.01

while True:
    rate(100)
    v = v + g * dt
    ball.pos = ball.pos + v * dt

    # 바닥에 닿으면 튕기기 + 효과음
    if ball.pos.y < -4.5:
        ball.pos = vector(ball.pos.x, -4.5, ball.pos.z)
        v = vector(v.x, -v.y * 0.8, v.z)  # 반발 계수 0.8
        # 여기에 바운스 효과음을 추가하세요
        # 효과음("jump")

    # 속도가 거의 0이면 종료
    if abs(v.y) < 0.1 and ball.pos.y < -4.3:
        break

# 코드가 끝나면 BGM은 자동으로 멈춥니다
효과음("success")
print("시뮬레이션 완료!")
`,
    solutionCode: `from vpython import *

배경음악("adventure")

box(pos=vector(0, -5, 0), size=vector(10, 0.2, 4), color=color.green)

ball = sphere(pos=vector(0, 5, 0), color=color.red, radius=0.4)
v = vector(0, 0, 0)
g = vector(0, -9.8, 0)
dt = 0.01

while True:
    rate(100)
    v = v + g * dt
    ball.pos = ball.pos + v * dt

    if ball.pos.y < -4.5:
        ball.pos = vector(ball.pos.x, -4.5, ball.pos.z)
        v = vector(v.x, -v.y * 0.8, v.z)
        효과음("jump")

    if abs(v.y) < 0.1 and ball.pos.y < -4.3:
        break

효과음("success")
print("시뮬레이션 완료!")
`,
    codeChecks: [
      { pattern: '효과음\\s*\\(|sfx\\s*\\(', minCount: 1, message: '바운스 시 효과음()을 추가하세요' },
    ],
    assertions: [
      { type: 'sphere', property: 'pos.y', operator: '<', value: 0 },
      { type: 'box', property: 'pos.y', operator: '==', value: -5, index: 0 },
    ],
    targetObjectId: 'obj_2',
    referenceTrajectory: (() => {
      const t = [];
      let y = 5, vy = 0;
      for (let i = 0; i < 500; i++) {
        vy += -9.8 * 0.01;
        y += vy * 0.01;
        if (y < -4.5) {
          y = -4.5;
          vy = -vy * 0.8;
        }
        t.push([0, y, 0]);
        if (Math.abs(vy) < 0.1 && y < -4.3) break;
      }
      return t;
    })(),
    hints: [
      { ko: '효과음("jump")을 바운스 조건 안에 넣으세요.', en: 'Put sfx("jump") inside the bounce condition.' },
      { ko: '배경음악("adventure")로 BGM을 시작하세요.', en: 'Start BGM with bgm("adventure").' },
      { ko: '코드가 끝나면 BGM은 자동으로 멈춥니다.', en: 'BGM stops automatically when code finishes.' },
    ],
  },

  // ═══════════════════════════════════════════
  // AR: Art — 미디어아트 예제
  // ═══════════════════════════════════════════
  {
    id: 'AR-3',
    category: 'AR',
    level: 3,
    title: {
      ko: '음악 파동 시각화',
      en: 'Music Wave Visualization',
    },
    description: {
      ko: '음계를 연주하면서 3D 표면이 파동으로 변하는 미디어아트를 만드세요.',
      en: 'Create media art where a 3D surface ripples as musical notes play.',
    },
    gradeType: 'run',
    starterCode: `from vpython import *
import math

# === 음악 파동 시각화 ===
# 음계를 연주하면서 3D 구슬들이 파동으로 춤춥니다!
# 이미 완성된 코드입니다. 숫자를 바꿔서 파동을 변형해보세요!

배경음악("peaceful")
scene_background(색상['검정'])

# 파동 표면 생성 (구슬 격자)
크기 = 12
구슬들 = []
for i in range(크기):
    행 = []
    for j in range(크기):
        x = (i - 크기/2) * 0.8
        z = (j - 크기/2) * 0.8
        s = sphere(
            pos=vector(x, 0, z),
            radius=0.15,
            color=무지개[i % 7],
            opacity=0.8
        )
        행.append(s)
    구슬들.append(행)

# 음계와 시간에 따라 파동 애니메이션
t = 0
notes = [음계['도'], 음계['레'], 음계['미'], 음계['파'],
         음계['솔'], 음계['라'], 음계['시']]

for 반복 in range(7):
    # 음 재생
    sound(notes[반복], 0.4, 'triangle')

    # 30프레임 동안 파동 업데이트
    for f in range(30):
        rate(60)
        t += 0.1
        for i in range(크기):
            for j in range(크기):
                x = (i - 크기/2) * 0.8
                z = (j - 크기/2) * 0.8
                # 파동 함수: 중심에서 퍼지는 원형 파동
                거리 = math.sqrt(x*x + z*z)
                y = math.sin(거리 * 2 - t * 3) * 0.5 * math.exp(-거리 * 0.15)
                구슬들[i][j].pos = vector(x, y, z)
                # 높이에 따라 색상 변화
                밝기 = (y + 0.5) / 1.0
                구슬들[i][j].color = 무지개[반복]
                구슬들[i][j].opacity = 0.5 + 밝기 * 0.5

효과음("success")
print("음악 파동 시각화 완료!")
`,
    solutionCode: `from vpython import *
import math

배경음악("peaceful")
scene_background(색상['검정'])

크기 = 12
구슬들 = []
for i in range(크기):
    행 = []
    for j in range(크기):
        x = (i - 크기/2) * 0.8
        z = (j - 크기/2) * 0.8
        s = sphere(pos=vector(x, 0, z), radius=0.15, color=무지개[i % 7], opacity=0.8)
        행.append(s)
    구슬들.append(행)

t = 0
notes = [음계['도'], 음계['레'], 음계['미'], 음계['파'], 음계['솔'], 음계['라'], 음계['시']]

for 반복 in range(7):
    sound(notes[반복], 0.4, 'triangle')
    for f in range(30):
        rate(60)
        t += 0.1
        for i in range(크기):
            for j in range(크기):
                x = (i - 크기/2) * 0.8
                z = (j - 크기/2) * 0.8
                거리 = math.sqrt(x*x + z*z)
                y = math.sin(거리 * 2 - t * 3) * 0.5 * math.exp(-거리 * 0.15)
                구슬들[i][j].pos = vector(x, y, z)
                구슬들[i][j].color = 무지개[반복]
                구슬들[i][j].opacity = 0.5 + (y + 0.5) / 1.0 * 0.5

효과음("success")
print("음악 파동 시각화 완료!")
`,
    assertions: [
      { type: 'sphere', property: 'pos.y', operator: '!=', value: 0, index: 0 },
    ],
    hints: [
      { ko: 'math.sin(거리 - t)로 시간에 따른 파동을 만드세요.', en: 'Use math.sin(distance - t) for time-dependent waves.' },
      { ko: '구슬의 color와 opacity를 높이(y)에 따라 변경하면 아름답습니다.', en: 'Vary color and opacity based on height for beauty.' },
    ],
  },
];

export default missions;

/**
 * 카테고리 메타 정보
 */
export const categories = {
  CT: {
    id: 'CT',
    title: { ko: '컴퓨팅 사고', en: 'Computational Thinking' },
    icon: '🧠',
    color: '#4A90D9',
  },
  CR: {
    id: 'CR',
    title: { ko: '3D 창작', en: '3D Creative' },
    icon: '🎨',
    color: '#D94A8C',
  },
  MA: {
    id: 'MA',
    title: { ko: '수학 시각화', en: 'Math Visualization' },
    icon: '📐',
    color: '#4AD99A',
  },
  SC: {
    id: 'SC',
    title: { ko: '과학 시뮬레이션', en: 'Science Simulation' },
    icon: '🔬',
    color: '#D9A44A',
  },
  AR: {
    id: 'AR',
    title: { ko: '코드 아트', en: 'Code Art' },
    icon: '🎭',
    color: '#9A4AD9',
  },
  SN: {
    id: 'SN',
    title: { ko: '사운드 코딩', en: 'Sound Coding' },
    icon: '🎵',
    color: '#D9694A',
  },
};

/**
 * 특정 카테고리의 미션 목록
 */
export function getMissionsByCategory(categoryId) {
  return missions.filter(m => m.category === categoryId);
}

/**
 * ID로 미션 조회
 */
export function getMissionById(id) {
  return missions.find(m => m.id === id);
}

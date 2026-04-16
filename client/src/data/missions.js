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
      ko: '나만의 행성 만들기',
      en: 'Create Your Own Planet',
    },
    description: {
      ko: '우주 공간에 나만의 행성을 만들어 보세요! 크기, 색상, 위치를 자유롭게 바꿔보세요. VPyLab에서의 첫 3D 프로그래밍입니다.',
      en: 'Create your own planet in space! Change size, color, and position freely. Your first 3D programming!',
    },
    gradeType: 'A',
    starterCode: `from vpython import *

# 우주 배경
scene_background(색상['검정'])

# 나만의 행성을 만들어 보세요!
# sphere(radius=크기, color=색상, pos=vector(x, y, z))

# 아래에 sphere()로 행성을 만들어 보세요!
# radius=크기, color=색상, emissive=True 로 빛나게
`,
    solutionCode: `from vpython import *

scene_background(색상['검정'])
sphere(radius=2, color=color.red, emissive=True)
`,
    assertions: [
      { type: 'sphere', property: 'radius', operator: '>', value: 0 },
    ],
    hints: [
      { ko: 'sphere()를 호출하면 구가 만들어져요.', en: 'Call sphere() to create a sphere.' },
      { ko: 'radius=2 로 크기를, color=color.red 로 색을 정합니다.', en: 'Use radius=2 for size, color=color.red for color.' },
      { ko: 'emissive=True 를 추가하면 스스로 빛나는 행성이 됩니다!', en: 'Add emissive=True to make it glow!' },
    ],
  },

  {
    id: 'CT-2',
    category: 'CT',
    level: 1,
    title: {
      ko: '움직이는 신호등',
      en: 'Animated Traffic Light',
    },
    description: {
      ko: '신호등을 만들고 빨강→노랑→초록 순서로 켜지게 하세요! 효과음도 넣어보세요.',
      en: 'Build a traffic light and animate it: red→yellow→green with sound effects!',
    },
    gradeType: 'A',
    starterCode: `from vpython import *

# 신호등 기둥
box(pos=vector(0, 1.5, 0), size=vector(1.2, 3.5, 0.5), color=color.gray)

# 3개 구 (처음엔 어두운 색)
빨강 = sphere(pos=vector(0, 2.5, 0.3), radius=0.35, color=vector(0.3, 0, 0))
노랑 = sphere(pos=vector(0, 1.5, 0.3), radius=0.35, color=vector(0.3, 0.3, 0))
초록 = sphere(pos=vector(0, 0.5, 0.3), radius=0.35, color=vector(0, 0.3, 0))

# 빨간불 켜기
빨강.color = color.red
빨강.emissive = True
효과음("warning")
sleep(1)

# 빨간불 끄고, 노란불 켜기
빨강.color = vector(0.3, 0, 0)
빨강.emissive = False
# 여기에 노란불을 켜는 코드를 작성하세요

sleep(0.5)

# 노란불 끄고, 초록불 켜기
# 여기에 코드를 작성하세요

효과음("success")
print("신호가 바뀌었습니다!")
`,
    solutionCode: `from vpython import *

box(pos=vector(0, 1.5, 0), size=vector(1.2, 3.5, 0.5), color=color.gray)
빨강 = sphere(pos=vector(0, 2.5, 0.3), radius=0.35, color=vector(0.3, 0, 0))
노랑 = sphere(pos=vector(0, 1.5, 0.3), radius=0.35, color=vector(0.3, 0.3, 0))
초록 = sphere(pos=vector(0, 0.5, 0.3), radius=0.35, color=vector(0, 0.3, 0))

빨강.color = color.red
빨강.emissive = True
효과음("warning")
sleep(1)

빨강.color = vector(0.3, 0, 0)
빨강.emissive = False
노랑.color = color.yellow
노랑.emissive = True
효과음("select")
sleep(0.5)

노랑.color = vector(0.3, 0.3, 0)
노랑.emissive = False
초록.color = color.green
초록.emissive = True
효과음("success")
print("신호가 바뀌었습니다!")
`,
    assertions: [
      { type: 'sphere', property: 'color.g', operator: '==', value: 1, index: 2 },
      { type: 'box', property: 'pos.y', operator: 'approx', value: 1.5, index: 0 },
    ],
    hints: [
      { ko: '변수명.color 로 색을, 변수명.emissive 로 빛남을 바꿀 수 있어요.', en: 'Change color with name.color, glow with name.emissive.' },
      { ko: '빨간불을 끌 때처럼 노랑.color = color.yellow, 노랑.emissive = True 순서로 켜세요.', en: 'Like turning off red: set 노랑.color = color.yellow, 노랑.emissive = True.' },
      { ko: '초록불도 같은 패턴! 노랑을 끄고(False) → 초록을 켜세요(True).', en: 'Same pattern for green! Turn off yellow (False) → turn on green (True).' },
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
        # 속도에 중력을 더하고, 위치에 속도를 더하세요
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
      { ko: '물체가 떨어지려면 속도에 중력을 더해야 해요. "속도 = 속도 + 중력 * 시간"', en: 'To fall, add gravity to velocity: velocity = velocity + gravity * time' },
      { ko: '위치도 같은 원리! "위치 = 위치 + 속도 * 시간". 리스트의 i번째에 접근하세요.', en: 'Same for position: pos = pos + velocity * time. Access the i-th element.' },
      { ko: 'pass를 지우고, velocities[i]와 particles[i].pos를 각각 한 줄씩 업데이트하세요.', en: 'Remove pass and update velocities[i] and particles[i].pos, one line each.' },
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
      ko: '눈사람에 생명을',
      en: 'Snowman Comes Alive',
    },
    description: {
      ko: '눈사람에 당근 코(cone)와 모자(cylinder)를 달아 완성하세요! 완성하면 효과음이 울립니다.',
      en: 'Add a carrot nose (cone) and hat (cylinder) to the snowman! A sound plays when done.',
    },
    gradeType: 'A',
    starterCode: `from vpython import *

# 몸통
sphere(pos=vector(0, 0, 0), radius=1, color=color.white)
# 배
sphere(pos=vector(0, 1.3, 0), radius=0.7, color=color.white)
# 머리
sphere(pos=vector(0, 2.2, 0), radius=0.4, color=color.white)

# 눈 (이미 완성!)
sphere(pos=vector(-0.15, 2.35, 0.35), radius=0.05, color=color.black)
sphere(pos=vector(0.15, 2.35, 0.35), radius=0.05, color=color.black)

# 당근 코 — cone()으로 머리 앞(z=0.4)에 달아주세요!


# 모자 — cylinder()로 머리 위(y=2.5)에 올려주세요!

효과음("levelup")
print("눈사람 완성!")
`,
    solutionCode: `from vpython import *

sphere(pos=vector(0, 0, 0), radius=1, color=color.white)
sphere(pos=vector(0, 1.3, 0), radius=0.7, color=color.white)
sphere(pos=vector(0, 2.2, 0), radius=0.4, color=color.white)
sphere(pos=vector(-0.15, 2.35, 0.35), radius=0.05, color=color.black)
sphere(pos=vector(0.15, 2.35, 0.35), radius=0.05, color=color.black)
cone(pos=vector(0, 2.2, 0.4), axis=vector(0, 0, 0.5), radius=0.08, color=color.orange)
cylinder(pos=vector(0, 2.5, 0), axis=vector(0, 0.5, 0), radius=0.35, color=color.black)

효과음("levelup")
print("눈사람 완성!")
`,
    assertions: [
      { type: 'cone', property: 'pos.y', operator: 'approx', value: 2.2, index: 0 },
      { type: 'cylinder', property: 'pos.y', operator: '>', value: 2, index: 0 },
    ],
    hints: [
      { ko: 'cone()은 원뿔, cylinder()는 원기둥을 만들어요.', en: 'cone() makes a cone, cylinder() makes a cylinder.' },
      { ko: '코는 cone(pos=vector(0, 2.2, 0.4), ...) 처럼 머리 앞쪽(z 방향)에 달아요.', en: 'Place nose with cone(pos=vector(0, 2.2, 0.4), ...) in front of the head.' },
      { ko: '코는 pos의 z를 0.4로, axis의 z를 0.5로 하면 앞으로 뾰족하게 나와요. 모자는 y를 2.5 이상으로!', en: 'Nose: set pos z=0.4, axis z=0.5 to point forward. Hat: y above 2.5!' },
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
    # 공의 위치를 업데이트하세요 (속도 * 시간)
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
      { ko: '거리 = 속도 × 시간. 코드로는 "위치 = 위치 + 속도 * dt"', en: 'distance = velocity × time. In code: position = position + velocity * dt' },
      { ko: 'ball.pos 가 위치이고, v 가 속도, dt 가 짧은 시간입니다.', en: 'ball.pos is position, v is velocity, dt is a small time step.' },
      { ko: '"ball.위치 = ball.위치 + 속도 * 시간" 형태로 한 줄이면 됩니다!', en: '"ball.position = ball.position + velocity * time" — just one line!' },
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
    # 속도에 중력을 더하고, 위치에 속도를 더하세요
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
      { ko: '중력이 속도를 바꾸고, 속도가 위치를 바꿉니다. 두 줄이 필요해요!', en: 'Gravity changes velocity, velocity changes position. Two lines needed!' },
      { ko: '첫 번째 줄: v = v + g * dt (속도에 중력 더하기)', en: 'Line 1: v = v + g * dt (add gravity to velocity)' },
      { ko: '두 번째 줄: "공의 위치 = 공의 위치 + 속도 × 시간" 을 코드로 옮기세요!', en: 'Line 2: translate "ball position = ball position + velocity × time" into code!' },
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
    # 속도에 중력을 더하고, 위치에 속도를 더하세요
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
      { ko: '자유 낙하와 같은 원리! 속도에 중력 더하기, 위치에 속도 더하기.', en: 'Same principle as free fall! Add gravity to velocity, velocity to position.' },
      { ko: '자유낙하에서 쓴 코드 두 줄을 그대로 쓰면 돼요. 중력이 이미 v에 들어있어서 포물선이 됩니다!', en: 'Reuse the same two lines from free fall. Gravity is already in v, creating a parabola!' },
      { ko: 'make_trail=True 덕분에 포물선 궤적이 보여요. 각도를 바꿔보면 궤적이 달라져요!', en: 'make_trail=True shows the parabola. Try changing the angle!' },
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
    # 힘으로 가속도를 구하고, 속도와 위치를 차례로 업데이트하세요

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
      { ko: '뉴턴의 제2법칙! 힘(F)을 질량(m)으로 나누면 가속도(a)가 돼요.', en: "Newton's 2nd law: divide force (F) by mass (m) to get acceleration (a)." },
      { ko: '세 줄이에요: ① 힘÷질량=가속도 ② 속도에 가속도 더하기 ③ 위치에 속도 더하기', en: 'Three lines: ① force÷mass=accel ② add accel to velocity ③ add velocity to position' },
      { ko: 'k 값을 바꿔보세요! 크면 빠르게, 작으면 느리게 진동합니다.', en: 'Try changing k! Larger = faster oscillation, smaller = slower.' },
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
    # 힘으로 속도를 바꾸고, 속도로 위치를 바꾸세요
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
      { ko: '같은 패턴! 힘이 속도를 바꾸고, 속도가 위치를 바꿉니다.', en: 'Same pattern! Force changes velocity, velocity changes position.' },
      { ko: '앞의 과학 미션과 같은 패턴 두 줄! 이번엔 g 대신 F를 쓰세요.', en: 'Same two-line pattern as previous science missions! Use F instead of g this time.' },
      { ko: '초기 속도(1.4)를 바꾸면 궤도 모양이 달라져요. 너무 빠르면 탈출, 너무 느리면 충돌!', en: 'Change initial speed (1.4) — too fast = escape, too slow = crash!' },
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
      ko: '무지개 분수',
      en: 'Rainbow Fountain',
    },
    description: {
      ko: '무지개 7색 구슬이 위로 솟았다가 내려오는 분수를 만드세요. 반복문과 색상 리스트를 사용합니다.',
      en: 'Create a rainbow fountain where 7 colored spheres rise and fall. Use loops and a color list.',
    },
    gradeType: 'A',
    starterCode: `from vpython import *

# 무지개 7색
colors = [color.red, color.orange, color.yellow, color.green,
          color.cyan, color.blue, color.purple]

# 7개 구슬을 원형으로 배치
import math
balls = []
for i in range(7):
    angle = 2 * math.pi * i / 7
    x = 2 * math.cos(angle)
    z = 2 * math.sin(angle)
    # 여기에 sphere를 만들고 balls에 추가하세요
    # b = sphere(pos=vector(x, 0, z), radius=0.3, color=colors[i])
    # balls.append(b)

# 분수 애니메이션: 위로 솟았다가 내려옴
for t in range(100):
    rate(30)
    for i in range(len(balls)):
        # 각 구슬이 시간차를 두고 올라갔다 내려오기
        y = 3 * math.sin((t + i * 10) * 0.1)
        if y < 0:
            y = 0
        balls[i].pos.y = y

효과음("coin")
print("무지개 분수 완성!")
`,
    solutionCode: `from vpython import *
import math

colors = [color.red, color.orange, color.yellow, color.green,
          color.cyan, color.blue, color.purple]

balls = []
for i in range(7):
    angle = 2 * math.pi * i / 7
    x = 2 * math.cos(angle)
    z = 2 * math.sin(angle)
    b = sphere(pos=vector(x, 0, z), radius=0.3, color=colors[i])
    balls.append(b)

for t in range(100):
    rate(30)
    for i in range(len(balls)):
        y = 3 * math.sin((t + i * 10) * 0.1)
        if y < 0:
            y = 0
        balls[i].pos.y = y

효과음("coin")
print("무지개 분수 완성!")
`,
    assertions: [
      { type: 'sphere', property: 'color.r', operator: '==', value: 1, index: 0 },
      { type: 'sphere', property: 'pos.y', operator: '>=', value: 0, index: 6 },
    ],
    hints: [
      { ko: '구슬을 만들고 리스트에 저장해야 나중에 움직일 수 있어요.', en: 'Create spheres and store in list so you can move them later.' },
      { ko: 'b = sphere(pos=vector(x, 0, z), radius=0.3, color=colors[i]) 로 만들고', en: 'Create with b = sphere(pos=vector(x,0,z), radius=0.3, color=colors[i])' },
      { ko: 'balls.append(b) 로 리스트에 추가하세요. 두 줄이면 됩니다!', en: 'Then balls.append(b) to store. Just two lines!' },
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
        # 두 나선을 잇는 가로대(cylinder)를 만드세요
        pass
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
      { ko: 'cylinder의 pos는 시작점, axis는 끝점까지의 방향벡터입니다.', en: 'cylinder pos is start point, axis is direction vector to end point.' },
      { ko: '나선1 위치(x1,y,z1)에서 나선2 위치(x2,y,z2)까지 연결하면 돼요.', en: 'Connect from helix1 (x1,y,z1) to helix2 (x2,y,z2).' },
      { ko: 'pos는 나선1 좌표(x1,y,z1), axis는 나선2까지의 차이(x2-x1, 0, z2-z1)입니다.', en: 'pos is helix1 coords (x1,y,z1), axis is the difference to helix2 (x2-x1, 0, z2-z1).' },
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

# 마지막에 도-미-솔 화음을 연주하세요!
sleep(0.5)
# 화음() 함수에 주파수 리스트를 넣으면 됩니다

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
      { ko: '화음()은 여러 음을 동시에 내는 함수예요. 리스트로 음을 묶어 넣습니다.', en: 'chord() plays multiple notes at once. Pass a list of notes.' },
      { ko: '도(C4), 미(E4), 솔(G4)의 주파수 상수는 note.C4, note.E4, note.G4 입니다.', en: 'C4, E4, G4 frequency constants are note.C4, note.E4, note.G4.' },
      { ko: '화음([주파수1, 주파수2, 주파수3], 길이) 형식이에요. 도=C4, 미=E4, 솔=G4!', en: 'Format: chord([freq1, freq2, freq3], duration). Do=C4, Mi=E4, Sol=G4!' },
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

/**
 * VPy Lab MVP 미션 데이터 (10개)
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
      ko: '빨간색 구를 만들어 보세요. VPy Lab에서의 첫 3D 프로그래밍입니다!',
      en: 'Create a red sphere. Your first 3D programming in VPy Lab!',
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
    ],
    hints: [
      { ko: 'sphere() 함수를 사용하면 구를 만들 수 있어요.', en: 'Use the sphere() function to create a sphere.' },
      { ko: 'color=color.red 로 빨간색을 지정해요.', en: 'Set color=color.red for red color.' },
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

  // ═══════════════════════════════════════════
  // MA: Mathematics (수학)
  // ═══════════════════════════════════════════
  {
    id: 'MA-1',
    category: 'MA',
    level: 1,
    title: {
      ko: '좌표 탐험',
      en: 'Coordinate Explorer',
    },
    description: {
      ko: '구를 (3, 2, 1) 위치에 놓아 3D 좌표계를 이해하세요.',
      en: 'Place a sphere at position (3, 2, 1) to understand 3D coordinates.',
    },
    gradeType: 'A',
    starterCode: `from vpython import *

# (3, 2, 1) 위치에 구를 만드세요
# vector(x, y, z) 로 위치를 지정합니다
# x: 오른쪽, y: 위쪽, z: 앞쪽
sphere(pos=vector(0, 0, 0), color=color.cyan)
`,
    solutionCode: `from vpython import *

sphere(pos=vector(3, 2, 1), color=color.cyan)
`,
    assertions: [
      { type: 'sphere', property: 'pos.x', operator: '==', value: 3 },
      { type: 'sphere', property: 'pos.y', operator: '==', value: 2 },
      { type: 'sphere', property: 'pos.z', operator: '==', value: 1 },
    ],
    hints: [
      { ko: 'vector(3, 2, 1)로 위치를 지정하세요.', en: 'Use vector(3, 2, 1) for position.' },
      { ko: 'pos=vector(x, y, z) 형식입니다.', en: 'Format: pos=vector(x, y, z).' },
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
      ko: '회전하는 큐브',
      en: 'Spinning Cube',
    },
    description: {
      ko: '8개의 구로 정육면체 꼭짓점을 만들고, 회전시키세요.',
      en: 'Create cube vertices with 8 spheres and rotate them.',
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
    gradeType: 'A',
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
    gradeType: 'A',
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
    gradeType: 'A',
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
    gradeType: 'A',
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
    assertions: [
      { type: 'box', property: 'pos.x', operator: '<', value: 0, index: 0 },
      { type: 'box', property: 'pos.x', operator: '>', value: 0, index: 6 },
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
    assertions: [
      { type: 'sphere', property: 'pos.y', operator: '<', value: 0 },
      { type: 'box', property: 'pos.y', operator: '==', value: -5, index: 0 },
    ],
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
    gradeType: 'A',
    starterCode: `from vpython import *
import math

# === 음악 파동 시각화 ===
# 음계를 연주하면서 3D 표면이 실시간으로 변합니다

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
  AI: {
    id: 'AI',
    title: { ko: '인공지능 원리', en: 'AI Principles' },
    icon: '🤖',
    color: '#4AD9D9',
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

/**
 * VPy Lab 대표 예제 20선
 * 코드는 쉽지만 아이디어가 뛰어난 영감을 주는 예제들
 */

const EXAMPLES = [
  // ═══════════════════════════════════════
  // 🌌 우주/자연 (5개)
  // ═══════════════════════════════════════
  {
    id: 'solar-system',
    title: '태양계',
    thumbnail: '🪐',
    category: 'space',
    level: 2,
    description: '태양 주위를 도는 8개 행성. 크기와 속도가 모두 다릅니다.',
    tags: ['animation', 'trail', 'trigonometry'],
    code: `from vpython import *
import math

# 태양
sun = sphere(pos=vector(0,0,0), radius=0.8, color=color.yellow)
local_light(pos=vector(0,0,0), color=color.yellow, intensity=2)
scene_background(vector(0.02, 0.02, 0.05))

# 행성 데이터: [이름, 거리, 크기, 색, 속도]
planets_data = [
    [1.5, 0.1, color.gray, 4.0],    # 수성
    [2.2, 0.15, color.orange, 3.0],  # 금성
    [3.0, 0.16, color.cyan, 2.5],    # 지구
    [3.8, 0.12, color.red, 2.0],     # 화성
    [5.2, 0.4, color.orange, 1.2],   # 목성
    [6.5, 0.35, color.gold, 0.9],    # 토성
    [7.8, 0.25, color.skyblue, 0.6], # 천왕성
    [9.0, 0.24, color.blue, 0.4],    # 해왕성
]

planets = []
for dist, size, col, speed in planets_data:
    p = sphere(radius=size, color=col, make_trail=True, trail_color=col)
    p.dist = dist
    p.speed = speed
    p.angle = 0
    planets.append(p)

# 궤도 애니메이션
t = 0
while True:
    rate(60)
    t += 0.02
    for p in planets:
        p.angle += p.speed * 0.02
        p.pos = vector(p.dist * math.cos(p.angle), 0, p.dist * math.sin(p.angle))
`
  },
  {
    id: 'shooting-stars',
    title: '별똥별',
    thumbnail: '🌠',
    category: 'space',
    level: 1,
    description: '밤하늘에서 떨어지는 유성우. 떨어질 때마다 효과음이 납니다.',
    tags: ['random', 'trail', 'sfx'],
    code: `from vpython import *
import random

scene_background(vector(0.02, 0.02, 0.08))

# 배경 별 만들기
for i in range(100):
    x = random.uniform(-10, 10)
    y = random.uniform(-5, 8)
    z = random.uniform(-5, 5)
    sphere(pos=vector(x, y, z), radius=0.03, color=color.white)

# 별똥별 떨어뜨리기
while True:
    rate(30)

    # 가끔 별똥별 생성
    if random.random() < 0.15:
        x = random.uniform(-8, 8)
        star = sphere(
            pos=vector(x, 7, 0),
            radius=0.08,
            color=color.yellow,
            make_trail=True,
            trail_color=color.orange
        )
        play_sfx('laser')

        # 떨어지는 애니메이션
        for i in range(40):
            rate(60)
            star.pos.y -= 0.3
            star.pos.x += 0.15
            star.radius *= 0.97
            if star.pos.y < -5:
                break
        star.visible = False
`
  },
  {
    id: 'dna-helix',
    title: 'DNA 이중나선',
    thumbnail: '🧬',
    category: 'space',
    level: 2,
    description: '생명의 설계도, DNA의 아름다운 이중나선 구조를 3D로 표현합니다.',
    tags: ['biology', 'trigonometry', 'structure'],
    code: `from vpython import *
import math

scene_background(vector(0.05, 0.05, 0.1))

# DNA 이중나선 생성
colors1 = [color.cyan, color.blue, color.skyblue]
colors2 = [color.red, color.orange, color.pink]
radius = 1.5
step = 0.15
turns = 4

for i in range(int(turns * 40)):
    angle = i * 0.15
    y = i * step - (turns * 40 * step / 2)

    # 가닥 1
    x1 = radius * math.cos(angle)
    z1 = radius * math.sin(angle)
    sphere(pos=vector(x1, y, z1), radius=0.12, color=colors1[i % 3])

    # 가닥 2 (반대편)
    x2 = radius * math.cos(angle + math.pi)
    z2 = radius * math.sin(angle + math.pi)
    sphere(pos=vector(x2, y, z2), radius=0.12, color=colors2[i % 3])

    # 염기쌍 연결 (5개마다)
    if i % 5 == 0:
        cylinder(
            pos=vector(x1, y, z1),
            axis=vector(x2 - x1, 0, z2 - z1),
            radius=0.04,
            color=color.white,
            opacity=0.5
        )

print("DNA 이중나선 완성!")
`
  },
  {
    id: 'galaxy',
    title: '은하수',
    thumbnail: '🌀',
    category: 'space',
    level: 2,
    description: '나선 팔을 가진 은하가 천천히 회전합니다.',
    tags: ['animation', 'trigonometry', 'particles'],
    code: `from vpython import *
import math, random

scene_background(vector(0.01, 0.01, 0.03))

# 은하 중심
sphere(pos=vector(0,0,0), radius=0.5, color=color.yellow)
local_light(pos=vector(0,0,0), color=color.yellow, intensity=1.5)

# 나선 팔 위에 별 배치
stars = []
for arm in range(3):  # 3개 나선 팔
    offset = arm * 2.094  # 120도 간격
    for i in range(80):
        r = 0.5 + i * 0.08
        angle = offset + i * 0.15 + random.uniform(-0.2, 0.2)
        x = r * math.cos(angle)
        z = r * math.sin(angle)
        y = random.uniform(-0.1, 0.1)

        brightness = max(0.3, 1.0 - r / 8)
        size = random.uniform(0.02, 0.06)
        col = random.choice([color.white, color.skyblue, color.yellow, color.orange])

        s = sphere(pos=vector(x, y, z), radius=size, color=col, opacity=brightness)
        s.angle = math.atan2(z, x)
        s.dist = r
        stars.append(s)

# 은하 회전
while True:
    rate(30)
    for s in stars:
        s.angle += 0.003 / max(s.dist, 0.5)
        s.pos.x = s.dist * math.cos(s.angle)
        s.pos.z = s.dist * math.sin(s.angle)
`
  },
  {
    id: 'rain',
    title: '비 내리는 날',
    thumbnail: '🌧️',
    category: 'space',
    level: 1,
    description: '빗방울이 떨어지며 바닥에 부딪히면 소리가 납니다.',
    tags: ['animation', 'sound', 'random'],
    code: `from vpython import *
import random

scene_background(vector(0.15, 0.15, 0.2))

# 바닥
box(pos=vector(0, -3, 0), size=vector(12, 0.1, 8), color=color.gray, opacity=0.3)

# 빗방울 만들기
drops = []
for i in range(30):
    x = random.uniform(-5, 5)
    y = random.uniform(0, 8)
    z = random.uniform(-3, 3)
    d = cylinder(
        pos=vector(x, y, z),
        axis=vector(0, -0.3, 0),
        radius=0.02,
        color=color.skyblue,
        opacity=0.6
    )
    d.speed = random.uniform(0.15, 0.3)
    drops.append(d)

# 비 내리기
while True:
    rate(60)
    for d in drops:
        d.pos.y -= d.speed

        # 바닥에 닿으면 위로 리셋 + 소리
        if d.pos.y < -3:
            if random.random() < 0.3:
                freq = random.uniform(800, 2000)
                play_sound(freq, 0.05, 'sine', 0.1)
            d.pos.y = 8
            d.pos.x = random.uniform(-5, 5)
            d.speed = random.uniform(0.15, 0.3)
`
  },

  // ═══════════════════════════════════════
  // 🎵 사운드/음악 (5개)
  // ═══════════════════════════════════════
  {
    id: 'music-box',
    title: '3D 오르골',
    thumbnail: '🎶',
    category: 'sound',
    level: 2,
    description: '회전하는 실린더의 돌기가 음판을 때려 멜로디가 흘러나옵니다.',
    tags: ['instrument', 'animation', 'creative'],
    code: `from vpython import *
import math

scene_background(vector(0.05, 0.03, 0.02))

# 음판 (도레미파솔라시)
notes = ['도', '레', '미', '파', '솔', '라', '시']
colors = [color.red, color.orange, color.yellow, color.green, color.blue, color.navy, color.purple]
plates = []
for i, (n, c) in enumerate(zip(notes, colors)):
    b = box(pos=vector(-3 + i, 0, 0), size=vector(0.8, 0.1, 1), color=c)
    b.note = n
    b.base_y = 0
    plates.append(b)

# 오르골 실린더
drum = cylinder(pos=vector(-3, 2, 0), axis=vector(6, 0, 0), radius=0.3, color=color.gold)

# 멜로디 패턴: 학교종이 땡땡땡
melody = [4, 4, 5, 5, 4, 4, 2, 4, 4, 2, 2, 0,
          4, 4, 5, 5, 4, 4, 2, 4, 2, 0, 2, 0]

idx = 0
while True:
    rate(4)
    note_idx = melody[idx % len(melody)]

    # 해당 음판 두드리기
    p = plates[note_idx]
    p.pos.y = p.base_y - 0.2
    악기('피아노', p.note, 0.4)

    # 드럼 회전
    drum.pos = vector(-3, 2 + 0.05 * math.sin(idx * 0.5), 0)

    await rate(8)
    p.pos.y = p.base_y  # 음판 복귀

    idx += 1
`
  },
  {
    id: 'rainbow-xylophone',
    title: '무지개 실로폰',
    thumbnail: '🌈',
    category: 'sound',
    level: 1,
    description: '7색 무지개 막대가 차례로 울리며 도레미를 연주합니다.',
    tags: ['instrument', 'rainbow', 'music'],
    code: `from vpython import *

scene_background(vector(0.1, 0.1, 0.15))

# 무지개 실로폰 막대
notes = ['도', '레', '미', '파', '솔', '라', '시']
bars = []
for i in range(7):
    height = 1.5 + i * 0.2
    b = box(
        pos=vector(-3 + i, 0, 0),
        size=vector(0.8, height, 0.5),
        color=무지개[i]
    )
    bars.append(b)

# 채 (말렛)
mallet = sphere(pos=vector(-3, 2, 0), radius=0.15, color=color.white)

# 올라가며 연주
while True:
    for i in range(7):
        rate(3)
        mallet.pos = vector(-3 + i, bars[i].size.y / 2 + 0.5, 0)
        bars[i].pos.y -= 0.1
        악기('피아노', notes[i], 0.4)
        await rate(6)
        bars[i].pos.y += 0.1

    # 내려오며 연주
    for i in range(5, -1, -1):
        rate(3)
        mallet.pos = vector(-3 + i, bars[i].size.y / 2 + 0.5, 0)
        bars[i].pos.y -= 0.1
        악기('피아노', notes[i], 0.4)
        await rate(6)
        bars[i].pos.y += 0.1
`
  },
  {
    id: 'fireflies',
    title: '반딧불 합주',
    thumbnail: '✨',
    category: 'sound',
    level: 2,
    description: '빛나는 반딧불이 각자 다른 음을 내며 깜빡입니다.',
    tags: ['light', 'random', 'music'],
    code: `from vpython import *
import random, math

scene_background(vector(0.02, 0.04, 0.02))

# 반딧불 만들기
notes = ['도', '미', '솔', '라', '높은도']
note_freqs = [262, 330, 392, 440, 523]
flies = []

for i in range(12):
    x = random.uniform(-4, 4)
    y = random.uniform(-2, 3)
    z = random.uniform(-3, 3)

    col = random.choice([color.yellow, color.lime, color.green])
    s = sphere(pos=vector(x, y, z), radius=0.1, color=col)
    light = local_light(pos=vector(x, y, z), color=col, intensity=0)

    s.light = light
    s.freq = random.choice(note_freqs)
    s.phase = random.uniform(0, 6.28)
    s.speed = random.uniform(0.02, 0.05)
    s.base_pos = vector(x, y, z)
    flies.append(s)

# 반딧불 깜빡이며 소리내기
t = 0
while True:
    rate(30)
    t += 0.05

    for f in flies:
        # 둥둥 떠다니기
        f.pos = f.base_pos + vector(
            0.3 * math.sin(t * 0.5 + f.phase),
            0.2 * math.sin(t * 0.7 + f.phase),
            0.2 * math.cos(t * 0.3 + f.phase)
        )
        f.light.pos = f.pos

        # 깜빡이기
        glow = max(0, math.sin(t * 1.5 + f.phase))
        f.light.intensity = glow * 2
        f.opacity = 0.3 + glow * 0.7

        # 밝아지는 순간 소리
        if abs(math.sin(t * 1.5 + f.phase) - 1.0) < 0.05:
            if random.random() < 0.3:
                play_sound(f.freq, 0.2, 'sine', 0.15)
`
  },
  {
    id: 'rhythm-viz',
    title: '리듬 시각화',
    thumbnail: '🥁',
    category: 'sound',
    level: 1,
    description: '구들이 리듬에 맞춰 튀어오르며 비트를 만듭니다.',
    tags: ['animation', 'beat', 'sync'],
    code: `from vpython import *
import math

scene_background(vector(0.08, 0.05, 0.12))

# 비트 구 5개
colors = [color.red, color.orange, color.yellow, color.cyan, color.magenta]
freqs = [200, 300, 400, 500, 600]
balls = []

for i in range(5):
    s = sphere(pos=vector(-4 + i * 2, -1, 0), radius=0.4, color=colors[i])
    s.base_y = -1
    s.freq = freqs[i]
    balls.append(s)

# 바닥
box(pos=vector(0, -2, 0), size=vector(12, 0.2, 3), color=color.gray, opacity=0.3)

# 리듬 패턴: 1=큰비트, 0.5=작은비트, 0=쉼
pattern = [
    [1, 0, 0.5, 0, 1, 0, 0.5, 0],  # 킥
    [0, 0, 1, 0, 0, 0, 1, 0],       # 스네어
    [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5],  # 하이햇
    [0, 0, 0, 1, 0, 0, 0, 0],       # 탐
    [0, 0, 0, 0, 0, 0, 0, 1],       # 크래시
]

step = 0
while True:
    rate(8)
    idx = step % 8

    for i, b in enumerate(balls):
        vol = pattern[i][idx]
        if vol > 0:
            b.pos.y = b.base_y + vol * 2
            play_sound(b.freq, 0.1, 'square', vol * 0.3)

    await rate(16)
    for b in balls:
        b.pos.y = b.base_y

    step += 1
`
  },
  {
    id: 'space-bgm',
    title: '우주 유영',
    thumbnail: '🚀',
    category: 'sound',
    level: 1,
    description: '잔잔한 배경음악과 함께 별들 사이를 떠다닙니다.',
    tags: ['bgm', 'atmosphere', 'relaxing'],
    code: `from vpython import *
import random, math

scene_background(vector(0.01, 0.01, 0.03))

# 배경음악 시작
start_bgm('peaceful')

# 별 만들기
for i in range(200):
    x = random.uniform(-15, 15)
    y = random.uniform(-10, 10)
    z = random.uniform(-15, 15)
    size = random.uniform(0.02, 0.08)
    col = random.choice([color.white, color.skyblue, color.yellow])
    sphere(pos=vector(x, y, z), radius=size, color=col)

# 성운 (큰 반투명 구)
sphere(pos=vector(3, 2, -5), radius=3, color=color.purple, opacity=0.08)
sphere(pos=vector(-4, -1, -8), radius=4, color=color.cyan, opacity=0.05)
sphere(pos=vector(5, -3, -6), radius=2.5, color=color.pink, opacity=0.06)

# 우주선 (작은 화살표)
ship = arrow(pos=vector(0, 0, 5), axis=vector(0, 0, -0.5), color=color.white)
ship.make_trail = True
ship.trail_color = color.cyan

# 느긋하게 떠다니기
t = 0
while True:
    rate(30)
    t += 0.01
    ship.pos = vector(
        3 * math.sin(t * 0.5),
        2 * math.sin(t * 0.3),
        5 * math.cos(t * 0.2)
    )
    ship.axis = vector(
        0.3 * math.cos(t * 0.5),
        0.2 * math.cos(t * 0.3),
        -0.3 * math.sin(t * 0.2)
    )
`
  },

  // ═══════════════════════════════════════
  // 🔬 과학/수학 (4개)
  // ═══════════════════════════════════════
  {
    id: 'cannon',
    title: '포물선 대포',
    thumbnail: '💥',
    category: 'science',
    level: 2,
    description: '대포에서 발사된 공이 포물선을 그리며 날아갑니다.',
    tags: ['physics', 'trail', 'gravity'],
    code: `from vpython import *
import math

scene_background(vector(0.4, 0.6, 0.9))

# 바닥
box(pos=vector(5, -0.5, 0), size=vector(20, 1, 4), color=color.green)

# 대포
angle = 45
cannon = cylinder(
    pos=vector(-4, 0, 0),
    axis=vector(math.cos(math.radians(angle)), math.sin(math.radians(angle)), 0) * 1.5,
    radius=0.2,
    color=color.gray
)

# 발사!
play_sfx('explosion')

ball = sphere(
    pos=vector(-4, 0.5, 0),
    radius=0.2,
    color=color.red,
    make_trail=True,
    trail_color=color.orange
)

# 초기 속도
speed = 8
vx = speed * math.cos(math.radians(angle))
vy = speed * math.sin(math.radians(angle))
g = 9.8
dt = 0.02

while True:
    rate(60)
    vy -= g * dt
    ball.pos.x += vx * dt
    ball.pos.y += vy * dt

    # 바닥에 닿으면 정지
    if ball.pos.y < 0 and vy < 0:
        play_sfx('explosion')
        # 착탄 표시
        ring(pos=vector(ball.pos.x, 0.01, 0), axis=vector(0,1,0),
             radius=0.5, thickness=0.05, color=color.red)
        print(f"비거리: {ball.pos.x + 4:.1f}m")
        break
`
  },
  {
    id: 'wave-sim',
    title: '파동 시뮬레이션',
    thumbnail: '🌊',
    category: 'science',
    level: 2,
    description: '격자 위의 구들이 물결치듯 출렁이는 파동을 보여줍니다.',
    tags: ['physics', 'wave', 'grid'],
    code: `from vpython import *
import math

scene_background(vector(0.05, 0.08, 0.15))

# 격자 만들기
N = 15
dots = []
for i in range(N):
    row = []
    for j in range(N):
        x = (i - N/2) * 0.6
        z = (j - N/2) * 0.6
        s = sphere(pos=vector(x, 0, z), radius=0.12, color=color.cyan)
        row.append(s)
    dots.append(row)

# 파동 애니메이션
t = 0
while True:
    rate(30)
    t += 0.1

    for i in range(N):
        for j in range(N):
            x = (i - N/2) * 0.6
            z = (j - N/2) * 0.6
            dist = math.sqrt(x*x + z*z)

            # 원형 파동
            y = 0.8 * math.sin(dist * 1.5 - t * 3) / (1 + dist * 0.3)

            dots[i][j].pos.y = y

            # 높이에 따라 색 변경
            if y > 0.2:
                dots[i][j].color = color.white
            elif y > 0:
                dots[i][j].color = color.cyan
            elif y > -0.2:
                dots[i][j].color = color.blue
            else:
                dots[i][j].color = color.navy
`
  },
  {
    id: 'surface-plot',
    title: '3D 함수 그래프',
    thumbnail: '📊',
    category: 'science',
    level: 1,
    description: 'sin(x) × cos(y) 함수를 아름다운 3D 곡면으로 시각화합니다.',
    tags: ['chart', 'math', 'colormap'],
    code: `from vpython import *
import math

# sin(x) * cos(y) 함수의 값 계산
size = 20
z_data = []

for i in range(size):
    row = []
    for j in range(size):
        x = -3.14 + i * 6.28 / size
        y = -3.14 + j * 6.28 / size
        z = math.sin(x) * math.cos(y)
        row.append(z)
    z_data.append(row)

# 3D 곡면 그래프 그리기
surface3d(z_data, x_range=[-3.14, 3.14], y_range=[-3.14, 3.14], colormap='coolwarm')

print("sin(x) × cos(y) 함수")
print("빨간색 = 양수, 파란색 = 음수")
`
  },
  {
    id: 'pendulum',
    title: '진자 운동',
    thumbnail: '🕰️',
    category: 'science',
    level: 2,
    description: '줄에 매달린 공이 좌우로 흔들리며 에너지를 보존합니다.',
    tags: ['physics', 'animation', 'energy'],
    code: `from vpython import *
import math

scene_background(vector(0.1, 0.1, 0.12))

# 지지대
box(pos=vector(0, 4, 0), size=vector(3, 0.2, 0.5), color=color.gray)
cylinder(pos=vector(-1, 0, 0), axis=vector(0, 4, 0), radius=0.05, color=color.gray)
cylinder(pos=vector(1, 0, 0), axis=vector(0, 4, 0), radius=0.05, color=color.gray)

# 진자
L = 3.5  # 줄 길이
angle = math.radians(45)  # 초기 각도
omega = 0  # 각속도
g = 9.8

# 추
ball = sphere(radius=0.25, color=color.gold, make_trail=True, trail_color=color.orange)
string = cylinder(pos=vector(0, 4, 0), radius=0.02, color=color.white)

# 에너지 표시용
energy_arrow = arrow(pos=vector(-3, -1, 0), axis=vector(0, 0, 0), color=color.red)

dt = 0.01
while True:
    rate(100)

    # 진자 운동 방정식
    alpha = -g / L * math.sin(angle)
    omega += alpha * dt
    angle += omega * dt

    # 위치 업데이트
    x = L * math.sin(angle)
    y = 4 - L * math.cos(angle)
    ball.pos = vector(x, y, 0)
    string.axis = ball.pos - string.pos

    # 운동 에너지 표시 (속도에 비례)
    speed = abs(omega * L)
    energy_arrow.axis = vector(speed * 0.5, 0, 0)

    # 최저점 통과 시 소리
    if abs(angle) < 0.02 and abs(omega) > 0.5:
        play_sound(300 + speed * 50, 0.1, 'sine', 0.2)
`
  },

  // ═══════════════════════════════════════
  // 🎨 아트/창작 (4개)
  // ═══════════════════════════════════════
  {
    id: 'fireworks',
    title: '불꽃놀이',
    thumbnail: '🎆',
    category: 'art',
    level: 2,
    description: '밤하늘에 폭발하며 퍼지는 화려한 불꽃놀이입니다.',
    tags: ['particles', 'sfx', 'random'],
    code: `from vpython import *
import random, math

scene_background(vector(0.02, 0.02, 0.05))

# 불꽃놀이 함수
def firework(x, y):
    col = random.choice([color.red, color.yellow, color.cyan,
                         color.magenta, color.green, color.orange])
    play_sfx('explosion')

    particles = []
    N = 30
    for i in range(N):
        angle1 = random.uniform(0, 6.28)
        angle2 = random.uniform(-1.5, 1.5)
        speed = random.uniform(0.5, 1.5)

        vx = speed * math.cos(angle1) * math.cos(angle2)
        vy = speed * math.sin(angle2)
        vz = speed * math.sin(angle1) * math.cos(angle2)

        p = sphere(
            pos=vector(x, y, 0),
            radius=0.06,
            color=col,
            make_trail=True,
            trail_color=col
        )
        p.velocity = vector(vx, vy, vz)
        particles.append(p)

    # 퍼지는 애니메이션
    for t in range(40):
        rate(30)
        for p in particles:
            p.pos += p.velocity * 0.08
            p.velocity.y -= 0.02  # 중력
            p.opacity = max(0, 1.0 - t / 40)
            p.radius *= 0.98

    for p in particles:
        p.visible = False

# 여러 발 쏘기
while True:
    x = random.uniform(-3, 3)
    y = random.uniform(1, 4)
    firework(x, y)
    sleep(0.5)
`
  },
  {
    id: 'christmas-tree',
    title: '크리스마스 트리',
    thumbnail: '🎄',
    category: 'art',
    level: 1,
    description: '반짝이는 장식과 음악이 있는 크리스마스 트리입니다.',
    tags: ['holiday', 'light', 'bgm'],
    code: `from vpython import *
import random, math

scene_background(vector(0.02, 0.02, 0.05))
start_bgm('peaceful')

# 나무 기둥
cylinder(pos=vector(0, -1.5, 0), axis=vector(0, 1, 0), radius=0.2, color=color.brown)

# 나뭇잎 (원뿔 3층)
cone(pos=vector(0, 0, 0), axis=vector(0, 2.5, 0), radius=2, color=color.green)
cone(pos=vector(0, 1.2, 0), axis=vector(0, 2, 0), radius=1.5, color=color.green)
cone(pos=vector(0, 2.2, 0), axis=vector(0, 1.5, 0), radius=1, color=color.green)

# 별
sphere(pos=vector(0, 4.2, 0), radius=0.25, color=color.yellow)
local_light(pos=vector(0, 4.2, 0), color=color.yellow, intensity=2)

# 장식 달기
ornaments = []
lights = []
for i in range(20):
    angle = random.uniform(0, 6.28)
    height = random.uniform(0, 3.5)
    r = (3.5 - height) / 3.5 * 1.8  # 높이에 따라 반지름 감소

    x = r * math.cos(angle)
    z = r * math.sin(angle)

    col = random.choice([color.red, color.gold, color.blue, color.silver])
    s = sphere(pos=vector(x, height, z), radius=0.12, color=col)
    l = local_light(pos=vector(x, height, z), color=col, intensity=0)
    s.light = l
    ornaments.append(s)
    lights.append(l)

# 반짝반짝
t = 0
while True:
    rate(10)
    t += 1
    for i, (s, l) in enumerate(zip(ornaments, lights)):
        if (t + i) % 5 == 0:
            l.intensity = 1.5
        else:
            l.intensity = 0
`
  },
  {
    id: 'kaleidoscope',
    title: '3D 만화경',
    thumbnail: '🔮',
    category: 'art',
    level: 2,
    description: '대칭 패턴이 회전하며 끝없이 변하는 만화경입니다.',
    tags: ['symmetry', 'pastel', 'animation'],
    code: `from vpython import *
import math

scene_background(vector(0.05, 0.05, 0.08))

# 6겹 대칭 패턴
N = 6  # 대칭 수
objects = []

for ring_r in [1, 2, 3, 4]:
    for i in range(N):
        angle = i * 2 * math.pi / N
        x = ring_r * math.cos(angle)
        z = ring_r * math.sin(angle)

        col = 파스텔[ring_r % len(파스텔)]
        s = sphere(pos=vector(x, 0, z), radius=0.2, color=col, opacity=0.8)
        s.ring_r = ring_r
        s.base_angle = angle
        s.idx = i
        objects.append(s)

# 만화경 회전
t = 0
while True:
    rate(30)
    t += 0.02

    for s in objects:
        # 각 링마다 다른 속도로 회전
        speed = 1.0 / s.ring_r
        angle = s.base_angle + t * speed

        # 반지름도 미세하게 변동
        r = s.ring_r + 0.3 * math.sin(t * 2 + s.idx)

        s.pos.x = r * math.cos(angle)
        s.pos.z = r * math.sin(angle)
        s.pos.y = 0.5 * math.sin(t * 3 + s.ring_r)

        # 색 순환
        hue = (t * 0.1 + s.ring_r * 0.3 + s.idx * 0.2) % 7
        s.color = 무지개[int(hue) % 7]
`
  },
  {
    id: 'neon-city',
    title: '네온 도시',
    thumbnail: '🏙️',
    category: 'art',
    level: 1,
    description: '빛나는 네온 빌딩이 만드는 미래 도시 야경입니다.',
    tags: ['light', 'cityscape', 'atmosphere'],
    code: `from vpython import *
import random

scene_background(vector(0.02, 0.02, 0.04))

# 네온 색상들
neon_colors = [color.cyan, color.magenta, color.purple,
               color.pink, color.skyblue, color.blue]

# 빌딩 만들기
for i in range(30):
    x = random.uniform(-8, 8)
    z = random.uniform(-6, 2)
    width = random.uniform(0.4, 1.2)
    depth = random.uniform(0.4, 1.0)
    height = random.uniform(1, 6)

    # 빌딩 몸체 (어두운 색)
    box(
        pos=vector(x, height/2, z),
        size=vector(width, height, depth),
        color=vector(0.1, 0.1, 0.15)
    )

    # 네온 라인 (꼭대기)
    col = random.choice(neon_colors)
    box(
        pos=vector(x, height, z),
        size=vector(width + 0.1, 0.1, depth + 0.1),
        color=col
    )
    local_light(pos=vector(x, height, z), color=col, intensity=0.5)

    # 창문 (랜덤)
    if random.random() < 0.5:
        for floor in range(int(height)):
            if random.random() < 0.4:
                box(
                    pos=vector(x, floor + 0.5, z + depth/2 + 0.01),
                    size=vector(width * 0.3, 0.3, 0.02),
                    color=color.yellow,
                    opacity=0.6
                )

# 바닥 (도로)
box(pos=vector(0, -0.05, 0), size=vector(20, 0.1, 15), color=vector(0.05, 0.05, 0.08))

print("네온 도시 야경")
`
  },

  // ═══════════════════════════════════════
  // 🎮 게임/인터랙티브 (2개)
  // ═══════════════════════════════════════
  {
    id: 'bounce-ball',
    title: '바운스 볼',
    thumbnail: '⚽',
    category: 'game',
    level: 1,
    description: '벽에 부딪히면 색이 바뀌고 소리가 나는 통통 튀는 공입니다.',
    tags: ['physics', 'sound', 'color-change'],
    code: `from vpython import *
import random

scene_background(vector(0.08, 0.08, 0.1))

# 상자 벽 (반투명)
wall_size = 4
box(pos=vector(wall_size,0,0), size=vector(0.1,wall_size*2,wall_size*2), color=color.cyan, opacity=0.2)
box(pos=vector(-wall_size,0,0), size=vector(0.1,wall_size*2,wall_size*2), color=color.cyan, opacity=0.2)
box(pos=vector(0,wall_size,0), size=vector(wall_size*2,0.1,wall_size*2), color=color.magenta, opacity=0.2)
box(pos=vector(0,-wall_size,0), size=vector(wall_size*2,0.1,wall_size*2), color=color.magenta, opacity=0.2)
box(pos=vector(0,0,wall_size), size=vector(wall_size*2,wall_size*2,0.1), color=color.yellow, opacity=0.2)
box(pos=vector(0,0,-wall_size), size=vector(wall_size*2,wall_size*2,0.1), color=color.yellow, opacity=0.2)

# 공
ball = sphere(pos=vector(0,0,0), radius=0.3, color=color.red, make_trail=True)
vx, vy, vz = 3, 2.5, 2

all_colors = [color.red, color.orange, color.yellow, color.green,
              color.cyan, color.blue, color.purple, color.pink]
bounces = 0

while True:
    rate(60)
    ball.pos.x += vx * 0.02
    ball.pos.y += vy * 0.02
    ball.pos.z += vz * 0.02

    # 벽 충돌
    if abs(ball.pos.x) > wall_size - 0.3:
        vx = -vx
        bounces += 1
        ball.color = all_colors[bounces % len(all_colors)]
        ball.trail_color = ball.color
        play_sound(400 + bounces * 30, 0.1, 'square', 0.2)

    if abs(ball.pos.y) > wall_size - 0.3:
        vy = -vy
        bounces += 1
        ball.color = all_colors[bounces % len(all_colors)]
        ball.trail_color = ball.color
        play_sound(500 + bounces * 30, 0.1, 'triangle', 0.2)

    if abs(ball.pos.z) > wall_size - 0.3:
        vz = -vz
        bounces += 1
        ball.color = all_colors[bounces % len(all_colors)]
        ball.trail_color = ball.color
        play_sound(600 + bounces * 30, 0.1, 'sine', 0.2)
`
  },
  {
    id: 'planet-collision',
    title: '행성 충돌',
    thumbnail: '☄️',
    category: 'game',
    level: 2,
    description: '두 행성이 서로 끌려와 충돌하면 화려한 폭발이 일어납니다.',
    tags: ['gravity', 'trail', 'sfx', 'explosion'],
    code: `from vpython import *
import math, random

scene_background(vector(0.02, 0.02, 0.05))

# 두 행성
p1 = sphere(pos=vector(-5, 1, 0), radius=0.5, color=color.cyan,
            make_trail=True, trail_color=color.skyblue)
p2 = sphere(pos=vector(5, -1, 0), radius=0.4, color=color.orange,
            make_trail=True, trail_color=color.yellow)

p1.velocity = vector(1, -0.3, 0)
p2.velocity = vector(-1.2, 0.2, 0)

# 배경 별
for i in range(80):
    sphere(pos=vector(random.uniform(-10,10), random.uniform(-8,8), random.uniform(-5,-2)),
           radius=0.03, color=color.white)

dt = 0.02
while True:
    rate(60)

    # 중력 (서로 끌어당김)
    diff = p2.pos - p1.pos
    dist = max(mag(diff), 0.5)
    force = 5.0 / (dist * dist)
    direction = diff / dist

    p1.velocity += direction * force * dt
    p2.velocity -= direction * force * dt

    p1.pos += p1.velocity * dt
    p2.pos += p2.velocity * dt

    # 충돌 감지
    if dist < (p1.radius + p2.radius):
        play_sfx('explosion')

        # 폭발 이펙트
        center = (p1.pos + p2.pos) / 2
        p1.visible = False
        p2.visible = False

        for i in range(50):
            angle1 = random.uniform(0, 6.28)
            angle2 = random.uniform(-3.14, 3.14)
            speed = random.uniform(1, 4)

            col = random.choice([color.red, color.orange, color.yellow, color.white])
            s = sphere(pos=center, radius=random.uniform(0.05, 0.15), color=col,
                      make_trail=True, trail_color=col)
            s.velocity = vector(
                speed * math.cos(angle1) * math.cos(angle2),
                speed * math.sin(angle2),
                speed * math.sin(angle1) * math.cos(angle2)
            )

        # 폭발 진행
        for t in range(60):
            rate(30)

        print("행성 충돌! 새로운 성운이 탄생했습니다.")
        break
`
  },
];

export default EXAMPLES;

// 카테고리 필터 헬퍼
export const EXAMPLE_CATEGORIES = [
  { id: 'all', label: '전체', labelEn: 'All' },
  { id: 'space', label: '우주/자연', labelEn: 'Space' },
  { id: 'sound', label: '사운드', labelEn: 'Sound' },
  { id: 'science', label: '과학/수학', labelEn: 'Science' },
  { id: 'art', label: '아트', labelEn: 'Art' },
  { id: 'game', label: '게임', labelEn: 'Game' },
];

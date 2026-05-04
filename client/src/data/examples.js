/**
 * VPyLab 대표 예제 20선
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
        s.pos = vector(
            s.dist * math.cos(s.angle),
            s.pos.y,
            s.dist * math.sin(s.angle)
        )
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
        d.pos = vector(d.pos.x, d.pos.y - d.speed, d.pos.z)

        # 바닥에 닿으면 위로 리셋 + 소리
        if d.pos.y < -3:
            if random.random() < 0.3:
                freq = random.uniform(800, 2000)
                play_sound(freq, 0.05, 'sine', 0.1)
            d.pos = vector(random.uniform(-5, 5), 8, d.pos.z)
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
    p.pos = vector(p.pos.x, p.base_y - 0.2, p.pos.z)
    악기('피아노', p.note, 0.4)

    # 드럼 회전
    drum.pos = vector(-3, 2 + 0.05 * math.sin(idx * 0.5), 0)

    await rate(8)
    p.pos = vector(p.pos.x, p.base_y, p.pos.z)  # 음판 복귀

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
            b.pos = vector(b.pos.x, b.base_y + vol * 2, b.pos.z)
            play_sound(b.freq, 0.1, 'square', vol * 0.3)

    await rate(16)
    for b in balls:
        b.pos = vector(b.pos.x, b.base_y, b.pos.z)

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

            dots[i][j].pos = vector(dots[i][j].pos.x, y, dots[i][j].pos.z)

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

        s.pos = vector(
            r * math.cos(angle),
            0.5 * math.sin(t * 3 + s.ring_r),
            r * math.sin(angle)
        )

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

  // ═══════════════════════════════════════
  // ✨ v3 신규 기능 쇼케이스 (5개)
  // ═══════════════════════════════════════
  {
    id: 'showcase-shapes',
    title: '새 도형 모음 (피라미드/타원체/나선/라벨)',
    thumbnail: '🔷',
    category: 'creative',
    level: 1,
    description: 'v3에서 추가된 pyramid, ellipsoid, helix, label 객체를 한 화면에서 비교',
    tags: ['shapes', 'label', 'helix'],
    code: `from vpython import *

# v3에서 새로 추가된 3D 객체들
# ──────────────────────────────────────────

# pyramid: 사각뿔. size=(축방향 높이, 폭, 깊이)
pyramid(pos=vector(-3, 0, 0), size=vector(1.5, 1, 1),
        color=color.gold, axis=vector(0, 1, 0))
label(pos=vector(-3, 1.5, 0), text="피라미드",
      color=color.white, height=14)

# ellipsoid: 타원체. size=(x폭, y높이, z깊이)
ellipsoid(pos=vector(0, 0, 0), size=vector(1.4, 0.8, 0.6),
          color=color.skyblue)
label(pos=vector(0, 1.0, 0), text="타원체",
      color=color.white, height=14)

# helix: 나선/스프링. radius=반경, length=길이, coils=감김 수
helix(pos=vector(2.5, -0.5, 0), axis=vector(1, 0, 0),
      radius=0.4, length=2, coils=8, thickness=0.04,
      color=color.coral)
label(pos=vector(3.5, 0.7, 0), text="나선",
      color=color.white, height=14)

# 배경 + 카메라 시야 고정
scene.background = vector(0.05, 0.05, 0.1)
scene.center = vector(0, 0, 0)
scene.range = 4
`
  },

  {
    id: 'showcase-curve',
    title: '동적 곡선 (curve로 사인파 그리기)',
    thumbnail: '〰️',
    category: 'math',
    level: 2,
    description: 'curve 객체에 점을 누적하면서 실시간으로 곡선이 그려집니다',
    tags: ['curve', 'animation', 'math'],
    code: `from vpython import *
import math

# curve는 점을 append할 때마다 선분이 누적되어 그려집니다.
# 시간에 따라 사인 함수의 그래프를 그려봅니다.
# ──────────────────────────────────────────

scene.background = vector(0.05, 0.05, 0.1)

# 빨간 곡선과 노란 곡선을 동시에
sine_curve = curve(color=color.red)
cosine_curve = curve(color=color.yellow)

# 라벨로 어느 곡선이 무엇인지 표시
label(pos=vector(0, 1.5, 0), text="빨강=sin, 노랑=cos",
      color=color.white, height=14)

# 0부터 6π까지 점을 추가
x = 0
for step in range(300):
    sine_curve.append(vector(x, math.sin(x), 0))
    cosine_curve.append(vector(x, math.cos(x), 0))
    x += 0.06
    rate(120)
`
  },

  {
    id: 'showcase-clone-rotate',
    title: 'clone + rotate로 12지 시계',
    thumbnail: '🕰️',
    category: 'creative',
    level: 2,
    description: '한 객체를 복제하고 회전시켜 시계 모양 12개 마커를 만듭니다',
    tags: ['clone', 'rotate', 'pattern'],
    code: `from vpython import *
import math

# .clone(**kwargs)로 객체를 복제하고 일부 속성만 덮어씁니다.
# vector.rotate(angle, axis)로 회전한 위치를 계산합니다.
# ──────────────────────────────────────────

scene.background = vector(0.95, 0.95, 0.97)

# 시계 외곽
ring(pos=vector(0, 0, 0), radius=3.2, thickness=0.1,
     color=color.gray, axis=vector(0, 0, 1))

# 12시 위치의 기준 마커
marker = box(pos=vector(0, 3, 0), size=vector(0.3, 0.6, 0.2),
             color=color.navy)

# 12개 위치로 회전 복제
for i in range(1, 12):
    angle = -i * math.pi / 6  # 시계방향
    new_pos = vector(0, 3, 0).rotate(angle, axis=vector(0, 0, 1))
    # 정시(3,6,9,12)는 더 두껍게, 그 외는 얇게
    is_main = (i % 3 == 0)
    marker.clone(
        pos=new_pos,
        size=vector(0.25, 0.5, 0.2) if is_main else vector(0.15, 0.3, 0.15),
        color=color.navy if is_main else color.gray,
    )

# 시침
arrow(pos=vector(0, 0, 0), axis=vector(0, 2, 0),
      shaftwidth=0.15, color=color.red)
# 분침
arrow(pos=vector(0, 0, 0), axis=vector(2.5, 0, 0),
      shaftwidth=0.08, color=color.black)

scene.range = 4
`
  },

  {
    id: 'showcase-event-click',
    title: '클릭으로 공 만들기 (이벤트)',
    thumbnail: '👆',
    category: 'interactive',
    level: 3,
    description: 'scene.bind("click")으로 마우스 클릭 위치에 공을 생성합니다',
    tags: ['events', 'interactive', 'click'],
    code: `from vpython import *
import random

# scene.bind('event_name', handler)로 이벤트 핸들러 등록.
# 핸들러는 evt.pos(클릭된 월드 좌표), evt.pick(클릭된 객체 id) 정보를 받습니다.
# rate() 호출 시점에 자동으로 디스패치됩니다.
# ──────────────────────────────────────────

scene.background = vector(0.05, 0.1, 0.15)

# 안내 라벨
label(pos=vector(0, 3, 0), text="3D 화면을 클릭해 보세요!",
      color=color.white, height=20, background=color.black)

# 바닥 평면 (z=0 평면 시각화)
box(pos=vector(0, -0.05, 0), size=vector(8, 0.05, 8),
    color=color.gray, opacity=0.3)

# 클릭 핸들러
def on_click(evt):
    # evt.pos는 월드 좌표 (z=0 평면 또는 클릭된 객체 표면)
    if evt.pos is None:
        return
    # 무지개 색 중 무작위
    rainbow_colors = [color.red, color.orange, color.yellow,
                      color.green, color.cyan, color.blue, color.purple]
    sphere(pos=evt.pos, radius=0.3,
           color=random.choice(rainbow_colors),
           emissive=True)

scene.bind('click', on_click)

# 이벤트 디스패치를 위해 rate() 루프 필요
while True:
    rate(30)
`
  },

  {
    id: 'showcase-keyboard-bouncing',
    title: '키보드로 공 조종하기',
    thumbnail: '⌨️',
    category: 'interactive',
    level: 3,
    description: '방향키 입력에 따라 공이 움직이고 벽에 부딪히면 튕깁니다',
    tags: ['events', 'keyboard', 'physics'],
    code: `from vpython import *

# scene.bind('keydown', handler)로 키보드 이벤트 처리.
# evt.key에 눌린 키 이름이 들어옵니다 ('ArrowUp', 'ArrowLeft' 등)
# ──────────────────────────────────────────

scene.background = vector(0.1, 0.1, 0.15)

# 경기장 — 4면 벽
WALL = 4
for sx, sy in [(WALL, 0), (-WALL, 0), (0, WALL), (0, -WALL)]:
    if sx != 0:
        box(pos=vector(sx, 0, 0), size=vector(0.2, WALL*2, 0.5), color=color.gray)
    else:
        box(pos=vector(0, sy, 0), size=vector(WALL*2, 0.2, 0.5), color=color.gray)

# 플레이어 공
ball = sphere(pos=vector(0, 0, 0), radius=0.3,
              color=color.lime, emissive=True, make_trail=True)
ball.velocity = vector(0, 0, 0)

# 안내 라벨
label(pos=vector(0, WALL+0.5, 0),
      text="화살표 키로 가속, Space로 정지",
      color=color.white, height=16)

# 방향키 → 가속도 부여
def on_key(evt):
    accel = 0.05
    if evt.key == 'ArrowUp':    ball.velocity += vector(0, accel, 0)
    elif evt.key == 'ArrowDown': ball.velocity += vector(0, -accel, 0)
    elif evt.key == 'ArrowLeft': ball.velocity += vector(-accel, 0, 0)
    elif evt.key == 'ArrowRight':ball.velocity += vector(accel, 0, 0)
    elif evt.key == ' ':         ball.velocity = vector(0, 0, 0)

scene.bind('keydown', on_key)

# 메인 루프 — 위치/벽 충돌 처리
while True:
    rate(60)
    ball.pos += ball.velocity
    # 벽 반사
    if abs(ball.pos.x) > WALL - ball.radius:
        ball.velocity.x = -ball.velocity.x * 0.9
        ball.pos.x = (WALL - ball.radius) * (1 if ball.pos.x > 0 else -1)
    if abs(ball.pos.y) > WALL - ball.radius:
        ball.velocity.y = -ball.velocity.y * 0.9
        ball.pos.y = (WALL - ball.radius) * (1 if ball.pos.y > 0 else -1)
`
  },

  {
    id: 'showcase-slider-control',
    title: '슬라이더로 공 크기 조절',
    thumbnail: '🎚️',
    category: 'interactive',
    level: 2,
    description: 'UI 슬라이더로 객체 속성을 실시간으로 바꿉니다',
    tags: ['widget', 'slider', 'interactive'],
    code: `from vpython import *

# slider(min, max, step, value, bind=callback)로 UI 슬라이더 추가.
# 콜백은 evt.value로 슬라이더 값을 받습니다.
# ──────────────────────────────────────────

scene.background = vector(0.95, 0.95, 0.98)

ball = sphere(pos=vector(0, 0, 0), radius=0.5,
              color=color.coral, emissive=True)

label(pos=vector(0, 1.8, 0),
      text="우상단 슬라이더로 크기를 바꿔보세요",
      color=color.black, height=14)

# 슬라이더 콜백 — 슬라이더 값을 공의 반지름으로
def on_slide(evt):
    ball.radius = evt.value

slider(min=0.1, max=2.0, step=0.05, value=0.5,
       length=200, bind=on_slide)

# 버튼 콜백 — 색을 무작위로
def on_color(evt):
    import random
    palette = [color.red, color.green, color.blue,
               color.yellow, color.cyan, color.magenta, color.coral]
    ball.color = random.choice(palette)

button(text='색 바꾸기', bind=on_color)

# 이벤트 디스패치를 위해 rate() 루프 필요
while True:
    rate(30)
`
  },

  // ═══════════════════════════════════════
  // 🧪 v3 확장 쇼케이스 (8개) — 미커버 기능 보충
  // ═══════════════════════════════════════
  {
    id: 'showcase-vertex-rainbow',
    title: '정점 색상으로 만드는 무지개 부채',
    thumbnail: '🌈',
    category: 'creative',
    level: 2,
    description: 'vertex와 triangle로 정점마다 다른 색을 주어 그라디언트 면을 만듭니다',
    tags: ['vertex', 'triangle', 'gradient'],
    code: `from vpython import *
import math

# vertex(pos, color)는 위치+색을 가진 점.
# triangle(v0, v1, v2)은 3정점으로 면을 만들고, 정점 색이 자연스럽게 보간됩니다.
# ──────────────────────────────────────────

scene.background = vector(0.05, 0.05, 0.1)

# 무지개 7색 — 부채꼴 12조각으로 색이 흘러가게
rainbow_colors = [color.red, color.orange, color.yellow,
                  color.green, color.cyan, color.blue, color.purple]

N = 24                # 부채 조각 수
R = 3.0               # 반경
center = vertex(pos=vector(0, 0, 0), color=color.white)

prev_outer = None
for i in range(N + 1):
    angle = (i / N) * math.pi  # 0 ~ π (반원)
    outer_pos = vector(R * math.cos(angle), R * math.sin(angle), 0)
    # 무지개 색을 부드럽게 보간
    t = i / N * (len(rainbow_colors) - 1)
    idx = int(t)
    frac = t - idx
    if idx >= len(rainbow_colors) - 1:
        col = rainbow_colors[-1]
    else:
        a = rainbow_colors[idx]
        b = rainbow_colors[idx + 1]
        col = a * (1 - frac) + b * frac
    outer = vertex(pos=outer_pos, color=col)
    if prev_outer is not None:
        triangle(v0=center, v1=prev_outer, v2=outer)
    prev_outer = outer

label(pos=vector(0, -0.7, 0), text="정점 색이 면 위에서 그라디언트로 보간됩니다",
      color=color.white, height=14)
`
  },

  {
    id: 'showcase-platonic-solids',
    title: 'triangle/quad로 만드는 다면체',
    thumbnail: '🔺',
    category: 'math',
    level: 3,
    description: '직접 정점을 만들어 정사면체와 정육면체를 구성합니다',
    tags: ['triangle', 'quad', 'geometry'],
    code: `from vpython import *
import math

# triangle/quad는 vertex 리스트로 면을 만드는 저수준 메시.
# 정사면체(4면)와 정육면체(6면)를 직접 구성해봅시다.
# ──────────────────────────────────────────

scene.background = vector(0.97, 0.97, 0.99)

# === 정사면체 ===
# 4개의 정점 좌표 (중심이 원점)
a = math.sqrt(2/3)
b = math.sqrt(8/9)
verts_t = [
    vector(0, a, 0),
    vector(b, -a/3, 0),
    vector(-b/2, -a/3, math.sqrt(2/3)),
    vector(-b/2, -a/3, -math.sqrt(2/3)),
]
# 정사면체는 4개의 삼각형 면
faces_t = [(0,1,2), (0,2,3), (0,3,1), (1,3,2)]
for f in faces_t:
    triangle(
        v0=vertex(pos=verts_t[f[0]] + vector(-2, 0, 0), color=color.red),
        v1=vertex(pos=verts_t[f[1]] + vector(-2, 0, 0), color=color.green),
        v2=vertex(pos=verts_t[f[2]] + vector(-2, 0, 0), color=color.blue),
    )
label(pos=vector(-2, -1.5, 0), text="정사면체 (4면)",
      color=color.black, height=14)

# === 정육면체 ===
# 8개 정점, 6개 사각형 면
s = 0.7
verts_c = [
    vector(-s, -s, -s), vector( s, -s, -s),
    vector( s,  s, -s), vector(-s,  s, -s),
    vector(-s, -s,  s), vector( s, -s,  s),
    vector( s,  s,  s), vector(-s,  s,  s),
]
# 면 인덱스 (반시계 방향 보장)
faces_c = [
    (0, 3, 2, 1),  # 뒤
    (4, 5, 6, 7),  # 앞
    (0, 1, 5, 4),  # 아래
    (2, 3, 7, 6),  # 위
    (1, 2, 6, 5),  # 오른쪽
    (0, 4, 7, 3),  # 왼쪽
]
face_colors = [color.red, color.orange, color.yellow,
               color.green, color.blue, color.purple]
for face, fc in zip(faces_c, face_colors):
    quad(vs=[
        vertex(pos=verts_c[face[0]] + vector(2, 0, 0), color=fc),
        vertex(pos=verts_c[face[1]] + vector(2, 0, 0), color=fc),
        vertex(pos=verts_c[face[2]] + vector(2, 0, 0), color=fc),
        vertex(pos=verts_c[face[3]] + vector(2, 0, 0), color=fc),
    ])
label(pos=vector(2, -1.5, 0), text="정육면체 (6면)",
      color=color.black, height=14)
`
  },

  {
    id: 'showcase-extrusion-tube',
    title: 'extrusion으로 만드는 휘어진 튜브',
    thumbnail: '🌀',
    category: 'creative',
    level: 3,
    description: '2D 단면을 3D 경로(path)로 압출해 자유로운 곡선 튜브를 만듭니다',
    tags: ['extrusion', 'curve', 'path'],
    code: `from vpython import *
import math

# extrusion(path, shape)은 2D shape를 3D path를 따라 스윕합니다.
# path: 3D 점 리스트, shape: (x, y) 2D 외곽선 좌표
# ──────────────────────────────────────────

scene.background = vector(0.05, 0.08, 0.12)

# 1) 별 모양 단면
def star_shape(n_points=5, outer=0.5, inner=0.2):
    pts = []
    for i in range(n_points * 2):
        r = outer if i % 2 == 0 else inner
        ang = i * math.pi / n_points
        pts.append((r * math.cos(ang), r * math.sin(ang)))
    return pts

# 2) 나선형 경로
spiral_path = []
for i in range(40):
    t = i * 0.2
    spiral_path.append(vector(t - 4, math.sin(t) * 1.5, math.cos(t) * 1.5))

extrusion(path=spiral_path, shape=star_shape(n_points=5),
          color=color.gold)

# 3) 원형 단면 + 직선 path (속이 빈 파이프 같은 단순한 튜브)
circle_shape = [(0.2 * math.cos(a * math.pi / 8),
                 0.2 * math.sin(a * math.pi / 8)) for a in range(16)]
straight_path = [vector(t, -2, 0) for t in range(-3, 4)]
extrusion(path=straight_path, shape=circle_shape, color=color.cyan)

label(pos=vector(0, 3, 0), text="별 모양을 나선 경로로 압출",
      color=color.white, height=14)
label(pos=vector(0, -2.7, 0), text="원형 단면 + 직선 경로",
      color=color.white, height=12)
`
  },

  {
    id: 'showcase-keysdown-spaceship',
    title: 'keysdown으로 우주선 조종하기',
    thumbnail: '🚀',
    category: 'game',
    level: 3,
    description: '여러 키를 동시에 누를 수 있는 keysdown() 폴링으로 우주선을 자유롭게 움직입니다',
    tags: ['keysdown', 'game', 'multi-key'],
    code: `from vpython import *

# scene.bind('keydown')은 1회 누름마다 발생 — 게임 같은 동시 입력에는 부적합.
# keysdown()은 현재 눌린 모든 키 리스트를 반환 — 여러 키 동시 처리에 이상적.
# 예: 위+오른쪽을 함께 누르면 대각선 비행
# ──────────────────────────────────────────

scene.background = vector(0.02, 0.02, 0.08)

# 우주선 (compound로 본체+엔진 묶기)
hull = cone(pos=vector(0, 0, 0), axis=vector(0, 0.5, 0),
            radius=0.2, color=color.silver)
engine = cylinder(pos=vector(0, -0.3, 0), axis=vector(0, 0.2, 0),
                  radius=0.15, color=color.red)
ship = compound([hull, engine], pos=vector(0, 0, 0), make_trail=True,
                trail_color=color.cyan)

# 별들 (배경)
import random
for _ in range(60):
    sphere(pos=vector(random.uniform(-8,8), random.uniform(-5,5), random.uniform(-3,3)),
           radius=0.04, color=color.white, emissive=True)

label(pos=vector(0, 4.5, 0),
      text="WASD 또는 화살표로 비행 (동시 누르기 OK), Space로 정지",
      color=color.white, height=14)

speed = 0.05
while True:
    rate(60)
    keys = keysdown()  # 현재 눌려있는 키 리스트
    dx, dy = 0, 0
    if 'ArrowUp' in keys or 'w' in keys:    dy += speed
    if 'ArrowDown' in keys or 's' in keys:  dy -= speed
    if 'ArrowLeft' in keys or 'a' in keys:  dx -= speed
    if 'ArrowRight' in keys or 'd' in keys: dx += speed
    if ' ' in keys:
        ship.clear_trail()  # Space — 궤적 지우기

    if dx != 0 or dy != 0:
        ship.pos = ship.pos + vector(dx, dy, 0)
        # 화면 경계 wrap
        if ship.pos.x > 6:  ship.pos = vector(-6, ship.pos.y, 0)
        if ship.pos.x < -6: ship.pos = vector(6, ship.pos.y, 0)
        if ship.pos.y > 4:  ship.pos = vector(ship.pos.x, -4, 0)
        if ship.pos.y < -4: ship.pos = vector(ship.pos.x, 4, 0)
`
  },

  {
    id: 'showcase-mouse-follow',
    title: 'scene.mouse로 마우스 따라다니기',
    thumbnail: '🖱️',
    category: 'interactive',
    level: 2,
    description: 'scene.mouse.pos를 폴링해 마우스 위치를 부드럽게 추적하는 공',
    tags: ['mouse', 'interactive', 'follow'],
    code: `from vpython import *

# scene.mouse.pos는 현재 마우스의 월드 좌표(z=0 평면 기준).
# 매 프레임 폴링해서 그 위치로 부드럽게 다가가는 공을 만듭니다.
# ──────────────────────────────────────────

scene.background = vector(0.95, 0.97, 1.0)
scene.center = vector(0, 0, 0)
scene.range = 5

# 따라다니는 공
follower = sphere(pos=vector(0, 0, 0), radius=0.3,
                  color=color.coral, emissive=True,
                  make_trail=True, trail_color=color.coral)

# 안내 라벨
label(pos=vector(0, 4, 0),
      text="3D 화면에서 마우스를 움직여보세요!",
      color=color.black, height=16,
      background=color.white)

# 십자 가이드
box(pos=vector(0, 0, -0.1), size=vector(10, 0.02, 0.01), color=color.gray, opacity=0.5)
box(pos=vector(0, 0, -0.1), size=vector(0.02, 8, 0.01), color=color.gray, opacity=0.5)

# 보간 비율 (0.0 = 안 움직임, 1.0 = 즉시 따라감)
SMOOTHING = 0.08

while True:
    rate(60)
    target = scene.mouse.pos  # vector(x, y, z) — 마우스가 가리키는 월드 좌표
    # follower.pos를 target 방향으로 부드럽게 보간
    delta = target - follower.pos
    follower.pos = follower.pos + delta * SMOOTHING
`
  },

  {
    id: 'showcase-graph-functions',
    title: '슬라이더로 함수 그래프 조절',
    thumbnail: '📈',
    category: 'math',
    level: 3,
    description: 'A·sin(B·x + C) 함수의 진폭/주파수/위상을 슬라이더로 실시간 조절',
    tags: ['graph', 'gcurve', 'slider', 'math'],
    code: `from vpython import *
import math

# 2D 그래프(graph + gcurve)와 슬라이더를 결합한 인터랙티브 시각화.
# 슬라이더 값이 바뀔 때마다 함수 그래프가 다시 그려집니다.
# ──────────────────────────────────────────

# 그래프 캔버스
g = graph(title='A · sin(B · x + C)', xtitle='x', ytitle='y',
          width=480, height=300,
          xmin=0, xmax=4*math.pi, ymin=-3, ymax=3)
fcurve = gcurve(graph=g, color=color.blue)

# 현재 파라미터 (가변)
state = {'A': 1.0, 'B': 1.0, 'C': 0.0}

def redraw():
    fcurve.delete()  # 이전 시리즈 제거
    new_curve = gcurve(graph=g, color=color.blue)
    state['curve'] = new_curve
    A, B, C = state['A'], state['B'], state['C']
    for i in range(200):
        x = i * 4 * math.pi / 200
        y = A * math.sin(B * x + C)
        new_curve.plot(x, y)

state['curve'] = fcurve
redraw()

# 슬라이더 콜백들
def on_A(evt):
    state['A'] = evt.value
    redraw()
def on_B(evt):
    state['B'] = evt.value
    redraw()
def on_C(evt):
    state['C'] = evt.value
    redraw()

slider(min=0.1, max=3.0, step=0.1, value=1.0, length=180, bind=on_A)
slider(min=0.5, max=4.0, step=0.1, value=1.0, length=180, bind=on_B)
slider(min=0, max=2*math.pi, step=0.1, value=0, length=180, bind=on_C)

label(pos=vector(0, 0, 0),
      text="위에서부터 A(진폭), B(주파수), C(위상) 슬라이더",
      color=color.gray, height=14)

while True:
    rate(30)
`
  },

  {
    id: 'showcase-scatter-regression',
    title: '산점도와 회귀선 (gdots + gcurve)',
    thumbnail: '📊',
    category: 'math',
    level: 3,
    description: '랜덤 데이터의 산점도와 자동 계산된 회귀선을 함께 표시',
    tags: ['gdots', 'gcurve', 'data', 'statistics'],
    code: `from vpython import *
import random

# gdots(점)와 gcurve(선)를 같은 graph 안에서 함께 사용합니다.
# 노이즈가 섞인 선형 데이터에 최소제곱 회귀선을 그어봅시다.
# ──────────────────────────────────────────

# 1) 데이터 생성: y = 2x + 5 + 노이즈
points_data = []
for _ in range(40):
    x = random.uniform(0, 10)
    y = 2 * x + 5 + random.gauss(0, 2.5)
    points_data.append((x, y))

# 2) 최소제곱 회귀 (slope=m, intercept=b)
n = len(points_data)
sx = sum(p[0] for p in points_data)
sy = sum(p[1] for p in points_data)
sxx = sum(p[0]**2 for p in points_data)
sxy = sum(p[0]*p[1] for p in points_data)
m = (n*sxy - sx*sy) / (n*sxx - sx**2)
b = (sy - m*sx) / n
print(f"회귀식: y = {m:.3f} · x + {b:.3f}")

# 3) 그래프에 점과 선 함께 그리기
g = graph(title='선형 회귀', xtitle='x', ytitle='y',
          width=480, height=320, xmin=0, xmax=10)

# 산점도
dots = gdots(graph=g, color=color.red, size=6)
for x, y in points_data:
    dots.plot(x, y)

# 회귀선
line = gcurve(graph=g, color=color.blue)
for i in range(11):
    line.plot(i, m * i + b)

# 진짜 정답선 (참고용)
truth = gcurve(graph=g, color=color.gray)
for i in range(11):
    truth.plot(i, 2 * i + 5)

print("빨간 점 = 데이터, 파란 선 = 회귀, 회색 선 = 진짜 식")
`
  },

  {
    id: 'showcase-pendulum-trail',
    title: '진자 운동과 attach_trail',
    thumbnail: '🪀',
    category: 'science',
    level: 2,
    description: '단순 진자의 진동을 실시간으로 시뮬레이션하고 끝점의 궤적을 그립니다',
    tags: ['physics', 'attach_trail', 'simulation'],
    code: `from vpython import *
import math

# attach_trail()은 객체에 동적으로 궤적을 부착합니다.
# 진자의 끝점(bob)이 그리는 곡선을 관찰해봅시다.
# ──────────────────────────────────────────

scene.background = vector(0.95, 0.96, 0.98)
scene.range = 3

# 천장 고정점
pivot = sphere(pos=vector(0, 2, 0), radius=0.05, color=color.black)

# 끈 (cylinder) + 추 (sphere)
L = 1.8                      # 진자 길이
theta = math.radians(45)     # 초기 각도 (수직에서 시각)
omega = 0                    # 각속도
g = 9.81                     # 중력 가속도

bob = sphere(pos=pivot.pos + vector(L*math.sin(theta), -L*math.cos(theta), 0),
             radius=0.15, color=color.red, emissive=True)

# 추에 궤적 부착 (생성 후에도 추가 가능)
bob.attach_trail(color=color.blue, retain=500)

string = cylinder(pos=pivot.pos, axis=bob.pos - pivot.pos,
                  radius=0.015, color=color.gray)

label(pos=vector(0, 2.7, 0),
      text="단순 진자 — 빨간 추가 그리는 궤적을 관찰하세요",
      color=color.black, height=14)
label(pos=vector(0, -1.5, 0),
      text="(작은 진폭에서는 거의 직선, 큰 진폭에서는 둥근 호)",
      color=color.gray, height=12)

# 시뮬레이션 루프 (Euler 적분)
dt = 0.02
while True:
    rate(50)
    # θ'' = -g/L · sin(θ) — 진자 운동 방정식
    alpha = -g / L * math.sin(theta)
    omega += alpha * dt
    omega *= 0.999  # 미세 감쇠
    theta += omega * dt
    # 추 위치 업데이트
    bob.pos = pivot.pos + vector(L*math.sin(theta), -L*math.cos(theta), 0)
    string.axis = bob.pos - pivot.pos
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
  { id: 'creative', label: '창의', labelEn: 'Creative' },
  { id: 'math', label: '수학', labelEn: 'Math' },
  { id: 'interactive', label: '인터랙티브', labelEn: 'Interactive' },
];

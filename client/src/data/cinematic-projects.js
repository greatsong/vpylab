export const cometCode = `from vpython import *
import random

# 전시용 태양계입니다. 크기·거리·공전 속도는 한 화면에서 관찰하도록 조정했습니다.
scene.background = vector(0.003, 0.006, 0.018)
scene.range = 18
scene.lights = []
scene.ambient = color.gray(0.18)
sun = sphere(radius=1.15, color=vector(1, 0.86, 0.50), texture=textures.sun, emissive=True)
local_light(pos=sun.pos, color=vector(1, 0.96, 0.88), intensity=95)

# 별은 밝기별로 모아 세 개의 점 집합으로 그립니다.
random.seed(42)
for count, tint, radius in [(1350, (0.39, 0.48, 0.64), 0.045), (510, (0.72, 0.80, 1), 0.075), (140, (1, 0.86, 0.67), 0.10)]:
    stars = []
    for i in range(count):
        y = random.uniform(-1, 1)
        a = random.uniform(0, 2*pi)
        h = sqrt(1-y*y)
        stars.append(85 * vector(h*cos(a), y, h*sin(a)))
    points(pos=stars, color=vector(*tint), radius=radius, size_units='world')

# 행성을 추가하거나 고칠 때는 거리, 반지름, 색, 각속도, 출발 각도를 바꾸세요.
data = [
    (2.0, 0.15, (0.65, 0.60, 0.53), 1.65, 1.8),  # 수성
    (3.0, 0.27, (0.98, 0.76, 0.47), 1.25, 3.7),  # 금성
    (4.5, 0.40, (1, 1, 1),          0.85, 0.5),  # 지구
    (6.3, 0.24, (0.92, 0.37, 0.18), 0.64, 4.8),  # 화성
    (8.3, 0.90, (0.96, 0.72, 0.49), 0.38, 2.5),  # 목성
    (10.7, 0.74, (0.98, 0.84, 0.60), 0.27, 5.8), # 토성
    (13.1, 0.49, (0.49, 0.90, 0.91), 0.19, 3.5), # 천왕성
    (15.4, 0.47, (0.30, 0.49, 0.98), 0.14, 0.95) # 해왕성
]
planets = []
for distance, radius, tint, speed, phase in data:
    path = [distance * vector(cos(i*pi/90), 0, sin(i*pi/90)) for i in range(181)]
    curve(pos=path, color=vector(0.09, 0.14, 0.21))
    planets.append(sphere(radius=radius, color=vector(*tint), shininess=0.10))
planets[4].texture = textures.jupiter
earth = planets[2]
earth.texture = textures.earth
moon = sphere(radius=0.14, texture=textures.moon, shininess=0)
rings = []
for r, width, tone in [(0.99, 0.028, 0.54), (1.08, 0.045, 0.78), (1.20, 0.022, 0.62)]:
    rings.append(ring(radius=r, thickness=width, axis=vector(0.32, 1, 0.18), color=vector(tone, 0.86*tone, 0.66*tone)))

# 혜성: 근일점 거리와 이심률을 바꾸면 궤도와 먼지의 분포가 함께 바뀝니다.
q = 2.8
eccentricity = 0.68
mu = 14
comet = sphere(pos=vector(-q,0,0), radius=0.13, texture=textures.rock)
velocity = vector(0, 0.18, 0.984).norm() * sqrt(mu*(1+eccentricity)/q)
coma = sphere(radius=0.24, color=vector(0.42,0.95,0.82), opacity=0.22, emissive=True)
ion = curve(color=vector(0.17,0.48,1))
dust = points(size_units='world', radius=0.042, color=vector(0.88,0.70,0.49))
grains = []
tick = 0

view = menu(choices=["태양계 전체", "지표에서 달 보기", "지표에서 태양 보기", "지표에서 혜성 보기", "혜성 따라가기"])
pace = slider(min=0, max=3, value=1, step=0.1, text="공전 속도 (0 = 정지)")
last_view = -1
message = ""
t = 0
while True:
    rate(60)
    dt = 0.004 * pace.value
    if dt > 0:
        # 태양 중력으로 핵을 이동하고, 먼지에는 복사압을 단순화한 작은 유효중력을 적용합니다.
        velocity -= mu * norm(comet.pos) * dt / mag(comet.pos)**2
        comet.pos += velocity * dt
        if tick % 3 == 0:
            grains.append([vector(comet.pos.x, comet.pos.y, comet.pos.z), velocity + 0.16*vector(random.random()-.5, random.random()-.5, random.random()-.5), random.uniform(.18,.72)])
            grains = grains[-96:]
        for grain in grains:
            grain[1] -= mu * (1-grain[2]) * norm(grain[0]) * dt / mag(grain[0])**2
            grain[0] += grain[1] * dt
        if tick % 3 == 0:
            dust.splice(0, dust.npoints, [g[0] for g in grains])
        tick += 1
    coma.pos = comet.pos
    if tick % 6 == 1 and dt > 0:
        coma.radius = .17 + .14 * min(1,(q/mag(comet.pos))**2)
    ion.splice(0, ion.npoints, [comet.pos, comet.pos + 2.8*norm(comet.pos)*(q/mag(comet.pos))**2])
    for p, (distance, radius, tint, speed, phase) in zip(planets, data):
        a = phase + speed*t
        p.pos = distance * vector(cos(a), 0, sin(a))
    for band in rings:
        band.pos = planets[5].pos
    m = 2.4 + 5*t
    moon.pos = earth.pos + 0.95*vector(cos(m), 0.12*sin(m), 0.993*sin(m))
    spin = 2.8 + 9*t
    earth.axis = vector(cos(spin), 0, sin(spin))
    mode = view.index
    if mode == 0:
        status = "드래그로 회전 · 확대해서 지구와 달, 토성의 고리를 관찰하세요."
        if last_view != 0:
            scene.up = vector(0, 1, 0)
            scene.fov = pi/3
            scene.camera.pos = vector(0, 13, 24)
            scene.camera.axis = vector(0, -13, -24)
    elif mode == 4:
        scene.up = vector(0,1,0)
        scene.camera.pos = comet.pos + vector(0,1.6,3.4)
        scene.camera.axis = comet.pos - scene.camera.pos
        status = "푸른 이온 꼬리와 앞서 방출한 먼지를 비교하세요."
    else:
        zenith = vector(cos(pi/6)*cos(spin), sin(pi/6), cos(pi/6)*sin(spin))
        eye = earth.pos + 0.42*zenith
        direction = (moon.pos if mode == 1 else sun.pos if mode == 2 else comet.pos) - eye
        altitude = dot(direction, zenith)
        scene.up = zenith
        scene.fov = pi/3
        scene.camera.pos = eye
        scene.camera.axis = direction if altitude >= 0 else direction - altitude*zenith
        status = view.selected + (" · 지평선 위" if altitude >= 0 else " · 지평선 아래")
    if message != status:
        scene.caption = status
        message = status
    last_view = mode
    t += 0.004*pace.value
`;

export const timbreCode = `from vpython import *
from time import monotonic
scene.title = "빛으로 연주하는 다섯 음"
scene.caption = "버튼을 누르거나 숫자 1~5로 연주하세요."
notes = ["C4", "D4", "E4", "G4", "A4"]
timbres = ["felt", "marimba", "glass"]
voice = menu(choices=["펠트 피아노", "마림바", "유리종"])
room = checkbox(text="공간 잔향", checked=False)
volume = slider(min=0.1, max=1, value=0.42, text="연주 세기")
colors = [color.cyan, color.green, color.yellow, color.orange, color.magenta]
keys = [box(pos=vector(i-2,0,0), size=vector(.86,.25,2), color=colors[i]) for i in range(5)]
lights = [local_light(pos=k.pos+vector(0,.45,.5), color=k.color, intensity=0) for k in keys]
box(pos=vector(0,-.28,0), size=vector(6,.2,3), color=color.gray(.19))
ends = [0]*5
scene.forward = vector(0,-.65,-1)
def strike(i):
    ends[i] = monotonic() + .65
    play_note(notes[i], .65, type=timbres[voice.index] + ("-room" if room.checked else ""), volume=volume.value)
for i in range(5):
    button(text=str(i+1), bind=lambda b, i=i: strike(i))
def on_key(e):
    if e.key in ["1","2","3","4","5"]:
        strike(int(e.key)-1)
scene.bind("keydown", on_key)
while True:
    rate(45)
    for i in range(5):
        glow = max(0, (ends[i]-monotonic())/.65)
        if keys[i].emissive != (glow > .1):
            keys[i].emissive = glow > .1
        if lights[i].intensity != 3*glow**2:
            lights[i].intensity = 3*glow**2
`;

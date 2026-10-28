# 4차시: 충돌을 8음 선율로 기록하고 순서대로 들어봅니다.
# 컬러 비트 핀볼: 공식 MIT Bounce.py의 벽 반사를 읽고 새 목적으로 확장합니다.
# 원작 고정 SHA: 3254f6e4b845fdf27d8730b66887a9806d1822b3 (ATTRIBUTION.md 참고)
from vpython import *
scene.background = vector(0.025, 0.045, 0.095)
scene.range = 5.2
scene.autoscale = False
palette = [vector(1, 0.47, 0.27), vector(0.20, 0.78, 0.96), vector(1, 0.81, 0.28), vector(0.35, 0.91, 0.68), vector(0.75, 0.57, 1)]
notes = ["C5", "D5", "E5", "G5", "A5"]
box(pos=vector(0, 0, -0.6), size=vector(8.35, 8.35, 0.25), color=vector(0.08, 0.12, 0.22))
box(pos=vector(-4, 0, 0), size=vector(0.18, 8.2, 0.6), color=palette[1])
box(pos=vector(4, 0, 0), size=vector(0.18, 8.2, 0.6), color=palette[4])
box(pos=vector(0, 4, 0), size=vector(8.2, 0.18, 0.6), color=palette[3])
box(pos=vector(0, -4, 0), size=vector(8.2, 0.18, 0.6), color=palette[0])
ball = sphere(pos=vector(-3.25, -3.15, 0.1), radius=0.23, color=color.white, make_trail=True, retain=100)
velocity = vector(2.7, 3.5, 0)
dt = 1 / 60
bumper_positions = [vector(-2.3, 1.4, 0), vector(0, 2.2, 0), vector(2.3, 1.4, 0), vector(-1.45, -1.05, 0), vector(1.45, -1.05, 0)]
bumpers = []
counts = [0, 0, 0, 0, 0]
for i in range(5):
    bumpers.append(sphere(pos=bumper_positions[i], radius=0.53, color=palette[i], emissive=True))
    label(pos=bumper_positions[i] + vector(0, 0.8, 0), text=str(i+1), color=palette[i], height=16)

# 둥근 범퍼의 반사 계산은 교사 제공 도움 함수입니다.
def reflect_from_bumper(position, motion, center):
    offset = vector(position.x - center.x, position.y - center.y, 0)
    distance = mag(offset)
    if distance == 0:
        return center + vector(0.77, 0, 0.1), vector(3, 2, 0)
    normal = offset / distance
    return center + normal * 0.77 + vector(0, 0, 0.1), motion - 2 * dot(motion, normal) * normal
melody = []
slots = []
for i in range(8):
    slots.append(box(pos=vector(-3.2 + i*0.92, -4.6, 0), size=vector(0.75, 0.4, 0.1), color=vector(0.15, 0.20, 0.3)))

def show_sequence(event):
    print("기록한 음 번호:", melody)
    sounds = []
    frequencies = [523.25, 587.33, 659.25, 783.99, 880]
    for index in melody:
        sounds.append({"freq": frequencies[index], "duration": 0.45, "type": "musicbox", "volume": 0.16})
    play_sequence(sounds)

button(text="내 선율 듣기", bind=show_sequence)
print("4차시: 8칸이 차면 내 선율 듣기를 누르세요.")
while True:
    rate(60)
    ball.pos = ball.pos + velocity * dt
    if ball.pos.x > 3.65 or ball.pos.x < -3.65:
        ball.pos = vector(max(-3.65, min(3.65, ball.pos.x)), ball.pos.y, 0.1)
        velocity = vector(-velocity.x, velocity.y, 0)
        play_note("C5", 0.2, "musicbox", 0.16)
    if ball.pos.y > 3.65 or ball.pos.y < -3.65:
        ball.pos = vector(ball.pos.x, max(-3.65, min(3.65, ball.pos.y)), 0.1)
        velocity = vector(velocity.x, -velocity.y, 0)
        play_note("G5", 0.2, "musicbox", 0.16)
    for i in range(5):
        if mag(vector(ball.pos.x - bumpers[i].pos.x, ball.pos.y - bumpers[i].pos.y, 0)) < 0.77:
            ball.pos, velocity = reflect_from_bumper(ball.pos, velocity, bumpers[i].pos)
            counts[i] = counts[i] + 1
            ball.color = palette[i]
            play_note(notes[i], 0.23, "musicbox", 0.16)
            if len(melody) < 8:
                melody.append(i)
                slots[len(melody)-1].color = palette[i]
                print("기록", len(melody), "/8", melody)

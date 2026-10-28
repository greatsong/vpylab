# 2차시: 입체 상자에서 색과 소리가 있는 평면 보드로.
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
print("2차시: 가로벽 도, 세로벽 솔. 벽의 방향과 소리를 비교하세요.")
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

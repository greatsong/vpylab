from vpython import *
# 합성 수업의 순수 창작팀 단계 파일: 실제 학생 기록이 아닙니다.
scene.background = vector(0.94, 0.97, 1)
scene.range = 15
scene.autoscale = False
blue = vector(0.14, 0.34, 0.84)
teal = vector(0.04, 0.58, 0.55)
box(pos=vector(0, -0.25, 0), size=vector(22, 0.4, 16), color=color.white)

# 3차시: 위치의 차를 이용하여 목적지까지 이동합니다.
people = []
arrived = []
for i in range(36):
    people.append(sphere(pos=vector((i % 8 - 3.5) * 1.6, 0.5, -6 + (i // 8) * 1.3), radius=0.27, color=blue))
    arrived.append(False)
box(pos=vector(6, 0.05, 6), size=vector(2.4, 0.2, 3), color=teal)
goal = vector(6, 0.5, 5)
clock = 0
moving = 36
counter = label(pos=vector(0, 4, 0), text='', color=blue, height=18)
while moving > 0:
    rate(30)
    clock = clock + 0.1
    moving = 0
    for i in range(36):
        if not arrived[i]:
            difference = goal - people[i].pos
            if mag(difference) <= 0.15:
                arrived[i] = True
                people[i].color = color.mint
            else:
                people[i].pos = people[i].pos + norm(difference) * 0.15
                moving = moving + 1
    counter.text = '모형 시간 ' + str(round(clock, 1)) + '초 / 이동 중 ' + str(moving) + '명'
print('한 지점에서 모두 겹친다. 출구 처리 시간과 줄을 아직 계산하지 않았기 때문이다.')

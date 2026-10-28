from vpython import *
# 합성 수업의 순수 창작팀 단계 파일: 실제 학생 기록이 아닙니다.
scene.background = vector(0.94, 0.97, 1)
scene.range = 15
scene.autoscale = False
blue = vector(0.14, 0.34, 0.84)
teal = vector(0.04, 0.58, 0.55)
box(pos=vector(0, -0.25, 0), size=vector(22, 0.4, 16), color=color.white)

# 4차시: 도착한 순서로 줄에 넣고 일정 간격마다 한 명을 통과시킵니다.
people = []
state = []
queue = []
for i in range(36):
    people.append(sphere(pos=vector((i % 8 - 3.5) * 1.6, 0.5, -6 + (i // 8) * 1.3), radius=0.27, color=blue))
    state.append(0)
box(pos=vector(6, 0.05, 6), size=vector(2.4, 0.2, 3), color=teal)
clock = 0
next_service = 0
completed = 0
peak = 0
counter = label(pos=vector(0, 4, 0), text='', color=blue, height=18)
while completed < 36:
    rate(30)
    clock = clock + 0.1
    for i in range(36):
        if state[i] == 0:
            difference = vector(6, 0.5, 4.8) - people[i].pos
            if mag(difference) <= 0.15:
                state[i] = 1
                queue.append(i)
                people[i].color = color.orange
            else:
                people[i].pos = people[i].pos + norm(difference) * 0.15
    if len(queue) > peak:
        peak = len(queue)
    if len(queue) == 0:
        next_service = clock
    elif clock + 0.00001 >= next_service:
        person = queue.pop(0)
        state[person] = 2
        people[person].pos = vector(4.9 + (completed % 4) * 0.6, 0.5, 8.1 + (completed // 4) * 0.6)
        people[person].color = color.mint
        completed = completed + 1
        next_service = clock + 0.8
    for rank in range(len(queue)):
        people[queue[rank]].pos = vector(6 + (rank % 3 - 1) * 0.58, 0.5, 5.1 - (rank // 3) * 0.6)
    counter.text = '통과 ' + str(completed) + '/36 / 최대 대기 ' + str(peak) + '명'
print('한 출구 완료:', round(clock, 1), '초 / 최대 대기:', peak, '명')

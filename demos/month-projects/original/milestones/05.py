from vpython import *
# 합성 수업의 순수 창작팀 단계 파일: 실제 학생 기록이 아닙니다.
scene.background = vector(0.94, 0.97, 1)
scene.range = 15
scene.autoscale = False
blue = vector(0.14, 0.34, 0.84)
teal = vector(0.04, 0.58, 0.55)
box(pos=vector(0, -0.25, 0), size=vector(22, 0.4, 16), color=color.white)

# 5차시: strategy를 0, 1, 2로 바꾸어 같은 조건을 비교합니다.
# 0=한 출구 집중, 1=두 출구 분산, 2=분산+출발 시차
strategy = 1
count = 36
people = []
state = []
assigned = []
release_at = []
queues = [[], []]
exit_x = [-6, 6]
next_service = [0, 0]
exit_counts = [0, 0]
for gate in range(2):
    box(pos=vector(exit_x[gate], 0.05, 6), size=vector(2.4, 0.2, 3), color=teal)
for i in range(count):
    people.append(sphere(pos=vector((i % 8 - 3.5) * 1.6, 0.5, -6 + (i // 8) * 1.3), radius=0.27, color=blue))
    state.append(0)
    gate = 1
    if strategy > 0:
        gate = i % 2
    assigned.append(gate)
    release = 0
    if strategy == 2:
        release = (i // 6) * 1.8
    release_at.append(release)
clock = 0
completed = 0
peak = 0
counter = label(pos=vector(0, 4, 0), text='', color=blue, height=17)
while completed < count:
    rate(30)
    clock = clock + 0.1
    for i in range(count):
        if state[i] == 0 and clock >= release_at[i]:
            state[i] = 1
        if state[i] == 1:
            gate = assigned[i]
            difference = vector(exit_x[gate], 0.5, 4.8) - people[i].pos
            if mag(difference) <= 0.15:
                queues[gate].append(i)
                state[i] = 2
            else:
                people[i].pos = people[i].pos + norm(difference) * 0.15
    peak = max(peak, len(queues[0]) + len(queues[1]))
    for gate in range(2):
        if len(queues[gate]) == 0:
            next_service[gate] = clock
        elif clock + 0.00001 >= next_service[gate]:
            person = queues[gate].pop(0)
            state[person] = 3
            spot = exit_counts[gate]
            people[person].pos = vector(exit_x[gate] + (spot % 4 - 1.5) * 0.57, 0.5, 8.1 + (spot // 4) * 0.57)
            people[person].color = color.mint
            completed = completed + 1
            exit_counts[gate] = spot + 1
            next_service[gate] = clock + 0.8
        for rank in range(len(queues[gate])):
            person = queues[gate][rank]
            people[person].pos = vector(exit_x[gate] + (rank % 3 - 1) * 0.58, 0.5, 5.1 - (rank // 3) * 0.6)
            people[person].color = color.orange
    counter.text = '전략 ' + str(strategy) + ' / 통과 ' + str(completed) + '/' + str(count) + ' / 최대 대기 ' + str(peak)
print('전략:', strategy, '완료:', round(clock, 1), '초 / 최대 대기:', peak, '명')

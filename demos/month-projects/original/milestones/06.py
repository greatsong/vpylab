# 6차시: 조작 위젯·일시정지·리셋. 전략은 직접 하나씩 비교합니다.
from vpython import *

# 실행기의 비동기 감싸기 안에서도 콜백과 반복문이 같은 상태를 공유합니다.
global auto_active, completed, count, elapsed, exit_counts, finished
global interval, last_quarter, mode_index, next_service, peak_queue, queues
global results, running, step_count, wait_total
scene.title = '축제길 실험실 | 출구 안내 방법을 바꾸면 어떤 차이가 날까?'
scene.background = vector(0.94, 0.97, 1.0)
scene.center = vector(0, 0, 0)
scene.range = 18
scene.autoscale = False
blue = vector(0.14, 0.34, 0.84)
teal = vector(0.04, 0.58, 0.55)
ink = vector(0.1, 0.18, 0.32)
orange = vector(0.98, 0.57, 0.2)
mode_names = ['한 출구 집중', '두 출구 분산', '분산 + 출발 시차']
exit_x = [-6, 6]
people = []
state = []
assigned = []
release_at = []
joined_at = []
queues = [[], []]
next_service = [0, 0]
exit_counts = [0, 0]
results = [None, None, None]
running = False
finished = False
auto_active = False
mode_index = 0
count = 36
interval = 0.8
elapsed = 0
peak_queue = 0
wait_total = 0
completed = 0
step_count = 0
last_quarter = 0
dt = 0.1
walk_speed = 1.5
box(pos=vector(0, -0.25, 0), size=vector(22, 0.4, 16), color=color.white)
box(pos=vector(-11, 0.4, 0), size=vector(0.2, 1.0, 16), color=blue)
box(pos=vector(11, 0.4, 0), size=vector(0.2, 1.0, 16), color=blue)
box(pos=vector(0, 0.4, -8), size=vector(22, 1.0, 0.2), color=blue)
for gate in range(2):
    box(pos=vector(exit_x[gate], 0.02, 6), size=vector(2.4, 0.12, 3), color=teal)
    box(pos=vector(exit_x[gate] - 1.3, 1.4, 6.7), size=vector(0.2, 2.8, 0.2), color=blue)
    box(pos=vector(exit_x[gate] + 1.3, 1.4, 6.7), size=vector(0.2, 2.8, 0.2), color=blue)
    box(pos=vector(exit_x[gate], 2.8, 6.7), size=vector(2.8, 0.2, 0.2), color=blue)
    label(pos=vector(exit_x[gate], 3.6, 6.7), text='출구 ' + str(gate + 1), color=ink, height=15)
for i in range(48):
    people.append(sphere(pos=vector(0, 0.5, 0), radius=0.27, color=blue, visible=False))
    state.append(0)
    assigned.append(0)
    release_at.append(0)
    joined_at.append(0)
heading = label(pos=vector(0, 11, -5), text='축제길 실험실', color=ink, height=23)
status = label(pos=vector(0, 8.5, -5), text='', color=ink, height=15)
metrics = label(pos=vector(0, 6, -5), text='', color=ink, height=14)
result_board = label(pos=vector(0, -8, 10), text='', color=ink, height=14)
conclusion = label(pos=vector(0, -12.5, 10), text='', color=ink, height=13)

def lock_settings(locked):
    mode_menu.disabled = locked
    count_slider.disabled = locked
    interval_slider.disabled = locked

def show_results():
    text_rows = ['비교표  |  완료 시간 / 최대 대기 / 평균 대기']
    for k in range(3):
        if results[k] is None:
            text_rows.append(mode_names[k] + ': 아직 측정하지 않음')
        else:
            row = results[k]
            bar_height = row[0] * 0.055
            text_rows.append(mode_names[k] + ': ' + str(row[0]) + '초 / ' + str(row[1]) + '명 / ' + str(row[2]) + '초')
    result_board.text = '\n'.join(text_rows)

def show_metrics():
    waiting = len(queues[0]) + len(queues[1])
    metrics.text = '모형 시간 ' + str(round(elapsed, 1)) + '초  |  통과 ' + str(completed) + '/' + str(count) + '명  |  대기 ' + str(waiting) + '명'

def prepare(which):
    global mode_index, count, interval, elapsed, peak_queue, wait_total
    global completed, queues, next_service, exit_counts, finished, step_count, last_quarter
    mode_index = which
    count = int(count_slider.value)
    interval = float(interval_slider.value)
    elapsed = 0
    peak_queue = 0
    wait_total = 0
    completed = 0
    step_count = 0
    last_quarter = 0
    queues = [[], []]
    next_service = [0, 0]
    exit_counts = [0, 0]
    finished = False
    heading.text = mode_names[mode_index]
    for i in range(48):
        people[i].visible = i < count
        people[i].color = color.lavender
        people[i].pos = vector((i % 8 - 3.5) * 1.6, 0.5, -6 + i // 8 * 1.3)
        state[i] = 0
        assigned[i] = 1
        if mode_index > 0:
            assigned[i] = i % 2
        release_at[i] = 0
        if mode_index == 2:
            release_at[i] = i // 6 * 1.8
        joined_at[i] = 0
    show_metrics()

def start_or_pause(event):
    global running, auto_active
    if running:
        running = False
        start_button.text = '계속하기'
        status.text = '일시정지: 같은 상태에서 계속할 수 있습니다.'
    else:
        if finished:
            auto_active = False
            prepare(mode_index)
        running = True
        start_button.text = '일시정지'
        lock_settings(True)
        status.text = '실험 중 · 화면은 모형 시간의 약 3배속'

def reset_all(event):
    global running, auto_active, results
    running = False
    auto_active = False
    results = [None, None, None]
    prepare(mode_names.index(mode_menu.value))
    start_button.text = '실험 시작'
    lock_settings(False)
    status.text = '처음 상태입니다. 조건을 정하고 실험을 시작하세요.'
    conclusion.text = '같은 조건에서 안내 전략만 바꾸어 비교합니다.'
    show_results()

def choose_mode(event):
    global running, auto_active
    running = False
    auto_active = False
    prepare(mode_names.index(event.value))
    start_button.text = '실험 시작'
    status.text = '전략 선택: ' + mode_names[mode_index]
    conclusion.text = '인원·출구 간격이 같을 때만 비교표를 함께 읽습니다.'

def change_conditions(event):
    reset_all(event)
    status.text = '조건 변경: ' + str(count) + '명 / 출구별 ' + str(round(interval, 2)) + '초마다 1명 통과'

def complete_run():
    global running, finished, auto_active
    running = False
    finished = True
    average = round(wait_total / count, 1)
    results[mode_index] = [round(elapsed, 1), peak_queue, average]
    show_results()
    print('RESULT|original|' + mode_names[mode_index] + '|people=' + str(count) + '|interval=' + str(round(interval, 2)) + '|time=' + str(round(elapsed, 1)) + '|peak=' + str(peak_queue) + '|mean_wait=' + str(average))
    if auto_active and mode_index < 2:
        following = mode_index + 1
        mode_menu.value = mode_names[following]
        prepare(following)
        running = True
        status.text = '세 전략 자동 비교 (' + str(following + 1) + '/3)'
    else:
        auto_active = False
        start_button.text = '같은 전략 다시 실험'
        lock_settings(False)
        status.text = '완료: 모든 사람이 출구를 통과했습니다.'
        conclusion.text = '대기가 줄어도 총시간이 줄지는 않을 수 있습니다.\n모형의 가정: 직선 이동, 같은 보행 속도, 출구별 일정 처리 간격, 충돌 없음.'
        if results[0] is not None and results[1] is not None and (results[2] is not None):
            saved = round(results[0][0] - results[1][0], 1)
            conclusion.text = '집중 → 분산: 완료 시간 차이 ' + str(saved) + '초\n시차 전략의 대기와 총시간도 비교하세요. 실제 안전성의 증명은 아닙니다.'

def advance():
    global elapsed, completed, wait_total, peak_queue, step_count, last_quarter
    elapsed = elapsed + dt
    step_count = step_count + 1
    for i in range(count):
        if state[i] == 0 and elapsed >= release_at[i]:
            state[i] = 1
            people[i].color = blue if assigned[i] == 0 else teal
        if state[i] == 1:
            gate = assigned[i]
            destination = vector(exit_x[gate], 0.5, 4.8)
            difference = destination - people[i].pos
            distance = mag(difference)
            if distance <= walk_speed * dt:
                people[i].pos = destination
                state[i] = 2
                queues[gate].append(i)
                joined_at[i] = elapsed
            else:
                people[i].pos = people[i].pos + norm(difference) * walk_speed * dt
    waiting = len(queues[0]) + len(queues[1])
    if waiting > peak_queue:
        peak_queue = waiting
    for gate in range(2):
        if len(queues[gate]) == 0:
            next_service[gate] = elapsed
        elif elapsed + 1e-05 >= next_service[gate]:
            person = queues[gate].pop(0)
            state[person] = 3
            wait_total = wait_total + elapsed - joined_at[person]
            completed = completed + 1
            spot = exit_counts[gate]
            people[person].pos = vector(exit_x[gate] + (spot % 4 - 1.5) * 0.57, 0.5, 8.1 + spot // 4 * 0.57)
            people[person].color = color.mint
            exit_counts[gate] = spot + 1
            next_service[gate] = elapsed + interval
        for rank in range(len(queues[gate])):
            person = queues[gate][rank]
            people[person].pos = vector(exit_x[gate] + (rank % 3 - 1) * 0.58, 0.5, 5.1 - rank // 3 * 0.6)
            people[person].color = orange
    quarter = completed * 4 // count
    if quarter > last_quarter:
        last_quarter = quarter
    if step_count % 3 == 0 or completed == count:
        show_metrics()
    if completed == count:
        complete_run()
mode_menu = menu(choices=mode_names, selected=mode_names[0], bind=choose_mode)
count_slider = slider(min=24, max=48, step=6, value=36, text='참가 인원(명)', bind=change_conditions)
interval_slider = slider(min=0.4, max=1.2, step=0.2, value=0.8, text='출구 통과 간격(초)', bind=change_conditions)
start_button = button(text='실험 시작', bind=start_or_pause)
reset_button = button(text='처음으로', bind=reset_all)
reset_all(None)
print('사용법: 조건을 정하고 [실험 시작]을 누르세요. 일시정지·처음으로도 가능합니다.')
print('수업용 단순 대기열 모형입니다. 화면상 구 사이의 충돌과 실제 사람의 행동은 계산하지 않습니다.')
while True:
    rate(30)
    if running:
        advance()

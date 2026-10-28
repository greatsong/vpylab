# 컬러 비트 핀볼 — 공개 프로젝트 리믹스, 8차시 합성 개발 시나리오
# 원작: vpython/vpython-jupyter, Demos_no_notebook/Bounce.py (MIT)
# 고정 버전: 3254f6e4b845fdf27d8730b66887a9806d1822b3
# 원작/라이선스/교사 준비/새 기능의 구별은 ATTRIBUTION.md 참고.
from vpython import *

# 실행 환경이 코드를 함수로 감싸도, 콜백과 반복문이 같은 실험 상태를 씁니다.
global mode, layout, running, muted, recording, instrument, speed, launch_x
global velocity, elapsed, clock, wall_hits, counts, cooldowns, melody, playing
global play_index, play_at, target_order, score, misses, last_sound, report_at, dt
global bumper_positions

# 1~2차시: 원작의 벽 반사를 읽고, 색을 음과 번호에 대응한다.
scene.background = vector(0.025, 0.045, 0.095)
scene.center = vector(0.7, -0.15, 0)
scene.range = 6.8
scene.autoscale = False
palette = [vector(1, 0.47, 0.27), vector(0.20, 0.78, 0.96),
           vector(1, 0.81, 0.28), vector(0.35, 0.91, 0.68),
           vector(0.75, 0.57, 1)]
notes = ["C5", "D5", "E5", "G5", "A5"]
names = ["1 도", "2 레", "3 미", "4 솔", "5 라"]
box(pos=vector(0, 0, -0.6), size=vector(8.35, 8.35, 0.25), color=vector(0.08, 0.12, 0.22))
box(pos=vector(-4, 0, -0.05), size=vector(0.18, 8.2, 0.65), color=palette[1])
box(pos=vector(4, 0, -0.05), size=vector(0.18, 8.2, 0.65), color=palette[4])
box(pos=vector(0, 4, -0.05), size=vector(8.2, 0.18, 0.65), color=palette[3])
box(pos=vector(0, -4, -0.05), size=vector(8.2, 0.18, 0.65), color=palette[0])
for i in range(9):
    box(pos=vector(-4 + i, 0, -0.45), size=vector(0.012, 8, 0.01), color=vector(0.13, 0.18, 0.28))
    box(pos=vector(0, -4 + i, -0.45), size=vector(8, 0.012, 0.01), color=vector(0.13, 0.18, 0.28))
ball = sphere(pos=vector(-3.25, -3.15, 0.1), radius=0.23, color=color.white,
              emissive=True, make_trail=True, retain=120, trail_color=palette[1])
bumper_positions = [vector(-2.3, 1.4, 0), vector(0, 2.2, 0), vector(2.3, 1.4, 0),
                    vector(-1.45, -1.05, 0), vector(1.45, -1.05, 0)]
bumpers = []
halos = []
bumper_labels = []
bars = []
bar_labels = []
for i in range(5):
    bumpers.append(sphere(pos=bumper_positions[i], radius=0.53, color=palette[i], emissive=True))
    halos.append(ring(pos=bumper_positions[i], axis=vector(0, 0, 1), radius=0.72,
                      thickness=0.025, color=palette[i]))
    bumper_labels.append(label(pos=bumper_positions[i] + vector(0, 0.85, 0), text=names[i],
                               height=15, color=palette[i], border=0))
    bars.append(box(pos=vector(4.8 + i * 0.36, -3.7, 0), size=vector(0.23, 0.1, 0.2), color=palette[i]))
    bar_labels.append(label(pos=vector(4.8 + i * 0.36, -4.05, 0), text=str(i + 1),
                            color=palette[i], height=12))
label(pos=vector(5.5, -0.1, 0), text="충돌 횟수\n같은 시간\n다른 배치", height=14, color=color.white)
title_label = label(pos=vector(0, 5.1, 0), text="COLOR BEAT · 컬러 비트 핀볼", color=palette[1], height=22)
status = label(pos=vector(0, 4.55, 0), text="", color=color.white, height=14)
target_label = label(pos=vector(5.3, 2.8, 0), text="", color=palette[2], height=15)
label(pos=vector(0, -4.6, 0), text="나만의 8음 선율 · 색 + 번호 + 음 이름", color=color.white, height=14)
slots = []
slot_labels = []
for i in range(8):
    slots.append(box(pos=vector(-3.3 + i * 0.94, -5.2, 0), size=vector(0.8, 0.55, 0.14), color=vector(0.14, 0.20, 0.31)))
    slot_labels.append(label(pos=vector(-3.3 + i * 0.94, -5.2, 0.2), text="·", height=14))

mode = "충돌 작곡"
layout = "오각형"
running = True
muted = False
recording = True
instrument = "musicbox"
speed = 1.0
launch_x = 2.7
velocity = vector(2.7, 3.5, 0)
elapsed = 0
clock = 0
wall_hits = 0
counts = [0, 0, 0, 0, 0]
cooldowns = [0, 0, 0, 0, 0]
melody = []
playing = False
play_index = 0
play_at = 0
target_order = [0, 2, 3, 1, 4, 3, 2, 0]
score = 0
misses = 0
last_sound = -1
report_at = 0
dt = 1 / 60

# 3차시: 두 번째 학생이 검증하는 원형 충돌 공식(교사 제공 도움 함수).
# 벽 반사는 원작에서 가져왔고, 둥근 범퍼 반사는 도움 코드이다.
def reflect_from_bumper(position, motion, center):
    offset = vector(position.x - center.x, position.y - center.y, 0)
    distance = mag(offset)
    if distance == 0:
        return center + vector(0.77, 0, 0.1), vector(3, 2, 0)
    normal = offset / distance
    return center + normal * 0.77 + vector(0, 0, 0.1), motion - 2 * dot(motion, normal) * normal

def sound_note(index):
    global last_sound
    if not muted and clock - last_sound > 0.10:
        play_note(notes[index], 0.23, instrument, 0.16)
        last_sound = clock

def draw_melody():
    for i in range(8):
        if i < len(melody):
            slots[i].color = palette[melody[i]]
            slot_labels[i].text = names[melody[i]]
        else:
            slots[i].color = vector(0.14, 0.20, 0.31)
            slot_labels[i].text = "·"

# 4차시: 충돌 자료를 목록에 쌓고, 8개까지만 기록한다.
def register_hit(index):
    global score, misses, recording
    counts[index] = counts[index] + 1
    ball.color = palette[index]
    sound_note(index)
    if mode == "순서 도전":
        if index == target_order[score % 8]:
            score = score + 1
        else:
            misses = misses + 1
    if mode == "충돌 작곡" and recording and not playing and len(melody) < 8:
        melody.append(index)
        draw_melody()
        if len(melody) == 8:
            recording = False
            print("[선율 완성] 8음을 모았습니다. '선율 재생'으로 다시 들어보세요.")
    for i in range(5):
        height = min(3.0, 0.1 + counts[i] * 0.17)
        bars[i].size = vector(0.23, height, 0.2)
        bars[i].pos = vector(4.8 + i * 0.36, -3.75 + height / 2, 0)

def show_result(event=None):
    print("[실험 결과] 모드=" + mode + " / 배치=" + layout + " / 속도=" + str(round(speed, 2)))
    print("시간=" + str(round(elapsed, 1)) + "초 / 벽=" + str(wall_hits) + "회 / 범퍼=" + str(counts))
    print("목표 성공=" + str(score) + " / 다른 색=" + str(misses) + " / 기록 음=" + str(melody))

def reset_trial(event=None):
    global velocity, elapsed, wall_hits, counts, cooldowns, score, misses, running, report_at
    ball.pos = vector(-3.25, -3.15, 0.1)
    ball.color = color.white
    velocity = vector(launch_x, 3.5, 0)
    elapsed = 0
    wall_hits = 0
    counts = [0, 0, 0, 0, 0]
    cooldowns = [0, 0, 0, 0, 0]
    score = 0
    misses = 0
    report_at = 0
    running = True
    pause_button.text = "일시 정지"
    for i in range(5):
        bars[i].size = vector(0.23, 0.1, 0.2)
        bars[i].pos = vector(4.8 + i * 0.36, -3.7, 0)
    print("[새 실험] 선율은 보존합니다. 같은 20초 동안 조건 하나만 바꾸어 비교하세요.")

def toggle_running(event):
    global running
    if mode == "순서 도전" and elapsed >= 45:
        reset_trial()
        return
    running = not running
    if running:
        pause_button.text = "일시 정지"
    else:
        pause_button.text = "계속 움직이기"
        show_result()

# 5차시: 세 모드와 배치, 발사 방향을 비교한다.
def change_mode(event):
    global mode
    mode = str(event.value)
    for i in range(5):
        bumpers[i].visible = mode != "반사 관찰"
        halos[i].visible = mode != "반사 관찰"
        bumper_labels[i].visible = mode != "반사 관찰"
    reset_trial()
    print("[모드 변경] " + mode)

def change_layout(event):
    global layout, bumper_positions
    layout = str(event.value)
    if layout == "오각형":
        bumper_positions = [vector(-2.3, 1.4, 0), vector(0, 2.2, 0), vector(2.3, 1.4, 0), vector(-1.45, -1.05, 0), vector(1.45, -1.05, 0)]
    elif layout == "지그재그":
        bumper_positions = [vector(-2.3, 2.2, 0), vector(1.6, 1.2, 0), vector(-1.6, 0, 0), vector(2.3, -1.2, 0), vector(-0.4, -2, 0)]
    else:
        bumper_positions = [vector(-2.5, 2.3, 0), vector(2.5, 2.3, 0), vector(0, 0, 0), vector(-2.5, -2.1, 0), vector(2.5, -2.1, 0)]
    for i in range(5):
        bumpers[i].pos = bumper_positions[i]
        halos[i].pos = bumper_positions[i]
        bumper_labels[i].pos = bumper_positions[i] + vector(0, 0.85, 0)
    reset_trial()

def change_speed(event):
    global speed
    speed = float(event.value)
    print("[조건 변경] 진행 배율=" + str(round(speed, 2)))

def change_launch(event):
    global launch_x
    launch_x = float(event.value)
    reset_trial()

def push_left(event):
    global velocity
    velocity = vector(max(-6, velocity.x - 0.8), velocity.y, 0)

def push_right(event):
    global velocity
    velocity = vector(min(6, velocity.x + 0.8), velocity.y, 0)

# 6차시: 짧은 음, 조용한 음량, 음소거와 색 이외의 단서를 넣는다.
def toggle_mute(event):
    global muted
    muted = bool(event.value)
    print("[소리] 음소거=" + str(muted))

def change_instrument(event):
    global instrument
    if str(event.value) == "오르골":
        instrument = "musicbox"
    else:
        instrument = "piano"

def preview_1(event):
    sound_note(0)
def preview_2(event):
    sound_note(1)
def preview_3(event):
    sound_note(2)
def preview_4(event):
    sound_note(3)
def preview_5(event):
    sound_note(4)

# 7차시: 충돌로 만든 선율을 일정한 박자로 재생한다.
def play_melody(event):
    global playing, play_index, play_at
    if len(melody) == 0:
        print("[재생 안내] 충돌 작곡 모드에서 먼저 음을 모으세요.")
        return
    playing = True
    play_index = 0
    play_at = clock
    print("[선율 재생] " + str(len(melody)) + "음 / 0.45초 간격")

def clear_melody(event):
    global melody, playing, recording
    melody = []
    playing = False
    recording = True
    draw_melody()
    print("[새 작곡] 8칸을 비웠습니다.")

menu(choices=["반사 관찰", "충돌 작곡", "순서 도전"], selected=mode, bind=change_mode)
menu(choices=["오각형", "지그재그", "넓은 간격"], selected=layout, bind=change_layout)
pause_button = button(text="일시 정지", bind=toggle_running)
button(text="같은 조건 재시작", bind=reset_trial)
button(text="← 방향 조절", bind=push_left)
button(text="방향 조절 →", bind=push_right)
slider(min=0.5, max=1.6, step=0.1, value=1, text="진행 배율", bind=change_speed)
slider(min=-4, max=4, step=0.5, value=2.7, text="처음 가로 속도", bind=change_launch)
menu(choices=["오르골", "피아노"], selected="오르골", bind=change_instrument)
checkbox(text="음소거", checked=False, bind=toggle_mute)
button(text="1 도 미리 듣기", bind=preview_1)
button(text="2 레 미리 듣기", bind=preview_2)
button(text="3 미 미리 듣기", bind=preview_3)
button(text="4 솔 미리 듣기", bind=preview_4)
button(text="5 라 미리 듣기", bind=preview_5)
button(text="선율 재생", bind=play_melody)
button(text="새 작곡", bind=clear_melody)
button(text="결과 출력", bind=show_result)
print("[준비 완료] 컬러 비트 핀볼: 반사 관찰 / 충돌 작곡 / 순서 도전")
print("오르골 5음과 색·번호가 대응합니다. 20초 비교 실험, 8음 작곡, 45초 도전을 해보세요.")
print("공개 원작의 벽 반사를 새 목적에 적용한 합성 수업 결과물입니다. 실제 학생 성취 기록이 아닙니다.")

# 8차시: 벽 반지름 보정, 중복 충돌 방지, 45초 종료를 동료가 검사한다.
while True:
    rate(60)
    clock = clock + dt
    if playing and clock >= play_at:
        sound_note(melody[play_index])
        slot_labels[play_index].text = "♪ " + names[melody[play_index]]
        play_index = play_index + 1
        play_at = clock + 0.45
        if play_index == len(melody):
            playing = False
            print("[재생 완료] 기록된 순서와 소리가 일치하는지 비교하세요.")
    if not running:
        continue
    elapsed = elapsed + dt
    ball.pos = ball.pos + velocity * dt * speed
    if ball.pos.x > 3.65 or ball.pos.x < -3.65:
        ball.pos = vector(max(-3.65, min(3.65, ball.pos.x)), ball.pos.y, 0.1)
        velocity = vector(-velocity.x, velocity.y, 0)
        wall_hits = wall_hits + 1
        if mode == "반사 관찰":
            sound_note(0)
    if ball.pos.y > 3.65 or ball.pos.y < -3.65:
        ball.pos = vector(ball.pos.x, max(-3.65, min(3.65, ball.pos.y)), 0.1)
        velocity = vector(velocity.x, -velocity.y, 0)
        wall_hits = wall_hits + 1
        if mode == "반사 관찰":
            sound_note(3)
    if mode != "반사 관찰":
        for i in range(5):
            cooldowns[i] = max(0, cooldowns[i] - dt)
            if mag(vector(ball.pos.x - bumpers[i].pos.x, ball.pos.y - bumpers[i].pos.y, 0)) < 0.77 and cooldowns[i] == 0:
                ball.pos, velocity = reflect_from_bumper(ball.pos, velocity, bumpers[i].pos)
                cooldowns[i] = 0.16
                register_hit(i)
            if mode == "순서 도전" and i == target_order[score % 8]:
                halos[i].color = color.white
                halos[i].radius = 0.78
            else:
                halos[i].color = palette[i]
                halos[i].radius = 0.72
    status.text = mode + " · " + str(round(elapsed, 1)) + "초 · 벽 " + str(wall_hits) + " · 범퍼 " + str(sum(counts))
    if mode == "순서 도전":
        target_label.text = "다음 목표\n" + names[target_order[score % 8]] + "\n성공 " + str(score) + "\n다른 색 " + str(misses)
        if elapsed >= 45:
            running = False
            pause_button.text = "도전 다시 시작"
            print("[도전 종료] 45초 동안 목표 순서 성공=" + str(score) + ", 다른 색=" + str(misses))
            show_result()
    else:
        target_label.text = "기록 " + str(len(melody)) + "/8음\n음량 16%\n색 + 번호 + 음"
    if elapsed - report_at >= 20:
        report_at = elapsed
        show_result()

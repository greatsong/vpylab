from vpython import *

# 7차시: 리듬 실험·화음 실험·음색 비교와 음 구슬을 추가합니다.
# 색은 음을 구별하는 약속이며, 빛의 주파수와 음의 주파수가 같다는 뜻은 아닙니다.
scene.background = vector(0.055, 0.075, 0.15)
scene.center = vector(0, 1.6, 0)
scene.range = 9
scene.autoscale = False

note_names = ['도4', '레4', '미4', '파4', '솔4', '라4', '시4', '도5']
frequencies = [261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88, 523.25]
palette = [vector(0.98, 0.38, 0.42), vector(1, 0.64, 0.28),
           vector(1, 0.85, 0.35), vector(0.43, 0.84, 0.60),
           vector(0.28, 0.78, 0.91), vector(0.40, 0.55, 0.98),
           vector(0.71, 0.48, 0.94), vector(0.98, 0.57, 0.81)]
starter = [0, 2, 4, 2, 1, 3, 5, -1, 4, 5, 7, 5, 4, 2, 1, 0]
notes = starter.copy()
state = {'playing': False, 'step': 0, 'elapsed': 0, 'wait': 0, 'bpm': 108,
         'edit': 0, 'mode': '선율 실험', 'variant': '원본',
         'timbre': '뮤직박스', 'muted': False, 'rounds': 0}
bars = []
bulbs = []

box(pos=vector(0, -0.18, 0), size=vector(13.6, 0.25, 4.8),
    color=vector(0.12, 0.16, 0.27))
label(pos=vector(0, 5.2, 0), text='소리빛 작곡 실험실', height=24,
      color=vector(0.88, 0.95, 1))
status = label(pos=vector(0, 4.3, 0), text='재생 버튼으로 내가 만든 16박을 들어 보세요.', height=13)
summary = label(pos=vector(0, -0.75, 1.5), text='', height=12)
cursor = sphere(pos=vector(-5.85, 0.35, 1.3), radius=0.15,
                color=vector(1, 1, 1), emissive=True)
for i in range(16):
    bars.append(box(pos=vector((i - 7.5) * 0.78, 0.3, 0.75),
                    size=vector(0.58, 0.6, 0.62), color=palette[0]))
    label(pos=vector((i - 7.5) * 0.78, -0.12, 1.35),
          text=str(i + 1), height=10)
for i in range(8):
    x = (i - 3.5) * 1.45
    height = 0.8 + i * 0.25
    cylinder(pos=vector(x, 0, -1.45), axis=vector(0, height, 0),
             radius=0.34, color=palette[i], opacity=0.65)
    bulbs.append(sphere(pos=vector(x, height + 0.24, -1.45),
                        radius=0.3, color=palette[i], emissive=True))
    label(pos=vector(x, height + 0.9, -1.45), text=note_names[i], height=13)

plot = graph(title='16박의 음높이 비교 · 쉼표는 0 Hz',
             xtitle='박 번호', ytitle='주파수 Hz', width=520, height=190,
             xmin=1, xmax=16, ymin=0, ymax=1100)
pitch_line = gcurve(graph=plot, color=vector(0.32, 0.78, 0.95), label='현재 변형')

def source_index(step):
    if state['variant'] == '거꾸로':
        return 15 - step
    return step

def pitch_frequency(index):
    frequency = frequencies[index]
    if state['variant'] == '한 옥타브 위':
        frequency = frequency * 2
    return frequency

def beat_seconds(step):
    seconds = 60 / state['bpm']
    if state['mode'] == '리듬 실험':
        if step % 2 == 0:
            seconds = seconds * 1.5
        else:
            seconds = seconds * 0.5
    return seconds

def refresh_score():
    pitch_line.clear()
    rests = 0
    total_frequency = 0
    played = 0
    for step in range(16):
        index = notes[source_index(step)]
        height = 0.18
        shade = vector(0.30, 0.33, 0.41)
        frequency = 0
        if index >= 0:
            height = 0.65 + index * 0.29
            shade = palette[index]
            frequency = pitch_frequency(index)
            total_frequency = total_frequency + frequency
            played = played + 1
        else:
            rests = rests + 1
        bars[step].size = vector(0.58, height, 0.62)
        bars[step].pos = vector((step - 7.5) * 0.78, height / 2, 0.75)
        bars[step].color = shade
        bars[step].opacity = 0.88
        if step == state['edit']:
            bars[step].opacity = 1
        pitch_line.plot(step + 1, frequency)
    average = 0
    if played > 0:
        average = round(total_frequency / played, 1)
    summary.text = ('16박 · 쉼표 ' + str(rests) + '개 · 평균 ' + str(average)
                    + ' Hz · ' + str(state['bpm']) + ' BPM · '
                    + state['variant'] + ' · 완주 ' + str(state['rounds']) + '회')

def toggle_play(widget):
    state['playing'] = not state['playing']
    if state['playing']:
        state['elapsed'] = 10
        status.text = '재생 중 · 박 막대와 뒤쪽 음 구슬을 비교해 보세요.'
    else:
        status.text = '일시정지 · 박을 편집한 뒤 다시 재생할 수 있습니다.'

def restart(widget):
    state['step'] = 0
    state['elapsed'] = 10
    state['playing'] = True
    print('처음부터 비교 재생:', state['mode'], state['variant'], state['bpm'], 'BPM')

def change_mode(widget):
    state['mode'] = widget.value
    state['step'] = 0
    state['elapsed'] = 10
    status.text = state['mode'] + ' 선택 · 같은 악보로 조건 하나를 비교합니다.'
    print('실험 모드:', state['mode'])

def change_variant(widget):
    state['variant'] = widget.value
    state['step'] = 0
    state['elapsed'] = 10
    refresh_score()
    print('음높이 변형:', state['variant'])

def change_timbre(widget):
    state['timbre'] = widget.value
    print('악기:', state['timbre'])

def change_tempo(widget):
    state['bpm'] = int(widget.value)
    refresh_score()

def change_step(widget):
    state['edit'] = int(widget.value) - 1
    index = notes[source_index(state['edit'])]
    name = '쉼표'
    if index >= 0:
        name = note_names[index]
    note_menu.value = name
    status.text = str(state['edit'] + 1) + '번 박 편집 · 현재 ' + name
    refresh_score()

def change_note(widget):
    index = -1
    if widget.value != '쉼표':
        index = note_names.index(widget.value)
    notes[source_index(state['edit'])] = index
    refresh_score()
    print('악보 수정:', state['edit'] + 1, '번 박 =', widget.value)

def change_mute(widget):
    state['muted'] = bool(widget.value)
    print('프로젝트 음소거:', state['muted'])

button(text='재생 / 일시정지', bind=toggle_play)
button(text='처음부터 듣기', bind=restart)
mode_menu = menu(choices=['선율 실험', '리듬 실험', '화음 실험'], bind=change_mode)
variant_menu = menu(choices=['원본', '거꾸로', '한 옥타브 위'], bind=change_variant)
timbre_menu = menu(choices=['뮤직박스', '피아노', '맑은 사인파'], bind=change_timbre)
tempo_slider = slider(text='빠르기 BPM', min=60, max=168, step=6, value=108, bind=change_tempo)
step_slider = slider(text='편집할 박', min=1, max=16, step=1, value=1, bind=change_step)
note_menu = menu(choices=note_names + ['쉼표'], selected='도4', bind=change_note)
checkbox(text='프로젝트 음소거', checked=False, bind=change_mute)

refresh_score()
print('준비 완료 | 수업 코드 확장: 소리빛 작곡 실험실 | 16박 · 3실험 · 3변형')
print('음소거해도 막대 높이·색·그래프로 모든 실험을 관찰할 수 있습니다.')
while True:
    rate(30)
    if state['playing']:
        state['elapsed'] = state['elapsed'] + 1 / 30
        step = state['step']
        if state['elapsed'] >= state['wait']:
            state['elapsed'] = 0
            state['wait'] = beat_seconds(step)
            index = notes[source_index(step)]
            cursor.pos = vector((step - 7.5) * 0.78, 3.4, 0.75)
            for i in range(8):
                bulbs[i].radius = 0.3
            if index >= 0:
                bulbs[index].radius = 0.47
                cursor.color = palette[index]
                status.text = str(step + 1) + '/16박 · ' + note_names[index] + ' · ' + str(round(pitch_frequency(index), 1)) + ' Hz'
                if not state['muted']:
                    timbre = 'musicbox'
                    if state['timbre'] == '피아노':
                        timbre = 'piano'
                    if state['timbre'] == '맑은 사인파':
                        timbre = 'sine'
                    play_sound(pitch_frequency(index), beat_seconds(step) * 0.72, timbre, 0.15)
                    if state['mode'] == '화음 실험' and step % 4 == 0:
                        play_chord([130.81, 164.81, 196.00], beat_seconds(step) * 1.5, 'piano', 0.06)
            else:
                cursor.color = vector(0.6, 0.65, 0.75)
                status.text = str(step + 1) + '/16박 · 쉼표'
            state['step'] = state['step'] + 1
            if state['step'] == 16:
                state['step'] = 0
                state['rounds'] = state['rounds'] + 1
                refresh_score()
                print('16박 완주', state['rounds'], '회 |', state['mode'], state['variant'], state['bpm'], 'BPM')

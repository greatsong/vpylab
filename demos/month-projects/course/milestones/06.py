from vpython import *

# 6차시: 같은 악보를 원본·거꾸로·옥타브 위로 비교합니다.
scene.background = vector(0.055, 0.075, 0.15)
scene.range = 9
names = ['도4', '레4', '미4', '파4', '솔4', '라4', '시4', '도5']
frequencies = [261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88, 523.25]
score = [0, 2, 4, 2, 1, 3, 5, -1, 4, 5, 7, 5, 4, 2, 1, 0]
palette = [vector(0.98, 0.38, 0.42), vector(1, 0.64, 0.28),
           vector(1, 0.85, 0.35), vector(0.43, 0.84, 0.60),
           vector(0.28, 0.78, 0.91), vector(0.40, 0.55, 0.98),
           vector(0.71, 0.48, 0.94), vector(0.98, 0.57, 0.81)]
state = {'playing': False, 'muted': False, 'bpm': 108, 'step': 0,
         'elapsed': 0, 'edit': 0, 'variant': '원본'}
bars = []
for i in range(16):
    bars.append(box(pos=vector((i - 7.5) * 0.78, 0.3, 0),
                    size=vector(0.58, 0.6, 0.6), color=palette[0]))
cursor = sphere(radius=0.17, color=color.white, emissive=True)
plot = graph(title='변형에 따른 음높이', xtitle='박', ytitle='Hz', height=190)
line = gcurve(graph=plot, color=color.cyan)

def source_index(step):
    if state['variant'] == '거꾸로':
        return 15 - step
    return step

def frequency(index):
    value = frequencies[index]
    if state['variant'] == '한 옥타브 위':
        value = value * 2
    return value

def refresh():
    line.clear()
    for i in range(16):
        index = score[source_index(i)]
        height = 0.18
        shade = vector(0.3, 0.33, 0.41)
        pitch = 0
        if index >= 0:
            height = 0.65 + index * 0.29
            shade = palette[index]
            pitch = frequency(index)
        bars[i].size = vector(0.58, height, 0.6)
        bars[i].pos = vector((i - 7.5) * 0.78, height / 2, 0)
        bars[i].color = shade
        line.plot(i + 1, pitch)

def toggle(widget):
    state['playing'] = not state['playing']

def set_variant(widget):
    state['variant'] = widget.value
    state['step'] = 0
    refresh()
    print('변형:', state['variant'])

def set_tempo(widget):
    state['bpm'] = int(widget.value)

def set_mute(widget):
    state['muted'] = bool(widget.value)

def set_step(widget):
    state['edit'] = int(widget.value) - 1

def set_note(widget):
    index = -1
    if widget.value != '쉼표':
        index = names.index(widget.value)
    score[source_index(state['edit'])] = index
    refresh()

button(text='재생 / 일시정지', bind=toggle)
menu(choices=['원본', '거꾸로', '한 옥타브 위'], bind=set_variant)
slider(text='빠르기 BPM', min=60, max=168, step=6, value=108, bind=set_tempo)
slider(text='편집할 박', min=1, max=16, step=1, value=1, bind=set_step)
menu(choices=names + ['쉼표'], selected='도4', bind=set_note)
checkbox(text='음소거', checked=False, bind=set_mute)
refresh()
print('음의 순서를 바꿀 때와 주파수를 2배로 할 때의 차이를 비교합니다.')
while True:
    rate(30)
    if state['playing']:
        state['elapsed'] = state['elapsed'] + 1 / 30
        if state['elapsed'] >= 60 / state['bpm']:
            state['elapsed'] = 0
            step = state['step']
            cursor.pos = vector((step - 7.5) * 0.78, 3.4, 0)
            index = score[source_index(step)]
            if index >= 0 and not state['muted']:
                play_sound(frequency(index), 42 / state['bpm'], 'musicbox', 0.15)
            state['step'] = (step + 1) % 16

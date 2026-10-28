from vpython import *

# 4차시: 긴 sleep 대신 짧은 rate 루프를 써서 재생 중에도 조작합니다.
scene.background = vector(0.055, 0.075, 0.15)
scene.range = 9
names = ['도4', '레4', '미4', '파4', '솔4', '라4', '시4', '도5']
score = [0, 2, 4, 2, 1, 3, 5, -1, 4, 5, 7, 5, 4, 2, 1, 0]
palette = [vector(0.98, 0.38, 0.42), vector(1, 0.64, 0.28),
           vector(1, 0.85, 0.35), vector(0.43, 0.84, 0.60),
           vector(0.28, 0.78, 0.91), vector(0.40, 0.55, 0.98),
           vector(0.71, 0.48, 0.94), vector(0.98, 0.57, 0.81)]
state = {'playing': False, 'muted': False, 'bpm': 108, 'step': 0, 'elapsed': 0}
for i in range(16):
    index = score[i]
    height = 0.18
    shade = vector(0.3, 0.33, 0.41)
    if index >= 0:
        height = 0.65 + index * 0.29
        shade = palette[index]
    box(pos=vector((i - 7.5) * 0.78, height / 2, 0),
        size=vector(0.58, height, 0.6), color=shade)
cursor = sphere(radius=0.17, color=color.white, emissive=True)

def toggle(widget):
    state['playing'] = not state['playing']

def set_tempo(widget):
    state['bpm'] = int(widget.value)
    print('빠르기:', state['bpm'], 'BPM')

def set_mute(widget):
    state['muted'] = bool(widget.value)

button(text='재생 / 일시정지', bind=toggle)
slider(text='빠르기 BPM', min=60, max=168, step=6, value=108, bind=set_tempo)
checkbox(text='음소거', checked=False, bind=set_mute)
print('BPM은 1분에 몇 박인지 나타냅니다. 한 박 길이는 60 / BPM초입니다.')
while True:
    rate(30)
    if state['playing']:
        state['elapsed'] = state['elapsed'] + 1 / 30
        if state['elapsed'] >= 60 / state['bpm']:
            state['elapsed'] = 0
            step = state['step']
            cursor.pos = vector((step - 7.5) * 0.78, 3.4, 0)
            index = score[step]
            if index >= 0 and not state['muted']:
                play_note(names[index], 42 / state['bpm'], 'musicbox', 0.15)
            state['step'] = (step + 1) % 16

from vpython import *

# 2차시: 수업의 무지개 순서를 팀이 정한 음-색 대응표로 바꿉니다.
scene.background = vector(0.055, 0.075, 0.15)
notes = ['도4', '레4', '미4', '파4', '솔4', '라4', '시4', '도5']
palette = [vector(0.98, 0.38, 0.42), vector(1, 0.64, 0.28),
           vector(1, 0.85, 0.35), vector(0.43, 0.84, 0.60),
           vector(0.28, 0.78, 0.91), vector(0.40, 0.55, 0.98),
           vector(0.71, 0.48, 0.94), vector(0.98, 0.57, 0.81)]
scene.range = 6
for i in range(8):
    height = 0.6 + i * 0.3
    box(pos=vector(i - 3.5, height / 2, 0),
        size=vector(0.7, height, 0.7), color=palette[i])
    label(pos=vector(i - 3.5, height + 0.5, 0), text=notes[i], height=14)
    play_note(notes[i], 0.35, 'musicbox', 0.15)
    sleep(0.42)
print('8음과 8색을 일대일로 대응했습니다. 도4와 도5도 구별합니다.')

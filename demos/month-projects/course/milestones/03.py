from vpython import *

# 3차시: 16박을 리스트에 저장하고, 쉼표와 재생 커서를 추가합니다.
scene.background = vector(0.055, 0.075, 0.15)
scene.range = 9
names = ['도4', '레4', '미4', '파4', '솔4', '라4', '시4', '도5']
score = [0, 2, 4, 2, 1, 3, 5, -1, 4, 5, 7, 5, 4, 2, 1, 0]
palette = [vector(0.98, 0.38, 0.42), vector(1, 0.64, 0.28),
           vector(1, 0.85, 0.35), vector(0.43, 0.84, 0.60),
           vector(0.28, 0.78, 0.91), vector(0.40, 0.55, 0.98),
           vector(0.71, 0.48, 0.94), vector(0.98, 0.57, 0.81)]
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
for i in range(16):
    cursor.pos = vector((i - 7.5) * 0.78, 3.4, 0)
    index = score[i]
    if index >= 0:
        play_note(names[index], 0.32, 'musicbox', 0.15)
    sleep(0.45)
print('16박 완주: 8번 박은 쉼표라서 소리가 나지 않습니다.')

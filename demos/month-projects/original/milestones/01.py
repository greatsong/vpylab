from vpython import *
# 합성 수업의 순수 창작팀 단계 파일: 실제 학생 기록이 아닙니다.
scene.background = vector(0.94, 0.97, 1)
scene.range = 15
scene.autoscale = False
blue = vector(0.14, 0.34, 0.84)
teal = vector(0.04, 0.58, 0.55)
box(pos=vector(0, -0.25, 0), size=vector(22, 0.4, 16), color=color.white)

# 1차시: 학교 축제장을 단순한 좌표로 표현합니다.
box(pos=vector(-6, 0.05, 6), size=vector(2.4, 0.2, 3), color=teal)
box(pos=vector(6, 0.05, 6), size=vector(2.4, 0.2, 3), color=teal)
label(pos=vector(0, 3, 0), text='축제길: 같은 출구만 쓰면 어떻게 될까?', color=blue, height=19)
sphere(pos=vector(0, 0.5, -5), radius=0.3, color=blue)
print('질문: 사람, 출구, 도착을 각각 어떤 자료로 표현할까?')

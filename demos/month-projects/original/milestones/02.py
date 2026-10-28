from vpython import *
# 합성 수업의 순수 창작팀 단계 파일: 실제 학생 기록이 아닙니다.
scene.background = vector(0.94, 0.97, 1)
scene.range = 15
scene.autoscale = False
blue = vector(0.14, 0.34, 0.84)
teal = vector(0.04, 0.58, 0.55)
box(pos=vector(0, -0.25, 0), size=vector(22, 0.4, 16), color=color.white)

# 2차시: 반복문과 리스트로 사람 36명의 처음 위치를 만듭니다.
people = []
for gate_x in [-6, 6]:
    box(pos=vector(gate_x, 0.05, 6), size=vector(2.4, 0.2, 3), color=teal)
for i in range(36):
    person = sphere(pos=vector((i % 8 - 3.5) * 1.6, 0.5, -6 + (i // 8) * 1.3), radius=0.27, color=blue)
    people.append(person)
label(pos=vector(0, 4, 0), text='36명을 한 사람씩 저장한 리스트', color=blue, height=19)
print('실험: range(36)을 24로 바꾸고 줄 수가 어떻게 바뀌는지 확인한다.')

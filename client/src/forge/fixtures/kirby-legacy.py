# vpylab-forge:v1 eyJmb3JtYXQiOiJ2cHlsYWItZm9yZ2UiLCJ2ZXJzaW9uIjoxLCJpZCI6ImJ1aWx0aW4ta2lyYnkiLCJ0aXRsZSI6Iuy7pOu5hOyymOufvCDrj5nqt7jrnpfqsowiLCJkZXNjcmlwdGlvbiI6IiIsInJlY2lwZSI6eyJwcmVzZXRJZCI6ImtpcmJ5IiwicGFyYW1zIjp7IndpZHRoIjoyLjEsImhlaWdodCI6MS45NSwiZGVwdGgiOjEuNywiZXllU2l6ZSI6MC4xOCwiZXllR2FwIjowLjE4LCJjaGVla1NpemUiOjAuMjMsImVhckxlbmd0aCI6MC41NSwiYXJtU2l6ZSI6MC41NSwiZmVldFNpemUiOjAuNTUsIndhbGwiOjAuMTQsInBvaW50IjowLjQ4LCJ0b25lIjo4ODB9LCJjb2xvcnMiOlsiI2Y4YThjYyIsIiNkYTQ3NzIiXSwiZXhwcmVzc2lvbiI6InNtaWxlIiwiYWNjZXNzb3J5Ijoibm9uZSIsImJlbGxNb2RlIjoic2hhcGUifSwic291cmNlIjpudWxsLCJyZWNvcmRJZCI6bnVsbCwicmVmZXJlbmNlcyI6W119
from vpython import *

# 커비처럼 동그랗게 · VPyLab 대장간
def make_kirby_62f62faf(pos=None, scale=1):
    if not isinstance(scale, (int, float)) or not 0 < scale < 1000:
        raise ValueError("scale은 0보다 큰 유한한 양수여야 합니다 (1000 미만)")
    origin = vector(0, 0, 0) if pos is None else vector(pos)
    # 슬라이더에서 바꾼 값입니다. size는 세 방향의 전체 길이입니다.
    body_width = 2.1
    body_height = 1.95
    body_depth = 1.7
    eye_size = 0.18
    eye_gap = 0.18
    cheek_size = 0.23
    arm_size = 0.55
    feet_size = 0.55
    ear_length = 0.55
    wall_ratio = 0.14
    inner_ratio = 0.48
    tone_hz = 880
    body_color = vector(0.972549, 0.658824, 0.8)
    accent_color = vector(0.854902, 0.278431, 0.447059)
    eye_x = (body_width * eye_gap)
    eye_y = (body_height * 0.12)
    parts = []
    body = ellipsoid(pos=origin + vector(0, 0, 0) * scale, size=vector(body_width, body_height, body_depth) * scale, color=body_color)
    parts.append(body)
    left_arm = ellipsoid(pos=origin + vector((-1 * ((body_width * 0.46) + (arm_size * 0.15))), (body_height * -0.15), 0) * scale, size=vector(arm_size, (arm_size * 0.7), (arm_size * 0.8)) * scale, color=body_color)
    parts.append(left_arm)
    left_foot = ellipsoid(pos=origin + vector((body_width * -0.27), (body_height * -0.48), (body_depth * 0.12)) * scale, size=vector(feet_size, (feet_size * 0.6), (feet_size * 1.3)) * scale, color=accent_color)
    parts.append(left_foot)
    left_cheek = ellipsoid(pos=origin + vector((body_width * -0.32), (body_height * -0.08), (((body_depth * 0.5) * sqrt(max(0.05, ((1 - (((body_width * -0.32) / (body_width * 0.5)) * ((body_width * -0.32) / (body_width * 0.5)))) - (((body_height * -0.08) / (body_height * 0.5)) * ((body_height * -0.08) / (body_height * 0.5))))))) + 0.035)) * scale, size=vector(cheek_size, (cheek_size * 0.5), 0.05) * scale, color=vector(1, 0.6, 0.7))
    parts.append(left_cheek)
    right_arm = ellipsoid(pos=origin + vector((1 * ((body_width * 0.46) + (arm_size * 0.15))), (body_height * -0.15), 0) * scale, size=vector(arm_size, (arm_size * 0.7), (arm_size * 0.8)) * scale, color=body_color)
    parts.append(right_arm)
    right_foot = ellipsoid(pos=origin + vector((body_width * 0.27), (body_height * -0.48), (body_depth * 0.12)) * scale, size=vector(feet_size, (feet_size * 0.6), (feet_size * 1.3)) * scale, color=accent_color)
    parts.append(right_foot)
    right_cheek = ellipsoid(pos=origin + vector((body_width * 0.32), (body_height * -0.08), (((body_depth * 0.5) * sqrt(max(0.05, ((1 - (((body_width * 0.32) / (body_width * 0.5)) * ((body_width * 0.32) / (body_width * 0.5)))) - (((body_height * -0.08) / (body_height * 0.5)) * ((body_height * -0.08) / (body_height * 0.5))))))) + 0.035)) * scale, size=vector(cheek_size, (cheek_size * 0.5), 0.05) * scale, color=vector(1, 0.6, 0.7))
    parts.append(right_cheek)
    eye_minus1 = ellipsoid(pos=origin + vector((eye_x * -1), eye_y, ((((body_depth * 0.5) * sqrt(max(0.05, ((1 - (((eye_x * -1) / (body_width * 0.5)) * ((eye_x * -1) / (body_width * 0.5)))) - ((eye_y / (body_height * 0.5)) * (eye_y / (body_height * 0.5))))))) + 0.045) + 0)) * scale, size=vector(eye_size, (eye_size * 1.65), (eye_size * 0.52)) * scale, color=vector(0.09, 0.12, 0.18))
    parts.append(eye_minus1)
    eye_shine_minus1 = sphere(pos=origin + vector(((eye_x * -1) - (eye_size * 0.12)), (eye_y + (eye_size * 0.35)), ((((body_depth * 0.5) * sqrt(max(0.05, ((1 - (((eye_x * -1) / (body_width * 0.5)) * ((eye_x * -1) / (body_width * 0.5)))) - ((eye_y / (body_height * 0.5)) * (eye_y / (body_height * 0.5))))))) + 0.045) + (eye_size * 0.36))) * scale, radius=(eye_size * 0.16) * scale, color=vector(1, 0.985, 0.96))
    parts.append(eye_shine_minus1)
    eye_1 = ellipsoid(pos=origin + vector((eye_x * 1), eye_y, ((((body_depth * 0.5) * sqrt(max(0.05, ((1 - (((eye_x * 1) / (body_width * 0.5)) * ((eye_x * 1) / (body_width * 0.5)))) - ((eye_y / (body_height * 0.5)) * (eye_y / (body_height * 0.5))))))) + 0.045) + 0)) * scale, size=vector(eye_size, (eye_size * 1.65), (eye_size * 0.52)) * scale, color=vector(0.09, 0.12, 0.18))
    parts.append(eye_1)
    eye_shine_1 = sphere(pos=origin + vector(((eye_x * 1) - (eye_size * 0.12)), (eye_y + (eye_size * 0.35)), ((((body_depth * 0.5) * sqrt(max(0.05, ((1 - (((eye_x * 1) / (body_width * 0.5)) * ((eye_x * 1) / (body_width * 0.5)))) - ((eye_y / (body_height * 0.5)) * (eye_y / (body_height * 0.5))))))) + 0.045) + (eye_size * 0.36))) * scale, radius=(eye_size * 0.16) * scale, color=vector(1, 0.985, 0.96))
    parts.append(eye_shine_1)
    smile_minus1 = ellipsoid(pos=origin + vector((body_width * -0.035), ((body_height * -0.18) + (body_height * 0.015)), (((body_depth * 0.5) * sqrt(max(0.05, ((1 - ((0 / (body_width * 0.5)) * (0 / (body_width * 0.5)))) - (((body_height * -0.18) / (body_height * 0.5)) * ((body_height * -0.18) / (body_height * 0.5))))))) + 0.055)) * scale, size=vector((body_width * 0.085), (body_height * 0.025), 0.06) * scale, color=vector(0.09, 0.12, 0.18))
    parts.append(smile_minus1)
    smile_1 = ellipsoid(pos=origin + vector((body_width * 0.035), ((body_height * -0.18) + (body_height * 0.015)), (((body_depth * 0.5) * sqrt(max(0.05, ((1 - ((0 / (body_width * 0.5)) * (0 / (body_width * 0.5)))) - (((body_height * -0.18) / (body_height * 0.5)) * ((body_height * -0.18) / (body_height * 0.5))))))) + 0.055)) * scale, size=vector((body_width * 0.085), (body_height * 0.025), 0.06) * scale, color=vector(0.09, 0.12, 0.18))
    parts.append(smile_1)
    object_3d = compound(parts)
    effects = []
    visible_parts = [object_3d] + effects
    object_offset = vector(object_3d.pos - origin)
    class Module:
        def __init__(self):
            self.object = object_3d
            self.parts = visible_parts
            self.active = True
        @property
        def pos(self):
            return vector(self.object.pos - object_offset)
        def move_to(self, new_pos):
            self.object.pos = vector(new_pos) + object_offset
        def dispose(self):
            if not self.active:
                return
            self.active = False
            for item in self.parts:
                item.visible = False
    return Module()

scene.range = 3
scene.center = vector(0, 0.15, 0)
scene.forward = vector(-0.25, -0.12, -1)
my_module = make_kirby_62f62faf(pos=vector(0, 0, 0), scale=1)
# 다른 위치에 더 만들기: friend = make_kirby_62f62faf(pos=vector(3,0,0), scale=0.7)
# 이동: my_module.move_to(vector(2,0,0))
# 제거: my_module.dispose()


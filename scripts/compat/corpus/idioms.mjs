/**
 * 수업에서 흔히 나오는 GlowScript VPython 관용구 코퍼스.
 * 각 항목은 GlowScript에서 그대로 실행되는 짧은 프로그램이다. 결과가 결정적인 것은 assert로 의미를 검사한다.
 * doc: GlowScript 문서 페이지 이름(https://www.glowscript.org/docs/VPythonDocs/<doc>.html)
 */
const D = 'https://www.glowscript.org/docs/VPythonDocs/';

const IDIOMS = [
  // === 벡터 ===
  { id: 'vec-component-add', title: 'ball.pos.x += dx 성분 변경', doc: 'vector', progress: true, code: `from vpython import *
ball = sphere(pos=vector(0, 0, 0))
ball.pos.x += 1
assert ball.pos.x == 1
` },
  { id: 'vec-pos-plus-vdt', title: 'ball.pos += v*dt', doc: 'vector', code: `from vpython import *
ball = sphere()
v = vector(1, 2, 0)
dt = 0.5
ball.pos += v * dt
assert ball.pos == vector(0.5, 1, 0)
` },
  { id: 'vec-size-component', title: 'box.size.x = 2 성분 대입', doc: 'box', progress: true, code: `from vpython import *
b = box()
b.size.x = 2
assert b.size.x == 2
` },
  { id: 'vec-mag-hat-norm', title: 'vector.mag / .hat / .norm() / mag2', doc: 'vector', code: `from vpython import *
a = vector(1, 2, 3)
assert abs(a.mag - 3.7416573867739413) < 1e-9
assert abs(mag(a) - a.mag) < 1e-12
assert abs(a.mag2 - 14) < 1e-9
assert abs(mag2(a) - 14) < 1e-9
h = a.hat
assert abs(h.mag - 1) < 1e-9
n = a.norm()
assert abs(n.x - h.x) < 1e-12
assert abs(norm(a).x - h.x) < 1e-12
assert hat(vector(0, 0, 0)) == vector(0, 0, 0)
` },
  { id: 'vec-dot-cross', title: 'dot / cross 함수와 메서드', doc: 'vector', code: `from vpython import *
a = vector(3, 1, 0)
b = vector(0, 2, 0)
assert dot(a, b) == 2
assert a.dot(b) == 2
assert cross(a, b) == vector(0, 0, 6)
assert a.cross(b) == vector(0, 0, 6)
` },
  { id: 'vec-proj-comp-diff-angle', title: 'proj / comp / diff_angle', doc: 'vector', code: `from vpython import *
a = vector(1, 1, 0)
b = vector(1, 0, 0)
assert proj(a, b) == vector(1, 0, 0)
assert abs(comp(a, b) - 1) < 1e-12
assert abs(diff_angle(a, b) - pi / 4) < 1e-9
assert abs(a.diff_angle(b) - pi / 4) < 1e-9
` },
  { id: 'vec-rotate-function', title: 'rotate(v, angle=, axis=) 함수형', doc: 'vector', code: `from vpython import *
v = vector(1, 0, 0)
w = rotate(v, angle=pi / 2, axis=vector(0, 0, 1))
assert abs(w.x) < 1e-9 and abs(w.y - 1) < 1e-9
w2 = v.rotate(angle=pi / 2, axis=vector(0, 0, 1))
assert abs(w2.y - 1) < 1e-9
w3 = v.rotate(pi / 2)
assert abs(w3.y - 1) < 1e-9
` },
  { id: 'vec-arith', title: 'vector 덧셈·뺄셈·스칼라 곱·나눗셈·음수', doc: 'vector', code: `from vpython import *
a = vector(1, 2, 3)
b = vector(10, 20, 30)
assert a + b == vector(11, 22, 33)
assert b - a == vector(9, 18, 27)
assert 2 * a == vector(2, 4, 6)
assert a * 2 == vector(2, 4, 6)
assert b / 10 == vector(1, 2, 3)
assert -a == vector(-1, -2, -3)
print(a + b)
` },
  { id: 'vec-random', title: 'vector.random()', doc: 'vector', code: `from vpython import *
r = vector.random()
assert -1 <= r.x <= 1 and -1 <= r.y <= 1 and -1 <= r.z <= 1
` },
  { id: 'vec-alias', title: 'vec 별칭과 equals', doc: 'vector', code: `from vpython import *
b = box(pos=vec(1, 2, 3))
assert b.pos.equals(vector(1, 2, 3))
` },
  { id: 'vec-tuple-pos', title: 'pos에 튜플 전달(GlowScript는 오류, 의미 확인용)', doc: 'vector', tags: ['neg'], code: `from vpython import *
try:
    s = sphere(pos=(1, 2, 3))
    print('tuple pos accepted:', s.pos)
except Exception as e:
    print('tuple pos rejected:', type(e).__name__)
` },
  { id: 'vec-int-mul-rhs', title: 'vector * vector 는 오류여야 함', doc: 'vector', code: `from vpython import *
try:
    vector(1, 0, 0) * vector(0, 1, 0)
    raise AssertionError('vector*vector 가 허용됨')
except TypeError:
    pass
` },
  { id: 'vec-value-copy', title: 'obj.pos 대입은 복사본(별칭 아님)', doc: 'vector', code: `from vpython import *
p = vector(1, 1, 1)
b = box(pos=p)
p.x = 5
assert b.pos.x == 1, 'pos 가 인자 벡터와 별칭됨'
` },

  // === 객체 생성 ===
  { id: 'obj-box-lhw', title: 'box(length=, height=, width=)', doc: 'box', code: `from vpython import *
b = box(length=3, height=2, width=1)
assert b.size == vector(3, 2, 1)
assert b.length == 3
b.length = 5
assert b.size.x == 5
b.axis = vector(0, 2, 0)
assert b.length == 2
` },
  { id: 'obj-box-axis-up', title: 'box.axis / box.up', doc: 'box', code: `from vpython import *
b = box(axis=vector(0, 0, 2), up=vector(0, 1, 0))
assert abs(b.length - 2) < 1e-9
b.up = vector(1, 0, 0)
print(b.up)
` },
  { id: 'obj-sphere-size', title: 'sphere.size / size=vector 로 타원체', doc: 'sphere', code: `from vpython import *
s = sphere(radius=2)
assert s.size == vector(4, 4, 4)
s2 = sphere(size=vector(2, 1, 1))
print(s2.size)
` },
  { id: 'obj-cylinder', title: 'cylinder(radius=, axis=, length=)', doc: 'cylinder', code: `from vpython import *
c = cylinder(pos=vector(0, 0, 0), axis=vector(3, 0, 0), radius=0.5)
assert c.length == 3
c.length = 5
assert c.axis.mag == 5
c2 = cylinder(length=2, radius=1)
assert c2.axis.x == 2
` },
  { id: 'obj-cone-pyramid', title: 'cone / pyramid', doc: 'cone', code: `from vpython import *
c = cone(pos=vector(5, 2, 0), axis=vector(3, 0, 0), radius=1, color=color.cyan)
p = pyramid(pos=vector(0, 0, 0), size=vector(1, 2, 3), color=color.red)
p2 = pyramid(length=2, height=1, width=1)
assert c.length == 3
` },
  { id: 'obj-ellipsoid', title: 'ellipsoid(length=, height=, width=)', doc: 'ellipsoid', code: `from vpython import *
e = ellipsoid(pos=vector(0, 0, 0), length=2, height=1, width=3, color=color.cyan)
assert e.size == vector(2, 1, 3)
e.length = 4
assert e.size.x == 4
` },
  { id: 'obj-ring', title: 'ring(radius=, thickness=, axis=)', doc: 'ring', code: `from vpython import *
r = ring(pos=vector(0, 0, 0), axis=vector(0, 1, 0), radius=2, thickness=0.2)
r.radius = 3
` },
  { id: 'obj-helix', title: 'helix(coils=, thickness=, length=)', doc: 'helix', code: `from vpython import *
h = helix(pos=vector(0, 0, 0), axis=vector(3, 0, 0), radius=0.5, coils=8, thickness=0.1)
h.length = 2
assert h.axis.mag == 2
h.axis = vector(0, 4, 0)
assert h.length == 4
` },
  { id: 'obj-arrow', title: 'arrow(axis=, shaftwidth=, headwidth=, headlength=)', doc: 'arrow', code: `from vpython import *
a = arrow(pos=vector(0, 0, 0), axis=vector(1, 0, 0), shaftwidth=0.1, headwidth=0.2, headlength=0.3, color=color.orange)
a.axis = vector(0, 2, 0)
assert a.length == 2
a.length = 1
assert a.axis.mag == 1
a.round = True
` },
  { id: 'obj-label', title: 'label(text=, box=False, height=, xoffset=, line=, opacity=)', doc: 'label', code: `from vpython import *
l = label(pos=vector(0, 0, 0), text='Early', xoffset=20, yoffset=50, space=30, height=16, border=4, font='sans', box=False, line=False, opacity=0.5, linecolor=color.red, background=color.black)
l.text = 'Later'
l.height = 20
l.color = color.yellow
` },
  { id: 'obj-text', title: "text(text='..', align=, depth=) 3D 글자", doc: 'text', code: `from vpython import *
t = text(text='Hello', align='center', color=color.green, depth=0.3, height=1, billboard=True)
t.pos = vector(0, 2, 0)
print(t.length, t.height)
` },
  { id: 'obj-curve-pos-list', title: 'curve(pos=[...]) 와 append / modify / point', doc: 'curve', code: `from vpython import *
c = curve(pos=[vector(-1, 3, 2), vector(2, 0, -1)], color=color.yellow, radius=0.05)
c.append(vector(3, 1, 0))
c.append(pos=vector(4, 1, 0), color=color.red)
c.append([vector(5, 1, 0), vector(6, 1, 0)])
assert c.npoints == 6
c.modify(0, pos=vector(0, 0, 0))
p = c.point(0)
assert p['pos'] == vector(0, 0, 0)
c.clear()
` },
  { id: 'obj-curve-dict-points', title: 'curve 에 dict 점 전달', doc: 'curve', code: `from vpython import *
c = curve(pos=[{'pos': vector(0, 0, 0), 'color': color.red}, {'pos': vector(1, 1, 0), 'color': color.blue}])
c.append({'pos': vector(2, 2, 0), 'radius': 0.1})
` },
  { id: 'obj-points', title: 'points(pos=[...], radius=)', doc: 'points', code: `from vpython import *
p = points(pos=[vector(0, 0, 0), vector(1, 0, 0)], radius=5, color=color.cyan)
p.append(vector(2, 0, 0))
` },
  { id: 'obj-compound', title: 'compound([...]) 과 pos/axis/rotate', doc: 'compound', code: `from vpython import *
parts = [box(pos=vector(0, 0, 0)), sphere(pos=vector(1, 0, 0), radius=0.3)]
c = compound(parts, pos=vector(3, 2, 0), axis=vector(1, 1, 0), color=color.red)
c.pos = vector(0, 0, 0)
c.axis = vector(0, 1, 0)
c.rotate(angle=0.2, axis=vector(0, 0, 1))
print(c.size)
` },
  { id: 'obj-compound-origin', title: 'compound(origin=)', doc: 'compound', code: `from vpython import *
c = compound([box(), sphere(pos=vector(2, 0, 0))], origin=vector(0, 0, 0))
print(c.pos)
` },
  { id: 'obj-extrusion', title: 'extrusion(path=, shape=shapes.circle)', doc: 'extrusion', code: `from vpython import *
e = extrusion(path=[vector(0, 0, 0), vector(0, 1, 0)], shape=shapes.circle(radius=0.5), color=color.red)
e2 = extrusion(path=paths.circle(radius=2), shape=shapes.rectangle(width=0.4, height=0.2))
` },
  { id: 'obj-shapes-paths', title: 'shapes.* / paths.* 생성', doc: 'shapes_and_paths', code: `from vpython import *
s1 = shapes.circle(radius=1)
s2 = shapes.rectangle(width=2, height=1)
s3 = shapes.triangle(length=1)
s4 = shapes.star(n=5, radius=1, iradius=0.5)
s5 = shapes.ngon(np=6, length=1)
p1 = paths.circle(radius=2)
p2 = paths.rectangle(width=2, height=1)
p3 = paths.line(start=vector(0, 0, 0), end=vector(1, 0, 0))
assert len(s1) > 3 and len(p1) > 3
` },
  { id: 'obj-vertex-triangle-quad', title: 'vertex / triangle / quad', doc: 'vertex', code: `from vpython import *
a = vertex(pos=vector(0, 0, 0), color=color.red)
b = vertex(pos=vector(1, 0, 0), color=color.green)
c = vertex(pos=vector(0, 1, 0), color=color.blue)
d = vertex(pos=vector(1, 1, 0))
T = triangle(v0=a, v1=b, v2=c)
Q = quad(v0=a, v1=b, v2=d, v3=c)
T2 = triangle(vs=[a, b, c])
a.pos = vector(0, 0, 1)
a.normal = vector(0, 0, 1)
` },
  { id: 'obj-simple-sphere', title: 'simple_sphere', doc: 'sphere', code: `from vpython import *
s = simple_sphere(pos=vector(0, 0, 0), radius=0.5, color=color.red)
` },
  { id: 'obj-group', title: 'group() 묶기', doc: 'group', code: `from vpython import *
g = group()
b = box(group=g)
s = sphere(pos=vector(1, 0, 0), group=g)
g.pos = vector(1, 1, 0)
g.rotate(angle=0.3, axis=vector(0, 1, 0))
` },

  // === 속성 변경 ===
  { id: 'attr-color-gray', title: 'color.gray(0.5)', doc: 'color', progress: true, code: `from vpython import *
c = color.gray(0.5)
assert c == vector(0.5, 0.5, 0.5)
b = box(color=color.gray(0.3))
` },
  { id: 'attr-color-hsv', title: 'color.hsv_to_rgb / rgb_to_hsv', doc: 'color', code: `from vpython import *
c = color.hsv_to_rgb(vector(0, 1, 1))
assert c == vector(1, 0, 0)
h = color.rgb_to_hsv(vector(1, 0, 0))
assert h.x == 0 and h.y == 1 and h.z == 1
` },
  { id: 'attr-color-names', title: 'GlowScript 색 이름 전체', doc: 'color', code: `from vpython import *
for c in [color.red, color.green, color.blue, color.yellow, color.cyan, color.magenta, color.orange, color.purple, color.black, color.white]:
    assert isinstance(c, vector)
print(color.green)
` },
  { id: 'attr-opacity-emissive-shininess', title: 'opacity / emissive / shininess', doc: 'opacity', code: `from vpython import *
b = box(opacity=0.5, shininess=0.2, emissive=False)
b.opacity = 0.3
b.emissive = True
b.shininess = 0.9
assert b.shininess == 0.9
` },
  { id: 'attr-texture-preset', title: 'texture=textures.wood 와 변경', doc: 'texture', code: `from vpython import *
b = box(texture=textures.wood)
s = sphere(texture=textures.earth)
b.texture = textures.metal
for name in ['flower', 'granite', 'gravel', 'earth', 'metal', 'rock', 'rough', 'rug', 'stones', 'stucco', 'wood', 'wood_old']:
    assert hasattr(textures, name), name
` },
  { id: 'attr-texture-url', title: 'texture 이미지 URL 과 dict 형식', doc: 'texture', code: `from vpython import *
b = box(texture='https://i.imgur.com/example.jpg')
b2 = box(texture={'file': textures.wood, 'place': 'right'})
b3 = box(texture={'file': textures.wood, 'bumpmap': bumpmaps.wood})
` },
  { id: 'attr-visible-false', title: 'obj.visible = False 로 숨기기', doc: 'standardAttributes', code: `from vpython import *
b = box()
b.visible = False
assert b.visible is False
b.visible = True
` },
  { id: 'attr-up-axis', title: 'obj.up / obj.axis 대입', doc: 'standardAttributes', code: `from vpython import *
c = cylinder()
c.axis = vector(0, 1, 0)
c.up = vector(1, 0, 0)
a = arrow()
a.axis = vector(1, 1, 1)
assert abs(a.axis.mag - 3 ** 0.5) < 1e-9
` },
  { id: 'attr-axis-mag', title: 'obj.axis.mag 읽기와 obj.pos.x 읽기', doc: 'standardAttributes', code: `from vpython import *
a = arrow(axis=vector(3, 4, 0), pos=vector(1, 2, 3))
assert a.axis.mag == 5
assert a.pos.x == 1 and a.pos.y == 2 and a.pos.z == 3
` },
  { id: 'attr-user-attributes', title: 'obj.velocity / obj.mass 사용자 속성', doc: 'workwithobjects', code: `from vpython import *
ball = sphere()
ball.velocity = vector(1, 0, 0)
ball.mass = 2.5
ball.p = ball.mass * ball.velocity
ball.charge = -1
assert ball.p == vector(2.5, 0, 0)
` },
  { id: 'attr-clone', title: 'obj.clone(pos=...)', doc: 'clone', code: `from vpython import *
b = box(color=color.red, size=vector(2, 1, 1))
b2 = b.clone(pos=vector(0, 2, 0))
assert b2.color == color.red and b2.size == vector(2, 1, 1)
l = label(text='hi')
l2 = l.clone(pos=vector(1, 0, 0))
` },
  { id: 'attr-del-object', title: 'del obj 와 visible=False 로 삭제', doc: 'workwithobjects', code: `from vpython import *
b = box()
b.visible = False
del b
s = sphere()
s.visible = False
` },
  { id: 'attr-rotate-method', title: 'obj.rotate(angle=, axis=, origin=)', doc: 'rotation', code: `from vpython import *
b = box(pos=vector(1, 0, 0), axis=vector(1, 0, 0))
b.rotate(angle=pi / 2, axis=vector(0, 0, 1), origin=vector(0, 0, 0))
assert abs(b.pos.y - 1) < 1e-9 and abs(b.pos.x) < 1e-9
assert abs(b.axis.y - 1) < 1e-9
b.rotate(angle=0.1)
rotate(b, angle=0.1, axis=vector(0, 1, 0))
` },
  { id: 'attr-rotate-sphere-default-axis', title: 'sphere.rotate 기본 축은 obj.axis', doc: 'rotation', code: `from vpython import *
s = sphere(pos=vector(0, 0, 0), axis=vector(1, 0, 0))
s.rotate(angle=0.5)
assert s.pos == vector(0, 0, 0)
` },
  { id: 'attr-dynamic-size-from-length', title: 'obj.size.y 변경이 height 에 반영', doc: 'box', progress: true, code: `from vpython import *
b = box()
b.size.y = 3
assert b.height == 3
` },

  // === 궤적 ===
  { id: 'trail-basic', title: 'make_trail=True + retain + trail_color', doc: 'trail', code: `from vpython import *
ball = sphere(make_trail=True, retain=50, trail_color=color.red, trail_radius=0.05)
for i in range(10):
    ball.pos = vector(i * 0.1, 0, 0)
ball.clear_trail()
` },
  { id: 'trail-points-interval', title: "trail_type='points', interval=, pps=", doc: 'trail', code: `from vpython import *
ball = sphere(make_trail=True, trail_type='points', interval=10, retain=1000, pps=15)
for i in range(30):
    ball.pos = vector(i * 0.1, 0, 0)
ball.make_trail = False
ball.pos = vector(5, 0, 0)
ball.make_trail = True
` },
  { id: 'trail-attach-trail', title: 'attach_trail(obj, color=, radius=, retain=, type=)', doc: 'trail', code: `from vpython import *
ball = sphere()
tr = attach_trail(ball, color=color.green, radius=0.02, retain=100, type='curve')
for i in range(5):
    ball.pos = vector(i, 0, 0)
tr.stop()
tr.start()
tr.clear()
` },
  { id: 'trail-attach-trail-function', title: 'attach_trail(function) 함수 궤적', doc: 'trail', code: `from vpython import *
t = 0
tr = attach_trail(lambda: vector(t, t * t, 0), color=color.red)
` },
  { id: 'attach-arrow', title: 'attach_arrow(ball, "velocity", scale=)', doc: 'attacharrow', progress: true, code: `from vpython import *
ball = sphere(radius=0.3)
ball.velocity = vector(1, 0, 0)
a = attach_arrow(ball, 'velocity', color=color.green, scale=0.5, shaftwidth=ball.radius / 3)
ball.velocity = vector(0, 2, 0)
ball.pos = vector(1, 0, 0)
a.stop()
a.start()
` },
  { id: 'attach-light', title: 'attach_light(ball, offset=)', doc: 'attach_light', code: `from vpython import *
ball = sphere()
attach_light(ball, offset=vector(3, 0, 1), color=color.green)
` },

  // === scene ===
  { id: 'scene-camera', title: 'scene.camera.pos / axis / follow', doc: 'camera', progress: true, code: `from vpython import *
b = box()
scene.camera.pos = vector(0, 0, 10)
scene.camera.axis = vector(0, 0, -10)
scene.camera.follow(b)
scene.camera.follow(None)
print(scene.camera.pos)
` },
  { id: 'scene-forward-range-center', title: 'scene.forward / range / center / up / fov', doc: 'canvas', progress: true, code: `from vpython import *
scene.forward = vector(0, -1, -1)
scene.range = 5
scene.center = vector(0, 1, 0)
scene.up = vector(0, 1, 0)
scene.fov = pi / 4
scene.autoscale = False
print(scene.range, scene.center, scene.forward)
` },
  { id: 'scene-ambient-lights', title: 'scene.ambient / scene.lights = []', doc: 'light', progress: true, code: `from vpython import *
scene.ambient = color.gray(0.2)
scene.lights = []
distant_light(direction=vector(0, -1, 0), color=color.orange)
local_light(pos=vector(-3, 1, -2), color=color.yellow)
print(len(scene.lights))
` },
  { id: 'scene-title-caption', title: 'scene.title / caption / append_to_caption', doc: 'canvas', progress: true, code: `from vpython import *
scene.title = 'This is the <i>Title</i>'
scene.caption = 'White spheres are <b>boring</b>.'
scene.append_to_caption('\\nMore text')
scene.append_to_title('again')
` },
  { id: 'scene-size', title: 'scene.width / height / background / visible', doc: 'canvas', code: `from vpython import *
scene.width = 800
scene.height = 400
scene.background = color.white
scene.visible = True
scene.resizable = False
` },
  { id: 'scene-userzoom', title: 'scene.userzoom / userspin / userpan', doc: 'canvas', code: `from vpython import *
scene.userzoom = False
scene.userspin = False
scene.userpan = False
` },
  { id: 'scene-objects-delete', title: 'scene.objects / scene.delete()', doc: 'canvas', code: `from vpython import *
box(); sphere()
assert len(scene.objects) == 2
for obj in scene.objects:
    obj.visible = False
scene.delete()
` },
  { id: 'scene-canvas-new', title: 'canvas() 추가 캔버스와 canvas= 인자', doc: 'canvases', code: `from vpython import *
scene2 = canvas(width=300, height=200, background=color.white, title='second')
b = box(canvas=scene2)
scene2.select()
s = sphere()
scene.select()
b.canvas = scene
` },
  { id: 'scene-align', title: "canvas(align='left') + graph(align='right')", doc: 'canvas', code: `from vpython import *
scene.align = 'left'
g = graph(align='right', width=300, height=200)
` },
  { id: 'scene-pixel-to-world', title: 'scene.pixel_to_world 읽기', doc: 'canvas', code: `from vpython import *
print(scene.pixel_to_world)
` },

  // === 그래프 ===
  { id: 'graph-gcurve', title: 'graph() + gcurve().plot(x, y)', doc: 'graph', code: `from vpython import *
g = graph(title='My Graph', xtitle='x', ytitle='t', xmin=0, ymin=-20, width=500, height=300)
gc = gcurve(color=color.red, label='y')
for x in range(10):
    gc.plot(x, x * x)
gc.plot(pos=(11, 121))
gc.plot([(12, 144), (13, 169)])
gc.plot(14, 196, 15, 225)
` },
  { id: 'graph-gdots-gvbars', title: 'gdots / gvbars / ghbars', doc: 'graph', code: `from vpython import *
gd = gdots(color=color.red, radius=3)
gd.plot(1, 2)
gv = gvbars(delta=0.05, color=color.blue)
gv.plot(1, 2)
gh = ghbars(delta=0.2, color=color.green)
gh.plot(1, 2)
gd.delete()
` },
  { id: 'graph-fast-false', title: 'graph(fast=False) 와 데이터 교체', doc: 'graph', code: `from vpython import *
g = graph(fast=False, scroll=True, xmin=0, xmax=10)
gc = gcurve(graph=g, color=color.red, dot=True, interval=5)
gc.plot(0, 0)
gc.data = [(0, 0), (1, 1)]
gc.delete()
g.delete()
` },

  // === 이벤트 ===
  { id: 'event-bind-keydown', title: "scene.bind('keydown', f) 와 ev.key", doc: 'key', code: `from vpython import *
def onkey(ev):
    print(ev.key, ev.event, ev.which)
scene.bind('keydown', onkey)
scene.bind('keyup', onkey)
scene.unbind('keyup', onkey)
` },
  { id: 'event-bind-click-pos', title: "scene.bind('click', f) 와 ev.pos / ev.pick", doc: 'mouse', code: `from vpython import *
def onclick(ev):
    print(ev.pos, ev.pick, ev.event)
    if ev.pick:
        ev.pick.color = color.red
scene.bind('click', onclick)
scene.bind('mousedown mousemove mouseup', onclick)
` },
  { id: 'event-bind-decorator', title: '@scene.bind 데코레이터는 GlowScript에 없음(VPyLab 확장 확인)', doc: 'mouse', code: `from vpython import *
def f(ev):
    pass
scene.bind('click', f)
` },
  { id: 'event-mouse-pos-pick', title: 'scene.mouse.pos / pick / project / ray', doc: 'mouse', code: `from vpython import *
b = box()
p = scene.mouse.pos
assert isinstance(p, vector)
o = scene.mouse.pick
r = scene.mouse.ray
q = scene.mouse.project(normal=vector(0, 1, 0))
print(scene.mouse.alt, scene.mouse.shift, scene.mouse.ctrl)
` },
  { id: 'event-keysdown', title: 'keysdown()', doc: 'key', code: `from vpython import *
k = keysdown()
assert isinstance(k, list)
if 'up' in k:
    print('up')
` },
  { id: 'event-waitfor-click', title: "scene.waitfor('click')", doc: 'mouse', code: `from vpython import *
b = box()
ev = scene.waitfor('click')
print('clicked', ev.pos)
` },
  { id: 'event-waitfor-keydown', title: "scene.waitfor('keydown') 로 키 대기", doc: 'key', code: `from vpython import *
ev = scene.waitfor('keydown')
print(ev.key)
` },
  { id: 'event-pause', title: 'scene.pause()', doc: 'pause', code: `from vpython import *
box()
scene.pause()
print('resumed')
` },
  { id: 'event-waitfor-redraw', title: "scene.waitfor('redraw draw_complete')", doc: 'canvas', code: `from vpython import *
box()
scene.waitfor('redraw')
scene.waitfor('draw_complete')
` },

  // === 위젯 ===
  { id: 'widget-slider', title: 'slider(bind=f, min=, max=, value=)', doc: 'slider', code: `from vpython import *
def setrate(s):
    print(s.value, s.id)
sl = slider(bind=setrate, min=0, max=10, value=5, step=0.5, length=300, left=10, right=10, id='r')
sl.value = 7
assert sl.value == 7
sl.disabled = True
sl.delete()
` },
  { id: 'widget-button', title: 'button(bind=f, text=) 와 b.text 변경', doc: 'button', code: `from vpython import *
def run(b):
    b.text = 'Pause' if b.text == 'Run' else 'Run'
b = button(bind=run, text='Run', background=color.cyan, color=color.red)
b.text = 'Stop'
assert b.text == 'Stop'
b.disabled = True
` },
  { id: 'widget-wtext', title: 'wtext(text=) 와 .text 갱신', doc: 'wtext', code: `from vpython import *
w = wtext(text='초기값')
w.text = '변경됨'
assert w.text == '변경됨'
scene.append_to_caption('\\n')
w2 = wtext(text='{:.2f}'.format(3.14159))
` },
  { id: 'widget-winput', title: "winput(bind=f, type='numeric')", doc: 'textinput', code: `from vpython import *
def got(w):
    print(w.number, w.text)
w = winput(bind=got, type='numeric', prompt='값: ', width=80)
w2 = winput(bind=got, type='string', text='hello')
print(w2.text)
` },
  { id: 'widget-checkbox-radio-menu', title: 'checkbox / radio / menu', doc: 'checkbox', code: `from vpython import *
def f(w):
    print(w.checked if hasattr(w, 'checked') else w.selected)
c = checkbox(bind=f, text='보이기', checked=True)
r = radio(bind=f, text='A', checked=False, name='g')
m = menu(bind=f, choices=['red', 'green', 'blue'], selected='green', index=1)
assert c.checked is True
assert m.selected == 'green'
m.selected = 'blue'
assert m.index == 2
c.delete()
` },
  { id: 'widget-caption-placement', title: 'scene.caption 뒤에 위젯 배치와 pos=scene.title_anchor', doc: 'widgetPosition', code: `from vpython import *
scene.caption = '속도 조절\\n'
sl = slider(bind=lambda s: None, pos=scene.caption_anchor)
b = button(bind=lambda b: None, text='x', pos=scene.title_anchor)
` },

  // === 실행 흐름 ===
  { id: 'flow-rate-loop', title: 'while True + rate(100) 루프', doc: 'rate', code: `from vpython import *
ball = sphere()
t = 0
while True:
    rate(100)
    t += 0.01
    ball.pos = vector(sin(t), 0, 0)
` },
  { id: 'flow-rate-in-function', title: '함수 안에서 rate() 호출', doc: 'rate', code: `from vpython import *
ball = sphere()
def step(n):
    for i in range(n):
        rate(50)
        ball.pos = ball.pos + vector(0.01, 0, 0)
step(20)
print('done', ball.pos.x)
` },
  { id: 'flow-rate-in-method', title: '클래스 메서드 안에서 rate()', doc: 'rate', code: `from vpython import *
class Ball:
    def __init__(self):
        self.ball = sphere(radius=0.3)
        self.v = vector(1, 0, 0)
    def run(self):
        for i in range(10):
            rate(60)
            self.ball.pos += self.v * 0.01
b = Ball()
b.run()
print(b.ball.pos)
` },
  { id: 'flow-sleep', title: 'sleep(0.1)', doc: 'rate', code: `from vpython import *
box()
sleep(0.1)
print('after sleep')
` },
  { id: 'flow-while-no-rate', title: 'rate 없는 while True 무한 루프(정지 가능?)', doc: 'rate', tags: ['hang'], code: `from vpython import *
b = box()
n = 0
while True:
    n += 1
    b.pos = vector(n % 10, 0, 0)
` },
  { id: 'flow-for-no-rate', title: 'rate 없이 for 루프로 pos 갱신(마지막 상태만 보여야 함)', doc: 'rate', code: `from vpython import *
b = box()
for i in range(1000):
    b.pos = vector(i * 0.001, 0, 0)
print(b.pos)
` },
  { id: 'flow-import-vpython', title: 'import vpython 후 vpython.sphere()', doc: 'package', code: `import vpython
s = vpython.sphere(color=vpython.color.red)
v = vpython.vector(1, 2, 3)
print(vpython.mag(v))
` },
  { id: 'flow-import-as', title: 'import vpython as vp', doc: 'package', code: `import vpython as vp
b = vp.box(pos=vp.vec(1, 0, 0))
vp.rate(30)
` },
  { id: 'flow-from-import-names', title: 'from vpython import sphere, vector, color, rate', doc: 'package', code: `from vpython import sphere, vector, color, rate
s = sphere(pos=vector(0, 0, 0), color=color.red)
rate(30)
` },
  { id: 'flow-math-bare', title: 'from vpython import * 뒤 sin/cos/pi/sqrt 바로 사용', doc: 'mathfunct', code: `from vpython import *
x = sin(pi / 2) + cos(0) + sqrt(4) + exp(0) + log(1) + atan2(1, 1) + floor(1.5) + ceil(1.2) + radians(180) + degrees(pi) + factorial(3)
print(x, abs(-1), round(2.567, 2), max(1, 2, 3), min(1, 2))
` },
  { id: 'flow-random-bare', title: 'from vpython import * 뒤 random() 바로 사용', doc: 'mathfunct', code: `from vpython import *
r = random()
assert 0 <= r < 1
` },
  { id: 'flow-random-module', title: 'import random; random.random/choice/uniform/randint', doc: 'mathfunct', code: `from vpython import *
import random
print(random.random(), random.choice([1, 2, 3]), random.uniform(0, 1), random.randint(1, 6))
from random import randint, uniform
print(randint(1, 3), uniform(0, 1))
` },
  { id: 'flow-math-module', title: 'import math; math.sin/cos/pi', doc: 'mathfunct', code: `from vpython import *
import math
print(math.sin(math.pi / 2), math.cos(0))
` },
  { id: 'flow-arange-clock', title: 'arange / clock / msclock / sign / combin', doc: 'mathfunct', code: `from vpython import *
xs = arange(0, 1, 0.25)
assert len(list(xs)) == 4
t0 = clock()
print(msclock(), sign(-3), combin(5, 2))
` },
  { id: 'flow-print-formats', title: 'print 서식: f-string / % / format / sep end', doc: 'print', code: `from vpython import *
v = vector(1, 2, 3)
x = 3.14159
print(f'{x:.2f}', '%.1f' % x, '{:.3f}'.format(x))
print('a', 'b', sep='-', end='!\\n')
print(v, mag(v))
print_options(digits=3)
print(v)
` },
  { id: 'flow-input', title: 'input() 사용', doc: 'textinput', tags: ['input'], code: `from vpython import *
name = input('이름을 입력하세요: ')
print('안녕', name)
` },
  { id: 'flow-comprehension', title: '리스트·딕셔너리 컴프리헨션으로 객체 생성', doc: 'workwithobjects', code: `from vpython import *
balls = [sphere(pos=vector(i, 0, 0), radius=0.2) for i in range(5)]
colors = {i: vector(i / 5, 0, 1 - i / 5) for i in range(5)}
for i, b in enumerate(balls):
    b.color = colors[i]
assert len(balls) == 5
` },
  { id: 'flow-class-with-objects', title: '클래스 정의 후 self.ball = sphere()', doc: 'workwithobjects', code: `from vpython import *
class Planet:
    def __init__(self, r, c):
        self.ball = sphere(radius=r, color=c, make_trail=True)
        self.angle = 0
    def move(self, dt):
        self.angle += dt
        self.ball.pos = vector(cos(self.angle), 0, sin(self.angle))
p = Planet(0.3, color.blue)
for i in range(10):
    rate(100)
    p.move(0.1)
` },
  { id: 'flow-global-in-handler', title: '이벤트 핸들러에서 global 변수 변경', doc: 'key', code: `from vpython import *
running = True
def toggle(ev):
    global running
    running = not running
scene.bind('click', toggle)
b = box()
for i in range(5):
    rate(60)
    if running:
        b.pos += vector(0.1, 0, 0)
` },
  { id: 'flow-global-called-in-loop', title: 'rate 루프 안에서 global 변수를 바꾸는 함수 호출', doc: 'rate', code: `from vpython import *
score = 0
def hit():
    global score
    score += 1
b = box()
for i in range(3):
    rate(60)
    hit()
assert score == 3, score
` },
  { id: 'flow-global-no-rate', title: 'rate 없이 global 변수를 바꾸는 함수 호출', doc: 'rate', code: `from vpython import *
count = 0
def bump():
    global count
    count += 1
bump(); bump()
assert count == 2
` },
  { id: 'flow-lambda-rate-warning', title: 'lambda 안의 rate 호출(경고 확인)', doc: 'rate', code: `from vpython import *
f = lambda: rate(10)
print('ok')
` },
  { id: 'flow-scene-visible-false', title: 'scene.visible = False', doc: 'canvas', code: `from vpython import *
box()
scene.visible = False
scene.visible = True
` },
  { id: 'flow-rotate-keyword-only', title: 'obj.rotate(angle=0.1) 축 생략', doc: 'rotation', code: `from vpython import *
b = box(axis=vector(0, 1, 0))
b.rotate(angle=0.1)
print(b.axis)
` },
  { id: 'flow-pos-chain', title: 'obj.pos = obj.pos + v 와 obj.pos.x 읽기 반복', doc: 'vector', code: `from vpython import *
b = box()
v = vector(0.1, 0, 0)
for i in range(10):
    b.pos = b.pos + v
assert abs(b.pos.x - 1) < 1e-9
` },
  { id: 'flow-vector-in-fstring', title: 'f-string 안의 벡터 출력 서식', doc: 'print', code: `from vpython import *
v = vector(1.23456, 2, 3)
print(f'pos={v}')
` },
  { id: 'flow-two-objects-same-var', title: '같은 변수에 객체 재생성(이전 객체는 남음)', doc: 'workwithobjects', code: `from vpython import *
b = box()
b = box(pos=vector(2, 0, 0))
assert len(scene.objects) == 2
` },
  { id: 'flow-local-light-attrs', title: 'local_light.pos 변경과 distant_light.direction', doc: 'light', code: `from vpython import *
L = local_light(pos=vector(0, 0, 0), color=color.yellow)
L.pos = vector(1, 1, 1)
D = distant_light(direction=vector(0, -1, 0), color=color.gray(0.5))
D.direction = vector(1, 0, 0)
` },
  { id: 'flow-canvas-events-on-other', title: 'scene.bind 와 canvas.bind 모두 지원', doc: 'canvas', code: `from vpython import *
def f(ev):
    pass
c2 = canvas()
c2.bind('click', f)
scene.bind('resize', f)
` },
  { id: 'flow-compound-clone', title: 'compound.clone()', doc: 'compound', code: `from vpython import *
c = compound([box(), sphere(pos=vector(1, 0, 0))])
c2 = c.clone(pos=vector(0, 3, 0))
` },
  { id: 'flow-get-library', title: 'get_library / read_local_file (GlowScript 전용 함수)', doc: 'file', tags: ['glowscript-only'], code: `from vpython import *
print(callable(get_library), callable(read_local_file))
` },
];

export default IDIOMS.filter((item) => item.code);
export { D as DOC_BASE };

"""'즉시 수정 가능' 항목을 임시로 덧씌우는 심(what-if 측정용).

static-harness.py --shim 으로 API 로드와 모듈 등록 뒤에 실행된다. 앱 코드는 바꾸지 않는다.
목적: 한 줄짜리 수정들이 들어가면 공식 예제·데모가 어디까지 진행되는지(두 번째 오류가 무엇인지) 재는 것.
여기 있는 구현은 측정용 최소 구현이며 제품 코드로 옮길 품질이 아니다.
"""
import sys as _sys
import math as _math
import random as _random
import colorsys as _colorsys
import time as _time

_vp = _sys.modules['vpython']
_added = {}

# A1·A2·A14: 수학 이름, random(), arange, clock, sign, combin, print_options
for _n in dir(_math):
    if not _n.startswith('_'):
        _added[_n] = getattr(_math, _n)
_added['random'] = _random.random
_added['arange'] = lambda start, stop=None, step=1: (
    [start + i * step for i in range(int(_math.ceil(((stop if stop is not None else start) - (start if stop is not None else 0)) / step)))]
    if stop is not None else [i * step for i in range(int(_math.ceil(start / step)))]
)
_added['clock'] = _time.time
_added['msclock'] = lambda: _time.time() * 1000
_added['sign'] = lambda x: (x > 0) - (x < 0)
_added['combin'] = lambda n, k: _math.comb(int(n), int(k))
_added['print_options'] = lambda **kw: None

# B1: scene.width / height setter
_Scene.width = property(lambda s: s.__dict__.get('_shim_width', 640), lambda s, v: s.__dict__.__setitem__('_shim_width', v))
_Scene.height = property(lambda s: s.__dict__.get('_shim_height', 400), lambda s, v: s.__dict__.__setitem__('_shim_height', v))
_Scene.align = property(lambda s: s.__dict__.get('_shim_align', 'none'), lambda s, v: s.__dict__.__setitem__('_shim_align', v))
_Scene.resizable = property(lambda s: True, lambda s, v: None)
_Scene.caption_anchor = property(lambda s: None)
_Scene.title_anchor = property(lambda s: None)
_Scene.pixel_to_world = property(lambda s: 0.01)
_Scene.select = lambda s: None

# A3: canvas() — 단일 캔버스: 인자를 scene 에 적용하고 scene 을 돌려준다
def canvas(**kw):
    for k, v in kw.items():
        try:
            setattr(scene, k, v)
        except Exception:
            pass
    return scene
canvas.get_selected = staticmethod(lambda: scene)
_added['canvas'] = canvas

# B9: scene.objects — 생성된 객체 추적
_orig_gobject_init = _GObject.__init__
def _tracking_init(self, *a, **kw):
    _orig_gobject_init(self, *a, **kw)
    scene.__dict__.setdefault('_shim_objects', []).append(self)
_GObject.__init__ = _tracking_init
_Scene.objects = property(lambda s: [o for o in s.__dict__.get('_shim_objects', []) if getattr(o, 'visible', True)])

# A11, B4, B5, A7, A6
_added['simple_sphere'] = sphere
vector.norm = lambda self: self.hat
vector.equals = lambda self, other: self == other
vector.random = staticmethod(lambda: vector(_random.uniform(-1, 1), _random.uniform(-1, 1), _random.uniform(-1, 1)))
_added['proj'] = lambda a, b: a.proj(b)
_added['comp'] = lambda a, b: a.comp(b)
_added['diff_angle'] = lambda a, b: a.diff_angle(b)
def rotate(obj, angle=0, axis=None, origin=None):
    if isinstance(obj, vector):
        return obj.rotate(angle, axis=axis if axis is not None else vector(0, 0, 1))
    return obj.rotate(angle=angle, axis=axis, origin=origin)
_added['rotate'] = rotate

# B8: 색 변환
def _hsv_to_rgb(c):
    r, g, b = _colorsys.hsv_to_rgb(c.x, c.y, c.z)
    return vector(r, g, b)
def _rgb_to_hsv(c):
    h, s, v = _colorsys.rgb_to_hsv(c.x, c.y, c.z)
    return vector(h, s, v)
type(color).hsv_to_rgb = staticmethod(_hsv_to_rgb)
type(color).rgb_to_hsv = staticmethod(_rgb_to_hsv)

# A12: 텍스처 이름·bumpmaps
for _n in ['rock', 'wood_old', 'earth', 'granite', 'gravel', 'rough', 'rug', 'stones', 'stucco', 'flower', 'metal', 'wood']:
    if not hasattr(textures, _n):
        setattr(type(textures), _n, 'preset:wood')
class _Bumpmaps:
    wood = 'bump:wood'; wood_old = 'bump:wood_old'; stucco = 'bump:stucco'; stones = 'bump:stones'; rock = 'bump:rock'; gravel = 'bump:gravel'
_added['bumpmaps'] = _Bumpmaps()

# A8·A9: attach_trail / attach_light 함수형
class _TrailHandle:
    def __init__(self, obj): self.obj = obj
    def stop(self): self.obj._make_trail = False
    def start(self): self.obj._make_trail = True
    def clear(self): self.obj.clear_trail()
def attach_trail(obj, **kw):
    if callable(obj) and not hasattr(obj, 'attach_trail'):
        return _TrailHandle(type('_F', (), {'_make_trail': False, 'clear_trail': lambda s: None})())
    obj.attach_trail(color=kw.get('color'), retain=kw.get('retain', 10000))
    return _TrailHandle(obj)
_added['attach_trail'] = attach_trail
_added['attach_light'] = lambda obj, offset=None, color=None, **kw: local_light(pos=obj.pos + (offset or vector(0, 0, 0)), color=color or vector(1, 1, 1))

# B6·B7: length / size
def _len_get(self): return self.axis.mag
def _len_set(self, v): self.axis = self.axis.hat * float(v) if self.axis.mag > 0 else vector(float(v), 0, 0)
for _cls in (cylinder, cone, arrow, helix):
    if not isinstance(getattr(_cls, 'length', None), property):
        _cls.length = property(_len_get, _len_set)
if not isinstance(getattr(sphere, 'size', None), property):
    sphere.size = property(lambda s: vector(2 * s.radius, 2 * s.radius, 2 * s.radius), lambda s, v: setattr(s, 'radius', v.x / 2))

# A5: wtext
class wtext:
    def __init__(self, text='', **kw):
        self._text = str(text)
        print(f'[wtext] {self._text}')
    @property
    def text(self): return self._text
    @text.setter
    def text(self, v): self._text = str(v)
_added['wtext'] = wtext

# B13·B14: winput.text/number, menu.selected/index
winput.text = property(lambda s: s.__dict__.get('_shim_text', ''), lambda s, v: s.__dict__.__setitem__('_shim_text', v))
winput.number = property(lambda s: float(s.text) if str(s.text).strip() else None)
menu.selected = property(lambda s: s.value, lambda s, v: setattr(s, 'value', v))
menu.index = property(lambda s: s._choices.index(s.value) if s.value in s._choices else -1, lambda s, v: setattr(s, 'value', s._choices[v]))

# C1: curve.append(pos=..., color=...) / append([v1, v2]) / dict 점
_orig_curve_append = curve.append
def _curve_append(self, pos=None, **kw):
    if isinstance(pos, dict):
        pos = pos.get('pos')
    if isinstance(pos, (list, tuple)) and pos and isinstance(pos[0], (vector, dict, list, tuple)) and not (len(pos) == 3 and isinstance(pos[0], (int, float))):
        for p in pos:
            _curve_append(self, p)
        return
    _orig_curve_append(self, pos)
curve.append = _curve_append

for _k, _v in _added.items():
    globals()[_k] = _v
    setattr(_vp, _k, _v)

"""
VPyLab — Python 측 VPython API
Pyodide Web Worker 내에서 실행됨.
Three.js 메인 스레드로 JSON 커맨드를 전송하는 방식.

커맨드 배칭: rate() 호출 시 누적된 커맨드를 한번에 전송
"""

import js
import json
import math
import re
import asyncio
import colorsys
import random as _random_module
import time as _time_module
from typing import Optional
from math import *   # GlowScript처럼 from vpython import * 가 sin, cos, pi, sqrt 등 math 이름을 함께 제공한다

# vector 출력 자릿수 — print_options(digits=...)로 바꾼다
_print_digits = 4

# === 커맨드 버퍼 (배칭) ===
_command_buffer = []
_object_counter = 0


def _send_commands():
    """버퍼의 모든 커맨드를 메인 스레드로 한번에 전송"""
    global _command_buffer
    if _command_buffer:
        # JSON 문자열로 직렬화하여 전송 (Proxy 객체 문제 회피)
        js.postMessage(json.dumps({
            "type": "batch",
            "runId": _current_run_id(),
            "commands": _command_buffer
        }))
        _command_buffer = []


def _add_command(cmd):
    """커맨드를 버퍼에 추가"""
    _command_buffer.append(cmd)


def _current_run_id():
    """현재 실행 번호. 이전 실행의 늦은 메시지를 브라우저에서 걸러내기 위해 함께 보낸다."""
    try:
        return int(js._getCurrentRunId())
    except:
        return 0


def _new_id():
    global _object_counter
    _object_counter += 1
    return f"obj_{_object_counter}"


# === vector 클래스 ===
class vector:
    """3차원 벡터. 물체의 pos·axis·size·color로 쓰이면 ball.pos.x += 1 처럼 성분만 바꿔도 화면에 반영된다."""
    def __init__(self, x=0, y=0, z=0):
        self._owner = None   # 이 벡터를 속성으로 가진 객체 (예: sphere)
        self._attr = None    # 그 객체에서의 속성 이름 (예: 'pos')
        if isinstance(x, vector):
            # vector(v) — GlowScript처럼 복사본을 만든다
            x, y, z = x._x, x._y, x._z
        self._x = float(x)
        self._y = float(y)
        self._z = float(z)

    def _changed(self):
        """성분이 바뀌면 소유 객체의 속성 세터를 다시 호출해 화면 갱신 커맨드를 보낸다."""
        owner = self._owner
        if owner is not None:
            setattr(owner, self._attr, self)

    @property
    def x(self):
        return self._x

    @x.setter
    def x(self, value):
        self._x = float(value)
        self._changed()

    @property
    def y(self):
        return self._y

    @y.setter
    def y(self, value):
        self._y = float(value)
        self._changed()

    @property
    def z(self):
        return self._z

    @z.setter
    def z(self, value):
        self._z = float(value)
        self._changed()

    def __repr__(self):
        d = _print_digits
        return f"<{self.x:.{d}g}, {self.y:.{d}g}, {self.z:.{d}g}>"

    def __add__(self, other):
        return vector(self.x + other.x, self.y + other.y, self.z + other.z)

    def __sub__(self, other):
        return vector(self.x - other.x, self.y - other.y, self.z - other.z)

    def __mul__(self, s):
        if isinstance(s, (int, float)):
            return vector(self.x * s, self.y * s, self.z * s)
        return NotImplemented

    def __rmul__(self, s):
        return self.__mul__(s)

    def __truediv__(self, s):
        return vector(self.x / s, self.y / s, self.z / s)

    def __neg__(self):
        return vector(-self.x, -self.y, -self.z)

    def __eq__(self, other):
        if not isinstance(other, vector):
            return NotImplemented
        return self.x == other.x and self.y == other.y and self.z == other.z

    def __ne__(self, other):
        eq = self.__eq__(other)
        return NotImplemented if eq is NotImplemented else not eq

    def __hash__(self):
        return hash((self.x, self.y, self.z))

    @property
    def mag(self):
        return (self.x**2 + self.y**2 + self.z**2) ** 0.5

    @property
    def mag2(self):
        return self.x**2 + self.y**2 + self.z**2

    @property
    def hat(self):
        m = self.mag
        if m == 0:
            return vector(0, 0, 0)
        return self / m

    def dot(self, other):
        return self.x * other.x + self.y * other.y + self.z * other.z

    def cross(self, other):
        return vector(
            self.y * other.z - self.z * other.y,
            self.z * other.x - self.x * other.z,
            self.x * other.y - self.y * other.x,
        )

    def to_list(self):
        return [self.x, self.y, self.z]

    def clone(self):
        """벡터 복제 — 원본과 독립된 새 벡터 반환"""
        return vector(self.x, self.y, self.z)

    def proj(self, b):
        """self를 b 방향으로 투영한 벡터 (vector projection)"""
        bh = b.hat
        return bh * self.dot(bh)

    def comp(self, b):
        """self의 b 방향 스칼라 성분 (scalar projection)"""
        return self.dot(b.hat)

    def diff_angle(self, b):
        """두 벡터 사이의 각 (라디안)"""
        import math
        m1 = self.mag
        m2 = b.mag
        if m1 == 0 or m2 == 0:
            return 0.0
        cos_t = self.dot(b) / (m1 * m2)
        # 부동소수 오차 보정
        if cos_t > 1.0: cos_t = 1.0
        elif cos_t < -1.0: cos_t = -1.0
        return math.acos(cos_t)

    def rotate(self, angle, axis=None):
        """주어진 축을 중심으로 angle(라디안)만큼 회전한 새 벡터 (Rodrigues 공식)
        axis 미지정 시 z축(0,0,1) 사용"""
        import math
        if axis is None:
            axis = vector(0, 0, 1)
        k = axis.hat
        cos_a = math.cos(angle)
        sin_a = math.sin(angle)
        v = self
        return v * cos_a + k.cross(v) * sin_a + k * (k.dot(v) * (1 - cos_a))

    def norm(self):
        """단위 벡터 — hat과 같다 (GlowScript 호환)"""
        return self.hat

    def equals(self, other):
        """성분이 모두 같은지 비교 (GlowScript 호환)"""
        return self == other

    @staticmethod
    def random():
        """각 성분이 -1~1 사이인 난수 벡터"""
        return vector(
            _random_module.uniform(-1, 1),
            _random_module.uniform(-1, 1),
            _random_module.uniform(-1, 1),
        )


# vec() — vector()의 단축 별칭
vec = vector


def _serialize_command_value(value):
    """Three.js 브릿지로 보낼 수 있는 JSON 친화 값으로 변환."""
    if isinstance(value, vector):
        return value.to_list()
    if isinstance(value, (int, float, bool, str)):
        return value
    if isinstance(value, (list, tuple)):
        serialized = []
        for item in value:
            converted = _serialize_command_value(item)
            if converted is None:
                return None
            serialized.append(converted)
        return serialized
    return None


def _coerce_vector(value, default=None):
    """vector, list, tuple을 vector로 맞춘다."""
    if isinstance(value, vector):
        # 사용자 벡터와 내부 상태 공유(aliasing) 방지 — 복제본 반환
        return value.clone()
    if isinstance(value, (list, tuple)) and len(value) >= 3:
        return vector(value[0], value[1], value[2])
    if isinstance(default, vector):
        return default.clone()
    return default


# === 한 번만 출력하는 안내 · group 인자 · 공통 회전 ===
_notices_shown = set()   # 실행 한 번에 한 번만 출력하는 안내문의 키


def _notice_once(key, message):
    """같은 안내문은 실행 한 번에 한 번만 출력한다."""
    if key in _notices_shown:
        return
    _notices_shown.add(key)
    print(message)


def _track_scene_object(obj):
    _scene_objects.append(obj)


def _untrack_scene_object(obj):
    try:
        _scene_objects.remove(obj)
    except ValueError:
        pass


def _group_ref(value):
    """group= 인자를 검사해 group 객체를 돌려준다. None이면 None."""
    if value is None:
        return None
    if not isinstance(value, group):
        raise TypeError("group= 인자에는 group()으로 만든 객체를 넘겨야 합니다")
    return value


def _rotate_object(obj, angle, axis=None, origin=None):
    """pos(와 있으면 axis·up)를 가진 객체를 origin을 지나는 axis 축으로 angle(라디안)만큼 회전한다.
    origin 미지정: 객체 자기 위치(자리는 그대로 두고 방향만 돈다).
    axis 미지정: 객체 자신의 axis (GlowScript와 같음). axis가 없는 객체(sphere 등)는 y축."""
    if axis is None:
        own = getattr(obj, '_axis', None)
        axis = own.clone() if isinstance(own, vector) and own.mag > 0 else vector(0, 1, 0)
    else:
        axis = _coerce_vector(axis, vector(0, 1, 0))
    if origin is None:
        origin = obj.pos
    else:
        origin = _coerce_vector(origin, vector(0, 0, 0))
    rel = obj.pos - origin
    obj.pos = origin + rel.rotate(angle, axis=axis)
    if isinstance(getattr(obj, '_axis', None), vector):
        obj.axis = obj._axis.rotate(angle, axis=axis)
    if isinstance(getattr(obj, '_up', None), vector):
        obj.up = obj._up.rotate(angle, axis=axis)


# === 색상 팔레트 (30색) ===
# color.red, color['빨'], 색상['빨강'] 모두 가능

class _GrayColor(vector):
    """color.gray는 회색 벡터이면서, color.gray(0.2)처럼 밝기를 지정할 수도 있다 (GlowScript 호환)."""
    def __call__(self, level):
        level = float(level)
        return vector(level, level, level)


class _ColorPalette:
    """30색 팔레트 — 속성(.red)과 이름 접근(['빨']) 모두 지원"""

    # --- 기본 색 (기존 호환) ---
    red       = vector(1, 0, 0)
    green     = vector(0, 0.8, 0)
    blue      = vector(0, 0, 1)
    yellow    = vector(1, 1, 0)
    cyan      = vector(0, 1, 1)
    magenta   = vector(1, 0, 1)
    orange    = vector(1, 0.6, 0)
    white     = vector(1, 1, 1)
    black     = vector(0, 0, 0)
    gray      = _GrayColor(0.5, 0.5, 0.5)
    purple    = vector(0.5, 0, 0.5)

    # --- 확장 색 (학생 친화적) ---
    pink      = vector(1, 0.75, 0.8)
    brown     = vector(0.6, 0.3, 0.1)
    gold      = vector(1, 0.84, 0)
    silver    = vector(0.75, 0.75, 0.75)
    navy      = vector(0, 0, 0.5)
    skyblue   = vector(0.53, 0.81, 0.92)
    lime      = vector(0.5, 1, 0)
    olive     = vector(0.5, 0.5, 0)
    coral     = vector(1, 0.5, 0.31)
    salmon    = vector(0.98, 0.5, 0.45)
    violet    = vector(0.56, 0, 1)
    indigo    = vector(0.29, 0, 0.51)
    beige     = vector(0.96, 0.96, 0.86)
    mint      = vector(0.6, 1, 0.8)
    peach     = vector(1, 0.85, 0.73)
    lavender  = vector(0.71, 0.49, 0.86)
    maroon    = vector(0.5, 0, 0)
    teal      = vector(0, 0.5, 0.5)
    ivory     = vector(1, 1, 0.94)

    # 한글 → 영어 매핑
    _name_map = {
        # 기본 색
        '빨': 'red', '빨강': 'red', '빨간': 'red',
        '초': 'green', '초록': 'green', '녹': 'green', '녹색': 'green',
        '파': 'blue', '파랑': 'blue', '파란': 'blue',
        '노': 'yellow', '노랑': 'yellow', '노란': 'yellow',
        '하늘': 'skyblue', '하늘색': 'skyblue',
        '청록': 'cyan', '시안': 'cyan',
        '자홍': 'magenta', '마젠타': 'magenta',
        '주': 'orange', '주황': 'orange', '주황색': 'orange',
        '흰': 'white', '흰색': 'white', '하양': 'white', '하얀': 'white',
        '검': 'black', '검정': 'black', '까만': 'black', '검은': 'black',
        '회': 'gray', '회색': 'gray',
        '보': 'purple', '보라': 'purple', '보라색': 'purple',
        # 확장 색
        '분': 'pink', '분홍': 'pink', '핑크': 'pink',
        '갈': 'brown', '갈색': 'brown',
        '금': 'gold', '금색': 'gold', '황금': 'gold',
        '은': 'silver', '은색': 'silver',
        '남': 'navy', '남색': 'navy',
        '연두': 'lime', '라임': 'lime',
        '올리브': 'olive',
        '산호': 'coral', '코랄': 'coral',
        '연어': 'salmon', '살몬': 'salmon',
        '보랏빛': 'violet', '바이올렛': 'violet',
        '남보라': 'indigo', '인디고': 'indigo',
        '베이지': 'beige',
        '민트': 'mint',
        '살구': 'peach', '복숭아': 'peach', '피치': 'peach',
        '라벤더': 'lavender',
        '적갈': 'maroon', '밤색': 'maroon',
        '청록색': 'teal', '틸': 'teal',
        '상아': 'ivory', '아이보리': 'ivory',
    }

    @staticmethod
    def hsv_to_rgb(c):
        """색상(h)·채도(s)·명도(v) 벡터 → RGB 벡터. 각 성분은 0~1 (GlowScript 호환)
        예: color.hsv_to_rgb(vector(0.33, 1, 1)) → 초록"""
        c = _coerce_vector(c, vector(0, 0, 0))
        r, g, b = colorsys.hsv_to_rgb(c.x, c.y, c.z)
        return vector(r, g, b)

    @staticmethod
    def rgb_to_hsv(c):
        """RGB 벡터 → 색상(h)·채도(s)·명도(v) 벡터 (GlowScript 호환)"""
        c = _coerce_vector(c, vector(0, 0, 0))
        h, sat, v = colorsys.rgb_to_hsv(c.x, c.y, c.z)
        return vector(h, sat, v)

    def __getitem__(self, key):
        """color['빨'], color['red'] 모두 지원"""
        # 한글 이름 → 영어로 변환
        if key in self._name_map:
            return getattr(self, self._name_map[key])
        # 영어 이름 직접 접근
        if hasattr(self, key) and not key.startswith('_'):
            return getattr(self, key)
        # 못 찾으면 에러 + 사용 가능한 이름 안내
        kr_names = [k for k in self._name_map.keys() if len(k) <= 3]
        raise KeyError(f"'{key}' 색상을 찾을 수 없습니다. 사용 가능: {', '.join(kr_names[:15])}...")

    def __repr__(self):
        return "<색상 팔레트 30색 — color.red 또는 color['빨'] 사용>"


color = _ColorPalette()
색상 = color  # 한글 별칭


# === 텍스처 프리셋 ===
class _TexturePresets:
    """VPython textures.* 프리셋 — 프로시저럴 패턴 또는 외부 URL/data URI 사용 가능

    예:
        box(texture=textures.wood)
        sphere(texture="https://example.com/img.jpg")
        ground = box(texture=textures.checker, size=vector(20, 0.1, 20))
    """
    wood = "preset:wood"
    metal = "preset:metal"
    stones = "preset:stones"
    granite = "preset:granite"
    gravel = "preset:gravel"
    rough = "preset:rough"
    rug = "preset:rug"
    stucco = "preset:stucco"
    flower = "preset:flower"
    earth = "preset:earth"
    brick = "preset:brick"
    checker = "preset:checker"
    grid = "preset:grid"
    galaxy = "preset:galaxy"
    nebula = "preset:nebula"
    water = "preset:water"
    lava = "preset:lava"
    ice = "preset:ice"
    circuit = "preset:circuit"
    fire = "preset:fire"
    # GlowScript 문서에 있는 이름 — 가장 가까운 프리셋으로 그린다
    rock = "preset:granite"
    wood_old = "preset:wood"

    def __repr__(self):
        names = [k for k in dir(self) if not k.startswith('_') and isinstance(getattr(self, k), str)]
        return f"<텍스처 프리셋 {len(names)}종 — textures.wood, textures.metal 등>"


textures = _TexturePresets()
텍스처 = textures  # 한글 별칭


class _BumpmapPresets:
    """GlowScript의 bumpmaps.* 이름. 현재 렌더러는 범프맵을 그리지 않으므로 받기만 하고 무시한다."""
    wood = "bump:wood"
    wood_old = "bump:wood_old"
    stucco = "bump:stucco"
    stones = "bump:stones"
    rock = "bump:rock"
    gravel = "bump:gravel"

    def __repr__(self):
        return "<범프맵 프리셋 — 현재는 받기만 하고 그리지 않음>"


bumpmaps = _BumpmapPresets()

# scene.objects 조회용: 만들어진 3D 객체 목록
_scene_objects = []


# === 벡터 소유 추적 ===
class _VectorOwner:
    """_pos, _axis 같은 내부 속성에 벡터를 저장할 때 벡터에 소유자를 기록한다.
    같은 벡터를 다른 객체에도 넣으면 복제해 서로 영향을 주지 않게 한다 (GlowScript와 같은 동작)."""
    _vector_attrs = ()

    def __setattr__(self, name, value):
        if isinstance(value, vector) and name.startswith('_') and name[1:] in self._vector_attrs:
            # 사용자 변수나 다른 객체의 벡터를 그대로 보관하면 별칭이 되므로 복제한다 (VPython은 성분을 복사한다)
            if value._owner is not self:
                value = value.clone()
            value._owner = self
            value._attr = name[1:]
        object.__setattr__(self, name, value)


# === 3D 객체 베이스 클래스 ===
class _GObject(_VectorOwner):
    _vector_attrs = ('pos', 'axis', 'size', 'up', 'color', 'velocity', 'trail_color')

    def __init__(self, obj_type, **kwargs):
        self._id = _new_id()
        self._type = obj_type
        self._group = _group_ref(kwargs.pop('group', None))
        self._make_trail = kwargs.pop('make_trail', False)
        self._trail_color = kwargs.pop('trail_color', None)
        pos_arg = kwargs.get('pos', None)
        if pos_arg is None:
            pos_arg = vector(0, 0, 0)
        elif not isinstance(pos_arg, vector):
            raise TypeError(f"pos에는 vector를 넣어야 합니다. 예: pos=vector(1, 2, 3)  (받은 값: {pos_arg!r})")
        self._pos = pos_arg
        self._color = kwargs.get('color', color.white)
        self._visible = kwargs.get('visible', True)
        self._opacity = kwargs.get('opacity', 1.0)
        self._emissive = kwargs.get('emissive', False)
        _scene_objects.append(self)
        self._velocity = kwargs.get('velocity', vector(0, 0, 0))
        self._texture = kwargs.get('texture', None)

        # 객체 생성 커맨드
        extra = {}
        for k, v in kwargs.items():
            if k in ('pos', 'color', 'visible', 'opacity', 'velocity'):
                continue
            serialized = _serialize_command_value(v)
            if serialized is not None:
                extra[k] = serialized
        if self._group is not None:
            # group(묶음)에 속한 객체 — pos는 묶음 기준의 상대 위치
            self._group._objects.append(self)
            extra['group'] = self._group._id

        _add_command({
            "action": "create",
            "id": self._id,
            "type": obj_type,
            "pos": self._pos.to_list(),
            "color": self._color.to_list(),
            "visible": self._visible,
            "opacity": self._opacity,
            "make_trail": self._make_trail,
            "trail_color": self._trail_color.to_list() if self._trail_color else None,
            **extra,
        })

    @property
    def pos(self):
        return self._pos

    @pos.setter
    def pos(self, value):
        self._pos = value
        _add_command({
            "action": "update",
            "id": self._id,
            "pos": value.to_list(),
        })
        if self._make_trail:
            _add_command({
                "action": "trail_update",
                "id": self._id,
                "pos": value.to_list(),
            })

    @property
    def color(self):
        return self._color

    @color.setter
    def color(self, value):
        self._color = value
        _add_command({
            "action": "update",
            "id": self._id,
            "color": value.to_list(),
        })

    @property
    def visible(self):
        return self._visible

    @visible.setter
    def visible(self, value):
        self._visible = value
        _add_command({
            "action": "update",
            "id": self._id,
            "visible": value,
        })

    @property
    def velocity(self):
        return self._velocity

    @velocity.setter
    def velocity(self, value):
        self._velocity = value

    @property
    def opacity(self):
        return self._opacity

    @opacity.setter
    def opacity(self, value):
        self._opacity = value
        _add_command({
            "action": "update",
            "id": self._id,
            "opacity": value,
        })

    @property
    def emissive(self):
        return self._emissive

    @emissive.setter
    def emissive(self, value):
        self._emissive = value
        _add_command({
            "action": "update",
            "id": self._id,
            "emissive": value,
        })

    @property
    def texture(self):
        return self._texture

    @texture.setter
    def texture(self, value):
        self._texture = value
        _add_command({
            "action": "update",
            "id": self._id,
            "texture": value,
        })

    # === 공통 메서드 ===
    def _clone_kwargs(self):
        """clone() 시 사용할 현재 속성 dict — 서브클래스에서 확장"""
        return {
            'pos': self._pos.clone() if isinstance(self._pos, vector) else self._pos,
            'color': self._color.clone() if isinstance(self._color, vector) else self._color,
            'visible': self._visible,
            'opacity': self._opacity,
            'emissive': self._emissive,
            'texture': self._texture,
        }

    def clone(self, **kwargs):
        """객체 복제 — 동일 속성으로 새 객체 생성. kwargs로 속성을 덮어쓸 수 있음.
        예: ball2 = ball.clone(pos=vector(2,0,0))"""
        args = self._clone_kwargs()
        args.update(kwargs)
        return self.__class__(**args)

    def rotate(self, angle, axis=None, origin=None):
        """원점을 중심으로 axis 축으로 angle(라디안)만큼 객체를 회전.
        - origin 미지정: 객체 자기 위치(self.pos)를 중심으로 회전
        - axis 미지정: y축(0,1,0)
        객체에 axis 속성이 있으면(cylinder, arrow, cone 등) 함께 회전"""
        _rotate_object(self, angle, axis, origin)

    def clear_trail(self):
        """누적된 궤적(trail)을 모두 지움"""
        _add_command({"action": "trail_clear", "id": self._id})

    def attach_trail(self, color=None, retain=10000, type='curve', pps=0, radius=0, interval=1):
        """객체에 궤적을 부착 (이미 있으면 색상/길이만 갱신). stop()/start()/clear()가 있는 손잡이를 돌려준다.
        type='points'면 점 궤적, interval=n이면 n번 움직일 때마다 한 점, pps=k면 초당 k점까지만 남긴다."""
        self._make_trail = True
        if color is not None:
            self._trail_color = color
        _add_command({
            "action": "trail_attach",
            "id": self._id,
            "trail_color": color.to_list() if isinstance(color, vector) else None,
            "pos": self._pos.to_list(),
            "retain": int(retain) if retain and retain > 0 else 10000,
            "trail_type": str(type),
            "pps": float(pps or 0),
            "interval": int(interval or 1),
            "trail_radius": float(radius or 0),
        })
        return _TrailHandle(self)


class _TrailHandle:
    """attach_trail()이 돌려주는 손잡이 — stop()으로 멈추고 start()로 다시 잇고 clear()로 지운다."""
    def __init__(self, obj):
        self.obj = obj

    def stop(self):
        self.obj._make_trail = False

    def start(self):
        self.obj._make_trail = True

    def clear(self):
        self.obj.clear_trail()


class _AxisLength:
    """axis가 있는 객체(cylinder, cone, arrow, helix)의 length — axis의 길이와 연동된다 (GlowScript 호환)"""

    @property
    def length(self):
        return self._axis.mag

    @length.setter
    def length(self, value):
        direction = self._axis.hat if self._axis.mag > 0 else vector(1, 0, 0)
        self.axis = direction * float(value)


class _RadiusSize:
    """반지름이 있는 축 객체(cylinder, cone)의 size — vector(length, 2*radius, 2*radius) (GlowScript 호환)"""

    @property
    def size(self):
        return vector(self._axis.mag, 2 * self._radius, 2 * self._radius)

    @size.setter
    def size(self, value):
        value = _coerce_vector(value, vector(1, 2, 2))
        self.length = value.x
        self.radius = value.y / 2


# === 구체적 3D 객체 ===
class sphere(_GObject):
    def __init__(self, **kwargs):
        self._radius = kwargs.pop('radius', 1.0)
        super().__init__('sphere', radius=self._radius, **kwargs)

    @property
    def radius(self):
        return self._radius

    @radius.setter
    def radius(self, value):
        self._radius = value
        _add_command({"action": "update", "id": self._id, "radius": value})

    @property
    def size(self):
        """지름 벡터 vector(2r, 2r, 2r) (GlowScript 호환). 대입하면 x 성분의 절반이 반지름이 된다."""
        d = 2 * self._radius
        return vector(d, d, d)

    @size.setter
    def size(self, value):
        value = _coerce_vector(value, vector(2, 2, 2))
        self.radius = value.x / 2

    def _clone_kwargs(self):
        return {**super()._clone_kwargs(), 'radius': self._radius}


simple_sphere = sphere   # GlowScript의 삼각형 수가 적은 구 — 같은 구로 그린다


class box(_GObject):
    def __init__(self, **kwargs):
        size_arg = kwargs.pop('size', None)
        length_arg = kwargs.pop('length', None)
        height_arg = kwargs.pop('height', None)
        width_arg = kwargs.pop('width', None)
        axis_arg = _coerce_vector(kwargs.pop('axis', vector(1, 0, 0)), vector(1, 0, 0))
        up_arg = _coerce_vector(kwargs.pop('up', vector(0, 1, 0)), vector(0, 1, 0))

        if size_arg is None:
            length = length_arg if length_arg is not None else (axis_arg.mag if axis_arg.mag > 0 else 1)
            height = height_arg if height_arg is not None else 1
            width = width_arg if width_arg is not None else 1
            self._size = vector(length, height, width)
        else:
            self._size = _coerce_vector(size_arg, vector(1, 1, 1))
            if length_arg is not None:
                self._size.x = float(length_arg)
            if height_arg is not None:
                self._size.y = float(height_arg)
            if width_arg is not None:
                self._size.z = float(width_arg)

        axis_dir = axis_arg.hat if axis_arg.mag > 0 else vector(1, 0, 0)
        self._axis = axis_dir * self._size.x
        self._up = up_arg if up_arg.mag > 0 else vector(0, 1, 0)
        super().__init__(
            'box',
            size=self._size,
            axis=self._axis,
            up=self._up,
            **kwargs,
        )

    @property
    def size(self):
        return self._size

    @size.setter
    def size(self, value):
        self._size = _coerce_vector(value, vector(1, 1, 1))
        axis_dir = self._axis.hat if self._axis.mag > 0 else vector(1, 0, 0)
        self._axis = axis_dir * self._size.x
        _add_command({
            "action": "update",
            "id": self._id,
            "size": self._size.to_list(),
            "axis": self._axis.to_list(),
        })

    @property
    def length(self):
        return self._size.x

    @length.setter
    def length(self, value):
        self._size.x = float(value)
        axis_dir = self._axis.hat if self._axis.mag > 0 else vector(1, 0, 0)
        self._axis = axis_dir * self._size.x
        _add_command({
            "action": "update",
            "id": self._id,
            "size": self._size.to_list(),
            "axis": self._axis.to_list(),
            "length": self._size.x,
        })

    @property
    def height(self):
        return self._size.y

    @height.setter
    def height(self, value):
        self._size.y = float(value)
        _add_command({
            "action": "update",
            "id": self._id,
            "size": self._size.to_list(),
            "height": self._size.y,
        })

    @property
    def width(self):
        return self._size.z

    @width.setter
    def width(self, value):
        self._size.z = float(value)
        _add_command({
            "action": "update",
            "id": self._id,
            "size": self._size.to_list(),
            "width": self._size.z,
        })

    @property
    def axis(self):
        return self._axis

    @axis.setter
    def axis(self, value):
        self._axis = _coerce_vector(value, vector(1, 0, 0))
        if self._axis.mag > 0:
            self._size.x = self._axis.mag
        _add_command({
            "action": "update",
            "id": self._id,
            "axis": self._axis.to_list(),
            "size": self._size.to_list(),
        })

    @property
    def up(self):
        return self._up

    @up.setter
    def up(self, value):
        self._up = _coerce_vector(value, vector(0, 1, 0))
        _add_command({"action": "update", "id": self._id, "up": self._up.to_list()})

    def _clone_kwargs(self):
        return {
            **super()._clone_kwargs(),
            'size': self._size.clone(),
            'axis': self._axis.clone(),
            'up': self._up.clone(),
        }


class cylinder(_AxisLength, _RadiusSize, _GObject):
    def __init__(self, **kwargs):
        self._radius = kwargs.pop('radius', 1.0)
        self._axis = kwargs.pop('axis', vector(1, 0, 0))
        length_arg = kwargs.pop('length', None)
        if length_arg is not None:
            direction = self._axis.hat if self._axis.mag > 0 else vector(1, 0, 0)
            self._axis = direction * float(length_arg)
        super().__init__('cylinder', radius=self._radius, axis=self._axis.to_list(), **kwargs)

    @property
    def radius(self):
        return self._radius

    @radius.setter
    def radius(self, value):
        self._radius = value
        _add_command({"action": "update", "id": self._id, "radius": value})

    @property
    def axis(self):
        return self._axis

    @axis.setter
    def axis(self, value):
        self._axis = value
        _add_command({"action": "update", "id": self._id, "axis": value.to_list()})

    def _clone_kwargs(self):
        return {**super()._clone_kwargs(), 'radius': self._radius, 'axis': self._axis.clone()}


class arrow(_AxisLength, _GObject):
    def __init__(self, **kwargs):
        self._axis = kwargs.pop('axis', vector(1, 0, 0))
        length_arg = kwargs.pop('length', None)
        if length_arg is not None:
            direction = self._axis.hat if self._axis.mag > 0 else vector(1, 0, 0)
            self._axis = direction * float(length_arg)
        self._shaftwidth = kwargs.pop('shaftwidth', 0.1)
        super().__init__('arrow', axis=self._axis.to_list(), shaftwidth=self._shaftwidth, **kwargs)

    @property
    def axis(self):
        return self._axis

    @axis.setter
    def axis(self, value):
        self._axis = value
        _add_command({"action": "update", "id": self._id, "axis": value.to_list()})

    @property
    def shaftwidth(self):
        return self._shaftwidth

    @shaftwidth.setter
    def shaftwidth(self, value):
        self._shaftwidth = value
        _add_command({"action": "update", "id": self._id, "shaftwidth": value})

    def _clone_kwargs(self):
        return {**super()._clone_kwargs(), 'axis': self._axis.clone(), 'shaftwidth': self._shaftwidth}


class cone(_AxisLength, _RadiusSize, _GObject):
    def __init__(self, **kwargs):
        self._radius = kwargs.pop('radius', 1.0)
        self._axis = kwargs.pop('axis', vector(1, 0, 0))
        length_arg = kwargs.pop('length', None)
        if length_arg is not None:
            direction = self._axis.hat if self._axis.mag > 0 else vector(1, 0, 0)
            self._axis = direction * float(length_arg)
        super().__init__('cone', radius=self._radius, axis=self._axis.to_list(), **kwargs)

    @property
    def radius(self):
        return self._radius

    @radius.setter
    def radius(self, value):
        self._radius = value
        _add_command({"action": "update", "id": self._id, "radius": value})

    @property
    def axis(self):
        return self._axis

    @axis.setter
    def axis(self, value):
        self._axis = value
        _add_command({"action": "update", "id": self._id, "axis": value.to_list()})

    def _clone_kwargs(self):
        return {**super()._clone_kwargs(), 'radius': self._radius, 'axis': self._axis.clone()}


class ring(_GObject):
    def __init__(self, **kwargs):
        self._radius = kwargs.pop('radius', 1.0)
        self._thickness = kwargs.pop('thickness', 0.1)
        super().__init__('ring', radius=self._radius, thickness=self._thickness, **kwargs)

    @property
    def radius(self):
        return self._radius

    @radius.setter
    def radius(self, value):
        self._radius = value
        _add_command({"action": "update", "id": self._id, "radius": value})

    @property
    def thickness(self):
        return self._thickness

    @thickness.setter
    def thickness(self, value):
        self._thickness = value
        _add_command({"action": "update", "id": self._id, "thickness": value})

    def _clone_kwargs(self):
        return {**super()._clone_kwargs(), 'radius': self._radius, 'thickness': self._thickness}


# === 새 프리미티브: pyramid (4면 피라미드) ===
class pyramid(_GObject):
    """사각뿔 — VPython의 pyramid. size=vector(length, height, width)"""
    def __init__(self, **kwargs):
        self._size = kwargs.pop('size', vector(1, 1, 1))
        self._axis = kwargs.pop('axis', vector(1, 0, 0))
        s = self._size.to_list() if isinstance(self._size, vector) else list(self._size)
        super().__init__('pyramid', size=s, axis=self._axis.to_list(), **kwargs)

    @property
    def size(self):
        return self._size

    @size.setter
    def size(self, value):
        self._size = value
        s = value.to_list() if isinstance(value, vector) else list(value)
        _add_command({"action": "update", "id": self._id, "size": s})

    @property
    def axis(self):
        return self._axis

    @axis.setter
    def axis(self, value):
        self._axis = value
        _add_command({"action": "update", "id": self._id, "axis": value.to_list()})

    def _clone_kwargs(self):
        return {**super()._clone_kwargs(), 'size': self._size.clone(), 'axis': self._axis.clone()}


# === 새 프리미티브: ellipsoid (타원체) ===
class ellipsoid(_GObject):
    """타원체 — sphere를 size로 비균등 스케일링. size=vector(length, height, width)"""
    def __init__(self, **kwargs):
        size = _coerce_vector(kwargs.pop('size', None), vector(1, 1, 1))
        # GlowScript처럼 length·height·width로도 지정할 수 있다
        length_arg = kwargs.pop('length', None)
        height_arg = kwargs.pop('height', None)
        width_arg = kwargs.pop('width', None)
        if length_arg is not None:
            size.x = float(length_arg)
        if height_arg is not None:
            size.y = float(height_arg)
        if width_arg is not None:
            size.z = float(width_arg)
        self._size = size
        super().__init__('ellipsoid', size=self._size.to_list(), **kwargs)

    @property
    def size(self):
        return self._size

    @size.setter
    def size(self, value):
        self._size = _coerce_vector(value, vector(1, 1, 1))
        _add_command({"action": "update", "id": self._id, "size": self._size.to_list()})

    @property
    def length(self):
        return self._size.x

    @length.setter
    def length(self, value):
        self.size = vector(float(value), self._size.y, self._size.z)

    @property
    def height(self):
        return self._size.y

    @height.setter
    def height(self, value):
        self.size = vector(self._size.x, float(value), self._size.z)

    @property
    def width(self):
        return self._size.z

    @width.setter
    def width(self, value):
        self.size = vector(self._size.x, self._size.y, float(value))

    def _clone_kwargs(self):
        return {**super()._clone_kwargs(), 'size': self._size.clone()}


# === 새 프리미티브: helix (나선/스프링) ===
class helix(_GObject):
    """나선 — pos에서 axis 방향으로 길이만큼, coils번 감김"""
    def __init__(self, **kwargs):
        self._radius = kwargs.pop('radius', 1.0)
        self._axis = kwargs.pop('axis', vector(1, 0, 0))
        self._length = kwargs.pop('length', None)
        self._coils = kwargs.pop('coils', 5)
        self._thickness = kwargs.pop('thickness', 0.05)
        # length 미지정 시 axis 길이 사용
        ax = self._axis
        length = self._length if self._length is not None else ax.mag
        super().__init__(
            'helix',
            radius=self._radius,
            axis=ax.to_list(),
            length=float(length),
            coils=int(self._coils),
            thickness=float(self._thickness),
            **kwargs,
        )

    @property
    def radius(self):
        return self._radius

    @radius.setter
    def radius(self, value):
        self._radius = value
        _add_command({"action": "update", "id": self._id, "radius": value})

    @property
    def axis(self):
        return self._axis

    @axis.setter
    def axis(self, value):
        self._axis = value
        self._length = self._axis.mag
        _add_command({"action": "update", "id": self._id, "axis": value.to_list(), "length": float(self._length)})

    @property
    def length(self):
        """나선의 길이 — axis의 길이와 같다 (GlowScript 호환)"""
        return self._length if self._length is not None else self._axis.mag

    @length.setter
    def length(self, value):
        direction = self._axis.hat if self._axis.mag > 0 else vector(1, 0, 0)
        self.axis = direction * float(value)

    def _clone_kwargs(self):
        return {
            **super()._clone_kwargs(),
            'radius': self._radius,
            'axis': self._axis.clone(),
            'length': self._length,
            'coils': self._coils,
            'thickness': self._thickness,
        }


# === 새 프리미티브: label (3D 텍스트 라벨) ===
class label:
    """3D 위치에 텍스트 라벨을 표시 — 항상 카메라를 향함(Sprite)"""
    def __init__(self, **kwargs):
        self._id = _new_id()
        _scene_objects.append(self)
        self._pos = kwargs.get('pos', vector(0, 0, 0))
        self._text = kwargs.get('text', '')
        self._color = kwargs.get('color', color.white)
        self._height = kwargs.get('height', 16)  # 폰트 높이(픽셀)
        self._visible = kwargs.get('visible', True)
        self._opacity = kwargs.get('opacity', 1.0)
        self._background = kwargs.get('background', None)
        self._border = kwargs.get('border', 0)

        _add_command({
            "action": "create",
            "id": self._id,
            "type": "label",
            "pos": self._pos.to_list(),
            "color": self._color.to_list(),
            "text": str(self._text),
            "height": float(self._height),
            "visible": self._visible,
            "opacity": float(self._opacity),
            "background": self._background.to_list() if isinstance(self._background, vector) else None,
            "border": float(self._border),
        })

    @property
    def pos(self):
        return self._pos

    @pos.setter
    def pos(self, value):
        self._pos = value
        _add_command({"action": "update", "id": self._id, "pos": value.to_list()})

    @property
    def text(self):
        return self._text

    @text.setter
    def text(self, value):
        self._text = str(value)
        _add_command({"action": "update", "id": self._id, "text": self._text})

    @property
    def color(self):
        return self._color

    @color.setter
    def color(self, value):
        self._color = value
        _add_command({"action": "update", "id": self._id, "color": value.to_list()})

    @property
    def visible(self):
        return self._visible

    @visible.setter
    def visible(self, value):
        self._visible = value
        _add_command({"action": "update", "id": self._id, "visible": value})

    @property
    def opacity(self):
        return self._opacity

    @opacity.setter
    def opacity(self, value):
        self._opacity = float(value)
        _add_command({"action": "update", "id": self._id, "opacity": self._opacity})

    def clone(self, **kwargs):
        args = {
            'pos': self._pos.clone(),
            'text': self._text,
            'color': self._color.clone() if isinstance(self._color, vector) else self._color,
            'height': self._height,
            'visible': self._visible,
            'opacity': self._opacity,
            'background': self._background.clone() if isinstance(self._background, vector) else self._background,
            'border': self._border,
        }
        args.update(kwargs)
        return label(**args)


# === 새 프리미티브: text (3D 입체 글자) ===
_LATIN_GLYPH_LIMIT = 0x0250   # 번들 글꼴(helvetiker)이 가진 글자 범위. 그 밖(한글 등)은 2D 라벨로 대체한다


def _text_is_latin(s):
    return all(ord(ch) < _LATIN_GLYPH_LIMIT for ch in s)


class text(_GObject):
    """3D 입체 글자 — text(text='Hello', pos=vector(0,0,0), height=1, depth=0.2, align='left', color=color.white)
    pos는 기준선 위치(align='left'면 왼쪽 끝, 'center'면 가운데, 'right'면 오른쪽 끝).
    axis 방향으로 글이 흐르고 up이 글자의 위쪽이다. billboard=True면 항상 카메라를 향한다.
    번들 글꼴은 라틴 문자만 담고 있어 한글 등은 카메라를 향하는 2D 라벨로 대체된다. 2D 화면 라벨은 label()을 사용한다."""
    _vector_attrs = _GObject._vector_attrs + ('start_face_color', 'end_face_color')

    def __init__(self, **kwargs):
        self._text = str(kwargs.pop('text', ''))
        self._height = float(kwargs.pop('height', 1.0))
        depth = kwargs.pop('depth', None)
        self._depth = float(depth) if depth is not None else 0.2 * self._height
        self._align = str(kwargs.pop('align', 'left'))
        self._font = str(kwargs.pop('font', 'sans'))
        self._billboard = bool(kwargs.pop('billboard', False))
        self._axis = _coerce_vector(kwargs.pop('axis', None), vector(1, 0, 0))
        self._up = _coerce_vector(kwargs.pop('up', None), vector(0, 1, 0))
        self._start_face_color = _coerce_vector(kwargs.pop('start_face_color', None), None)
        self._end_face_color = _coerce_vector(kwargs.pop('end_face_color', None), None)
        length = kwargs.pop('length', None)
        self._length_override = float(length) if length is not None else None
        self._latin = _text_is_latin(self._text)
        if not self._latin:
            _notice_once('text-latin', "[text] 번들 글꼴에 없는 글자(한글 등)가 있어 입체 글자 대신 카메라를 향하는 2D 라벨로 표시합니다.")
        super().__init__(
            'text',
            text=self._text, height=self._height, depth=self._depth, align=self._align, font=self._font,
            billboard=self._billboard, axis=self._axis, up=self._up, latin=self._latin,
            start_face_color=self._start_face_color, end_face_color=self._end_face_color,
            length=self._length_override,
            **kwargs,
        )

    def _update(self, **fields):
        _add_command({"action": "update", "id": self._id, **fields})

    @property
    def text(self):
        return self._text

    @text.setter
    def text(self, value):
        self._text = str(value)
        latin = _text_is_latin(self._text)
        if not latin:
            _notice_once('text-latin', "[text] 번들 글꼴에 없는 글자(한글 등)가 있어 입체 글자 대신 카메라를 향하는 2D 라벨로 표시합니다.")
        self._latin = latin
        self._update(text=self._text, latin=latin)

    @property
    def height(self):
        return self._height

    @height.setter
    def height(self, value):
        self._height = float(value)
        self._update(height=self._height)

    @property
    def depth(self):
        return self._depth

    @depth.setter
    def depth(self, value):
        self._depth = float(value)
        self._update(depth=self._depth)

    @property
    def align(self):
        return self._align

    @align.setter
    def align(self, value):
        self._align = str(value)
        self._update(align=self._align)

    @property
    def billboard(self):
        return self._billboard

    @billboard.setter
    def billboard(self, value):
        self._billboard = bool(value)
        self._update(billboard=self._billboard)

    @property
    def font(self):
        return self._font

    @property
    def axis(self):
        return self._axis

    @axis.setter
    def axis(self, value):
        self._axis = _coerce_vector(value, vector(1, 0, 0))
        self._update(axis=self._axis.to_list(), up=self._up.to_list())

    @property
    def up(self):
        return self._up

    @up.setter
    def up(self, value):
        self._up = _coerce_vector(value, vector(0, 1, 0))
        self._update(axis=self._axis.to_list(), up=self._up.to_list())

    def _estimate_length(self):
        """글자 폭의 어림값 — 글꼴 측정은 브릿지가 하므로 평균 글자 폭(높이의 0.6배)으로 센다."""
        longest = max((len(line) for line in self._text.split('\n')), default=0)
        return 0.6 * self._height * longest

    @property
    def length(self):
        """글의 가로 길이. 대입하면 글이 그 길이로 늘거나 준다."""
        if self._length_override is not None:
            return self._length_override
        return self._estimate_length()

    @length.setter
    def length(self, value):
        self._length_override = float(value)
        self._update(length=self._length_override)

    @property
    def start(self):
        """글의 왼쪽 끝 위치 (기준선 위)"""
        direction = self._axis.hat if self._axis.mag > 0 else vector(1, 0, 0)
        length = self.length
        if self._align == 'center':
            return self._pos - direction * (length / 2)
        if self._align == 'right':
            return self._pos - direction * length
        return self._pos.clone()

    @property
    def end(self):
        """글의 오른쪽 끝 위치 (기준선 위)"""
        direction = self._axis.hat if self._axis.mag > 0 else vector(1, 0, 0)
        return self.start + direction * self.length

    @property
    def descender(self):
        """기준선 아래로 내려가는 글자(g, p 등)의 깊이 어림값"""
        return 0.2 * self._height

    @property
    def vertical_spacing(self):
        """여러 줄일 때 줄 사이 간격"""
        return 1.4 * self._height

    def _clone_kwargs(self):
        return {
            **super()._clone_kwargs(),
            'text': self._text,
            'height': self._height,
            'depth': self._depth,
            'align': self._align,
            'font': self._font,
            'billboard': self._billboard,
            'axis': self._axis.clone(),
            'up': self._up.clone(),
            'start_face_color': self._start_face_color.clone() if isinstance(self._start_face_color, vector) else None,
            'end_face_color': self._end_face_color.clone() if isinstance(self._end_face_color, vector) else None,
            'length': self._length_override,
        }




# === 새 프리미티브: curve / points (점마다 위치·색·반지름을 가진 점 목록) ===
def _as_point(value):
    """vector 또는 (x, y, z)를 새 vector로"""
    if isinstance(value, vector):
        return value.clone()
    if isinstance(value, (list, tuple)) and len(value) == 3 and all(isinstance(c, (int, float)) for c in value):
        return vector(*value)
    raise TypeError(f"점은 vector 또는 (x, y, z) 형식이어야 합니다: {value!r}")


def _point_items(args):
    """curve/points의 생성자·append 인자를 점 항목 목록으로 편다.
    벡터 하나, (x, y, z), {'pos': v, 'color': c, 'radius': r}, 그리고 이들의 리스트와 여러 위치 인자를 모두 받는다."""
    items = []
    for a in args:
        if a is None:
            continue
        if isinstance(a, (vector, dict)):
            items.append(a)
        elif isinstance(a, (list, tuple)):
            if len(a) == 3 and all(isinstance(c, (int, float)) for c in a):
                items.append(vector(*a))
            else:
                items.extend(_point_items(a))
        else:
            raise TypeError(f"점은 vector, (x, y, z) 또는 {{'pos': ...}} 형식이어야 합니다: {a!r}")
    return items


class _PointList(_VectorOwner):
    """curve와 points의 공통 구현. 점마다 pos·color·radius를 저장하고 브릿지에 목록으로 보낸다."""
    _vector_attrs = ('color', 'origin', 'axis', 'up')
    _type = 'curve'

    def __init__(self, *args, **kwargs):
        self._id = _new_id()
        self._group = _group_ref(kwargs.pop('group', None))
        self._color = _coerce_vector(kwargs.get('color'), color.white)
        self._radius = float(kwargs.get('radius', 0))
        self._visible = bool(kwargs.get('visible', True))
        self._opacity = float(kwargs.get('opacity', 1.0))
        self._emissive = bool(kwargs.get('emissive', False))
        self._retain = int(kwargs.get('retain', -1))
        self._origin = _coerce_vector(kwargs.get('origin'), vector(0, 0, 0))
        self._axis = _coerce_vector(kwargs.get('axis'), vector(1, 0, 0))
        self._up = _coerce_vector(kwargs.get('up'), vector(0, 1, 0))
        self._pos_list = []
        self._color_list = []
        self._radius_list = []
        for item in _point_items(list(args) + [kwargs.get('pos')]):
            self._store(item)

        cmd = {
            "action": "create",
            "id": self._id,
            "type": self._type,
            "color": self._color.to_list(),
            "radius": self._radius,
            "visible": self._visible,
            "opacity": self._opacity,
            "emissive": self._emissive,
            "origin": self._origin.to_list(),
            "axis": self._axis.to_list(),
            "up": self._up.to_list(),
            "points": [p.to_list() for p in self._pos_list],
            "colors": [c.to_list() for c in self._color_list],
            "radii": list(self._radius_list),
        }
        cmd.update(self._extra_create(kwargs))
        if self._group is not None:
            self._group._objects.append(self)
            cmd['group'] = self._group._id
        _add_command(cmd)
        _track_scene_object(self)

    def _extra_create(self, kwargs):
        return {}

    def _store(self, item, index=None):
        """점 항목 하나를 (pos, color, radius)로 나눠 저장한다."""
        if isinstance(item, dict):
            if 'pos' not in item:
                raise ValueError("점 dict에는 'pos'가 있어야 합니다. 예: {'pos': vector(0,0,0), 'color': color.red}")
            pos = _as_point(item['pos'])
            col = _coerce_vector(item.get('color'), self._color)
            rad = float(item.get('radius', self._radius))
        else:
            pos = _as_point(item)
            col = self._color.clone()
            rad = self._radius
        if index is None:
            self._pos_list.append(pos)
            self._color_list.append(col)
            self._radius_list.append(rad)
        else:
            self._pos_list[index] = pos
            self._color_list[index] = col
            self._radius_list[index] = rad

    def _send_all(self):
        """점 목록 전체를 다시 보낸다 (modify·pop·shift 등 뒤)."""
        _add_command({
            "action": "curve_set",
            "id": self._id,
            "points": [p.to_list() for p in self._pos_list],
            "colors": [c.to_list() for c in self._color_list],
            "radii": list(self._radius_list),
        })

    def _trim_retain(self):
        if self._retain > 0 and len(self._pos_list) > self._retain:
            cut = len(self._pos_list) - self._retain
            del self._pos_list[:cut]
            del self._color_list[:cut]
            del self._radius_list[:cut]
            return True
        return False

    # --- 점 추가·수정 ---
    def append(self, *args, **kwargs):
        """점 추가 — append(v), append(v1, v2), append([v1, v2]), append(pos=v, color=c, radius=r), append({'pos': v})"""
        if 'retain' in kwargs:
            self._retain = int(kwargs.pop('retain'))
        items = _point_items(args)
        if 'pos' in kwargs:
            pos_arg = kwargs['pos']
            if isinstance(pos_arg, (list, tuple)) and not (
                len(pos_arg) == 3 and all(isinstance(c, (int, float)) for c in pos_arg)
            ):
                # append(pos=[v1, v2, ...]) — 점 목록
                pos_items = _point_items([pos_arg])
            else:
                pos_items = [pos_arg]
            for p in pos_items:
                spec = dict(p) if isinstance(p, dict) else {'pos': p}
                for key in ('color', 'radius'):
                    if key in kwargs:
                        spec[key] = kwargs[key]
                items.append(spec)
        elif kwargs:
            # append(v, color=c) — 위치 인자 점에 색·반지름을 적용
            styled = []
            for it in items:
                spec = dict(it) if isinstance(it, dict) else {'pos': it}
                for key in ('color', 'radius'):
                    if key in kwargs:
                        spec[key] = kwargs[key]
                styled.append(spec)
            items = styled
        if not items:
            return
        start = len(self._pos_list)
        for it in items:
            self._store(it)
        if self._trim_retain():
            self._send_all()
            return
        _add_command({
            "action": "curve_append",
            "id": self._id,
            "points": [p.to_list() for p in self._pos_list[start:]],
            "colors": [c.to_list() for c in self._color_list[start:]],
            "radii": list(self._radius_list[start:]),
        })

    def push(self, *args, **kwargs):
        """append와 같다 (GlowScript 별칭)"""
        self.append(*args, **kwargs)

    def unshift(self, *args):
        """맨 앞에 점을 끼워 넣는다."""
        items = _point_items(args)
        saved = (self._pos_list, self._color_list, self._radius_list)
        self._pos_list, self._color_list, self._radius_list = [], [], []
        for it in items:
            self._store(it)
        self._pos_list += saved[0]
        self._color_list += saved[1]
        self._radius_list += saved[2]
        self._send_all()

    def modify(self, index, *args, **kwargs):
        """index번째 점을 바꾼다 — modify(i, pos=v), modify(i, color=c), modify(i, x=1.5), modify(i, vector)"""
        n = len(self._pos_list)
        if not -n <= index < n:
            raise IndexError(f"점 번호 {index}이(가) 범위를 벗어났습니다 (점 {n}개)")
        spec = {}
        if args:
            first = args[0]
            if isinstance(first, dict):
                spec.update(first)
            else:
                spec['pos'] = first
        spec.update(kwargs)
        pos = _as_point(spec['pos']) if 'pos' in spec else self._pos_list[index].clone()
        for comp in ('x', 'y', 'z'):
            if comp in spec:
                setattr(pos, comp, float(spec[comp]))
        self._pos_list[index] = pos
        if 'color' in spec:
            self._color_list[index] = _coerce_vector(spec['color'], self._color)
        if 'radius' in spec:
            self._radius_list[index] = float(spec['radius'])
        self._send_all()

    def point(self, index):
        """index번째 점의 정보 dict — {'pos', 'color', 'radius', 'visible'}"""
        return {
            'pos': self._pos_list[index].clone(),
            'color': self._color_list[index].clone(),
            'radius': self._radius_list[index],
            'visible': self._visible,
        }

    def slice(self, start, end=None):
        """start부터 end 앞까지의 점 정보 dict 목록"""
        rng = range(len(self._pos_list))[start:end]
        return [self.point(i) for i in rng]

    def pop(self, index=-1):
        """점 하나를 빼서 dict로 돌려준다 (기본: 마지막 점)."""
        info = self.point(index)
        del self._pos_list[index]
        del self._color_list[index]
        del self._radius_list[index]
        self._send_all()
        return info

    def shift(self):
        """첫 점을 빼서 dict로 돌려준다."""
        return self.pop(0)

    def splice(self, start, howmany, *items):
        """start부터 howmany개를 지우고 그 자리에 items를 넣는다."""
        pts = _point_items(items)
        tail = (self._pos_list[start + howmany:], self._color_list[start + howmany:], self._radius_list[start + howmany:])
        del self._pos_list[start:]
        del self._color_list[start:]
        del self._radius_list[start:]
        for it in pts:
            self._store(it)
        self._pos_list += tail[0]
        self._color_list += tail[1]
        self._radius_list += tail[2]
        self._send_all()

    def clear(self):
        """모든 점 지우기"""
        self._pos_list = []
        self._color_list = []
        self._radius_list = []
        _add_command({"action": "curve_clear", "id": self._id})

    def rotate(self, angle, axis=None, origin=None):
        """origin을 지나는 axis 축으로 전체를 회전한다 (점 좌표는 그대로 두고 방향만 바꾼다)."""
        axis = _coerce_vector(axis, vector(0, 1, 0)) if axis is not None else vector(0, 1, 0)
        origin = _coerce_vector(origin, vector(0, 0, 0)) if origin is not None else self._origin
        rel = self._origin - origin
        self._origin = origin + rel.rotate(angle, axis=axis)
        self._axis = self._axis.rotate(angle, axis=axis)
        self._up = self._up.rotate(angle, axis=axis)
        _add_command({
            "action": "update", "id": self._id,
            "origin": self._origin.to_list(), "axis": self._axis.to_list(), "up": self._up.to_list(),
        })

    # --- 속성 ---
    @property
    def npoints(self):
        return len(self._pos_list)

    def __len__(self):
        return len(self._pos_list)

    @property
    def origin(self):
        return self._origin

    @origin.setter
    def origin(self, value):
        self._origin = _coerce_vector(value, vector(0, 0, 0))
        _add_command({"action": "update", "id": self._id, "origin": self._origin.to_list()})

    # GlowScript에서 curve.pos는 origin과 같은 뜻이다
    pos = origin

    @property
    def axis(self):
        return self._axis

    @axis.setter
    def axis(self, value):
        self._axis = _coerce_vector(value, vector(1, 0, 0))
        _add_command({"action": "update", "id": self._id, "axis": self._axis.to_list(), "up": self._up.to_list()})

    @property
    def up(self):
        return self._up

    @up.setter
    def up(self, value):
        self._up = _coerce_vector(value, vector(0, 1, 0))
        _add_command({"action": "update", "id": self._id, "axis": self._axis.to_list(), "up": self._up.to_list()})

    @property
    def color(self):
        return self._color

    @color.setter
    def color(self, value):
        """전체 색 — 점마다 준 색도 모두 이 색으로 바뀐다 (GlowScript와 같음)"""
        self._color = _coerce_vector(value, color.white)
        self._color_list = [self._color.clone() for _ in self._color_list]
        _add_command({"action": "update", "id": self._id, "color": self._color.to_list()})

    @property
    def radius(self):
        return self._radius

    @radius.setter
    def radius(self, value):
        self._radius = float(value)
        self._radius_list = [self._radius for _ in self._radius_list]
        _add_command({"action": "update", "id": self._id, "radius": self._radius})

    @property
    def retain(self):
        return self._retain

    @retain.setter
    def retain(self, value):
        self._retain = int(value)
        if self._trim_retain():
            self._send_all()

    @property
    def visible(self):
        return self._visible

    @visible.setter
    def visible(self, value):
        self._visible = bool(value)
        _add_command({"action": "update", "id": self._id, "visible": self._visible})

    @property
    def opacity(self):
        return self._opacity

    @opacity.setter
    def opacity(self, value):
        self._opacity = float(value)
        _add_command({"action": "update", "id": self._id, "opacity": self._opacity})

    @property
    def emissive(self):
        return self._emissive

    @emissive.setter
    def emissive(self, value):
        self._emissive = bool(value)
        _add_command({"action": "update", "id": self._id, "emissive": self._emissive})


class curve(_PointList):
    """3D 폴리라인 — 점을 누적해 선을 그린다.
    c = curve(color=color.red); c.append(pos)
    c = curve(v1, v2, v3)                      # 위치 인자로 점 여러 개
    c = curve(pos=[{'pos': v, 'color': c}])    # 점마다 색·반지름
    c.npoints, c.point(i), c.modify(i, pos=v), c.rotate(angle=, axis=)"""
    _type = 'curve'


class points(_PointList):
    """3D 점 집합 — 작은 점으로 표시.
    size: 픽셀 크기(size_units='pixels', 기본) 또는 radius로 월드 크기(size_units='world')
    shape: 'round'(기본) 또는 'square'"""
    _type = 'points'

    def __init__(self, *args, **kwargs):
        self._size = float(kwargs.get('size', 5))
        self._size_units = str(kwargs.get('size_units', 'pixels'))
        self._shape = str(kwargs.get('shape', 'round'))
        super().__init__(*args, **kwargs)

    def _extra_create(self, kwargs):
        return {"size": self._size, "size_units": self._size_units, "shape": self._shape}

    @property
    def size(self):
        return self._size

    @size.setter
    def size(self, value):
        self._size = float(value)
        _add_command({"action": "update", "id": self._id, "size": self._size})

    @property
    def size_units(self):
        return self._size_units

    @property
    def shape(self):
        return self._shape


# === compound (복합 객체) ===
def _object_extent(obj):
    """객체의 대략적인 경계 상자 (lo, hi). compound의 중심·크기 어림용이며 회전은 무시한다."""
    pos = getattr(obj, 'pos', None)
    if not isinstance(pos, vector):
        return vector(0, 0, 0), vector(0, 0, 0)
    t = getattr(obj, '_type', None)
    if t == 'sphere':
        r = float(getattr(obj, '_radius', 1))
        return pos - vector(r, r, r), pos + vector(r, r, r)
    if t in ('box', 'ellipsoid'):
        s = getattr(obj, '_size', vector(1, 1, 1))
        h = vector(abs(s.x) / 2, abs(s.y) / 2, abs(s.z) / 2)
        return pos - h, pos + h
    if t == 'pyramid':
        s = getattr(obj, '_size', vector(1, 1, 1))
        a = getattr(obj, '_axis', vector(1, 0, 0))
        end = pos + a.hat * s.x
        r = max(abs(s.y), abs(s.z)) / 2
        return vector(min(pos.x, end.x) - r, min(pos.y, end.y) - r, min(pos.z, end.z) - r), \
            vector(max(pos.x, end.x) + r, max(pos.y, end.y) + r, max(pos.z, end.z) + r)
    if t in ('cylinder', 'cone', 'arrow', 'helix'):
        a = getattr(obj, '_axis', vector(1, 0, 0))
        r = float(getattr(obj, '_radius', getattr(obj, '_shaftwidth', 0.1)))
        end = pos + a
        return vector(min(pos.x, end.x) - r, min(pos.y, end.y) - r, min(pos.z, end.z) - r), \
            vector(max(pos.x, end.x) + r, max(pos.y, end.y) + r, max(pos.z, end.z) + r)
    if t == 'ring':
        r = float(getattr(obj, '_radius', 1)) + float(getattr(obj, '_thickness', 0.1))
        return pos - vector(r, r, r), pos + vector(r, r, r)
    if isinstance(obj, compound):
        h = obj.size / 2
        return pos - h, pos + h
    return pos.clone(), pos.clone()


class compound(_VectorOwner):
    """여러 객체를 하나로 묶기. 묶은 뒤에는 하나의 객체처럼 pos·color·rotate()·clone()을 쓴다.
    pos 기본값은 부품들의 중심(경계 상자 중심)이고, pos를 지정하면 중심이 그 자리로 옮겨진다 (GlowScript와 같음).
    (하위 객체를 나중에 따로 바꾸려면 group()을 사용한다.)"""
    _vector_attrs = ('pos', 'axis', 'up', 'color', 'trail_color', 'scale')

    def __init__(self, objects, **kwargs):
        self._id = _new_id()
        self._objects = list(objects)
        self._group = _group_ref(kwargs.pop('group', None))
        # 부품들의 경계 상자 → 중심과 원래 크기 (회전은 무시한 어림값)
        lo, hi = None, None
        for obj in self._objects:
            a, b = _object_extent(obj)
            if lo is None:
                lo, hi = a.clone(), b.clone()
            else:
                lo = vector(min(lo.x, a.x), min(lo.y, a.y), min(lo.z, a.z))
                hi = vector(max(hi.x, b.x), max(hi.y, b.y), max(hi.z, b.z))
        if lo is None:
            lo = hi = vector(0, 0, 0)
        self._center0 = (lo + hi) / 2
        self._size0 = vector(max(hi.x - lo.x, 1e-9), max(hi.y - lo.y, 1e-9), max(hi.z - lo.z, 1e-9))
        self._scale = vector(1, 1, 1)
        self._pos = _coerce_vector(kwargs.get('pos'), self._center0)
        axis_dir = _coerce_vector(kwargs.get('axis'), vector(1, 0, 0))
        axis_dir = axis_dir.hat if axis_dir.mag > 0 else vector(1, 0, 0)
        self._axis = axis_dir * self._size0.x
        self._up = _coerce_vector(kwargs.get('up'), vector(0, 1, 0))
        self._color = kwargs.get('color', None)
        self._visible = kwargs.get('visible', True)
        self._opacity = kwargs.get('opacity', 1.0)
        self._emissive = kwargs.get('emissive', False)
        self._texture = kwargs.get('texture', None)
        self._make_trail = kwargs.pop('make_trail', False)
        self._trail_color = kwargs.pop('trail_color', None)

        # 하위 객체 ID 수집 — 묶인 객체는 scene.objects에서 빠진다 (GlowScript와 같음)
        sub_ids = []
        for obj in self._objects:
            sub_ids.append(obj._id)
            _untrack_scene_object(obj)

        cmd = {
            "action": "compound",
            "id": self._id,
            "sub_ids": sub_ids,
            "pos": self._pos.to_list(),
            "center": self._center0.to_list(),
            "axis": self._axis.to_list(),
            "up": self._up.to_list(),
            "color": self._color.to_list() if self._color else None,
            "visible": self._visible,
            "opacity": self._opacity,
            "emissive": self._emissive,
            "texture": self._texture,
            "make_trail": self._make_trail,
            "trail_color": self._trail_color.to_list() if self._trail_color else None,
        }
        if self._group is not None:
            self._group._objects.append(self)
            cmd['group'] = self._group._id
        _add_command(cmd)
        _track_scene_object(self)

    def __getitem__(self, index):
        """compound[0] — 인덱스로 하위 객체 접근"""
        return self._objects[index]

    def __len__(self):
        return len(self._objects)

    @property
    def pos(self):
        return self._pos

    @pos.setter
    def pos(self, value):
        self._pos = _coerce_vector(value, vector(0, 0, 0))
        _add_command({"action": "update", "id": self._id, "pos": self._pos.to_list()})
        if self._make_trail:
            _add_command({"action": "trail_update", "id": self._id, "pos": self._pos.to_list()})

    @property
    def axis(self):
        return self._axis

    @axis.setter
    def axis(self, value):
        """방향과 길이 — axis의 길이가 length(axis 방향 크기)가 된다 (GlowScript와 같음)."""
        value = _coerce_vector(value, vector(1, 0, 0))
        if value.mag == 0:
            raise ValueError('compound.axis는 길이가 0이 아닌 벡터여야 합니다')
        self._axis = value
        self._scale = vector(value.mag / self._size0.x, self._scale.y, self._scale.z)
        _add_command({
            "action": "update", "id": self._id,
            "axis": self._axis.to_list(), "up": self._up.to_list(), "scale": self._scale.to_list(),
        })

    @property
    def up(self):
        return self._up

    @up.setter
    def up(self, value):
        self._up = _coerce_vector(value, vector(0, 1, 0))
        _add_command({"action": "update", "id": self._id, "axis": self._axis.to_list(), "up": self._up.to_list()})

    # --- 크기: 부품 경계 상자(어림값) × 배율 ---
    def _send_scale(self):
        _add_command({"action": "update", "id": self._id, "scale": self._scale.to_list()})

    @property
    def size(self):
        """vector(length, height, width) — 부품들의 경계 상자 크기(회전 무시) × 배율"""
        return vector(self._size0.x * self._scale.x, self._size0.y * self._scale.y, self._size0.z * self._scale.z)

    @size.setter
    def size(self, value):
        v = _coerce_vector(value, self.size)
        self._scale = vector(v.x / self._size0.x, v.y / self._size0.y, v.z / self._size0.z)
        direction = self._axis.hat if self._axis.mag > 0 else vector(1, 0, 0)
        self._axis = direction * v.x
        _add_command({"action": "update", "id": self._id, "axis": self._axis.to_list(), "up": self._up.to_list(), "scale": self._scale.to_list()})

    @property
    def length(self):
        return self._size0.x * self._scale.x

    @length.setter
    def length(self, value):
        s = self.size
        self.size = vector(float(value), s.y, s.z)

    @property
    def height(self):
        return self._size0.y * self._scale.y

    @height.setter
    def height(self, value):
        self._scale = vector(self._scale.x, float(value) / self._size0.y, self._scale.z)
        self._send_scale()

    @property
    def width(self):
        return self._size0.z * self._scale.z

    @width.setter
    def width(self, value):
        self._scale = vector(self._scale.x, self._scale.y, float(value) / self._size0.z)
        self._send_scale()

    @property
    def color(self):
        return self._color

    @color.setter
    def color(self, value):
        self._color = value
        _add_command({"action": "update", "id": self._id, "color": value.to_list()})

    @property
    def visible(self):
        return self._visible

    @visible.setter
    def visible(self, value):
        self._visible = value
        _add_command({"action": "update", "id": self._id, "visible": value})

    @property
    def opacity(self):
        return self._opacity

    @opacity.setter
    def opacity(self, value):
        self._opacity = value
        _add_command({"action": "update", "id": self._id, "opacity": value})

    @property
    def emissive(self):
        return self._emissive

    @emissive.setter
    def emissive(self, value):
        self._emissive = bool(value)
        _add_command({"action": "update", "id": self._id, "emissive": self._emissive})

    @property
    def texture(self):
        return self._texture

    @texture.setter
    def texture(self, value):
        self._texture = value
        _add_command({"action": "update", "id": self._id, "texture": value})

    def rotate(self, angle, axis=None, origin=None):
        """origin(기본: 자기 위치)을 지나는 axis(기본: 자기 axis) 축으로 angle(라디안)만큼 전체를 회전"""
        _rotate_object(self, angle, axis, origin)

    def clear_trail(self):
        _add_command({"action": "trail_clear", "id": self._id})

    def attach_trail(self, color=None, retain=10000, type='curve', pps=0, radius=0, interval=1):
        return _GObject.attach_trail(self, color=color, retain=retain, type=type, pps=pps, radius=radius, interval=interval)

    def clone(self, **kwargs):
        """같은 부품으로 새 compound를 만든다. kwargs로 pos·color·group 등을 덮어쓸 수 있다.
        예: wheel2 = wheel.clone(pos=vector(4, 0, 0))"""
        parts = []
        for obj in self._objects:
            if not hasattr(obj, 'clone'):
                raise TypeError(f"compound.clone(): {type(obj).__name__} 객체는 복제할 수 없습니다")
            parts.append(obj.clone())
        args = {
            'pos': self._pos.clone(),
            'axis': self._axis.clone(),
            'up': self._up.clone(),
            'color': self._color.clone() if isinstance(self._color, vector) else self._color,
            'visible': self._visible,
            'opacity': self._opacity,
            'emissive': self._emissive,
            'texture': self._texture,
            'make_trail': self._make_trail,
            'trail_color': self._trail_color.clone() if isinstance(self._trail_color, vector) else self._trail_color,
        }
        args.update(kwargs)
        size = args.pop('size', None)
        copy = compound(parts, **args)
        if size is not None:
            copy.size = size
        elif self._scale != vector(1, 1, 1):
            copy.size = self.size
        return copy


# === group (객체 묶음 — 하위 객체를 나중에 따로 바꿀 수 있다) ===
class group(_VectorOwner):
    """객체 묶음. g = group(); box(group=g, pos=vector(1, 0, 0))
    하위 객체의 pos는 묶음 기준(g.pos가 원점)의 상대 위치다. g.pos·g.rotate()·g.visible로 한꺼번에 움직이고,
    compound와 달리 하위 객체의 색·위치를 나중에 따로 바꿀 수 있다."""
    _vector_attrs = ('pos', 'axis', 'up')

    def __init__(self, **kwargs):
        self._id = _new_id()
        self._objects = []
        self._parent = _group_ref(kwargs.get('group'))
        self._pos = _coerce_vector(kwargs.get('pos'), vector(0, 0, 0))
        self._axis = _coerce_vector(kwargs.get('axis'), vector(1, 0, 0))
        self._up = _coerce_vector(kwargs.get('up'), vector(0, 1, 0))
        self._visible = bool(kwargs.get('visible', True))
        cmd = {
            "action": "create",
            "id": self._id,
            "type": "group",
            "pos": self._pos.to_list(),
            "axis": self._axis.to_list(),
            "up": self._up.to_list(),
            "visible": self._visible,
        }
        if self._parent is not None:
            self._parent._objects.append(self)
            cmd['group'] = self._parent._id
        _add_command(cmd)

    @property
    def objects(self):
        """묶음에 든 객체 목록 (복사본)"""
        return list(self._objects)

    def __len__(self):
        return len(self._objects)

    def __getitem__(self, index):
        return self._objects[index]

    @property
    def pos(self):
        return self._pos

    @pos.setter
    def pos(self, value):
        self._pos = _coerce_vector(value, vector(0, 0, 0))
        _add_command({"action": "update", "id": self._id, "pos": self._pos.to_list()})

    @property
    def axis(self):
        return self._axis

    @axis.setter
    def axis(self, value):
        self._axis = _coerce_vector(value, vector(1, 0, 0))
        _add_command({"action": "update", "id": self._id, "axis": self._axis.to_list(), "up": self._up.to_list()})

    @property
    def up(self):
        return self._up

    @up.setter
    def up(self, value):
        self._up = _coerce_vector(value, vector(0, 1, 0))
        _add_command({"action": "update", "id": self._id, "axis": self._axis.to_list(), "up": self._up.to_list()})

    @property
    def visible(self):
        return self._visible

    @visible.setter
    def visible(self, value):
        self._visible = bool(value)
        _add_command({"action": "update", "id": self._id, "visible": self._visible})

    def rotate(self, angle, axis=None, origin=None):
        """origin(기본: g.pos)을 지나는 axis 축으로 묶음 전체를 회전"""
        _rotate_object(self, angle, axis, origin)


# === 조명 객체 ===
# scene.lights 조회용: 사용자가 만든 조명 목록
_user_lights = []


class local_light(_VectorOwner):
    """점광원 — 특정 위치에서 모든 방향으로 빛을 발산"""
    _vector_attrs = ('pos', 'color')

    def __init__(self, **kwargs):
        self._id = _new_id()
        _user_lights.append(self)
        self._pos = kwargs.get('pos', vector(0, 0, 0))
        self._color = kwargs.get('color', color.white)
        self._intensity = kwargs.get('intensity', 1.0)

        _add_command({
            "action": "create",
            "id": self._id,
            "type": "local_light",
            "pos": self._pos.to_list(),
            "color": self._color.to_list(),
            "intensity": self._intensity,
        })

    @property
    def pos(self):
        return self._pos

    @pos.setter
    def pos(self, value):
        self._pos = value
        _add_command({"action": "update", "id": self._id, "pos": value.to_list()})

    @property
    def color(self):
        return self._color

    @color.setter
    def color(self, value):
        self._color = value
        _add_command({"action": "update", "id": self._id, "color": value.to_list()})

    @property
    def intensity(self):
        return self._intensity

    @intensity.setter
    def intensity(self, value):
        self._intensity = value
        _add_command({"action": "update", "id": self._id, "intensity": value})


class distant_light(_VectorOwner):
    """평행광 — 특정 방향에서 무한히 먼 곳으로부터 오는 빛"""
    _vector_attrs = ('direction', 'color')

    def __init__(self, **kwargs):
        self._id = _new_id()
        _user_lights.append(self)
        self._direction = kwargs.get('direction', vector(0, -1, 0))
        self._color = kwargs.get('color', color.white)
        self._intensity = kwargs.get('intensity', 1.0)

        _add_command({
            "action": "create",
            "id": self._id,
            "type": "distant_light",
            "direction": self._direction.to_list(),
            "color": self._color.to_list(),
            "intensity": self._intensity,
        })

    @property
    def direction(self):
        return self._direction

    @direction.setter
    def direction(self, value):
        self._direction = value
        _add_command({"action": "update", "id": self._id, "direction": value.to_list()})

    @property
    def color(self):
        return self._color

    @color.setter
    def color(self, value):
        self._color = value
        _add_command({"action": "update", "id": self._id, "color": value.to_list()})

    @property
    def intensity(self):
        return self._intensity

    @intensity.setter
    def intensity(self, value):
        self._intensity = value
        _add_command({"action": "update", "id": self._id, "intensity": value})


# === 저수준 메시: vertex / triangle / quad / extrusion ===
class vertex:
    """삼각형/사각형의 정점 — pos는 필수, 나머지는 선택"""
    def __init__(self, pos=None, color=None, normal=None, opacity=1.0):
        self.pos = pos if pos is not None else vector(0, 0, 0)
        self.color = color if color is not None else vector(1, 1, 1)
        self.normal = normal
        self.opacity = float(opacity)

    def to_dict(self):
        d = {
            "pos": self.pos.to_list(),
            "color": self.color.to_list(),
            "opacity": self.opacity,
        }
        if isinstance(self.normal, vector):
            d["normal"] = self.normal.to_list()
        return d


class triangle:
    """3정점으로 이루어진 삼각형 면 — vertex 3개를 받음"""
    def __init__(self, v0=None, v1=None, v2=None, vs=None, **kwargs):
        self._id = _new_id()
        # vs=[v0,v1,v2] 또는 v0=, v1=, v2= 두 형식 모두 지원
        if vs is not None:
            verts = list(vs)
        else:
            verts = [v0, v1, v2]
        if len(verts) != 3 or any(v is None for v in verts):
            raise ValueError("triangle은 정확히 3개의 vertex가 필요합니다")
        self._vertices = [v if isinstance(v, vertex) else vertex(pos=v) for v in verts]
        self._visible = kwargs.get('visible', True)

        _add_command({
            "action": "create",
            "id": self._id,
            "type": "triangle",
            "vertices": [v.to_dict() for v in self._vertices],
            "visible": self._visible,
        })

    @property
    def visible(self):
        return self._visible

    @visible.setter
    def visible(self, value):
        self._visible = value
        _add_command({"action": "update", "id": self._id, "visible": value})


class quad:
    """4정점으로 이루어진 사각형 면 — 내부적으로 2개의 삼각형"""
    def __init__(self, v0=None, v1=None, v2=None, v3=None, vs=None, **kwargs):
        self._id = _new_id()
        if vs is not None:
            verts = list(vs)
        else:
            verts = [v0, v1, v2, v3]
        if len(verts) != 4 or any(v is None for v in verts):
            raise ValueError("quad는 정확히 4개의 vertex가 필요합니다")
        self._vertices = [v if isinstance(v, vertex) else vertex(pos=v) for v in verts]
        self._visible = kwargs.get('visible', True)

        _add_command({
            "action": "create",
            "id": self._id,
            "type": "quad",
            "vertices": [v.to_dict() for v in self._vertices],
            "visible": self._visible,
        })

    @property
    def visible(self):
        return self._visible

    @visible.setter
    def visible(self, value):
        self._visible = value
        _add_command({"action": "update", "id": self._id, "visible": value})


def _is_point2d(p):
    return isinstance(p, vector) or (
        isinstance(p, (list, tuple)) and len(p) >= 2 and all(isinstance(c, (int, float)) for c in p[:2])
    )


def _is_contour(c):
    return isinstance(c, (list, tuple)) and len(c) > 0 and all(_is_point2d(p) for p in c)


def _contour_points(c):
    return [[float(p.x), float(p.y)] if isinstance(p, vector) else [float(p[0]), float(p[1])] for p in c]


def _normalize_shape(shape):
    """extrusion의 shape 인자 → [[바깥 외곽선, 구멍, ...], ...] (고체 목록, 점은 [x, y])
    받는 형식: [x, y] 점 목록 / [바깥, 구멍...] 목록(shapes.circle(thickness=)의 결과) / 고체 여러 개의 목록"""
    if shape is None:
        return [[[[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5], [-0.5, -0.5]]]]
    if _is_contour(shape):
        return [[_contour_points(shape)]]
    if isinstance(shape, (list, tuple)) and shape and all(_is_contour(c) for c in shape):
        return [[_contour_points(c) for c in shape]]
    solids = []
    for s in shape or []:
        if _is_contour(s):
            solids.append([_contour_points(s)])
        elif isinstance(s, (list, tuple)) and s and all(_is_contour(c) for c in s):
            solids.append([_contour_points(c) for c in s])
        else:
            raise TypeError("shape는 [x, y] 점 목록, [바깥, 구멍, ...] 목록, 또는 그런 목록의 목록이어야 합니다 (shapes.* 결과)")
    if not solids:
        raise ValueError("shape에 점이 없습니다")
    return solids


def _normalize_path(path):
    """extrusion의 path 인자 → [[x, y, z], ...]"""
    pts = []
    for p in (path or []):
        if isinstance(p, vector):
            pts.append(p.to_list())
        elif isinstance(p, (list, tuple)) and len(p) >= 2 and all(isinstance(c, (int, float)) for c in p):
            pts.append([float(p[0]), float(p[1]), float(p[2]) if len(p) > 2 else 0.0])
        else:
            raise TypeError("path는 vector 목록이어야 합니다 (paths.* 결과). 예: path=[vector(0,0,0), vector(0,0,2)]")
    if len(pts) < 2:
        raise ValueError("path에는 점이 2개 이상 필요합니다")
    return pts


class extrusion(_GObject):
    """2D 단면(shape)을 경로(path)를 따라 쓸어 만든 입체.
    extrusion(path=paths.circle(radius=2), shape=shapes.rectangle(width=0.4, height=0.2))
    - shape: [x, y] 점 목록, [바깥, 구멍] 목록(shapes.circle(thickness=)의 결과), 또는 고체 여러 개의 목록
    - pos: 기본값은 경로의 중심. 지정하면 입체 전체가 그 위치로 옮겨진다
    - color: 색 하나 또는 경로 점마다의 색 목록. scale: 숫자 또는 경로 점마다의 배율 목록
    - start_face_color / end_face_color: 열린 경로 양 끝면의 색
    - rotate()·clone()·axis·up은 다른 객체와 같다"""
    def __init__(self, path=None, shape=None, **kwargs):
        self._path = _normalize_path(path)
        self._shape = _normalize_shape(shape)
        self._axis = _coerce_vector(kwargs.pop('axis', None), vector(1, 0, 0))
        self._up = _coerce_vector(kwargs.pop('up', None), vector(0, 1, 0))
        scale = kwargs.pop('scale', 1.0)
        self._scale = [float(s) for s in scale] if isinstance(scale, (list, tuple)) else float(scale)
        self._start_face_color = _coerce_vector(kwargs.pop('start_face_color', None), None)
        self._end_face_color = _coerce_vector(kwargs.pop('end_face_color', None), None)
        self._show_start_face = bool(kwargs.pop('show_start_face', True))
        self._show_end_face = bool(kwargs.pop('show_end_face', True))
        for ignored in ('twist', 'smooth', 'xscale', 'yscale', 'shininess'):
            kwargs.pop(ignored, None)

        # 경로 점마다 다른 색 (Conch 예제처럼 color=[v1, v2, ...])
        color_arg = kwargs.get('color', None)
        self._colors = None
        if isinstance(color_arg, (list, tuple)) and color_arg and not (
            len(color_arg) == 3 and all(isinstance(c, (int, float)) for c in color_arg)
        ):
            self._colors = [_coerce_vector(c, color.white) for c in color_arg]
            kwargs['color'] = self._colors[0].clone()
        elif color_arg is not None and not isinstance(color_arg, vector):
            kwargs['color'] = _coerce_vector(color_arg, color.white)
        if kwargs.get('pos') is None:
            kwargs['pos'] = self._path_center()

        super().__init__(
            'extrusion',
            path=self._path,
            shape=self._shape,
            axis=self._axis,
            up=self._up,
            scale=self._scale,
            colors=self._colors,
            start_face_color=self._start_face_color,
            end_face_color=self._end_face_color,
            show_start_face=self._show_start_face,
            show_end_face=self._show_end_face,
            **kwargs,
        )

    def _path_center(self):
        xs = [p[0] for p in self._path]
        ys = [p[1] for p in self._path]
        zs = [p[2] for p in self._path]
        return vector((min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2, (min(zs) + max(zs)) / 2)

    @property
    def path(self):
        return [vector(*p) for p in self._path]

    @property
    def shape(self):
        return [[[list(p) for p in contour] for contour in solid] for solid in self._shape]

    @property
    def axis(self):
        return self._axis

    @axis.setter
    def axis(self, value):
        """방향만 바뀐다. 기본 axis=vector(1,0,0)이 만든 그대로의 방향이다."""
        self._axis = _coerce_vector(value, vector(1, 0, 0))
        _add_command({"action": "update", "id": self._id, "axis": self._axis.to_list(), "up": self._up.to_list()})

    @property
    def up(self):
        return self._up

    @up.setter
    def up(self, value):
        self._up = _coerce_vector(value, vector(0, 1, 0))
        _add_command({"action": "update", "id": self._id, "axis": self._axis.to_list(), "up": self._up.to_list()})

    def _clone_kwargs(self):
        args = {
            **super()._clone_kwargs(),
            'path': [vector(*p) for p in self._path],
            'shape': self.shape,
            'axis': self._axis.clone(),
            'up': self._up.clone(),
            'scale': list(self._scale) if isinstance(self._scale, list) else self._scale,
            'start_face_color': self._start_face_color.clone() if isinstance(self._start_face_color, vector) else None,
            'end_face_color': self._end_face_color.clone() if isinstance(self._end_face_color, vector) else None,
            'show_start_face': self._show_start_face,
            'show_end_face': self._show_end_face,
        }
        if self._colors:
            args['color'] = [c.clone() for c in self._colors]
        return args


# === 2D 그래프 시스템 ===
# graph는 별도 캔버스(DOM 오버레이)에서 그려지는 2D 플롯입니다.
# gcurve(선), gdots(점), gvbars(세로막대), ghbars(가로막대)를 지원.

_active_graphs = {}  # id → graph 인스턴스 (디버그용)

class graph:
    """2D 플롯 캔버스 — gcurve/gdots/gvbars/ghbars의 컨테이너"""
    def __init__(self, **kwargs):
        self._id = _new_id()
        self._title = kwargs.get('title', '')
        self._xtitle = kwargs.get('xtitle', '')
        self._ytitle = kwargs.get('ytitle', '')
        self._width = int(kwargs.get('width', 480))
        self._height = int(kwargs.get('height', 320))
        self._fast = bool(kwargs.get('fast', True))
        self._xmin = kwargs.get('xmin', None)
        self._xmax = kwargs.get('xmax', None)
        self._ymin = kwargs.get('ymin', None)
        self._ymax = kwargs.get('ymax', None)
        self._series = []
        _active_graphs[self._id] = self

        _add_command({
            "action": "graph_create",
            "id": self._id,
            "title": self._title,
            "xtitle": self._xtitle,
            "ytitle": self._ytitle,
            "width": self._width,
            "height": self._height,
            "fast": self._fast,
            "xmin": self._xmin, "xmax": self._xmax,
            "ymin": self._ymin, "ymax": self._ymax,
        })

    def _add_series(self, series):
        self._series.append(series)

    def delete(self):
        _add_command({"action": "graph_delete", "id": self._id})
        _active_graphs.pop(self._id, None)


class _GSeriesBase:
    """그래프 시리즈 공통 부모 — gcurve/gdots/gvbars/ghbars"""
    _kind = 'curve'

    def __init__(self, **kwargs):
        self._id = _new_id()
        # graph 인스턴스 — 미지정 시 기본 graph 1개를 자동 생성
        g = kwargs.get('graph', None)
        if g is None:
            # 기존에 만들어진 가장 최근 graph 재사용 (없으면 새로 생성)
            if _active_graphs:
                g = next(reversed(list(_active_graphs.values())))
            else:
                g = graph()
        self._graph = g
        self._color = kwargs.get('color', vector(0.2, 0.5, 0.9))
        self._width = float(kwargs.get('width', 1.5))
        self._size = float(kwargs.get('size', 4))   # gdots
        self._label = kwargs.get('label', '')
        self._visible = kwargs.get('visible', True)
        g._add_series(self)

        _add_command({
            "action": "graph_series_create",
            "id": self._id,
            "graph_id": g._id,
            "kind": self._kind,
            "color": self._color.to_list(),
            "width": self._width,
            "size": self._size,
            "label": self._label,
            "visible": self._visible,
        })

    def plot(self, *args):
        """plot(x, y) 또는 plot([(x,y), ...]) 또는 plot([x1,x2,...], [y1,y2,...])"""
        # 다양한 입력 형식 정규화
        pts = []
        if len(args) == 2 and not hasattr(args[0], '__iter__'):
            pts = [(float(args[0]), float(args[1]))]
        elif len(args) == 2 and hasattr(args[0], '__iter__') and hasattr(args[1], '__iter__'):
            pts = list(zip([float(x) for x in args[0]], [float(y) for y in args[1]]))
        elif len(args) == 1 and hasattr(args[0], '__iter__'):
            for item in args[0]:
                if hasattr(item, '__iter__') and not isinstance(item, str):
                    a = list(item)
                    pts.append((float(a[0]), float(a[1])))
                else:
                    raise ValueError("plot 인자가 (x,y) 페어가 아닙니다")
        else:
            raise ValueError("plot(x, y) 또는 plot([(x,y), ...]) 형식이어야 합니다")
        _add_command({
            "action": "graph_series_plot",
            "id": self._id,
            "points": pts,
        })

    def delete(self):
        _add_command({"action": "graph_series_delete", "id": self._id})

    def clear(self):
        """시리즈의 점만 비우고 같은 그래프/색/핸들러는 유지"""
        _add_command({"action": "graph_series_clear", "id": self._id})


class gcurve(_GSeriesBase):
    """선 그래프"""
    _kind = 'curve'


class gdots(_GSeriesBase):
    """점 그래프"""
    _kind = 'dots'


class gvbars(_GSeriesBase):
    """세로 막대 그래프"""
    _kind = 'vbars'


class ghbars(_GSeriesBase):
    """가로 막대 그래프"""
    _kind = 'hbars'


# === 이벤트 시스템 (scene.bind, scene.mouse) ===
class _MouseState:
    """scene.mouse — 마우스 상태 폴링 객체. 최신 위치는 메인 스레드가 갱신."""
    def __init__(self):
        self._pos = vector(0, 0, 0)   # 월드 좌표 (3D 평면 z=0 가정)
        self._pick = None              # 현재 마우스 아래 객체 id

    @property
    def pos(self):
        # JS의 _getMousePos를 통해 최신 좌표 갱신
        try:
            p = js._getMousePos()
            if p is not None:
                self._pos = vector(p[0], p[1], p[2])
        except Exception:
            pass
        return self._pos

    @property
    def pick(self):
        try:
            return js._getMousePick()
        except Exception:
            return None

    @property
    def camera(self):
        """카메라 위치 (scene.camera.pos와 같다)"""
        return scene.camera.pos

    @property
    def ray(self):
        """카메라에서 마우스가 가리키는 점을 향하는 단위 벡터"""
        direction = self.pos - scene.camera.pos
        if direction.mag == 0:
            return scene.forward
        return direction.hat

    def project(self, normal=None, point=None, d=None):
        """마우스 광선을 평면에 투영한 점. 평면은 normal(법선)과 point(평면 위 한 점) 또는 d(원점에서 법선 방향 거리)로 준다.
        광선이 평면과 만나지 않으면 None. 예: scene.mouse.project(normal=vector(0,1,0), point=vector(0,0,0))"""
        normal = _coerce_vector(normal, vector(0, 0, 1))
        if normal.mag == 0:
            raise ValueError('project의 normal은 길이가 0이 아닌 벡터여야 합니다')
        if point is None:
            point = normal.hat * float(d or 0)
        else:
            point = _coerce_vector(point, vector(0, 0, 0))
        cam = scene.camera.pos
        ray = self.ray
        denom = normal.dot(ray)
        if abs(denom) < 1e-12:
            return None
        t = normal.dot(point - cam) / denom
        if t < 0:
            return None
        return cam + ray * t

    # 보조 키 상태 — VPyLab은 포인터 이벤트에서 보조 키를 읽지 않으므로 항상 False
    alt = False
    ctrl = False
    shift = False


_mouse_singleton = _MouseState()


class _EventInfo:
    """on_click/on_mousedown 등에 전달되는 이벤트 객체"""
    def __init__(self, name, pos=None, pick=None, key=None):
        self.event = name
        self.pos = pos if pos is not None else vector(0, 0, 0)
        self.pick = pick
        self.key = key


# bind된 핸들러 저장: { event_name: [handler, ...] }
_event_handlers = {}


def _process_pending_events():
    """JS 이벤트 큐에서 이벤트를 가져와 등록된 핸들러 호출. rate()에서 호출됨."""
    try:
        while True:
            evt_json = js._popEvent()
            if evt_json is None:
                return
            try:
                import json as _json
                # PyProxy → str 강제 변환
                evt = _json.loads(str(evt_json))
            except Exception:
                continue
            name = evt.get('name')
            handlers = _event_handlers.get(name, [])
            if not handlers:
                # widget 이벤트는 widget id로도 디스패치
                w_id = evt.get('widget')
                if w_id and w_id in _event_handlers:
                    handlers = _event_handlers[w_id]
            if not handlers:
                continue
            pos = evt.get('pos')
            info = _EventInfo(
                name=name,
                pos=vector(*pos) if pos else None,
                pick=evt.get('pick'),
                key=evt.get('key'),
            )
            # widget 이벤트면 value 필드 추가
            if 'value' in evt:
                info.value = evt['value']
            for h in handlers:
                try:
                    h(info)
                except Exception as e:
                    print(f"[event handler error] {e}")
    except Exception:
        # _popEvent 미정의 등 — 조용히 무시
        return


def keysdown():
    """현재 눌려있는 모든 키의 리스트를 반환 (VPython 호환).
    예: 'ArrowUp' in keysdown() — 위 화살표가 현재 눌려있으면 True
    여러 키를 동시에 처리하는 게임 루프에 유용."""
    try:
        import json as _json
        raw = js._getPressedKeys()
        return _json.loads(str(raw))
    except Exception:
        return []


def _bind(event_name, handler):
    _event_handlers.setdefault(event_name, []).append(handler)


def _unbind(event_name, handler=None):
    if handler is None:
        _event_handlers.pop(event_name, None)
    else:
        lst = _event_handlers.get(event_name)
        if lst and handler in lst:
            lst.remove(handler)


# === UI 위젯 ===
# slider, button, checkbox, radio, menu, winput
# 모두 DOM 요소로 메인 스레드에서 렌더링되며, 이벤트는 _event_handlers로 디스패치.

_widget_values = {}  # widget id → 최신 value (JS와 동기화)


class _Widget:
    _kind = 'widget'

    def __init__(self, **kwargs):
        self._id = _new_id()
        self._bind = kwargs.pop('bind', None)
        self._visible = kwargs.pop('visible', True)
        self._disabled = kwargs.pop('disabled', False)
        # bind 핸들러 등록 (id 기반)
        if callable(self._bind):
            _event_handlers.setdefault(self._id, []).append(self._bind)
        _widget_values[self._id] = kwargs.get('value', None)

    def _emit_create(self, extra):
        cmd = {
            "action": "widget_create",
            "id": self._id,
            "kind": self._kind,
            "visible": self._visible,
            "disabled": self._disabled,
        }
        cmd.update(extra)
        _add_command(cmd)

    @property
    def value(self):
        # JS에서 갱신된 최신값 동기화
        try:
            v = js._getWidgetValue(self._id)
            if v is not None:
                _widget_values[self._id] = v
        except Exception:
            pass
        return _widget_values.get(self._id)

    @value.setter
    def value(self, v):
        _widget_values[self._id] = v
        _add_command({"action": "widget_update", "id": self._id, "value": v})

    @property
    def disabled(self):
        return self._disabled

    @disabled.setter
    def disabled(self, v):
        self._disabled = bool(v)
        _add_command({"action": "widget_update", "id": self._id, "disabled": self._disabled})

    def delete(self):
        _add_command({"action": "widget_delete", "id": self._id})


class slider(_Widget):
    _kind = 'slider'

    def __init__(self, min=0, max=1, step=0.01, value=None, length=200, text='', **kwargs):
        self._min = float(min)
        self._max = float(max)
        self._step = float(step)
        self._value = float(value) if value is not None else self._min
        self._length = int(length)
        self._text = str(text)
        super().__init__(value=self._value, **kwargs)
        self._emit_create({
            "min": self._min, "max": self._max, "step": self._step,
            "value": self._value, "length": self._length, "text": self._text,
        })


class button(_Widget):
    _kind = 'button'

    def __init__(self, text='Button', **kwargs):
        self._text = str(text)
        super().__init__(**kwargs)
        self._emit_create({"text": self._text})

    @property
    def text(self):
        return self._text

    @text.setter
    def text(self, v):
        self._text = str(v)
        _add_command({"action": "widget_update", "id": self._id, "text": self._text})


class checkbox(_Widget):
    _kind = 'checkbox'

    def __init__(self, text='', checked=False, **kwargs):
        self._text = str(text)
        self._checked = bool(checked)
        super().__init__(value=self._checked, **kwargs)
        self._emit_create({"text": self._text, "checked": self._checked})

    @property
    def checked(self):
        return bool(self.value)

    @checked.setter
    def checked(self, v):
        self.value = bool(v)


class radio(_Widget):
    _kind = 'radio'

    def __init__(self, text='', name='radio_group', value=None, checked=False, **kwargs):
        self._text = str(text)
        self._name = str(name)
        self._radio_value = value
        self._checked = bool(checked)
        super().__init__(value=value if checked else None, **kwargs)
        self._emit_create({
            "text": self._text, "name": self._name,
            "radio_value": self._radio_value, "checked": self._checked,
        })


class menu(_Widget):
    _kind = 'menu'

    def __init__(self, choices=None, selected=None, **kwargs):
        self._choices = list(choices) if choices else []
        self._selected = selected if selected is not None else (self._choices[0] if self._choices else None)
        super().__init__(value=self._selected, **kwargs)
        self._emit_create({"choices": self._choices, "selected": self._selected})

    @property
    def choices(self):
        return list(self._choices)

    @property
    def selected(self):
        """현재 선택된 항목 (GlowScript 호환, value와 같다)"""
        return self.value

    @selected.setter
    def selected(self, v):
        self.value = v

    @property
    def index(self):
        """선택된 항목의 번호. 목록에 없으면 -1"""
        v = self.value
        return self._choices.index(v) if v in self._choices else -1

    @index.setter
    def index(self, i):
        self.value = self._choices[int(i)]


class winput(_Widget):
    """텍스트/숫자 입력 — Enter 키 또는 blur 시 bind 호출"""
    _kind = 'winput'

    def __init__(self, prompt='', type='numeric', **kwargs):
        self._prompt = str(prompt)
        self._type = str(type)
        super().__init__(**kwargs)
        self._emit_create({"prompt": self._prompt, "input_type": self._type})

    @property
    def text(self):
        """입력 칸의 글자 (GlowScript 호환). 아직 입력이 없으면 빈 문자열"""
        v = self.value
        return '' if v is None else str(v)

    @text.setter
    def text(self, v):
        self.value = str(v)

    @property
    def number(self):
        """입력값을 숫자로 바꾼 값. 숫자가 아니면 None"""
        t = self.text.strip()
        if not t:
            return None
        try:
            return float(t)
        except ValueError:
            return None


# === scene 객체 (카메라/배경 제어) ===
def _camera_state():
    """메인 스레드가 약 10Hz로 보내는 카메라 상태 (pos, center, forward, up, range, fov, width, height)."""
    try:
        raw = js._getCameraState()
        if raw is None:
            return None
        return json.loads(str(raw))
    except Exception:
        return None


class _Camera:
    """scene.camera — GlowScript VPython과 같은 의미의 카메라 제어
    scene.camera.pos = vector(0, 5, 10)   # 카메라를 옮기고 중심도 같이 이동 (방향·거리 유지)
    scene.camera.axis = vector(0, -5, -10)  # 카메라는 그대로 두고 중심을 pos + axis로
    scene.camera.follow(ball)              # ball을 계속 화면 중심에 둠, follow(None)이면 해제
    """
    def __init__(self, scene):
        self._scene = scene
        self._pos = None
        self._axis = None
        self.follower = None

    @property
    def pos(self):
        state = self._scene._fresh_state()
        if state and state.get('pos'):
            return vector(*state['pos'])
        if self._pos is not None:
            return self._pos.clone()
        return self._scene.center - self._scene._forward * self._scene._distance()

    @pos.setter
    def pos(self, value):
        value = _coerce_vector(value, vector(0, 0, 0))
        self._pos = value
        self._scene._autoscale = False
        self._scene._mark_set()
        _add_command({"action": "scene", "property": "camera_pos", "value": value.to_list()})

    @property
    def axis(self):
        state = self._scene._fresh_state()
        if state and state.get('pos') and state.get('center'):
            return vector(*state['center']) - vector(*state['pos'])
        if self._axis is not None:
            return self._axis.clone()
        return self._scene._forward * self._scene._distance()

    @axis.setter
    def axis(self, value):
        value = _coerce_vector(value, vector(0, 0, -1))
        if mag(value) == 0:
            raise ValueError('scene.camera.axis는 길이가 0이 아닌 벡터여야 합니다')
        self._axis = value
        self._scene._autoscale = False
        self._scene._forward = norm(value)
        self._scene._range = mag(value) * math.tan(self._scene._fov / 2)
        self._scene._mark_set()
        _add_command({"action": "scene", "property": "camera_axis", "value": value.to_list()})

    def rotate(self, angle=0, axis=None, origin=None):
        """카메라를 origin(기본 scene.center)을 중심으로 axis 둘레로 angle만큼 회전한다. 보는 점은 그대로다."""
        if axis is None:
            axis = self._scene.up
        axis = _coerce_vector(axis, vector(0, 1, 0))
        center = self._scene.center
        origin = _coerce_vector(origin, center)
        new_pos = origin + (self.pos - origin).rotate(angle, axis=axis)
        new_up = self._scene.up.rotate(angle, axis=axis)
        # pos를 지정하면 중심도 같이 움직이므로, axis로 중심을 원래 자리에 되돌린다
        self.pos = new_pos
        self.axis = center - new_pos
        self._scene.up = new_up

    def follow(self, obj=None):
        """객체를 계속 화면 중심에 둔다. None이면 추적을 멈춘다."""
        self.follower = obj
        obj_id = getattr(obj, '_id', None) if obj is not None else None
        _add_command({"action": "scene", "property": "camera_follow", "value": obj_id})


class _Scene(_VectorOwner):
    """씬 전역 제어 — VPython의 scene과 유사
    scene.background = color.black
    scene.range = 5         # 화면 짧은 변 방향으로 보이는 범위의 절반 (GlowScript와 같음)
    scene.center = vector(0,0,0)
    scene.forward = vector(0,-1,-1)   # 보는 방향
    scene.up = vector(0,1,0)
    scene.fov = pi/3                  # 시야각 (라디안)
    scene.camera.pos / scene.camera.axis / scene.camera.follow(obj)
    scene.ambient = color.gray(0.3)   # 환경광
    scene.lights = []                 # 기본 조명 끄기
    scene.autoscale = True/False
    scene.title = "..."     # 3D 화면 위쪽 글자
    scene.caption = "..."   # 3D 화면 아래쪽 글자
    """
    _vector_attrs = ('background', 'center', 'forward', 'up', 'ambient')

    def __init__(self):
        self._background = vector(0.97, 0.98, 0.98)
        self._range = None
        self._center = vector(0, 0, 0)
        self._autoscale = True
        self._title = ''
        self._caption = ''
        self._forward = vector(0, 0, -1)
        self._up = vector(0, 1, 0)
        self._fov = math.pi / 4   # 뷰포트 기본 45도 (GlowScript 기본은 60도)
        self._ambient = vector(0.6, 0.6, 0.6)
        self._lights = None
        self._camera = _Camera(self)
        self._set_seq = None   # 마지막으로 카메라 값을 지정했을 때의 상태 번호
        self._width = None     # scene.width = 800 처럼 지정한 값 (화면 크기는 바뀌지 않고 값만 기억한다)
        self._height = None
        self._align = 'none'
        self._resizable = True
        self._visible = True

    def _mark_set(self):
        """카메라 값을 지정한 직후에는 메인 스레드 상태가 아직 옛 값이므로 로컬 값을 쓰게 한다."""
        state = _camera_state()
        self._set_seq = state.get('seq', 0) if state else -1

    def _fresh_state(self):
        """지정 이후에 새로 도착한 카메라 상태만 돌려준다. 없으면 None."""
        state = _camera_state()
        if not state:
            return None
        if self._set_seq is not None and state.get('seq', 0) <= self._set_seq:
            return None
        return state

    def _reset(self):
        """새 실행 전에 카메라·조명 설정을 기본값으로 되돌린다."""
        self.__init__()

    def _distance(self):
        """중심에서 카메라까지 거리 — range / tan(fov/2)"""
        r = self._range if self._range else 10.0
        return r / math.tan(self._fov / 2)

    @property
    def background(self):
        return self._background

    @background.setter
    def background(self, value):
        self._background = value
        _add_command({"action": "scene", "property": "background", "value": value.to_list()})

    @property
    def range(self):
        state = self._fresh_state()
        if state and state.get('range'):
            return float(state['range'])
        return self._range if self._range is not None else 10.0

    @range.setter
    def range(self, value):
        value = float(value)
        if value <= 0:
            raise ValueError('scene.range는 0보다 커야 합니다')
        self._range = value
        self._autoscale = False   # GlowScript처럼 range를 지정하면 자동 맞춤을 끈다
        self._mark_set()
        _add_command({"action": "scene", "property": "range", "value": self._range})

    @property
    def forward(self):
        state = self._fresh_state()
        if state and state.get('forward'):
            self._forward = vector(*state['forward'])
        return self._forward.clone()

    @forward.setter
    def forward(self, value):
        value = _coerce_vector(value, vector(0, 0, -1))
        if mag(value) == 0:
            raise ValueError('scene.forward는 길이가 0이 아닌 벡터여야 합니다')
        self._forward = norm(value)
        self._mark_set()
        _add_command({"action": "scene", "property": "forward", "value": self._forward.to_list()})

    @property
    def up(self):
        state = self._fresh_state()
        if state and state.get('up'):
            self._up = vector(*state['up'])
        return self._up.clone()

    @up.setter
    def up(self, value):
        value = _coerce_vector(value, vector(0, 1, 0))
        if mag(value) == 0:
            raise ValueError('scene.up은 길이가 0이 아닌 벡터여야 합니다')
        self._up = norm(value)
        self._mark_set()
        _add_command({"action": "scene", "property": "up", "value": self._up.to_list()})

    @property
    def fov(self):
        state = self._fresh_state()
        if state and state.get('fov'):
            self._fov = float(state['fov'])
        return self._fov

    @fov.setter
    def fov(self, value):
        value = float(value)
        if not 0 < value < math.pi:
            raise ValueError('scene.fov는 라디안 단위로 0과 pi 사이여야 합니다 (예: pi/3)')
        self._fov = value
        self._mark_set()
        _add_command({"action": "scene", "property": "fov", "value": self._fov})

    @property
    def camera(self):
        return self._camera

    @property
    def width(self):
        if self._width is not None:
            return self._width
        state = _camera_state()
        return int(state['width']) if state and state.get('width') else 640

    @width.setter
    def width(self, value):
        """GlowScript 코드가 멈추지 않도록 값을 기억한다. 3D 화면 크기는 레이아웃이 정하므로 바뀌지 않는다."""
        self._width = int(value)

    @property
    def height(self):
        if self._height is not None:
            return self._height
        state = _camera_state()
        return int(state['height']) if state and state.get('height') else 400

    @height.setter
    def height(self, value):
        self._height = int(value)

    @property
    def align(self):
        return self._align

    @align.setter
    def align(self, value):
        self._align = str(value)

    @property
    def resizable(self):
        return self._resizable

    @resizable.setter
    def resizable(self, value):
        self._resizable = bool(value)

    @property
    def caption_anchor(self):
        """wtext(pos=scene.caption_anchor) 위치 표시 (GlowScript 호환). 위젯은 항상 전용 패널에 놓이므로 위젯에서는 무시된다."""
        return _CAPTION_ANCHOR

    @property
    def title_anchor(self):
        """wtext(pos=scene.title_anchor)면 글자가 제목 영역에 놓인다."""
        return _TITLE_ANCHOR

    @property
    def objects(self):
        """현재 보이는 3D 객체 목록. for o in scene.objects: o.visible = False 로 모두 숨길 수 있다."""
        return [o for o in _scene_objects if getattr(o, '_visible', True)]

    @property
    def visible(self):
        return self._visible

    @visible.setter
    def visible(self, value):
        """scene.visible = False 면 3D 화면 전체를 숨긴다 (객체는 남아 있다)."""
        self._visible = bool(value)
        _add_command({"action": "scene", "property": "visible", "value": self._visible})

    def delete(self):
        """3D 화면의 객체를 모두 지운다 (GlowScript의 canvas.delete()). 위젯·그래프는 남는다."""
        for obj in list(_scene_objects):
            try:
                obj._visible = False
            except Exception:
                pass
        _scene_objects.clear()
        _add_command({"action": "scene", "property": "delete", "value": True})

    def select(self):
        """GlowScript의 canvas.select() — 캔버스가 하나뿐이므로 할 일이 없다."""
        return self

    @property
    def pixel_to_world(self):
        """화면 픽셀 하나가 중심 거리에서 차지하는 월드 길이"""
        return 2 * self.range / max(1, self.height)

    @property
    def ambient(self):
        return self._ambient.clone()

    @ambient.setter
    def ambient(self, value):
        value = _coerce_vector(value, vector(0.6, 0.6, 0.6))
        self._ambient = value
        _add_command({"action": "scene", "property": "ambient", "value": value.to_list()})

    @property
    def lights(self):
        return list(self._lights) if self._lights is not None else list(_user_lights)

    @lights.setter
    def lights(self, value):
        lights = list(value) if value else []
        self._lights = lights
        ids = [light._id for light in lights if hasattr(light, '_id')]
        _add_command({"action": "scene", "property": "lights", "value": ids})

    @property
    def center(self):
        return self._center

    @center.setter
    def center(self, value):
        self._center = value
        _add_command({"action": "scene", "property": "center", "value": value.to_list()})

    @property
    def autoscale(self):
        return self._autoscale

    @autoscale.setter
    def autoscale(self, value):
        self._autoscale = bool(value)
        _add_command({"action": "scene", "property": "autoscale", "value": self._autoscale})

    @property
    def title(self):
        return self._title

    @title.setter
    def title(self, value):
        self._title = str(value)
        _add_command({"action": "scene", "property": "title", "value": self._title})

    def append_to_title(self, *values):
        """3D 화면 위쪽 글자에 덧붙인다."""
        text = ''.join(str(v) for v in values)
        self._title += text
        _add_command({"action": "scene", "property": "append_title", "value": text})

    def append_to_caption(self, *values):
        """3D 화면 아래쪽 글자에 덧붙인다."""
        text = ''.join(str(v) for v in values)
        self._caption += text
        _add_command({"action": "scene", "property": "append_caption", "value": text})

    @property
    def caption(self):
        return self._caption

    @caption.setter
    def caption(self, value):
        self._caption = str(value)
        _add_command({"action": "scene", "property": "caption", "value": self._caption})

    @property
    def mouse(self):
        return _mouse_singleton

    def bind(self, event_names, handler=None):
        """이벤트 핸들러 등록.
        scene.bind('click', on_click)
        scene.bind('mousedown mouseup mousemove', on_mouse)  # 공백 구분 다중
        @scene.bind('keydown')  # 데코레이터로도 사용 가능"""
        # 데코레이터 형태: scene.bind('click') 후 함수에 적용
        if handler is None:
            def _decorator(fn):
                self.bind(event_names, fn)
                return fn
            return _decorator
        names = event_names.split() if isinstance(event_names, str) else list(event_names)
        for n in names:
            _bind(n, handler)
        # 메인 스레드에 이 이벤트를 디스패치 시작하라고 알림
        _add_command({"action": "scene_bind", "events": names})

    def unbind(self, event_names, handler=None):
        names = event_names.split() if isinstance(event_names, str) else list(event_names)
        for n in names:
            _unbind(n, handler)

    def waitfor(self, event_name):
        """동기 대기 — VPython의 scene.waitfor와 호환되도록 단순화.
        실제 비동기 환경에서는 이벤트 루프와 충돌하므로 권장하지 않음."""
        print(f"[scene.waitfor] {event_name} — VPyLab은 scene.bind 콜백 사용을 권장")


scene = _Scene()


# === canvas() — GlowScript의 캔버스 생성 ===
_canvas_calls = 0


def canvas(**kwargs):
    """GlowScript의 canvas(width=, height=, background=, title=, center=, range=, forward=, ...).
    VPyLab은 3D 화면이 하나라서 인자를 scene에 적용하고 scene을 돌려준다.
    두 번째 호출부터는 같은 scene을 돌려주고 안내를 한 번 출력한다."""
    global _canvas_calls
    _canvas_calls += 1
    if _canvas_calls > 1:
        _notice_once('canvas-single', "[canvas] VPyLab은 캔버스를 하나만 지원합니다. 새 canvas()는 기존 scene을 그대로 돌려줍니다.")
    for key, value in kwargs.items():
        setattr(scene, key, value)
    return scene


canvas.get_selected = lambda: scene


# === attach_arrow — 객체의 벡터 속성을 따라다니는 화살표 ===
_attached_arrows = []


class attach_arrow:
    """attach_arrow(ball, 'velocity', scale=0.5) — ball.velocity를 화살표로 계속 표시한다.
    rate()나 sleep()을 지날 때마다 위치와 방향이 갱신된다. .stop()으로 숨기고 .start()로 다시 켠다."""
    def __init__(self, obj, attr, scale=1.0, shaftwidth=None, color=None):
        if not hasattr(obj, attr):
            raise AttributeError(f"attach_arrow: 객체에 '{attr}' 속성이 없습니다")
        self.obj = obj
        self.attr = attr
        self.scale = scale
        self._active = True
        self._last = None
        kwargs = {'pos': obj.pos, 'axis': self._axis()}
        if shaftwidth is not None:
            kwargs['shaftwidth'] = shaftwidth
        kwargs['color'] = color if color is not None else obj.color
        self.arrow = arrow(**kwargs)
        self._last = (obj.pos.to_list(), kwargs['axis'].to_list())
        _attached_arrows.append(self)

    def _axis(self):
        value = getattr(self.obj, self.attr, None)
        if not isinstance(value, vector):
            return vector(0, 0, 0)
        return value * self.scale

    def update(self):
        if not self._active:
            return
        pos = self.obj.pos
        axis = self._axis()
        key = (pos.to_list(), axis.to_list())
        if key == self._last:
            return
        self._last = key
        self.arrow.pos = pos
        self.arrow.axis = axis

    def stop(self):
        self._active = False
        self.arrow.visible = False

    def start(self):
        self._active = True
        self.arrow.visible = True
        self._last = None
        self.update()


def _update_attached_arrows():
    for item in _attached_arrows:
        try:
            item.update()
        except Exception as e:
            print(f"[attach_arrow] 갱신 실패: {e}")


# === rate()·sleep()마다 갱신하는 부착물: attach_trail(함수)·attach_light ===
_attached_followers = []


def _update_attached_followers():
    for item in _attached_followers:
        try:
            item.update()
        except Exception as e:
            print(f"[{type(item).__name__}] 갱신 실패: {e}")


class _FunctionTrail:
    """attach_trail(함수, ...) — rate()·sleep()을 지날 때마다 함수가 돌려준 벡터를 궤적에 더한다."""
    def __init__(self, fn, color=None, radius=0, retain=-1, type='curve', pps=0):
        self.fn = fn
        self._active = True
        self._pps = float(pps or 0)
        self._last_time = None
        kwargs = {'color': color if color is not None else vector(1, 1, 1), 'retain': int(retain)}
        if type == 'points':
            if radius and radius > 0:
                kwargs['radius'] = float(radius)
                kwargs['size_units'] = 'world'
            self.trail = points(**kwargs)
        else:
            kwargs['radius'] = float(radius or 0)
            self.trail = curve(**kwargs)
        _attached_followers.append(self)

    def update(self):
        if not self._active:
            return
        if self._pps > 0:
            import time as _time
            now = _time.time()
            if self._last_time is not None and now - self._last_time < 1.0 / self._pps:
                return
            self._last_time = now
        value = self.fn()
        if isinstance(value, vector):
            self.trail.append(value)

    def stop(self):
        self._active = False

    def start(self):
        self._active = True

    def clear(self):
        self.trail.clear()


def attach_trail(obj, color=None, radius=0, retain=-1, type='curve', pps=0, interval=1):
    """객체 또는 함수에 궤적을 붙인다. 돌려주는 손잡이로 stop()·start()·clear()를 한다.
    attach_trail(ball, color=color.green, retain=100)   # 객체가 움직일 때마다 점을 남긴다
    attach_trail(lambda: ball.pos + vector(0, 1, 0))     # 함수 값이 궤적이 된다 (rate()마다 한 점)
    type='points'면 점 궤적, pps=k면 초당 k점까지만, interval=n이면 n번 움직일 때마다 한 점."""
    if hasattr(obj, 'attach_trail'):
        return obj.attach_trail(color=color, retain=retain, type=type, pps=pps, radius=radius, interval=interval)
    if callable(obj):
        return _FunctionTrail(obj, color=color, radius=radius, retain=retain, type=type, pps=pps)
    raise TypeError("attach_trail의 첫 인자는 3D 객체이거나 벡터를 돌려주는 함수여야 합니다")


class attach_light:
    """attach_light(obj, offset=vector(0,0,0), color=color.white) — 객체를 따라다니는 점광원.
    rate()·sleep()마다 광원 위치를 obj.pos + offset으로 옮긴다. .color·.offset·.visible을 바꿀 수 있다."""
    def __init__(self, obj, offset=None, color=None, intensity=1.0):
        if not hasattr(obj, 'pos'):
            raise TypeError("attach_light의 첫 인자는 pos가 있는 3D 객체여야 합니다")
        self.obj = obj
        self._offset = _coerce_vector(offset, vector(0, 0, 0))
        light_color = _coerce_vector(color, vector(1, 1, 1))
        self.light = local_light(pos=obj.pos + self._offset, color=light_color, intensity=intensity)
        self._visible = True
        self._last = None
        _attached_followers.append(self)

    def update(self):
        if not self._visible:
            return
        pos = self.obj.pos + self._offset
        key = pos.to_list()
        if key == self._last:
            return
        self._last = key
        self.light.pos = pos

    @property
    def offset(self):
        return self._offset

    @offset.setter
    def offset(self, value):
        self._offset = _coerce_vector(value, vector(0, 0, 0))
        self._last = None
        self.update()

    @property
    def color(self):
        return self.light.color

    @color.setter
    def color(self, value):
        self.light.color = _coerce_vector(value, vector(1, 1, 1))

    @property
    def visible(self):
        return self._visible

    @visible.setter
    def visible(self, value):
        self._visible = bool(value)
        _add_command({"action": "update", "id": self.light._id, "visible": self._visible})
        if self._visible:
            self._last = None
            self.update()


# === wtext — 캡션(또는 제목) 영역의 글자 ===
class _Anchor:
    """scene.caption_anchor / scene.title_anchor — wtext와 위젯의 위치 표시"""
    def __init__(self, name):
        self.name = name

    def __repr__(self):
        return f"<scene.{self.name}_anchor>"


_CAPTION_ANCHOR = _Anchor('caption')
_TITLE_ANCHOR = _Anchor('title')


class wtext:
    """캡션 영역에 글자를 표시하고 나중에 바꾼다 — 슬라이더 값 표시에 쓴다.
    w = wtext(text='0.0')
    w.text = f'{s.value:.1f}'
    pos=scene.title_anchor면 제목 영역에 표시한다."""
    def __init__(self, text='', pos=None, **kwargs):
        self._id = _new_id()
        self._text = str(text)
        self._anchor = 'title' if pos is _TITLE_ANCHOR else 'caption'
        _add_command({"action": "wtext_create", "id": self._id, "text": self._text, "anchor": self._anchor})

    @property
    def text(self):
        return self._text

    @text.setter
    def text(self, value):
        self._text = str(value)
        _add_command({"action": "wtext_update", "id": self._id, "text": self._text})

    def delete(self):
        _add_command({"action": "wtext_delete", "id": self._id})


# === shapes / paths — extrusion용 2D 단면과 3D 경로 생성기 (GlowScript shapes_and_paths 호환) ===
_TWO_PI = 2 * math.pi


def _shape_finish(cp, pos=(0, 0), rotate=0, scale=1, xscale=1, yscale=1, roundness=0, invert=False):
    """원점 기준 외곽선 cp([x, y] 목록)를 rotate(라디안)·xscale/yscale로 바꾸고 pos로 옮긴 뒤 roundness를 적용한다."""
    if scale != 1:
        xscale = yscale = scale
    px, py = float(pos[0]), float(pos[1])
    c, s = math.cos(rotate), math.sin(rotate)
    out = []
    for x, y in cp:
        if rotate:
            x, y = x * c - y * s, x * s + y * c
        out.append([x * xscale + px, y * yscale + py])
    if roundness > 0:
        out = _round_corners(out, roundness, invert)
    return out


def _round_corners(cp, roundness, invert=False, nseg=16):
    """각 꼭짓점을 호로 바꾼다. 꼭짓점에서 접점까지의 거리는 가장 짧은 변 길이 × roundness(0~0.5)."""
    closed = len(cp) > 1 and cp[0] == cp[-1]
    pts = cp[:-1] if closed else list(cp)
    n = len(pts)
    if n < 3:
        return cp
    shortest = min(
        math.hypot(pts[(i + 1) % n][0] - pts[i][0], pts[(i + 1) % n][1] - pts[i][1]) for i in range(n)
    )
    r = shortest * min(max(roundness, 0), 0.5)
    if r <= 0:
        return cp
    out = []
    for i in range(n):
        ax, ay = pts[i - 1]
        vx, vy = pts[i]
        bx, by = pts[(i + 1) % n]
        d1 = math.hypot(ax - vx, ay - vy)
        d2 = math.hypot(bx - vx, by - vy)
        if d1 == 0 or d2 == 0:
            out.append([vx, vy])
            continue
        u1 = ((ax - vx) / d1, (ay - vy) / d1)
        u2 = ((bx - vx) / d2, (by - vy) / d2)
        cos_phi = max(-1.0, min(1.0, u1[0] * u2[0] + u1[1] * u2[1]))
        phi = math.acos(cos_phi)
        if phi < 1e-6 or abs(phi - math.pi) < 1e-6:
            out.append([vx, vy])
            continue
        t1 = (vx + u1[0] * r, vy + u1[1] * r)
        t2 = (vx + u2[0] * r, vy + u2[1] * r)
        bx_, by_ = u1[0] + u2[0], u1[1] + u2[1]
        bl = math.hypot(bx_, by_) or 1.0
        dist = r / math.cos(phi / 2)
        cx, cy = vx + bx_ / bl * dist, vy + by_ / bl * dist
        rho = r * math.tan(phi / 2)
        a1 = math.atan2(t1[1] - cy, t1[0] - cx)
        a2 = math.atan2(t2[1] - cy, t2[0] - cx)
        sweep = a2 - a1
        while sweep > math.pi:
            sweep -= _TWO_PI
        while sweep < -math.pi:
            sweep += _TWO_PI
        mx, my = (t1[0] + t2[0]) / 2, (t1[1] + t2[1]) / 2
        chord_len = math.hypot(t2[0] - t1[0], t2[1] - t1[1]) or 1.0
        nx, ny = -(t2[1] - t1[1]) / chord_len, (t2[0] - t1[0]) / chord_len
        for k in range(nseg + 1):
            a = a1 + sweep * k / nseg
            x, y = cx + rho * math.cos(a), cy + rho * math.sin(a)
            if invert:
                # 접점을 잇는 선에 대해 호를 뒤집어 안으로 파인 모서리를 만든다
                dn = (x - mx) * nx + (y - my) * ny
                x, y = x - 2 * dn * nx, y - 2 * dn * ny
            out.append([x, y])
    out.append(list(out[0]))
    return out


def _arc_points(radius, angle1, angle2, np):
    """angle1에서 angle2까지 호 위의 점 — 둘레 전체에 np개 기준"""
    sweep = angle2 - angle1
    segments = max(1, int(round(abs(sweep) / (_TWO_PI / np))))
    return [[radius * math.cos(angle1 + sweep * i / segments), radius * math.sin(angle1 + sweep * i / segments)]
            for i in range(segments + 1)]


def _ngon_points(np, radius, rotate=0):
    return [[radius * math.cos(rotate + _TWO_PI * i / np), radius * math.sin(rotate + _TWO_PI * i / np)] for i in range(np)]


class _Shapes:
    """shapes.* — extrusion 단면용 2D 점 목록 생성기. 닫힌 외곽선은 첫 점을 끝에 한 번 더 둔다.
    공통 인자: pos=[0,0], rotate=0(라디안), scale=1, xscale=1, yscale=1, roundness=0(0~0.5), invert=False.
    thickness를 주면 [바깥 외곽선, 안쪽 구멍]을 돌려준다 (rectangle·circle·ngon·star·trapezoid)."""

    @staticmethod
    def rectangle(pos=(0, 0), width=1, height=None, rotate=0, thickness=0, roundness=0, invert=False,
                  scale=1, xscale=1, yscale=1):
        if height is None:
            height = width
        w, h = width / 2, height / 2
        style = dict(pos=pos, rotate=rotate, scale=scale, xscale=xscale, yscale=yscale, roundness=roundness, invert=invert)
        outer = _shape_finish([[-w, -h], [w, -h], [w, h], [-w, h], [-w, -h]], **style)
        if not thickness:
            return outer
        wall = min(width, height) * thickness
        iw, ih = max(w - wall, 1e-6), max(h - wall, 1e-6)
        inner = _shape_finish([[-iw, -ih], [iw, -ih], [iw, ih], [-iw, ih], [-iw, -ih]], **style)
        return [outer, inner]

    @staticmethod
    def cross(pos=(0, 0), width=1, thickness=0.2, rotate=0, roundness=0, invert=False, scale=1, xscale=1, yscale=1):
        w, t = width / 2, thickness / 2
        cp = [[-t, -w], [t, -w], [t, -t], [w, -t], [w, t], [t, t], [t, w], [-t, w], [-t, t], [-w, t], [-w, -t], [-t, -t], [-t, -w]]
        return _shape_finish(cp, pos=pos, rotate=rotate, scale=scale, xscale=xscale, yscale=yscale, roundness=roundness, invert=invert)

    @staticmethod
    def trapezoid(pos=(0, 0), width=2, height=1, top=None, rotate=0, thickness=0, roundness=0, invert=False,
                  scale=1, xscale=1, yscale=1):
        if top is None:
            top = width / 2
        w, h, t = width / 2, height / 2, top / 2
        style = dict(pos=pos, rotate=rotate, scale=scale, xscale=xscale, yscale=yscale, roundness=roundness, invert=invert)
        outer = _shape_finish([[-w, -h], [w, -h], [t, h], [-t, h], [-w, -h]], **style)
        if not thickness:
            return outer
        wall = min(height, top) * thickness
        inner = _shape_finish([[-(w - wall), -(h - wall)], [w - wall, -(h - wall)], [t - wall, h - wall], [-(t - wall), h - wall], [-(w - wall), -(h - wall)]], **style)
        return [outer, inner]

    @staticmethod
    def circle(pos=(0, 0), radius=0.5, np=64, angle1=0, angle2=_TWO_PI, thickness=0, rotate=0,
               scale=1, xscale=1, yscale=1):
        style = dict(pos=pos, rotate=rotate, scale=scale, xscale=xscale, yscale=yscale)
        full = abs((angle2 - angle1) - _TWO_PI) < 1e-9
        if full:
            outer = _ngon_points(np, radius, angle1)
            outer.append(list(outer[0]))
            if not thickness:
                return _shape_finish(outer, **style)
            inner = _ngon_points(np, radius * (1 - thickness), angle1)
            inner.append(list(inner[0]))
            return [_shape_finish(outer, **style), _shape_finish(inner, **style)]
        arc = _arc_points(radius, angle1, angle2, np)
        if not thickness:
            # 부채꼴 — 중심점을 포함한다
            return _shape_finish([[0, 0]] + arc + [[0, 0]], **style)
        inner = _arc_points(radius * (1 - thickness), angle1, angle2, np)
        inner.reverse()
        return _shape_finish(arc + inner + [list(arc[0])], **style)

    @staticmethod
    def arc(pos=(0, 0), radius=0.5, np=64, angle1=0, angle2=_TWO_PI, thickness=None, rotate=0,
            scale=1, xscale=1, yscale=1, path=False):
        style = dict(pos=pos, rotate=rotate, scale=scale, xscale=xscale, yscale=yscale)
        outer = _arc_points(radius, angle1, angle2, np)
        if path:
            return _shape_finish(outer, **style)   # 열린 경로
        if thickness is None:
            thickness = 0.01 * radius
        inner = _arc_points(max(radius - thickness, 1e-6), angle1, angle2, np)
        inner.reverse()
        return _shape_finish(outer + inner + [list(outer[0])], **style)

    @staticmethod
    def ellipse(pos=(0, 0), width=1, height=None, np=64, thickness=0, angle1=0, angle2=_TWO_PI, rotate=0,
                scale=1, xscale=1, yscale=1):
        if height is None:
            height = width / 2
        return _Shapes.circle(pos=pos, radius=width / 2, np=np, angle1=angle1, angle2=angle2, thickness=thickness,
                              rotate=rotate, scale=scale, xscale=xscale, yscale=yscale * (height / width))

    @staticmethod
    def line(pos=(0, 0), start=(0, 0), end=(0, 1), np=2, thickness=None, rotate=0, scale=1, xscale=1, yscale=1):
        sx, sy = float(start[0]), float(start[1])
        ex, ey = float(end[0]), float(end[1])
        length = math.hypot(ex - sx, ey - sy) or 1.0
        if thickness is None:
            thickness = 0.01 * length
        nx, ny = -(ey - sy) / length * thickness, (ex - sx) / length * thickness
        np = max(2, int(np))
        side = [[sx + (ex - sx) * i / (np - 1), sy + (ey - sy) * i / (np - 1)] for i in range(np)]
        back = [[x + nx, y + ny] for x, y in reversed(side)]
        return _shape_finish(side + back + [list(side[0])], pos=pos, rotate=rotate, scale=scale, xscale=xscale, yscale=yscale)

    @staticmethod
    def ngon(pos=(0, 0), np=3, length=1, radius=None, rotate=0, thickness=0, roundness=0, invert=False,
             scale=1, xscale=1, yscale=1):
        np = int(np)
        if np < 3:
            raise ValueError("ngon의 np는 3 이상이어야 합니다")
        if radius is None:
            radius = length / (2 * math.sin(math.pi / np))
        else:
            length = 2 * radius * math.sin(math.pi / np)
        style = dict(pos=pos, rotate=rotate, scale=scale, xscale=xscale, yscale=yscale, roundness=roundness, invert=invert)
        outer = _ngon_points(np, radius)
        outer.append(list(outer[0]))
        if not thickness:
            return _shape_finish(outer, **style)
        wall = length * thickness
        inner = _ngon_points(np, max(radius - wall / math.cos(math.pi / np), 1e-6))
        inner.append(list(inner[0]))
        return [_shape_finish(outer, **style), _shape_finish(inner, **style)]

    @staticmethod
    def triangle(pos=(0, 0), length=1, radius=None, rotate=0, thickness=0, roundness=0, invert=False, scale=1, xscale=1, yscale=1):
        return _Shapes.ngon(pos=pos, np=3, length=length, radius=radius, rotate=rotate - math.pi / 6, thickness=thickness,
                            roundness=roundness, invert=invert, scale=scale, xscale=xscale, yscale=yscale)

    @staticmethod
    def pentagon(pos=(0, 0), length=1, radius=None, rotate=0, thickness=0, roundness=0, invert=False, scale=1, xscale=1, yscale=1):
        return _Shapes.ngon(pos=pos, np=5, length=length, radius=radius, rotate=rotate + math.pi / 10, thickness=thickness,
                            roundness=roundness, invert=invert, scale=scale, xscale=xscale, yscale=yscale)

    @staticmethod
    def hexagon(pos=(0, 0), length=1, radius=None, rotate=0, thickness=0, roundness=0, invert=False, scale=1, xscale=1, yscale=1):
        return _Shapes.ngon(pos=pos, np=6, length=length, radius=radius, rotate=rotate, thickness=thickness,
                            roundness=roundness, invert=invert, scale=scale, xscale=xscale, yscale=yscale)

    @staticmethod
    def octagon(pos=(0, 0), length=1, radius=None, rotate=0, thickness=0, roundness=0, invert=False, scale=1, xscale=1, yscale=1):
        return _Shapes.ngon(pos=pos, np=8, length=length, radius=radius, rotate=rotate + math.pi / 8, thickness=thickness,
                            roundness=roundness, invert=invert, scale=scale, xscale=xscale, yscale=yscale)

    @staticmethod
    def star(pos=(0, 0), radius=1, n=5, iradius=None, rotate=0, thickness=0, roundness=0, invert=False,
             scale=1, xscale=1, yscale=1):
        n = int(n)
        if iradius is None:
            iradius = radius / 2
        style = dict(pos=pos, rotate=rotate, scale=scale, xscale=xscale, yscale=yscale, roundness=roundness, invert=invert)

        def build(r_out, r_in):
            cp = []
            for i in range(2 * n):
                r = r_out if i % 2 == 0 else r_in
                a = math.pi / 2 + math.pi * i / n
                cp.append([r * math.cos(a), r * math.sin(a)])
            cp.append(list(cp[0]))
            return cp

        outer = _shape_finish(build(radius, iradius), **style)
        if not thickness:
            return outer
        wall = radius * thickness
        inner = _shape_finish(build(max(radius - wall, 1e-6), max(iradius - wall, 1e-6)), **style)
        return [outer, inner]

    @staticmethod
    def points(pos=None, rotate=0, scale=1, xscale=1, yscale=1, roundness=0, invert=False, path=False):
        """직접 준 [x, y] 점 목록을 단면으로. 닫혀 있지 않으면 첫 점을 끝에 더한다 (path=True면 열어 둔다)."""
        cp = _contour_points(pos or [])
        if not cp:
            raise ValueError("shapes.points에는 pos=[[x, y], ...] 점 목록이 필요합니다")
        if not path and cp[0] != cp[-1]:
            cp.append(list(cp[0]))
        ox, oy = cp[0]
        local = [[x - ox, y - oy] for x, y in cp]   # 첫 점을 중심으로 회전·확대
        return _shape_finish(local, pos=(ox, oy), rotate=rotate, scale=scale, xscale=xscale, yscale=yscale, roundness=roundness, invert=invert)

    @staticmethod
    def gear(pos=(0, 0), n=20, radius=1, phi=20, addendum=None, dedendum=None, fradius=None, bevel=0, rotate=0,
             scale=1, xscale=1, yscale=1, res=1):
        """톱니바퀴 단면 (사다리꼴 톱니로 단순화한 모양). n: 톱니 수, radius: 피치 반지름"""
        n = int(n)
        if addendum is None:
            addendum = 0.08 * radius
        if dedendum is None:
            dedendum = 0.1 * radius
        r_tip, r_root = radius + addendum, radius - dedendum
        half_pitch = math.pi / (2 * n)
        spread = math.tan(math.radians(phi))
        h_tip = half_pitch * max(0.3, 1 - spread * addendum / radius * 2.5)
        h_root = min(half_pitch * (1 + spread * dedendum / radius * 2.5), math.pi / n * 0.95)
        cp = []
        for i in range(n):
            theta = _TWO_PI * i / n
            for r, da in ((r_root, -h_root), (radius, -half_pitch), (r_tip, -h_tip), (r_tip, h_tip), (radius, half_pitch), (r_root, h_root)):
                cp.append([r * math.cos(theta + da), r * math.sin(theta + da)])
        cp.append(list(cp[0]))
        return _shape_finish(cp, pos=pos, rotate=rotate, scale=scale, xscale=xscale, yscale=yscale)

    @staticmethod
    def rackgear(pos=(0, 0), n=30, radius=5, length=None, phi=20, addendum=None, dedendum=None, fradius=None,
                 bevel=0.05, depth=1.1, rotate=0, scale=1, xscale=1, yscale=1, res=1):
        """직선 톱니(랙) 단면. 톱니는 y 방향으로 늘어서고 받침판은 -x 쪽에 있다."""
        n = int(n)
        if addendum is None:
            addendum = 0.08 * radius
        if dedendum is None:
            dedendum = 0.1 * radius
        pitch = _TWO_PI * radius / n
        if length is None:
            length = 10 * math.pi
        teeth = max(1, int(length / pitch))
        total = teeth * pitch
        spread = math.tan(math.radians(phi))
        half_tip = max(pitch * 0.05, pitch / 4 - addendum * spread)
        half_root = min(pitch * 0.45, pitch / 4 + dedendum * spread)
        back = -(dedendum + depth)
        cp = [[back, -total / 2], [-dedendum, -total / 2]]
        for i in range(teeth):
            yc = -total / 2 + pitch * (i + 0.5)
            cp += [[-dedendum, yc - half_root], [addendum, yc - half_tip], [addendum, yc + half_tip], [-dedendum, yc + half_root]]
        cp += [[-dedendum, total / 2], [back, total / 2], [back, -total / 2]]
        return _shape_finish(cp, pos=pos, rotate=rotate, scale=scale, xscale=xscale, yscale=yscale)

    @staticmethod
    def text(**kwargs):
        raise NotImplementedError("shapes.text는 VPyLab에서 지원하지 않습니다. 입체 글자는 text(text='...', depth=...) 객체를 사용하세요.")

    def __repr__(self):
        return "<shapes: rectangle, circle, triangle, pentagon, hexagon, octagon, ngon, star, arc, ellipse, cross, trapezoid, line, points, gear, rackgear>"


shapes = _Shapes()


class _Paths:
    """paths.* — extrusion 경로용 3D 점(vector) 목록 생성기. shapes.*와 같은 인자를 받되 pos·up은 vector다.
    기본으로 xz 평면에 놓이며(up=vector(0,1,0)) 2D의 (x, y)가 (x, 0, -y)로 간다. 닫힌 경로는 첫 점을 끝에 반복한다.
    arc와 line만 열린 경로다. 경로에는 구멍이 없으므로 thickness는 받지 않는다."""

    @staticmethod
    def _convert(cp, pos=None, up=None):
        pos = _coerce_vector(pos, vector(0, 0, 0))
        up = _coerce_vector(up, vector(0, 1, 0))
        pts = [vector(x, 0, -y) for x, y in cp]
        y_axis = vector(0, 1, 0)
        if up.mag > 0 and (up.hat - y_axis).mag > 1e-9:
            axis = y_axis.cross(up)
            if axis.mag < 1e-9:
                axis = vector(1, 0, 0)   # up이 정반대 방향이면 x축으로 뒤집는다
            angle = y_axis.diff_angle(up)
            pts = [p.rotate(angle, axis=axis) for p in pts]
        return [p + pos for p in pts]

    @staticmethod
    def _check(kw):
        if kw.get('thickness'):
            raise ValueError("paths.*는 thickness를 받지 않습니다 (경로에는 구멍이 없습니다). 단면 쪽 shapes.*에 주세요.")

    @staticmethod
    def rectangle(pos=None, up=None, **kw):
        _Paths._check(kw)
        return _Paths._convert(_Shapes.rectangle(**kw), pos, up)

    @staticmethod
    def cross(pos=None, up=None, **kw):
        return _Paths._convert(_Shapes.cross(**kw), pos, up)

    @staticmethod
    def trapezoid(pos=None, up=None, **kw):
        _Paths._check(kw)
        return _Paths._convert(_Shapes.trapezoid(**kw), pos, up)

    @staticmethod
    def circle(pos=None, up=None, **kw):
        _Paths._check(kw)
        return _Paths._convert(_Shapes.circle(**kw), pos, up)

    @staticmethod
    def ellipse(pos=None, up=None, **kw):
        _Paths._check(kw)
        return _Paths._convert(_Shapes.ellipse(**kw), pos, up)

    @staticmethod
    def arc(pos=None, up=None, **kw):
        _Paths._check(kw)
        kw['path'] = True
        return _Paths._convert(_Shapes.arc(**kw), pos, up)

    @staticmethod
    def ngon(pos=None, up=None, **kw):
        _Paths._check(kw)
        return _Paths._convert(_Shapes.ngon(**kw), pos, up)

    @staticmethod
    def triangle(pos=None, up=None, **kw):
        _Paths._check(kw)
        return _Paths._convert(_Shapes.triangle(**kw), pos, up)

    @staticmethod
    def pentagon(pos=None, up=None, **kw):
        _Paths._check(kw)
        return _Paths._convert(_Shapes.pentagon(**kw), pos, up)

    @staticmethod
    def hexagon(pos=None, up=None, **kw):
        _Paths._check(kw)
        return _Paths._convert(_Shapes.hexagon(**kw), pos, up)

    @staticmethod
    def octagon(pos=None, up=None, **kw):
        _Paths._check(kw)
        return _Paths._convert(_Shapes.octagon(**kw), pos, up)

    @staticmethod
    def star(pos=None, up=None, **kw):
        _Paths._check(kw)
        return _Paths._convert(_Shapes.star(**kw), pos, up)

    @staticmethod
    def points(pos=None, up=None, **kw):
        """paths.points(pos=[vector, ...]) — 직접 준 점 목록. 닫혀 있지 않으면 첫 점을 끝에 더한다 (path=True면 열어 둔다)."""
        pts = [_as_point(p) for p in (pos or [])]
        if not pts:
            raise ValueError("paths.points에는 pos=[vector, ...] 점 목록이 필요합니다")
        if not kw.get('path') and pts[0] != pts[-1]:
            pts.append(pts[0].clone())
        return pts

    @staticmethod
    def line(start=None, end=None, np=2, **kw):
        """start에서 end까지 np개 점의 직선 경로 (열린 경로)"""
        start = _coerce_vector(start, vector(0, 0, 0))
        end = _coerce_vector(end, vector(0, 0, -0.1))
        np = max(2, int(np))
        return [start + (end - start) * (i / (np - 1)) for i in range(np)]

    def __repr__(self):
        return "<paths: rectangle, circle, arc, line, ellipse, triangle, pentagon, hexagon, octagon, ngon, star, cross, trapezoid, points>"


paths = _Paths()


# === frame 별칭 (compound와 동일) ===
# VPython 구버전 호환 — frame은 사실상 compound와 같은 그룹화
frame = compound


# === 중단 신호 확인 ===
def _check_stop():
    """JS의 shouldStop 플래그를 확인하여 중단 여부 반환"""
    try:
        return js._checkStopSignal()
    except:
        return False


class _StopExecution(Exception):
    """사용자가 실행을 중지했을 때 발생하는 예외"""
    pass


# === rate() 함수 ===
async def rate(fps):
    """
    프레임 레이트 제어 + 커맨드 버퍼 플러시 + 이벤트 디스패치
    rate(100) = 초당 100회 루프, 각 반복 후 커맨드 배치 전송 및 등록된 핸들러 호출
    """
    if _check_stop():
        _send_commands()
        raise _StopExecution("실행이 중지되었습니다")
    # 등록된 이벤트 핸들러 호출 (있을 때만)
    if _event_handlers:
        _process_pending_events()
    if _attached_arrows:
        _update_attached_arrows()
    if _attached_followers:
        _update_attached_followers()
    if _command_buffer:
        _send_commands()  # 누적된 커맨드를 한번에 전송
    else:
        # 커맨드가 없어도 하트비트 전송 (활동 타이머 리셋용)
        js.postMessage(json.dumps({"type": "batch", "runId": _current_run_id(), "commands": []}))
    delay = 1.0 / fps
    await asyncio.sleep(delay)


async def sleep(seconds):
    """비동기 sleep + 이벤트 디스패치"""
    if _check_stop():
        _send_commands()
        raise _StopExecution("실행이 중지되었습니다")
    if _event_handlers:
        _process_pending_events()
    if _attached_arrows:
        _update_attached_arrows()
    if _attached_followers:
        _update_attached_followers()
    if _command_buffer:
        _send_commands()
    else:
        js.postMessage(json.dumps({"type": "batch", "runId": _current_run_id(), "commands": []}))
    await asyncio.sleep(seconds)


# === 씬 제어 ===
def scene_background(c):
    """배경색 변경"""
    _add_command({"action": "scene", "property": "background", "value": c.to_list()})


# === 수학 유틸 ===
def mag(v):
    return v.mag

def mag2(v):
    return v.mag2

def hat(v):
    return v.hat

def dot(a, b):
    return a.dot(b)

def cross(a, b):
    return a.cross(b)

def norm(v):
    return v.hat

def proj(a, b):
    """a를 b 방향으로 투영한 벡터"""
    return a.proj(b)

def comp(a, b):
    """a의 b 방향 스칼라 성분"""
    return a.comp(b)

def diff_angle(a, b):
    """두 벡터 사이의 각 (라디안)"""
    return a.diff_angle(b)

def rotate(obj, angle=0, axis=None, origin=None):
    """벡터면 회전한 새 벡터를 돌려주고, 3D 객체면 그 자리에서 회전시킨다 (GlowScript 함수형)"""
    if isinstance(obj, vector):
        return obj.rotate(angle, axis=axis)
    if origin is None:
        return obj.rotate(angle, axis=axis)
    return obj.rotate(angle, axis=axis, origin=origin)


class _RandomCompat:
    """GlowScript의 random() — 0 이상 1 미만의 난수.
    random.randint(1, 6)처럼 표준 random 모듈의 함수도 그대로 쓸 수 있다."""
    def __call__(self):
        return _random_module.random()

    def __getattr__(self, name):
        return getattr(_random_module, name)

    def __repr__(self):
        return "<random: random()은 0~1 난수, random.randint(a, b) 등도 사용 가능>"


random = _RandomCompat()


def arange(start, stop=None, step=1):
    """start부터 stop 전까지 step 간격의 숫자 목록 (GlowScript 호환)"""
    if stop is None:
        start, stop = 0, start
    if step == 0:
        raise ValueError('arange의 step은 0이 될 수 없습니다')
    count = int(math.ceil((stop - start) / step))
    return [start + i * step for i in range(max(count, 0))]


def clock():
    """프로그램 실행 중 경과 시간(초)"""
    return _time_module.time()


def msclock():
    """프로그램 실행 중 경과 시간(밀리초)"""
    return _time_module.time() * 1000


def sign(x):
    """부호: 양수면 1, 음수면 -1, 0이면 0"""
    return (x > 0) - (x < 0)


def combin(n, k):
    """조합의 수 nCk"""
    return math.comb(int(n), int(k))


def print_options(digits=None, **kwargs):
    """vector 출력 자릿수 지정. 예: print_options(digits=3)"""
    global _print_digits
    if digits is not None:
        _print_digits = max(1, int(digits))


# === 한글 노트 이름 → 영어 변환 ===
_KOREAN_NOTE_MAP = {
    '도': 'C', '레': 'D', '미': 'E', '파': 'F',
    '솔': 'G', '라': 'A', '시': 'B',
    '도#': 'C#', '레#': 'D#', '파#': 'F#', '솔#': 'G#', '라#': 'A#',
    '레b': 'Db', '미b': 'Eb', '솔b': 'Gb', '라b': 'Ab', '시b': 'Bb',
}

def _resolve_note_name(name):
    """한글 또는 영어 노트 이름을 영어로 통일
    옥타브 번호가 없으면 기본 4(가운데 옥타브)를 자동 추가
    예: "도" → "C4", "솔#" → "G#4", "C" → "C4"
    """
    if not name:
        return name

    # 한글 → 영어 변환
    for kr in sorted(_KOREAN_NOTE_MAP, key=len, reverse=True):
        en = _KOREAN_NOTE_MAP[kr]
        if name.startswith(kr):
            rest = name[len(kr):]
            # 옥타브 번호가 없으면 기본 4
            if not rest or not rest[0].isdigit():
                rest = '4' + rest
            return en + rest

    # 영어 노트도 옥타브 없으면 기본 4 추가
    # "C" → "C4", "F#" → "F#4", "Bb" → "Bb4"
    if len(name) == 1 and name[0] in 'ABCDEFG':
        return name + '4'
    if len(name) == 2 and name[0] in 'ABCDEFG' and name[1] in '#b':
        return name + '4'

    return name


# === 사운드 API ===

def play_sound(frequency=440, duration=0.3, type='sine', volume=0.3):
    """
    기본 비프음 재생
    frequency: 주파수 (Hz)
    duration: 길이 (초)
    type: 파형 ('sine', 'square', 'sawtooth', 'triangle')
    volume: 볼륨 (0~1)
    """
    _add_command({
        "action": "sound",
        "method": "beep",
        "frequency": frequency,
        "duration": duration,
        "type": type,
        "volume": volume,
    })


def play_note(name, duration=0.5, type='sine', volume=0.4):
    """
    노트 이름으로 재생 (예: 'C4', 'F#5', 'Bb3', '도4', '솔#5')
    한글 노트 이름도 지원합니다.
    """
    resolved = _resolve_note_name(name)
    _add_command({
        "action": "sound",
        "method": "note",
        "name": resolved,
        "duration": duration,
        "type": type,
        "volume": volume,
    })


def _note_frequency(name):
    """음 이름을 숫자 주파수로 바꾸어 실행 화면과 HTML 내보내기에서 함께 사용합니다."""
    match = re.fullmatch(r'([A-G])([#b]?)(-?\d+)', _resolve_note_name(name))
    if not match:
        raise ValueError(f'음 이름을 확인해주세요: {name}')
    letter, accidental, octave = match.groups()
    pitch = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}[letter]
    pitch += 1 if accidental == '#' else -1 if accidental == 'b' else 0
    return 440 * 2 ** (((int(octave) - 4) * 12 + pitch - 9) / 12)


def play_chord(frequencies, duration=1.0, type='sine', volume=0.25):
    """
    여러 주파수를 동시에 재생 (화음)
    frequencies: 주파수 또는 음 이름 리스트 [261.63, '미4', 'G4']
    """
    _add_command({
        "action": "sound",
        "method": "chord",
        "frequencies": [_note_frequency(value) if isinstance(value, str) else value for value in frequencies],
        "duration": duration,
        "type": type,
        "volume": volume,
    })


def play_sequence(notes):
    """
    노트 배열을 순차적으로 재생
    notes: [{"freq": 261.63, "duration": 0.3}, ...]
    """
    note_list = []
    for n in notes:
        item = {"freq": n.get("freq", 440), "duration": n.get("duration", 0.3)}
        if "type" in n:
            item["type"] = n["type"]
        if "volume" in n:
            item["volume"] = n["volume"]
        note_list.append(item)
    _add_command({
        "action": "sound",
        "method": "sequence",
        "notes": note_list,
    })


def play_sfx(name):
    """
    이름으로 게임 효과음 재생
    사용 가능: jump, coin, powerup, death, fireball, pipe, 1up,
               select, warning, explosion, laser, success, error, levelup
    """
    _add_command({
        "action": "sound",
        "method": "sfx",
        "name": name,
    })


def start_bgm(name, loop=True):
    """
    배경음악 시작
    사용 가능: adventure, explore, battle, peaceful, victory
    """
    _add_command({
        "action": "sound",
        "method": "bgm_start",
        "name": name,
        "loop": loop,
    })


def stop_bgm():
    """배경음악 정지"""
    _add_command({
        "action": "sound",
        "method": "bgm_stop",
    })


# 음표 주파수 상수 (자주 쓰는 노트)
class note:
    """음표 주파수 상수"""
    C3 = 130.81; D3 = 146.83; E3 = 164.81; F3 = 174.61; G3 = 196.00; A3 = 220.00; B3 = 246.94
    C4 = 261.63; D4 = 293.66; E4 = 329.63; F4 = 349.23; G4 = 392.00; A4 = 440.00; B4 = 493.88
    C5 = 523.25; D5 = 587.33; E5 = 659.25; F5 = 698.46; G5 = 783.99; A5 = 880.00; B5 = 987.77
    C6 = 1046.50


# === 3D 차트 API ===

def scatter3d(points, y=None, z=None, colors=None, size=0.08, colormap='rainbow', opacity=0.9, show_axes=True, color=None):
    """3D 산점도 — 미디어아트 스타일
    points: [[x,y,z], ...] 또는 numpy array. scatter3d(x목록, y목록, z목록)처럼 좌표 목록 세 개로도 부를 수 있다
    colors: [[r,g,b], ...] (선택) — 없으면 z값 기반 컬러맵
    color: 점 전체에 적용할 색 하나 (선택)
    """
    if y is not None and z is not None:
        points = list(zip(points, y, z))
    pts = [list(p) for p in points]  # numpy array → list 변환
    if colors is None and color is not None:
        colors = [color] * len(pts)
    cols = [c.to_list() if isinstance(c, vector) else list(c) for c in colors] if colors else None  # vector도 받는다
    _add_command({
        "action": "chart",
        "chart_type": "scatter3d",
        "points": pts,
        "colors": cols,
        "size": size,
        "colormap": colormap,
        "opacity": opacity,
        "show_axes": show_axes,
    })
    _send_commands()


def surface3d(z_data, x_range=None, y_range=None, colormap='viridis', wireframe=True, opacity=0.85, show_axes=True):
    """3D 표면 그래프 — Plotly 스타일
    z_data: 2D 리스트 [[z00, z01, ...], ...]
    """
    z = [list(row) for row in z_data]  # numpy array → list
    _add_command({
        "action": "chart",
        "chart_type": "surface3d",
        "z_data": z,
        "x_range": list(x_range) if x_range else [-5, 5],
        "y_range": list(y_range) if y_range else [-5, 5],
        "colormap": colormap,
        "wireframe": wireframe,
        "opacity": opacity,
        "show_axes": show_axes,
    })
    _send_commands()


def line3d(points, color=None, width=0.03, show_axes=True):
    """3D 선 그래프 — 글로우 효과
    points: [[x,y,z], ...]
    """
    pts = [list(p) for p in points]
    _add_command({
        "action": "chart",
        "chart_type": "line3d",
        "points": pts,
        "color": color.to_list() if hasattr(color, 'to_list') else color,
        "width": width,
        "show_axes": show_axes,
    })
    _send_commands()


def bar3d(values, labels=None, colors=None, colormap='plasma', bar_width=0.6, show_axes=True):
    """3D 막대 그래프
    values: [v1, v2, v3, ...]
    """
    _add_command({
        "action": "chart",
        "chart_type": "bar3d",
        "values": list(values),
        "labels": list(labels) if labels else None,
        "colors": [c.to_list() if isinstance(c, vector) else list(c) for c in colors] if colors else None,
        "colormap": colormap,
        "bar_width": bar_width,
        "show_axes": show_axes,
    })
    _send_commands()


# 한글 별칭
산점도 = scatter3d
표면그래프 = surface3d
선그래프 = line3d
막대그래프 = bar3d


# === 짧은 별칭 (Short Aliases) ===
# 기존 함수를 유지하면서 학생 친화적인 짧은 이름 제공

def sound(frequency=440, duration=0.3, type='sine', volume=0.3):
    """play_sound()의 짧은 별칭 — 소리 재생"""
    play_sound(frequency, duration, type, volume)

def sfx(name):
    """play_sfx()의 짧은 별칭 — 게임 효과음 재생"""
    play_sfx(name)

def bgm(name, loop=True):
    """start_bgm()의 짧은 별칭 — 배경음악 시작"""
    start_bgm(name, loop)

def chord(frequencies, duration=1.0, type='sine', volume=0.25):
    """play_chord()의 짧은 별칭 — 화음 재생"""
    play_chord(frequencies, duration, type, volume)


def 소리(frequency=440, duration=0.3, type='sine', volume=0.3):
    """sound()의 한글 별칭"""
    play_sound(frequency, duration, type, volume)

def 음표(name, duration=0.5, type='sine', volume=0.4):
    """play_note()의 한글 별칭 — 한글 노트 이름 지원 + 자동 순차 대기.
    예: 음표("도4", 0.4), 음표("솔#5", 0.3)
    동기 함수이지만 duration 만큼 워커를 block 시켜 학생이 sleep을 명시하지 않아도
    음이 분리되어 들립니다. 50ms 단위로 stop 체크/이벤트 디스패치하여
    실행 중지·인터랙션도 즉시 반응합니다.
    """
    import time as _time  # Pyodide 표준 모듈
    play_note(_resolve_note_name(name), duration, type, volume)
    _send_commands()
    end = _time.time() + duration
    while _time.time() < end:
        if _check_stop():
            raise _StopExecution("실행이 중지되었습니다")
        if _event_handlers:
            _process_pending_events()
        _time.sleep(min(0.05, max(0.0, end - _time.time())))

def 효과음(name):
    """play_sfx()의 한글 별칭"""
    play_sfx(name)

def 배경음악(name, loop=True):
    """start_bgm()의 한글 별칭"""
    start_bgm(name, loop)

def 배경음악정지():
    """stop_bgm()의 한글 별칭"""
    stop_bgm()

def 화음(frequencies, duration=1.0, type='sine', volume=0.25):
    """play_chord()의 한글 별칭 — 동시 발음 + 자동 순차 대기.
    음표와 동일하게 duration 만큼 워커를 block시켜 다음 화음과 자연스럽게 분리됩니다.
    """
    import time as _time
    play_chord(frequencies, duration, type, volume)
    _send_commands()
    end = _time.time() + duration
    while _time.time() < end:
        if _check_stop():
            raise _StopExecution("실행이 중지되었습니다")
        if _event_handlers:
            _process_pending_events()
        _time.sleep(min(0.05, max(0.0, end - _time.time())))


# ===================================================================
# 기본 리스트 — 학생이 바로 불러서 사용
# ===================================================================

# ===================================================================
# NamedList — 인덱스 [0]과 이름 ['도'] 모두 가능한 리스트
# ===================================================================

class NamedList(list):
    """인덱스와 이름 모두로 접근 가능한 리스트
    예: 음계[0], 음계['도'], 무지개['빨']
    """
    def __init__(self, items, name_map=None):
        super().__init__(items)
        self._name_map = name_map or {}

    def __getitem__(self, key):
        if isinstance(key, str):
            if key in self._name_map:
                return super().__getitem__(self._name_map[key])
            raise KeyError(f"'{key}' 이름을 찾을 수 없습니다. 사용 가능: {list(self._name_map.keys())}")
        return super().__getitem__(key)


# 기본 음계 (가운데 옥타브, C4~C5)
_scale_names = {'도': 0, '레': 1, '미': 2, '파': 3, '솔': 4, '라': 5, '시': 6, '높은도': 7,
                'C': 0, 'D': 1, 'E': 2, 'F': 3, 'G': 4, 'A': 5, 'B': 6}
음계 = NamedList([note.C4, note.D4, note.E4, note.F4, note.G4, note.A4, note.B4, note.C5], _scale_names)
scale = 음계

# 높은 음계 (C5~C6)
높은음계 = NamedList([note.C5, note.D5, note.E5, note.F5, note.G5, note.A5, note.B5, note.C6], _scale_names)
high_scale = 높은음계

# 낮은 음계 (C3~C4)
낮은음계 = NamedList([note.C3, note.D3, note.E3, note.F3, note.G3, note.A3, note.B3, note.C4], _scale_names)
low_scale = 낮은음계

# 기본 색깔 (무지개 7색)
_rainbow_names = {'빨': 0, '빨강': 0, '주': 1, '주황': 1, '노': 2, '노랑': 2,
                  '초': 3, '초록': 3, '하늘': 4, '청': 4, '파': 5, '파랑': 5,
                  '보': 6, '보라': 6,
                  'red': 0, 'orange': 1, 'yellow': 2, 'green': 3, 'cyan': 4, 'blue': 5, 'purple': 6}
무지개 = NamedList([color.red, color.orange, color.yellow, color.green, color.cyan, color.blue, color.purple], _rainbow_names)
rainbow = 무지개

# 따뜻한 색
따뜻한색 = NamedList([color.red, color.orange, color.yellow], {'빨': 0, '주': 1, '노': 2})
warm_colors = 따뜻한색

# 차가운 색
차가운색 = NamedList([color.cyan, color.blue, color.purple], {'하늘': 0, '파': 1, '보': 2})
cool_colors = 차가운색

# 기본 색 (흰검빨녹파)
기본색 = NamedList(
    [color.white, color.black, color.red, color.green, color.blue],
    {'흰': 0, '흰색': 0, '검': 1, '검정': 1, '빨': 2, '빨강': 2, '초': 3, '초록': 3, '파': 4, '파랑': 4,
     'white': 0, 'black': 1, 'red': 2, 'green': 3, 'blue': 4}
)
basic_colors = 기본색

# 파스텔 색
파스텔 = NamedList([
    vector(1, 0.7, 0.7),    # 파스텔 핑크
    vector(1, 0.85, 0.7),   # 파스텔 오렌지
    vector(1, 1, 0.7),      # 파스텔 노랑
    vector(0.7, 1, 0.7),    # 파스텔 초록
    vector(0.7, 0.9, 1),    # 파스텔 하늘
    vector(0.8, 0.7, 1),    # 파스텔 보라
    vector(1, 0.7, 0.9),    # 파스텔 자홍
], {'핑크': 0, '주황': 1, '노랑': 2, '초록': 3, '하늘': 4, '보라': 5, '자홍': 6})
pastel_colors = 파스텔


# ===================================================================
# 악기 음색 시스템
# ===================================================================

# 악기별 파형 + 볼륨 프리셋
_INSTRUMENT_PRESETS = {
    'piano': {'type': 'triangle', 'volume': 0.35},
    'organ': {'type': 'sine', 'volume': 0.3},
    'guitar': {'type': 'sawtooth', 'volume': 0.2},
    'flute': {'type': 'sine', 'volume': 0.25},
    'trumpet': {'type': 'square', 'volume': 0.2},
    'bass': {'type': 'triangle', 'volume': 0.4},
    'chiptune': {'type': 'square', 'volume': 0.15},
    'synth': {'type': 'sawtooth', 'volume': 0.25},
}

# 한글 악기 이름 매핑
_INSTRUMENT_KR = {
    '피아노': 'piano',
    '오르간': 'organ',
    '기타': 'guitar',
    '플루트': 'flute',
    '트럼펫': 'trumpet',
    '베이스': 'bass',
    '칩튠': 'chiptune',
    '신스': 'synth',
}

def _resolve_instrument(name):
    """악기 이름 → 프리셋 반환"""
    if not name:
        return _INSTRUMENT_PRESETS['piano']
    resolved = _INSTRUMENT_KR.get(name, name).lower()
    return _INSTRUMENT_PRESETS.get(resolved, _INSTRUMENT_PRESETS['piano'])

def play_instrument(instrument, name, duration=0.5, volume=None):
    """
    악기를 지정하여 노트 재생
    instrument: 'piano', 'guitar', 'trumpet', 'flute', 'chiptune' 등
               한글도 가능: '피아노', '기타', '트럼펫'
    name: 노트 이름 ('도', 'C4', '솔#5' 등)
    """
    preset = _resolve_instrument(instrument)
    vol = volume if volume is not None else preset['volume']
    resolved = _resolve_note_name(name)
    _add_command({
        "action": "sound",
        "method": "note",
        "name": resolved,
        "duration": duration,
        "type": preset['type'],
        "volume": vol,
    })

async def 악기(instrument, name, duration=0.5, volume=None):
    """play_instrument()의 한글 별칭 + 자동 대기
    예: 악기("피아노", "도"), 악기("기타", "솔4", 0.8)
    """
    play_instrument(instrument, name, duration, volume)
    _send_commands()
    await asyncio.sleep(duration)


def _reset_runtime_state():
    """새 코드 실행 전 Python 측 런타임 상태를 정리"""
    global _command_buffer, _object_counter
    _command_buffer = []
    _object_counter = 0
    _active_graphs.clear()
    _event_handlers.clear()
    _widget_values.clear()
    _attached_arrows.clear()
    _user_lights.clear()
    _scene_objects.clear()
    _attached_followers.clear()
    _notices_shown.clear()
    global _canvas_calls
    _canvas_calls = 0
    scene._reset()

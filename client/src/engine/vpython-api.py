"""
VPyLab — Python 측 VPython API
Pyodide Web Worker 내에서 실행됨.
Three.js 메인 스레드로 JSON 커맨드를 전송하는 방식.

커맨드 배칭: rate() 호출 시 누적된 커맨드를 한번에 전송
"""

import js
import json
import asyncio
from typing import Optional

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
            "commands": _command_buffer
        }))
        _command_buffer = []


def _add_command(cmd):
    """커맨드를 버퍼에 추가"""
    _command_buffer.append(cmd)


def _new_id():
    global _object_counter
    _object_counter += 1
    return f"obj_{_object_counter}"


# === vector 클래스 ===
class vector:
    def __init__(self, x=0, y=0, z=0):
        self.x = float(x)
        self.y = float(y)
        self.z = float(z)

    def __repr__(self):
        return f"<{self.x:.4g}, {self.y:.4g}, {self.z:.4g}>"

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

# vec() — vector()의 단축 별칭
vec = vector


# === 색상 팔레트 (30색) ===
# color.red, color['빨'], 색상['빨강'] 모두 가능

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
    gray      = vector(0.5, 0.5, 0.5)
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


# === 3D 객체 베이스 클래스 ===
class _GObject:
    def __init__(self, obj_type, **kwargs):
        self._id = _new_id()
        self._type = obj_type
        self._make_trail = kwargs.pop('make_trail', False)
        self._trail_color = kwargs.pop('trail_color', None)
        self._pos = kwargs.get('pos', vector(0, 0, 0))
        self._color = kwargs.get('color', color.white)
        self._visible = kwargs.get('visible', True)
        self._opacity = kwargs.get('opacity', 1.0)
        self._emissive = kwargs.get('emissive', False)
        self._velocity = kwargs.get('velocity', vector(0, 0, 0))

        # 객체 생성 커맨드
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
            **{k: v for k, v in kwargs.items()
               if k not in ('pos', 'color', 'visible', 'opacity', 'velocity')
               and isinstance(v, (int, float, bool, str))},
            **{k: v.to_list() for k, v in kwargs.items()
               if k not in ('pos', 'color', 'visible', 'opacity', 'velocity')
               and isinstance(v, vector)},
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

    # === 공통 메서드 ===
    def _clone_kwargs(self):
        """clone() 시 사용할 현재 속성 dict — 서브클래스에서 확장"""
        return {
            'pos': self._pos.clone() if isinstance(self._pos, vector) else self._pos,
            'color': self._color.clone() if isinstance(self._color, vector) else self._color,
            'visible': self._visible,
            'opacity': self._opacity,
            'emissive': self._emissive,
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
        if axis is None:
            axis = vector(0, 1, 0)
        if origin is None:
            origin = self._pos
        # pos 회전 (origin 기준 상대 위치를 회전)
        rel = self._pos - origin
        new_rel = rel.rotate(angle, axis=axis)
        self.pos = origin + new_rel
        # axis 속성 보유 시 함께 회전
        if hasattr(self, '_axis') and isinstance(self._axis, vector):
            self.axis = self._axis.rotate(angle, axis=axis)

    def clear_trail(self):
        """누적된 궤적(trail)을 모두 지움"""
        _add_command({"action": "trail_clear", "id": self._id})

    def attach_trail(self, color=None, retain=10000):
        """객체에 궤적을 부착 (이미 있으면 색상/길이만 갱신)"""
        self._make_trail = True
        if color is not None:
            self._trail_color = color
        _add_command({
            "action": "trail_attach",
            "id": self._id,
            "trail_color": color.to_list() if isinstance(color, vector) else None,
            "pos": self._pos.to_list(),
            "retain": int(retain),
        })


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

    def _clone_kwargs(self):
        return {**super()._clone_kwargs(), 'radius': self._radius}


class box(_GObject):
    def __init__(self, **kwargs):
        self._size = kwargs.pop('size', vector(1, 1, 1))
        super().__init__('box', size=self._size.to_list() if isinstance(self._size, vector) else self._size, **kwargs)

    @property
    def size(self):
        return self._size

    @size.setter
    def size(self, value):
        self._size = value
        s = value.to_list() if isinstance(value, vector) else value
        _add_command({"action": "update", "id": self._id, "size": s})

    def _clone_kwargs(self):
        s = self._size
        size = s.clone() if isinstance(s, vector) else list(s) if hasattr(s, '__iter__') else s
        return {**super()._clone_kwargs(), 'size': size}


class cylinder(_GObject):
    def __init__(self, **kwargs):
        self._radius = kwargs.pop('radius', 1.0)
        self._axis = kwargs.pop('axis', vector(1, 0, 0))
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


class arrow(_GObject):
    def __init__(self, **kwargs):
        self._axis = kwargs.pop('axis', vector(1, 0, 0))
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


class cone(_GObject):
    def __init__(self, **kwargs):
        self._radius = kwargs.pop('radius', 1.0)
        self._axis = kwargs.pop('axis', vector(1, 0, 0))
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
    """타원체 — sphere를 size로 비균등 스케일링"""
    def __init__(self, **kwargs):
        self._size = kwargs.pop('size', vector(1, 1, 1))
        s = self._size.to_list() if isinstance(self._size, vector) else list(self._size)
        super().__init__('ellipsoid', size=s, **kwargs)

    @property
    def size(self):
        return self._size

    @size.setter
    def size(self, value):
        self._size = value
        s = value.to_list() if isinstance(value, vector) else list(value)
        _add_command({"action": "update", "id": self._id, "size": s})

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
        _add_command({"action": "update", "id": self._id, "axis": value.to_list()})

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


# 영어 별칭: text() = label()
text = label


# === 새 프리미티브: curve (선분 누적 곡선) ===
class curve:
    """3D 폴리라인 — 점을 누적해 선을 그림.
    c = curve(color=color.red); c.append(pos)"""
    def __init__(self, **kwargs):
        self._id = _new_id()
        self._color = kwargs.get('color', color.white)
        self._radius = float(kwargs.get('radius', 0))  # 0이면 기본 LineBasic, >0이면 굵은 선
        self._visible = kwargs.get('visible', True)
        self._points = []  # [vector, ...]

        # 초기 points 인자 지원
        initial = kwargs.get('pos', None)
        if initial is not None:
            if isinstance(initial, vector):
                self._points.append(initial.clone())
            else:
                for p in initial:
                    self._points.append(p.clone() if isinstance(p, vector) else vector(*p))

        _add_command({
            "action": "create",
            "id": self._id,
            "type": "curve",
            "color": self._color.to_list(),
            "radius": self._radius,
            "visible": self._visible,
            "points": [p.to_list() for p in self._points],
        })

    def append(self, pos):
        """점을 추가"""
        v = pos.clone() if isinstance(pos, vector) else vector(*pos)
        self._points.append(v)
        _add_command({
            "action": "curve_append",
            "id": self._id,
            "pos": v.to_list(),
        })

    def clear(self):
        """모든 점 지우기"""
        self._points = []
        _add_command({"action": "curve_clear", "id": self._id})

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

    def __len__(self):
        return len(self._points)


# === 새 프리미티브: points (점 집합) ===
class points:
    """3D 점들의 집합 — 작은 점 또는 구로 표시"""
    def __init__(self, **kwargs):
        self._id = _new_id()
        self._color = kwargs.get('color', color.white)
        self._size = float(kwargs.get('size', 5))  # 픽셀 단위
        self._visible = kwargs.get('visible', True)
        self._points = []

        initial = kwargs.get('pos', None)
        if initial is not None:
            if isinstance(initial, vector):
                self._points.append(initial.clone())
            else:
                for p in initial:
                    self._points.append(p.clone() if isinstance(p, vector) else vector(*p))

        _add_command({
            "action": "create",
            "id": self._id,
            "type": "points",
            "color": self._color.to_list(),
            "size": self._size,
            "visible": self._visible,
            "points": [p.to_list() for p in self._points],
        })

    def append(self, pos):
        v = pos.clone() if isinstance(pos, vector) else vector(*pos)
        self._points.append(v)
        _add_command({
            "action": "curve_append",  # 동일한 메커니즘 재사용
            "id": self._id,
            "pos": v.to_list(),
        })

    def clear(self):
        self._points = []
        _add_command({"action": "curve_clear", "id": self._id})

    @property
    def visible(self):
        return self._visible

    @visible.setter
    def visible(self, value):
        self._visible = value
        _add_command({"action": "update", "id": self._id, "visible": value})

    def __len__(self):
        return len(self._points)


# === compound (복합 객체) ===
class compound:
    """여러 객체를 하나로 묶기"""
    def __init__(self, objects, **kwargs):
        self._id = _new_id()
        self._objects = list(objects)
        self._pos = kwargs.get('pos', vector(0, 0, 0))
        self._color = kwargs.get('color', None)
        self._visible = kwargs.get('visible', True)
        self._opacity = kwargs.get('opacity', 1.0)
        self._make_trail = kwargs.pop('make_trail', False)
        self._trail_color = kwargs.pop('trail_color', None)

        # 하위 객체 ID 수집
        sub_ids = [obj._id for obj in self._objects]

        _add_command({
            "action": "compound",
            "id": self._id,
            "sub_ids": sub_ids,
            "pos": self._pos.to_list(),
            "color": self._color.to_list() if self._color else None,
            "visible": self._visible,
            "opacity": self._opacity,
            "make_trail": self._make_trail,
            "trail_color": self._trail_color.to_list() if self._trail_color else None,
        })

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
        self._pos = value
        _add_command({"action": "update", "id": self._id, "pos": value.to_list()})
        if self._make_trail:
            _add_command({"action": "trail_update", "id": self._id, "pos": value.to_list()})

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


# === 조명 객체 ===
class local_light:
    """점광원 — 특정 위치에서 모든 방향으로 빛을 발산"""
    def __init__(self, **kwargs):
        self._id = _new_id()
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


class distant_light:
    """평행광 — 특정 방향에서 무한히 먼 곳으로부터 오는 빛"""
    def __init__(self, **kwargs):
        self._id = _new_id()
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


class extrusion:
    """2D 단면을 path를 따라 압출(스윕). VPython 호환 단순화 버전.
    - path: [vector, ...] 또는 평면 좌표 리스트
    - shape: [(x, y), ...] 2D 단면 외곽선 (또는 vector 리스트)
    """
    def __init__(self, path=None, shape=None, color=None, **kwargs):
        self._id = _new_id()
        self._color = color if color is not None else vector(1, 1, 1)
        self._visible = kwargs.get('visible', True)
        self._opacity = float(kwargs.get('opacity', 1.0))
        # path 정규화
        path = path or []
        path_pts = []
        for p in path:
            if isinstance(p, vector):
                path_pts.append(p.to_list())
            else:
                path_pts.append(list(p))
        # shape 정규화 — (x, y) 튜플 또는 vector
        shape = shape or [(-0.5, -0.5), (0.5, -0.5), (0.5, 0.5), (-0.5, 0.5)]
        shape_pts = []
        for s in shape:
            if isinstance(s, vector):
                shape_pts.append([s.x, s.y])
            else:
                shape_pts.append(list(s)[:2])

        _add_command({
            "action": "create",
            "id": self._id,
            "type": "extrusion",
            "path": path_pts,
            "shape": shape_pts,
            "color": self._color.to_list(),
            "visible": self._visible,
            "opacity": self._opacity,
        })

    @property
    def visible(self):
        return self._visible

    @visible.setter
    def visible(self, value):
        self._visible = value
        _add_command({"action": "update", "id": self._id, "visible": value})


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
                g = next(iter(_active_graphs.values()))
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

    def __init__(self, min=0, max=1, step=0.01, value=None, length=200, **kwargs):
        self._min = float(min)
        self._max = float(max)
        self._step = float(step)
        self._value = float(value) if value is not None else self._min
        self._length = int(length)
        super().__init__(value=self._value, **kwargs)
        self._emit_create({
            "min": self._min, "max": self._max, "step": self._step,
            "value": self._value, "length": self._length,
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


class winput(_Widget):
    """텍스트/숫자 입력 — Enter 키 또는 blur 시 bind 호출"""
    _kind = 'winput'

    def __init__(self, prompt='', type='numeric', **kwargs):
        self._prompt = str(prompt)
        self._type = str(type)
        super().__init__(**kwargs)
        self._emit_create({"prompt": self._prompt, "input_type": self._type})


# === scene 객체 (카메라/배경 제어) ===
class _Scene:
    """씬 전역 제어 — VPython의 scene과 유사
    scene.background = color.black
    scene.range = 5         # 카메라 시야 반경
    scene.center = vector(0,0,0)
    scene.autoscale = True/False
    scene.title = "..."     # (현재는 print로 대체)
    """
    def __init__(self):
        self._background = vector(0.97, 0.98, 0.98)
        self._range = None
        self._center = vector(0, 0, 0)
        self._autoscale = True
        self._title = ''
        self._caption = ''

    @property
    def background(self):
        return self._background

    @background.setter
    def background(self, value):
        self._background = value
        _add_command({"action": "scene", "property": "background", "value": value.to_list()})

    @property
    def range(self):
        return self._range

    @range.setter
    def range(self, value):
        self._range = float(value)
        _add_command({"action": "scene", "property": "range", "value": self._range})

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
        # 콘솔 출력으로 대체 (DOM 오버레이는 Tier 3에서)
        print(f"[scene.title] {self._title}")

    @property
    def caption(self):
        return self._caption

    @caption.setter
    def caption(self, value):
        self._caption = str(value)
        print(f"[scene.caption] {self._caption}")

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
    if _command_buffer:
        _send_commands()  # 누적된 커맨드를 한번에 전송
    else:
        # 커맨드가 없어도 하트비트 전송 (활동 타이머 리셋용)
        js.postMessage(json.dumps({"type": "batch", "commands": []}))
    delay = 1.0 / fps
    await asyncio.sleep(delay)


async def sleep(seconds):
    """비동기 sleep + 이벤트 디스패치"""
    if _check_stop():
        _send_commands()
        raise _StopExecution("실행이 중지되었습니다")
    if _event_handlers:
        _process_pending_events()
    if _command_buffer:
        _send_commands()
    else:
        js.postMessage(json.dumps({"type": "batch", "commands": []}))
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
    for kr, en in _KOREAN_NOTE_MAP.items():
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


def play_chord(frequencies, duration=1.0, type='sine', volume=0.25):
    """
    여러 주파수를 동시에 재생 (화음)
    frequencies: 주파수 리스트 [261.63, 329.63, 392]
    """
    _add_command({
        "action": "sound",
        "method": "chord",
        "frequencies": list(frequencies),
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

def scatter3d(points, colors=None, size=0.08, colormap='rainbow', opacity=0.9, show_axes=True):
    """3D 산점도 — 미디어아트 스타일
    points: [[x,y,z], ...] 또는 numpy array
    colors: [[r,g,b], ...] (선택) — 없으면 z값 기반 컬러맵
    """
    pts = [list(p) for p in points]  # numpy array → list 변환
    cols = [list(c) for c in colors] if colors else None
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
        "colors": [list(c) for c in colors] if colors else None,
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

async def 음표(name, duration=0.5, type='sine', volume=0.4):
    """play_note()의 한글 별칭 — 한글 노트 이름 지원 + 자동 대기
    예: 음표("도4", 0.4), 음표("솔#5", 0.3)
    소리 재생 후 duration만큼 자동으로 대기하여 순차 재생됩니다.
    """
    play_note(_resolve_note_name(name), duration, type, volume)
    _send_commands()
    await asyncio.sleep(duration)

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
    """play_chord()의 한글 별칭"""
    play_chord(frequencies, duration, type, volume)


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

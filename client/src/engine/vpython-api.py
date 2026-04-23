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


# === 구체적 3D 객체 ===
class sphere(_GObject):
    def __init__(self, **kwargs):
        self._radius = kwargs.pop('radius', 0.5)
        super().__init__('sphere', radius=self._radius, **kwargs)

    @property
    def radius(self):
        return self._radius

    @radius.setter
    def radius(self, value):
        self._radius = value
        _add_command({"action": "update", "id": self._id, "radius": value})


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


class cylinder(_GObject):
    def __init__(self, **kwargs):
        self._radius = kwargs.pop('radius', 0.5)
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


class cone(_GObject):
    def __init__(self, **kwargs):
        self._radius = kwargs.pop('radius', 0.5)
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
    프레임 레이트 제어 + 커맨드 버퍼 플러시
    rate(100) = 초당 100회 루프, 각 반복 후 커맨드 배치 전송
    """
    if _check_stop():
        _send_commands()
        raise _StopExecution("실행이 중지되었습니다")
    if _command_buffer:
        _send_commands()  # 누적된 커맨드를 한번에 전송
    else:
        # 커맨드가 없어도 하트비트 전송 (활동 타이머 리셋용)
        js.postMessage(json.dumps({"type": "batch", "commands": []}))
    delay = 1.0 / fps
    await asyncio.sleep(delay)


async def sleep(seconds):
    """비동기 sleep"""
    if _check_stop():
        _send_commands()
        raise _StopExecution("실행이 중지되었습니다")
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

"""실제 VPyLab Python API와 학생 프로젝트의 자료·입력·한 프레임을 검증합니다.

브라우저 렌더링·실제 청취 검증을 대체하지 않는 로컬 계약 점검입니다.
"""
import ast
import contextlib
import io
import json
import math
from pathlib import Path
import runpy
import sys
import types

folder = Path(__file__).resolve().parent
project = folder.parents[2]
messages = []
sys.modules['js'] = types.SimpleNamespace(
    postMessage=messages.append,
    _getCurrentRunId=lambda: 1,
    _getWidgetValue=lambda key: None,
    _popEvent=lambda: None,
    _checkStopSignal=lambda: False,
)
api = runpy.run_path(str(project / 'client/src/engine/vpython-api.py'))
module = types.ModuleType('vpython')
module.__dict__.update(api)
sys.modules['vpython'] = module
checks = []

for filename in sorted((folder / 'milestones').glob('*.py')):
    tree = ast.parse(filename.read_text(), filename=str(filename))
    compile(tree, str(filename), 'exec')
    assert not any(isinstance(node, (ast.ClassDef, ast.ListComp, ast.DictComp,
                                     ast.SetComp, ast.GeneratorExp, ast.Lambda))
                   for node in ast.walk(tree)), filename.name
    checks.append(filename.name + ': 문법·기본 문법 범위 확인')

tree = ast.parse((folder / 'main.py').read_text())
assert isinstance(tree.body[-1], ast.While)
frame = ast.Module(body=tree.body[-1].body[1:], type_ignores=[])
setup = ast.Module(body=tree.body[:-1], type_ignores=[])
namespace = {}
with contextlib.redirect_stdout(io.StringIO()):
    exec(compile(setup, 'course-main-setup', 'exec'), namespace)
frame_code = compile(frame, 'course-main-frame', 'exec')
state = namespace['state']
notes = namespace['notes']
commands = api['_command_buffer']

def widget(value):
    return types.SimpleNamespace(value=value)

def frames(count):
    for _ in range(count):
        exec(frame_code, namespace)

def sounds():
    return [command for command in commands if command['action'] == 'sound']

assert len(notes) == 16 and notes[7] == -1
assert len(namespace['bars']) == 16 and len(namespace['bulbs']) == 8
assert len(namespace['palette']) == len(namespace['note_names']) == 8
checks.append('실제 API로 16박·8색·막대·음 구슬·그래프·위젯 생성')

with contextlib.redirect_stdout(io.StringIO()):
    namespace['change_variant'](widget('한 옥타브 위'))
assert math.isclose(namespace['pitch_frequency'](0), 523.26)
with contextlib.redirect_stdout(io.StringIO()):
    namespace['change_variant'](widget('원본'))
assert math.isclose(namespace['pitch_frequency'](0), 261.63)
checks.append('옥타브 주파수 2배·원본 복귀')

with contextlib.redirect_stdout(io.StringIO()):
    namespace['change_variant'](widget('거꾸로'))
    namespace['change_step'](widget(1))
    namespace['change_note'](widget('시4'))
assert notes[15] == 6
with contextlib.redirect_stdout(io.StringIO()):
    namespace['change_step'](widget(16))
    namespace['change_note'](widget('쉼표'))
assert notes[0] == -1
checks.append('역순 화면의 1번·16번 박 편집이 실제 원본 위치와 일치')

for index in range(16):
    notes[index] = -1
namespace['refresh_score']()
assert '쉼표 16개' in namespace['summary'].text
assert '평균 0 Hz' in namespace['summary'].text
checks.append('16개 모두 쉼표일 때 0으로 나누지 않음')

with contextlib.redirect_stdout(io.StringIO()):
    namespace['change_mute'](widget(True))
    namespace['reset_score'](None)
assert state['muted'] is True
assert notes == namespace['starter'] and state['bpm'] == 108
assert state['variant'] == '원본' and state['mode'] == '선율 실험'
assert state['timbre'] == '뮤직박스' and state['rounds'] == 0
assert namespace['cursor'].pos.x == -5.85
assert namespace['note_menu'].value == '도4'
checks.append('초기화는 악보·조건·위젯·커서를 복원하고 음소거를 유지')

sound_count = len(sounds())
namespace['toggle_play'](None)
with contextlib.redirect_stdout(io.StringIO()):
    frames(310)
assert len(sounds()) == sound_count
assert state['rounds'] >= 1
checks.append('음소거 상태에서 16박을 완주해도 새 소리 명령이 없음')

with contextlib.redirect_stdout(io.StringIO()):
    namespace['reset_score'](None)
    namespace['change_mute'](widget(False))
    namespace['change_mode'](widget('리듬 실험'))
assert math.isclose(namespace['beat_seconds'](0) + namespace['beat_seconds'](1), 120 / 108)
namespace['toggle_play'](None)
frames(1)
assert math.isclose(state['wait'], 90 / 108)
count = len(sounds())
frames(24)
assert len(sounds()) == count
frames(2)
assert len(sounds()) == count + 1
checks.append('리듬 모드 첫 긴 박이 다음 음 전에 유지되고 두 박 합계 보존')

with contextlib.redirect_stdout(io.StringIO()):
    namespace['reset_score'](None)
    namespace['change_mode'](widget('화음 실험'))
namespace['toggle_play'](None)
frames(1)
assert sounds()[-1]['method'] == 'chord'
assert sounds()[-1]['volume'] == 0.06
assert sounds()[-2]['frequency'] == 261.63
assert sounds()[-2]['volume'] == 0.15
checks.append('화음 모드 실제 API 명령의 선율·낮은 반주·음량 확인')

for value, expected in [('뮤직박스', 'musicbox'), ('피아노', 'piano'), ('맑은 사인파', 'sine')]:
    with contextlib.redirect_stdout(io.StringIO()):
        namespace['change_mode'](widget('선율 실험'))
        namespace['change_timbre'](widget(value))
    state['elapsed'] = 10
    frames(1)
    assert sounds()[-1]['type'] == expected
checks.append('세 음색이 실제 지원되는 sound 명령으로 전달')

output = io.StringIO()
with contextlib.redirect_stdout(output):
    namespace['compare_results'](None)
assert '주파수는 2배' in output.getvalue()
assert '두 박 합계는 유지' in output.getvalue()
checks.append('비교 결과에 옥타브·리듬의 수치 및 측정 한계 출력')

report = {'ok': True, 'scope': 'AST + 실제 Python API·입력 함수·프레임 계약 점검',
          'browserVerified': False, 'checks': checks, 'checkCount': len(checks)}
print(json.dumps(report, ensure_ascii=False, indent=2))

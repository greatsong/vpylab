#!/usr/bin/env python3
"""정적 하네스의 자식 프로세스 — 코드 한 개를 js 스텁과 함께 실행하고 결과를 JSON 한 줄로 출력한다.

static-harness.py 가 호출한다. 표준 입력으로 JSON을 받는다:
  {"api": "<vpython-api.py 경로>", "transform": "<student-code-transform.py 경로>",
   "registration": "<워커 모듈 등록 Python>", "code": "<학생 코드 그대로>", "rateLimit": 240, "wallLimit": 3.0}
학생 코드는 Worker와 같이 vpython-api.py 의 _vpylab_run 이 ast 로 변환해 모듈 수준에서 실행한다.
Pyodide 대신 CPython 에서 돌기 때문에 js 모듈을 흉내 낸 스텁(더미 postMessage 등)을 sys.modules['js'] 에 넣는다.
"""
import asyncio
import builtins
import io
import json
import sys
import time
import traceback
import types


def main():
    spec = json.loads(sys.stdin.read())
    api_code = open(spec['api'], encoding='utf-8').read()
    rate_limit = spec.get('rateLimit', 240)
    wall_limit = spec.get('wallLimit', 3.0)

    state = {
        'messages': [],        # js.postMessage 로 보낸 문자열(JSON)
        'stub_missing': set(), # 스텁에 없는 js 이름 접근 기록
        'stop_calls': 0,
        'started': time.time(),
        'stop_requested': False,
        'warnings': [],        # 변환기 경고 (type: warning)
        'synthetic_events': [],  # scene.waitfor 가 기다리는 이벤트에 보낼 가짜 이벤트
    }

    def note_waiting_binds(payload):
        """scene.waitfor 가 보낸 scene_bind(waiting=True) 를 보면 그 이벤트를 한 번 만들어 준다."""
        try:
            msg = json.loads(payload)
        except (TypeError, ValueError):
            return
        if msg.get('type') == 'warning':
            state['warnings'].append(msg.get('text'))
            return
        for cmd in msg.get('commands', []) or []:
            if cmd.get('action') == 'scene_bind' and cmd.get('waiting'):
                for name in cmd.get('events', []):
                    evt = {'name': name, 'pos': [1.0, 2.0, 0.0], 'pick': None}
                    if name.startswith('key'):
                        evt['key'] = 'a'
                    state['synthetic_events'].append(json.dumps(evt))

    class JsStub(types.ModuleType):
        """Pyodide 의 js 전역을 흉내 — 워커가 노출하는 함수만 의미 있게 구현"""
        def __init__(self):
            super().__init__('js')

        @staticmethod
        def postMessage(payload):
            text = payload if isinstance(payload, str) else json.dumps(payload, default=str)
            state['messages'].append(text)
            note_waiting_binds(text)

        @staticmethod
        def _getCurrentRunId():
            return 1

        @staticmethod
        def _popEvent():
            # 대기 중인 waitfor 에만 가짜 이벤트를 준다 (bind 핸들러는 실제로 호출하지 않는다)
            return state['synthetic_events'].pop(0) if state['synthetic_events'] else None

        @staticmethod
        def _getInputValue(request_id):
            return json.dumps({'value': '42'})

        @staticmethod
        def _getMousePos():
            return [0.0, 0.0, 0.0]

        @staticmethod
        def _getMousePick():
            return None

        @staticmethod
        def _getCameraState():
            return json.dumps({
                'pos': [0, 0, 10], 'center': [0, 0, 0], 'forward': [0, 0, -1], 'up': [0, 1, 0],
                'range': 10, 'fov': 1.0, 'width': 640, 'height': 400,
            })

        @staticmethod
        def _getWidgetValue(widget_id):
            return None

        @staticmethod
        def _getPressedKeys():
            return '[]'

        @staticmethod
        def _checkStopSignal():
            state['stop_calls'] += 1
            if state['stop_calls'] > rate_limit or time.time() - state['started'] > wall_limit:
                state['stop_requested'] = True
                return True
            return False

        @staticmethod
        def _queueOutput(kind, text):
            (sys.stderr if kind == 'stderr' else sys.stdout).write(str(text))

        def __getattr__(self, name):
            if name.startswith('__'):
                raise AttributeError(name)
            state['stub_missing'].add(name)
            return lambda *a, **k: None

    sys.modules['js'] = JsStub()

    # asyncio.sleep 을 즉시 반환으로 바꿔 rate()/sleep() 대기를 없앤다 (API 는 모듈 참조를 통해 호출하므로 적용됨)
    real_sleep = asyncio.sleep

    async def fast_sleep(seconds, result=None):
        await real_sleep(0)
        return result

    asyncio.sleep = fast_sleep

    # 학생 출력 캡처 — 실제 stdout 은 결과 JSON 전용
    real_stdout, real_stderr = sys.stdout, sys.stderr
    out_buf, err_buf = io.StringIO(), io.StringIO()
    sys.stdout, sys.stderr = out_buf, err_buf

    # input() 은 워커에 표준 입력이 없다 — 어떤 예외가 나는지 그대로 보고하기 위해 빈 stdin 으로 둔다
    sys.stdin = io.StringIO('')

    # 변환기를 Worker 와 같은 모듈 이름으로 등록
    transform_module = types.ModuleType('_vpylab_transform')
    exec(compile(open(spec['transform'], encoding='utf-8').read(), '<vpylab-transform>', 'exec'), transform_module.__dict__)
    sys.modules['_vpylab_transform'] = transform_module

    g = {'__name__': '__main__', '__builtins__': builtins}
    result = {'status': 'pass', 'error': None, 'rateCalls': 0}
    phase = 'api'
    try:
        exec(compile(api_code, '<vpython-api>', 'exec'), g)
        exec(compile(spec['registration'], '<vpython-register>', 'exec'), g)
        if spec.get('shim'):
            phase = 'shim'
            exec(compile(spec['shim'], '<compat-shim>', 'exec'), g)
        if '_reset_runtime_state' in g:
            g['_reset_runtime_state']()
        phase = 'student'
        state['started'] = time.time()
        # Worker 와 같은 경로: ast 변환 → 최상위 await 로 모듈 수준 실행 → 남은 태스크 대기
        asyncio.run(g['_vpylab_run'](spec['code'], '<student>'))
        if '_send_commands' in g:
            g['_send_commands']()
    except SystemExit:
        result['status'] = 'pass'
    except BaseException as exc:  # noqa: BLE001 — 모든 예외를 보고
        if type(exc).__name__ == '_StopExecution' or state['stop_requested']:
            result['status'] = 'stopped'
        else:
            result['status'] = 'error'
            tb = traceback.extract_tb(exc.__traceback__)
            student_frames = [f for f in tb if f.filename == '<student>']
            api_frames = [f for f in tb if f.filename == '<vpython-api>']
            last = student_frames[-1] if student_frames else None
            result['error'] = {
                'phase': phase,
                'type': type(exc).__name__,
                'message': str(exc),
                'studentLine': last.lineno if last else None,
                'apiLine': api_frames[-1].lineno if api_frames else None,
                'inApi': bool(api_frames) and (not student_frames or tb[-1].filename == '<vpython-api>'),
            }
    finally:
        sys.stdout, sys.stderr = real_stdout, real_stderr

    # 커맨드 집계
    actions = {}
    create_types = {}
    scene_props = {}
    total = 0
    for payload in state['messages']:
        try:
            msg = json.loads(payload)
        except (TypeError, ValueError):
            continue
        for cmd in msg.get('commands', []) or []:
            total += 1
            act = cmd.get('action', '?')
            actions[act] = actions.get(act, 0) + 1
            if act == 'create':
                t = cmd.get('type', '?')
                create_types[t] = create_types.get(t, 0) + 1
            elif act == 'scene':
                p = cmd.get('property', '?')
                scene_props[p] = scene_props.get(p, 0) + 1
    result.update({
        'rateCalls': state['stop_calls'],
        'commands': {'total': total, 'actions': actions, 'createTypes': create_types, 'sceneProps': scene_props},
        'stdout': out_buf.getvalue()[-2000:],
        'stderr': err_buf.getvalue()[-2000:],
        'stubMissing': sorted(state['stub_missing']),
        'warnings': state['warnings'],
        'duration': round(time.time() - state['started'], 3),
    })
    real_stdout.write(json.dumps(result, ensure_ascii=False, default=str))
    real_stdout.write('\n')
    real_stdout.flush()


if __name__ == '__main__':
    main()

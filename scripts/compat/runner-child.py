#!/usr/bin/env python3
"""정적 하네스의 자식 프로세스 — 코드 한 개를 js 스텁과 함께 실행하고 결과를 JSON 한 줄로 출력한다.

static-harness.py 가 호출한다. 표준 입력으로 JSON을 받는다:
  {"api": "<vpython-api.py 경로>", "registration": "<워커 모듈 등록 Python>", "code": "<전처리된 코드>",
   "rateLimit": 240, "wallLimit": 3.0}
Pyodide 대신 CPython 에서 돌기 때문에 js 모듈을 흉내 낸 스텁(더미 postMessage 등)을 sys.modules['js'] 에 넣는다.
"""
import ast
import asyncio
import builtins
import inspect
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
    }

    class JsStub(types.ModuleType):
        """Pyodide 의 js 전역을 흉내 — 워커가 노출하는 함수만 의미 있게 구현"""
        def __init__(self):
            super().__init__('js')

        @staticmethod
        def postMessage(payload):
            state['messages'].append(payload if isinstance(payload, str) else json.dumps(payload, default=str))

        @staticmethod
        def _getCurrentRunId():
            return 1

        @staticmethod
        def _popEvent():
            return None

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
        flags = ast.PyCF_ALLOW_TOP_LEVEL_AWAIT
        code_obj = compile(spec['code'], '<student>', 'exec', flags=flags)
        ret = eval(code_obj, g)
        if inspect.iscoroutine(ret):
            asyncio.run(ret)
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
        'duration': round(time.time() - state['started'], 3),
    })
    real_stdout.write(json.dumps(result, ensure_ascii=False, default=str))
    real_stdout.write('\n')
    real_stdout.flush()


if __name__ == '__main__':
    main()

#!/usr/bin/env python3
"""
VPyLab 미션 코드를 CPython에서 실행해 브릿지 커맨드를 수집한다 (채점 테스트용).

브라우저에서는 Pyodide Worker가 vpython-api.py를 실행하고 JSON 커맨드를 메인 스레드로 보낸다.
테스트에서는 같은 vpython-api.py를 CPython으로 실행하되,
  - js 모듈을 가짜로 만들어 postMessage 커맨드를 모으고,
  - rate()/sleep()/음표()의 시간 지연은 가상 시계로 대체해 즉시 끝내고,
  - rate() 호출 횟수가 한도를 넘으면 사용자가 정지 버튼을 누른 것처럼 중단한다.

표준 입력 : JSON 배열 [{ "id": str, "label": str, "code": str }]
             (code는 code-preprocessor.js의 preprocessCode()를 거친 코드)
표준 출력 : JSON 배열 [{ "id", "label", "ok", "stopped", "error", "stdout", "commands": [...] }]
"""

import ast
import asyncio
import contextlib
import io
import json
import sys
import time
import types
from pathlib import Path

API_PATH = Path(__file__).resolve().parents[1] / 'engine' / 'vpython-api.py'
RATE_CALL_LIMIT = 20000  # 무한 루프 방지 — 이 횟수를 넘으면 실행 중지 신호를 보낸다

collected_commands = []
stop_requested = False


class FakeJs(types.ModuleType):
    """Pyodide의 js 모듈 대체 — Worker가 노출하는 함수만 흉내 낸다."""

    def __init__(self):
        super().__init__('js')

    @staticmethod
    def postMessage(payload):
        message = json.loads(payload)
        if message.get('type') == 'batch':
            collected_commands.extend(message.get('commands', []))

    @staticmethod
    def _getCurrentRunId():
        return 0

    @staticmethod
    def _checkStopSignal():
        return stop_requested

    @staticmethod
    def _queueOutput(kind, text):
        return None


sys.modules['js'] = FakeJs()

# === 가상 시계: time.time()/time.sleep()/asyncio.sleep()을 즉시 진행 ===
virtual_clock = [0.0]


def fake_time():
    return virtual_clock[0]


def fake_sleep(seconds):
    virtual_clock[0] += max(0.0, float(seconds))


async def fake_async_sleep(seconds, result=None):
    virtual_clock[0] += max(0.0, float(seconds))
    return result


time.time = fake_time
time.sleep = fake_sleep
asyncio.sleep = fake_async_sleep

# === vpython-api.py 로드 (Worker와 같은 방식으로 전역에 실행 후 모듈로 등록) ===
api_namespace = {'__name__': '__vpylab_api__'}
exec(compile(API_PATH.read_text(encoding='utf-8'), str(API_PATH), 'exec'), api_namespace)

original_rate = api_namespace['rate']
rate_calls = [0]


async def counted_rate(fps):
    global stop_requested
    rate_calls[0] += 1
    if rate_calls[0] > RATE_CALL_LIMIT:
        stop_requested = True
    return await original_rate(fps)


api_namespace['rate'] = counted_rate

vpython_module = types.ModuleType('vpython')
for name, value in api_namespace.items():
    if not name.startswith('_'):
        setattr(vpython_module, name, value)
sys.modules['vpython'] = vpython_module

StopExecution = api_namespace['_StopExecution']


def run_one(code):
    """코드 한 편을 실행하고 수집된 커맨드를 돌려준다."""
    global stop_requested
    collected_commands.clear()
    virtual_clock[0] = 0.0
    rate_calls[0] = 0
    stop_requested = False
    api_namespace['_reset_runtime_state']()

    stdout = io.StringIO()
    error = None
    stopped = False
    loop = asyncio.new_event_loop()
    try:
        with contextlib.redirect_stdout(stdout):
            compiled = compile(code, '<mission>', 'exec', flags=ast.PyCF_ALLOW_TOP_LEVEL_AWAIT)
            namespace = {'__name__': '__main__'}
            result = eval(compiled, namespace)
            if asyncio.iscoroutine(result):
                loop.run_until_complete(result)
    except StopExecution:
        stopped = True
    except BaseException as exc:  # noqa: BLE001 — 학생 코드의 모든 오류를 보고한다
        error = f'{type(exc).__name__}: {exc}'
    finally:
        loop.close()

    # 실행 후 남은 커맨드 버퍼 플러시 (Worker의 runCode와 동일)
    try:
        api_namespace['_send_commands']()
    except Exception:  # noqa: BLE001
        pass

    return {
        'ok': error is None,
        'stopped': stopped,
        'error': error,
        'stdout': stdout.getvalue(),
        'commands': list(collected_commands),
    }


def main():
    jobs = json.loads(sys.stdin.read() or '[]')
    results = []
    for job in jobs:
        outcome = run_one(job.get('code', ''))
        outcome['id'] = job.get('id')
        outcome['label'] = job.get('label')
        results.append(outcome)
    sys.stdout.write(json.dumps(results, ensure_ascii=False))


if __name__ == '__main__':
    main()

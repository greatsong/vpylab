#!/usr/bin/env python3
"""
VPyLab 미션 코드를 CPython에서 실행해 브릿지 커맨드를 수집한다 (채점 테스트용).

브라우저에서는 Pyodide Worker가 vpython-api.py를 실행하고 JSON 커맨드를 메인 스레드로 보낸다.
테스트에서는 같은 vpython-api.py를 CPython으로 실행하되,
  - js 모듈을 가짜로 만들어 postMessage 커맨드를 모으고,
  - rate()/sleep()/음표()의 시간 지연은 가상 시계로 대체해 즉시 끝내고,
  - rate() 호출 횟수가 한도를 넘으면 사용자가 정지 버튼을 누른 것처럼 중단한다.

표준 입력 : JSON 배열 [{ "id": str, "label": str, "code": str }]
             (code는 학생이 쓴 그대로. Worker와 같이 student-code-transform.py가 ast로 변환한다)
표준 출력 : JSON 배열 [{ "id", "label", "ok", "stopped", "error", "stdout", "commands": [...] }]
"""

import asyncio
import contextlib
import io
import json
import sys
import time
import types
from pathlib import Path

API_PATH = Path(__file__).resolve().parents[1] / 'engine' / 'vpython-api.py'
TRANSFORM_PATH = Path(__file__).resolve().parents[1] / 'engine' / 'student-code-transform.py'
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

    @staticmethod
    def _popEvent():
        return None

    @staticmethod
    def _getInputValue(request_id):
        # input()에는 정해진 답을 준다 (브라우저에서는 입력 위젯이 받는다)
        return json.dumps({'value': '42'})


sys.modules['js'] = FakeJs()

# === 학생 코드 변환기 등록 (Worker의 _vpylab_transform 모듈과 같다) ===
transform_module = types.ModuleType('_vpylab_transform')
exec(compile(TRANSFORM_PATH.read_text(encoding='utf-8'), str(TRANSFORM_PATH), 'exec'), transform_module.__dict__)
sys.modules['_vpylab_transform'] = transform_module

# === 가상 시계: time.time()/time.sleep()/asyncio.sleep()을 즉시 진행 ===
virtual_clock = [0.0]


def fake_time():
    return virtual_clock[0]


def fake_sleep(seconds):
    virtual_clock[0] += max(0.0, float(seconds))


real_async_sleep = asyncio.sleep


async def fake_async_sleep(seconds, result=None):
    virtual_clock[0] += max(0.0, float(seconds))
    # 한 번은 실제로 양보해 나란히 도는 태스크(async 핸들러, rate 콜백)가 진행되게 한다
    await real_async_sleep(0)
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
# 학생 코드가 API 전역에 남긴 이름이 다음 코드에 새지 않도록 실행 전 상태를 보관한다
baseline_namespace = dict(api_namespace)


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
            # Worker와 같은 경로: ast 변환 → 모듈 수준 실행(최상위 await) → 남은 태스크 대기.
            # 학생 코드는 API 전역에서 실행된다 (Worker에서도 API와 같은 전역이다).
            loop.run_until_complete(api_namespace['_vpylab_run'](code, '<mission>'))
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

    # 학생 코드가 만든 이름은 지우고 덮어쓴 API 이름은 되돌린다 (_로 시작하는 내부 상태는 _reset_runtime_state 가 맡는다)
    for key in list(api_namespace):
        if key not in baseline_namespace:
            del api_namespace[key]
        elif not key.startswith('_'):
            api_namespace[key] = baseline_namespace[key]

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

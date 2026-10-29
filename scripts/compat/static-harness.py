#!/usr/bin/env python3
"""정적(오프라인) 호환성 하네스.

out/preprocessed.json 의 코드를 하나씩 자식 프로세스(runner-child.py)로 실행하고
예외·정지·시간 초과·무반응·미지원 커맨드를 out/static-results.json 에 기록한다.
브라우저 없이 CPython 3.12 로 vpython-api.py 를 js 스텁과 함께 돌리므로 Python 쪽 의미만 검사한다.

사용법:
    python3 -I scripts/compat/static-harness.py [--api <vpython-api.py>] [--filter <부분문자열>] [--jobs 8] [--timeout 12]
"""
import argparse
import json
import os
import re
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
CHILD = HERE / 'runner-child.py'

# GlowScript 가 `from vpython import *` 로 제공하는 이름 — NameError 가 나면 '미지원 API' 로 분류
GLOWSCRIPT_GLOBALS = set('''
canvas sphere simple_sphere box cylinder cone pyramid ellipsoid ring helix arrow curve points label text compound extrusion
vertex triangle quad group graph gcurve gdots gvbars ghbars slider button checkbox radio menu winput wtext
local_light distant_light attach_arrow attach_trail attach_light rate sleep vector vec mag mag2 norm hat dot cross proj comp
diff_angle rotate color textures bumpmaps shapes paths scene keysdown pause print_options get_library read_local_file download
abs sqrt sin cos tan asin acos atan atan2 exp log log10 pow pi ceil floor sign round max min random factorial combin radians
degrees clock msclock arange e tau fsum gamma hypot modf trunc isnan isinf isclose cosh sinh tanh asinh acosh atanh expm1
log1p log2 erf erfc lgamma copysign fabs fmod frexp ldexp dist prod isqrt perm comb inf nan
'''.split())

# 수업에서 자주 쓰는 정도 — 문서 페이지 이름 기준 (보고서의 심각도 참고용)
COMMON_API = {'sphere', 'box', 'vector', 'rate', 'color', 'arrow', 'cylinder', 'label', 'curve', 'scene', 'graph', 'gcurve'}

# 화면에 무언가 만들어야 하는 호출 — 이 호출이 있는데 커맨드가 0개면 '무반응'
DRAW_CALL = re.compile(r'\b(sphere|box|cylinder|arrow|cone|ring|helix|pyramid|ellipsoid|label|text|curve|points|compound|extrusion|'
                       r'local_light|distant_light|graph|gcurve|gdots|gvbars|ghbars|slider|button|checkbox|radio|menu|winput|triangle|quad)\s*\(')


def classify(item, corpus_item, res, timed_out, bridge_labels):
    """결과를 범주로 분류한다. 반환: (category, detail)"""
    tags = set(corpus_item.get('tags', []))
    if timed_out:
        return ('timeout', 'rate 가 없는 반복문이거나 매우 무거운 코드 — 브라우저에서는 10초 무응답 뒤 강제 종료')
    if res['status'] == 'error':
        err = res['error']
        if err['phase'] in ('api', 'shim'):
            return ('harness', f"{err['phase']} 로드 실패: {err['type']}: {err['message']}")
        t, m = err['type'], err['message']
        if t == 'NameError':
            name = m.split("'")[1] if "'" in m else ''
            if name in GLOWSCRIPT_GLOBALS:
                return ('unsupported-api', f'GlowScript 전역 이름 `{name}` 없음')
            if corpus_item.get('kind') == 'fragment':
                return ('fragment-undefined', f'문서 조각이 가정한 이름 `{name}` 미정의 (VPyLab 문제 아님)')
            return ('error', f'{t}: {m}')
        if t == 'AttributeError':
            return ('unsupported-attr', m)
        if t == 'TypeError' and ('unexpected keyword' in m or 'positional argument' in m or 'not callable' in m):
            return ('unsupported-arg', m)
        if t == 'AssertionError':
            return ('semantic', f'의미 차이 (assert 실패): {m}')
        if t in ('EOFError', 'OSError') and 'input' in tags:
            return ('input', f'{t}: {m}')
        if t == 'ModuleNotFoundError' or t == 'ImportError':
            return ('unsupported-module', m)
        if t == 'SyntaxError' and re.search(r'\$\(|\bjQuery\b|\.js_', corpus_item['code']):
            return ('glowscript-only', 'Web VPython 전용: JavaScript(jQuery) 혼용 코드')
        return ('error', f'{t}: {m}')
    # 통과했더라도 브릿지가 모르는 커맨드가 있으면 표시
    unknown_types = [t for t in res['commands']['createTypes'] if t not in bridge_labels]
    unknown_actions = [a for a in res['commands']['actions'] if a not in bridge_labels]
    if unknown_types or unknown_actions:
        return ('unsupported-bridge', f'브릿지가 모르는 커맨드 type={unknown_types} action={unknown_actions}')
    if res['stderr'].strip():
        return ('warning', res['stderr'].strip()[-300:])
    if res['status'] == 'stopped':
        return ('pass', f"rate {res['rateCalls']}회 뒤 정지")
    if res['commands']['total'] == 0 and not res['stdout'].strip() and DRAW_CALL.search(corpus_item['code']):
        return ('silent', '객체를 만드는 호출이 있는데 커맨드가 하나도 안 나감 (무반응)')
    return ('pass', '')


def run_one(spec, timeout):
    started = time.time()
    try:
        proc = subprocess.run(
            [sys.executable, '-I', str(CHILD)], input=json.dumps(spec), capture_output=True, text=True, timeout=timeout,
        )
    except subprocess.TimeoutExpired:
        return None, True, round(time.time() - started, 2)
    line = proc.stdout.strip().split('\n')[-1] if proc.stdout.strip() else ''
    try:
        return json.loads(line), False, round(time.time() - started, 2)
    except ValueError:
        return {
            'status': 'error', 'rateCalls': 0,
            'error': {'phase': 'harness', 'type': 'ChildCrash', 'message': (proc.stderr or proc.stdout)[-500:], 'studentLine': None},
            'commands': {'total': 0, 'actions': {}, 'createTypes': {}, 'sceneProps': {}}, 'stdout': '', 'stderr': '', 'stubMissing': [],
        }, False, round(time.time() - started, 2)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--api', default=str(ROOT / 'client/src/engine/vpython-api.py'))
    ap.add_argument('--filter', default='')
    ap.add_argument('--jobs', type=int, default=max(2, (os.cpu_count() or 4) // 2))
    ap.add_argument('--timeout', type=float, default=12.0)
    ap.add_argument('--out', default=str(HERE / 'out/static-results.json'))
    ap.add_argument('--shim', action='store_true', help='shim-quickfixes.py 를 덧씌워 "즉시 수정 적용 시" 결과를 잰다')
    args = ap.parse_args()

    pre = json.loads((HERE / 'out/preprocessed.json').read_text(encoding='utf-8'))
    corpus = {it['id']: it for it in json.loads((HERE / 'corpus/corpus.json').read_text(encoding='utf-8'))}
    bridge_labels = set(pre['bridgeCaseLabels'])
    items = [it for it in pre['items'] if args.filter in it['id']]
    shim_code = (HERE / 'shim-quickfixes.py').read_text(encoding='utf-8') if args.shim else ''
    if args.shim:
        print('심(shim-quickfixes.py) 적용: 즉시 수정 가능 항목을 임시로 덧씌운 what-if 측정')
    print(f'정적 하네스: {len(items)}개 실행 (api={os.path.relpath(args.api, ROOT)}, jobs={args.jobs})')

    def work(it):
        spec = {'api': args.api, 'registration': pre['registration'], 'code': it['code'], 'rateLimit': 240, 'wallLimit': 3.0, 'shim': shim_code}
        res, timed_out, elapsed = run_one(spec, args.timeout)
        corpus_item = corpus[it['id']]
        if res is None:
            res = {'status': 'timeout', 'error': None, 'rateCalls': 0, 'commands': {'total': 0, 'actions': {}, 'createTypes': {}, 'sceneProps': {}}, 'stdout': '', 'stderr': '', 'stubMissing': []}
        category, detail = classify(it, corpus_item, res, timed_out, bridge_labels)
        return {
            'id': it['id'], 'source': corpus_item['source'], 'kind': corpus_item.get('kind', 'program'),
            'title': corpus_item['title'], 'origin': corpus_item['origin'], 'progress': corpus_item.get('progress', False),
            'category': category, 'detail': detail, 'status': res['status'], 'error': res.get('error'),
            'commands': res['commands'], 'stdout': res['stdout'], 'stderr': res['stderr'], 'stubMissing': res['stubMissing'],
            'preprocessWarnings': it['warnings'], 'elapsed': elapsed,
        }

    results = []
    with ThreadPoolExecutor(max_workers=args.jobs) as pool:
        for i, r in enumerate(pool.map(work, items), 1):
            results.append(r)
            mark = '✓' if r['category'] == 'pass' else '✗'
            print(f"  [{i}/{len(items)}] {mark} {r['id']} — {r['category']} {r['detail'][:80]}")

    summary = {}
    for r in results:
        summary[r['category']] = summary.get(r['category'], 0) + 1
    out = {
        'generatedAt': time.strftime('%Y-%m-%dT%H:%M:%S'),
        'python': sys.version.split()[0],
        'api': os.path.relpath(args.api, ROOT),
        'count': len(results),
        'summary': summary,
        'shim': args.shim,
        'results': results,
    }
    Path(args.out).write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding='utf-8')
    print('요약:', json.dumps(summary, ensure_ascii=False))
    print(f'→ {os.path.relpath(args.out, ROOT)}')


if __name__ == '__main__':
    main()

#!/usr/bin/env python3
"""glowscript.org 공식 예제(GlowScriptDemos/Examples)를 프로그램 코퍼스로 저장한다.

사용법:
    python3 -I scripts/compat/extract-glowscript-examples.py <examples-json-dir> scripts/compat/corpus/glowscript-examples.json

<examples-json-dir>에는 fetch-sources.mjs 가 내려받은 <이름>.json (API 응답, source 필드) 이 있어야 한다.
Web VPython 프로그램은 첫 줄이 "Web VPython 3.2" 같은 버전 표식이고 import 가 없으므로,
표식을 떼고 `from vpython import *` 를 붙여 VPyLab 에서 돌 수 있는 형태로 바꾼다. 나머지는 원문 그대로다.
"""
import json
import re
import sys
from pathlib import Path

ORIGIN = 'https://www.glowscript.org/#/user/GlowScriptDemos/folder/Examples/program/'


def convert(source):
    src = source.replace('\r\n', '\n').replace('\r', '\n')
    lines = src.split('\n')
    header = None
    if lines and re.match(r'^\s*(Web VPython|GlowScript)\s+[\d.]+', lines[0]):
        header = lines.pop(0).strip()
    body = '\n'.join(lines)
    if not re.search(r'^\s*(from|import)\s+vpython', body, re.M):
        body = 'from vpython import *\n' + body
    return header, body


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)
    items = []
    for path in sorted(Path(sys.argv[1]).glob('*.json')):
        data = json.loads(path.read_text(encoding='utf-8'))
        source = data.get('source')
        if not source:
            continue
        header, code = convert(source)
        # JavaScript 예제는 제외 (Web VPython 표식이 없고 var/let 로 시작)
        if header is None and re.search(r'^\s*(var|let|const)\s', code, re.M):
            continue
        name = path.stem
        items.append({
            'id': f'gsexample:{name}',
            'source': 'gsexample',
            'kind': 'program',
            'title': f'GlowScript 공식 예제 {name}',
            'origin': ORIGIN + name,
            'header': header,
            'code': code,
        })
    Path(sys.argv[2]).write_text(json.dumps(items, ensure_ascii=False, indent=1), encoding='utf-8')
    print(f'{len(items)}개 예제를 {sys.argv[2]}에 저장')


if __name__ == '__main__':
    main()

#!/usr/bin/env python3
"""vpython-jupyter 저장소의 Demos/*.ipynb 에서 코드 셀을 이어 붙여 프로그램 코퍼스로 저장한다.

사용법:
    python3 -I scripts/compat/extract-demos.py <demos-dir> scripts/compat/corpus/vpython-demos.json

노트북 한 개 = 프로그램 한 개. 주피터 전용 매직(%)과 get_ipython 호출 줄은 제거한다.
"""
import json
import re
import sys
from pathlib import Path

ORIGIN = 'https://github.com/vpython/vpython-jupyter/blob/master/Demos/'


def notebook_code(path):
    nb = json.loads(path.read_text(encoding='utf-8'))
    parts = []
    for cell in nb.get('cells', []):
        if cell.get('cell_type') != 'code':
            continue
        src = ''.join(cell.get('source', []))
        lines = [l for l in src.split('\n') if not l.lstrip().startswith('%') and 'get_ipython' not in l]
        parts.append('\n'.join(lines))
    code = '\n\n'.join(p for p in parts if p.strip())
    return code


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)
    items = []
    for path in sorted(Path(sys.argv[1]).glob('*.ipynb')):
        code = notebook_code(path)
        if not code.strip():
            continue
        name = path.stem
        items.append({
            'id': f'demos:{name}',
            'source': 'demos',
            'kind': 'program',
            'title': f'VPython 데모 {name}',
            'origin': ORIGIN + path.name,
            'code': code,
        })
    Path(sys.argv[2]).write_text(json.dumps(items, ensure_ascii=False, indent=1), encoding='utf-8')
    print(f'{len(items)}개 프로그램을 {sys.argv[2]}에 저장')


if __name__ == '__main__':
    main()

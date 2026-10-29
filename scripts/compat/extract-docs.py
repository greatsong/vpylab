#!/usr/bin/env python3
"""GlowScript VPython 공식 문서(HTML)에서 예제 코드를 뽑아 JSON 코퍼스로 저장한다.

사용법:
    python3 -I scripts/compat/extract-docs.py <docs-html-dir> scripts/compat/corpus/glowscript-docs.json

<docs-html-dir>에는 fetch-sources.mjs 가 내려받은 VPythonDocs/*.html 이 있어야 한다.
추출 대상:
  1. <pre> 블록 전체 (여러 줄 예제)
  2. 본문 텍스트 가운데 Python 문장으로 파싱되는 한 줄(객체 시그니처, 속성 대입 등)
각 조각은 kind='fragment'로 표시하고, 하네스가 공통 서문(from vpython import * 와 흔한 변수 정의)을 붙여 실행한다.
"""
import ast
import html
import json
import re
import sys
from pathlib import Path

DOC_BASE = 'https://www.glowscript.org/docs/VPythonDocs/'
# JavaScript 전용 페이지나 코드가 없는 페이지는 제외
SKIP = {'programJS.html', 'ACE-keyboard-shortcuts.html', 'arcanetext.html', 'genindex.html', 'search.html',
        'index.html', 'license.html', 'resources.html', 'webvs7.html', 'package.html',
        'MakingNewVersion.txt'}


def body_text(raw):
    start = raw.find('<div class="body"')
    end = raw.find('<div class="sphinxsidebar"')
    if start < 0:
        return ''
    return raw[start:end if end > start else None]


def strip_tags(s):
    s = re.sub(r'<br\s*/?>', '\n', s)
    s = re.sub(r'<[^>]+>', '', s)
    return html.unescape(s).replace('¶', '').replace('’', "'").replace('“', '"').replace('”', '"')


def parses(code):
    try:
        ast.parse(code)
        return True
    except SyntaxError:
        return False


def is_code_line(line):
    """프로즈가 아니라 코드로 보이는 한 줄인지 판단"""
    s = line.strip()
    if not s or len(s) > 200:
        return False
    if not any(ch in s for ch in '(=.'):
        return False
    if s.endswith(':') or s.startswith('#'):
        return False
    # evt.text 같은 단순 속성 읽기는 scene/color/textures 등 전역 객체일 때만 의미가 있다
    m = re.match(r'^(\w+)\.\w+$', s)
    if m and m.group(1) not in ('scene', 'color', 'textures', 'shapes', 'paths', 'vector', 'vec'):
        return False
    # 설명 문장(영문 대문자 시작 + 공백 많은 문장)은 제외
    if re.match(r'^[A-Z][a-z]+\s+[a-z]', s) and '(' not in s:
        return False
    return parses(s)


def extract(doc_dir):
    items = []
    for path in sorted(Path(doc_dir).glob('*.html')):
        if path.name in SKIP:
            continue
        raw = path.read_text(encoding='utf-8', errors='replace')
        body = body_text(raw)
        page = path.stem
        url = DOC_BASE + path.name
        # 1) <pre> 블록
        for i, block in enumerate(re.findall(r'<pre[^>]*>(.*?)</pre>', body, re.S)):
            code = strip_tags(block).strip('\n')
            if not code.strip():
                continue
            if not parses(code):
                continue
            items.append({
                'id': f'docs:{page}:pre{i + 1}',
                'source': 'docs',
                'kind': 'fragment',
                'title': f'{page} 문서 예제 블록 {i + 1}',
                'origin': url,
                'code': code,
            })
        # 2) 한 줄 코드 (pre 블록 밖)
        text = strip_tags(re.sub(r'<pre[^>]*>.*?</pre>', '', body, flags=re.S))
        seen = set()
        for line in text.split('\n'):
            s = line.strip()
            if s in seen or not is_code_line(s):
                continue
            seen.add(s)
            items.append({
                'id': f'docs:{page}:line{len(seen)}',
                'source': 'docs',
                'kind': 'fragment',
                'title': f'{page} 문서 한 줄: {s[:60]}',
                'origin': url,
                'code': s,
            })
    return items


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)
    items = extract(sys.argv[1])
    Path(sys.argv[2]).write_text(json.dumps(items, ensure_ascii=False, indent=1), encoding='utf-8')
    print(f'{len(items)}개 조각을 {sys.argv[2]}에 저장')


if __name__ == '__main__':
    main()

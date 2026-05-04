#!/usr/bin/env python3
"""VPyLab 코스 코드 정적 검증

courses.js에 들어있는 모든 lesson code를 추출해서:
  1) Python ast.parse로 문법 오류 검출
  2) vpython API 화이트리스트와 매칭 — 미정의 호출/속성 탐지

실행:
  python3 scripts/validate_courses.py
종료 코드: 오류 있으면 1, 없으면 0
"""
from __future__ import annotations
import ast
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
COURSES_JS = ROOT / "client/src/data/courses.js"

# ── vpython 화이트리스트 (Phase A에서 추출) ────────────────
VP_FUNCTIONS = {
    "sphere", "box", "cylinder", "arrow", "cone", "ring", "compound",
    "pyramid", "ellipsoid", "helix", "label", "text", "curve", "points",
    "graph", "gcurve", "gdots", "gvbars", "ghbars", "keysdown", "rate",
    "sleep", "scene_background", "local_light", "distant_light",
    "vertex", "triangle", "quad", "extrusion",
    "mag", "mag2", "hat", "dot", "cross", "norm",
    "play_sound", "play_note", "play_chord", "play_sequence",
    "play_sfx", "start_bgm", "stop_bgm", "play_instrument",
    "scatter3d", "surface3d", "line3d", "bar3d",
    "slider", "button", "checkbox", "radio", "menu", "winput",
    "vector", "vec", "color", "scene",
    # 한글 API
    "음표", "효과음", "배경음악", "배경음악정지", "화음", "소리",
    "산점도", "표면그래프", "선그래프", "막대그래프", "악기",
    "색상", "무지개", "rainbow", "따뜻한색", "warm_colors",
    "차가운색", "cool_colors", "기본색", "basic_colors",
    "파스텔", "pastel_colors",
    "음계", "scale", "높은음계", "high_scale", "낮은음계", "low_scale",
}

PY_BUILTINS = {
    "range", "len", "abs", "int", "float", "str", "list", "dict",
    "tuple", "set", "enumerate", "zip", "sum", "min", "max", "sorted",
    "print", "input", "isinstance", "round", "pow", "bool", "type",
    "all", "any", "map", "filter", "reversed",
    "True", "False", "None",
}

ALLOWED_MODULES = {"math", "random"}
MATH_NAMES = {
    "sin", "cos", "tan", "asin", "acos", "atan", "atan2",
    "sqrt", "pow", "exp", "log", "log2", "log10",
    "pi", "e", "tau", "inf", "nan",
    "floor", "ceil", "trunc", "fabs", "factorial",
    "degrees", "radians", "hypot", "copysign",
}
RANDOM_NAMES = {
    "random", "uniform", "randint", "choice", "shuffle",
    "sample", "seed", "randrange", "gauss",
}

ALLOWED_NAMES = VP_FUNCTIONS | PY_BUILTINS | ALLOWED_MODULES

# 메서드 화이트리스트 (Attribute 검증)
ALLOWED_ATTRS = {
    "pos", "color", "visible", "opacity", "emissive", "velocity",
    "radius", "axis", "size", "shaftwidth", "thickness", "length",
    "height", "width", "up", "make_trail", "trail_color",
    "clone", "rotate", "attach_trail", "clear_trail",
    "append", "plot", "delete", "clear",
    "mag", "mag2", "hat", "dot", "cross", "norm",
    "proj", "comp", "diff_angle", "to_list",
    "x", "y", "z",
    "text", "background", "border",
    "title", "xtitle", "ytitle",
    "xmin", "xmax", "ymin", "ymax",
    "checked", "disabled", "value", "caption",
    "intensity", "direction",
    "angle", "speed", "dist", "dx", "dy", "dz",
    "name", "id", "data", "tag", "label",
    "red", "green", "blue", "yellow", "cyan", "magenta",
    "orange", "white", "black", "gray", "purple", "pink",
    "brown", "gold", "silver", "navy", "skyblue", "lime",
    "olive", "coral", "salmon", "violet", "indigo", "beige",
    "mint", "peach", "lavender", "maroon", "teal", "ivory",
    "background", "center", "range", "autoscale", "title",
    "caption", "mouse", "bind", "unbind", "waitfor",
    "r", "g", "b",
    "real", "imag",
    "lower", "upper", "split", "join", "strip",
    # 학생이 인스턴스에 자유롭게 만들 수 있는 동적 속성은 검증 제외(아래 로직에서 self-defined 처리)
}


def extract_lesson_codes(js_text: str) -> list[tuple[str, str]]:
    """courses.js에서 (lessonId, code) 추출.
    code: `...` 백틱 템플릿 리터럴 안에 들어있다고 가정.
    """
    out: list[tuple[str, str]] = []
    # lesson 블록 찾기: id: '...' 와 code: `...` 같은 lesson 안에서
    # courses.js는 단순한 객체 배열이므로 정규식으로 처리
    pattern = re.compile(
        r"id:\s*'([^']+)'[^`]*?code:\s*`([^`]*)`",
        re.DOTALL,
    )
    for m in pattern.finditer(js_text):
        out.append((m.group(1), m.group(2)))
    return out


def collect_used(tree: ast.AST) -> tuple[set[str], set[tuple[str, str]]]:
    """코드에서 사용한 (이름들, (객체.속성) 쌍)을 추출."""
    names: set[str] = set()
    attrs: set[tuple[str, str]] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Name):
            names.add(node.id)
        elif isinstance(node, ast.Attribute):
            if isinstance(node.value, ast.Name):
                attrs.add((node.value.id, node.attr))
    return names, attrs


def collect_defined(tree: ast.AST) -> set[str]:
    """코드 내에서 학생이 정의한 이름(변수, 함수, import, 함수 인자)."""
    defined: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Assign):
            for t in node.targets:
                if isinstance(t, ast.Name):
                    defined.add(t.id)
                elif isinstance(t, ast.Tuple):
                    for el in t.elts:
                        if isinstance(el, ast.Name):
                            defined.add(el.id)
        elif isinstance(node, ast.AugAssign):
            if isinstance(node.target, ast.Name):
                defined.add(node.target.id)
        elif isinstance(node, ast.AnnAssign):
            if isinstance(node.target, ast.Name):
                defined.add(node.target.id)
        elif isinstance(node, ast.For):
            if isinstance(node.target, ast.Name):
                defined.add(node.target.id)
            elif isinstance(node.target, ast.Tuple):
                for el in node.target.elts:
                    if isinstance(el, ast.Name):
                        defined.add(el.id)
        elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            defined.add(node.name)
            for a in node.args.args:
                defined.add(a.arg)
            for a in node.args.kwonlyargs:
                defined.add(a.arg)
            if node.args.vararg:
                defined.add(node.args.vararg.arg)
            if node.args.kwarg:
                defined.add(node.args.kwarg.arg)
        elif isinstance(node, ast.Lambda):
            for a in node.args.args:
                defined.add(a.arg)
        elif isinstance(node, ast.Import):
            for alias in node.names:
                defined.add(alias.asname or alias.name.split(".")[0])
        elif isinstance(node, ast.ImportFrom):
            for alias in node.names:
                if alias.name == "*":
                    # from vpython import * — 모든 vp api가 들어옴
                    defined.update(VP_FUNCTIONS)
                else:
                    defined.add(alias.asname or alias.name)
        elif isinstance(node, ast.comprehension):
            if isinstance(node.target, ast.Name):
                defined.add(node.target.id)
            elif isinstance(node.target, ast.Tuple):
                for el in node.target.elts:
                    if isinstance(el, ast.Name):
                        defined.add(el.id)
        elif isinstance(node, ast.With):
            for item in node.items:
                if item.optional_vars and isinstance(item.optional_vars, ast.Name):
                    defined.add(item.optional_vars.id)
        elif isinstance(node, ast.ExceptHandler):
            if node.name:
                defined.add(node.name)
    return defined


def check_module_attr(modname: str, attr: str) -> bool:
    if modname == "math":
        return attr in MATH_NAMES
    if modname == "random":
        return attr in RANDOM_NAMES
    return True  # 학생 객체 속성은 자유롭게 허용


def validate_code(code: str, label: str) -> list[str]:
    errors: list[str] = []
    try:
        tree = ast.parse(code)
    except SyntaxError as e:
        errors.append(f"[SYNTAX] {label} line {e.lineno}: {e.msg}")
        return errors

    # 베이스라인(pro-toolkit-*) 코스에만 적용되는 추가 정량 룰
    if label.startswith("pro-toolkit-"):
        n_lines = len([l for l in code.splitlines() if l.strip()])
        if n_lines > 25:
            errors.append(
                f"[BASELINE] {label}: 비-공백 줄 {n_lines}>25 — 베이스라인 길이 상한 위반"
            )
        n_funcs = sum(
            1 for n in ast.walk(tree) if isinstance(n, ast.FunctionDef)
        )
        n_classes = sum(
            1 for n in ast.walk(tree) if isinstance(n, ast.ClassDef)
        )
        if n_funcs > 2:
            errors.append(f"[BASELINE] {label}: 함수 정의 {n_funcs}>2")
        if n_classes > 0:
            errors.append(f"[BASELINE] {label}: 클래스 금지({n_classes}개 발견)")
        for node in ast.walk(tree):
            if isinstance(node, ast.While):
                t = node.test
                if isinstance(t, ast.Constant) and t.value is True:
                    errors.append(
                        f"[BASELINE] {label}: while True 금지(종료 조건 명시 필요)"
                    )
        n_marker = code.count("# ★")
        if n_marker < 1 or n_marker > 6:
            errors.append(
                f"[BASELINE] {label}: ★ 마커 {n_marker}개 (1~6 권장)"
            )

    used_names, used_attrs = collect_used(tree)
    defined = collect_defined(tree)

    # 이름 검증
    for n in used_names:
        if n in defined:
            continue
        if n in ALLOWED_NAMES:
            continue
        errors.append(f"[NAME] {label}: 미허용 식별자 '{n}'")

    # 속성 검증 (모듈 호출만 엄격)
    for owner, attr in used_attrs:
        if owner in ALLOWED_MODULES:
            if not check_module_attr(owner, attr):
                errors.append(
                    f"[ATTR] {label}: '{owner}.{attr}'는 허용 목록에 없음"
                )
        # 객체.속성은 자유 (학생이 만든 변수에 임의 속성 부여 흔함)
    return errors


def main() -> int:
    if not COURSES_JS.exists():
        print(f"❌ {COURSES_JS} 가 없습니다.")
        return 1
    text = COURSES_JS.read_text(encoding="utf-8")
    lessons = extract_lesson_codes(text)
    if not lessons:
        print("⚠️  추출된 lesson 코드가 없습니다.")
        return 1

    all_errors: list[str] = []
    for lid, code in lessons:
        errs = validate_code(code, lid)
        all_errors.extend(errs)

    print(f"검증 대상: {len(lessons)}개 lesson")
    if all_errors:
        print(f"❌ 오류 {len(all_errors)}건:")
        for e in all_errors:
            print(f"  - {e}")
        return 1
    print("✅ 모든 코드 통과 (syntax + API 화이트리스트)")
    return 0


if __name__ == "__main__":
    sys.exit(main())

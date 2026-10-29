"""
VPyLab 학생 코드 변환기 — GlowScript와 같은 실행 의미를 만든다.

브라우저에는 블로킹 대기가 없으므로 rate()·sleep()·scene.pause()·scene.waitfor()·input()·악기()는
코루틴이다. 학생은 GlowScript처럼 평범한 함수로 쓰므로, 실행 전에 이 모듈이 코드를 다음과 같이 바꾼다.

1. 위 호출이 들어 있는 def(중첩 함수·클래스 메서드 포함)를 async def로 바꾼다.
2. 그렇게 바뀐 함수를 부르는 자리에도 await를 붙인다. 호출 그래프를 따라 변하지 않을 때까지 반복한다.
3. 모듈 수준의 호출에는 최상위 await를 붙인다(PyCF_ALLOW_TOP_LEVEL_AWAIT). 코드를 함수로 감싸지
   않으므로 모듈 전역이 진짜 전역이고 global 선언이 동작한다.

문자열·주석 안의 가짜 호출은 ast가 파싱 단계에서 걸러 낸다. 줄 번호는 ast 노드가 그대로 갖고 있으므로
변환된 코드 객체의 트레이스백 줄 번호가 학생이 쓴 줄 번호와 같다.

GlowScript(lib/compiling/GScompiler.js)는 rate·sleep·get_library·read_local_file과 scene.pause·
scene.waitfor·scene.capture를 대기 함수로 두고 사용자 함수 전부를 async로 바꾼다. 여기서는 대기
함수를 실제로 부르는 함수만 바꾼다. 그래야 평범한 함수의 반환값·속도가 그대로 유지된다.

이 파일은 Pyodide(CPython 3.12)와 하네스(CPython 3.11 이상) 양쪽에서 실행된다. js 모듈을 쓰지 않는다.
"""
import ast

# 바로 부르는 코루틴 이름 (vpython-api.py에서 async def로 정의)
BLOCKING_NAMES = frozenset({'rate', 'sleep', '악기', 'input'})
# scene.<이름>(...) 형태의 코루틴 메서드
SCENE_BLOCKING_ATTRS = frozenset({'pause', 'waitfor'})
# `import vpython as vp` 뒤 vp.rate()·vp.scene.pause()를 인식하기 위한 모듈 이름
VPYTHON_MODULES = frozenset({'vpython'})

# 사용자 메서드 이름과 같아도 수신자를 알 수 없으면 await를 붙이지 않는 내장 메서드 이름.
# (ball.update()처럼 수신자가 사용자 클래스 인스턴스로 확인되면 붙인다.)
COMMON_BUILTIN_METHODS = frozenset({
    'append', 'extend', 'insert', 'pop', 'remove', 'clear', 'copy', 'update', 'get', 'keys', 'values',
    'items', 'sort', 'reverse', 'index', 'count', 'add', 'discard', 'join', 'split', 'strip', 'format',
    'replace', 'read', 'write', 'close', 'setdefault', 'plot', 'delete', 'rotate', 'start', 'stop',
})

_FUNC_NODES = (ast.FunctionDef, ast.AsyncFunctionDef)
_SCOPE_NODES = (ast.FunctionDef, ast.AsyncFunctionDef, ast.Lambda, ast.ClassDef)


class _FuncInfo:
    __slots__ = ('node', 'name', 'is_method', 'has_yield', 'is_async')

    def __init__(self, node, is_method):
        self.node = node
        self.name = node.name
        self.is_method = is_method
        self.has_yield = _contains_yield(node)
        self.is_async = isinstance(node, ast.AsyncFunctionDef)


def _contains_yield(func):
    """함수 본문(중첩 스코프 제외)에 yield가 있는지"""
    for child in _iter_scope(func):
        if isinstance(child, (ast.Yield, ast.YieldFrom)):
            return True
    return False


def _iter_scope(node):
    """노드 아래를 순회하되 중첩된 함수·람다·클래스 안으로는 들어가지 않는다."""
    stack = list(ast.iter_child_nodes(node))
    while stack:
        child = stack.pop()
        yield child
        if isinstance(child, _SCOPE_NODES):
            continue
        stack.extend(ast.iter_child_nodes(child))


class _Analysis:
    """호출 그래프 분석 결과"""

    def __init__(self):
        self.functions = []          # _FuncInfo 목록
        self.classes = set()         # 사용자 클래스 이름
        self.instances = set()       # 사용자 클래스 인스턴스를 담은 변수 이름 (b = Ball())
        self.module_aliases = set()  # import vpython as vp → {'vp'}
        self.name_aliases = {}       # from vpython import rate as r → {'r': 'rate'}
        self.scene_names = {'scene'}
        self.async_functions = set() # async로 바꿀 함수 이름
        self.async_methods = set()   # async로 바꿀 메서드 이름
        self.sync_only = set()       # async로 바꿀 수 없는 함수(생성기·__init__) 이름
        self.warnings = []

    def shadowed(self, name):
        """학생이 같은 이름의 함수를 정의했으면 내장 코루틴이 아니라 그 함수로 본다."""
        return any(f.name == name and not f.is_method for f in self.functions)

    def resolve_name(self, name):
        return self.name_aliases.get(name, name)

    def is_blocking_call(self, call):
        """이 Call 노드에 await가 필요한지"""
        func = call.func
        if isinstance(func, ast.Name):
            name = self.resolve_name(func.id)
            if name in self.async_functions:
                return True
            return name in BLOCKING_NAMES and not self.shadowed(func.id)
        if isinstance(func, ast.Attribute):
            attr = func.attr
            receiver = func.value
            if isinstance(receiver, ast.Name):
                if receiver.id in self.scene_names and attr in SCENE_BLOCKING_ATTRS:
                    return True
                if receiver.id in self.module_aliases and attr in BLOCKING_NAMES:
                    return True
                if attr in self.async_methods:
                    if receiver.id in ('self', 'cls') or receiver.id in self.instances:
                        return True
                    return attr not in COMMON_BUILTIN_METHODS
                return False
            # vp.scene.pause()
            if (isinstance(receiver, ast.Attribute) and isinstance(receiver.value, ast.Name)
                    and receiver.value.id in self.module_aliases and receiver.attr == 'scene'
                    and attr in SCENE_BLOCKING_ATTRS):
                return True
            # self.ball.step(), balls[i].step() — 수신자를 알 수 없으면 이름으로만 판단
            if attr in self.async_methods and attr not in COMMON_BUILTIN_METHODS:
                return True
        return False


def _collect(tree, analysis):
    """함수·클래스·별칭·인스턴스 변수를 모은다."""
    def walk(node, in_class):
        for child in ast.iter_child_nodes(node):
            if isinstance(child, ast.ClassDef):
                analysis.classes.add(child.name)
                walk(child, True)
            elif isinstance(child, _FUNC_NODES):
                analysis.functions.append(_FuncInfo(child, in_class))
                walk(child, False)
            else:
                if isinstance(child, ast.Import):
                    for alias in child.names:
                        if alias.name in VPYTHON_MODULES:
                            analysis.module_aliases.add(alias.asname or alias.name)
                elif isinstance(child, ast.ImportFrom) and child.module in VPYTHON_MODULES:
                    for alias in child.names:
                        if alias.asname and alias.name in BLOCKING_NAMES:
                            analysis.name_aliases[alias.asname] = alias.name
                        if alias.asname and alias.name == 'scene':
                            analysis.scene_names.add(alias.asname)
                walk(child, in_class)
    walk(tree, False)

    # 인스턴스 변수: b = Ball(...), s = scene
    for node in ast.walk(tree):
        if isinstance(node, (ast.Assign, ast.AnnAssign)):
            value = node.value
            targets = node.targets if isinstance(node, ast.Assign) else [node.target]
            names = [t.id for t in targets if isinstance(t, ast.Name)]
            if not names or value is None:
                continue
            if isinstance(value, ast.Call) and isinstance(value.func, ast.Name) and value.func.id in analysis.classes:
                analysis.instances.update(names)
            elif isinstance(value, ast.Name) and value.id in analysis.scene_names:
                analysis.scene_names.update(names)


def _mark_async(analysis):
    """대기 함수를 부르는 함수를 async로 표시한다. 호출 그래프를 따라 변화가 없을 때까지 반복."""
    changed = True
    while changed:
        changed = False
        for info in analysis.functions:
            if info.is_async and not info.is_method and info.name not in analysis.async_functions:
                analysis.async_functions.add(info.name)
                changed = True
            if info.is_async and info.is_method and info.name not in analysis.async_methods:
                analysis.async_methods.add(info.name)
                changed = True
            target = analysis.async_methods if info.is_method else analysis.async_functions
            if info.name in target or info.name in analysis.sync_only:
                continue
            calls = (c for c in _iter_scope(info.node) if isinstance(c, ast.Call))
            if not any(analysis.is_blocking_call(c) for c in calls):
                continue
            if info.has_yield:
                analysis.sync_only.add(info.name)
                analysis.warnings.append(
                    f"{info.node.lineno}번 줄: yield가 있는 함수 {info.name}() 안에서는 rate()·sleep() 같은 대기 함수를 쓸 수 없습니다.")
                continue
            if info.name == '__init__':
                analysis.sync_only.add(info.name)
                analysis.warnings.append(
                    f"{info.node.lineno}번 줄: __init__ 안에서는 rate()·sleep() 같은 대기 함수를 쓸 수 없습니다. 별도 메서드로 옮기세요.")
                continue
            target.add(info.name)
            changed = True


class _Transformer(ast.NodeTransformer):
    """async def 전환과 await 삽입"""

    def __init__(self, analysis):
        self.analysis = analysis
        self.awaitable = [True]  # 모듈 수준은 최상위 await 가능
        self.in_lambda = [False]
        self.already_awaited = set()

    def _is_async_target(self, node):
        info_target = self.analysis.async_methods if self._parent_is_class else self.analysis.async_functions
        return node.name in info_target and node.name not in self.analysis.sync_only

    _parent_is_class = False

    def visit_ClassDef(self, node):
        saved = self._parent_is_class
        self._parent_is_class = True
        self.awaitable.append(False)
        self.generic_visit(node)
        self.awaitable.pop()
        self._parent_is_class = saved
        return node

    def visit_FunctionDef(self, node):
        make_async = self._is_async_target(node)
        saved = self._parent_is_class
        self._parent_is_class = False
        self.awaitable.append(make_async)
        self.in_lambda.append(False)
        self.generic_visit(node)
        self.in_lambda.pop()
        self.awaitable.pop()
        self._parent_is_class = saved
        if not make_async:
            return node
        new = ast.AsyncFunctionDef(
            name=node.name, args=node.args, body=node.body, decorator_list=node.decorator_list,
            returns=node.returns, type_comment=getattr(node, 'type_comment', None),
        )
        if hasattr(node, 'type_params'):
            new.type_params = node.type_params
        return ast.copy_location(new, node)

    def visit_AsyncFunctionDef(self, node):
        saved = self._parent_is_class
        self._parent_is_class = False
        self.awaitable.append(True)
        self.in_lambda.append(False)
        self.generic_visit(node)
        self.in_lambda.pop()
        self.awaitable.pop()
        self._parent_is_class = saved
        return node

    def visit_Lambda(self, node):
        self.in_lambda.append(True)
        self.awaitable.append(False)
        self.generic_visit(node)
        self.awaitable.pop()
        self.in_lambda.pop()
        return node

    def visit_Await(self, node):
        if isinstance(node.value, ast.Call):
            self.already_awaited.add(id(node.value))
        self.generic_visit(node)
        return node

    def visit_Call(self, node):
        self.generic_visit(node)
        if id(node) in self.already_awaited or not self.analysis.is_blocking_call(node):
            return node
        label = ast.unparse(node.func) if hasattr(ast, 'unparse') else '대기 함수'
        if self.in_lambda[-1]:
            self.analysis.warnings.append(f"{node.lineno}번 줄: lambda 안의 {label}()은 기다릴 수 없습니다. def로 바꾸세요.")
            return node
        if not self.awaitable[-1]:
            # 생성기·__init__ 등 async로 바꿀 수 없는 함수 안 — 경고는 _mark_async에서 이미 냈다
            return node
        return ast.copy_location(ast.Await(value=node), node)


def transform_student_code(source, filename='<student>'):
    """학생 코드를 변환한 ast.Module과 경고 목록을 돌려준다. SyntaxError는 그대로 올라간다."""
    tree = ast.parse(source, filename=filename, type_comments=False)
    analysis = _Analysis()
    _collect(tree, analysis)
    _mark_async(analysis)
    tree = _Transformer(analysis).visit(tree)
    ast.fix_missing_locations(tree)
    return tree, analysis.warnings


def compile_student_code(source, filename='<student>'):
    """변환 뒤 최상위 await를 허용해 컴파일한 코드 객체와 경고 목록"""
    tree, warnings = transform_student_code(source, filename)
    code = compile(tree, filename, 'exec', flags=ast.PyCF_ALLOW_TOP_LEVEL_AWAIT, dont_inherit=True)
    return code, warnings


def unparse_student_code(source):
    """테스트·디버깅용: 변환된 코드를 문자열로 (Python 3.9 이상)"""
    tree, warnings = transform_student_code(source)
    return ast.unparse(tree), warnings

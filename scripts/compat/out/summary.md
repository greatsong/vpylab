# GlowScript 호환성 점검 요약 (자동 생성)

- 생성: 2026-10-31T02:49:29.589Z
- 정적 하네스: 2026-10-31T11:23:42, CPython 3.12.4, API client/src/engine/vpython-api.py, 586개
- 브라우저 하네스: 2026-10-31T02:24:23.020Z, http://127.0.0.1:4095, 586개, 씬 접근 가능
- 심 적용 정적 하네스(즉시 수정 가능 항목을 shim-quickfixes.py 로 덧씌운 what-if): 2026-10-30T08:36:03, 562개

## 출처별 결과

| 출처 | 개수 | 정적 통과 | 정적 실패 | 제외(문서 조각 미정의 등) | 브라우저 통과 | 브라우저 실패 | 즉시 수정 적용 시 통과 |
|---|---|---|---|---|---|---|---|
| VPyLab 내장(예제·코스·미션) | 218 | 218 | 0 | 0 | 218 | 0 | 211 |
| 수업 관용구 | 131 | 128 | 3 | 0 | 128 | 3 | 101 |
| GlowScript 공식 예제 | 33 | 28 | 3 | 2 | 28 | 3 | 19 |
| GlowScript 문서 조각 | 169 | 131 | 16 | 22 | 135 | 12 | 103 |
| VPython 7 데모(vpython-jupyter) | 35 | 27 | 8 | 0 | 29 | 6 | 18 |
| **합계** | 586 | 532 | 30 | 24 | 538 | 24 | 452 |

## 범주별 건수

| 범주 | 정적 | 브라우저 |
|---|---|---|
| 통과 (`pass`) | 532 | 538 |
| 미지원 인자·호출 형식 (`unsupported-arg`) | 11 | 11 |
| 시간 초과(정지 불가) (`timeout`) | 1 | 0 |
| 미지원 API(이름 없음) (`unsupported-api`) | 4 | 4 |
| 실행 오류 (`error`) | 2 | 2 |
| Web VPython 전용(제외) (`glowscript-only`) | 2 | 2 |
| 문서 조각 미정의(제외) (`fragment-undefined`) | 22 | 22 |
| 미지원 속성·메서드 (`unsupported-attr`) | 3 | 1 |
| 경고 (`warning`) | 4 | 0 |
| 미지원 모듈 (`unsupported-module`) | 5 | 5 |
| 무응답 뒤 강제 종료 (`hang`) | 0 | 1 |

## GlowScript 공식 예제 (glowscript.org Examples)

정적 33개 중 통과 28개, 브라우저 33개 중 통과 28개, 즉시 수정 적용 시 통과 19개.

| 예제 | 정적 결과 | 브라우저 결과 | 메시 수 | 첫 오류 | 즉시 수정 적용 시 (다음 오류) |
|---|---|---|---|---|---|
| [AtomicSolid-VPython](https://www.glowscript.org/#/user/GlowScriptDemos/folder/Examples/program/AtomicSolid-VPython) | 통과 | 통과 | 216 |  | 통과 |
| [BillboardingText](https://www.glowscript.org/#/user/GlowScriptDemos/folder/Examples/program/BillboardingText) | 통과 | 통과 | 10 |  | 미지원 속성·메서드: 'label' object has no attribute 'start' |
| [BinaryStar-VPython](https://www.glowscript.org/#/user/GlowScriptDemos/folder/Examples/program/BinaryStar-VPython) | 통과 | 통과 | 2 |  | 통과 |
| [Bounce-Callbacks-VPython](https://www.glowscript.org/#/user/GlowScriptDemos/folder/Examples/program/Bounce-Callbacks-VPython) | 통과 | 통과 | 6 |  | 통과 |
| [Bounce-VPython](https://www.glowscript.org/#/user/GlowScriptDemos/folder/Examples/program/Bounce-VPython) | 통과 | 통과 | 6 |  | 통과 |
| [BoxLightTest](https://www.glowscript.org/#/user/GlowScriptDemos/folder/Examples/program/BoxLightTest) | 통과 | 통과 | 7 |  | 통과 |
| [Bumpmaps-VPython](https://www.glowscript.org/#/user/GlowScriptDemos/folder/Examples/program/Bumpmaps-VPython) | 통과 | 통과 | 1 |  | 통과 |
| [ButtonsSlidersMenus-VPython](https://www.glowscript.org/#/user/GlowScriptDemos/folder/Examples/program/ButtonsSlidersMenus-VPython) | 통과 | 통과 | 4 |  | 통과 |
| [CORS](https://www.glowscript.org/#/user/GlowScriptDemos/folder/Examples/program/CORS) | 통과 | 통과 | 1 |  | 통과 |
| [Car](https://www.glowscript.org/#/user/GlowScriptDemos/folder/Examples/program/Car) | 통과 | 통과 | 26 |  | 미지원 API(이름 없음): name 'group' is not defined |
| [Color-RGB-HSV-VPython](https://www.glowscript.org/#/user/GlowScriptDemos/folder/Examples/program/Color-RGB-HSV-VPython) | 통과 | 통과 | 1 |  | 통과 |
| [Conch](https://www.glowscript.org/#/user/GlowScriptDemos/folder/Examples/program/Conch) | 통과 | 통과 | 1 |  | 미지원 API(이름 없음): name 'shapes' is not defined |
| [DipoleElectricField](https://www.glowscript.org/#/user/GlowScriptDemos/folder/Examples/program/DipoleElectricField) | 통과 | 통과 | 2 |  | 통과 |
| [DoublePendulum-VPython](https://www.glowscript.org/#/user/GlowScriptDemos/folder/Examples/program/DoublePendulum-VPython) | 통과 | 통과 | 7 |  | 통과 |
| [ElectricMotor](https://www.glowscript.org/#/user/GlowScriptDemos/folder/Examples/program/ElectricMotor) | 통과 | 통과 | 381 |  | 미지원 속성·메서드: 'extrusion' object has no attribute 'clone' |
| [Extrusions](https://www.glowscript.org/#/user/GlowScriptDemos/folder/Examples/program/Extrusions) | 통과 | 통과 | 7 |  | 미지원 API(이름 없음): name 'shapes' is not defined |
| [GraphTest](https://www.glowscript.org/#/user/GlowScriptDemos/folder/Examples/program/GraphTest) | 통과 | 통과 | 0 |  | 통과 |
| [Gyroscope-VPython](https://www.glowscript.org/#/user/GlowScriptDemos/folder/Examples/program/Gyroscope-VPython) | 통과 | 통과 | 7 |  | 미지원 속성·메서드: 'compound' object has no attribute 'length' |
| [HardSphereGas-VPython](https://www.glowscript.org/#/user/GlowScriptDemos/folder/Examples/program/HardSphereGas-VPython) | 통과 | 통과 | 200 |  | 통과 |
| [LaTexMathDisplay](https://www.glowscript.org/#/user/GlowScriptDemos/folder/Examples/program/LaTexMathDisplay) | 실행 오류 | 실행 오류 | 1 | NameError: name 'MathJax' is not defined | 실행 오류: name 'MathJax' is not defined |
| [MatterAndInteractions](https://www.glowscript.org/#/user/GlowScriptDemos/folder/Examples/program/MatterAndInteractions) | Web VPython 전용(제외) | Web VPython 전용(제외) | 0 | SyntaxError: invalid syntax (<student>, line 114) | Web VPython 전용(제외): invalid syntax (<student>, line 114) |
| [MousePicking-VPython](https://www.glowscript.org/#/user/GlowScriptDemos/folder/Examples/program/MousePicking-VPython) | 통과 | 통과 | 9 |  | 미지원 API(이름 없음): name 'shapes' is not defined |
| [Plot3D](https://www.glowscript.org/#/user/GlowScriptDemos/folder/Examples/program/Plot3D) | 통과 | 통과 | 2310 |  | 통과 |
| [RotatingCubes-VPython](https://www.glowscript.org/#/user/GlowScriptDemos/folder/Examples/program/RotatingCubes-VPython) | 통과 | 통과 | 1000 |  | 통과 |
| [RotatingCurve](https://www.glowscript.org/#/user/GlowScriptDemos/folder/Examples/program/RotatingCurve) | 통과 | 통과 | 0 |  | 미지원 인자·호출 형식: curve.__init__() takes 1 positional argument but 2 were given |
| [RotatingPoints](https://www.glowscript.org/#/user/GlowScriptDemos/folder/Examples/program/RotatingPoints) | 통과 | 통과 | 0 |  | 실행 오류: could not convert string to float: 'pos' |
| [Rug](https://www.glowscript.org/#/user/GlowScriptDemos/folder/Examples/program/Rug) | 미지원 인자·호출 형식 | 미지원 인자·호출 형식 | 0 | TypeError: vertex.__init__() got an unexpected keyword argument 'texpos' | 미지원 인자·호출 형식: vertex.__init__() got an unexpected keyword argument 'texpos' |
| [ScrollingText](https://www.glowscript.org/#/user/GlowScriptDemos/folder/Examples/program/ScrollingText) | Web VPython 전용(제외) | Web VPython 전용(제외) | 0 | SyntaxError: invalid syntax (<student>, line 10) | Web VPython 전용(제외): invalid syntax (<student>, line 10) |
| [Stars-VPython](https://www.glowscript.org/#/user/GlowScriptDemos/folder/Examples/program/Stars-VPython) | 통과 | 통과 | 20 |  | 통과 |
| [Stonehenge-VPython](https://www.glowscript.org/#/user/GlowScriptDemos/folder/Examples/program/Stonehenge-VPython) | 실행 오류 | 실행 오류 | 40 | NameError: name 'Date' is not defined | 미지원 API(이름 없음): name 'shapes' is not defined |
| [Textures-VPython](https://www.glowscript.org/#/user/GlowScriptDemos/folder/Examples/program/Textures-VPython) | 통과 | 통과 | 12 |  | 통과 |
| [Transparency](https://www.glowscript.org/#/user/GlowScriptDemos/folder/Examples/program/Transparency) | 통과 | 통과 | 6 |  | 통과 |
| [VPythonObjects-VPython](https://www.glowscript.org/#/user/GlowScriptDemos/folder/Examples/program/VPythonObjects-VPython) | 통과 | 통과 | 11 |  | 통과 |

## 실패 항목 전체 (정적 기준, 제외 범주 포함)

| id | 출처 | 범주 | 상세 | 줄 | 브라우저 | 근거 |
|---|---|---|---|---|---|---|
| `idiom:graph-gcurve` | idiom | unsupported-arg | _GSeriesBase.plot() got an unexpected keyword argument 'pos' | 6 | unsupported-arg: TypeError: _GSeriesBase.plot() got an unexpected keyword argument 'pos' | [문서](https://www.glowscript.org/docs/VPythonDocs/graph.html) |
| `idiom:flow-while-no-rate` | idiom | timeout | rate 가 없는 반복문이거나 매우 무거운 코드 — 브라우저에서는 10초 무응답 뒤 강제 종료 |  | hang | [문서](https://www.glowscript.org/docs/VPythonDocs/rate.html) |
| `idiom:flow-get-library` | idiom | unsupported-api | GlowScript 전역 이름 `get_library` 없음 | 2 | unsupported-api: NameError: name 'get_library' is not defined | [문서](https://www.glowscript.org/docs/VPythonDocs/file.html) |
| `gsexample:LaTexMathDisplay` | gsexample | error | NameError: name 'MathJax' is not defined | 7 | error: NameError: name 'MathJax' is not defined | [문서](https://www.glowscript.org/#/user/GlowScriptDemos/folder/Examples/program/LaTexMathDisplay) |
| `gsexample:MatterAndInteractions` | gsexample | glowscript-only | Web VPython 전용: JavaScript(jQuery) 혼용 코드 |  | glowscript-only: SyntaxError: invalid syntax | [문서](https://www.glowscript.org/#/user/GlowScriptDemos/folder/Examples/program/MatterAndInteractions) |
| `gsexample:Rug` | gsexample | unsupported-arg | vertex.__init__() got an unexpected keyword argument 'texpos' | 33 | unsupported-arg: TypeError: vertex.__init__() got an unexpected keyword argument 'texpos' | [문서](https://www.glowscript.org/#/user/GlowScriptDemos/folder/Examples/program/Rug) |
| `gsexample:ScrollingText` | gsexample | glowscript-only | Web VPython 전용: JavaScript(jQuery) 혼용 코드 |  | glowscript-only: SyntaxError: invalid syntax | [문서](https://www.glowscript.org/#/user/GlowScriptDemos/folder/Examples/program/ScrollingText) |
| `gsexample:Stonehenge-VPython` | gsexample | error | NameError: name 'Date' is not defined | 25 | error: NameError: name 'Date' is not defined. Did you mean: 'rate'? | [문서](https://www.glowscript.org/#/user/GlowScriptDemos/folder/Examples/program/Stonehenge-VPython) |
| `docs:attach_light:line1` | docs | unsupported-arg | attach_light.__init__() missing 1 required positional argument: 'obj' | 14 | unsupported-arg: TypeError: attach_light.__init__() missing 1 required positional argument: 'obj' | [문서](https://www.glowscript.org/docs/VPythonDocs/attach_light.html) |
| `docs:attacharrow:line1` | docs | unsupported-arg | attach_arrow.__init__() missing 2 required positional arguments: 'obj' and 'attr' | 14 | unsupported-arg: TypeError: attach_arrow.__init__() missing 2 required positional arguments: 'obj' and 'attr' | [문서](https://www.glowscript.org/docs/VPythonDocs/attacharrow.html) |
| `docs:color:pre1` | docs | fragment-undefined | 문서 조각이 가정한 이름 `hsv` 미정의 (VPyLab 문제 아님) | 16 | fragment-undefined: NameError: name 'hsv' is not defined | [문서](https://www.glowscript.org/docs/VPythonDocs/color.html) |
| `docs:color:line1` | docs | fragment-undefined | 문서 조각이 가정한 이름 `c` 미정의 (VPyLab 문제 아님) | 14 | fragment-undefined: NameError: name 'c' is not defined | [문서](https://www.glowscript.org/docs/VPythonDocs/color.html) |
| `docs:color:line2` | docs | fragment-undefined | 문서 조각이 가정한 이름 `c` 미정의 (VPyLab 문제 아님) | 14 | fragment-undefined: NameError: name 'c' is not defined | [문서](https://www.glowscript.org/docs/VPythonDocs/color.html) |
| `docs:compound:line2` | docs | unsupported-arg | compound.__init__() missing 1 required positional argument: 'objects' | 14 | unsupported-arg: TypeError: compound.__init__() missing 1 required positional argument: 'objects' | [문서](https://www.glowscript.org/docs/VPythonDocs/compound.html) |
| `docs:file:line1` | docs | unsupported-api | GlowScript 전역 이름 `get_library` 없음 | 14 | unsupported-api: NameError: name 'get_library' is not defined | [문서](https://www.glowscript.org/docs/VPythonDocs/file.html) |
| `docs:file:line2` | docs | unsupported-api | GlowScript 전역 이름 `read_local_file` 없음 | 14 | unsupported-api: NameError: name 'read_local_file' is not defined | [문서](https://www.glowscript.org/docs/VPythonDocs/file.html) |
| `docs:file:line3` | docs | unsupported-api | GlowScript 전역 이름 `download` 없음 | 14 | unsupported-api: NameError: name 'download' is not defined | [문서](https://www.glowscript.org/docs/VPythonDocs/file.html) |
| `docs:graph:line2` | docs | fragment-undefined | 문서 조각이 가정한 이름 `mygraph` 미정의 (VPyLab 문제 아님) | 14 | fragment-undefined: NameError: name 'mygraph' is not defined. Did you mean: 'graph'? | [문서](https://www.glowscript.org/docs/VPythonDocs/graph.html) |
| `docs:graph:line3` | docs | fragment-undefined | 문서 조각이 가정한 이름 `mygraph` 미정의 (VPyLab 문제 아님) | 14 | fragment-undefined: NameError: name 'mygraph' is not defined. Did you mean: 'graph'? | [문서](https://www.glowscript.org/docs/VPythonDocs/graph.html) |
| `docs:graph:line4` | docs | unsupported-attr | type object 'graph' has no attribute 'get_selected' | 14 | unsupported-attr: AttributeError: type object 'graph' has no attribute 'get_selected' | [문서](https://www.glowscript.org/docs/VPythonDocs/graph.html) |
| `docs:graph:line6` | docs | fragment-undefined | 문서 조각이 가정한 이름 `gc` 미정의 (VPyLab 문제 아님) | 14 | fragment-undefined: NameError: name 'gc' is not defined. Did you forget to import 'gc' | [문서](https://www.glowscript.org/docs/VPythonDocs/graph.html) |
| `docs:graph:line7` | docs | fragment-undefined | 문서 조각이 가정한 이름 `gc` 미정의 (VPyLab 문제 아님) | 14 | fragment-undefined: NameError: name 'gc' is not defined. Did you forget to import 'gc' | [문서](https://www.glowscript.org/docs/VPythonDocs/graph.html) |
| `docs:group:line2` | docs | fragment-undefined | 문서 조각이 가정한 이름 `mygroup` 미정의 (VPyLab 문제 아님) | 14 | fragment-undefined: NameError: name 'mygroup' is not defined. Did you mean: 'group'? | [문서](https://www.glowscript.org/docs/VPythonDocs/group.html) |
| `docs:key:pre1` | docs | warning | <student>:20: SyntaxWarning: "is" with 'str' literal. Did you mean "=="? |  | pass | [문서](https://www.glowscript.org/docs/VPythonDocs/key.html) |
| `docs:latexmath:pre1` | docs | fragment-undefined | 문서 조각이 가정한 이름 `MathJax` 미정의 (VPyLab 문제 아님) | 17 | fragment-undefined: NameError: name 'MathJax' is not defined | [문서](https://www.glowscript.org/docs/VPythonDocs/latexmath.html) |
| `docs:latexmath:pre2` | docs | fragment-undefined | 문서 조각이 가정한 이름 `MathJax` 미정의 (VPyLab 문제 아님) | 15 | fragment-undefined: NameError: name 'MathJax' is not defined | [문서](https://www.glowscript.org/docs/VPythonDocs/latexmath.html) |
| `docs:menu:pre1` | docs | warning | <student>:20: SyntaxWarning: "is" with 'int' literal. Did you mean "=="? <student>:22: SyntaxWarning: "is" with 'int' literal. Did you mean  |  | pass | [문서](https://www.glowscript.org/docs/VPythonDocs/menu.html) |
| `docs:mouse:line2` | docs | unsupported-arg | _Scene.waitfor() missing 1 required positional argument: 'event_names' | 14 | unsupported-arg: TypeError: _Scene.waitfor() missing 1 required positional argument: 'event_names' | [문서](https://www.glowscript.org/docs/VPythonDocs/mouse.html) |
| `docs:mouse:line3` | docs | unsupported-arg | '_MouseState' object is not callable | 14 | unsupported-arg: TypeError: '_MouseState' object is not callable | [문서](https://www.glowscript.org/docs/VPythonDocs/mouse.html) |
| `docs:mouse:line7` | docs | unsupported-arg | '_MouseState' object is not callable | 14 | unsupported-arg: TypeError: '_MouseState' object is not callable | [문서](https://www.glowscript.org/docs/VPythonDocs/mouse.html) |
| `docs:mouse:line9` | docs | fragment-undefined | 문서 조각이 가정한 이름 `newcolor` 미정의 (VPyLab 문제 아님) | 14 | fragment-undefined: NameError: name 'newcolor' is not defined | [문서](https://www.glowscript.org/docs/VPythonDocs/mouse.html) |
| `docs:radiobutton:pre1` | docs | warning | <student>:17: SyntaxWarning: "is" with 'str' literal. Did you mean "=="? <student>:19: SyntaxWarning: "is" with 'str' literal. Did you mean  |  | pass | [문서](https://www.glowscript.org/docs/VPythonDocs/radiobutton.html) |
| `docs:rate:line1` | docs | unsupported-arg | rate() missing 1 required positional argument: 'fps' | 14 | unsupported-arg: TypeError: rate() missing 1 required positional argument: 'fps' | [문서](https://www.glowscript.org/docs/VPythonDocs/rate.html) |
| `docs:rate:line3` | docs | fragment-undefined | 문서 조각이 가정한 이름 `make_trail` 미정의 (VPyLab 문제 아님) | 14 | fragment-undefined: NameError: name 'make_trail' is not defined | [문서](https://www.glowscript.org/docs/VPythonDocs/rate.html) |
| `docs:shapes_and_paths:line1` | docs | fragment-undefined | 문서 조각이 가정한 이름 `x0` 미정의 (VPyLab 문제 아님) | 14 | fragment-undefined: NameError: name 'x0' is not defined | [문서](https://www.glowscript.org/docs/VPythonDocs/shapes_and_paths.html) |
| `docs:shapes_and_paths:line2` | docs | fragment-undefined | 문서 조각이 가정한 이름 `x0` 미정의 (VPyLab 문제 아님) | 14 | fragment-undefined: NameError: name 'x0' is not defined | [문서](https://www.glowscript.org/docs/VPythonDocs/shapes_and_paths.html) |
| `docs:shapes_and_paths:line21` | docs | fragment-undefined | 문서 조각이 가정한 이름 `outer` 미정의 (VPyLab 문제 아님) | 14 | fragment-undefined: NameError: name 'outer' is not defined. Did you mean: 'iter'? | [문서](https://www.glowscript.org/docs/VPythonDocs/shapes_and_paths.html) |
| `docs:slider:pre1` | docs | warning | <student>:18: SyntaxWarning: "is" with 'str' literal. Did you mean "=="? |  | pass | [문서](https://www.glowscript.org/docs/VPythonDocs/slider.html) |
| `docs:speed:line1` | docs | unsupported-arg | rate() missing 1 required positional argument: 'fps' | 14 | unsupported-arg: TypeError: rate() missing 1 required positional argument: 'fps' | [문서](https://www.glowscript.org/docs/VPythonDocs/speed.html) |
| `docs:userinput:line3` | docs | fragment-undefined | 문서 조각이 가정한 이름 `key_pressed` 미정의 (VPyLab 문제 아님) | 14 | fragment-undefined: NameError: name 'key_pressed' is not defined | [문서](https://www.glowscript.org/docs/VPythonDocs/userinput.html) |
| `docs:vector:line1` | docs | fragment-undefined | 문서 조각이 가정한 이름 `myvec1` 미정의 (VPyLab 문제 아님) | 14 | fragment-undefined: NameError: name 'myvec1' is not defined | [문서](https://www.glowscript.org/docs/VPythonDocs/vector.html) |
| `docs:vertex:line2` | docs | fragment-undefined | 문서 조각이 가정한 이름 `myvertex0` 미정의 (VPyLab 문제 아님) | 14 | fragment-undefined: NameError: name 'myvertex0' is not defined. Did you mean: 'vertex'? | [문서](https://www.glowscript.org/docs/VPythonDocs/vertex.html) |
| `docs:vertex:line3` | docs | fragment-undefined | 문서 조각이 가정한 이름 `myvertexlist` 미정의 (VPyLab 문제 아님) | 14 | fragment-undefined: NameError: name 'myvertexlist' is not defined | [문서](https://www.glowscript.org/docs/VPythonDocs/vertex.html) |
| `docs:vertex:line4` | docs | fragment-undefined | 문서 조각이 가정한 이름 `c` 미정의 (VPyLab 문제 아님) | 14 | fragment-undefined: NameError: name 'c' is not defined | [문서](https://www.glowscript.org/docs/VPythonDocs/vertex.html) |
| `docs:vertex:line5` | docs | fragment-undefined | 문서 조각이 가정한 이름 `c` 미정의 (VPyLab 문제 아님) | 14 | fragment-undefined: NameError: name 'c' is not defined | [문서](https://www.glowscript.org/docs/VPythonDocs/vertex.html) |
| `docs:wtext:line1` | docs | fragment-undefined | 문서 조각이 가정한 이름 `vslider` 미정의 (VPyLab 문제 아님) | 14 | fragment-undefined: NameError: name 'vslider' is not defined. Did you mean: 'slider'? | [문서](https://www.glowscript.org/docs/VPythonDocs/wtext.html) |
| `demos:ButtonsSlidersMenus1-async` | demos | unsupported-module | No module named 'ipywidgets' | 1 | unsupported-module: ModuleNotFoundError: No module named 'ipywidgets' | [문서](https://github.com/vpython/vpython-jupyter/blob/master/Demos/ButtonsSlidersMenus1-async.ipynb) |
| `demos:ButtonsSlidersMenus1` | demos | unsupported-module | No module named 'ipywidgets' | 1 | unsupported-module: ModuleNotFoundError: No module named 'ipywidgets' | [문서](https://github.com/vpython/vpython-jupyter/blob/master/Demos/ButtonsSlidersMenus1.ipynb) |
| `demos:Color-RGB-HSV1` | demos | unsupported-module | No module named 'ipywidgets' | 1 | unsupported-module: ModuleNotFoundError: No module named 'ipywidgets' | [문서](https://github.com/vpython/vpython-jupyter/blob/master/Demos/Color-RGB-HSV1.ipynb) |
| `demos:Graphs` | demos | unsupported-attr | 'gdots' object has no attribute 'radius' | 33 | pass | [문서](https://github.com/vpython/vpython-jupyter/blob/master/Demos/Graphs.ipynb) |
| `demos:Rug` | demos | unsupported-arg | vertex.__init__() got an unexpected keyword argument 'texpos' | 37 | unsupported-arg: TypeError: vertex.__init__() got an unexpected keyword argument 'texpos' | [문서](https://github.com/vpython/vpython-jupyter/blob/master/Demos/Rug.ipynb) |
| `demos:Stonehenge` | demos | unsupported-attr | 'helix' object has no attribute 'size' | 310 | pass | [문서](https://github.com/vpython/vpython-jupyter/blob/master/Demos/Stonehenge.ipynb) |
| `demos:Textures1-async` | demos | unsupported-module | No module named 'ipywidgets' | 1 | unsupported-module: ModuleNotFoundError: No module named 'ipywidgets' | [문서](https://github.com/vpython/vpython-jupyter/blob/master/Demos/Textures1-async.ipynb) |
| `demos:Textures1` | demos | unsupported-module | No module named 'ipywidgets' | 1 | unsupported-module: ModuleNotFoundError: No module named 'ipywidgets' | [문서](https://github.com/vpython/vpython-jupyter/blob/master/Demos/Textures1.ipynb) |

## 정적 통과 · 브라우저 실패 (실행 경로·브릿지 쪽 문제)

| id | 브라우저 범주 | 상태 | 오류 | 브릿지 경고 |
|---|---|---|---|---|

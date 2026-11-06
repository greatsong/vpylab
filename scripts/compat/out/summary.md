# GlowScript 호환성 점검 요약 (자동 생성)

- 생성: 2026-11-06T19:44:39.289Z
- 정적 하네스: 2026-11-07T04:44:39, CPython 3.12.4, API client/src/engine/vpython-api.py, 750개

Python 실행 통과는 화면·입력·게임의 의미가 동일함을 보장하지 않습니다. 함수 등록 뒤의 이벤트 동작은 별도 회귀 검사로 확인합니다.

## 출처별 결과

| 출처 | 개수 | 정적 통과 | 정적 실패 | 제외(문서 조각 미정의 등) | 브라우저 통과 | 브라우저 실패 | 즉시 수정 적용 시 통과 |
|---|---|---|---|---|---|---|---|
| VPyLab 내장(예제·코스·미션·체험) | 344 | 344 | 0 | 0 | - | - | - |
| 가져온 작품 실행용 | 33 | 31 | 0 | 2 | - | - | - |
| 보존 원본 오류 재현 | 5 | 0 | 0 | 5 | - | - | - |
| 수업 관용구 | 131 | 129 | 2 | 0 | - | - | - |
| GlowScript 공식 예제 | 33 | 29 | 2 | 2 | - | - | - |
| GlowScript 문서 조각 | 169 | 134 | 7 | 28 | - | - | - |
| VPython 7 데모(vpython-jupyter) | 35 | 30 | 5 | 0 | - | - | - |
| **합계** | 750 | 697 | 16 | 37 | - | - | - |

## 범주별 건수

| 범주 | 정적 | 브라우저 |
|---|---|---|
| Python 실행 통과 (`pass`) | 697 | - |
| 보존 원본 오류 재현 (`origin-error`) | 5 | - |
| 빈 원본(제외) (`empty`) | 2 | - |
| 시간 초과(정지 불가) (`timeout`) | 1 | - |
| 미지원 API(이름 없음) (`unsupported-api`) | 4 | - |
| 실행 오류 (`error`) | 2 | - |
| Web VPython 전용(제외) (`glowscript-only`) | 2 | - |
| 문서 호출 표기(제외) (`fragment-incomplete`) | 6 | - |
| 문서 조각 미정의(제외) (`fragment-undefined`) | 22 | - |
| 경고 (`warning`) | 4 | - |
| 미지원 모듈 (`unsupported-module`) | 5 | - |

## GlowScript 공식 예제 (glowscript.org Examples)

정적 33개 중 통과 29개.

| 예제 | 정적 결과 | 브라우저 결과 | 메시 수 | 첫 오류 | 즉시 수정 적용 시 (다음 오류) |
|---|---|---|---|---|---|
| [AtomicSolid-VPython](https://www.glowscript.org/#/user/GlowScriptDemos/folder/Examples/program/AtomicSolid-VPython) | Python 실행 통과 | - | - |  | - |
| [BillboardingText](https://www.glowscript.org/#/user/GlowScriptDemos/folder/Examples/program/BillboardingText) | Python 실행 통과 | - | - |  | - |
| [BinaryStar-VPython](https://www.glowscript.org/#/user/GlowScriptDemos/folder/Examples/program/BinaryStar-VPython) | Python 실행 통과 | - | - |  | - |
| [Bounce-Callbacks-VPython](https://www.glowscript.org/#/user/GlowScriptDemos/folder/Examples/program/Bounce-Callbacks-VPython) | Python 실행 통과 | - | - |  | - |
| [Bounce-VPython](https://www.glowscript.org/#/user/GlowScriptDemos/folder/Examples/program/Bounce-VPython) | Python 실행 통과 | - | - |  | - |
| [BoxLightTest](https://www.glowscript.org/#/user/GlowScriptDemos/folder/Examples/program/BoxLightTest) | Python 실행 통과 | - | - |  | - |
| [Bumpmaps-VPython](https://www.glowscript.org/#/user/GlowScriptDemos/folder/Examples/program/Bumpmaps-VPython) | Python 실행 통과 | - | - |  | - |
| [ButtonsSlidersMenus-VPython](https://www.glowscript.org/#/user/GlowScriptDemos/folder/Examples/program/ButtonsSlidersMenus-VPython) | Python 실행 통과 | - | - |  | - |
| [CORS](https://www.glowscript.org/#/user/GlowScriptDemos/folder/Examples/program/CORS) | Python 실행 통과 | - | - |  | - |
| [Car](https://www.glowscript.org/#/user/GlowScriptDemos/folder/Examples/program/Car) | Python 실행 통과 | - | - |  | - |
| [Color-RGB-HSV-VPython](https://www.glowscript.org/#/user/GlowScriptDemos/folder/Examples/program/Color-RGB-HSV-VPython) | Python 실행 통과 | - | - |  | - |
| [Conch](https://www.glowscript.org/#/user/GlowScriptDemos/folder/Examples/program/Conch) | Python 실행 통과 | - | - |  | - |
| [DipoleElectricField](https://www.glowscript.org/#/user/GlowScriptDemos/folder/Examples/program/DipoleElectricField) | Python 실행 통과 | - | - |  | - |
| [DoublePendulum-VPython](https://www.glowscript.org/#/user/GlowScriptDemos/folder/Examples/program/DoublePendulum-VPython) | Python 실행 통과 | - | - |  | - |
| [ElectricMotor](https://www.glowscript.org/#/user/GlowScriptDemos/folder/Examples/program/ElectricMotor) | Python 실행 통과 | - | - |  | - |
| [Extrusions](https://www.glowscript.org/#/user/GlowScriptDemos/folder/Examples/program/Extrusions) | Python 실행 통과 | - | - |  | - |
| [GraphTest](https://www.glowscript.org/#/user/GlowScriptDemos/folder/Examples/program/GraphTest) | Python 실행 통과 | - | - |  | - |
| [Gyroscope-VPython](https://www.glowscript.org/#/user/GlowScriptDemos/folder/Examples/program/Gyroscope-VPython) | Python 실행 통과 | - | - |  | - |
| [HardSphereGas-VPython](https://www.glowscript.org/#/user/GlowScriptDemos/folder/Examples/program/HardSphereGas-VPython) | Python 실행 통과 | - | - |  | - |
| [LaTexMathDisplay](https://www.glowscript.org/#/user/GlowScriptDemos/folder/Examples/program/LaTexMathDisplay) | 실행 오류 | - | - | NameError: name 'MathJax' is not defined | - |
| [MatterAndInteractions](https://www.glowscript.org/#/user/GlowScriptDemos/folder/Examples/program/MatterAndInteractions) | Web VPython 전용(제외) | - | - | SyntaxError: invalid syntax (<student>, line 114) | - |
| [MousePicking-VPython](https://www.glowscript.org/#/user/GlowScriptDemos/folder/Examples/program/MousePicking-VPython) | Python 실행 통과 | - | - |  | - |
| [Plot3D](https://www.glowscript.org/#/user/GlowScriptDemos/folder/Examples/program/Plot3D) | Python 실행 통과 | - | - |  | - |
| [RotatingCubes-VPython](https://www.glowscript.org/#/user/GlowScriptDemos/folder/Examples/program/RotatingCubes-VPython) | Python 실행 통과 | - | - |  | - |
| [RotatingCurve](https://www.glowscript.org/#/user/GlowScriptDemos/folder/Examples/program/RotatingCurve) | Python 실행 통과 | - | - |  | - |
| [RotatingPoints](https://www.glowscript.org/#/user/GlowScriptDemos/folder/Examples/program/RotatingPoints) | Python 실행 통과 | - | - |  | - |
| [Rug](https://www.glowscript.org/#/user/GlowScriptDemos/folder/Examples/program/Rug) | Python 실행 통과 | - | - |  | - |
| [ScrollingText](https://www.glowscript.org/#/user/GlowScriptDemos/folder/Examples/program/ScrollingText) | Web VPython 전용(제외) | - | - | SyntaxError: invalid syntax (<student>, line 10) | - |
| [Stars-VPython](https://www.glowscript.org/#/user/GlowScriptDemos/folder/Examples/program/Stars-VPython) | Python 실행 통과 | - | - |  | - |
| [Stonehenge-VPython](https://www.glowscript.org/#/user/GlowScriptDemos/folder/Examples/program/Stonehenge-VPython) | 실행 오류 | - | - | NameError: name 'Date' is not defined | - |
| [Textures-VPython](https://www.glowscript.org/#/user/GlowScriptDemos/folder/Examples/program/Textures-VPython) | Python 실행 통과 | - | - |  | - |
| [Transparency](https://www.glowscript.org/#/user/GlowScriptDemos/folder/Examples/program/Transparency) | Python 실행 통과 | - | - |  | - |
| [VPythonObjects-VPython](https://www.glowscript.org/#/user/GlowScriptDemos/folder/Examples/program/VPythonObjects-VPython) | Python 실행 통과 | - | - |  | - |

## 실패 항목 전체 (정적 기준, 제외 범주 포함)

| id | 출처 | 범주 | 상세 | 줄 | 브라우저 | 근거 |
|---|---|---|---|---|---|---|
| `showcase-original:gs2024-01` | showcase-original | origin-error | 보존 원본의 알려진 오류: TypeError: 'float' object cannot be interpreted as an integer | 10 | - | [문서](https://www.glowscript.org/#/user/greatsong21/folder/2024vpython%ED%94%84%EB%A1%9C%EC%A0%9D%ED%8A%B8%EB%AA%A8%EC%9D%8C/program/%EA%B2%BD%EC%82%AC%ED%95%98%EA%B0%95%EB%B2%95-%ED%95%99%EC%8A%B5%EB%A5%A0%EC%8B%A4%EC%8A%B5%28solsol%29) |
| `showcase-original:gs2024-02` | showcase-original | origin-error | 보존 원본의 알려진 오류: SyntaxError: expected ':' (<student>, line 638) |  | - | [문서](https://www.glowscript.org/#/user/greatsong21/folder/2024vpython%ED%94%84%EB%A1%9C%EC%A0%9D%ED%8A%B8%EB%AA%A8%EC%9D%8C/program/%EA%B5%B0%EC%A7%91%ED%99%94%EC%95%8C%EA%B3%A0%EB%A6%AC%EC%A6%98%28solsol%29) |
| `showcase-original:gs2024-06` | showcase-original | origin-error | 보존 원본의 알려진 오류: TypeError: 'float' object cannot be interpreted as an integer | 27 | - | [문서](https://www.glowscript.org/#/user/greatsong21/folder/2024vpython%ED%94%84%EB%A1%9C%EC%A0%9D%ED%8A%B8%EB%AA%A8%EC%9D%8C/program/%EC%8A%A4%EB%84%A4%EC%9D%B4%ED%81%AC%EA%B2%8C%EC%9E%84%28%EC%88%98%EB%9D%BD%EA%B3%A0%EC%84%9C%ED%9D%AC%EC%88%98%EC%84%A0%EC%83%9D%EB%8B%98%29) |
| `showcase-original:gs2024-19` | showcase-original | origin-error | 보존 원본의 알려진 오류: NameError: name 'speed_f' is not defined | 12 | - | [문서](https://www.glowscript.org/#/user/greatsong21/folder/2024vpython%ED%94%84%EB%A1%9C%EC%A0%9D%ED%8A%B8%EB%AA%A8%EC%9D%8C/program/2023%EC%97%B0%EC%88%98%EC%9E%91%ED%92%88%28%EA%B3%BC%ED%95%99%EC%84%A0%EC%83%9D%EB%8B%98%29) |
| `showcase-original:gs2024-21` | showcase-original | origin-error | 보존 원본의 알려진 오류: TypeError: list indices must be integers or slices, not float | 70 | - | [문서](https://www.glowscript.org/#/user/greatsong21/folder/2024vpython%ED%94%84%EB%A1%9C%EC%A0%9D%ED%8A%B8%EB%AA%A8%EC%9D%8C/program/2023%EC%97%B0%EC%88%98%EC%9E%91%ED%92%88%ED%85%8C%ED%8A%B8%EB%A6%AC%EC%8A%A4%28%EC%88%98%ED%95%99%EC%84%A0%EC%83%9D%EB%8B%98%29) |
| `showcase:gs2024-22` | showcase | empty | 내용 없는 원본 초안 — 실행 성공률에서 제외 |  | - | [문서](https://www.glowscript.org/#/user/greatsong21/folder/2024vpython%ED%94%84%EB%A1%9C%EC%A0%9D%ED%8A%B8%EB%AA%A8%EC%9D%8C/program/240529ns01) |
| `showcase:gs2024-24` | showcase | empty | 내용 없는 원본 초안 — 실행 성공률에서 제외 |  | - | [문서](https://www.glowscript.org/#/user/greatsong21/folder/2024vpython%ED%94%84%EB%A1%9C%EC%A0%9D%ED%8A%B8%EB%AA%A8%EC%9D%8C/program/240710-6) |
| `idiom:flow-while-no-rate` | idiom | timeout | rate 가 없는 반복문이거나 매우 무거운 코드 — 브라우저에서는 10초 무응답 뒤 강제 종료 |  | - | [문서](https://www.glowscript.org/docs/VPythonDocs/rate.html) |
| `idiom:flow-get-library` | idiom | unsupported-api | GlowScript 전역 이름 `get_library` 없음 | 2 | - | [문서](https://www.glowscript.org/docs/VPythonDocs/file.html) |
| `gsexample:LaTexMathDisplay` | gsexample | error | NameError: name 'MathJax' is not defined | 7 | - | [문서](https://www.glowscript.org/#/user/GlowScriptDemos/folder/Examples/program/LaTexMathDisplay) |
| `gsexample:MatterAndInteractions` | gsexample | glowscript-only | Web VPython 전용: JavaScript(jQuery) 혼용 코드 |  | - | [문서](https://www.glowscript.org/#/user/GlowScriptDemos/folder/Examples/program/MatterAndInteractions) |
| `gsexample:ScrollingText` | gsexample | glowscript-only | Web VPython 전용: JavaScript(jQuery) 혼용 코드 |  | - | [문서](https://www.glowscript.org/#/user/GlowScriptDemos/folder/Examples/program/ScrollingText) |
| `gsexample:Stonehenge-VPython` | gsexample | error | NameError: name 'Date' is not defined | 25 | - | [문서](https://www.glowscript.org/#/user/GlowScriptDemos/folder/Examples/program/Stonehenge-VPython) |
| `docs:attach_light:line1` | docs | fragment-incomplete | 인자를 생략한 문서 호출 표기: attach_light.__init__() missing 1 required positional argument: 'obj' | 14 | - | [문서](https://www.glowscript.org/docs/VPythonDocs/attach_light.html) |
| `docs:attacharrow:line1` | docs | fragment-incomplete | 인자를 생략한 문서 호출 표기: attach_arrow.__init__() missing 2 required positional arguments: 'obj' and 'attr' | 14 | - | [문서](https://www.glowscript.org/docs/VPythonDocs/attacharrow.html) |
| `docs:color:pre1` | docs | fragment-undefined | 문서 조각이 가정한 이름 `hsv` 미정의 (VPyLab 문제 아님) | 16 | - | [문서](https://www.glowscript.org/docs/VPythonDocs/color.html) |
| `docs:color:line1` | docs | fragment-undefined | 문서 조각이 가정한 이름 `c` 미정의 (VPyLab 문제 아님) | 14 | - | [문서](https://www.glowscript.org/docs/VPythonDocs/color.html) |
| `docs:color:line2` | docs | fragment-undefined | 문서 조각이 가정한 이름 `c` 미정의 (VPyLab 문제 아님) | 14 | - | [문서](https://www.glowscript.org/docs/VPythonDocs/color.html) |
| `docs:compound:line2` | docs | fragment-incomplete | 인자를 생략한 문서 호출 표기: compound.__init__() missing 1 required positional argument: 'objects' | 14 | - | [문서](https://www.glowscript.org/docs/VPythonDocs/compound.html) |
| `docs:file:line1` | docs | unsupported-api | GlowScript 전역 이름 `get_library` 없음 | 14 | - | [문서](https://www.glowscript.org/docs/VPythonDocs/file.html) |
| `docs:file:line2` | docs | unsupported-api | GlowScript 전역 이름 `read_local_file` 없음 | 14 | - | [문서](https://www.glowscript.org/docs/VPythonDocs/file.html) |
| `docs:file:line3` | docs | unsupported-api | GlowScript 전역 이름 `download` 없음 | 14 | - | [문서](https://www.glowscript.org/docs/VPythonDocs/file.html) |
| `docs:graph:line2` | docs | fragment-undefined | 문서 조각이 가정한 이름 `mygraph` 미정의 (VPyLab 문제 아님) | 14 | - | [문서](https://www.glowscript.org/docs/VPythonDocs/graph.html) |
| `docs:graph:line3` | docs | fragment-undefined | 문서 조각이 가정한 이름 `mygraph` 미정의 (VPyLab 문제 아님) | 14 | - | [문서](https://www.glowscript.org/docs/VPythonDocs/graph.html) |
| `docs:graph:line6` | docs | fragment-undefined | 문서 조각이 가정한 이름 `gc` 미정의 (VPyLab 문제 아님) | 14 | - | [문서](https://www.glowscript.org/docs/VPythonDocs/graph.html) |
| `docs:graph:line7` | docs | fragment-undefined | 문서 조각이 가정한 이름 `gc` 미정의 (VPyLab 문제 아님) | 14 | - | [문서](https://www.glowscript.org/docs/VPythonDocs/graph.html) |
| `docs:group:line2` | docs | fragment-undefined | 문서 조각이 가정한 이름 `mygroup` 미정의 (VPyLab 문제 아님) | 14 | - | [문서](https://www.glowscript.org/docs/VPythonDocs/group.html) |
| `docs:key:pre1` | docs | warning | <student>:20: SyntaxWarning: "is" with 'str' literal. Did you mean "=="? |  | - | [문서](https://www.glowscript.org/docs/VPythonDocs/key.html) |
| `docs:latexmath:pre1` | docs | fragment-undefined | 문서 조각이 가정한 이름 `MathJax` 미정의 (VPyLab 문제 아님) | 17 | - | [문서](https://www.glowscript.org/docs/VPythonDocs/latexmath.html) |
| `docs:latexmath:pre2` | docs | fragment-undefined | 문서 조각이 가정한 이름 `MathJax` 미정의 (VPyLab 문제 아님) | 15 | - | [문서](https://www.glowscript.org/docs/VPythonDocs/latexmath.html) |
| `docs:menu:pre1` | docs | warning | <student>:20: SyntaxWarning: "is" with 'int' literal. Did you mean "=="? <student>:22: SyntaxWarning: "is" with 'int' literal. Did you mean  |  | - | [문서](https://www.glowscript.org/docs/VPythonDocs/menu.html) |
| `docs:mouse:line2` | docs | fragment-incomplete | 인자를 생략한 문서 호출 표기: _Scene.waitfor() missing 1 required positional argument: 'event_names' | 14 | - | [문서](https://www.glowscript.org/docs/VPythonDocs/mouse.html) |
| `docs:mouse:line9` | docs | fragment-undefined | 문서 조각이 가정한 이름 `newcolor` 미정의 (VPyLab 문제 아님) | 14 | - | [문서](https://www.glowscript.org/docs/VPythonDocs/mouse.html) |
| `docs:radiobutton:pre1` | docs | warning | <student>:17: SyntaxWarning: "is" with 'str' literal. Did you mean "=="? <student>:19: SyntaxWarning: "is" with 'str' literal. Did you mean  |  | - | [문서](https://www.glowscript.org/docs/VPythonDocs/radiobutton.html) |
| `docs:rate:line1` | docs | fragment-incomplete | 인자를 생략한 문서 호출 표기: rate() missing 1 required positional argument: 'fps' | 14 | - | [문서](https://www.glowscript.org/docs/VPythonDocs/rate.html) |
| `docs:rate:line3` | docs | fragment-undefined | 문서 조각이 가정한 이름 `make_trail` 미정의 (VPyLab 문제 아님) | 14 | - | [문서](https://www.glowscript.org/docs/VPythonDocs/rate.html) |
| `docs:shapes_and_paths:line1` | docs | fragment-undefined | 문서 조각이 가정한 이름 `x0` 미정의 (VPyLab 문제 아님) | 14 | - | [문서](https://www.glowscript.org/docs/VPythonDocs/shapes_and_paths.html) |
| `docs:shapes_and_paths:line2` | docs | fragment-undefined | 문서 조각이 가정한 이름 `x0` 미정의 (VPyLab 문제 아님) | 14 | - | [문서](https://www.glowscript.org/docs/VPythonDocs/shapes_and_paths.html) |
| `docs:shapes_and_paths:line21` | docs | fragment-undefined | 문서 조각이 가정한 이름 `outer` 미정의 (VPyLab 문제 아님) | 14 | - | [문서](https://www.glowscript.org/docs/VPythonDocs/shapes_and_paths.html) |
| `docs:slider:pre1` | docs | warning | <student>:18: SyntaxWarning: "is" with 'str' literal. Did you mean "=="? |  | - | [문서](https://www.glowscript.org/docs/VPythonDocs/slider.html) |
| `docs:speed:line1` | docs | fragment-incomplete | 인자를 생략한 문서 호출 표기: rate() missing 1 required positional argument: 'fps' | 14 | - | [문서](https://www.glowscript.org/docs/VPythonDocs/speed.html) |
| `docs:userinput:line3` | docs | fragment-undefined | 문서 조각이 가정한 이름 `key_pressed` 미정의 (VPyLab 문제 아님) | 14 | - | [문서](https://www.glowscript.org/docs/VPythonDocs/userinput.html) |
| `docs:vector:line1` | docs | fragment-undefined | 문서 조각이 가정한 이름 `myvec1` 미정의 (VPyLab 문제 아님) | 14 | - | [문서](https://www.glowscript.org/docs/VPythonDocs/vector.html) |
| `docs:vertex:line2` | docs | fragment-undefined | 문서 조각이 가정한 이름 `myvertex0` 미정의 (VPyLab 문제 아님) | 14 | - | [문서](https://www.glowscript.org/docs/VPythonDocs/vertex.html) |
| `docs:vertex:line3` | docs | fragment-undefined | 문서 조각이 가정한 이름 `myvertexlist` 미정의 (VPyLab 문제 아님) | 14 | - | [문서](https://www.glowscript.org/docs/VPythonDocs/vertex.html) |
| `docs:vertex:line4` | docs | fragment-undefined | 문서 조각이 가정한 이름 `c` 미정의 (VPyLab 문제 아님) | 14 | - | [문서](https://www.glowscript.org/docs/VPythonDocs/vertex.html) |
| `docs:vertex:line5` | docs | fragment-undefined | 문서 조각이 가정한 이름 `c` 미정의 (VPyLab 문제 아님) | 14 | - | [문서](https://www.glowscript.org/docs/VPythonDocs/vertex.html) |
| `docs:wtext:line1` | docs | fragment-undefined | 문서 조각이 가정한 이름 `vslider` 미정의 (VPyLab 문제 아님) | 14 | - | [문서](https://www.glowscript.org/docs/VPythonDocs/wtext.html) |
| `demos:ButtonsSlidersMenus1-async` | demos | unsupported-module | No module named 'ipywidgets' | 1 | - | [문서](https://github.com/vpython/vpython-jupyter/blob/master/Demos/ButtonsSlidersMenus1-async.ipynb) |
| `demos:ButtonsSlidersMenus1` | demos | unsupported-module | No module named 'ipywidgets' | 1 | - | [문서](https://github.com/vpython/vpython-jupyter/blob/master/Demos/ButtonsSlidersMenus1.ipynb) |
| `demos:Color-RGB-HSV1` | demos | unsupported-module | No module named 'ipywidgets' | 1 | - | [문서](https://github.com/vpython/vpython-jupyter/blob/master/Demos/Color-RGB-HSV1.ipynb) |
| `demos:Textures1-async` | demos | unsupported-module | No module named 'ipywidgets' | 1 | - | [문서](https://github.com/vpython/vpython-jupyter/blob/master/Demos/Textures1-async.ipynb) |
| `demos:Textures1` | demos | unsupported-module | No module named 'ipywidgets' | 1 | - | [문서](https://github.com/vpython/vpython-jupyter/blob/master/Demos/Textures1.ipynb) |

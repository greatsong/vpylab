# GlowScript 호환성 점검 하네스

GlowScript VPython 코드가 VPyLab에서 어디서 깨지는지 자동으로 전수 점검한다.
결과 보고서는 [docs/GLOWSCRIPT_COMPAT_REPORT.md](../../docs/GLOWSCRIPT_COMPAT_REPORT.md)에 있다.

## 빠른 실행

```bash
npm run compat:check          # 코퍼스 생성 → 전처리 → 정적 하네스 → 요약 (브라우저 불필요, 약 2분)
npm run compat:browser        # 브라우저 하네스 (Playwright, 개발 서버를 4095 포트에 띄움, 약 30~40분)
npm run compat:check:all      # 둘 다 실행하고 요약
```

브라우저 하네스는 처음 한 번 준비가 필요하다.

```bash
npm --prefix scripts/compat install
npx --prefix scripts/compat playwright install chromium
```

정적 하네스는 CPython 3.12 를 쓴다(Pyodide 0.27 과 같은 버전). `python3.12` 가 없으면 `PYTHON=python3 npm run compat:check` 처럼 바꿀 수 있다.

## 구성

| 파일 | 역할 |
|---|---|
| `corpus/idioms.mjs` | 수업 관용구 112개 (직접 작성, 결정적인 것은 `assert` 로 의미 검사) |
| `corpus/glowscript-examples.json` | glowscript.org 공식 예제 33개 (`extract-glowscript-examples.py`) |
| `corpus/glowscript-docs.json` | GlowScript 문서 각 페이지의 예제 블록·한 줄 코드 169개 (`extract-docs.py`) |
| `corpus/vpython-demos.json` | vpython-jupyter Demos 노트북 35개 (`extract-demos.py`) |
| `build-corpus.mjs` | 위 코퍼스와 `client/src/data/{examples,courses,missions}.js` 의 모든 코드를 `corpus/corpus.json` 으로 합침 |
| `preprocess.mjs` | 코퍼스 코드와 워커의 vpython 모듈 등록 블록·브릿지 커맨드 목록을 `out/preprocessed.json` 에 저장 (학생 코드 변환은 실행 시 `student-code-transform.py` 가 Worker 와 같이 수행) |
| `static-harness.py` + `runner-child.py` | 코드마다 자식 프로세스에서 `vpython-api.py` 의 `_vpylab_run` 으로 실행(ast 변환 → 모듈 수준 실행) → `out/static-results.json`. `scene.waitfor` 가 기다리는 이벤트와 `input()` 답(`42`)은 js 스텁이 만들어 준다 |
| `browser-harness.mjs` | Playwright 로 `/sandbox` 를 열어 Monaco 에 코드를 넣고 실행 버튼을 눌러 Worker 메시지·브릿지 경고·3D 메시 수를 기록 → `out/browser-results.json` |
| `summarize.mjs` | 두 결과를 합쳐 `out/summary.md`, `out/merged.json` 생성 |
| `fetch-sources.mjs` | 문서·데모·공식 예제 원문을 다시 내려받을 때 사용 (원문은 저장소에 두지 않음) |

## 판정 범주

| 범주 | 뜻 |
|---|---|
| `pass` | 예외 없이 끝남, 또는 `rate()` 루프가 정지 신호로 정상 종료 |
| `unsupported-api` | GlowScript 가 제공하는 전역 이름(`canvas`, `pi`, `sin`, `shapes` …)이 없음 (NameError) |
| `unsupported-attr` | 객체에 속성·메서드가 없거나 setter 가 없음 (AttributeError) |
| `unsupported-arg` | 인자 이름·호출 형식이 다름 (TypeError) |
| `semantic` | 실행은 되지만 값이 GlowScript 와 다름 (`assert` 실패) |
| `silent` | 객체를 만드는 호출이 있는데 커맨드가 하나도 안 나감 |
| `timeout` / `hang` | `rate()` 가 없는 무한 루프 등으로 정지되지 않음 |
| `input` | `input()` 사용 (워커에 표준 입력이 없음) |
| `fragment-undefined` | 문서에서 잘라 온 조각이 가정한 변수가 없음 → VPyLab 문제가 아니므로 집계에서 제외 |
| `glowscript-only` | jQuery 등 JavaScript 를 섞은 Web VPython 전용 코드 → 제외 |

## 옵션

```bash
python3.12 -I scripts/compat/static-harness.py --filter idiom: --jobs 8        # 일부만
python3.12 -I scripts/compat/static-harness.py --api path/to/vpython-api.py     # 다른 API 버전으로
node scripts/compat/browser-harness.mjs --filter gsexample: --headed            # 눈으로 보면서
node scripts/compat/browser-harness.mjs --url http://127.0.0.1:4033             # 떠 있는 서버 사용
```

## 한계

- 정적 하네스는 Python 쪽 의미만 본다. 브릿지(Three.js)가 커맨드를 어떻게 그리는지는 브라우저 하네스가 본다.
- 브라우저 하네스는 Worker 를 재시작하지 않고 코드를 이어서 돌린다. 각 코드가 끝나면 Python 전역을 스냅샷으로 되돌리지만, `scene` 의 카메라·배경 같은 화면 상태는 앱이 실행 시작 때 초기화하는 범위까지만 되돌아간다.
- 마우스·키보드·위젯 이벤트는 실제로 발생시키지 않는다. 핸들러 등록까지만 검사한다. 정적 하네스는 `scene.waitfor()` 가 기다리는 이벤트만 가짜로 한 번 보내고, 브라우저 하네스는 보내지 않으므로 `waitfor`·`pause`·`input()` 코드는 브라우저에서 실행 시간 초과 뒤 정지로 끝난다.
- 메시 수는 React fiber 에서 Three.js 씬을 찾아 센다. 씬을 못 찾으면 `create` 커맨드 수로 대신 판정한다.

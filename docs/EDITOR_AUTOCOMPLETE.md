# 편집기 자동 완성

VPyLab 편집기(Monaco)는 VPython 이름을 외우지 않아도 되도록 자리마다 다른 제안을 보여 줍니다. 제안 목록은 ↑·↓로 고르고 Enter 또는 Tab으로 넣습니다. 목록이 닫혔으면 Ctrl+Space로 다시 엽니다.

## 자리별 제안

| 적는 자리 | 보여 주는 것 | 예 |
|---|---|---|
| `색상[` 또는 `color[` | 한글·영어 색 이름 (색 견본 포함). 따옴표까지 넣어 준다 | `색상['빨강']`, `color['red']` |
| `color.` 또는 `색상.` | 영어 색 속성 30가지, `hsv_to_rgb()` | `color.skyblue` |
| `무지개[`, `파스텔[`, `따뜻한색[`, `차가운색[`, `기본색[` | 그 목록의 이름 키 | `무지개['보라']`, `파스텔['하늘']` |
| `음계[`, `높은음계[`, `낮은음계[` | 도~시, 높은도, C~B | `음계['솔']` |
| `음표(`, `play_note(` | 음 이름(도~시, #·b, 옥타브 3~6, C4 같은 영어 이름) | `음표("솔#5")` |
| `악기(` | 첫 인자에 악기 이름, 둘째 인자에 음 이름 | `악기("피아노", "도")` |
| `효과음(`, `play_sfx(` | 효과음 이름 | `효과음("coin")` |
| `배경음악(`, `start_bgm(` | 배경음악 이름 | `배경음악("adventure")` |
| `textures.`, `texture=` | 텍스처 이름 | `box(texture=textures.wood)` |
| `scene.`, `scene.camera.` | 씬·카메라 속성과 메서드 | `scene.background`, `scene.camera.follow()` |
| `note.` | 음 주파수 상수 | `note.C4` |
| `ball.` 처럼 객체 변수 뒤 | 공통 속성(pos, color, velocity, radius…)과 메서드 | `ball.velocity` |
| `ball.pos.` 처럼 벡터 뒤 | x, y, z, mag, hat… | `ball.pos.x` |
| `sphere(` 처럼 함수 괄호 뒤 | 그 함수의 키워드 인자 (`color=` 자리에는 색이 먼저) | `sphere(radius=0.5)` |
| `random.` | `randint`, `uniform`, `choice`, `random`, `shuffle`. `import random`이 없으면 설명에 안내가 붙는다 | `random.randint(1, 6)` |
| `목록.` 처럼 변수 뒤 | 객체 속성 다음에 리스트 메서드 `append`, `pop`, `index` | `목록.append(값)` |
| 그 밖의 자리 | 구문·패턴 스니펫이 먼저, 그다음 API 함수·객체와 한글 별칭, 파이썬 내장 함수, 키워드 | 아래 표 |

함수 스니펫은 인자마다 탭 정지가 있어 Tab으로 다음 인자로 옮겨 가며 값을 바꿉니다. 각 항목에는 한국어 한 줄 설명이 붙습니다.

## 구문·패턴 스니펫과 한글 검색

입문 학생이 타이핑을 줄일 수 있도록 자주 쓰는 구문과 한 줄 패턴을 스니펫으로 넣었습니다(`client/src/components/editor/starter-snippets.js`). 라벨 옆에 한글 설명이 보이고, 한글로 쳐도 찾힙니다.

| 입력 | 제안 |
|---|---|
| `for`, `반복` | `for i in range(10):` + 들여쓴 본문 자리, `while True:` + `rate(60)` |
| `if`, `조건` | `if 조건:`, `elif 조건:`, `else:` |
| `random`, `무작위` | `import random`, `x = random.uniform(-5, 5)` |
| `리스트`, `목록` | `리스트 = []`, `리스트.append(값)` |
| `공`, `상자`, `빛` | `공 = sphere(...)`, `상자 = box(...)`, `빛 = local_light(...)`, `scene.lights = []` |
| `소리` | `음표("도", 0.3)`, `효과음("coin")`, `배경음악("adventure")` |
| `화면`, `배경` | `scene.range = 4`, `scene_background(색상['검정'])` |
| `출력`, `길이`, `정수`, `반올림` … | `print()`, `len()`, `int()`, `round()`, `min()`, `max()`, `sum()`, `abs()`, `float()`, `str()`, `range()` |
| `sin`, `cos`, `sqrt`, `pi` | `from vpython import *`로 함께 들어오는 math 이름 |
| `True`, `False`, `and`, `or`, `not`, `in`, `break` | 키워드 |

이 밖의 표준 라이브러리 이름은 넣지 않습니다. 엔진 내부 이름(`_`로 시작)은 어느 자리에서도 제안하지 않습니다.

## 어디에서 오는가

항목은 손으로 적지 않고 원본에서 읽습니다. 색·텍스처·음 이름·악기·목록·씬 속성은 `client/src/engine/vpython-api.py` 원문에서, 효과음·배경음악 이름은 `client/src/engine/sound-system.js`의 `SFX_MAP`·`BGM_PATTERNS`에서, 함수 설명·서명·인자는 `client/src/data/docs.js`에서 옵니다. 그래서 API에 색이나 효과음을 더하면 자동 완성에도 바로 나타납니다.

- 데이터: `client/src/engine/completion-data.js` (모듈 로드 때 한 번 만든다)
- 문맥 판별·Monaco 등록: `client/src/components/editor/vpylab-completions.js`
- 검사: `completion-data.test.js`는 python3가 있으면 실제 `vpython-api.py`를 실행해 이름 목록을 대조하고, `vpylab-completions.test.js`는 자리별 집합 선택을 검사합니다.

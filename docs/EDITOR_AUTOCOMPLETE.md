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
| 그 밖의 자리 | API 함수·객체와 한글 별칭. 함수는 괄호와 기본 인자가 든 스니펫 | `sphere(pos=vector(0,0,0), radius=1.0, color=color.white)` |

함수 스니펫은 인자마다 탭 정지가 있어 Tab으로 다음 인자로 옮겨 가며 값을 바꿉니다. 각 항목에는 한국어 한 줄 설명이 붙습니다.

## 어디에서 오는가

항목은 손으로 적지 않고 원본에서 읽습니다. 색·텍스처·음 이름·악기·목록·씬 속성은 `client/src/engine/vpython-api.py` 원문에서, 효과음·배경음악 이름은 `client/src/engine/sound-system.js`의 `SFX_MAP`·`BGM_PATTERNS`에서, 함수 설명·서명·인자는 `client/src/data/docs.js`에서 옵니다. 그래서 API에 색이나 효과음을 더하면 자동 완성에도 바로 나타납니다.

- 데이터: `client/src/engine/completion-data.js` (모듈 로드 때 한 번 만든다)
- 문맥 판별·Monaco 등록: `client/src/components/editor/vpylab-completions.js`
- 검사: `completion-data.test.js`는 python3가 있으면 실제 `vpython-api.py`를 실행해 이름 목록을 대조하고, `vpylab-completions.test.js`는 자리별 집합 선택을 검사합니다.

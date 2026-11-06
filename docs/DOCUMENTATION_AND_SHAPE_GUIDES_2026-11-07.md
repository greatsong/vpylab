# 문서 메뉴와 도형 만들기 가이드 — 2026-11-07

문서 메뉴 안에 **모양 만들기 가이드 8개**를 추가했습니다. 기존 API 88개와 해시 ID는 유지했으며, API·자체 확장·제공 함수를 구별했습니다. 새 최상위 메뉴나 학생용 AI 기능은 추가하지 않았습니다.

## 학생이 보게 되는 내용

| 가이드 | 직접 바꾸는 것 | 확인할 개념 |
|---|---|---|
| 모양 만들기 시작 | 공의 반지름 | 위치와 크기의 구별 |
| 늘이고 납작하게 | 타원체의 세 방향 크기 | 높이와 두께, 시점 |
| 방향과 길이 바꾸기 | 원기둥의 axis | 끝점 = pos + axis, 대각선 길이 |
| 부품 합쳐 내 모양 | 머리 위치, 전체 투명도 | compound, 흰 부품에 색 필터 적용 |
| 삼각형에서 지붕으로 | 단면 높이, 압출 깊이 | 닫힌 단면과 경로 |
| 반구와 돔 만들기 | 높이, 삼각형 분할 수 | 반구와 돔, 매끈함과 면 수 |
| 안이 빈 컵 만들기 | 높이, 벽 두께 | 구멍 있는 벽과 별도 바닥 |
| 표준과 자체 기능 | 출처 목록 확인 | 다른 환경에 옮길 때 확인할 차이 |

각 가이드는 **예상 → 실행 → 숫자 하나 변경 → 결과 설명** 순서입니다. 설명 답은 접어 두었으며, 다른 문서로 이동하면 다시 접힙니다. 기본 7개와 변형 13개, 총 20개 실행 프로그램을 제공합니다.

반구의 `make_dome`은 내장 API가 아니라 VPython으로 작성한 **제공 함수**입니다. 호출부를 먼저 보여 주고 원리를 읽을 함수 정의는 펼쳐 보도록 했습니다. 전체 코드 복사와 실습 열기에는 import와 함수 정의가 모두 포함됩니다. 제공 함수는 기존 창작 활동과 단일 원본을 공유합니다.

컵은 원기둥을 겹쳐 속을 비운 것처럼 보이게 하지 않습니다. `shapes.circle(radius, thickness)`로 구멍 있는 단면을 만들고, extrusion 벽에 얇은 cylinder 바닥을 더합니다. thickness는 반지름의 비율이며 바닥 높이와 구별해 설명했습니다.

## 표준과 VPyLab 기능 표시

본문에 `VPython API`, `VPyLab 확장`, `만들기 가이드`를 글자로 표시하고, 표준 함수에 추가한 인자는 표 안에서 별도 표시합니다. 확장 목록은 문서 메타데이터로 생성합니다.

- **표준**: compound, vertex, emissive, 카메라, 2D graph/gcurve/gdots/gvbars/ghbars, 3D text의 billboard 등입니다. 같은 이름을 지원한다는 뜻이며 완전한 화면 호환 선언은 아닙니다.
- **자체 확장**: 소리, 3D 차트, 한글 이름, 추가 색 이름, `scene_background`, `vector.clone`, `obj.attach_trail`, 이 앱의 `frame` 별칭입니다. 표준 `attach_trail(obj, ...)`와 구별했습니다. frame은 구형 VPython frame 전체 구현이 아닙니다.
- **혼합 항목**: 빛의 intensity, radio의 직렬화 가능한 value, 추가 텍스처 이름은 해당 인자만 확장으로 표시합니다. 표준 이름의 텍스처도 앱이 생성한 이미지이므로 모양 차이를 설명합니다.
- 표준 예제에서 자체 색 이름·scene_background·intensity를 제거했습니다. radio는 벡터를 value로 보내는 예제 대신 표준 콜백에서 공의 색을 직접 바꾸도록 수정했습니다.

기존 설명도 실제 구현과 대조했습니다. fov 기본값은 60도이며 예제에서는 pi/2로 변경해 차이가 보이게 했습니다. forward·center·follow는 autoscale을 유지하고 range·camera.pos/axis는 해제한다는 점, title/caption 오버레이, canvas 크기 조절, 색상 값을 바로잡았습니다.

## 이동과 사용성

문서 선택을 URL 해시와 연결해 뒤로/앞으로 가기를 지원합니다. 문서를 바꾸면 본문 스크롤과 검색어를 초기화합니다. 검색은 가이드 설명·변경 지시·확장 설명도 찾습니다.

실습은 같은 탭의 `/sandbox?doc=<id>`에서 열립니다. 상단에 문서 목록과 해당 문서로 돌아가기를 제공하며, 탭 안에서 수정한 초안을 복원합니다. 모바일 목록은 Escape·키보드 포커스 이동과 닫은 뒤 포커스 복귀를 지원합니다. 복사 버튼은 항상 보이며, 실제 성공 후에만 성공으로 표시합니다. 코드 표시에는 HTML 삽입을 사용하지 않습니다.

## 검증 중 발견한 원기둥·원뿔 오류

**원인:** Three.js CylinderGeometry/ConeGeometry는 중심을 원점으로 생성하지만, VPython은 pos를 밑면 중심/시작점으로 정의합니다. 기존 렌더러가 중심 기준 geometry를 그대로 배치해 양 끝이 각각 길이의 절반만큼 어긋났습니다. 예를 들어 `pos.y=3, axis.y=4`이면 3부터 7이어야 하는데 1부터 5로 그려질 수 있었습니다. 컵 바닥도 의도한 y=0..0.12 대신 중심 기준으로 배치됐습니다.

**수정:** 공유 geometry 생성 함수에서 로컬 y 방향으로 길이/2만큼 이동합니다. 편집기와 공유 HTML의 생성·radius 변경·axis/length 변경 재생성에 같은 함수를 적용했습니다. Python의 pos나 채점용 속성값을 보정하는 방식은 사용하지 않았습니다. arrow 내부 부품의 중심 배치에는 적용하지 않았습니다.

실제 geometry의 양 끝과 length/size 변경 후 compound의 색·투명도 적용을 검사했습니다. 빌드에서 압축된 함수로 만든 HTML도 열어 원기둥·원뿔 범위가 3..7인지 확인했습니다.

pyramid는 공식 문서상 pos가 중심이므로 같은 보정을 하지 않았습니다. 현재 직사각형 밑면을 정확히 표현하지 못하는 기존 기하 제약은 문서에 명시했습니다.

## Claude 회의와 채택 판단

사용자가 승인한 전체 소스 문맥의 사본을 로컬 3-way CLI 브리지로 제공했습니다. 키·인증 자료·학생 프로젝트·Git 이력은 제외했습니다. Claude가 모든 파일을 읽었다는 뜻은 아닙니다. 설계 회의는 읽기 10회, 구현 후 검토는 12회 안에서 수행한 **정적 검토**이며 실제 실행은 호스트가 담당했습니다.

| Claude 의견 | 반영·확인 |
|---|---|
| 기존 문서 안의 가이드 8개, 기존 ID 유지 | 채택 |
| 반구 함수 단일 원본, 컵은 표준 extrusion+바닥 | 채택 |
| 해시/스크롤/복사/모바일과 실행 경로 먼저 개선 | 채택, 브라우저 검증 |
| 함수 정의를 접으면 복사가 혼동될 수 있음 | 호출·제공 함수임을 표시하고 전체 복사·실습에 정의 포함, 실패 안내도 구별 |
| 다른 문서에도 펼친 정답·복사 상태가 남음 | 문서 ID로 본문을 다시 생성, 회귀 검사 |
| 검색 삭제 후 포커스 이탈 | 입력창으로 복귀, 회귀 검사 |
| 표준 그래프를 charts 범주로 오분류할 가능성 | 실제 범주는 graphs, 표준 유지 및 검사 추가 |
| 표준 텍스처 rock/wood_old 누락 가능성 | 공식 소스 대조 후 표준 목록 보완 |
| pyramid도 밑면 기준일 수 있다는 기억 | 공식 문서에서 중심임을 확인, 동일 보정 미적용 |
| 초안의 인증 초기화·계정 분리, primitive 수정은 읽지 못함 | 호스트의 브라우저 상태 전환 검사와 실제 geometry·공유 HTML 검사로 확인 |

구현 검토 결론은 **“읽은 범위에서는 P0/P1을 발견하지 못함”**입니다. 위 미확인 사항과 실행을 포함한 전체 승인으로 해석하지 않았습니다. [설계 회의 원문](collaboration/docs-design-claude-2026-11-07.json), [구현 검토 원문](collaboration/docs-implementation-claude-2026-11-07.json)을 보존했습니다.

## 검증 결과

| 검사 | 결과·범위 |
|---|---|
| 프론트 전체 회귀 | **67개 파일, 748개 검사 통과**, skip 없음 |
| 서버 내보내기·도형 응답 검증·증거 해시 | 10개 통과 |
| API·가이드 Python 프로그램 | 108개 통과: 기존 API 88 + 가이드 기본 7 + 변형 13 |
| 문서 브라우저 | 21개 시나리오 통과, 그 안에서 가이드 20개를 실제 Pyodide+Three.js로 실행 |
| 실제 도형 의미 | 돔 256면·닫힌 변·외향 법선·치수·분할 경계, 컵 중앙 광선은 벽을 지나 바닥 y=0.12에 닿음, 벽 위쪽은 y=1.6 |
| 반응형·접근·이동 | 너비 360/768/1280, 영어·다크, 뒤로 가기·스크롤·검색·복사 실패·Escape·포커스·초안 복원 통과 |
| 기존 창작 화면 | 반구·소리 버튼·팀 상태·복수 canvas 반복·helix·Rug 7개 통과 |
| 기존 이동·카메라·compound | 9개 통과: 초안 왕복·초기화·모바일·카메라 값과 세로 화면·실제 재질·극단 range |
| 공유 HTML | 소스 생성본 및 실제 production 빌드가 만든 HTML 양쪽 통과 |
| 확장 코퍼스 | 750개 중 Python 실행 697개 통과. 내장 자료는 344/344, 새 문서 사례는 108/108 |
| 정적 검사·빌드 | 변경 파일 lint 오류/경고 없음, production 빌드 통과, diff 공백 오류 없음 |

코퍼스의 나머지는 원본 오류 5, 빈 초안 2, timeout 1, 미지원 API 4, 실행 오류 2, Web VPython 전용 2, 불완전 호출 6, 미정의 문서 조각 22, 경고 4, 미지원 모듈 5입니다. Python 실행과 화면 일치를 구별하며 선택 브라우저 검사를 750개 전체의 화면 검증으로 확대하지 않습니다.

결과 JSON에는 소스 fingerprint를 남겼습니다. 정적 코퍼스·문서·창작·카메라 브라우저 결과가 같은 런타임 소스에 해당함을 확인했습니다. 전체 요약과 한계는 [검증 기록](collaboration/docs-validation-2026-11-07.json), 코퍼스 상세는 [자동 요약](../scripts/compat/out/summary.md)에 있습니다.

## 남은 범위

- **열린 컵 가이드의 shapes/구멍 있는 단면은 편집기에서 지원하며 현재 공유 HTML에서는 지원하지 않습니다.** 가이드에 이 제한을 표시했습니다. extrusion의 twist/smooth/xscale/yscale도 현재 geometry에 반영되지 않음을 명시했습니다.
- 계정 분리 검사는 백엔드 요청을 차단한 합성 로컬 인증 상태로 지연 초기화·계정 변경·로그아웃을 재현했습니다. 실제 OAuth 로그인이나 DB 저장 전체 검증은 아닙니다.
- 공유 HTML 검사는 설치된 동일 버전 Three.js/Pyodide를 사용해 CDN 가용성과 분리했습니다.
- 실제 API 비용을 쓰는 Solar 재평가나 학생용 AI 기능 활성화는 하지 않았습니다. 기본 학습은 AI 없이 진행합니다.
- 기존 큰 번들·동적 import 관련 빌드 경고는 남아 있습니다. 운영 배포는 하지 않았습니다.

## 화면 확인

[모바일 반구 가이드](review-figures/2026-11-07/docs-dome-mobile.png) · [데스크톱 가이드](review-figures/2026-11-07/docs-dome-desktop.png) · [영어·다크](review-figures/2026-11-07/docs-dome-english-dark.png) · [실제 컵 실행](review-figures/2026-11-07/docs-cup-runtime.png)

## 기준 원문

위치 의미는 [공식 cylinder 문서](https://www.glowscript.org/docs/VPythonDocs/cylinder.html)와 [pyramid 문서](https://www.glowscript.org/docs/VPythonDocs/pyramid.html)를 대조했습니다. 도형 조합은 [compound](https://www.glowscript.org/docs/VPythonDocs/compound.html)와 [extrusion](https://www.glowscript.org/docs/VPythonDocs/extrusion.html)을 기준으로 했습니다.

billboard는 [공식 text 문서](https://www.glowscript.org/docs/VPythonDocs/text.html), 표준 텍스처 이름은 [공식 GlowScript 소스](https://github.com/vpython/glowscript/blob/master/lib/glow/primitives.js), 벡터 복사는 [VPython 벡터 구현](https://github.com/vpython/vpython-jupyter/blob/master/vpython/vector.py)을 대조했습니다. 표준의 실제 지원 차이는 앱 문서의 별도 설명을 우선 확인합니다.

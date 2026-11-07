# 최종 변경·운영 검증 — 2026-11-07

## 배포한 기능

- 첫 화면: 기본 친구/프렌즈의 3D 회전·시점 복구, 캐릭터별 조명, 기본 접힌 위치/각도 XYZ·크기·밝기·색 조절.
- 내 메인: 현재 프로젝트의 코드 사본을 홈에 두고 명시적으로 실행. 문구·배경 변경. 기본 복구는 원본/사본을 보존. 브라우저의 계정별 설정이며 다른 기기와 동기화하거나 작품을 공개하지 않음.
- 캐릭터: ▶/■ 버튼으로 만두 주름·손전등 불빛·공구상자 뚜껑·분홍 친구 입 모션 반복/정지. 프렌즈 바운스 포함. 모션 감소는 자동 재생을 줄이고 직접 재생은 허용.
- AI 없는 자동 완성: 문서와 로컬 규칙으로 함수/인자/알려진 멤버/색/변수/함수를 제안. Tab 적용, Esc 닫기, Enter 줄바꿈. 값 자리의 변수를 `y=`처럼 바꾸지 않고 기존 단어의 철자·등호를 보존.
- 입력 중 작은 뜻 카드: 중1 기준 22개 단어, color/red 제외. sphere/radius/opacity/compound 등을 직접 타이핑하거나 완성할 때 그림·뜻·예시를 처음 두 번만 안내. 알겠어요로 즉시 생략. 입력 초점을 유지하고 다음 입력·스크롤·Esc·6초에 닫힘. 문서 사전은 수동으로 접고 펼침.
- 소리: 정지·닫기·화면 이동·오류·무응답 종료에서 예약음까지 정리. 정상 본문 종료 뒤 예약음이 남으면 정지 제공. 재실행 전 이전 음원을 정리. 극장 중복 실행과 정지 뒤 Worker 이벤트 큐 재개도 수정.

이 UI 도움·소리 확장은 VPyLab 자체 기능이며 VPython의 기본 문법·도형 속성을 바꾸지 않습니다.

## 원인과 검토 반영

기존 운영에서 정지 2.6초 뒤에도 Web Audio RMS가 0.01162로 남는 것을 재현했습니다. 기존 정지가 배경음만 처리하고, Worker와 오디오의 수명이 분리되어 있었으며, 정지 직후 소리 배치·입력 이벤트가 남는 문제를 함께 정리했습니다.

첫 화면 모션은 2.4초 뒤 원형으로 돌아오고 모션 감소 환경에서는 직접 재생도 막혀 변형을 놓치기 쉬웠습니다. 직접 반복 재생과 명확한 상태 표시로 보완했습니다.

Claude의 트레이닝 정지/재실행, 자동 완성 위치 인자·철자/등호·직접 입력 카드 지적을 반영했습니다. Gemini 4 Argon의 극장 pending 중복 실행, 정지 이벤트 큐, 코드 소스 교체, 숨긴 홈 문구·배경 보존 지적도 반영했습니다. 정적 모델 검토와 실제 브라우저 검증은 별개로 기록합니다. 임의 사용자 함수 반환형까지 분석하는 Python 언어 서버를 제공한다고 주장하지 않습니다.

## 검증

최종 로컬: 79개 파일/835개 단위 검사 통과, 린트 오류 0개(기존 LoadingScreen 경고 1개), 빌드 성공. 앞선 운영 9a46db9의 전체 CI도 통과했습니다. 최종 9db0494 CI 및 후속 모델 결과는 아래에 이어 기록합니다.

운영의 실제 Monaco/Pyodide/WebGL/Web Audio로 검증했습니다. 손님 코드 fixture와 브라우저 설정만 사용하고, 갤러리 재실행 검사는 API 응답·조회수 쓰기를 가로채 DB를 수정하지 않았습니다. 계정 격리는 단위 검사이며 이번 검증을 실제 계정 로그인 검사로 주장하지 않습니다. 스피커는 음소거 상태에서 실제 오디오 그래프의 신호와 노드 해제를 측정했습니다.

- 개인 메인 14개: [결과](collaboration/personal-home-final-production-2026-11-07.json)
- 캐릭터·선택형 문서 사전 15개: [결과](collaboration/motion-words-production-2026-11-07.json)
- 조명·보관한 홈 설정 보존 6개: [결과](collaboration/lighting-final-production-2026-11-07.json)
- 소리 종료 6개: [결과](collaboration/audio-stop-final-production-2026-11-07.json). 300ms/2.6초 후 모든 RMS 0, 혼합 음원은 8.6초 후에도 0.
- 극장·입력 큐 6개: [결과](collaboration/audio-queue-final-production-2026-11-07.json). 극장 실행 횟수 1, 정지 후 콜백이 재개되지 않고 새 실행에서는 정상 입력 가능.
- 트레이닝/갤러리 재실행 6개: [결과](collaboration/audio-restart-production-2026-11-07.json). 이전 활성 오실레이터가 모두 분리됨.
- 최종 편집기 25개: [배포 빌드 결과](collaboration/completion-25-built-2026-11-07.json). 앞선 직접 입력 운영 19개도 통과했고, 추가 경계 6개를 포함한 최종 운영 결과는 이어 연결합니다.

## 화면

- [직접 입력 뜻 카드](review-figures/2026-11-07/literal-typing-sphere-reviewed.png)
- [만두 변형](review-figures/2026-11-07/dumpling-action-production.png)
- [손전등 불빛](review-figures/2026-11-07/flashlight-action-production.png)
- [공구상자 모션](review-figures/2026-11-07/toolbox-action-production.png)
- [분홍 친구 입 모션](review-figures/2026-11-07/kirby-action-production.png)

사용법은 [사용 안내](USER_GUIDE_KO.md), 세부 원인은 [소리/조명 보고](AUDIO_STOP_AND_STAGE_LIGHTING_2026-11-07.md), [입력 도움/모션 보고](WORD_TIPS_AND_HOME_ACTIONS_2026-11-07.md)에 기록했습니다.

## 마지막 경계 검토 반영

Gemini 4 Argon의 마지막 정적 검토에는 P1/P2 지적이 없었습니다. Claude가 지적한 다섯 입력 경계는 다음처럼 반영했습니다.

| 지적 | 최종 동작과 실제 확인 |
|---|---|
| sphere_count·box1·position에서 부분 단어 카드 | 같은 식별자가 이어지면 후보를 지우고 안내 횟수도 소비하지 않음 |
| 빠르게 완성한 함수와 인자 목록 | sphere()의 입력이 끝나면 카드, 인자 목록을 고르는 동안에는 목록을 우선하고 겹치지 않음 |
| radius 변수와 radius= 인자가 함께 있는 경우 | 아직 삽입할 문자가 있는 같은 이름 후보가 하나라도 있으면 목록 유지 |
| 값 변수의 Tab 완성 후 카드 유실 | 키워드 뒤의 값만 바꾸면 후보를 보존하고 해당 키워드 뜻 표시 |
| 모르는 멤버의 문서 단어 fallback | 일반 문서 단어 제안은 끄고, 명시적 변수·함수·인자·멤버 제공. 튜플·연쇄·세미콜론 대입도 포함 |

마우스로 코드 중간을 수정하거나 커서를 옮겼을 때 이전 타이핑의 예약 카드가 완성 목록을 닫지 않도록 현재 커서 위치도 확인합니다.

- [Claude의 입력 경계 지적](collaboration/completion-boundary-review-claude-2026-11-07.json)
- [Gemini 4 Argon 정적 검토](collaboration/completion-boundary-review-gemini-2026-11-07.json)
- [실제 운영 입력 카드](review-figures/2026-11-07/typing-card-production.png)
- [웹 사용 안내 확인](collaboration/guide-production-proof-2026-11-07.json)

## 영문판 최종 점검 후속

이 문서의 이전 SHA·검사 수는 해당 배포 시점의 기록입니다. 이후 조명 선택 카드·전체 영문 UI/기초 교재·공유 소스의 언어 전환 보존·명시적 대기형 소리 도우미를 반영했습니다. 최신 소스·검토·운영 검증은 [영문판 최종 점검](FINAL_ENGLISH_RELEASE_2026-11-07.md)을 확인하세요.

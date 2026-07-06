# VPyLab 전체 기능 점검 및 개선 방안 심층 보고서

**점검일**: 2026-07-06
**점검 방법**: ① 자동 검증(vitest 157개 테스트 / eslint / vite build) ② 브라우저 런타임 QA(홈·샌드박스 실행·미션·갤러리·문서·로그인) ③ 4개 영역 병렬 심층 코드 리뷰(엔진 / 프론트엔드 상태관리 / 서버·보안·RLS / 기능 인벤토리·문서 정합성)

---

## 1. 총평

VPyLab은 **엔진·콘텐츠·협업 기능이 계획을 초과 달성한 상태**입니다. 미션 54개(계획 50), VPython API v3 Tier 3까지 구현, 테스트 157개 전원 통과, 빌드 성공, 런타임에서 3D 실행·미션·갤러리·문서·로그인 모두 정상 동작을 확인했습니다.

그러나 심층 리뷰에서 다음 **3대 구조적 공백**과 **1건의 critical 버그(실증 확인)**가 발견됐습니다.

1. **critical 버그**: `time.sleep(1)`이 전처리기에서 `time.await sleep(1)`로 변환되어 SyntaxError 발생 — 학생들이 매우 자주 쓰는 패턴
2. **인증 공백**: 서버 GitHub 프록시 엔드포인트에 Supabase 사용자 검증이 없어 서버가 GitHub API 증폭기로 악용 가능
3. **i18n 허상**: 언어 키는 ko/en 241개 완전 동기화이나 실제 적용률이 낮아 영문 모드에서 상당 부분 한국어 표시 — "전 세계 학교" 비전과의 최대 격차
4. **AI 힌트 부재**: PLAN.md의 핵심 차별점인 AI 힌트가 코드에서 통째로 제거됨(`server/routes/ai.js` 삭제) — 의도적이라면 계획 문서 갱신 필요

---

## 2. 자동 검증 및 런타임 QA 결과

| 항목 | 결과 |
|---|---|
| vitest | **7파일 157개 전원 통과** (3.1s) |
| eslint | 오류 0, 경고 6 (react-hooks/exhaustive-deps) |
| vite build | 성공. 단 **monaco 청크 4.2MB(gzip 1.08MB)** — 코드 스플리팅 여지 |
| 홈 / 미션(54개) / 갤러리 / 문서 / 로그인 모달 | 정상 렌더링, 콘솔 오류 0, 실패 네트워크 요청 0 |
| 샌드박스 Python 실행 | Pyodide 로딩 → 실행 → 3D 구 렌더링 → 정지 정상 |
| 모바일 폭 /docs | **UX 결함**: 사이드바가 숨겨진 채 "왼쪽에서 항목을 선택하세요"만 표시(플로팅 버튼 존재하나 안내 문구와 불일치) |

---

## 3. Critical / High 오류 목록

### 3.1 [CRITICAL — 실증 확인] 전처리기가 `time.sleep()`을 깨뜨림
- 위치: `client/src/engine/code-preprocessor.js:102` (+ `export-html.js`의 동일 정규식)
- `(?<!\w)` lookbehind가 `.`을 제외하지 못해 `time.sleep(1)` → `time.await sleep(1)` (SyntaxError).
- 실제 실행으로 재현 확인함. 한글 함수명(`내악기(...)` 등)도 동일 원리로 오탐.
- **수정**: lookbehind를 `(?<![\w.])`로 확장. 한글 오탐은 `[\w.가-힣]` 고려. export-html.js 정규식 2곳 동반 수정.

### 3.2 [HIGH·보안] GitHub 프록시 엔드포인트의 서버측 인증 부재
- 위치: `server/routes/projects.js`(`/setup`, `/commit`), `sync.js`(`/github`), `publish.js`
- `githubToken`만 검증하고 요청자가 VPyLab 로그인 사용자인지·프로젝트 멤버인지 확인하지 않음. 임의 GitHub 토큰 소지자가 서버를 경유해 repo 생성/커밋 가능.
- **수정**: Supabase access token 검증(`auth.getUser()`) + `vpylab_project_members` 멤버십 확인. 이미 올바른 패턴이 `/members/github-usernames`에 존재하므로 재사용.

### 3.3 [HIGH·데이터 손실] 로그아웃 시 스토어 미정리 — 공용 PC 컨텍스트 유출
- 위치: `client/src/stores/authStore.js:187-190, 69-71`
- 로그아웃해도 activeProject·Realtime 채널·savedCodes가 남아, 학교 공용 PC에서 다음 학생에게 이전 학생의 프로젝트가 노출되고 잘못된 대상으로 저장 시도 가능.
- **수정**: `signOut`/`SIGNED_OUT`에서 projectStore.closeProject(), codeStore 초기화, Realtime 구독 해제.

### 3.4 [HIGH·데이터 손실] `deleteProject` 삭제 순서 — 코드 먼저 삭제 후 프로젝트 삭제 실패 시 복구 불가
- 위치: `client/src/stores/projectStore.js:1331-1361` (미커밋 변경분)
- **수정**: FK `ON DELETE CASCADE` 또는 RPC 트랜잭션으로 서버측 이동. 최소한 순서 역전 + `withTimeout` 적용.

### 3.5 [HIGH·조용한 유실] autoSave 오류가 화면에 표시되지 않음 + INSERT 경합 중복 행
- 위치: `client/src/stores/codeStore.js:245-288`, `Sandbox.jsx:1171-1173`
- `saveStatus: 'error'`를 렌더링하는 분기가 없어 저장 실패를 사용자가 모른 채 이탈 → 코드 유실. debounce 경합으로 "자유 코딩" 중복 행 생성 가능.
- **수정**: error 상태 표시("자동 저장 실패 — 수동 저장 필요") + in-flight 가드.

### 3.6 [HIGH·VPython 호환] `obj.pos.x += 1`이 화면에 반영 안 됨
- 위치: `client/src/engine/vpython-api.py` (vector에 owner backref 없음)
- 실제 VPython에서 가장 흔한 교육 패턴 중 하나가 무반응. 학생 혼란 요인.
- **수정**: 객체 속성 vector에 `_on_change` 콜백 부착.

### 3.7 [HIGH·VPython 호환] `arrow.axis` 갱신 시 길이가 안 변함
- 위치: `client/src/engine/vpython-bridge.js:801-806`
- 힘 벡터/용수철 시뮬레이션 핵심 패턴이 회전만 되고 길이 미반영. helix는 기준축까지 어긋남(90°).
- **수정**: cylinder/cone/arrow axis 갱신 시 geometry 재생성 또는 축방향 scale.

### 3.8 [HIGH·누수] trail/curve 갱신마다 GPU 버퍼 재생성 — VRAM 누수 + O(n²)
- 위치: `vpython-bridge.js:631-644, 872-895` + export-html.js 동일 패턴
- **수정**: maxPoints 사전 할당 + `setDrawRange` + ring buffer.

### 3.9 [HIGH·내보내기 불일치] export HTML에서 깨지는 기능들
- 이번 미커밋 box 기능(length/axis/up) 미반영 → 내보내면 1×1×1 상자로 렌더링 (`export-html.js:545, 1119-1129`)
- 한글 음악 API `음표()`/`악기()`가 export에서 **무음** (await 변환 정규식에 `악기` 누락, `export-html.js:883,893`)
- 기본 radius 불일치(메인 1.0 vs export 0.5), `ellipsoid.size` 갱신 시 상자로 변신, label text 갱신 미지원
- **근본 해결**: 파일 헤더 TODO대로 `vpython-api.py?raw` 임포트로 클라이언트/서버/export 3중 유지보수 제거.

### 3.10 [HIGH·검증 필요] Worker에서 `delete self.fetch` 후 micropip 동작 여부
- `pyodide-worker.js:199` fetch 삭제 후 numpy 자동 설치(`loadPackage`)가 프로덕션에서 동작하는지 미확인. 동작한다면 역으로 fetch 차단이 불완전하다는 의미이므로 어느 쪽이든 점검 필요.

---

## 4. Medium 이슈 (요약)

**프론트엔드**
- `removeMember`/`setMemberRole`이 projectId 확인 없이 `activeMembers` 수정 → 다른 프로젝트 멤버 목록 오염 (`projectStore.js:1126-1152`) — 한 줄 수정 (`regenerateInviteCode` 패턴 재사용)
- `createProject` 타임아웃 후 늦게 완료된 insert가 고아 프로젝트로 잔존 → RPC 트랜잭션화 또는 클라이언트 UUID 선지정
- `?team=` 초대 링크: 확인 없이 에디터 코드 교체 + URL 파라미터 미제거로 새로고침마다 재합류
- 초대 합류 실패 메시지가 오버레이에 가려진 콘솔에만 출력
- `onAuthStateChange` 콜백 내 `await upsertProfile` — supabase-js auth lock 교착 위험 (공식 문서 경고 사항)
- MissionPlay 저장 코드 로드 경합(늦은 로드가 타이핑 덮어씀) + autoSave deps 누락
- `fetchMyProjects` 실패가 빈 목록으로 위장 → "프로젝트가 다 사라졌다"로 오인
- Realtime 구독 실패/재연결 처리 없음 → 팀원 저장 알림 조용히 중단
- `repoLoadStatus === 'error'` 후 자동 저장 영구 차단 (`Sandbox.jsx:253-258`)

**서버/인프라**
- 전역 에러 핸들러 부재 + `NODE_ENV=production` 미설정 → 스택 트레이스 노출 가능
- CORS `ALLOWED_ORIGINS` 빈 문자열 시 전체 차단 사고 가능 → trim/filter(Boolean) 처리
- `vpylab_shares` anon INSERT 정책이 열려 있음(서버 경유만 의도라면 제거)
- 에러 응답에 `e.message` 원본 노출 다수
- rate-limit이 IP 기준 — 학교 NAT에서 학생들이 서로 한도 소진 → 인증 키 병행
- 민감정보 검사(`checkSensitiveContent`)가 경고만 하고 발행 차단 안 함 — 학생 이메일이 GitHub Pages에 공개될 수 있음

**엔진**
- `_coerce_vector`가 사용자 vector와 내부 상태 aliasing (`b.length = 8`이 사용자 변수까지 변경)
- `gcurve()`가 "가장 최근"이 아닌 "가장 오래된" graph에 부착
- `clearScene`이 텍스처(map)·`distant_light.target` 미정리 → 실행 반복 시 누적
- pointermove마다 전체 raycast + Worker 메시지 → 이벤트 미사용 시에도 발생, 스로틀 필요
- graph2d `Math.min(...spread)` — 12만 점 이상에서 스택 오버플로
- 텍스처 URL이 사용자 코드발 네트워크 사이드채널(`texture="https://..."`) → allowlist 검토

---

## 5. 기능 완성도 및 계획 대비 공백

| 기능 | 상태 |
|---|---|
| 샌드박스 IDE / 미션 54개 / 코스 7개 / 예제 / 문서 / 갤러리 / 팀·GitHub 연동 / 공유 / 테마 9종 | **완성** |
| HTML 내보내기 | 부분 — 위젯·2D그래프·이벤트 스텁(의도적), 3.9의 불일치는 버그 |
| i18n | 부분 — 키 241/241 동기화이나 Guide·Gallery·Courses·스토어 계층 등 하드코딩 한글 600여 줄 |
| **AI 힌트 (Solar Pro 3)** | **부재** — PLAN 핵심 차별점인데 코드에서 제거됨 |
| AI 카테고리 미션 (AI-1~8) | 0/8 |
| GOVERNANCE.md | 미작성 (4대 거버넌스 문서 중 유일) |
| Google OAuth Provider | 미설정 (GitHub만 완료) |
| matplotlib 이미지 렌더링 | 미구현 (micropip 설치만 가능) |
| Service Worker Pyodide 캐싱 | 미구현 — PLAN에서 "학교 네트워크 필수"로 명시 |
| submissions 서버 라우트 | 주석 처리 상태 (`server/index.js:53`) |

**문서 부패(코드보다 뒤처짐)**: CLAUDE.md "2종 테마"(실제 9종), PROGRESS.md "미션 16개"(실제 54), "120 테스트"(실제 157), 삭제된 ai.js 기록 잔존. `textures` 프리셋·`파스텔` NamedList는 구현됐으나 VPYTHON_API.md 미문서화.

**접근성**: aria-* 총 37건/11파일, 주요 페이지 0건. `index.html lang="ko"` 고정(언어 전환 시 미갱신). Suspense 폴백 "로딩 중..." 하드코딩.

---

## 6. 우선순위 로드맵 (권장)

### P0 — 즉시 (학생 대면 버그 + 보안)
1. 전처리기 `(?<![\w.])` 수정 + 회귀 테스트 (3.1) — **몇 줄 수정**
2. GitHub 프록시 인증 검증 추가 (3.2)
3. 로그아웃 스토어 정리 (3.3)
4. autoSave 오류 표시 + in-flight 가드 (3.5)
5. `removeMember`/`setMemberRole` projectId 가드 — 한 줄
6. `NODE_ENV=production` + 전역 에러 핸들러

### P1 — 단기 (호환성 + 데이터 무결성)
7. `obj.pos.x` 반응성 (3.6), arrow/cylinder axis 길이 (3.7)
8. deleteProject/createProject 트랜잭션화 (3.4, RPC 또는 CASCADE)
9. export-html 동기화 — `?raw` 임포트 리팩터링으로 근본 해결 (3.9)
10. micropip/fetch 검증 (3.10), trail ring buffer (3.8)
11. `?team=` 초대 플로우 다듬기 (confirm + URL 정리 + 오류 표시)

### P2 — 중기 (제품 완성도)
12. i18n 실적용 확대 (Guide/Gallery/Courses/스토어 에러 메시지 code 기반화) — 글로벌 비전의 최대 격차
13. AI 힌트 방침 결정: 재구현 또는 PLAN/PROGRESS에서 공식 제거
14. Service Worker Pyodide 캐싱 (학교 네트워크 필수 요건)
15. monaco 청크 분리/지연 로딩 (초기 로딩 개선)
16. Realtime 재연결, rate-limit 인증 키, 접근성(aria/lang)

### P3 — 장기
17. AI 카테고리 미션 8종, GOVERNANCE.md, Google OAuth, matplotlib 렌더링, submissions 라우트
18. 문서 부패 일괄 정리 (CLAUDE.md/PROGRESS.md/VPYTHON_API.md)

---

## 7. 미커밋 변경분(8파일, +714/-168)에 대한 판정

box axis/up/length 지원, 팀 모달 로컬 상태 분리, createProject 타임아웃 등 **방향은 전반적으로 개선이며 수학(Gram-Schmidt 직교화)도 정확**합니다. 단 커밋 전 다음 보완 권장:
- export-html.js에 box 신기능 동기화 (3.9)
- `_coerce_vector` clone 처리 (aliasing)
- `removeMember` projectId 가드 (이번 변경으로 노출된 신규 버그)
- axis 영벡터/평행 케이스 테스트 추가

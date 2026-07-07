# VPyLab E2E 검증 매뉴얼

**최종 갱신**: 2026-07-07 (2026-07-06 초판 전면 개정)
**목적**: 2026-07-06~07 세션의 모든 수정(서버 인증, 팀 멤버십 강화, 오픈소스 루프, 크기 버그, 학급 대시보드)이 **실환경에서 실제로 동작하는지** 검증한다.
**대상**: 새 Claude Code 세션 또는 사람 검증자. 이 문서만으로 실행 가능.
**소요 시간**: 약 20~25분 (GitHub 계정 2~3개 준비 시)

> **Claude 세션에게**: 프로덕션이 이미 배포되어 있으므로 **프로덕션 URL 기준으로 검증**하는 것이 기본이다(아래 §1). 로컬로 돌리려면 서버는 Bash `cd server && PORT=4034 node index.js`(run_in_background), 클라이언트는 preview_start `vpylab-client`. GitHub OAuth·발행 등 실계정 단계는 사람만 할 수 있으니, 해당 단계에서 사용자에게 브라우저 조작을 요청하고 완료를 기다린 뒤 진행하라. 각 단계의 ✅는 preview_snapshot/console_logs/network 또는 curl로 확인하고, ❌면 §5 진단을 따르라. **curl로 자동 검증 가능한 단계(STEP 0·A1·A2)는 사람 없이 먼저 끝내라.**

---

## 0. 현재 상태 (2026-07-07 기준)

**이미 완료되어 재확인만 하면 되는 것**:
- ✅ **DB 마이그레이션 014·016·017 프로덕션 적용 완료** (CLI로 적용·검증됨). 추가 SQL 실행 불필요.
- ✅ **서버(Railway)·클라이언트(Vercel) 최신 커밋 배포 완료**, `NODE_ENV=production` 설정됨.
- ✅ **Supabase 협업/권한 계층은 4계정 자동 시뮬레이션으로 20/20 통과** (→ [TEAM_COLLABORATION_FLOW.md](TEAM_COLLABORATION_FLOW.md)).
- ✅ **크기 버그(박스/구/실린더/axis)는 브라우저 실행으로 검증 완료** (→ 아래 STEP A1은 재확인용).
- ✅ **학급 대시보드 엔드포인트·C-1 우회 차단은 로컬 HTTP 통합 테스트로 9/9 통과**.

**이 매뉴얼이 남기는 것 = 실계정 GitHub OAuth가 필요해 자동화 못 한 부분**: repo 자동 생성·커밋·collaborator 초대·Pages 발행·Fork. STEP B/C 계열.

### 이번에 반영된 주요 변경 요약
| 영역 | 변경 |
|---|---|
| 보안 | GitHub 프록시 전 엔드포인트에 Supabase 인증(`Authorization: Bearer`) 필수. `/commit`·`/sync/github`는 멤버십까지 강제(**C-1 우회 차단**: projectId 생략+repoFullName만으로 우회 불가). `/access`·`/collaborators/*`도 인증 필수(**H-1**). |
| DB 보안 | **마이그레이션 017**: code_revisions INSERT RLS 소유권 우회 차단(외부인이 남의 코드 이력 위조 불가). |
| 오픈소스 루프 | Fork→"갤러리에 공개하기"→원작 remix_count 증가, 발행 부분 성공(`githubPending`), `/commit` 시 갤러리 코드 동기화, repo 소실 스냅샷 폴백, attribution 스냅샷(016). |
| 크기 | 박스 length/height/width·axis/up, arrow/cylinder/cone/helix의 axis 갱신 시 **길이 반영**, 내보내기 HTML의 기본 radius·박스 치수·ellipsoid·axis 일치. |
| 엔진 | `time.sleep()` SyntaxError 수정, gcurve 최신 그래프 부착, 텍스처/광원 누수 정리. |
| 교사 도구 | 대시보드 "팀 프로젝트" 탭 + `/api/projects/class-overview`(교사 소유권 검증 후 팀별 기여도 집계). |
| 스토어 | 로그아웃 정리, autoSave 오류 표시, `?team=` 초대 confirm+URL 정리, Realtime 재구독. |

---

## 1. 대상 환경

| | 프로덕션 (기본) | 로컬 (대안) |
|---|---|---|
| 프론트 | https://vpylab.vercel.app | http://localhost:4033 |
| 서버 | https://vpylab-server-production.up.railway.app | http://localhost:4034 |

아래 단계에서 `<FRONT>`, `<SERVER>`를 위 값으로 치환. 로컬로 검증하려면 `.env`에 SUPABASE_URL·SUPABASE_SERVICE_ROLE_KEY 필요.

**계정 준비**: A(리더/owner), B·C(팀원). 최소 A·B 2개면 되고, 3인 팀 전체를 보려면 C까지. B·C 창은 시크릿 창 사용.

---

## 2. 자동 검증 (사람 불필요 — 먼저 실행)

### STEP 0 — 인증 미들웨어 스모크
```bash
S=https://vpylab-server-production.up.railway.app
# 쓰기 엔드포인트(POST)는 무토큰이면 401 auth_required 여야 정상
for ep in projects/commit publish sync/github; do
  echo -n "$ep -> "; curl -s -X POST "$S/api/$ep" -H 'Content-Type: application/json' -d '{}' --max-time 10; echo
done
# 대시보드 엔드포인트(GET)도 무토큰 401
echo -n "class-overview -> "; curl -s "$S/api/projects/class-overview?classId=x" --max-time 10; echo
# 없는 경로는 404 핸들러
echo -n "404 -> "; curl -s "$S/api/nope" --max-time 10; echo
```
- ✅ 세 POST 엔드포인트 + class-overview 모두 `{"error":"로그인이 필요합니다.","code":"auth_required"}`
- ✅ 없는 경로 → `{"error":"요청한 경로를 찾을 수 없습니다."}` (404 핸들러)

> 위 curl 결과는 2026-07-07 프로덕션에서 실제로 확인됨.

### STEP A1 — 크기 렌더링 (박스 = 핵심 이슈) *(preview 또는 브라우저)*
`<FRONT>/sandbox`에 접속해 엔진 "Ready" 후 아래를 붙여 실행:
```python
from vpython import *
b1 = box(pos=vector(-5,2,0), length=4, height=0.5, width=1, color=color.red)       # 치수
b2 = box(pos=vector(0,2,0), size=vector(3,1,1), axis=vector(1,1,0), color=color.green)  # 회전
b3 = box(pos=vector(5,2,0), color=color.blue); b3.length = 3; b3.height = 0.3       # 실행 중 치수 갱신
b4 = box(pos=vector(0,-2,0), length=4, height=0.4, width=0.4, color=color.orange); b4.axis = vector(0,1,0)  # 실행 중 회전
ar = arrow(pos=vector(-3,-3,0), axis=vector(1,0,0), color=color.cyan); ar.axis = vector(0,3,0)  # axis 길이 반영
print('b1', b1.size, '| b3', b3.size)
```
- ✅ b1은 4×0.5×1 납작한 막대, b2는 45° 기울어짐, b3는 실행 중 3×0.3으로 변형, b4는 세로로 섬, ar 화살표는 길이 3으로 늘어남
- ✅ 콘솔에 `b1 <4, 0.5, 1> | b3 <3, 0.3, 1>` 출력 (Python 값과 화면 일치)

### STEP A2 — time.sleep 회귀 *(preview 또는 브라우저)*
```python
from vpython import *
import time
ball = sphere(color=color.orange)
time.sleep(0.3)
ball.pos = vector(1,0,0)
print('ok')
```
- ✅ **SyntaxError 없이 실행**되고 `ok` 출력 (수정 전에는 `time.await sleep`으로 깨졌음)

---

## 3. 로그인·개인 기능 (계정 A)

### STEP B1 — GitHub 로그인
1. 헤더 "로그인" → "GitHub로 로그인" → OAuth 완료 *(사람)*
- ✅ 헤더에 프로필 표시, 콘솔 오류 0

### STEP B2 — 팀 프로젝트 생성 + repo 자동 생성
1. 샌드박스 "📁 프로젝트" → 새 프로젝트 (GitHub 연동 켜기)
- ✅ 생성 성공, 툴바에 프로젝트 제목
- ✅ 잠시 후 GitHub에 `vpylab-<slug>` repo 생성 (github.com 확인)
- ❌ 401 → 진단 A / 403 → 진단 B

### STEP B3 — 저장 → GitHub 커밋
1. 코드 수정 후 "💾 저장" (커밋 메시지 입력)
- ✅ 저장 성공. repo에 main.py 커밋 + history.md 갱신
- ✅ "📜 저장 이력" 패널에 새 리비전 표시

### STEP B4 — autoSave 오류 표시
1. DevTools Network를 Offline으로 두고 코드 타이핑 후 몇 초 대기
- ✅ 툴바에 "⚠️ 자동 저장 실패 — 수동 저장해주세요" (수정 전 무표시)
2. Online 복귀

### STEP B5 — 갤러리 발행
1. "갤러리에 올리기" → 제목/카테고리 → 발행
- ✅ 갤러리에 작품 표시, Pages URL 존재 (Pages 활성화 1~2분 지연 가능 — 404여도 이 단계는 정상)

---

## 4. 팀 협업 + 오픈소스 루프 (계정 A + B[+C])

### STEP C1 — 팀원 합류
1. A: 프로젝트 패널에서 초대 코드/링크 복사
2. B(시크릿): 로그인 후 `<FRONT>/sandbox?team=<코드>` 접속
- ✅ 에디터에 비기본 코드가 있으면 **교체 확인 대화상자**
- ✅ 합류 후 URL에서 `?team=` 제거됨 (새로고침해도 재합류 안 함)
- ✅ 잘못된 코드면 팀 패널에 오류 표시 (숨은 콘솔 아님)
3. (3인) C도 동일하게 합류

### STEP C2 — collaborator 초대 + 팀원 저장
1. A: 팀 패널에서 B(·C)의 GitHub username으로 collaborator 초대
2. B: GitHub 알림에서 초대 **수락** *(사람)*
3. B: 코드 수정 후 저장
- ✅ 수락 전이면 "GitHub 반영 보류"(github_permission_required) 안내가 뜨고 VPyLab 저장은 성공 — **설계된 우아한 실패**
- ✅ 수락 후 저장하면 repo에 B 명의 커밋
- ❌ 403 `not_project_member` → 진단 B (B가 팀 멤버로 안 잡힘)
4. A 창: ✅ "팀원이 저장했습니다" Realtime 알림

### STEP C3 — 갤러리 코드 동기화
1. A: 프로젝트 코드를 눈에 띄게 수정(색상 등) 후 저장
2. 갤러리 → 해당 작품 상세 → "코드 보기"
- ✅ **방금 수정한 최신 코드**가 보임 (수정 전엔 발행 시점 스냅샷)

### STEP C4 — Fork → 갤러리 공개 (오픈소스 루프)
1. B: 갤러리에서 A의 작품 상세 → "Fork"
- ✅ 비공개 초안 생성
2. 갤러리 목록 "내 작품"에 Fork본이 **"비공개" 뱃지**와 함께 표시
3. Fork본 상세 → **"갤러리에 공개하기"**
- ✅ 공개 전환
4. A의 원작 상세 새로고침
- ✅ **Remix 카운트 +1**, Remix 목록에 Fork본, Fork본에 "원작: <제목> by <작성자>"

### STEP C5 — attribution 보존
1. A: 원작을 갤러리에서 삭제
2. Fork본(B) 상세 새로고침
- ✅ "원작: <제목> by <작성자> (삭제됨)" 표시 (016 적용됨 → 정상)

### STEP C6 — 로그아웃 정리 (공용 PC)
1. A 창: 프로젝트를 연 채 로그아웃
- ✅ 툴바에서 프로젝트 제목 사라짐
2. 같은 창에서 B 로그인
- ✅ 이전 계정 프로젝트/코드 안 보임

---

## 5. 교사 학급 대시보드 (교사 계정)

> 사전조건: 교사 계정(profile.role='teacher') + 학급 생성 + 학생이 학급 소속 + 학생이 팀 프로젝트 참여. STEP C를 마친 A·B가 한 학급 학생이면 그대로 사용 가능.

### STEP D1 — 팀 프로젝트 기여도
1. 교사 로그인 → `<FRONT>/dashboard` → **"팀 프로젝트" 탭**
- ✅ 학급 선택 시 학생들이 참여한 팀 프로젝트 카드가 뜨고, 팀원별 **기여도 막대(리비전 수)**, 최근 활동, 리더 뱃지 표시
- ✅ 다른 교사의 학급 ID로 접근 불가(서버 403 `not_class_teacher`)

---

## 6. 진단 (실패 시)

**진단 A — 401 `auth_required` (B2/B3/B5 등)**
- DevTools Network에서 해당 요청에 `Authorization: Bearer …` 헤더가 있는지 확인. 없으면 구버전 클라이언트 캐시 → 강력 새로고침(Cmd+Shift+R).
- 세션 만료면 재로그인.

**진단 B — 403 `not_project_member` (B3/C2)**
- 저장자가 실제 팀 멤버인지 확인:
  `SELECT role FROM vpylab_project_members WHERE project_id='<id>' AND user_id='<uid>';`
- 소유자(A)인데 막히면 `vpylab_projects_add_owner_member` 트리거(마이그레이션 010) 확인.
- **주의(C-1 수정 반영)**: 이제 `projectId`를 생략하고 `repoFullName`만 보내도 서버가 repo→프로젝트 역조회로 멤버십을 강제한다. 비멤버가 팀 repo에 커밋 시도하면 403이 **정상**이다.

**진단 C — GitHub 커밋 미반영**
- 서버 로그 `[projects/commit]` 확인. `github_auth_required`/`blocked`면 GitHub 재로그인 후 **다음 명시적 저장** 때 대기열이 재시도됨(프로젝트를 다시 여는 것만으로는 permission-blocked 잡은 재시도 안 함 — 한 번 더 저장 필요).

**진단 D — C3에서 갤러리 코드가 옛날 것**
- 서버 로그 `갤러리 코드 동기화 실패` 확인. 프로덕션은 `github_last_synced_at`(014) 적용 완료 상태이므로, 발생 시 갤러리 row의 `project_id`가 프로젝트와 연결됐는지 확인.

**진단 E — Remix 카운트 안 오름 (C4)**
- 이미 공개했던 작품 재공개는 증가 안 함(중복 방지) = **정상**. 새 Fork로 재시도.

**진단 F — D1에서 팀 프로젝트가 안 보임**
- 학생이 실제로 팀 프로젝트 멤버인지, 학생 profile.class_id가 해당 학급인지 확인. `/api/projects/class-overview`는 교사 소유 학급만, 그 학급 학생이 속한 팀만 집계한다.

---

## 7. 결과 기록

각 STEP ✅/❌ 기록. ❌면 진단 결과와 함께 보고. 전 단계 ✅면 **"VPyLab E2E(인증·팀협업·오픈소스루프·크기·대시보드) 검증 통과"**로 판정.

이미 자동 검증된 계층(STEP 0·A1·A2 및 Supabase 협업 시뮬레이션)은 재확인이 빠르고, 나머지(B/C/D)는 실계정 GitHub OAuth가 필요한 수동 검증이다.

## 관련 문서
- [TEAM_COLLABORATION_FLOW.md](TEAM_COLLABORATION_FLOW.md) — 3인 팀 플로우 설계 + Supabase 계층 자동 검증(20/20) + 발견·수정한 RLS 취약점(017)
- [OPENSOURCE_FLOW_REVIEW_2026-07-06.md](OPENSOURCE_FLOW_REVIEW_2026-07-06.md) — 오픈소스 순환 분석
- [AUDIT_REPORT_2026-07-06.md](AUDIT_REPORT_2026-07-06.md) — 전체 감사

# VPyLab GitHub 공동 프로젝트 E2E 검증 매뉴얼

**목적**: 2026-07-06~07 수정분(서버 인증 추가, 오픈소스 루프 완성, 스토어 버그 수정)이 **실계정 환경에서 실제로 동작하는지** 브라우저로 검증한다.
**대상**: 새 Claude Code 세션 또는 사람 검증자. 이 문서만으로 실행 가능하도록 작성됨.
**소요 시간**: 약 15~20분 (2개 GitHub 계정 준비 시)

> Claude 세션에게: 이 매뉴얼을 실행할 때는 preview 도구(preview_start → `vpylab-client`)로 클라이언트를 띄우고, 서버는 Bash로 `cd server && PORT=4034 node index.js` (run_in_background)로 띄워라. 로그인 등 OAuth 단계는 사람이 해야 하므로, 해당 단계에서 사용자에게 브라우저 조작을 요청하고 완료 후 진행하라. 각 단계의 ✅ 기대 결과를 preview_snapshot/preview_console_logs/preview_network로 확인하고, ❌ 실패 시 "진단" 절을 따르라.

---

## 0. 배경 — 무엇이 바뀌었는가

이번 수정에서 **파괴적 변경 1건**이 들어갔다:

- 서버의 GitHub 프록시 엔드포인트(`/api/projects/setup`, `/api/projects/commit`, `/api/publish`(POST/PUT/fork/fetch), `/api/sync/github`)가 이제 **Supabase 로그인 토큰을 요구**한다 (`Authorization: Bearer <access_token>`, 무토큰 → 401 `auth_required`, 비멤버 → 403 `not_project_member`).
- 클라이언트(projectStore/githubSyncStore/galleryStore)는 헤더를 보내도록 수정됨. **서버·클라이언트가 모두 이번 수정분이어야 정상 동작**한다.

그 외 핵심 변경: Fork→갤러리 공개 경로 신설(`republishWork`), 발행 부분 성공(`githubPending`), `/commit` 시 갤러리 코드 동기화, repo 소실 시 스냅샷 폴백, 로그아웃 스토어 정리, autoSave 오류 표시, `?team=` 초대 confirm.

## 1. 사전 준비

| 항목 | 내용 |
|---|---|
| 계정 A | GitHub 계정 (프로젝트 소유자 역할) |
| 계정 B | 두 번째 GitHub 계정 (팀원 역할) — 없으면 7~8단계 생략 가능 |
| DB 마이그레이션 | Supabase SQL Editor에서 `supabase/migrations/016_gallery_attribution.sql` 적용 (remix_from_title/author 컬럼). 미적용 시 발행은 폴백으로 동작하나 attribution 검증(11단계)은 불가 |
| 서버 실행 | `cd server && PORT=4034 node index.js` — `.env`에 SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 필요. 기동 로그 확인 |
| 클라이언트 실행 | `cd client && npm run dev` (포트 4033) 또는 preview_start `vpylab-client` |
| 브라우저 | 계정 B용은 시크릿 창 사용 |

**사전 스모크** (로그인 불필요):
```bash
curl -s -X POST http://localhost:4034/api/publish -H 'Content-Type: application/json' -d '{}'
# 기대: {"error":"로그인이 필요합니다.","code":"auth_required"}  ← 인증 미들웨어 동작 증거
```

## 2. 검증 단계

### STEP 1 — 비로그인 샌드박스 (기준선)
1. `http://localhost:4033/sandbox` 접속, Python 엔진 "Ready" 대기
2. 기본 예제 실행
- ✅ 3D 구가 렌더링되고 움직임. 콘솔 오류 0
3. 코드에 `import time` / `time.sleep(0.5)` 를 while 루프 앞에 추가하고 실행
- ✅ **SyntaxError 없이 실행됨** (이번 critical 수정 검증 — 수정 전에는 `time.await sleep`으로 깨졌음)

### STEP 2 — GitHub 로그인 (계정 A)
1. 헤더 "로그인" → "GitHub로 로그인" → OAuth 완료 *(사람 조작 필요)*
- ✅ 헤더에 프로필 표시, 콘솔 오류 0

### STEP 3 — 팀 프로젝트 생성 + repo 자동 생성
1. 샌드박스 툴바 "📁 프로젝트" → 새 프로젝트 만들기 (GitHub 연동 옵션 켜기)
- ✅ 프로젝트 생성 성공, 에디터 상단에 프로젝트 제목 표시
- ✅ 잠시 후 GitHub에 `vpylab-<slug>` repo 생성됨 (github.com에서 확인)
- ❌ 401/403 → 진단 A

### STEP 4 — 저장 → GitHub 커밋
1. 코드를 수정하고 "💾 저장" (커밋 메시지 입력)
- ✅ 저장 성공 토스트. repo에 main.py 새 커밋 + history.md 갱신 (github.com 확인)
- ✅ 저장 이력(📜) 패널에 새 리비전 표시
- ❌ 403 `not_project_member` → 진단 B (트리거 미적용 DB)

### STEP 5 — autoSave 오류 표시 (선택, 파괴적 아님)
1. DevTools Network를 Offline으로 전환 후 코드 타이핑, 몇 초 대기
- ✅ 툴바에 "⚠️ 자동 저장 실패 — 수동 저장해주세요" 표시 (이번 수정 — 이전엔 무표시)
2. Online 복귀

### STEP 6 — 갤러리 발행
1. "갤러리에 올리기" → 제목/카테고리 입력 → 발행
- ✅ 발행 성공, 갤러리에 작품 표시, GitHub Pages URL 존재 (Pages는 1~2분 지연 가능 — 404여도 이 단계에서는 정상)

### STEP 7 — 팀원 초대 (계정 B, 시크릿 창)
1. 계정 A: 프로젝트 패널에서 초대 코드 복사 (또는 초대 링크)
2. 계정 B: 로그인 후 초대 링크(`/sandbox?team=<코드>`) 접속
- ✅ 에디터에 작성 중 코드가 있으면 **교체 확인 대화상자**가 뜸 (이번 수정)
- ✅ 합류 후 URL에서 `?team=` 파라미터가 제거됨 (이번 수정 — 새로고침해도 재합류 안 함)
- ✅ 잘못된 코드 입력 시 팀 패널에 오류 메시지 표시 (이번 수정 — 이전엔 숨은 콘솔에만)

### STEP 8 — 팀원 저장 + 실시간 알림
1. 계정 B: 코드 수정 후 저장
- ✅ 저장 성공 (GitHub collaborator 초대를 수락 안 했으면 "GitHub 반영 보류" 안내가 뜨는 것이 정상 동작)
2. 계정 A 창: 
- ✅ "팀원이 저장했습니다" 알림/토스트 표시 (Realtime)

### STEP 9 — 갤러리 코드 동기화 (이번 핵심 수정)
1. 계정 A: 프로젝트 코드를 눈에 띄게 수정(예: 색상 변경) 후 저장
2. 갤러리에서 해당 작품 상세 → "코드 보기"
- ✅ **방금 수정한 최신 코드가 보임** (수정 전에는 발행 시점 스냅샷만 보였음)

### STEP 10 — Fork → 갤러리 공개 (오픈소스 루프, 이번 핵심 수정)
1. 계정 B: 갤러리에서 계정 A의 작품 상세 → "Fork"
- ✅ Fork 성공, 내 비공개 초안 생성
2. 갤러리 목록에서
- ✅ "내 작품" 섹션에 Fork본이 **"비공개" 뱃지**와 함께 표시 (이번 수정)
3. Fork본 상세 → **"갤러리에 공개하기"** 버튼 클릭 (이번 신설)
- ✅ 공개 전환 성공
4. 원작(계정 A 작품) 상세 새로고침
- ✅ **Remix 카운트 +1**, Remix 목록에 Fork본 표시
- ✅ Fork본 상세에 "원작: <제목> by <작성자>" 표시

### STEP 11 — attribution 보존 (016 마이그레이션 적용 시)
1. 계정 A: 원작을 갤러리에서 삭제
2. Fork본(계정 B) 상세 새로고침
- ✅ "원작: <제목> by <작성자> (삭제됨)" 텍스트 표시 (이번 수정 — 이전엔 출처가 조용히 소멸)

### STEP 12 — 로그아웃 정리 (공용 PC 시나리오, 이번 수정)
1. 계정 A 창: 프로젝트를 연 채 로그아웃
- ✅ 에디터 툴바에서 프로젝트 제목이 사라짐 (이전엔 남아 있었음)
2. 같은 창에서 계정 B로 로그인
- ✅ 이전 계정의 프로젝트/코드가 보이지 않음

## 3. 진단 (실패 시)

**진단 A — 3/4/6단계에서 401 `auth_required`**
- 클라이언트가 헤더를 안 보내는 경우: 브라우저 DevTools Network에서 해당 요청의 `Authorization` 헤더 존재 확인. 없으면 구버전 클라이언트가 캐시된 것 — 강력 새로고침.
- 세션 만료: 로그아웃 후 재로그인.

**진단 B — 4단계에서 403 `not_project_member`**
- DB에 `vpylab_projects_add_owner_member` 트리거(마이그레이션 010)가 적용됐는지 확인:
  `SELECT * FROM vpylab_project_members WHERE project_id = '<프로젝트ID>';` — 소유자 row가 없으면 트리거 미적용.

**진단 C — GitHub 커밋이 반영 안 됨**
- 서버 로그에서 `[projects/commit]` 라인 확인. `github_auth_required`/`blocked`면 GitHub 재로그인 후 프로젝트를 다시 열면 대기열이 자동 재시도됨 (설계된 동작).

**진단 D — STEP 9에서 갤러리 코드가 옛날 것**
- 서버 로그에서 `갤러리 코드 동기화 실패` 경고 확인. `github_last_synced_at` 컬럼 부재면 마이그레이션 014 미적용.

**진단 E — Remix 카운트가 안 오름 (STEP 10)**
- 이미 한 번 공개했던 작품을 재공개한 경우 증가하지 않는 것이 **정상**(중복 방지). 새 Fork로 재시도.

## 4. 결과 기록

각 STEP의 ✅/❌를 기록하고, ❌가 하나라도 있으면 진단 절 결과와 함께 보고할 것. 전 단계 ✅면 "GitHub 공동 프로젝트 + 오픈소스 루프 E2E 검증 통과"로 판정한다.

## 관련 문서
- 발견 문제 전체: [AUDIT_REPORT_2026-07-06.md](AUDIT_REPORT_2026-07-06.md)
- 오픈소스 플로우 분석: [OPENSOURCE_FLOW_REVIEW_2026-07-06.md](OPENSOURCE_FLOW_REVIEW_2026-07-06.md)

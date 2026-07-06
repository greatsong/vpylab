# VPyLab 3인 팀 GitHub 공동 프로젝트 플로우 (설계 + 검증)

**작성일**: 2026-07-07
**검증**: Supabase 협업·권한 계층은 운영 DB에 테스트 계정 4개(리더 A, 팀원 B·C, 외부인 D)로 **실제 실행하여 20단계 전원 통과**. GitHub 계층은 실계정 OAuth가 필요해 설계 + 수동 검증 포인트로 기술.

---

## 1. 역할 설계 (3인 팀)

| 역할 | 인원 | VPyLab 권한 | GitHub 권한 |
|---|---|---|---|
| **리더 (owner)** | A | 프로젝트 생성/삭제, 멤버 초대·역할변경·추방, 코드 편집, 발행 | repo 소유자, collaborator 초대 |
| **팀원 (editor)** | B, C | 코드 읽기·편집, 리비전 기록, 발행 | collaborator 수락 시 push |
| (viewer) | — | 읽기 전용 (수업 관찰자/평가자용) | — |

3인 팀 권장 구성: **A = editor 겸 repo 관리자, B·C = editor**. viewer는 교사가 여러 팀을 순회 관찰할 때 사용.

## 2. 전체 플로우 (10단계)

```
[A] 팀 프로젝트 생성          → repo 자동 생성(GitHub 로그인 시) + 초대코드 발급
     │  └ 소유자 자동 owner 멤버 등록 (DB 트리거)
[A] 초대코드/링크 B·C에 공유
[B][C] 초대코드로 합류         → editor로 등록
[A] GitHub collaborator 초대   → B·C가 GitHub 알림 수락 (repo push 권한)
[누구든] 코드 편집 → 💾 저장   → VPyLab 저장 + 리비전(작성자 기록) + GitHub 커밋
     │  └ 팀원 저장 시 Realtime으로 다른 멤버에게 알림
[A] 갤러리 발행                → Pages URL + 갤러리 등록(project_id 연결)
[외부 학생] 실행/좋아요/Fork   → 오픈소스 순환 (별도 문서 OPENSOURCE_FLOW_REVIEW 참조)
[교사] 기여 이력 확인          → 리비전 작성자 분포로 3인 각자 기여 파악
```

## 3. Supabase 계층 실전 검증 결과 (운영 DB, 20/20 통과)

| # | 단계 | 결과 |
|---|---|---|
| 1 | 계정 4개 생성·로그인 | ✅ |
| 2 | A가 프로젝트 생성 | ✅ invite_code 발급 |
| 2-1 | **소유자 자동 owner 멤버 등록 (트리거)** | ✅ |
| 3 | B·C 초대코드 합류 (RPC `vpylab_join_project_by_invite`) | ✅ editor 등록 |
| 3-1 | 멤버 3명 확인 | ✅ owner,editor,editor |
| 4 | A 코드 생성 + 첫 리비전 | ✅ |
| 5 | B가 팀 코드 읽기 | ✅ (RLS 팀 조회 허용) |
| 5-1 | B가 팀 코드 수정 | ✅ (editor 편집 허용) |
| 5-2 | B 리비전 기록 (project_id 포함) | ✅ author=B |
| 6 | C 리비전 기록 | ✅ author=C |
| 7 | **외부인 D 코드 읽기** | ✅ 차단 (RLS) |
| 7-1 | **외부인 D 리비전 위조 (project_id NULL)** | ✅ 차단 ← 아래 §4 참조 |
| 7-1b | **외부인 D 리비전 위조 (팀 project_id 지정)** | ✅ 차단 |
| 7-2 | 외부인 D 멤버 목록 조회 | ✅ 차단 |
| 8 | A가 C를 viewer로 강등 | ✅ (owner 권한) |
| 8-1 | **viewer C의 코드 수정** | ✅ 차단 |
| 9 | A 갤러리 발행 (project_id 연결) | ✅ |
| 9-1 | 비로그인 갤러리 열람 | ✅ (공개 작품 RLS) |
| 10 | 기여 이력 (리비전 작성자 분포) | ✅ {A:1, B:1, C:1} |

## 4. 검증 중 발견·수정한 보안 취약점 🔴

**code_revisions INSERT RLS 소유권 우회** (마이그레이션 017로 수정, 운영 적용 완료)

- **증상**: 외부인 D가 팀 코드를 *읽지는* 못하는데, 그 코드의 이력(리비전)에 위조 항목을 *삽입*할 수 있었음.
- **원인**: 012의 팀 insert 정책이 `author_id = auth.uid() AND (project_id IS NULL OR can_edit_project(project_id))`. 공격자가 `project_id`를 NULL로 두고 임의 `code_id`를 지정하면 `project_id IS NULL` 분기로 통과 — 코드 소유권/멤버십 검증이 전혀 없었음.
- **수정**: 팀 정책을 `project_id IS NOT NULL AND can_edit_project(project_id)`로 강화. 개인 리비전은 기존 own-code 정책(코드 소유권 확인)이 커버. 클라이언트는 팀 리비전에 항상 project_id를 채우므로 정상 협업 무영향.
- **재검증**: 두 공격 벡터(NULL / 비멤버가 팀 project_id 지정) 모두 차단, 정상 3인 리비전은 그대로 기록됨.

> 이 취약점은 정적 리뷰(감사 보고서)에서 놓쳤고 **실제 4계정 시뮬레이션에서만 드러났습니다.** 협업 권한은 반드시 다중 계정으로 돌려봐야 함을 보여주는 사례.

## 5. GitHub 계층 (실계정 검증 필요)

Supabase 계층은 위에서 자동 검증됐고, 아래는 실제 GitHub OAuth가 필요해 수동으로 확인해야 하는 지점입니다. [E2E_VERIFICATION_MANUAL.md](E2E_VERIFICATION_MANUAL.md)의 STEP 3·4·7·8에 대응.

1. **repo 자동 생성** — A가 GitHub 로그인 상태로 프로젝트 생성 시 `vpylab-<slug>` repo 생성. 서버 `/api/projects/setup`은 이제 Supabase 인증 필수(마이그레이션과 함께 배포됨).
2. **collaborator 초대** — A가 B·C의 GitHub username으로 초대 → B·C가 GitHub에서 수락해야 push 가능. 수락 전 저장은 "GitHub 반영 보류" 상태로 VPyLab에는 저장됨(설계된 우아한 실패).
3. **동시 편집 충돌** — B·C가 같은 파일을 각자 커밋하면 GitHub 레벨에서 후속 커밋이 앞 커밋 위에 쌓임. VPyLab은 Realtime 알림으로 "팀원이 저장했습니다"를 띄워 덮어쓰기 전에 최신 코드를 당겨받도록 유도(`handlePullLatestProjectCode`).
4. **Pages 발행** — 발행 후 1~2분 뒤 공개 URL 활성화.

## 6. 교사 운영 관점

- **기여 이력**: `vpylab_code_revisions.author_id`로 3인 각자의 커밋 수·시점이 이미 기록됨(위 STEP 10에서 실증). 학급 대시보드 UI는 미구현(로드맵 Phase 3) — 필요 시 이 데이터로 바로 구축 가능.
- **역할 통제**: 관찰/평가자는 viewer로 넣으면 읽기만 가능(STEP 8-1 실증).
- **초대 방식**: 초대코드(8자) 또는 `/sandbox?team=<코드>` 링크. 링크 합류 시 현재 코드 교체 전 확인 대화(이번 세션 수정분).

## 7. 배포 상태

| 항목 | 상태 |
|---|---|
| 마이그레이션 017 (RLS 수정) | ✅ 운영 DB 적용 + 커밋 `fc05a5b` |
| 서버 인증 미들웨어 + NODE_ENV | ✅ Railway 배포 완료 |
| 클라이언트 (초대/저장/발행 플로우) | ✅ Vercel 배포 완료 |

## 관련 문서
- [E2E_VERIFICATION_MANUAL.md](E2E_VERIFICATION_MANUAL.md) — GitHub 포함 실계정 12단계 수동 검증
- [OPENSOURCE_FLOW_REVIEW_2026-07-06.md](OPENSOURCE_FLOW_REVIEW_2026-07-06.md) — 발행 이후 오픈소스 순환
- [AUDIT_REPORT_2026-07-06.md](AUDIT_REPORT_2026-07-06.md) — 전체 감사

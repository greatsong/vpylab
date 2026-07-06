# VPyLab 오픈소스 프로젝트 플로우 심층 리뷰

**작성일**: 2026-07-06
**위상**: [AUDIT_REPORT_2026-07-06.md](AUDIT_REPORT_2026-07-06.md)의 후속 — 사용자 지정 핵심 축인 "오픈소스 프로젝트 플로우"를 끝-대-끝 추적한 결과와 우선순위 재편.

---

## 1. 플로우 정의와 현재 구현 상태

이 플랫폼의 핵심 비전 루프:

```
[1] 프로젝트 생성        ✅  createProject + 첫 revision + 백그라운드 GitHub 셋업
[2] 팀 초대/합류         ✅  VPyLab 초대 코드 + GitHub collaborator (이중 구조, Guide에 안내됨)
[3] 코드 저장(리비전)    ✅  saveAndPush → immutable revision
[4] GitHub repo 커밋     ✅  대기열 + 지수 백오프 + blocked 분류 (가장 견고한 구간)
[5] GitHub Pages 발행    ⚠️  실패해도 URL 저장 (404 링크 가능, 상태 표시 없음)
[6] 갤러리 등록          ⚠️  발행 시점 스냅샷, source_revision_id 미기록
[7] 실행/좋아요          ✅  비로그인도 실행 가능
[8a] Remix               ✅  출처 링크·remix_count 동작
[8b] GitHub Fork         ❌  루프 미완성 — Fork 작품이 갤러리에 공개될 경로 없음 (코드 검증 완료)
[9] 이슈/기여            ⚠️  GitHub 이슈 외부 링크만
[10] 다시 갤러리로       ❌  Fork/수정본이 갤러리로 되돌아오는 자동 흐름 없음
```

**결론**: 1~4단계(만들고 저장하는 쪽)는 견고하나, 8b~10단계(다른 사람의 작품이 순환하는 쪽)가 닫히지 않았습니다. "오픈소스처럼 순환"이 비전이라면 현재는 **발행 플랫폼이지 아직 순환 생태계가 아닙니다.**

---

## 2. 끊어진 고리 (검증 상태 표기)

### 2.1 [HIGH — 코드로 검증 완료] Fork한 작품은 갤러리에 영원히 비공개
- `galleryStore.js:422` — forkWork가 `is_public: false` 초안 생성, 주석은 "remix_count 증가는 재발행 시에만 처리"
- `galleryStore.js:344-375` — 유일한 후속 경로인 updateWork는 code/title/description만 갱신. `is_public` 전환도 `vpylab_increment_remix` 호출도 없음 (increment_remix는 Remix 발행 `galleryStore.js:270`에서만 호출)
- **결과**: Fork → 수정 → 갤러리 공개라는 8b 루프 전체가 실질적 죽은 코드
- **수정**: updateWork(또는 별도 "재발행" 액션)에 `is_public: true` 전환 + 원작 remix_count 증가 + 갤러리 상세/편집 화면에 "갤러리에 공개하기" 버튼

### 2.2 [HIGH] 같은 작품 상세 페이지에서 두 버튼이 서로 다른 코드를 실행
- repo 연결 작품의 "VPyLab에서 실행"은 raw main.py(최신), "코드 보기"·3D 미리보기·`?play=` 실행은 발행 시점 스냅샷 (`GalleryDetail.jsx:87-89` vs `:320, :327`)
- `/api/projects/commit`은 repo만 갱신하고 갤러리 `code`를 갱신하지 않음. migration 014가 만든 `github_last_synced_at` 컬럼을 쓰는 코드가 전무
- **수정**: commit 성공 시 `project_id`로 연결된 갤러리 row의 code/`github_last_synced_at` 동기화. 조회 측도 repo 우선 + 스냅샷 fallback으로 통일

### 2.3 [MEDIUM] repo 삭제 시 실행 불가 (스냅샷이 있는데도)
- `Sandbox.jsx:217-240` `?repo=` 로드는 404 시 그대로 에러. 갤러리 상세는 `github_repo`가 있으면 무조건 repo 경로 선택
- **수정**: repo 로드 실패 시 `?play=` 스냅샷 폴백 + 갤러리 상세에 "저장소 연결 끊김" 뱃지

### 2.4 [MEDIUM] 라이선스가 작품에 전혀 흐르지 않음
- CC BY-NC-SA 표기는 About 페이지(미션 콘텐츠)뿐. 학생 작품에는 라이선스 선택·repo LICENSE 파일·README 표기·Remix 승계가 전무
- **수정**: 발행 시 라이선스 선택(기본 CC BY-NC-SA 4.0) → 갤러리 컬럼 + LICENSE 커밋 + README 표기 + Remix 시 승계. 오픈소스 순환의 법적 토대

### 2.5 [MEDIUM] 원작 삭제 시 attribution 소멸
- `002_gallery.sql:22` `remix_from ... ON DELETE SET NULL` → Remix 계보·원작자 표시가 조용히 사라짐
- **수정**: publishWork에 `remix_from_title`/`remix_from_author` 비정규화 저장 + `source_revision_id`(스키마 존재, `galleryStore.js:235-247` insert에 누락) 기록

### 2.6 [MEDIUM] 갤러리 발행이 전부-아니면-전무
- GitHub 401 시 publishWork 전체 실패 — 프로젝트 저장(4단계)의 훌륭한 대기열 패턴이 발행(6단계)에는 없음
- **수정**: GitHub 실패 시 스냅샷 갤러리 등록은 진행하고 "GitHub 연결 보류" 상태 표시 (기존 패턴 재사용)

### 2.7 [MEDIUM] 스냅샷-only 작품은 수정 진입점이 없음
- "수정하기" 버튼 조건이 `isMyWork && currentWork.github_repo` (`GalleryDetail.jsx:270`) — repo 없는 내 작품은 삭제 후 재발행만 가능

### 2.8 [LOW] 기타
- GitHub 동기화 백엔드 3벌 (projects/commit, sync/github, publish) — repo 생성 규칙 단일화 필요
- `fetchCodeFromGitHub`가 공개 repo에도 토큰 요구 (`galleryStore.js:332-341`) — 토큰 만료 시 불필요한 스냅샷 fallback
- 이슈/기여(9단계)는 외부 링크만 — 앱 내 "이 작품에 달린 이슈 N개" 표시 같은 최소 통합도 없음

---

## 3. 이 플로우에 직접 걸리는 기존 감사 발견 (재소환)

| 발견 | 플로우 영향 |
|---|---|
| GitHub 프록시 인증 부재 (서버) | 플로우의 신뢰 기반 — P0 유지 |
| `?team=` 초대: 확인 없이 코드 교체 + 새로고침마다 재합류 | [2] 합류 첫 경험 훼손 |
| 초대 합류 실패가 가려진 콘솔에만 출력 | [2] 실패 시 학생이 원인을 모름 |
| removeMember projectId 가드 누락 | [2] 팀 관리 오염 |
| 저장 타임아웃 UI와 백그라운드 저장 이중 진행 → revision 중복 | [3] 이력 신뢰도 |
| Realtime 구독 실패 시 조용히 중단 | [3] 팀원 저장 알림 유실 → 덮어쓰기 |
| deleteProject 순서 (코드 먼저 삭제) | [1] 데이터 손실 |
| 민감정보 검사 경고만 (발행 차단 없음) | [5] 학생 이메일이 공개 Pages에 게시 가능 |
| rate-limit IP 기준 (학교 NAT) | [4][5] 학급 단위 사용 시 서로 한도 소진 |
| i18n 하드코딩 (플로우 안내 전반) | 글로벌 오픈소스 비전과의 격차 |

## 4. 참여 장벽 지도

- **비로그인**: 갤러리 열람·실행·코드 보기 가능 ✅ (좋은 설계)
- **이메일 로그인**: 좋아요·Remix(스냅샷)·팀 합류·저장/revision 가능
- **GitHub 로그인 필요**: repo 커밋[4], Pages 발행[5], Fork[8b], collaborator 초대
- Guide가 "GitHub는 필수 아님"을 정직하게 안내 — 구조는 건전. 단 Google OAuth 미설정이라 실질 이메일 진입로가 좁음

## 5. 교사 운영 도구 공백

`vpylab_code_revisions.author_id`로 데이터는 이미 쌓이는데 보여주는 화면이 없음:
- 학급 단위 팀/repo/최근 커밋 목록, 학생별 기여(리비전 작성자 분포), 학생 repo 일괄 링크
- 학교에서 이 플로우를 "수업으로" 돌리려면 필수 — 현재 대시보드는 미션 제출 중심

---

## 6. 오픈소스 플로우 중심 재편 로드맵

### Phase 0 — 신뢰 기반 (기존 P0에서 플로우 관련만)
1. GitHub 프록시 서버측 인증 (감사 3.2)
2. 전처리기 `time.sleep` critical 버그 (플로우 무관하지만 학생 대면 최우선 유지)
3. 로그아웃 스토어 정리 (공용 PC — 학급 환경 필수)

### Phase 1 — 루프 닫기 (이번 리뷰의 핵심)
4. **Fork → 갤러리 공개 경로 구현** (2.1) — 죽은 루프 부활, 최우선
5. 갤러리↔repo 코드 동기화 (2.2)
6. repo 소실 스냅샷 폴백 + 연결 끊김 뱃지 (2.3)
7. 발행 부분 성공 허용 — 대기열 패턴 재사용 (2.6)
8. `?team=` 초대 플로우 다듬기 + 합류 실패 표시

### Phase 2 — 순환의 품질
9. 라이선스 파이프라인 (2.4) — LICENSE 커밋 + Remix 승계
10. attribution 비정규화 + source_revision_id 기록 (2.5)
11. 스냅샷-only 작품 수정 경로 (2.7)
12. Pages 상태 폴링/뱃지 ("발행 준비 중" → "공개됨")
13. 민감정보 발행 전 확인 플로우

### Phase 3 — 생태계화
14. 교사 학급 대시보드 (기여 이력·repo 일람)
15. 앱 내 이슈 카운트 표시 등 GitHub 최소 통합
16. 동기화 백엔드 단일화 (repo 생성 규칙 1벌)
17. i18n 실적용 (플로우 안내 문구 우선) + Google OAuth 활성화 (이메일 진입로 확대)

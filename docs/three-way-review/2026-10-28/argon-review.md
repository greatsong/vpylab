# Gemini Argon 검토 제안 원문

아래는 독립 모델의 제안이며 확정 사실이 아닙니다. 재현·채택·기각 판정은 [총괄 보고서](../../CLASSROOM_V2_THREE_WAY_REVIEW_2026-10-28.md)를 참조하세요. 행 번호는 검토 시 전달한 발췌본 기준입니다.

제공된 3개 소스 발췌본(`server/classroom/store.js`, `server/classroom/github-learning.js`, `client/src/classroom/useDraft.js`)을 기반으로 아키텍처, 기록·프라이버시, 귀속(attribution), 재시도 일관성 관점에서 검토한 결과입니다.

---

### 1. 확정된 조치 가능 결함 (Confirmed Actionable Defects)

#### [결함 1] 학생 상세조회에서 GitHub Outbox 작업 큐(전체 학생 payload) 노출
- **심각도**: High (프라이버시 / 데이터 노출)
- **위치**: `server/classroom/store.js:184-185`
- **원인 및 트리거**: `detail(id, actor)`는 프로젝트 참여자(`viewer`, `editor` 학생 포함) 누구에게나 호출 가능하며, `jobs: store.getJobs(id)`를 필터링 없이 그대로 반환합니다. `getJobs`는 프로젝트의 모든 `github_jobs` 행과 `payload`(다른 학생이 작성·요청한 이슈/제안/체크포인트 원문, `authorId`, `lastError` 등)를 포함합니다.
- **영향**: 학생이 팀 프로젝트 상세 API를 조회할 때 다른 학생의 GitHub 동기화 대기 작업 페이로드와 내부 오류 메시지를 모두 열람할 수 있습니다.
- **최소 수정 및 테스트**:
  - **수정**: `detail()`에서 `actor.role === 'teacher' || project.myRole === 'owner'`가 아니면 `jobs`를 제외하거나 본인이 요청한 작업/요약 상태만 반환하도록 제한합니다.
  - **테스트**: `student-a`가 생성한 job이 있을 때 `student-b`로 `store.detail(projectId, studentB)` 호출 시 타인의 민감한 job payload가 노출되지 않는지 검증합니다.

#### [결함 2] 로컬 스토리지 장애 후 `update()` 호출 시 복구 차단(`session.blocked`)이 풀려 서버 덮어쓰기 발생
- **심각도**: High (재시도 일관성 / 초안 유실 위험)
- **위치**: `client/src/classroom/useDraft.js:28-46`, `115-121`, `142-150`
- **원인 및 트리거**:
  1. 초기 로드나 충돌 시 `preserve(session, selected, alternatives)`에서 `localStorage` 쓰기가 실패(`QuotaExceededError` 등)하면, 다른 초안이 있을 때 `session.blocked = true`와 `session.pendingRecoveries = different`를 설정해 서버 덮어쓰기를 막습니다(39-41행).
  2. 직후 사용자가 에디터에서 한 글자라도 수정하면 `update()`가 호출됩니다(111행). 이때 `selected`는 `next`(방금 수정한 코드)가 되고, `preserve(session, next, ...)`의 `different`에는 `pendingRecoveries`가 유지되어 다시 `catch` 블록으로 들어갑니다.
  3. 그러나 만약 이전 `selected`와 `alternatives`가 우연히 같아 `different.length === 0`이거나, `session.pendingRecoveries`에 있던 항목이 새 `next`와 같아지는 경우(또는 `readDraft`가 `null`을 반환해 `alternatives`가 비어 있고 초기 `pendingRecoveries`가 비어 있던 상태에서 로컬 저장만 실패한 경우), `session.blocked`가 `true`로 설정되지 않은 채 `status: 'local'`로 발행(124행)되어 140행 `useEffect`가 700ms 후 서버에 `PUT /drafts`를 전송합니다.
  4. 또한 92행에서 로딩 중 편집(`session.edited`)이 있었고 `remoteIsCurrent === false`(다른 창의 원격 초안)였을 때, `normalizedRemote`는 `clientSequence: 0`으로 포크(81행)되므로 92행의 `remote?.clientSequence` 대신 `normalizedRemote` 기준이 섞이거나, `preserve` 실패 시에도 124행 `update`는 무조건 `status: 'local'`을 발행합니다(97행이나 159행처럼 `session.blocked ? 'offline' : 'local'`을 확인하지 않음).
- **영향**: 기기 저장소가 고장 난 상태에서 사용자가 타이핑을 계속하면 UI 상태가 `'local'`로 표시되고 조건에 따라 서버 초안을 덮어쓸 수 있습니다.
- **최소 수정 및 테스트**:
  - **수정**: `catch` 블록(39행)에서 `different.length` 조건과 무관하게 저장 실패 시 `session.blocked = true`를 유지하거나, `update()`의 `publish`(124행)에서도 `status: session.blocked ? 'offline' : 'local'`을 사용하도록 통일합니다.
  - **테스트**: `localStorage.setItem`이 예외를 던지도록 모킹한 상태에서 원격 다른 창 초안 수신 후 `update()` 호출 시 `status === 'offline'` 유지 및 `PUT` 요청 미발생을 검증합니다.

#### [결함 3] `addIssue` 및 `addProposal`에서 `github_jobs` Outbox 큐 등록 누락 (또는 트랜잭션 불일치)
- **심각도**: Medium (아키텍처 / Outbox 기록 일관성)
- **위치**: `server/classroom/store.js:89-91`, `156`, `159`
- **원인 및 트리거**:
  - `attributeLearningEvents`(89-91행)는 `github_jobs` 테이블에서 `job.kind === 'proposal'` 및 `job.kind === 'issue'`인 작업을 조회하여 `payload.authorId === metadata.requestedByUserId`를 대조해 `'VPyLab 제출자'`로 귀속합니다.
  - 반면 `writeCheckpoint`(152행)는 트랜잭션 내에서 `store.enqueueJob({ ..., kind: 'checkpoint', ... })`을 호출하지만, `addIssue`(156행)와 `addProposal`(159행)은 로컬 테이블(`issues`, `proposals`)에만 `INSERT`하고 트랜잭션으로 묶거나 `enqueueJob`을 호출하지 않습니다.
- **영향**: 라우트 계층에서 별도로 `enqueueJob`을 호출하더라도 DB 트랜잭션 원자성이 깨지며(이슈/제안 생성과 outbox 등록 분리), `store.addIssue`/`store.addProposal` 단독 호출 시 GitHub outbox 작업이 누락되어 이후 학습 이벤트 귀속(`attributeLearningEvents`)이 실패합니다.
- **최소 수정 및 테스트**:
  - **수정**: `addIssue`와 `addProposal`을 `store.transaction`으로 감싸고, 체크포인트와 동일한 계약으로 outbox job 생성 책임을 트랜잭션 내부로 일원화합니다(외부 호출 시 같은 트랜잭션 내 실행 보장).
  - **테스트**: 제안/이슈 생성 시 `github_jobs`에 `authorId`가 포함된 레코드가 원자적으로 생성되고 `attributeLearningEvents`에서 `requestedByUserId`가 정상 매칭되는지 확인합니다.

#### [결함 4] `mergeProposal`에서 제안 작성자가 프로젝트에서 제거되었거나 `users` 조회 실패 시 검증 부재 및 `updateSettings` 트랜잭션 누락
- **심각도**: Medium (기록/귀속 무결성)
- **위치**: `server/classroom/store.js:162`
- **원인 및 트리거**: `mergeProposal`은 `store.writeCheckpoint(project, store.user(proposal.authorId), ...)`를 호출합니다. 만약 `proposal.authorId`가 `null`이거나 현재 프로젝트 멤버에서 권한이 회수(`viewer`로 변경 등)된 상태여도, 병합 시점에는 `actor`(병합 실행자)의 쓰기 권한만 검사하고 체크포인트의 `authorId`는 `proposal.authorId`로 기록합니다. 만약 `store.user(proposal.authorId)`가 `null`이면 `actor.id` 접근 시 `TypeError: Cannot read properties of null (reading 'id')`가 발생해 500 에러가 납니다.
- **영향**: 비정상 `author_id` 상태에서 병합 시 500 예외가 발생하며, 병합 주체(`merged_by`)와 체크포인트 작성자(`author_id`) 검증이 분리됩니다.
- **최소 수정 및 테스트**:
  - **수정**: `const author = store.user(proposal.authorId) || actor;`로 방어하거나 작성자 존재 여부를 확인한 뒤 `writeCheckpoint`에 전달합니다.
  - **테스트**: 작성자 레코드가 없거나 비활성화된 제안 병합 시 500 에러 없이 처리되는지 확인합니다.

#### [결함 5] GitHub 백필(`backfillGitHubLearning`) 시 `/issues` 엔드포인트가 PR까지 페이지네이션 예산을 소모함
- **심각도**: Low (동기화/재시도 효율성)
- **위치**: `server/classroom/github-learning.js:70`, `114`
- **원인 및 트리거**: GitHub REST API의 `GET /repos/{owner}/{repo}/issues`는 이슈와 Pull Request를 모두 반환합니다. 70행 `normalizeGitHubLearningEvent`에서 `!payload.issue.pull_request`로 PR을 버리고 있지만, 114행 `collect('/issues', ...)`는 페이지당 50개 항목 중 PR이 대다수인 저장소에서 실제 이슈를 거의 수집하지 못한 채 `maxPagesPerEndpoint = 2` 및 `maxRequests` 예산을 소모합니다.
- **영향**: PR이 많은 학급 저장소에서 백필 시 최근 이슈 학습 근거가 누락되면서도 `stats.coverage`에는 `'/issues'`가 완료된 것으로 기록될 수 있습니다(2페이지 이하일 때).
- **최소 수정 및 테스트**:
  - **수정**: `/issues` 수집 시 PR로 인해 스킵된 비율이 높거나 페이지가 남아있을 때의 한계를 고려하거나, 백필 통계에 PR 필터링 여부를 반영합니다.
  - **테스트**: PR 50개와 이슈 5개가 섞인 모의 응답에서 이슈가 누락 없이 수집되거나 `partial` 표시가 정확한지 테스트합니다.

---

### 2. 미확인 사항 (Unknowns — 제공된 발췌본 외부)
- **라우트/워커의 Outbox Dedupe 가드**: 컨텍스트에 언급된 "체크포인트 ID+코드 일치 검증 및 타 제출자의 동일 outbox job 재사용 거부" 로직은 제공된 3개 파일 외부(라우트 핸들러 또는 GitHub 워커 파일)에 위치하므로 해당 파일의 직접 검증은 불가능합니다. 다만 `store.js:183`의 `enqueueJob` 자체는 여전히 `INSERT OR IGNORE` 후 `store.getJobs(projectId).find(x => x.dedupeKey === dedupeKey)`를 반환하므로, 호출자가 반환된 기존 job의 `payload.authorId` 및 `checkpointId`/`code` 일치 여부를 검증하지 않으면 기존 job이 조용히 재사용될 수 있습니다.
- **`draft-journal.js` 내부 구현**: `chooseDraft`, `archiveDraft`, `recoveryDrafts`의 정확한 직렬화 및 용량 제한 방식은 발췌본 외부입니다.

### 3. 알려진 향후 기능 (Known Future Features — 결함에서 제외)
- 과목별 리뷰 필수 정책 설정(review-required course policy), 제안 수정/대체(editable/superseding proposals), 리믹스 출처/라이선스 내보내기, 구술 근거 참조(oral evidence refs)는 의도된 향후 기능으로 분류하여 결함에서 제외했습니다.


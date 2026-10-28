# Claude 검토 제안 원문

아래는 독립 모델의 제안이며 확정 사실이 아닙니다. 재현·채택·기각 판정은 [총괄 보고서](../../CLASSROOM_V2_THREE_WAY_REVIEW_2026-10-28.md)를 참조하세요. 행 번호는 검토 시 전달한 발췌본 기준입니다.

**검토 결론 요약**: 제공된 발췌 범위에서 고위험(비밀 유출·즉시 데이터 손실) 결함은 확인하지 못했습니다. 확인 가능한 결함은 중간 1건, 낮음 2건이며, 나머지는 발췌 밖 코드에 의존하는 미확인 사항입니다.

## 확인된 결함

**1. [중간] 교사 수동 복구한 Issue가 학습 근거 원장에 기록되지 않음**
- 위치: `server/classroom/github.js:367-370` (비교: `:414-417`)
- 트리거: Issue 생성 응답 유실 → 작업 `blocked` → 교사가 `reconcileIssue`로 번호 지정해 복구.
- 영향: `runOnce` 성공 경로는 `recordJobLearning(job, result, binding)`을 호출하지만 복구 경로는 상태만 `succeeded`로 바꿉니다. 복구된 Issue는 `github_learning_events`에 없으므로 학생 근거 목록·`evidenceIds` 피드백 연결에서 누락되고, 같은 작업인데 경로에 따라 귀속 결과가 달라집니다(웹훅으로 나중에 들어오더라도 `requestedByUserId` 귀속은 작업 기반이라 보장되지 않음).
- 수정: 368-370을 `store.transaction`으로 묶고, 상태 갱신 `changes===1`일 때 `recordJobLearning(job, result, binding)` 호출. 테스트: 유실 시뮬레이션 → reconcile → `listLearningEvents`에 해당 Issue가 `authorId=payload.authorId`로 존재하는지 확인.

**2. [낮음] PR 재시도 조기 반환 경로가 브랜치 변조 검사를 건너뜀**
- 위치: `server/classroom/github.js:135-136` (검사 로직은 `:141-143`에만 존재)
- 트리거: PR 생성 응답 유실 후 재시도 전에, 저장소 쓰기 권한자가 결정적 브랜치명 `vpylab/proposal-{jobId}-{hash}`에 추가 커밋을 push.
- 영향: 기존 PR을 그대로 결과로 채택하며 `sha: pulls[0].head.sha`(변조된 sha)를 학생 제안 작업의 성공 결과·출처로 기록합니다. 브랜치가 존재할 때 적용하는 parent/내용 검사와 비일관.
- 수정: 조기 반환 전 `progress.commitSha`가 있으면 `pulls[0].head.sha === progress.commitSha` 확인, 없으면 141-143과 동일한 커밋 parent + 파일 내용 검사. 불일치 시 `proposal_branch_conflict`. 테스트: 모의 fetch에서 PR 목록은 반환하되 head.sha를 다르게 주고 409 확인.

**3. [낮음] 불확실 상태의 Issue 작업을 교사가 재시도할 수 있어 복구와 경합**
- 위치: `server/classroom/github.js:356`, `:167`, `:368-370`
- 트리거: `github_unavailable`로 끝난 Issue 작업은 167행에서 `uncertain=true`가 되어 `blocked`되지만 `last_error`는 `github_unavailable:`로 시작합니다. 356행은 `github_issue_uncertain`/`github_network`만 막으므로 `retry`가 허용됩니다.
- 영향: 중복 Issue는 163행 `issueSending` 가드가 막으므로 생성되지 않습니다. 다만 재시도가 즉시 다시 `blocked`로 떨어지고, 교사가 동시에 `reconcileIssue`를 await 중이면 370행의 `WHERE state='blocked'`가 조용히 0건 갱신되어 progress에는 `issue`가 기록되었는데 상태는 `blocked`로 남는 불일치가 생깁니다(한 번 더 reconcile하면 회복).
- 수정: `retry`에서 `job.kind==='issue'`이고 progress의 `issueSending===true`이면 `manual_issue_check_required`로 거부(문자열 접두 비교 대신 progress 기반). reconcile 결과 갱신은 트랜잭션 안에서 `changes!==1`이면 409 반환.

## 미확인 / 발췌 밖 의존 사항

- **Issue 전송 중 네트워크 예외의 `uncertain` 처리**: `request()`가 fetch 예외(TypeError 등)를 `GitHubError`로 감싸고 `uncertain`을 설정하는지 발췌에 없습니다. 감싸지 않으면 167행이 `issueSending=false`로 되돌리고 425행이 `pending`으로 자동 재시도해 **중복 Issue** 가능성이 있습니다. 권장 테스트: POST 직후 fetch reject 시뮬레이션 → 작업이 `blocked`이고 `issueSending`이 `true`로 유지되는지 확인. 확인되면 이것이 가장 중요한 항목입니다.
- **enqueueIssue 중복 키(`:339`)**: 제안과 달리 제출자/작성자 검사가 없어 다른 팀원이 같은 로컬 Issue를 내보내면 첫 제출자의 작업이 그대로 반환됩니다. 로컬 Issue 자체에 작성자가 있어 의도된 설계일 수 있어 결함으로 분류하지 않았습니다.
- **addReview(`store.js:161`) vs mergeProposal 적격 검토자(`:162`)**: 병합은 "viewer이지만 시스템 교사"의 검토를 인정하지만, 검토 작성은 `write:true`를 요구합니다. `accessProject`가 교사에게 write를 주지 않으면 162행의 교사-viewer 조항은 도달 불가능합니다. `accessProject` 미제공으로 미확인.
- **CSRF 자체 출처 비교(`app.js:37`)**: `trust proxy` 미설정 상태에서 TLS 종단 프록시 뒤에 두면 `req.protocol`이 `http`가 되어 자체 출처 비교가 항상 실패하고 `allowedOrigins`에만 의존합니다. 미배포 상태이므로 현재 영향 없음, 배포 시 확인.
- **웹훅 서명 비밀 미설정 시 동작**: `verifyGitHubSignature`가 `webhookSecret` 미설정에서 `false`를 반환하는지 미확인.

## 결함으로 분류하지 않은 항목

검토 필수 정책, 제안 수정/대체, 리믹스 출처·라이선스 내보내기, 구두 근거 참조는 향후 기능으로 제외했습니다. `addProposal`이 최신 버전만 허용하고 stale 제안 병합이 `version_conflict`로 실패하는 것, `joinProject`가 기존 viewer 역할을 유지하는 것, 시뮬레이터 PR 번호 계산 등은 단일 프로세스·동기 SQLite 전제에서 안전하다고 판단했습니다. 발췌 외 저장소·운영 환경에 대한 감사는 수행하지 않았습니다.

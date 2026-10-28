# 실제 두 GitHub 계정의 동료 리뷰·승인 검증

2026-10-28 12:04:47 한국 시각, `codex/classroom-v2`의 두 실계정 시험이 완료됐습니다. 기존 비공개 시험 저장소에서 **PR 작성→다른 계정의 검토 의견·승인→학생별 근거·교사 피드백 공개 범위**를 실제 API로 검증했습니다. 12:05:12에 GitHub 원문을 다시 읽어 대조했습니다.

운영 서비스·운영 DB·원본 프로젝트의 원격 저장소는 변경하지 않았습니다. 테스트 PR은 열린 채 유지했으며 병합하지 않았습니다.

## 실제 원문과 계정

| 구분 | 확인한 실제 기록 |
| --- | --- |
| 비공개 시험 저장소 | [greatsong/vpylab-private-classroom-e2e-20261028](https://github.com/greatsong/vpylab-private-classroom-e2e-20261028), 숫자 ID `1436391183` |
| 작성자 A | `greatsong`, 숫자 ID `6792460` → 합성 학생 가에 명시 연결 |
| 검토자 B | `greatsong-danggok`, 숫자 ID `270214046` → 합성 학생 나에 명시 연결 |
| 새 PR | [PR #3](https://github.com/greatsong/vpylab-private-classroom-e2e-20261028/pull/3), 실제 작성자 A, 열린 상태 |
| 동료 검토 의견 | [COMMENTED 리뷰](https://github.com/greatsong/vpylab-private-classroom-e2e-20261028/pull/3#pullrequestreview-5677273272), 실제 작성자 B |
| 동료 승인 | [APPROVED 리뷰](https://github.com/greatsong/vpylab-private-classroom-e2e-20261028/pull/3#pullrequestreview-5677273521), 실제 작성자 B |
| 검토 대상 | 세 기록 모두 PR head SHA `e0bf18c8f914ca7c3342a1e258372011bbac23d5`에 대응 |

두 리뷰는 **같은 B 계정의 의견 1개와 승인 1개**입니다. 두 명의 검토자가 승인했다는 뜻은 아닙니다. 두 계정은 사용자 본인의 계정이며 수업 명단·코드·피드백은 합성 시험 자료입니다.

사용자가 브라우저에서 GitHub CLI 로그인을 승인한 뒤, 각 계정의 인증으로 `/user`를 호출해 서로 다른 숫자 ID를 확인했습니다. 이름이나 이메일로 학생을 추측하지 않았습니다. CLI의 기본 활성 계정은 원래 `greatsong`으로 복구했고, 시험은 `--user`로 두 계정의 인증을 각각 선택했습니다.

B는 처음에 시험 저장소 접근 권한이 없었습니다. 이 고정 시험 저장소에만 B를 협업자로 초대하고 B 계정으로 수락했습니다(초대 ID `340078443`). 실제 조회에서 `pull=true`, `push=true`, `admin=false`를 확인했습니다. 다른 저장소의 권한은 변경하지 않았습니다. 초대·수락은 GitHub의 [협업자 API](https://docs.github.com/en/rest/collaborators/collaborators#add-a-repository-collaborator)와 [초대 수락 API](https://docs.github.com/en/rest/collaborators/invitations#accept-a-repository-invitation)를 사용했습니다.

## 실제로 통과한 검사

하니스의 **8개 확인 단계**가 통과했습니다. 단계 안에는 여러 API 단언이 포함되므로 8개 독립 기능이나 사용자 8명을 뜻하지 않습니다.

| 영역 | 확인한 결과 |
| --- | --- |
| 신원·저장소 | 두 계정의 숫자 ID, 동일한 비공개 저장소 ID·소유자·권한·main 기준 SHA를 확인했습니다. |
| 가져오기·저장 | 기존 단일 계정 시험 DB와 분리한 로컬 교실에서 코드를 가져오고 학생 가의 실험 근거·확정본을 저장했습니다. |
| PR·중복 제출 | 학생 가의 확정 체크포인트를 실제 PR #3으로 보냈습니다. 다른 요청 키로 같은 확정본을 제출해도 같은 작업 ID가 반환됐습니다. |
| 동료 의견·승인 | B의 실제 `COMMENTED`·`APPROVED` 응답에서 작성자 숫자 ID와 검토 대상 SHA를 검증했습니다. GitHub 원문 재조회에서도 일치했습니다. |
| 근거 수집 | 실제 PR과 B의 리뷰 2개를 수집했습니다. 같은 기록을 다시 가져와도 근거 ID 목록이 바뀌지 않았습니다. |
| 학생별 분리 | A의 PR은 학생 가, B의 리뷰는 학생 나의 개인 근거에 연결됐습니다. B의 리뷰는 학생 가의 개인 근거에 들어가지 않았고, 상대 학생의 개인 근거 조회는 양방향 HTTP 403으로 차단됐습니다. |
| 교사 기록·피드백 | 학생별로 비공개·개별·팀 피드백을 하나씩 저장했습니다. 같은 요청 재전송은 기존 결과를 반환했습니다. detail·export·learning 응답에서 비공개=작성 교사, 개별=대상 학생·교사, 팀=참여자 범위를 확인했습니다. |
| 인증값 격리 | 두 계정 토큰이 시험 상태 파일·DB/WAL/SHM·확인한 로컬 API 응답에 포함되지 않았습니다. CLI 자체의 자격 증명 저장소에 대한 보안 감사를 수행한 것은 아닙니다. |

검토 전후와 독립 원문 재조회에서 `main`은 시작 SHA `ac1c465a761beac4649f05c3dcec18b1baa09c08` 그대로였습니다. PR의 변경 파일은 `main.py` 하나였고, PR은 `open`, `merged=false`였습니다. 운영 교체나 main 자동 반영을 수행하지 않았습니다.

## 보존한 로컬 결과

- 실행 ID: `9f3f56c2-1631-42f0-a7a1-c7f97ee7f507`
- 합성 교실 프로젝트 ID: `587fcb4c-efda-446f-9082-0dbb59bbe610`
- 별도 DB·상태: `.local/github-two-account/classroom.sqlite`, `.local/github-two-account/state.json`
- 교사 피드백: 총 6개(비공개 2·학생 전달 2·팀 공유 2)
- 로컬 작업: 체크포인트 1개·PR 제안 1개, 모두 `succeeded`
- 근거 원장: 6종 15행, 수집 경로는 REST 보완 수집 14행·로컬 CLI 작업 결과 1행, Webhook 실수신 0행

근거 원장에는 이전 시험 저장소의 기록과 상태 스냅샷이 포함됩니다. 이번에 새로 생성한 독립 학생 활동 15개라는 뜻이 아닙니다. 학생 가의 조회 근거 12개·학생 나의 2개 차이도 기여도나 사고력 비교로 해석하지 않습니다. 이번에 새로 만든 협업 기록은 **PR 1개·B의 리뷰 2개**입니다.

비밀값을 제외한 [로컬 검증 요약](github-two-account-test/2026-10-28/local-validation.json)과 [독립 GitHub 원문 대조](github-two-account-test/2026-10-28/github-readback.json)를 보존했습니다. 원본 토큰·DB·세션은 커밋하지 않았습니다. 새 PR은 이 대화의 첨부에도 연결했습니다.

## 범위와 다음 검증

이번 결과로 기존 단일 계정 시험에서 남았던 **실제 다른 계정의 PR 리뷰·승인과 학생별 귀속**을 확인했습니다. 인증은 기존 GitHub CLI 두 계정이며 합성 학생에 명시 연결했습니다. 실제 Supabase GitHub OAuth 로그인, GitHub App 설치·권한 회수, Webhook 외부 수신·재전송, 학교 조직의 브랜치 보호, 실제 학생의 화면 사용성·기기·망·동시 수업 부하는 별도입니다.

화면 안내·중복 제출·초안 보존과 두 계정 도구의 최종 자동 회귀는 직전 커밋 `a65ae63`에서 **356개 통과**, 두 빌드 성공, 린트 오류 0·기존 경고 6개였습니다. 이번 실제 시험에서는 구현 코드를 변경하지 않았으며, 실제 API 확인을 전체 회귀 테스트의 새 실행으로 집계하지 않았습니다. 브라우저 자동 조작 도구를 사용할 수 없어 두 브라우저의 실제 로그인·클릭 사용성을 새로 검증하지 않았습니다.

시험 도구의 [실행·재개 안내](../scripts/classroom/two-account-github.md)를 참고하세요. `--run`은 실제 GitHub에 쓸 수 있으므로 상태를 지워 새 시험으로 만들거나 확인 없이 반복 실행할 필요가 없습니다. 운영 교체는 사용자 확인·승인 이후에 진행합니다.

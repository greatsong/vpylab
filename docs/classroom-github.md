# 새 수업 공간의 GitHub 연결

2026-10-28 로컬 대체 브랜치의 구현 기준입니다. 기존 수업 자료와 운영 GitHub OAuth 기능은 수정하지 않습니다.

## 저장 책임

학생의 개인 초안, 팀 저장본, 사고 과정, 질문, 제안과 동료 검토는 수업 서버의 SQLite에 먼저 저장합니다. 팀 저장본과 outbox 기록은 같은 트랜잭션에서 확정됩니다. GitHub 장애는 학생의 저장을 취소하지 않습니다. 로그인은 브라우저의 Supabase GitHub OAuth를 사용할 수 있지만 저장소 연동에는 학생 OAuth 토큰을 사용하지 않습니다. GitHub App의 개인 키와 설치 토큰은 서버에만 둡니다.

GitHub는 팀의 문제 정의·해결안 제안·동료 검토·수정을 남기는 협력 공간입니다. VPyLab은 그 이슈·PR·리뷰·커밋을 수집해 학생의 설명과 교사 피드백을 연결합니다. GitHub App이 수업 서버의 자동화 주체로 작동하고, 학생은 VPyLab 프로젝트 권한을 거쳐 요청합니다. 학생 계정으로 GitHub 활동을 가장하지 않습니다. `main`을 직접 갱신하거나 강제 푸시하는 API는 없습니다.

## 실행 모드

| 모드 | 동작 |
| --- | --- |
| `simulator` | 로컬 모드의 기본값. SQLite에 모의 저장소·외부 변경·PR을 저장하며 GitHub에 요청하지 않습니다. 화면은 모의 연결임을 표시합니다. |
| `offline` | 운영에서 자격 증명 없이 실행할 때 기본값. 초안과 팀 저장은 작동합니다. 기존 GitHub 제안 작업은 `blocked`로 보존됩니다. |
| `live` | 교사가 등록한 저장소에 GitHub App으로 접근합니다. 실제 저장소 변경과 PR 생성이 일어나므로 별도로 설정한 후 사용합니다. |

`simulator`는 로컬 수업 모드에서만 허용됩니다. 모의 저장소의 기준 SHA는 실제 GitHub SHA가 아닙니다. 모의 PR은 기본 브랜치에 자동 반영되지 않습니다. 교사의 외부 변경 시뮬레이션으로 충돌 동작을 검증할 수 있습니다.

## GitHub App 운영 설정

1. 학교 또는 교사 조직에 GitHub App을 등록합니다. 저장소 권한은 `Contents: Read and write`, `Issues: Read and write`, `Pull requests: Read and write`, 기본 `Metadata: Read`만 부여합니다. Workflow·관리·멤버 권한은 필요하지 않습니다.
2. 팀별 비공개 저장소를 준비하고, GitHub App을 선택한 저장소에만 설치합니다. 빈 저장소는 초기 커밋과 기본 브랜치가 있어야 합니다. 연결할 파일은 기본 `main.py`이며 50KB 이하 UTF-8 파일을 지원합니다. 파일이 없으면 새 제안에서 생성할 수 있습니다.
3. 서버의 비밀 관리 기능으로 아래 설정을 제공합니다. 개인 키와 Webhook 비밀값은 클라이언트 설정이나 `VITE_` 변수에 넣지 않습니다. `.env` 파일을 커밋하지 않습니다.

| 서버 변수 | 값 |
| --- | --- |
| `CLASSROOM_GITHUB_MODE` | `live` |
| `CLASSROOM_GITHUB_APP_ID` | GitHub App client ID 또는 application ID |
| `CLASSROOM_GITHUB_PRIVATE_KEY` | PEM 개인 키. 실제 줄바꿈 또는 `\n` 사용 가능 |
| `CLASSROOM_GITHUB_WEBHOOK_SECRET` | 별도 생성한 Webhook 비밀값 |
| `CLASSROOM_GITHUB_REPOSITORIES` | 아래 형식의 JSON 배열 |

```json
[
  {
    "key": "2027-team-one",
    "owner": "SCHOOL_ORGANIZATION",
    "repo": "team-one",
    "installationId": 123456,
    "repositoryId": 987654,
    "branch": "main",
    "path": "main.py",
    "projectId": "OPTIONAL_VPYLAB_PROJECT_ID"
  }
]
```

실제 ID를 서버에서 등록합니다. `projectId`를 지정하면 해당 프로젝트만 선택할 수 있습니다. 생략하면 교사가 이 서버에 등록된 저장소 중 하나를 지정할 수 있습니다. 프로젝트 소유자인 학생도 저장소 연결을 변경할 수 없습니다. 저장소는 기본적으로 비공개여야 하며, 공개가 필요한 교사 소유 예제만 서버 설정에서 명시적으로 `allowPublic: true`를 지정합니다.

4. 교사가 프로젝트의 저장소 선택에서 `key`를 연결합니다. 브라우저가 보낸 owner·installation ID·repository ID를 신뢰하지 않습니다. 작업 실행 시 서버 allowlist를 다시 대조하고 GitHub 응답의 저장소 ID·소유자·이름·공개 여부도 검사합니다.
5. Webhook URL을 `https://YOUR_CLASSROOM_SERVER/api/v2/github/webhook`으로 설정하고 `push`, `pull_request`, `pull_request_review`, `pull_request_review_comment`, `issues`, `issue_comment`를 구독합니다. 설치 변경 이벤트도 처리합니다. 원본 바이트에 대한 `X-Hub-Signature-256` HMAC을 세션/CSRF 및 JSON 파싱 전에 검사합니다. `X-GitHub-Delivery`는 SQLite 기본 키로 기록하여 중복 전송을 재처리하지 않습니다. 같은 ID의 다른 본문은 거부합니다.

GitHub App JWT는 서버에서 RS256으로 생성하고, 저장소 ID 하나와 세 권한으로 제한한 installation token을 발급합니다. 토큰은 만료 전까지만 서버 메모리에 캐시합니다. 토큰·개인 키·GitHub 원문 오류를 응답이나 작업 기록에 저장하지 않습니다.

## 학생과 교사의 사용 흐름

1. VPyLab에서 문제·성공 기준을 정하고 실험합니다. 개인 초안과 팀 저장본을 보존합니다.
2. GitHub 최신 코드를 가져옵니다. 서버는 기본 브랜치의 현재 SHA를 읽고, 그 SHA로 파일을 읽어 일관된 비교본을 만듭니다. 가져오기만으로 팀 코드를 바꾸지 않습니다.
3. 외부 코드와 팀 저장본을 비교하고, 제목·설명과 함께 GitHub 제안을 제출합니다. 제출한 기준 SHA와 실행 시 GitHub의 최신 SHA가 다르면 `github_base_conflict`로 중지합니다.
4. 일치하면 기존 tree를 기반으로 Python 파일만 바꾸는 commit과 작업별 고유 브랜치를 만들고 PR을 엽니다. 기본 브랜치의 다른 파일을 보존합니다. PR 생성 직전에 기준 SHA를 한 번 더 확인합니다. 그 이후 외부 변경도 GitHub PR의 병합·검토 절차를 거칩니다.
5. GitHub에서 교사 또는 허가된 팀원이 검토·병합한 뒤 VPyLab에서 다시 가져옵니다. 새 코드는 비교·기존 버전 검사를 거쳐 별도로 팀 저장본에 반영합니다. VPyLab이 GitHub PR을 자동 병합하지 않습니다.

VPyLab의 로컬 동료 제안과 GitHub PR은 현재 별도 기록입니다. GitHub PR을 내보내면 outbox에서 URL과 결과를 추적합니다. GitHub의 리뷰를 VPyLab 자체 리뷰로 자동 복제하지 않습니다.

## 과정 기록과 학생 피드백

‘GitHub 과정’ 화면은 이슈·PR·동료 리뷰·코드 의견·대화·커밋을 시간순으로 보여줍니다. ‘문제와 질문’에 남긴 질문은 명시적인 버튼으로 GitHub Issue 작업에 보낼 수 있습니다. 팀 확정 코드의 PR 제출은 ‘팀·연결’에서 진행합니다.

서명 Webhook으로 받은 기록은 `github_learning_events`에 영속 저장합니다. 수정·삭제 이벤트를 이미 수집한 원문에 덮어쓰지 않고 추가 사건으로 남기며, 원문 URL·SHA·숫자 작성자 ID·발생 시각·수신 시각을 보존합니다. 같은 사건을 다시 받아도 중복 보존하지 않습니다. 원문 링크는 연결된 GitHub 저장소의 HTTPS 주소만 허용합니다. 수집 전에 수정·삭제된 내용을 과거 상태로 복구한다고 보장하지 않습니다.

‘GitHub 과정 기록 가져오기’는 GET API로 기존 기록을 보완합니다. 한 번에 최대 24개 요청, 항목별 최대 2페이지, 최대 10개 PR의 리뷰를 확인합니다. 화면은 최근 200개 사건을 표시하고 더 오래된 기록·부분 수집·수집 실패를 알립니다. 현재 목록에 없다는 이유만으로 학생이 참여하지 않았다고 판정하지 않습니다. Webhook 이전의 전체 브랜치·전체 리뷰·삭제된 기록을 모두 복구하는 기능은 아닙니다.

운영에서는 서버가 검증한 Supabase GitHub provider identity의 숫자 ID를 학생 계정과 연결합니다. 이메일·표시 이름·GitHub 로그인 문자열만으로 작성자를 추측하지 않습니다. push payload에 숫자 커밋 작성자 ID가 없으면 해당 커밋은 미연결 상태로 두며 REST 보완 수집에서 확인할 수 있습니다. App이 생성한 PR·Issue는 GitHub 실제 작성자와 인증된 VPyLab 제출자를 구분합니다. 로컬 데모의 세 계정 연결은 `local_demo`로 표시하며 실제 GitHub 신원이 아닙니다.

교사는 학생을 선택하고 GitHub 원문 근거를 골라 관찰·다음 질문을 남길 수 있습니다. 피드백은 근거 ID와 제목·URL·SHA 스냅샷을 함께 보존하므로 최근 목록 밖의 근거도 다시 확인할 수 있습니다. 공개 범위는 다음과 같습니다.

| 공개 범위 | 조회 가능 대상 |
| --- | --- |
| 나만 보는 교사 기록 | 작성한 교사만 |
| 대상 학생에게 전달 | 대상 학생과 참여 교사 |
| 팀에 공유 | 해당 프로젝트 참여자 |

이 범위는 조회·학생별 요약·교사 현황·내보내기에도 적용합니다. 교사 개인 메모와 학생 피드백은 GitHub로 전송하지 않습니다. 같은 화면에서 GitHub 근거와 연결하되, 저장소에 접근 가능한 다른 학생에게 개인 관찰이 노출되지 않게 합니다. 학생에게는 본인의 근거와 전달된 피드백, 다음 탐구 질문이 표시됩니다. 기록 건수를 성적·기여도·사고력 점수로 환산하지 않고 AI를 사용하지 않는 수업도 같은 방식으로 관찰합니다.

## 장애와 재시도

`github_jobs`가 durable outbox이며 `pending → running → succeeded`로 진행됩니다. 네트워크·5xx는 지수 backoff로 최대 8회 자동 시도합니다. `Retry-After`를 우선하고, 소진된 primary rate limit은 `X-RateLimit-Reset` 이후에 시도합니다. secondary limit은 최소 1분부터 지수 대기합니다. 요청은 직렬화하고 변경 요청 사이에 최소 1초를 둡니다.

인증·권한 철회·저장소 변경·기준 SHA 충돌·잘못된 파일은 `blocked`로 표시합니다. 최신 코드를 확인하여 새 제안을 만들거나, 교사가 설정을 수정한 뒤 적절한 작업을 다시 시도해야 합니다. 재시작하면 5분 이상 남은 `running` 작업을 다시 처리합니다.

PR 생성 응답이 유실되어도 같은 고유 브랜치의 기존 PR을 찾아 중복 생성을 방지합니다. branch 생성 응답 유실은 기존 branch의 부모 commit과 파일 내용을 검사합니다. 일반 Issue API는 원자적인 중복 방지 키를 지원하지 않으므로 생성 응답 유실 시 자동 재생성을 멈춥니다. 교사가 실제 Issue 번호를 입력하면 본문의 작업 표식을 검증한 뒤 성공으로 복구할 수 있습니다.

## API

모든 프로젝트 경로는 `/api/v2/projects/:id/github` 아래에 있으며 로그인과 프로젝트 권한이 필요합니다. Webhook은 서명으로 인증합니다.

| 메서드·경로 | 역할 |
| --- | --- |
| `GET /` | 모드, 비교본, 모의 PR, 허용 저장소, 작업 상태 조회 |
| `PUT /` `{repositoryKey}` | 교사만 서버 allowlist의 저장소 연결 |
| `POST /fetch` | GitHub 현재 비교본 가져오기 |
| `POST /proposals` `{code,title,message?,baseSha,checkpointId?}` | 편집 권한으로 PR 생성 작업 큐에 등록. 저장본 ID가 있으면 같은 프로젝트·동일 코드 검사 후 저장 설명을 기본값으로 사용 |
| `POST /issues` `{issueId,title,body}` | 프로젝트에 저장된 동일 질문을 Issue로 내보내기 |
| `POST /simulate-push` `{code,baseSha}` | 로컬 모의 저장소에서 외부 커밋 재현 |
| `POST /jobs/:jobId/retry` | 관리 권한으로 중지·실패 작업 재시도 |
| `POST /jobs/:jobId/reconcile-issue` `{number}` | 교사가 응답 유실된 Issue의 작업 표식을 검증하고 복구 |
| `GET /learning` | 수집한 GitHub 과정 사건과 수집 상태 |
| `POST /learning/sync` | 읽기 전용 REST API로 기록 보완 수집 |
| `POST /learning/simulate` | 로컬 교사만 모의 협력 예시 생성 |
| `POST /api/v2/github/webhook` | 원본 본문 서명·저장소 연결·중복 전송 검사 |

프로젝트 루트의 `GET /api/v2/projects/:id/learning`은 학생 계정 귀속과 학생별 근거·질문·피드백을 추가합니다. 학생은 본인 요약만, 참여 교사는 참여 학생들의 요약을 봅니다. `POST /api/v2/projects/:id/feedback`은 `visibility`와 `evidenceIds`를 지원하며 다른 프로젝트의 근거 참조를 거부합니다.

## 검증 범위와 운영 전 확인

`node --test server/classroom/github.test.js`로 모의 GitHub API, 실제 HTTP 라우트, SQLite 재시작, SHA 충돌, 응답 유실, rate limit, 인증 실패, Webhook HMAC·중복 및 권한을 검사합니다. 테스트는 외부 GitHub 저장소에 쓰지 않습니다.

실제 GitHub App 설치와 학교 조직 정책, Webhook 도달, 저장소 보호·리뷰 규칙, 토큰 권한 승인, 비공개 저장소 요금제, 운영 백업·복구는 로컬 테스트로 입증할 수 없습니다. 운영 대체 전 별도 비공개 테스트 저장소에서 실제 설치·fetch·PR·외부 병합·권한 회수까지 확인해야 합니다.

구현 근거: [GitHub App JWT](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-json-web-token-jwt-for-a-github-app), [installation token](https://docs.github.com/en/rest/apps/apps#create-an-installation-access-token-for-an-app), [Git trees](https://docs.github.com/en/rest/git/trees), [Git commits](https://docs.github.com/en/rest/git/commits), [Git refs](https://docs.github.com/en/rest/git/refs), [Pull requests](https://docs.github.com/en/rest/pulls/pulls), [Webhook 서명](https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries), [REST API 권장 사용법](https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api).

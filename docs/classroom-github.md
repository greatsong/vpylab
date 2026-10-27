# 새 수업 공간의 GitHub 연결

2026-10-28 로컬 대체 브랜치의 구현 기준입니다. 기존 수업 자료와 운영 GitHub OAuth 기능은 수정하지 않습니다.

## 저장 책임

학생의 개인 초안, 팀 저장본, 사고 과정, 질문, 제안과 동료 검토는 수업 서버의 SQLite에 먼저 저장합니다. 팀 저장본과 outbox 기록은 같은 트랜잭션에서 확정됩니다. GitHub 장애는 학생의 저장을 취소하지 않습니다. 로그인은 브라우저의 Supabase GitHub OAuth를 사용할 수 있지만 저장소 연동에는 학생 OAuth 토큰을 사용하지 않습니다. GitHub App의 개인 키와 설치 토큰은 서버에만 둡니다.

GitHub는 팀의 확정 결과를 제안하고 외부 검토를 받는 저장소입니다. GitHub App이 수업 서버의 자동화 주체로 작동하고, 학생은 VPyLab 학급·프로젝트 권한을 거쳐 요청합니다. 학생 계정으로 GitHub 활동을 가장하지 않습니다. `main`을 직접 갱신하거나 강제 푸시하는 API는 없습니다.

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
5. Webhook URL을 `https://YOUR_CLASSROOM_SERVER/api/v2/github/webhook`으로 설정하고 `push`, `pull_request`를 구독합니다. 설치 변경 이벤트도 처리합니다. 원본 바이트에 대한 `X-Hub-Signature-256` HMAC을 세션/CSRF 및 JSON 파싱 전에 검사합니다. `X-GitHub-Delivery`는 SQLite 기본 키로 기록하여 중복 전송을 재처리하지 않습니다. 같은 ID의 다른 본문은 거부합니다.

GitHub App JWT는 서버에서 RS256으로 생성하고, 저장소 ID 하나와 세 권한으로 제한한 installation token을 발급합니다. 토큰은 만료 전까지만 서버 메모리에 캐시합니다. 토큰·개인 키·GitHub 원문 오류를 응답이나 작업 기록에 저장하지 않습니다.

## 학생과 교사의 사용 흐름

1. VPyLab에서 문제·성공 기준을 정하고 실험합니다. 개인 초안과 팀 저장본을 보존합니다.
2. GitHub 최신 코드를 가져옵니다. 서버는 기본 브랜치의 현재 SHA를 읽고, 그 SHA로 파일을 읽어 일관된 비교본을 만듭니다. 가져오기만으로 팀 코드를 바꾸지 않습니다.
3. 외부 코드와 팀 저장본을 비교하고, 제목·설명과 함께 GitHub 제안을 제출합니다. 제출한 기준 SHA와 실행 시 GitHub의 최신 SHA가 다르면 `github_base_conflict`로 중지합니다.
4. 일치하면 기존 tree를 기반으로 Python 파일만 바꾸는 commit과 작업별 고유 브랜치를 만들고 PR을 엽니다. 기본 브랜치의 다른 파일을 보존합니다. PR 생성 직전에 기준 SHA를 한 번 더 확인합니다. 그 이후 외부 변경도 GitHub PR의 병합·검토 절차를 거칩니다.
5. GitHub에서 교사 또는 허가된 팀원이 검토·병합한 뒤 VPyLab에서 다시 가져옵니다. 새 코드는 비교·기존 버전 검사를 거쳐 별도로 팀 저장본에 반영합니다. VPyLab이 GitHub PR을 자동 병합하지 않습니다.

VPyLab의 로컬 동료 제안과 GitHub PR은 현재 별도 기록입니다. GitHub PR을 내보내면 outbox에서 URL과 결과를 추적합니다. GitHub의 리뷰를 VPyLab 자체 리뷰로 자동 복제하지 않습니다.

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
| `POST /api/v2/github/webhook` | 원본 본문 서명·저장소 연결·중복 전송 검사 |

## 검증 범위와 운영 전 확인

`node --test server/classroom/github.test.js`로 모의 GitHub API, 실제 HTTP 라우트, SQLite 재시작, SHA 충돌, 응답 유실, rate limit, 인증 실패, Webhook HMAC·중복 및 권한을 검사합니다. 테스트는 외부 GitHub 저장소에 쓰지 않습니다.

실제 GitHub App 설치와 학교 조직 정책, Webhook 도달, 저장소 보호·리뷰 규칙, 토큰 권한 승인, 비공개 저장소 요금제, 운영 백업·복구는 로컬 테스트로 입증할 수 없습니다. 운영 대체 전 별도 비공개 테스트 저장소에서 실제 설치·fetch·PR·외부 병합·권한 회수까지 확인해야 합니다.

구현 근거: [GitHub App JWT](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-json-web-token-jwt-for-a-github-app), [installation token](https://docs.github.com/en/rest/apps/apps#create-an-installation-access-token-for-an-app), [Git trees](https://docs.github.com/en/rest/git/trees), [Git commits](https://docs.github.com/en/rest/git/commits), [Git refs](https://docs.github.com/en/rest/git/refs), [Pull requests](https://docs.github.com/en/rest/pulls/pulls), [Webhook 서명](https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries), [REST API 권장 사용법](https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api).

# Pyodide 첫 로딩 단축·재방문 즉시 실행·교실 요청 제한 (2026-10-29)

- 기준 커밋: `7428fdd` (main) → 이 작업 브랜치
- 측정 도구: Python Playwright 1.62 + Chromium, 새 브라우저 프로필에서 `/mission/CT-1`을 열어 화면에 "Python 엔진 준비 완료!"가 나타날 때까지의 시간을 3회 측정. "재방문"은 같은 프로필에서 페이지를 닫고 4초 뒤 다시 연 값(HTTP 캐시·Service Worker 적용).
- 측정 기기: 맥북(유선급 인터넷). 상위 세션이 다른 망에서 잰 운영 앱 15초와 차이가 나는 이유는 망 속도이며, 아래 표의 바닥값(약 1.8초)은 네트워크가 아니라 WebAssembly 컴파일과 Python 초기화 시간입니다.

## 1. 전후 측정

| 환경 | 첫 방문 평균(범위, 초) | 재방문 평균(범위, 초) | Pyodide 출처 | 재방문 때 Pyodide 네트워크 |
|---|---|---|---|---|
| 운영 https://vpylab.vercel.app (변경 전) | 2.52 (2.20~3.08) | 1.82 (1.78~1.90) | jsdelivr CDN | HTTP 캐시 (CDN 헤더에 의존) |
| 로컬 dev 서버 (변경 전) | 2.50 (1.86~3.75) | 1.90 (1.76~2.01) | jsdelivr CDN | HTTP 캐시 |
| 로컬 dev 서버 (변경 후) | 1.99 (1.65~2.17) | 1.84 (1.70~1.95) | 같은 출처 `/pyodide/v0.27.0/` | dev 서버는 no-cache라 재검증 |
| 로컬 `vite preview` (변경 후, Service Worker) | 2.11 (2.03~2.18) | 1.89 (1.84~1.92) | 같은 출처 | **없음** — 핵심 파일 5개 모두 Service Worker 캐시에서 제공 |
| 교실 LAN 모드 http://172.30.15.219:4077 (변경 후) | 2.24 (1.74~2.69) | 2.05 (1.80~2.55) | 교사 맥북(같은 출처) | HTTP 캐시 (http라 Service Worker 없음) |

파일별 소요(첫 방문 1회차, 요청 시작 → 응답 완료):

| 파일 | 운영 CDN(변경 전) | 같은 출처 preview(변경 후) | 비고 |
|---|---|---|---|
| pyodide.js | 48ms · 6.5KB | 7ms · 6KB | importScripts |
| pyodide.asm.js | 90ms · 245KB(br) | 91ms · 236KB | |
| pyodide.asm.wasm | 1,066ms · 2.99MB(br) | 1,162ms · 10.1MB(무압축) | 시간의 대부분은 스트리밍 컴파일 |
| python_stdlib.zip | 103ms · 2.32MB | 106ms · 2.36MB | |
| pyodide-lock.json | 100ms · 23KB | 101ms · 25KB | 변경 후는 패키지 경로를 CDN 절대 주소로 바꾼 판 |

결론: 빠른 망에서는 출처를 바꿔도 첫 방문 시간은 비슷합니다(약 0.4초 단축). 효과는 (1) CDN이 막히거나 느린 학교망에서 같은 출처로 받는 것, (2) 재방문 때 Service Worker가 네트워크 없이 시작하는 것, (3) 교실 LAN 모드에서 외부 회선 없이 동작하는 것입니다. 학교망에서의 실측은 배포 후 같은 스크립트(`scratchpad`의 `measure.py`, 아래 재현 방법)로 다시 재야 합니다.

재현 방법: Playwright(Python)로 `page.goto(url)` 뒤 `wait_for_function`으로 본문에 "Python 엔진 준비 완료" 또는 "실행 준비 완료"가 나타날 때까지 기다리고, `request`/`requestfinished` 이벤트로 파일별 시간을 기록합니다.

## 2. 자체 호스팅 파일 (`client/public/pyodide/v0.27.0/`, 빌드 때 npm `pyodide@0.27.0`에서 복사)

| 파일 | 크기 |
|---|---|
| pyodide.js | 14,861 B |
| pyodide.asm.js | 1,253,545 B |
| pyodide.asm.wasm | 10,104,029 B |
| python_stdlib.zip | 2,358,641 B |
| pyodide-lock.json (패키지 경로를 CDN 절대 주소로 재작성) | 115,580 B |
| **합계** | **13,846,656 B (13.2 MiB)** |

- 복사는 `client/scripts/pyodide-assets.mjs`의 Vite 플러그인이 `vite dev`·`vite build` 시작 때 수행하며, 복사본은 `.gitignore`에 넣어 저장소에는 들어가지 않습니다.
- 경로에 버전을 넣어(`/pyodide/v0.27.0/`) 1년 immutable 캐시를 안전하게 줍니다. 버전을 올리면 Worker의 `PYODIDE_VERSION`과 `package.json`의 `pyodide` 버전을 함께 바꿉니다(플러그인이 불일치를 빌드 오류로 알립니다).
- micropip 자동 설치 패키지(numpy 등)는 계속 CDN에서 받습니다. Pyodide는 lock 파일의 `file_name`이 절대 URL이면 indexURL과 합치지 않고 그대로 받으므로, lock 파일만 재작성하면 됩니다.
- Vercel 용량: Git 연동 배포는 Vercel이 빌드하므로 "소스 업로드 100MB(Hobby)/1GB(Pro)" 제한과 무관하고, 빌드 산출물 크기에는 상한이 없습니다(파일 수가 10만 개 이상일 때만 빌드 시간 문제). 산출물은 기존 약 16MB에서 약 31MB로 늘어납니다.

## 3. Worker 로딩 순서

1. 같은 출처 `/pyodide/v0.27.0/pyodide.js` (1회 시도 — 404는 결정적이므로 재시도 없음)
2. `https://cdn.jsdelivr.net/pyodide/v0.27.0/full/` (3회)
3. `https://unpkg.com/pyodide@0.27.0/` (3회)

성공한 출처를 `indexURL`로 써서 wasm·stdlib·lock 파일도 같은 곳에서 받습니다. `ready` 메시지에 출처를 실어 보내 메인 스레드가 Service Worker 캐시를 채웁니다.

## 4. Service Worker 캐시 정책 (`client/src/sw/service-worker.js`, 빌드 때 `sw.js`로 생성)

| 대상 | 정책 | 캐시 이름 |
|---|---|---|
| 앱 셸(index.html 또는 classroom.html)·`/assets/*` JS·CSS(Monaco·Three.js·React 청크 포함) | 설치 때 미리 저장, 캐시 우선. 산출물 목록 해시가 바뀌면 새 캐시를 만들고 옛 캐시 삭제 | `vpylab-app-<해시>` |
| `/pyodide/v*/` 핵심 파일, CDN의 Pyodide·휠(jsdelivr·unpkg) | 캐시 우선. 처음 받을 때 저장하고, Worker가 준비되면 `WARM_PYODIDE` 메시지로 빠진 파일을 채움(HTTP 캐시에서 채워져 추가 네트워크 없음). 다른 버전의 핵심 파일은 activate 때 삭제 | `vpylab-pyodide` |
| 글꼴 CSS(Google Fonts·Fontshare) | 캐시 먼저, 뒤에서 갱신 | `vpylab-fonts` |
| 글꼴 파일 | 캐시 우선 | `vpylab-fonts` |
| 페이지 이동(navigate) | 네트워크 우선, 끊기면 저장한 앱 셸 | |
| API·Supabase·그 밖의 요청 | 건드리지 않음 | |

- 등록은 빌드된 앱(`import.meta.env.PROD`)이고 보안 출처(https 또는 localhost)일 때만 합니다. 개발 서버와 http LAN 출처에서는 등록하지 않습니다.
- 핵심 파일을 설치 때 미리 받지 않는 이유: 첫 방문에 Worker가 같은 파일을 동시에 받아 학생 30명 기준 2배 대역폭이 들고, 갤러리만 보는 방문자도 14MB를 받게 되기 때문입니다.
- Pyodide Worker가 초기화 뒤 fetch 등을 지우는 보안 정책은 그 Worker 전역에만 적용됩니다. Service Worker는 브라우저가 별도 스레드로 띄우고 Worker의 요청도 가로채므로 충돌하지 않습니다. 교실 앱(`classroom.html`)도 같은 플러그인으로 `sw.js`를 만들며 앱 셸만 `classroom.html`로 바꿉니다.
- `sw.js`는 Vercel의 기본 규칙(`no-cache, no-store`)으로 제공되어 갱신이 바로 반영됩니다.

## 5. CSP·헤더 변경

- `vercel.json`, `client/vercel.json`: rewrites에서 `pyodide/`와 `sw.js`를 제외(없는 파일이 index.html로 바뀌지 않게), `/pyodide/(.*)`에 `Cache-Control: public, max-age=31536000, immutable`. 메인 CSP는 이미 `script-src 'self' 'unsafe-eval'`, `connect-src 'self'`, `worker-src 'self' blob:`을 허용해 변경 없음.
- `client/vercel.classroom.json`과 `client/src/classroom/worker-policy.js`(Worker 전용 CSP): `connect-src`에 `'self'` 추가(같은 출처 wasm·stdlib·lock을 fetch하기 위해). 같은 출처 API 보호는 Worker가 초기화 뒤 요청 가능한 API를 모두 지우는 것으로 유지하며, 이번에 `caches`(Cache Storage)도 삭제 목록에 넣었습니다.
- Worker의 `fetch`: 기존에는 초기화 뒤 완전히 지워 `import numpy`가 "fetch is not a function"으로 실패했습니다(운영에서도 같은 상태였음을 LAN 검증 중 확인). 이제 패키지 설치 중(학생 코드 실행 전)이고 주소가 Pyodide 패키지 출처(같은 출처 `/pyodide/`, jsdelivr·unpkg의 pyodide, pypi.org, files.pythonhosted.org)일 때만 통과시키는 가드로 바꿨습니다. 학생 코드가 실행되는 동안에는 모든 주소를 거부합니다.

## 6. 요청 제한 (`server/middleware/rate-limit.js`)

| 층 | 키 | 한도(분당) | 적용 |
|---|---|---|---|
| IP 층(인증 전) | IP(IPv6는 /56) | 600 | `/api` 전체 (`server/index.js`) |
| 사용자 읽기 | Supabase 사용자 ID | 120 | `/api/projects/access`, `collaborators/pending`, `class-overview`, `members/github-usernames`(비로그인은 IP) |
| 사용자 쓰기 | 사용자 ID | 30 | `/api/projects/setup`, `collaborators/invite`·`cancel`, `commit`, `/api/sync/github` |
| 사용자 발행 | 사용자 ID | 3 (기존 값 유지) | `/api/publish/*` |
| 비로그인 공유 링크 | IP | 60 | `POST /api/share` |

근거: 학생 30명이 같은 공인 IP로 들어오므로 IP 층은 30명 × 분당 20회 = 600으로 두고, 실제 남용 방어는 인증 뒤 사용자별 한도가 맡습니다. 사용자 층 제한은 `requireSupabaseUser` 뒤에 둬야 사용자 ID로 키를 만들 수 있어 미들웨어 순서를 바꿨습니다(테스트가 순서를 검사). 기존에는 모든 제한이 인증 전 IP 기준 분당 10회(발행 3회)여서 한 학급의 11번째 요청부터 429였습니다. 환경변수 `RATE_LIMIT_IP_PER_MINUTE`, `RATE_LIMIT_USER_READ_PER_MINUTE`, `RATE_LIMIT_USER_WRITE_PER_MINUTE`, `RATE_LIMIT_USER_PUBLISH_PER_MINUTE`, `RATE_LIMIT_SHARE_PER_MINUTE`로 조정할 수 있습니다. 서버 인스턴스가 여러 개가 되면 공유 저장소 기반 한도를 검토합니다(현재 Railway 단일 인스턴스, MemoryStore).

## 7. GlowScript 참고 (https://github.com/vpython/glowscript)

- 외부 라이브러리(jQuery·ACE·glow 런타임·RapydScript 컴파일러)를 CDN이 아니라 자기 서버의 `lib/`·`package/`에서 제공하고, 런타임 파일 이름에 버전을 넣습니다(`package/glow.3.2.min.js`, `package/RScompiler.3.2.min.js`). 캐시 무효화를 파일 이름의 버전으로 처리하는 방식이며, 이번 `/pyodide/v0.27.0/` 경로 설계와 같은 원리입니다.
- `ide/routes.py`는 `ide.js`와 `untrusted/` 응답에만 `no-store`를 걸고 정적 파일은 플랫폼(GAE) 기본 캐시에 맡깁니다. Service Worker나 localStorage 캐시는 쓰지 않습니다.
- 학생 프로그램은 별도 출처(sandbox 서브도메인)의 iframe에서 실행하고 postMessage로만 통신합니다. VPyLab은 Web Worker + API 삭제 + Worker 전용 CSP로 격리하므로 구조가 다릅니다.
- 참고할 점: 버전이 붙은 경로 + 긴 캐시(이미 반영). 그 밖에 가져올 캐시 기법은 없었습니다.

## 8. 운영 배포 시 확인할 점

1. 배포 뒤 `https://vpylab.vercel.app/pyodide/v0.27.0/pyodide.asm.wasm`을 받아 `content-type: application/wasm`, `cache-control: public, max-age=31536000, immutable`, `content-encoding`(br 또는 gzip)을 확인합니다. 압축이 없으면 10.1MB가 그대로 전송되므로 사전 압축을 검토합니다.
2. `/pyodide/v0.27.0/missing`이 index.html이 아니라 404인지 확인합니다(rewrites 제외가 적용됐는지).
3. 미션 화면에서 DevTools → Application → Service Workers에 `sw.js`가 활성이고, Cache Storage에 `vpylab-app-*`, `vpylab-pyodide`가 생기는지, 새로고침 뒤 Pyodide 파일이 "(ServiceWorker)"로 제공되는지 확인합니다.
4. 교실 v2 배포(`vercel.classroom.json`)는 Worker CSP에 `'self'`가 들어갔는지 응답 헤더로 확인합니다.
5. 샌드박스에서 `import numpy`가 설치까지 끝나는지 확인합니다(이전에는 운영에서도 실패).
6. Railway 서버에 새 환경변수는 필요 없습니다. 배포 뒤 같은 IP에서 로그인 사용자 두 명이 번갈아 커밋해도 429가 나지 않는지 확인합니다.
7. 학교망에서 이 문서의 방법으로 첫 방문·재방문 시간을 다시 재어 표를 갱신합니다.

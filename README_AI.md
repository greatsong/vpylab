# VPyLab — AI 배포 가이드

> 이 문서는 **AI 에이전트(Claude Code, Cursor, Codex 등)가 읽고 배포를 수행**하기 위한 구조화된 가이드입니다.
> 사람이 읽을 가이드는 [`README.md`](README.md)를 참고하세요.

---

## 프로젝트 메타데이터

```yaml
name: VPyLab
description: 3D Python 프로그래밍 교육 플랫폼 (Pyodide + Three.js)
architecture: monorepo (client/ + server/)
frontend: React 19, Vite 8, Tailwind v4, Three.js, Monaco Editor
backend: Express 5, Node.js (ESM)
database: Supabase (PostgreSQL + Auth + RLS)
ai_service: Upstage Solar Pro 3 (선택사항)
license: AGPL-3.0 (code), CC BY-NC-SA 4.0 (missions)
```

---

## 디렉토리 구조

```
vpylab/
├── client/                     # React 프론트엔드
│   ├── src/
│   ├── public/
│   ├── index.html
│   ├── vite.config.js
│   ├── package.json
│   └── dist/                   # 빌드 출력 (gitignored)
├── server/                     # Express 백엔드
│   ├── index.js                # 진입점
│   ├── routes/
│   │   ├── ai.js               # POST /api/ai/hint (Upstage 프록시)
│   │   ├── share.js            # POST /api/share (코드 공유)
│   │   └── publish.js          # POST /api/publish (GitHub Pages 발행)
│   ├── Procfile                # `web: node index.js`
│   ├── package.json
│   └── .env.example
├── supabase/
│   ├── config.toml
│   └── migrations/             # 001~006, 순서대로 실행 필수
├── vercel.json                 # 프론트엔드 배포 설정
├── .env.example                # 루트 환경변수 템플릿
└── CLAUDE.md                   # 프로젝트별 Claude Code 지침
```

---

## 환경변수 명세

### 프론트엔드 (client/)

| 변수명 | 필수 | 설명 | 예시 |
|--------|------|------|------|
| `VITE_SUPABASE_URL` | Y | Supabase 프로젝트 URL | `https://xxxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Y | Supabase anon/public 키 | `eyJhbGciOiJI...` |
| `VITE_API_BASE_URL` | Y* | 백엔드 서버 URL (프로덕션 빌드 시) | `https://vpylab-server.onrender.com` |

> *개발 모드에서는 Vite proxy가 `/api` → `localhost:4034`로 전달하므로 불필요.

### 백엔드 (server/)

| 변수명 | 필수 | 설명 | 예시 |
|--------|------|------|------|
| `PORT` | N | 서버 포트 (기본 4034, Render에서는 10000) | `10000` |
| `ALLOWED_ORIGINS` | Y | CORS 허용 오리진 (쉼표 구분) | `https://vpylab.vercel.app` |
| `SUPABASE_URL` | Y | Supabase 프로젝트 URL | `https://xxxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Y | Supabase service_role 키 (**비밀**) | `eyJhbGciOiJI...` |
| `UPSTAGE_API_KEY` | N | Upstage Solar Pro 3 API 키 | `up_xxxx` |
| `NODE_ENV` | N | 환경 모드 | `production` |

---

## 배포 절차 (무료 서비스)

### 전제 조건

사용자에게 아래 계정이 있는지 확인. 없으면 가입 안내:
- GitHub (https://github.com/signup)
- Supabase (https://supabase.com) — GitHub SSO 가능
- Render (https://render.com) — GitHub SSO 가능
- Vercel (https://vercel.com) — GitHub SSO 가능

사용자에게 VPyLab 리포지토리를 fork했는지 확인.

---

### Phase 1: Supabase 설정

#### 1-1. 프로젝트 생성

```
서비스: Supabase Dashboard
경로: https://supabase.com/dashboard → New Project
설정:
  - Name: vpylab
  - Database Password: (사용자 입력)
  - Region: Northeast Asia (Seoul) 또는 가장 가까운 리전
  - Plan: Free
```

#### 1-2. 스키마 마이그레이션

SQL Editor에서 아래 파일을 **번호 순서대로** 실행:

```
supabase/migrations/001_vpylab_schema.sql    # 핵심 테이블 4개 + RLS
supabase/migrations/002_gallery.sql           # 갤러리 테이블
supabase/migrations/003_shares.sql            # 코드 공유 테이블
supabase/migrations/004_shares_rls_fix.sql    # RLS 정책 보완
supabase/migrations/005_gallery_search_index.sql  # 검색 인덱스
supabase/migrations/006_gallery_collaboration.sql # 협업 기능
```

> 각 파일은 `IF NOT EXISTS` 가드가 있지만, 순서 의존성(FK 참조)이 있으므로 순서 준수 필수.

#### 1-3. 키 수집

Supabase Dashboard → Settings → API에서 수집:

```
SUPABASE_URL          = Project URL (https://xxxx.supabase.co)
SUPABASE_ANON_KEY     = anon public key
SUPABASE_SERVICE_KEY  = service_role key (reveal 클릭)
```

#### 1-4. 인증 설정

Supabase Dashboard → Authentication → URL Configuration:

```
Site URL:       https://{frontend-domain}   # Phase 3 완료 후 설정
Redirect URLs:  https://{frontend-domain}/**
```

---

### Phase 2: 백엔드 배포 (Render)

#### 옵션 A: Render (권장 — 무료, 간편)

```
서비스: Render Dashboard
경로: https://dashboard.render.com → New → Web Service
설정:
  - Repository: 사용자의 vpylab fork
  - Branch: main
  - Root Directory: server
  - Runtime: Node
  - Build Command: npm install
  - Start Command: node index.js
  - Instance Type: Free
  - Region: Singapore
환경변수:
  PORT=10000
  ALLOWED_ORIGINS=https://vpylab.vercel.app   # Phase 3 후 실제 URL로 변경
  SUPABASE_URL={Phase 1에서 수집}
  SUPABASE_SERVICE_ROLE_KEY={Phase 1에서 수집}
  NODE_ENV=production
```

배포 완료 후 URL: `https://vpylab-server-xxxx.onrender.com`

검증: `GET /api/health` → `{"status":"ok",...}`

#### 옵션 B: Railway

```
서비스: Railway Dashboard
경로: https://railway.com → New Project → Deploy from GitHub repo
설정:
  - Repository: 사용자의 vpylab fork
  - Root Directory: /server
  - Start Command: (Procfile 자동 감지: web: node index.js)
환경변수: (옵션 A와 동일)
```

#### 옵션 C: Fly.io

```bash
# CLI 설치 후
cd server
fly launch --name vpylab-server --region nrt --no-deploy
# fly.toml 자동 생성
fly secrets set SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... ALLOWED_ORIGINS=... NODE_ENV=production
fly deploy
```

> **무료 티어 비교:**
> | 서비스 | 무료 한도 | 절전 | 특징 |
> |--------|-----------|------|------|
> | Render | 750시간/월 | 15분 후 | 가장 간편 |
> | Railway | $5 크레딧/월 | 없음 | 더 빠름, 크레딧 소진 주의 |
> | Fly.io | 3 shared-cpu VMs | 없음 | CLI 필요, 가장 유연 |

---

### Phase 3: 프론트엔드 배포 (Vercel)

#### 옵션 A: Vercel (권장)

```
서비스: Vercel Dashboard
경로: https://vercel.com → Add New → Project → Import Git Repository
설정:
  - Repository: 사용자의 vpylab fork
  - Framework Preset: Vite
  - Root Directory: client
  - Build Command: npm install && npx vite build
  - Output Directory: dist
환경변수:
  VITE_SUPABASE_URL={Phase 1에서 수집}
  VITE_SUPABASE_ANON_KEY={Phase 1에서 수집한 anon key}
  VITE_API_BASE_URL={Phase 2에서 받은 백엔드 URL}
```

> **주의:** `vercel.json`이 루트에 이미 있음. Root Directory를 `client`로 설정하면
> Vercel이 `vercel.json`을 루트에서 읽고, 빌드는 `client/` 기준으로 수행.
> `vercel.json`의 `buildCommand`와 `outputDirectory`가 이미 `client/` 기준으로 설정되어 있으므로
> 충돌할 수 있음. **Root Directory를 `client`로 설정한 경우, Vercel Dashboard에서
> Build Command와 Output Directory를 직접 지정**하는 것이 안전함.

배포 완료 후 URL: `https://vpylab-xxxx.vercel.app`

#### 옵션 B: Netlify

```
서비스: Netlify Dashboard
설정:
  - Repository: 사용자의 vpylab fork
  - Base directory: client
  - Build command: npm install && npx vite build
  - Publish directory: client/dist
환경변수: (Vercel과 동일)

추가 설정 필요 — netlify.toml 또는 _redirects:
  /* /index.html 200    # SPA 라우팅 리다이렉트
```

#### 옵션 C: GitHub Pages (프론트엔드만, 정적)

```bash
cd client
npm install && npx vite build
# dist/ 폴더를 gh-pages 브랜치에 푸시
# 또는 peaceiris/actions-gh-pages GitHub Action 사용
```

> GitHub Pages는 서버사이드 리다이렉트가 없으므로 SPA 라우팅에 `404.html` 핵 필요.
> 권장하지 않음.

---

### Phase 4: 사후 연결

#### 4-1. CORS 오리진 업데이트

Render 환경변수 `ALLOWED_ORIGINS`를 실제 프론트엔드 URL로 변경:

```
ALLOWED_ORIGINS=https://vpylab-xxxx.vercel.app
```

커스텀 도메인 포함 시 쉼표 구분:
```
ALLOWED_ORIGINS=https://vpylab-xxxx.vercel.app,https://myschool.kr
```

#### 4-2. Supabase 인증 URL 설정

Supabase Dashboard → Authentication → URL Configuration:
```
Site URL:       https://vpylab-xxxx.vercel.app
Redirect URLs:  https://vpylab-xxxx.vercel.app/**
```

#### 4-3. Vercel CSP 헤더 (선택)

`vercel.json`의 `Content-Security-Policy` 헤더에서 `connect-src`의
백엔드 URL을 실제 Render URL로 변경:

```
connect-src 'self' https://*.supabase.co ... https://vpylab-server-xxxx.onrender.com blob:;
```

#### 4-4. 검증 체크리스트

```
[ ] GET {backend-url}/api/health → {"status":"ok"}
[ ] 프론트엔드 URL 접속 → 에디터 + 3D 뷰어 로드
[ ] Python 코드 실행 → 3D 렌더링
[ ] 코드 공유 버튼 → 공유 링크 생성
[ ] (선택) 회원가입/로그인 → 코드 저장/불러오기
[ ] (선택) AI 힌트 → 응답 반환
```

---

### Phase 5: AI 힌트 활성화 (선택)

```
서비스: Upstage Console (https://console.upstage.ai)
1. 회원가입 및 API Key 발급
2. Render 환경변수에 추가:
   UPSTAGE_API_KEY={발급받은 키}
3. 자동 재배포 대기
```

> 대안 AI 서비스로 교체 시 `server/routes/ai.js`의 API 엔드포인트와 모델명 수정 필요.
> OpenAI 호환 API라면 URL과 모델명만 변경하면 됨.

---

## 로컬 개발 환경

```bash
# 1. 의존성 설치
npm install
cd client && npm install
cd ../server && npm install
cd ..

# 2. 환경변수 설정
cp .env.example .env.local
# .env.local 편집: Supabase URL, 키 입력

cp server/.env.example server/.env
# server/.env 편집: Supabase URL, service_role 키 입력

# 3. 개발 서버 실행
npm run dev
# → client: http://localhost:4033
# → server: http://localhost:4034
# → Vite proxy: /api/* → localhost:4034
```

---

## API 엔드포인트

| Method | Path | 설명 | Rate Limit |
|--------|------|------|------------|
| GET | `/api/health` | 헬스체크 | 없음 |
| POST | `/api/ai/hint` | AI 힌트 요청 | 5/분, 20/일 per IP |
| POST | `/api/share` | 코드 공유 링크 생성 | 10/분 per IP |
| POST | `/api/publish` | GitHub Pages 발행 | 3/분 per IP |
| POST | `/api/publish/fetch` | GitHub 리포에서 코드 가져오기 | 3/분 per IP |
| PUT | `/api/publish/update` | GitHub 리포 업데이트 | 3/분 per IP |
| POST | `/api/publish/fork` | 리포 fork | 3/분 per IP |

---

## 보안 주의사항

- `SUPABASE_SERVICE_ROLE_KEY`는 절대 프론트엔드에 노출하지 않음
- 모든 테이블에 RLS(Row Level Security) 정책 적용됨
- Express에 `helmet`, `cors`, `express-rate-limit` 미들웨어 적용
- Pyodide Worker에서 `fetch`, `WebSocket`, `IndexedDB` 삭제 필수
- 콘솔 출력은 `textContent`로만 렌더링 (`innerHTML` 금지)
- 공유 코드는 LZ-String 디코딩 후 50KB 상한 검증

---

## 데이터베이스 스키마 요약

```
vpylab_classes      — 학급 (teacher_id, invite_code)
vpylab_profiles     — 사용자 프로필 (role: student|teacher|admin)
vpylab_saved_code   — 저장된 코드 (user_id, mission_id)
vpylab_submissions  — 미션 제출 (score, passed, grading_details)
vpylab_gallery      — 갤러리 작품
vpylab_gallery_likes — 좋아요
vpylab_shares       — 임시 코드 공유 (nanoid 8자, 만료 없음)
```

---

## 트러블슈팅 참조

| 증상 | 원인 | 해결 |
|------|------|------|
| 프론트엔드 빈 화면 | `VITE_SUPABASE_URL` 미설정 | Vercel 환경변수 확인 후 재배포 |
| 코드 공유 500 에러 | `SUPABASE_SERVICE_ROLE_KEY` 미설정 | Render 환경변수 확인 |
| CORS 에러 | `ALLOWED_ORIGINS` 불일치 | 실제 프론트엔드 URL로 수정 |
| 로그인 리다이렉트 실패 | Supabase Site URL 미설정 | Auth → URL Configuration 설정 |
| Render 30초 대기 | 무료 인스턴스 절전 | 정상 동작, 수업 전 미리 접속 |
| AI 힌트 503 | `UPSTAGE_API_KEY` 미설정 | 선택사항, 키 추가 또는 무시 |
| 빌드 실패 "vite not found" | Root Directory 미설정 | `client`로 지정 확인 |

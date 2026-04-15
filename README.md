# VPyLab — 3D 프로그래밍 교육 플랫폼

> Python으로 3D 세상을 만드는 교육 플랫폼. Pyodide + Three.js + Web Audio.

---

## 이 문서는 누구를 위한 건가요?

**프로그래밍을 잘 모르는 선생님**도 VPyLab을 직접 배포해서 수업에 사용할 수 있도록 안내합니다.  
모든 단계를 **스크린샷 없이도 따라할 수 있게** 최대한 쉽게 설명했습니다.

AI에게 배포를 맡기고 싶다면 → [`README_AI.md`](README_AI.md) 를 AI에게 보여주세요.

---

## 목차

1. [전체 구조 이해하기](#1-전체-구조-이해하기)
2. [사전 준비](#2-사전-준비)
3. [Step 1: Supabase 데이터베이스 만들기](#step-1-supabase-데이터베이스-만들기)
4. [Step 2: 백엔드 서버 배포하기 (Render)](#step-2-백엔드-서버-배포하기-render)
5. [Step 3: 프론트엔드 배포하기 (Vercel)](#step-3-프론트엔드-배포하기-vercel)
6. [Step 4: 동작 확인하기](#step-4-동작-확인하기)
7. [선택사항: AI 힌트 기능 켜기](#선택사항-ai-힌트-기능-켜기)
8. [문제가 생겼을 때](#문제가-생겼을-때)
9. [업데이트하기](#업데이트하기)

---

## 1. 전체 구조 이해하기

VPyLab은 세 부분으로 나뉩니다:

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  프론트엔드  │────▶│   백엔드    │────▶│ 데이터베이스 │
│  (화면)     │     │  (서버)     │     │  (저장소)    │
│  Vercel     │     │  Render     │     │  Supabase   │
│  무료       │     │  무료       │     │  무료        │
└─────────────┘     └─────────────┘     └─────────────┘
```

| 구성 요소 | 하는 일 | 배포할 곳 | 비용 |
|-----------|---------|-----------|------|
| 프론트엔드 | 학생이 보는 화면 (에디터, 3D 뷰어) | Vercel | 무료 |
| 백엔드 | AI 힌트, 코드 공유, 작품 발행 | Render | 무료 |
| 데이터베이스 | 학급, 학생, 코드 저장 | Supabase | 무료 |

**무료 한도 참고:**
- Vercel: 월 100GB 트래픽 (학교 한 곳이면 충분)
- Render: 무료 인스턴스는 15분 미사용 시 절전 (첫 요청에 30초 대기)
- Supabase: 500MB 저장, 월 5만 API 호출

---

## 2. 사전 준비

아래 계정을 **무료로** 만들어주세요. 이메일 하나로 모두 가입 가능합니다.

| 서비스 | 가입 주소 | 필요한 이유 |
|--------|-----------|-------------|
| GitHub | https://github.com/signup | 코드 저장소 + 로그인 |
| Supabase | https://supabase.com | 데이터베이스 |
| Render | https://render.com | 백엔드 서버 |
| Vercel | https://vercel.com | 프론트엔드 화면 |

> **팁:** GitHub 계정이 있으면 나머지 서비스도 "Sign in with GitHub" 버튼으로 바로 가입됩니다.

### 내 컴퓨터에 GitHub 리포지토리 준비하기

1. https://github.com/greatsong/vpylab 에 접속합니다
2. 우측 상단 **Fork** 버튼을 클릭합니다
3. "Create fork" 버튼을 클릭합니다
4. 이제 `https://github.com/내아이디/vpylab` 형태의 내 저장소가 생겼습니다

---

## Step 1: Supabase 데이터베이스 만들기

### 1-1. 프로젝트 생성

1. https://supabase.com/dashboard 에 접속합니다
2. **New Project** 클릭
3. 아래와 같이 입력합니다:
   - **Name:** `vpylab` (아무 이름이나 괜찮습니다)
   - **Database Password:** 안전한 비밀번호 입력 (메모해두세요)
   - **Region:** `Northeast Asia (Seoul)` 선택
4. **Create new project** 클릭
5. 1~2분 기다리면 프로젝트가 만들어집니다

### 1-2. 테이블 만들기

1. 왼쪽 메뉴에서 **SQL Editor** 클릭
2. **New query** 클릭
3. 프로젝트 폴더에서 아래 파일들을 **순서대로** 열어서 내용을 복사-붙여넣기 → **Run** 클릭:

```
supabase/migrations/001_vpylab_schema.sql
supabase/migrations/002_gallery.sql
supabase/migrations/003_shares.sql
supabase/migrations/004_shares_rls_fix.sql
supabase/migrations/005_gallery_search_index.sql
supabase/migrations/006_gallery_collaboration.sql
```

> **주의:** 반드시 001 → 002 → ... 순서대로 실행해야 합니다.  
> 각 파일을 실행할 때마다 "Success" 메시지가 나오면 다음 파일로 넘어가세요.

### 1-3. API 키 메모하기

1. 왼쪽 메뉴에서 **Settings** → **API** 클릭
2. 아래 3가지를 메모장에 복사해 둡니다:

| 이름 | 어디에 있나요 | 용도 |
|------|---------------|------|
| **Project URL** | 상단에 `https://xxxx.supabase.co` 형태 | 프론트 + 백엔드 모두 사용 |
| **anon public** | `Project API keys` 섹션 | 프론트엔드에서 사용 (공개 가능) |
| **service_role** | `Project API keys` 섹션 (눈 아이콘 클릭) | 백엔드에서만 사용 (**절대 공개 금지**) |

---

## Step 2: 백엔드 서버 배포하기 (Render)

### 2-1. Render에서 서비스 만들기

1. https://dashboard.render.com 에 접속합니다
2. **New** → **Web Service** 클릭
3. **Build and deploy from a Git repository** 선택 → **Next**
4. GitHub 연동이 안 되어 있으면 **Connect GitHub** 클릭하여 연결
5. 내 `vpylab` 리포지토리를 찾아 **Connect** 클릭

### 2-2. 서비스 설정

| 설정 항목 | 입력할 값 |
|-----------|-----------|
| **Name** | `vpylab-server` |
| **Region** | `Singapore` (한국에서 가까움) |
| **Branch** | `main` |
| **Root Directory** | `server` |
| **Runtime** | `Node` |
| **Build Command** | `npm install` |
| **Start Command** | `node index.js` |
| **Instance Type** | `Free` 선택 |

### 2-3. 환경변수 설정

아래쪽 **Environment Variables** 섹션에서 **Add Environment Variable**을 클릭하여 하나씩 추가합니다:

| Key | Value |
|-----|-------|
| `PORT` | `10000` |
| `ALLOWED_ORIGINS` | (Step 3 완료 후 Vercel 주소 입력. 일단 `https://vpylab.vercel.app` 으로 넣어두세요) |
| `SUPABASE_URL` | Step 1에서 메모한 **Project URL** |
| `SUPABASE_SERVICE_ROLE_KEY` | Step 1에서 메모한 **service_role** 키 |
| `NODE_ENV` | `production` |

> **`UPSTAGE_API_KEY`는 지금 안 넣어도 됩니다.** AI 힌트 기능 없이도 기본 기능은 모두 동작합니다.

### 2-4. 배포 시작

**Create Web Service** 버튼을 클릭합니다.

5~10분 후 배포가 완료되면 상단에 URL이 표시됩니다:  
`https://vpylab-server-xxxx.onrender.com`

이 URL을 메모해 두세요. 프론트엔드에서 사용합니다.

### 2-5. 동작 확인

브라우저에서 아래 주소를 열어보세요:  
`https://vpylab-server-xxxx.onrender.com/api/health`

아래와 같은 응답이 나오면 성공입니다:
```json
{"status":"ok","timestamp":"2026-...","version":"0.1.0"}
```

---

## Step 3: 프론트엔드 배포하기 (Vercel)

### 3-1. Vercel에서 프로젝트 만들기

1. https://vercel.com/dashboard 에 접속합니다
2. **Add New...** → **Project** 클릭
3. **Import Git Repository**에서 `vpylab` 리포지토리를 찾아 **Import** 클릭

### 3-2. 빌드 설정

| 설정 항목 | 입력할 값 |
|-----------|-----------|
| **Framework Preset** | `Vite` |
| **Root Directory** | `client` (Edit 클릭하여 변경) |
| **Build Command** | `npm install && npx vite build` |
| **Output Directory** | `dist` |

### 3-3. 환경변수 설정

**Environment Variables** 섹션에서 아래를 추가합니다:

| Key | Value |
|-----|-------|
| `VITE_SUPABASE_URL` | Step 1에서 메모한 **Project URL** |
| `VITE_SUPABASE_ANON_KEY` | Step 1에서 메모한 **anon public** 키 |
| `VITE_API_BASE_URL` | Step 2에서 받은 Render URL (예: `https://vpylab-server-xxxx.onrender.com`) |

### 3-4. 배포

**Deploy** 버튼을 클릭합니다. 2~3분 후 배포가 완료됩니다.

완료되면 URL이 표시됩니다: `https://vpylab-xxxx.vercel.app`

### 3-5. Render 환경변수 업데이트

이제 실제 Vercel URL을 알았으니, Render로 돌아가서 수정합니다:

1. Render 대시보드 → `vpylab-server` → **Environment** 탭
2. `ALLOWED_ORIGINS` 값을 실제 Vercel URL로 변경
3. **Save Changes** → 자동으로 재배포됩니다

> **커스텀 도메인을 사용한다면:**  
> `ALLOWED_ORIGINS`에 쉼표로 구분하여 추가합니다:  
> `https://vpylab-xxxx.vercel.app,https://myschool.com`

---

## Step 4: 동작 확인하기

1. Vercel에서 받은 URL을 브라우저에서 엽니다
2. 에디터가 보이면 아래 코드를 입력하고 **실행** 버튼을 누릅니다:

```python
from vpython import *

box(color=color.red)
sphere(pos=vector(2, 0, 0), color=color.blue)
```

3. 3D 화면에 빨간 상자와 파란 구가 나타나면 **성공**입니다!

### 추가 확인 (선택)

- [ ] 코드 저장 → 불러오기가 되는지 확인
- [ ] 코드 공유 버튼 → 공유 링크 생성 확인
- [ ] 갤러리 페이지가 로드되는지 확인

---

## 선택사항: AI 힌트 기능 켜기

학생이 코딩하다 막힐 때 AI가 힌트를 주는 기능입니다. 없어도 기본 기능에 지장 없습니다.

1. https://console.upstage.ai 에 가입합니다
2. API Key를 발급받습니다
3. Render 대시보드 → `vpylab-server` → **Environment** 탭
4. 환경변수 추가:

| Key | Value |
|-----|-------|
| `UPSTAGE_API_KEY` | 발급받은 API Key |

5. **Save Changes** 클릭 (자동 재배포)

> **비용:** Upstage Solar Pro는 무료 체험 크레딧을 제공합니다. 학교 수업 규모라면 무료 한도 내에서 충분합니다.

---

## 문제가 생겼을 때

### "사이트가 로딩되지 않아요"

- Vercel 대시보드에서 빌드 로그를 확인합니다
- 환경변수 `VITE_SUPABASE_URL`과 `VITE_SUPABASE_ANON_KEY`가 정확한지 확인합니다

### "로그인/회원가입이 안 돼요"

- Supabase 대시보드 → **Authentication** → **URL Configuration**
- **Site URL**을 Vercel 배포 URL로 설정합니다
- **Redirect URLs**에도 같은 URL을 추가합니다

### "코드 공유가 안 돼요"

- Render 대시보드에서 서버 로그를 확인합니다
- `SUPABASE_URL`과 `SUPABASE_SERVICE_ROLE_KEY`가 정확한지 확인합니다

### "Render 서버가 느려요"

- 무료 인스턴스는 15분 미사용 시 절전 모드에 들어갑니다
- 첫 요청 시 30초 정도 대기가 발생합니다 (이후는 빠릅니다)
- 수업 시작 전에 미리 사이트를 한 번 열어두면 좋습니다

### "SQL 실행 시 에러가 나요"

- 마이그레이션 파일을 순서대로 실행했는지 확인합니다
- 이미 실행한 파일을 다시 실행하면 "already exists" 에러가 나올 수 있습니다 — 이건 정상입니다

---

## 업데이트하기

원본 프로젝트에 업데이트가 있을 때:

1. 내 GitHub 리포지토리에서 **Sync fork** → **Update branch** 클릭
2. Vercel과 Render가 자동으로 재배포합니다

---

## 라이선스

- 코드: AGPL v3
- 미션 콘텐츠: CC BY-NC-SA 4.0

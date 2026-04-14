# VPy Lab — 종합 구현 계획서 (v4)

> **"자연 현상을 3D로 관찰하고, 코드로 해독하고, 소리로 느끼고, 친구와 토론하고, 세상과 공유하는 플랫폼"**

**버전**: 4.0  
**작성일**: 2026-04-14  
**작성자**: 석리송 (당곡고등학교 수리정보교육부)  
**상태**: 5대 영역 리뷰 완료, 구현 준비

---

## 1. 프로젝트 개요

VPy Lab은 GlowScript을 대체하는 **3D 프로그래밍 교육 플랫폼**이다.

### 1.1 문제

기존 도구(GlowScript, Trinket)는 영문 전용이며, 채점·AI·사운드·교육관리 기능이 전무하다.

### 1.2 해결

Pyodide(Python 3) + Three.js + Web Audio API 기반으로 제로 빌드. 다국어 UI, 자동 채점, AI 피드백, 사운드, 6대 카테고리 50개 미션 커리큘럼을 제공한다.

### 1.3 비전

전 세계 모든 학교에 도입될 수 있는 **오픈소스 교육 플랫폼**.
- 다국어 지원과 표준화된 커리큘럼으로 **글로벌 확산**
- GitHub를 통해 우리 반 친구들과, 나아가 전 세계의 학생들이 **시간과 공간의 한계를 넘어 협력**
- 학생이 직접 **오픈소스 문화를 경험** (fork, PR, 코드 리뷰)
- 교사와 개발자 커뮤니티의 기여를 통해 **지속적으로 발전**

### 1.4 핵심 차별점

| 항목 | GlowScript | VPy Lab |
|---|---|---|
| Python 실행 | Skulpt (Python 2 잔재) | Pyodide (완전한 Python 3) |
| 언어 | 영문 전용 | **다국어** (한/영 기본, 확장 가능) |
| 사운드 | 없음 | Web Audio + Tone.js 통합 |
| 채점 | 없음 | 변수 추적 기반 자동 채점 |
| AI | 없음 | Solar Pro 3 힌트/리뷰 (자기주도학습 옵션) |
| 교육 관리 | 없음 | 학급/미션/제출 관리 |
| 학습 모드 | 자유 코딩만 | 5가지 학습 모드 |
| 공유 | 사용자 계정 기반 | URL 인코딩 + GitHub Pages 포트폴리오 |
| 오픈소스 | 부분적 | 완전 오픈소스 (미션, 번역 기여 가능) |
| 아키텍처 | 레거시 단일 파일 | 현대적 React + 모듈 구조 |

### 1.5 교육 철학: 교실 속 협력 우선

VPy Lab의 핵심은 **교실 안에서 친구들과 선생님과의 소통과 협력을 통한 문제해결**이다. AI는 보조 수단일 뿐, 주인공은 학생과 교사 사이의 상호작용이다.

- **기본 모드**: 교사가 안내하고, 학생이 서로 돕고, 함께 토론하며 배움
- **AI 옵션**: 혼자 공부하는 학습자를 위한 선택적 기능 (교실 밖, 자기주도학습)
- **원칙**: "AI proposes, humans decide" / 정답 직접 제공 금지

---

## 2. 아키텍처

### 2.1 전체 구조

```
┌──────────────────────────────────────────────────────┐
│                    브라우저 (클라이언트)                │
│                                                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────┐│
│  │ Monaco   │  │ Pyodide  │  │ Three.js │  │ Web   ││
│  │ Editor   │  │ (Worker) │  │  WebGL   │  │ Audio ││
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └───┬───┘│
│       │             │              │             │    │
│       │    ┌────────┴──────────────┴─────────────┘    │
│       │    │                                          │
│       │    │   VPython → Three.js/Audio 브릿지        │
│       │    │   (커맨드 버퍼 패턴: Worker → JSON → Main)│
│       │    │                                          │
│       │    ├── 객체 레지스트리 (변수 추적)              │
│       │    ├── 좌표 히스토리 (궤적 기록)               │
│       │    ├── 채점 엔진 (assertion 검사)              │
│       │    └── i18n 시스템 (다국어)                    │
│       │                                               │
│  ┌────┴───────────────────────────────────────────┐   │
│  │              React UI (Tailwind v4)             │   │
│  │  미션 카드 │ 3D 뷰포트 │ 채점 패널 │ 콘솔      │   │
│  └────────────────────────────────────────────────┘   │
└──────────────────────┬───────────────────────────────┘
                       │
              ┌────────┴────────┐
              │   Express 서버   │
              │                  │
              ├─ Supabase       │  인증, 코드 저장, 미션 관리, 제출 기록
              ├─ Solar Pro 3    │  AI 힌트/리뷰 프록시 (선택적)
              │   API 프록시     │
              └─ Vercel /       │  배포
                  Cloudflare    │
              
              ┌─────────────────┐
              │  학생 GitHub     │  학생 개인 레포 → GitHub Pages
              │  Pages 배포      │  멋진 템플릿 → 포트폴리오
              └─────────────────┘
```

### 2.2 기술 스택

| 항목 | 기술 | 이유 |
|---|---|---|
| 프론트엔드 | React 19 + Vite | 최신 패턴, 기존 프로젝트 통일 |
| 스타일링 | Tailwind v4 + CSS 변수 | 테마 전환, 다크모드 |
| 백엔드 | Express 5 | 학생 기록, AI 프록시 |
| DB/인증 | Supabase | 무료 티어, 실시간 |
| Python | Pyodide v0.27 (CDN, Worker) | Python 3 WASM, 샌드박스 |
| 3D | Three.js (npm) | WebGL |
| 에디터 | @monaco-editor/react | VS Code 경험, 자동완성, 교육용 UX |
| 사운드 | Web Audio API | 의존성 0 |
| 상태 | Zustand | 가벼움 |
| AI | Upstage Solar Pro 3 API | 기본 모델, 서버 프록시 경유 |
| 다국어 | React Context + JSON | 가벼운 i18n, 확장 용이 |
| 공유 | lz-string | URL 인코딩 |
| 학생 배포 | GitHub Pages | 포트폴리오, 오픈소스 |
| 폰트 | Pretendard + Noto Sans | 한글 + 다국어 |

### 2.3 포트 배정 (로컬 개발)

- **4033**: Vite 프론트엔드
- **4034**: Express 백엔드

### 2.4 배포

- **플랫폼 본체**: Cloudflare Pages 또는 Vercel (SPA + Express)
- **학생 작품**: 학생 개인 GitHub Pages (`{학생}.github.io/{프로젝트}/`)
- **프로젝트 설명서**: SPA 내 `/about` 페이지

---

## 3. 보안 설계 (v4 — 보안 감사 결과 반영)

### 3.1 위협 분석 및 대응

| 위협 | 심각도 | 대응 |
|---|---|---|
| Express 보안 미들웨어 부재 | **CRITICAL** | helmet, cors(화이트리스트), rate-limit, 입력 크기 제한 필수 추가 |
| API 키 노출 | **HIGH** | Express 프록시 — API 키는 서버 환경변수만. `.gitignore`에 `.env*` 필수 |
| CORS 차단 | **HIGH** | Express 프록시 — 클라이언트→서버→AI API |
| Pyodide 샌드박스 탈출 | **HIGH** _(상향)_ | Worker 내 위험 API 삭제 + 패키지 화이트리스트 (상세 3.2 참조) |
| AI 프록시 남용 | **HIGH** | 학생당 분당 5회, 일일 20회 상한. 글로벌 분당 60회 |
| 학생 간 코드 공유 공격 | **HIGH** | LZ-String 디코딩 후 50KB 상한, textContent만 사용, 실행 전 경고 |
| Supabase RLS 미설계 | **HIGH** | 테이블별 RLS 정책 필수 (3.3 참조) |
| 교사 계정 권한 관리 | **HIGH** | role 필드(student/teacher/admin), 교사 MFA 권장 |
| 공유 컴퓨터 (학교 PC실) | **MEDIUM** | sessionStorage만, Supabase `persistSession: false` |
| CDN 공급망 공격 | **MEDIUM** | SRI 해시, 버전 고정, CSP 메타 태그 |
| URL 해시 코드 주입 | **MEDIUM** | 디코딩 후 크기 검증 + 경고 배너 + textContent 렌더링 |
| 독립 HTML XSS | **MEDIUM** | 내보내기 HTML에 CSP 메타 태그 삽입 |
| AI 프롬프트 인젝션 | **MEDIUM** | 시스템 프롬프트 강화, 완전 코드 블록 응답 필터링 |
| npm 공급망 공격 | **LOW** | `npm audit` CI, package-lock.json 커밋, Dependabot |
| 학생 개인정보 | **MEDIUM** | AI opt-in, 식별자 제거, PIPA/GDPR 고려 |

### 3.2 Pyodide Worker 샌드박스 강화 (HIGH → 필수)

보안 감사 결과, Web Worker 내 Pyodide는 `fetch()`, `IndexedDB`, `WebSocket`, `importScripts()`에 접근 가능한 것으로 확인됨. 커맨드 버퍼 패턴은 정상 실행 경로만 제한하며, `import js`를 통한 Worker `self` 객체 직접 접근으로 우회 가능.

```javascript
// worker.js — Pyodide 로딩 전에 실행 (필수)
delete self.fetch;
delete self.XMLHttpRequest;
delete self.WebSocket;
delete self.indexedDB;
delete self.navigator.sendBeacon;
// importScripts()는 Pyodide 로딩 후 삭제
// Pyodide 패키지 화이트리스트: numpy, matplotlib만 허용
```

추가 조치:
- `Worker.terminate()` 기반 강제 종료 (setTimeout 아님)
- 메모리 128MB 상한 감시
- `pyodide.http` 모듈 로딩 차단

### 3.3 Supabase RLS 정책 (필수)

| 테이블 | 정책 |
|---|---|
| `submissions` | 학생: 본인만 읽기/쓰기. 교사: 담당 학급만 읽기 |
| `saved_code` | 본인만 CRUD |
| `user_profiles` | 본인만 수정, 교사는 담당 학급 학생 읽기 |
| `classes` | 교사만 생성/수정 |

### 3.4 Express 서버 보안 미들웨어 (CRITICAL)

```javascript
// server/index.js — 필수 보안 미들웨어
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');

app.use(helmet());
app.use(cors({ origin: ['https://vpylab.example.com'] }));
app.use(express.json({ limit: '10kb' }));
app.use('/api/ai', rateLimit({ windowMs: 60000, max: 5, message: '잠시 후 다시 시도해주세요' }));
```

### 3.5 학생 개인정보

- AI 기능은 opt-in (학생/교사 동의 후 활성화)
- AI에 전송되는 데이터: 코드 내용만 (학생 이름, 학번 등 식별자 제거)
- PIPA(개인정보보호법) / GDPR 고려 — 미성년자 데이터 추가 보호
- 전송 전 "코드가 AI 서비스로 전송됩니다" 안내 표시
- AI 응답에서 완전한 코드 블록 필터링 (정답 직접 제공 방지)

---

## 4. 다국어 지원 (i18n)

### 4.1 범위

- **기본**: 한국어 / English (MVP)
- **확장 가능**: 中文, 日本語, ภาษาไทย, Filipino 등
- **구현**: `src/i18n/` 디렉토리에 언어별 JSON, React Context로 전환
- **범위**: UI 텍스트, 오류 메시지, 미션 설명, 채점 피드백, About 페이지
- **코드는 항상 영어** (Python/VPython API는 언어 불문)

### 4.2 구조

```
src/i18n/
├── index.js        # I18nProvider, useI18n() 훅
├── ko.json         # 한국어
├── en.json         # English
└── README.md       # 번역 기여 가이드 (새 언어 추가 방법)
```

### 4.3 번역 기여 및 거버넌스

전 세계 교사/개발자가 GitHub PR로 새 언어 파일을 추가할 수 있다.
1. `src/i18n/` 디렉토리에 `{locale}.json` 파일 추가
2. 기존 `en.json`의 키를 모두 번역
3. PR 제출 → Language Maintainer 리뷰 → 병합

**Language Maintainer 제도** (거버넌스 리뷰 결과 반영):
- 한국어/영어: 프로젝트 핵심팀이 직접 관리
- 새 언어 추가 시: 해당 언어의 Language Maintainer 1명 이상 지정 필수
- Maintainer 없는 언어: `"status": "community-translation"` 라벨 + UI 안내
- 미번역 키: 영어 fallback 자동 표시
- Phase 2: 번역 완성도 대시보드 (언어별 번역률 % 표시)

---

## 5. 6대 카테고리 × 50개 미션 커리큘럼

### 5.1 전체 구조

```
                        난이도
           Lv.1 따라하기  →  Lv.2 변형하기  →  Lv.3 설계하기  →  Lv.4 창작하기
          ─────────────────────────────────────────────────────────────────
  CT      │ 반복·조건    │ 함수·추상화  │ 알고리즘 설계 │ 자유 구현     │
  CR      │ 첫 3D 세계  │ 나만의 변형  │ 규칙 창작    │ 월드 빌더     │
  MA      │ 좌표·벡터   │ 함수 그래프  │ 프랙탈·변환  │ 수학 아트     │
  SC      │ 등속·낙하   │ 포물선·진동  │ 다체 문제    │ 실험 설계     │
  AR      │ 색상·그라데  │ 파티클·패턴  │ 음악 반응    │ 인터랙티브    │
  AI      │ 퍼셉트론    │ 경사하강법   │ 강화학습     │ 자유 실험     │
          ─────────────────────────────────────────────────────────────────

  총 50개 미션 = 주 2회 기준 한 학기+ / 주 1회 기준 1년
```

### 5.2 AI: 인공지능 원리 (8개) — 신규 카테고리

| # | 미션명 | Lv | 핵심 개념 | 학습 모드 | 채점 |
|---|---|---|---|---|---|
| AI-1 | 퍼셉트론 한 개 | 1 | 입력·가중치·활성화 함수 | Mode 0 | A |
| AI-2 | AND/OR 게이트 학습 | 1 | 퍼셉트론 학습 규칙 | Mode 0 | A+B |
| AI-3 | 경사하강법 구슬 | 2 | 3D 손실 표면 위 구슬 굴리기 | Mode 1 | B |
| AI-4 | 신경망 시각화 | 2 | 다층 퍼셉트론, 신호 전파 | Mode 0 | A |
| AI-5 | K-평균 군집화 | 2 | 3D 점 군집, 중심점 이동 | Mode 1 | B |
| AI-6 | 결정 경계 그리기 | 3 | 2D/3D 분류, 초평면 | Mode 1 | B+C |
| AI-7 | 미로 탐색 에이전트 | 3 | 강화학습, 보상/탐험 | Mode 2 | B+C |
| AI-8 | 나만의 AI 실험 | 4 | 자유 선택 | Mode 3 | C+갤러리 |

### 5.3 나머지 카테고리

(원본 설계서 참조 — CT 8개, CR 7개, MA 9개, SC 9개, AR 9개)

---

## 6. 미션 콘텐츠 제작 시스템 (Mission Content Pipeline)

### 6.1 미션 표준 구조

모든 미션은 아래 7개 필수 섹션을 포함해야 한다:

```
mission/
├── meta.json          # 메타 정보 (ID, 카테고리, 난이도, 작성자, 버전)
├── description/       # 문제 설명 (다국어)
│   ├── ko.md
│   └── en.md
├── solution/          # 문제 해설 (모범 답안 + 풀이 과정)
│   ├── reference-code.py    # 모범 코드
│   └── explanation/         # 풀이 해설 (다국어)
│       ├── ko.md
│       └── en.md
├── hints/             # 단계별 힌트 (3단계)
│   ├── hint-1.json    # Lv.1: 방향 제시 ("어떤 물리 법칙이 관련될까요?")
│   ├── hint-2.json    # Lv.2: 구체적 안내 ("gravity 변수를 사용해보세요")
│   └── hint-3.json    # Lv.3: 거의 답 ("ball.velocity.y -= 9.8 * dt 형태로...")
├── grading/           # 채점 기준
│   ├── assertions.json      # A/B등급 자동 채점 조건
│   └── rubric.json          # C등급 AI/교사 채점 루브릭
├── template.py        # 학생에게 제공되는 시작 코드 (Lv.1~2)
└── tests/             # 검수용 자동 테스트
    ├── test-grading.js      # 채점 정확도 테스트
    └── test-hints.js        # 힌트 적절성 테스트
```

### 6.2 미션 제작 기준 (Quality Standards)

| 항목 | 기준 | 검증 방법 |
|---|---|---|
| **서비스 방향 적합성** | 6대 카테고리 중 하나에 명확히 속함. 3D 시각화가 핵심 학습에 기여 (장식 아님) | 리뷰어 체크리스트 |
| **난이도 정확성** | Lv.1~4 기준 일치. Lv.1은 10분 내 완료, Lv.4는 1시간+ | 3명 테스트 플레이 |
| **문제 설명** | 학생이 읽고 무엇을 해야 하는지 즉시 이해. 목표·조건·제약 명시 | 비전공 학생 1명 이해도 테스트 |
| **모범 답안** | 정상 실행, 채점 조건 100% 통과, 코드 스타일 모범적 | 자동 테스트 |
| **풀이 해설** | "왜 이렇게 풀었는지" 설명. 수학/과학 원리 연결 | 리뷰어 확인 |
| **힌트 3단계** | 점진적 공개. Lv.1은 사고 촉진, Lv.3도 완전한 답 제공 금지 | 리뷰어 + AI 검증 |
| **채점 기준** | A등급 오채점 0%, B등급 20% 오차 허용, 경계값 5회 테스트 | 자동 테스트 10회 |
| **다국어** | 최소 ko + en. 기술 용어는 원문 병기 | 리뷰어 확인 |

### 6.3 미션 2단계 분류 체계 (거버넌스 리뷰 반영)

| 단계 | 이름 | 조건 | 표시 |
|---|---|---|---|
| **Verified** | 검증 미션 | 메인테이너 승인 + CI 통과 | 기본 미션 목록, 뱃지 표시 |
| **Community** | 커뮤니티 미션 | CI 자동 검증만 통과 | 별도 탭, "커뮤니티 제작" 라벨 |

- `meta.json`에 `"tier": "verified"` 또는 `"community"` 필드 추가
- Community 미션 승격 조건: 평점 4.0+, 사용 50회+, 교사 리뷰 1건+
- 채점 오류 신고 3건 이상 시 자동 비활성화

### 6.4 검수 프로세스 (Review Pipeline)

```
1. 제작 (Author)
   교사가 미션 작성: 문제 설명 + 모범 답안 + 풀이 해설 + 힌트 + 채점 기준
   ↓
2. 자동 검증 (CI) — 변경 감지 방식 (수정 미션만 테스트)
   GitHub Actions:
   - JSON 스키마 유효성 검사
   - 모범 답안 실행 → 채점 조건 100% 통과 확인
   - 힌트 3단계 존재 확인
   - 다국어 파일 존재 확인
   - 채점 경계값 테스트 (정답 코드 ±10% 변형 → 통과/실패 확인)
   ↓
3. 리뷰 (Founder Review → 2인 전환)
   - MVP 초기: 프로젝트 창시자 1인 리뷰 (Founder Review)
   - 리뷰어 5명 이상 확보 시 → 2인 교차 리뷰 전환
   PR 체크리스트:
   - [ ] 서비스 방향 적합성
   - [ ] 난이도 정확성
   - [ ] 문제 설명 명확성
   - [ ] 힌트 교육적 적절성 (답 직접 제공 금지 원칙)
   - [ ] 채점 기준 공정성
   - [ ] 풀이 해설 교육적 가치
   ↓
4. 테스트 플레이 (Phase 2 — 학생 테스트 시스템 구축 후)
   해당 난이도 학생 1~3명 실제 풀기:
   - 소요 시간, 막히는 지점, 힌트 사용 패턴 관찰
   ↓
5. 승인 & 병합 (Merge)
   리뷰 통과 → main 병합 → 자동 배포
   작성 교사 크레딧 표시
```

### 6.5 오픈소스 기여 흐름

```
교사 A (서울):  "포물선 운동 미션을 만들었어요" → GitHub PR
교사 B (도쿄):  리뷰 + 일본어 번역 추가 → PR 코멘트
교사 C (방콕):  태국어 번역 추가 → PR 코멘트  
자동 검증:       CI 통과 ✅ (변경 감지 — 해당 미션만 테스트)
관리자:          병합 → 전 세계 VPy Lab에 자동 반영
```

### 6.6 학생 기여 가이드 (거버넌스 리뷰 반영)

| 기여 유형 | 학생 참여 | 비고 |
|---|---|---|
| 버그 리포트 | 적극 권장 | Issue로 제출, 위험 없음 |
| UI 번역 수정 | 권장 | 낮은 진입 장벽 |
| 미션 아이디어 제안 | 권장 | Issue로 제안, 교사가 구현 |
| 코드 PR (버그 수정) | 허용 (교사 동반) | 오픈소스 핵심 경험 |
| 미션 제작 | 제한적 허용 | Community 단계만 |

- DCO(Developer Certificate of Origin) 채택: `git commit -s`로 서명
- 미성년자 조항: "18세 미만 기여자는 보호자 또는 담당 교사의 동의 하에 기여합니다"

---

## 7. 코드 공유 + GitHub 배포

### 7.1 공유 방식

1. **URL 인코딩** (MVP): LZ-String → Base64 → URL 해시 — 메신저 공유. 디코딩 후 50KB 상한 검증, 외부 코드 경고 배너
2. **Supabase 저장** (Phase 2): 짧은 링크 — 과제 제출
3. **독립 HTML 내보내기** (MVP): VPy Lab 런타임 + 학생 코드 → 단일 HTML
4. **GitHub Pages 배포**: 학생이 자기 GitHub 레포에 HTML push → 포트폴리오

### 7.2 학생 GitHub Pages 포트폴리오

- **멋진 기본 템플릿** 제공 → 학생이 자신감·자존감을 느낄 수 있는 수준의 디자인
- 플랫폼에서 "GitHub에 배포" 버튼 → 가이드/자동화
- 오픈소스 협력 프로젝트 가능 (fork, PR)
- **Phase 2+**: AI로 웹 페이지 디자인 커스터마이징, 다국어 번역 지원
- 구조 설계 시 AI 디자인/번역 기능 확장이 가능하도록 **템플릿 시스템 모듈화**

---

## 8. 디렉토리 구조

```
vpylab/
├── client/
│   ├── public/
│   │   └── audio/                      # BGM, 효과음 mp3
│   ├── src/
│   │   ├── main.jsx
│   │   ├── App.jsx
│   │   ├── index.css                   # Tailwind v4
│   │   ├── i18n/                       # 다국어 시스템
│   │   │   ├── index.js                # i18n Context Provider
│   │   │   ├── ko.json                 # 한국어
│   │   │   ├── en.json                 # English
│   │   │   └── README.md              # 번역 기여 가이드
│   │   ├── engine/                     # 핵심 엔진
│   │   │   ├── pyodide-loader.js       # Pyodide CDN 로딩 + Worker
│   │   │   ├── vpython-bridge.js       # JS측 VPython API
│   │   │   ├── vpython-api.py          # Python측 VPython API
│   │   │   ├── code-preprocessor.js    # async 변환 전처리기
│   │   │   ├── object-registry.js      # 객체 레지스트리 + 좌표 히스토리
│   │   │   ├── grading-engine.js       # 채점 엔진 (A/B/C등급)
│   │   │   ├── sound-system.js         # Web Audio API
│   │   │   └── error-korean.js         # 다국어 오류 메시지
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── Header.jsx          # 언어 선택 포함
│   │   │   │   └── MainLayout.jsx
│   │   │   ├── editor/
│   │   │   │   ├── CodeEditor.jsx      # Monaco Editor
│   │   │   │   └── EditorToolbar.jsx
│   │   │   ├── viewport/
│   │   │   │   ├── Viewport3D.jsx
│   │   │   │   └── ViewportControls.jsx
│   │   │   ├── console/
│   │   │   │   └── OutputConsole.jsx
│   │   │   ├── grading/
│   │   │   │   ├── GradingPanel.jsx
│   │   │   │   └── TrajectoryOverlay.jsx
│   │   │   ├── mission/
│   │   │   │   ├── MissionCard.jsx
│   │   │   │   ├── MissionList.jsx
│   │   │   │   └── MissionDetail.jsx
│   │   │   ├── github/
│   │   │   │   ├── ExportHTML.jsx      # 독립 HTML 내보내기
│   │   │   │   └── GitHubDeploy.jsx    # GitHub Pages 배포 가이드
│   │   │   └── shared/
│   │   │       ├── ThemeToggle.jsx
│   │   │       ├── LanguageSelector.jsx
│   │   │       └── LoadingScreen.jsx
│   │   ├── pages/
│   │   │   ├── Home.jsx
│   │   │   ├── Sandbox.jsx
│   │   │   ├── MissionPage.jsx
│   │   │   ├── About.jsx              # 프로젝트 설명서
│   │   │   └── Settings.jsx           # 테마, 언어 설정
│   │   ├── data/
│   │   │   └── missions/
│   │   │       ├── ct-missions.js
│   │   │       ├── cr-missions.js
│   │   │       ├── ma-missions.js
│   │   │       ├── sc-missions.js
│   │   │       ├── ar-missions.js
│   │   │       └── ai-missions.js
│   │   ├── hooks/
│   │   │   ├── usePyodide.js
│   │   │   ├── useThreeScene.js
│   │   │   ├── useGrading.js
│   │   │   └── useI18n.js
│   │   ├── stores/
│   │   │   └── appStore.js
│   │   └── utils/
│   │       ├── share.js
│   │       ├── themes.js
│   │       └── export-html.js         # 독립 HTML 생성
│   ├── vite.config.js
│   └── package.json
├── server/
│   ├── index.js                       # Express 엔트리
│   ├── routes/
│   │   ├── ai.js                      # Solar Pro 3 API 프록시
│   │   ├── submissions.js             # 학생 제출 기록
│   │   └── share.js                   # 코드 저장/조회
│   ├── middleware/
│   │   ├── auth.js                    # Supabase JWT 검증
│   │   ├── security.js                # helmet, cors, rate-limit, 입력 제한
│   │   └── ai-guard.js               # AI 프록시 레이트 리밋 + 응답 필터링
│   └── package.json
├── LICENSE                            # AGPL v3 (코드)
├── CODE_OF_CONDUCT.md                 # Contributor Covenant + 미성년자 안전 부속서
├── CONTRIBUTING.md                    # 기여 가이드 + 미션 템플릿 + DCO 정책
├── GOVERNANCE.md                      # 프로젝트 거버넌스 (리뷰어, 역할, 의사결정)
├── package.json                       # 루트 (concurrently)
└── CLAUDE.md
```

---

## 9. 구현 로드맵 (8 Steps)

### Step 1: 프로젝트 스캐폴딩

- React 19 + Vite + Tailwind v4 (client/)
- Express 5 (server/)
- 루트 concurrently 스크립트
- Vite proxy: `/api` → `localhost:4034`
- Pretendard 폰트, 다크 테마 기본

### Step 2: 다국어 시스템 + 기본 UI

- i18n Context Provider + `useI18n()` 훅
- ko.json / en.json 언어 파일
- Header (로고, 언어 선택, 테마 토글)
- Home 페이지: 6대 카테고리 카드
- 4종 테마 시스템 (CSS 변수)

### Step 3: 엔진 코어 — Pyodide + Three.js 브릿지

- Pyodide CDN 로딩 (Web Worker, 프로그레스 바)
- **Worker 샌드박스 강화**: 위험 API 삭제 (fetch, WebSocket, IndexedDB, importScripts)
- VPython Phase 1 API: vector, sphere, box, cylinder, arrow, color, rate
- rate() → await rate() 코드 전처리기 (**라인 파서 방식** — 문자열/주석 스킵, 단순 regex 금지)
- 객체 레지스트리 + 좌표 히스토리
- Python↔JS **커맨드 배칭** 브릿지 (프레임당 단일 postMessage)
- `Worker.terminate()` 기반 강제 종료 + 메모리 128MB 상한
- Pyodide stdlib 선택적 로드 (core만 11MB, NumPy는 필요 시만)
- Service Worker Pyodide 캐싱 (기존 Step 8에서 상향 — 학교 네트워크 필수)

### Step 4: IDE 레이아웃 — 에디터 + 3D + 콘솔

- 3패널: 좌 에디터 / 우상 3D / 우하 콘솔
- Monaco Editor (Python, 다크 테마, 자동완성)
- Three.js 캔버스 + OrbitControls
- 실행/정지/리셋 버튼
- print() 출력 (**textContent만 사용** — innerHTML/dangerouslySetInnerHTML 금지)
- 다국어 오류 메시지
- Sandbox: 미션 없이 자유 코딩
- 태블릿 반응형: 2패널 토글 모드 (에디터/3D 전환)
- 저사양 감지: `navigator.hardwareConcurrency` + 자동 품질 조정

### Step 5: 사운드 + 채점 엔진

- Web Audio API: beep, play, bgm, success, error
- A등급 + B등급 자동 채점
- 채점 결과 패널 UI
- 궤적 오버레이 (Mode 1)

### Step 6: 미션 시스템 + 학습 모드

- MVP 10개 미션: CT-1~3, SC-1~2, AR-1~2, CR-1, AI-1, AI-3
- **미션 lazy loading**: 인덱스 JSON만 로드, 상세는 진입 시 동적 로드
- `meta.json`에 `"tier"` 필드 (verified/community)
- Mode 0 기초 드릴, Mode 1 현상 해독, Mode 2 월드 빌더

### Step 7: 서버 + AI + 공유 + GitHub 배포

- Express: **보안 미들웨어** (helmet, cors, rate-limit, 입력 검증) 우선 설정
- Solar Pro 3 API 프록시 + **요청 큐잉** (p-queue, 동시 5개 제한)
- **AI 쿨다운**: 힌트 버튼 30초 쿨다운 ("잠시 생각해보세요"), 학생당 일일 20회 상한
- 기본 힌트는 로컬 JSON에서 제공, AI는 개인화 피드백에만 사용
- Supabase 연동: 인증 (`persistSession: false`), 코드 저장, 제출 기록, **RLS 정책**
- LZ-String URL 공유 (디코딩 후 50KB 상한) + 독립 HTML 내보내기 (CSP 메타 태그)
- GitHub Pages 배포 가이드/템플릿

### Step 8: 설명서 + 거버넌스 + 배포

- About 페이지: 프로젝트 설명서 (다국어)
- Settings: 테마, 언어, 교사 설정
- **4대 거버넌스 문서**: LICENSE (Apache 2.0), CODE_OF_CONDUCT.md, CONTRIBUTING.md, GOVERNANCE.md
- 미션 스켈레톤 템플릿 (`mission-template/`)
- GitHub 웹 에디터(github.dev) 스크린샷 기여 가이드
- `npm audit` CI 파이프라인, `.gitignore` 보안 점검
- 배포 설정 (Cloudflare Pages / Vercel)

---

## 10. 학생 성장 변화 가이드

### 교육 후 기대되는 역량 변화

| 카테고리 | 기대 변화 |
|---|---|
| CT | 복잡한 구조를 함수로 추상화하여 재사용 가능한 모듈로 설계하는 능력 |
| CR | 제약 조건 안에서 독창적 접근을 시도하며 자신만의 표현 방식을 개발 |
| MA | 수학 개념의 실세계 적용을 탐구하고 추상적 수학을 구체적으로 시각화 |
| SC | 자연 현상을 코드로 모델링하고 시뮬레이션 결과를 이론과 비교 검증 |
| AR | 코드를 활용한 생성적 예술 작품 제작, 알고리즘적 아름다움 탐구 |
| AI | 인공지능의 핵심 원리를 직접 구현하여 블랙박스가 아닌 투명한 이해 |

### 공통 역량 변화

- **컴퓨팅 사고력**: 문제를 분해하고 알고리즘적으로 해결하는 습관
- **오픈소스 문화**: GitHub 협업, 코드 리뷰, PR 경험
- **글로벌 협력**: 시간과 공간을 넘어 전 세계 학생들과 협력
- **자기주도학습**: 힌트 시스템과 채점 피드백을 통한 독립적 학습 능력
- **포트폴리오 구축**: GitHub Pages를 통한 자기 작품 발표 경험

---

## 11. 검증 방법

1. `npm run dev` → `localhost:4033` + `localhost:4034` 동시 실행
2. Sandbox: `sphere()`, `box()`, `arrow()` 생성 + 애니메이션
3. `rate()` 기반 자유 낙하 시뮬레이션
4. CT-1 미션: A등급 자동 채점 확인
5. SC-1 미션: 궤적 비교 → 유사도 %
6. `sound.beep(440, 0.5)` 재생
7. 한국어/English 전환 → UI 텍스트 변경 확인
8. LZ-String 공유 링크 → 새 탭 복원
9. 독립 HTML 내보내기 → 로컬에서 열기
10. About 페이지 프로젝트 설명서 확인
11. AI 힌트: Solar Pro 3 → 서버 프록시 → 힌트 표시

---

## 12. 비용 분석 (비용 리뷰 결과)

### 12.1 월간 비용 요약

| 항목 | Tier 1 (40명) | Tier 2 (400명) | Tier 3 (4,000명) |
|---|---|---|---|
| Supabase | ₩36,000 (Pro) | ₩36,000 (Pro) | ₩36,000 (Pro) |
| Solar Pro 3 AI | ₩830 | ₩8,300 | ₩82,900 |
| 호스팅 (프론트+백엔드) | ₩7,200 (Railway) | ₩7,200 (Railway) | ₩14,400 (Railway) |
| GitHub Actions | ₩0 | ₩0 | ₩34,500 |
| **월 합계** | **₩830** | **₩15,500** | **₩169,300** |
| **학생 1인당** | **₩21** | **₩39** | **₩42** |

- AI 비활성화 시 Tier 1은 **완전 ₩0 운영 가능**
- 첫 유료 전환 시점: **학교 3~5개 (120~200명)** — Render 콜드스타트 문제

### 12.2 비용 주의 사항

| 항목 | 위험도 | 설명 |
|---|---|---|
| Supabase 자동 정지 | **높음** | 무료 티어 7일 미사용 시 자동 정지 — 방학 중 DB 손실 위험 |
| Render 콜드스타트 | **중간** | 수업 시작 시 30명 동시 접속 → 첫 1분간 AI 불가 |
| Pyodide 초기 로딩 | **중간** | 25MB, 학교 네트워크 30명 동시 → 1~2분 로딩 가능 |

---

## 13. 기술 리스크 및 완화책 (기술 리뷰 결과)

| 리스크 | 영향 | 완화책 | 구현 시점 |
|---|---|---|---|
| 번들 28MB 초기 로딩 | 학교 네트워크 1~2분 | CodeMirror 6 전환 + Pyodide core만 로드 + SW 캐싱 | Step 3~4 |
| 커맨드 버퍼 지연 (객체 50+) | 프레임 드롭 | 커맨드 배칭 (프레임당 단일 postMessage) | Step 3 |
| 코드 전처리기 엣지 케이스 | 학생 코드 오류 | 문자열/주석 인식 라인 파서, lambda 경고 | Step 3 |
| 학교 Chrome 정책 캐시 삭제 | 매 수업 재다운로드 | CDN HTTP 캐시 의존 + Pyodide 경량화 | Step 3 |
| 태블릿 3패널 비좁음 | UX 저하 | 2패널 토글 모드 + 저사양 자동 감지 | Step 4 |
| AI 수업 시작 스파이크 | API 한도 초과 | 요청 큐잉 + 30초 쿨다운 + 로컬 힌트 우선 | Step 7 |

---

## 14. 리뷰 완료 및 논의 필요 이슈

### 14.1 완료된 리뷰 (2026-04-14)

| 리뷰 영역 | 결과 | 주요 발견 |
|---|---|---|
| 기술 타당성 | BLOCKER 없음 | 커맨드 배칭, 전처리기 파서, CodeMirror 전환 권고 |
| 보안 감사 | CRITICAL 1건, HIGH 5건 | Express 미들웨어, Pyodide 샌드박스, RLS, 교사 권한 |
| 확장성 | 40명 무료 OK | 미션 lazy loading, AI 큐잉, Pyodide 캐싱 초기 반영 |
| 오픈소스 거버넌스 | 실현 가능 | Founder Review → 2인 전환, 2단계 미션, DCO, CoC |
| 비용 분석 | Tier 1: ₩830/월 | AI 없으면 ₩0, 학생 1인당 ₩42 (글로벌) |

### 14.2 결정 완료 사항 (2026-04-14)

| 이슈 | 결정 | 근거 |
|---|---|---|
| 에디터 | **Monaco Editor** | VS Code 경험, 자동완성, 교육용 UX 우선 |
| DB | **Supabase Pro** ($25/월) | 7일 정지 방지, 안정적 운영 |
| 백엔드 호스팅 | **Railway** (기존 사용 중) | 이미 결제 중, 콜드스타트 없음 |
| GitHub 인증 | **GitHub App** (OAuth 기반, 학생 친화) | 최소 권한 + 쉬운 UX. 레포 단위 세밀한 권한 설정 |
| 라이선스 | **AGPL v3** (코드) + **CC BY-NC-SA 4.0** (미션 콘텐츠) | 상업적 이용 사실상 차단. 교육 기관 자유 사용 |
| CoC 집행 | **창시자 1인 체제** (향후 2인 확대 예정) | 현실적 여건 반영. CoC 문서에 확대 계획 명시 |

#### 라이선스 상세

- **코드 (AGPL v3)**: 수정 후 서비스 운영 시 전체 소스코드 공개 의무. 교육 기관은 자유 사용, 상업적 포크 사실상 억제
- **미션 콘텐츠 (CC BY-NC-SA 4.0)**: 출처 표시 + 비상업적 사용만 + 동일 조건 공유. 교사 간 자유로운 공유·수정 허용
- 파일 구조: `LICENSE` (AGPL v3), `missions/LICENSE` (CC BY-NC-SA 4.0), `i18n/LICENSE` (CC BY-NC-SA 4.0)

#### CoC 상세

- Contributor Covenant v2.1 기반 + 미성년자 안전 부속서
- 신고 채널: 프로젝트 전용 이메일
- 미성년자 보호: 성인-학생 1:1 비공개 대화 금지 권고, 학생 개인정보 게시 금지 권고
- 향후 교사 기여자 확보 시 2인 이상 CoC 위원회로 확대 계획

---

*이 문서는 VPy Lab 프로젝트의 구현 계획서로, 원본 종합 설계서를 기반으로 5대 영역 리뷰 + 6대 이슈 결정을 반영한 v4 최종본입니다.*

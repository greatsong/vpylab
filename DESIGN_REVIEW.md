# VPy Lab UI/UX 디자인 리뷰 및 개선 명세서

> **리뷰 대상**: VPy Lab v0.1 (3D 프로그래밍 교육 플랫폼)  
> **대상 사용자**: 고등학생 (15~18세), 학교 PC실/크롬북/태블릿  
> **작성일**: 2026-04-14  

---

## 1. 전체 비주얼 아이덴티티

### 1.1 현재 상태 진단

현재 디자인은 GitHub의 다크 테마를 거의 그대로 차용했다. 개발자 도구로서는 익숙하지만, 고등학생 대상 교육 플랫폼으로서 다음 문제가 있다:

- 정체성 부재: VPy Lab만의 시각 언어가 없다. 로고가 텍스트뿐이고, 브랜드 컬러 시스템이 없다
- 차가운 인상: 교육 플랫폼에 기대하는 따뜻함, 활력, 성취감이 전달되지 않는다
- 히어로 섹션이 텍스트만으로 구성되어 있어 플랫폼의 핵심 가치(3D 시각화)를 보여주지 못한다

### 1.2 개선 방향: "실험실의 설렘"

VPy Lab은 "가상 실험실"이다. 톤은 **과학 실험실의 정밀함 + 창작의 설렘**이어야 한다.

**브랜드 컬러 시스템 (테마 불문 일관 유지)**:

```css
/* 브랜드 상수 — 테마 변경과 무관하게 유지 */
:root {
  --brand-primary: #6C5CE7;      /* 보라 — 창의/탐구 */
  --brand-primary-light: #A29BFE;
  --brand-secondary: #00CEC9;    /* 시안 — 과학/기술 */
  --brand-gradient: linear-gradient(135deg, #6C5CE7 0%, #00CEC9 100%);
}
```

**로고 개선**: 텍스트 로고에 심볼 추가. 3D 좌표축(x, y, z)을 형상화한 간결한 아이콘을 VPy 텍스트 왼쪽에 배치한다. 아이콘은 16px~32px 범위에서 깨지지 않는 SVG로 제작한다.

```jsx
{/* Header.jsx 로고 영역 */}
<div className="flex items-center gap-2">
  <svg width="28" height="28" viewBox="0 0 28 28">
    {/* 3축 좌표계 아이콘: X(빨강), Y(초록), Z(파랑) 화살표가 원점에서 뻗어나감 */}
    <line x1="14" y1="14" x2="24" y2="20" stroke="#ff6b6b" strokeWidth="2.5" strokeLinecap="round"/>
    <line x1="14" y1="14" x2="14" y2="4" stroke="#51cf66" strokeWidth="2.5" strokeLinecap="round"/>
    <line x1="14" y1="14" x2="6" y2="20" stroke="#339af0" strokeWidth="2.5" strokeLinecap="round"/>
    <circle cx="14" cy="14" r="3" fill="var(--brand-primary)"/>
  </svg>
  <span className="text-xl font-bold" style={{
    background: 'var(--brand-gradient)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent'
  }}>
    VPy Lab
  </span>
</div>
```

---

## 2. 4종 테마 개선

### 2.1 대비율(Contrast Ratio) 감사

WCAG AA 기준: 일반 텍스트 4.5:1, 대형 텍스트(18px bold 이상) 3:1.

| 테마 | 요소 | 현재 | 대비율 | 판정 |
|---|---|---|---|---|
| Deep Space | text-secondary (#8b949e) on bg-primary (#0d1117) | 5.0:1 | AA 통과 | OK |
| Deep Space | text-muted (#484f58) on bg-primary (#0d1117) | 2.6:1 | **실패** | 수정 필요 |
| Neon Lab | accent (#00ffaa) on bg-primary (#0a0a1a) | 12.8:1 | 통과 | 과도하게 밝음 |
| Neon Lab | text-muted (#5555aa) on bg-primary (#0a0a1a) | 2.8:1 | **실패** | 수정 필요 |
| Forest Night | text-muted (#557755) on bg-primary (#0d1a0d) | 2.7:1 | **실패** | 수정 필요 |
| Clean White | text-muted (#8b949e) on bg-primary (#ffffff) | 3.5:1 | **실패** (일반 텍스트) | 수정 필요 |

### 2.2 수정된 테마 색상값

```css
/* Deep Space — text-muted 대비율 보정 */
[data-theme="deep-space"] {
  --color-text-muted: #6e7681;   /* 기존 #484f58 → 3.9:1로 상향, 보조 라벨에만 사용 */
}

/* Neon Lab — 네온 채도 조절, 가독성 향상 */
[data-theme="neon-lab"] {
  --color-accent: #00E09A;       /* 기존 #00ffaa → 채도 약간 낮춰 눈 피로 감소 */
  --color-accent-hover: #33F0B0;
  --color-text-muted: #7070BB;   /* 기존 #5555aa → 4.0:1로 상향 */
  --color-text-secondary: #9999DD; /* 기존 #8888cc → 밝기 상향 */
}

/* Forest Night — 전반적 밝기 상향 */
[data-theme="forest-night"] {
  --color-text-muted: #6B9B6B;   /* 기존 #557755 → 4.1:1 */
  --color-text-secondary: #99BB99; /* 기존 #88aa88 → 가독성 향상 */
}

/* Clean White — muted 어둡게 */
[data-theme="clean-white"] {
  --color-text-muted: #6e7781;   /* 기존 #8b949e → 4.7:1 */
}
```

### 2.3 코딩 환경 눈 피로도 개선

에디터 배경과 주변 패널 간 명도 차이가 너무 크면 눈이 피로하다. 에디터 배경은 주변보다 약간만 어두운 수준을 유지한다.

```css
/* 에디터 전용 배경 변수 추가 (모든 테마) */
:root,
[data-theme="deep-space"] {
  --color-editor-bg: #0d1117;       /* bg-primary와 동일 — 가장 낮은 명도 */
  --color-editor-gutter: #161b22;   /* 줄번호 영역은 한 단계 밝게 */
  --color-editor-line-highlight: rgba(88, 166, 255, 0.06); /* 현재 줄 강조 */
}

[data-theme="neon-lab"] {
  --color-editor-bg: #0a0a1a;
  --color-editor-gutter: #12122a;
  --color-editor-line-highlight: rgba(0, 224, 154, 0.06);
}

[data-theme="clean-white"] {
  --color-editor-bg: #ffffff;
  --color-editor-gutter: #f6f8fa;
  --color-editor-line-highlight: rgba(9, 105, 218, 0.04);
}
```

### 2.4 테마 선택 UI 개선

드롭다운 select 대신 시각적 테마 스위처를 제안한다. 각 테마를 작은 색상 칩으로 표현한다.

```jsx
{/* ThemeSwitcher.jsx — select 대체 */}
<div className="flex items-center gap-1.5">
  {THEMES.map(t => (
    <button
      key={t}
      onClick={() => setTheme(t)}
      className="w-5 h-5 rounded-full border-2 transition-transform duration-150"
      style={{
        background: THEME_COLORS[t].preview, /* 테마별 대표 그라디언트 */
        borderColor: theme === t ? 'var(--color-accent)' : 'transparent',
        transform: theme === t ? 'scale(1.2)' : 'scale(1)',
      }}
      title={THEME_LABELS[t]}
      aria-label={`${THEME_LABELS[t]} 테마로 전환`}
    />
  ))}
</div>

// 테마별 미리보기 색상
const THEME_COLORS = {
  'deep-space':   { preview: 'linear-gradient(135deg, #0d1117, #58a6ff)' },
  'neon-lab':     { preview: 'linear-gradient(135deg, #0a0a1a, #00E09A)' },
  'forest-night': { preview: 'linear-gradient(135deg, #0d1a0d, #66cc99)' },
  'clean-white':  { preview: 'linear-gradient(135deg, #ffffff, #0969da)' },
};
```

---

## 3. Home 페이지 UX

### 3.1 히어로 섹션 재설계

현재 히어로는 텍스트만 있다. 3D 교육 플랫폼의 첫인상으로 부족하다.

```
[히어로 구성 — 상단 영역]
┌──────────────────────────────────────────────┐
│                                              │
│   ┌─────────────────┐   VPy Lab             │
│   │                 │                        │
│   │  Three.js로     │   자연 현상을 3D로      │
│   │  렌더링된       │   관찰하고,             │
│   │  회전하는       │   코드로 해독하는       │
│   │  데모 장면      │   실험실               │
│   │                 │                        │
│   └─────────────────┘   [시작하기] [둘러보기] │
│                                              │
└──────────────────────────────────────────────┘
```

**구현 방식**: 별도의 Three.js 씬이 아닌, CSS 기반 애니메이션 배경을 사용한다. 낮은 사양에서도 동작해야 하므로 무거운 3D 장면은 피한다.

```css
/* 히어로 배경: 격자 패턴 + 그라디언트 */
.hero-bg {
  background: 
    radial-gradient(circle at 70% 40%, var(--color-accent-bg) 0%, transparent 50%),
    linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
  background-size: 100% 100%, 24px 24px, 24px 24px;
}

[data-theme="clean-white"] .hero-bg {
  background: 
    radial-gradient(circle at 70% 40%, var(--color-accent-bg) 0%, transparent 50%),
    linear-gradient(rgba(0,0,0,0.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0,0,0,0.04) 1px, transparent 1px);
  background-size: 100% 100%, 24px 24px, 24px 24px;
}
```

```jsx
{/* 히어로 CTA 버튼 */}
<div className="flex gap-3 justify-center mt-6">
  <button
    className="px-6 py-2.5 rounded-lg font-semibold text-sm text-white transition-all duration-200"
    style={{
      background: 'var(--brand-gradient)',
      boxShadow: '0 2px 12px rgba(108, 92, 231, 0.3)',
    }}
    onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
    onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
  >
    자유 코딩 시작
  </button>
  <button
    className="px-6 py-2.5 rounded-lg font-semibold text-sm transition-all duration-200"
    style={{
      color: 'var(--color-text-primary)',
      border: '1px solid var(--color-border)',
      backgroundColor: 'var(--color-bg-secondary)',
    }}
  >
    미션 둘러보기
  </button>
</div>
```

### 3.2 카테고리 카드 개선

**현재 문제점**:
- 카드 내 정보 계층이 약하다 (카테고리 ID, 이름, 영어명, 미션수가 비슷한 크기)
- 이모지만으로 카테고리 구별이 어렵다
- "준비 중 →" 텍스트가 모든 카드에 있어서 비활성 느낌을 준다
- 호버 효과가 인라인 스타일로 구현되어 있어 유지보수가 어렵다

**개선 카드 구조**:

```
┌──────────────────────────────┐
│ ┌────┐                      │
│ │ 🧩 │  컴퓨팅 사고력  [CT] │  ← 이모지 더 크게, ID는 뱃지
│ └────┘  Computational        │
│         Thinking             │
│                              │
│ ███████░░░  3/8 완료         │  ← 진행률 바 추가
│                              │
│ ★☆☆☆  난이도: Lv.1~3        │  ← 난이도 범위 표시
│                              │
│            [시작하기 →]       │  ← 명확한 CTA
└──────────────────────────────┘
```

```css
/* 카테고리 카드 CSS */
.category-card {
  position: relative;
  border-radius: 1rem;
  padding: 1.5rem;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
  cursor: pointer;
}

.category-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: var(--card-accent);
  opacity: 0;
  transition: opacity 0.2s ease;
}

.category-card:hover {
  border-color: var(--card-accent);
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
}

.category-card:hover::before {
  opacity: 1;
}

/* 카드 상단 악센트 바 색상을 각 카테고리의 color로 설정 */
.category-card:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}
```

```jsx
{/* 개선된 카드 컴포넌트 */}
<div
  className="category-card"
  style={{ '--card-accent': cat.color }}
  role="link"
  tabIndex={0}
  aria-label={`${cat.name} 카테고리 - ${cat.count}개 미션`}
>
  {/* 이모지 아이콘 — 큰 크기, 배경 원 */}
  <div className="flex items-start gap-4 mb-4">
    <div
      className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0"
      style={{ backgroundColor: `${cat.color}15` }}
    >
      {cat.emoji}
    </div>
    <div className="flex-1 min-w-0">
      <h3 className="font-bold text-base" style={{ color: 'var(--color-text-primary)' }}>
        {cat.name}
      </h3>
      <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
        {cat.nameEn}
      </p>
    </div>
    <span
      className="text-xs font-mono px-1.5 py-0.5 rounded shrink-0"
      style={{ color: cat.color, backgroundColor: `${cat.color}15` }}
    >
      {cat.id}
    </span>
  </div>

  {/* 진행률 바 */}
  <div className="mb-3">
    <div className="flex justify-between text-xs mb-1">
      <span style={{ color: 'var(--color-text-secondary)' }}>{cat.count}개 미션</span>
      <span style={{ color: cat.color }}>0/{cat.count}</span>
    </div>
    <div className="h-1.5 rounded-full" style={{ backgroundColor: 'var(--color-bg-tertiary)' }}>
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: '0%', backgroundColor: cat.color }}
      />
    </div>
  </div>

  {/* 하단 CTA */}
  <div className="flex items-center justify-end">
    <span className="text-xs font-medium" style={{ color: cat.color }}>
      시작하기
      <span className="inline-block ml-1 transition-transform group-hover:translate-x-1">
        &rarr;
      </span>
    </span>
  </div>
</div>
```

### 3.3 카테고리 카드 그리드 반응형

```css
/* 카드 그리드 — 기기별 최적화 */
.category-grid {
  display: grid;
  gap: 1rem;
  grid-template-columns: 1fr;                        /* 모바일: 1열 */
}

@media (min-width: 640px) {
  .category-grid { grid-template-columns: repeat(2, 1fr); } /* 태블릿: 2열 */
}

@media (min-width: 1024px) {
  .category-grid { grid-template-columns: repeat(3, 1fr); } /* 데스크톱: 3열 */
}
```

### 3.4 빈 상태 / 첫 방문 안내

학생이 처음 방문했을 때, 또는 아직 미션이 로드되지 않았을 때의 UX가 필요하다.

```jsx
{/* 첫 방문 배너 — localStorage에 visited 플래그가 없을 때 표시 */}
<div
  className="rounded-xl p-6 mb-8 relative overflow-hidden"
  style={{
    background: 'var(--brand-gradient)',
    color: '#ffffff',
  }}
>
  <button
    className="absolute top-3 right-3 text-white/60 hover:text-white text-lg"
    onClick={() => { localStorage.setItem('vpylab-visited', 'true'); setShowWelcome(false); }}
    aria-label="닫기"
  >
    &times;
  </button>
  <h2 className="text-lg font-bold mb-2">VPy Lab에 오신 것을 환영합니다</h2>
  <p className="text-sm opacity-90 mb-4">
    Python 코드로 3D 세계를 만들어보세요. 먼저 자유 코딩으로 시작하거나, 
    미션을 골라 단계별로 도전할 수 있습니다.
  </p>
  <div className="flex gap-2">
    <button className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors">
      30초 가이드 보기
    </button>
  </div>
</div>
```

### 3.5 게이미피케이션 요소

Home 페이지에 학습 현황 요약 섹션을 추가한다 (로그인 후).

```
┌────────────────────────────────────────────────────┐
│  오늘의 학습                                        │
│                                                     │
│  🔥 3일 연속 도전 중     ⭐ 12개 미션 완료           │
│  📊 전체 진행률 24%      🏆 최근 달성: CT-3 통과!    │
│                                                     │
└────────────────────────────────────────────────────┘
```

```css
/* 스트릭 뱃지 */
.streak-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
  background: linear-gradient(135deg, #ff6b6b22, #ffa50022);
  color: #ff6b6b;
  border: 1px solid #ff6b6b33;
}
```

---

## 4. IDE 레이아웃 UX 설계 (Step 4 대비)

### 4.1 데스크톱 3패널 레이아웃

```
┌──────────────────────────────────────────────────────────┐
│ Header: [로고]  [미션명: SC-1 자유낙하]  [테마] [언어]    │
├─────────────────┬────────────────────────────────────────┤
│                 │  [▶ 실행] [■ 정지] [↺ 초기화]  [공유]  │
│                 ├────────────────────────────────────────┤
│   코드 에디터    │                                        │
│   (Monaco)      │          3D 뷰포트                     │
│                 │          (Three.js)                    │
│   좌측 40%      │          우측 60%                      │
│                 │                                        │
│                 ├────────────────────────────────────────┤
│                 │  콘솔 출력                              │
│                 │  (높이 120px, 접기/펼치기 가능)          │
├─────────────────┴────────────────────────────────────────┤
│ 상태바: [Python 준비됨] [줄 15, 열 8] [UTF-8]             │
└──────────────────────────────────────────────────────────┘
```

**핵심 원칙**:
- 코드를 왼쪽, 결과를 오른쪽에 배치 (좌에서 우로 읽는 자연스러운 흐름: 입력 → 출력)
- 에디터는 전체 높이를 차지 (코드가 긴 미션에서 스크롤 최소화)
- 3D 뷰포트가 가장 넓은 영역 — 이 플랫폼의 핵심 가치
- 콘솔은 기본 축소 상태, 오류 발생 시 자동 펼침

### 4.2 리사이즈 핸들

```css
/* 패널 리사이저 */
.panel-resizer {
  width: 4px;
  cursor: col-resize;
  background: var(--color-border);
  transition: background 0.15s ease;
  position: relative;
  flex-shrink: 0;
}

.panel-resizer:hover,
.panel-resizer:active {
  background: var(--color-accent);
}

/* 리사이저 드래그 중 커서 영역 확장 (잡기 쉽게) */
.panel-resizer::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: -4px;
  right: -4px;
}

/* 수평 리사이저 (콘솔 위) */
.panel-resizer-horizontal {
  height: 4px;
  cursor: row-resize;
  background: var(--color-border);
  transition: background 0.15s ease;
}

.panel-resizer-horizontal:hover,
.panel-resizer-horizontal:active {
  background: var(--color-accent);
}
```

**리사이즈 제약 조건**:
- 에디터 최소 너비: 320px (코드 가독성 보장)
- 3D 뷰포트 최소 너비: 280px
- 콘솔 최소 높이: 80px, 최대 높이: 뷰포트의 50%
- `localStorage`에 마지막 패널 비율 저장

### 4.3 태블릿 2패널 토글 (화면 너비 1024px 미만)

```
[탭 바]  [코드 ✏️]  [3D 🎯]  [콘솔 📋]

← 스와이프로 전환 또는 탭 클릭 →
```

```css
/* 태블릿 모드 — 1024px 미만 */
@media (max-width: 1023px) {
  .ide-layout {
    display: flex;
    flex-direction: column;
  }

  .ide-tab-bar {
    display: flex;
    border-bottom: 1px solid var(--color-border);
    background: var(--color-bg-secondary);
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }

  .ide-tab {
    padding: 0.625rem 1rem;
    font-size: 0.8125rem;
    font-weight: 500;
    white-space: nowrap;
    border-bottom: 2px solid transparent;
    color: var(--color-text-secondary);
    transition: all 0.15s ease;
  }

  .ide-tab.active {
    color: var(--color-accent);
    border-bottom-color: var(--color-accent);
  }

  .ide-panel {
    flex: 1;
    min-height: 0;
    display: none;
  }

  .ide-panel.active {
    display: flex;
  }
}
```

### 4.4 실행 버튼 위치와 상태

실행 버튼은 에디터와 뷰포트 사이 상단의 툴바에 배치한다. 가장 자주 누르는 버튼이므로 크고 눈에 띄어야 한다.

```jsx
{/* EditorToolbar.jsx */}
<div className="flex items-center gap-2 px-3 py-2"
  style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)' }}>

  {/* 실행 버튼 — 가장 크고 강조 */}
  <button
    className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold text-white transition-all duration-150"
    style={{
      background: isRunning ? '#e03131' : '#2b8a3e',
      boxShadow: isRunning ? '0 0 0 3px #e0313133' : '0 0 0 3px #2b8a3e33',
    }}
    onClick={isRunning ? onStop : onRun}
  >
    {isRunning ? (
      <><span>&#9632;</span> 정지</>      /* 실행 중이면 빨간 정지 */
    ) : (
      <><span>&#9654;</span> 실행</>      /* 정지 상태면 초록 실행 */
    )}
  </button>

  {/* 초기화 */}
  <button
    className="px-3 py-1.5 rounded-lg text-xs transition-colors"
    style={{ color: 'var(--color-text-secondary)', background: 'var(--color-bg-tertiary)' }}
  >
    ↺ 초기화
  </button>

  <div className="flex-1" />

  {/* 우측: 공유/내보내기 */}
  <button className="text-xs px-3 py-1.5 rounded-lg"
    style={{ color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}>
    공유
  </button>
</div>
```

**단축키**: `Ctrl+Enter` (또는 `Cmd+Enter`) = 실행. 에디터 하단에 키 힌트를 작게 표시한다.

```css
.keyboard-hint {
  font-size: 0.6875rem;
  color: var(--color-text-muted);
  font-family: var(--font-mono);
}

.keyboard-hint kbd {
  display: inline-block;
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  border: 1px solid var(--color-border);
  background: var(--color-bg-tertiary);
  font-size: 0.625rem;
  line-height: 1;
}
```

### 4.5 미션 모드 레이아웃 확장

미션 진행 시, 좌측 에디터 위에 미션 설명/힌트 패널을 토글로 추가한다.

```
┌───────────────────┬──────────────────────────────────┐
│ [미션 설명 ▾]     │  [▶ 실행]  [채점 제출]            │
│ ┌───────────────┐ ├──────────────────────────────────┤
│ │ SC-1: 자유낙하│ │                                  │
│ │               │ │           3D 뷰포트              │
│ │ 공이 떨어지는 │ │                                  │
│ │ 시뮬레이션... │ │                                  │
│ │               │ ├──────────────────────────────────┤
│ │ [힌트 1] [2]  │ │  콘솔                            │
│ └───────────────┘ │                                  │
│ ┌───────────────┐ │                                  │
│ │ 코드 에디터    │ │                                  │
│ │               │ │                                  │
│ └───────────────┘ │                                  │
└───────────────────┴──────────────────────────────────┘
```

---

## 5. 로딩 UX: Pyodide 25MB 대기

### 5.1 현재 문제

30초~1분의 대기 시간은 고등학생 집중력에 치명적이다. "로딩 중..."만 보여주면 이탈한다.

### 5.2 단계별 프로그레스 바

로딩을 의미 있는 단계로 나누어 진행감을 준다.

```jsx
const LOADING_STAGES = [
  { label: 'Python 엔진 다운로드', percent: 0,  icon: '📦' },
  { label: 'WebAssembly 컴파일',   percent: 40, icon: '⚙️' },
  { label: 'VPython 라이브러리 설치', percent: 70, icon: '🔧' },
  { label: '3D 환경 초기화',       percent: 90, icon: '🎯' },
  { label: '준비 완료!',           percent: 100, icon: '🚀' },
];
```

### 5.3 교육적 로딩 화면 구성

```
┌──────────────────────────────────────────┐
│                                          │
│            ⚙️ WebAssembly 컴파일 중       │
│                                          │
│  ██████████████░░░░░░░░░  58%            │
│                                          │
│  ─────────────────────────────────────   │
│                                          │
│  💡 알고 계셨나요?                        │
│                                          │
│  "VPython의 sphere()는 Three.js의        │
│   SphereGeometry로 변환됩니다.            │
│   기본 반지름은 1, 색상은 흰색이에요."     │
│                                          │
│  ─────────────────────────────────────   │
│                                          │
│  💬 첫 방문 시 약 30초 소요               │
│     다음부터는 캐시로 빠르게 로드됩니다     │
│                                          │
└──────────────────────────────────────────┘
```

### 5.4 로딩 팁 목록

```javascript
const LOADING_TIPS = [
  { emoji: '🐍', text: 'Python의 들여쓰기는 4칸 스페이스가 표준이에요.' },
  { emoji: '🌐', text: 'VPython의 vector(1,0,0)은 x축 방향 단위벡터입니다.' },
  { emoji: '🎨', text: 'color.red, color.green, color.blue로 객체 색상을 지정해보세요.' },
  { emoji: '📐', text: 'rate(60)은 초당 60번 화면을 갱신합니다. 부드러운 애니메이션의 비결!' },
  { emoji: '🔄', text: 'for 루프와 while 루프: 반복 횟수를 알면 for, 조건 기반이면 while!' },
  { emoji: '💡', text: '변수명은 의미 있게! ball_velocity가 bv보다 훨씬 읽기 좋아요.' },
  { emoji: '🌍', text: 'VPy Lab은 오픈소스예요. GitHub에서 미션을 만들어 기여할 수 있어요!' },
  { emoji: '🔬', text: '뉴턴의 제2법칙: F=ma. 이걸 코드로 구현하면 자유 낙하 시뮬레이션이 됩니다.' },
];
```

### 5.5 프로그레스 바 CSS

```css
/* 로딩 프로그레스 바 */
.loading-progress-track {
  height: 6px;
  border-radius: 3px;
  background: var(--color-bg-tertiary);
  overflow: hidden;
  width: 280px;
  margin: 0 auto;
}

.loading-progress-fill {
  height: 100%;
  border-radius: 3px;
  background: var(--brand-gradient);
  transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
}

/* 프로그레스 바 끝에 빛나는 효과 */
.loading-progress-fill::after {
  content: '';
  position: absolute;
  right: 0;
  top: -2px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: white;
  opacity: 0.6;
  filter: blur(3px);
  animation: loading-glow 1.5s ease-in-out infinite;
}

@keyframes loading-glow {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 0.8; }
}

/* 팁 전환 애니메이션 */
.loading-tip {
  animation: tip-fade 0.4s ease-out;
}

@keyframes tip-fade {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
```

### 5.6 팁 자동 교체 간격

5초마다 다음 팁으로 전환한다. 읽기에 충분한 시간이면서 지루하지 않은 간격이다.

```jsx
useEffect(() => {
  const interval = setInterval(() => {
    setTipIndex(prev => (prev + 1) % LOADING_TIPS.length);
  }, 5000);
  return () => clearInterval(interval);
}, []);
```

---

## 6. 마이크로인터랙션

### 6.1 코드 실행 피드백

```css
/* 실행 버튼 클릭 시 리플 효과 */
@keyframes run-ripple {
  0% { box-shadow: 0 0 0 0 rgba(43, 138, 62, 0.4); }
  100% { box-shadow: 0 0 0 12px rgba(43, 138, 62, 0); }
}

.run-button-active {
  animation: run-ripple 0.6s ease-out;
}

/* 실행 중 표시: 뷰포트 테두리 펄스 */
@keyframes viewport-running {
  0%, 100% { border-color: var(--color-border); }
  50% { border-color: var(--color-accent); }
}

.viewport-running {
  animation: viewport-running 2s ease-in-out infinite;
}
```

### 6.2 채점 결과 애니메이션

```css
/* 통과 — 화면 전체에 초록색 플래시 */
@keyframes grade-pass {
  0% { opacity: 0; }
  20% { opacity: 1; }
  100% { opacity: 0; }
}

.grade-flash-pass {
  position: fixed;
  inset: 0;
  pointer-events: none;
  background: radial-gradient(circle, rgba(47, 179, 80, 0.15) 0%, transparent 70%);
  animation: grade-pass 1.2s ease-out forwards;
  z-index: 50;
}

/* 실패 — 붉은 흔들림 */
@keyframes grade-fail-shake {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-4px); }
  40% { transform: translateX(4px); }
  60% { transform: translateX(-2px); }
  80% { transform: translateX(2px); }
}

.grade-fail-shake {
  animation: grade-fail-shake 0.4s ease-out;
}

/* 채점 점수 숫자 카운트업 */
@keyframes score-countup {
  from { opacity: 0; transform: scale(0.5); }
  to { opacity: 1; transform: scale(1); }
}

.score-number {
  animation: score-countup 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
  font-size: 2rem;
  font-weight: 800;
  font-family: var(--font-mono);
}
```

### 6.3 힌트 열기 애니메이션

단계별 힌트는 왼쪽에서 슬라이드인하면서 페이드인한다.

```css
@keyframes hint-reveal {
  from {
    opacity: 0;
    transform: translateX(-12px);
    max-height: 0;
  }
  to {
    opacity: 1;
    transform: translateX(0);
    max-height: 200px;
  }
}

.hint-content {
  animation: hint-reveal 0.35s cubic-bezier(0.4, 0, 0.2, 1) forwards;
  overflow: hidden;
}

/* 힌트 단계 표시 — 3단계 점진적 공개 */
.hint-step {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border-radius: 0.5rem;
  cursor: pointer;
  transition: background 0.15s ease;
}

.hint-step:hover {
  background: var(--color-bg-tertiary);
}

.hint-step-locked {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 잠긴 힌트 아이콘 — 자물쇠 */
.hint-lock {
  width: 14px;
  height: 14px;
  color: var(--color-text-muted);
}
```

### 6.4 레벨업 / 미션 완료 효과

```css
/* 미션 완료 축하 배너 — 위에서 슬라이드 다운 */
@keyframes mission-complete-banner {
  0% { transform: translateY(-100%); opacity: 0; }
  20% { transform: translateY(0); opacity: 1; }
  80% { transform: translateY(0); opacity: 1; }
  100% { transform: translateY(-100%); opacity: 0; }
}

.mission-complete-banner {
  position: fixed;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  padding: 0.75rem 2rem;
  border-radius: 0 0 1rem 1rem;
  font-weight: 700;
  font-size: 0.875rem;
  z-index: 100;
  animation: mission-complete-banner 3s cubic-bezier(0.4, 0, 0.2, 1) forwards;
  background: var(--brand-gradient);
  color: #ffffff;
  box-shadow: 0 4px 20px rgba(108, 92, 231, 0.3);
}

/* 간단한 파티클 효과 — CSS만으로 (JS 불필요) */
@keyframes confetti-fall {
  0% { transform: translateY(-10px) rotate(0deg); opacity: 1; }
  100% { transform: translateY(60px) rotate(720deg); opacity: 0; }
}

.confetti-particle {
  position: absolute;
  width: 6px;
  height: 6px;
  border-radius: 1px;
  animation: confetti-fall 1.5s ease-out forwards;
}
```

### 6.5 콘솔 출력 애니메이션

```css
/* 새 출력 줄 추가 시 */
@keyframes console-line-in {
  from { opacity: 0; transform: translateX(-4px); }
  to { opacity: 1; transform: translateX(0); }
}

.console-line {
  animation: console-line-in 0.15s ease-out;
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  line-height: 1.5;
  padding: 0 0.75rem;
}

.console-line-error {
  color: var(--color-error);
  background: rgba(248, 81, 73, 0.06);
}

.console-line-output {
  color: var(--color-text-primary);
}
```

### 6.6 버튼/인터랙티브 요소 전역 트랜지션

```css
/* 전역 전환 기본값 — 모든 인터랙티브 요소에 적용 */
button, a, select, input, [role="button"] {
  transition: background-color 0.15s ease,
              color 0.15s ease,
              border-color 0.15s ease,
              box-shadow 0.15s ease,
              transform 0.15s ease;
}

/* 키보드 포커스 가시성 (접근성) */
:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}

/* 터치 피드백 (모바일/태블릿) */
@media (hover: none) {
  button:active, [role="button"]:active {
    transform: scale(0.97);
  }
}
```

---

## 7. 타이포그래피

### 7.1 현재 문제

- `@font-face`의 `src`에 CSS 파일 URL이 들어가 있다. 이는 동작하지 않는다. CSS 파일은 `@import`로 로드해야 한다.
- 코드 폰트(JetBrains Mono)가 CDN 로드 설정이 없다.
- 크기 체계가 명시적으로 정의되어 있지 않다.

### 7.2 폰트 로딩 수정

```css
/* index.css 상단 — 기존 @font-face 삭제 후 아래로 교체 */
@import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css');
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap');

@import "tailwindcss";
```

### 7.3 타이포그래피 스케일

모바일부터 데스크톱까지 유동적으로 대응하는 체계. 기본 크기를 `1rem = 16px`으로 설정하되, 학교 모니터 해상도(1920x1080 기준)에서 코드가 편하게 읽히는 크기를 우선한다.

```css
/* 타이포그래피 토큰 */
:root {
  /* 제목 체계 */
  --text-display: 2rem;        /* 32px — 히어로 제목 */
  --text-heading-1: 1.5rem;    /* 24px — 페이지 제목 */
  --text-heading-2: 1.25rem;   /* 20px — 섹션 제목 */
  --text-heading-3: 1.0625rem; /* 17px — 카드 제목 */
  
  /* 본문 체계 */
  --text-body: 0.9375rem;      /* 15px — 일반 본문 (미션 설명 등) */
  --text-body-small: 0.8125rem;/* 13px — 보조 텍스트, 콘솔 */
  --text-caption: 0.75rem;     /* 12px — 라벨, 뱃지 */
  --text-tiny: 0.6875rem;      /* 11px — 키보드 힌트, 버전 */

  /* 코드 크기 — 에디터 기본 */
  --text-code: 0.875rem;       /* 14px — Monaco 에디터 기본 */
  --text-code-small: 0.8125rem;/* 13px — 인라인 코드 */
  
  /* 줄 높이 */
  --leading-tight: 1.3;
  --leading-normal: 1.6;
  --leading-relaxed: 1.8;
  
  /* 글자 간격 */
  --tracking-tight: -0.01em;
  --tracking-normal: 0;
  --tracking-wide: 0.02em;
}

/* 반응형 — 작은 화면에서 크기 축소 */
@media (max-width: 640px) {
  :root {
    --text-display: 1.625rem;    /* 26px */
    --text-heading-1: 1.25rem;   /* 20px */
    --text-heading-2: 1.0625rem; /* 17px */
    --text-body: 0.875rem;       /* 14px */
    --text-code: 0.8125rem;      /* 13px */
  }
}
```

### 7.4 제목 스타일

```css
/* 제목 공통 */
h1, h2, h3, h4 {
  font-family: var(--font-sans);
  font-weight: 700;
  letter-spacing: var(--tracking-tight);
  line-height: var(--leading-tight);
  color: var(--color-text-primary);
}

h1 { font-size: var(--text-heading-1); }
h2 { font-size: var(--text-heading-2); }
h3 { font-size: var(--text-heading-3); }

/* 미션 설명 본문 — 가독성 최우선 */
.mission-description {
  font-size: var(--text-body);
  line-height: var(--leading-relaxed);
  color: var(--color-text-primary);
  word-break: keep-all;          /* 한국어 단어 단위 줄바꿈 */
  overflow-wrap: break-word;
}

/* 코드 블록 (인라인) */
code:not(pre code) {
  font-family: var(--font-mono);
  font-size: var(--text-code-small);
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  background: var(--color-bg-tertiary);
  color: var(--color-accent);
}
```

### 7.5 코드 에디터 폰트 설정

Monaco Editor 설정에 적용할 값:

```javascript
// Monaco Editor 옵션
const editorOptions = {
  fontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, Consolas, monospace",
  fontSize: 14,                    // var(--text-code)에 해당
  lineHeight: 22,                  // 1.57 비율
  fontLigatures: true,             // JetBrains Mono 합자 활성화
  letterSpacing: 0.3,
  renderWhitespace: 'selection',   // 선택 시에만 공백 표시
  minimap: { enabled: false },     // 학생에게 미니맵은 혼란
  scrollBeyondLastLine: false,
  padding: { top: 12, bottom: 12 },
  lineNumbers: 'on',
  lineNumbersMinChars: 3,
  folding: true,
  wordWrap: 'on',                  // 좁은 화면에서 줄 바꿈
  tabSize: 4,
};
```

---

## 8. 상태바 설계

IDE 하단에 상태바를 추가한다. VS Code 사용자에게 익숙한 패턴이다.

```css
.status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 24px;
  padding: 0 0.75rem;
  font-size: var(--text-tiny);
  font-family: var(--font-mono);
  background: var(--color-bg-tertiary);
  border-top: 1px solid var(--color-border);
  color: var(--color-text-muted);
}

.status-bar-item {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0 0.5rem;
}

/* Python 준비 상태 표시 */
.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.status-dot-ready { background: var(--color-success); }
.status-dot-loading { background: var(--color-warning); animation: pulse 1.5s infinite; }
.status-dot-error { background: var(--color-error); }

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
```

```
[● Python 준비됨]                          [줄 15, 열 8] [UTF-8] [Deep Space]
```

---

## 9. 접근성(A11y) 체크리스트

교육 플랫폼으로서 기본 접근성을 보장해야 한다.

| 항목 | 현재 상태 | 개선 |
|---|---|---|
| 키보드 탐색 | 카드에 tabIndex 없음 | 모든 카드에 `tabIndex={0}`, `role="link"`, `onKeyDown Enter` 추가 |
| aria-label | 없음 | 주요 버튼, 카드, 네비게이션에 aria-label 추가 |
| 색상 대비 | text-muted 실패 | 위 2.2 참조 |
| 포커스 표시 | outline 기본 | `:focus-visible` 커스텀 스타일 추가 |
| skip-to-content | 없음 | 헤더 앞에 skip link 추가 |
| 이미지 alt | N/A | 3D 뷰포트에 `aria-label="3D 시뮬레이션 뷰포트"` 추가 |
| 동작 축소 | 미고려 | `prefers-reduced-motion` 미디어 쿼리 적용 |

```css
/* 접근성: 동작 축소 선호 사용자 */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}

/* 스킵 링크 */
.skip-link {
  position: absolute;
  top: -100%;
  left: 0;
  padding: 0.5rem 1rem;
  background: var(--color-accent);
  color: white;
  font-weight: 600;
  z-index: 200;
  transition: top 0.2s ease;
}

.skip-link:focus {
  top: 0;
}
```

---

## 10. 스페이싱(Spacing) 시스템

일관된 간격을 위한 기본 단위: `4px (0.25rem)`.

```css
:root {
  --space-1: 0.25rem;   /* 4px  — 최소 간격 */
  --space-2: 0.5rem;    /* 8px  — 인라인 요소 간 */
  --space-3: 0.75rem;   /* 12px — 컴팩트 패딩 */
  --space-4: 1rem;      /* 16px — 기본 패딩 */
  --space-5: 1.25rem;   /* 20px — 카드 내부 패딩 */
  --space-6: 1.5rem;    /* 24px — 섹션 간격 */
  --space-8: 2rem;      /* 32px — 큰 섹션 간격 */
  --space-10: 2.5rem;   /* 40px */
  --space-12: 3rem;     /* 48px — 히어로/주요 영역 */
}
```

---

## 11. Header 개선

### 11.1 현재 문제

- 네비게이션이 없다 (홈, 자유 코딩, 미션, 설정)
- 언어/테마가 HTML select로 되어 있어 스타일링 한계
- 모바일에서 항목이 겹칠 수 있음

### 11.2 개선된 Header 구조

```
데스크톱:
┌──────────────────────────────────────────────────────────────┐
│ [로고]  [홈] [자유 코딩] [미션]   [●●●● 테마] [한/En] [설정] │
└──────────────────────────────────────────────────────────────┘

태블릿/모바일:
┌──────────────────────────────────────────────┐
│ [로고]                        [설정] [메뉴 ☰]│
└──────────────────────────────────────────────┘
```

```css
/* 헤더 */
.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 48px;
  padding: 0 var(--space-4);
  background: var(--color-bg-secondary);
  border-bottom: 1px solid var(--color-border);
  position: sticky;
  top: 0;
  z-index: 40;
  backdrop-filter: blur(8px);
  background: color-mix(in srgb, var(--color-bg-secondary) 85%, transparent);
}

/* 네비게이션 링크 */
.nav-link {
  padding: 0.375rem 0.75rem;
  border-radius: 0.375rem;
  font-size: var(--text-body-small);
  font-weight: 500;
  color: var(--color-text-secondary);
  transition: all 0.15s ease;
}

.nav-link:hover {
  color: var(--color-text-primary);
  background: var(--color-bg-tertiary);
}

.nav-link.active {
  color: var(--color-accent);
  background: var(--color-accent-bg);
}

/* 모바일 네비게이션 숨기기 */
@media (max-width: 768px) {
  .nav-links { display: none; }
  .mobile-menu-button { display: flex; }
}

@media (min-width: 769px) {
  .mobile-menu-button { display: none; }
}
```

---

## 12. 우선순위 정리

| 우선순위 | 항목 | 영향도 | 작업량 |
|---|---|---|---|
| **P0** | text-muted 대비율 수정 (접근성 필수) | 높음 | 10분 |
| **P0** | 폰트 로딩 수정 (@font-face → @import) | 높음 | 5분 |
| **P1** | 카테고리 카드 개선 (진행률 바, CTA, 접근성) | 높음 | 2시간 |
| **P1** | IDE 3패널 레이아웃 + 리사이저 | 높음 | 4시간 |
| **P1** | 로딩 UX (프로그레스 바 + 팁) | 높음 | 3시간 |
| **P2** | 브랜드 로고/그라디언트 | 중간 | 1시간 |
| **P2** | 테마 스위처 (select → 컬러 칩) | 중간 | 1시간 |
| **P2** | Header 네비게이션 추가 | 중간 | 2시간 |
| **P2** | 마이크로인터랙션 (실행, 채점, 힌트) | 중간 | 3시간 |
| **P2** | 태블릿 2패널 토글 | 중간 | 2시간 |
| **P3** | 히어로 섹션 개선 (배경, CTA) | 낮음 | 1시간 |
| **P3** | 상태바 | 낮음 | 1시간 |
| **P3** | 게이미피케이션 (스트릭, 진행률 요약) | 낮음 | 3시간 |
| **P3** | prefers-reduced-motion 지원 | 낮음 | 30분 |
| **P3** | skip-to-content 링크 | 낮음 | 15분 |

---

## 부록: 애니메이션 타이밍 함수 통일

```css
:root {
  /* 표준 이징 — 전체 프로젝트에서 일관 사용 */
  --ease-default: cubic-bezier(0.4, 0, 0.2, 1);   /* Material 표준 */
  --ease-in: cubic-bezier(0.4, 0, 1, 1);           /* 화면 밖으로 나갈 때 */
  --ease-out: cubic-bezier(0, 0, 0.2, 1);          /* 화면 안으로 들어올 때 */
  --ease-bounce: cubic-bezier(0.34, 1.56, 0.64, 1);/* 점수, 뱃지 팝업 */

  /* 표준 지속시간 */
  --duration-fast: 150ms;     /* 호버, 포커스 */
  --duration-normal: 200ms;   /* 일반 전환 */
  --duration-slow: 350ms;     /* 패널 열기, 힌트 공개 */
  --duration-slower: 500ms;   /* 점수 카운트, 테마 전환 */
}
```

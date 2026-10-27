# Design System — VPyLab

## Product Context
- **What this is:** Python 3D 프로그래밍 교육 플랫폼 (Pyodide + Three.js + Web Audio)
- **Who it's for:** 중/고등학생, 교사
- **Space/industry:** Creative coding education (p5.js, Scratch, Processing 계열)
- **Project type:** Web app (IDE + 미션 + 갤러리 + 대시보드)

## Aesthetic Direction
- **Direction:** Playful-Scientific
- **Decoration level:** Intentional (도트 그리드 패턴, 서브틀한 텍스처)
- **Mood:** 과학관 체험 전시 — 조직적이지만 활기차고, 배움에 진지하지만 시각적으로 신나는
- **Reference sites:** p5js.org, scratch.mit.edu, openprocessing.org

## Typography
- **Display/Hero:** Satoshi (Variable, 700-900) — 기하학적이고 현대적, Inter와 차별화
- **Body:** DM Sans (400-600) — 따뜻하고 가독성 높음
- **UI/Labels:** DM Sans 500
- **Data/Tables:** JetBrains Mono (tabular-nums)
- **Code:** JetBrains Mono
- **Loading:** Google Fonts CDN
- **Scale:** 12 / 13 / 14 / 16 / 18 / 20 / 24 / 32 / 40 / 48 / 64 / 80

## Color
- **Approach:** Expressive — "빛의 분산" 컨셉, 다색 스펙트럼
- **Background:** #F8FAFC (기존 creative-light 테마)
- **Surface:** #FFFFFF
- **Primary text:** #111827
- **Secondary text:** #6B7280
- **Muted text:** #9CA3AF
- **Border:** #E5E7EB
- **기본 강조색:** #2563EB. 화면은 `index.css`의 `--color-*` 테마 변수를 공유합니다.
- **Category colors (스펙트럼):**
  - CT (컴퓨팅): #6C5CE7 (Purple)
  - CR (창작): #FF6B6B (Coral)
  - MA (수학): #00CEC9 (Cyan)
  - SC (과학): #00B894 (Mint)
  - AR (아트): #F0883E (Orange)
  - SN (사운드): #E84393 (Pink)
  - AI (인공지능): #4A6CF7 (Blue)
- **Semantic:** success #00B894, warning #FDCB6E, error #FF6B6B, info #4A6CF7
- **Dark mode:** 배경 #0F172A, 표면 #1E293B, 텍스트 #F8FAFC, 테두리 #334155

## Spacing
- **Base unit:** 8px
- **Density:** Comfortable
- **Scale:** 2(2px) 4(4px) 8(8px) 12(12px) 16(16px) 20(20px) 24(24px) 32(32px) 40(40px) 48(48px) 64(64px) 80(80px)

## Layout
- **Approach:** Grid-disciplined
- **Grid:** 1 col (mobile) → 2 col (tablet) → 3 col (desktop)
- **Max content width:** 일반 페이지 1280px. 에디터·3D 작업 화면은 더 넓게 사용합니다.
- **Border radius:** 작업 카드·버튼·입력·탭·패널은 0. 아바타·상태 점처럼 원형 의미가 있는 요소만 full:9999px.
- **헤더:** 기존 앱과 같은 56px 기본 높이, 1px 하단 테두리와 작은 사각형 활성 메뉴.
- **새 교실:** 기능 구조는 유지하며 기존 화면의 색·글꼴·작업 밀도를 따릅니다. 새 로고 제작은 보류하고 `VPyLab` 텍스트만 표시합니다.

## Motion
- **Approach:** Intentional
- **Easing:** enter(cubic-bezier(0.4, 0, 0.2, 1)) exit(ease-in) move(ease-in-out)
- **Duration:** micro(100ms) short(200ms) medium(300ms) long(500ms)
- **Patterns:** 카드 호버 translateY(-4px), 버튼 호버 scale(1.02), 페이지 입장 slide-up

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-04-14 | 디자인 시스템 생성 | /design-consultation 기반, p5.js 참고, Playful-Scientific 방향 |
| 2026-04-14 | Satoshi + DM Sans 선택 | Inter 대비 독자적 얼굴, 기하학적이면서 따뜻함 |
| 2026-04-14 | 다색 스펙트럼 컬러 | "빛의 분산" 컨셉, 카테고리별 고유색 |
| 2026-10-28 | 새 교실도 기존 테마·사각형 UI를 공유, 로고 제작 보류 | 사용자 디자인 선호 반영, 기존 `index.css`의 실제 기준과 문서 일치 |

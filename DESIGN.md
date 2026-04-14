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
- **Background:** #FAFBFC (cool gray)
- **Surface:** #FFFFFF
- **Primary text:** #1A1A2E (deep navy-black)
- **Secondary text:** #5A5B6A
- **Muted text:** #9394A5
- **Border:** #E5E6EE
- **Category colors (스펙트럼):**
  - CT (컴퓨팅): #6C5CE7 (Purple)
  - CR (창작): #FF6B6B (Coral)
  - MA (수학): #00CEC9 (Cyan)
  - SC (과학): #00B894 (Mint)
  - AR (아트): #F0883E (Orange)
  - SN (사운드): #E84393 (Pink)
  - AI (인공지능): #4A6CF7 (Blue)
- **Semantic:** success #00B894, warning #FDCB6E, error #FF6B6B, info #4A6CF7
- **Dark mode:** 배경 #16161A, 표면 #1E1E24, 텍스트 #FFFFFE, 테두리 #2E2E38

## Spacing
- **Base unit:** 8px
- **Density:** Comfortable
- **Scale:** 2(2px) 4(4px) 8(8px) 12(12px) 16(16px) 20(20px) 24(24px) 32(32px) 40(40px) 48(48px) 64(64px) 80(80px)

## Layout
- **Approach:** Grid-disciplined
- **Grid:** 1 col (mobile) → 2 col (tablet) → 3 col (desktop)
- **Max content width:** 1200px
- **Border radius:** sm:6px, md:12px, lg:16px, xl:20px, full:9999px

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

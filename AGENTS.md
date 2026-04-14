# VPyLab — Codex 가이드

## 프로젝트 개요

3D 프로그래밍 교육 플랫폼. Pyodide(Python 3) + Three.js + Web Audio API.
전 세계 학교를 위한 오픈소스 프로젝트.

## 기술 스택

- **프론트엔드**: React 19 + Vite + Tailwind v4 (client/, 포트 4033)
- **백엔드**: Express 5 (server/, 포트 4034)
- **에디터**: Monaco Editor
- **3D**: Three.js
- **Python**: Pyodide (Web Worker)
- **DB/인증**: Supabase Pro
- **AI**: Upstage Solar Pro 3 (서버 프록시)
- **호스팅**: Railway (백엔드), Vercel (프론트)

## 코딩 컨벤션

- UI 텍스트와 주석은 한국어
- 코드(변수명, 함수명 등)는 영어
- CSS 변수 기반 2종 테마 시스템 (creative-light / deep-dark)
- 폰트: Satoshi(Display) + DM Sans(Body) + JetBrains Mono(Code)
- 디자인 시스템: DESIGN.md 참조
- 보안: Express에 helmet, cors, rate-limit 필수. Worker 내 위험 API 삭제 필수.

## 보안 주의사항

- `.env` 파일은 절대 커밋하지 않음
- 모든 콘솔 출력은 textContent로만 렌더링 (innerHTML 금지)
- Pyodide Worker에서 fetch, WebSocket, IndexedDB 삭제 필수
- Supabase RLS 정책 필수 적용
- LZ-String 디코딩 후 50KB 상한 검증

## 라이선스

- 코드: AGPL v3
- 미션 콘텐츠: CC BY-NC-SA 4.0

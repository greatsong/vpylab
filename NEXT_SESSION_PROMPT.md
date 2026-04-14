# VPy Lab — 다음 세션 프롬프트

아래 내용을 복사하여 다음 세션의 첫 메시지로 사용하세요.

---

VPy Lab 프로젝트를 이어서 진행합니다.

1. 먼저 다음 파일들을 읽어주세요:
   - /Users/greatsong/greatsong-project/vpylab/PROGRESS.md
   - /Users/greatsong/greatsong-project/vpylab/CLAUDE.md

2. 현재 상태:
   - 엔진 코어 + 미션 시스템 + 공유/내보내기 + AI 힌트 완성
   - Supabase 연동 완성 (6테이블 + 18 RLS + 3 RPC + Google/GitHub OAuth)
   - 교사 대시보드 (학급 생성/초대/학생 현황) 완성
   - About 페이지 + i18n 180+키 완성
   - **사운드 시스템**: 게임 SFX 12종, BGM 5종, 악기 8종, 노트/화음/시퀀스
   - **3D 차트**: scatter3d, surface3d, line3d, bar3d + 5종 컬러맵
   - **카메라**: Auto-Fit → Smooth Follow → Manual 하이브리드
   - **make_trail + compound + clone()** 지원
   - **내보내기 v2**: 모든 기능 동기화 (사운드/차트/30색/NamedList/악기/한글API)
   - **갤러리 시스템**: 목록/상세/발행모달/Remix/좋아요/검색/필터
   - **GitHub Pages 자동 발행**: 서버 API (리포 생성 → 커밋 → Pages 활성화)
   - **GitHub 오픈소스 인프라**: Issue/PR 템플릿, CI, CODEOWNERS 등 19파일
   - 120개 vitest 테스트 통과, 빌드 성공
   - pythink2 Supabase 프로젝트 (fipdcjhtfslinfmalwjn) 공유 사용
   - 미션 16개 (CT2 + CR2 + MA2 + SC2 + AR3 + SN5)

3. 다음 세션 작업 (우선순위 순):

   **[우선순위 1] 실제 배포**
   - Supabase 대시보드에서 Google OAuth + GitHub OAuth Provider 활성화
   - Cloudflare Pages 프론트엔드 배포
   - Railway 백엔드 배포
   - 배포 후 E2E 인증 테스트 (로그인 → 코드 저장 → 갤러리 발행 → GitHub Pages)

   **[우선순위 2] 갤러리 고도화**
   - 갤러리 상세에서 3D 미리보기 (코드 자동 실행, 읽기 전용)
   - 내보내기 파일명: GitHub ID + 날짜시간 (이미 적용됨)
   - 갤러리 썸네일 자동 생성 (Sandbox에서 실행 후 캡처)

   **[우선순위 3] 기능 확장**
   - 교사 역할 전환 기능 (admin SQL 또는 UI)
   - 미션 추가 (50개 목표, 현재 16개)
   - 2D 오버레이 차트 (plot2d)
   - matplotlib 이미지 렌더링 (base64 PNG → 콘솔 표시)

4. 방침:
   - 기능 구현 후 반드시 vitest 테스트 통과 확인
   - 화면이 있는 기능은 preview로 시각적 확인
   - UI 텍스트는 한국어, 코드는 영어
   - 보안: GitHub token DB 미저장, rate-limit, RLS, 민감정보 검사

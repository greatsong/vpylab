# VPy Lab — 다음 세션 프롬프트

아래 내용을 복사하여 다음 세션의 첫 메시지로 사용하세요.

---

VPy Lab 프로젝트를 이어서 진행합니다.

1. 먼저 다음 파일들을 읽어주세요:
   - /Users/greatsong/greatsong-project/vpylab/PROGRESS.md
   - /Users/greatsong/greatsong-project/vpylab/CLAUDE.md

2. 현재 상태:
   - 엔진 코어 + 미션 시스템 + 공유/내보내기 + AI 힌트 완성
   - Supabase 연동 완성 (4테이블 + 11 RLS + Google/GitHub OAuth 코드)
   - 교사 대시보드 (학급 생성/초대/학생 현황) 완성
   - About 페이지 + i18n 150+키 완성
   - **사운드 시스템**: 게임 SFX 12종, BGM 5종, 악기 8종, 노트/화음/시퀀스
   - **학생 친화적 API**: 음표("도"), 효과음("jump"), 색상['갈색'], 음계['솔'], 악기("피아노", "도")
   - **3D 차트**: scatter3d, surface3d, line3d, bar3d + 5종 컬러맵 (viridis/plasma/rainbow/coolwarm/ocean)
   - **카메라**: Auto-Fit → Smooth Follow → Manual 하이브리드
   - **make_trail + compound** 지원
   - **numpy**: micropip 지연 설치 (import 감지 → 자동 설치)
   - 120개 vitest 테스트 통과, 빌드 성공
   - pythink2 Supabase 프로젝트 (fipdcjhtfslinfmalwjn) 공유 사용
   - 미션 16개 (CT2 + CR2 + MA2 + SC2 + AR3 + SN5)

3. 다음 세션 작업 (우선순위 순):

   **[우선순위 1] 내보내기(export-html.js) 동기화**
   - 현재 독립 HTML 내보내기에 새 기능이 빠져 있음
   - 추가해야 할 것: 사운드 시스템, 차트 시스템, compound, 30색 팔레트, NamedList, 악기, 한글 API
   - export-html.js 안의 인라인 Python API를 vpython-api.py와 동기화

   **[우선순위 2] 실제 배포**
   - Supabase 대시보드에서 Google OAuth + GitHub OAuth Provider 활성화
   - Cloudflare Pages 프론트엔드 배포
   - Railway 백엔드 배포
   - 배포 후 E2E 인증 테스트 (로그인 → 코드 저장 → 미션 제출)

   **[우선순위 3] 기능 확장**
   - 교사 역할 전환 기능 (admin SQL 또는 UI)
   - 미션 추가 (50개 목표, 현재 16개)
   - 2D 오버레이 차트 (plot2d)
   - matplotlib 이미지 렌더링 (base64 PNG → 콘솔 표시)

4. 방침:
   - 기능 구현 후 반드시 vitest 테스트 통과 확인
   - 화면이 있는 기능은 preview로 시각적 확인
   - UI 텍스트는 한국어, 코드는 영어

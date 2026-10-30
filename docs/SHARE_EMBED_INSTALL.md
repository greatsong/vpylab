# 공유·임베드·설치 안내

VPyLab은 설치 없이 브라우저에서 실행되고 링크 하나로 공유됩니다. 이 문서는 그 장점을 살리는 다섯 가지 기능과 배포 설정을 정리합니다. (2026-10-30)

## 1. 앱으로 설치 (PWA)

- `client/public/manifest.webmanifest`가 앱 이름·아이콘·독립 창(`standalone`)을 정의합니다. 색은 `DESIGN.md`의 밝은 테마 값(표면 `#FFFFFF`, 배경 `#F8FAFC`)입니다.
- 아이콘은 `icon-192.png`·`icon-512.png`(일반)와 `icon-maskable-192.png`·`icon-maskable-512.png`(둥근 마스크용, 파란 전면 배경에 로고를 안전 영역 안으로 축소)입니다.
- 크롬·엣지: 브라우저가 `beforeinstallprompt`를 보내면 헤더에 **앱으로 설치** 버튼이 나타납니다. 설치하거나 한 번 거절하면 숨깁니다(`client/src/lib/pwa-install.js`).
- iOS Safari: 설치 프롬프트가 없으므로 화면 아래에 "공유 → 홈 화면에 추가" 안내를 한 번만 보여 줍니다. 카카오톡·네이버·인스타그램 같은 앱 안 브라우저는 설치가 되지 않아 iOS에서는 안내하지 않고, 안드로이드에서는 "크롬에서 열면 설치할 수 있습니다"를 한 번 보여 줍니다. 닫으면 `localStorage`(`vpylab-ios-install-hint-dismissed`)에 기억합니다.
- Service Worker가 매니페스트를 사전 캐시합니다(`client/scripts/service-worker-plugin.mjs`의 `PUBLIC_PRECACHE`). 응답 헤더가 그대로 저장되므로 MIME(`application/manifest+json`)이 유지됩니다.

## 2. 공유 미리보기 카드 (Open Graph)

- `/s/:id`(공유 코드)와 `/gallery/:id`(갤러리 작품)는 Vercel 서버리스 함수 `api/og.mjs`가 응답합니다. 빌드된 `index.html`의 `<head>`에 `og:title`·`og:description`·`og:image`·`og:url`·`twitter:card`만 주입하므로, 카카오톡·구글 클래스룸·Slack에는 카드가 보이고 사람에게는 앱이 그대로 뜹니다.
- 갤러리 썸네일이 data URI(JPEG·PNG·WebP)로 저장된 작품은 `api/og-image.mjs?id=<uuid>`가 디코드해 저장된 MIME 그대로 돌려줍니다. 디코드 전 문자열 길이(3MB)와 디코드 뒤 매직 바이트를 확인하며, 한 시간 캐시(`max-age=3600, stale-while-revalidate`)합니다. HTML 응답은 60초만 엣지에 둡니다. 비공개로 바꾸거나 지운 뒤에는 한 시간 안에 기본 카드로 돌아오지만, 카카오톡·페이스북 등 **메신저 쪽 캐시는 별도**라 바로 바뀌지 않습니다(페이스북 공유 디버거 등으로 갱신). URL 썸네일은 그 주소로 보냅니다. 공유 코드와 썸네일이 없는 작품은 기본 카드 `client/public/brand/og-default.png`(1200×630)를 씁니다.
- 함수는 Supabase 공개 anon 키로 읽기만 합니다. Vercel 프로젝트 환경변수(`VITE_SUPABASE_URL`·`VITE_SUPABASE_ANON_KEY` 또는 `SUPABASE_URL`·`SUPABASE_ANON_KEY`)를 먼저 쓰고, 없으면 함수 번들에 포함한 `client/.env.production`(커밋된 공개 값)을 읽습니다. 비공개·삭제된 작품, 형식이 틀린 id, 네트워크 실패는 모두 기본 카드로 응답하고 내용을 노출하지 않습니다.
- 그 밖의 페이지(홈 등)는 `client/index.html`의 기본 og 메타로 카드가 보입니다.
- 확인 방법: 메신저 봇처럼 요청해 메타를 봅니다.

  ```bash
  curl -s -A facebookexternalhit https://vpylab.vercel.app/gallery/<uuid> | grep -o '<meta property="og:[^>]*>'
  ```

## 3. 임베드 (iframe)

- `/embed/:id`는 헤더·편집기·로그인·저장 없이 3D 화면, 제목, 실행·정지, 소리 켜기, **VPyLab에서 열기**만 두는 보기 전용 페이지입니다(`client/src/pages/Embed.jsx`). 열리면 자동 실행하며, 소리는 브라우저 정책상 사용자가 **소리 켜기**를 누른 뒤에 납니다.
- `id`가 uuid면 갤러리 작품, 그 밖이면 공유 코드(nanoid 8자)로 읽습니다. 공개 작품만 조회(`is_public = true`)하므로 소유자가 로그인한 상태에서도 비공개 초안은 "작품을 찾을 수 없습니다"로 표시됩니다. 소리는 **소리 켜기**를 누른 뒤 음소거 토글로 바뀝니다.
- 갤러리 상세의 **임베드 코드 복사**와 공유 링크 대화상자의 **임베드 코드 복사**가 아래 코드를 복사합니다.

  ```html
  <iframe src="https://vpylab.vercel.app/embed/<id>" width="800" height="500" allow="autoplay; fullscreen" loading="lazy" title="VPyLab"></iframe>
  ```

- Service Worker는 `/embed/` 페이지 응답을 일반 앱 셸과 다른 키에 저장합니다(헤더가 다르기 때문).
- 보안: `vercel.json`에서 `/embed/`만 `Content-Security-Policy: … frame-ancestors *`이고 `X-Frame-Options`가 없습니다. 그 밖의 HTML 경로는 `frame-ancestors 'self'`와 `X-Frame-Options: DENY`를 유지합니다. Pyodide Worker와 Service Worker는 같은 출처에서 불러오므로 iframe 안에서도 동작합니다(일부 브라우저는 제3자 iframe의 Service Worker 저장을 막지만, 실행에는 영향이 없습니다).

## 4. 전체 화면

- 3D 뷰포트 오른쪽 위의 **전체 화면** 버튼이 `requestFullscreen`으로 뷰포트를 띄웁니다. 전체 화면 안에서는 아래에 실행·정지와 **전체 화면 나가기** 버튼이 나타나고, `Esc`로도 나갑니다(`client/src/hooks/useFullscreen.js`).
- iOS Safari처럼 API가 없거나 iframe이 `allow="fullscreen"` 없이 막은 경우에는 CSS 고정 배치로 화면을 채우고 `Esc`로 끕니다.
- 크기 변화는 `Viewport3D`의 `ResizeObserver`가 카메라 aspect와 렌더러 크기를 갱신합니다.

## 5. QR 공유

- 샌드박스의 **공유** 버튼은 링크를 만들어 바로 복사한 뒤, 링크·**QR 보기**·**임베드 코드 복사**·열기를 둔 대화상자를 엽니다. 갤러리 상세에도 **QR 보기**가 있습니다.
- QR은 `qrcode`(MIT) 라이브러리로 브라우저 안에서 만들며 외부 이미지 API를 쓰지 않습니다. 프로젝터에 띄우면 학생이 휴대폰 카메라로 바로 열 수 있고, **PNG 내려받기**로 인쇄용 파일을 받습니다(`client/src/components/share/QRCodeModal.jsx`).

## 배포 설정 메모

- 실제 Vercel 배포는 **저장소 루트의 `vercel.json`**을 씁니다(배포된 CSP의 `img-src … https: http:`가 루트 설정과 일치). `client/vercel.json`은 같은 재작성 예외·헤더만 맞춰 두었고, 서버리스 함수는 루트 `api/`에만 있습니다.
- `api/og.mjs`는 함수 번들에 `client/dist/index.html`을 포함하도록 `functions.includeFiles`를 둡니다. 번들에 없으면 배포 자체에서 `/index.html`을 받아 옵니다.

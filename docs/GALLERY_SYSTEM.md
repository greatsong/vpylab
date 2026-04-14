# 갤러리 시스템 설계 (Gallery System Design)

VPy Lab 학생 작품 공유 및 교사 미션 공유를 위한 갤러리 시스템 설계안입니다.

## 1. 학생 작품 갤러리

### 1.1 공유 링크 시스템 (현재)

VPy Lab은 LZ-String으로 코드를 압축하여 URL 파라미터로 공유합니다.

```
https://vpylab.pages.dev/sandbox?code=<LZ-String-compressed-code>
```

### 1.2 GitHub Pages 갤러리 (제안)

별도의 `vpylab-gallery` 리포지토리를 만들어 학생 작품을 전시합니다.

#### 구조

```
vpylab-gallery/
  index.html              # 갤러리 메인 페이지
  works/
    2026-04/
      pendulum-art.json   # 개별 작품 메타데이터
      solar-system.json
    2026-05/
      ...
  assets/
    thumbnails/            # 작품 썸네일 (자동 생성)
```

#### 작품 JSON 포맷

```json
{
  "title": {
    "ko": "진자 아트",
    "en": "Pendulum Art"
  },
  "author": "anonymous-student-42",
  "date": "2026-04-10",
  "category": "AR",
  "code": "from vpython import *\n...",
  "description": {
    "ko": "진자의 궤적으로 그린 미디어아트",
    "en": "Media art drawn by pendulum trajectory"
  },
  "tags": ["pendulum", "art", "physics"],
  "vpylabVersion": "0.1.0"
}
```

#### 제출 방법

1. **앱 내 공유 버튼** -> 자동으로 vpylab-gallery 리포지토리에 PR 생성
2. **수동 PR** -> `works/` 폴더에 JSON 파일 추가
3. 메인테이너 리뷰 후 머지 -> GitHub Pages 자동 배포

#### 개인정보 보호

- 작가명은 반드시 닉네임/익명 사용 (실명 금지)
- 학교명, 학년/반 등 개인 식별 정보 포함 금지
- 코드 내 개인정보 자동 스캔 (CI)

### 1.3 갤러리 자동화 GitHub Action

```yaml
# vpylab-gallery/.github/workflows/build-gallery.yml
name: Build Gallery
on:
  push:
    branches: [main]
    paths: ['works/**']

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Generate gallery index
        run: node scripts/build-gallery.js
      
      - name: Generate thumbnails
        run: node scripts/generate-thumbnails.js
      
      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v4
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```

---

## 2. 교사 미션 공유 시스템

### 2.1 커뮤니티 미션 리포지토리

공식 미션 외에 교사들이 만든 커뮤니티 미션을 별도 관리합니다.

#### 구조

```
vpylab/
  client/src/data/
    missions.js              # 공식 미션 (16개, 엄격한 리뷰)
    community-missions/      # 커뮤니티 미션 (교사 기여)
      index.js               # 커뮤니티 미션 로더
      physics/
        pendulum.js
        projectile.js
      music/
        ...
```

### 2.2 미션 리뷰 프로세스

```
[교사가 미션 작성]
    |
    v
[GitHub PR 제출] -- CI 자동 검증 (스키마, i18n, 보안)
    |
    v
[교육 전문가 리뷰] -- starterCode 적절성, 난이도, 교육과정 연계
    |
    v
[코드 리뷰] -- solutionCode 실행 가능성, assertions 검증
    |
    v
[머지] -- 커뮤니티 미션 또는 공식 미션으로 승격
```

### 2.3 미션 승격 기준

커뮤니티 미션이 공식 미션으로 승격되는 기준:

- GitHub Discussions에서 10개 이상의 좋아요
- 2명 이상의 교사가 실제 수업에서 사용 후 피드백 제공
- 완벽한 i18n (최소 ko/en)
- 교육과정 연계 문서 포함

---

## 3. GitHub Discussions 활용

### 카테고리 구성

| 카테고리 | 용도 | 아이콘 |
|---------|------|--------|
| Announcements | 공지사항 (메인테이너만 작성) | megaphone |
| Mission Ideas | 미션 아이디어 제안/토론 | light-bulb |
| Teaching Tips | 수업 활용 팁 공유 | mortar-board |
| Show & Tell | 학생 작품, 수업 사례 공유 | star |
| Q&A | 사용법 질문 | question |
| Bug Reports | 간단한 문제 제보 (복잡하면 Issue로) | bug |
| i18n Coordination | 번역 조율, 용어 통일 | globe |

### 토론 템플릿

#### Mission Ideas 카테고리

```markdown
## 미션 아이디어

**카테고리**: CT / CR / MA / SC / AR / SN / AI
**난이도**: Lv.1~4
**대상 학년**: 

### 아이디어 설명

(학생이 무엇을 배우고 만들게 되나요?)

### 관련 교육과정

(어떤 교과/단원과 연결되나요?)

### 참고 자료

(관련 링크, 논문, 교과서 등)
```

#### Teaching Tips 카테고리

```markdown
## 수업 활용 팁

**사용 미션**: (미션 ID)
**학년/과목**: 
**수업 시간**: (예: 50분 x 2차시)

### 수업 운영 방법

(어떻게 수업에 활용했나요?)

### 학생 반응

(학생들의 반응은 어땠나요?)

### 개선점

(다음에 다시 한다면 바꾸고 싶은 점)
```

---

## 4. 구현 우선순위

### Phase 1 (현재 ~ v0.2)
- [x] CONTRIBUTING.md, Issue/PR 템플릿
- [x] CI: 미션 데이터 검증, i18n 검증
- [ ] GitHub Discussions 카테고리 설정

### Phase 2 (v0.2 ~ v0.3)
- [ ] 커뮤니티 미션 폴더 구조
- [ ] 미션 리뷰 워크플로우 자동화
- [ ] Crowdin 연동 (번역 플랫폼)

### Phase 3 (v0.3 ~ v0.5)
- [ ] vpylab-gallery 리포지토리 생성
- [ ] 앱 내 갤러리 제출 기능
- [ ] 썸네일 자동 생성

### Phase 4 (v0.5+)
- [ ] 교사 대시보드에서 커뮤니티 미션 검색/설치
- [ ] 미션 인기도/평점 시스템
- [ ] 교사 인증 배지 시스템

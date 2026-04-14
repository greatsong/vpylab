# 다국어(i18n) 기여 가이드

VPy Lab의 다국어 지원 구조와 새 언어 추가 방법을 설명합니다.

## 현재 지원 언어

| 언어 | 코드 | UI | 미션 | 상태 |
|------|------|----|----|------|
| 한국어 | ko | 완료 | 완료 | 기본 언어 |
| English | en | 완료 | 완료 | 완료 |

## 아키텍처

### UI 텍스트

```
client/src/i18n/
  index.jsx       # I18nProvider, useI18n hook
  ko.json         # 한국어 (기준 파일)
  en.json         # 영어
  ja.json         # 새 언어 파일 예시
```

- JSON 키-값 구조, 중첩 지원
- `useI18n()` hook의 `t('key.path')` 함수로 접근
- fallback 순서: 선택 언어 -> 영어 -> 키 이름

### 미션 텍스트

미션 데이터(`missions.js`) 내에 직접 다국어 텍스트를 포함합니다:

```javascript
title: { ko: '...', en: '...', ja: '...' },
description: { ko: '...', en: '...', ja: '...' },
hints: [
  { ko: '...', en: '...', ja: '...' },
],
```

## 새 언어 추가 절차

### Step 1: UI 번역 파일 생성

```bash
# en.json을 기준으로 복사
cp client/src/i18n/en.json client/src/i18n/ja.json
```

`ja.json`의 모든 값(value)을 일본어로 번역합니다.
키(key)는 변경하지 않습니다.

### Step 2: i18n 모듈에 등록

`client/src/i18n/index.jsx`에 import를 추가합니다:

```javascript
import ko from './ko.json';
import en from './en.json';
import ja from './ja.json';   // 추가

const messages = { ko, en, ja };  // 추가
```

### Step 3: 미션 텍스트 번역

`client/src/data/missions.js`의 각 미션에 새 언어 키를 추가합니다:

```javascript
title: {
  ko: '첫 번째 구',
  en: 'Your First Sphere',
  ja: '最初の球',           // 추가
},
```

### Step 4: PR 제출

브랜치: `i18n/add-japanese`
커밋 메시지: `i18n: add Japanese translation`

## 번역 규칙

### 번역하지 않는 것

- 프로그래밍 키워드: `sphere`, `box`, `vector`, `color`, `rate`
- VPy Lab API: `from vpython import *`
- 함수명: `sphere()`, `cylinder()`, `math.sin()`
- 변수명: `ball`, `v`, `dt`, `g`

### 번역하는 것

- UI 텍스트 (버튼, 메뉴, 안내 문구)
- 미션 제목, 설명, 힌트
- 코드 내 주석 (`# 여기에 코드를 작성하세요`)
- 에러 메시지, 콘솔 출력 안내

### 한국어 특수 함수명 처리

VPy Lab은 한국어 함수명도 지원합니다 (Python alias):

| 한국어 | 영어 | 설명 |
|--------|------|------|
| 음표() | play_note() | 음표 재생 |
| 효과음() | sfx() | 효과음 재생 |
| 배경음악() | bgm() | BGM 재생 |
| 화음() | chord() | 화음 재생 |

다른 언어 번역 시, 코드 내 한국어 함수명은 영어 함수명과 병기합니다:

```python
# 음표("솔4", 0.4)  또는  play_note("G4", 0.4)
play_note("G4", 0.4)
```

## CI 자동 검증

PR 제출 시 자동으로 다음을 검사합니다:

1. **키 완전성**: en.json 대비 누락 키 검출
2. **미션 i18n**: 모든 미션의 title/description/hints에 필수 언어(ko, en) 존재
3. **커버리지 리포트**: PR 코멘트로 번역 진행률 표시

## Crowdin 연동 (계획)

Phase 2에서 Crowdin 또는 Weblate 연동을 계획하고 있습니다:

1. `en.json`을 소스 파일로 설정
2. 번역자가 Crowdin 웹 에디터에서 번역
3. GitHub Action이 번역 결과를 자동으로 PR 생성
4. 리뷰 후 머지

이 방식은 비개발자(교사, 학부모)도 번역에 쉽게 참여할 수 있게 합니다.

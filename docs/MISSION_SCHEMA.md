# 미션 스키마 (Mission Schema)

VPy Lab 미션의 데이터 구조와 작성 규칙을 정의합니다.

## 전체 스키마

```javascript
{
  // === 필수 필드 ===
  id: string,            // 카테고리-번호 (예: 'CT-3', 'SC-5')
  category: string,      // 'CT'|'CR'|'MA'|'SC'|'AR'|'SN'|'AI'
  level: number,         // 1~4
  title: {
    ko: string,          // 한국어 제목 (필수)
    en: string,          // 영어 제목 (필수)
    // 추가 언어 선택
  },
  description: {
    ko: string,          // 한국어 설명 (필수)
    en: string,          // 영어 설명 (필수)
  },
  gradeType: string,     // 'A'|'B'|'A+B'
  starterCode: string,   // 학생 시작 코드
  solutionCode: string,  // 모범 답안 (교사 전용)
  assertions: Array,     // A등급 채점 조건 (SN 카테고리는 빈 배열 허용)
  hints: Array,          // 단계별 힌트 [{ko, en}, ...]

  // === 조건부 필수 ===
  referenceTrajectory: Array,  // B등급 미션 전용: 좌표 배열 [[x,y,z], ...]
}
```

## 필드 상세

### id

- 형식: `<CATEGORY>-<NUMBER>` (예: `CT-1`, `SC-3`)
- 카테고리 약자 + 하이픈 + 순번
- 기존 미션과 **중복 불가** (CI에서 자동 검증)

### category

| 값 | 의미 | 설명 |
|----|------|------|
| CT | Computational Thinking | 기초 프로그래밍 개념 |
| CR | Creative | 자유로운 3D 모델링, 창작 |
| MA | Mathematics | 수학 개념의 시각적 탐구 |
| SC | Science | 물리/화학/생물 시뮬레이션 |
| AR | Art | 미디어아트, 생성 예술 |
| SN | Sound | 음악, 효과음 프로그래밍 |
| AI | AI Principles | 기초 AI/ML 개념 |

### level

| 값 | 이름 | 학생 활동 | 교사 가이드 |
|----|------|-----------|------------|
| 1 | 따라하기 (Follow) | 주석 해제, 빈칸 채우기 | 개념 설명 후 코드 따라하기 |
| 2 | 변형하기 (Modify) | 기존 코드 수정/확장 | 파라미터 변경 실험 |
| 3 | 설계하기 (Design) | 요구사항 기반 설계 | 알고리즘 설계 토론 |
| 4 | 창작하기 (Create) | 자유 주제 프로젝트 | 피드백 및 발표 지원 |

### gradeType

| 값 | 채점 방식 | 사용 상황 |
|----|-----------|-----------|
| A | 정적 검사 | 오브젝트 속성(위치, 색상, 크기) 확인 |
| B | 궤적 비교 | 애니메이션 경로 비교 |
| A+B | 복합 | 정적 검사 + 궤적 비교 |

### assertions (A등급)

```javascript
assertions: [
  {
    type: string,        // 'sphere'|'box'|'cylinder'|'arrow'|'ring' 등
    property: string,    // 'color.r'|'pos.x'|'radius' 등
    operator: string,    // '=='|'!='|'>'|'>='|'<'|'<='
    value: number,       // 기대값
    index?: number,      // 같은 타입의 몇 번째 객체 (0부터, 선택)
  }
]
```

### referenceTrajectory (B등급)

```javascript
// 좌표 배열: [[x, y, z], [x, y, z], ...]
// IIFE로 계산하여 정의 가능
referenceTrajectory: (() => {
  const t = [];
  // 물리 시뮬레이션 계산
  return t;
})(),
```

### hints

```javascript
hints: [
  {
    ko: '첫 번째 힌트 (한국어)',
    en: 'First hint (English)',
    // 추가 언어 선택
  },
  // 최소 1개, 권장 2~3개
  // 점진적으로 구체적인 힌트 제공
]
```

### starterCode / solutionCode

- Python 코드 문자열 (backtick template literal 사용)
- `from vpython import *`로 시작
- starterCode: 학생이 채울 부분을 주석으로 표시
  - `# 여기에 코드를 작성하세요` 또는
  - `# Write your code here`
- solutionCode: 실제 실행 가능한 완성 코드
- 한글 함수명 지원: `음표()`, `효과음()`, `배경음악()` 등

## 미션 추가 예시

```javascript
{
  id: 'SC-3',
  category: 'SC',
  level: 2,
  title: {
    ko: '진자 운동',
    en: 'Pendulum Motion',
  },
  description: {
    ko: '중력에 의한 진자 운동을 시뮬레이션하세요.',
    en: 'Simulate pendulum motion under gravity.',
  },
  gradeType: 'A+B',
  starterCode: `from vpython import *
import math

# 진자 막대
L = 5  # 줄의 길이
theta = math.radians(30)  # 초기 각도

pivot = vector(0, 0, 0)
ball = sphere(pos=vector(L*math.sin(theta), -L*math.cos(theta), 0),
              radius=0.3, color=color.red)
rod = cylinder(pos=pivot, axis=ball.pos - pivot, radius=0.05)

omega = 0  # 각속도
dt = 0.01
g = 9.8

# 여기에 애니메이션 루프를 작성하세요
# while True:
#     rate(100)
#     ...
`,
  solutionCode: `from vpython import *
import math

L = 5
theta = math.radians(30)

pivot = vector(0, 0, 0)
ball = sphere(pos=vector(L*math.sin(theta), -L*math.cos(theta), 0),
              radius=0.3, color=color.red)
rod = cylinder(pos=pivot, axis=ball.pos - pivot, radius=0.05)

omega = 0
dt = 0.01
g = 9.8

while True:
    rate(100)
    alpha = -(g / L) * math.sin(theta)
    omega += alpha * dt
    theta += omega * dt
    ball.pos = vector(L*math.sin(theta), -L*math.cos(theta), 0)
    rod.axis = ball.pos - pivot
`,
  assertions: [
    { type: 'sphere', property: 'pos.y', operator: '<', value: 0 },
    { type: 'cylinder', property: 'pos.x', operator: '==', value: 0, index: 0 },
  ],
  referenceTrajectory: (() => {
    const t = [];
    let theta = Math.PI / 6, omega = 0;
    const L = 5, g = 9.8, dt = 0.01;
    for (let i = 0; i < 500; i++) {
      const alpha = -(g / L) * Math.sin(theta);
      omega += alpha * dt;
      theta += omega * dt;
      t.push([L * Math.sin(theta), -L * Math.cos(theta), 0]);
    }
    return t;
  })(),
  hints: [
    { ko: 'while True: 루프 안에서 rate(100)을 호출하세요.', en: 'Call rate(100) inside the while loop.' },
    { ko: '각가속도: alpha = -(g/L) * sin(theta)', en: 'Angular acceleration: alpha = -(g/L) * sin(theta)' },
    { ko: 'ball.pos를 매 프레임 업데이트하세요.', en: 'Update ball.pos every frame.' },
  ],
}
```

## 검증 규칙

CI에서 자동 검증되는 항목:

1. 모든 미션에 필수 필드 10개 존재
2. `id` 고유성
3. `category`가 유효한 값
4. `level`이 1~4 범위
5. `gradeType`이 A, B, A+B 중 하나
6. `title`, `description`에 `ko`, `en` 키 존재
7. `hints` 배열에 1개 이상의 항목
8. `hints` 각 항목에 `ko`, `en` 키 존재
9. `assertions` 배열 존재 (SN 카테고리는 빈 배열 허용)
10. B등급 미션에 `referenceTrajectory` 존재

/**
 * 입문 학생용 구문·패턴 스니펫
 *
 * 파이썬 기본 구문과 VPyLab에서 자주 쓰는 한 줄 패턴을 탭 정지가 있는 스니펫으로 제공한다.
 * 이 목록은 원본 API에서 뽑을 수 없는 "쓰는 법"이라 손으로 적는다.
 * 자주 쓰는 순서대로 적어 두면 그 순서가 제안 목록의 순서가 된다(sortText).
 *
 * 각 항목:
 *   label       제안 목록에 보이는 코드 한 줄
 *   korean      라벨 옆에 보이는 한글 설명
 *   aliases     한글 접두 검색어 (filterText에 함께 들어간다: "반복" → for/while)
 *   insertText  Monaco 스니펫 ($1, ${1:기본값}, $0)
 *   documentation 한 줄 설명
 */
export const STARTER_SNIPPETS = [
  // ── 파이썬 기본 구문 ──
  {
    label: 'from vpython import *',
    korean: '시작',
    aliases: ['시작', '불러오기'],
    insertText: 'from vpython import *\n$0',
    documentation: '프로그램 첫 줄. VPyLab의 모든 이름을 불러옵니다.',
  },
  {
    label: 'for i in range(10):',
    korean: '횟수 반복',
    aliases: ['반복', '횟수'],
    insertText: 'for ${1:i} in range(${2:10}):\n    ${3:pass}',
    documentation: '정해진 횟수만큼 반복합니다. Tab으로 변수 이름, 횟수, 본문 자리로 옮겨 갑니다.',
  },
  {
    label: 'while True:',
    korean: '계속 반복',
    aliases: ['반복', '계속', '무한'],
    insertText: 'while True:\n    rate(${1:60})\n    $0',
    documentation: '멈출 때까지 계속 반복합니다. rate(60)이 한 바퀴 속도를 정합니다.',
  },
  {
    label: 'if 조건:',
    korean: '조건',
    aliases: ['조건', '만약'],
    insertText: 'if ${1:조건}:\n    ${2:pass}',
    documentation: '조건이 참일 때만 본문을 실행합니다.',
  },
  {
    label: 'elif 조건:',
    korean: '또 다른 조건',
    aliases: ['조건', '아니면'],
    insertText: 'elif ${1:조건}:\n    ${2:pass}',
    documentation: '앞의 if가 거짓일 때 다른 조건을 검사합니다.',
  },
  {
    label: 'else:',
    korean: '나머지 경우',
    aliases: ['조건', '아니면'],
    insertText: 'else:\n    ${1:pass}',
    documentation: '앞의 조건이 모두 거짓일 때 실행합니다.',
  },
  {
    label: 'import random',
    korean: '무작위 모듈',
    aliases: ['무작위', '랜덤'],
    insertText: 'import random\n$0',
    documentation: '무작위 수를 만드는 random 모듈을 불러옵니다.',
  },
  {
    label: 'x = random.uniform(-5, 5)',
    korean: '무작위 실수',
    aliases: ['무작위', '랜덤'],
    insertText: '${1:x} = random.uniform(${2:-5}, ${3:5})',
    documentation: '두 수 사이의 무작위 실수를 만듭니다. 먼저 import random이 필요합니다.',
  },
  {
    label: '리스트 = []',
    korean: '빈 리스트',
    aliases: ['리스트', '목록'],
    insertText: '${1:리스트} = []',
    documentation: '빈 리스트를 만듭니다. 나중에 append로 값을 넣습니다.',
  },
  {
    label: '리스트.append(값)',
    korean: '리스트에 추가',
    aliases: ['리스트', '목록', '추가'],
    insertText: '${1:리스트}.append(${2:값})',
    documentation: '리스트 끝에 값을 하나 넣습니다.',
  },

  // ── VPyLab 자주 쓰는 한 줄 패턴 ──
  {
    label: "공 = sphere(pos=vector(0, 0, 0), radius=0.5, color=색상['빨강'])",
    korean: '공 만들기',
    aliases: ['공', '구', '만들기'],
    insertText: "${1:공} = sphere(pos=vector(${2:0}, ${3:0}, ${4:0}), radius=${5:0.5}, color=색상['${6:빨강}'])",
    documentation: '공을 만들어 변수에 담습니다. 위치, 반지름, 색을 Tab으로 바꿉니다.',
  },
  {
    label: "box(pos=vector(0, 0, 0), size=vector(1, 1, 1), color=색상['하늘'])",
    korean: '상자 만들기',
    aliases: ['상자', '박스', '만들기'],
    insertText: "${1:상자} = box(pos=vector(${2:0}, ${3:0}, ${4:0}), size=vector(${5:1}, ${6:1}, ${7:1}), color=색상['${8:하늘}'])",
    documentation: '상자를 만듭니다. size가 가로·세로·깊이입니다.',
  },
  {
    label: "local_light(pos=vector(2, 2, 2), color=색상['빨강'], intensity=50)",
    korean: '빛 만들기',
    aliases: ['빛', '조명', '만들기'],
    insertText: "${1:빛} = local_light(pos=vector(${2:2}, ${3:2}, ${4:2}), color=색상['${5:빨강}'], intensity=${6:50})",
    documentation: '한 점에서 퍼지는 빛을 만듭니다. 기본 조명을 끄려면 scene.lights = [] 를 먼저 씁니다.',
  },
  {
    label: 'scene.lights = []',
    korean: '기본 조명 끄기',
    aliases: ['빛', '조명', '끄기'],
    insertText: 'scene.lights = []',
    documentation: '기본 조명을 모두 끕니다. 그다음 local_light로 내 빛을 만듭니다.',
  },
  {
    label: 'scene.range = 4',
    korean: '화면 범위',
    aliases: ['화면', '범위', '카메라'],
    insertText: 'scene.range = ${1:4}',
    documentation: '화면에 보이는 범위를 정합니다. 숫자가 작을수록 가까이 보입니다.',
  },
  {
    label: 'scene_background(색상[\'검정\'])',
    korean: '배경색',
    aliases: ['배경', '화면'],
    insertText: "scene_background(색상['${1:검정}'])",
    documentation: '화면 배경색을 바꿉니다.',
  },
  {
    label: '음표("도", 0.3)',
    korean: '음 연주',
    aliases: ['소리', '음', '연주'],
    insertText: '음표("${1:도}", ${2:0.3})',
    documentation: '음 하나를 연주합니다. 둘째 값이 길이(초)입니다.',
  },
  {
    label: '효과음("coin")',
    korean: '효과음',
    aliases: ['소리', '효과'],
    insertText: '효과음("${1:coin}")',
    documentation: '게임 효과음을 냅니다. 따옴표 안에서 이름을 고를 수 있습니다.',
  },
  {
    label: '배경음악("adventure")',
    korean: '배경음악',
    aliases: ['소리', '음악'],
    insertText: '배경음악("${1:adventure}")',
    documentation: '배경음악을 반복 재생합니다. 배경음악정지()로 멈춥니다.',
  },
  {
    label: 'sleep(0.5)',
    korean: '기다리기',
    aliases: ['기다리기', '잠시', '멈춤'],
    insertText: 'sleep(${1:0.5})',
    documentation: '정한 시간(초)만큼 기다립니다.',
  },
];

/**
 * API 이름의 한글 접두 검색어. "공" → sphere, "빛" → local_light.
 * filterText에 함께 넣어 한글로 쳐도 찾히게 한다.
 */
export const KOREAN_SEARCH_ALIASES = {
  sphere: ['공', '구'],
  box: ['상자', '박스'],
  cylinder: ['원기둥'],
  cone: ['원뿔'],
  ring: ['고리', '반지'],
  arrow: ['화살표'],
  pyramid: ['피라미드'],
  helix: ['스프링', '나선'],
  label: ['글자', '글씨'],
  text: ['글자', '글씨'],
  curve: ['곡선', '선'],
  vector: ['벡터'],
  local_light: ['빛', '조명'],
  distant_light: ['빛', '조명'],
  scene: ['화면', '장면'],
  scene_background: ['배경'],
  rate: ['속도', '반복'],
  sleep: ['기다리기', '잠시'],
  음표: ['소리', '음'],
  효과음: ['소리'],
  배경음악: ['소리', '음악'],
  배경음악정지: ['소리', '음악', '정지'],
  소리: ['소리'],
  화음: ['소리'],
  악기: ['소리'],
  색상: ['색', '색깔'],
  무지개: ['색', '색깔'],
  파스텔: ['색', '색깔'],
};

/**
 * 입문 수업에서 실제로 쓰는 파이썬 내장 함수만 (표준 라이브러리 전체는 넣지 않는다).
 * input은 vpython-api.py가 화면 입력창으로 다시 정의하므로 API 항목에서 온다.
 */
export const PYTHON_BUILTINS = [
  { name: 'range', args: '${1:10}', aliases: ['범위', '반복'], documentation: 'range(10)은 0부터 9까지, range(1, 11)은 1부터 10까지의 수를 차례로 냅니다.' },
  { name: 'len', args: '${1:리스트}', aliases: ['길이', '개수'], documentation: '리스트나 문자열의 길이(개수)를 돌려줍니다.' },
  { name: 'print', args: '${1:값}', aliases: ['출력', '인쇄'], documentation: '값을 콘솔에 출력합니다.' },
  { name: 'int', args: '${1:값}', aliases: ['정수'], documentation: '정수로 바꿉니다. int("3") → 3, int(3.7) → 3' },
  { name: 'float', args: '${1:값}', aliases: ['실수'], documentation: '실수로 바꿉니다. float("2.5") → 2.5' },
  { name: 'str', args: '${1:값}', aliases: ['문자열', '글자'], documentation: '문자열로 바꿉니다. str(3) → "3"' },
  { name: 'abs', args: '${1:x}', aliases: ['절댓값'], documentation: '절댓값을 돌려줍니다. abs(-3) → 3' },
  { name: 'round', args: '${1:x}, ${2:2}', aliases: ['반올림'], documentation: '반올림합니다. round(3.14159, 2) → 3.14' },
  { name: 'min', args: '${1:a}, ${2:b}', aliases: ['최소'], documentation: '가장 작은 값을 돌려줍니다. 리스트를 넣어도 됩니다.' },
  { name: 'max', args: '${1:a}, ${2:b}', aliases: ['최대'], documentation: '가장 큰 값을 돌려줍니다. 리스트를 넣어도 됩니다.' },
  { name: 'sum', args: '${1:리스트}', aliases: ['합계', '합'], documentation: '리스트 값을 모두 더합니다.' },
];

/** from vpython import * 로 함께 들어오는 math 이름 중 입문 수업에서 쓰는 것 */
export const MATH_NAMES = [
  { name: 'sin', args: '${1:x}', aliases: ['사인'], documentation: '사인값. 각도는 라디안입니다(radians(도)로 바꿀 수 있음).' },
  { name: 'cos', args: '${1:x}', aliases: ['코사인'], documentation: '코사인값. 각도는 라디안입니다.' },
  { name: 'sqrt', args: '${1:x}', aliases: ['제곱근', '루트'], documentation: '제곱근. sqrt(16) → 4.0' },
  { name: 'pi', args: null, aliases: ['원주율', '파이'], documentation: '원주율 3.14159…' },
];

/** random. 뒤에서만 제안한다. import random 이 없으면 설명에 안내를 붙인다 */
export const RANDOM_MEMBERS = [
  { name: 'randint', args: '${1:1}, ${2:6}', aliases: ['정수', '무작위'], documentation: 'a 이상 b 이하의 무작위 정수. random.randint(1, 6) → 주사위' },
  { name: 'uniform', args: '${1:-5}, ${2:5}', aliases: ['실수', '무작위'], documentation: 'a 이상 b 이하의 무작위 실수.' },
  { name: 'choice', args: '${1:리스트}', aliases: ['고르기', '무작위'], documentation: '리스트에서 하나를 무작위로 고릅니다.' },
  { name: 'random', args: '', aliases: ['무작위'], documentation: '0 이상 1 미만의 무작위 실수.' },
  { name: 'shuffle', args: '${1:리스트}', aliases: ['섞기', '무작위'], documentation: '리스트 순서를 무작위로 섞습니다(리스트 자체가 바뀜).' },
];
export const IMPORT_RANDOM_HINT = '맨 위에 import random 필요';

/** 리스트 메서드. 변수 뒤 점(.)에서 객체 속성 다음에 보인다. 문자열 메서드는 넣지 않는다 */
export const LIST_METHODS = [
  { name: 'append', args: '${1:값}', aliases: ['추가', '리스트'], documentation: '리스트 끝에 값을 넣습니다.' },
  { name: 'pop', args: '', aliases: ['꺼내기', '리스트'], documentation: '리스트 마지막 값을 꺼내며 지웁니다. pop(0)은 첫 값.' },
  { name: 'index', args: '${1:값}', aliases: ['위치', '리스트'], documentation: '값이 리스트의 몇 번째에 있는지 돌려줍니다.' },
];

/** 입문 수업에서 쓰는 키워드 */
export const PYTHON_KEYWORDS = [
  { name: 'True', aliases: ['참'], documentation: '참' },
  { name: 'False', aliases: ['거짓'], documentation: '거짓' },
  { name: 'and', aliases: ['그리고'], documentation: '둘 다 참일 때 참' },
  { name: 'or', aliases: ['또는'], documentation: '하나라도 참이면 참' },
  { name: 'not', aliases: ['아님', '반대'], documentation: '참·거짓을 뒤집음' },
  { name: 'in', aliases: ['포함', '안에'], documentation: '값이 리스트 안에 있는지. for i in range(10): 에도 쓰임' },
  { name: 'break', aliases: ['멈춤', '반복'], documentation: '반복문을 바로 빠져나감' },
];

import { useState, useEffect } from 'react';
import { useI18n } from '../../i18n';

// 카테고리: vpython 기능 팁
const TIPS_VPYTHON_KO = [
  '💡 sphere()로 구를, box()로 상자를, cylinder()로 원기둥을 만들어요',
  '💡 rate(100)은 초당 100번 화면을 갱신해요',
  '💡 vector(1, 2, 3)으로 3D 좌표를 표현해요',
  '💡 color.red, color.cyan 등으로 색상을 지정해요',
  '💡 while True: 루프 안에서 물체를 움직일 수 있어요',
  '💡 ball.velocity를 사용해서 속도를 제어해보세요',
  '💡 중력은 ball.velocity.y -= 9.8 * dt 로 구현해요',
  '💡 box(size=vector(2, 0.1, 2))로 바닥을 만들어보세요',
  '💡 arrow()로 힘이나 속도의 방향을 시각화할 수 있어요',
  '💡 cone()으로 원뿔을, ring()으로 링을 만들어보세요',
  '💡 물체의 .pos를 바꾸면 위치가 이동해요',
  '💡 .color = color.green 으로 물체 색을 바꿀 수 있어요',
  '💡 .radius로 구의 크기를, .size로 상자 크기를 조절해요',
  '💡 play_note("C4")로 피아노 소리도 낼 수 있어요',
  '💡 mag(v)는 벡터의 크기, hat(v)는 단위벡터를 구해요',
  '💡 dot(a, b)는 내적, cross(a, b)는 외적을 계산해요',
  '💡 scene_background("black")으로 배경색을 바꿔보세요',
  '💡 compound()로 여러 물체를 하나로 묶을 수 있어요',
  '💡 distant_light()로 태양광 같은 조명을 추가해보세요',
  '💡 sleep(0.5)로 0.5초 동안 멈출 수 있어요',
];

// 카테고리: 교육적 조언
const TIPS_ADVICE_KO = [
  '📝 에러 메시지를 꼼꼼히 읽으면 해결의 실마리가 보여요',
  '📝 코드를 한 줄씩 바꿔보며 결과를 관찰하면 이해가 빨라져요',
  '📝 처음부터 완벽한 코드를 쓰려고 하지 마세요. 실행하고, 고치고, 반복!',
  '📝 변수 이름을 잘 짓는 것만으로도 코드가 훨씬 읽기 쉬워져요',
  '📝 복잡한 문제는 작은 조각으로 나눠서 하나씩 해결해보세요',
  '📝 다른 사람의 코드를 읽는 것도 훌륭한 학습 방법이에요',
  '📝 print()를 사용해 중간 값을 확인하면 디버깅이 쉬워져요',
  '📝 시뮬레이션에서 숫자를 바꿔보면 물리 법칙을 체감할 수 있어요',
  '📝 실패는 배움의 시작이에요. 에러를 두려워하지 마세요!',
  '📝 코딩은 생각을 표현하는 또 하나의 언어예요',
];

// 카테고리: 영감을 주는 명언 (한영 병기)
const TIPS_QUOTES_KO = [
  '✨ "상상력은 지식보다 중요하다" "Imagination is more important than knowledge" — 알베르트 아인슈타인(Albert Einstein)',
  '✨ "실수한 적 없는 사람은 새로운 것을 시도한 적 없는 사람이다" "A person who never made a mistake never tried anything new" — 알베르트 아인슈타인(Albert Einstein)',
  '✨ "가장 좋은 학습 방법은 직접 만들어 보는 것이다" "The best way to learn is to build" — 시모어 패퍼트(Seymour Papert)',
  '✨ "창의성은 연결하는 능력이다" "Creativity is just connecting things" — 스티브 잡스(Steve Jobs)',
  '✨ "모든 전문가도 처음엔 초보자였다" "Every expert was once a beginner" — 헬렌 헤이즈(Helen Hayes)',
  '✨ "천 리 길도 한 걸음부터" "A journey of a thousand miles begins with a single step" — 노자(Lao Tzu)',
  '✨ "모든 사람이 코딩을 배워야 한다. 생각하는 법을 가르쳐주니까" "Everybody should learn to code. It teaches you how to think" — 스티브 잡스(Steve Jobs)',
  '✨ "코드는 시처럼 아름다울 수 있다" "Code can be beautiful, just like poetry" — 도널드 크누스(Donald Knuth)',
  '✨ "컴퓨터가 강력한 이유는 질문할 수 있기 때문이다" "Computers are powerful because you can ask questions" — 할 에이벌슨(Hal Abelson)',
  '✨ "깊이 파고들면 수학이 나온다" "Dig deep into anything and you\'ll find math" — 미야모토 시게루(Shigeru Miyamoto)',
];

// 카테고리: 재미있는 사실
const TIPS_FUN_KO = [
  '🎮 1947년에 진짜 나방이 컴퓨터에 끼었어요. "버그"라는 말이 여기서 유명해졌죠!',
  '🎮 파이썬(Python)은 뱀이 아니라 영국 코미디 쇼 "몬티 파이썬"에서 이름을 따왔어요',
  '🎮 NASA는 제임스 웹 우주 망원경 데이터를 파이썬으로 분석해요',
  '🎮 Minecraft의 원래 이름은 "Cave Game"이었어요. 일주일도 안 돼서 바뀌었죠',
  '🎮 세계 최초의 프로그래머는 1840년대의 에이다 러브레이스(Ada Lovelace)예요',
  '🎮 1980년에 1GB 저장장치는 냉장고만큼 크고 무게가 455kg이었어요',
  '🎮 여러분의 스마트폰은 아폴로 11호의 컴퓨터보다 수백만 배 빨라요',
  '🎮 구글의 첫 서버 케이스는 레고 블록으로 만들었어요. 지금도 전시 중!',
  '🎮 유튜브의 첫 영상 "Me at the zoo"는 동물원에서 찍은 19초짜리예요',
  '🎮 이모지(emoji)는 일본어 絵(그림) + 文字(문자)에서 온 말이에요',
  '🎮 팀 버너스리가 만든 세계 최초의 웹사이트(1991년)는 아직도 접속할 수 있어요',
  '🎮 Wi-Fi는 약자가 아니에요. "Hi-Fi"처럼 기억하기 좋은 이름으로 지은 거예요',
  '🎮 하루에 전 세계에서 약 5억 개의 트윗이 올라와요. 초당 약 6,000개!',
  '🎮 최초의 마우스(1964년)는 나무로 만들었어요. 선이 꼬리처럼 생겨서 "마우스"!',
  '🎮 "Hello, World!"는 1972년부터 프로그래머의 첫 코드 전통이 되었어요',
  '🎮 로블록스 창작자의 75%가 24세 미만이에요. 10대 개발자도 아주 많아요',
  '🎮 우주정거장(ISS)에서도 Astro Pi 프로젝트로 파이썬 코드를 돌려요',
  '🎮 QR코드는 도요타 자동차 부품을 추적하려고 1994년에 만들어졌어요',
  '🎮 세상에는 수천 개의 프로그래밍 언어가 있지만, 널리 쓰이는 건 약 50개예요',
  '🎮 인터넷 해저 케이블의 총 길이는 지구를 35바퀴 이상 감을 수 있어요',
];

const ALL_TIPS_KO = [
  ...TIPS_VPYTHON_KO,

  ...TIPS_ADVICE_KO,
  ...TIPS_QUOTES_KO,
  ...TIPS_FUN_KO,
];

// --- English ---
const TIPS_VPYTHON_EN = [
  '💡 Use sphere(), box(), and cylinder() to create 3D shapes',
  '💡 rate(100) updates the screen 100 times per second',
  '💡 Use vector(1, 2, 3) to represent 3D coordinates',
  '💡 Set colors with color.red, color.cyan, etc.',
  '💡 Move objects inside a while True: loop',
  '💡 Use ball.velocity to control speed',
  '💡 Simulate gravity with ball.velocity.y -= 9.8 * dt',
  '💡 Make a floor with box(size=vector(2, 0.1, 2))',
  '💡 Use arrow() to visualize forces and velocity',
  '💡 Create cones with cone() and rings with ring()',
  '💡 Change .pos to move an object to a new position',
  '💡 Set .color = color.green to change an object\'s color',
  '💡 Use .radius for spheres and .size for boxes to resize',
  '💡 Play piano sounds with play_note("C4")',
  '💡 mag(v) gives vector length, hat(v) gives unit vector',
  '💡 dot(a, b) computes dot product, cross(a, b) cross product',
  '💡 Change background with scene_background("black")',
  '💡 Group objects together with compound()',
  '💡 Add sunlight-like lighting with distant_light()',
  '💡 Use sleep(0.5) to pause for half a second',
];

const TIPS_ADVICE_EN = [
  '📝 Read error messages carefully — they contain clues to the solution',
  '📝 Change one line at a time and observe the result to learn faster',
  "📝 Don't aim for perfect code from the start. Run, fix, repeat!",
  '📝 Good variable names make code much easier to read',
  '📝 Break complex problems into small pieces and solve them one by one',
  '📝 Reading other people\'s code is a great way to learn',
  '📝 Use print() to check intermediate values for easier debugging',
  '📝 Tweak numbers in simulations to feel the physics laws in action',
  "📝 Failure is the beginning of learning. Don't be afraid of errors!",
  '📝 Coding is another language for expressing your thoughts',
];

const TIPS_QUOTES_EN = [
  '✨ "Imagination is more important than knowledge" — Albert Einstein',
  '✨ "A person who never made a mistake never tried anything new" — Albert Einstein',
  '✨ "The best way to learn is to build" — Seymour Papert',
  '✨ "Creativity is just connecting things" — Steve Jobs',
  '✨ "Every expert was once a beginner" — Helen Hayes',
  '✨ "A journey of a thousand miles begins with a single step" — Lao Tzu',
  '✨ "Everybody should learn to code. It teaches you how to think" — Steve Jobs',
  '✨ "Code can be beautiful, just like poetry" — Donald Knuth',
  '✨ "Computers are powerful because you can ask questions" — Hal Abelson',
  '✨ "Dig deep into anything and you\'ll find math" — Shigeru Miyamoto',
];

const TIPS_FUN_EN = [
  '🎮 In 1947, a real moth got stuck in a computer — that\'s how we got the word "bug"!',
  '🎮 Python is named after a British comedy show, not the snake',
  '🎮 NASA uses Python to analyze space data',
  '🎮 Minecraft was originally called "Cave Game"',
  '🎮 The first programmer was Ada Lovelace, a woman, in the 1840s',
  '🎮 In 1980, a 1GB storage device was as big as a refrigerator',
  '🎮 Your phone is millions of times faster than the computer that landed on the moon',
  '🎮 Google\'s first server was housed in a case made of LEGO bricks',
  '🎮 YouTube\'s first video was a 19-second clip filmed at a zoo',
  '🎮 Emoji was invented in Japan — it means "picture character"',
  '🎮 The world\'s first website (1991) is still online today',
  '🎮 Wi-Fi isn\'t actually an acronym — it\'s just a catchy brand name',
  '🎮 About 500 million tweets are posted worldwide every day',
  '🎮 The first computer mouse was made of wood (1964)',
  '🎮 "Hello, World!" has been the first program since 1972',
  '🎮 Many Roblox developers are teenagers',
  '🎮 Python code runs on the International Space Station (ISS)',
  '🎮 QR codes were invented to track car parts',
  '🎮 There are thousands of programming languages — about 50 are widely used',
  '🎮 Undersea internet cables can wrap around the Earth 35+ times',
];

const ALL_TIPS_EN = [
  ...TIPS_VPYTHON_EN,

  ...TIPS_ADVICE_EN,
  ...TIPS_QUOTES_EN,
  ...TIPS_FUN_EN,
];

export default function LoadingScreen({ progress = 0, message = '' }) {
  const { t, locale } = useI18n();
  const [tipIndex, setTipIndex] = useState(0);
  const tips = locale === 'ko' ? ALL_TIPS_KO : ALL_TIPS_EN;

  // 셔플된 순서를 한 번만 생성 (매번 랜덤하게 보이도록)
  const [shuffledOrder] = useState(() => {
    const indices = Array.from({ length: tips.length }, (_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    return indices;
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % shuffledOrder.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [tips.length]);

  return (
    <div
      className="flex flex-col items-center justify-center h-full gap-5 px-8"
      style={{ backgroundColor: 'var(--color-bg-primary)' }}
    >
      {/* 상태 메시지 */}
      <div className="text-center">
        <p className="text-sm font-medium mb-1" style={{ color: 'var(--color-text-primary)' }}>
          {message || t('loading.pyodide')}
        </p>
        <p className="text-xs font-mono" style={{ color: 'var(--color-text-muted)' }}>
          {Math.round(progress)}%
        </p>
      </div>

      {/* 프로그레스 바 */}
      <div className="w-56 loading-bar h-1.5">
        <div className="loading-bar-fill" style={{ width: `${progress}%` }} />
      </div>

      {/* 학습 팁 */}
      <p
        className="text-xs text-center max-w-xs"
        key={tipIndex}
        style={{ color: 'var(--color-text-muted)', animation: 'slide-up 0.2s ease-out' }}
      >
        {tips[shuffledOrder[tipIndex % shuffledOrder.length]]}
      </p>
    </div>
  );
}

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

// 카테고리: 과학/프로그래밍 지식
const TIPS_SCIENCE_KO = [
  '🔬 뉴턴의 운동 법칙: F = ma, 코드 한 줄로 표현할 수 있어요',
  '🔬 빛의 3원색은 빨강, 초록, 파랑 — 모니터도 같은 원리예요',
  '🔬 지구의 중력 가속도 9.8 m/s²는 VPython에서도 똑같이 적용돼요',
  '🔬 포물선 운동 = 수평 등속 운동 + 수직 자유 낙하',
  '🔬 행성이 태양 주위를 도는 것도 중력 시뮬레이션으로 구현할 수 있어요',
  '🔬 벡터는 크기와 방향을 가진 양 — 물리에서 가장 중요한 개념이에요',
  '🔬 단진자의 주기는 길이에만 영향을 받아요 — 시뮬레이션으로 확인해보세요',
  '🔬 탄성 충돌에서는 운동량과 에너지가 모두 보존돼요',
  '🔬 파동은 sin() 함수로 표현할 수 있어요',
  '🔬 만유인력 법칙: 모든 물체는 서로 끌어당기고 있어요',
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

// 카테고리: 영감을 주는 명언
const TIPS_QUOTES_KO = [
  '✨ "상상력은 지식보다 중요하다" — 알베르트 아인슈타인',
  '✨ "한 번도 실수한 적 없는 사람은 새로운 것을 시도한 적 없는 사람이다" — 아인슈타인',
  '✨ "모든 전문가도 처음엔 초보자였다" — 헬렌 헤이즈',
  '✨ "코드는 시(詩)처럼 아름다울 수 있다" — 도널드 크누스',
  '✨ "가장 좋은 학습 방법은 직접 만들어 보는 것이다" — 시모어 패퍼트',
  '✨ "컴퓨터가 강력한 이유는 질문할 수 있기 때문이다" — 할 에이벌슨',
  '✨ "세상 모든 사람이 코딩을 배워야 한다. 생각하는 법을 가르쳐주니까" — 스티브 잡스',
  '✨ "우주의 언어는 수학이고, 수학의 언어는 코드다"',
  '✨ "실패는 성공의 반대가 아니라 성공의 일부다"',
  '✨ "무엇이든 충분히 깊이 파고들면 수학이 나온다" — 미야모토 시게루',
  '✨ "어려운 일을 해낼 수 있다는 사실이 우리를 성장시킨다"',
  '✨ "호기심은 가장 강력한 학습 엔진이다"',
];

// 카테고리: 재미있는 사실
const TIPS_FUN_KO = [
  '🎮 최초의 컴퓨터 버그는 진짜 나방이 컴퓨터에 끼어서 생긴 거예요!',
  '🎮 파이썬의 이름은 뱀이 아니라 영국 코미디 쇼에서 따왔어요',
  '🎮 NASA도 파이썬으로 우주 데이터를 분석해요',
  '🎮 Minecraft의 원래 이름은 "Cave Game"이었어요',
  '🎮 세계 최초의 프로그래머는 에이다 러브레이스라는 여성이에요',
  '🎮 1GB 저장장치가 1971년에는 냉장고만큼 컸어요',
  '🎮 인류가 달에 간 컴퓨터보다 여러분의 스마트폰이 수백만 배 빨라요',
  '🎮 구글의 첫 서버는 레고 블록으로 만든 케이스에 들어있었어요',
];

const ALL_TIPS_KO = [
  ...TIPS_VPYTHON_KO,
  ...TIPS_SCIENCE_KO,
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

const TIPS_SCIENCE_EN = [
  "🔬 Newton's law: F = ma — you can express it in one line of code",
  '🔬 The three primary colors of light are red, green, blue — monitors work the same way',
  '🔬 Earth\'s gravity (9.8 m/s²) works the same in VPython',
  '🔬 Projectile motion = horizontal constant velocity + vertical free fall',
  '🔬 You can simulate planets orbiting the sun with gravity!',
  '🔬 Vectors have magnitude and direction — the most important concept in physics',
  '🔬 A pendulum\'s period depends only on its length — try simulating it!',
  '🔬 In elastic collisions, both momentum and energy are conserved',
  '🔬 Waves can be represented using the sin() function',
  '🔬 Universal gravitation: every object attracts every other object',
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
  '✨ "Anyone who has never made a mistake has never tried anything new" — Einstein',
  '✨ "Every expert was once a beginner" — Helen Hayes',
  '✨ "Code can be beautiful, just like poetry" — Donald Knuth',
  '✨ "The best way to learn is to build something" — Seymour Papert',
  '✨ "Computers are powerful because you can ask questions" — Hal Abelson',
  '✨ "Everybody should learn to code. It teaches you how to think" — Steve Jobs',
  '✨ "The language of the universe is math, and the language of math is code"',
  '✨ "Failure is not the opposite of success — it\'s part of it"',
  '✨ "Dig deep into anything and you\'ll find math" — Shigeru Miyamoto',
  '✨ "Doing hard things is what makes us grow"',
  '✨ "Curiosity is the most powerful learning engine"',
];

const TIPS_FUN_EN = [
  '🎮 The first computer bug was a real moth stuck in a machine!',
  '🎮 Python is named after a British comedy show, not the snake',
  '🎮 NASA uses Python to analyze space data',
  '🎮 Minecraft was originally called "Cave Game"',
  '🎮 The first programmer was Ada Lovelace, a woman, in the 1840s',
  '🎮 In 1971, a 1GB storage device was as big as a refrigerator',
  '🎮 Your phone is millions of times faster than the computer that landed on the moon',
  '🎮 Google\'s first server was housed in a case made of LEGO bricks',
];

const ALL_TIPS_EN = [
  ...TIPS_VPYTHON_EN,
  ...TIPS_SCIENCE_EN,
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

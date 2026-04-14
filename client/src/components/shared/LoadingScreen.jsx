import { useState, useEffect } from 'react';
import { useI18n } from '../../i18n';

const TIPS_KO = [
  'VPython에서 sphere()로 구를 만들 수 있어요',
  'rate(100)은 초당 100번 화면을 갱신해요',
  'vector(1, 2, 3)으로 3D 좌표를 표현해요',
  'color.red, color.cyan 등으로 색상을 지정해요',
  'while True: 루프 안에서 물체를 움직일 수 있어요',
  'ball.velocity를 사용해서 속도를 제어해보세요',
  '중력은 ball.velocity.y -= 9.8 * dt 로 구현해요',
  'box(size=vector(2, 0.1, 2))로 바닥을 만들어보세요',
];

const TIPS_EN = [
  'Create a sphere with sphere() in VPython',
  'rate(100) updates the screen 100 times per second',
  'Use vector(1, 2, 3) to represent 3D coordinates',
  'Set colors with color.red, color.cyan, etc.',
  'Move objects inside a while True: loop',
  'Use ball.velocity to control speed',
  'Simulate gravity with ball.velocity.y -= 9.8 * dt',
  'Make a floor with box(size=vector(2, 0.1, 2))',
];

export default function LoadingScreen({ progress = 0, message = '' }) {
  const { t, locale } = useI18n();
  const [tipIndex, setTipIndex] = useState(0);
  const tips = locale === 'ko' ? TIPS_KO : TIPS_EN;

  useEffect(() => {
    const interval = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % tips.length);
    }, 5000);
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
        {tips[tipIndex]}
      </p>
    </div>
  );
}

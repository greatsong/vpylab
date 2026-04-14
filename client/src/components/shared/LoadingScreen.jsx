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
      className="flex flex-col items-center justify-center h-full gap-6 px-8"
      style={{ backgroundColor: 'var(--color-bg-primary)' }}
    >
      {/* 로고 애니메이션 */}
      <div className="relative">
        <svg width="64" height="64" viewBox="0 0 28 28" className="animate-pulse">
          <line x1="14" y1="14" x2="24" y2="20" stroke="#FF6B6B" strokeWidth="2.5" strokeLinecap="round"/>
          <line x1="14" y1="14" x2="14" y2="4" stroke="#00B894" strokeWidth="2.5" strokeLinecap="round"/>
          <line x1="14" y1="14" x2="6" y2="20" stroke="#6C5CE7" strokeWidth="2.5" strokeLinecap="round"/>
          <circle cx="14" cy="14" r="3" fill="#6C5CE7"/>
        </svg>
      </div>

      {/* 상태 메시지 */}
      <div className="text-center">
        <p className="text-base font-semibold mb-1" style={{ color: 'var(--color-text-primary)' }}>
          {message || t('loading.pyodide')}
        </p>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          {t('loading.progress', { percent: Math.round(progress) })}
        </p>
      </div>

      {/* 프로그레스 바 */}
      <div className="w-64 loading-bar h-2">
        <div className="loading-bar-fill" style={{ width: `${progress}%` }} />
      </div>

      {/* 학습 팁 */}
      <div
        className="text-sm text-center max-w-sm animate-slide-up flex items-center gap-2"
        key={tipIndex}
        style={{ color: 'var(--color-text-muted)' }}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="var(--color-accent)" style={{ flexShrink: 0 }}>
          <path d="M8 1a5 5 0 00-2 9.58V12a1 1 0 001 1h2a1 1 0 001-1v-1.42A5 5 0 008 1zm0 2a3 3 0 012 5.24V10H6V8.24A3 3 0 018 3zM6 14h4v1H6v-1z"/>
        </svg>
        {tips[tipIndex]}
      </div>

      <p className="text-xs mt-4" style={{ color: 'var(--color-text-muted)' }}>
        {t('loading.tip')}
      </p>
    </div>
  );
}

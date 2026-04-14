import { useState, useCallback } from 'react';
import { CheckIcon, LockIcon } from './Icons';

/**
 * 스텝 진행 상태를 관리하는 커스텀 훅
 * @param {number} totalSteps — 전체 단계 수
 */
export function useStepProgress(totalSteps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState(new Set());
  const [showTransition, setShowTransition] = useState(false);

  const completeStep = useCallback((stepNum) => {
    setCompletedSteps((prev) => {
      const next = new Set(prev);
      next.add(stepNum);
      return next;
    });
    if (stepNum === currentStep && stepNum < totalSteps) {
      setShowTransition(true);
    }
  }, [currentStep, totalSteps]);

  const goToStep = useCallback((stepNum) => {
    if (stepNum <= 1 || completedSteps.has(stepNum - 1) || stepNum === currentStep) {
      setCurrentStep(stepNum);
      setShowTransition(false);
    }
  }, [completedSteps, currentStep]);

  const dismissTransition = useCallback(() => {
    setShowTransition(false);
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  }, [currentStep, totalSteps]);

  const isUnlocked = useCallback((stepNum) => {
    return stepNum === 1 || completedSteps.has(stepNum - 1);
  }, [completedSteps]);

  return {
    currentStep,
    completedSteps,
    showTransition,
    completeStep,
    goToStep,
    dismissTransition,
    isUnlocked,
  };
}

/**
 * 스텝 진행 표시기 UI 컴포넌트
 */
export default function StepIndicator({ steps, currentStep, completedSteps, onStepClick }) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto py-3 px-1 -mx-1">
      {steps.map((step, idx) => {
        const num = idx + 1;
        const isCompleted = completedSteps.has(num);
        const isCurrent = currentStep === num;
        const isLocked = num > 1 && !completedSteps.has(num - 1) && !isCurrent;
        const canClick = isCompleted || isCurrent;

        return (
          <div key={num} className="flex items-center" style={{ flex: idx < steps.length - 1 ? 1 : 'none' }}>
            {/* 스텝 버튼 */}
            <button
              onClick={() => canClick && onStepClick(num)}
              disabled={isLocked}
              className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all whitespace-nowrap"
              style={{
                cursor: canClick ? 'pointer' : 'default',
                backgroundColor: isCurrent
                  ? 'var(--color-accent-bg)'
                  : isCompleted
                    ? 'rgba(0, 184, 148, 0.08)'
                    : 'transparent',
                border: isCurrent
                  ? '1px solid var(--color-accent)'
                  : isCompleted
                    ? '1px solid rgba(0, 184, 148, 0.3)'
                    : '1px solid var(--color-border)',
                opacity: isLocked ? 0.4 : 1,
              }}
            >
              {/* 번호/상태 원 */}
              <span
                className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
                style={{
                  backgroundColor: isCompleted
                    ? 'var(--color-success)'
                    : isCurrent
                      ? 'var(--color-accent)'
                      : 'var(--color-bg-tertiary)',
                  color: isCompleted || isCurrent ? '#fff' : 'var(--color-text-muted)',
                  ...(isCurrent && !isCompleted ? { animation: 'pulse-glow 2s ease-in-out infinite' } : {}),
                }}
              >
                {isCompleted ? (
                  <CheckIcon size={12} />
                ) : isLocked ? (
                  <LockIcon size={11} />
                ) : (
                  num
                )}
              </span>

              {/* 제목 */}
              <span
                className="text-xs font-semibold hidden sm:inline"
                style={{
                  color: isCurrent
                    ? 'var(--color-accent)'
                    : isCompleted
                      ? 'var(--color-success)'
                      : 'var(--color-text-muted)',
                }}
              >
                {step.title}
              </span>
            </button>

            {/* 연결선 */}
            {idx < steps.length - 1 && (
              <div
                className="h-px flex-1 mx-1 min-w-[8px]"
                style={{
                  backgroundColor: completedSteps.has(num)
                    ? 'var(--color-success)'
                    : 'var(--color-border)',
                  opacity: completedSteps.has(num) ? 0.5 : 0.3,
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * 단계 완료 축하 + "다음 단계로" 전환 오버레이
 */
export function StepTransition({ nextStepTitle, onNext }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
    >
      <div
        className="rounded-2xl p-8 text-center max-w-sm mx-4"
        style={{
          backgroundColor: 'var(--color-bg-panel)',
          border: '1px solid var(--color-border)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.15)',
          animation: 'slide-up 0.3s ease-out',
        }}
      >
        {/* 축하 아이콘 */}
        <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0, 184, 148, 0.1)' }}>
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <circle cx="16" cy="16" r="12" stroke="#00B894" strokeWidth="2.5" />
            <path d="M10 16l4 4 8-8" stroke="#00B894" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        <h3
          className="text-lg font-bold mb-2"
          style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-display)' }}
        >
          단계 완료!
        </h3>
        <p className="text-sm mb-6" style={{ color: 'var(--color-text-muted)' }}>
          다음 단계: <strong style={{ color: 'var(--color-text-primary)' }}>{nextStepTitle}</strong>
        </p>

        <button
          onClick={onNext}
          className="btn-primary inline-flex items-center gap-2"
        >
          다음 단계로
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M3 8h10M9 4l4 4-4 4" />
          </svg>
        </button>
      </div>
    </div>
  );
}

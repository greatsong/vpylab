/**
 * VPyLab — 저장 게이트 다이얼로그
 *
 * 사용자가 활성 프로젝트가 없는 상태에서 💾를 누르면 표시.
 * "VPyLab은 모든 저장을 GitHub 프로젝트에 commit합니다"를 환기하고
 * 새 프로젝트 / 기존 프로젝트 선택을 유도한다.
 */
export default function ProjectGate({ open, onCreateNew, onPickExisting, onClose }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(15, 23, 42, 0.54)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-md border shadow-2xl"
        style={{
          backgroundColor: 'var(--color-bg-panel)',
          borderColor: 'var(--color-border)',
          padding: 24,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>
              저장 위치 선택
            </h3>
            <p className="mt-1 text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
              GitHub 커밋과 Pages 갱신이 함께 기록됩니다.
            </p>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 border bg-transparent text-lg"
            style={{
              color: 'var(--color-text-muted)',
              borderColor: 'var(--color-border)',
            }}
            aria-label="닫기"
          >
            ×
          </button>
        </div>

        <div className="flex flex-col gap-2">
          <button
            onClick={onCreateNew}
            className="w-full py-3 px-4 text-sm font-bold cursor-pointer border-none text-left flex items-center justify-between gap-4"
            style={{
              backgroundColor: 'var(--color-accent)',
              color: 'var(--color-accent-text, white)',
            }}
          >
            <span>새 프로젝트 만들기</span>
            <span className="text-xs font-medium opacity-80">첫 커밋으로 저장</span>
          </button>
          <button
            onClick={onPickExisting}
            className="w-full py-3 px-4 text-sm font-semibold cursor-pointer border text-left flex items-center justify-between gap-4"
            style={{
              backgroundColor: 'var(--color-bg-primary)',
              borderColor: 'var(--color-border)',
              color: 'var(--color-text-primary)',
            }}
          >
            <span>기존 프로젝트에 저장</span>
            <span className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>목록에서 선택</span>
          </button>
        </div>
      </div>
    </div>
  );
}

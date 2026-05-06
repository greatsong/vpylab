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
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-md shadow-2xl p-6"
        style={{ backgroundColor: 'var(--color-bg-primary)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--color-text-primary)' }}>
          💾 어디에 저장할까요?
        </h3>
        <p className="text-sm mb-5 leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
          VPyLab은 모든 저장을 GitHub 프로젝트에 commit합니다.<br />
          이 코드를 새 프로젝트로 만들거나, 기존 프로젝트에 이어 저장할 수 있어요.
        </p>

        <div className="flex flex-col gap-2 mb-3">
          <button
            onClick={onCreateNew}
            className="w-full py-3 px-4 text-sm font-bold cursor-pointer border-none text-left flex items-center justify-between"
            style={{
              backgroundColor: 'var(--color-accent)',
              color: 'var(--color-accent-text, white)',
            }}
          >
            <span>＋ 새 프로젝트로 만들기</span>
            <span className="text-xs opacity-80">현재 코드가 첫 commit이 됨</span>
          </button>
          <button
            onClick={onPickExisting}
            className="w-full py-3 px-4 text-sm font-medium cursor-pointer border text-left flex items-center justify-between"
            style={{
              backgroundColor: 'var(--color-bg-tertiary)',
              borderColor: 'var(--color-border)',
              color: 'var(--color-text-primary)',
            }}
          >
            <span>📁 기존 프로젝트에 이어 저장</span>
            <span className="text-xs opacity-60">목록에서 선택</span>
          </button>
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="text-sm px-3 py-1.5 cursor-pointer border-none bg-transparent"
            style={{ color: 'var(--color-text-muted)' }}
          >
            취소
          </button>
        </div>
      </div>
    </div>
  );
}

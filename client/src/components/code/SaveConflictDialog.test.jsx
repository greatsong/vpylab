import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SaveConflictDialog from './SaveConflictDialog';

describe('공동 코드 충돌 비교', () => {
  it('두 편집본을 유지하고 확인 전에는 저장하지 않는다', () => {
    const apply = vi.fn(); render(<SaveConflictDialog localCode="speed = 2" remoteCode="speed = 3" onApply={apply} onClose={() => {}} />);
    expect(screen.getByLabelText('내 편집본')).toHaveValue('speed = 2');
    expect(screen.getByLabelText('친구가 먼저 저장한 코드')).toHaveValue('speed = 3');
    expect(screen.getByRole('button', { name: '확인한 코드로 다시 저장' })).toBeDisabled();
    expect(apply).not.toHaveBeenCalled();
  });
  it('학생이 직접 정리하고 확인한 코드만 전달한다', () => {
    const apply = vi.fn(); render(<SaveConflictDialog localCode="mine" remoteCode="theirs" onApply={apply} onClose={() => {}} />);
    fireEvent.change(screen.getByLabelText('함께 반영할 코드'), { target: { value: 'combined' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: '확인한 코드로 다시 저장' }));
    expect(apply).toHaveBeenCalledWith('combined');
    expect(screen.getByLabelText('내 편집본')).toHaveValue('mine');
  });
  it('비교를 닫아도 저장이나 코드 교체를 실행하지 않는다', () => {
    const apply = vi.fn(), close = vi.fn(); render(<SaveConflictDialog localCode="mine" remoteCode="theirs" onApply={apply} onClose={close} />);
    fireEvent.click(screen.getByRole('button', { name: '편집본 유지하고 돌아가기' }));
    expect(close).toHaveBeenCalledOnce(); expect(apply).not.toHaveBeenCalled();
  });
});

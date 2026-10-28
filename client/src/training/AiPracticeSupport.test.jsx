import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import AiPracticeSupport from './AiPracticeSupport.jsx';
import { useState } from 'react';

const activity = { editTask: 'radius 한 줄 변경', aiOptional: '값의 의미를 묻습니다.' };
const session = { id: 1, aiPrompt: '한 단계 힌트를 주세요.' };
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe('AI 도움의 근거 기록', () => {
  it('수정하지 않은 기본 질문을 복사해도 실제 사용한 질문을 저장한다', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined), onChange = vi.fn();
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    render(<AiPracticeSupport activity={activity} session={session} value={{ prediction: '위치는 같다.' }} onChange={onChange} />);
    const question = screen.getByLabelText('AI에게 할 질문').value;
    fireEvent.click(screen.getByRole('button', { name: 'AI 질문 복사' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(question));
    expect(onChange).toHaveBeenCalledWith({ aiPrompt: question });
  });
  it('이미 채택한 응답을 바꾸면 기존 근거를 지우지 않고 판단을 보류한다', () => {
    function PracticeWithRecord() {
      const [value, setValue] = useState({ aiResponse: '처음 응답', aiDecision: 'adopted', aiVerification: 'x=4, y=8', aiReason: '직접 실행함' });
      return <AiPracticeSupport activity={activity} session={session} value={value} onChange={patch => setValue(previous => ({ ...previous, ...patch }))} />;
    }
    render(<PracticeWithRecord />);
    fireEvent.change(screen.getByLabelText('받은 AI 응답·검토 예시'), { target: { value: '새 응답' } });
    expect(screen.getByLabelText('AI 도움에 대한 판단').value).toBe('pending');
    expect(screen.getByLabelText('AI 답을 확인한 실행·수치').value).toBe('x=4, y=8');
    expect(screen.getByLabelText('채택·거절한 이유').value).toBe('직접 실행함');
    expect(screen.getByText(/응답이 바뀌어 판단을 보류/)).toBeTruthy();
  });
  it('채택 후 질문만 바꾸어도 이전 응답의 판단을 재확인하고 기록을 보존한다', () => {
    function PracticeWithQuestion() {
      const [value, setValue] = useState({ aiPrompt: '반지름만 바꾸면?', aiResponse: '위치는 유지됩니다.', aiDecision: 'adopted', aiVerification: '0.9에서 위치 0,0,0', aiReason: '원본과 비교함' });
      return <AiPracticeSupport activity={activity} session={session} value={value} onChange={patch => setValue(previous => ({ ...previous, ...patch }))} />;
    }
    render(<PracticeWithQuestion />);
    fireEvent.change(screen.getByLabelText('AI에게 할 질문'), { target: { value: '색만 바꾸면?' } });
    expect(screen.getByLabelText('AI 도움에 대한 판단').value).toBe('pending');
    expect(screen.getByLabelText('받은 AI 응답·검토 예시').value).toBe('위치는 유지됩니다.');
    expect(screen.getByLabelText('AI 답을 확인한 실행·수치').value).toBe('0.9에서 위치 0,0,0');
    expect(screen.getByLabelText('채택·거절한 이유').value).toBe('원본과 비교함');
    expect(screen.getByText(/질문이나 응답이 바뀌어 판단을 보류/)).toBeTruthy();
  });
});

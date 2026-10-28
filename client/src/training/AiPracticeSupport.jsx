import { useState } from 'react';

/** 참가자의 AI 도구에서 받은 설명과 직접 확인한 근거를 연결합니다. 자동 호출은 하지 않습니다. */
export default function AiPracticeSupport({ activity, session, value, previousValue, onChange }) {
  const [copyMessage, setCopyMessage] = useState('');
  const prompt = value.aiPrompt ?? `${session.aiPrompt || activity.aiOptional}\n\n이번 과제: ${activity.editTask}\n나의 예상: ${value.prediction || '(먼저 작성)'}\n완성 코드 대신 확인할 질문과 한 단계 힌트를 주세요.`;
  const updatePrompt = next => onChange({ aiPrompt: next, ...(next !== prompt ? { aiDecision: 'pending', aiVerificationNeedsReview: true } : {}) });
  const copyPrompt = async () => {
    updatePrompt(prompt);
    try { await navigator.clipboard.writeText(prompt); setCopyMessage('질문을 복사했습니다. 본인이 사용하는 AI 도구에 붙여 넣으세요.'); }
    catch { setCopyMessage('복사 권한이 없습니다. 아래 질문을 선택해 직접 복사하세요.'); }
  };
  return <section className="tr-card tr-ai-workflow" aria-label="AI 도움과 검증 기록">
    <span className="tr-kicker">나의 예상 → AI의 힌트 → 직접 실행 → 채택 판단</span>
    <h3>AI와 함께 확인하되, 판단은 내가 남깁니다.</h3>
    <p>각자 사용하는 AI 도구에 질문하고 응답을 이곳에 붙여 넣습니다. 이 화면에서 AI 서비스로 자동 전송하지 않습니다.</p>
    {previousValue?.aiResponse && <details className="tr-details"><summary>지난 차시의 응답을 다시 검토하기</summary><p>새 질문을 만들기 전에 지난 응답과 직접 확인한 근거를 다시 읽습니다. 재검토는 이번 차시의 별도 기록으로 저장됩니다.</p><pre className="tr-proposal-summary">{previousValue.aiResponse}</pre><p>지난 확인: {previousValue.aiVerification || '아직 작성한 확인 근거 없음'}</p><button className="cr-button small" onClick={() => onChange({ aiResponse: previousValue.aiResponse, aiTool: previousValue.aiTool || '', aiUseStatus: previousValue.aiUseStatus || 'not-yet', aiPrompt: previousValue.aiPrompt, aiReusedFromSession: session.id - 1, aiDecision: 'pending' })}>지난 응답을 가져와 재검토</button></details>}
    <div className="tr-record-grid">
      <label className="tr-field">AI 사용 상태<select aria-label="AI 사용 상태" value={value.aiUseStatus || 'not-yet'} onChange={event => onChange({ aiUseStatus: event.target.value })}><option value="not-yet">아직 사용 전</option><option value="used">내 AI 도구에서 실제 응답을 받음</option><option value="example-only">강사 작성 검토 예시로 연습함</option><option value="unavailable">도구 연결이 어려워 도움말로 진행함</option></select></label>
      <label className="tr-field">사용한 AI 도구·도움 출처<input aria-label="사용한 AI 도구·도움 출처" value={value.aiTool || ''} onChange={event => onChange({ aiTool: event.target.value })} placeholder="도구 이름 또는 강사 작성 연습 예시" /></label>
      <label className="tr-field">AI에게 할 질문<textarea aria-label="AI에게 할 질문" rows={4} value={prompt} onChange={event => updatePrompt(event.target.value)} /></label>
    </div>
    <button className="cr-button small" disabled={!value.prediction?.trim()} onClick={copyPrompt}>AI 질문 복사</button>
    {!value.prediction?.trim() && <p className="tr-note">먼저 위의 ‘실행 전 예상’을 한 문장 적습니다.</p>}
    {copyMessage && <p role="status" className="tr-save">{copyMessage}</p>}
    <details className="tr-details"><summary>응답을 받고, 확인한 근거 기록하기</summary>
      <div className="tr-record-grid">
        <label className="tr-field">받은 AI 응답·검토 예시<textarea aria-label="받은 AI 응답·검토 예시" value={value.aiResponse || ''} rows={4} onChange={event => onChange({ aiResponse: event.target.value, aiDecision: 'pending', aiVerificationNeedsReview: true })} placeholder="실제로 받은 응답을 붙여 넣고 출처를 위에 표시하세요." /></label>
        <label className="tr-field">AI 답을 확인한 실행·수치<textarea aria-label="AI 답을 확인한 실행·수치" value={value.aiVerification || ''} rows={4} onChange={event => onChange({ aiVerification: event.target.value })} placeholder={session.aiVerification || '같은 코드에서 확인한 값과 AI의 설명을 비교합니다.'} /></label>
        <label className="tr-field">AI 도움에 대한 판단<select aria-label="AI 도움에 대한 판단" value={value.aiDecision || 'pending'} onChange={event => onChange({ aiDecision: event.target.value, aiVerificationNeedsReview: event.target.value === 'pending' })}><option value="pending">검증 전 · 판단 보류</option><option value="partly-adopted">일부 채택</option><option value="adopted">실행 근거를 확인하고 채택</option><option value="rejected">채택하지 않음</option></select></label>
        <label className="tr-field">채택·거절한 이유<textarea aria-label="채택·거절한 이유" value={value.aiReason || ''} rows={3} onChange={event => onChange({ aiReason: event.target.value })} placeholder="내가 확인한 근거와 아직 확인하지 못한 것을 구별합니다." /></label>
      </div>
      {value.aiVerificationNeedsReview && <p className="tr-note" role="status">질문이나 응답이 바뀌어 판단을 보류했습니다. 남겨 둔 실행 근거를 현재 질문·응답과 다시 대조한 뒤 판단하세요.</p>}
    </details>
    <details className="tr-details"><summary>AI 연결이 어려울 때의 검토 연습</summary><p>{session.aiFallback || '강사가 작성한 연습 예시를 읽고 같은 코드로 확인합니다. 실제 AI 응답을 받은 것으로 기록하지 않습니다.'}</p><p><b>강사가 작성한 연습 예시 · 실제 AI 응답 아님:</b> {session.aiResponseExample?.text || '교과 질문과 직접 확인할 값을 짝과 정하고 도움말로 진행합니다.'}</p></details>
  </section>;
}

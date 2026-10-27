export default function EvidenceForm({ value, onChange, aiPolicy, prefix = 'evidence' }) {
  const field = (name, label, placeholder) => (
    <label className="cr-field" htmlFor={`${prefix}-${name}`} key={name}>
      <span>{label}</span>
      <textarea id={`${prefix}-${name}`} rows={2} maxLength={2000} value={value[name] || ''}
        placeholder={placeholder} onChange={(event) => onChange({ ...value, [name]: event.target.value })} />
    </label>
  );
  return <div className="cr-evidence-fields">
    {field('hypothesis', '예상과 가설', '무엇이 어떻게 달라질 것으로 예상했나요?')}
    {field('observation', '실험과 관찰', '실행 조건과 실제 결과, 실패한 사례를 남겨주세요.')}
    {field('reasoning', '판단한 이유', '어떤 대안을 비교했고 왜 이 방법을 골랐나요?')}
    {field('nextStep', '다음에 확인할 것', '아직 모르는 점, 다음 실험이나 개선을 적어주세요.')}
    {aiPolicy !== 'disabled' && <details className="cr-ai-detail"><summary>AI를 사용했다면 기록하기 <span>선택</span></summary>
      {field('aiUse', 'AI 제안과 나의 판단', '어떤 도움을 받았고, 무엇을 채택하거나 거절했나요? 어떻게 검증했나요?')}
    </details>}
    <p className="cr-hint">AI 사용 여부와 관계없이 가설·관찰·판단·설명을 중심으로 배웁니다.</p>
  </div>;
}

import { useUiText } from "../../i18n/ui-text";
import { useState } from 'react';

export default function SaveConflictDialog({ localCode, remoteCode, onApply, onClose }) {
  const ui = useUiText();
  const [combined, setCombined] = useState(localCode);
  const [confirmed, setConfirmed] = useState(false);
  const fieldStyle = { width: '100%', minHeight: 180, padding: 12, fontFamily: 'monospace',
    color: 'var(--color-text-primary)', background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)' };
  const downloadMine = () => {
    const url = URL.createObjectURL(new Blob([localCode], { type: 'text/x-python;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = 'my-vpylab-code.py'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <div className="fixed inset-0 z-[120] overflow-y-auto p-4" style={{ background: 'rgba(0,0,0,.65)' }}>
    <section role="dialog" aria-modal="true" aria-labelledby="save-conflict-title" className="max-w-5xl mx-auto p-6 space-y-4"
      style={{ background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)' }}>
      <h2 id="save-conflict-title" className="text-xl font-semibold">{ui("친구의 코드와 비교해주세요")}</h2>
      <p>{ui("친구의 저장이 먼저 반영됐습니다. 내 편집본은 그대로 보관했으며 자동으로 합치거나 덮어쓰지 않았습니다.")}</p>
      <div className="grid md:grid-cols-2 gap-4">
        <label>{ui("내 편집본")}<textarea aria-label={ui("내 편집본")} readOnly value={localCode} style={fieldStyle} /></label>
        <label>{ui("친구가 먼저 저장한 코드")}<textarea aria-label={ui("친구가 먼저 저장한 코드")} readOnly value={remoteCode} style={fieldStyle} /></label>
      </div>
      <label className="block">{ui("두 내용을 확인하며 저장할 코드를 직접 정리해주세요.")}<textarea aria-label={ui("함께 반영할 코드")} value={combined} onChange={event => { setCombined(event.target.value); setConfirmed(false); }} style={fieldStyle} />
      </label>
      <label className="flex gap-2"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />{ui("친구의 변경과 내 변경을 확인했습니다.")}</label>
      <p className="text-sm">{ui("비교하는 동안 다른 저장이 추가되면 다시 알려드립니다.")}</p>
      <div className="flex flex-wrap gap-3">
        <button type="button" className="px-4 py-2 border" onClick={downloadMine}>{ui("내 편집본 내려받기")}</button>
        <button type="button" className="px-4 py-2 border" onClick={onClose}>{ui("편집본 유지하고 돌아가기")}</button>
        <button type="button" className="px-4 py-2 border disabled:opacity-50" disabled={!confirmed} onClick={() => onApply(combined)}>{ui("확인한 코드로 다시 저장")}</button>
      </div>
    </section>
  </div>;
}

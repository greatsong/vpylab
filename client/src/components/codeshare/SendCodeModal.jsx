import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../../i18n';
import useCodeShareStore from '../../stores/codeShareStore';

export default function SendCodeModal({ isOpen, onClose, currentCode }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const {
    teacherClasses, selectedClassId, setSelectedClassId,
    sendCode, generateTitle,
  } = useCodeShareStore();

  const [title, setTitle] = useState('');
  const [code, setCode] = useState('');
  const [classId, setClassId] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setCode(currentCode || '');
      setError(null);
      setSending(false);
      const cid = selectedClassId || (teacherClasses.length === 1 ? teacherClasses[0].id : '');
      setClassId(cid);
      setTitle(generateTitle());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // 학급이 없는 경우
  if (teacherClasses.length === 0) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center"
        style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
        onClick={onClose}
      >
        <div
          className="rounded-2xl p-8 max-w-sm w-full mx-4 text-center"
          style={{ backgroundColor: 'var(--color-bg-panel)', boxShadow: '0 16px 48px rgba(0,0,0,0.12)' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-4xl mb-4">📭</div>
          <h3 className="text-base font-bold mb-2" style={{ color: 'var(--color-text-primary)' }}>
            {t('codeShare.noClasses')}
          </h3>
          <p className="text-sm mb-6" style={{ color: 'var(--color-text-muted)' }}>
            {t('codeShare.noClassesDesc')}
          </p>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-lg text-sm font-semibold cursor-pointer"
              style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)' }}
            >
              {t('codeShare.cancel')}
            </button>
            <button
              onClick={() => { onClose(); navigate('/dashboard'); }}
              className="flex-1 py-2.5 rounded-lg text-sm font-semibold cursor-pointer"
              style={{ backgroundColor: 'var(--color-accent)', color: 'white', border: 'none' }}
            >
              {t('codeShare.goToDashboard')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleSend = async () => {
    if (!code.trim()) {
      setError(t('codeShare.emptyCode'));
      return;
    }
    if (!classId) {
      setError(t('codeShare.selectClassFirst'));
      return;
    }

    setSending(true);
    setError(null);

    const finalTitle = title.trim() || generateTitle();
    const result = await sendCode({ classId, code, title: finalTitle });

    if (result.error) {
      setError(result.error);
      setSending(false);
    } else {
      if (selectedClassId !== classId) setSelectedClassId(classId);
      onClose();
    }
  };

  const selectedClass = teacherClasses.find((c) => c.id === classId);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <div
        className="rounded-2xl max-w-lg w-full mx-4 flex flex-col"
        style={{
          backgroundColor: 'var(--color-bg-panel)',
          boxShadow: '0 16px 48px rgba(0,0,0,0.12)',
          maxHeight: '85vh',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center gap-3 p-5 pb-0">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
            style={{ backgroundColor: '#FEF3C7' }}
          >
            📤
          </div>
          <div>
            <h3 className="text-base font-bold" style={{ color: 'var(--color-text-primary)' }}>
              {t('codeShare.sendToStudents')}
            </h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
              {t('codeShare.sendDesc')}
            </p>
          </div>
        </div>

        {/* 본문 */}
        <div className="p-5 flex flex-col gap-3 overflow-y-auto">
          {/* 학급 선택 (2개 이상일 때만) */}
          {teacherClasses.length > 1 && (
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                {t('codeShare.selectClass')}
              </label>
              <select
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
                className="w-full py-2 px-3 rounded-lg text-sm"
                style={{
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-bg-secondary)',
                  color: 'var(--color-text-primary)',
                  fontFamily: 'inherit',
                  outline: 'none',
                }}
              >
                <option value="">{t('codeShare.selectClassPlaceholder')}</option>
                {teacherClasses.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* 제목 */}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
              {t('codeShare.codeTitle')}
              <span className="font-normal ml-1" style={{ color: 'var(--color-text-muted)' }}>
                ({t('codeShare.autoFilled')})
              </span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full py-2 px-3 rounded-lg text-sm"
              style={{
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-bg-secondary)',
                color: 'var(--color-text-primary)',
                fontFamily: 'inherit',
                outline: 'none',
              }}
            />
          </div>

          {/* 코드 편집 */}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
              {t('codeShare.codeContent')}
              <span className="font-normal ml-1" style={{ color: 'var(--color-text-muted)' }}>
                ({t('codeShare.editable')})
              </span>
            </label>
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              spellCheck={false}
              className="w-full rounded-lg text-xs"
              style={{
                backgroundColor: '#1E1E1E',
                color: '#D4D4D4',
                fontFamily: "'JetBrains Mono', monospace",
                lineHeight: 1.6,
                padding: '12px',
                border: '1px solid transparent',
                outline: 'none',
                resize: 'vertical',
                minHeight: '120px',
                maxHeight: '200px',
              }}
            />
          </div>

          {/* 학생 수 표시 */}
          {selectedClass && (
            <div
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm"
              style={{ backgroundColor: '#ECFDF5', color: '#065F46' }}
            >
              <span>👥</span>
              {selectedClass.name} {t('codeShare.studentsWillReceive')}
            </div>
          )}

          {/* 에러 */}
          {error && (
            <div
              className="px-3 py-2 rounded-lg text-sm"
              style={{ backgroundColor: '#FEF2F2', color: '#991B1B' }}
            >
              {error}
            </div>
          )}
        </div>

        {/* 하단 버튼 */}
        <div className="flex gap-2 p-5 pt-0">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg text-sm font-semibold cursor-pointer"
            style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)' }}
          >
            {t('codeShare.cancel')}
          </button>
          <button
            onClick={handleSend}
            disabled={sending}
            className="flex-1 py-2.5 rounded-lg text-sm font-semibold cursor-pointer"
            style={{
              backgroundColor: sending ? 'var(--color-text-muted)' : '#F59E0B',
              color: 'white',
              border: 'none',
              opacity: sending ? 0.7 : 1,
            }}
          >
            {sending ? t('codeShare.sending') : `📤 ${t('codeShare.sendAction')}`}
          </button>
        </div>
      </div>
    </div>
  );
}

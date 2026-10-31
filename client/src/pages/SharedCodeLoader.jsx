import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { loadSharedCode } from '../utils/share';
import { useI18n } from '../i18n/useI18n';

/**
 * /s/:id → 공유 코드 로드 후 Sandbox로 이동
 */
export default function SharedCodeLoader() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useI18n();
  const [error, setError] = useState(null);

  useEffect(() => {
    loadSharedCode(id).then(({ code, title, error: err }) => {
      if (err || !code) {
        setError(err || t('sharedCode.notFound'));
        return;
      }
      // state로 코드 전달하며 Sandbox로 이동
      navigate('/sandbox', { state: { sharedCode: code, sharedTitle: title, autoPlay: true }, replace: true });
    });
  }, [id, navigate, t]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: 'var(--color-bg-primary)', color: 'var(--color-text-secondary)' }}>
        <div className="text-center">
          <p className="text-lg mb-4">{error}</p>
          <a href="/" className="text-sm" style={{ color: 'var(--color-accent)' }}>{t('sharedCode.backHome')}</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center"
      style={{ backgroundColor: 'var(--color-bg-primary)', color: 'var(--color-text-muted)' }}>
      <p>{t('sharedCode.loading')}</p>
    </div>
  );
}

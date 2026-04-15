import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { loadSharedCode } from '../utils/share';

/**
 * /s/:id → 공유 코드 로드 후 Sandbox로 이동
 */
export default function SharedCodeLoader() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState(null);

  useEffect(() => {
    loadSharedCode(id).then(({ code, title, error: err }) => {
      if (err || !code) {
        setError(err || '코드를 찾을 수 없습니다');
        return;
      }
      // state로 코드 전달하며 Sandbox로 이동
      navigate('/sandbox', { state: { sharedCode: code, sharedTitle: title, autoPlay: true }, replace: true });
    });
  }, [id, navigate]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: 'var(--color-bg-primary)', color: 'var(--color-text-secondary)' }}>
        <div className="text-center">
          <p className="text-lg mb-4">{error}</p>
          <a href="/" className="text-sm" style={{ color: 'var(--color-accent)' }}>홈으로 돌아가기</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center"
      style={{ backgroundColor: 'var(--color-bg-primary)', color: 'var(--color-text-muted)' }}>
      <p>코드 로딩 중...</p>
    </div>
  );
}

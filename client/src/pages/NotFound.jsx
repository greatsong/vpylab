import { Link } from 'react-router-dom';
import Header from '../components/layout/Header';
import { useI18n } from '../i18n/useI18n';

// 등록되지 않은 주소 — 빈 화면 대신 안내와 홈 링크를 보여준다
export default function NotFound() {
  const { locale: lang } = useI18n();

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
      <Header />
      <main className="flex-1 container-main py-16 w-full">
        <div className="max-w-md mx-auto text-center">
          <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
            {lang === 'ko' ? '페이지를 찾을 수 없습니다.' : 'Page not found.'}
          </p>
          <Link to="/" className="btn-secondary no-underline inline-block">
            {lang === 'ko' ? '← 홈으로' : '← Back to home'}
          </Link>
        </div>
      </main>
    </div>
  );
}

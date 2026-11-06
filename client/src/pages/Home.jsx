import { Link } from 'react-router-dom';
import Header from '../components/layout/Header';
import { useI18n } from '../i18n/useI18n';

export default function Home() {
  const { locale } = useI18n();
  const ko = locale === 'ko';
  const paths = [
    { number: '01', title: ko ? '빛과 소리로 시작하는 코딩' : 'First Coding with Light and Sound', description: ko ? '소리 하나에서 시작해, 두 상태를 구분하는 알림 작품을 만듭니다.' : 'Start with one sound and make a signal for two different states.', meta: ko ? '처음 배우는 학생 · 8차시' : 'For beginners · 8 lessons', to: '/courses/beg-light-sound' },
    { number: '02', title: ko ? 'GitHub 프로젝트 시작하기' : 'Start a GitHub Project', description: ko ? '만든 작품을 보관하고, 바꾼 이유를 남기고, 친구와 공유합니다.' : 'Keep your work, record your decisions, and share it with others.', meta: ko ? '작품을 만든 다음 · 4차시' : 'After your first project · 4 lessons', to: '/courses/beg-github-project' },
  ];
  return (
    <div className="min-h-screen w-full min-w-0 flex flex-col" style={{ backgroundColor: 'var(--color-bg-primary)', color: 'var(--color-text-primary)' }}>
      <Header />
      <main className="flex-1 w-full max-w-5xl mx-auto px-6 md:px-10">
        <section className="pt-14 pb-12 md:pt-24 md:pb-20">
          <p className="text-xs font-semibold tracking-widest mb-6" style={{ color: 'var(--color-accent)' }}>{ko ? '처음 배우는 코딩, VPyLab' : 'YOUR FIRST CODE, VPyLab'}</p>
          <h1 className="font-display text-4xl md:text-6xl font-bold tracking-tight leading-tight max-w-3xl">{ko ? <>빛과 소리로 시작하는<br />나의 첫 코딩.</> : <>Your first code.<br />Light, sound, and ideas.</>}</h1>
          <p className="mt-6 text-base md:text-lg leading-relaxed max-w-xl" style={{ color: 'var(--color-text-secondary)' }}>{ko ? '작은 코드를 실행하고, 한 가지씩 바꾸고, 달라진 이유를 찾아보세요. 나에게 필요한 작품을 만들며 문제를 해결하는 연습을 합니다.' : 'Run a little code. Change one thing. Find out why the result changed, then make something useful to you.'}</p>
          <div className="mt-8 flex items-center gap-x-6 gap-y-4 flex-wrap">
            <Link to="/courses/beg-light-sound/light-sound-1" className="btn-primary no-underline inline-flex items-center gap-5">{ko ? '첫 수업 시작하기' : 'Start your first lesson'} <span aria-hidden="true">→</span></Link>
            <Link to="/sandbox" className="text-sm font-medium no-underline py-3" style={{ color: 'var(--color-text-secondary)' }}>{ko ? '자유롭게 만들기' : 'Create freely'} <span aria-hidden="true">↗</span></Link>
          </div>
          <p className="mt-4 text-xs" style={{ color: 'var(--color-text-secondary)' }}>{ko ? '설치나 로그인 없이 첫 수업을 시작할 수 있어요.' : 'Start your first lesson without installing or signing in.'}</p>
        </section>
        <section className="pb-14" aria-labelledby="learning-path-title">
          <div className="flex justify-between items-center gap-4 pb-5" style={{ borderBottom: '1px solid var(--color-border)' }}>
            <h2 id="learning-path-title" className="text-sm font-semibold">{ko ? '이렇게 이어가요' : 'Your learning path'}</h2>
            <Link to="/courses" className="text-xs no-underline" style={{ color: 'var(--color-text-secondary)' }}>{ko ? '모든 교재' : 'All courses'} <span aria-hidden="true">→</span></Link>
          </div>
          <ol>{paths.map(path => (
            <li key={path.to} style={{ borderBottom: '1px solid var(--color-border)' }}>
              <Link to={path.to} className="group flex items-start sm:items-center gap-5 sm:gap-8 py-6 no-underline" style={{ color: 'inherit' }}>
                <span className="font-mono text-xs pt-1 sm:pt-0" style={{ color: 'var(--color-accent)' }} aria-hidden="true">{path.number}</span>
                <div className="flex-1 min-w-0"><p className="text-xs mb-2" style={{ color: 'var(--color-text-secondary)' }}>{path.meta}</p><h3 className="font-display text-lg font-semibold group-hover:underline underline-offset-4">{path.title}</h3><p className="text-sm mt-2 leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>{path.description}</p></div>
                <span className="self-center text-lg" aria-hidden="true">↗</span>
              </Link>
            </li>
          ))}</ol>
        </section>
      </main>
      <footer className="w-full max-w-5xl mx-auto px-6 md:px-10 pb-8 text-xs flex justify-between gap-5 flex-wrap" style={{ color: 'var(--color-text-secondary)' }}>
        <span>{ko ? '빛과 소리로 코딩하며, 창의적 문제해결력을 키우는 VPyLab' : 'Creative problem solving through light, sound, and code.'}</span>
        <div className="flex gap-5"><Link to="/guide" className="no-underline" style={{ color: 'inherit' }}>{ko ? '사용 안내' : 'Guide'}</Link><Link to="/privacy" className="no-underline" style={{ color: 'inherit' }}>{ko ? '개인정보 처리방침' : 'Privacy'}</Link></div>
      </footer>
    </div>
  );
}

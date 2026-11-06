import { Link } from 'react-router-dom';
import Header from '../components/layout/Header';
import { useI18n } from '../i18n/useI18n';

export default function Home() {
  const { locale } = useI18n();
  const ko = locale === 'ko';
  const paths = [
    { number: '01', title: ko ? '튜토리얼' : 'Tutorials', description: ko ? '3D, 빛과 소리, 움직임, 버튼. 기능마다 3~5분씩 가볍게 체험해요.' : 'Try 3D, light and sound, motion, and buttons in 3–5 minutes each.', to: '/tutorials' },
    { number: '02', title: ko ? '트레이닝' : 'Training', description: ko ? '기초 코스부터 핵심 연습까지, 작은 작품을 만들며 차근차근 훈련해요.' : 'Train step by step, from foundations to core practice and your own small project.', to: '/missions' },
    { number: '03', title: ko ? '갤러리' : 'Gallery', description: ko ? '실제 학생이 만든 프로젝트를 보고, 서로의 아이디어에서 배워요.' : 'Explore actual student projects and learn from each other’s ideas.', to: '/gallery' },
  ];
  return (
    <div className="min-h-screen w-full min-w-0 flex flex-col" style={{ backgroundColor: 'var(--color-bg-primary)', color: 'var(--color-text-primary)' }}>
      <Header />
      <main className="flex-1 w-full max-w-5xl mx-auto px-6 md:px-10">
        <section className="pt-14 pb-12 md:pt-24 md:pb-20">
          <p className="text-xs font-semibold tracking-widest mb-6" style={{ color: 'var(--color-accent)' }}>{ko ? '코드가 눈앞의 작품으로, VPyLab' : 'YOUR CODE COMES TO LIFE, VPyLab'}</p>
          <h1 className="font-display text-4xl md:text-6xl font-bold tracking-tight leading-tight max-w-3xl">{ko ? <>빛과 소리로 만드는<br />나의 첫 코딩.</> : <>Your first code.<br />Light, sound, and ideas.</>}</h1>
          <p className="mt-6 text-base md:text-lg leading-relaxed max-w-xl" style={{ color: 'var(--color-text-secondary)' }}>{ko ? '짧게 체험하고, 트레이닝으로 연습하고, 나만의 작품을 만들어보세요.' : 'Try a feature, train step by step, and make a project of your own.'}</p>
          <div className="mt-8 flex items-center gap-x-6 gap-y-4 flex-wrap">
            <Link to="/tutorials/shape" className="btn-primary no-underline inline-flex items-center gap-5">{ko ? '3분 체험 시작하기' : 'Try it in 3 minutes'} <span aria-hidden="true">→</span></Link>
            <Link to="/missions" className="text-sm font-medium no-underline py-3" style={{ color: 'var(--color-text-secondary)' }}>{ko ? '차근차근 배우기' : 'Learn step by step'} <span aria-hidden="true">↗</span></Link>
          </div>
          <p className="mt-4 text-xs" style={{ color: 'var(--color-text-secondary)' }}>{ko ? '설치나 로그인 없이 시작할 수 있어요.' : 'Start without installing or signing in.'}</p>
        </section>
        <section className="pb-14" aria-labelledby="learning-path-title">
          <h2 id="learning-path-title" className="text-sm font-semibold pb-5" style={{ borderBottom: '1px solid var(--color-border)' }}>{ko ? '체험에서 내 작품까지' : 'From trying to creating'}</h2>
          <ol>{paths.map(path => <li key={path.to} style={{ borderBottom: '1px solid var(--color-border)' }}><Link to={path.to} className="group flex items-start sm:items-center gap-5 sm:gap-8 py-6 no-underline" style={{ color: 'inherit' }}><span className="font-mono text-xs pt-1 sm:pt-0" style={{ color: 'var(--color-accent)' }} aria-hidden="true">{path.number}</span><div className="flex-1 min-w-0"><h3 className="font-display text-lg font-semibold group-hover:underline underline-offset-4">{path.title}</h3><p className="text-sm mt-2 leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>{path.description}</p></div><span className="self-center text-lg" aria-hidden="true">↗</span></Link></li>)}</ol>
        </section>
      </main>
      <footer className="w-full max-w-5xl mx-auto px-6 md:px-10 pb-8 text-xs flex justify-between gap-5 flex-wrap" style={{ color: 'var(--color-text-secondary)' }}>
        <Link to="/sandbox" className="no-underline" style={{ color: 'inherit' }}>{ko ? '바로 만들기 →' : 'Create now →'}</Link>
        <div className="flex gap-5"><Link to="/guide" className="no-underline" style={{ color: 'inherit' }}>{ko ? '사용 안내' : 'Guide'}</Link><Link to="/privacy" className="no-underline" style={{ color: 'inherit' }}>{ko ? '개인정보 처리방침' : 'Privacy'}</Link></div>
      </footer>
    </div>
  );
}

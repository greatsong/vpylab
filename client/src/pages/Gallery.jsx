import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import Header from '../components/layout/Header';
import GalleryCard from '../components/gallery/GalleryCard';
import useGalleryStore from '../stores/galleryStore';
import useAuthStore from '../stores/authStore';
import { glowscriptProjects } from '../data/glowscript-projects';
import { useI18n } from '../i18n/useI18n';

function SourceCard({ project, ko }) {
  return <Link to={`/gallery/glowscript/${project.id}`} className="block border no-underline overflow-hidden" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-panel)', color: 'var(--color-text-primary)' }}>
    {project.thumbnail ? <img src={project.thumbnail} alt="" loading="lazy" className="w-full aspect-[8/5] object-contain" style={{ backgroundColor: '#111827' }} /> : <div className="aspect-[8/5] flex items-center justify-center text-xs" style={{ backgroundColor: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)' }}>{ko ? '원본 코드 보기' : 'View original code'}</div>}
    <div className="p-5"><p className="text-xs mb-2" style={{ color: 'var(--color-accent)' }}>{project.credit}</p><h3 className="text-base font-semibold leading-relaxed break-words mb-3">{project.title}</h3><p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{project.folder.startsWith('2021') ? '2021 서울고' : '2024 프로젝트 모음'} · {ko ? '작품 보기' : 'Explore'} →</p></div>
  </Link>;
}

export default function Gallery() {
  const { locale } = useI18n();
  const ko = locale === 'ko';
  const user = useAuthStore(s => s.user);
  const { works, myWorks, loading, error, hasMore, fetchWorks, fetchMyWorks } = useGalleryStore();
  const students = glowscriptProjects.filter(project => project.kind === 'student');
  const references = glowscriptProjects.filter(project => project.kind !== 'student');
  useEffect(() => { fetchWorks(true); }, [fetchWorks]);
  useEffect(() => { if (user) fetchMyWorks(); }, [user, fetchMyWorks]);
  return <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg-primary)', color: 'var(--color-text-primary)' }}>
    <Header />
    <main className="w-full max-w-5xl mx-auto px-6 md:px-10 py-12">
      <h1 className="font-display text-3xl font-bold mb-4">{ko ? '갤러리' : 'Gallery'}</h1>
      <p className="text-sm leading-relaxed max-w-2xl mb-9" style={{ color: 'var(--color-text-secondary)' }}>{ko ? '학생이 만든 실제 프로젝트를 보고, 어떤 아이디어를 코드로 옮겼는지 살펴보세요. 원본을 실행하거나 코드를 열어 나만의 실험으로 이어갈 수 있어요.' : 'Explore actual student projects and the ideas behind them. Run the originals or open the code for your own experiments.'}</p>
      <section aria-labelledby="student-project-title">
        <div className="flex items-center justify-between gap-4 mb-5"><h2 id="student-project-title" className="font-display text-xl font-bold">{ko ? '학생 프로젝트' : 'Student projects'}</h2><Link to="/sandbox" className="text-sm no-underline" style={{ color: 'var(--color-accent)' }}>{ko ? '내 작품 만들기' : 'Create your own'} →</Link></div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">{students.map(project => <SourceCard key={project.id} project={project} ko={ko} />)}{works.map(work => <GalleryCard key={work.id} work={work} />)}</div>
        {loading && <p className="text-sm mt-5">{ko ? '작품을 불러오는 중입니다.' : 'Loading projects.'}</p>}
        {error && <p role="alert" className="text-sm mt-5">{ko ? '새 작품을 불러오지 못했습니다.' : 'Could not load new projects.'} <button type="button" onClick={() => fetchWorks(true)} className="btn-secondary">{ko ? '다시 시도' : 'Retry'}</button></p>}
        {!loading && hasMore && works.length > 0 && <button type="button" onClick={() => fetchWorks()} className="btn-secondary mt-5">{ko ? '더 보기' : 'Load more'}</button>}
      </section>
      <details className="mt-12 border-t pt-6" style={{ borderColor: 'var(--color-border)' }}>
        <summary className="text-sm font-semibold cursor-pointer">{ko ? `교사·참고 프로젝트 ${references.length}개` : `${references.length} teacher and reference projects`}</summary>
        <p className="text-sm leading-relaxed my-5" style={{ color: 'var(--color-text-secondary)' }}>{ko ? '2024 프로젝트 모음의 교사·연수·참고 자료입니다. 학생 작품과 구분해 보관했습니다. 내용이 없는 초안도 원본 기록으로 남아 있습니다.' : 'Teacher, workshop, and other work from the supplied 2024 collection. These are separate from student work; empty drafts are also preserved.'}</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">{references.map(project => <SourceCard key={project.id} project={project} ko={ko} />)}</div>
      </details>
      {user && myWorks.length > 0 && <details className="mt-8 border-t pt-6" style={{ borderColor: 'var(--color-border)' }}>
        <summary className="text-sm font-semibold cursor-pointer">{ko ? '내 작업 보기' : 'My work'}</summary>
        <p className="text-sm my-5" style={{ color: 'var(--color-text-secondary)' }}>{ko ? '작품 상세 화면에서 공개 범위를 바꿀 수 있어요. 학생 프로젝트 전시는 별도 확인한 뒤 이루어집니다.' : 'Manage visibility from each work’s detail page. Student exhibition is confirmed separately.'}</p>
        <div className="gallery-grid">{myWorks.map(work => <GalleryCard key={work.id} work={work} />)}</div>
      </details>}
      <p className="mt-10 text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>{ko ? '출처: greatsong21의 GlowScript 공개 폴더 2개 · 총 33개 원본. 원본 이름과 출처는 작품별로 확인할 수 있습니다.' : 'Source: two public GlowScript folders by greatsong21, containing 33 originals. Each project includes its original name and source.'}</p>
    </main>
  </div>;
}

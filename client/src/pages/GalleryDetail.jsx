import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import Header from '../components/layout/Header';
import useGalleryStore from '../stores/galleryStore';
import useAuthStore from '../stores/authStore';
import GalleryCard from '../components/gallery/GalleryCard';
import { useI18n } from '../i18n';

export default function GalleryDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { locale: lang } = useI18n();
  const { currentWork, loading, fetchWork, toggleLike, checkIfLiked, forkWork } = useGalleryStore();
  const user = useAuthStore(s => s.user);
  const getGitHubToken = useAuthStore(s => s.getGitHubToken);
  const isGitHubUser = useAuthStore(s => s.isGitHubUser);
  const [isLiked, setIsLiked] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [forking, setForking] = useState(false);

  useEffect(() => { fetchWork(id); }, [id]);

  useEffect(() => {
    if (currentWork && user) checkIfLiked(id).then(setIsLiked);
  }, [currentWork, user]);

  if (loading || !currentWork) {
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
        <Header />
        <div className="flex-1 flex items-center justify-center" style={{ color: 'var(--color-text-muted)' }}>
          {lang === 'ko' ? '로딩 중...' : 'Loading...'}
        </div>
      </div>
    );
  }

  const author = currentWork.vpylab_profiles?.display_name || (lang === 'ko' ? '익명' : 'Anonymous');
  const date = new Date(currentWork.created_at).toLocaleDateString(lang === 'ko' ? 'ko-KR' : 'en-US');
  const isMyWork = user && currentWork.user_id === user.id;

  const handleLike = async () => {
    if (!user) return;
    const liked = await toggleLike(id);
    setIsLiked(liked);
  };

  const handleRemix = () => navigate(`/sandbox?remix=${id}`);
  const handlePlay = () => {
    navigate(`/sandbox?play=${id}`);
  };
  const handleEdit = () => navigate(`/sandbox?edit=${id}`);

  const handleFork = async () => {
    if (!user) return;
    if (!isGitHubUser()) {
      alert(lang === 'ko' ? 'GitHub 로그인이 필요합니다.' : 'GitHub login required.');
      return;
    }
    if (!currentWork.github_repo) return;

    setForking(true);
    const token = await getGitHubToken();
    if (!token) {
      setForking(false);
      if (confirm(lang === 'ko'
        ? 'GitHub 인증이 만료되었습니다. 재로그인하시겠습니까?'
        : 'GitHub auth expired. Re-login?')) {
        sessionStorage.setItem('vpylab_pending_fork', JSON.stringify({
          sourceId: id,
          sourceRepo: currentWork.github_repo
        }));
        const { signInWithGitHub } = useAuthStore.getState();
        signInWithGitHub();
      }
      return;
    }

    const result = await forkWork({ sourceId: id, sourceRepo: currentWork.github_repo, githubToken: token });
    setForking(false);
    if (result.error) {
      alert((lang === 'ko' ? 'Fork 실패: ' : 'Fork failed: ') + result.error);
    } else {
      navigate(`/sandbox?edit=${result.data.id}`);
    }
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
      <Header />

      <main className="flex-1 container-main py-8 w-full">
        {/* 뒤로가기 */}
        <Link to="/gallery" className="inline-flex items-center gap-1.5 text-sm no-underline mb-6"
          style={{ color: 'var(--color-text-muted)' }}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round"/>
          </svg>
          {lang === 'ko' ? '갤러리' : 'Gallery'}
        </Link>

        {/* 메인 */}
        <div className="detail-layout mb-8">
          {/* 카테고리 비주얼 */}
          <div className="rounded-xl overflow-hidden flex items-center justify-center" style={{
            aspectRatio: '16/10',
            background: {
              computing: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              math: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
              science: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
              art: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
              sound: 'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
              free: 'linear-gradient(135deg, #30cfd0 0%, #330867 100%)',
            }[currentWork.category] || 'linear-gradient(135deg, #30cfd0 0%, #330867 100%)',
          }}>
            <span style={{ fontSize: '4rem', filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.2))' }}>
              {{ computing: '💻', math: '📐', science: '🔬', art: '🎨', sound: '🎵', free: '🚀' }[currentWork.category] || '🚀'}
            </span>
          </div>

          {/* 정보 */}
          <div>
            <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--color-text-primary)' }}>
              {currentWork.title}
            </h1>
            <p className="text-sm mb-4" style={{ color: 'var(--color-text-muted)' }}>
              {author} · {date}
            </p>

            {currentWork.description && (
              <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--color-text-secondary)' }}>
                {currentWork.description}
              </p>
            )}

            {/* 영감 */}
            {currentWork.originalWork && (
              <Link to={`/gallery/${currentWork.originalWork.id}`}
                className="inline-flex items-center gap-2 text-xs no-underline px-3 py-2 rounded-lg mb-4"
                style={{
                  backgroundColor: 'var(--color-accent-bg)',
                  border: '1px solid rgba(108,92,231,0.2)',
                  color: 'var(--color-accent)',
                }}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M2 4l3-3v2h6a3 3 0 013 3v2h-2V6a1 1 0 00-1-1H5v2L2 4zm12 8l-3 3v-2H5a3 3 0 01-3-3v-2h2v2a1 1 0 001 1h6v-2l3 3z"/>
                </svg>
                {lang === 'ko' ? '영감' : 'Inspired by'}: {currentWork.originalWork.vpylab_profiles?.display_name} — "{currentWork.originalWork.title}"
              </Link>
            )}

            {/* 통계 */}
            <div className="flex items-center gap-4 mb-5 text-sm">
              <button
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg cursor-pointer transition-all"
                onClick={handleLike}
                disabled={!user}
                style={{
                  border: `1px solid ${isLiked ? 'var(--color-error)' : 'var(--color-border)'}`,
                  backgroundColor: isLiked ? 'rgba(255,107,107,0.08)' : 'transparent',
                  color: isLiked ? 'var(--color-error)' : 'var(--color-text-muted)',
                  opacity: user ? 1 : 0.5,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill={isLiked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5">
                  <path d="M8 14s-5.5-3.5-5.5-7A3.5 3.5 0 018 4a3.5 3.5 0 015.5 3c0 3.5-5.5 7-5.5 7z"/>
                </svg>
                {currentWork.like_count || 0}
              </button>
              <span className="flex items-center gap-1.5" style={{ color: 'var(--color-text-muted)' }}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 3C4.5 3 1.5 5.5.5 8c1 2.5 4 5 7.5 5s6.5-2.5 7.5-5c-1-2.5-4-5-7.5-5zm0 8a3 3 0 110-6 3 3 0 010 6z"/>
                </svg>
                {currentWork.view_count || 0}
              </span>
              <span className="flex items-center gap-1.5" style={{ color: 'var(--color-text-muted)' }}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M2 4l3-3v2h6a3 3 0 013 3v2h-2V6a1 1 0 00-1-1H5v2L2 4zm12 8l-3 3v-2H5a3 3 0 01-3-3v-2h2v2a1 1 0 001 1h6v-2l3 3z"/>
                </svg>
                {currentWork.remix_count || 0}
              </span>
            </div>

            {/* 액션 버튼 */}
            <div className="flex flex-wrap gap-2">
              <button onClick={handlePlay}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full border-none cursor-pointer font-semibold text-sm text-white transition-all"
                style={{ backgroundColor: 'var(--color-accent)' }}
                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'none'}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M5 2l10 6-10 6V2z"/></svg>
                {lang === 'ko' ? '바로 플레이' : 'Play'}
              </button>

              {isMyWork && currentWork.github_repo && (
                <button onClick={handleEdit}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full border-none cursor-pointer font-semibold text-sm text-white"
                  style={{ backgroundColor: '#f0883e' }}>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M12.1 1.5l2.4 2.4-9 9H3v-2.5l9.1-8.9zm-1.4 1.4L4 9.6V11h1.4l6.7-6.7-1.4-1.4z"/></svg>
                  {lang === 'ko' ? '수정' : 'Edit'}
                </button>
              )}

              {!isMyWork && currentWork.github_repo && user && isGitHubUser() && (
                <button onClick={handleFork} disabled={forking}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full border-none cursor-pointer font-semibold text-sm text-white"
                  style={{ backgroundColor: '#00B894', opacity: forking ? 0.6 : 1 }}>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M5 3.25a2.25 2.25 0 00-1 4.34v1.16A2.25 2.25 0 005 13a2.25 2.25 0 001-4.34V7.59A2.25 2.25 0 005 3.25zM11 3.25a2.25 2.25 0 00-1 4.34v.16c0 .83-.67 1.5-1.5 1.5H7V7.59A2.25 2.25 0 005 3.25"/></svg>
                  {forking
                    ? (lang === 'ko' ? 'Remix 중...' : 'Remixing...')
                    : (lang === 'ko' ? '내 것으로 Remix' : 'Remix to Mine')}
                </button>
              )}

              <button onClick={handleRemix}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full cursor-pointer font-medium text-sm transition-all"
                style={{ border: '1px solid var(--color-border)', backgroundColor: 'transparent', color: 'var(--color-text-primary)' }}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M2 4l3-3v2h6a3 3 0 013 3v2h-2V6a1 1 0 00-1-1H5v2L2 4zm12 8l-3 3v-2H5a3 3 0 01-3-3v-2h2v2a1 1 0 001 1h6v-2l3 3z"/></svg>
                Remix
              </button>

              {currentWork.github_url && (
                <a href={currentWork.github_url} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full no-underline font-medium text-sm transition-all"
                  style={{ border: '1px solid var(--color-border)', backgroundColor: 'transparent', color: 'var(--color-text-primary)' }}>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
                  Pages
                </a>
              )}

              {currentWork.github_repo && (
                <>
                  <a href={`https://github.com/${currentWork.github_repo}`} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full no-underline font-medium text-sm transition-all"
                    style={{ border: '1px solid var(--color-border)', backgroundColor: 'transparent', color: 'var(--color-text-primary)' }}>
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
                    Repo
                  </a>
                  <a href={`https://github.com/${currentWork.github_repo}/issues/new`} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full no-underline font-medium text-sm transition-all"
                    style={{ border: '1px solid var(--color-border)', backgroundColor: 'transparent', color: 'var(--color-text-primary)' }}>
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M8 9.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"/><path fillRule="evenodd" d="M8 0a8 8 0 100 16A8 8 0 008 0zM1.5 8a6.5 6.5 0 1113 0 6.5 6.5 0 01-13 0z"/></svg>
                    {lang === 'ko' ? '피드백' : 'Feedback'}
                  </a>
                </>
              )}

              <button onClick={() => setShowCode(!showCode)}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full cursor-pointer font-medium text-sm transition-all"
                style={{ border: '1px solid var(--color-border)', backgroundColor: 'transparent', color: 'var(--color-text-secondary)' }}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M5.5 4L1 8l4.5 4M10.5 4L15 8l-4.5 4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg>
                {showCode ? (lang === 'ko' ? '코드 숨기기' : 'Hide Code') : (lang === 'ko' ? '코드 보기' : 'View Code')}
              </button>
            </div>
          </div>
        </div>

        {/* 코드 */}
        {showCode && (
          <div className="rounded-xl overflow-hidden mb-8"
            style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}>
            <div className="flex justify-between items-center px-4 py-2.5 text-xs font-medium"
              style={{ borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}>
              <span>Python</span>
              <button
                onClick={() => navigator.clipboard.writeText(currentWork.code)}
                className="px-3 py-1 rounded-md cursor-pointer text-xs transition-all"
                style={{ border: '1px solid var(--color-border)', backgroundColor: 'transparent', color: 'var(--color-text-secondary)' }}>
                {lang === 'ko' ? '복사' : 'Copy'}
              </button>
            </div>
            <pre style={{
              padding: '1rem', margin: 0, overflowX: 'auto',
              fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', lineHeight: 1.6,
              maxHeight: '400px', overflowY: 'auto', color: 'var(--color-text-primary)',
            }}>
              <code>{currentWork.code}</code>
            </pre>
          </div>
        )}

        {/* Remix 목록 */}
        {currentWork.remixes?.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2"
              style={{ color: 'var(--color-text-primary)' }}>
              <svg width="18" height="18" viewBox="0 0 16 16" fill="var(--color-accent)">
                <path d="M2 4l3-3v2h6a3 3 0 013 3v2h-2V6a1 1 0 00-1-1H5v2L2 4zm12 8l-3 3v-2H5a3 3 0 01-3-3v-2h2v2a1 1 0 001 1h6v-2l3 3z"/>
              </svg>
              Remix ({currentWork.remixes.length})
            </h2>
            <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
              {currentWork.remixes.map(remix => (
                <GalleryCard key={remix.id} work={remix} />
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

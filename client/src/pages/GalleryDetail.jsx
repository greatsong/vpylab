import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Header from '../components/layout/Header';
import GalleryCard from '../components/gallery/GalleryCard';
import useGalleryStore from '../stores/galleryStore';
import useAuthStore from '../stores/authStore';
import { ensureAudioReady } from '../engine/sound-system';
import { createPosterThumbnail, isThumbnailUsable } from '../engine/thumbnail';
import { useI18n } from '../i18n/useI18n';

const GalleryPreview = lazy(() => import('../components/gallery/GalleryPreview'));

const CATEGORY_META = {
  CT: { label: '컴퓨팅', accent: '#4A6CF7', mark: 'CT' },
  CR: { label: '창작', accent: '#FF6B6B', mark: 'CR' },
  MA: { label: '수학', accent: '#00CEC9', mark: 'MA' },
  SC: { label: '과학', accent: '#00B894', mark: 'SC' },
  AR: { label: '아트', accent: '#F0883E', mark: 'AR' },
  SN: { label: '사운드', accent: '#E84393', mark: 'SN' },
  free: { label: '자유', accent: '#2563EB', mark: 'VP' },
};

function shortNumber(value) {
  const n = Number(value || 0);
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return String(n);
}

function GitHubIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

function DetailStat({ label, value, children }) {
  return (
    <div className="gallery-detail-stat">
      {children}
      <span>{shortNumber(value)}</span>
      <p>{label}</p>
    </div>
  );
}

export default function GalleryDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { locale: lang } = useI18n();
  const { currentWork, loading, fetchWork, toggleLike, checkIfLiked, forkWork, republishWork } = useGalleryStore();
  const user = useAuthStore(s => s.user);
  const getGitHubToken = useAuthStore(s => s.getGitHubToken);
  const isGitHubUser = useAuthStore(s => s.isGitHubUser);
  const signInWithGitHub = useAuthStore(s => s.signInWithGitHub);
  const [likeState, setLikeState] = useState({ id: null, value: false });
  const [showCode, setShowCode] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [forking, setForking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [detailThumbnail, setDetailThumbnail] = useState(null);
  const [makingPublic, setMakingPublic] = useState(false);
  const [repoStatus, setRepoStatus] = useState(null); // { repo, broken }

  useEffect(() => {
    fetchWork(id);
  }, [fetchWork, id]);

  useEffect(() => {
    let alive = true;
    if (!currentWork || !user) return () => { alive = false; };
    checkIfLiked(id).then(value => {
      if (alive) setLikeState({ id, value });
    });
    return () => { alive = false; };
  }, [checkIfLiked, currentWork, id, user]);

  const meta = CATEGORY_META[currentWork?.category] || CATEGORY_META.free;
  const author = currentWork?.vpylab_profiles?.display_name
    || currentWork?.author_alias
    || (lang === 'ko' ? '익명' : 'Anonymous');
  const date = currentWork
    ? new Date(currentWork.created_at).toLocaleDateString(lang === 'ko' ? 'ko-KR' : 'en-US')
    : '';
  const isMyWork = !!(user && currentWork?.user_id === user.id);
  const isLiked = !!user && likeState.id === id && likeState.value;
  const repoUrl = currentWork?.github_repo ? `https://github.com/${currentWork.github_repo}` : '';
  const issuesUrl = currentWork?.github_repo ? `${repoUrl}/issues/new` : '';
  // repo 소실 대비: repo 경로에도 play 파라미터를 병기해 Sandbox가 스냅샷으로 폴백할 수 있게 함
  const runPath = currentWork?.github_repo
    ? `/sandbox?repo=${encodeURIComponent(currentWork.github_repo)}&autorun=1&play=${id}`
    : `/sandbox?play=${id}`;
  const projectState = useMemo(() => {
    if (!currentWork) return [];
    const flags = [
      currentWork.github_repo ? 'GitHub 저장소 연결' : '갤러리 코드 스냅샷',
      currentWork.github_url ? 'Pages 실행 페이지' : 'Pages 미발행',
      currentWork.project_id ? 'VPyLab 프로젝트에서 발행' : '독립 작품',
    ];
    if (currentWork.is_public === false) flags.push('비공개 초안');
    return flags;
  }, [currentWork]);
  const posterThumbnail = useMemo(() => createPosterThumbnail({
    title: currentWork?.title,
    description: currentWork?.description,
    category: currentWork?.category,
    code: currentWork?.code,
    repo: currentWork?.github_repo,
    author,
  }), [author, currentWork?.category, currentWork?.code, currentWork?.description, currentWork?.github_repo, currentWork?.title]);
  const stageThumbnail = detailThumbnail?.id === currentWork?.id && detailThumbnail.src
    ? detailThumbnail.src
    : posterThumbnail;
  const hasStageCapturedThumbnail = detailThumbnail?.id === currentWork?.id && !!detailThumbnail.src;

  useEffect(() => {
    let alive = true;
    if (!currentWork?.thumbnail) return () => { alive = false; };
    isThumbnailUsable(currentWork.thumbnail).then(usable => {
      if (alive) setDetailThumbnail({ id: currentWork.id, src: usable ? currentWork.thumbnail : null });
    });
    return () => { alive = false; };
  }, [currentWork?.id, currentWork?.thumbnail]);

  // 저장소 연결 상태 확인 — repo 정보는 있는데 GitHub에서 사라진 경우 뱃지 표시
  useEffect(() => {
    let alive = true;
    const repo = currentWork?.github_repo;
    if (!repo) return () => { alive = false; };
    fetch(`https://api.github.com/repos/${repo}`)
      .then(res => {
        if (alive) setRepoStatus({ repo, broken: res.status === 404 });
      })
      .catch(() => {
        // 네트워크 오류는 저장소 소실로 단정하지 않음
      });
    return () => { alive = false; };
  }, [currentWork?.github_repo]);

  const repoBroken = !!(currentWork?.github_repo
    && repoStatus?.repo === currentWork.github_repo
    && repoStatus.broken);

  if (loading || !currentWork) {
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
        <Header />
        <main className="gallery-detail-page">
          <div className="gallery-loading">{lang === 'ko' ? '작품을 불러오는 중입니다.' : 'Loading work.'}</div>
        </main>
      </div>
    );
  }

  const handleLike = async () => {
    if (!user) {
      useAuthStore.getState().setAuthModalOpen(true);
      return;
    }
    const liked = await toggleLike(id);
    setLikeState({ id, value: liked });
  };

  const handleRun = async () => {
    await ensureAudioReady();
    navigate(runPath);
  };

  const handleFork = async () => {
    if (!user) {
      useAuthStore.getState().setAuthModalOpen(true);
      return;
    }
    if (!isGitHubUser()) {
      signInWithGitHub();
      return;
    }
    if (!currentWork.github_repo) {
      navigate(`/sandbox?remix=${id}`);
      return;
    }

    setForking(true);
    const token = await getGitHubToken();
    if (!token) {
      setForking(false);
      sessionStorage.setItem('vpylab_pending_fork', JSON.stringify({
        sourceId: id,
        sourceRepo: currentWork.github_repo,
      }));
      signInWithGitHub();
      return;
    }

    const result = await forkWork({ sourceId: id, sourceRepo: currentWork.github_repo, githubToken: token });
    setForking(false);
    if (result.error) {
      alert((lang === 'ko' ? 'Fork 실패: ' : 'Fork failed: ') + result.error);
      return;
    }
    navigate(`/sandbox?edit=${result.data.id}`);
  };

  // Fork 초안 등 비공개 작품을 갤러리에 공개
  const handleMakePublic = async () => {
    if (!user) {
      useAuthStore.getState().setAuthModalOpen(true);
      return;
    }
    setMakingPublic(true);
    const result = await republishWork(id);
    setMakingPublic(false);
    if (result.error) {
      alert((lang === 'ko' ? '공개 실패: ' : 'Publish failed: ') + result.error);
      return;
    }
    alert(lang === 'ko'
      ? '작품이 갤러리에 공개되었습니다. 이제 누구나 실행하고 Remix할 수 있습니다.'
      : 'Your work is now public in the gallery.');
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(currentWork.code);
    } catch {
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
      <Header />

      <main className="gallery-detail-page" style={{ '--work-accent': meta.accent }}>
        <Link to="/gallery" className="gallery-detail-back">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {lang === 'ko' ? '갤러리로 돌아가기' : 'Back to gallery'}
        </Link>

        <section className="gallery-detail-hero">
          <div className="gallery-detail-stage">
            <img
              src={stageThumbnail}
              alt=""
              className={hasStageCapturedThumbnail ? 'captured' : 'poster'}
              onError={() => setDetailThumbnail({ id: currentWork.id, src: null })}
            />
            {hasStageCapturedThumbnail && <div className="gallery-detail-stage-label">{meta.label}</div>}
          </div>

          <div className="gallery-detail-copy">
            <div className="gallery-detail-kicker">
              <span>{meta.label}</span>
              {currentWork.github_repo && (
                <span>
                  <GitHubIcon size={13} />
                  {currentWork.github_repo}
                </span>
              )}
              {repoBroken && (
                <span style={{ color: '#E84393' }}>
                  {lang === 'ko' ? '저장소 연결 끊김' : 'Repo unavailable'}
                </span>
              )}
              {currentWork.is_public === false && (
                <span style={{ color: 'var(--color-text-secondary, #888)' }}>
                  {lang === 'ko' ? '비공개' : 'Private'}
                </span>
              )}
            </div>

            <h1>{currentWork.title}</h1>
            <p className="gallery-detail-meta">{author} · {date}</p>
            <p className="gallery-detail-description">
              {currentWork.description || '설명 없이 공개된 VPyLab 작품입니다. 코드를 열어 구조를 살펴보고 내 프로젝트로 발전시킬 수 있습니다.'}
            </p>

            {currentWork.originalWork && (
              <Link to={`/gallery/${currentWork.originalWork.id}`} className="gallery-origin-link">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                  <path d="M2 4l3-3v2h6a3 3 0 013 3v2h-2V6a1 1 0 00-1-1H5v2L2 4zm12 8l-3 3v-2H5a3 3 0 01-3-3v-2h2v2a1 1 0 001 1h6v-2l3 3z" />
                </svg>
                {lang === 'ko' ? '원작에서 Remix' : 'Remixed from'}: {currentWork.originalWork.title}
              </Link>
            )}

            {/* 원작 row가 삭제된 경우 — 비정규화된 스냅샷으로 출처 표기 유지 */}
            {!currentWork.originalWork && currentWork.remix_from_title && (
              <p className="gallery-origin-link" style={{ opacity: 0.75, cursor: 'default' }}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                  <path d="M2 4l3-3v2h6a3 3 0 013 3v2h-2V6a1 1 0 00-1-1H5v2L2 4zm12 8l-3 3v-2H5a3 3 0 01-3-3v-2h2v2a1 1 0 001 1h6v-2l3 3z" />
                </svg>
                {lang === 'ko'
                  ? `원작: ${currentWork.remix_from_title} by ${currentWork.remix_from_author || '익명'} (삭제됨)`
                  : `Original: ${currentWork.remix_from_title} by ${currentWork.remix_from_author || 'Anonymous'} (deleted)`}
              </p>
            )}

            <div className="gallery-detail-stats">
              <button
                className={`gallery-detail-like ${isLiked ? 'active' : ''}`}
                onClick={handleLike}
                type="button"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill={isLiked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                  <path d="M8 14s-5.5-3.5-5.5-7A3.5 3.5 0 018 4a3.5 3.5 0 015.5 3c0 3.5-5.5 7-5.5 7z" />
                </svg>
                {shortNumber(currentWork.like_count)}
              </button>
              <DetailStat label={lang === 'ko' ? '조회' : 'Views'} value={currentWork.view_count}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                  <path d="M8 3C4.5 3 1.5 5.5.5 8c1 2.5 4 5 7.5 5s6.5-2.5 7.5-5c-1-2.5-4-5-7.5-5zm0 8a3 3 0 110-6 3 3 0 010 6z" />
                </svg>
              </DetailStat>
              <DetailStat label="Remix" value={currentWork.remix_count}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                  <path d="M2 4l3-3v2h6a3 3 0 013 3v2h-2V6a1 1 0 00-1-1H5v2L2 4zm12 8l-3 3v-2H5a3 3 0 01-3-3v-2h2v2a1 1 0 001 1h6v-2l3 3z" />
                </svg>
              </DetailStat>
            </div>

            <div className="gallery-detail-actions">
              <button className="gallery-detail-action primary" onClick={handleRun} type="button">
                <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M5 2l9 6-9 6V2z" /></svg>
                VPyLab에서 실행
              </button>
              {isMyWork && currentWork.is_public === false && (
                <button
                  className="gallery-detail-action primary"
                  onClick={handleMakePublic}
                  disabled={makingPublic}
                  type="button"
                >
                  {makingPublic
                    ? (lang === 'ko' ? '공개 처리 중' : 'Publishing')
                    : (lang === 'ko' ? '갤러리에 공개하기' : 'Publish to gallery')}
                </button>
              )}
              <button className="gallery-detail-action" onClick={() => navigate(`/sandbox?remix=${id}`)} type="button">
                Remix 프로젝트
              </button>
              {isMyWork && currentWork.github_repo && (
                <button className="gallery-detail-action" onClick={() => navigate(`/sandbox?edit=${id}`)} type="button">
                  수정하기
                </button>
              )}
              {!isMyWork && currentWork.github_repo && (
                <button className="gallery-detail-action" onClick={handleFork} disabled={forking} type="button">
                  {forking ? 'Fork 준비 중' : 'GitHub Fork'}
                </button>
              )}
            </div>
          </div>
        </section>

        <section className="gallery-detail-open-source">
          <div>
            <p className="gallery-detail-section-label">Project Signals</p>
            <h2>{lang === 'ko' ? '코드와 기여 경로' : 'Code and contribution path'}</h2>
            <div className="gallery-detail-flags">
              {projectState.map(item => <span key={item}>{item}</span>)}
            </div>
          </div>
          <div className="gallery-detail-link-grid">
            {currentWork.github_url && (
              <a href={currentWork.github_url} target="_blank" rel="noopener noreferrer">Pages</a>
            )}
            {repoUrl && (
              <a href={repoUrl} target="_blank" rel="noopener noreferrer">
                <GitHubIcon size={14} />
                Repo
              </a>
            )}
            {issuesUrl && (
              <a href={issuesUrl} target="_blank" rel="noopener noreferrer">Issue 남기기</a>
            )}
            <button onClick={() => setShowCode(value => !value)} type="button">
              {showCode ? '코드 닫기' : '코드 보기'}
            </button>
            <button onClick={() => setShowPreview(value => !value)} type="button">
              {showPreview ? '미리보기 닫기' : '3D 미리보기'}
            </button>
          </div>
        </section>

        {showCode && (
          <section className="gallery-code-panel">
            <div className="gallery-code-panel-head">
              <span>main.py</span>
              <button onClick={handleCopyCode} type="button">{copied ? '복사됨' : '코드 복사'}</button>
            </div>
            <pre><code>{currentWork.code}</code></pre>
          </section>
        )}

        {showPreview && (
          <section className="gallery-preview-panel">
            <Suspense fallback={<div className="gallery-preview-loading">Python 엔진을 준비하고 있습니다.</div>}>
              <GalleryPreview code={currentWork.code} />
            </Suspense>
          </section>
        )}

        {currentWork.remixes?.length > 0 && (
          <section className="gallery-remix-section">
            <div className="gallery-section-head compact">
              <div>
                <h2>Remix</h2>
                <p>{lang === 'ko' ? '이 작품에서 이어진 공개 프로젝트입니다.' : 'Published projects that build from this work.'}</p>
              </div>
            </div>
            <div className="gallery-grid">
              {currentWork.remixes.map(remix => (
                <GalleryCard key={remix.id} work={remix} />
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

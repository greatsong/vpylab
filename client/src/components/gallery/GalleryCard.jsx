import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ensureAudioReady } from '../../engine/sound-system';
import useGalleryStore from '../../stores/galleryStore';

const CATEGORY_META = {
  CT: { label: '컴퓨팅', accent: '#4A6CF7', mark: 'CT' },
  CR: { label: '창작', accent: '#E84393', mark: 'CR' },
  MA: { label: '수학', accent: '#00CEC9', mark: 'MA' },
  SC: { label: '과학', accent: '#00B894', mark: 'SC' },
  AR: { label: '아트', accent: '#F0883E', mark: 'AR' },
  SN: { label: '사운드', accent: '#6C5CE7', mark: 'SN' },
  free: { label: '자유', accent: '#2563EB', mark: 'VP' },
};

function shortNumber(value) {
  const n = Number(value || 0);
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return String(n);
}

function Stat({ icon, value, label }) {
  return (
    <span className="gallery-work-stat" title={label}>
      {icon}
      {shortNumber(value)}
    </span>
  );
}

export default function GalleryCard({ work }) {
  const navigate = useNavigate();
  const fetchThumbnail = useGalleryStore(s => s.fetchThumbnail);
  const [thumbnail, setThumbnail] = useState(null);
  const [thumbnailLoaded, setThumbnailLoaded] = useState(false);
  const author = work.vpylab_profiles?.display_name || work.author_alias || '익명';
  const meta = CATEGORY_META[work.category] || CATEGORY_META.free;
  const hasRepo = !!work.github_repo;
  const hasPages = !!work.github_url;

  useEffect(() => {
    let alive = true;
    fetchThumbnail(work.id).then(src => {
      if (!alive) return;
      setThumbnail(src || null);
      setThumbnailLoaded(true);
    });
    return () => { alive = false; };
  }, [fetchThumbnail, work.id]);

  const handlePlay = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    await ensureAudioReady();
    if (work.github_repo) {
      navigate(`/sandbox?repo=${encodeURIComponent(work.github_repo)}&autorun=1`);
      return;
    }
    navigate(`/sandbox?play=${work.id}`);
  };

  const handleRemix = (e) => {
    e.preventDefault();
    e.stopPropagation();
    navigate(`/sandbox?remix=${work.id}`);
  };

  return (
    <article className="gallery-card" style={{ '--work-accent': meta.accent }}>
      <Link to={`/gallery/${work.id}`} className="gallery-card-main" aria-label={`${work.title} 상세 보기`}>
        <div className="gallery-card-thumb">
          {thumbnail ? (
            <img src={thumbnail} alt="" loading="lazy" />
          ) : (
            <div className={`gallery-card-fallback ${thumbnailLoaded ? 'ready' : ''}`}>
              <span>{meta.mark}</span>
              <div className="code-lines" aria-hidden="true">
                <i />
                <i />
                <i />
              </div>
            </div>
          )}
          <div className="gallery-card-topline">
            <span className="gallery-category">{meta.label}</span>
            {hasPages && <span className="gallery-mini-badge">Pages</span>}
          </div>
        </div>

        <div className="gallery-card-info">
          <div className="gallery-card-title-row">
            <h3>{work.title}</h3>
            {hasRepo && (
              <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor" aria-label="GitHub 저장소 있음">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
              </svg>
            )}
          </div>

          <p className="gallery-card-desc">{work.description || '설명 없이 공개된 VPyLab 작품입니다.'}</p>

          <div className="gallery-card-meta">
            <span>{author}</span>
            <span>{new Date(work.created_at).toLocaleDateString('ko-KR')}</span>
          </div>

          <div className="gallery-card-stats">
            <Stat
              label="좋아요"
              value={work.like_count}
              icon={<svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><path d="M8 14s-5.5-3.5-5.5-7A3.5 3.5 0 018 4a3.5 3.5 0 015.5 3c0 3.5-5.5 7-5.5 7z" /></svg>}
            />
            <Stat
              label="조회"
              value={work.view_count}
              icon={<svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><path d="M8 3C4.5 3 1.5 5.5.5 8c1 2.5 4 5 7.5 5s6.5-2.5 7.5-5c-1-2.5-4-5-7.5-5zm0 8a3 3 0 110-6 3 3 0 010 6z" /></svg>}
            />
            <Stat
              label="Remix"
              value={work.remix_count}
              icon={<svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><path d="M2 4l3-3v2h6a3 3 0 013 3v2h-2V6a1 1 0 00-1-1H5v2L2 4zm12 8l-3 3v-2H5a3 3 0 01-3-3v-2h2v2a1 1 0 001 1h6v-2l3 3z" /></svg>}
            />
          </div>
        </div>
      </Link>

      <div className="gallery-card-actions">
        <button onClick={handlePlay} className="gallery-card-run" type="button">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><path d="M5 2l9 6-9 6V2z" /></svg>
          실행
        </button>
        <button onClick={handleRemix} className="gallery-card-remix" type="button">
          Remix
        </button>
      </div>
    </article>
  );
}

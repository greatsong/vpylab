import { Link, useNavigate } from 'react-router-dom';

export default function GalleryCard({ work }) {
  const navigate = useNavigate();
  const author = work.vpylab_profiles?.display_name || '익명';

  const handlePlay = (e) => {
    e.preventDefault();
    e.stopPropagation();
    navigate(`/sandbox?play=${work.id}`);
  };

  return (
    <Link to={`/gallery/${work.id}`} className="gallery-card">
      <div className="gallery-card-thumb">
        {work.thumbnail ? (
          <img src={work.thumbnail} alt={work.title} loading="lazy" />
        ) : (
          <div className="gallery-card-placeholder">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <rect x="4" y="4" width="24" height="24" rx="4" stroke="var(--color-text-muted)" strokeWidth="1.5" opacity="0.4"/>
              <circle cx="13" cy="14" r="3" fill="var(--color-text-muted)" opacity="0.3"/>
              <path d="M4 24L12 18L18 22L24 16L28 20" stroke="var(--color-text-muted)" strokeWidth="1.5" opacity="0.3"/>
            </svg>
          </div>
        )}
        <button className="play-overlay" onClick={handlePlay} title="Play">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="currentColor">
            <path d="M11 6l16 10-16 10V6z"/>
          </svg>
        </button>
        {work.github_url && <span className="github-badge">Pages</span>}
      </div>

      <div className="gallery-card-info">
        <h3>{work.title}</h3>
        <p className="gallery-card-author">{author}</p>
        <div className="gallery-card-stats">
          <span>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="var(--color-error)" style={{ verticalAlign: '-1px', marginRight: '3px' }}>
              <path d="M8 14s-5.5-3.5-5.5-7A3.5 3.5 0 018 4a3.5 3.5 0 015.5 3c0 3.5-5.5 7-5.5 7z"/>
            </svg>
            {work.like_count || 0}
          </span>
          <span>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="var(--color-text-muted)" style={{ verticalAlign: '-1px', marginRight: '3px' }}>
              <path d="M8 3C4.5 3 1.5 5.5.5 8c1 2.5 4 5 7.5 5s6.5-2.5 7.5-5c-1-2.5-4-5-7.5-5zm0 8a3 3 0 110-6 3 3 0 010 6z"/>
            </svg>
            {work.view_count || 0}
          </span>
          {work.remix_count > 0 && (
            <span>
              <svg width="12" height="12" viewBox="0 0 16 16" fill="var(--color-text-muted)" style={{ verticalAlign: '-1px', marginRight: '3px' }}>
                <path d="M2 4l3-3v2h6a3 3 0 013 3v2h-2V6a1 1 0 00-1-1H5v2L2 4zm12 8l-3 3v-2H5a3 3 0 01-3-3v-2h2v2a1 1 0 001 1h6v-2l3 3z"/>
              </svg>
              {work.remix_count}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

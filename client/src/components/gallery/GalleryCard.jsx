import { Link } from 'react-router-dom';

export default function GalleryCard({ work }) {
  const author = work.vpylab_profiles?.display_name || '익명';

  return (
    <Link to={`/gallery/${work.id}`} className="gallery-card">
      {/* 썸네일 */}
      <div className="gallery-card-thumb">
        {work.thumbnail ? (
          <img src={work.thumbnail} alt={work.title} loading="lazy" />
        ) : (
          <div className="gallery-card-placeholder">
            <span>🎨</span>
          </div>
        )}
        {work.github_url && <span className="github-badge">Pages</span>}
      </div>

      {/* 정보 */}
      <div className="gallery-card-info">
        <h3>{work.title}</h3>
        <p className="gallery-card-author">{author}</p>
        <div className="gallery-card-stats">
          <span>❤️ {work.like_count || 0}</span>
          <span>👁️ {work.view_count || 0}</span>
          {work.remix_count > 0 && <span>🔀 {work.remix_count}</span>}
        </div>
      </div>

      <style>{`
        .gallery-card {
          display: block; text-decoration: none; color: inherit;
          background: var(--bg-secondary, #161b22); border-radius: 10px;
          border: 1px solid var(--border, #30363d); overflow: hidden;
          transition: transform 0.2s, border-color 0.2s;
        }
        .gallery-card:hover {
          transform: translateY(-2px);
          border-color: var(--accent, #6C5CE7);
        }
        .gallery-card-thumb {
          position: relative; aspect-ratio: 16/10; overflow: hidden;
          background: linear-gradient(135deg, #1a1e2e 0%, #2d1f3d 100%);
        }
        .gallery-card-thumb img { width: 100%; height: 100%; object-fit: cover; }
        .gallery-card-placeholder {
          width: 100%; height: 100%; display: flex;
          align-items: center; justify-content: center; font-size: 32px;
        }
        .github-badge {
          position: absolute; top: 6px; right: 6px;
          background: rgba(35,134,54,0.9); color: white;
          padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 600;
        }
        .gallery-card-info { padding: 10px 12px; }
        .gallery-card-info h3 {
          margin: 0; font-size: 14px; font-weight: 600;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .gallery-card-author {
          margin: 2px 0 6px; font-size: 12px; color: var(--text-secondary, #8b949e);
        }
        .gallery-card-stats {
          display: flex; gap: 10px; font-size: 12px; color: var(--text-secondary, #8b949e);
        }
      `}</style>
    </Link>
  );
}

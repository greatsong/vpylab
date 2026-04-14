import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import useGalleryStore from '../stores/galleryStore';
import useAuthStore from '../stores/authStore';
import GalleryCard from '../components/gallery/GalleryCard';

export default function GalleryDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentWork, loading, fetchWork, toggleLike, checkIfLiked } = useGalleryStore();
  const user = useAuthStore(s => s.user);
  const [isLiked, setIsLiked] = useState(false);
  const [showCode, setShowCode] = useState(false);

  useEffect(() => {
    fetchWork(id);
  }, [id]);

  useEffect(() => {
    if (currentWork && user) {
      checkIfLiked(id).then(setIsLiked);
    }
  }, [currentWork, user]);

  if (loading || !currentWork) {
    return <div className="gallery-detail-loading">로딩 중...</div>;
  }

  const author = currentWork.vpylab_profiles?.display_name || '익명';
  const date = new Date(currentWork.created_at).toLocaleDateString('ko-KR');

  const handleLike = async () => {
    if (!user) return;
    const liked = await toggleLike(id);
    setIsLiked(liked);
  };

  const handleRemix = () => {
    // Sandbox로 이동하면서 코드와 remixFrom 전달
    navigate(`/sandbox?remix=${id}`);
  };

  return (
    <div className="gallery-detail">
      {/* 상단: 썸네일 + 정보 */}
      <div className="detail-main">
        {/* 썸네일 */}
        <div className="detail-visual">
          {currentWork.thumbnail ? (
            <img src={currentWork.thumbnail} alt={currentWork.title} />
          ) : (
            <div className="detail-placeholder">🎨</div>
          )}
        </div>

        {/* 정보 패널 */}
        <div className="detail-info">
          <h1>{currentWork.title}</h1>
          <p className="detail-author">{author} · {date}</p>

          {currentWork.description && (
            <p className="detail-desc">{currentWork.description}</p>
          )}

          {/* 영감 표시 */}
          {currentWork.originalWork && (
            <Link to={`/gallery/${currentWork.originalWork.id}`} className="inspired-badge">
              🔀 영감: {currentWork.originalWork.vpylab_profiles?.display_name}의
              "{currentWork.originalWork.title}"
            </Link>
          )}

          {/* 통계 */}
          <div className="detail-stats">
            <button
              className={`like-btn ${isLiked ? 'liked' : ''}`}
              onClick={handleLike}
              disabled={!user}
              title={user ? '' : '로그인이 필요합니다'}
            >
              {isLiked ? '❤️' : '🤍'} {currentWork.like_count || 0}
            </button>
            <span>👁️ {currentWork.view_count || 0}</span>
            <span>🔀 {currentWork.remix_count || 0}</span>
          </div>

          {/* 액션 버튼 */}
          <div className="detail-actions">
            <button onClick={handleRemix} className="btn-remix">
              🔀 Remix (내 코드로 열기)
            </button>
            {currentWork.github_url && (
              <a href={currentWork.github_url} target="_blank" rel="noopener noreferrer" className="btn-github-pages">
                🌐 GitHub Pages에서 보기
              </a>
            )}
            <button onClick={() => setShowCode(!showCode)} className="btn-code">
              {showCode ? '코드 숨기기' : '📝 코드 보기'}
            </button>
          </div>
        </div>
      </div>

      {/* 코드 영역 */}
      {showCode && (
        <div className="detail-code">
          <div className="code-header">
            <span>Python 코드</span>
            <button onClick={() => navigator.clipboard.writeText(currentWork.code)}>
              복사
            </button>
          </div>
          <pre><code>{currentWork.code}</code></pre>
        </div>
      )}

      {/* Remix 목록 */}
      {currentWork.remixes?.length > 0 && (
        <div className="detail-remixes">
          <h2>🔀 이 작품에서 영감을 받은 Remix ({currentWork.remixes.length})</h2>
          <div className="remix-grid">
            {currentWork.remixes.map(remix => (
              <GalleryCard key={remix.id} work={remix} />
            ))}
          </div>
        </div>
      )}

      <style>{`
        .gallery-detail {
          max-width: 1000px; margin: 0 auto; padding: 24px 16px;
        }
        .gallery-detail-loading {
          text-align: center; padding: 80px 0; color: var(--text-secondary, #8b949e);
        }
        .detail-main {
          display: grid; grid-template-columns: 1.2fr 1fr; gap: 24px; margin-bottom: 24px;
        }
        .detail-visual {
          aspect-ratio: 16/10; border-radius: 12px; overflow: hidden;
          background: linear-gradient(135deg, #1a1e2e, #2d1f3d);
        }
        .detail-visual img { width: 100%; height: 100%; object-fit: cover; }
        .detail-placeholder {
          width: 100%; height: 100%; display: flex;
          align-items: center; justify-content: center; font-size: 64px;
        }
        .detail-info h1 { margin: 0 0 4px; font-size: 22px; }
        .detail-author { color: var(--text-secondary, #8b949e); font-size: 13px; margin: 0 0 12px; }
        .detail-desc { font-size: 14px; line-height: 1.5; margin: 0 0 12px; }
        .inspired-badge {
          display: inline-block; background: rgba(108,92,231,0.15);
          border: 1px solid rgba(108,92,231,0.3); padding: 6px 12px;
          border-radius: 6px; font-size: 13px; color: var(--text-primary);
          text-decoration: none; margin-bottom: 12px;
        }
        .inspired-badge:hover { border-color: var(--accent, #6C5CE7); }

        .detail-stats {
          display: flex; align-items: center; gap: 16px; margin-bottom: 16px; font-size: 14px;
        }
        .like-btn {
          background: transparent; border: 1px solid var(--border, #30363d);
          border-radius: 6px; padding: 4px 10px; cursor: pointer; font-size: 14px;
          color: var(--text-secondary);
        }
        .like-btn.liked { border-color: #f85149; color: #f85149; }
        .like-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .detail-actions { display: flex; flex-wrap: wrap; gap: 8px; }
        .btn-remix {
          padding: 10px 20px; border-radius: 8px; border: none; cursor: pointer;
          background: var(--accent, #6C5CE7); color: white; font-weight: 600; font-size: 14px;
        }
        .btn-github-pages {
          padding: 10px 20px; border-radius: 8px; text-decoration: none;
          background: #238636; color: white; font-size: 14px; font-weight: 600;
        }
        .btn-code {
          padding: 10px 20px; border-radius: 8px; cursor: pointer; font-size: 14px;
          border: 1px solid var(--border, #30363d); background: transparent;
          color: var(--text-secondary, #8b949e);
        }

        .detail-code {
          background: var(--bg-secondary, #161b22); border-radius: 10px;
          border: 1px solid var(--border, #30363d); margin-bottom: 24px; overflow: hidden;
        }
        .code-header {
          display: flex; justify-content: space-between; align-items: center;
          padding: 8px 16px; border-bottom: 1px solid var(--border, #30363d); font-size: 13px;
        }
        .code-header button {
          background: transparent; border: 1px solid var(--border); border-radius: 4px;
          padding: 2px 10px; color: var(--text-secondary); cursor: pointer; font-size: 12px;
        }
        .detail-code pre {
          padding: 16px; margin: 0; overflow-x: auto; font-family: 'JetBrains Mono', monospace;
          font-size: 13px; line-height: 1.5; max-height: 400px; overflow-y: auto;
        }

        .detail-remixes { margin-top: 32px; }
        .detail-remixes h2 { font-size: 18px; margin: 0 0 16px; }
        .remix-grid {
          display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px;
        }

        @media (max-width: 700px) {
          .detail-main { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useGalleryStore from '../../stores/galleryStore';
import useAuthStore from '../../stores/authStore';
// export-html은 큰 모듈이므로 발행 시점에 lazy import


const CATEGORIES = [
  { value: 'free', label: '자유', en: 'Free' },
  { value: 'CT', label: '컴퓨팅 사고', en: 'CT' },
  { value: 'CR', label: '창작', en: 'Creative' },
  { value: 'MA', label: '수학', en: 'Math' },
  { value: 'SC', label: '과학', en: 'Science' },
  { value: 'AR', label: '아트', en: 'Art' },
  { value: 'SN', label: '사운드', en: 'Sound' },
];

export default function PublishModal({ isOpen, onClose, code, thumbnail, remixFrom }) {
  const navigate = useNavigate();
  const publishWork = useGalleryStore(s => s.publishWork);
  const publishing = useGalleryStore(s => s.publishing);
  const getGitHubToken = useAuthStore(s => s.getGitHubToken);
  const isGitHubUser = useAuthStore(s => s.isGitHubUser);
  const signInWithGitHub = useAuthStore(s => s.signInWithGitHub);
  const profile = useAuthStore(s => s.profile);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [authorAlias, setAuthorAlias] = useState(profile?.display_name || '');
  const [category, setCategory] = useState('free');
  const [publishToGitHub, setPublishToGitHub] = useState(true);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [githubTokenExpired, setGithubTokenExpired] = useState(false);

  if (!isOpen) return null;

  const handlePublish = async () => {
    if (!title.trim()) {
      setError('제목을 입력해주세요.');
      return;
    }
    if (!code?.trim()) {
      setError('코드가 비어있습니다.');
      return;
    }

    setError(null);
    setResult(null);

    try {
      let githubToken = null;
      let htmlContent = null;

      // GitHub Pages 발행 옵션이 켜져 있고 GitHub 로그인된 경우
      if (publishToGitHub && isGitHubUser()) {
        githubToken = await getGitHubToken();
        if (githubToken) {
          const { generateStandaloneHTML } = await import('../../utils/export-html');
          htmlContent = generateStandaloneHTML(code, title.trim());
        } else {
          setGithubTokenExpired(true);
          // 경고 표시하지만 갤러리에는 발행 가능하도록 진행
        }
      }

      const res = await publishWork({
        title: title.trim(),
        description: description.trim(),
        code,
        thumbnail,
        category,
        remixFrom,
        htmlContent,
        githubToken,
        authorAlias: authorAlias.trim() || '익명',
      });

      if (res.error) {
        setError(res.error);
      } else {
        setResult(res);
      }
    } catch (err) {
      console.error('[Publish] 오류:', err);
      setError(err.message || '발행 중 오류가 발생했습니다.');
    }
  };

  const handleClose = () => {
    setTitle('');
    setDescription('');
    setAuthorAlias(profile?.display_name || '');
    setCategory('free');
    setResult(null);
    setError(null);
    setGithubTokenExpired(false);
    onClose();
  };

  const handleGoToGallery = () => {
    handleClose();
    if (result?.data?.id) {
      navigate(`/gallery/${result.data.id}`);
    } else {
      navigate('/gallery');
    }
  };

  return (
    <div className="publish-modal-overlay" onClick={handleClose}>
      <div className="publish-modal" onClick={e => e.stopPropagation()}>
        {/* 발행 성공 */}
        {result ? (
          <div className="publish-success">
            <div className="success-icon">
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                <circle cx="24" cy="24" r="24" fill="url(#successGrad)" />
                <path d="M15 24L21 30L33 18" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                <defs><linearGradient id="successGrad" x1="0" y1="0" x2="48" y2="48">
                  <stop stopColor="#00B894" /><stop offset="1" stopColor="#00CEC9" />
                </linearGradient></defs>
              </svg>
            </div>
            <h2>발행 완료!</h2>
            <p className="success-desc">작품이 갤러리에 올라갔습니다.</p>
            {result.githubUrl && (
              <div className="github-url-box">
                <p>GitHub Pages URL</p>
                <a href={result.githubUrl} target="_blank" rel="noopener noreferrer">
                  {result.githubUrl}
                </a>
                <button
                  onClick={() => navigator.clipboard.writeText(result.githubUrl)}
                  className="copy-btn"
                >
                  URL 복사
                </button>
              </div>
            )}
            {result.warnings?.length > 0 && (
              <div className="publish-warnings">
                {result.warnings.map((w, i) => (
                  <p key={i}>⚠️ {w}</p>
                ))}
              </div>
            )}
            <div className="publish-actions">
              <button onClick={handleGoToGallery} className="btn-primary">갤러리에서 보기</button>
              <button onClick={handleClose} className="btn-secondary">닫기</button>
            </div>
          </div>
        ) : (
          <>
            <div className="modal-header">
              <h2>갤러리에 올리기</h2>
              <button className="close-btn" onClick={handleClose} aria-label="닫기">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M15 5L5 15M5 5l10 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {/* 썸네일 미리보기 */}
            {thumbnail && (
              <div className="thumbnail-preview">
                <img src={thumbnail} alt="미리보기" />
              </div>
            )}

            {/* 영감 표시 */}
            {remixFrom && (
              <div className="remix-badge">
                <span className="remix-icon">🔀</span> 다른 작품에서 영감을 받은 Remix
              </div>
            )}

            {/* 제목 */}
            <label>
              제목 <span className="required">*</span>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="작품 제목을 입력하세요"
                maxLength={100}
                autoFocus
              />
            </label>

            {/* 공개 이름 */}
            <label>
              공개 이름
              <div className="author-alias-row">
                <input
                  type="text"
                  value={authorAlias}
                  onChange={e => setAuthorAlias(e.target.value)}
                  placeholder="갤러리에 표시될 이름"
                  maxLength={30}
                />
                <button
                  type="button"
                  className={`anon-btn ${!authorAlias.trim() ? 'active' : ''}`}
                  onClick={() => setAuthorAlias('')}
                >
                  익명
                </button>
              </div>
            </label>

            {/* 설명 */}
            <label>
              설명
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="작품에 대한 설명 (선택)"
                maxLength={500}
                rows={3}
              />
            </label>

            {/* 카테고리 */}
            <label>
              카테고리
              <div className="category-pills">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat.value}
                    className={`pill ${category === cat.value ? 'active' : ''}`}
                    onClick={() => setCategory(cat.value)}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </label>

            {/* GitHub Pages 발행 옵션 */}
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={publishToGitHub}
                onChange={e => setPublishToGitHub(e.target.checked)}
              />
              GitHub Pages로 발행 (고유 URL 생성)
            </label>

            {publishToGitHub && !isGitHubUser() && (
              <div className="github-login-prompt">
                <p>GitHub Pages 발행을 위해 GitHub 로그인이 필요합니다.</p>
                <button onClick={signInWithGitHub} className="btn-github">
                  GitHub으로 로그인
                </button>
              </div>
            )}

            {/* GitHub 토큰 만료 경고 */}
            {githubTokenExpired && (
              <div className="github-token-warning">
                <span>⚠️</span>
                <div>
                  <p>GitHub 인증이 만료되었습니다.</p>
                  <p>갤러리에만 발행됩니다. GitHub Pages도 원하시면 재로그인해주세요.</p>
                  <button onClick={signInWithGitHub} className="btn-github-small">
                    GitHub 재로그인
                  </button>
                </div>
              </div>
            )}

            {/* 에러 */}
            {error && <div className="publish-error">{error}</div>}

            {/* 버튼 */}
            <div className="publish-actions">
              <button
                onClick={handlePublish}
                disabled={publishing || !title.trim()}
                className="btn-primary"
              >
                {publishing ? (
                  <span className="publishing-state">
                    <span className="spinner" />
                    발행 중...
                  </span>
                ) : '발행하기'}
              </button>
              <button onClick={handleClose} className="btn-secondary">취소</button>
            </div>
          </>
        )}
      </div>

      <style>{`
        .publish-modal-overlay {
          position: fixed; inset: 0;
          background: rgba(0,0,0,0.5);
          backdrop-filter: blur(4px);
          display: flex; align-items: center; justify-content: center;
          z-index: 1000;
          animation: fadeIn 0.2s ease;
        }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(16px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        .publish-modal {
          background: var(--color-bg-panel, #1E1E24);
          border-radius: var(--radius-lg, 16px);
          padding: 28px;
          width: 90%; max-width: 480px; max-height: 90vh; overflow-y: auto;
          border: 1px solid var(--color-border, #2E2E38);
          box-shadow: 0 20px 60px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.05) inset;
          animation: slideUp 0.25s ease;
          font-family: var(--font-body, 'DM Sans', sans-serif);
        }

        .modal-header {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 20px;
        }
        .modal-header h2 {
          margin: 0; font-size: 20px; font-weight: 700;
          font-family: var(--font-display, 'Satoshi', sans-serif);
          color: var(--color-text-primary, #FFFFFE);
        }
        .close-btn {
          background: none; border: none; cursor: pointer; padding: 4px;
          color: var(--color-text-muted, #72757E); border-radius: 6px;
          transition: all 0.15s;
        }
        .close-btn:hover { background: var(--color-bg-tertiary, #26262E); color: var(--color-text-primary, #FFFFFE); }

        .publish-modal label {
          display: block; margin-bottom: 16px;
          font-size: 13px; font-weight: 500;
          color: var(--color-text-secondary, #94A1B2);
        }
        .publish-modal input[type="text"],
        .publish-modal textarea {
          display: block; width: 100%; margin-top: 6px;
          padding: 10px 14px;
          background: var(--color-bg-primary, #16161A);
          border: 1px solid var(--color-border, #2E2E38);
          border-radius: var(--radius-md, 12px);
          color: var(--color-text-primary, #FFFFFE);
          font-size: 14px; font-family: inherit;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .publish-modal input[type="text"]:focus,
        .publish-modal textarea:focus {
          outline: none;
          border-color: var(--color-accent, #7F5AF0);
          box-shadow: 0 0 0 3px var(--color-accent-bg, rgba(127, 90, 240, 0.12));
        }
        .publish-modal textarea { resize: vertical; }
        .required { color: var(--color-error, #FF6B6B); }

        .thumbnail-preview {
          margin-bottom: 16px; border-radius: var(--radius-md, 12px);
          overflow: hidden; border: 1px solid var(--color-border, #2E2E38);
        }
        .thumbnail-preview img { width: 100%; height: auto; display: block; }

        .remix-badge {
          background: var(--color-accent-bg, rgba(127, 90, 240, 0.12));
          border: 1px solid rgba(127, 90, 240, 0.25);
          padding: 10px 14px; border-radius: var(--radius-md, 12px);
          margin-bottom: 16px; font-size: 13px;
          color: var(--color-text-secondary, #94A1B2);
          display: flex; align-items: center; gap: 6px;
        }
        .remix-icon { font-size: 16px; }

        .category-pills { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
        .pill {
          padding: 6px 14px; border-radius: var(--radius-full, 9999px);
          border: 1px solid var(--color-border, #2E2E38);
          background: transparent;
          color: var(--color-text-secondary, #94A1B2);
          cursor: pointer; font-size: 13px; font-weight: 500;
          transition: all 0.15s;
        }
        .pill:hover { border-color: var(--color-accent, #7F5AF0); color: var(--color-text-primary, #FFFFFE); }
        .pill.active {
          background: linear-gradient(135deg, var(--brand-purple, #6C5CE7), var(--brand-blue, #4A6CF7));
          color: white;
          border-color: transparent;
          box-shadow: 0 2px 8px rgba(108, 92, 231, 0.3);
        }

        .checkbox-label {
          display: flex !important; align-items: center; gap: 10px; cursor: pointer;
          padding: 10px 14px; border-radius: var(--radius-md, 12px);
          background: var(--color-bg-primary, #16161A);
          border: 1px solid var(--color-border, #2E2E38);
          margin-bottom: 16px;
          transition: border-color 0.15s;
        }
        .checkbox-label:hover { border-color: var(--color-accent, #7F5AF0); }
        .checkbox-label input[type="checkbox"] {
          width: 16px; height: 16px; margin: 0;
          accent-color: var(--color-accent, #7F5AF0);
        }

        .github-login-prompt {
          background: var(--color-bg-primary, #16161A);
          padding: 14px; border-radius: var(--radius-md, 12px);
          margin-bottom: 16px;
          border: 1px solid var(--color-border, #2E2E38);
        }
        .github-login-prompt p { margin: 0 0 10px; font-size: 13px; color: var(--color-text-secondary, #94A1B2); }
        .btn-github {
          padding: 8px 18px; border-radius: var(--radius-sm, 6px);
          border: none; cursor: pointer;
          background: #238636; color: white; font-size: 13px; font-weight: 600;
          transition: background 0.15s;
        }
        .btn-github:hover { background: #2ea043; }

        .publish-error {
          background: rgba(255, 107, 107, 0.1);
          border: 1px solid rgba(255, 107, 107, 0.25);
          color: var(--color-error, #FF6B6B);
          font-size: 13px; padding: 10px 14px;
          border-radius: var(--radius-md, 12px);
          margin: 8px 0;
        }

        .publish-actions { display: flex; gap: 10px; margin-top: 20px; }
        .btn-primary {
          flex: 1; padding: 12px; border-radius: var(--radius-md, 12px);
          border: none; cursor: pointer;
          background: linear-gradient(135deg, var(--brand-purple, #6C5CE7), var(--brand-blue, #4A6CF7));
          color: white; font-weight: 700; font-size: 15px;
          font-family: var(--font-display, 'Satoshi', sans-serif);
          transition: opacity 0.15s, transform 0.15s;
          box-shadow: 0 4px 14px rgba(108, 92, 231, 0.35);
        }
        .btn-primary:hover:not(:disabled) { opacity: 0.9; transform: translateY(-1px); }
        .btn-primary:active:not(:disabled) { transform: translateY(0); }
        .btn-primary:disabled { opacity: 0.4; cursor: not-allowed; box-shadow: none; }

        .btn-secondary {
          padding: 12px 20px; border-radius: var(--radius-md, 12px);
          border: 1px solid var(--color-border, #2E2E38);
          background: transparent;
          color: var(--color-text-secondary, #94A1B2);
          cursor: pointer; font-size: 14px; font-weight: 500;
          transition: all 0.15s;
        }
        .btn-secondary:hover {
          border-color: var(--color-text-muted, #72757E);
          color: var(--color-text-primary, #FFFFFE);
        }

        .publishing-state { display: flex; align-items: center; justify-content: center; gap: 8px; }
        .spinner {
          width: 16px; height: 16px;
          border: 2px solid rgba(255,255,255,0.25);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
        }

        .publish-success { text-align: center; padding: 8px 0; }
        .success-icon { margin-bottom: 16px; }
        .publish-success h2 {
          font-size: 22px; margin: 0 0 6px;
          font-family: var(--font-display, 'Satoshi', sans-serif);
          color: var(--color-text-primary, #FFFFFE);
        }
        .success-desc { color: var(--color-text-secondary, #94A1B2); font-size: 14px; margin: 0 0 20px; }

        .github-url-box {
          background: rgba(0, 206, 201, 0.08);
          border: 1px solid rgba(0, 206, 201, 0.2);
          padding: 14px; border-radius: var(--radius-md, 12px);
          margin-bottom: 16px; text-align: left;
        }
        .github-url-box p { margin: 0 0 6px; font-size: 12px; color: var(--color-text-muted, #72757E); font-weight: 500; }
        .github-url-box a { color: var(--brand-cyan, #00CEC9); word-break: break-all; font-size: 13px; }
        .copy-btn {
          margin-top: 10px; padding: 6px 14px; border-radius: var(--radius-sm, 6px);
          border: 1px solid var(--color-border, #2E2E38);
          background: transparent; color: var(--color-text-secondary, #94A1B2);
          cursor: pointer; font-size: 12px;
          transition: all 0.15s;
        }
        .copy-btn:hover { border-color: var(--brand-cyan, #00CEC9); color: var(--brand-cyan, #00CEC9); }

        .publish-warnings { margin: 8px 0; }
        .publish-warnings p { font-size: 12px; color: var(--color-warning, #FDCB6E); margin: 4px 0; }

        .author-alias-row {
          display: flex; gap: 8px; margin-top: 6px;
        }
        .author-alias-row input { flex: 1; }
        .anon-btn {
          padding: 8px 14px; border-radius: var(--radius-md, 12px);
          border: 1px solid var(--color-border, #2E2E38);
          background: transparent;
          color: var(--color-text-secondary, #94A1B2);
          cursor: pointer; font-size: 13px; white-space: nowrap;
          transition: all 0.15s;
        }
        .anon-btn.active {
          background: var(--color-accent-bg, rgba(127, 90, 240, 0.12));
          border-color: var(--color-accent, #7F5AF0);
          color: var(--color-accent, #7F5AF0);
        }

        .github-token-warning {
          display: flex; gap: 10px; align-items: flex-start;
          background: rgba(253, 203, 110, 0.08);
          border: 1px solid rgba(253, 203, 110, 0.25);
          padding: 12px 14px; border-radius: var(--radius-md, 12px);
          margin: 8px 0; font-size: 13px;
          color: var(--color-warning, #FDCB6E);
        }
        .github-token-warning p { margin: 0 0 6px; }
        .btn-github-small {
          padding: 5px 12px; border-radius: var(--radius-sm, 6px);
          border: none; cursor: pointer;
          background: #238636; color: white; font-size: 12px; font-weight: 600;
        }
      `}</style>
    </div>
  );
}

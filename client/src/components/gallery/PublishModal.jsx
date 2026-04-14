import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useGalleryStore from '../../stores/galleryStore';
import useAuthStore from '../../stores/authStore';
import { generateStandaloneHTML } from '../../utils/export-html';
import { useI18n } from '../../i18n';

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
  const { t } = useI18n();
  const navigate = useNavigate();
  const publishWork = useGalleryStore(s => s.publishWork);
  const publishing = useGalleryStore(s => s.publishing);
  const getGitHubToken = useAuthStore(s => s.getGitHubToken);
  const isGitHubUser = useAuthStore(s => s.isGitHubUser);
  const signInWithGitHub = useAuthStore(s => s.signInWithGitHub);
  const user = useAuthStore(s => s.user);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('free');
  const [publishToGitHub, setPublishToGitHub] = useState(true);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

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

    let githubToken = null;
    let htmlContent = null;

    // GitHub Pages 발행 옵션이 켜져 있고 GitHub 로그인된 경우
    if (publishToGitHub && isGitHubUser()) {
      githubToken = await getGitHubToken();
      if (githubToken) {
        htmlContent = generateStandaloneHTML(code, title.trim());
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
    });

    if (res.error) {
      setError(res.error);
    } else {
      setResult(res);
    }
  };

  const handleClose = () => {
    setTitle('');
    setDescription('');
    setCategory('free');
    setResult(null);
    setError(null);
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
            <h2>🎉 발행 완료!</h2>
            {result.githubUrl && (
              <div className="github-url-box">
                <p>GitHub Pages URL:</p>
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
            <h2>갤러리에 올리기</h2>

            {/* 썸네일 미리보기 */}
            {thumbnail && (
              <div className="thumbnail-preview">
                <img src={thumbnail} alt="미리보기" />
              </div>
            )}

            {/* 영감 표시 */}
            {remixFrom && (
              <div className="remix-badge">
                🔀 다른 작품에서 영감을 받은 Remix입니다
              </div>
            )}

            {/* 제목 */}
            <label>
              제목 <span className="required">*</span>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="작품 제목"
                maxLength={100}
                autoFocus
              />
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

            {/* 에러 */}
            {error && <p className="publish-error">❌ {error}</p>}

            {/* 버튼 */}
            <div className="publish-actions">
              <button
                onClick={handlePublish}
                disabled={publishing || !title.trim()}
                className="btn-primary"
              >
                {publishing ? '발행 중...' : '발행하기'}
              </button>
              <button onClick={handleClose} className="btn-secondary">취소</button>
            </div>
          </>
        )}
      </div>

      <style>{`
        .publish-modal-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.6);
          display: flex; align-items: center; justify-content: center; z-index: 1000;
        }
        .publish-modal {
          background: var(--bg-secondary, #161b22); border-radius: 12px; padding: 24px;
          width: 90%; max-width: 480px; max-height: 90vh; overflow-y: auto;
          border: 1px solid var(--border, #30363d);
        }
        .publish-modal h2 { margin: 0 0 16px; font-size: 18px; }
        .publish-modal label { display: block; margin-bottom: 12px; font-size: 13px; color: var(--text-secondary, #8b949e); }
        .publish-modal input[type="text"],
        .publish-modal textarea {
          display: block; width: 100%; margin-top: 4px; padding: 8px 12px;
          background: var(--bg-primary, #0d1117); border: 1px solid var(--border, #30363d);
          border-radius: 6px; color: var(--text-primary, #e6edf3); font-size: 14px;
        }
        .publish-modal textarea { resize: vertical; }
        .required { color: #f85149; }
        .thumbnail-preview { margin-bottom: 12px; border-radius: 8px; overflow: hidden; }
        .thumbnail-preview img { width: 100%; height: auto; display: block; }
        .remix-badge {
          background: rgba(108,92,231,0.15); border: 1px solid rgba(108,92,231,0.3);
          padding: 8px 12px; border-radius: 6px; margin-bottom: 12px; font-size: 13px;
        }
        .category-pills { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
        .pill {
          padding: 4px 12px; border-radius: 999px; border: 1px solid var(--border, #30363d);
          background: transparent; color: var(--text-secondary, #8b949e); cursor: pointer; font-size: 12px;
        }
        .pill.active { background: var(--accent, #6C5CE7); color: white; border-color: var(--accent, #6C5CE7); }
        .checkbox-label { display: flex !important; align-items: center; gap: 8px; cursor: pointer; }
        .checkbox-label input { width: auto; margin: 0; }
        .github-login-prompt {
          background: rgba(255,255,255,0.05); padding: 12px; border-radius: 8px; margin-bottom: 12px;
        }
        .github-login-prompt p { margin: 0 0 8px; font-size: 13px; }
        .btn-github {
          padding: 6px 16px; border-radius: 6px; border: none; cursor: pointer;
          background: #238636; color: white; font-size: 13px;
        }
        .publish-error { color: #f85149; font-size: 13px; margin: 8px 0; }
        .publish-actions { display: flex; gap: 8px; margin-top: 16px; }
        .btn-primary {
          flex: 1; padding: 10px; border-radius: 8px; border: none; cursor: pointer;
          background: var(--accent, #6C5CE7); color: white; font-weight: 600; font-size: 14px;
        }
        .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
        .btn-secondary {
          padding: 10px 16px; border-radius: 8px; border: 1px solid var(--border, #30363d);
          background: transparent; color: var(--text-secondary, #8b949e); cursor: pointer; font-size: 14px;
        }
        .publish-success { text-align: center; }
        .publish-success h2 { font-size: 22px; margin-bottom: 16px; }
        .github-url-box {
          background: rgba(0,206,201,0.1); padding: 12px; border-radius: 8px; margin-bottom: 12px;
        }
        .github-url-box p { margin: 0 0 4px; font-size: 12px; color: var(--text-secondary); }
        .github-url-box a { color: #58a6ff; word-break: break-all; }
        .copy-btn {
          margin-top: 8px; padding: 4px 12px; border-radius: 4px; border: 1px solid var(--border, #30363d);
          background: transparent; color: var(--text-secondary); cursor: pointer; font-size: 12px;
        }
        .publish-warnings { margin: 8px 0; }
        .publish-warnings p { font-size: 12px; color: #d29922; margin: 2px 0; }
      `}</style>
    </div>
  );
}

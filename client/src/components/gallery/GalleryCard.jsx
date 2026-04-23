import { Link, useNavigate } from 'react-router-dom';
import { ensureAudioReady } from '../../engine/sound-system';

/* ---------- pythink2 스타일 아이콘 (둥근 사각형 + 그라데이션 + 흰색 라인) ---------- */

const IconComputing = () => (
  <svg viewBox="0 0 120 120" width="64" height="64" fill="none">
    <defs><linearGradient id="gc-comp" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stopColor="#667eea" /><stop offset="100%" stopColor="#764ba2" />
    </linearGradient></defs>
    <rect x="4" y="4" width="112" height="112" rx="28" fill="url(#gc-comp)" />
    {/* 모니터 */}
    <rect x="30" y="28" width="60" height="44" rx="6" stroke="white" strokeWidth="5" fill="rgba(255,255,255,0.12)" />
    {/* 코드 프롬프트 > */}
    <path d="M43 44l12 10-12 10" stroke="white" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
    {/* 커서 _ */}
    <line x1="60" y1="60" x2="74" y2="60" stroke="white" strokeWidth="5" strokeLinecap="round" />
    {/* 스탠드 */}
    <line x1="60" y1="72" x2="60" y2="84" stroke="white" strokeWidth="4" strokeLinecap="round" />
    <line x1="44" y1="88" x2="76" y2="88" stroke="white" strokeWidth="4" strokeLinecap="round" opacity="0.7" />
  </svg>
);

const IconMath = () => (
  <svg viewBox="0 0 120 120" width="64" height="64" fill="none">
    <defs><linearGradient id="gc-math" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stopColor="#f093fb" /><stop offset="100%" stopColor="#f5576c" />
    </linearGradient></defs>
    <rect x="4" y="4" width="112" height="112" rx="28" fill="url(#gc-math)" />
    {/* 그래프 축 */}
    <line x1="28" y1="90" x2="28" y2="26" stroke="white" strokeWidth="4" strokeLinecap="round" />
    <line x1="28" y1="90" x2="94" y2="90" stroke="white" strokeWidth="4" strokeLinecap="round" />
    {/* 사인 곡선 */}
    <path d="M28 68 Q44 30 60 58 Q76 86 92 48" stroke="white" strokeWidth="5" strokeLinecap="round" fill="none" />
    {/* 점들 */}
    <circle cx="44" cy="44" r="4" fill="white" opacity="0.7" />
    <circle cx="76" cy="72" r="4" fill="white" opacity="0.7" />
    <circle cx="92" cy="48" r="4" fill="white" opacity="0.7" />
  </svg>
);

const IconScience = () => (
  <svg viewBox="0 0 120 120" width="64" height="64" fill="none">
    <defs><linearGradient id="gc-sci" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stopColor="#4facfe" /><stop offset="100%" stopColor="#00f2fe" />
    </linearGradient></defs>
    <rect x="4" y="4" width="112" height="112" rx="28" fill="url(#gc-sci)" />
    {/* 플라스크 */}
    <path d="M48 22v26L26 82a8 8 0 006.9 12h54.2a8 8 0 006.9-12L72 48V22"
      stroke="white" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="rgba(255,255,255,0.1)" />
    {/* 플라스크 입구 */}
    <line x1="42" y1="22" x2="78" y2="22" stroke="white" strokeWidth="5" strokeLinecap="round" />
    {/* 액체 수면 */}
    <path d="M34 72 Q60 62 86 72" stroke="white" strokeWidth="3" strokeLinecap="round" opacity="0.5" />
    {/* 기포 */}
    <circle cx="50" cy="80" r="4" fill="white" opacity="0.4" />
    <circle cx="66" cy="76" r="3" fill="white" opacity="0.3" />
    <circle cx="58" cy="86" r="2.5" fill="white" opacity="0.35" />
  </svg>
);

const IconArt = () => (
  <svg viewBox="0 0 120 120" width="64" height="64" fill="none">
    <defs><linearGradient id="gc-art" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stopColor="#fa709a" /><stop offset="100%" stopColor="#fee140" />
    </linearGradient></defs>
    <rect x="4" y="4" width="112" height="112" rx="28" fill="url(#gc-art)" />
    {/* 붓 손잡이 */}
    <line x1="28" y1="92" x2="56" y2="64" stroke="white" strokeWidth="6" strokeLinecap="round" />
    {/* 붓 금속 */}
    <rect x="52" y="52" width="18" height="20" rx="2" transform="rotate(-45 60 62)"
      stroke="white" strokeWidth="3" fill="rgba(255,255,255,0.2)" />
    {/* 붓 끝 */}
    <path d="M68 44 Q80 32 88 32 Q88 40 76 52 Z"
      stroke="white" strokeWidth="4" strokeLinejoin="round" fill="rgba(255,255,255,0.35)" />
    {/* 색 점 */}
    <circle cx="34" cy="36" r="6" fill="white" opacity="0.5" />
    <circle cx="52" cy="28" r="5" fill="white" opacity="0.4" />
    <circle cx="82" cy="78" r="5" fill="white" opacity="0.4" />
  </svg>
);

const IconSound = () => (
  <svg viewBox="0 0 120 120" width="64" height="64" fill="none">
    <defs><linearGradient id="gc-snd" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stopColor="#a18cd1" /><stop offset="100%" stopColor="#fbc2eb" />
    </linearGradient></defs>
    <rect x="4" y="4" width="112" height="112" rx="28" fill="url(#gc-snd)" />
    {/* 헤드폰 밴드 */}
    <path d="M28 64 A32 32 0 0 1 92 64" stroke="white" strokeWidth="5" strokeLinecap="round" fill="none" />
    {/* 왼쪽 이어컵 */}
    <rect x="20" y="60" width="16" height="26" rx="8" stroke="white" strokeWidth="4" fill="rgba(255,255,255,0.2)" />
    {/* 오른쪽 이어컵 */}
    <rect x="84" y="60" width="16" height="26" rx="8" stroke="white" strokeWidth="4" fill="rgba(255,255,255,0.2)" />
    {/* 음파 */}
    <path d="M50 50 Q54 42 58 50 Q62 58 66 50 Q70 42 74 50" stroke="white" strokeWidth="3" strokeLinecap="round" opacity="0.5" />
  </svg>
);

const IconFree = () => (
  <svg viewBox="0 0 120 120" width="64" height="64" fill="none">
    <defs><linearGradient id="gc-free" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stopColor="#30cfd0" /><stop offset="100%" stopColor="#330867" />
    </linearGradient></defs>
    <rect x="4" y="4" width="112" height="112" rx="28" fill="url(#gc-free)" />
    {/* 로켓 몸통 */}
    <path d="M60 24 C60 24 42 44 42 68 C42 76 48 82 60 82 C72 82 78 76 78 68 C78 44 60 24 60 24Z"
      stroke="white" strokeWidth="5" strokeLinejoin="round" fill="rgba(255,255,255,0.15)" />
    {/* 창문 */}
    <circle cx="60" cy="52" r="8" stroke="white" strokeWidth="4" fill="rgba(255,255,255,0.2)" />
    {/* 왼쪽 날개 */}
    <path d="M42 68 L28 80 L42 78" stroke="white" strokeWidth="4" strokeLinejoin="round" fill="rgba(255,255,255,0.1)" />
    {/* 오른쪽 날개 */}
    <path d="M78 68 L92 80 L78 78" stroke="white" strokeWidth="4" strokeLinejoin="round" fill="rgba(255,255,255,0.1)" />
    {/* 화염 */}
    <path d="M52 82 Q56 96 60 90 Q64 96 68 82" stroke="white" strokeWidth="3" strokeLinecap="round" opacity="0.6" />
  </svg>
);

const CATEGORY_STYLES = {
  computing:  { icon: <IconComputing />,  gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
  math:       { icon: <IconMath />,       gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' },
  science:    { icon: <IconScience />,    gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' },
  art:        { icon: <IconArt />,        gradient: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)' },
  sound:      { icon: <IconSound />,      gradient: 'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)' },
  free:       { icon: <IconFree />,       gradient: 'linear-gradient(135deg, #30cfd0 0%, #330867 100%)' },
};

export default function GalleryCard({ work }) {
  const navigate = useNavigate();
  const author = work.vpylab_profiles?.display_name || '익명';
  const style = CATEGORY_STYLES[work.category] || CATEGORY_STYLES.free;

  const handlePlay = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    await ensureAudioReady();
    navigate(`/sandbox?play=${work.id}`);
  };

  return (
    <Link to={`/gallery/${work.id}`} className="gallery-card">
      <div className="gallery-card-thumb" style={{ background: style.gradient }}>
        <div className="gallery-card-icon">{style.icon}</div>
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

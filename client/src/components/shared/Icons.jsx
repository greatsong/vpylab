/**
 * AI Lab 공용 SVG 아이콘 세트
 * 이모지(▶⏸🗺💃★) 대신 깔끔한 SVG 아이콘 사용
 */

export function PlayIcon({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className}>
      <path d="M4 2.5v11l9-5.5L4 2.5z" />
    </svg>
  );
}

export function PauseIcon({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className}>
      <rect x="3" y="2" width="3.5" height="12" rx="1" />
      <rect x="9.5" y="2" width="3.5" height="12" rx="1" />
    </svg>
  );
}

export function ResetIcon({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M2.5 8a5.5 5.5 0 1 1 1.3 3.5" />
      <path d="M2.5 12V8h4" />
    </svg>
  );
}

export function StepForwardIcon({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className}>
      <path d="M3 2.5v11l6-5.5L3 2.5z" />
      <rect x="11" y="2.5" width="2.5" height="11" rx="0.5" />
    </svg>
  );
}

export function MapIcon({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M1.5 4v9.5l4.5-2 4 2 4.5-2V2l-4.5 2-4-2-4.5 2z" />
      <path d="M6 4v9.5M10 2v9.5" />
    </svg>
  );
}

export function TrainIcon({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="8" cy="6.5" r="4" />
      <path d="M5.5 6.5c0 1.5 1 2.5 2.5 2.5s2.5-1 2.5-2.5S9.5 4 8 4 5.5 5 5.5 6.5z" />
      <path d="M8 10.5v3M5.5 14h5" />
    </svg>
  );
}

export function LaunchIcon({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M8 1.5c0 0-5 3-5 8.5l2 2.5h6l2-2.5c0-5.5-5-8.5-5-8.5z" />
      <circle cx="8" cy="7" r="1.5" fill="currentColor" />
      <path d="M6.5 12.5L5 15M9.5 12.5L11 15" />
    </svg>
  );
}

export function CameraIcon({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="1.5" y="4" width="13" height="9" rx="1.5" />
      <circle cx="8" cy="8.5" r="2.5" />
      <path d="M5 4L6 2h4l1 2" />
    </svg>
  );
}

export function DanceIcon({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="currentColor" className={className}>
      <circle cx="16" cy="5" r="3" opacity="0.9" />
      <path d="M16 8v6" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d="M16 11l-6-4M16 11l7-2" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M16 14l-5 8M16 14l5 8" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
      <circle cx="10" cy="6" r="1" opacity="0.3" />
      <circle cx="24" cy="8" r="1.2" opacity="0.3" />
      <circle cx="11" cy="23" r="1" opacity="0.3" />
      <circle cx="21" cy="23" r="1" opacity="0.3" />
    </svg>
  );
}

export function StarIcon({ size = 16, filled = false, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" className={className}>
      <path
        d="M8 1.5l2 4.2 4.5.6-3.3 3.1.8 4.5L8 11.6l-4 2.3.8-4.5L1.5 6.3l4.5-.6L8 1.5z"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function LockIcon({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="3.5" y="7" width="9" height="7" rx="1.5" />
      <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
    </svg>
  );
}

export function CheckIcon({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3.5 8.5l3 3 6-7" />
    </svg>
  );
}

export function ArrowUpIcon({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M8 13V3M4 7l4-4 4 4" />
    </svg>
  );
}

export function ArrowDownIcon({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M8 3v10M4 9l4 4 4-4" />
    </svg>
  );
}

export function ArrowLeftIcon({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M13 8H3M7 4L3 8l4 4" />
    </svg>
  );
}

export function ArrowRightIcon({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 8h10M9 4l4 4-4 4" />
    </svg>
  );
}

export function ChevronRightIcon({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M6 3l5 5-5 5" />
    </svg>
  );
}

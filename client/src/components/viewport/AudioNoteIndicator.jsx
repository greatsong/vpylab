import { useEffect, useState } from 'react';
import { getPlayingNotes } from '../../engine/sound-system';
import useAudioState from '../../hooks/useAudioState';
import { useOptionalI18n } from '../../i18n/useI18n';

// 현재 음만 표시합니다. 미리 예약한 다음 음을 화면에 먼저 보여주지 않습니다.
export default function AudioNoteIndicator() {
  const { playing } = useAudioState();
  const { locale } = useOptionalI18n();
  const [notes, setNotes] = useState('');
  useEffect(() => {
    if (!playing) return;
    const update = () => setNotes(getPlayingNotes().join(' · '));
    // GPU가 바쁜 기기에서도 짧은 음 표시가 3D 프레임 대기에 묶이지 않게 합니다.
    const timer = setInterval(update, 33);
    return () => clearInterval(timer);
  }, [playing]);
  if (!playing || !notes) return null;
  return <div className="pointer-events-none absolute bottom-12 right-3 max-w-[70%] rounded px-3 py-1.5 text-xs" style={{ color: 'var(--color-text-primary)', backgroundColor: 'var(--color-bg-panel)', border: '1px solid var(--color-accent)' }} data-vpylab-playing-notes="" aria-label={locale === 'en' ? 'Playing notes' : '연주 중인 음'}>
    <span aria-hidden="true">♪ </span>{notes}
  </div>;
}

import { useSyncExternalStore } from 'react';
import { getAudioState, setMasterMuted, setMasterVolume, subscribeAudioState } from '../../engine/sound-system';

export default function SoundSettings() {
  const audio = useSyncExternalStore(subscribeAudioState, getAudioState, getAudioState);
  return (
    <div className="border-t mt-2 pt-3 px-4 pb-2 text-xs space-y-3" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}>
      <button type="button" aria-pressed={audio.muted} onClick={() => setMasterMuted(!audio.muted)} className="border-0 bg-transparent cursor-pointer p-0 text-left">{audio.muted ? '소리 켜기' : '소리 끄기'}</button>
      <label className="flex items-center gap-3">소리 크기<input type="range" aria-label="소리 크기" min="0" max="100" value={Math.round(audio.volume * 100)} onChange={event => setMasterVolume(Number(event.target.value) / 100)} className="min-w-0 flex-1" /></label>
    </div>
  );
}

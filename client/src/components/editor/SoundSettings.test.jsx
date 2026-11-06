import { beforeEach, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import SoundSettings from './SoundSettings';
import { getAudioState, setMasterMuted, setMasterVolume } from '../../engine/sound-system';

beforeEach(() => { setMasterMuted(false); setMasterVolume(0.6); });

it('교재에 안내한 소리 제어가 실제 오디오 엔진의 상태를 바꾼다', () => {
  render(<SoundSettings />);
  fireEvent.click(screen.getByRole('button', { name: '소리 끄기' }));
  expect(getAudioState().muted).toBe(true);
  expect(screen.getByRole('button', { name: '소리 켜기' })).toHaveAttribute('aria-pressed', 'true');
  fireEvent.change(screen.getByRole('slider', { name: '소리 크기' }), { target: { value: '35' } });
  expect(getAudioState().volume).toBe(0.35);
  fireEvent.click(screen.getByRole('button', { name: '소리 켜기' }));
  expect(getAudioState().muted).toBe(false);
});

/**
 * 사운드 시스템 단위 테스트
 * Web Audio API를 mock하여 jsdom 환경에서 테스트
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// === Web Audio API Mock ===
function createMockAudioContext() {
  return {
    currentTime: 0,
    state: 'running',
    sampleRate: 44100,
    resume: vi.fn(),
    destination: {},
    createOscillator: vi.fn(() => ({
      type: 'sine',
      frequency: {
        value: 440,
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    })),
    createGain: vi.fn(() => ({
      gain: {
        value: 1,
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
    })),
    createBuffer: vi.fn((channels, length) => ({
      getChannelData: vi.fn(() => new Float32Array(length)),
    })),
    createBufferSource: vi.fn(() => ({
      buffer: null,
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    })),
    createBiquadFilter: vi.fn(() => ({
      type: 'lowpass',
      frequency: {
        value: 350,
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
    })),
  };
}

let mockCtx;
let constructorCallCount;

beforeEach(() => {
  mockCtx = createMockAudioContext();
  constructorCallCount = 0;

  // new AudioContext()가 동작하려면 일반 함수(constructor) 형태여야 함
  function MockAudioContext() {
    constructorCallCount++;
    return mockCtx;
  }
  globalThis.AudioContext = MockAudioContext;
  globalThis.webkitAudioContext = MockAudioContext;

  vi.resetModules();
});

afterEach(() => {
  delete globalThis.AudioContext;
  delete globalThis.webkitAudioContext;
  vi.restoreAllMocks();
});

describe('sound-system', () => {
  // ───────────────────────────────────────────
  // 기본 재생
  // ───────────────────────────────────────────
  describe('beep()', () => {
    it('기본 매개변수로 비프음을 재생한다', async () => {
      const { beep } = await import('./sound-system.js');
      beep();
      expect(mockCtx.createOscillator).toHaveBeenCalledTimes(1);
      expect(mockCtx.createGain).toHaveBeenCalledTimes(1);
    });

    it('커스텀 주파수, 길이, 파형, 볼륨을 적용한다', async () => {
      const { beep } = await import('./sound-system.js');
      beep(880, 1.0, 'square', 0.8);
      const osc = mockCtx.createOscillator.mock.results[0].value;
      expect(osc.type).toBe('square');
      expect(osc.frequency.value).toBe(880);
    });

    it('오실레이터와 게인이 올바르게 연결된다', async () => {
      const { beep } = await import('./sound-system.js');
      beep();
      const osc = mockCtx.createOscillator.mock.results[0].value;
      const gain = mockCtx.createGain.mock.results[0].value;
      expect(osc.connect).toHaveBeenCalledWith(gain);
      expect(gain.connect).toHaveBeenCalledWith(mockCtx.destination);
    });

    it('페이드 아웃이 설정된다 (클릭 방지)', async () => {
      const { beep } = await import('./sound-system.js');
      beep(440, 0.3, 'sine', 0.5);
      const gain = mockCtx.createGain.mock.results[0].value;
      expect(gain.gain.setValueAtTime).toHaveBeenCalledWith(0.5, 0);
      expect(gain.gain.exponentialRampToValueAtTime).toHaveBeenCalledWith(0.001, 0.3);
    });

    it('오실레이터가 시작/정지된다', async () => {
      const { beep } = await import('./sound-system.js');
      beep(440, 0.5);
      const osc = mockCtx.createOscillator.mock.results[0].value;
      expect(osc.start).toHaveBeenCalledWith(0);
      expect(osc.stop).toHaveBeenCalledWith(0.5);
    });

    it('suspended 상태에서 resume()을 호출한다', async () => {
      mockCtx.state = 'suspended';
      const { beep } = await import('./sound-system.js');
      beep();
      expect(mockCtx.resume).toHaveBeenCalled();
    });

    it('4가지 파형 타입을 지원한다', async () => {
      const { beep } = await import('./sound-system.js');
      for (const type of ['sine', 'square', 'sawtooth', 'triangle']) {
        beep(440, 0.1, type);
        const idx = mockCtx.createOscillator.mock.results.length - 1;
        const osc = mockCtx.createOscillator.mock.results[idx].value;
        expect(osc.type).toBe(type);
      }
    });
  });

  // ───────────────────────────────────────────
  // 노트 변환 (순수 함수, AudioContext 불필요)
  // ───────────────────────────────────────────
  describe('noteToFreq()', () => {
    it('A4 = 440Hz', async () => {
      const { noteToFreq } = await import('./sound-system.js');
      expect(noteToFreq('A4')).toBeCloseTo(440, 1);
    });

    it('C4 ≈ 261.63Hz', async () => {
      const { noteToFreq } = await import('./sound-system.js');
      expect(noteToFreq('C4')).toBeCloseTo(261.63, 0);
    });

    it('샵(#) 노트: F#4 ≈ 370Hz', async () => {
      const { noteToFreq } = await import('./sound-system.js');
      expect(noteToFreq('F#4')).toBeCloseTo(370, 0);
    });

    it('플랫(b) 노트: Bb4 ≈ 466Hz', async () => {
      const { noteToFreq } = await import('./sound-system.js');
      expect(noteToFreq('Bb4')).toBeCloseTo(466, 0);
    });

    it('다양한 옥타브: C3~C6', async () => {
      const { noteToFreq } = await import('./sound-system.js');
      expect(noteToFreq('C3')).toBeCloseTo(130.81, 0);
      expect(noteToFreq('C6')).toBeCloseTo(1046.5, 0);
    });

    it('없는 노트는 null 반환', async () => {
      const { noteToFreq } = await import('./sound-system.js');
      expect(noteToFreq('X9')).toBeNull();
      expect(noteToFreq('')).toBeNull();
      expect(noteToFreq(null)).toBeNull();
    });
  });

  // ───────────────────────────────────────────
  // 노트 기반 재생
  // ───────────────────────────────────────────
  describe('playNote()', () => {
    it('노트 이름으로 재생한다', async () => {
      const { playNote } = await import('./sound-system.js');
      playNote('C4', 0.5);
      const osc = mockCtx.createOscillator.mock.results[0].value;
      expect(osc.frequency.value).toBeCloseTo(261.63, 0);
    });

    it('잘못된 노트 이름은 무시한다', async () => {
      const { playNote } = await import('./sound-system.js');
      playNote('Z9', 0.5);
      expect(mockCtx.createOscillator).not.toHaveBeenCalled();
    });
  });

  describe('playChord()', () => {
    it('여러 주파수를 동시에 재생한다', async () => {
      const { playChord } = await import('./sound-system.js');
      playChord([261.63, 329.63, 392], 1.0);
      expect(mockCtx.createOscillator).toHaveBeenCalledTimes(3);
    });

    it('빈 배열이면 아무것도 하지 않는다', async () => {
      const { playChord } = await import('./sound-system.js');
      playChord([], 1.0);
      expect(mockCtx.createOscillator).not.toHaveBeenCalled();
    });
  });

  describe('playSequence()', () => {
    it('노트 배열을 순차적으로 재생한다', async () => {
      vi.useFakeTimers();
      const { playSequence } = await import('./sound-system.js');
      playSequence([
        { freq: 261.63, duration: 0.3 },
        { freq: 329.63, duration: 0.3 },
        { freq: 392, duration: 0.3 },
      ]);

      expect(mockCtx.createOscillator).toHaveBeenCalledTimes(1);
      vi.advanceTimersByTime(300);
      expect(mockCtx.createOscillator).toHaveBeenCalledTimes(2);
      vi.advanceTimersByTime(300);
      expect(mockCtx.createOscillator).toHaveBeenCalledTimes(3);

      vi.useRealTimers();
    });
  });

  // ───────────────────────────────────────────
  // 시스템 효과음
  // ───────────────────────────────────────────
  describe('시스템 효과음', () => {
    it('successSound: 3개 노트 순차 재생', async () => {
      vi.useFakeTimers();
      const { successSound } = await import('./sound-system.js');
      successSound();
      expect(mockCtx.createOscillator).toHaveBeenCalledTimes(1);
      vi.advanceTimersByTime(100);
      expect(mockCtx.createOscillator).toHaveBeenCalledTimes(2);
      vi.advanceTimersByTime(100);
      expect(mockCtx.createOscillator).toHaveBeenCalledTimes(3);
      vi.useRealTimers();
    });

    it('errorSound: 낮은 square 파형', async () => {
      const { errorSound } = await import('./sound-system.js');
      errorSound();
      const osc = mockCtx.createOscillator.mock.results[0].value;
      expect(osc.frequency.value).toBe(200);
      expect(osc.type).toBe('square');
    });

    it('hintSound: 2개 높은 노트', async () => {
      vi.useFakeTimers();
      const { hintSound } = await import('./sound-system.js');
      hintSound();
      expect(mockCtx.createOscillator).toHaveBeenCalledTimes(1);
      vi.advanceTimersByTime(80);
      expect(mockCtx.createOscillator).toHaveBeenCalledTimes(2);
      vi.useRealTimers();
    });

    it('runSound: 660Hz 실행음', async () => {
      const { runSound } = await import('./sound-system.js');
      runSound();
      const osc = mockCtx.createOscillator.mock.results[0].value;
      expect(osc.frequency.value).toBe(660);
    });

    it('levelUpSound: 4개 노트 상승 아르페지오', async () => {
      vi.useFakeTimers();
      const { levelUpSound } = await import('./sound-system.js');
      levelUpSound();
      // i=0 → setTimeout(0), fakeTimers에서는 advance 필요
      vi.advanceTimersByTime(0);
      expect(mockCtx.createOscillator).toHaveBeenCalledTimes(1);
      vi.advanceTimersByTime(360);
      expect(mockCtx.createOscillator).toHaveBeenCalledTimes(4);
      vi.useRealTimers();
    });
  });

  // ───────────────────────────────────────────
  // 게임 효과음
  // ───────────────────────────────────────────
  describe('게임 효과음', () => {
    it('sfxJump: 상승 주파수 스윕', async () => {
      const { sfxJump } = await import('./sound-system.js');
      sfxJump();
      const osc = mockCtx.createOscillator.mock.results[0].value;
      expect(osc.type).toBe('square');
      expect(osc.frequency.setValueAtTime).toHaveBeenCalled();
    });

    it('sfxCoin: 2개의 높은 square 음', async () => {
      vi.useFakeTimers();
      const { sfxCoin } = await import('./sound-system.js');
      sfxCoin();
      expect(mockCtx.createOscillator).toHaveBeenCalledTimes(1);
      vi.advanceTimersByTime(60);
      expect(mockCtx.createOscillator).toHaveBeenCalledTimes(2);
      vi.useRealTimers();
    });

    it('sfxPowerUp: 6개 상승 아르페지오', async () => {
      vi.useFakeTimers();
      const { sfxPowerUp } = await import('./sound-system.js');
      sfxPowerUp();
      vi.advanceTimersByTime(0);
      expect(mockCtx.createOscillator).toHaveBeenCalledTimes(1);
      vi.advanceTimersByTime(250);
      expect(mockCtx.createOscillator).toHaveBeenCalledTimes(6);
      vi.useRealTimers();
    });

    it('sfxDeath: 6개 하강 음계', async () => {
      vi.useFakeTimers();
      const { sfxDeath } = await import('./sound-system.js');
      sfxDeath();
      vi.advanceTimersByTime(0);
      expect(mockCtx.createOscillator).toHaveBeenCalledTimes(1);
      vi.advanceTimersByTime(500);
      expect(mockCtx.createOscillator).toHaveBeenCalledTimes(6);
      vi.useRealTimers();
    });

    it('sfxFireball: sawtooth 하강 스윕', async () => {
      const { sfxFireball } = await import('./sound-system.js');
      sfxFireball();
      const osc = mockCtx.createOscillator.mock.results[0].value;
      expect(osc.type).toBe('sawtooth');
    });

    it('sfxPipe: square 하강 후 상승', async () => {
      const { sfxPipe } = await import('./sound-system.js');
      sfxPipe();
      const osc = mockCtx.createOscillator.mock.results[0].value;
      expect(osc.type).toBe('square');
    });

    it('sfx1Up: 6개 밝은 상승 멜로디', async () => {
      vi.useFakeTimers();
      const { sfx1Up } = await import('./sound-system.js');
      sfx1Up();
      // 첫 노트는 setTimeout(0)으로 예약됨
      vi.advanceTimersByTime(0);
      expect(mockCtx.createOscillator).toHaveBeenCalledTimes(1);
      vi.advanceTimersByTime(400);
      expect(mockCtx.createOscillator).toHaveBeenCalledTimes(6);
      vi.useRealTimers();
    });

    it('sfxSelect: 짧은 틱', async () => {
      const { sfxSelect } = await import('./sound-system.js');
      sfxSelect();
      expect(mockCtx.createOscillator).toHaveBeenCalledTimes(1);
    });

    it('sfxWarning: 3번 반복 경고음', async () => {
      vi.useFakeTimers();
      const { sfxWarning } = await import('./sound-system.js');
      sfxWarning();
      expect(mockCtx.createOscillator).toHaveBeenCalledTimes(1);
      vi.advanceTimersByTime(500);
      expect(mockCtx.createOscillator).toHaveBeenCalledTimes(3);
      vi.useRealTimers();
    });

    it('sfxExplosion: 노이즈 기반 폭발음', async () => {
      const { sfxExplosion } = await import('./sound-system.js');
      sfxExplosion();
      expect(mockCtx.createBuffer).toHaveBeenCalled();
      expect(mockCtx.createBufferSource).toHaveBeenCalled();
      expect(mockCtx.createBiquadFilter).toHaveBeenCalled();
    });

    it('sfxLaser: sawtooth 하강', async () => {
      const { sfxLaser } = await import('./sound-system.js');
      sfxLaser();
      const osc = mockCtx.createOscillator.mock.results[0].value;
      expect(osc.type).toBe('sawtooth');
    });
  });

  // ───────────────────────────────────────────
  // playSfx
  // ───────────────────────────────────────────
  describe('playSfx()', () => {
    it('이름으로 게임 효과음을 재생한다', async () => {
      const { playSfx } = await import('./sound-system.js');
      playSfx('jump');
      expect(mockCtx.createOscillator).toHaveBeenCalled();
    });

    it('대소문자 구분 없이 동작한다', async () => {
      const { playSfx } = await import('./sound-system.js');
      playSfx('COIN');
      expect(mockCtx.createOscillator).toHaveBeenCalled();
    });

    it('없는 이름은 무시한다', async () => {
      const { playSfx } = await import('./sound-system.js');
      playSfx('nonexistent');
      expect(mockCtx.createOscillator).not.toHaveBeenCalled();
    });

    it('시스템 효과음도 이름으로 재생 가능하다', async () => {
      const { playSfx } = await import('./sound-system.js');
      playSfx('success');
      expect(mockCtx.createOscillator).toHaveBeenCalled();
    });
  });

  // ───────────────────────────────────────────
  // BGM
  // ───────────────────────────────────────────
  describe('BGM', () => {
    it('startBgm: 패턴 재생을 시작한다', async () => {
      vi.useFakeTimers();
      const { startBgm, getCurrentBgm } = await import('./sound-system.js');
      startBgm('adventure');
      expect(getCurrentBgm()).toBe('adventure');
      // 첫 노트는 delay=0이지만 setTimeout이므로 advance 필요
      vi.advanceTimersByTime(10);
      expect(mockCtx.createOscillator).toHaveBeenCalled();
      vi.useRealTimers();
    });

    it('stopBgm: 재생을 정지한다', async () => {
      vi.useFakeTimers();
      const { startBgm, stopBgm, getCurrentBgm } = await import('./sound-system.js');
      startBgm('adventure');
      expect(getCurrentBgm()).toBe('adventure');
      stopBgm();
      expect(getCurrentBgm()).toBeNull();
      vi.useRealTimers();
    });

    it('startBgm을 두 번 호출하면 이전 BGM이 정지된다', async () => {
      vi.useFakeTimers();
      const { startBgm, getCurrentBgm } = await import('./sound-system.js');
      startBgm('adventure');
      startBgm('battle');
      expect(getCurrentBgm()).toBe('battle');
      vi.useRealTimers();
    });

    it('없는 BGM 이름은 무시한다', async () => {
      const { startBgm, getCurrentBgm } = await import('./sound-system.js');
      startBgm('nonexistent');
      expect(getCurrentBgm()).toBeNull();
    });

    it('5종 BGM 패턴이 모두 존재한다', async () => {
      vi.useFakeTimers();
      const { startBgm, getCurrentBgm, stopBgm } = await import('./sound-system.js');
      for (const name of ['adventure', 'explore', 'battle', 'peaceful', 'victory']) {
        startBgm(name);
        expect(getCurrentBgm()).toBe(name);
        stopBgm();
      }
      vi.useRealTimers();
    });
  });

  // ───────────────────────────────────────────
  // processSoundCommand (Python 브릿지)
  // ───────────────────────────────────────────
  describe('processSoundCommand()', () => {
    it('beep 커맨드', async () => {
      const { processSoundCommand } = await import('./sound-system.js');
      processSoundCommand({
        action: 'sound', method: 'beep',
        frequency: 523, duration: 0.5, type: 'triangle', volume: 0.6,
      });
      const osc = mockCtx.createOscillator.mock.results[0].value;
      expect(osc.frequency.value).toBe(523);
      expect(osc.type).toBe('triangle');
    });

    it('play 커맨드', async () => {
      const { processSoundCommand } = await import('./sound-system.js');
      processSoundCommand({
        action: 'sound', method: 'play', frequency: 880, duration: 1.0,
      });
      const osc = mockCtx.createOscillator.mock.results[0].value;
      expect(osc.frequency.value).toBe(880);
    });

    it('note 커맨드', async () => {
      const { processSoundCommand } = await import('./sound-system.js');
      processSoundCommand({
        action: 'sound', method: 'note', name: 'C4', duration: 0.5,
      });
      const osc = mockCtx.createOscillator.mock.results[0].value;
      expect(osc.frequency.value).toBeCloseTo(261.63, 0);
    });

    it('chord 커맨드', async () => {
      const { processSoundCommand } = await import('./sound-system.js');
      processSoundCommand({
        action: 'sound', method: 'chord',
        frequencies: [261.63, 329.63, 392], duration: 1.0,
      });
      expect(mockCtx.createOscillator).toHaveBeenCalledTimes(3);
    });

    it('sequence 커맨드', async () => {
      vi.useFakeTimers();
      const { processSoundCommand } = await import('./sound-system.js');
      processSoundCommand({
        action: 'sound', method: 'sequence',
        notes: [
          { freq: 440, duration: 0.2 },
          { freq: 880, duration: 0.2 },
        ],
      });
      expect(mockCtx.createOscillator).toHaveBeenCalledTimes(1);
      vi.advanceTimersByTime(200);
      expect(mockCtx.createOscillator).toHaveBeenCalledTimes(2);
      vi.useRealTimers();
    });

    it('sfx 커맨드', async () => {
      const { processSoundCommand } = await import('./sound-system.js');
      processSoundCommand({ action: 'sound', method: 'sfx', name: 'jump' });
      expect(mockCtx.createOscillator).toHaveBeenCalled();
    });

    it('bgm_start 커맨드', async () => {
      vi.useFakeTimers();
      const { processSoundCommand, getCurrentBgm } = await import('./sound-system.js');
      processSoundCommand({ action: 'sound', method: 'bgm_start', name: 'peaceful' });
      expect(getCurrentBgm()).toBe('peaceful');
      vi.useRealTimers();
    });

    it('bgm_stop 커맨드', async () => {
      vi.useFakeTimers();
      const { startBgm, processSoundCommand, getCurrentBgm } = await import('./sound-system.js');
      startBgm('adventure');
      processSoundCommand({ action: 'sound', method: 'bgm_stop' });
      expect(getCurrentBgm()).toBeNull();
      vi.useRealTimers();
    });

    it('알 수 없는 method는 무시한다', async () => {
      const { processSoundCommand } = await import('./sound-system.js');
      processSoundCommand({ action: 'sound', method: 'unknown_method' });
      expect(mockCtx.createOscillator).not.toHaveBeenCalled();
    });
  });

  // ───────────────────────────────────────────
  // AudioContext 싱글턴
  // ───────────────────────────────────────────
  describe('AudioContext 싱글턴', () => {
    it('여러 호출에도 하나의 AudioContext만 생성한다', async () => {
      const { beep } = await import('./sound-system.js');
      beep(); beep(); beep();
      expect(constructorCallCount).toBe(1);
    });
  });
});

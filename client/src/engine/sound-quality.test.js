import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function audioParameter(value = 0) {
  const events = [];
  const parameter = { value, events };
  for (const method of ['setValueAtTime', 'linearRampToValueAtTime', 'exponentialRampToValueAtTime']) parameter[method] = vi.fn((next, time) => { events.push({ method, value: next, time }); });
  parameter.cancelScheduledValues = vi.fn();
  parameter.cancelAndHoldAtTime = vi.fn();
  return parameter;
}

function audioContext() {
  const sources = []; const gains = []; const filters = [];
  const node = (kind) => ({ kind, connect: vi.fn(), disconnect: vi.fn() });
  const source = (kind) => {
    const handlers = [];
    const result = { ...node(kind), frequency: audioParameter(440), start: vi.fn(), stop: vi.fn(), addEventListener: vi.fn((name, handler) => { if (name === 'ended') handlers.push(handler); }), end: () => handlers.forEach((handler) => handler()) };
    sources.push(result); return result;
  };
  const context = {
    state: 'running', currentTime: 0, sampleRate: 48000, destination: node('destination'),
    resume: vi.fn(async () => { context.state = 'running'; }),
    createOscillator: vi.fn(() => source('oscillator')),
    createGain: vi.fn(() => { const gain = { ...node('gain'), gain: audioParameter(1) }; gains.push(gain); return gain; }),
    createDynamicsCompressor: vi.fn(() => ({ ...node('compressor'), threshold: audioParameter(), knee: audioParameter(), ratio: audioParameter(), attack: audioParameter(), release: audioParameter() })),
    createWaveShaper: vi.fn(() => ({ ...node('limiter'), curve: null, oversample: 'none' })),
    createBuffer: vi.fn((channels, length) => ({ getChannelData: () => new Float32Array(length) })),
    createBufferSource: vi.fn(() => source('buffer')),
    createBiquadFilter: vi.fn(() => { const filter = { ...node('filter'), frequency: audioParameter(350) }; filters.push(filter); return filter; }),
    sources, gains, filters,
  };
  return context;
}

function envelopeAt(events, time) {
  let previous = { value: 0, time: 0 };
  for (const next of events) {
    if (time < next.time) {
      if (next.method === 'setValueAtTime') return previous.value;
      const fraction = Math.max(0, Math.min(1, (time - previous.time) / (next.time - previous.time)));
      return next.method === 'exponentialRampToValueAtTime' && previous.value > 0
        ? previous.value * Math.pow(next.value / previous.value, fraction)
        : previous.value + (next.value - previous.value) * fraction;
    }
    previous = next;
  }
  return previous.value;
}

let context;
let sound;
beforeEach(async () => {
  vi.useFakeTimers(); vi.resetModules(); context = audioContext();
  function AudioContextDouble() { return context; }
  vi.stubGlobal('AudioContext', vi.fn(AudioContextDouble));
  vi.stubGlobal('webkitAudioContext', undefined);
  sound = await import('./sound-system.js');
});
afterEach(() => { sound.stopAllSounds(); vi.runOnlyPendingTimers(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('수업 음원의 출력 경로와 자연스러운 수명', () => {
  it('기본음과 노이즈 모두 동일한 master·compressor·limiter를 거친다', () => {
    sound.beep(440, 0.5); sound.sfxExplosion();
    const master = context.gains[0];
    const compressor = context.createDynamicsCompressor.mock.results[0].value;
    const limiter = context.createWaveShaper.mock.results[0].value;
    expect(context.gains[1].connect).toHaveBeenCalledWith(master);
    expect(context.gains[2].connect).toHaveBeenCalledWith(master);
    expect(master.connect).toHaveBeenCalledExactlyOnceWith(compressor);
    expect(compressor.connect).toHaveBeenCalledExactlyOnceWith(limiter);
    expect(limiter.connect).toHaveBeenCalledExactlyOnceWith(context.destination);
    expect(compressor.threshold.value).toBe(-18);
    expect(compressor.ratio.value).toBe(12);
    expect(master.gain.value).toBeCloseTo(0.27);
    expect(limiter.oversample).toBe('2x');
    expect(context.sources.every((source) => !source.connect.mock.calls.some(([target]) => target === context.destination))).toBe(true);
  });

  it('음량 변경은 부드럽게 적용하고 음소거는 예약음·노이즈·필터까지 정리한다', () => {
    sound.sfxExplosion(); sound.playSequence([{ freq: 440, duration: 0.5 }, { freq: 660, duration: 0.5 }]);
    sound.setMasterVolume(0.4);
    expect(context.gains[0].gain.linearRampToValueAtTime).toHaveBeenCalledWith(0.4 * 0.45, 0.02);
    const created = context.sources.length;
    sound.setMasterMuted(true);
    expect(sound.getAudioState()).toMatchObject({ muted: true, playing: false, pendingCount: 0 });
    vi.advanceTimersByTime(30);
    for (const source of context.sources) expect(source.disconnect).toHaveBeenCalled();
    for (const filter of context.filters) expect(filter.disconnect).toHaveBeenCalled();
    vi.advanceTimersByTime(2000);
    expect(context.sources).toHaveLength(created);
    sound.setMasterMuted(false);
    expect(sound.getAudioState().playing).toBe(false);
  });

  it('음의 시작과 끝을 0으로 예약하고 종료 이벤트에서 노드를 연결 해제한다', () => {
    sound.beep(440, 0.5, 'sine', 0.4);
    const source = context.sources[0]; const gain = context.gains[1];
    expect(gain.gain.events[0]).toMatchObject({ method: 'setValueAtTime', value: 0, time: 0 });
    expect(gain.gain.events[1]).toMatchObject({ method: 'linearRampToValueAtTime', value: 0.4, time: 0.008 });
    expect(gain.gain.events.at(-1)).toMatchObject({ method: 'linearRampToValueAtTime', value: 0, time: 0.5 });
    source.end();
    expect(source.disconnect).toHaveBeenCalledOnce();
    expect(gain.disconnect).toHaveBeenCalledOnce();
    expect(sound.getAudioState()).toMatchObject({ playing: false, voiceCount: 0 });
  });

  it('동시 소스와 예약 수를 제한하고 BGM을 오래 반복해도 정지 후 예약이 남지 않는다', () => {
    for (let index = 0; index < 500; index++) sound.successSound();
    expect(context.createOscillator.mock.calls.length).toBeLessThanOrEqual(sound.MAX_AUDIO_VOICES);
    expect(sound.getAudioState().pendingCount).toBeLessThanOrEqual(sound.MAX_AUDIO_TIMERS);
    sound.stopAllSounds(); vi.advanceTimersByTime(30);
    sound.startBgm('peaceful'); vi.advanceTimersByTime(120_000);
    expect(sound.getAudioState().voiceCount).toBeLessThanOrEqual(sound.MAX_AUDIO_VOICES);
    expect(sound.getAudioState().pendingCount).toBeLessThanOrEqual(33);
    sound.stopAllSounds(); vi.advanceTimersByTime(30);
    const created = context.sources.length; vi.advanceTimersByTime(120_000);
    expect(context.sources).toHaveLength(created);
    expect(sound.getAudioState()).toMatchObject({ playing: false, voiceCount: 0, pendingCount: 0 });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('suspended 상태에서 예약한 음표를 resume 뒤 중복 재생하지 않는다', async () => {
    let release;
    context.state = 'suspended';
    const resume = new Promise((resolve) => { release = resolve; });
    context.resume.mockImplementation(() => resume);
    sound.playNote('C5', 0.5);
    expect(context.createOscillator).toHaveBeenCalledTimes(1);
    const ready = sound.ensureAudioReady();
    context.state = 'running'; release(); await ready;
    expect(context.createOscillator).toHaveBeenCalledTimes(1);
  });

  it('피아노·뮤직박스는 배음과 자연 잔향을 합성하며 limiter 곡선은 유한·대칭이다', () => {
    sound.beep(440, 0.5, 'piano', 0.4); sound.beep(440, 0.5, 'musicbox', 0.4);
    expect(context.createOscillator).toHaveBeenCalledTimes(6);
    expect(context.sources.slice(0, 3).map((source) => source.frequency.value)).toEqual([440, 880, 1320]);
    expect(context.sources[5].frequency.value).toBeCloseTo(440 * 3.01);
    for (const source of context.sources) expect(source.stop.mock.calls[0][0]).toBeGreaterThan(0.5);
    const curve = context.createWaveShaper.mock.results[0].value.curve;
    expect(curve[1024]).toBe(0);
    for (let index = 0; index < curve.length; index++) {
      expect(Number.isFinite(curve[index])).toBe(true);
      expect(Math.abs(curve[index])).toBeLessThan(0.85);
      expect(curve[index]).toBeCloseTo(-curve[curve.length - 1 - index], 5);
      if (index) expect(curve[index]).toBeGreaterThanOrEqual(curve[index - 1]);
    }
    // 예약한 배음과 envelope의 참조 파형으로 양 끝의 영점과 출력 범위를 확인합니다.
    const samples = new Float32Array(48000);
    for (let index = 0; index < samples.length; index++) {
      const time = index / 48000;
      let mixed = 0;
      for (const source of context.sources) {
        const gain = source.connect.mock.calls[0][0];
        mixed += Math.sin(2 * Math.PI * source.frequency.value * time) * envelopeAt(gain.gain.events, time);
      }
      samples[index] = 0.85 * Math.tanh(mixed * context.gains[0].gain.value / 0.85);
    }
    expect(samples[0]).toBe(0);
    expect(samples.at(-1)).toBeCloseTo(0, 6);
    expect(Math.max(...samples.map(Math.abs))).toBeLessThan(0.85);
    expect(samples.some((sample) => Math.abs(sample) > 0.01)).toBe(true);
  });

  it('미리 듣기는 호출 전 자동 재생하지 않고 음소거로 지연된 연주도 취소한다', async () => {
    expect(context.createOscillator).not.toHaveBeenCalled();
    expect(globalThis.AudioContext).not.toHaveBeenCalled();
    expect(await sound.previewInstrument('musicbox')).toBe(true);
    expect(context.createOscillator).toHaveBeenCalledTimes(3);
    sound.setMasterMuted(true); vi.advanceTimersByTime(5000);
    expect(context.createOscillator).toHaveBeenCalledTimes(3);
    expect(await sound.previewInstrument('piano')).toBe(false);
  });

  it('resume 대기 중 정지하면 미리 듣기와 실행 콜백이 뒤늦게 시작되지 않는다', async () => {
    let release;
    context.state = 'suspended';
    const resume = new Promise((resolve) => { release = resolve; });
    context.resume.mockImplementation(() => resume);
    const preview = sound.previewInstrument('piano');
    const run = vi.fn(); sound.resumeAndRun(run);
    sound.stopAllSounds(); context.state = 'running'; release();
    expect(await preview).toBe(false);
    await Promise.resolve(); vi.advanceTimersByTime(1000);
    expect(run).not.toHaveBeenCalled();
    expect(context.createOscillator).not.toHaveBeenCalled();
  });

  it('0 음량과 잘못된 주파수·길이는 소스를 만들지 않는다', () => {
    sound.processSoundCommand({ method: 'beep', frequency: 440, duration: 1, volume: 0 });
    sound.beep(Infinity, 1); sound.beep(440, Infinity); sound.beep(-1, 1); sound.beep(440, -1);
    expect(context.sources).toHaveLength(0);
  });

  it('브라우저 resume이 응답하지 않아도 미리 듣기는 500ms 뒤 실패하고 다시 시도할 수 있다', async () => {
    context.state = 'suspended'; context.resume.mockImplementation(() => new Promise(() => {}));
    const pending = sound.previewInstrument('musicbox');
    vi.advanceTimersByTime(500);
    expect(await pending).toBe(false);
    expect(sound.getAudioState().playing).toBe(false);
    expect(context.createOscillator).not.toHaveBeenCalled();
    context.state = 'running';
    expect(await sound.previewInstrument('musicbox')).toBe(true);
    expect(context.createOscillator).toHaveBeenCalledTimes(3);
  });
});

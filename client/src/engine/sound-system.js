/**
 * VPyLab — 사운드 시스템 (Phase 2: 게임 효과음 + BGM + 노트 시스템)
 * 의존성 0. 브라우저 내장 Web Audio API만 사용.
 *
 * 기능:
 * 1) beep / play — 기본 주파수 재생
 * 2) playNote / playChord / playSequence — 노트 이름 기반 재생
 * 3) 게임 효과음 — 슈퍼마리오 스타일 (점프, 코인, 파워업, 죽음 등)
 * 4) BGM — 루프 가능한 8비트 배경음악
 * 5) processSoundCommand — Python 코드에서 호출하는 브릿지 인터페이스
 *
 * 모든 효과음/BGM은 저작권 없이 Web Audio API로 합성합니다.
 */

let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (globalThis.AudioContext || globalThis.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

// ===================================================================
// 1) 기본 재생
// ===================================================================

/**
 * 비프음
 * @param {number} frequency - 주파수 (Hz)
 * @param {number} duration - 길이 (초)
 * @param {string} type - 파형 ('sine'|'square'|'sawtooth'|'triangle')
 * @param {number} volume - 볼륨 (0~1)
 */
export function beep(frequency = 440, duration = 0.3, type = 'sine', volume = 0.3) {
  const ctx = getAudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.value = frequency;
  gain.gain.value = volume;

  // 페이드 아웃으로 클릭 방지
  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + duration);
}

/**
 * 노트 연주 (학생 코드에서 사용)
 */
export function play(frequency, duration = 0.5) {
  beep(frequency, duration, 'sine', 0.4);
}

// ===================================================================
// 2) 노트 이름 → 주파수 변환 + 노트 기반 재생
// ===================================================================

// 반음 인덱스 (C=0, C#=1, ..., B=11)
const NOTE_NAMES = {
  'C': 0, 'C#': 1, 'Db': 1,
  'D': 2, 'D#': 3, 'Eb': 3,
  'E': 4, 'Fb': 4,
  'F': 5, 'F#': 6, 'Gb': 6,
  'G': 7, 'G#': 8, 'Ab': 8,
  'A': 9, 'A#': 10, 'Bb': 10,
  'B': 11, 'Cb': 11,
};

/**
 * 노트 이름(예: "C4", "F#5") → 주파수(Hz) 변환
 * A4 = 440Hz 기준, 12-TET
 * @returns {number|null}
 */
export function noteToFreq(name) {
  if (!name || name.length < 2) return null;

  // 이름과 옥타브 분리
  let notePart, octave;
  if (name.length >= 3 && (name[1] === '#' || name[1] === 'b')) {
    notePart = name.slice(0, 2);
    octave = parseInt(name.slice(2), 10);
  } else {
    notePart = name[0];
    octave = parseInt(name.slice(1), 10);
  }

  const semitone = NOTE_NAMES[notePart];
  if (semitone === undefined || isNaN(octave)) return null;

  // A4(=440Hz)를 기준으로 반음 차이 계산
  const stepsFromA4 = (octave - 4) * 12 + (semitone - 9);
  return 440 * Math.pow(2, stepsFromA4 / 12);
}

/**
 * 노트 이름으로 재생
 */
export function playNote(name, duration = 0.5, type = 'sine', volume = 0.4) {
  const freq = noteToFreq(name);
  if (freq === null) return;
  beep(freq, duration, type, volume);
}

/**
 * 여러 주파수를 동시에 재생 (화음)
 */
export function playChord(frequencies, duration = 1.0, type = 'sine', volume = 0.25) {
  if (!frequencies || frequencies.length === 0) return;
  for (const freq of frequencies) {
    beep(freq, duration, type, volume);
  }
}

/**
 * 노트 배열을 순차적으로 재생
 * @param {Array<{freq: number, duration: number, type?: string, volume?: number}>} notes
 */
export function playSequence(notes) {
  if (!notes || notes.length === 0) return;
  let delay = 0;
  for (const n of notes) {
    if (delay === 0) {
      beep(n.freq, n.duration, n.type || 'sine', n.volume || 0.4);
    } else {
      const d = delay;
      setTimeout(() => beep(n.freq, n.duration, n.type || 'sine', n.volume || 0.4), d);
    }
    delay += n.duration * 1000;
  }
}

// ===================================================================
// 3) 시스템 효과음 (UI용)
// ===================================================================

export function successSound() {
  beep(523, 0.15, 'sine', 0.2);  // C5
  setTimeout(() => beep(659, 0.15, 'sine', 0.2), 100);  // E5
  setTimeout(() => beep(784, 0.3, 'sine', 0.2), 200);   // G5
}

export function errorSound() {
  beep(200, 0.3, 'square', 0.15);
}

export function hintSound() {
  beep(880, 0.1, 'sine', 0.15);
  setTimeout(() => beep(1100, 0.15, 'sine', 0.15), 80);
}

export function runSound() {
  beep(660, 0.08, 'sine', 0.1);
}

export function levelUpSound() {
  const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6
  notes.forEach((freq, i) => {
    setTimeout(() => beep(freq, 0.2, 'sine', 0.2), i * 120);
  });
}

// ===================================================================
// 4) 게임 효과음 (슈퍼마리오 스타일, 저작권 무관)
// ===================================================================

/**
 * 점프 효과음 — 상승 주파수 스윕
 */
export function sfxJump() {
  const ctx = getAudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'square';
  osc.frequency.setValueAtTime(300, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.15);

  gain.gain.setValueAtTime(0.2, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.2);
}

/**
 * 코인 획득 효과음 — 높은 2음
 */
export function sfxCoin() {
  beep(988, 0.06, 'square', 0.2);   // B5
  setTimeout(() => beep(1319, 0.12, 'square', 0.2), 60); // E6
}

/**
 * 파워업 효과음 — 상승 아르페지오
 */
export function sfxPowerUp() {
  const notes = [523, 659, 784, 988, 1175, 1319]; // C5→E6
  notes.forEach((freq, i) => {
    setTimeout(() => beep(freq, 0.08, 'square', 0.15), i * 50);
  });
}

/**
 * 죽음/실패 효과음 — 하강 음계
 */
export function sfxDeath() {
  const notes = [494, 466, 440, 370, 311, 247]; // B4→B3 하강
  notes.forEach((freq, i) => {
    setTimeout(() => beep(freq, 0.15, 'square', 0.15), i * 100);
  });
}

/**
 * 파이어볼 효과음 — 빠른 하강 스윕
 */
export function sfxFireball() {
  const ctx = getAudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(900, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.15);

  gain.gain.setValueAtTime(0.15, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.15);
}

/**
 * 파이프/워프 효과음 — 하강 후 상승
 */
export function sfxPipe() {
  const ctx = getAudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'square';
  osc.frequency.setValueAtTime(500, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.2);
  osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.4);

  gain.gain.setValueAtTime(0.15, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.3);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.4);
}

/**
 * 1UP (생명 획득) 효과음 — 밝은 상승 멜로디
 */
export function sfx1Up() {
  const notes = [659, 784, 988, 784, 988, 1319]; // E5-G5-B5-G5-B5-E6
  notes.forEach((freq, i) => {
    setTimeout(() => beep(freq, 0.1, 'square', 0.18), i * 80);
  });
}

/**
 * 버튼/선택 효과음 — 짧은 틱
 */
export function sfxSelect() {
  beep(660, 0.05, 'square', 0.12);
}

/**
 * 경고/위험 효과음
 */
export function sfxWarning() {
  beep(440, 0.15, 'square', 0.2);
  setTimeout(() => beep(440, 0.15, 'square', 0.2), 250);
  setTimeout(() => beep(440, 0.15, 'square', 0.2), 500);
}

/**
 * 폭발 효과음 — 노이즈 기반
 */
export function sfxExplosion() {
  const ctx = getAudioContext();

  // 화이트 노이즈 버퍼 생성
  const bufferSize = ctx.sampleRate * 0.4;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.3, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);

  // 로우패스 필터로 둔탁한 느낌
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(1000, ctx.currentTime);
  filter.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.4);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  noise.start(ctx.currentTime);
  noise.stop(ctx.currentTime + 0.4);
}

/**
 * 레이저 효과음 — 하강 톤
 */
export function sfxLaser() {
  const ctx = getAudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(1500, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.2);

  gain.gain.setValueAtTime(0.15, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.2);
}

// 이름으로 효과음 호출하는 매핑
const SFX_MAP = {
  jump: sfxJump,
  coin: sfxCoin,
  powerup: sfxPowerUp,
  power_up: sfxPowerUp,
  death: sfxDeath,
  fireball: sfxFireball,
  pipe: sfxPipe,
  '1up': sfx1Up,
  oneup: sfx1Up,
  select: sfxSelect,
  warning: sfxWarning,
  explosion: sfxExplosion,
  laser: sfxLaser,
  success: successSound,
  error: errorSound,
  hint: hintSound,
  run: runSound,
  levelup: levelUpSound,
  level_up: levelUpSound,
};

/**
 * 이름으로 효과음 재생
 * @param {string} name - 효과음 이름 (jump, coin, powerup, death 등)
 */
export function playSfx(name) {
  const fn = SFX_MAP[name?.toLowerCase()];
  if (fn) fn();
}

// ===================================================================
// 5) BGM (루프 가능한 8비트 배경음악)
// ===================================================================

// 현재 재생 중인 BGM 상태
let currentBgm = null;

/**
 * BGM 패턴 정의 (저작권 없는 오리지널 8비트 멜로디)
 * 각 패턴은 { notes: [...], tempo, type, volume } 형태
 */
const BGM_PATTERNS = {
  // 모험 테마 — 밝은 8비트 마치
  adventure: {
    notes: [
      'C4','E4','G4','C5','B4','G4','E4','G4',
      'A4','C5','E5','A4','G4','E4','C4','E4',
      'F4','A4','C5','F4','E4','C4','A3','C4',
      'G4','B4','D5','G4','F4','D4','B3','D4',
    ],
    durations: [
      0.15,0.15,0.15,0.3,0.15,0.15,0.15,0.3,
      0.15,0.15,0.15,0.3,0.15,0.15,0.15,0.3,
      0.15,0.15,0.15,0.3,0.15,0.15,0.15,0.3,
      0.15,0.15,0.15,0.3,0.15,0.15,0.15,0.3,
    ],
    type: 'square',
    volume: 0.12,
  },

  // 탐험 테마 — 미스터리한 분위기
  explore: {
    notes: [
      'E4','G4','A4','B4','E4','G4','A4','G4',
      'D4','F#4','A4','D5','D4','F#4','A4','F#4',
      'C4','E4','G4','C5','C4','E4','G4','E4',
      'B3','D#4','F#4','B4','B3','D#4','F#4','D#4',
    ],
    durations: [
      0.2,0.2,0.2,0.4,0.2,0.2,0.2,0.4,
      0.2,0.2,0.2,0.4,0.2,0.2,0.2,0.4,
      0.2,0.2,0.2,0.4,0.2,0.2,0.2,0.4,
      0.2,0.2,0.2,0.4,0.2,0.2,0.2,0.4,
    ],
    type: 'triangle',
    volume: 0.1,
  },

  // 전투 테마 — 긴박한 빠른 템포
  battle: {
    notes: [
      'A4','A4','C5','A4','D5','C5','A4','A4',
      'G4','G4','Bb4','G4','C5','Bb4','G4','G4',
      'F4','F4','A4','F4','C5','A4','F4','F4',
      'E4','E4','G4','E4','B4','G4','E4','E4',
    ],
    durations: [
      0.1,0.1,0.1,0.1,0.15,0.1,0.1,0.15,
      0.1,0.1,0.1,0.1,0.15,0.1,0.1,0.15,
      0.1,0.1,0.1,0.1,0.15,0.1,0.1,0.15,
      0.1,0.1,0.1,0.1,0.15,0.1,0.1,0.15,
    ],
    type: 'square',
    volume: 0.12,
  },

  // 평화 테마 — 느긋한 아르페지오
  peaceful: {
    notes: [
      'C4','E4','G4','C5','G4','E4',
      'F4','A4','C5','F5','C5','A4',
      'G4','B4','D5','G5','D5','B4',
      'C4','E4','G4','C5','G4','E4',
    ],
    durations: [
      0.3,0.3,0.3,0.3,0.3,0.3,
      0.3,0.3,0.3,0.3,0.3,0.3,
      0.3,0.3,0.3,0.3,0.3,0.3,
      0.3,0.3,0.3,0.3,0.3,0.3,
    ],
    type: 'sine',
    volume: 0.1,
  },

  // 승리 팡파레
  victory: {
    notes: [
      'C5','C5','C5','C5','Ab4','Bb4','C5','Bb4','C5',
      'E5','E5','E5','E5','C5','D5','E5','D5','E5',
      'G5','G5','F5','E5','D5','C5','D5','E5','C5',
    ],
    durations: [
      0.12,0.12,0.12,0.35,0.12,0.12,0.12,0.12,0.45,
      0.12,0.12,0.12,0.35,0.12,0.12,0.12,0.12,0.45,
      0.12,0.12,0.12,0.12,0.12,0.12,0.12,0.12,0.6,
    ],
    type: 'square',
    volume: 0.15,
  },
};

/**
 * BGM 재생 시작
 * @param {string} name - BGM 이름 (adventure, explore, battle, peaceful, victory)
 * @param {boolean} loop - 반복 여부 (기본 true)
 */
export function startBgm(name, loop = true) {
  stopBgm(); // 기존 BGM 중지

  const pattern = BGM_PATTERNS[name?.toLowerCase()];
  if (!pattern) return;

  const { notes, durations, type, volume } = pattern;
  let running = true;
  let timeoutIds = [];

  function playPattern() {
    if (!running) return;
    let delay = 0;

    for (let i = 0; i < notes.length; i++) {
      const freq = noteToFreq(notes[i]);
      const dur = durations[i] || 0.2;
      if (freq) {
        const d = delay;
        const tid = setTimeout(() => {
          if (running) beep(freq, dur * 0.9, type, volume);
        }, d);
        timeoutIds.push(tid);
      }
      delay += dur * 1000;
    }

    // 패턴이 끝나면 루프
    if (loop) {
      const tid = setTimeout(() => {
        if (running) playPattern();
      }, delay);
      timeoutIds.push(tid);
    }
  }

  currentBgm = {
    name,
    stop: () => {
      running = false;
      timeoutIds.forEach(id => clearTimeout(id));
      timeoutIds = [];
    },
  };

  playPattern();
}

/**
 * BGM 정지
 */
export function stopBgm() {
  if (currentBgm) {
    currentBgm.stop();
    currentBgm = null;
  }
}

/**
 * 현재 BGM 이름 조회
 */
export function getCurrentBgm() {
  return currentBgm?.name || null;
}

// ===================================================================
// 6) Python 브릿지 인터페이스 — processSoundCommand
// ===================================================================

/**
 * Worker에서 온 사운드 커맨드를 처리
 * vpython-bridge.js의 processBatch에서 호출됨
 *
 * @param {Object} cmd - 사운드 커맨드
 *   { action: 'sound', method: 'beep'|'note'|'chord'|'sequence'|'sfx'|'bgm_start'|'bgm_stop', ... }
 */
export function processSoundCommand(cmd) {
  switch (cmd.method) {
    case 'beep':
      beep(cmd.frequency || 440, cmd.duration || 0.3, cmd.type || 'sine', cmd.volume || 0.3);
      break;

    case 'play':
      play(cmd.frequency || 440, cmd.duration || 0.5);
      break;

    case 'note':
      playNote(cmd.name, cmd.duration || 0.5, cmd.type || 'sine', cmd.volume || 0.4);
      break;

    case 'chord':
      playChord(cmd.frequencies || [], cmd.duration || 1.0, cmd.type || 'sine', cmd.volume || 0.25);
      break;

    case 'sequence':
      playSequence(cmd.notes || []);
      break;

    case 'sfx':
      playSfx(cmd.name);
      break;

    case 'bgm_start':
      startBgm(cmd.name, cmd.loop !== false);
      break;

    case 'bgm_stop':
      stopBgm();
      break;

    default:
      // 알 수 없는 method는 무시
      break;
  }
}

import { useEffect } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import RuntimePanel from './RuntimePanel';
import * as singleton from '../engine/pyodide-singleton';
import { setMasterMuted, setMasterVolume, stopAllSounds } from '../engine/sound-system';

vi.mock('../components/viewport/Viewport3D', () => ({ default: function Viewport({ sceneRef, onSceneReady }) {
  useEffect(() => { sceneRef.current = { _cameraSystem: { onCodeStart: vi.fn() } }; onSceneReady(sceneRef.current); }, [sceneRef, onSceneReady]);
  return <div>3D 화면</div>;
} }));
vi.mock('../engine/object-registry', () => ({ clearRegistry: vi.fn() }));
vi.mock('../engine/vpython-bridge', async () => {
  const { processSoundCommand } = await import('../engine/sound-system');
  return { clearScene: vi.fn(), processBatch: (commands) => commands.filter((command) => command.action === 'sound').forEach(processSoundCommand) };
});

let worker;
let oscillators;
const parameter = () => ({ value: 1, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn(), cancelScheduledValues: vi.fn() });
const node = () => ({ connect: vi.fn(), disconnect: vi.fn() });
class WorkerDouble {
  constructor() { this.postMessage = vi.fn(); this.terminate = vi.fn(); worker = this; }
  emit(data) { this.onmessage?.({ data }); }
}
beforeEach(() => {
  vi.useFakeTimers(); oscillators = [];
  const context = {
    currentTime: 0, state: 'running', destination: {}, resume: vi.fn(async () => {}),
    createGain: () => ({ ...node(), gain: parameter() }),
    createOscillator: () => { const source = { ...node(), frequency: parameter(), start: vi.fn(), stop: vi.fn() }; oscillators.push(source); return source; },
    createDynamicsCompressor: () => ({ ...node(), threshold: parameter(), knee: parameter(), ratio: parameter(), attack: parameter(), release: parameter() }),
    createWaveShaper: () => ({ ...node(), curve: null }),
  };
  function AudioContextDouble() { return context; }
  vi.stubGlobal('AudioContext', AudioContextDouble); vi.stubGlobal('Worker', WorkerDouble);
  setMasterMuted(false); setMasterVolume(0.6); singleton.hardStop();
});
afterEach(() => { cleanup(); stopAllSounds(); vi.runOnlyPendingTimers(); singleton.hardStop(); vi.unstubAllGlobals(); vi.useRealTimers(); });

it('실제 음원 엔진은 Python 본문 완료 뒤 시퀀스를 계속 연주하고 정지·이탈에서 끝낸다', async () => {
  const view = render(<RuntimePanel code="play_sequence(notes)" />);
  await act(async () => { worker.emit({ type: 'ready' }); });
  fireEvent.click(screen.getByRole('button', { name: '▶ 실행' }));
  const runId = worker.postMessage.mock.calls.find(([message]) => message.type === 'run')[0].runId;
  act(() => {
    worker.emit({ type: 'batch', runId, commands: [{ action: 'sound', method: 'sequence', notes: [{ freq: 440, duration: 0.4, type: 'piano' }, { freq: 550, duration: 0.4, type: 'piano' }, { freq: 660, duration: 0.4, type: 'piano' }] }] });
    worker.emit({ type: 'done', runId });
  });
  expect(oscillators).toHaveLength(3);
  expect(screen.getByRole('status')).toHaveTextContent('실행 준비 완료');
  expect(screen.getByRole('button', { name: '■ 정지' })).toBeEnabled();
  act(() => { vi.advanceTimersByTime(400); });
  expect(oscillators).toHaveLength(6);
  fireEvent.click(screen.getByRole('button', { name: '■ 정지' }));
  act(() => { vi.advanceTimersByTime(2000); });
  expect(oscillators).toHaveLength(6);
  oscillators.forEach((source) => expect(source.disconnect).toHaveBeenCalled());
  fireEvent.click(screen.getByRole('button', { name: '▶ 실행' }));
  const nextRun = worker.postMessage.mock.calls.filter(([message]) => message.type === 'run').at(-1)[0].runId;
  act(() => { worker.emit({ type: 'batch', runId: nextRun, commands: [{ action: 'sound', method: 'sequence', notes: [{ freq: 440, duration: 0.4 }, { freq: 550, duration: 0.4 }] }] }); });
  const beforeLeaving = oscillators.length;
  view.unmount(); act(() => { vi.advanceTimersByTime(5000); });
  expect(oscillators).toHaveLength(beforeLeaving);
  oscillators.forEach((source) => expect(source.disconnect).toHaveBeenCalled());
});

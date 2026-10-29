import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import RuntimePanel from './RuntimePanel';
import * as singleton from '../engine/pyodide-singleton';
import { setMasterMuted, setMasterVolume, stopAllSounds } from '../engine/sound-system';

const sound = vi.hoisted(() => ({ state: { volume: 0.6, muted: false, playing: false }, listeners: new Set() }));
const cameraSystems = vi.hoisted(() => []);

vi.mock('../components/viewport/Viewport3D', () => ({
  default: function MockViewport({ sceneRef, onSceneReady }) {
    useEffect(() => {
      const scene = { _cameraSystem: { onCodeStart: vi.fn(), setPreserveDirectionOnCenter: vi.fn() } };
      cameraSystems.push(scene._cameraSystem);
      sceneRef.current = scene;
      onSceneReady(scene);
    }, [sceneRef, onSceneReady]);
    return <div data-testid="viewport">3D 화면</div>;
  },
}));
vi.mock('../engine/vpython-bridge', () => ({ processBatch: vi.fn(), clearScene: vi.fn() }));
vi.mock('../engine/object-registry', () => ({ clearRegistry: vi.fn() }));
vi.mock('../engine/sound-system', () => {
  const publish = (changes) => { sound.state = { ...sound.state, ...changes }; sound.listeners.forEach((listener) => listener(sound.state)); };
  const stop = vi.fn(() => publish({ playing: false }));
  return {
    ensureAudioResumed: vi.fn(), stopAllSounds: stop, resumeAndRun: (callback) => { callback(); return () => {}; },
    getAudioState: () => sound.state,
    subscribeAudioState: (listener) => { sound.listeners.add(listener); return () => sound.listeners.delete(listener); },
    setMasterVolume: vi.fn((volume) => publish({ volume })),
    setMasterMuted: vi.fn((muted) => { if (muted) stop(); publish({ muted }); }),
  };
});

let workers;
class FakeWorker {
  constructor() {
    this.postMessage = vi.fn(); this.terminate = vi.fn(); workers.push(this);
  }
  emit(message) { this.onmessage?.({ data: message }); }
}
async function ready() { await act(async () => { workers.at(-1).emit({ type: 'ready' }); }); }
function currentRun() { return workers.at(-1).postMessage.mock.calls.map(([message]) => message).findLast((message) => message.type === 'run').runId; }

describe('교실 Python 실행 화면', () => {
  beforeEach(() => { workers = []; cameraSystems.length = 0; vi.clearAllMocks(); sound.state = { volume: 0.6, muted: false, playing: false }; sound.listeners.clear(); vi.useFakeTimers(); vi.stubGlobal('Worker', FakeWorker); singleton.hardStop(); });
  afterEach(() => { cleanup(); singleton.hardStop(); vi.unstubAllGlobals(); vi.useRealTimers(); });

  it('연수의 시선 방향 보존은 선택한 실행기에만 적용하고 실행기를 재생성하지 않고 전환한다', async () => {
    const view = render(<RuntimePanel code="print(1)" />);
    await ready();
    const system = cameraSystems.at(-1);
    expect(system.setPreserveDirectionOnCenter).toHaveBeenLastCalledWith(false);

    view.rerender(<RuntimePanel code="print(1)" preserveDirectionOnCenter />);
    expect(system.setPreserveDirectionOnCenter).toHaveBeenLastCalledWith(true);

    view.rerender(<RuntimePanel code="print(1)" preserveDirectionOnCenter={false} />);
    expect(system.setPreserveDirectionOnCenter).toHaveBeenLastCalledWith(false);
    expect(cameraSystems).toHaveLength(1);
    expect(workers).toHaveLength(1);
  });

  it('콘솔은 최근 200줄과 32KB를 유지하고 HTML을 텍스트로 표시한다', async () => {
    render(<RuntimePanel code="print(1)" />);
    await ready();
    fireEvent.click(screen.getByRole('button', { name: '▶ 실행' }));
    const runId = currentRun();
    act(() => {
      for (let index = 0; index < 260; index++) workers[0].emit({ type: 'stdout', runId, text: `${index}: ${'x'.repeat(200)}` });
      workers[0].emit({ type: 'stdout', runId, text: '<img src=x onerror=alert(1)>' });
    });
    const consoleElement = screen.getByLabelText('실행 출력');
    expect(consoleElement.children.length).toBeLessThanOrEqual(200);
    expect(consoleElement.textContent.length).toBeLessThanOrEqual(32_768 + 200);
    expect(consoleElement.textContent).toContain('<img src=x onerror=alert(1)>');
    expect(consoleElement.querySelector('img')).toBeNull();
    expect([...consoleElement.children].some((line) => line.textContent.startsWith('0: '))).toBe(false);
  });

  it('실행 완료 증거는 실행 당시 코드와 출력으로 기록한다', async () => {
    const onRunResult = vi.fn();
    const view = render(<RuntimePanel code="print('원본')" onRunResult={onRunResult} />);
    await ready();
    fireEvent.click(screen.getByRole('button', { name: '▶ 실행' }));
    const runId = currentRun();
    view.rerender(<RuntimePanel code="print('수정본')" onRunResult={onRunResult} />);
    act(() => {
      workers[0].emit({ type: 'stdout', runId, text: '원본' });
      workers[0].emit({ type: 'done', runId });
    });
    expect(onRunResult).toHaveBeenCalledOnce();
    expect(onRunResult).toHaveBeenCalledWith(expect.objectContaining({ status: 'completed', code: "print('원본')", output: expect.arrayContaining([{ text: '원본', type: 'log' }]) }));
  });

  it('정지 확인 중에는 준비 완료 표시와 실행 버튼을 허용하지 않는다', async () => {
    render(<RuntimePanel code="while True:\n    pass" />);
    await ready();
    fireEvent.click(screen.getByRole('button', { name: '▶ 실행' }));
    fireEvent.click(screen.getByRole('button', { name: '■ 정지' }));
    expect(screen.getByRole('status')).toHaveTextContent('실행 종료 확인 중');
    expect(screen.getByRole('button', { name: '▶ 실행' })).toBeDisabled();
    act(() => { vi.advanceTimersByTime(750); });
    expect(screen.getByRole('status')).toHaveTextContent('Python 준비 중');
    expect(screen.getByRole('button', { name: '▶ 실행' })).toBeDisabled();
    await ready();
    expect(screen.getByRole('button', { name: '▶ 실행' })).toBeEnabled();
  });

  it('초기화 실패를 알려주고 수동 엔진 준비를 제공한다', async () => {
    render(<RuntimePanel code="print(1)" />);
    await act(async () => { workers[0].emit({ type: 'error', error: '학교 네트워크 연결 실패' }); });
    expect(screen.getByRole('alert')).toHaveTextContent('학교 네트워크 연결 실패');
    expect(screen.getByRole('button', { name: '▶ 실행' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '엔진 다시 준비' }));
    expect(workers).toHaveLength(2);
    await ready();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('소리 설정은 접혀 있고, 열면 음량과 음소거만 제어한다', async () => {
    const view = render(<RuntimePanel code="print(1)" />); await ready();
    expect(screen.queryByLabelText('소리 음량')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /소리$/ }));
    expect(screen.queryByLabelText('미리 듣기 음색')).toBeNull();
    expect(screen.queryByRole('button', { name: /미리 듣기/ })).toBeNull();
    fireEvent.change(screen.getByLabelText('소리 음량'), { target: { value: '35' } });
    expect(setMasterVolume).toHaveBeenCalledWith(0.35);
    fireEvent.click(screen.getByRole('button', { name: '음소거' }));
    expect(setMasterMuted).toHaveBeenCalledWith(true);
    expect(screen.getByRole('button', { name: '소리 켜기' })).toHaveAttribute('aria-pressed', 'true');
    const stops = stopAllSounds.mock.calls.length; view.unmount();
    expect(stopAllSounds).toHaveBeenCalledTimes(stops + 1);
  });

  it('정상 Python 완료는 예약된 음을 자르지 않고 정지·오류는 소리를 정리한다', async () => {
    render(<RuntimePanel code="play_note('C5', 2)" />); await ready();
    fireEvent.click(screen.getByRole('button', { name: '▶ 실행' }));
    act(() => { sound.state = { ...sound.state, playing: true }; sound.listeners.forEach((listener) => listener(sound.state)); });
    const stops = stopAllSounds.mock.calls.length;
    act(() => { workers[0].emit({ type: 'done', runId: currentRun() }); });
    expect(stopAllSounds).toHaveBeenCalledTimes(stops);
    expect(screen.getByRole('button', { name: '■ 정지' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: '■ 정지' }));
    expect(stopAllSounds).toHaveBeenCalledTimes(stops + 1);
    fireEvent.click(screen.getByRole('button', { name: '▶ 실행' }));
    act(() => { workers[0].emit({ type: 'error', runId: currentRun(), error: '실행 오류' }); });
    expect(stopAllSounds).toHaveBeenCalledTimes(stops + 3);
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import useFullscreen, { fullscreenSupported } from './useFullscreen';

/** 브라우저 전체 화면 API를 흉내 내는 document */
function fakeDocument({ supported = true, reject = false } = {}) {
  const listeners = {};
  const doc = {
    fullscreenEnabled: supported,
    fullscreenElement: null,
    addEventListener: (name, fn) => { (listeners[name] ||= new Set()).add(fn); },
    removeEventListener: (name, fn) => { listeners[name]?.delete(fn); },
    dispatch: (name, event = {}) => { listeners[name]?.forEach((fn) => fn(event)); },
    exitFullscreen: vi.fn(async () => { doc.fullscreenElement = null; doc.dispatch('fullscreenchange'); }),
  };
  const element = {
    requestFullscreen: vi.fn(async () => {
      if (reject) throw new Error('denied');
      doc.fullscreenElement = element;
      doc.dispatch('fullscreenchange');
    }),
  };
  return { doc, element };
}

describe('전체 화면 훅', () => {
  afterEach(() => vi.restoreAllMocks());

  it('브라우저 API로 켜고 Esc(fullscreenchange)로 나가면 상태가 따라온다', async () => {
    const { doc, element } = fakeDocument();
    const ref = { current: element };
    const { result } = renderHook(() => useFullscreen(ref, { doc }));
    expect(result.current.supported).toBe(true);
    expect(result.current.active).toBe(false);

    await act(async () => { await result.current.toggle(); });
    expect(element.requestFullscreen).toHaveBeenCalledTimes(1);
    expect(result.current.active).toBe(true);
    expect(result.current.pseudo).toBe(false);

    // 사용자가 Esc를 누르면 브라우저가 fullscreenElement를 비우고 이벤트를 보낸다
    act(() => { doc.fullscreenElement = null; doc.dispatch('fullscreenchange'); });
    expect(result.current.active).toBe(false);
  });

  it('토글로 나가면 exitFullscreen을 부른다', async () => {
    const { doc, element } = fakeDocument();
    const ref = { current: element };
    const { result } = renderHook(() => useFullscreen(ref, { doc }));
    await act(async () => { await result.current.toggle(); });
    await act(async () => { await result.current.toggle(); });
    expect(doc.exitFullscreen).toHaveBeenCalledTimes(1);
    expect(result.current.active).toBe(false);
  });

  it('API가 없으면(iOS Safari) CSS 대체 모드로 켜고 Esc로 끈다', async () => {
    const { doc, element } = fakeDocument({ supported: false });
    delete element.requestFullscreen;
    const ref = { current: element };
    const { result } = renderHook(() => useFullscreen(ref, { doc }));
    expect(result.current.supported).toBe(false);
    await act(async () => { await result.current.toggle(); });
    expect(result.current.active).toBe(true);
    expect(result.current.pseudo).toBe(true);
    act(() => { doc.dispatch('keydown', { key: 'Escape' }); });
    expect(result.current.active).toBe(false);
  });

  it('요청이 거부되면(iframe allow 없음 등) CSS 대체로 넘어간다', async () => {
    const { doc, element } = fakeDocument({ reject: true });
    const ref = { current: element };
    const { result } = renderHook(() => useFullscreen(ref, { doc }));
    await act(async () => { await result.current.toggle(); });
    expect(result.current.active).toBe(true);
    expect(result.current.pseudo).toBe(true);
  });

  it('fullscreenSupported는 document가 없으면 false', () => {
    expect(fullscreenSupported(undefined)).toBe(false);
    expect(fullscreenSupported({ webkitFullscreenEnabled: true })).toBe(true);
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  initInstallPrompt, getInstallState, subscribeInstallState, promptInstall,
  shouldShowIosHint, dismissIosHint, isIosSafari, isStandalone, resetInstallState,
} from './pwa-install';

function fakeTarget() {
  const handlers = {};
  return {
    addEventListener: (name, fn) => { handlers[name] = fn; },
    fire: (name, event = {}) => handlers[name]?.({ preventDefault: vi.fn(), ...event }),
  };
}

function fakePromptEvent(outcome = 'accepted') {
  return {
    preventDefault: vi.fn(),
    prompt: vi.fn(() => Promise.resolve()),
    userChoice: Promise.resolve({ outcome }),
  };
}

describe('PWA 설치 상태', () => {
  beforeEach(() => resetInstallState());

  it('beforeinstallprompt를 받으면 설치 버튼을 보일 수 있고 기본 띠는 막는다', () => {
    const target = fakeTarget();
    initInstallPrompt(target);
    const listener = vi.fn();
    subscribeInstallState(listener);
    const event = fakePromptEvent();
    target.fire('beforeinstallprompt', event);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(getInstallState().canPrompt).toBe(true);
    expect(listener).toHaveBeenCalledWith({ canPrompt: true, installed: false });
  });

  it('프롬프트를 띄우면 버튼을 숨기고, 수락하면 설치됨으로 바뀐다', async () => {
    const target = fakeTarget();
    initInstallPrompt(target);
    const event = fakePromptEvent('accepted');
    target.fire('beforeinstallprompt', event);
    const result = await promptInstall();
    expect(event.prompt).toHaveBeenCalledTimes(1);
    expect(result).toBe('accepted');
    expect(getInstallState()).toEqual({ canPrompt: false, installed: true });
  });

  it('거절해도 prompt()는 한 번만 부를 수 있으므로 버튼은 다시 보이지 않는다', async () => {
    const target = fakeTarget();
    initInstallPrompt(target);
    target.fire('beforeinstallprompt', fakePromptEvent('dismissed'));
    expect(await promptInstall()).toBe('dismissed');
    expect(getInstallState().canPrompt).toBe(false);
    expect(await promptInstall()).toBe('unavailable');
  });

  it('appinstalled가 오면 설치 버튼을 숨긴다', () => {
    const target = fakeTarget();
    initInstallPrompt(target);
    target.fire('beforeinstallprompt', fakePromptEvent());
    target.fire('appinstalled');
    expect(getInstallState()).toEqual({ canPrompt: false, installed: true });
  });

  it('iOS Safari만 홈 화면 안내 대상이고, 닫으면 기억한다', () => {
    const iosSafari = { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1', platform: 'iPhone', maxTouchPoints: 5 };
    const iosChrome = { ...iosSafari, userAgent: iosSafari.userAgent.replace('Version/17.0', 'CriOS/120.0') };
    const ipadDesktopUa = { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15', platform: 'MacIntel', maxTouchPoints: 5 };
    const mac = { ...ipadDesktopUa, maxTouchPoints: 0 };
    expect(isIosSafari(iosSafari)).toBe(true);
    expect(isIosSafari(iosChrome)).toBe(false);
    expect(isIosSafari(ipadDesktopUa)).toBe(true);
    expect(isIosSafari(mac)).toBe(false);

    const store = new Map();
    const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
    const win = { matchMedia: () => ({ matches: false }), navigator: {} };
    expect(shouldShowIosHint({ nav: iosSafari, win, storage })).toBe(true);
    dismissIosHint(storage);
    expect(shouldShowIosHint({ nav: iosSafari, win, storage })).toBe(false);
    // 이미 홈 화면 앱으로 열렸으면 안내하지 않는다
    expect(shouldShowIosHint({ nav: iosSafari, win: { navigator: { standalone: true } }, storage: { getItem: () => null } })).toBe(false);
    expect(isStandalone({ matchMedia: () => ({ matches: true }), navigator: {} })).toBe(true);
  });

  it('localStorage가 막혀 있어도 예외를 내지 않는다', () => {
    const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
    const iosSafari = { userAgent: 'iPhone Safari', platform: 'iPhone', maxTouchPoints: 5 };
    const win = { matchMedia: () => ({ matches: false }), navigator: {} };
    expect(shouldShowIosHint({ nav: iosSafari, win, storage: broken })).toBe(true);
    expect(() => dismissIosHint(broken)).not.toThrow();
  });
});

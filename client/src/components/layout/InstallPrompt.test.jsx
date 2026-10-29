import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { I18nProvider } from '../../i18n';
import { InstallButton, IosInstallHint } from './InstallPrompt';
import { initInstallPrompt, resetInstallState } from '../../lib/pwa-install';

vi.mock('../../lib/pwa-install', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, shouldShowIosHint: vi.fn(() => false) };
});
import { shouldShowIosHint } from '../../lib/pwa-install';

function fakeTarget() {
  const handlers = {};
  return {
    addEventListener: (name, fn) => { handlers[name] = fn; },
    fire: (name, event = {}) => handlers[name]?.({ preventDefault: vi.fn(), ...event }),
  };
}

const renderWithI18n = (ui) => render(<I18nProvider>{ui}</I18nProvider>);

describe('설치 버튼', () => {
  beforeEach(() => { resetInstallState(); localStorage.clear(); });
  afterEach(() => cleanup());

  it('설치 프롬프트가 없으면 아무것도 그리지 않는다', () => {
    renderWithI18n(<InstallButton />);
    expect(screen.queryByTestId('pwa-install-button')).toBeNull();
  });

  it('beforeinstallprompt 뒤에 보이고, 누르면 프롬프트를 띄운 뒤 숨긴다', async () => {
    const target = fakeTarget();
    initInstallPrompt(target);
    renderWithI18n(<InstallButton />);
    const event = { preventDefault: vi.fn(), prompt: vi.fn(() => Promise.resolve()), userChoice: Promise.resolve({ outcome: 'accepted' }) };
    act(() => { target.fire('beforeinstallprompt', event); });
    const button = screen.getByTestId('pwa-install-button');
    expect(button).toHaveTextContent('앱으로 설치');
    await act(async () => { fireEvent.click(button); await event.userChoice; });
    expect(event.prompt).toHaveBeenCalled();
    expect(screen.queryByTestId('pwa-install-button')).toBeNull();
  });

  it('설치가 끝나면(appinstalled) 버튼이 사라진다', () => {
    const target = fakeTarget();
    initInstallPrompt(target);
    renderWithI18n(<InstallButton />);
    act(() => { target.fire('beforeinstallprompt', { prompt: vi.fn(), userChoice: new Promise(() => {}) }); });
    expect(screen.getByTestId('pwa-install-button')).toBeInTheDocument();
    act(() => { target.fire('appinstalled'); });
    expect(screen.queryByTestId('pwa-install-button')).toBeNull();
  });
});

describe('iOS 홈 화면 안내', () => {
  afterEach(() => cleanup());

  it('대상이 아니면 그리지 않는다', () => {
    shouldShowIosHint.mockReturnValue(false);
    renderWithI18n(<IosInstallHint />);
    expect(screen.queryByTestId('ios-install-hint')).toBeNull();
  });

  it('대상이면 안내를 보이고 닫기를 누르면 localStorage에 기억한다', () => {
    shouldShowIosHint.mockReturnValue(true);
    renderWithI18n(<IosInstallHint />);
    expect(screen.getByTestId('ios-install-hint')).toHaveTextContent('홈 화면에 추가');
    fireEvent.click(screen.getByText('닫기'));
    expect(screen.queryByTestId('ios-install-hint')).toBeNull();
    expect(localStorage.getItem('vpylab-ios-install-hint-dismissed')).toBe('1');
  });
});

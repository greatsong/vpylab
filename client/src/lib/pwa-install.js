/**
 * PWA 설치 상태.
 * 브라우저가 보내는 beforeinstallprompt 이벤트를 붙잡아 두었다가 헤더의 "앱으로 설치" 버튼이
 * 사용자 클릭 시점에 띄웁니다. iOS Safari는 이 이벤트가 없으므로 "홈 화면에 추가" 안내를
 * 한 번만 보여 주고, 닫으면 localStorage에 기억합니다.
 */
const IOS_HINT_KEY = 'vpylab-ios-install-hint-dismissed';

let deferredPrompt = null;
let installed = false;
let snapshot = { canPrompt: false, installed: false };
const listeners = new Set();

function publish() {
  snapshot = { canPrompt: !!deferredPrompt && !installed, installed };
  listeners.forEach((listener) => listener(snapshot));
}

/** 이미 설치된 앱(독립 창)으로 열렸는지 */
export function isStandalone(win = typeof window !== 'undefined' ? window : undefined) {
  if (!win) return false;
  try {
    if (win.matchMedia?.('(display-mode: standalone)')?.matches) return true;
  } catch { /* matchMedia가 없는 환경 */ }
  return win.navigator?.standalone === true;
}

/** iOS의 Safari인지 (iPadOS 13+는 데스크톱 UA를 쓰므로 터치 지점 수로 구분) */
export function isIosSafari(nav = typeof navigator !== 'undefined' ? navigator : undefined) {
  if (!nav) return false;
  const ua = nav.userAgent || '';
  const isIos = /iPad|iPhone|iPod/.test(ua) || (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1);
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|OPT\//.test(ua);
  return isIos && isSafari;
}

export function getInstallState() { return snapshot; }

export function subscribeInstallState(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** 앱 시작 직후(React 마운트 전) 한 번 호출합니다. 이벤트는 로드 뒤 곧 오므로 늦게 붙이면 놓칩니다. */
export function initInstallPrompt(target = typeof window !== 'undefined' ? window : undefined) {
  if (!target?.addEventListener) return;
  target.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault(); // 브라우저의 자동 설치 띠 대신 헤더 버튼으로 안내합니다.
    deferredPrompt = event;
    installed = false;
    publish();
  });
  target.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    installed = true;
    publish();
  });
}

/**
 * 붙잡아 둔 설치 프롬프트를 띄웁니다. prompt()는 한 번만 부를 수 있어 결과와 관계없이 버튼을 숨깁니다.
 * @returns {Promise<'accepted'|'dismissed'|'unavailable'>}
 */
export async function promptInstall() {
  const prompt = deferredPrompt;
  if (!prompt) return 'unavailable';
  deferredPrompt = null;
  publish();
  try {
    await prompt.prompt();
    const choice = await prompt.userChoice;
    if (choice?.outcome === 'accepted') installed = true;
    publish();
    return choice?.outcome === 'accepted' ? 'accepted' : 'dismissed';
  } catch {
    publish();
    return 'dismissed';
  }
}

export function shouldShowIosHint({ nav, win, storage } = {}) {
  if (!isIosSafari(nav) || isStandalone(win)) return false;
  try {
    const store = storage || localStorage;
    return store.getItem(IOS_HINT_KEY) !== '1';
  } catch {
    return true;
  }
}

export function dismissIosHint(storage) {
  try {
    (storage || localStorage).setItem(IOS_HINT_KEY, '1');
  } catch { /* 사생활 보호 모드 등 저장 불가 — 이번 세션에서만 닫힘 */ }
}

/** 테스트 전용 */
export function resetInstallState() {
  deferredPrompt = null;
  installed = false;
  listeners.clear();
  snapshot = { canPrompt: false, installed: false };
}

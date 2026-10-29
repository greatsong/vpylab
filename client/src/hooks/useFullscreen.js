import { useCallback, useEffect, useState } from 'react';

/**
 * 전체 화면 API가 있는지. iOS Safari는 iPhone에서 요소 전체 화면을 지원하지 않습니다(webkit 접두어도 없음).
 * 그때는 CSS로 화면을 채우는 대체 방식을 씁니다.
 */
export function fullscreenSupported(doc = typeof document !== 'undefined' ? document : undefined) {
  if (!doc) return false;
  return !!(doc.fullscreenEnabled || doc.webkitFullscreenEnabled);
}

function requestOn(element) {
  const request = element.requestFullscreen || element.webkitRequestFullscreen;
  return request ? request.call(element) : Promise.reject(new Error('fullscreen unsupported'));
}

function exitOn(doc) {
  const exit = doc.exitFullscreen || doc.webkitExitFullscreen;
  return exit ? exit.call(doc) : Promise.resolve();
}

function currentElement(doc) {
  return doc.fullscreenElement || doc.webkitFullscreenElement || null;
}

/**
 * ref가 가리키는 요소를 전체 화면으로 띄우고 상태를 돌려줍니다.
 * - 브라우저 API를 쓰면 Esc로 나갈 때 fullscreenchange로 상태가 따라옵니다.
 * - API가 없으면 CSS 대체(pseudo) 모드로 켜고, Esc 키로 끕니다.
 * @returns {{ active: boolean, pseudo: boolean, supported: boolean, toggle: () => Promise<void>, exit: () => Promise<void> }}
 */
export default function useFullscreen(ref, { doc = typeof document !== 'undefined' ? document : undefined } = {}) {
  const supported = fullscreenSupported(doc);
  const [active, setActive] = useState(false);
  const [pseudo, setPseudo] = useState(false);

  useEffect(() => {
    if (!doc || !supported) return undefined;
    const sync = () => setActive(!!ref.current && currentElement(doc) === ref.current);
    doc.addEventListener('fullscreenchange', sync);
    doc.addEventListener('webkitfullscreenchange', sync);
    return () => {
      doc.removeEventListener('fullscreenchange', sync);
      doc.removeEventListener('webkitfullscreenchange', sync);
    };
  }, [doc, ref, supported]);

  // CSS 대체 모드는 Esc로 나갑니다.
  useEffect(() => {
    if (!pseudo || !doc) return undefined;
    const onKey = (event) => { if (event.key === 'Escape') setPseudo(false); };
    doc.addEventListener('keydown', onKey);
    return () => doc.removeEventListener('keydown', onKey);
  }, [pseudo, doc]);

  const exit = useCallback(async () => {
    if (pseudo) { setPseudo(false); return; }
    if (doc && currentElement(doc)) {
      try { await exitOn(doc); } catch { /* 이미 나간 상태 */ }
    }
    setActive(false);
  }, [doc, pseudo]);

  const toggle = useCallback(async () => {
    const element = ref.current;
    if (!element) return;
    if (active || pseudo) { await exit(); return; }
    if (supported) {
      try {
        await requestOn(element);
        setActive(true);
        return;
      } catch { /* 권한 거부·iframe allow 없음 → CSS 대체 */ }
    }
    setPseudo(true);
  }, [ref, active, pseudo, supported, exit]);

  return { active: active || pseudo, pseudo, supported, toggle, exit };
}

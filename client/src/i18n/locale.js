/** 공유 링크의 명시 언어 > 브라우저 선택 > 한국어 순으로 시작합니다. */
export function readInitialLocale({ search = '', storage } = {}) {
  const requested = new URLSearchParams(search).get('lang');
  let saved;
  try { saved = storage?.getItem('vpylab-locale'); } catch { /* 설정을 읽지 못해도 시작합니다. */ }
  const locale = ['ko', 'en'].includes(requested) ? requested : ['ko', 'en'].includes(saved) ? saved : 'ko';
  if (requested === locale) try { storage?.setItem('vpylab-locale', locale); } catch { /* 현재 탭에서는 선택 언어를 씁니다. */ }
  return locale;
}

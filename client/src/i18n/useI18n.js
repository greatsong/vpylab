import { useContext, useMemo } from 'react';
import { I18nContext, messages, translate } from './context';

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}

/**
 * I18nProvider 밖(교실 앱 등)에서도 쓸 수 있는 선택적 훅. 공급자가 없으면 한국어로 번역합니다.
 * Viewport3D처럼 여러 앱이 공유하는 구성 요소에서 씁니다.
 */
export function useOptionalI18n(fallbackLocale = 'ko') {
  const ctx = useContext(I18nContext);
  const fallback = useMemo(() => ({
    locale: fallbackLocale,
    t: (key, params) => translate(fallbackLocale, key, params),
    messages: messages[fallbackLocale] || messages.en,
  }), [fallbackLocale]);
  return ctx || fallback;
}

import { createContext, useContext, useMemo } from 'react';
import useAppStore from '../stores/appStore';
import ko from './ko.json';
import en from './en.json';

const messages = { ko, en };

const I18nContext = createContext(null);

/**
 * 중첩 키로 번역 문자열을 가져온다.
 * 예: t('home.serverConnected') → '서버 연결됨'
 * 템플릿 변수: t('home.missionCount', { count: 8 }) → '8개 미션'
 */
function getNestedValue(obj, path) {
  return path.split('.').reduce((acc, key) => acc?.[key], obj);
}

function translate(locale, key, params = {}) {
  const msg = getNestedValue(messages[locale], key)
    || getNestedValue(messages['en'], key)  // fallback to English
    || key;

  if (typeof msg !== 'string') return key;

  return msg.replace(/\{\{(\w+)\}\}/g, (_, k) => params[k] ?? `{{${k}}}`);
}

export function I18nProvider({ children }) {
  const locale = useAppStore((s) => s.locale);

  const value = useMemo(() => ({
    locale,
    t: (key, params) => translate(locale, key, params),
    messages: messages[locale] || messages['en'],
  }), [locale]);

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}

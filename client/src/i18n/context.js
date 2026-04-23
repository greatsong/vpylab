import { createContext } from 'react';
import ko from './ko.json';
import en from './en.json';

export const messages = { ko, en };

export const I18nContext = createContext(null);

/**
 * 중첩 키로 번역 문자열을 가져온다.
 * 예: t('home.serverConnected') → '서버 연결됨'
 * 템플릿 변수: t('home.missionCount', { count: 8 }) → '8개 미션'
 */
function getNestedValue(obj, path) {
  return path.split('.').reduce((acc, key) => acc?.[key], obj);
}

export function translate(locale, key, params = {}) {
  const msg = getNestedValue(messages[locale], key)
    || getNestedValue(messages.en, key)
    || key;

  if (typeof msg !== 'string') return key;

  return msg.replace(/\{\{(\w+)\}\}/g, (_, k) => params[k] ?? `{{${k}}}`);
}

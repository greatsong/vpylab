import { useMemo } from 'react';
import useAppStore from '../stores/appStore';
import { I18nContext, messages, translate } from './context';

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

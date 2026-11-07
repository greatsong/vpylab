import useAppStore from '../stores/appStore';
import english from './en-ui-text.json';

const normalize = value => value.replace(/\s+/g, ' ').trim();

/** 고정 UI 문구만 번역합니다. 학생 코드·이름·설명에는 적용하지 않습니다. */
export function translateUi(locale, source, ...values) {
  if (Array.isArray(source) && Object.hasOwn(source, 'raw')) {
    const key = source.map((part, i) => part + (i < values.length ? `{${i}}` : '')).join('');
    const pattern = locale === 'en' ? (Object.hasOwn(english, normalize(key)) ? english[normalize(key)] : key) : key;
    return pattern.replace(/\{(\d+)\}/g, (token, i) => String(values[Number(i)] ?? token));
  }
  if (typeof source !== 'string' || locale !== 'en') return source;
  return translateSystemMessage(locale, source);
}

export function useUiText() {
  useAppStore(state => state.locale);
  return uiText;
}

/** 컴포넌트 밖에서 실행하는 서비스 안내용. 저장 데이터는 바꾸지 않습니다. */
export function uiText(source, ...values) {
  return translateUi(useAppStore.getState().locale, source, ...values);
}

const escapePattern = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const systemPatterns = Object.entries(english).filter(([key]) => /\{\d+\}/.test(key)).map(([key, value]) => {
  const indices = [];
  const parts = key.split(/(\{\d+\})/g).map(part => {
    if (!/^\{\d+\}$/.test(part)) return escapePattern(part);
    indices.push(Number(part.slice(1, -1)));
    return '([\\s\\S]*?)';
  });
  return { pattern: new RegExp('^' + parts.join('') + '$'), indices, value };
});
/** Worker·저장소가 만든 안내/오류 전용. 학생 stdout·제목에는 쓰지 않습니다. */
export function translateSystemMessage(locale, source) {
  if (locale !== 'en' || typeof source !== 'string') return source;
  const key=normalize(source);
  if (Object.hasOwn(english, key)) return english[key];
  for (const { pattern, indices, value } of systemPatterns) {
    const match = pattern.exec(normalize(source));
    if (!match) continue;
    const values = Object.fromEntries(indices.map((index, i) => [index, match[i + 1]]));
    return value.replace(/\{(\d+)\}/g, (token, i) => values[i] ?? token);
  }
  return source;
}

export function getUiLocale() { return useAppStore.getState().locale; }

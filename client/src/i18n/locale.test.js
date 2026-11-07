import { describe, expect, it, vi } from 'vitest';
import { readInitialLocale } from './locale';

describe('shared English entry links', () => {
  it('uses and remembers an explicit supported language', () => {
    const storage={getItem:()=> 'ko',setItem:vi.fn()};
    expect(readInitialLocale({search:'?lang=en&lesson=beg-light-sound/light-sound-1',storage})).toBe('en');
    expect(storage.setItem).toHaveBeenCalledWith('vpylab-locale','en');
  });
  it('ignores an unsupported query without losing the saved language', () => {
    const storage={getItem:()=> 'en',setItem:vi.fn()};
    expect(readInitialLocale({search:'?lang=anything',storage})).toBe('en');
    expect(storage.setItem).not.toHaveBeenCalled();
  });
  it('opens supported language links even when browser storage is unavailable', () => {
    const storage={getItem:()=>{throw Error('blocked')},setItem:()=>{throw Error('blocked')}};
    expect(readInitialLocale({search:'?lang=en',storage})).toBe('en');
    expect(readInitialLocale({storage})).toBe('ko');
  });
});

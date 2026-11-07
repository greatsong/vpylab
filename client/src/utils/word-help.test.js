import { afterEach,expect,it } from 'vitest';
import { claimWordTip,readWordHelp,rememberWord } from './word-help';
afterEach(()=>localStorage.clear());
it('단어별 자동 안내는 계정·손님 각각 두 번만 허용한다',()=>{expect(claimWordTip('a','sphere')).toBe(true);expect(claimWordTip('a','sphere')).toBe(true);expect(claimWordTip('a','sphere')).toBe(false);expect(claimWordTip('b','sphere')).toBe(true);expect(claimWordTip(null,'sphere')).toBe(true);expect(readWordHelp('a').views.sphere).toBe(2);expect(claimWordTip('a','color')).toBe(false);});
it('알겠어요는 즉시 자동 안내를 중단하며 문서의 기존 기억 데이터도 읽는다',()=>{localStorage.setItem('vpylab:word-help:v1:a',JSON.stringify(['compound']));expect(claimWordTip('a','compound')).toBe(false);rememberWord('a','opacity');expect(claimWordTip('a','opacity')).toBe(false);expect(readWordHelp('a').known).toEqual(['compound','opacity']);});
it('브라우저 보관 공간을 지우면 안내 횟수도 초기화한다',()=>{claimWordTip('a','radius');claimWordTip('a','radius');localStorage.clear();expect(claimWordTip('a','radius')).toBe(true);});

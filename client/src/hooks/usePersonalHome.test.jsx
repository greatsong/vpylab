import { act, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import usePersonalHome from './usePersonalHome';
import { personalHomeKey, writePersonalHome } from '../utils/personal-home';
function Probe({scope}){const home=usePersonalHome(scope);return <p>{home?.greeting||'기본 화면'}</p>;}
afterEach(()=>localStorage.clear());
it('같은 탭의 설정과 다른 탭의 변경을 반영하고 계정 전환 시 이전 설정을 보여주지 않는다',()=>{
 const {rerender}=render(<Probe scope="a"/>);act(()=>{writePersonalHome('a',{greeting:'A의 공간'});});expect(screen.getByText('A의 공간')).toBeVisible();rerender(<Probe scope="b"/>);expect(screen.getByText('기본 화면')).toBeVisible();
 act(()=>{localStorage.setItem(personalHomeKey('b'),JSON.stringify({version:1,greeting:'B의 공간'}));window.dispatchEvent(new StorageEvent('storage',{key:personalHomeKey('b')}));});expect(screen.getByText('B의 공간')).toBeVisible();expect(screen.queryByText('A의 공간')).toBeNull();
});

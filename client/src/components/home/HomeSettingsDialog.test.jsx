import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import HomeSettingsDialog from './HomeSettingsDialog';
import { readPersonalHome, writePersonalHome } from '../../utils/personal-home';
const auth=vi.hoisted(()=>({user:{id:'a'},loading:false}));
vi.mock('../../stores/authStore',()=>({default:{getState:()=>auth}}));
beforeEach(()=>{auth.user={id:'a'};auth.loading=false;HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};});
afterEach(()=>{localStorage.clear();vi.restoreAllMocks();});
it('현재 코드 사본을 내 메인으로 지정한다',()=>{
 const done=vi.fn();render(<MemoryRouter><HomeSettingsDialog userId="a" pin={{title:'작품',code:'sphere()'}} onClose={done}/></MemoryRouter>);fireEvent.change(screen.getByLabelText('작품 이름'),{target:{value:'나의 종'}});fireEvent.click(screen.getByRole('button',{name:'내 메인으로 설정'}));expect(readPersonalHome('a').project).toMatchObject({title:'나의 종',code:'sphere()'});expect(done).toHaveBeenCalledOnce();
});
it('대화상자에서 계정이 바뀌면 이전 작품을 다른 계정에 저장하지 않는다',()=>{
 render(<MemoryRouter><HomeSettingsDialog userId="a" pin={{title:'A의 작품',code:'sphere()'}} onClose={()=>{}}/></MemoryRouter>);auth.user={id:'b'};fireEvent.click(screen.getByRole('button',{name:'내 메인으로 설정'}));expect(screen.getByRole('alert')).toHaveTextContent('계정이 바뀌었습니다');expect(readPersonalHome('a')).toBeNull();expect(readPersonalHome('b')).toBeNull();
});

it('명시적으로 삭제를 확인한 경우에만 자신의 보관본을 지운다',()=>{
 writePersonalHome('a',{project:{title:'A의 작품',code:'sphere()'}});writePersonalHome('b',{greeting:'B의 공간'});
 const confirm=vi.spyOn(window,'confirm').mockReturnValue(false);render(<MemoryRouter><HomeSettingsDialog userId="a" onClose={()=>{}}/></MemoryRouter>);
 fireEvent.click(screen.getByText('이 브라우저의 보관본 관리'));fireEvent.click(screen.getByRole('button',{name:'보관본 삭제'}));expect(readPersonalHome('a')).not.toBeNull();
 confirm.mockReturnValue(true);fireEvent.click(screen.getByRole('button',{name:'보관본 삭제'}));expect(readPersonalHome('a')).toBeNull();expect(readPersonalHome('b').greeting).toBe('B의 공간');
});

import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import useAuthStore from '../stores/authStore';
import { writePersonalHome } from '../utils/personal-home';
import Home from './Home';
vi.mock('../i18n/useI18n',()=>({useI18n:()=>({locale:'ko'})}));
vi.mock('../components/layout/Header',()=>({default:()=> <header>메뉴</header>}));
vi.mock('../components/home/WelcomeFriends',()=>({default:()=> <div>기본 환영 친구</div>}));
vi.mock('../components/home/PersonalHomeProject',()=>({default:({project})=><div>{project.title}</div>}));
afterEach(()=>{act(()=>{useAuthStore.setState({user:null,loading:true});localStorage.clear();});});
it('인증 준비 중에는 손님 작품을 노출하지 않고 계정 전환 즉시 이전 작품을 숨긴다',async()=>{
 writePersonalHome(null,{project:{title:'손님 전용',code:'sphere()'}});writePersonalHome('a',{project:{title:'A 전용 작품',code:'sphere()'}});
 act(()=>useAuthStore.setState({user:null,loading:true}));render(<MemoryRouter><Home/></MemoryRouter>);
 expect(screen.getByRole('status')).toBeVisible();expect(screen.queryByText('기본 환영 친구')).toBeNull();expect(screen.queryByText('손님 전용')).toBeNull();
 act(()=>useAuthStore.setState({user:{id:'a'},loading:false}));await screen.findByText('A 전용 작품');
 act(()=>useAuthStore.setState({user:{id:'b'},loading:false}));await screen.findByText('기본 환영 친구');expect(screen.queryByText('A 전용 작품')).toBeNull();expect(screen.queryByText('손님 전용')).toBeNull();
});

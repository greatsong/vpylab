import {beforeEach,it,expect,vi} from 'vitest';
import {fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {MemoryRouter,useNavigate,useLocation} from 'react-router-dom';
import {I18nProvider} from '../i18n';
import useAppStore from '../stores/appStore';
import Docs from './Docs';
vi.mock('../components/layout/Header',()=>({default:()=> <header>VPyLab</header>}));
function Probe(){const navigate=useNavigate(),location=useLocation();return <><button onClick={()=>navigate(-1)}>History back</button><output data-testid="location">{location.hash}</output></>;}
function setup(path='/docs'){return render(<I18nProvider><MemoryRouter initialEntries={[path]}><Docs/><Probe/></MemoryRouter></I18nProvider>)}
beforeEach(()=>{useAppStore.setState({locale:'ko'});});
it('기본 가이드·해시 링크·브라우저 뒤로가기와 본문 스크롤이 실제 선택과 일치한다',async()=>{
 setup();expect(document.querySelector('article').dataset.docId).toBe('shape-start');
 const main=screen.getByRole('main');main.scrollTop=900;
 fireEvent.click(screen.getByRole('button',{name:'늘이고 납작하게'}));expect(screen.getByTestId('location')).toHaveTextContent('#shape-stretch');expect(main.scrollTop).toBe(0);
 fireEvent.click(screen.getByRole('button',{name:'안이 빈 컵 만들기'}));expect(document.querySelector('article').dataset.docId).toBe('shape-cup');
 fireEvent.click(screen.getByText('History back'));await waitFor(()=>expect(document.querySelector('article').dataset.docId).toBe('shape-stretch'));
});
it('확장·혼합 인자를 문자로 구분하고 한글 검색으로 가이드를 찾는다',()=>{
 setup('/docs#local_light');expect(screen.getByRole('heading',{level:1})).toHaveTextContent('local_light');expect(screen.getByRole('region',{name:'인자 설명 표'})).toHaveTextContent('VPyLab 확장');
 fireEvent.change(screen.getByRole('searchbox'),{target:{value:'반구'}});fireEvent.click(screen.getByRole('button',{name:'반구와 돔 만들기'}));expect(screen.getByText(/make_dome은 VPython 내장 명령이 아닙니다/)).toBeVisible();expect(screen.getByRole('link',{name:'실습에서 열기 →'})).toHaveAttribute('href','/sandbox?doc=shape-dome');
});
it('모바일 목록은 Escape로 닫히고 열었던 버튼으로 포커스가 돌아온다',async()=>{
 setup();const opener=screen.getByRole('button',{name:'문서 목록 열기'});opener.focus();fireEvent.click(opener);const dialog=screen.getByRole('dialog');expect(within(dialog).getByRole('searchbox')).toHaveFocus();fireEvent.keyDown(document,{key:'Escape'});await waitFor(()=>expect(screen.queryByRole('dialog')).not.toBeInTheDocument());expect(opener).toHaveFocus();
});
it('없는 해시와 잘못된 인코딩을 안전하게 안내한다',()=>{
 setup('/docs#%E0%A4%A');expect(screen.getByRole('heading',{level:1})).toHaveTextContent('문서를 찾을 수 없습니다.');fireEvent.click(screen.getByRole('button',{name:'모양 만들기 시작으로'}));expect(document.querySelector('article').dataset.docId).toBe('shape-start');
});
it('새 가이드로 옮기면 앞 가이드의 확인 답이 접히고 검색 지우기는 입력 포커스를 유지한다',()=>{
 setup('/docs#shape-stretch');const details=document.querySelector('article details');details.open=true;
 fireEvent.click(screen.getByRole('button',{name:'안이 빈 컵 만들기'}));expect(document.querySelector('article details')).not.toHaveAttribute('open');
 const input=screen.getByRole('searchbox');fireEvent.change(input,{target:{value:'컵'}});fireEvent.click(screen.getByRole('button',{name:'검색 지우기'}));expect(input).toHaveFocus();
});

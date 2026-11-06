import {it,expect,vi} from 'vitest';
import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import DocCodeBlock from './DocCodeBlock';
it('문자열·주석·부등호를 HTML로 실행하지 않고 원문 그대로 보여준다',()=>{
 const code='if x < 3:\n    print("<img src=x onerror=alert(1)>") # 12 < 30';render(<DocCodeBlock code={code}/>);expect(document.querySelector('pre code').textContent).toBe(code);expect(document.querySelector('img')).toBeNull();expect(screen.getByRole('button',{name:'예제 코드 복사'})).toBeVisible();
});
it('제공 함수 포함 전체 복사와 복사 실패를 정확하게 알린다',async()=>{
 const writeText=vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('denied'));Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText}});
 render(<DocCodeBlock code="make_dome()" copyCode={'def make_dome():\n    pass\nmake_dome()'}/>);const button=screen.getByRole('button',{name:'제공 함수 포함 전체 코드 복사'});fireEvent.click(button);await waitFor(()=>expect(screen.getByRole('status')).toHaveTextContent('복사했습니다.'));expect(writeText).toHaveBeenCalledWith('def make_dome():\n    pass\nmake_dome()');fireEvent.click(button);await waitFor(()=>expect(screen.getByRole('status')).toHaveTextContent('복사하지 못했습니다.'));
});

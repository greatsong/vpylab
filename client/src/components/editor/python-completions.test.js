import {expect,it,vi} from 'vitest';
import {completionChoices,pythonContext,registerPythonHelp} from './python-completions';
const names=s=>completionChoices(s).map(x=>x.name);
it('문서 기반 함수와 내 변수·함수를 제공하고 주석·문자열에서는 추천하지 않는다',()=>{
 expect(names('sp')).toContain('sphere');expect(names('friend = compound([])\nfr')).toContain('friend');expect(names('def jump():\n    pass\nju')).toContain('jump');expect(names('# sp')).toEqual([]);expect(names('print("sp')).toEqual([]);expect(names("'''sp")).toEqual([]);
});
it('현재 호출의 인자만 안내하고 사용한 인자·위치 인자·안쪽 vector를 구분한다',()=>{
 expect(names('sphere(radius=1, op')).toContain('opacity');expect(names('sphere(radius=1, op')).not.toContain('radius');expect(names('vector(1, y')).not.toContain('x');expect(names('sphere(pos=vector(1, y')).toContain('y');expect(pythonContext('sphere(pos=vector(1, 2), op').call.name).toBe('sphere');expect(completionChoices('sphere(op').find(x=>x.name==='opacity').insertText).toBe('opacity=');
});
it('점 뒤에는 해당 종류의 속성만 제안하며 모르는 객체의 타입을 지어내지 않는다',()=>{
 expect(names('ball = sphere()\nball.')).toContain('radius');expect(names('ball = sphere()\nball.pos.')).toContain('x');expect(names('color.')).toContain('red');expect(names('scene.')).toContain('range');expect(names('items = []\nitems.')).toContain('append');expect(names('label1=label()\nlabel1.')).not.toContain('axis');expect(names('unknown.')).toEqual([]);
});
it('편집기 지원을 중복 등록하지 않고 폐기 후 재등록할 수 있다',()=>{
 const handles=[],register=vi.fn(()=>{const handle={dispose:vi.fn()};handles.push(handle);return handle;});const monaco={languages:{registerCompletionItemProvider:register,registerHoverProvider:register,registerSignatureHelpProvider:register}};
 const a=registerPythonHelp(monaco);expect(registerPythonHelp(monaco)).toBe(a);expect(register).toHaveBeenCalledTimes(3);a.dispose();handles.forEach(h=>expect(h.dispose).toHaveBeenCalledOnce());registerPythonHelp(monaco);expect(register).toHaveBeenCalledTimes(6);
});

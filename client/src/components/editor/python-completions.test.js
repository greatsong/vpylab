import {expect,it,vi} from 'vitest';
import {completionChoices,pythonContext,registerPythonHelp} from './python-completions';
const names=s=>completionChoices(s).map(x=>x.name);
it('문서 기반 함수와 내 변수·함수를 제공하고 주석·문자열에서는 추천하지 않는다',()=>{
 expect(names('sp')).toContain('sphere');expect(names('friend = compound([])\nfr')).toContain('friend');expect(names('def jump():\n    pass\nju')).toContain('jump');expect(names('# sp')).toEqual([]);expect(names('print("sp')).toEqual([]);expect(names("'''sp")).toEqual([]);
});
it('현재 호출의 인자만 안내하고 사용한 인자·위치 인자·안쪽 vector를 구분한다',()=>{
 expect(names('sphere(radius=1, op')).toContain('opacity');expect(names('sphere(radius=1, op')).not.toContain('radius');expect(names('vector(1, y')).not.toContain('x');expect(names('my_y=2\nsphere(pos=vector(1, my')).toContain('my_y');expect(pythonContext('sphere(pos=vector(1, 2), op').call.name).toBe('sphere');expect(completionChoices('sphere(op').find(x=>x.name==='opacity').insertText).toBe('opacity=');
});
it('점 뒤에는 해당 종류의 속성만 제안하며 모르는 객체의 타입을 지어내지 않는다',()=>{
 expect(names('ball = sphere()\nball.')).toContain('radius');expect(names('ball = sphere()\nball.pos.')).toContain('x');expect(names('color.')).toContain('red');expect(names('scene.')).toContain('range');expect(names('items = []\nitems.')).toContain('append');expect(names('label1=label()\nlabel1.')).not.toContain('axis');expect(names('unknown.')).toEqual([]);
});
it('편집기 지원을 중복 등록하지 않고 폐기 후 재등록할 수 있다',()=>{
 const handles=[],register=vi.fn(()=>{const handle={dispose:vi.fn()};handles.push(handle);return handle;});const monaco={languages:{registerCompletionItemProvider:register,registerHoverProvider:register,registerSignatureHelpProvider:register}};
 const a=registerPythonHelp(monaco);expect(registerPythonHelp(monaco)).toBe(a);expect(register).toHaveBeenCalledTimes(3);a.dispose();handles.forEach(h=>expect(h.dispose).toHaveBeenCalledOnce());registerPythonHelp(monaco);expect(register).toHaveBeenCalledTimes(6);
});
it('단어 중간을 고칠 때 남은 철자와 기존 등호를 중복 삽입하지 않는다',()=>{
 const providers=[],register=p=>{providers.push(p);return{dispose(){}};},monaco={languages:{CompletionItemKind:{Function:1,Variable:2,Keyword:3,Property:4},registerCompletionItemProvider:(_id,p)=>register(p),registerHoverProvider:(_id,p)=>register(p),registerSignatureHelpProvider:(_id,p)=>register(p)}};
 registerPythonHelp(monaco);const line='sphere(radius=0.5)',model={getValueInRange:()=> 'sphere(ra',getWordUntilPosition:()=>({startColumn:8,endColumn:10}),getWordAtPosition:()=>({startColumn:8,endColumn:14}),getLineContent:()=>line};const item=providers[0].provideCompletionItems(model,{lineNumber:1,column:10}).suggestions.find(x=>x.label.label==='radius');expect(item.range.endColumn).toBe(14);expect(item.insertText).toBe('radius');expect(line.slice(0,item.range.startColumn-1)+item.insertText+line.slice(item.range.endColumn-1)).toBe(line);
});

it('위치 인자는 변수로 완성하고 함수 인자를 지역 변수로 오해하지 않는다',()=>{
 expect(completionChoices('y=2\nvector(0, y').find(x=>x.name==='y').insertText).toBe('y');expect(completionChoices('speed=30\nrate(sp').find(x=>x.name==='speed').insertText).toBe('speed');expect(names('sphere(radius=1)\nra')).not.toContain('radius');expect(names('ball=sphere(\n    radius=1\n)\nra')).not.toContain('radius');expect(names('def move(delta, target=vector(1,2,0)):\n    de')).toContain('delta');expect(names('for i in range(3):\n    i')).toContain('i');expect(names('items[0].')).toEqual([]);expect(names('make().')).toEqual([]);
});
it('scene.width는 화면 픽셀 크기로 설명한다',()=>{expect(completionChoices('scene.').find(x=>x.name==='width').detail).toBe('화면 가로 크기');});

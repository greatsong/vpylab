import { describe, expect, it } from 'vitest';
import { hasPython, runPythonJobs } from '../test/python-runner';

const run = (code, events) => runPythonJobs([{ id: 'event', label: 'check', code: 'from vpython import *\n' + code, events }]).get('event:check');
const event = (widget, value) => ({ name: 'widget', widget, ...(value === undefined ? {} : { value }) });

describe.skipIf(!hasPython())('VPython 위젯 등록 후 실제 이벤트 전달', () => {
  it('인자 없는 async 버튼 콜백도 한 번 실행하고 끝까지 기다린다', () => {
    const result = run('def clicked():\n    rate(100)\n    print("clicked")\nbutton(bind=clicked, text="RUN")', [event('obj_1')]);
    expect(result.error).toBeNull();
    expect(result.stdout).toBe('clicked\n');
    expect(result.pendingTasks).toBe(0);
  });

  it('메뉴·슬라이더·체크박스 콜백은 실제 객체와 갱신된 값을 받는다', () => {
    const result = run(`def select(m):
    assert m is choices and m.selected == 'two' and m.index == 2
    print('menu')
def slide(s):
    assert s is speed and s.value == 7
    print('slider')
def check(c):
    assert c is tick and c.checked is True
    print('checkbox')
choices = menu(choices=['choose','one','two'], bind=select)
speed = slider(min=0,max=10,bind=slide)
tick = checkbox(bind=check)
`, [event('obj_1', 'two'), event('obj_2', 7), event('obj_3', true)]);
    expect(result.error).toBeNull();
    expect(result.stdout).toBe('menu\nslider\ncheckbox\n');
  });

  it('함수 내부 TypeError를 인자 오류로 오해해 재호출하거나 출력만 하고 삼키지 않는다', () => {
    const result = run('def broken(e):\n    print("once")\n    raise TypeError("body failed")\nbutton(bind=broken)', [event('obj_1')]);
    expect(result.stdout).toBe('once\n');
    expect(result.error).toBe('TypeError: body failed');
  });

  it('async 이벤트 오류도 실행 오류로 전달하고 태스크를 회수한다', () => {
    const result = run('def broken():\n    rate(100)\n    raise ValueError("async failed")\nbutton(bind=broken)', [event('obj_1')]);
    expect(result.error).toBe('ValueError: async failed');
    expect(result.pendingTasks).toBe(0);
  });

  it('키 이벤트와 keysdown은 공식 이름을 쓰며 원래 DOM 이름은 raw_key로 보존한다', () => {
    const result = runPythonJobs([{ id: 'keys', label: 'names',
      code: 'from vpython import *\nassert keysdown() == ["up", "ctrl", "a", "f2"]\ndef key(e):\n    assert e.key == "left" and e.raw_key == "ArrowLeft"\n    print("key")\nscene.bind("keydown", key)',
      pressedKeys: ['ArrowUp', 'Control', 'a', 'F2'], events: [{ name: 'keydown', key: 'ArrowLeft' }],
    }]).get('keys:names');
    expect(result.error).toBeNull();
    expect(result.stdout).toBe('key\n');
  });

  it('이전 실행의 위젯 인스턴스와 콜백은 다음 실행에 남지 않는다', () => {
    const runs = runPythonJobs([
      { id: 'first', label: 'reset', code: 'from vpython import *\ndef old(e):\n    raise AssertionError("old handler")\nbutton(bind=old)' },
      { id: 'second', label: 'reset', code: 'from vpython import *\nprint("clean")', events: [event('obj_1')] },
    ]);
    expect(runs.get('second:reset').error).toBeNull();
    expect(runs.get('second:reset').stdout).toBe('clean\n');
  });
});

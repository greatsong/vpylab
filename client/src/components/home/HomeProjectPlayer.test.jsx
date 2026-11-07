import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import HomeProjectPlayer from './HomeProjectPlayer';
const engine=vi.hoisted(()=>({callbacks:null,state:{},initWorker:vi.fn(),runCode:vi.fn(),stopExecution:vi.fn(),stopSound:vi.fn()}));
vi.mock('../../hooks/useAudioState',()=>({default:()=>({playing:false})}));
vi.mock('../../hooks/usePyodide',()=>({default:options=>{engine.callbacks=options;return{...engine.state,initWorker:engine.initWorker,runCode:engine.runCode,stopExecution:engine.stopExecution};}}));
vi.mock('../viewport/Viewport3D',()=>({default:()=> <div>뷰포트</div>}));
vi.mock('../../engine/vpython-bridge',()=>({clearScene:vi.fn(),processBatch:vi.fn()}));
vi.mock('../../engine/object-registry',()=>({clearRegistry:vi.fn()}));
vi.mock('../../engine/sound-system',()=>({stopAllSounds:engine.stopSound}));
beforeEach(()=>{vi.clearAllMocks();engine.state={status:'error',isReady:false,isRunning:false,progress:15};});
afterEach(()=>vi.clearAllMocks());
it('실행 환경 실패를 보이고 사용자가 다시 준비할 수 있다',()=>{
 render(<HomeProjectPlayer code="sphere()" ko onClose={()=>{}}/>);act(()=>engine.callbacks.onError('환경 다운로드 실패'));
 expect(screen.getByRole('alert')).toHaveTextContent('환경 다운로드 실패');expect(engine.stopSound).toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'다시 준비'}));expect(engine.initWorker).toHaveBeenCalledTimes(2);
});
it('정상 종료는 예약음을 자르지 않고 정지 시 소리를 정리한다',async()=>{
 engine.state={status:'ready',isReady:true,isRunning:false,progress:100};render(<HomeProjectPlayer code="sphere()" ko onClose={()=>{}}/>);await waitFor(()=>expect(engine.runCode).toHaveBeenCalledOnce());engine.stopSound.mockClear();
 act(()=>engine.callbacks.onDone({stopped:false}));expect(engine.stopSound).not.toHaveBeenCalled();act(()=>engine.callbacks.onDone({stopped:true}));expect(engine.stopSound).toHaveBeenCalledOnce();
});

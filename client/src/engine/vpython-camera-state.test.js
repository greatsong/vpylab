import { describe, expect, it } from 'vitest';
import { hasPython, runPythonJobs } from '../test/python-runner';

const run = code => runPythonJobs([{id:'camera',label:'case',code:`from vpython import *\n${code}`}]).get('camera:case');
describe.skipIf(!hasPython())('VPython 카메라 명령 직후의 값과 적용 확인', () => {
  it('center·camera.pos·camera.axis를 연속 지정해도 중심과 시선·range가 일관적이다', () => {
    const r=run(`scene.range=3
axis=scene.camera.axis
scene.center=vec(4,2,1)
assert mag(scene.camera.pos-(scene.center-axis))<1e-9
assert scene.camera.axis == axis and scene.forward == vec(0,0,-1)
scene.camera.pos=vec(8,3,2)
assert scene.center == scene.camera.pos + axis
scene.camera.axis=vec(0,-2,-4)
assert scene.center == vec(8,1,-2)
assert scene.forward == norm(vec(0,-2,-4))
assert abs(scene.range-mag(vec(0,-2,-4))*tan(scene.fov/2))<1e-9
`);
    expect(r.error).toBeNull();
    const writes=r.commands.filter(c=>c.action==='scene'&&c.camera_revision!==undefined);
    expect(writes.map(c=>c.camera_revision)).toEqual([1,2,3,4]);
  });
  it('center 성분만 바꿔도 카메라 축과 보는 방향을 유지한다', () => {
    const r=run('scene.range=2\na=scene.camera.axis\nscene.center.x=5\nassert mag(scene.camera.pos-(vec(5,0,0)-a))<1e-9\nassert scene.camera.axis==a');
    expect(r.error).toBeNull();
  });
  it('seq가 새로워도 명령 적용 revision이 낮은 스냅샷은 방금 쓴 값을 덮지 않는다', () => {
    const r=run(`import js, json
state={'seq':100,'revision':0,'center':[0,0,0],'pos':[0,0,8],'forward':[0,0,-1],'range':4,'fov':pi/3,'aspect':1}
js._getCameraState=lambda canvas_id='scene':json.dumps(state)
scene.center=vec(5,0,0)
state['seq']=101
assert scene.center == vec(5,0,0)
assert scene.camera.pos == vec(5,0,8)
state.update(revision=1,center=[6,0,0],pos=[6,0,8])
assert scene.center == vec(6,0,0)
assert scene.camera.pos == vec(6,0,8)
`);
    expect(r.error).toBeNull();
  });
  it('세로로 긴 화면에서 range·axis·픽셀 배율이 짧은 가로 변을 기준으로 맞는다', () => {
    const r=run(`scene.width=300
scene.height=600
scene.range=2
assert abs(scene.camera.axis.mag-4/tan(scene.fov/2))<1e-9
scene.camera.axis=vec(0,0,-10)
assert abs(scene.range-5*tan(scene.fov/2))<1e-9
assert abs(scene.pixel_to_world-2*scene.range/300)<1e-9
`);
    expect(r.error).toBeNull();
  });
  it('복수 화면은 각자 revision과 중심을 유지하고 정점 메시의 compound 경계도 맞는다', () => {
    const r=run(`a=canvas(range=2)
b=canvas(range=5)
a.center=vec(3,0,0)
b.center=vec(-4,0,0)
assert a.center==vec(3,0,0) and b.center==vec(-4,0,0)
assert abs(a.camera.pos.z-2/tan(a.fov/2))<1e-9
t=triangle(vs=[vertex(pos=vec(10,0,0)),vertex(pos=vec(12,0,0)),vertex(pos=vec(10,2,0))])
c=compound([t])
assert c.pos==vec(11,1,0)
`);
    expect(r.error).toBeNull();
  });
});


it.skipIf(!hasPython())('camera.rotate는 기본적으로 자기 위치에서 시선을 돌리고 origin 지정 시 그 점 주위를 돈다',()=>{
 const r=run(`scene.range=3
p=scene.camera.pos
scene.camera.rotate(angle=pi/2,axis=vec(0,1,0))
assert mag(scene.camera.pos-p)<1e-9
assert mag(scene.forward-vec(-1,0,0))<1e-9
center=scene.center
scene.camera.rotate(angle=pi/2,axis=vec(0,1,0),origin=center)
assert mag(scene.center-center)<1e-9
assert mag(scene.forward-vec(0,0,1))<1e-9
assert scene.autoscale==False
`);
 expect(r.error).toBeNull();
});

import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { welcomeCode, welcomeFriends, welcomeParts } from './welcome-friends';
import { getTutorial } from './tutorials';
import { createWelcomeModel } from '../components/home/welcome-geometry';
import { clearScene, getMesh, processBatch } from '../engine/vpython-bridge';
import { hasPython, runPythonJobs } from '../test/python-runner';
const scene=new THREE.Scene();afterEach(()=>clearScene(scene));
describe.skipIf(!hasPython())('환영 친구의 화면과 실제 VPython',()=>{
 it.each(welcomeFriends.map(f=>[f.id]))('%s는 같은 기본 도형으로 재현되고 인사 후 종료한다',id=>{
  const code=welcomeCode(id),results=runPythonJobs([{id,label:'rest',code:code.split('# 손을 조금씩')[0]},{id,label:'wave',code}]);
  for(const result of results.values()){expect(result.error,id).toBeNull();expect(result.stopped).toBe(false);expect(result.pendingTasks).toBe(0);}
  const model=createWelcomeModel(id);model.group.updateMatrixWorld(true);const expected=new THREE.Box3().setFromObject(model.group);processBatch(results.get(id+':rest').commands,scene);scene.updateMatrixWorld(true);const actual=new THREE.Box3().setFromObject(scene);
  for(const axis of ['x','y','z']){expect(actual.min[axis],id+' min '+axis).toBeCloseTo(expected.min[axis],2);expect(actual.max[axis],id+' max '+axis).toBeCloseTo(expected.max[axis],2);}
  const baseCreates=results.get(id+':rest').commands.filter(c=>c.action==='create');
  for(const [i,part]of welcomeParts(id).entries()){
    const preview=model.group.getObjectByName(part.name),rendered=getMesh(baseCreates[i].id);
    expect(preview.getWorldPosition(new THREE.Vector3()).distanceTo(rendered.getWorldPosition(new THREE.Vector3())),id+' '+part.name+' pos').toBeLessThan(1e-5);
    expect(Math.abs(preview.getWorldQuaternion(new THREE.Quaternion()).dot(rendered.getWorldQuaternion(new THREE.Quaternion()))),id+' '+part.name+' rotation').toBeCloseTo(1,5);
  }
  const parts=welcomeParts(id),handIndex=parts.findIndex(p=>p.name==='right_hand');const creates=results.get(id+':wave').commands.filter(c=>c.action==='create');const hand=creates[handIndex];expect(hand).toBeTruthy();expect(results.get(id+':wave').commands.some(c=>c.action==='update'&&c.id===hand.id&&c.pos)).toBe(true);model.dispose();
 },20000);
});
it('첫 화면에서 고른 네 친구를 같은 체험 경로로 열고, 없는 선택은 만두로 시작한다',()=>{
 for(const f of welcomeFriends){const tutorial=getTutorial('welcome-friend',f.id);expect(tutorial.activeStep).toBe(f.id);expect(tutorial.code).toBe(welcomeCode(f.id));}
 expect(getTutorial('welcome-friend','missing').activeStep).toBe('dumpling');
});

describe.skipIf(!hasPython())('타원체·고리 속성과 복제 회귀',()=>{
 it('타원체를 size·length·axis로 바꿔도 타원체로 남고 복제·compound가 독립적이다',()=>{
  const code=`from vpython import *
e = ellipsoid(size=vector(2,1,.5))
assert abs(e.axis.mag-2)<1e-9
e.axis = vector(0,3,0)
assert e.length == 3
e.size.x = 4
e.height = .6
e.width = .8
assert abs(e.axis.mag-4)<1e-9
copy = e.clone(pos=vector(5,0,0))
assert copy.size == e.size and copy.axis == e.axis
copy.color = color.red
assert e.color != copy.color
whole = compound([copy])
assert whole.visible
r = ring(axis=vector(0,1,0))
r.axis = vector(0,0,1)
`;
  const result=runPythonJobs([{id:'orientation',label:'properties',code}]).get('orientation:properties');expect(result.error).toBeNull();processBatch(result.commands,scene);
  const e=getMesh('obj_1');expect(e.geometry.type).toBe('SphereGeometry');expect(e.scale.toArray()).toEqual([4,.6,.8]);expect(new THREE.Vector3(1,0,0).applyQuaternion(e.quaternion).distanceTo(new THREE.Vector3(0,1,0))).toBeLessThan(1e-6);
  const ring=getMesh('obj_4');expect(new THREE.Vector3(0,0,1).applyQuaternion(ring.quaternion).distanceTo(new THREE.Vector3(0,0,1))).toBeLessThan(1e-6);
 });
});

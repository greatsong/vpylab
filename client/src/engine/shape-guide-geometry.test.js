import {afterEach,describe,it,expect} from 'vitest';
import * as THREE from 'three';
import {getDocById} from '../data/docs';
import {getGuideVariants} from '../data/shape-guides';
import {hasPython,runPythonJobs} from '../test/python-runner';
import {processBatch,clearScene,getMesh} from './vpython-bridge';
const scene=new THREE.Scene();afterEach(()=>clearScene(scene));
const run=code=>runPythonJobs([{id:'guide',label:'geometry',code}]).get('guide:geometry');
const bounds=object=>{scene.updateMatrixWorld(true);return new THREE.Box3().setFromObject(object)};
const size=object=>bounds(object).getSize(new THREE.Vector3());
describe.skipIf(!hasPython())('가이드의 실제 치수·면·구멍',()=>{
 it('늘이기·방향 바꾸기의 실제 치수와 방향이 안내와 맞는다',()=>{
  const d=getDocById('shape-stretch');processBatch(run(getGuideVariants(d)[0].code).commands,scene);
  expect(size(getMesh('obj_1')).y).toBeCloseTo(1.6,5);clearScene(scene);
  processBatch(run(getGuideVariants(getDocById('shape-direction'))[0].code).commands,scene);
  const s=size(getMesh('obj_1'));expect(s.x).toBeCloseTo(2,5);expect(s.y).toBeCloseTo(.3,5);
 });
 it('삼각형 단면 지붕은 설명한 폭·높이·깊이로 렌더링된다',()=>{
  processBatch(run(getDocById('shape-triangle').code).commands,scene);const s=size(getMesh('obj_1'));
  expect(s.x).toBeCloseTo(2,5);expect(s.y).toBeCloseTo(.9,5);expect(s.z).toBeCloseTo(1.2,5);
 });
 it('닫힌 반구는 256개의 퇴화하지 않은 면, 바깥 법선, 모든 변의 2회 공유를 갖는다',()=>{
  const r=run(getDocById('shape-dome').code);expect(r.error).toBeNull();const faces=r.commands.filter(c=>c.type==='triangle');expect(faces).toHaveLength(256);
  const edges=new Map(),key=p=>p.map(n=>Math.round(n*1e6)).join(',');
  for(const f of faces){const vs=f.vertices.map(v=>new THREE.Vector3(...v.pos));const cross=new THREE.Vector3().crossVectors(vs[1].clone().sub(vs[0]),vs[2].clone().sub(vs[0]));expect(cross.length()).toBeGreaterThan(1e-10);
   const center=vs.reduce((sum,p)=>sum.add(p),new THREE.Vector3()).divideScalar(3),normal=center.y<1e-6?new THREE.Vector3(0,-1,0):center.clone().normalize();expect(cross.dot(normal)).toBeGreaterThan(0);
   for(let i=0;i<3;i++){const k=[key(f.vertices[i].pos),key(f.vertices[(i+1)%3].pos)].sort().join('|');edges.set(k,(edges.get(k)||0)+1);}
  }
  expect([...edges.values()].every(n=>n===2)).toBe(true);processBatch(r.commands,scene);const b=bounds(scene);expect(b.min.y).toBeCloseTo(0);expect(b.max.y).toBeCloseTo(1);expect(b.getSize(new THREE.Vector3()).x).toBeCloseTo(2);
 });
 it('제공 함수의 범위 경계와 잘못된 인자를 검사한다',()=>{
  const d=getDocById('shape-dome');
  for(const [before,after]of [['    segments=16,','    segments=3,'],['    segments=16,','    segments=4.5,'],['    radius=1,','    radius=0,']]){
   const at=d.code.lastIndexOf(before),r=run(d.code.slice(0,at)+after+d.code.slice(at+before.length));expect(r.error).toContain('ValueError');
  }
  for(const n of [4,32]){const r=run(d.code.replace('    segments=16,',`    segments=${n},`));expect(r.error).toBeNull();expect(r.commands.filter(c=>c.type==='triangle')).toHaveLength(n*n);}
 });
 it('컵 중앙 광선은 윗면을 통과해 바닥에 닿고, 가장자리 광선은 윗테두리에 닿는다',()=>{
  processBatch(run(getDocById('shape-cup').code).commands,scene);scene.updateMatrixWorld(true);
  const wall=getMesh('obj_1'),base=getMesh('obj_2'),ray=new THREE.Raycaster(new THREE.Vector3(0,3,0),new THREE.Vector3(0,-1,0));
  expect(ray.intersectObject(wall)).toHaveLength(0);expect(ray.intersectObject(base)[0].point.y).toBeCloseTo(.12,5);
  ray.set(new THREE.Vector3(.94,3,0),new THREE.Vector3(0,-1,0));expect(ray.intersectObject(wall)[0].point.y).toBeCloseTo(1.6,5);
 });
 it('컵 벽 두께를 바꿔도 바깥 크기는 유지하고 내부 구멍만 줄어든다',()=>{
  const d=getDocById('shape-cup');processBatch(run(getGuideVariants(d)[1].code).commands,scene);const wall=getMesh('obj_1');scene.updateMatrixWorld(true);expect(size(wall).x).toBeCloseTo(2,5);
  const ray=new THREE.Raycaster(new THREE.Vector3(.8,3,0),new THREE.Vector3(0,-1,0));expect(ray.intersectObject(wall)[0].point.y).toBeCloseTo(1.6,5);
 });
});

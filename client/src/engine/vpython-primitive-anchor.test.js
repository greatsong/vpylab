import {afterEach,it,expect} from 'vitest';
import * as THREE from 'three';
import {clearScene,getMesh,processBatch} from './vpython-bridge';
const scene=new THREE.Scene();afterEach(()=>clearScene(scene));
function extent(mesh,axis){scene.updateMatrixWorld(true);const attr=mesh.geometry.getAttribute('position'),values=[];for(let i=0;i<attr.count;i++){const p=new THREE.Vector3().fromBufferAttribute(attr,i).applyMatrix4(mesh.matrixWorld);values.push(p.dot(axis));}return [Math.min(...values),Math.max(...values)];}
it.each(['cylinder','cone'])('%s의 pos는 생성·반지름 변경·방향 변경 후에도 밑면 중심이다',type=>{
 processBatch([{action:'create',id:'rod',type,pos:[2,3,4],axis:[0,2,0],radius:.2}],scene);
 const m=getMesh('rod');expect(extent(m,new THREE.Vector3(0,1,0))).toEqual([3,5]);
 processBatch([{action:'update',id:'rod',radius:.4}],scene);let range=extent(m,new THREE.Vector3(0,1,0));expect(range[0]).toBeCloseTo(3);expect(range[1]).toBeCloseTo(5);
 processBatch([{action:'update',id:'rod',axis:[-4,0,0]}],scene);range=extent(m,new THREE.Vector3(1,0,0));expect(range[0]).toBeCloseTo(-2);expect(range[1]).toBeCloseTo(2);expect(m.position.toArray()).toEqual([2,3,4]);
});

it.each(['cylinder','cone'])('%s의 Python length·size 변경과 compound가 밑면 위치를 보존한다',async type=>{
 const {hasPython,runPythonJobs}=await import('../test/python-runner');if(!hasPython())return;
 const code=`from vpython import *\nc=${type}(pos=vec(1,2,3),axis=vec(0,2,0),radius=.1)\nc.length=4\nc.size=vec(6,.8,.8)\ng=compound([c])\ng.color=color.cyan\ng.opacity=.5\n`;
 const result=runPythonJobs([{id:'anchor',label:type,code}]).get('anchor:'+type);expect(result.error).toBeNull();processBatch(result.commands,scene);
 const m=getMesh('obj_1'),range=extent(m,new THREE.Vector3(0,1,0));expect(range[0]).toBeCloseTo(2);expect(range[1]).toBeCloseTo(8);expect(m.material.opacity).toBe(.5);expect(m.material.color.toArray()).toEqual([0,1,1]);
});

it('pyramid는 직사각형 밑면에서 axis로 뻗으며 size와 up 변경을 반영한다',async()=>{
 processBatch([{action:'create',id:'tip',type:'pyramid',pos:[2,3,4],axis:[0,2,0],up:[1,0,0],size:[2,4,6]}],scene);const mesh=getMesh('tip');
 for(const [axis,wanted]of [[[0,1,0],[3,5]],[[1,0,0],[0,4]],[[0,0,1],[1,7]]]){const range=extent(mesh,new THREE.Vector3(...axis));range.forEach((v,i)=>expect(v).toBeCloseTo(wanted[i],6));}
 processBatch([{action:'update',id:'tip',size:[3,2,4],axis:[3,0,0],up:[0,0,1]}],scene);
 for(const [axis,wanted]of [[[1,0,0],[2,5]],[[0,1,0],[1,5]],[[0,0,1],[3,5]]]){const range=extent(mesh,new THREE.Vector3(...axis));range.forEach((v,i)=>expect(v).toBeCloseTo(wanted[i],6));}
 const {hasPython,runPythonJobs}=await import('../test/python-runner');if(!hasPython())return;
 const result=runPythonJobs([{id:'pyramid',label:'linked',code:'from vpython import *\np=pyramid(pos=vec(1,2,3),axis=vec(0,2,0),size=vec(2,4,6),up=vec(1,0,0))\nassert p.axis.mag==p.length==2\np.size=vec(3,2,4)\nassert p.axis.mag==p.length==3\np.axis=vec(4,0,0)\nassert p.size.x==4\np.up=vec(0,0,1)\nq=p.clone(pos=vec(8,0,0))\nassert isinstance(q,pyramid) and q.size==p.size\n'}]).get('pyramid:linked');expect(result.error).toBeNull();
});

it('기울어진 pyramid의 compound 경계는 실제 밑면 네 꼭짓점과 끝점을 포함한다',async()=>{
 const {hasPython,runPythonJobs}=await import('../test/python-runner');if(!hasPython())return;
 const result=runPythonJobs([{id:'pyramid',label:'bounds',code:'from vpython import *\np=pyramid(pos=vec(1,2,3),axis=vec(1,1,0),size=vec(3,2,4),up=vec(0,0,1))\ng=compound([p])\nprint(g.pos.x,g.pos.y,g.pos.z,g.size.x,g.size.y,g.size.z)\n'}]).get('pyramid:bounds');expect(result.error).toBeNull();processBatch(result.commands,scene);scene.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(getMesh('obj_1'),true),compound=result.commands.find(c=>c.action==='compound'),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
 compound.size?.forEach((v,i)=>expect(v).toBeCloseTo(size.getComponent(i),5));compound.center.forEach((v,i)=>expect(v).toBeCloseTo(center.getComponent(i),5));
 const values=result.stdout.trim().split(/\s+/).map(Number);values.slice(0,3).forEach((v,i)=>expect(v).toBeCloseTo(center.getComponent(i),5));values.slice(3).forEach((v,i)=>expect(v).toBeCloseTo(size.getComponent(i),5));
});

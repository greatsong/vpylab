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

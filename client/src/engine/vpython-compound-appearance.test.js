import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { hasPython, runPythonJobs } from '../test/python-runner';
import { clearScene, getMesh, processBatch } from './vpython-bridge';

const scene = new THREE.Scene();
const run = code => runPythonJobs([{ id: 'compound', label: 'case', code: `from vpython import *\n${code}` }]).get('compound:case');
afterEach(() => clearScene(scene));

describe.skipIf(!hasPython())('compound 속성의 Python→실제 재질 연결', () => {
  it('기본 색은 흰색 벡터이며 성분 변경이 원본 팔레트를 바꾸지 않고 전송된다', () => {
    const r = run(`c=compound([sphere(),box(pos=vec(2,0,0))])
assert c.color == color.white
c.color.x = 0.25
assert c.color == vec(0.25,1,1) and color.white == vec(1,1,1)
`);
    expect(r.error).toBeNull();
    processBatch(r.commands, scene);
    getMesh('obj_3').traverse(child => { if (child.material) expect(child.material.color.toArray()).toEqual([0.25,1,1]); });
  });

  it('부품 색에 곱하는 VPython tint는 변경을 누적하지 않고 흰색으로 원래 색을 되돌린다', () => {
    const r = run('c=compound([sphere(color=color.cyan),box(pos=vec(2,0,0),color=color.white)])');
    expect(r.error).toBeNull();
    processBatch(r.commands, scene);
    const c = getMesh('obj_3');
    processBatch([{action:'update',id:'obj_3',color:[1,1,0]}],scene);
    expect(c.children[0].material.color.toArray()).toEqual([0,1,0]);
    expect(c.children[1].material.color.toArray()).toEqual([1,1,0]);
    processBatch([{action:'update',id:'obj_3',color:[1,1,1]}],scene);
    expect(c.children[0].material.color.toArray()).toEqual([0,1,1]);
  });

  it('불투명↔투명 전환은 재질 버전을 올려 shader를 갱신하며 0과 1 경계도 적용한다', () => {
    const r = run('c=compound([sphere(),box(pos=vec(2,0,0))])');
    processBatch(r.commands,scene);
    const m=getMesh('obj_1').material;
    const version=m.version;
    processBatch([{action:'update',id:'obj_3',opacity:0.25}],scene);
    expect(m.version).toBeGreaterThan(version);
    expect(m.opacity).toBe(0.25); expect(m.transparent).toBe(true); expect(m.depthWrite).toBe(false);
    processBatch([{action:'update',id:'obj_3',opacity:0}],scene);
    expect(m.opacity).toBe(0);
    processBatch([{action:'update',id:'obj_3',opacity:1}],scene);
    expect(m.opacity).toBe(1); expect(m.transparent).toBe(false); expect(m.depthWrite).toBe(true);
  });

  it('원래 반투명 부품과 정점 alpha는 compound opacity를 1로 돌려도 보존한다', () => {
    const r=run(`v=vertex(pos=vec(0,0,0),opacity=0.4)
t=triangle(vs=[v,vertex(pos=vec(1,0,0)),vertex(pos=vec(0,1,0))])
c=compound([t,sphere(pos=vec(2,0,0),opacity=0.5)])
c.color=vec(0.25,1,1)
c.opacity=0.5
c.shininess=0.9
c.emissive=True
v.pos.z=0.2
rate(100)
`);
    expect(r.error).toBeNull();processBatch(r.commands,scene);
    const mesh=getMesh('obj_1'), ball=getMesh('obj_2');
    expect(mesh.material.color.toArray()).toEqual([0.25,1,1]);
    expect(mesh.material.opacity).toBe(0.5); expect(ball.material.opacity).toBe(0.25);
    expect(mesh.material.userData.vpVertexOverrides.shininess.value).toBe(0.9);
    expect(mesh.material.userData.vpVertexOverrides.emissive.value).toBe(1);
    processBatch([{action:'update',id:'obj_3',opacity:1}],scene);
    expect(mesh.material.transparent).toBe(true); expect(ball.material.opacity).toBe(0.5);
  });

  it('중첩 compound는 안쪽의 기존 색과 alpha를 바탕으로 전체 속성을 바꾼다', () => {
    const r=run(`a=compound([sphere(color=color.cyan)],color=vec(0.5,1,1),opacity=0.5)
b=compound([a,box(pos=vec(2,0,0))])
b.color=vec(1,1,0)
b.opacity=0.5
`);
    expect(r.error).toBeNull();processBatch(r.commands,scene);
    expect(getMesh('obj_1').material.color.toArray()).toEqual([0,1,0]);
    expect(getMesh('obj_1').material.opacity).toBe(0.25);
  });
});


it('compound 기본 생성이 부품의 발광·광택을 덮지 않고 명시한 속성만 전달한다',()=>{
  const r=run('c=compound([sphere(emissive=True,shininess=0.2)])');
  expect(r.error).toBeNull();
  const cmd=r.commands.find(c=>c.action==='compound');
  expect(cmd).not.toHaveProperty('emissive');expect(cmd).not.toHaveProperty('shininess');
  processBatch(r.commands,scene);
  expect(getMesh('obj_1').material.emissiveIntensity).toBeGreaterThan(0);
  expect(getMesh('obj_1').material.roughness).toBeCloseTo(0.8);
});
it('다른 compound에 묶인 안쪽 compound를 따로 바꾸지 못하게 안내한다',()=>{
  const r=run('a=compound([sphere()])\nb=compound([a])\na.opacity=0.5');
  expect(r.error).toContain('다른 compound의 고정 부품');
});

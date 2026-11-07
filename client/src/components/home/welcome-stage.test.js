import { expect, it } from 'vitest';
import * as THREE from 'three';
import { createWelcomeStage } from './welcome-stage';
import { defaultStageLights, normalizeStageLights } from '../../data/stage-lighting';
it('위치·XYZ 회전·빛 크기·밝기·색을 바꾸면 실제 광원과 빛기둥이 같은 방향으로 바뀐다',()=>{
 const scene=new THREE.Scene(),stage=createWelcomeStage(scene),options=defaultStageLights();options[0]={...options[0],position:[-.8,2,1],rotation:[15,20,-10],size:1.5,brightness:.6,color:'#ff6688'};stage.setGround(-1);stage.setLighting(true,{left:'#ffffff',right:'#ffffff'},options);scene.updateMatrixWorld(true);
 const spots=[];scene.traverse(o=>{if(o.isSpotLight)spots.push(o);});const light=spots[0];expect(light.position.toArray()).toEqual([-.8,2,1]);expect(light.angle).toBeCloseTo(.705);expect(light.intensity).toBeCloseTo(7.8);expect(light.color.getHexString()).toBe('ff6688');
 const direction=light.target.position.clone().sub(light.position).normalize(),expected=new THREE.Vector3(.35,-1,0).sub(light.position).normalize().applyEuler(new THREE.Euler(...[15,20,-10].map(THREE.MathUtils.degToRad)));expect(direction.distanceTo(expected)).toBeLessThan(1e-6);
 let beam;scene.traverse(o=>{if(o.geometry?.type==='ConeGeometry'&&!beam)beam=o;});expect(new THREE.Vector3(0,-1,0).applyQuaternion(beam.quaternion).distanceTo(direction)).toBeLessThan(1e-6);stage.setGround(-.8);scene.updateMatrixWorld(true);expect(new THREE.Vector3(0,-1,0).applyQuaternion(beam.quaternion).distanceTo(light.target.position.clone().sub(light.position).normalize())).toBeLessThan(1e-6);stage.dispose();
});
it('조명 데이터를 정규화해 범위를 벗어난 수치와 CSS 주소를 받지 않는다',()=>{
 const normalized=normalizeStageLights([{position:[Infinity,100,-100],rotation:[NaN,500,-500],size:99,brightness:-1,color:'url(x)'}]);expect(normalized[0]).toMatchObject({position:[-1.58,2.6,-2],rotation:[0,45,-45],size:1.8,brightness:0,color:null});
});

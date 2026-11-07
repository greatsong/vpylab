import * as THREE from 'three';
import { defaultStageLights, normalizeStageLights } from '../../data/stage-lighting';

// 바닥·조명 기구·빛기둥을 같은 3D 장면에 둡니다.
export function createWelcomeStage(scene){
 const group=new THREE.Group(),effects=new THREE.Group(),spots=[],lenses=[],beams=[],fixtures=[];
 const floor=new THREE.Mesh(new THREE.CylinderGeometry(1.78,1.86,.14,64),new THREE.MeshStandardMaterial({color:'#d9e2df',roughness:.87}));floor.receiveShadow=true;group.add(floor,effects);
 for(const side of [-1,1]){
  const source=new THREE.Vector3(side*1.58,1.65,.4),target=new THREE.Vector3(side*-.35,-.9,0),direction=target.clone().sub(source),distance=direction.length();
  const light=new THREE.SpotLight(0xffffff,13,8,.47,.85,1.4);light.position.copy(source);light.target.position.copy(target);light.castShadow=true;light.shadow.mapSize.set(512,512);light.shadow.radius=3;light.shadow.bias=-.0003;light.shadow.normalBias=.025;effects.add(light,light.target);spots.push(light);
  const fixture=new THREE.Group();fixture.position.copy(source);fixture.quaternion.setFromUnitVectors(new THREE.Vector3(0,-1,0),direction.clone().normalize());
  const shell=new THREE.Mesh(new THREE.CylinderGeometry(.085,.12,.2,24),new THREE.MeshStandardMaterial({color:'#39434b',roughness:.5}));fixture.add(shell);
  const lens=new THREE.Mesh(new THREE.CircleGeometry(.105,24),new THREE.MeshBasicMaterial({color:0xffffff}));lens.rotation.x=Math.PI/2;lens.position.y=-.105;fixture.add(lens);effects.add(fixture);fixtures.push(fixture);lenses.push(lens);
  const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,uniforms:{tint:{value:new THREE.Color()},power:{value:1}},vertexShader:'varying vec3 n; varying vec3 v; varying vec2 tex; void main(){vec4 p=modelViewMatrix*vec4(position,1.); n=normalize(normalMatrix*normal); v=normalize(-p.xyz); tex=uv; gl_Position=projectionMatrix*p;}',fragmentShader:'uniform vec3 tint; uniform float power; varying vec3 n; varying vec3 v; varying vec2 tex; void main(){float edge=pow(abs(dot(normalize(n),normalize(v))),2.); float fade=sin(clamp(tex.y,0.,1.)*3.14159); gl_FragColor=vec4(tint,.095*edge*fade*power);}' });
  const beam=new THREE.Mesh(new THREE.ConeGeometry(1,1,48,1,true),material);beam.scale.set(distance*.37,distance,distance*.37);beam.position.copy(source).addScaledVector(direction,.5);beam.quaternion.setFromUnitVectors(new THREE.Vector3(0,-1,0),direction.clone().normalize());effects.add(beam);beams.push(beam);
 }
 scene.add(group);
 let ground=-.9,settings=defaultStageLights(),palette={left:'#ffffff',right:'#ffffff'};
 const layout=()=>spots.forEach((light,i)=>{
  const option=settings[i],source=new THREE.Vector3(...option.position),baseTarget=new THREE.Vector3((i?1:-1)*-.35,ground,0),direction=baseTarget.sub(source),distance=direction.length();
  direction.normalize().applyEuler(new THREE.Euler(...option.rotation.map(THREE.MathUtils.degToRad)));light.position.copy(source);light.target.position.copy(source).addScaledVector(direction,distance);
  const rotation=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,-1,0),direction);fixtures[i].position.copy(source);fixtures[i].quaternion.copy(rotation);beams[i].quaternion.copy(rotation);beams[i].position.copy(source).addScaledVector(direction,distance*.5);
  light.angle=Math.min(.85,.47*option.size);const radius=distance*Math.tan(light.angle)*.72;beams[i].scale.set(radius,distance,radius);light.intensity=13*option.brightness;
  const color=option.color||(i?palette.right:palette.left);light.color.set(color);lenses[i].material.color.set(color).multiplyScalar(Math.min(1,option.brightness));beams[i].material.uniforms.tint.value.set(color);beams[i].material.uniforms.power.value=option.brightness;
 });
 return {setVisible(visible){group.visible=visible;},setGround(y){ground=y;floor.position.y=y-.07;layout();},setLighting(on,colors,options){effects.visible=on;palette=colors;settings=normalizeStageLights(options)||defaultStageLights();layout();},dispose(){group.traverse(o=>{o.geometry?.dispose();o.material?.dispose();if(o.isLight)o.dispose();});scene.remove(group);}};
}

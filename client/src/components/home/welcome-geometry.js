import * as THREE from 'three';
import { createPrimitiveGeometry } from '../../../../server/shared/primitive-geometry.js';
import { welcomeParts, welcomeWavePivot } from '../../data/welcome-friends';
const primitives=createPrimitiveGeometry(THREE);
export function createWelcomeModel(id){
 const group=new THREE.Group(),pivot=new THREE.Group();pivot.position.fromArray(welcomeWavePivot(id));group.add(pivot);
 for(const p of welcomeParts(id)){
  let geometry;
  if(p.type==='ellipsoid'){geometry=new THREE.SphereGeometry(1,32,24);geometry.scale(...p.size.map(x=>x/2));}
  else if(p.type==='curve'){geometry=new THREE.BufferGeometry().setFromPoints(p.pos.map(v=>new THREE.Vector3(...v)));}
  else if(p.type==='box')geometry=new THREE.BoxGeometry(...p.size);
  else if(p.type==='ring')geometry=new THREE.TorusGeometry(p.radius,p.thickness,12,48);
  else if(p.type==='cylinder')geometry=primitives.cylinder(p.radius,new THREE.Vector3(...p.axis).length(),32);
  else geometry=primitives.cone(p.radius,new THREE.Vector3(...p.axis).length(),32);
  const material=p.type==='curve'?new THREE.LineBasicMaterial({color:p.color}):new THREE.MeshStandardMaterial({color:new THREE.Color(p.color),roughness:.72});
  const mesh=p.type==='curve'?new THREE.Line(geometry,material):new THREE.Mesh(geometry,material);mesh.name=p.name;
  if(p.type!=='curve')mesh.position.fromArray(p.pos);
  if(p.axis)mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,p.type==='ring'?0:1,p.type==='ring'?1:0),new THREE.Vector3(...p.axis).normalize());
  if(p.angle)mesh.rotateZ(p.angle);
  if(p.name==='right_hand'){mesh.position.sub(pivot.position);pivot.add(mesh);}else group.add(mesh);
 }
 return{group,pivot,dispose(){group.traverse(o=>{if(o.geometry){o.geometry.dispose();o.material.dispose();}});}};
}

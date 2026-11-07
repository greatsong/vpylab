import * as THREE from 'three';
import { createPrimitiveGeometry } from '../../../../server/shared/primitive-geometry.js';
import { welcomeLayout, welcomeParts } from '../../data/welcome-friends';
const primitives=createPrimitiveGeometry(THREE);
export function createWelcomeModel(id){
 if(id==='friends'){
   const group=new THREE.Group(),members=welcomeLayout().map(item=>{const model=createWelcomeModel(item.id);model.group.scale.setScalar(item.scale);model.group.position.fromArray(item.origin);model.basePosition=model.group.position.clone();group.add(model.group);return model;});
   return{group,members,dispose(){members.forEach(m=>m.dispose());}};
 }
 const group=new THREE.Group();
 for(const p of welcomeParts(id)){
  let geometry;
  if(p.type==='sphere')geometry=new THREE.SphereGeometry(p.radius,32,24);
  else if(p.type==='ellipsoid'){geometry=new THREE.SphereGeometry(1,32,24);geometry.scale(...p.size.map(x=>x/2));}
  else if(p.type==='box')geometry=new THREE.BoxGeometry(...p.size);
  else if(p.type==='ring')geometry=new THREE.TorusGeometry(p.radius,p.thickness,12,48);
  else if(p.type==='cylinder')geometry=primitives.cylinder(p.radius,new THREE.Vector3(...p.axis).length(),32);
  else geometry=primitives.cone(p.radius,new THREE.Vector3(...p.axis).length(),32);
  const material=new THREE.MeshStandardMaterial({color:new THREE.Color(p.color),roughness:.72});
  const mesh=new THREE.Mesh(geometry,material);mesh.name=p.name;if(mesh.isMesh){mesh.castShadow=!/^(eye|cheek|mouth|tongue|smile)/.test(p.name);mesh.receiveShadow=true;}
  mesh.position.fromArray(p.pos);
  if(['box','ellipsoid'].includes(p.type)&&p.axis){
    const x=new THREE.Vector3(...p.axis).normalize(),y=new THREE.Vector3(...(p.up||[0,1,0]));
    y.addScaledVector(x,-y.dot(x)).normalize();const z=new THREE.Vector3().crossVectors(x,y).normalize();
    mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x,y,z));
  }
  else if(p.axis)mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,p.type==='ring'?0:1,p.type==='ring'?1:0),new THREE.Vector3(...p.axis).normalize());
  if(p.angle)mesh.rotateZ(p.angle);
  group.add(mesh);
 }
 return{group,dispose(){group.traverse(o=>{if(o.geometry){o.geometry.dispose();o.material.dispose();}});}};
}

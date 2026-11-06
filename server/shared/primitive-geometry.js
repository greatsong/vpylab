// Three.js의 중심 기준 기하를 VPython의 pos(밑면 중심) 기준으로 맞춥니다.
// 편집기와 독립 HTML에서 같은 생성기를 사용합니다.
export function createPrimitiveGeometry(THREE) {
 return {
  cylinder(radius,length){return new THREE.CylinderGeometry(radius,radius,length,32).translate(0,length/2,0);},
  cone(radius,length){return new THREE.ConeGeometry(radius,length,32).translate(0,length/2,0);},
 };
}

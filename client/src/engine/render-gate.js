// 카메라나 장면이 바뀔 때 그립니다. 외부 비동기 변경을 위해 2Hz 보정도 남깁니다.
export function createRenderGate() {
  let lastRender = -Infinity;
  let previous = [];
  return (now, camera, dirty = false) => {
    const values = [...camera.position.toArray(), ...camera.quaternion.toArray(), ...camera.projectionMatrix.elements];
    const changed = values.some((value, index) => Math.abs(value - (previous[index] ?? Infinity)) > 1e-10);
    if (!dirty && !changed && now - lastRender < 500) return false;
    previous = values;
    lastRender = now;
    return true;
  };
}

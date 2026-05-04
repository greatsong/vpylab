import { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import useAppStore from '../../stores/appStore';
import CameraSystem from '../../engine/camera-system';
import { postEvent, postMouseState, postPressedKeys } from '../../engine/pyodide-singleton';
import { isEventBound } from '../../engine/vpython-bridge';

const THEME_BG = {
  'creative-light': 0xf8fafc,
  'deep-dark': 0x0f172a,
  'ocean-breeze': 0xf0f9ff,
  'sunset-glow': 0xfffbf5,
  'forest-night': 0x071a0f,
  'lavender-dream': 0xfaf5ff,
  'midnight-purple': 0x13081f,
  'rose-garden': 0xfff1f2,
  'cyber-neon': 0x0a0a0f,
};

export default function Viewport3D({ sceneRef, onSceneReady }) {
  const containerRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const cameraSystemRef = useRef(null);
  const animFrameRef = useRef(null);
  const gridRef = useRef(null);
  const axesRef = useRef(null);
  const [showAxes, setShowAxes] = useState(false);
  const [cameraMode, setCameraMode] = useState('auto-fit');
  const [lockFollowZoom, setLockFollowZoom] = useState(false);
  const theme = useAppStore((s) => s.theme);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    // 씬
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(THEME_BG[theme] || 0xf7f8fa);

    // 카메라 — 기본 거리를 8로 줄여 가까이에서 시작
    const camera = new THREE.PerspectiveCamera(45, (width / height) || 1, 0.1, 1000);
    camera.position.set(0, 0, 8);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // 렌더러 — 저사양 대응
    const renderer = new THREE.WebGLRenderer({
      antialias: window.devicePixelRatio <= 1,
      alpha: false,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 1;
    controls.maxDistance = 100;
    controlsRef.current = controls;

    // 하이브리드 카메라 시스템
    const camSystem = new CameraSystem(camera, controls, scene, {
      zoomLocked: lockFollowZoom,
    });
    cameraSystemRef.current = camSystem;
    // bridge.js에서 scene._cameraSystem으로 접근 (scene.range/center/autoscale 처리)
    scene._cameraSystem = camSystem;

    // 더블클릭 → Auto-Fit 리셋
    const onDblClick = () => {
      camSystem.resetToAutoFit();
      setCameraMode(camSystem.getMode());
    };
    renderer.domElement.addEventListener('dblclick', onDblClick);

    // === scene.bind / scene.mouse 이벤트 디스패치 ===
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();      // -1..1 NDC 좌표
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0); // z=0 평면
    const intersection = new THREE.Vector3();

    function computePosFromEvent(e) {
      const rect = renderer.domElement.getBoundingClientRect();
      ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(ndc, camera);
      // 1) 객체 픽 — meshRegistry의 모든 mesh를 순회하지 않고 scene 자식 사용
      const targets = [];
      scene.traverse((o) => {
        if (o.userData?.vpId && o.visible !== false) targets.push(o);
      });
      const hits = raycaster.intersectObjects(targets, true);
      let pick = null;
      let pos = null;
      if (hits.length > 0) {
        pos = [hits[0].point.x, hits[0].point.y, hits[0].point.z];
        // 픽 객체의 vpId 찾기 (parent를 따라 올라감)
        let o = hits[0].object;
        while (o && !o.userData?.vpId) o = o.parent;
        pick = o?.userData?.vpId || null;
      } else {
        // 2) 객체가 없으면 z=0 평면과의 교점
        if (raycaster.ray.intersectPlane(groundPlane, intersection)) {
          pos = [intersection.x, intersection.y, intersection.z];
        }
      }
      return { pos, pick };
    }

    const onPointerDown = (e) => {
      if (!isEventBound('mousedown') && !isEventBound('click')) return;
      const { pos, pick } = computePosFromEvent(e);
      if (isEventBound('mousedown')) postEvent({ name: 'mousedown', pos, pick });
    };
    const onPointerUp = (e) => {
      const downBound = isEventBound('mouseup') || isEventBound('click');
      if (!downBound) return;
      const { pos, pick } = computePosFromEvent(e);
      if (isEventBound('mouseup')) postEvent({ name: 'mouseup', pos, pick });
      if (isEventBound('click')) postEvent({ name: 'click', pos, pick });
    };
    const onPointerMove = (e) => {
      // mouse pos는 항상 갱신 (scene.mouse.pos 폴링용)
      const { pos, pick } = computePosFromEvent(e);
      if (pos) postMouseState(pos, pick);
      if (isEventBound('mousemove')) postEvent({ name: 'mousemove', pos, pick });
    };
    // keysdown() 폴링용 — 현재 눌려있는 키 셋
    const pressedKeys = new Set();
    const flushKeys = () => postPressedKeys([...pressedKeys]);

    const onKeyDown = (e) => {
      if (!pressedKeys.has(e.key)) {
        pressedKeys.add(e.key);
        flushKeys();
      }
      if (isEventBound('keydown')) postEvent({ name: 'keydown', key: e.key });
    };
    const onKeyUp = (e) => {
      if (pressedKeys.delete(e.key)) flushKeys();
      if (isEventBound('keyup')) postEvent({ name: 'keyup', key: e.key });
    };
    const onBlur = () => {
      // 포커스 잃을 때 모든 키 해제 (stuck key 방지)
      if (pressedKeys.size > 0) {
        pressedKeys.clear();
        flushKeys();
      }
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);

    // 조명
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(5, 10, 7);
    scene.add(dirLight);

    // 그리드 (바닥 기준선) — 기본 숨김
    const gridHelper = new THREE.GridHelper(20, 20, 0x444444, 0x222222);
    gridHelper.material.opacity = 0.3;
    gridHelper.material.transparent = true;
    gridHelper.visible = false;
    scene.add(gridHelper);
    gridRef.current = gridHelper;

    // 좌표축 (XYZ) — 기본 숨김
    const axesHelper = new THREE.AxesHelper(3);
    axesHelper.visible = false;
    scene.add(axesHelper);
    axesRef.current = axesHelper;

    // sceneRef로 씬 전달 + 렌더러 참조 (썸네일 캡처용)
    if (sceneRef) {
      sceneRef.current = scene;
      sceneRef.current._renderer = renderer;
    }
    onSceneReady?.(scene);

    // 렌더 루프
    let modeUpdateCounter = 0;
    function animate() {
      animFrameRef.current = requestAnimationFrame(animate);

      // 카메라 자동 시스템 업데이트
      camSystem.update();

      controls.update();
      renderer.render(scene, camera);

      // UI 모드 표시 업데이트 (60프레임마다)
      if (++modeUpdateCounter % 60 === 0) {
        setCameraMode(camSystem.getMode());
      }
    }
    animate();

    // 리사이즈 대응
    const observer = new ResizeObserver(() => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w === 0 || h === 0) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    observer.observe(container);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(animFrameRef.current);
      renderer.domElement.removeEventListener('dblclick', onDblClick);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      camSystem.dispose();
      controls.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []); // 한 번만 초기화

  // 테마 변경 시 배경색만 업데이트
  useEffect(() => {
    if (sceneRef?.current) {
      sceneRef.current.background = new THREE.Color(THEME_BG[theme] || 0xf7f8fa);
    }
  }, [theme, sceneRef]);

  // 축/그리드 토글
  useEffect(() => {
    if (gridRef.current) gridRef.current.visible = showAxes;
    if (axesRef.current) axesRef.current.visible = showAxes;
  }, [showAxes]);

  // 줌 고정 토글
  useEffect(() => {
    cameraSystemRef.current?.setZoomLocked(lockFollowZoom);
  }, [lockFollowZoom]);

  // cameraSystemRef를 외부에 노출 (Sandbox/MissionPlay에서 사용)
  useEffect(() => {
    if (sceneRef && cameraSystemRef.current) {
      // sceneRef에 카메라 시스템 접근을 위한 커스텀 속성 부착
      sceneRef.current._cameraSystem = cameraSystemRef.current;
    }
  });

  return (
    <div
      className="w-full h-full relative"
      style={{ touchAction: 'none' }}
      data-vpylab-viewport=""
    >
      <div ref={containerRef} className="w-full h-full" />

      {/* 카메라 모드 표시 + 옵션 토글 */}
      <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
        {/* 카메라 모드 선택 */}
        <div className="flex gap-0.5">
          <button
            onClick={() => {
              if (cameraSystemRef.current) {
                cameraSystemRef.current.resetToAutoFit();
                setCameraMode('auto-fit');
              }
            }}
            className="text-xs px-2 py-0.5 rounded-l cursor-pointer"
            style={{
              color: cameraMode === 'auto-fit' ? 'var(--color-accent)' : 'var(--color-text-muted)',
              backgroundColor: 'color-mix(in srgb, var(--color-bg-secondary) 80%, transparent)',
              border: cameraMode === 'auto-fit' ? '1px solid var(--color-accent)' : '1px solid transparent',
            }}
            title="전체 물체가 화면에 담기도록 자동 줌"
          >
            자동
          </button>
          <button
            onClick={() => {
              if (cameraSystemRef.current) {
                cameraSystemRef.current.switchToFollow();
                setCameraMode('follow');
              }
            }}
            className="text-xs px-2 py-0.5 rounded-r cursor-pointer"
            style={{
              color: cameraMode === 'follow' ? 'var(--color-accent)' : 'var(--color-text-muted)',
              backgroundColor: 'color-mix(in srgb, var(--color-bg-secondary) 80%, transparent)',
              border: cameraMode === 'follow' ? '1px solid var(--color-accent)' : '1px solid transparent',
            }}
            title="움직이는 물체 중심을 따라감"
          >
            추적
          </button>
        </div>

        <label
          className="flex items-center gap-1.5 text-xs cursor-pointer select-none px-2 py-1 rounded"
          style={{
            color: lockFollowZoom ? 'var(--color-accent)' : 'var(--color-text-muted)',
            backgroundColor: 'color-mix(in srgb, var(--color-bg-secondary) 80%, transparent)',
            border: lockFollowZoom ? '1px solid var(--color-accent)' : 'none',
          }}
          title="카메라 줌 거리를 현재 상태로 고정합니다"
        >
          <input
            type="checkbox"
            checked={lockFollowZoom}
            onChange={(e) => setLockFollowZoom(e.target.checked)}
            className="accent-current"
          />
          줌 고정
        </label>

        {/* 축 토글 */}
        <label
          className="flex items-center gap-1.5 text-xs cursor-pointer select-none px-2 py-1 rounded"
          style={{
            color: 'var(--color-text-muted)',
            backgroundColor: 'color-mix(in srgb, var(--color-bg-secondary) 80%, transparent)',
          }}
        >
          <input
            type="checkbox"
            checked={showAxes}
            onChange={(e) => setShowAxes(e.target.checked)}
            className="accent-current"
          />
          XYZ
        </label>
      </div>
    </div>
  );
}

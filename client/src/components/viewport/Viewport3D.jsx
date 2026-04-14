import { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import useAppStore from '../../stores/appStore';
import CameraSystem from '../../engine/camera-system';

const THEME_BG = {
  'creative-light': 0xf7f8fa,
  'deep-dark': 0x16161a,
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
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
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
    const camSystem = new CameraSystem(camera, controls, scene);
    cameraSystemRef.current = camSystem;

    // 더블클릭 → Auto-Fit 리셋
    const onDblClick = () => {
      camSystem.resetToAutoFit();
      setCameraMode(camSystem.getMode());
    };
    renderer.domElement.addEventListener('dblclick', onDblClick);

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

    // sceneRef로 씬 전달
    if (sceneRef) sceneRef.current = scene;
    onSceneReady?.(scene);

    // 렌더 루프
    let modeUpdateCounter = 0;
    function animate() {
      animFrameRef.current = requestAnimationFrame(animate);

      // 카메라 시스템이 제어 중이면 OrbitControls.update() 스킵 (이중 호출 방지)
      const cameraControlled = camSystem.update();
      if (!cameraControlled) {
        controls.update();
      }
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
  }, [theme]);

  // 축/그리드 토글
  useEffect(() => {
    if (gridRef.current) gridRef.current.visible = showAxes;
    if (axesRef.current) axesRef.current.visible = showAxes;
  }, [showAxes]);

  // 외부에서 코드 실행 시 Auto-Fit 트리거
  const triggerAutoFit = useCallback(() => {
    if (cameraSystemRef.current) {
      cameraSystemRef.current.onCodeStart();
      setCameraMode('auto-fit');
    }
  }, []);

  // cameraSystemRef를 외부에 노출 (Sandbox/MissionPlay에서 사용)
  useEffect(() => {
    if (sceneRef && cameraSystemRef.current) {
      // sceneRef에 카메라 시스템 접근을 위한 커스텀 속성 부착
      sceneRef.current._cameraSystem = cameraSystemRef.current;
    }
  });

  // 카메라 모드 라벨
  const modeLabels = {
    'auto-fit': '자동',
    'follow': '추적',
    'manual': '수동',
  };

  return (
    <div className="w-full h-full relative" style={{ touchAction: 'none' }}>
      <div ref={containerRef} className="w-full h-full" />

      {/* 뷰포트 컨트롤 */}
      <div className="viewport-controls">
        {/* 카메라 모드 */}
        <button
          onClick={() => {
            if (cameraSystemRef.current) {
              cameraSystemRef.current.resetToAutoFit();
              setCameraMode('auto-fit');
            }
          }}
          className={`vp-btn vp-camera-btn ${cameraMode === 'manual' ? 'vp-manual' : 'vp-auto'}`}
          title="더블클릭 또는 이 버튼으로 자동 카메라 복귀"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            {cameraMode === 'manual' ? (
              /* 수동: 마우스 커서 아이콘 */
              <path d="M4 1L4 11L6.5 8.5L9 13L11 12L8.5 7.5L12 7.5L4 1Z" fill="currentColor"/>
            ) : (
              /* 자동: 타겟 아이콘 */
              <>
                <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                <circle cx="8" cy="8" r="1" fill="currentColor"/>
                <path d="M8 2V4M8 12V14M2 8H4M12 8H14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              </>
            )}
          </svg>
          {modeLabels[cameraMode] || '자동'}
        </button>

        {/* XYZ 축 토글 */}
        <button
          onClick={() => setShowAxes(!showAxes)}
          className={`vp-btn vp-xyz-btn ${showAxes ? 'vp-active' : ''}`}
          title="좌표축 표시/숨기기"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M8 2V14" stroke="#00B894" strokeWidth="1.5" strokeLinecap="round" opacity={showAxes ? 1 : 0.4}/>
            <path d="M2 10L8 14L14 10" stroke="#6C5CE7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={showAxes ? 1 : 0.4}/>
            <path d="M2 6L8 2L14 6" stroke="#FF6B6B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={showAxes ? 1 : 0.4}/>
          </svg>
          XYZ
        </button>

        <style>{`
          .viewport-controls {
            position: absolute; top: 10px; right: 10px;
            display: flex; flex-direction: column; gap: 6px;
            align-items: flex-end; z-index: 5;
          }
          .vp-btn {
            display: flex; align-items: center; gap: 5px;
            padding: 5px 10px; border-radius: 8px;
            font-size: 11px; font-weight: 600; cursor: pointer;
            border: 1px solid transparent;
            font-family: var(--font-body, 'DM Sans', sans-serif);
            letter-spacing: 0.02em;
            backdrop-filter: blur(8px);
            transition: all 0.2s;
          }

          /* 카메라 — 자동 */
          .vp-camera-btn.vp-auto {
            background: rgba(108, 92, 231, 0.15);
            border-color: rgba(108, 92, 231, 0.3);
            color: var(--brand-purple, #6C5CE7);
          }
          .vp-camera-btn.vp-auto:hover {
            background: rgba(108, 92, 231, 0.25);
          }

          /* 카메라 — 수동 */
          .vp-camera-btn.vp-manual {
            background: rgba(255, 255, 255, 0.06);
            border-color: rgba(255, 255, 255, 0.08);
            color: var(--color-text-muted, #72757E);
          }
          .vp-camera-btn.vp-manual:hover {
            background: rgba(108, 92, 231, 0.12);
            border-color: rgba(108, 92, 231, 0.25);
            color: var(--brand-purple, #6C5CE7);
          }

          /* XYZ — 비활성 */
          .vp-xyz-btn {
            background: rgba(255, 255, 255, 0.06);
            border-color: rgba(255, 255, 255, 0.08);
            color: var(--color-text-muted, #72757E);
          }
          .vp-xyz-btn:hover {
            background: rgba(0, 184, 148, 0.1);
            border-color: rgba(0, 184, 148, 0.25);
          }
          /* XYZ — 활성 */
          .vp-xyz-btn.vp-active {
            background: rgba(0, 184, 148, 0.12);
            border-color: rgba(0, 184, 148, 0.3);
            color: var(--brand-mint, #00B894);
          }
          .vp-xyz-btn.vp-active:hover {
            background: rgba(0, 184, 148, 0.2);
          }
        `}</style>
      </div>
    </div>
  );
}

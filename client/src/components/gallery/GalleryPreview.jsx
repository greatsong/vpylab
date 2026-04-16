import { useRef, useState, useCallback, useEffect } from 'react';
import Viewport3D from '../viewport/Viewport3D';
import OutputConsole from '../console/OutputConsole';
import usePyodide from '../../hooks/usePyodide';
import { processBatch, clearScene } from '../../engine/vpython-bridge';
import { clearRegistry } from '../../engine/object-registry';
import { stopBgm } from '../../engine/sound-system';
import { useI18n } from '../../i18n';

/**
 * 갤러리 상세 페이지용 3D 미리보기
 * Sandbox의 코드 실행 로직을 재사용하되, 읽기 전용 뷰만 제공
 */
export default function GalleryPreview({ code }) {
  const { t } = useI18n();
  const sceneRef = useRef(null);
  const [outputs, setOutputs] = useState([]);
  const [ran, setRan] = useState(false);

  const addOutput = useCallback((text, type = 'log') => {
    setOutputs((prev) => [...prev, { text, type, id: Date.now() + Math.random() }]);
  }, []);

  const handleBatch = useCallback((commands) => {
    if (sceneRef.current) processBatch(commands, sceneRef.current);
  }, []);

  const { runCode, stopExecution, isReady, isRunning } = usePyodide({
    onOutput: addOutput,
    onError: (err) => {
      addOutput(err, 'error');
      stopBgm();
    },
    onBatch: handleBatch,
    onDone: () => stopBgm(),
  });

  // 컴포넌트 언마운트 시 정리
  useEffect(() => () => stopBgm(), []);

  const handleRun = () => {
    if (!isReady || !code) return;
    if (sceneRef.current) clearScene(sceneRef.current);
    clearRegistry();
    if (sceneRef.current?._cameraSystem) {
      sceneRef.current._cameraSystem.onCodeStart();
    }
    setOutputs([]);
    setRan(true);
    runCode(code);
  };

  const handleStop = () => {
    stopExecution();
    stopBgm();
  };

  return (
    <div className="rounded-xl overflow-hidden"
      style={{ border: '1px solid var(--color-border)', height: '500px', display: 'flex', flexDirection: 'column' }}>

      {/* 컨트롤 바 */}
      <div className="flex items-center gap-2 px-4 py-2"
        style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg-secondary)' }}>
        <button onClick={handleRun} disabled={!isReady || isRunning}
          className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg border-none cursor-pointer text-xs font-medium text-white transition-all"
          style={{ backgroundColor: isRunning ? 'var(--color-text-muted)' : 'var(--color-accent)', opacity: (!isReady || isRunning) ? 0.5 : 1 }}>
          {!isReady ? (t('common.loading')) : isRunning ? (t('editor.stop')) : '▶ ' + t('editor.run')}
        </button>
        {isRunning && (
          <button onClick={handleStop}
            className="px-3 py-1.5 rounded-lg border-none cursor-pointer text-xs font-medium text-white"
            style={{ backgroundColor: 'var(--color-error, #e74c3c)' }}>
            {t('editor.stop')}
          </button>
        )}
        <span className="text-xs ml-auto" style={{ color: 'var(--color-text-muted)' }}>
          {t('gallery.preview')}
        </span>
      </div>

      {/* 3D 뷰포트 + 콘솔 */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* 3D */}
        <div style={{ flex: 7, minWidth: 0 }}>
          <Viewport3D sceneRef={sceneRef} onSceneReady={() => {}} />
        </div>
        {/* 콘솔 */}
        {ran && (
          <div style={{ flex: 3, minWidth: 0, borderLeft: '1px solid var(--color-border)', overflow: 'auto' }}>
            <OutputConsole outputs={outputs} onClear={() => setOutputs([])} />
          </div>
        )}
      </div>
    </div>
  );
}

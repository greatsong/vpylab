import { useState, useRef, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useI18n } from '../i18n';
import Header from '../components/layout/Header';
import CodeEditor, { DEFAULT_CODE } from '../components/editor/CodeEditor';
import Viewport3D from '../components/viewport/Viewport3D';
import OutputConsole from '../components/console/OutputConsole';
import LoadingScreen from '../components/shared/LoadingScreen';
import usePyodide from '../hooks/usePyodide';
import { processBatch, clearScene } from '../engine/vpython-bridge';
import { clearRegistry } from '../engine/object-registry';
import { runSound, successSound, errorSound, stopBgm } from '../engine/sound-system';
import { captureThumbnail } from '../engine/thumbnail';
import { copyCodeLink, decodeCodeFromURL } from '../utils/share';
import { generateStandaloneHTML, downloadHTML } from '../utils/export-html';
import useAuthStore from '../stores/authStore';
import useCodeStore from '../stores/codeStore';
import useGalleryStore from '../stores/galleryStore';
import SavedCodeList from '../components/code/SavedCodeList';
import PublishModal from '../components/gallery/PublishModal';

/**
 * Sandbox 페이지 — 자유 코딩 IDE
 * 3패널: 좌 에디터 | 우상 3D 뷰포트 | 우하 콘솔
 * 태블릿: 탭 전환 (에디터/3D 토글)
 */
export default function Sandbox() {
  const { t } = useI18n();
  const [code, setCode] = useState(DEFAULT_CODE);
  const [outputs, setOutputs] = useState([]);
  const [activeTab, setActiveTab] = useState('editor');
  const [shareMsg, setShareMsg] = useState('');
  const [saveMsg, setSaveMsg] = useState('');
  const [showSavedCodes, setShowSavedCodes] = useState(false);
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [remixFrom, setRemixFrom] = useState(null);
  const [remixInfo, setRemixInfo] = useState(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const { user } = useAuthStore();
  const { saveCode } = useCodeStore();
  const [searchParams] = useSearchParams();

  // URL에서 공유 코드 로드
  useEffect(() => {
    const { code: shared, isExternal } = decodeCodeFromURL();
    if (shared) {
      setCode(shared);
      if (isExternal) {
        setOutputs([{ text: t('share.externalCode'), type: 'warning', id: Date.now() }]);
      }
    }
  }, []);

  // Remix 파라미터 처리 (?remix=galleryId)
  useEffect(() => {
    const remixId = searchParams.get('remix');
    if (remixId) {
      setRemixFrom(remixId);
      // 갤러리에서 원본 코드 로드
      useGalleryStore.getState().fetchWork(remixId).then(() => {
        const work = useGalleryStore.getState().currentWork;
        if (work) {
          setCode(work.code);
          setRemixInfo({ title: work.title, author: work.vpylab_profiles?.display_name });
          addOutput(`🔀 "${work.title}" 작품을 Remix합니다. 자유롭게 수정해보세요!`, 'success');
        }
      });
    }
  }, [searchParams]);

  const addOutput = useCallback((text, type = 'log') => {
    setOutputs((prev) => [...prev, { text, type, id: Date.now() + Math.random() }]);
  }, []);

  const handleBatch = useCallback((commands) => {
    if (sceneRef.current) {
      processBatch(commands, sceneRef.current);
    }
  }, []);

  const {
    status, progress, progressMessage,
    initWorker, runCode, stopExecution,
    isLoading, isReady, isRunning,
  } = usePyodide({
    onOutput: addOutput,
    onError: (err) => {
      addOutput(err, 'error');
      stopBgm();  // 에러 시 BGM 자동 정지
      errorSound();
    },
    onBatch: handleBatch,
    onReady: () => addOutput('Python 엔진 준비 완료!', 'success'),
    onDone: () => {
      stopBgm();  // 코드 정상 완료 시 BGM 자동 정지
      setActiveTab('editor');  // 코드 에디터로 복귀
    },
  });

  // 최초 Worker 초기화
  useEffect(() => {
    initWorker();
  }, [initWorker]);

  const handleRun = () => {
    if (!isReady) return;
    // 씬 + 레지스트리 초기화
    if (sceneRef.current) clearScene(sceneRef.current);
    clearRegistry();
    // 카메라 자동 시스템 리셋
    if (sceneRef.current?._cameraSystem) {
      sceneRef.current._cameraSystem.onCodeStart();
    }
    setOutputs([]);
    setActiveTab('3d');  // 실행 시 3D 뷰로 자동 전환
    runSound();
    addOutput('▶ 실행 중...', 'log');
    runCode(code);
  };

  const handleStop = () => {
    stopExecution();
    stopBgm();  // 실행 정지 시 BGM 자동 정지
    setActiveTab('editor');  // 정지 시 코드 에디터로 복귀
    addOutput('⏹ 실행 중지됨', 'warning');
  };

  const handleReset = () => {
    if (sceneRef.current) clearScene(sceneRef.current);
    setCode(DEFAULT_CODE);
    setOutputs([]);
  };

  const handleShare = async () => {
    const ok = await copyCodeLink(code);
    setShareMsg(ok ? t('share.copied') : 'Failed');
    setTimeout(() => setShareMsg(''), 2000);
  };

  const handleExport = () => {
    const html = generateStandaloneHTML(code, 'My VPy Lab Project');
    // 파일명: 깃헙아이디_파일이름_날짜시간.html
    const githubId = user?.user_metadata?.user_name
      || user?.user_metadata?.preferred_username
      || user?.email?.split('@')[0]
      || 'guest';
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 16).replace(/[-:T]/g, '').slice(0, 12); // 202604141605
    const filename = `${githubId}_vpylab_${dateStr}.html`;
    downloadHTML(html, filename);
  };

  const handleSave = async () => {
    if (!user) {
      useAuthStore.getState().setAuthModalOpen(true);
      return;
    }
    const title = prompt(t('code.saveTitlePlaceholder')) || `코드 ${new Date().toLocaleDateString()}`;
    const { error } = await saveCode({ title, code });
    if (!error) {
      setSaveMsg(t('code.saved'));
      setTimeout(() => setSaveMsg(''), 2000);
    }
  };

  // 로딩 중이면 로딩 화면 표시
  if (isLoading) {
    return (
      <div className="h-screen flex flex-col">
        <Header />
        <LoadingScreen progress={progress} message={progressMessage} />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
      <Header />

      {/* 툴바 */}
      <div
        className="flex items-center gap-2 px-3 py-2 shrink-0"
        style={{
          backgroundColor: 'var(--color-bg-secondary)',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <button onClick={handleRun} disabled={!isReady || isRunning} className="toolbar-btn --run">
          {t('editor.run')}
        </button>
        <button onClick={handleStop} disabled={!isRunning} className="toolbar-btn --stop">
          {t('editor.stop')}
        </button>
        <button onClick={handleReset} className="toolbar-btn">
          {t('editor.reset')}
        </button>

        <div className="hidden md:flex items-center gap-2 ml-2">
          <button onClick={handleShare} className="toolbar-btn">
            {shareMsg || t('editor.share')}
          </button>
          <button onClick={handleExport} className="toolbar-btn">
            {t('editor.export')}
          </button>
          <button onClick={handleSave} className="toolbar-btn">
            {saveMsg || t('code.save')}
          </button>
          <button onClick={() => setShowSavedCodes(true)} className="toolbar-btn">
            {t('code.myCodes')}
          </button>
          <button
            onClick={() => {
              if (!user) { useAuthStore.getState().setAuthModalOpen(true); return; }
              setPublishModalOpen(true);
            }}
            className="toolbar-btn --publish"
          >
            🚀 {t('gallery.publish') || '갤러리에 올리기'}
          </button>
        </div>

        <div className="flex-1" />

        {/* 모바일 탭 */}
        <div className="flex md:hidden gap-1">
          {[['editor', 'Code'], ['3d', '3D'], ['console', 'Log']].map(([tab, label]) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`tab-btn ${activeTab === tab ? '--active' : ''}`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* 상태 */}
        <div className="hidden md:flex items-center gap-1.5 text-xs" style={{ color: 'var(--color-text-muted)' }}>
          <span className={`status-dot ${isRunning ? '--running' : isReady ? '--ready' : '--idle'}`} />
          {isRunning ? t('editor.run') + '...' : isReady ? 'Ready' : '...'}
        </div>
      </div>

      {/* === 3패널 레이아웃 (데스크톱) === */}
      <div className="flex-1 flex min-h-0">
        {/* 좌측: 에디터 (데스크톱: 항상 보임, 모바일: 탭) */}
        <div
          className={`${activeTab === 'editor' ? 'flex' : 'hidden'} md:flex flex-col`}
          style={{ width: '45%', minWidth: '300px', borderRight: '1px solid var(--color-border)' }}
        >
          <CodeEditor code={code} onChange={(val) => setCode(val || '')} />
        </div>

        {/* 리사이저 (데스크톱) */}
        <div className="hidden md:block panel-resizer w-1" />

        {/* 우측: 3D + 콘솔 */}
        <div className="flex-1 flex flex-col min-h-0 min-w-0">
          {/* 3D 뷰포트 */}
          <div
            className={`${activeTab === '3d' || activeTab === 'editor' ? 'flex' : 'hidden'} md:flex`}
            style={{ height: '60%', minHeight: 0, borderBottom: '1px solid var(--color-border)' }}
          >
            <Viewport3D sceneRef={sceneRef} />
          </div>

          {/* 리사이저 (데스크톱) */}
          <div className="hidden md:block panel-resizer panel-resizer-h h-1" />

          {/* 콘솔 */}
          <div
            className={`${activeTab === 'console' || activeTab === 'editor' ? 'flex' : 'hidden'} md:flex flex-col`}
            style={{ flex: 1, minHeight: 0 }}
          >
            <OutputConsole outputs={outputs} onClear={() => setOutputs([])} />
          </div>
        </div>
      </div>

      {/* Remix 배너 */}
      {remixInfo && (
        <div style={{
          position: 'fixed', bottom: 12, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(108,92,231,0.9)', color: 'white', padding: '6px 16px',
          borderRadius: 8, fontSize: 13, zIndex: 50, backdropFilter: 'blur(8px)',
        }}>
          🔀 Remix: {remixInfo.author}의 "{remixInfo.title}"
        </div>
      )}

      {/* 저장된 코드 사이드패널 */}
      {showSavedCodes && (
        <SavedCodeList
          onLoadCode={(loadedCode) => setCode(loadedCode)}
          onClose={() => setShowSavedCodes(false)}
        />
      )}

      {/* 갤러리 발행 모달 */}
      <PublishModal
        isOpen={publishModalOpen}
        onClose={() => setPublishModalOpen(false)}
        code={code}
        thumbnail={sceneRef.current?._renderer ? captureThumbnail(sceneRef.current._renderer.domElement) : null}
        remixFrom={remixFrom}
      />
    </div>
  );
}

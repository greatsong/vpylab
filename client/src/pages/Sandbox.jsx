import { useState, useRef, useCallback, useEffect } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import { useI18n } from '../i18n';
import Header from '../components/layout/Header';
import CodeEditor, { DEFAULT_CODE } from '../components/editor/CodeEditor';
import Viewport3D from '../components/viewport/Viewport3D';
import OutputConsole from '../components/console/OutputConsole';
import LoadingScreen from '../components/shared/LoadingScreen';
import usePyodide from '../hooks/usePyodide';
import { processBatch, clearScene } from '../engine/vpython-bridge';
import { clearRegistry } from '../engine/object-registry';
import { runSound, errorSound, stopBgm, initAudioOnUserGesture, ensureAudioResumed } from '../engine/sound-system';
import { captureThumbnail } from '../engine/thumbnail';
import { copyCodeLink, decodeCodeFromURL } from '../utils/share';
// export-html은 큰 모듈이므로 사용 시점에 lazy import
import useAuthStore from '../stores/authStore';
import useCodeStore from '../stores/codeStore';
import useGalleryStore from '../stores/galleryStore';
import SavedCodeList from '../components/code/SavedCodeList';
import PublishModal from '../components/gallery/PublishModal';
import EXAMPLES, { EXAMPLE_CATEGORIES } from '../data/examples';

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
  const [mobileMore, setMobileMore] = useState(false);
  const [shareMsg, setShareMsg] = useState('');
  const [saveMsg, setSaveMsg] = useState('');
  const [showSavedCodes, setShowSavedCodes] = useState(false);
  const [showExamples, setShowExamples] = useState(false);
  const [exampleCategory, setExampleCategory] = useState('all');
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [publishThumbnail, setPublishThumbnail] = useState(null);
  const [remixFrom, setRemixFrom] = useState(null);
  const [remixInfo, setRemixInfo] = useState(null);
  const [editMode, setEditMode] = useState(null); // { id, githubRepo, title }
  const [theaterMode, setTheaterMode] = useState(false);
  const [theaterWaiting, setTheaterWaiting] = useState(false); // 클릭 대기 중
  const sceneRef = useRef(null);
  const pendingBatchRef = useRef([]);  // 모바일: sceneRef 미 mount 시 버퍼
  const { user } = useAuthStore();
  const { saveCode, autoSave, clearAutoSave, saveStatus } = useCodeStore();
  const [searchParams] = useSearchParams();
  const location = useLocation();

  // /s/:id에서 넘어온 공유 코드 로드
  useEffect(() => {
    if (location.state?.sharedCode) {
      setCode(location.state.sharedCode);
      if (location.state?.autoPlay) {
        // 극장 모드: 클릭 대기 → 클릭 시 오디오 잠금 해제 + 실행
        setTheaterMode(true);
        setTheaterWaiting(true);
      } else {
        setOutputs([{ text: t('share.externalCode'), type: 'warning', id: Date.now() }]);
      }
      // state 정리 (뒤로가기 시 다시 로드 방지)
      window.history.replaceState({}, '');
      return;
    }
    // 기존 LZ-String URL 하위 호환
    const { code: shared, isExternal } = decodeCodeFromURL();
    if (shared) {
      setCode(shared);
      if (isExternal) {
        setOutputs([{ text: t('share.externalCode'), type: 'warning', id: Date.now() }]);
      }
    }
  }, []);

  // 자동 저장: 코드 변경 시 2초 debounce
  useEffect(() => {
    if (user && code && code !== DEFAULT_CODE) {
      autoSave(code, { title: '자유 코딩' });
    }
  }, [code, user]);

  // 컴포넌트 언마운트 시 타이머 정리
  useEffect(() => () => clearAutoSave(), []);
  useEffect(() => { initAudioOnUserGesture(); }, []);

  const addOutput = useCallback((text, type = 'log') => {
    setOutputs((prev) => [...prev, { text, type, id: Date.now() + Math.random() }]);
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
          addOutput(`"${work.title}" 작품을 Remix합니다. 자유롭게 수정해보세요!`, 'success');
        }
      });
    }
  }, [searchParams, addOutput]);

  // Play 파라미터 처리 (?play=galleryId) — 코드 로드 후 자동 실행
  const pendingPlayRef = useRef(null); // 자동 실행할 코드
  useEffect(() => {
    const playId = searchParams.get('play');
    if (!playId) return;

    let cancelled = false;
    (async () => {
      const playCode = await useGalleryStore.getState().fetchWorkCode(playId);
      if (cancelled || !playCode) return;
      setCode(playCode);
      pendingPlayRef.current = playCode;
    })();
    return () => { cancelled = true; };
  }, [searchParams]);

  // Edit 파라미터 처리 (?edit=galleryId) — GitHub에서 코드 가져와 수정 모드
  useEffect(() => {
    const editId = searchParams.get('edit');
    if (editId) {
      useGalleryStore.getState().fetchWork(editId).then(async () => {
        const work = useGalleryStore.getState().currentWork;
        if (work && work.github_repo) {
          const token = await useAuthStore.getState().getGitHubToken();
          if (token) {
            try {
              const { code: fetchedCode } = await useGalleryStore.getState().fetchCodeFromGitHub(work.github_repo, token);
              if (fetchedCode) setCode(fetchedCode);
              else setCode(work.code); // fallback: DB 코드 사용
            } catch {
              setCode(work.code);
            }
          } else {
            setCode(work.code);
          }
          setEditMode({ id: editId, githubRepo: work.github_repo, title: work.title });
          addOutput(`"${work.title}" 수정 모드. 수정 후 "업데이트"를 눌러주세요.`, 'success');
        }
      });
    }
  }, [searchParams, addOutput]);

  const handleBatch = useCallback((commands) => {
    if (sceneRef.current) {
      // 먼저 대기 중인 batch가 있으면 flush
      if (pendingBatchRef.current.length > 0) {
        for (const pending of pendingBatchRef.current) {
          processBatch(pending, sceneRef.current);
        }
        pendingBatchRef.current = [];
      }
      processBatch(commands, sceneRef.current);
    } else {
      // 모바일: 뷰포트 미 mount 시 버퍼에 저장
      pendingBatchRef.current.push(commands);
    }
  }, []);

  const {
    progress, progressMessage,
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
    // 클릭 핸들러 안에서 동기적으로 오디오 잠금 해제 (모바일 필수)
    ensureAudioResumed();
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
    addOutput('실행 중...', 'log');
    runCode(code);
  };

  // pendingPlay: Play 모드 코드 로드 + Pyodide 준비 모두 완료 시 자동 실행
  useEffect(() => {
    if (isReady && pendingPlayRef.current) {
      const playCode = pendingPlayRef.current;
      pendingPlayRef.current = null;
      // 다음 프레임에서 실행 (코드 state 반영 보장)
      requestAnimationFrame(() => {
        if (sceneRef.current) clearScene(sceneRef.current);
        clearRegistry();
        if (sceneRef.current?._cameraSystem) sceneRef.current._cameraSystem.onCodeStart();
        setOutputs([]);
        setActiveTab('3d');
        runSound();
        addOutput('실행 중...', 'log');
        runCode(playCode);
      });
    }
  }, [isReady, code]);

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

  const handleExport = async () => {
    const { generateStandaloneHTML, downloadHTML } = await import('../utils/export-html');
    const html = generateStandaloneHTML(code, 'My VPyLab Project');
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

  const openPublishModal = useCallback(() => {
    if (!user) {
      useAuthStore.getState().setAuthModalOpen(true);
      return;
    }
    const thumb = sceneRef.current?._renderer ? captureThumbnail(sceneRef.current._renderer.domElement) : null;
    setPublishThumbnail(thumb);
    setPublishModalOpen(true);
  }, [user]);

  const handleSaveAs = async () => {
    if (!user) {
      useAuthStore.getState().setAuthModalOpen(true);
      return;
    }
    const title = prompt(t('code.saveTitlePlaceholder'));
    if (title === null) return;  // 취소 시 저장하지 않음
    const finalTitle = title || `코드 ${new Date().toLocaleDateString()}`;
    const { data, error } = await saveCode({ title: finalTitle, code });
    if (!error && data) {
      useCodeStore.getState().setCurrentCodeId(data.id);
      setSaveMsg(t('code.saved'));
      setTimeout(() => setSaveMsg(''), 2000);
    }
  };

  // GitHub 작품 업데이트 (edit 모드)
  const handleUpdate = async () => {
    if (!editMode) return;
    const token = await useAuthStore.getState().getGitHubToken();
    if (!token) {
      addOutput('GitHub 인증이 필요합니다.', 'error');
      return;
    }
    const { generateStandaloneHTML } = await import('../utils/export-html');
    const htmlContent = generateStandaloneHTML(code, editMode.title);
    addOutput('GitHub에 업데이트 중...', 'log');
    const result = await useGalleryStore.getState().updateWork({
      id: editMode.id,
      title: editMode.title,
      code,
      htmlContent,
      githubRepo: editMode.githubRepo,
      githubToken: token,
    });
    if (result.error) {
      addOutput('업데이트 실패: ' + result.error, 'error');
    } else {
      addOutput('업데이트 완료!', 'success');
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

  // 극장 모드: 3D 뷰포트만 전체 화면
  if (theaterMode) {
    const handleTheaterStart = () => {
      // 클릭 핸들러 안에서 동기적으로 오디오 잠금 해제 (모바일 필수)
      ensureAudioResumed();
      setTheaterWaiting(false);
      // 코드 자동 실행
      pendingPlayRef.current = code;
      // pendingPlay useEffect가 isReady일 때 실행 처리
      if (isReady) {
        requestAnimationFrame(() => {
          if (sceneRef.current) clearScene(sceneRef.current);
          clearRegistry();
          if (sceneRef.current?._cameraSystem) sceneRef.current._cameraSystem.onCodeStart();
          setOutputs([]);
          runSound();
          runCode(code);
        });
      }
    };

    return (
      <div className="h-screen w-screen relative" style={{ backgroundColor: '#000' }}>
        <Viewport3D sceneRef={sceneRef} />

        {/* 클릭하여 시작 오버레이 */}
        {theaterWaiting && (
          <div
            onClick={handleTheaterStart}
            style={{
              position: 'fixed', inset: 0, zIndex: 200,
              background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <div style={{ textAlign: 'center', color: 'white' }}>
              <div style={{ fontSize: 64, marginBottom: 16 }}>▶</div>
              <div style={{ fontSize: 18, fontWeight: 600 }}>클릭하여 시작</div>
            </div>
          </div>
        )}

        {/* 좌상단: 코드 보기 버튼 */}
        {!theaterWaiting && (
          <button
            onClick={() => { handleStop(); setTheaterMode(false); }}
            style={{
              position: 'fixed', top: 16, left: 16, zIndex: 100,
              background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
              border: 'none', borderRadius: 10,
              color: 'white', padding: '8px 14px', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', transition: 'opacity 0.2s',
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            }}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
          >
            {'</>'} 코드 보기
          </button>
        )}

        {/* 좌하단: 정지 버튼 (실행 중일 때만) */}
        {isRunning && (
          <button
            onClick={handleStop}
            style={{
              position: 'fixed', bottom: 16, left: 16, zIndex: 100,
              background: 'rgba(239,68,68,0.8)', backdropFilter: 'blur(8px)',
              border: 'none', borderRadius: 10,
              color: 'white', padding: '8px 14px', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', transition: 'background 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,1)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(239,68,68,0.8)'}
          >
            ⏹ 정지
          </button>
        )}
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
          {editMode && (
            <button onClick={handleUpdate} className="toolbar-btn --update" style={{ background: '#f0883e', color: 'white', fontWeight: 600 }}>
              업데이트
            </button>
          )}
          <button onClick={handleShare} className="toolbar-btn">
            {shareMsg || t('editor.share')}
          </button>
          <button onClick={handleExport} className="toolbar-btn">
            {t('editor.export')}
          </button>
          <button onClick={handleSaveAs} className="toolbar-btn">
            {saveMsg || t('code.saveAs') || '다른 이름으로 저장'}
          </button>
          <button onClick={() => setShowExamples(true)} className="toolbar-btn --examples">
            {t('editor.examples') || '예제'}
          </button>
          <button onClick={() => setShowSavedCodes(true)} className="toolbar-btn">
            {t('code.myCodes')}
          </button>
          <button
            onClick={openPublishModal}
            className="toolbar-btn --publish"
          >
            {t('gallery.publish') || '갤러리에 올리기'}
          </button>
        </div>

        {/* 모바일 더보기 메뉴 */}
        <div className="relative md:hidden ml-1">
          <button
            onClick={() => setMobileMore(prev => !prev)}
            className="toolbar-btn"
            style={{ padding: '4px 8px', fontSize: 16 }}
          >
            ⋯
          </button>
          {mobileMore && (
            <div
              className="absolute right-0 top-full mt-1 w-44 rounded-xl py-1 z-50"
              style={{
                backgroundColor: 'var(--color-bg-panel)',
                border: '1px solid var(--color-border)',
                boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
              }}
            >
              {[
                { label: shareMsg || t('editor.share'), action: () => { handleShare(); setMobileMore(false); } },
                { label: t('editor.export'), action: () => { handleExport(); setMobileMore(false); } },
                { label: saveMsg || t('code.saveAs') || '다른 이름으로 저장', action: () => { handleSaveAs(); setMobileMore(false); } },
                { label: t('editor.examples') || '예제', action: () => { setShowExamples(true); setMobileMore(false); } },
                { label: t('code.myCodes'), action: () => { setShowSavedCodes(true); setMobileMore(false); } },
                { label: t('gallery.publish') || '갤러리에 올리기', action: () => {
                  openPublishModal();
                  setMobileMore(false);
                }},
              ].map((item, i) => (
                <button
                  key={i}
                  onClick={item.action}
                  className="w-full text-left px-4 py-2 text-xs cursor-pointer border-none bg-transparent transition-colors"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
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
        <div className="hidden md:flex items-center gap-3 text-xs" style={{ color: 'var(--color-text-muted)' }}>
          {user && saveStatus === 'saving' && <span>저장 중...</span>}
          {user && saveStatus === 'saved' && <span style={{ color: 'var(--color-success)' }}>저장됨 ✓</span>}
          <span className="flex items-center gap-1.5">
            <span className={`status-dot ${isRunning ? '--running' : isReady ? '--ready' : '--idle'}`} />
            {isRunning ? t('editor.run') + '...' : isReady ? 'Ready' : '...'}
          </span>
        </div>
      </div>

      {/* === 3패널 레이아웃 === */}
      <div className="flex-1 flex min-h-0">
        {/* 좌측: 에디터 */}
        <div
          className={`${activeTab === 'editor' ? 'flex' : 'hidden'} md:flex flex-col w-full md:w-[45%] md:min-w-[300px]`}
          style={{ borderRight: '1px solid var(--color-border)' }}
        >
          <CodeEditor code={code} onChange={(val) => setCode(val || '')} />
        </div>

        {/* 리사이저 (데스크톱) */}
        <div className="hidden md:block panel-resizer w-1" />

        {/* 우측: 3D + 콘솔 */}
        <div className={`${activeTab === 'editor' ? 'hidden' : 'flex'} md:flex flex-1 flex-col min-h-0 min-w-0`}>
          {/* 3D 뷰포트 — 모바일: 100%, 데스크톱: 항상 60% */}
          <div
            className={`${activeTab === '3d' ? 'flex' : 'hidden'} md:flex`}
            style={{ height: '60%', minHeight: 0, borderBottom: '1px solid var(--color-border)' }}
          >
            <Viewport3D sceneRef={sceneRef} />
          </div>

          {/* 리사이저 (데스크톱) */}
          <div className="hidden md:block panel-resizer panel-resizer-h h-1" />

          {/* 콘솔 — 데스크톱: 항상 표시 */}
          <div
            className={`${activeTab === 'console' || activeTab === '3d' ? 'flex' : 'hidden'} md:flex flex-col`}
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
          Remix: {remixInfo.author} — "{remixInfo.title}"
        </div>
      )}

      {editMode && (
        <div style={{
          position: 'fixed', bottom: 12, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(240,136,62,0.9)', color: 'white', padding: '6px 16px',
          borderRadius: 8, fontSize: 13, zIndex: 50, backdropFilter: 'blur(8px)',
        }}>
          수정 모드: "{editMode.title}" — 수정 후 "업데이트"를 눌러주세요
        </div>
      )}

      {/* 예제 패널 */}
      {showExamples && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
            zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowExamples(false); }}
        >
          <div
            style={{
              background: 'var(--color-bg-secondary)', borderRadius: 12,
              width: '90%', maxWidth: 720, maxHeight: '80vh', overflow: 'hidden',
              display: 'flex', flexDirection: 'column',
              border: '1px solid var(--color-border)',
            }}
          >
            {/* 헤더 */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: 18, color: 'var(--color-text-primary)' }}>{t('editor.examples') || '예제 갤러리'}</h2>
              <button onClick={() => setShowExamples(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: 4 }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M4.5 3L8 6.5 11.5 3 13 4.5 9.5 8 13 11.5 11.5 13 8 9.5 4.5 13 3 11.5 6.5 8 3 4.5 4.5 3z"/></svg>
              </button>
            </div>

            {/* 카테고리 탭 */}
            <div style={{ padding: '8px 20px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {EXAMPLE_CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setExampleCategory(cat.id)}
                  style={{
                    padding: '4px 12px', borderRadius: 16, border: 'none', cursor: 'pointer',
                    fontSize: 13, fontWeight: exampleCategory === cat.id ? 600 : 400,
                    background: exampleCategory === cat.id ? 'var(--color-accent)' : 'var(--color-bg-tertiary)',
                    color: exampleCategory === cat.id ? 'white' : 'var(--color-text-secondary)',
                  }}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* 예제 리스트 */}
            <div style={{ flex: 1, overflow: 'auto', padding: '8px 20px 20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
              {EXAMPLES
                .filter(ex => exampleCategory === 'all' || ex.category === exampleCategory)
                .map(ex => (
                  <button
                    key={ex.id}
                    onClick={() => { setCode(ex.code); setShowExamples(false); }}
                    style={{
                      background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)',
                      borderRadius: 8, padding: 12, cursor: 'pointer', textAlign: 'left',
                      transition: 'border-color 0.2s, transform 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-accent)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.transform = 'none'; }}
                  >
                    <div style={{ fontSize: 32, marginBottom: 8, lineHeight: 1 }}>
                      {ex.thumbnail || (
                        <svg width="28" height="28" viewBox="0 0 16 16" fill="var(--color-accent)" opacity="0.5">
                          <path d="M8 1a5 5 0 00-2 9.58V12a1 1 0 001 1h2a1 1 0 001-1v-1.42A5 5 0 008 1z"/>
                        </svg>
                      )}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 4 }}>{ex.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)', lineHeight: 1.4 }}>{ex.description}</div>
                    <div style={{ marginTop: 8, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {ex.tags.slice(0, 3).map(tag => (
                        <span key={tag} style={{ fontSize: 10, padding: '1px 6px', borderRadius: 8, background: 'var(--color-bg-tertiary)', color: 'var(--color-text-muted)' }}>{tag}</span>
                      ))}
                    </div>
                  </button>
                ))
              }
            </div>
          </div>
        </div>
      )}

      {/* 저장된 코드 사이드패널 */}
      {showSavedCodes && (
        <SavedCodeList
          onLoadCode={(loadedCode, codeId) => {
            setCode(loadedCode);
            if (codeId) useCodeStore.getState().setCurrentCodeId(codeId);
          }}
          onClose={() => setShowSavedCodes(false)}
        />
      )}

      {/* 갤러리 발행 모달 */}
      <PublishModal
        isOpen={publishModalOpen}
        onClose={() => { setPublishModalOpen(false); setPublishThumbnail(null); }}
        code={code}
        thumbnail={publishThumbnail}
        remixFrom={remixFrom}
      />
    </div>
  );
}

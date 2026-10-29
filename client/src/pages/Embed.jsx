import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useI18n } from '../i18n/useI18n';
import Viewport3D from '../components/viewport/Viewport3D';
import { BrandMark } from '../components/shared/BrandLogo';
import usePyodide from '../hooks/usePyodide';
import useAppStore from '../stores/appStore';
import { processBatch, clearScene } from '../engine/vpython-bridge';
import { clearRegistry } from '../engine/object-registry';
import { ensureAudioReady, isAudioUnlocked, stopAllSounds, stopBgm } from '../engine/sound-system';
import { loadSharedCode } from '../utils/share';
import { supabase } from '../lib/supabase';
import { isGalleryId, workUrl } from '../utils/embed';

/** 갤러리 작품 또는 공유 코드를 읽습니다. 비공개 작품은 RLS가 막아 "없음"으로 처리됩니다. */
async function loadWork(id) {
  if (isGalleryId(id)) {
    const { data, error } = await supabase
      .from('vpylab_gallery')
      .select('title, code')
      .eq('id', id)
      .single();
    if (error || !data?.code) return null;
    return { title: data.title || '', code: data.code, kind: 'gallery' };
  }
  const { code, title, error } = await loadSharedCode(id);
  if (error || !code) return null;
  return { title: title || '', code, kind: 'share' };
}

/**
 * /embed/:id — 다른 사이트의 iframe에 넣는 가벼운 보기 전용 페이지.
 * 헤더·편집기·로그인·저장 없이 3D 화면, 제목, 실행·정지, 소리 켜기, "VPyLab에서 열기"만 둡니다.
 * 열리면 자동 실행하고, 소리는 브라우저 정책상 사용자 동작 뒤에만 켜집니다.
 */
export default function Embed() {
  const { id } = useParams();
  const { t, locale } = useI18n();
  const theme = useAppStore((s) => s.theme);
  const sceneRef = useRef(null);
  const autoRanRef = useRef(false);
  const [work, setWork] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [lastError, setLastError] = useState('');
  const [soundOn, setSoundOn] = useState(() => isAudioUnlocked());

  const handleBatch = useCallback((commands) => {
    if (sceneRef.current) processBatch(commands, sceneRef.current);
  }, []);

  const {
    initWorker, runCode, stopExecution, isReady, isRunning, isLoading, progress, progressMessage,
  } = usePyodide({
    onBatch: handleBatch,
    onError: (message) => { setLastError(String(message || '')); stopBgm(); },
    onDone: () => stopBgm(),
    locale,
  });

  useEffect(() => { void initWorker(); }, [initWorker]);

  useEffect(() => {
    let alive = true;
    autoRanRef.current = false;
    setWork(null);
    setNotFound(false);
    loadWork(id).then((loaded) => {
      if (!alive) return;
      if (loaded) setWork(loaded);
      else setNotFound(true);
    });
    return () => { alive = false; };
  }, [id]);

  const run = useCallback(() => {
    if (!isReady || !work?.code) return;
    if (sceneRef.current) clearScene(sceneRef.current);
    clearRegistry();
    sceneRef.current?._cameraSystem?.onCodeStart?.();
    setLastError('');
    runCode(work.code);
  }, [isReady, work, runCode]);

  // 엔진과 코드가 모두 준비되면 한 번 자동 실행
  useEffect(() => {
    if (isReady && work?.code && !autoRanRef.current) {
      autoRanRef.current = true;
      run();
    }
  }, [isReady, work, run]);

  const stop = () => {
    stopExecution();
    stopBgm();
  };

  const enableSound = async () => {
    const ready = await ensureAudioReady();
    setSoundOn(ready || isAudioUnlocked());
  };

  useEffect(() => () => { stopBgm(); stopAllSounds(); }, []);

  const openUrl = work ? workUrl(id, window.location.origin) : `${window.location.origin}/`;
  const statusText = notFound
    ? t('embed.notFound')
    : !work ? t('embed.loading')
      : isLoading ? `${t('embed.preparing')} ${progress ? `${progress}%` : ''} ${progressMessage || ''}`.trim()
        : lastError;

  return (
    <div
      className="h-screen flex flex-col"
      style={{ backgroundColor: 'var(--color-bg-primary)', color: 'var(--color-text-primary)' }}
      data-vpylab-embed=""
      data-theme-name={theme}
    >
      <div
        className="flex items-center gap-2 px-3 shrink-0"
        style={{ height: 44, borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg-panel)' }}
      >
        <a href={openUrl} target="_blank" rel="noopener noreferrer" className="flex items-center no-underline shrink-0" aria-label="VPyLab">
          <BrandMark size={22} inverse={theme === 'deep-dark'} />
        </a>
        <span className="text-sm font-semibold truncate flex-1 min-w-0" title={work?.title || ''} data-testid="embed-title">
          {work?.title || (notFound ? t('embed.notFound') : 'VPyLab')}
        </span>
        {isRunning ? (
          <button type="button" onClick={stop} className="toolbar-btn --stop" style={{ padding: '4px 10px', fontSize: 12 }}>
            {t('editor.stop')}
          </button>
        ) : (
          <button type="button" onClick={run} disabled={!isReady || !work} className="toolbar-btn --run" style={{ padding: '4px 10px', fontSize: 12 }}>
            {t('editor.run')}
          </button>
        )}
        {!soundOn && (
          <button type="button" onClick={enableSound} className="toolbar-btn" style={{ padding: '4px 10px', fontSize: 12 }} title={t('embed.enableSound')}>
            🔈 {t('embed.enableSound')}
          </button>
        )}
        <a
          href={openUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="toolbar-btn no-underline"
          style={{ padding: '4px 10px', fontSize: 12 }}
          data-testid="embed-open-link"
        >
          {t('embed.openInVPyLab')} ↗
        </a>
      </div>

      <div className="flex-1 min-h-0 relative">
        <Viewport3D sceneRef={sceneRef} onSceneReady={() => {}} controls={{ onRun: run, onStop: stop, isRunning, isReady: isReady && !!work }} />
        {statusText && (
          <div
            className="absolute left-2 bottom-2 text-xs px-2 py-1 rounded max-w-[90%] whitespace-pre-wrap"
            style={{ color: lastError ? 'var(--color-error)' : 'var(--color-text-secondary)', backgroundColor: 'color-mix(in srgb, var(--color-bg-secondary) 85%, transparent)' }}
            data-testid="embed-status"
          >
            {statusText}
          </div>
        )}
      </div>
    </div>
  );
}

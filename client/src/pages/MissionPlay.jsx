import { useState, useRef, useCallback, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n';
import Header from '../components/layout/Header';
import CodeEditor from '../components/editor/CodeEditor';
import Viewport3D from '../components/viewport/Viewport3D';
import OutputConsole from '../components/console/OutputConsole';
import LoadingScreen from '../components/shared/LoadingScreen';
import usePyodide from '../hooks/usePyodide';
import { processBatch, clearScene } from '../engine/vpython-bridge';
import { gradeA, gradeB } from '../engine/grading-engine';
import { clearRegistry } from '../engine/object-registry';
import { runSound, successSound, errorSound, stopBgm, initAudioOnUserGesture } from '../engine/sound-system';
import { getMissionById } from '../data/missions';
import missions from '../data/missions';
import useAppStore from '../stores/appStore';
import useCodeStore from '../stores/codeStore';
import useAuthStore from '../stores/authStore';

/**
 * 미션 플레이 페이지
 * Sandbox와 유사하지만 미션 설명 + 채점 기능이 추가됨
 */
export default function MissionPlay() {
  const { missionId } = useParams();
  const { t, locale: lang } = useI18n();
  const navigate = useNavigate();

  const mission = getMissionById(missionId);
  const completeMission = useAppStore((s) => s.completeMission);
  const { user } = useAuthStore();
  const { autoSave, clearAutoSave, saveStatus, loadMissionCode } = useCodeStore();
  const [code, setCode] = useState(mission?.starterCode || '');
  const [outputs, setOutputs] = useState([]);
  const [gradeResult, setGradeResult] = useState(null);
  const [hintIndex, setHintIndex] = useState(-1);
  const [aiHint, setAiHint] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('editor');
  const sceneRef = useRef(null);

  // 미션이 없으면 목록으로 이동
  useEffect(() => {
    if (!mission) navigate('/missions');
  }, [mission, navigate]);

  useEffect(() => { initAudioOnUserGesture(); }, []);

  // 이전 저장된 코드 로드 (로그인 시)
  useEffect(() => {
    if (user && missionId) {
      loadMissionCode(missionId).then((savedCode) => {
        if (savedCode) setCode(savedCode);
      });
    }
    return () => clearAutoSave();
  }, [missionId, user]);

  // 자동 저장: 코드 변경 시 2초 debounce
  useEffect(() => {
    if (user && code && mission) {
      autoSave(code, { title: `미션: ${mission.title[lang]}`, missionId });
    }
  }, [code, user]);

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
      stopBgm();
      setActiveTab('editor');
    },
  });

  useEffect(() => {
    initWorker();
  }, [initWorker]);

  const handleRun = () => {
    if (!isReady) return;
    if (sceneRef.current) clearScene(sceneRef.current);
    // 카메라 자동 시스템 리셋
    if (sceneRef.current?._cameraSystem) {
      sceneRef.current._cameraSystem.onCodeStart();
    }
    clearRegistry();
    setOutputs([]);
    setGradeResult(null);
    setActiveTab('3d');  // 실행 시 3D 뷰로 자동 전환
    runSound();
    addOutput('▶ 실행 중...', 'log');
    runCode(code);
  };

  const handleStop = () => {
    stopExecution();
    stopBgm();
    setActiveTab('editor');  // 정지 시 코드 에디터로 복귀
    addOutput('⏹ 실행 중지됨', 'warning');
  };

  // 채점
  const handleGrade = () => {
    if (!mission) return;

    let result;

    if (mission.gradeType === 'A') {
      result = gradeA(mission.assertions);
    } else if (mission.gradeType === 'B') {
      result = gradeB('obj_1', mission.referenceTrajectory, 0.9);
    } else {
      // A+B 복합
      const aResult = gradeA(mission.assertions);
      if (mission.referenceTrajectory) {
        const bResult = gradeB('obj_1', mission.referenceTrajectory, 0.8);
        result = {
          grade: 'A+B',
          passed: aResult.passed && bResult.passed,
          score: Math.round((aResult.score + bResult.score) / 2),
          aResult,
          bResult,
          results: [...aResult.results],
        };
      } else {
        result = aResult;
      }
    }

    setGradeResult(result);

    if (result.passed) {
      completeMission(missionId, result.score);
      // Supabase에 제출 기록 저장 (로그인 상태일 때만)
      useCodeStore.getState().submitMission({
        missionId,
        code,
        score: result.score,
        passed: true,
        gradingDetails: result,
      });
      successSound();
      addOutput(`🎉 ${t('mission.congratulations')} (${result.score}점)`, 'success');
    } else {
      addOutput(`📝 ${t('mission.notYet')} (${result.score}점)`, 'warning');
    }
  };

  // AI 힌트
  const handleAiHint = async () => {
    if (aiLoading) return;
    setAiLoading(true);
    setAiHint('');
    try {
      const res = await fetch('/api/hint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          missionId: mission.id,
          hintLevel: hintIndex + 2,
          language: lang,
        }),
      });
      const data = await res.json();
      if (data.hint) {
        setAiHint(data.hint);
      } else {
        setAiHint(data.error || t('ai.cooldown'));
      }
    } catch {
      setAiHint(t('ai.cooldown'));
    } finally {
      setAiLoading(false);
    }
  };

  // 다음 미션
  const currentIdx = missions.findIndex(m => m.id === missionId);
  const nextMission = currentIdx >= 0 && currentIdx < missions.length - 1
    ? missions[currentIdx + 1] : null;

  if (!mission) return null;

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

      {/* 툴바 — Sandbox와 동일한 레이아웃 */}
      <div
        className="flex items-center gap-2 px-3 py-2 shrink-0"
        style={{
          backgroundColor: 'var(--color-bg-secondary)',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        {/* 실행 버튼들 (좌측, Sandbox와 동일 위치) */}
        <button onClick={handleRun} disabled={!isReady || isRunning} className="toolbar-btn --run">
          {t('editor.run')}
        </button>
        <button onClick={handleStop} disabled={!isRunning} className="toolbar-btn --stop">
          {t('editor.stop')}
        </button>
        <button onClick={handleGrade} disabled={isRunning} className="toolbar-btn --grade">
          {t('mission.submit')}
        </button>

        {/* 미션 정보 */}
        <div className="hidden md:flex items-center gap-2 ml-2">
          <Link
            to={`/missions?category=${mission.category}`}
            className="text-xs no-underline"
            style={{ color: 'var(--color-accent)' }}
          >
            ← {t('home.backToMissions')}
          </Link>
          <span className="text-xs font-mono font-bold" style={{ color: 'var(--color-text-muted)' }}>
            {mission.id}
          </span>
          <span className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>
            {mission.title[lang]}
          </span>
        </div>
        {/* 모바일: 미션 제목 */}
        <span className="md:hidden text-xs font-bold truncate max-w-[100px]" style={{ color: 'var(--color-text-primary)' }}>
          {mission.title[lang]}
        </span>

        <div className="flex-1" />

        {/* 모바일 탭 */}
        <div className="flex md:hidden gap-1">
          {[['editor', 'Code'], ['3d', '3D'], ['info', 'Info']].map(([tab, label]) => (
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

      {/* === 메인 레이아웃 === */}
      <div className="flex-1 flex min-h-0">
        {/* 좌측: 에디터 */}
        <div
          className={`${activeTab === 'editor' ? 'flex' : 'hidden'} md:flex flex-col w-full md:w-[45%] md:min-w-[300px]`}
          style={{ borderRight: '1px solid var(--color-border)' }}
        >
          <CodeEditor code={code} onChange={(val) => setCode(val || '')} />
        </div>

        {/* 중앙: 3D + 콘솔 */}
        <div className={`${activeTab === 'editor' ? 'hidden' : activeTab === 'info' ? 'hidden md:flex' : 'flex'} md:flex flex-1 flex-col min-h-0 min-w-0`}>
          <div
            className={`${activeTab === '3d' ? 'flex' : 'hidden'} md:flex`}
            style={{ height: activeTab === '3d' ? '100%' : '60%', minHeight: 0, borderBottom: '1px solid var(--color-border)' }}
          >
            <Viewport3D sceneRef={sceneRef} />
          </div>
          <div
            className="hidden md:flex flex-col"
            style={{ flex: 1, minHeight: 0 }}
          >
            <OutputConsole outputs={outputs} onClear={() => setOutputs([])} />
          </div>
        </div>

        {/* 우측: 미션 정보 + 채점 결과 */}
        <div
          className={`${activeTab === 'info' ? 'flex' : 'hidden'} md:flex flex-col overflow-y-auto w-full md:w-[260px] md:min-w-[240px]`}
          style={{
            borderLeft: '1px solid var(--color-border)',
            backgroundColor: 'var(--color-bg-secondary)',
          }}
        >
          <div className="p-4 space-y-5">
            {/* 미션 설명 */}
            <div className="rounded-xl p-3.5" style={{ backgroundColor: 'var(--color-bg-panel)', border: '1px solid var(--color-border)' }}>
              <div className="flex items-center gap-2 mb-2.5">
                <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ backgroundColor: '#6C5CE715' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M14 2H6C5.45 2 5 2.45 5 3V21C5 21.55 5.45 22 6 22H18C18.55 22 19 21.55 19 21V7L14 2Z" stroke="#6C5CE7" strokeWidth="2" fill="none"/>
                    <path d="M14 2V7H19" stroke="#6C5CE7" strokeWidth="2" strokeLinecap="round"/>
                    <path d="M9 13H15M9 17H13" stroke="#6C5CE7" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </div>
                <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-accent)', letterSpacing: '0.08em' }}>
                  {t('mission.description')}
                </h3>
              </div>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                {mission.description[lang]}
              </p>
            </div>

            {/* 힌트 */}
            <div className="rounded-xl p-3.5" style={{ backgroundColor: 'var(--color-bg-panel)', border: '1px solid var(--color-border)' }}>
              <div className="flex items-center gap-2 mb-2.5">
                <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ backgroundColor: '#FDCB6E15' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M9 21H15M12 3C8.69 3 6 5.69 6 9C6 11.22 7.21 13.15 9 14.19V17C9 17.55 9.45 18 10 18H14C14.55 18 15 17.55 15 17V14.19C16.79 13.15 18 11.22 18 9C18 5.69 15.31 3 12 3Z" stroke="#FDCB6E" strokeWidth="2" fill="none" strokeLinecap="round"/>
                  </svg>
                </div>
                <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: '#E0A800', letterSpacing: '0.08em' }}>
                  {t('mission.hints')}
                </h3>
              </div>
              {mission.hints.map((hint, i) => (
                <div key={i} className="mb-2">
                  {i <= hintIndex ? (
                    <div className="text-sm p-2.5 rounded-lg flex items-start gap-2" style={{
                      backgroundColor: '#FDCB6E10',
                      border: '1px solid #FDCB6E30',
                      color: 'var(--color-text-secondary)',
                    }}>
                      <span style={{ fontSize: 16, lineHeight: 1 }}>💡</span>
                      <span>{hint[lang]}</span>
                    </div>
                  ) : (
                    <button
                      onClick={() => setHintIndex(i)}
                      className="text-xs px-3 py-2.5 rounded-lg cursor-pointer w-full text-left flex items-center gap-2 transition-all"
                      style={{
                        backgroundColor: 'var(--color-bg-tertiary)',
                        color: 'var(--color-text-muted)',
                        border: '1px solid var(--color-border)',
                      }}
                    >
                      <span style={{ fontSize: 14 }}>🔒</span>
                      <span>{t('mission.showHint')} {i + 1}</span>
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* AI 힌트 */}
            <div className="rounded-xl p-3.5" style={{ backgroundColor: 'var(--color-bg-panel)', border: '1px solid var(--color-border)' }}>
              <button
                onClick={handleAiHint}
                disabled={aiLoading}
                className="w-full py-2.5 px-4 rounded-lg text-sm font-semibold cursor-pointer transition-all flex items-center justify-center gap-2"
                style={{
                  background: 'linear-gradient(135deg, #6C5CE720, #00B89420)',
                  border: '1px solid #6C5CE730',
                  color: 'var(--color-accent)',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2L14.4 9.6H22L15.8 14.4L18.2 22L12 17.2L5.8 22L8.2 14.4L2 9.6H9.6L12 2Z" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinejoin="round"/>
                </svg>
                {aiLoading ? t('ai.thinking') : t('ai.askHint')}
              </button>
              {aiHint && (
                <div className="mt-2.5 text-xs p-3 rounded-lg leading-relaxed" style={{
                  backgroundColor: '#6C5CE710',
                  border: '1px solid #6C5CE720',
                  color: 'var(--color-text-secondary)',
                }}>
                  {aiHint}
                </div>
              )}
              <p className="text-[11px] mt-2 text-center" style={{ color: 'var(--color-text-muted)', opacity: 0.5 }}>
                {t('ai.disclaimer')}
              </p>
            </div>

            {/* 채점 결과 */}
            {gradeResult && (
              <div
                className="p-4 rounded-xl"
                style={{
                  backgroundColor: gradeResult.passed ? '#3fb95010' : '#f7816610',
                  border: `1px solid ${gradeResult.passed ? '#3fb95040' : '#f7816640'}`,
                }}
              >
                <h3
                  className="text-sm font-bold mb-2 flex items-center gap-1.5"
                  style={{ color: gradeResult.passed ? '#3fb950' : '#f78166' }}
                >
                  {gradeResult.passed ? '✅ ' + t('grading.passed') : '❌ ' + t('grading.failed')}
                </h3>
                <p className="text-2xl font-bold mb-2" style={{ color: 'var(--color-text-primary)' }}>
                  {gradeResult.score}<span className="text-sm font-normal ml-1" style={{ color: 'var(--color-text-muted)' }}>점</span>
                </p>

                {/* 세부 결과 */}
                {gradeResult.results?.map((r, i) => (
                  <div key={i} className="text-xs mb-1.5 pl-2" style={{ color: 'var(--color-text-secondary)', borderLeft: `2px solid ${r.passed ? '#3fb95050' : '#f7816650'}` }}>
                    {r.message}
                  </div>
                ))}

                {/* 다음 미션 버튼 */}
                {gradeResult.passed && nextMission && (
                  <Link
                    to={`/mission/${nextMission.id}`}
                    className="block mt-3 text-center text-sm font-bold py-2.5 rounded-lg no-underline transition-all"
                    style={{
                      background: 'linear-gradient(135deg, var(--color-accent), #8B7CF7)',
                      color: '#fff',
                    }}
                    onClick={() => {
                      setCode(nextMission.starterCode);
                      setGradeResult(null);
                      setHintIndex(-1);
                      setOutputs([]);
                    }}
                  >
                    {t('mission.next')} → {nextMission.title[lang]}
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

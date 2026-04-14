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
import { runSound, successSound, errorSound, stopBgm } from '../engine/sound-system';
import { getMissionById } from '../data/missions';
import missions from '../data/missions';
import useAppStore from '../stores/appStore';
import useCodeStore from '../stores/codeStore';

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

      {/* 미션 정보 바 */}
      <div
        className="flex items-center gap-3 px-3 py-2 shrink-0"
        style={{
          backgroundColor: 'var(--color-bg-secondary)',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <Link
          to={`/missions?category=${mission.category}`}
          className="text-xs no-underline"
          style={{ color: 'var(--color-accent)' }}
        >
          {t('home.backToMissions')}
        </Link>
        <span className="text-xs font-mono font-bold" style={{ color: 'var(--color-text-primary)' }}>
          {mission.id}
        </span>
        <span className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>
          {mission.title[lang]}
        </span>
        <div className="flex-1" />

        {/* 실행 버튼들 */}
        <button onClick={handleRun} disabled={!isReady || isRunning} className="toolbar-btn --run">
          {t('editor.run')}
        </button>
        <button onClick={handleStop} disabled={!isRunning} className="toolbar-btn --stop">
          {t('editor.stop')}
        </button>
        <button onClick={handleGrade} disabled={isRunning} className="toolbar-btn --grade">
          {t('mission.submit')}
        </button>

        {/* 상태 */}
        <div className="hidden md:flex items-center gap-1.5 text-xs" style={{ color: 'var(--color-text-muted)' }}>
          <span className={`status-dot ${isRunning ? '--running' : isReady ? '--ready' : '--idle'}`} />
        </div>

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
      </div>

      {/* === 메인 레이아웃 === */}
      <div className="flex-1 flex min-h-0">
        {/* 좌측: 에디터 */}
        <div
          className={`${activeTab === 'editor' ? 'flex' : 'hidden'} md:flex flex-col`}
          style={{ width: '40%', minWidth: '280px', borderRight: '1px solid var(--color-border)' }}
        >
          <CodeEditor code={code} onChange={(val) => setCode(val || '')} />
        </div>

        {/* 중앙: 3D + 콘솔 */}
        <div className="flex-1 flex flex-col min-h-0 min-w-0">
          <div
            className={`${activeTab === '3d' || activeTab === 'editor' ? 'flex' : 'hidden'} md:flex`}
            style={{ height: '55%', minHeight: 0, borderBottom: '1px solid var(--color-border)' }}
          >
            <Viewport3D sceneRef={sceneRef} />
          </div>
          <div
            className={`${activeTab === 'info' || activeTab === 'editor' ? 'flex' : 'hidden'} md:flex flex-col`}
            style={{ flex: 1, minHeight: 0 }}
          >
            <OutputConsole outputs={outputs} onClear={() => setOutputs([])} />
          </div>
        </div>

        {/* 우측: 미션 정보 + 채점 결과 (데스크톱) */}
        <div
          className={`${activeTab === 'info' ? 'flex' : 'hidden'} md:flex flex-col overflow-y-auto`}
          style={{
            width: '260px',
            minWidth: '240px',
            borderLeft: '1px solid var(--color-border)',
            backgroundColor: 'var(--color-bg-secondary)',
          }}
        >
          <div className="p-4 space-y-4">
            {/* 미션 설명 */}
            <div>
              <h3 className="text-xs font-bold mb-2 uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
                {t('mission.description')}
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                {mission.description[lang]}
              </p>
            </div>

            {/* 힌트 */}
            <div>
              <h3 className="text-xs font-bold mb-2 uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
                {t('mission.hints')}
              </h3>
              {mission.hints.map((hint, i) => (
                <div key={i} className="mb-2">
                  {i <= hintIndex ? (
                    <p className="text-sm p-2 rounded" style={{
                      backgroundColor: 'var(--color-bg-tertiary)',
                      color: 'var(--color-text-secondary)',
                    }}>
                      💡 {hint[lang]}
                    </p>
                  ) : (
                    <button
                      onClick={() => setHintIndex(i)}
                      className="text-xs px-3 py-1.5 rounded border-none cursor-pointer w-full text-left"
                      style={{
                        backgroundColor: 'var(--color-bg-tertiary)',
                        color: 'var(--color-text-muted)',
                      }}
                    >
                      🔒 {t('mission.showHint')} {i + 1}
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* AI 힌트 */}
            <div>
              <button
                onClick={handleAiHint}
                disabled={aiLoading}
                className="toolbar-btn w-full justify-center"
              >
                {aiLoading ? t('ai.thinking') : t('ai.askHint')}
              </button>
              {aiHint && (
                <div className="mt-2 text-xs p-2.5 rounded leading-relaxed" style={{
                  backgroundColor: 'var(--color-bg-tertiary)',
                  color: 'var(--color-text-secondary)',
                }}>
                  {aiHint}
                </div>
              )}
              <p className="text-xs mt-1.5 opacity-40" style={{ color: 'var(--color-text-muted)' }}>
                {t('ai.disclaimer')}
              </p>
            </div>

            {/* 채점 결과 */}
            {gradeResult && (
              <div
                className="p-3 rounded-lg"
                style={{
                  backgroundColor: gradeResult.passed ? '#3fb95015' : '#f7816615',
                  border: `1px solid ${gradeResult.passed ? '#3fb950' : '#f78166'}`,
                }}
              >
                <h3
                  className="text-sm font-bold mb-2"
                  style={{ color: gradeResult.passed ? '#3fb950' : '#f78166' }}
                >
                  {gradeResult.passed ? '✅ ' + t('grading.passed') : '❌ ' + t('grading.failed')}
                </h3>
                <p className="text-2xl font-bold mb-2" style={{ color: 'var(--color-text-primary)' }}>
                  {gradeResult.score}<span className="text-sm font-normal" style={{ color: 'var(--color-text-muted)' }}>점</span>
                </p>

                {/* 세부 결과 */}
                {gradeResult.results?.map((r, i) => (
                  <div key={i} className="text-xs mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                    {r.message}
                  </div>
                ))}

                {/* 다음 미션 버튼 */}
                {gradeResult.passed && nextMission && (
                  <Link
                    to={`/mission/${nextMission.id}`}
                    className="block mt-3 text-center text-sm font-bold py-2 rounded-lg no-underline"
                    style={{
                      backgroundColor: 'var(--color-accent-bg)',
                      color: 'var(--color-accent)',
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

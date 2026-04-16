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
import { gradeA, gradeB, gradeNotes } from '../engine/grading-engine';
import { clearRegistry } from '../engine/object-registry';
import { runSound, successSound, errorSound, stopBgm, initAudioOnUserGesture, ensureAudioReady, resumeAndRun } from '../engine/sound-system';
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
  const [activeTab, setActiveTab] = useState('editor');
  const sceneRef = useRef(null);
  const pendingBatchRef = useRef([]);  // 모바일: sceneRef 미 mount 시 버퍼
  const pendingGradeRef = useRef(false);  // 채점 버튼 → 실행 완료 후 자동 채점

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
      if (pendingBatchRef.current.length > 0) {
        for (const pending of pendingBatchRef.current) {
          processBatch(pending, sceneRef.current);
        }
        pendingBatchRef.current = [];
      }
      processBatch(commands, sceneRef.current);
    } else {
      pendingBatchRef.current.push(commands);
    }
  }, []);

  // Viewport3D 마운트 시 대기 중인 배치 즉시 flush (정적 씬 대응)
  const handleSceneReady = useCallback((scene) => {
    if (pendingBatchRef.current.length > 0) {
      for (const pending of pendingBatchRef.current) {
        processBatch(pending, scene);
      }
      pendingBatchRef.current = [];
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
      stopBgm();
      setActiveTab('editor');
    },
  });

  useEffect(() => {
    initWorker();
  }, [initWorker]);

  const handleRun = () => {
    if (!isReady) return;
    // 클릭 제스처에서 AudioContext resume 후 코드 실행 (최대 500ms 대기)
    resumeAndRun(() => {
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
    });
  };

  const handleStop = () => {
    stopExecution();
    stopBgm();
    setActiveTab('editor');  // 정지 시 코드 에디터로 복귀
    addOutput('⏹ 실행 중지됨', 'warning');
    // 채점 대기 중이면 정지 후 자동 채점 (무한 루프 미션 대응)
    if (pendingGradeRef.current) {
      pendingGradeRef.current = false;
      setTimeout(() => handleGradeInternal(), 100);
    }
  };

  // 채점 (내부 로직)
  const handleGradeInternal = () => {
    if (!mission) return;

    let result;

    if (mission.gradeType === 'notes') {
      // 음악 미션: 재생된 노트 시퀀스와 정답 비교
      result = gradeNotes(mission.expectedNotes);
    } else if (mission.gradeType === 'code') {
      // 코드 검사형 미션: 특정 패턴이 코드에 있는지 확인
      const checks = mission.codeChecks || [];
      if (checks.length === 0) {
        // 검사 조건이 없으면 0점 (빈 배열 방어)
        result = {
          grade: 'code',
          passed: false,
          score: 0,
          results: [],
          message: '채점 기준이 설정되지 않았습니다.',
        };
      } else {
        const results = [];
        for (const check of checks) {
          const matches = code.match(new RegExp(check.pattern, 'g'));
          const count = matches ? matches.length : 0;
          const passed = count >= (check.minCount || 1);
          results.push({
            passed,
            message: passed
              ? `✅ ${check.message} (${count}개 사용)`
              : `❌ ${check.message} (현재 ${count}개)`,
          });
        }
        const passedAll = results.every(r => r.passed);
        result = {
          grade: 'code',
          passed: passedAll,
          score: passedAll ? 100 : Math.round((results.filter(r => r.passed).length / results.length) * 100),
          results,
          message: passedAll ? '✅ 코드 검사 통과!' : '코드를 더 작성해 보세요.',
        };
      }
    } else if (mission.gradeType === 'run') {
      // 탐험형 미션: 코드 실행 자체가 목표 (실행했으면 통과)
      result = { grade: 'run', passed: true, score: 100, message: '✅ 실행 완료!' };
    } else if (mission.gradeType === 'A') {
      result = gradeA(mission.assertions);
    } else if (mission.gradeType === 'B') {
      result = gradeB(mission.targetObjectId || 'obj_1', mission.referenceTrajectory, 0.9);
    } else {
      // A+B 복합
      const aResult = gradeA(mission.assertions);
      if (mission.referenceTrajectory) {
        const bResult = gradeB(mission.targetObjectId || 'obj_1', mission.referenceTrajectory, 0.8);
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

    // codeChecks 병행 검사: A, A+B 등에서도 codeChecks가 있으면 추가 검증
    if (mission.gradeType !== 'code' && mission.codeChecks && mission.codeChecks.length > 0 && result.passed) {
      const codeResults = [];
      for (const check of mission.codeChecks) {
        const matches = code.match(new RegExp(check.pattern, 'g'));
        const count = matches ? matches.length : 0;
        const passed = count >= (check.minCount || 1);
        codeResults.push({
          passed,
          message: passed
            ? `✅ ${check.message} (${count}개 사용)`
            : `❌ ${check.message} (현재 ${count}개)`,
        });
      }
      const codePassedAll = codeResults.every(r => r.passed);
      if (!codePassedAll) {
        const codeScore = Math.round((codeResults.filter(r => r.passed).length / codeResults.length) * 100);
        result = {
          ...result,
          passed: false,
          score: Math.round((result.score + codeScore) / 2),
          results: [...(result.results || []), ...codeResults],
          message: '코드를 더 완성해 보세요.',
        };
      }
    }

    setGradeResult(result);

    if (result.passed) {
      completeMission(missionId, result.score);
      useCodeStore.getState().submitMission({
        missionId,
        code,
        score: result.score,
        passed: true,
        gradingDetails: result,
      });
      successSound();
      if (result.score >= 100) {
        addOutput(`🎉 ${t('mission.congratulations')} (${result.score}점)`, 'success');
      } else {
        addOutput(`✅ 통과! (${result.score}점) — 더 완벽하게 도전해 보세요!`, 'success');
      }
    } else {
      if (result.score > 0) {
        addOutput(`📝 ${result.score}점 — ${result.message || t('mission.notYet')}`, 'warning');
      } else {
        addOutput(`📝 ${result.message || t('mission.notYet')}`, 'warning');
      }
    }
  };

  // 채점 (외부 진입점)
  const handleGrade = () => {
    if (!mission) return;

    // 실행 중이면 정지 후 채점 (무한 루프 미션 대응)
    if (isRunning) {
      pendingGradeRef.current = true;
      handleStop();
      return;
    }

    handleGradeInternal();
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
            className={`${activeTab === '3d' ? 'flex' : 'hidden'} md:flex w-full`}
            style={{ height: '60%', minHeight: 0, borderBottom: '1px solid var(--color-border)' }}
          >
            <Viewport3D sceneRef={sceneRef} onSceneReady={handleSceneReady} />
          </div>
          <div
            className={`${activeTab === '3d' ? 'flex' : 'hidden'} md:flex flex-col w-full`}
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
          <div className="p-4 space-y-4">
            {/* 미션 설명 */}
            <section>
              <h3 className="text-xs font-bold mb-2 flex items-center gap-1.5" style={{ color: 'var(--color-text-primary)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="2" strokeLinecap="round">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/><path d="M9 13h6M9 17h4"/>
                </svg>
                {t('mission.description')}
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                {mission.description[lang]}
              </p>
            </section>

            <div style={{ borderTop: '1px solid var(--color-border)' }} />

            {/* 힌트 */}
            <section>
              <h3 className="text-xs font-bold mb-2.5 flex items-center gap-1.5" style={{ color: 'var(--color-text-primary)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#E0A800" strokeWidth="2" strokeLinecap="round">
                  <path d="M9 21h6M12 3a6 6 0 00-4 10.5V17h8v-3.5A6 6 0 0012 3z"/>
                </svg>
                {t('mission.hints')}
              </h3>
              <div className="space-y-2">
                {mission.hints.map((hint, i) => (
                  <div key={i}>
                    {i <= hintIndex ? (
                      <div className="text-sm py-2.5 px-3 rounded-lg leading-relaxed" style={{
                        backgroundColor: 'var(--color-bg-panel)',
                        border: '1px solid var(--color-border)',
                        color: 'var(--color-text-secondary)',
                      }}>
                        {hint[lang]}
                      </div>
                    ) : (
                      <button
                        onClick={() => setHintIndex(i)}
                        className="text-[13px] px-3 py-2.5 rounded-lg cursor-pointer w-full text-left flex items-center gap-2 transition-colors font-medium"
                        style={{
                          backgroundColor: 'transparent',
                          color: 'var(--color-text-muted)',
                          border: '1px dashed var(--color-border)',
                        }}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
                        </svg>
                        {t('mission.showHint')} {i + 1}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </section>


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
                {/* 음악/실행 미션 메시지 */}
                {!gradeResult.results && gradeResult.message && (
                  <div className="text-xs pl-2" style={{ color: 'var(--color-text-secondary)' }}>
                    {gradeResult.message}
                  </div>
                )}

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

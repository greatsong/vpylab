import { useState, useRef, useCallback, useEffect } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import { useI18n } from '../i18n/useI18n';
import Header from '../components/layout/Header';
import CodeEditor, { DEFAULT_CODE } from '../components/editor/CodeEditor';
import Viewport3D from '../components/viewport/Viewport3D';
import OutputConsole from '../components/console/OutputConsole';
import LoadingScreen from '../components/shared/LoadingScreen';
import usePyodide from '../hooks/usePyodide';
import { processBatch, clearScene } from '../engine/vpython-bridge';
import { clearRegistry } from '../engine/object-registry';
import { runSound, errorSound, stopBgm, stopAllSounds, initAudioOnUserGesture, isAudioUnlocked, isTouchPlaybackEnvironment, resumeAndRun } from '../engine/sound-system';
import { captureThumbnail } from '../engine/thumbnail';
import { copyCodeLink, decodeCodeFromURL } from '../utils/share';
import {
  shouldForceDetailed,
  markDetailedSaved,
  readLastCodeLines,
  writeLastCodeLines,
  countCodeLines,
  nowLocalParts,
} from '../utils/voyage-state';
// export-html은 큰 모듈이므로 사용 시점에 lazy import
import useAuthStore from '../stores/authStore';
import useCodeStore from '../stores/codeStore';
import useGalleryStore from '../stores/galleryStore';
import TeamProjectsPanel from '../components/team/TeamProjectsPanel';
import ProjectGate from '../components/team/ProjectGate';
import SavedCodeList from '../components/code/SavedCodeList';
import RevisionTimeline from '../components/code/RevisionTimeline';
import useProjectStore from '../stores/projectStore';
import PublishModal from '../components/gallery/PublishModal';
import SendCodeModal from '../components/codeshare/SendCodeModal';
import CodeSharePanel from '../components/codeshare/CodeSharePanel';
import CodeShareToast from '../components/codeshare/CodeShareToast';
import useCodeShareStore from '../stores/codeShareStore';
import EXAMPLES, { EXAMPLE_CATEGORIES } from '../data/examples';
import { getLesson } from '../data/courses';

function getProjectRole(project, members, userId) {
  if (!project || !userId) return null;
  if (project.owner_id === userId) return 'owner';
  return members.find((member) => member.user_id === userId)?.role || project.my_role || null;
}

function waitForSaveTimeout(ms, message) {
  return new Promise((resolve) => {
    window.setTimeout(() => resolve({
      timedOut: true,
      error: { message },
    }), ms);
  });
}

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
  const [showTeam, setShowTeam] = useState(false);
  const [showSavedCodes, setShowSavedCodes] = useState(false);
  const [historyTarget, setHistoryTarget] = useState(null);
  const [teamInitialAction, setTeamInitialAction] = useState('browse');
  const [showProjectGate, setShowProjectGate] = useState(false);
  const [commitModalOpen, setCommitModalOpen] = useState(false);
  const [commitMustDetailed, setCommitMustDetailed] = useState(false);
  const [commitSaving, setCommitSaving] = useState(false);
  const [commitError, setCommitError] = useState('');
  const [commitElapsed, setCommitElapsed] = useState(0);
  const [commitStartedAt, setCommitStartedAt] = useState(null);
  const [pushToast, setPushToast] = useState(null);  // { nthCommit, message, commitUrl, repoUrl, pagesUrl } | null
  const activeProject = useProjectStore((s) => s.activeProject);
  const activeCodeId = useProjectStore((s) => s.activeCodeId);
  const activeMembers = useProjectStore((s) => s.activeMembers);
  const lastRemoteUpdate = useProjectStore((s) => s.lastRemoteUpdate);
  const githubSetupStatusById = useProjectStore((s) => s.githubSetupStatusById);
  const projectSaveStatus = useProjectStore((s) => s.projectSaveStatus);
  const pullLatest = useProjectStore((s) => s.pullLatest);
  const clearRemoteUpdate = useProjectStore((s) => s.clearRemoteUpdate);
  const [showExamples, setShowExamples] = useState(false);
  const [exampleCategory, setExampleCategory] = useState('all');
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [publishThumbnail, setPublishThumbnail] = useState(null);
  const [remixFrom, setRemixFrom] = useState(null);
  const [remixInfo, setRemixInfo] = useState(null);
  const [editMode, setEditMode] = useState(null); // { id, githubRepo, title }
  const [theaterMode, setTheaterMode] = useState(false);
  const [theaterWaiting, setTheaterWaiting] = useState(false); // 클릭 대기 중
  const [playStartRequired, setPlayStartRequired] = useState(false);
  const [repoLoadStatus, setRepoLoadStatus] = useState(null); // 'loading' | 'error' | null
  const sceneRef = useRef(null);
  const pendingBatchRef = useRef([]);  // 모바일: sceneRef 미 mount 시 버퍼
  const githubSetupNoticeRef = useRef(null);
  const { user, profile, isTeacher } = useAuthStore();
  const activeProjectRole = getProjectRole(activeProject, activeMembers, user?.id);
  const activeProjectCanEdit = !activeProject || activeProjectRole !== 'viewer';
  const activeGithubSetupStatus = activeProject?.id ? githubSetupStatusById[activeProject.id] : null;
  const { saveCode, autoSave, clearAutoSave, saveStatus, setCurrentCodeId } = useCodeStore();
  const {
    sharedCodes, unreadCount, panelOpen, sendModalOpen, lastReceivedAt,
    initialize: initCodeShare, unsubscribe: unsubCodeShare,
    setPanelOpen, setSendModalOpen, clearCodes, selectedClassId,
  } = useCodeShareStore();
  const [codeShareToast, setCodeShareToast] = useState(false);
  const [searchParams] = useSearchParams();
  const location = useLocation();
  // 초기화 시 되돌릴 "원본 코드" — 예제/lesson/remix 로드 시 갱신, 미설정 시 DEFAULT_CODE
  const initialCodeRef = useRef(DEFAULT_CODE);
  const codeRef = useRef(DEFAULT_CODE);
  const pendingPlayRef = useRef(null); // 자동 실행할 코드
  const loadedRepoParamRef = useRef(null);
  const repoParam = searchParams.get('repo');
  const repoAutorun = searchParams.get('autorun') === '1';

  const updateCode = useCallback((nextCode) => {
    setCode((prev) => {
      const value = typeof nextCode === 'function' ? nextCode(prev) : nextCode;
      const normalized = value || '';
      codeRef.current = normalized;
      return normalized;
    });
  }, []);

  useEffect(() => {
    codeRef.current = code;
  }, [code]);

  // GitHub 재인증 후 복원된 코드
  useEffect(() => {
    const returnAction = location.state?.returnAction;
    const returnProjectId = location.state?.returnProjectId;
    const restoreProjectContext = async () => {
      if (!returnProjectId) return;
      try {
        const store = useProjectStore.getState();
        const result = await store.openProject(returnProjectId);
        if (result?.code?.id) {
          useCodeStore.getState().setCurrentCodeId(result.code.id);
        }
      } catch (e) {
        setOutputs((prev) => [
          ...prev,
          { text: e.message || '프로젝트 컨텍스트를 복원하지 못했습니다.', type: 'warning', id: Date.now() },
        ]);
      }
    };
    const continueAfterAuth = () => {
      setTimeout(async () => {
        if (returnAction === 'publish') {
          await restoreProjectContext();
          setPublishModalOpen(true);
        } else if (returnAction === 'projects') {
          await restoreProjectContext();
          setTeamInitialAction('browse');
          setShowTeam(true);
        } else {
          setShowProjectGate(true);
        }
      }, 200);
    };

    if (location.state?.restoredCode != null) {
      updateCode(location.state.restoredCode);
      initialCodeRef.current = location.state.restoredCode;
      window.history.replaceState({}, '');
      continueAfterAuth();
    } else if (returnAction === 'publish') {
      window.history.replaceState({}, '');
      continueAfterAuth();
    }
  }, [
    location.state?.restoredCode,
    location.state?.returnAction,
    location.state?.returnProjectId,
    updateCode,
  ]);

  // /s/:id에서 넘어온 공유 코드 로드
  useEffect(() => {
    if (location.state?.sharedCode) {
      updateCode(location.state.sharedCode);
      initialCodeRef.current = location.state.sharedCode;
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
    // GitHub 프로젝트 README/Pages에서 넘어온 링크: ?repo=owner/repo
    if (repoParam && /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repoParam)) {
      const repoLoadKey = `${repoParam}:${repoAutorun ? 'autorun' : 'manual'}`;
      if (loadedRepoParamRef.current === repoLoadKey) return;
      loadedRepoParamRef.current = repoLoadKey;
      const [owner, repo] = repoParam.split('/');
      (async () => {
        setRepoLoadStatus('loading');
        pendingPlayRef.current = null;
        setOutputs([{ text: `${repoParam} 프로젝트 코드를 불러오는 중입니다.`, type: 'log', id: Date.now() }]);
        try {
          const response = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/main/main.py`);
          if (!response.ok) throw new Error(`GitHub main.py 로드 실패 (${response.status})`);
          const repoCode = await response.text();
          updateCode(repoCode);
          initialCodeRef.current = repoCode;
          setRepoLoadStatus(null);
          if (repoAutorun) {
            pendingPlayRef.current = repoCode;
          }
          setOutputs([{ text: `${repoParam} 프로젝트 코드를 불러왔습니다.`, type: 'success', id: Date.now() }]);
        } catch (e) {
          pendingPlayRef.current = null;
          setRepoLoadStatus('error');
          setOutputs([{ text: e.message || 'GitHub 프로젝트 코드를 불러오지 못했습니다.', type: 'error', id: Date.now() }]);
        }
      })();
      return;
    }
    // 기존 LZ-String URL 하위 호환
    const { code: shared, isExternal } = decodeCodeFromURL();
    if (shared) {
      updateCode(shared);
      initialCodeRef.current = shared;
      if (repoAutorun) {
        pendingPlayRef.current = shared;
      }
      if (isExternal) {
        setOutputs([{ text: t('share.externalCode'), type: 'warning', id: Date.now() }]);
      }
    }
  }, [location.state?.sharedCode, location.state?.autoPlay, repoAutorun, repoParam, t, updateCode]);

  // 자동 저장: 코드 변경 시 2초 debounce
  // 활성 프로젝트가 있으면 GitHub commit 흐름(수동 저장)을 사용하므로 자동 저장은 건너뜁니다.
  // (프로젝트 모드에서 vpylab_saved_code 직접 갱신 시 팀 멤버의 user_id 필터로 인해
  //  실제 갱신 없이 'saved' 표시되는 문제 방지)
  useEffect(() => {
    if (!user || !code || code === DEFAULT_CODE) return;
    if (activeProject) return;
    if (repoLoadStatus) return;
    autoSave(code, { title: '자유 코딩' });
  }, [code, user, activeProject, repoLoadStatus, autoSave]);

  // 컴포넌트 언마운트 시 타이머 정리
  useEffect(() => () => clearAutoSave(), [clearAutoSave]);

  // 코드 공유 초기화 + 정리
  useEffect(() => {
    if (user && profile) initCodeShare(user, profile);
    return () => unsubCodeShare();
  }, [user, profile, initCodeShare, unsubCodeShare]);

  // 코드 수신 토스트
  useEffect(() => {
    if (lastReceivedAt && !panelOpen) {
      setCodeShareToast(true);
    }
  }, [lastReceivedAt, panelOpen]);
  useEffect(() => { initAudioOnUserGesture(); }, []);

  useEffect(() => {
    if (!commitSaving || !commitStartedAt) return undefined;
    const tick = () => setCommitElapsed(Math.floor((Date.now() - commitStartedAt) / 1000));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [commitSaving, commitStartedAt]);

  // 외부 코드(공유/리믹스/플레이/예제/차시) 로드 시 활성 프로젝트 컨텍스트 해제
  // → 그 코드를 저장하면 별도 프로젝트로 가는 게 자연스러움
  useEffect(() => {
    const fromExternal =
      !!location.state?.sharedCode
      || !!searchParams.get('remix')
      || !!searchParams.get('play')
      || !!searchParams.get('example')
      || !!searchParams.get('lesson')
      || !!repoParam
      || window.location.hash.startsWith('#code=')
      || window.location.hash.startsWith('#b64=');
    if (fromExternal) {
      useProjectStore.getState().closeProject();
      useCodeStore.getState().setCurrentCodeId(null);
    }
  }, [location.state, repoParam, searchParams]);

  // Ctrl/Cmd+S → 저장
  useEffect(() => {
    const onKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, user]);

  const addOutput = useCallback((text, type = 'log') => {
    setOutputs((prev) => [...prev, { text, type, id: Date.now() + Math.random() }]);
  }, []);

  useEffect(() => {
    if (!activeProject?.id || !activeGithubSetupStatus?.state) return;
    const state = activeGithubSetupStatus.state;
    const message = activeGithubSetupStatus.message || activeGithubSetupStatus.error || '';
    const noticeKey = `${activeProject.id}:${state}:${message}`;
    if (githubSetupNoticeRef.current === noticeKey) return;
    githubSetupNoticeRef.current = noticeKey;

    if (state === 'pending') {
      addOutput('GitHub 저장소를 준비하는 중입니다. 프로젝트 작업은 먼저 시작할 수 있습니다.', 'log');
    } else if (state === 'success') {
      addOutput('GitHub 저장소와 Pages 실행 페이지가 연결되었습니다.', 'success');
    } else if (state === 'error') {
      addOutput(message || 'GitHub 저장소 연결에 실패했습니다. 프로젝트 패널에서 재연결할 수 있습니다.', 'warning');
    }
  }, [
    activeProject?.id,
    activeGithubSetupStatus?.state,
    activeGithubSetupStatus?.message,
    activeGithubSetupStatus?.error,
    addOutput,
  ]);


  // Remix 파라미터 처리 (?remix=galleryId)
  useEffect(() => {
    const remixId = searchParams.get('remix');
    if (remixId) {
      setRemixFrom(remixId);
      // 갤러리에서 원본 코드 로드
      useGalleryStore.getState().fetchWork(remixId).then(() => {
        const work = useGalleryStore.getState().currentWork;
        if (work) {
          updateCode(work.code);
          initialCodeRef.current = work.code;
          setRemixInfo({ title: work.title, author: work.vpylab_profiles?.display_name });
          addOutput(`"${work.title}" 작품을 Remix합니다. 자유롭게 수정해보세요!`, 'success');
        }
      });
    }
  }, [searchParams, addOutput, updateCode]);

  // Play 파라미터 처리 (?play=galleryId) — 코드 로드 후 자동 실행
  useEffect(() => {
    const playId = searchParams.get('play');
    if (!playId) return;

    let cancelled = false;
    (async () => {
      const playCode = await useGalleryStore.getState().fetchWorkCode(playId);
      if (cancelled || !playCode) return;
      updateCode(playCode);
      initialCodeRef.current = playCode;
      pendingPlayRef.current = playCode;
    })();
    return () => { cancelled = true; };
  }, [searchParams, updateCode]);

  // Example 파라미터 처리 (?example=<id>) — 예제 코드를 에디터에 자동 로드
  useEffect(() => {
    const exampleId = searchParams.get('example');
    if (!exampleId) return;
    const ex = EXAMPLES.find(e => e.id === exampleId);
    if (ex) {
      // 다른 예제로 이동 시 이전 잔존음/실행 정리
      stopAllSounds();
      // softStop 직접 호출 (stopExecution은 아래에서 디스트럭처되므로 TDZ 회피)
      import('../engine/pyodide-singleton').then(m => m.softStop()).catch(() => {});
      if (sceneRef.current) clearScene(sceneRef.current);
      updateCode(ex.code);
      initialCodeRef.current = ex.code;  // 초기화 시 이 예제로 복귀
      addOutput(`예제 "${ex.title}" 로드됨. 실행 버튼을 눌러주세요.`, 'success');
    } else {
      addOutput(`예제 ID "${exampleId}"를 찾을 수 없습니다.`, 'error');
    }
  }, [searchParams, addOutput, updateCode]);

  // Course lesson 파라미터 처리 (?lesson=<courseId>/<lessonId>) — 코스 차시 코드 prefill
  useEffect(() => {
    const lessonParam = searchParams.get('lesson');
    if (!lessonParam) return;
    const slash = lessonParam.indexOf('/');
    if (slash <= 0) {
      addOutput(`잘못된 lesson 파라미터: ${lessonParam} (형식: courseId/lessonId)`, 'error');
      return;
    }
    const cid = lessonParam.slice(0, slash);
    const lid = lessonParam.slice(slash + 1);
    const lesson = getLesson(cid, lid);
    if (lesson) {
      // 다른 차시로 이동 시 이전 잔존음/실행 정리
      stopAllSounds();
      import('../engine/pyodide-singleton').then(m => m.softStop()).catch(() => {});
      if (sceneRef.current) clearScene(sceneRef.current);
      updateCode(lesson.code);
      initialCodeRef.current = lesson.code;  // 초기화 시 이 차시로 복귀
      addOutput(`코스 차시 "${lesson.title?.ko || lid}" 로드됨. 실행 버튼을 눌러주세요.`, 'success');
    } else {
      addOutput(`차시를 찾을 수 없습니다: ${lessonParam}`, 'error');
    }
  }, [searchParams, addOutput, updateCode]);

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
              const c = fetchedCode || work.code;
              updateCode(c);
              initialCodeRef.current = c;
            } catch {
              updateCode(work.code);
              initialCodeRef.current = work.code;
            }
          } else {
            updateCode(work.code);
            initialCodeRef.current = work.code;
          }
          setEditMode({ id: editId, githubRepo: work.github_repo, title: work.title });
          addOutput(`"${work.title}" 수정 모드. 수정 후 "업데이트"를 눌러주세요.`, 'success');
        }
      });
    }
  }, [searchParams, addOutput, updateCode]);

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
    },
  });

  // 최초 Worker 초기화
  useEffect(() => {
    initWorker();
  }, [initWorker]);

  const startProgram = useCallback((sourceCode) => {
    // 이전 코드의 잔존음 + BGM + 3D 객체를 모두 정리
    stopAllSounds();
    stopExecution();  // 이전 무한 루프 강제 종료 (rate에서 stop signal 감지)
    if (sceneRef.current) clearScene(sceneRef.current);
    clearRegistry();
    if (sceneRef.current?._cameraSystem) {
      sceneRef.current._cameraSystem.onCodeStart();
    }
    setOutputs([]);
    setActiveTab('3d');
    runSound();
    addOutput('실행 중', 'log');
    runCode(sourceCode);
  }, [addOutput, runCode, stopExecution]);

  const handleRun = () => {
    if (!isReady || repoLoadStatus === 'loading') return;
    setPlayStartRequired(false);
    resumeAndRun(() => startProgram(codeRef.current));
  };

  // pendingPlay: Play 모드 코드 로드 + Pyodide 준비 모두 완료 시 자동 실행
  useEffect(() => {
    if (isReady && pendingPlayRef.current) {
      const playCode = pendingPlayRef.current;
      if (isTouchPlaybackEnvironment() && !isAudioUnlocked()) {
        setPlayStartRequired(true);
        return;
      }
      pendingPlayRef.current = null;
      // 다음 프레임에서 실행 (코드 state 반영 보장)
      requestAnimationFrame(() => startProgram(playCode));
    }
  }, [isReady, code, startProgram]);

  const handlePendingPlayStart = () => {
    const playCode = pendingPlayRef.current || codeRef.current;
    setPlayStartRequired(false);
    pendingPlayRef.current = null;
    resumeAndRun(() => startProgram(playCode));
  };

  const handleStop = () => {
    stopExecution();
    stopBgm();  // 실행 정지 시 BGM 자동 정지
    setActiveTab('editor');  // 정지 시 코드 에디터로 복귀
    addOutput('⏹ 실행 중지됨', 'warning');
  };

  const handleReset = () => {
    // 현재 로드된 예제/lesson/공유 코드의 원본으로 복귀 (없으면 DEFAULT_CODE)
    stopAllSounds();
    stopExecution();
    if (sceneRef.current) clearScene(sceneRef.current);
    updateCode(initialCodeRef.current || DEFAULT_CODE);
    setOutputs([]);
  };

  const handlePullLatestProjectCode = async () => {
    const shouldReplace = codeRef.current === initialCodeRef.current
      || window.confirm('현재 에디터의 코드가 다른 멤버의 최신 저장본으로 바뀝니다. 계속할까요?');
    if (!shouldReplace) return;

    const latestCode = await pullLatest();
    if (latestCode == null) {
      addOutput('최신 프로젝트 코드를 불러오지 못했습니다.', 'error');
      return;
    }

    stopAllSounds();
    stopExecution();
    if (sceneRef.current) clearScene(sceneRef.current);
    clearRegistry();
    updateCode(latestCode);
    initialCodeRef.current = latestCode;
    setActiveTab('editor');
    addOutput('다른 멤버가 저장한 최신 코드를 가져왔습니다.', 'success');
  };

  const handleShare = async () => {
    const ok = await copyCodeLink(codeRef.current);
    setShareMsg(ok ? t('share.copied') : 'Failed');
    setTimeout(() => setShareMsg(''), 2000);
  };

  const handleExport = async () => {
    const { generateStandaloneHTML, downloadHTML } = await import('../utils/export-html');
    const html = generateStandaloneHTML(codeRef.current, 'My VPyLab Project');
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

  const refreshPublishThumbnail = useCallback(async () => {
    const thumb = sceneRef.current?._renderer
      ? captureThumbnail(sceneRef.current._renderer.domElement)
      : null;
    setPublishThumbnail(thumb);
    return thumb;
  }, []);

  const openPublishModal = useCallback(() => {
    if (!user) {
      useAuthStore.getState().setAuthModalOpen(true);
      return;
    }
    setPublishModalOpen(true);
    refreshPublishThumbnail();
  }, [refreshPublishThumbnail, user]);

  /**
   * 저장 — 현재 코드가 이미 있으면 같은 행을 업데이트하고 revision을 누적,
   * 없으면 제목을 묻고 새 행을 만든다. (학생 학습 흐름에 맞춰 단순화)
   */
  const handleSave = async () => {
    if (!user) {
      useAuthStore.getState().setAuthModalOpen(true);
      return;
    }
    // 동적 import — projectStore는 프로젝트 컨텍스트가 있을 때만 필요
    const projStore = (await import('../stores/projectStore')).default.getState();
    const activeProject = projStore.activeProject;

    // === 프로젝트 컨텍스트: Supabase 저장 + GitHub commit + 토스트 ===
    if (activeProject) {
      const currentRole = getProjectRole(activeProject, projStore.activeMembers, user.id);
      if (currentRole === 'viewer') {
        setSaveMsg('보기 전용');
        addOutput('이 프로젝트는 보기 권한입니다. 저장하려면 팀 소유자에게 편집 권한을 요청해주세요.', 'warning');
        setTimeout(() => setSaveMsg(''), 2500);
        return;
      }

      // 모달 열기 전, "기록 권장 모드" 여부를 결정.
      // 처음이거나 마지막 기록 후 30분이 지나면 기록 탭을 기본으로 열어줍니다.
      const force = shouldForceDetailed(activeProject.id, user.id);
      setCommitMustDetailed(force);
      setCommitError('');
      setCommitModalOpen(true);
      return;
    }

    // === 활성 프로젝트 없음: 게이트 다이얼로그로 유도 (떠도는 저장 폐지) ===
    setShowProjectGate(true);
  };

  /**
   * payload: { kind: 'quick' | 'detailed', title, did?, blocker?, next? }
   * 모달이 이번 작업 유형(코드 저장/기록 남기기)을 넘기면,
   * 코드 저장은 최신 코드를 반영하고 기록 남기기는 코드를 덮어쓰지 않습니다.
   */
  const handleProjectCommit = async (payload) => {
    const projStore = (await import('../stores/projectStore')).default.getState();
    const proj = projStore.activeProject;
    if (!proj) {
      setCommitModalOpen(false);
      setShowProjectGate(true);
      return;
    }
    const userId = user?.id;
    if (!userId) {
      setCommitError('로그인이 필요합니다');
      return;
    }
    const currentRole = getProjectRole(proj, projStore.activeMembers, userId);
    if (currentRole === 'viewer') {
      setCommitError('보기 권한에서는 프로젝트를 저장할 수 없습니다.');
      return;
    }

    const saveType = payload?.saveType === 'record' ? 'record' : 'code';
    const title = (payload?.title || '').trim();
    if (!title) {
      setCommitError('제목을 적어주세요.');
      return;
    }
    if (saveType === 'record' && !(payload.did || '').trim()) {
      setCommitError('기록 내용은 한 줄 이상 적어주세요.');
      return;
    }

    const currentCode = codeRef.current;
    const { localDate, localTime, tzOffset } = nowLocalParts();
    const codeLines = countCodeLines(currentCode);
    const lastLines = readLastCodeLines(proj.id, userId);
    const lineDelta = lastLines != null ? codeLines - lastLines : null;
    const recordPayload = {
      kind: 'detailed',
      title,
      did: (payload.did || '').trim(),
      blocker: (payload.blocker || '').trim(),
      next: (payload.next || '').trim(),
      localDate,
      localTime,
      tzOffset,
      codeLines,
      lineDelta,
    };
    const revisionMessage = saveType === 'record'
      ? [
        `기록: ${title}`,
        recordPayload.did && `한 일: ${recordPayload.did}`,
        recordPayload.blocker && `막힌 점: ${recordPayload.blocker}`,
        recordPayload.next && `다음: ${recordPayload.next}`,
      ].filter(Boolean).join(' | ')
      : title;

    setCommitSaving(true);
    setCommitElapsed(0);
    setCommitStartedAt(Date.now());
    setCommitError('');
    setSaveMsg(saveType === 'record' ? '기록 중…' : '저장 중…');
    let result = null;
    let error = null;
    try {
      const savePromise = saveType === 'record'
        ? projStore.recordProjectNote({
          currentCode,
          message: title,
          revisionMessage,
          voyageEntry: recordPayload,
        })
        : projStore.saveAndPush({
          code: currentCode,
          message: title,
          revisionMessage,
          voyageEntry: null,
        });
      const response = await Promise.race([
        savePromise,
        waitForSaveTimeout(
          saveType === 'record' ? 40000 : 60000,
          saveType === 'record'
            ? '기록 저장이 40초 안에 끝나지 않았습니다. 화면을 새로고침한 뒤 이력에 반영됐는지 확인해주세요.'
            : '코드 저장이 60초 안에 끝나지 않았습니다. 화면을 새로고침한 뒤 이력에 반영됐는지 확인해주세요.',
        ),
      ]);
      result = response?.data || null;
      error = response?.error || null;
    } catch (e) {
      error = { message: e?.message || (saveType === 'record' ? '기록 저장에 실패했습니다.' : '코드 저장에 실패했습니다.') };
    } finally {
      setCommitSaving(false);
      setCommitStartedAt(null);
      useProjectStore.setState({ projectSaveStatus: null });
    }

    if (error) {
      setSaveMsg(saveType === 'record' ? '기록 실패' : '저장 실패');
      setCommitError(error.message);
      setTimeout(() => setSaveMsg(''), 2500);
      return;
    }

    if (saveType === 'record' && !result?.voyageEntry?.error) {
      markDetailedSaved(proj.id, userId);
    }
    if (saveType === 'code') {
      writeLastCodeLines(proj.id, userId, codeLines);
      initialCodeRef.current = currentCode;
    }

    setSaveMsg('');
    setCommitModalOpen(false);
    setPushToast({
      recordOnly: result.recordOnly,
      localOnly: result.localOnly,
      pendingGitHub: result.pendingGitHub,
      nthCommit: result.nthCommit,
      message: title || new Date().toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' }),
      commitUrl: result.commitUrl,
      pageCommitUrl: result.pageCommitUrl,
      repoUrl: result.repoUrl,
      recordUrl: result.recordUrl,
      pagesUrl: result.pagesUrl,
      pagesStatus: result.pagesStatus,
      pagesWarning: result.pagesWarning,
    });
  };

  /**
   * 다른 이름으로 저장 — 현재 currentCodeId 무관하게 새 행을 만든다.
   */
  const handleSaveAs = async () => {
    if (!user) {
      useAuthStore.getState().setAuthModalOpen(true);
      return;
    }
    const title = prompt(t('code.saveTitlePlaceholder'));
    if (title === null) return;
    const finalTitle = title || `코드 ${new Date().toLocaleDateString()}`;
    const { data, error } = await saveCode({ title: finalTitle, code: codeRef.current });
    if (!error && data) {
      useCodeStore.getState().setCurrentCodeId(data.id);
      setSaveMsg(t('code.saved'));
      setTimeout(() => setSaveMsg(''), 2000);
    }
  };

  const handleOpenHistory = () => {
    if (!user) {
      useAuthStore.getState().setAuthModalOpen(true);
      return;
    }
    if (activeProject && activeCodeId) {
      setHistoryTarget({ id: activeCodeId, title: activeProject.title });
      return;
    }
    setShowSavedCodes(true);
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
    const htmlContent = generateStandaloneHTML(codeRef.current, editMode.title);
    addOutput('GitHub에 업데이트 중...', 'log');
    const result = await useGalleryStore.getState().updateWork({
      id: editMode.id,
      title: editMode.title,
      code: codeRef.current,
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
      setTheaterWaiting(false);
            pendingPlayRef.current = codeRef.current;
            resumeAndRun(() => {
              if (isReady) {
                requestAnimationFrame(() => {
            if (sceneRef.current) clearScene(sceneRef.current);
            clearRegistry();
            if (sceneRef.current?._cameraSystem) sceneRef.current._cameraSystem.onCodeStart();
                  setOutputs([]);
                  runSound();
                  runCode(codeRef.current);
                });
              }
            });
    };

    return (
      <div className="h-screen w-screen relative" style={{ backgroundColor: '#000' }}>
        <Viewport3D sceneRef={sceneRef} onSceneReady={handleSceneReady} />

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
        className="flex items-center gap-2 shrink-0"
        style={{
          backgroundColor: 'var(--color-bg-secondary)',
          borderBottom: '1px solid var(--color-border)',
          padding: '10px 20px',
        }}
      >
        <button onClick={handleRun} disabled={!isReady || isRunning || repoLoadStatus === 'loading'} className="toolbar-btn --run">
          {repoLoadStatus === 'loading' ? '불러오는 중' : t('editor.run')}
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
          <button
            onClick={handleSave}
            className="toolbar-btn"
            style={{ fontWeight: 600 }}
            title={activeProjectCanEdit
              ? '현재 코드를 저장 (Ctrl/Cmd+S). 같은 코드면 이력에 누적됩니다.'
              : '보기 권한이라 프로젝트를 저장할 수 없습니다.'}
          >
            {activeProjectRole === 'viewer' ? '보기 전용' : (saveMsg || '💾 저장')}
          </button>
          <button onClick={handleSaveAs} className="toolbar-btn" title="새 이름으로 저장 (별도 코드로 분기)">
            {t('code.saveAs') || '다른 이름으로 저장'}
          </button>
          <button onClick={handleOpenHistory} className="toolbar-btn" title="현재 코드의 저장 이력과 복원 기록 보기">
            📜 저장 이력
          </button>
          <button onClick={() => setShowExamples(true)} className="toolbar-btn --examples">
            {t('editor.examples') || '예제'}
          </button>
          <button onClick={() => { setTeamInitialAction('browse'); setShowTeam(true); }} className="toolbar-btn" style={{ fontWeight: activeProject ? 600 : 400 }}>
            {activeProject ? `📁 ${activeProject.title.slice(0, 20)}${activeProject.title.length > 20 ? '…' : ''}` : '📁 프로젝트'}
          </button>
          <button
            onClick={openPublishModal}
            className="toolbar-btn --publish"
          >
            {t('gallery.publish') || '갤러리에 올리기'}
          </button>
          {/* 교사: 코드 전송 + 비우기 */}
          {isTeacher() && (
            <>
              <button onClick={() => setSendModalOpen(true)} className="toolbar-btn" style={{ background: '#F59E0B', color: 'white', fontWeight: 600, border: '1px solid #F59E0B' }}>
                {t('codeShare.sendToStudents')}
              </button>
              {sharedCodes.length > 0 && (
                <button
                  onClick={() => {
                    if (window.confirm(t('codeShare.clearConfirm'))) {
                      clearCodes(selectedClassId);
                    }
                  }}
                  className="toolbar-btn"
                  style={{ color: 'var(--color-error, #FF6B6B)' }}
                >
                  {t('codeShare.clearAll')}
                </button>
              )}
            </>
          )}
          {/* 학생: 코드 우편함 */}
          {!isTeacher() && profile?.class_id && sharedCodes.length > 0 && (
            <button onClick={() => setPanelOpen(true)} className="toolbar-btn" style={{ position: 'relative' }}>
              {t('codeShare.mailbox')}
              {unreadCount > 0 && (
                <span style={{
                  position: 'absolute', top: -4, right: -4,
                  background: 'var(--color-error, #FF6B6B)', color: 'white',
                  borderRadius: '50%', width: 16, height: 16,
                  fontSize: 10, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {unreadCount}
                </span>
              )}
            </button>
          )}
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
                { label: activeProjectRole === 'viewer' ? '보기 전용' : (saveMsg || '💾 저장'), action: () => { handleSave(); setMobileMore(false); } },
                { label: t('code.saveAs') || '다른 이름으로 저장', action: () => { handleSaveAs(); setMobileMore(false); } },
                { label: '📜 저장 이력', action: () => { handleOpenHistory(); setMobileMore(false); } },
                { label: t('editor.examples') || '예제', action: () => { setShowExamples(true); setMobileMore(false); } },
                { label: activeProject ? `📁 ${activeProject.title}` : '📁 프로젝트', action: () => { setTeamInitialAction('browse'); setShowTeam(true); setMobileMore(false); } },
                { label: t('gallery.publish') || '갤러리에 올리기', action: () => { openPublishModal(); setMobileMore(false); } },
                // 교사: 코드 전송
                ...(isTeacher() ? [
                  { label: `📤 ${t('codeShare.sendToStudents')}`, action: () => { setSendModalOpen(true); setMobileMore(false); } },
                ] : []),
                // 학생: 코드 우편함
                ...(!isTeacher() && profile?.class_id && sharedCodes.length > 0 ? [
                  { label: `📬 ${t('codeShare.mailbox')}${unreadCount > 0 ? ` (${unreadCount})` : ''}`, action: () => { setPanelOpen(true); setMobileMore(false); } },
                ] : []),
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
          {/* 모바일 전용: 코드 바로 위 실행/정지 — 상단 툴바가 가려지는 작은 화면 대응 */}
          <div
            className="md:hidden flex gap-2 shrink-0"
            style={{
              backgroundColor: 'var(--color-bg-secondary)',
              borderBottom: '1px solid var(--color-border)',
              padding: '10px 16px',
            }}
          >
            {!isRunning ? (
              <button
                onClick={handleRun}
                disabled={!isReady || repoLoadStatus === 'loading'}
                className="btn-primary flex-1 !py-2.5 !text-[14px] flex items-center justify-center gap-1.5"
                style={{ opacity: isReady && repoLoadStatus !== 'loading' ? 1 : 0.5 }}
              >
                <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor"><path d="M6 2l8 6-8 6V2z"/></svg>
                {repoLoadStatus === 'loading' ? '불러오는 중' : t('editor.run')}
              </button>
            ) : (
              <button
                onClick={handleStop}
                className="btn-primary flex-1 !py-2.5 !text-[14px] flex items-center justify-center gap-1.5"
                style={{ background: 'var(--color-error, #FF6B6B)' }}
              >
                <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor"><rect x="3" y="3" width="10" height="10" rx="1"/></svg>
                {t('editor.stop')}
              </button>
            )}
            <button
              onClick={handleReset}
              className="btn-secondary !py-2.5 !text-[13px] !px-4"
              title={t('editor.reset')}
            >
              ↺
            </button>
          </div>
          <CodeEditor code={code} onChange={(val) => updateCode(val || '')} />
        </div>

        {/* 리사이저 (데스크톱) */}
        <div className="hidden md:block panel-resizer w-1" />

        {/* 우측: 3D + 콘솔 */}
        <div className={`${activeTab === 'editor' ? 'hidden' : 'flex'} md:flex flex-1 flex-col min-h-0 min-w-0`}>
          {/* 3D 뷰포트 — 모바일: 100%, 데스크톱: 항상 60% */}
          <div
            className={`${activeTab === '3d' ? 'flex' : 'hidden'} md:flex w-full`}
            style={{ height: '60%', minHeight: 0, borderBottom: '1px solid var(--color-border)' }}
          >
            <Viewport3D sceneRef={sceneRef} onSceneReady={handleSceneReady} />
          </div>

          {/* 리사이저 (데스크톱) */}
          <div className="hidden md:block panel-resizer panel-resizer-h h-1" />

          {/* 콘솔 — 데스크톱: 항상 표시 */}
          <div
            className={`${activeTab === 'console' || activeTab === '3d' ? 'flex' : 'hidden'} md:flex flex-col w-full`}
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

      {playStartRequired && (
        <div
          onClick={handlePendingPlayStart}
          style={{
            position: 'fixed', inset: 0, zIndex: 120,
            background: 'rgba(13,17,23,0.72)', backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 24, cursor: 'pointer',
          }}
        >
          <div
            style={{
              width: 'min(420px, 100%)',
              background: 'var(--color-bg-secondary)',
              border: '1px solid var(--color-border)',
              borderRadius: 18,
              padding: '28px 24px',
              textAlign: 'center',
              boxShadow: '0 20px 40px rgba(0,0,0,0.24)',
            }}
          >
            <div style={{ fontSize: 48, lineHeight: 1, marginBottom: 14 }}>▶</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 10 }}>
              탭하여 소리와 함께 시작
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--color-text-secondary)' }}>
              모바일과 태블릿에서는 첫 탭에서 오디오를 먼저 활성화해야 합니다.
            </div>
          </div>
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
                    onClick={() => {
                      // 다른 예제로 전환 시 이전 잔존음/실행/씬 정리
                      stopAllSounds();
                      stopExecution();
                      if (sceneRef.current) clearScene(sceneRef.current);
                      clearRegistry();
                      updateCode(ex.code);
                      initialCodeRef.current = ex.code;
                      // 예제 로드 = 활성 프로젝트와 무관 → 컨텍스트 해제
                      useProjectStore.getState().closeProject();
                      useCodeStore.getState().setCurrentCodeId(null);
                      setShowExamples(false);
                    }}
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

      {/* 저장 게이트 다이얼로그 — 활성 프로젝트 없을 때 💾 누르면 표시 */}
      <ProjectGate
        open={showProjectGate}
        onCreateNew={() => { setShowProjectGate(false); setTeamInitialAction('create'); setShowTeam(true); }}
        onPickExisting={() => { setShowProjectGate(false); setTeamInitialAction('browse'); setShowTeam(true); }}
        onClose={() => setShowProjectGate(false)}
      />

      {commitModalOpen && (
        <CommitSaveModal
          key={`${commitModalOpen ? 'open' : 'closed'}-${commitMustDetailed ? 'record' : 'code'}`}
          open={commitModalOpen}
          projectTitle={activeProject?.title || ''}
          githubConnected={Boolean(activeProject?.github_repo)}
          saving={commitSaving}
          progressLabel={projectSaveStatus}
          elapsedSeconds={commitElapsed}
          error={commitError}
          mustDetailed={commitMustDetailed}
          onSubmit={handleProjectCommit}
          onClose={() => {
            if (commitSaving) return;
            setCommitModalOpen(false);
            setCommitError('');
          }}
        />
      )}

      {/* 프로젝트 사이드패널 */}
      {showTeam && (
        <TeamProjectsPanel
          currentCode={codeRef.current}
          initialAction={teamInitialAction}
          onOpenProject={async (projectId, prefetched = null) => {
            // 프로젝트의 코드를 에디터에 로드 + 활성 프로젝트로 전환
            const { default: useProjectStore } = await import('../stores/projectStore');
            const store = useProjectStore.getState();
            const result = prefetched?.code && store.activeProject?.id === projectId
              ? { project: store.activeProject, code: prefetched.code }
              : await store.openProject(projectId) || {};
            if (result.error) {
              throw new Error(result.error.message || '프로젝트를 열지 못했습니다.');
            }
            const codeRow = result.code;
            if (codeRow?.code == null) {
              throw new Error('프로젝트 코드를 찾을 수 없습니다.');
            }

            stopAllSounds();
            stopExecution();
            if (sceneRef.current) clearScene(sceneRef.current);
            clearRegistry();
            setOutputs([]);
            setActiveTab('editor');
            updateCode(codeRow.code);
            initialCodeRef.current = codeRow.code;
            if (codeRow.id) useCodeStore.getState().setCurrentCodeId(codeRow.id);
            addOutput(`프로젝트 "${result.project?.title || '제목 없음'}"을 열었습니다.`, 'success');
            if (!result.project?.github_repo) {
              addOutput('GitHub 저장소는 아직 연결되지 않았습니다. 프로젝트 카드에서 나중에 연결할 수 있습니다.', 'log');
            }
            setShowTeam(false);
            setTeamInitialAction('browse');
          }}
          onClose={() => { setShowTeam(false); setTeamInitialAction('browse'); }}
        />
      )}

      {/* 현재 프로젝트/코드 저장 이력 */}
      {historyTarget && (
        <RevisionTimeline
          codeId={historyTarget.id}
          codeTitle={historyTarget.title}
          onClose={() => setHistoryTarget(null)}
          onRestored={(snapshotCode) => {
            updateCode(snapshotCode);
            initialCodeRef.current = snapshotCode;
            setHistoryTarget(null);
            addOutput('선택한 저장 이력을 에디터로 복원했습니다. GitHub에도 맞추려면 코드 저장을 눌러주세요.', 'success');
          }}
        />
      )}

      {/* 저장된 코드 목록과 각 코드의 이력 */}
      {showSavedCodes && (
        <SavedCodeList
          onClose={() => setShowSavedCodes(false)}
          onLoadCode={(loadedCode, codeId) => {
            updateCode(loadedCode);
            initialCodeRef.current = loadedCode;
            if (codeId) setCurrentCodeId(codeId);
            setShowSavedCodes(false);
            addOutput('저장된 코드를 에디터로 불러왔습니다.', 'success');
          }}
        />
      )}

      {/* GitHub 저장 성공 토스트 */}
      {pushToast && <GitHubSaveToast toast={pushToast} onClose={() => setPushToast(null)} />}

      {/* 다른 멤버 저장 알림 */}
      {lastRemoteUpdate && activeProject && (
        <RemoteUpdateToast
          projectTitle={activeProject.title}
          update={lastRemoteUpdate}
          onPull={handlePullLatestProjectCode}
          onClose={clearRemoteUpdate}
        />
      )}

      {/* 갤러리 발행 모달 */}
      <PublishModal
        isOpen={publishModalOpen}
        onClose={() => { setPublishModalOpen(false); setPublishThumbnail(null); }}
        code={codeRef.current}
        thumbnail={publishThumbnail}
        remixFrom={remixFrom}
        projectContext={activeProject}
        onRefreshThumbnail={refreshPublishThumbnail}
      />

      {/* 코드 전송 모달 (교사) */}
      <SendCodeModal
        isOpen={sendModalOpen}
        onClose={() => setSendModalOpen(false)}
        currentCode={codeRef.current}
      />

      {/* 코드 수신 패널 (학생) */}
      {panelOpen && (
        <CodeSharePanel
          onClose={() => setPanelOpen(false)}
          onReplaceCode={(newCode) => {
            updateCode(newCode);
            setOutputs(prev => [...prev, { text: t('codeShare.replaced'), type: 'success', id: Date.now() }]);
          }}
          onAppendCode={(newCode) => {
            updateCode(prev => prev + '\n\n# --- ' + t('codeShare.teacherCode') + ' ---\n' + newCode);
            setOutputs(prev => [...prev, { text: t('codeShare.appended'), type: 'success', id: Date.now() }]);
          }}
        />
      )}

      {/* 코드 수신 토스트 */}
      <CodeShareToast
        visible={codeShareToast}
        onDismiss={() => setCodeShareToast(false)}
        onOpen={() => { setCodeShareToast(false); setPanelOpen(true); }}
      />
    </div>
  );
}

/**
 * 저장 모달
 *  - 코드 저장: 현재 에디터 코드를 최신본으로 반영
 *  - 기록 남기기: 코드는 덮어쓰지 않고 항해 일지만 추가
 */
function CommitSaveModal({
  open,
  projectTitle,
  githubConnected = false,
  saving,
  progressLabel,
  elapsedSeconds = 0,
  error,
  mustDetailed = false,
  onSubmit,
  onClose,
}) {
  const [saveType, setSaveType] = useState(mustDetailed ? 'record' : 'code');
  const [title, setTitle] = useState('');
  const [did, setDid] = useState('');
  const [blocker, setBlocker] = useState('');
  const [next, setNext] = useState('');
  const [touched, setTouched] = useState(false);

  if (!open) return null;

  const trimmedTitle = title.trim();
  const trimmedDid = did.trim();
  const titleMissing = !trimmedTitle;
  const didMissing = saveType === 'record' && !trimmedDid;
  const canSubmit = !titleMissing && !didMissing && !saving;

  const progressPercent = saving ? Math.min(92, 14 + elapsedSeconds * 4) : 0;
  const waitingMessage = elapsedSeconds >= 20
    ? '저장 응답이 평소보다 오래 걸리고 있어요. 창을 닫지 말고 조금만 기다려주세요.'
    : saveType === 'record'
      ? 'VPyLab 기록을 먼저 남기고, GitHub 항해 일지는 뒤에서 반영합니다.'
      : githubConnected
        ? '보통 6-15초 정도, 미리보기 페이지 갱신이 느리면 30초 안팎까지 걸릴 수 있어요.'
        : '보통 1-3초 안에 VPyLab 이력에 저장됩니다. GitHub 연결은 나중에 할 수 있어요.';

  const handleSubmit = (e) => {
    e.preventDefault();
    setTouched(true);
    if (!canSubmit) return;
    if (saveType === 'code') {
      onSubmit({ saveType: 'code', title: trimmedTitle });
    } else {
      onSubmit({
        saveType: 'record',
        title: trimmedTitle,
        did: trimmedDid,
        blocker: blocker.trim(),
        next: next.trim(),
      });
    }
  };

  const inputStyle = {
    backgroundColor: 'var(--color-bg-primary)',
    borderColor: 'var(--color-border)',
    color: 'var(--color-text-primary)',
  };
  const labelClass = 'mb-1.5 block text-xs font-semibold';
  const labelStyle = { color: 'var(--color-text-secondary)' };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(15, 23, 42, 0.54)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md border shadow-2xl"
        style={{
          backgroundColor: 'var(--color-bg-panel)',
          borderColor: 'var(--color-border)',
          padding: 24,
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase" style={{ color: 'var(--color-accent)' }}>
              {projectTitle}
            </p>
            <h3 className="mt-1 text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>
              작업 남기기
            </h3>
            <p className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
              {saveType === 'record'
                ? '기록만 남기면 현재 코드는 덮어쓰지 않습니다. 회고, 역할 분담, 다음 할 일을 남길 때 사용하세요.'
                : githubConnected
                  ? '코드 저장은 최신 코드와 Pages 실행 페이지를 갱신합니다. 기록은 별도로 남길 수 있어요.'
                  : '코드 저장은 VPyLab 코드 이력에 남습니다. GitHub 연결 후에는 커밋과 Pages도 함께 갱신됩니다.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="h-8 w-8 border bg-transparent text-lg disabled:opacity-40"
            style={{ color: 'var(--color-text-muted)', borderColor: 'var(--color-border)' }}
            aria-label="닫기"
          >
            ×
          </button>
        </div>

        {/* 작업 유형 선택 */}
        <div
          className="mb-4 grid grid-cols-2 gap-1 p-1 rounded"
          style={{ backgroundColor: 'var(--color-bg-secondary)' }}
          role="tablist"
        >
          <button
            type="button"
            onClick={() => setSaveType('code')}
            className="px-3 py-1.5 text-xs font-semibold rounded transition-colors"
            style={{
              backgroundColor: saveType === 'code' ? 'var(--color-bg-panel)' : 'transparent',
              color: saveType === 'code' ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
              border: saveType === 'code' ? '1px solid var(--color-border)' : '1px solid transparent',
            }}
            role="tab"
            aria-selected={saveType === 'code'}
          >
            코드 저장
          </button>
          <button
            type="button"
            onClick={() => setSaveType('record')}
            className="px-3 py-1.5 text-xs font-semibold rounded transition-colors"
            style={{
              backgroundColor: saveType === 'record' ? 'var(--color-bg-panel)' : 'transparent',
              color: saveType === 'record' ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
              border: saveType === 'record' ? '1px solid var(--color-border)' : '1px solid transparent',
            }}
            role="tab"
            aria-selected={saveType === 'record'}
          >
            기록 남기기
          </button>
        </div>

        {mustDetailed ? (
          <div
            className="mb-4 px-3 py-2.5 text-xs leading-relaxed"
            style={{
              backgroundColor: 'rgba(74,108,247,0.08)',
              borderLeft: '3px solid var(--color-accent)',
              color: 'var(--color-text-secondary)',
            }}
          >
            <div className="font-bold mb-0.5" style={{ color: 'var(--color-accent)' }}>
              잠깐 회고하는 시간이에요
            </div>
            오늘 처음이거나 마지막 기록 후 30분이 지났어요. 코드 저장과 별개로 기록을 먼저 남겨두면 이어받기가 훨씬 쉬워집니다.
          </div>
        ) : null}

        {/* 제목 — 항상 노출, 항상 필수 */}
        <label className="block">
          <span className={labelClass} style={labelStyle}>
            제목 <span style={{ color: 'var(--color-error)' }}>*</span>
          </span>
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={saveType === 'code' ? '예: 카메라 위치 조정 코드 저장' : '예: 오늘 역할 정리'}
            className="w-full border px-3 py-2 text-sm outline-none"
            style={inputStyle}
            maxLength={120}
          />
          {touched && titleMissing && (
            <span className="mt-1 block text-[11px]" style={{ color: 'var(--color-error)' }}>
              제목은 한 줄이라도 적어주세요.
            </span>
          )}
        </label>

        {/* 기록 남기기 추가 필드 */}
        {saveType === 'record' && (
          <>
            <label className="block mt-3">
              <span className={labelClass} style={labelStyle}>
                기록 내용 <span style={{ color: 'var(--color-error)' }}>*</span>
              </span>
              <textarea
                value={did}
                onChange={(e) => setDid(e.target.value)}
                placeholder="예: 민준은 공 움직임을 맡고, 나는 벽 충돌 조건을 확인했다."
                className="w-full border px-3 py-2 text-sm outline-none resize-y"
                style={{ ...inputStyle, minHeight: 60 }}
                maxLength={500}
                rows={2}
              />
              {touched && didMissing && (
                <span className="mt-1 block text-[11px]" style={{ color: 'var(--color-error)' }}>
                  기록 내용은 한 줄 이상 적어주세요.
                </span>
              )}
            </label>

            <label className="block mt-3">
              <span className={labelClass} style={labelStyle}>
                막힌 점 <span className="font-normal" style={{ color: 'var(--color-text-muted)' }}>(선택)</span>
              </span>
              <textarea
                value={blocker}
                onChange={(e) => setBlocker(e.target.value)}
                placeholder="없으면 비워두세요. 있으면 다음 사람이 이어받기 좋아요."
                className="w-full border px-3 py-2 text-sm outline-none resize-y"
                style={{ ...inputStyle, minHeight: 50 }}
                maxLength={500}
                rows={2}
              />
            </label>

            <label className="block mt-3">
              <span className={labelClass} style={labelStyle}>
                다음 할 일 <span className="font-normal" style={{ color: 'var(--color-text-muted)' }}>(선택)</span>
              </span>
              <textarea
                value={next}
                onChange={(e) => setNext(e.target.value)}
                placeholder="예: 벽과 반사 효과 추가하기"
                className="w-full border px-3 py-2 text-sm outline-none resize-y"
                style={{ ...inputStyle, minHeight: 50 }}
                maxLength={500}
                rows={2}
              />
            </label>
          </>
        )}

        {error && (
          <p
            className="mt-3 border px-3 py-2 text-xs"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-error)' }}
          >
            {error}
          </p>
        )}

        {saving && (
          <div
            className="mt-3 border px-3 py-3 text-xs"
            style={{
              backgroundColor: 'var(--color-bg-secondary)',
              borderColor: 'var(--color-border)',
              color: 'var(--color-text-secondary)',
            }}
            role="status"
          >
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                {progressLabel || '저장하는 중입니다.'}
              </span>
              <span style={{ color: 'var(--color-text-muted)' }}>{elapsedSeconds}초</span>
            </div>
            <div className="h-1.5 overflow-hidden" style={{ backgroundColor: 'var(--color-bg-tertiary)' }}>
              <div
                className="h-full transition-all duration-500"
                style={{ width: `${progressPercent}%`, backgroundColor: 'var(--color-accent)' }}
              />
            </div>
            <p className="mt-2 leading-relaxed">{waitingMessage}</p>
          </div>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="border px-4 py-2 text-sm font-semibold disabled:opacity-40"
            style={{
              backgroundColor: 'transparent',
              borderColor: 'var(--color-border)',
              color: 'var(--color-text-secondary)',
            }}
          >
            취소
          </button>
          <button
            type="submit"
            disabled={saving}
            className="border-none px-4 py-2 text-sm font-semibold disabled:opacity-60"
            style={{
              backgroundColor: 'var(--color-accent)',
              color: 'var(--color-accent-text, white)',
            }}
          >
            {saving ? (saveType === 'record' ? '기록 중' : '저장 중') : (saveType === 'record' ? '기록 남기기' : '코드 저장')}
          </button>
        </div>
      </form>
    </div>
  );
}

function RemoteUpdateToast({ projectTitle, update, onPull, onClose }) {
  const isRecord = update?.kind === 'record';

  return (
    <div
      className="fixed bottom-6 left-6 z-[80] w-[min(390px,calc(100vw-32px))] border shadow-2xl"
      style={{
        backgroundColor: 'var(--color-bg-panel)',
        borderColor: 'var(--color-border)',
        boxShadow: 'inset 3px 0 0 var(--color-warning, #F59E0B), 0 20px 40px rgba(15,23,42,0.18)',
        animation: 'fadeIn 0.2s ease-out',
        padding: 18,
      }}
      role="status"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>
            {isRecord ? '다른 멤버가 기록을 남겼습니다' : '다른 멤버가 코드를 저장했습니다'}
          </p>
          <p className="mt-1 text-xs leading-relaxed break-words" style={{ color: 'var(--color-text-secondary)' }}>
            {isRecord
              ? `${projectTitle || '팀 프로젝트'}의 항해 일지에 새 기록이 추가되었습니다. 현재 코드는 바뀌지 않았습니다.`
              : `${projectTitle || '팀 프로젝트'}의 최신 코드를 가져와 이어서 작업할 수 있습니다.`}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="h-7 w-7 border bg-transparent text-base flex-shrink-0"
          style={{
            color: 'var(--color-text-muted)',
            borderColor: 'var(--color-border)',
          }}
          aria-label="닫기"
        >
          ×
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {!isRecord && (
          <button
            type="button"
            onClick={onPull}
            className="px-2.5 py-1.5 text-[11px] font-semibold border-none"
            style={{
              backgroundColor: 'var(--color-accent)',
              color: 'var(--color-accent-text, white)',
            }}
          >
            최신 코드 가져오기
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          className="px-2.5 py-1.5 text-[11px] font-semibold border-none"
          style={{
            backgroundColor: 'var(--color-bg-tertiary)',
            color: 'var(--color-text-primary)',
          }}
        >
          {isRecord ? '확인' : '나중에'}
        </button>
      </div>
    </div>
  );
}

function GitHubSaveToast({ toast, onClose }) {
  const links = [
    toast.recordUrl && { href: toast.recordUrl, label: '기록 파일' },
    toast.pageCommitUrl && { href: toast.pageCommitUrl, label: 'Pages 커밋' },
    !toast.recordUrl && !toast.pageCommitUrl && toast.commitUrl && { href: toast.commitUrl, label: '이번 커밋' },
    !toast.recordOnly && toast.pagesUrl && { href: toast.pagesUrl, label: '실행 페이지' },
    toast.repoUrl && { href: toast.repoUrl, label: '저장소' },
  ].filter(Boolean);
  const statusText = toast.recordOnly
    ? (toast.pagesWarning || '코드는 바꾸지 않고 기록만 남겼습니다.')
    : toast.localOnly || toast.pendingGitHub
    ? toast.pagesWarning
    : toast.pagesWarning
      ? `Pages 배포 확인: ${toast.pagesWarning}`
      : toast.pagesStatus
        ? `Pages 상태: ${toast.pagesStatus}. 반영에는 잠시 시간이 걸릴 수 있습니다.`
        : 'Pages 반영에는 잠시 시간이 걸릴 수 있습니다.';
  const titleText = toast.recordOnly
    ? '기록 저장 완료'
    : toast.localOnly || toast.pendingGitHub
    ? 'VPyLab 저장 완료'
    : 'GitHub 저장 완료';
  const detailText = toast.recordOnly
    ? `${toast.nthCommit}번째 기록 · ${toast.message}`
    : toast.localOnly
    ? `${toast.nthCommit}번째 저장 · ${toast.message}`
    : toast.pendingGitHub
      ? 'GitHub 반영은 백그라운드에서 진행 중입니다. 편집은 계속해도 됩니다.'
      : `${toast.nthCommit}번째 커밋 · ${toast.message}`;

  return (
    <div
      className="fixed bottom-6 right-6 z-[80] w-[min(390px,calc(100vw-32px))] border shadow-2xl"
      style={{
        backgroundColor: 'var(--color-bg-panel)',
        borderColor: 'var(--color-border)',
        boxShadow: 'inset 3px 0 0 var(--color-success), 0 20px 40px rgba(15,23,42,0.18)',
        animation: 'fadeIn 0.2s ease-out',
        padding: 18,
      }}
      role="status"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>
            {titleText}
          </p>
          <p className="mt-1 text-xs leading-relaxed break-words" style={{ color: 'var(--color-text-secondary)' }}>
            {detailText}
          </p>
          <p className="mt-1 text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
            {statusText}
          </p>
        </div>
        <button
          onClick={onClose}
          className="h-7 w-7 border bg-transparent text-base flex-shrink-0"
          style={{
            color: 'var(--color-text-muted)',
            borderColor: 'var(--color-border)',
          }}
          aria-label="닫기"
        >
          ×
        </button>
      </div>

      {links.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {links.map((link, index) => (
            <a
              key={link.href}
              href={link.href}
              target="_blank"
              rel="noreferrer"
              className="px-2.5 py-1.5 text-[11px] font-semibold no-underline"
              style={{
                backgroundColor: index === 0 ? 'var(--color-accent)' : 'var(--color-bg-tertiary)',
                color: index === 0 ? 'var(--color-accent-text, white)' : 'var(--color-text-primary)',
              }}
            >
              {link.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

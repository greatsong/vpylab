/* global importScripts */
/**
 * VPyLab — Pyodide Web Worker
 *
 * 보안 감사 결과 반영:
 * - Pyodide 로딩 완료 후 위험 API 삭제 (fetch, WebSocket, IndexedDB, importScripts)
 * - Worker.terminate() 기반 강제 종료 (메인 스레드에서)
 * - 패키지 화이트리스트
 *
 * 중요: fetch/importScripts는 Pyodide 로딩에 필요하므로,
 *       Pyodide 초기화가 완료된 후에만 삭제한다.
 */

const PYODIDE_VERSION = '0.27.0';
// 1차 CDN: jsdelivr, 2차 fallback: unpkg — 한 쪽이 일시 장애여도 다른 쪽으로 시도
const PYODIDE_CDNS = [
  `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`,
  `https://unpkg.com/pyodide@${PYODIDE_VERSION}/`,
];
let PYODIDE_CDN = PYODIDE_CDNS[0];

let pyodide = null;
let vpythonApiCode = null;
let shouldStop = false;
let micropipLoaded = false;
let isRunningCode = false;
let isDispatchingEvents = false;
let currentRunId = 0;
let queuedRun = null;

// Python의 print()가 무한 반복되어도 Worker 메모리와 메시지 큐를 제한합니다.
const OUTPUT_BUFFER_LIMIT = 16_384;
const outputStreams = {
  stdout: { text: '', dropped: 0 },
  stderr: { text: '', dropped: 0 },
};
let outputFlushTimer = null;

self._queueOutput = (kind, value) => {
  const stream = outputStreams[kind];
  if (!stream) return;
  const text = String(value);
  const available = Math.max(0, OUTPUT_BUFFER_LIMIT - stream.text.length);
  stream.text += text.slice(0, available);
  stream.dropped += Math.max(0, text.length - available);
  if (outputFlushTimer === null) {
    outputFlushTimer = setTimeout(() => { void flushOutputStreams(); }, 75);
  }
};

function resetOutputStreams() {
  clearTimeout(outputFlushTimer);
  outputFlushTimer = null;
  for (const stream of Object.values(outputStreams)) {
    stream.text = '';
    stream.dropped = 0;
  }
}

// === 이벤트 큐 (메인 스레드 → Python) ===
const _eventQueue = [];
const _widgetValues = {};   // { widgetId: latestValue }
let _mouseState = { pos: [0, 0, 0], pick: null };
let _cameraStateJson = null; // 메인 스레드가 보내는 카메라 상태 (scene.camera.pos 등 읽기용)
let _pressedKeysJson = '[]';  // 현재 눌려있는 키 목록 (JSON 직렬화)

self._popEvent = () => {
  return _eventQueue.length > 0 ? _eventQueue.shift() : null;
};
self._getMousePos = () => _mouseState.pos;
self._getMousePick = () => _mouseState.pick;
self._getCameraState = () => _cameraStateJson;
self._getWidgetValue = (id) => _widgetValues[id] ?? null;
self._getPressedKeys = () => _pressedKeysJson;
self._getCurrentRunId = () => currentRunId;

function sendRunMessage(runId, type, payload = {}) {
  self.postMessage({ type, runId, ...payload });
}

function sendProgress(percent, message) {
  self.postMessage({ type: 'progress', percent, message });
}

function clearInputQueues() {
  _eventQueue.length = 0;
  for (const key of Object.keys(_widgetValues)) delete _widgetValues[key];
}

async function flushOutputStreams(runId = currentRunId) {
  clearTimeout(outputFlushTimer);
  outputFlushTimer = null;
  for (const [kind, stream] of Object.entries(outputStreams)) {
    if (stream.text) sendRunMessage(runId, kind, { text: stream.text.replace(/\n$/, '') });
    if (stream.dropped) sendRunMessage(runId, kind, { text: '출력이 너무 많아 일부를 생략했습니다.' });
    stream.text = '';
    stream.dropped = 0;
  }
}

async function dispatchQueuedEvents() {
  if (!pyodide || isRunningCode || isDispatchingEvents || _eventQueue.length === 0) return;
  isDispatchingEvents = true;
  shouldStop = false;
  sendRunMessage(currentRunId, 'event_start');
  try {
    await pyodide.runPythonAsync(`
_process_pending_events()
_send_commands()
`);
    await flushOutputStreams();
    sendRunMessage(currentRunId, 'event_done');
  } catch (err) {
    await flushOutputStreams();
    const msg = err.message || String(err);
    if (shouldStop || msg.includes('_StopExecution') || msg.includes('실행이 중지되었습니다')) {
      sendRunMessage(currentRunId, 'event_done', { stopped: true });
      clearInputQueues();
    } else {
      sendRunMessage(currentRunId, 'error', { error: formatPythonError(msg), raw: msg });
    }
  } finally {
    isDispatchingEvents = false;
    if (_eventQueue.length > 0) {
      await dispatchQueuedEvents();
    }
  }
}

/**
 * Pyodide JS 스크립트를 importScripts로 로드 — CDN 순회 + 재시도 (3회)
 * 한 CDN이 일시 장애여도 다른 CDN으로 자동 전환.
 */
function importPyodideScript() {
  const errors = [];
  for (const cdn of PYODIDE_CDNS) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        importScripts(`${cdn}pyodide.js`);
        PYODIDE_CDN = cdn;  // 성공한 CDN을 indexURL로도 사용
        return cdn;
      } catch (e) {
        const message = e.message || String(e);
        errors.push(`${cdn} attempt ${attempt + 1}: ${message}`);
        // CSP가 막은 fallback은 재시도해도 성공하지 않으므로 같은 CDN 반복을 멈춥니다.
        if (/Content Security Policy|violates.*directive|blocked by CSP/i.test(message)) break;
      }
    }
  }
  throw new Error(`Pyodide CDN 로드 실패: 학교/회사 네트워크가 CDN을 막았거나 일시 장애가 있습니다. 새로고침 후 다시 실행해 주세요. (${errors.slice(-2).join(' | ')})`);
}

/**
 * Pyodide 초기화
 */
async function initPyodide() {
  try {
    sendProgress(10, 'Pyodide 다운로드 중...');

    // 1. Pyodide JS 로드 — CDN 순회 + 재시도
    importPyodideScript();

    sendProgress(40, 'Python 엔진 초기화 중...');

    // 2. Pyodide WASM 로드 (fetch 필요) — JS 로드에 성공한 CDN 사용
    pyodide = await self.loadPyodide({
      indexURL: PYODIDE_CDN,
    });

    sendProgress(70, 'VPython API 준비 중...');

    // 3. VPython API를 'vpython' 모듈로 등록 (한 번만)
    if (vpythonApiCode) {
      // vpython-api.py 코드를 실행하여 전역에 로드
      await pyodide.runPythonAsync(vpythonApiCode);
      // 'vpython' 모듈로 등록 — from vpython import * 가 동작하도록
      await pyodide.runPythonAsync(`
import sys
import types
vpython_module = types.ModuleType('vpython')
# 현재 전역에 정의된 VPython 클래스/함수를 모듈에 복사
_vpython_names = [
    'vector', 'vec', 'color', '\uc0c9\uc0c1', 'textures', '\ud14d\uc2a4\ucc98',
    'sphere', 'box', 'cylinder', 'arrow', 'cone', 'ring', 'compound',
    'pyramid', 'ellipsoid', 'helix', 'label', 'text', 'curve', 'points', 'frame',
    'vertex', 'triangle', 'quad', 'extrusion',
    'graph', 'gcurve', 'gdots', 'gvbars', 'ghbars',
    'slider', 'button', 'checkbox', 'radio', 'menu', 'winput',
    'scene', 'keysdown',
    'local_light', 'distant_light', 'attach_arrow',
    'rate', 'sleep', 'scene_background',
    'mag', 'mag2', 'hat', 'dot', 'cross', 'norm',
    'play_sound', 'play_note', 'play_chord', 'play_sequence',
    'play_sfx', 'start_bgm', 'stop_bgm', 'note',
    'sound', 'sfx', 'bgm', 'chord',
    '\uc18c\ub9ac', '\uc74c\ud45c', '\ud6a8\uacfc\uc74c', '\ubc30\uacbd\uc74c\uc545', '\ubc30\uacbd\uc74c\uc545\uc815\uc9c0', '\ud654\uc74c',
    'NamedList',
    '\uc74c\uacc4', 'scale', '\ub192\uc740\uc74c\uacc4', 'high_scale', '\ub0ae\uc740\uc74c\uacc4', 'low_scale',
    '\ubb34\uc9c0\uac1c', 'rainbow', '\ub530\ub73b\ud55c\uc0c9', 'warm_colors', '\ucc28\uac00\uc6b4\uc0c9', 'cool_colors',
    '\uae30\ubcf8\uc0c9', 'basic_colors', '\ud30c\uc2a4\ud154', 'pastel_colors',
    'play_instrument', '\uc545\uae30',
    'scatter3d', 'surface3d', 'line3d', 'bar3d',
    '\uc0b0\uc810\ub3c4', '\ud45c\uba74\uadf8\ub798\ud504', '\uc120\uadf8\ub798\ud504', '\ub9c9\ub300\uadf8\ub798\ud504',
]
for _name in _vpython_names:
    if _name in dir():
        setattr(vpython_module, _name, eval(_name))
sys.modules['vpython'] = vpython_module
`);
      // vpython API 로딩 완료
    }

    sendProgress(85, '보안 샌드박스 설정 중...');

    // 4. pyodide.http 모듈 차단
    await pyodide.runPythonAsync(`
import sys
if 'pyodide' in sys.modules:
    if hasattr(sys.modules['pyodide'], 'http'):
        delattr(sys.modules['pyodide'], 'http')
`);

    // 5. === 보안: 위험 API 삭제 (Pyodide 로딩 완료 후!) ===
    // 상속된 API도 가리도록 값을 고정합니다. delete만 하면 프로토타입의 API가 남습니다.
    for (const name of ['fetch', 'XMLHttpRequest', 'WebSocket', 'indexedDB', 'importScripts', 'Worker', 'SharedWorker', 'EventSource']) {
      Object.defineProperty(self, name, { value: undefined, configurable: false, writable: false });
    }
    if (self.navigator) {
      delete self.navigator.sendBeacon;
    }

    sendProgress(100, '준비 완료!');
    self.postMessage({ type: 'ready' });
  } catch (err) {
    self.postMessage({
      type: 'error',
      error: `Pyodide 초기화 실패: ${err.message}`,
    });
  }
}

/**
 * 코드에서 import 문을 분석하여 설치 필요한 외부 패키지 목록 반환
 * 표준 라이브러리(math, random, json 등)는 제외
 */
const STDLIB_MODULES = new Set([
  'sys', 'os', 'io', 'json', 'math', 'random', 'time', 'datetime',
  'collections', 'itertools', 'functools', 'operator', 'string',
  're', 'copy', 'types', 'typing', 'abc', 'enum', 'dataclasses',
  'decimal', 'fractions', 'statistics', 'cmath',
  'asyncio', 'concurrent', 'threading',
  'pathlib', 'glob', 'fnmatch',
  'csv', 'textwrap', 'difflib',
  'struct', 'codecs', 'unicodedata',
  'html', 'xml', 'base64', 'binascii', 'hashlib', 'hmac',
  'pprint', 'reprlib', 'traceback', 'warnings', 'logging',
  'unittest', 'doctest',
  // VPython 내장 모듈은 제외
  'vpython', 'js',
]);

// Pyodide에서 micropip으로 설치 가능한 패키지
const INSTALLABLE_PACKAGES = {
  'numpy': 'numpy',
  'np': 'numpy',
  'matplotlib': 'matplotlib',
  'pandas': 'pandas',
  'pd': 'pandas',
  'scipy': 'scipy',
  'sklearn': 'scikit-learn',
  'sympy': 'sympy',
};

// 이미 설치한 패키지 캐시
const installedPackages = new Set();

function detectRequiredPackages(code) {
  const needed = new Set();
  const lines = code.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    // import numpy / import numpy as np
    let match = trimmed.match(/^import\s+(\w+)/);
    if (match) {
      const mod = match[1];
      if (!STDLIB_MODULES.has(mod) && INSTALLABLE_PACKAGES[mod]) {
        needed.add(INSTALLABLE_PACKAGES[mod]);
      }
    }
    // from numpy import ... / from matplotlib.pyplot import ...
    match = trimmed.match(/^from\s+(\w+)/);
    if (match) {
      const mod = match[1];
      if (!STDLIB_MODULES.has(mod) && INSTALLABLE_PACKAGES[mod]) {
        needed.add(INSTALLABLE_PACKAGES[mod]);
      }
    }
  }

  // 이미 설치된 것은 제외
  return [...needed].filter(pkg => !installedPackages.has(pkg));
}

/**
 * Python 코드 실행
 */
async function runCode(code, runId = currentRunId + 1) {
  if (!pyodide) {
    sendRunMessage(runId, 'error', { error: 'Python 엔진이 아직 준비되지 않았습니다.' });
    return;
  }

  if (isRunningCode) {
    queuedRun = { code, runId };
    shouldStop = true;
    return;
  }

  try {
    currentRunId = runId;
    isRunningCode = true;
    resetOutputStreams();
    // 중단 플래그 리셋
    shouldStop = false;
    clearInputQueues();

    // Python에서 중단 신호를 확인할 수 있도록 JS 함수 노출
    self._checkStopSignal = () => shouldStop;

    // 필요한 패키지 자동 설치
    const packages = detectRequiredPackages(code);
    if (packages.length > 0) {
      // micropip 지연 로딩 (첫 사용 시에만)
      if (!micropipLoaded) {
        sendRunMessage(runId, 'stdout', { text: '📦 패키지 관리자 준비 중...' });
        await pyodide.loadPackage('micropip');
        micropipLoaded = true;
      }
      sendRunMessage(runId, 'stdout', { text: `📦 ${packages.join(', ')} 설치 중...` });
      await pyodide.runPythonAsync(`
import micropip
await micropip.install(${JSON.stringify(packages)})
`);
      for (const pkg of packages) {
        installedPackages.add(pkg);
      }
      sendRunMessage(runId, 'stdout', { text: `✅ ${packages.join(', ')} 설치 완료!` });
    }

    // Python 문자열 버퍼에 무제한 축적하지 않고 제한된 JS 버퍼로 보냅니다.
    await pyodide.runPythonAsync(`
import sys
class _VPLBoundedOutput:
    encoding = 'utf-8'
    def __init__(self, kind):
        self.kind = kind
    def write(self, text):
        text = str(text)
        js._queueOutput(self.kind, text)
        return len(text)
    def flush(self):
        pass
    def isatty(self):
        return False
sys.stdout = _VPLBoundedOutput('stdout')
sys.stderr = _VPLBoundedOutput('stderr')
`);

    // 이전 실행에서 남은 Python 측 객체/핸들러를 정리
    await pyodide.runPythonAsync('_reset_runtime_state()');

    // 학생 코드 실행 전 heartbeat — 모바일에서 초기화 지연으로 인한 타임아웃 방지
    sendRunMessage(runId, 'batch', { commands: [] });

    // 학생 코드 실행
    await pyodide.runPythonAsync(code);

    // 실행 후 남은 커맨드 버퍼 플러시
    await pyodide.runPythonAsync('_send_commands()');

    // 남은 출력을 묶어서 전송한 뒤 버퍼를 비웁니다.
    await flushOutputStreams(runId);

    isRunningCode = false;
    sendRunMessage(runId, 'done');
  } catch (err) {
    await flushOutputStreams(runId);
    const msg = err.message || String(err);
    // 사용자 중지로 인한 예외는 에러가 아닌 정상 종료로 처리
    // shouldStop 플래그 또는 예외 메시지로 판별
    if (shouldStop || msg.includes('_StopExecution') || msg.includes('실행이 중지되었습니다')) {
      shouldStop = false;
      isRunningCode = false;
      sendRunMessage(runId, 'done');
      if (queuedRun) {
        const next = queuedRun;
        queuedRun = null;
        await runCode(next.code, next.runId);
      }
      return;
    }
    const errorMsg = formatPythonError(msg);
    isRunningCode = false;
    sendRunMessage(runId, 'error', { error: errorMsg, raw: msg });
  }

  if (queuedRun) {
    const next = queuedRun;
    queuedRun = null;
    await runCode(next.code, next.runId);
  }
}

/**
 * Python 에러 메시지를 사용자 친화적으로 포맷
 */
function formatPythonError(msg) {
  const lines = msg.split('\n').filter(l => l.trim());
  // 마지막 Error 라인 찾기
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].includes('Error') || lines[i].includes('Exception')) {
      return lines[i].trim();
    }
  }
  return lines[lines.length - 1]?.trim() || msg;
}

// === 메시지 핸들러 ===
self.onmessage = async (event) => {
  const { type, code, vpythonApi } = event.data;

  switch (type) {
    case 'init':
      if (vpythonApi) vpythonApiCode = vpythonApi;
      await initPyodide();
      break;

    case 'run':
      await runCode(code, event.data.runId);
      break;

    case 'stop':
      // 소프트 스톱 — rate()에서 플래그 확인 후 Python 예외 발생
      shouldStop = true;
      break;

    case 'event':
      // 메인 스레드의 사용자 입력 이벤트 — 큐에 적재하면 rate()에서 디스패치
      if (event.data.payload) {
        try {
          _eventQueue.push(JSON.stringify(event.data.payload));
        } catch { /* 직렬화 실패 시 무시 */ }
      }
      await dispatchQueuedEvents();
      break;

    case 'widget_value':
      // 위젯 값 동기화
      if (event.data.id !== undefined) {
        _widgetValues[event.data.id] = event.data.value;
      }
      break;

    case 'mouse':
      // 마우스 좌표/픽 객체 갱신
      if (Array.isArray(event.data.pos)) _mouseState.pos = event.data.pos;
      if ('pick' in event.data) _mouseState.pick = event.data.pick;
      break;

    case 'camera':
      // 카메라 위치·중심·방향·range — scene.camera.pos 등 폴링용
      try { _cameraStateJson = JSON.stringify(event.data.state); }
      catch { _cameraStateJson = null; }
      break;

    case 'keys':
      // 현재 눌려있는 키 목록 — keysdown() 폴링용
      if (Array.isArray(event.data.keys)) {
        try { _pressedKeysJson = JSON.stringify(event.data.keys); }
        catch { _pressedKeysJson = '[]'; }
      }
      break;

    default:
      // 무시
      break;
  }
};

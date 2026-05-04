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
const PYODIDE_CDN = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

let pyodide = null;
let vpythonApiCode = null;
let shouldStop = false;
let micropipLoaded = false;

// === 이벤트 큐 (메인 스레드 → Python) ===
const _eventQueue = [];
const _widgetValues = {};   // { widgetId: latestValue }
let _mouseState = { pos: [0, 0, 0], pick: null };
let _pressedKeysJson = '[]';  // 현재 눌려있는 키 목록 (JSON 직렬화)

self._popEvent = () => {
  return _eventQueue.length > 0 ? _eventQueue.shift() : null;
};
self._getMousePos = () => _mouseState.pos;
self._getMousePick = () => _mouseState.pick;
self._getWidgetValue = (id) => _widgetValues[id] ?? null;
self._getPressedKeys = () => _pressedKeysJson;

function sendProgress(percent, message) {
  self.postMessage({ type: 'progress', percent, message });
}

/**
 * Pyodide 초기화
 */
async function initPyodide() {
  try {
    sendProgress(10, 'Pyodide 다운로드 중...');

    // 1. Pyodide JS 로드 (importScripts 필요)
    importScripts(`${PYODIDE_CDN}pyodide.js`);

    sendProgress(40, 'Python 엔진 초기화 중...');

    // 2. Pyodide WASM 로드 (fetch 필요)
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
    'vector', 'vec', 'color', '\uc0c9\uc0c1', 'sphere', 'box', 'cylinder', 'arrow', 'cone', 'ring', 'compound',
    'pyramid', 'ellipsoid', 'helix', 'label', 'text', 'curve', 'points', 'frame',
    'vertex', 'triangle', 'quad', 'extrusion',
    'graph', 'gcurve', 'gdots', 'gvbars', 'ghbars',
    'slider', 'button', 'checkbox', 'radio', 'menu', 'winput',
    'scene', 'keysdown',
    'local_light', 'distant_light',
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
    delete self.fetch;
    delete self.XMLHttpRequest;
    delete self.WebSocket;
    delete self.indexedDB;
    delete self.importScripts;
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
async function runCode(code) {
  if (!pyodide) {
    self.postMessage({ type: 'error', error: 'Python 엔진이 아직 준비되지 않았습니다.' });
    return;
  }

  try {
    // 중단 플래그 리셋
    shouldStop = false;

    // Python에서 중단 신호를 확인할 수 있도록 JS 함수 노출
    self._checkStopSignal = () => shouldStop;

    // 필요한 패키지 자동 설치
    const packages = detectRequiredPackages(code);
    if (packages.length > 0) {
      // micropip 지연 로딩 (첫 사용 시에만)
      if (!micropipLoaded) {
        self.postMessage({ type: 'stdout', text: '📦 패키지 관리자 준비 중...' });
        await pyodide.loadPackage('micropip');
        micropipLoaded = true;
      }
      self.postMessage({ type: 'stdout', text: `📦 ${packages.join(', ')} 설치 중...` });
      await pyodide.runPythonAsync(`
import micropip
await micropip.install(${JSON.stringify(packages)})
`);
      for (const pkg of packages) {
        installedPackages.add(pkg);
      }
      self.postMessage({ type: 'stdout', text: `✅ ${packages.join(', ')} 설치 완료!` });
    }

    // stdout/stderr 리디렉션
    await pyodide.runPythonAsync(`
import sys
from io import StringIO
sys.stdout = StringIO()
sys.stderr = StringIO()
`);

    // 학생 코드 실행 전 heartbeat — 모바일에서 초기화 지연으로 인한 타임아웃 방지
    self.postMessage({ type: 'batch', commands: [] });

    // 학생 코드 실행
    await pyodide.runPythonAsync(code);

    // 실행 후 남은 커맨드 버퍼 플러시
    await pyodide.runPythonAsync('_send_commands()');

    // 출력 캡처 — 줄 단위로 분리하여 전송
    const stdout = await pyodide.runPythonAsync('sys.stdout.getvalue()');
    const stderr = await pyodide.runPythonAsync('sys.stderr.getvalue()');

    if (stdout) {
      const lines = stdout.split('\n');
      // 마지막 빈 줄 제거 (trailing newline)
      if (lines.length > 0 && lines[lines.length - 1] === '') {
        lines.pop();
      }
      for (const line of lines) {
        self.postMessage({ type: 'stdout', text: line });
      }
    }
    if (stderr) {
      const lines = stderr.split('\n');
      if (lines.length > 0 && lines[lines.length - 1] === '') {
        lines.pop();
      }
      for (const line of lines) {
        self.postMessage({ type: 'stderr', text: line });
      }
    }

    self.postMessage({ type: 'done' });
  } catch (err) {
    const msg = err.message || String(err);
    // 사용자 중지로 인한 예외는 에러가 아닌 정상 종료로 처리
    // shouldStop 플래그 또는 예외 메시지로 판별
    if (shouldStop || msg.includes('_StopExecution') || msg.includes('실행이 중지되었습니다')) {
      shouldStop = false;
      self.postMessage({ type: 'done' });
      return;
    }
    const errorMsg = formatPythonError(msg);
    self.postMessage({ type: 'error', error: errorMsg, raw: msg });
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
      await runCode(code);
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

import { runInContext, runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';
import source from './pyodide-worker.js?raw';
import { translateSystemMessage } from '../i18n/ui-text';

// 실제 Worker 스크립트를 격리된 문맥에서 실행해, 최상위 함수(import 감지)를 직접 부릅니다.
function createContext() {
  const globals = new Map();
  const python = {
    runPythonAsync: vi.fn(async () => {}),
    loadPackage: vi.fn(async () => {}),
    globals: { set: vi.fn((key, value) => globals.set(key, value)), get: (key) => globals.get(key) },
  };
  const self = Object.create({ fetch: vi.fn(), WebSocket: vi.fn(), indexedDB: {}, caches: {} });
  self.postMessage = vi.fn();
  self.loadPyodide = vi.fn(async () => python);
  const context = { self, importScripts: vi.fn(), setTimeout, clearTimeout, URL };
  runInNewContext(source, context);
  return { context, self, python, globals };
}

const systemTexts = (self) => self.postMessage.mock.calls
  .map(([message]) => message)
  .filter((message) => message.type === 'stdout' && message.system)
  .map((message) => message.text);

describe('import 감지 (detectImportedModules)', () => {
  const { context } = createContext();
  const detect = (code) => [...context.detectImportedModules(code)];

  it('import·from·점 이름·여러 개·별칭을 최상위 이름으로 모은다', () => {
    expect(detect('import qrcode\nimport numpy as np, segno\nfrom matplotlib.pyplot import plot\nimport a.b.c as d'))
      .toEqual(['qrcode', 'numpy', 'segno', 'matplotlib', 'a']);
  });

  it('주석과 문자열 안의 import는 무시한다', () => {
    const code = [
      '# import fakeone',
      'x = "import faketwo"',
      "y = '''",
      'import fakethree',
      "'''",
      'print("from fakefour import z")  # from fakefive import w',
      'import real',
    ].join('\n');
    expect(detect(code)).toEqual(['real']);
  });

  it('상대 import는 설치 대상이 아니다', () => {
    expect(detect('from . import helper\nfrom .utils import f\nfrom ..pkg import g')).toEqual([]);
  });

  it('들여쓰기·세미콜론·괄호와 역슬래시 줄 이음·같은 줄 try 블록도 읽는다', () => {
    const code = 'def f():\n    import inner\nx = 1; import semi\nfrom paren import (\n    a,\n    b,\n)\nimport \\\n    slash\ntry: import trial\nexcept ImportError: pass';
    expect(detect(code)).toEqual(['inner', 'semi', 'paren', 'slash', 'trial']);
  });

  it('import가 들어간 다른 이름(important, imports)은 import 문으로 보지 않는다', () => {
    expect(detect('important = 1\nimports = []\nfromage = 2')).toEqual([]);
  });
});

describe('설치 후보 (detectImportCandidates)', () => {
  const { context } = createContext();
  const required = (code) => context.detectImportCandidates(code).map((item) => item.package);

  it('표준 라이브러리와 VPyLab 내장 모듈은 설치하지 않는다', () => {
    expect(required('import math, random, heapq\nfrom vpython import *\nimport js\nfrom collections import deque')).toEqual([]);
  });

  it('허용 목록에 없던 패키지도 import 이름으로 설치를 시도한다', () => {
    expect(required('import qrcode\nimport segno')).toEqual(['qrcode', 'segno']);
  });

  it('import 이름과 설치 이름이 다르면 대응표를 쓴다', () => {
    expect(required('import sklearn\nfrom PIL import Image\nimport yaml\nimport bs4')).toEqual(['scikit-learn', 'Pillow', 'PyYAML', 'beautifulsoup4']);
  });

  it('표준 모듈과 한 글자 다른 이름은 철자 실수로 보고 설치하지 않는다', () => {
    expect(required('import maths\nimport randon\nimport numpi\nimport jsonn')).toEqual([]);
  });
});

describe('실행 중 설치 흐름', () => {
  async function initialised() {
    const created = createContext();
    await created.self.onmessage({ data: { type: 'init', vpythonApi: '# API' } });
    created.self.postMessage.mockClear();
    return created;
  }

  it('이미 import할 수 있는 모듈이면 패키지 관리자를 받지 않는다', async () => {
    const { self, python } = await initialised();
    python.runPythonAsync.mockImplementation(async (code) => (code.includes('_vpylab_missing_modules(') ? '[]' : undefined));
    await self.onmessage({ data: { type: 'run', runId: 1, code: 'import qrcode\nprint(1)' } });
    expect(python.loadPackage).not.toHaveBeenCalled();
    expect(self.postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'done', runId: 1 }));
  });

  it('설치 실패는 안내만 하고 학생 코드는 그대로 실행한다', async () => {
    const { self, python, globals } = await initialised();
    const ran = [];
    python.runPythonAsync.mockImplementation(async (code) => {
      if (code.includes('_vpylab_missing_modules(')) return globals.get('__vpylab_import_names__');
      if (code.includes('_vpylab_install_packages(')) return JSON.stringify({ segno: null, pygame: 'nowheel', nosuchpkg: 'notfound' });
      if (code.includes('_vpylab_run(')) ran.push(globals.get('__vpylab_source__'));
      return undefined;
    });
    const code = 'import segno\nimport pygame\nimport nosuchpkg';
    await self.onmessage({ data: { type: 'run', runId: 2, code } });
    expect(python.globals.set).toHaveBeenCalledWith('__vpylab_install_names__', JSON.stringify(['segno', 'pygame', 'nosuchpkg']));
    const texts = systemTexts(self);
    expect(texts).toContain('✅ segno 설치 완료!');
    expect(texts.some((text) => text.startsWith('⚠️ pygame:') && text.includes('Pyodide'))).toBe(true);
    expect(texts.some((text) => text.startsWith('⚠️ nosuchpkg:') && text.includes('찾지 못했습니다'))).toBe(true);
    expect(ran).toEqual([code]);

    // 성공한 패키지만 기억해, 다음 실행에서는 실패한 것만 다시 시도합니다.
    python.globals.set.mockClear();
    await self.onmessage({ data: { type: 'run', runId: 3, code } });
    expect(python.globals.set).toHaveBeenCalledWith('__vpylab_import_names__', JSON.stringify(['pygame', 'nosuchpkg']));
  });

  it('Pyodide 배포판에 든 패키지는 먼저 배포판에서 불러오고, 남은 것만 micropip으로 설치한다', async () => {
    const { self, python, globals } = await initialised();
    const loaded = new Set();
    python.loadPackagesFromImports = vi.fn(async (code) => {
      // 배포판에는 pygame(→ pygame-ce)만 있다고 가정합니다.
      if (code.includes('import pygame')) loaded.add('pygame');
      await expect(self.fetch('https://cdn.jsdelivr.net/pyodide/v0.27.0/full/pygame_ce.whl')).resolves.toBeUndefined();
    });
    python.runPythonAsync.mockImplementation(async (code) => {
      if (code.includes('_vpylab_missing_modules(')) {
        return JSON.stringify(JSON.parse(globals.get('__vpylab_import_names__')).filter((name) => !loaded.has(name)));
      }
      if (code.includes('_vpylab_install_packages(')) {
        return JSON.stringify(Object.fromEntries(JSON.parse(globals.get('__vpylab_install_names__')).map((pkg) => [pkg, null])));
      }
      return undefined;
    });
    await self.onmessage({ data: { type: 'run', runId: 5, code: 'import pygame\nimport segno' } });
    expect(python.loadPackagesFromImports.mock.calls[0][0]).toBe('import pygame\nimport segno');
    expect(python.loadPackage).toHaveBeenCalledWith('micropip');
    expect(globals.get('__vpylab_install_names__')).toBe(JSON.stringify(['segno']));
    expect(systemTexts(self)).toContain('✅ pygame, segno 설치 완료!');
  });

  it('패키지 관리자를 받지 못해도 실행은 이어 가고 안내를 남긴다', async () => {
    const { self, python, globals } = await initialised();
    python.loadPackage.mockRejectedValue(new Error('offline'));
    const ran = [];
    python.runPythonAsync.mockImplementation(async (code) => {
      if (code.includes('_vpylab_run(')) ran.push(globals.get('__vpylab_source__'));
      return undefined;
    });
    await self.onmessage({ data: { type: 'run', runId: 4, code: 'import qrcode' } });
    expect(systemTexts(self).some((text) => text.startsWith('⚠️ qrcode:') && text.includes('인터넷'))).toBe(true);
    expect(ran).toEqual(['import qrcode']);
    await expect(self.fetch('https://pypi.org/simple/qrcode/')).rejects.toThrow('네트워크 요청');
  });
});

describe('설치 안내 문구', () => {
  it('실패 안내는 모두 영어 번역이 있다', () => {
    const { context } = createContext();
    const templates = Object.values(runInContext('INSTALL_FAILURE_MESSAGES', context));
    expect(templates).toHaveLength(3);
    for (const template of templates) {
      const text = template.replace('{0}', 'qrcode');
      const english = translateSystemMessage('en', text);
      expect(english, text).not.toBe(text);
      expect(english.startsWith('⚠️ qrcode:')).toBe(true);
    }
  });
});

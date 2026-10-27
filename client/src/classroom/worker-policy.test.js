// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createServer } from 'vite';
import classroomConfig from '../../vite.classroom.config.js';
import { CLASSROOM_CSP, WORKER_CSP, isPythonWorkerRequest, workerPolicyMiddleware } from './worker-policy';

function directives(policy) {
  return Object.fromEntries(policy.split(';').map((entry) => entry.trim().split(/\s+/)).filter(([name]) => name).map(([name, ...sources]) => [name, sources]));
}

const template = JSON.parse(readFileSync(resolve('vercel.classroom.json'), 'utf8'));

describe('Python Worker의 독립적인 응답 보안 정책', () => {
  it('런타임 다운로드 출처만 연결을 허용하고 같은 출처 API와 하위 Worker를 차단한다', () => {
    const policy = directives(WORKER_CSP);
    expect(policy['default-src']).toEqual(["'none'"]);
    expect(policy['connect-src']).toEqual(['https://cdn.jsdelivr.net', 'https://unpkg.com', 'https://pypi.org', 'https://files.pythonhosted.org']);
    expect(policy['connect-src']).not.toContain("'self'");
    expect(policy['worker-src']).toEqual(["'none'"]);
    expect(policy['child-src']).toEqual(["'none'"]);
    expect(policy['script-src']).toEqual(expect.arrayContaining(["'unsafe-eval'", "'wasm-unsafe-eval'", 'https://cdn.jsdelivr.net', 'https://unpkg.com']));
  });

  it('Vite Worker query와 배포 해시 파일을 인식하되 메인 앱과 다른 Worker에는 적용하지 않는다', () => {
    for (const url of ['/src/engine/pyodide-worker.js?worker_file&type=classic', '/src/engine/pyodide-worker.js?worker', '/assets/pyodide-worker-CtSakRF1.js', '/assets/pyodide-worker-a_b-123.js?x=1', '/src/engine/%70yodide-worker.js?worker_file&type=classic', '/@fs/Users/example/client/src/engine/pyodide-worker.js?worker_file&type=classic']) expect(isPythonWorkerRequest(url), url).toBe(true);
    for (const url of ['/classroom.html', '/api/v2/projects', '/assets/editor.worker-Dpt_xPrs.js', '/assets/pyodide-worker-CtSakRF1.js.map', '/assets/pyodide-worker-CtSakRF1.js/extra', '/src/engine/pyodide-worker.js.backup', '/%invalid']) expect(isPythonWorkerRequest(url), url).toBe(false);
  });

  it('개발 및 preview 응답에 강제 CSP·nosniff를 넣고 기존 캐시 사용을 막는다', () => {
    const response = { setHeader: vi.fn() }; const next = vi.fn();
    workerPolicyMiddleware({ url: '/src/engine/pyodide-worker.js?worker_file&type=classic' }, response, next);
    expect(response.setHeader).toHaveBeenCalledWith('Content-Security-Policy', WORKER_CSP);
    expect(response.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
    expect(response.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
    expect(next).toHaveBeenCalledOnce();
    const plugin = classroomConfig.plugins.find((item) => item.name === 'classroom-python-worker-policy');
    expect(plugin.configureServer).toBe(plugin.configurePreviewServer);
  });

  it('Vercel 템플릿은 Worker와 메인 앱 정책을 겹치지 않게 분리한다', () => {
    const worker = template.headers.find((rule) => rule.source === '/assets/pyodide-worker-:hash.js');
    const main = template.headers.find((rule) => rule !== worker);
    const workerHeaders = Object.fromEntries(worker.headers.map(({ key, value }) => [key, value]));
    const mainHeaders = Object.fromEntries(main.headers.map(({ key, value }) => [key, value]));
    expect(workerHeaders['Content-Security-Policy']).toBe(WORKER_CSP);
    expect(mainHeaders['Content-Security-Policy']).toBe(CLASSROOM_CSP);
    expect(directives(CLASSROOM_CSP)['connect-src']).toContain("'self'");
    expect(directives(CLASSROOM_CSP)['worker-src']).toContain("'self'");
    const mainPath = new RegExp(`^${main.source}$`);
    expect(mainPath.test('/assets/pyodide-worker-CtSakRF1.js')).toBe(false);
    for (const path of ['/classroom.html', '/', '/assets/editor.worker-Dpt_xPrs.js', '/api/v2/projects']) expect(mainPath.test(path), path).toBe(true);
    expect(template.outputDirectory).toBe('dist-classroom');
  });
});

describe('실제 로컬 Vite 서버의 Worker 응답', () => {
  let server;
  let origin;
  beforeAll(async () => {
    server = await createServer({
      ...classroomConfig, configFile: false, logLevel: 'silent',
      server: { ...classroomConfig.server, port: 0, strictPort: false, hmr: false, proxy: undefined, watch: null },
    });
    await server.listen();
    origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  }, 20_000);
  afterAll(async () => { await server?.close(); });

  it('브라우저가 실제 요청하는 classic Worker URL에 정책을 전달한다', async () => {
    const response = await fetch(`${origin}/src/engine/pyodide-worker.js?worker_file&type=classic`);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-security-policy')).toBe(WORKER_CSP);
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(await response.text()).toContain('PYODIDE_VERSION');
  });

  it('개발 메인 HTML은 HMR을 유지하고 Worker와 같은 제한을 받지 않는다', async () => {
    const response = await fetch(`${origin}/classroom.html`);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-security-policy')).toBeNull();
    expect(await response.text()).toContain('/@vite/client');
  });
});

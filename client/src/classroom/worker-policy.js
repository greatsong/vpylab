/**
 * 학생 Python은 API를 지운 것만으로 격리되지 않습니다.
 * Worker 스크립트 자체의 응답 헤더로 통신과 하위 Worker를 제한합니다.
 * connect-src의 'self'는 같은 출처 /pyodide/ 핵심 파일을 받기 위한 것입니다.
 */
export const WORKER_CSP = "default-src 'none'; connect-src 'self' https://cdn.jsdelivr.net https://unpkg.com https://pypi.org https://files.pythonhosted.org; script-src 'self' 'unsafe-eval' 'wasm-unsafe-eval' https://cdn.jsdelivr.net https://unpkg.com; worker-src 'none'; child-src 'none'; object-src 'none'; base-uri 'none'";

export const CLASSROOM_CSP = "default-src 'self'; script-src 'self' 'unsafe-eval' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net https://api.fontshare.com; font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net https://cdn.fontshare.com; connect-src 'self' https://*.supabase.co wss://*.supabase.co; img-src 'self' blob: data: https://*.githubusercontent.com https://*.googleusercontent.com; media-src 'self' blob: data:; worker-src 'self' blob:; frame-src 'none'; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'";

export function isPythonWorkerRequest(requestUrl) {
  try {
    const path = decodeURIComponent(new URL(requestUrl, 'http://classroom.invalid').pathname);
    return /^\/src\/engine\/pyodide-worker\.js$/i.test(path)
      || /^\/assets\/pyodide-worker-[a-z0-9_-]+\.js$/i.test(path)
      || /^\/@fs\/.*\/client\/src\/engine\/pyodide-worker\.js$/i.test(path);
  } catch { return false; }
}

export function workerPolicyMiddleware(request, response, next) {
  if (isPythonWorkerRequest(request.url || '')) {
    response.setHeader('Content-Security-Policy', WORKER_CSP);
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Cache-Control', 'no-store');
  }
  next();
}

export function classroomWorkerPolicy() {
  const configure = (server) => { server.middlewares.use(workerPolicyMiddleware); };
  return {
    name: 'classroom-python-worker-policy',
    enforce: 'pre',
    configureServer: configure,
    configurePreviewServer: configure,
  };
}

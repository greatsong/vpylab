/**
 * VPyLab — 교실 LAN 서버
 *
 * 교사 맥북이 같은 교실 와이파이 안에서 빌드된 앱과 Pyodide 핵심 파일을 직접 제공합니다.
 * Pyodide(Python)는 각 학생의 브라우저에서 실행되고, 이 서버는 파일만 보냅니다.
 *
 * - http 출처이므로 Service Worker는 쓰지 않고 HTTP 캐시(해시 산출물·/pyodide/ 1년 immutable)에 맡깁니다.
 * - 로그인·갤러리·GitHub 연동 API는 제공하지 않습니다. /api/*는 503과 안내 문구로 답합니다.
 * - helmet의 CSP는 운영 vercel.json과 같은 수준으로 두되, Pyodide·WASM·Worker에 필요한 항목만 허용합니다.
 */
import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { join } from 'node:path';
import express from 'express';
import helmet from 'helmet';

export const LAN_DEFAULT_PORT = 4077;

const LAN_CSP = [
  "default-src 'self'",
  // Pyodide는 eval·WASM 컴파일이 필요하고 Monaco·Three.js는 blob: Worker를 씁니다.
  "script-src 'self' 'unsafe-eval' 'wasm-unsafe-eval' blob:",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  // 인터넷이 함께 있을 때만 선택 패키지(numpy 등)를 CDN에서 받습니다.
  "connect-src 'self' https://cdn.jsdelivr.net https://unpkg.com https://pypi.org https://files.pythonhosted.org",
  "img-src 'self' blob: data:",
  "media-src 'self' blob: data:",
  "worker-src 'self' blob:",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
].join('; ');

export function createLanApp({ distDir, appShell = 'index.html' }) {
  if (!existsSync(join(distDir, appShell))) {
    throw new Error(`빌드 산출물이 없습니다: ${join(distDir, appShell)} — 먼저 npm run classroom:lan 으로 빌드해주세요.`);
  }
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet({
    contentSecurityPolicy: { useDefaults: false, directives: parseCsp(LAN_CSP) },
    // http 교실망에는 HSTS·COEP를 걸지 않습니다(https가 아니라 무의미하고 다른 기기 접속을 방해할 수 있음).
    strictTransportSecurity: false,
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: { policy: 'same-origin' },
    // http 출처에서는 Origin-Agent-Cluster 헤더가 콘솔 경고만 남기므로 끕니다.
    originAgentCluster: false,
  }));

  // 서버 API는 교실 모드 범위 밖입니다. 클라이언트가 같은 출처로 보내면 안내 문구로 답합니다.
  app.all('/api/{*path}', (req, res) => {
    res.status(503).json({ error: '교실 모드에서는 저장·공유·GitHub 연동을 지원하지 않습니다. 코드는 파일로 내려받아 보관해주세요.', code: 'lan_mode_unavailable' });
  });

  const immutable = { maxAge: '1y', immutable: true, index: false, fallthrough: true };
  app.use('/assets', express.static(join(distDir, 'assets'), immutable));
  app.use('/pyodide', express.static(join(distDir, 'pyodide'), immutable));
  app.use(express.static(distDir, { index: false, maxAge: 0, cacheControl: true, etag: true }));

  // SPA 진입점: 경로가 무엇이든 앱 셸을 보냅니다. HTML은 항상 새로 받습니다.
  const shell = readFileSync(join(distDir, appShell));
  app.get('/{*path}', (req, res, next) => {
    if (req.path.startsWith('/assets/') || req.path.startsWith('/pyodide/')) return next();
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.type('html').send(shell);
  });
  app.use((req, res) => res.status(404).json({ error: '요청한 경로를 찾을 수 없습니다.' }));
  return app;
}

function parseCsp(value) {
  return Object.fromEntries(value.split(';').map((part) => part.trim()).filter(Boolean).map((part) => {
    const [name, ...sources] = part.split(/\s+/);
    return [name, sources];
  }));
}

/** 학생 기기가 접속할 수 있는 IPv4 주소 목록. 와이파이(en0) 같은 사설 주소를 앞에 둡니다. */
export function lanAddresses() {
  const found = [];
  for (const [name, entries] of Object.entries(networkInterfaces())) {
    for (const entry of entries || []) {
      if (entry.family !== 'IPv4' || entry.internal) continue;
      found.push({ name, address: entry.address });
    }
  }
  const score = ({ name, address }) => (address.startsWith('192.168.') ? 0 : address.startsWith('10.') ? 1 : /^172\.(1[6-9]|2\d|3[01])\./.test(address) ? 2 : 3) + (name === 'en0' ? 0 : 0.5);
  return found.sort((a, b) => score(a) - score(b));
}

export function startLanServer({ distDir, port = LAN_DEFAULT_PORT, host = '0.0.0.0', appShell } = {}) {
  const app = createLanApp({ distDir, appShell });
  const server = createServer(app);
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => resolve({ app, server, port: server.address().port, close: () => new Promise((done) => server.close(done)) }));
  });
}

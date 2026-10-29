import { defineConfig, mergeConfig } from 'vite';
import process from 'node:process';
import base from './vite.config.js';
import { classroomWorkerPolicy } from './src/classroom/worker-policy.js';
import { setServiceWorkerAppShell } from './scripts/service-worker-plugin.mjs';

// 기본 설정의 Service Worker는 index.html을 앱 셸로 삼으므로 교실 진입점으로 바꿉니다.
setServiceWorkerAppShell('classroom.html');

const previewPort = Number(process.env.CLASSROOM_PREVIEW_PORT || 4043);
const apiPort = Number(process.env.CLASSROOM_API_PORT || 4044);
if (![previewPort, apiPort].every((port) => Number.isSafeInteger(port) && port >= 1024 && port <= 65535)) throw new Error('로컬 교실 포트를 확인해주세요.');

// 승인 전 운영 앱의 진입점과 배포 산출물을 분리합니다.
export default mergeConfig(base, defineConfig({
  // 여러 로컬 교실을 함께 열어도 의존성 사전 번들 캐시가 서로 덮이지 않게 합니다.
  cacheDir: `node_modules/.vite-classroom-${previewPort}`,
  plugins: [classroomWorkerPolicy()],
  server: {
    host: '127.0.0.1',
    port: previewPort,
    strictPort: true,
    open: false,
    proxy: { '/api': { target: `http://127.0.0.1:${apiPort}`, changeOrigin: false } },
  },
  build: { outDir: 'dist-classroom', rollupOptions: { input: 'classroom.html' } },
}));

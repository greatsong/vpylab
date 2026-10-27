import { defineConfig, mergeConfig } from 'vite';
import process from 'node:process';
import base from './vite.config.js';
import { classroomWorkerPolicy } from './src/classroom/worker-policy.js';

const previewPort = Number(process.env.CLASSROOM_PREVIEW_PORT || 4043);
const apiPort = Number(process.env.CLASSROOM_API_PORT || 4044);
if (![previewPort, apiPort].every((port) => Number.isSafeInteger(port) && port >= 1024 && port <= 65535)) throw new Error('로컬 교실 포트를 확인해주세요.');

// 승인 전 운영 앱의 진입점과 배포 산출물을 분리합니다.
export default mergeConfig(base, defineConfig({
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

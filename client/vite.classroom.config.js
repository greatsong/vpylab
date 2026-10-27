import { defineConfig, mergeConfig } from 'vite';
import base from './vite.config.js';
import { classroomWorkerPolicy } from './src/classroom/worker-policy.js';

// 승인 전 운영 앱의 진입점과 배포 산출물을 분리합니다.
export default mergeConfig(base, defineConfig({
  plugins: [classroomWorkerPolicy()],
  server: {
    host: '127.0.0.1',
    port: 4043,
    strictPort: true,
    open: false,
    proxy: { '/api': { target: 'http://127.0.0.1:4044', changeOrigin: false } },
  },
  build: { outDir: 'dist-classroom', rollupOptions: { input: 'classroom.html' } },
}));

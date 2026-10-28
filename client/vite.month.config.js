import { defineConfig, mergeConfig } from 'vite';
import classroom from './vite.classroom.config.js';

// 완성 작품과 협력 교실을 같은 로컬 서버에서 확인합니다.
export default mergeConfig(classroom, defineConfig({
  // 검증 기록을 저장하는 동안 실행 중인 Python을 바꾸지 않습니다.
  server: { hmr: false },
  build: {
    outDir: 'dist-month-projects',
    rollupOptions: { input: ['month-projects.html', 'classroom.html'] },
  },
}));

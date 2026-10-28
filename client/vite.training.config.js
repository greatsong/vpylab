import { defineConfig, mergeConfig } from 'vite';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import base from './vite.config.js';
import { classroomWorkerPolicy } from './src/classroom/worker-policy.js';
import { projectDir } from '../scripts/project-paths.mjs';

const training = projectDir('vpylab-teacher-training');
const downloads = new Map([
  ['instructor-guide.pdf', 'application/pdf'], ['participant-workbook.pdf', 'application/pdf'],
  ['vpylab-teacher-training-kit.zip', 'application/zip'],
  ...['three-no-ai', 'three-ai'].flatMap(id => ['instructor', 'workbook'].map(kind => [`${id}-${kind}.pdf`, 'application/pdf'])),
]);
function trainingDownloads() {
  const install = server => { server.middlewares.use((req, res, next) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    if (!url.pathname.startsWith('/training-materials/')) return next();
    const name = url.pathname.slice('/training-materials/'.length);
    if (!['GET', 'HEAD'].includes(req.method) || !downloads.has(name)) { res.statusCode = 404; return res.end('자료를 찾을 수 없습니다.'); }
    const path = join(training, 'downloads', name);
    if (!existsSync(path)) { res.statusCode = 404; return res.end('자료를 준비하고 있습니다.'); }
    res.setHeader('Content-Type', downloads.get(name)); res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Disposition', `inline; filename="${name}"`);
    return res.end(req.method === 'HEAD' ? undefined : readFileSync(path));
  }); };
  return { name: 'teacher-training-downloads', configureServer: install, configurePreviewServer: install };
}
export default mergeConfig(base, defineConfig({
  plugins: [classroomWorkerPolicy(), trainingDownloads()],
  resolve: { alias: { '@teacher-training': training } },
  cacheDir: 'node_modules/.vite-teacher-training',
  server: { host: '127.0.0.1', port: 4093, strictPort: true, open: false, fs: { allow: [fileURLToPath(new URL('./', import.meta.url)), training] }, proxy: { '/api': { target: 'http://127.0.0.1:4094', changeOrigin: false } } },
  preview: { host: '127.0.0.1', port: 4093, strictPort: true, open: false, proxy: { '/api': { target: 'http://127.0.0.1:4094', changeOrigin: false } } },
  build: { outDir: 'dist-teacher-training', rollupOptions: { input: ['training.html', 'classroom.html'] } },
}));

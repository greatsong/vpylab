import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 4034;

// === 프록시 설정 (Railway/Render 등 리버스 프록시 뒤에서 req.ip 정확도 보장) ===
app.set('trust proxy', 1);

// === 보안 미들웨어 (CRITICAL — 보안 감사 결과 반영) ===
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:4033'],
}));
app.use(express.json({ limit: '1mb' }));

// === 라우트 ===
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '0.3.0',
  });
});

// GitHub Pages 발행 API
import publishRoutes from './routes/publish.js';
app.use('/api/publish', publishRoutes);

// 학생 제출 기록
// app.use('/api/submissions', require('./routes/submissions.js'));  // Step 7에서 활성화

// 코드 공유 (서버 경유 — 보안 감사 결과 반영)
import shareRoutes from './routes/share.js';
app.use('/api/share', shareRoutes);

// GitHub 동기화 (Phase 3 — 학생/팀 GitHub 레포에 매 저장 시점 commit)
import syncRoutes from './routes/sync.js';
app.use('/api/sync', syncRoutes);

// 프로젝트 = GitHub 레포 1:1 (Phase 4-A — 프로젝트 생성 + 자동 Pages + commit)
import projectsRoutes from './routes/projects.js';
app.use('/api/projects', projectsRoutes);

app.listen(PORT, () => {
  console.log(`[VPyLab] Express 서버 실행: http://localhost:${PORT}`);
});

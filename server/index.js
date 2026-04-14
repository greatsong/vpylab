import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 4034;

// === 보안 미들웨어 (CRITICAL — 보안 감사 결과 반영) ===
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:4033'],
}));
app.use(express.json({ limit: '100kb' }));

// AI 프록시 레이트 리밋 (학생당 분당 5회)
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: '잠시 후 다시 시도해주세요. (분당 5회 제한)' },
  standardHeaders: true,
  legacyHeaders: false,
});

// === 라우트 ===
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '0.1.0',
  });
});

// AI 힌트 프록시 (Solar Pro 3)
import aiRoutes from './routes/ai.js';
app.use('/api/ai', aiLimiter, aiRoutes);

// GitHub Pages 발행 API
import publishRoutes from './routes/publish.js';
app.use('/api/publish', publishRoutes);

// 학생 제출 기록
// app.use('/api/submissions', require('./routes/submissions.js'));  // Step 7에서 활성화

// 코드 공유
// app.use('/api/share', require('./routes/share.js'));  // Step 7에서 활성화

app.listen(PORT, () => {
  console.log(`[VPyLab] Express 서버 실행: http://localhost:${PORT}`);
});

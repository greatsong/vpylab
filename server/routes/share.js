/**
 * VPyLab — 코드 공유 API
 *
 * 보안: anon key로 직접 INSERT 불가 → 서버 경유 + rate-limit + 크기 검증
 */

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { createClient } from '@supabase/supabase-js';
import { nanoid } from 'nanoid';

const router = Router();

// 서버용 Supabase 클라이언트 (service_role 키) — 지연 초기화
// ESM import 호이스팅으로 dotenv.config()보다 먼저 평가되므로
// 모듈 최상위에서 createClient 호출하면 env 미로드 시 크래시 발생
let _supabase = null;
function getSupabase() {
  if (!_supabase) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error('SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY 미설정');
    }
    _supabase = createClient(url, key);
  }
  return _supabase;
}

const MAX_CODE_SIZE = 50_000; // 50KB
const SHARE_ID_LENGTH = 8;

// 공유 생성 rate-limit (IP당 분당 10회)
const shareLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: '잠시 후 다시 시도해주세요. (분당 10회 제한)' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * POST /api/share
 * Body: { code, title }
 * Returns: { id, url }
 */
router.post('/', shareLimiter, async (req, res) => {
  try {
    const { code, title } = req.body;

    // 입력 검증
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: '코드가 필요합니다.' });
    }
    if (code.length > MAX_CODE_SIZE) {
      return res.status(400).json({ error: '코드가 너무 깁니다 (50KB 초과)' });
    }

    const safeTitle = (typeof title === 'string' ? title : '제목 없음').slice(0, 200);

    // nanoid로 짧은 ID 생성, 충돌 시 재시도
    for (let attempt = 0; attempt < 3; attempt++) {
      const id = nanoid(SHARE_ID_LENGTH);
      const { error } = await getSupabase()
        .from('vpylab_shares')
        .insert({ id, code, title: safeTitle });

      if (!error) {
        return res.json({ id, url: `/s/${id}` });
      }

      // PK 충돌이면 재시도
      if (!error.message?.includes('duplicate')) {
        return res.status(500).json({ error: '공유 링크 생성 실패' });
      }
    }

    res.status(500).json({ error: '공유 링크 생성 실패 (충돌 초과)' });
  } catch (err) {
    console.error('[Share] 오류:', err.message);
    res.status(500).json({ error: '서버 오류' });
  }
});

export default router;

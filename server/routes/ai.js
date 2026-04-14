/**
 * VPy Lab — Solar Pro 3 AI 힌트 프록시
 *
 * 보안 감사 결과 반영:
 * - 학생당 분당 5회 레이트 리밋 (미들웨어에서 적용)
 * - 학생당 일일 20회 상한
 * - 코드 길이 10KB 제한
 * - AI 응답에서 완전한 코드 블록 필터링
 * - 프롬프트 인젝션 방어
 */

import { Router } from 'express';

const router = Router();

// 일일 요청 카운터 (메모리, 프로덕션에서는 Redis 사용)
const dailyCounts = new Map();
const DAILY_LIMIT = 20;

// 자정에 카운터 리셋
setInterval(() => dailyCounts.clear(), 24 * 60 * 60 * 1000);

const SYSTEM_PROMPT = `당신은 VPy Lab의 교육 AI 조교입니다.
학생이 3D 프로그래밍(VPython) 과제를 풀 때 도움을 줍니다.

반드시 지켜야 할 규칙:
1. 절대로 완전한 정답 코드를 제공하지 마세요
2. 힌트와 방향만 제시하세요
3. 학생이 스스로 생각하도록 질문을 던지세요
4. 코드를 보여줄 때는 핵심 부분만 1~2줄로 제한하세요
5. 친절하고 격려하는 톤을 유지하세요
6. 한국어로 답변하세요 (학생이 영어로 물으면 영어로)`;

router.post('/hint', async (req, res) => {
  const { code, missionId, hintLevel, language } = req.body;

  // 입력 검증
  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: '코드가 필요합니다' });
  }

  if (code.length > 10_000) {
    return res.status(400).json({ error: '코드가 너무 깁니다 (10KB 초과)' });
  }

  // 일일 제한 체크 (IP 기반, 프로덕션에서는 JWT 사용자 기반)
  const clientId = req.ip;
  const count = dailyCounts.get(clientId) || 0;
  if (count >= DAILY_LIMIT) {
    return res.status(429).json({
      error: '오늘의 AI 힌트를 모두 사용했습니다',
      remaining: 0,
    });
  }

  // API 키 확인
  const apiKey = process.env.UPSTAGE_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'AI 서비스가 설정되지 않았습니다' });
  }

  try {
    const response = await fetch('https://api.upstage.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'solar-pro',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: `미션: ${missionId || '자유 코딩'}
힌트 단계: ${hintLevel || 1} (1=방향, 2=구체적, 3=거의 답)

<user_code>
${code}
</user_code>

이 코드에 대해 힌트를 주세요.`,
          },
        ],
        max_tokens: 500,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[AI] API 오류:', response.status, errText);
      return res.status(502).json({ error: 'AI 서비스 일시 오류' });
    }

    const data = await response.json();
    let hint = data.choices?.[0]?.message?.content || '';

    // 보안: 완전한 코드 블록 필터링 (```python ... ``` 에서 5줄 이상이면 제거)
    hint = hint.replace(/```python\n([\s\S]{200,?})```/g,
      '```\n[코드가 너무 길어서 생략되었습니다. 직접 생각해보세요!]\n```'
    );

    // 카운터 증가
    dailyCounts.set(clientId, count + 1);

    res.json({
      hint,
      remaining: DAILY_LIMIT - count - 1,
    });
  } catch (err) {
    console.error('[AI] 요청 실패:', err.message);
    res.status(500).json({ error: 'AI 서비스 연결 실패' });
  }
});

export default router;

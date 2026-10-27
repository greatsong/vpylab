import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { request, setTokenProvider } from './api';

let stored;
const success = (body) => ({ ok: true, status: 201, json: async () => body });

describe('교실 API 요청의 재시도 식별', () => {
  beforeEach(() => {
    stored = new Map(); vi.stubGlobal('crypto', webcrypto);
    vi.stubGlobal('localStorage', { getItem: (key) => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, value), removeItem: (key) => stored.delete(key) });
    vi.stubGlobal('fetch', vi.fn()); setTokenProvider(null);
  });
  afterEach(() => { setTokenProvider(null); vi.unstubAllGlobals(); });

  it('응답 유실 재전송은 같은 요청 키를 쓰고 성공 후 새 작업에는 새 키를 쓴다', async () => {
    const body = { code: '학생의 비공개 코드', baseVersion: 2, message: '실험 근거 저장', evidence: { hypothesis: '예상', observation: '관찰', reasoning: '판단', nextStep: '다음 실험', aiUse: '' } };
    const options = { method: 'POST', userId: 'student-a', body };
    fetch.mockRejectedValueOnce(new TypeError('응답 유실')).mockResolvedValueOnce(success({ checkpoint: { id: 'checkpoint-3', version: 3 } })).mockResolvedValueOnce(success({ checkpoint: { id: 'checkpoint-4', version: 4 } }));
    await expect(request('/projects/retry-test/checkpoints', options)).rejects.toThrow('응답 유실');
    expect(stored.size).toBe(1);
    expect([...stored.keys()].join('')).not.toContain('학생의 비공개 코드');
    await request('/projects/retry-test/checkpoints', options);
    expect(stored.size).toBe(0);
    await request('/projects/retry-test/checkpoints', options);
    const headers = fetch.mock.calls.map(([, init]) => init.headers);
    expect(headers[0]['Idempotency-Key']).toBe(headers[1]['Idempotency-Key']);
    expect(headers[2]['Idempotency-Key']).not.toBe(headers[1]['Idempotency-Key']);
    expect(headers[0]['X-Classroom-User']).toBe('student-a');
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual(body);
  });

  it('HTTP 성공이어도 JSON이 손상되면 저장 완료로 처리하지 않고 재시도 키를 유지한다', async () => {
    const options = { method: 'POST', userId: 'student-a', body: { title: '응답 형식 검사' } };
    fetch.mockResolvedValueOnce({ ok: true, status: 201, json: async () => { throw new SyntaxError('잘린 JSON'); } })
      .mockResolvedValueOnce(success({ project: { id: 'created-project' } }));
    await expect(request('/projects', options)).rejects.toMatchObject({ code: 'invalid_response', status: 502 });
    const firstKey = fetch.mock.calls[0][1].headers['Idempotency-Key'];
    expect(stored.size).toBe(1);
    await request('/projects', options);
    expect(fetch.mock.calls[1][1].headers['Idempotency-Key']).toBe(firstKey);
    expect(stored.size).toBe(0);
  });

  it('GET도 계정 불일치를 전달하여 현재 화면이 이전 계정 데이터를 숨길 수 있게 한다', async () => {
    const listener = vi.fn(); window.addEventListener('vpylab-classroom-session-changed', listener);
    fetch.mockResolvedValueOnce({ ok: false, status: 409, json: async () => ({ code: 'session_changed', message: '계정 변경' }) });
    await expect(request('/projects/team/drafts', { userId: 'student-a' })).rejects.toMatchObject({ code: 'session_changed' });
    expect(listener).toHaveBeenCalledOnce();
    expect(listener.mock.calls[0][0].detail.expectedUserId).toBe('student-a');
    window.removeEventListener('vpylab-classroom-session-changed', listener);
  });
});

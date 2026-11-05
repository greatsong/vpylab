import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchRow, supabaseAuthHeaders } from './og.mjs';

const env = (key) => ({ VITE_SUPABASE_URL: 'https://example.supabase.co', VITE_SUPABASE_ANON_KEY: key });

async function captureHeaders(key) {
  let seen = null;
  const fetchImpl = async (url, init) => {
    seen = init.headers;
    return { ok: true, json: async () => [{ title: '작품' }] };
  };
  const row = await fetchRow({ table: 'vpylab_shares', id: 'abc12345', select: 'title', env: env(key), fetchImpl });
  assert.deepEqual(row, { title: '작품' });
  return seen;
}

test('예전 JWT 키는 apikey와 Authorization을 모두 보냅니다', async () => {
  const key = 'eyJhbGciOiJIUzI1NiJ9.e30.signature';
  const headers = await captureHeaders(key);
  assert.equal(headers.apikey, key);
  assert.equal(headers.Authorization, `Bearer ${key}`);
});

test('새 sb_ 키는 apikey만 보내고 Authorization은 보내지 않습니다', async () => {
  const key = 'sb_publishable_example';
  const headers = await captureHeaders(key);
  assert.equal(headers.apikey, key);
  assert.equal('Authorization' in headers, false);
  assert.equal(headers.Accept, 'application/json');
});

test('supabaseAuthHeaders는 sb_secret_ 키에도 Authorization을 넣지 않습니다', () => {
  assert.deepEqual(supabaseAuthHeaders('sb_secret_example'), { apikey: 'sb_secret_example' });
});

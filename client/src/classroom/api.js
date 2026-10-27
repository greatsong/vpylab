let tokenProvider = null;
const pendingOperations = new Map();
export function setTokenProvider(provider) { tokenProvider = provider; }

async function mutationKey(method, path, userId, body) {
  const signature = JSON.stringify([method, path, userId, body]);
  let storageKey = null;
  if (globalThis.crypto?.subtle) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(signature));
    storageKey = `vpylab:v2:operation:${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
  }
  let key = pendingOperations.get(signature);
  try { key ||= storageKey && localStorage.getItem(storageKey); } catch { /* 이 기기의 저장소가 없어도 전송은 계속합니다. */ }
  key ||= crypto.randomUUID();
  pendingOperations.set(signature, key);
  try { if (storageKey) localStorage.setItem(storageKey, key); } catch { /* 요청 본문은 저장하지 않습니다. */ }
  return { key, clear: () => { pendingOperations.delete(signature); try { if (storageKey) localStorage.removeItem(storageKey); } catch { /* 저장소 미사용 */ } } };
}

export class RequestError extends Error {
  constructor(status, body) {
    super(body.error || body.message || `요청을 완료하지 못했습니다 (${status})`);
    this.status = status;
    Object.assign(this, body);
  }
}

export async function request(path, { method = 'GET', body, userId, signal, timeoutMs = 20000 } = {}) {
  const token = await tokenProvider?.();
  const operation = !['GET', 'HEAD', 'OPTIONS'].includes(method) && !path.startsWith('/session') ? await mutationKey(method, path, userId, body) : null;
  const abort = new AbortController();
  const cancel = () => abort.abort(signal?.reason);
  if (signal?.aborted) cancel(); else signal?.addEventListener('abort', cancel, { once: true });
  const timer = setTimeout(() => abort.abort(new DOMException('서버 응답 대기 시간이 지났습니다. 초안은 보존됩니다.', 'TimeoutError')), timeoutMs);
  try {
    const response = await fetch(`/api/v2${path}`, {
    method, credentials: 'same-origin', signal: abort.signal,
    headers: {
      Accept: 'application/json',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(userId ? { 'X-Classroom-User': userId } : {}),
      ...(operation ? { 'Idempotency-Key': operation.key } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  let data;
  try {
    data = response.status === 204 ? {} : await response.json();
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('invalid_envelope');
  } catch {
    // 서버의 성공 여부가 불명확하므로 같은 요청 키로 다시 확인합니다.
    throw new RequestError(502, { code: 'invalid_response', message: '서버 응답을 확인하지 못했습니다. 다시 시도해도 같은 작업은 중복 저장되지 않습니다.' });
  }
  if (!response.ok) {
    if (userId && (data.code === 'session_changed' || response.status === 401)) {
      window.dispatchEvent(new CustomEvent('vpylab-classroom-session-changed', { detail: { expectedUserId: userId } }));
    }
    if (response.status < 500) operation?.clear();
    throw new RequestError(response.status, data);
  }
  operation?.clear();
  return data;
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', cancel); }
}

export function downloadFile(name, content, type = 'text/plain;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = name; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

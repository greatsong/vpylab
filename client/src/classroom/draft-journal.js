export function draftKey(userId, projectId, clientId) {
  return `vpylab:v2:draft:${encodeURIComponent(userId)}:${encodeURIComponent(projectId)}:${encodeURIComponent(clientId)}`;
}

function validDraft(value) {
  return value && typeof value.code === 'string'
    && Number.isSafeInteger(value.clientSequence) && value.clientSequence >= 0
    && Number.isSafeInteger(value.baseVersion) && value.baseVersion >= 0;
}

export function sameDraft(first, second) {
  return !!first && !!second && first.code === second.code && first.baseVersion === second.baseVersion;
}

export function readDraft(storage, scope) {
  try {
    const value = JSON.parse(storage.getItem(draftKey(...scope)) || 'null');
    if (!validDraft(value)) return null;
    const [userId, projectId, clientId] = scope;
    if ((value.userId && value.userId !== userId) || (value.projectId && value.projectId !== projectId) || (value.clientId && value.clientId !== clientId)) return null;
    return value;
  } catch { return null; }
}

/** 닫힌 창의 작업은 최초 복구 때만 찾고, 계정·프로젝트·원본 창 소유권을 확인합니다. */
export function otherClientDrafts(storage, scope) {
  const [userId, projectId, clientId] = scope;
  const prefix = draftKey(userId, projectId, '');
  const candidates = [];
  try {
    for (let index = 0; index < storage.length; index++) {
      const key = storage.key(index);
      if (!key?.startsWith(prefix)) continue;
      const suffix = key.slice(prefix.length);
      if (!suffix || suffix.includes(':')) continue;
      let sourceClientId;
      try { sourceClientId = decodeURIComponent(suffix); } catch { continue; }
      if (sourceClientId === clientId || key !== draftKey(userId, projectId, sourceClientId)) continue;
      const candidate = readDraft(storage, [userId, projectId, sourceClientId]);
      if (candidate?.userId !== userId || candidate.projectId !== projectId || candidate.clientId !== sourceClientId) continue;
      candidates.push({ ...candidate, recoveredFromClientId: sourceClientId });
    }
  } catch { return []; }
  return candidates.sort((first, second) => (Date.parse(second.updatedAt) || 0) - (Date.parse(first.updatedAt) || 0));
}

export function writeDraft(storage, scope, draft) {
  // 저장 불가를 호출자에게 전달해 화면이 성공으로 표시하지 않도록 합니다.
  const [userId, projectId, clientId] = scope;
  storage.setItem(draftKey(...scope), JSON.stringify({ ...draft, userId, projectId, clientId }));
}

export function archiveDraft(storage, scope, draft) {
  if (!validDraft(draft)) return;
  const key = `${draftKey(...scope)}:recovery`;
  const entries = recoveryDrafts(storage, scope).filter((entry) => !sameDraft(entry, draft));
  // 의도적으로 비운 코드도 하나의 작업이므로 복구할 수 있어야 합니다.
  storage.setItem(key, JSON.stringify([{ ...draft, archivedAt: new Date().toISOString() }, ...entries].slice(0, 8)));
}

export function recoveryDrafts(storage, scope) {
  try {
    const data = JSON.parse(storage.getItem(`${draftKey(...scope)}:recovery`) || '[]');
    return Array.isArray(data) ? data.filter(validDraft).slice(0, 8) : [];
  } catch { return []; }
}

export function chooseDraft(local, remote, checkpoint) {
  const localDraft = validDraft(local) ? local : null;
  const remoteDraft = validDraft(remote) ? remote : null;
  if (localDraft && remoteDraft && localDraft.clientSequence === remoteDraft.clientSequence && !sameDraft(localDraft, remoteDraft)) {
    // 같은 번호의 다른 코드도 서버가 받아들일 새 번호로 보존합니다.
    return { ...localDraft, clientSequence: localDraft.clientSequence + 1, updatedAt: new Date().toISOString() };
  }
  const candidates = [localDraft, remoteDraft].filter(Boolean);
  const selected = candidates.sort((first, second) => second.clientSequence - first.clientSequence)[0];
  return selected ? { ...selected } : {
    code: checkpoint?.code ?? '',
    baseVersion: Number.isSafeInteger(checkpoint?.version) && checkpoint.version >= 0 ? checkpoint.version : 0,
    clientSequence: 0,
  };
}

export function getClientId() {
  // 같은 탭의 새로고침은 이어갑니다. 복제된 탭의 충돌도 순번과 복구 기록으로 처리합니다.
  const key = 'vpylab:v2:client';
  try {
    const previous = sessionStorage.getItem(key);
    if (previous) return previous;
    const id = crypto.randomUUID();
    sessionStorage.setItem(key, id);
    return id;
  } catch { return crypto.randomUUID(); }
}

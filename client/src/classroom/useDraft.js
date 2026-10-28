import { useCallback, useEffect, useRef, useState } from 'react';
import { request } from './api';
import { archiveDraft, chooseDraft, getClientId, otherClientDrafts, readDraft, recoveryDrafts, sameDraft, writeDraft } from './draft-journal';

const STORAGE_ERROR = '이 기기에 초안을 보존하지 못했습니다. 파일로 내려받아 보관해주세요.';
function browserStorage() { try { return localStorage; } catch { return null; } }
function forkDraft(draft, clientId, clientSequence = 0) {
  return { ...draft, clientId, clientSequence, recoveredFromClientId: draft.clientId || draft.recoveredFromClientId };
}

/** 계정·프로젝트·편집 창마다 독립된 초안과 요청 수명을 유지합니다. */
export default function useDraft(userId, projectId, checkpoint, { readOnly = false } = {}) {
  const [clientId] = useState(getClientId);
  const scopeKey = JSON.stringify([userId, projectId, clientId, readOnly]);
  const [view, setView] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const sessionRef = useRef(null);
  const checkpointRef = useRef(checkpoint);
  useEffect(() => { checkpointRef.current = checkpoint; }, [checkpoint]);

  const publish = useCallback((session, values) => {
    if (!session.live || sessionRef.current !== session) return;
    setView((previous) => ({ ...(previous?.scopeKey === session.key ? previous : {}), scopeKey: session.key, ...values }));
  }, []);

  const preserve = useCallback((session, selected, alternatives = []) => {
    const storage = browserStorage();
    const different = [...(session.pendingRecoveries || []), ...alternatives].filter((item) => item && !sameDraft(item, selected));
    try {
      for (const alternative of different) archiveDraft(storage, session.scope, alternative);
      session.recoveries = recoveryDrafts(storage, session.scope);
      writeDraft(storage, session.scope, selected);
      session.blocked = false;
      session.pendingRecoveries = [];
      session.storageError = '';
      return '';
    } catch {
      // 복구 보존이 실패한 상태에서는 다른 코드를 서버에 덮어쓰지 않습니다.
      if (different.length) {
        session.blocked = true;
        session.pendingRecoveries = different;
        session.recoveries = [...different.map((item) => ({ ...item, archivedAt: new Date().toISOString() })), ...session.recoveries].slice(0, 8);
      }
      session.storageError = STORAGE_ERROR;
      return STORAGE_ERROR;
    }
  }, []);

  useEffect(() => {
    const scope = [userId, projectId, clientId];
    const local = readOnly ? null : readDraft(browserStorage(), scope);
    const otherLocals = !readOnly && !local ? otherClientDrafts(browserStorage(), scope) : [];
    const recoveredLocal = otherLocals[0] ? forkDraft(otherLocals[0], clientId) : null;
    const session = {
      key: scopeKey, scope, live: true, loaded: false, edited: false, blocked: false, pendingRecoveries: [], storageError: '',
      draft: chooseDraft(local || recoveredLocal, null, checkpointRef.current),
      recoveries: readOnly ? [] : recoveryDrafts(browserStorage(), scope),
      loadController: new AbortController(), saveController: null,
    };
    sessionRef.current = session;
    const active = () => session.live && sessionRef.current === session;
    const openOffline = (message) => {
      session.loaded = true;
      const storageError = readOnly ? '' : preserve(session, session.draft, otherLocals);
      publish(session, { draft: session.draft, loaded: true, status: 'offline', error: message, storageError, recoveries: session.recoveries });
    };
    const load = readOnly
      ? Promise.resolve({ draft: null, checkpoint: checkpointRef.current })
      : request(`/projects/${projectId}/drafts?clientId=${encodeURIComponent(clientId)}`, { userId, signal: session.loadController.signal });
    const loadTimeout = setTimeout(() => {
      if (!active() || session.loaded) return;
      session.loadController.abort();
      openOffline('서버 응답이 늦어 이 기기의 초안을 열었습니다. 작성한 코드는 계속 보존됩니다.');
    }, 8_000);
    load.then(({ draft: received, checkpoint: serverCheckpoint, recoveredFromClientId }) => {
      clearTimeout(loadTimeout);
      if (!active() || session.loaded) return;
      const remote = received && (!received.userId || received.userId === userId) && (!received.projectId || received.projectId === projectId) ? received : null;
      const remoteClientId = recoveredFromClientId || remote?.clientId || remote?.recoveredFromClientId || clientId;
      const remoteIsCurrent = remoteClientId === clientId;
      const normalizedRemote = remote && !remoteIsCurrent ? forkDraft({ ...remote, clientId: remoteClientId }, clientId) : remote;
      let selected = chooseDraft(session.edited || local ? session.draft : null, normalizedRemote, serverCheckpoint || checkpointRef.current);
      if (!local && !session.edited && otherLocals.length) {
        // 서로 다른 창의 순번은 비교할 수 없으므로 마지막 작성 시각으로 복구합니다.
        const candidates = [...otherLocals, ...(remote ? [{ ...remote, clientId: remoteClientId }] : [])]
          .sort((first, second) => (Date.parse(second.updatedAt) || 0) - (Date.parse(first.updatedAt) || 0));
        const latest = candidates[0];
        selected = latest.clientId === clientId ? { ...latest } : forkDraft(latest, clientId, remoteIsCurrent && remote ? remote.clientSequence + 1 : 0);
      }
      if (session.edited && !sameDraft(selected, session.draft)) {
        // 로딩 중 쓴 코드는 응답으로 교체하지 않고 순번만 앞당깁니다.
        selected = { ...session.draft, clientSequence: Math.max(session.draft.clientSequence, remote?.clientSequence || 0) + 1 };
      }
      const storageError = readOnly ? '' : preserve(session, selected, [local, remote, session.draft, ...otherLocals]);
      session.draft = selected;
      session.loaded = true;
      publish(session, { draft: selected, loaded: true, status: session.blocked ? 'offline' : 'local', error: '', storageError, recoveries: session.recoveries });
    }).catch((error) => {
      clearTimeout(loadTimeout);
      if (!active() || session.loaded || error.name === 'AbortError') return;
      openOffline('서버 연결을 확인해주세요. 이 기기에 있는 초안을 열었습니다.');
    });
    return () => {
      session.live = false;
      clearTimeout(loadTimeout);
      session.loadController.abort();
      session.saveController?.abort();
    };
  }, [userId, projectId, clientId, scopeKey, readOnly, preserve, publish]);

  const update = useCallback((code, baseVersion) => {
    const session = sessionRef.current;
    if (readOnly || !session?.live || session.key !== scopeKey) return;
    const previous = session.draft;
    const stored = readDraft(browserStorage(), session.scope);
    const next = {
      code: code ?? '', baseVersion: baseVersion ?? previous.baseVersion,
      clientId, clientSequence: Math.max(previous.clientSequence, stored?.clientSequence || 0) + 1,
      updatedAt: new Date().toISOString(),
    };
    const storageError = preserve(session, next, stored && !sameDraft(stored, previous) ? [stored] : []);
    session.draft = next;
    session.edited = true;
    publish(session, { draft: next, loaded: session.loaded, status: session.blocked ? 'offline' : 'local', error: '', storageError, recoveries: session.recoveries });
  }, [clientId, scopeKey, readOnly, preserve, publish]);

  const replace = useCallback((code, baseVersion) => {
    const session = sessionRef.current;
    if (readOnly || !session?.live || session.key !== scopeKey) return;
    try { archiveDraft(browserStorage(), session.scope, session.draft); }
    catch { throw new Error('현재 초안을 복구 기록에 보존하지 못했습니다. 파일로 내려받은 뒤 다시 시도해주세요.'); }
    session.recoveries = recoveryDrafts(browserStorage(), session.scope);
    update(code, baseVersion);
  }, [scopeKey, readOnly, update]);

  const scopedView = view?.scopeKey === scopeKey ? view : null;
  const draft = scopedView?.draft || null;
  const loaded = scopedView?.loaded || false;

  useEffect(() => {
    const session = sessionRef.current;
    if (!draft || !loaded || readOnly || session?.key !== scopeKey || session.blocked) return;
    const current = () => session.live && sessionRef.current === session && session.draft === draft;
    const abort = new AbortController();
    const timer = setTimeout(async () => {
      if (!current()) return;
      session.saveController?.abort(); session.saveController = abort;
      publish(session, { status: 'saving' });
      try {
        await request(`/projects/${projectId}/drafts`, { method: 'PUT', userId, body: { ...draft, clientId }, signal: abort.signal });
        if (current()) publish(session, { status: 'saved', error: '' });
      } catch (error) {
        if (!current() || error.name === 'AbortError') return;
        if (error.code === 'draft_sequence_conflict' && error.draft) {
          const latest = error.draft;
          const next = { ...session.draft, clientSequence: Math.max(session.draft.clientSequence, latest.clientSequence || 0) + 1 };
          const storageError = preserve(session, next, [latest]);
          session.draft = next;
          publish(session, { draft: next, status: session.blocked ? 'offline' : 'local', storageError, recoveries: session.recoveries, error: '다른 창의 초안을 복구 기록에 보존하고 내 초안을 다시 보냅니다.' });
        } else publish(session, { status: 'offline', error: error.message || '서버에 초안을 보내지 못했습니다.' });
      }
    }, 700);
    return () => { clearTimeout(timer); abort.abort(); };
  }, [draft, loaded, userId, projectId, clientId, scopeKey, readOnly, retryCount, publish, preserve]);

  const retry = useCallback(() => {
    const session = sessionRef.current;
    if (session?.live && session.key === scopeKey && !readOnly) {
      const storageError = preserve(session, session.draft);
      publish(session, { storageError, recoveries: session.recoveries });
    }
    setRetryCount((value) => value + 1);
  }, [scopeKey, readOnly, preserve, publish]);

  useEffect(() => {
    window.addEventListener('online', retry);
    return () => window.removeEventListener('online', retry);
  }, [retry]);

  const advanceBase = useCallback((baseVersion) => {
    const session = sessionRef.current;
    if (session?.key === scopeKey) update(session.draft.code, baseVersion);
  }, [scopeKey, update]);

  return {
    draft, update, replace, advanceBase,
    recoveries: scopedView?.recoveries || [],
    status: scopedView?.status || 'loading',
    error: scopedView?.error || '', storageError: scopedView?.storageError || '',
    retry,
  };
}

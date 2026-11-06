// verify-github-live.mjs --write --two-accounts 전용. 실제 두 GitHub 계정의 토큰은 메모리에서만 사용합니다.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

export async function verifyGithubPeers({ owner, peer, token, request, checked, report, repo, project, codeRow, codeA, codeB }) {
  const peerToken = execFileSync('gh', ['auth', 'token', '--user', 'greatsong-danggok'], { encoding: 'utf8' }).trim();
  const unwrap = ({ data, error }) => { if (error) throw new Error(error.message); return data; };
  const testRepos = new Set([repo]);
  const invitationIds = new Set();
  async function gh(actorToken, path, method = 'GET', body = null) {
    const repoPath = path.match(/^repos\/([^/]+\/[^/]+)(?:\/|$)/)?.[1];
    assert(path === 'user' || path === 'user/repository_invitations'
      || (repoPath && testRepos.has(repoPath))
      || (method === 'PATCH' && invitationIds.has(path)), '전용 검증 범위를 벗어난 GitHub 요청');
    const response = await fetch(`https://api.github.com/${path}`, {
      method, headers: { Authorization: `Bearer ${actorToken}`, Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json', 'X-GitHub-Api-Version': '2022-11-28' },
      ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(25000),
    });
    if (response.status === 204) return null;
    const result = await response.json();
    assert(response.ok, `GitHub ${method} ${path}: ${response.status} ${result.message || ''}`);
    return result;
  }
  const [a, b] = await Promise.all([gh(token, 'user'), gh(peerToken, 'user')]);
  assert.equal(a.login, 'greatsong'); assert.equal(b.login, 'greatsong-danggok'); assert.notEqual(a.id, b.id);
  report.githubActors = [a.login, b.login];
  checked('실제 GitHub 두 계정의 서로 다른 사용자 ID와 인증 확인', { accounts: report.githubActors });
  const content = async (target, path) => Buffer.from((await gh(token, `repos/${target}/contents/${path}`)).content, 'base64').toString('utf8');
  async function accept(actorToken, target) {
    const pending = await gh(actorToken, 'user/repository_invitations');
    const invitation = pending.find(item => item.repository.full_name.toLowerCase() === target.toLowerCase());
    if (!invitation) return;
    const path = `user/repository_invitations/${invitation.id}`;
    invitationIds.add(path);
    await gh(actorToken, path, 'PATCH');
  }
  async function invite(actor, actorToken, target, username, invitedToken) {
    const invited = await request('/api/projects/collaborators/invite', actor, { repoFullName: target, username, githubToken: actorToken });
    assert(invited.invited.some(item => item.username === username));
    await accept(invitedToken, target);
    const again = await request('/api/projects/collaborators/invite', actor, { repoFullName: target, username, githubToken: actorToken });
    assert(again.invited.some(item => item.username === username && item.alreadyCollaborator));
    checked(`${target}: 실제 초대·상대 계정 수락·기존 멤버 재초대 성공`, { from: username === b.login ? a.login : b.login, to: username });
  }
  await invite(owner, token, repo, b.login, peerToken);
  unwrap(await owner.client.from('vpylab_project_members').update({ role: 'editor' }).eq('project_id', project.id).eq('user_id', peer.id));
  const peerAccess = await request('/api/projects/access', peer, { repoFullName: repo, githubToken: peerToken });
  assert(peerAccess.canPush);
  checked('초대받은 두 번째 GitHub 계정의 실제 저장소 쓰기 권한 확인');
  async function revision(actor, targetProject, targetCode, code, message) {
    return unwrap(await actor.client.from('vpylab_code_revisions').insert({
      code_id: targetCode.id, project_id: targetProject.id, author_id: actor.id,
      message, code_snapshot: code, code_size: code.length, source: 'manual',
    }).select().single());
  }
  const peerSaved = unwrap(await peer.client.rpc('vpylab_save_project_code', {
    p_code_id: codeRow.id, p_project_id: project.id, p_client_save_id: randomUUID(),
    p_expected_code: codeA, p_code: codeB, p_title: '두 계정 검증', p_message: '학생 B가 수정', p_source: 'manual',
  }));
  const peerRevision = peerSaved.revision;
  const payload = { repoFullName: repo, projectId: project.id, codeId: codeRow.id, code: codeB,
    revisionId: peerRevision.id, githubToken: peerToken, title: '두 계정 협업 검증', message: '학생 B 저장', authorLabel: '검증 학생 B' };
  const peerPush = await request('/api/projects/commit', peer, payload);
  assert(peerPush.commitSha); assert.equal(await content(repo, 'main.py'), codeB);
  const repeat = await request('/api/projects/commit', peer, payload);
  assert.equal(repeat.commitSha, peerPush.commitSha);
  assert.equal((await content(repo, 'history.md')).split(`VPyLab revision: \`${peerRevision.id}\``).length - 1, 1);
  checked('초대받은 학생 B가 저장하고 같은 요청을 재전송해도 커밋·이력 중복 없음');

  async function notes(target, targetProject, targetCode, savedCode) {
    const first = await revision(owner, targetProject, targetCode, savedCode, '학생 A 항해 일지');
    const second = await revision(peer, targetProject, targetCode, savedCode, '학생 B 항해 일지');
    const date = new Date().toISOString().slice(0, 10);
    const body = (id, actorToken, label) => ({ repoFullName: target, projectId: targetProject.id, codeId: targetCode.id,
      githubToken: actorToken, revisionId: id, recordOnly: true, authorLabel: label, message: label + ' 동시 항해 일지',
      voyageEntry: { localDate: date, localTime: '12:00', tzOffset: -540, kind: 'detailed', title: label + '의 관찰', did: '서로의 변경을 확인했습니다.', next: '다음 실험에서 비교합니다.' } });
    const results = await Promise.all([
      request('/api/projects/commit', owner, body(first.id, token, '검증 학생 A')),
      request('/api/projects/commit', peer, body(second.id, peerToken, '검증 학생 B')),
    ]);
    assert(results.every(item => item.commitSha));
    const diary = await content(target, `docs/voyage/${date}.md`);
    for (const id of [first.id, second.id]) assert.equal(diary.split(`vpylab-revision:${id}`).length - 1, 1);
    assert(diary.includes('검증 학생 A') && diary.includes('검증 학생 B'));
    assert.equal(await content(target, 'main.py'), savedCode);
    checked(`${target}: 두 계정의 동시 항해 일지가 모두 보존되고 코드 본문은 유지됨`);
  }
  await notes(repo, project, codeRow, codeB);

  const peerTitle = 'VPyLab GitHub 검증 작품 B';
  const peerProject = unwrap(await peer.client.from('vpylab_projects').insert({ owner_id: peer.id, title: peerTitle }).select().single());
  const peerCode = unwrap(await peer.client.from('vpylab_saved_code').insert({ user_id: peer.id, project_id: peerProject.id, title: peerTitle, code: codeA }).select().single());
  await revision(peer, peerProject, peerCode, codeA, 'B 프로젝트 생성');
  const repoName = `${report.runId}-peer`;
  const setup = await request('/api/projects/setup', peer, { title: peerTitle, repoName, code: codeA, githubToken: peerToken, authorLabel: '검증 학생 B' });
  assert.equal(setup.repoFullName, `${b.login}/${repoName}`);
  testRepos.add(setup.repoFullName);
  report.peerRepository = `https://github.com/${setup.repoFullName}`;
  unwrap(await peer.client.from('vpylab_projects').update({ github_repo: setup.repoFullName }).eq('id', peerProject.id));
  unwrap(await peer.client.from('vpylab_saved_code').update({ github_repo: setup.repoFullName }).eq('id', peerCode.id));
  checked('두 번째 실제 GitHub 계정이 새 저장소·최초 코드·Pages를 직접 생성');
  await invite(peer, peerToken, setup.repoFullName, a.login, token);
  unwrap(await owner.client.rpc('vpylab_join_project_by_invite', { p_invite_code: peerProject.invite_code }));
  await notes(setup.repoFullName, peerProject, peerCode, codeA);

  const fork = await request('/api/publish/fork', owner, { sourceRepo: setup.repoFullName, githubToken: token });
  assert.equal(fork.forkedRepo, `${a.login}/${repoName}`);
  testRepos.add(fork.forkedRepo);
  const forkInfo = await gh(token, `repos/${fork.forkedRepo}`);
  assert(forkInfo.fork);
  assert.equal(forkInfo.parent.full_name, setup.repoFullName);
  assert.equal(await content(fork.forkedRepo, 'main.py'), codeA);
  assert((await content(fork.forkedRepo, 'index.html')).includes(`repo=${encodeURIComponent(fork.forkedRepo)}`), 'fork 실행 페이지의 편집 링크가 원작 대신 내 fork를 열어야 합니다.');
  report.forkRepository = `https://github.com/${fork.forkedRepo}`;
  checked('학생 A가 학생 B의 저장소를 실제 GitHub fork로 이어가며 parent 출처와 코드 유지');

  const original = unwrap(await peer.client.from('vpylab_gallery').insert({ user_id: peer.id,
    title: '두 계정 검증 원작', code: codeA, category: 'art', author_alias: '검증 학생 B',
    github_repo: setup.repoFullName, github_url: setup.pagesUrl, is_public: true }).select().single());
  const remixed = unwrap(await owner.client.from('vpylab_gallery').insert({ user_id: owner.id,
    title: '두 계정 검증 리믹스', code: codeA, category: 'art', author_alias: '검증 학생 A',
    github_repo: fork.forkedRepo, github_url: fork.githubUrl, is_public: false,
    remix_from: original.id, remix_from_title: original.title, remix_from_author: '검증 학생 B' }).select().single());
  const attribution = unwrap(await owner.client.from('vpylab_gallery').select('remix_from,remix_from_title,remix_from_author')
    .eq('id', remixed.id).single());
  assert.equal(attribution.remix_from, original.id);
  assert.equal(attribution.remix_from_author, '검증 학생 B');
  checked('실제 갤러리 RLS로 리믹스 원작 연결·제목·원작자 출처 스냅샷 저장');

  // 기존 단일 계정 검증의 종료 상태를 유지하여 다음 실행도 안전하게 같은 fixture를 재사용합니다.
  const restored = unwrap(await owner.client.rpc('vpylab_save_project_code', {
    p_code_id: codeRow.id, p_project_id: project.id, p_client_save_id: randomUUID(),
    p_expected_code: codeB, p_code: codeA, p_title: '두 계정 검증', p_message: '두 계정 검증 후 A 복원', p_source: 'restore',
  }));
  const restore = restored.revision;
  await request('/api/projects/commit', owner, { ...payload, code: codeA, revisionId: restore.id, githubToken: token, authorLabel: '검증 학생 A', message: '검증 후 A 복원' });
  assert.equal(await content(repo, 'main.py'), codeA);
  checked('두 계정 검증 후 전용 작품 A를 복원하고 양쪽 저장소의 기록 보존');
}

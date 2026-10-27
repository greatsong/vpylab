import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { createStore, DEMO_USERS } from './store.js';
import { createClassroomApp } from './app.js';

const teacher=DEMO_USERS[0], studentA=DEMO_USERS[1], studentB=DEMO_USERS[2];
const input=(code='sphere()')=>({code,baseVersion:0,message:'실험 결과',evidence:{hypothesis:'속도를 바꾸면 도착 시간이 바뀝니다.',observation:'속도를 두 배로 바꾸자 도착 시간이 줄었습니다.',nextStep:'다른 거리에서도 확인합니다.'}});
const fixture=()=>{const store=createStore({localMode:true});return {store,id:store.listProjects(teacher)[0].id};};

async function httpFixture(t,options={}) {
  const runtime=createClassroomApp({localMode:true,...options});
  const server=runtime.app.listen(0,'127.0.0.1'); await once(server,'listening');
  const origin=`http://127.0.0.1:${server.address().port}`,clients=[];
  t.after(async()=>{runtime.githubService.stopWorker();await new Promise(resolve=>server.close(resolve));runtime.store.close();});
  function client() { let cookie='',user=null; const api=async(path,{method='GET',body,headers={}}={})=>{
    const response=await fetch(origin+'/api/v2'+path,{method,headers:{origin,cookie,...(body!==undefined?{'content-type':'application/json'}:{}),...(user?{'X-Classroom-User':user}:{}),...headers},...(body!==undefined?{body:JSON.stringify(body)}:{})});
    const setCookie=response.headers.get('set-cookie'); if(setCookie) cookie=setCookie.split(';')[0];
    const data=await response.json(); return {status:response.status,data};
  }; const c={api,login:async(id)=>{const result=await api('/session/local',{method:'POST',body:{userId:id}});if(result.status===200)user=id;return result;},get cookie(){return cookie;}};clients.push(c);return c;}
  return {runtime,origin,client};
}

test('같은 버전의 동시 저장은 하나만 확정하고 나머지는 충돌로 돌려준다',async()=>{
  const {store,id}=fixture();
  try { const results=await Promise.allSettled([Promise.resolve().then(()=>store.saveCheckpoint(id,studentA,input('a'))),Promise.resolve().then(()=>store.saveCheckpoint(id,studentB,input('b')))]); assert.equal(results.filter(x=>x.status==='fulfilled').length,1); const rejected=results.find(x=>x.status==='rejected').reason;assert.equal(rejected.code,'version_conflict');assert.equal(rejected.extra.current.version,1);assert.equal(store.getProject(id).version,1);assert.equal(store.checkpoints(id).length,2);assert.equal(store.getJobs(id).length,1);assert.equal(store.getJobs(id)[0].payload.code,store.getProject(id).code); } finally {store.close();}
});

test('아웃박스 저장 실패 시 코드와 이력을 함께 롤백한다',()=>{
  const {store,id}=fixture();try {const before=store.getProject(id);store.enqueueJob=()=>{throw new Error('저장 장치 오류');};assert.throws(()=>store.saveCheckpoint(id,studentA,input('새 코드')),/저장 장치 오류/);assert.equal(store.getProject(id).version,0);assert.equal(store.getProject(id).code,before.code);assert.equal(store.checkpoints(id).length,1);}finally{store.close();}
});

test('재시작 후 코드, 개인 초안, 세션, 미처리 작업이 보존된다',()=>{
  const dir=mkdtempSync(join(tmpdir(),'vpylab-v2-')),filename=join(dir,'state.sqlite');let store;
  try {store=createStore({filename,localMode:true});const id=store.listProjects(teacher)[0].id;const sid=store.createSession(studentA.id);store.saveDraft(id,studentA,{code:'나의 초안',baseVersion:0,clientSequence:1},'tab-a');store.saveCheckpoint(id,studentA,input('확정 코드'));store.close();store=createStore({filename,localMode:true});assert.equal(store.getProject(id).code,'확정 코드');assert.equal(store.draft(id,studentA,'tab-a').code,'나의 초안');assert.equal(store.session(sid).id,studentA.id);assert.equal(store.getJobs(id)[0].state,'pending');assert.equal(store.checkpoints(id).length,2);}finally{store?.close();rmSync(dir,{recursive:true,force:true});}
});

test('개인 초안은 계정과 편집 창별로 분리되고 역순 요청이 덮어쓰지 못한다',()=>{
  const {store,id}=fixture();try {store.saveDraft(id,studentA,{code:'최신',baseVersion:0,clientSequence:3},'tab');assert.throws(()=>store.saveDraft(id,studentA,{code:'과거',baseVersion:0,clientSequence:2},'tab'),e=>e.code==='draft_sequence_conflict');store.saveDraft(id,studentB,{code:'다른 학생',baseVersion:0,clientSequence:1},'tab');store.saveDraft(id,studentA,{code:'다른 창',baseVersion:0,clientSequence:1},'tab-2');assert.equal(store.draft(id,studentA,'tab').code,'최신');assert.equal(store.draft(id,studentB,'tab').code,'다른 학생');assert.equal(store.draft(id,studentA,'tab-2').code,'다른 창');assert.equal(store.draft(id,teacher,'tab'),null);}finally{store.close();}
});

test('본인 승인, 승인 없는 반영, 오래된 제안 반영을 막는다',()=>{
  const {store,id}=fixture();try {const proposal=store.addProposal(id,studentA,{title:'실험 제안',...input('제안 코드')});assert.throws(()=>store.addReview(id,proposal.id,studentA,{decision:'approve'}),e=>e.code==='self_review');assert.throws(()=>store.mergeProposal(id,proposal.id,studentA),e=>e.code==='review_required');store.addReview(id,proposal.id,studentB,{decision:'approve'});store.saveCheckpoint(id,teacher,input('팀 최신 코드'));assert.throws(()=>store.mergeProposal(id,proposal.id,studentA),e=>e.code==='version_conflict');assert.equal(store.proposal(id,proposal.id).state,'open');assert.equal(store.getProject(id).code,'팀 최신 코드');}finally{store.close();}
});

test('검토자의 최신 결정이 승인 상태를 정하고 승인 후에는 원자적으로 반영한다',()=>{
  const {store,id}=fixture();try {const proposal=store.addProposal(id,studentA,{title:'실험 제안',...input('반영 코드')});store.addReview(id,proposal.id,studentB,{decision:'approve'});store.addReview(id,proposal.id,studentB,{decision:'request_changes'});assert.throws(()=>store.mergeProposal(id,proposal.id,studentA),e=>e.code==='review_required');store.addReview(id,proposal.id,studentB,{decision:'approve'});const result=store.mergeProposal(id,proposal.id,studentA);assert.equal(result.checkpoint.version,1);assert.equal(result.proposal.state,'merged');assert.equal(store.getJobs(id).length,1);}finally{store.close();}
});

test('데모는 서버가 제공한 계정만 허용하며 요청 헤더로 인증할 수 없다',async(t)=>{
  const {client}=await httpFixture(t), c=client();
  assert.equal((await c.api('/projects',{headers:{'x-user-id':'teacher'}})).status,401);
  assert.equal((await c.login('unknown')).status,422);
  const login=await c.login('student-a');assert.equal(login.data.user.role,'student');
  const session=await c.api('/session');assert.equal(session.data.user.id,'student-a');assert.equal(session.data.users.length,3);
  assert.equal((await c.api('/teacher')).status,403);
  assert.equal((await c.api('/projects',{method:'POST',body:{title:'프로젝트',role:'teacher'}})).status,201);
});

test('계정 전환 후 이전 화면의 지연 요청을 거부하고 초안을 분리한다',async(t)=>{
  const {client}=await httpFixture(t), c=client();await c.login('student-a');const id=(await c.api('/projects')).data.projects[0].id;
  await c.api(`/projects/${id}/drafts`,{method:'PUT',body:{code:'학생 가 초안',baseVersion:0,clientSequence:1,clientId:'same-tab'}});
  await c.login('student-b');
  const stale=await c.api(`/projects/${id}/drafts`,{method:'PUT',headers:{'X-Classroom-User':'student-a'},body:{code:'지연된 요청',baseVersion:0,clientSequence:2,clientId:'same-tab'}});assert.equal(stale.status,409);assert.equal(stale.data.code,'session_changed');
  assert.equal((await c.api(`/projects/${id}/drafts?clientId=same-tab`)).data.draft,null);
  await c.login('student-a');assert.equal((await c.api(`/projects/${id}/drafts?clientId=same-tab`)).data.draft.code,'학생 가 초안');
});

test('브라우저의 다른 출처와 Origin 없는 변경 요청을 차단한다',async(t)=>{
  const {client,origin}=await httpFixture(t),c=client();await c.login('teacher');
  assert.equal((await c.api('/projects',{method:'POST',headers:{origin:'https://attacker.example'},body:{title:'허가 안 된 생성'}})).status,403);
  const response=await fetch(origin+'/api/v2/session/local',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({userId:'teacher'})});assert.equal(response.status,403);
  const rebound=await fetch(origin+'/api/v2/session/local',{method:'POST',headers:{'content-type':'application/json',host:'attacker.example',origin:'http://attacker.example'},body:JSON.stringify({userId:'teacher'})});assert.equal(rebound.status,403);
});

test('관찰자는 읽을 수 있지만 코드, 제안, 질문, 멤버를 변경할 수 없다',async(t)=>{
  const {client}=await httpFixture(t), owner=client(),viewer=client();await owner.login('teacher');await viewer.login('student-b');const id=(await owner.api('/projects')).data.projects[0].id;
  assert.equal((await owner.api(`/projects/${id}/members`,{method:'POST',body:{userId:'student-b',role:'viewer'}})).status,200);
  assert.equal((await viewer.api(`/projects/${id}`)).status,200);
  for(const [suffix,method,body] of [['drafts','PUT',{...input(),clientSequence:1}],['checkpoints','POST',input()],['issues','POST',{title:'질문'}],['proposals','POST',{title:'제안',...input()}],['members','POST',{userId:'student-a',role:'viewer'}]]) assert.equal((await viewer.api(`/projects/${id}/${suffix}`,{method,body})).status,403,suffix);
});

test('AI 미사용 수업도 공통 증거만으로 저장, 제안, 리뷰, 평가를 마친다',async(t)=>{
  const {client}=await httpFixture(t),owner=client(),peer=client();await owner.login('student-a');await peer.login('student-b');
  const created=await owner.api('/projects',{method:'POST',body:{title:'AI 없이 하는 실험',aiPolicy:'disabled',code:'초기 코드'}}),id=created.data.project.id;
  await peer.api('/projects/join',{method:'POST',body:{inviteCode:created.data.project.inviteCode}});
  const saved=await owner.api(`/projects/${id}/checkpoints`,{method:'POST',body:input('실험 코드')});assert.equal(saved.status,201);
  const proposal=await owner.api(`/projects/${id}/proposals`,{method:'POST',body:{...input('개선 코드'),baseVersion:1,title:'관찰을 반영한 개선'}});
  assert.equal((await peer.api(`/projects/${id}/proposals/${proposal.data.proposal.id}/reviews`,{method:'POST',body:{decision:'approve',comment:'관찰 결과가 가설을 뒷받침합니다.'}})).status,201);
  assert.equal((await owner.api(`/projects/${id}/proposals/${proposal.data.proposal.id}/merge`,{method:'POST',body:{}})).status,200);
  await owner.login('teacher');await owner.api('/projects/join',{method:'POST',body:{inviteCode:created.data.project.inviteCode}});const overview=await owner.api('/teacher');assert.equal(overview.status,200);const project=overview.data.projects.find(p=>p.id===id);assert.equal(project.aiPolicy,'disabled');assert.equal(project.reviewCount,1);assert.equal(project.latestCheckpoint.version,2);assert.ok(overview.data.criteria.every(x=>!x.includes('AI')));
});

test('코드와 증거의 크기 제한은 잘라내지 않고 저장 전에 거부한다',async(t)=>{
  const {client}=await httpFixture(t),c=client();await c.login('student-a');const id=(await c.api('/projects')).data.projects[0].id;
  assert.equal((await c.api(`/projects/${id}/checkpoints`,{method:'POST',body:input('한'.repeat(18000))})).status,422);
  assert.equal((await c.api(`/projects/${id}/checkpoints`,{method:'POST',body:{...input(),evidence:{observation:'가'.repeat(10001)}}})).status,422);
  assert.equal((await c.api(`/projects/${id}`)).data.project.version,0);
});

test('프로덕션은 로컬 로그인과 위조 헤더를 거부하고 검증한 JWT만 사용한다',async(t)=>{
  const {client}=await httpFixture(t,{localMode:false,verifyToken:async(token)=>{if(token!=='valid')throw Object.assign(new Error('유효하지 않은 토큰'),{status:401,code:'invalid_session'});return {id:'real-student',name:'학습자',role:'student'};}}),c=client();
  assert.equal((await c.api('/session')).data.localMode,false);assert.deepEqual((await c.api('/session')).data.users,[]);
  assert.equal((await c.api('/session/local',{method:'POST',body:{userId:'teacher'}})).status,404);
  assert.equal((await c.api('/projects',{headers:{'x-user-id':'teacher'}})).status,401);
  assert.equal((await c.api('/projects',{headers:{authorization:'Bearer invalid'}})).status,401);
  const valid=await c.api('/session',{headers:{authorization:'Bearer valid','x-user-id':'teacher'}});assert.equal(valid.data.user.id,'real-student');assert.equal(valid.data.user.role,'student');
});

test('로그아웃하면 복사한 이전 쿠키도 다시 사용할 수 없다',async(t)=>{
  const {client,origin}=await httpFixture(t),c=client();await c.login('student-a');const previousCookie=c.cookie;assert.equal((await c.api('/session',{method:'DELETE'})).status,200);const response=await fetch(origin+'/api/v2/projects',{headers:{cookie:previousCookie}});assert.equal(response.status,401);
});

test('수업 자료 출처와 교사 피드백을 보존하고 학생의 피드백 위조를 거부한다',async(t)=>{
  const {client}=await httpFixture(t),owner=client(),teacherClient=client();await owner.login('student-a');await teacherClient.login('teacher');
  const source={kind:'mission',id:'motion-1',title:'움직임 관찰',courseId:'physics'},created=await owner.api('/projects',{method:'POST',body:{title:'자료에서 시작한 실험',source,aiPolicy:'disabled'}}),id=created.data.project.id;
  assert.deepEqual(created.data.project.source,source);
  await teacherClient.api('/projects/join',{method:'POST',body:{inviteCode:created.data.project.inviteCode}});
  assert.equal((await owner.api(`/projects/${id}/feedback`,{method:'POST',body:{comment:'교사 흉내'}})).status,403);
  assert.equal((await teacherClient.api(`/projects/${id}/feedback`,{method:'POST',body:{studentId:'student-b',comment:'잘못된 대상'}})).status,422);
  const feedback=await teacherClient.api(`/projects/${id}/feedback`,{method:'POST',body:{studentId:'student-a',comment:'관찰 조건과 결과의 관계를 다음 실험에서도 확인해주세요.',criteria:{problem:'문제가 구체적입니다.',experiment:'조건을 바꾼 이유를 설명해주세요.'}}});assert.equal(feedback.status,201);assert.equal(feedback.data.feedback.teacherId,'teacher');
  const detail=await owner.api(`/projects/${id}`);assert.deepEqual(detail.data.project.source,source);assert.equal(detail.data.feedback.length,1);
  const overview=await teacherClient.api('/teacher');assert.equal(overview.data.projects.find(x=>x.id===id).feedback.length,1);
  assert.equal((await teacherClient.api(`/projects/${id}/feedback`,{method:'POST',body:{comment:'가'.repeat(2001)}})).status,422);
});


test('다른 교사는 참여하지 않은 프로젝트를 조회·편집·평가하거나 목록에서 볼 수 없다',()=>{
  const {store,id}=fixture();try {const otherTeacher=store.ensureUser({id:'teacher-other',name:'다른 학급 선생님',role:'teacher'});assert.deepEqual(store.listProjects(otherTeacher),[]);assert.deepEqual(store.teacherOverview(otherTeacher).projects,[]);for(const operation of [()=>store.detail(id,otherTeacher),()=>store.saveCheckpoint(id,otherTeacher,input('타 학급 변경')),()=>store.updateSettings(id,otherTeacher,{title:'타 학급 변경'}),()=>store.addFeedback(id,otherTeacher,{comment:'타 학급 평가'}),()=>store.addMember(id,otherTeacher,'student-a','viewer')])assert.throws(operation,error=>error.code==='access_denied');store.joinProject(otherTeacher,store.getProject(id).inviteCode);assert.equal(store.accessProject(id,otherTeacher).myRole,'teacher');assert.equal(store.teacherOverview(otherTeacher).projects.length,1);}finally{store.close();}
});

test('교사가 제안을 반영해도 코드와 학습 기록의 원저자를 보존하고 반영자를 따로 기록한다',()=>{
  const {store,id}=fixture();try {const proposal=store.addProposal(id,studentA,{title:'학생 가의 관찰',...input('학생 가의 코드')});store.addReview(id,proposal.id,studentB,{decision:'approve'});const result=store.mergeProposal(id,proposal.id,teacher);assert.equal(result.checkpoint.authorId,studentA.id);assert.equal(result.proposal.authorId,studentA.id);assert.equal(result.proposal.mergedBy,teacher.id);assert.equal(store.detail(id,teacher).reflections[0].authorId,studentA.id);assert.equal(store.getJobs(id)[0].payload.authorId,studentA.id);}finally{store.close();}
});

test('검토자가 관찰자로 바뀌면 이전 승인을 편집 승인으로 사용하지 않는다',()=>{
  const {store,id}=fixture();try {const proposal=store.addProposal(id,studentA,{title:'동료 승인 점검',...input('제안')});store.addReview(id,proposal.id,studentB,{decision:'approve'});store.addMember(id,teacher,studentB.id,'viewer');assert.throws(()=>store.mergeProposal(id,proposal.id,studentA),error=>error.code==='review_required');}finally{store.close();}
});

test('확정 저장 응답 본문이 유실되어도 같은 키 재시도는 최초 결과를 재생한다',async(t)=>{
  const {client,origin,runtime}=await httpFixture(t),c=client();await c.login('student-a');const id=(await c.api('/projects')).data.projects[0].id,path=`/projects/${id}/checkpoints`,body=input('응답이 유실된 코드'),key='lost-response-checkpoint';
  const lost=await fetch(origin+'/api/v2'+path,{method:'POST',headers:{origin,cookie:c.cookie,'content-type':'application/json','X-Classroom-User':'student-a','Idempotency-Key':key},body:JSON.stringify(body)});assert.equal(lost.status,201);await lost.body.cancel();
  const firstCheckpoint=runtime.store.checkpoint(id);runtime.store.saveCheckpoint(id,studentB,{...input('이후 다른 팀원 코드'),baseVersion:1});
  const retried=await c.api(path,{method:'POST',headers:{'Idempotency-Key':key},body});assert.equal(retried.status,201);assert.equal(retried.data.checkpoint.id,firstCheckpoint.id);assert.equal(retried.data.checkpoint.version,1);assert.equal(runtime.store.getProject(id).version,2);assert.equal(runtime.store.getJobs(id).length,2);
  const changed=await c.api(path,{method:'POST',headers:{'Idempotency-Key':key},body:{...body,code:'다른 내용'}});assert.equal(changed.status,409);assert.equal(changed.data.code,'idempotency_key_conflict');assert.equal(runtime.store.getProject(id).version,2);
});

test('같은 키의 동시 요청은 단일 저장 결과를 공유하고 JSON 키 순서는 영향을 주지 않는다',async(t)=>{
  const {client,runtime}=await httpFixture(t),c=client();await c.login('student-a');const id=(await c.api('/projects')).data.projects[0].id,body=input('동시 재시도'),headers={'Idempotency-Key':'concurrent-checkpoint-key'};
  const [a,b]=await Promise.all([c.api(`/projects/${id}/checkpoints`,{method:'POST',body,headers}),c.api(`/projects/${id}/checkpoints`,{method:'POST',body:{evidence:body.evidence,message:body.message,baseVersion:body.baseVersion,code:body.code},headers})]);assert.equal(a.status,201);assert.equal(b.status,201);assert.deepEqual(a.data,b.data);assert.equal(runtime.store.checkpoints(id).length,2);assert.equal(runtime.store.getJobs(id).length,1);
});

test('제안과 반영, 질문과 교사 피드백은 재전송되어도 중복되지 않는다',async(t)=>{
  const {client,runtime}=await httpFixture(t),a=client(),b=client(),tc=client();await a.login('student-a');await b.login('student-b');await tc.login('teacher');const id=(await a.api('/projects')).data.projects[0].id;
  const proposalRequest={method:'POST',body:{...input('검토할 코드'),title:'근거를 담은 제안'},headers:{'Idempotency-Key':'proposal-retry-key'}},first=await a.api(`/projects/${id}/proposals`,proposalRequest),again=await a.api(`/projects/${id}/proposals`,proposalRequest);assert.equal(first.status,201);assert.deepEqual(again,first);assert.equal(runtime.store.proposals(id).length,1);
  const proposalId=first.data.proposal.id;await b.api(`/projects/${id}/proposals/${proposalId}/reviews`,{method:'POST',body:{decision:'approve'}});
  const mergeRequest={method:'POST',body:{},headers:{'Idempotency-Key':'merge-retry-key'}},merged=await tc.api(`/projects/${id}/proposals/${proposalId}/merge`,mergeRequest),remerged=await tc.api(`/projects/${id}/proposals/${proposalId}/merge`,mergeRequest);assert.equal(merged.status,200);assert.deepEqual(remerged,merged);assert.equal(runtime.store.checkpoints(id).length,2);assert.equal(runtime.store.getJobs(id).length,1);
  for(const [suffix,body,key] of [['issues',{title:'관찰 질문',body:'변수를 바꾸면 어떻게 되나요?'},'issue-retry-key'],['feedback',{comment:'변수의 관계를 더 살펴보세요.',studentId:'student-a'},'feedback-retry-key']]) {const request={method:'POST',body,headers:{'Idempotency-Key':key}},one=await tc.api(`/projects/${id}/${suffix}`,request),two=await tc.api(`/projects/${id}/${suffix}`,request);assert.equal(one.status,201);assert.deepEqual(two,one);}
  assert.equal(runtime.store.issues(id).length,1);assert.equal(runtime.store.feedback(id).length,1);
});

test('요청 키는 계정에 격리되고 다른 경로나 내용으로 재사용하면 거부한다',async(t)=>{
  const {client,runtime}=await httpFixture(t),a=client(),b=client();await a.login('student-a');await b.login('student-b');const id=(await a.api('/projects')).data.projects[0].id,key='same-key-different-users',body={title:'각자 남긴 질문',body:'가설을 비교합니다.'},headers={'Idempotency-Key':key};
  const first=await a.api(`/projects/${id}/issues`,{method:'POST',body,headers}),second=await b.api(`/projects/${id}/issues`,{method:'POST',body,headers});assert.equal(first.status,201);assert.equal(second.status,201);assert.notEqual(first.data.issue.id,second.data.issue.id);assert.equal(runtime.store.issues(id).length,2);
  const reused=await a.api(`/projects/${id}/proposals`,{method:'POST',body:{...input(),title:'다른 경로'},headers});assert.equal(reused.status,409);assert.equal(reused.data.code,'idempotency_key_conflict');assert.equal(runtime.store.proposals(id).length,0);
});

test('요청 결과 기록 실패는 확정 코드·이력·아웃박스를 함께 롤백한다',async(t)=>{
  const {client,runtime}=await httpFixture(t),c=client();await c.login('student-a');const id=(await c.api('/projects')).data.projects[0].id,request={method:'POST',body:input('원자적 저장'),headers:{'Idempotency-Key':'atomic-operation-key'}};
  runtime.store.db.exec("CREATE TRIGGER reject_operation BEFORE INSERT ON operations BEGIN SELECT RAISE(ABORT,'결과 기록 오류'); END");
  assert.equal((await c.api(`/projects/${id}/checkpoints`,request)).status,500);assert.equal(runtime.store.getProject(id).version,0);assert.equal(runtime.store.checkpoints(id).length,1);assert.equal(runtime.store.getJobs(id).length,0);assert.equal(runtime.store.db.prepare('SELECT COUNT(*) AS count FROM operations').get().count,0);
  runtime.store.db.exec('DROP TRIGGER reject_operation');assert.equal((await c.api(`/projects/${id}/checkpoints`,request)).status,201);assert.equal(runtime.store.getProject(id).version,1);
});

test('서버 재시작 후 요청 결과가 남으며 내부 트랜잭션 실패를 savepoint로 분리한다',()=>{
  const dir=mkdtempSync(join(tmpdir(),'vpylab-operation-')),filename=join(dir,'state.sqlite');let store;
  try {store=createStore({filename,localMode:true});const id=store.listProjects(teacher)[0].id,operation={userId:studentA.id,key:'restart-operation-key',method:'POST',path:`/projects/${id}/checkpoints`,requestHash:'hash'};const first=store.operation(operation,()=>({status:201,body:{checkpoint:store.saveCheckpoint(id,studentA,input('재시작을 견딘 코드'))}}));store.close();store=createStore({filename,localMode:true});const replay=store.operation(operation,()=>{throw new Error('재실행하면 안 됩니다.');});assert.deepEqual(replay.body,first.body);assert.equal(replay.replayed,true);assert.equal(store.getProject(id).version,1);
    store.transaction(()=>{assert.throws(()=>store.transaction(()=>{store.db.prepare('UPDATE projects SET title=? WHERE id=?').run('롤백할 이름',id);throw new Error('내부 실패');}),/내부 실패/);assert.notEqual(store.getProject(id).title,'롤백할 이름');store.db.prepare('UPDATE projects SET title=? WHERE id=?').run('외부 작업은 완료',id);});assert.equal(store.getProject(id).title,'외부 작업은 완료');
  }finally{store?.close();rmSync(dir,{recursive:true,force:true});}
});

test('readiness는 실제 저장 테이블과 최신 코드 일치를 확인하고 liveness와 구분한다',async(t)=>{
  const {client,runtime}=await httpFixture(t),c=client();assert.equal((await c.api('/health')).status,200);const ready=await c.api('/readiness');assert.equal(ready.status,200);assert.equal(ready.data.checks.database,'ok');
  const project=runtime.store.listProjects(teacher)[0];runtime.store.db.prepare('UPDATE projects SET code=? WHERE id=?').run('이력과 불일치하는 변경',project.id);const unready=await c.api('/readiness');assert.equal(unready.status,503);assert.equal(unready.data.ok,false);assert.equal((await c.api('/health')).status,200);
});

test('개별 피드백은 대상 학생과 참여 교사에게만 보이고 팀 피드백은 팀에 공개한다',async(t)=>{
  const {client,runtime}=await httpFixture(t),teacherClient=client(),a=client(),b=client();await teacherClient.login('teacher');await a.login('student-a');await b.login('student-b');const id=(await a.api('/projects')).data.projects[0].id;
  const privateA=await teacherClient.api(`/projects/${id}/feedback`,{method:'POST',body:{studentId:'student-a',comment:'학생 가에게만 전달하는 개별 피드백',criteria:{reasoning:'가설의 근거를 함께 검토합니다.'}}}),privateB=await teacherClient.api(`/projects/${id}/feedback`,{method:'POST',body:{studentId:'student-b',comment:'학생 나에게만 전달하는 개별 피드백'}}),team=await teacherClient.api(`/projects/${id}/feedback`,{method:'POST',body:{comment:'팀 전체가 확인하는 피드백'}});
  assert.equal(privateA.status,201);assert.equal(privateB.status,201);assert.equal(team.status,201);
  for(const [c,allowed,excluded] of [[a,privateA.data.feedback.id,privateB.data.feedback.id],[b,privateB.data.feedback.id,privateA.data.feedback.id]]) {
    const detail=await c.api(`/projects/${id}`),exported=await c.api(`/projects/${id}/export`);
    for(const data of [detail.data,exported.data]) {assert.equal(data.feedback.length,2);assert.ok(data.feedback.some(item=>item.id===allowed));assert.ok(data.feedback.some(item=>item.id===team.data.feedback.id));assert.ok(data.feedback.every(item=>item.id!==excluded));}
  }
  assert.equal((await teacherClient.api(`/projects/${id}`)).data.feedback.length,3);assert.equal((await teacherClient.api('/teacher')).data.projects.find(project=>project.id===id).feedback.length,3);
  const uninvitedTeacher=runtime.store.ensureUser({id:'private-other-teacher',name:'다른 교사',role:'teacher'});assert.throws(()=>runtime.store.feedback(id,uninvitedTeacher),error=>error.code==='access_denied');
});

test('새 탭에서도 같은 계정의 최신 초안을 찾고 현재 탭의 초안을 우선한다',async(t)=>{
  const {client,runtime}=await httpFixture(t),c=client();await c.login('student-a');const id=(await c.api('/projects')).data.projects[0].id;
  await c.api(`/projects/${id}/drafts`,{method:'PUT',body:{code:'전날 닫은 탭의 코드',baseVersion:0,clientSequence:8,clientId:'yesterday-tab'}});
  const recovered=await c.api(`/projects/${id}/drafts?clientId=new-tab`);assert.equal(recovered.status,200);assert.equal(recovered.data.draft.code,'전날 닫은 탭의 코드');assert.equal(recovered.data.recoveredFromClientId,'yesterday-tab');
  assert.equal(runtime.store.draft(id,studentA,'new-tab'),null);
  const forked=await c.api(`/projects/${id}/drafts`,{method:'PUT',body:{code:'새 탭에서 이어 쓴 코드',baseVersion:0,clientSequence:1,clientId:'new-tab'}});assert.equal(forked.status,200);assert.equal(runtime.store.draft(id,studentA,'yesterday-tab').code,'전날 닫은 탭의 코드');
  await c.api(`/projects/${id}/drafts`,{method:'PUT',body:{code:'이전 탭도 독립적으로 수정',baseVersion:0,clientSequence:9,clientId:'yesterday-tab'}});
  const exact=await c.api(`/projects/${id}/drafts?clientId=new-tab`);assert.equal(exact.data.draft.code,'새 탭에서 이어 쓴 코드');assert.equal(exact.data.recoveredFromClientId,null);
  const latest=await c.api(`/projects/${id}/drafts?clientId=another-day-tab`);assert.equal(latest.data.draft.code,'이전 탭도 독립적으로 수정');assert.equal(latest.data.recoveredFromClientId,'yesterday-tab');
});

test('초안 목록은 프로젝트와 계정에 격리하고 최신 스무 개까지만 반환한다',async(t)=>{
  const {client,runtime}=await httpFixture(t),a=client(),b=client();await a.login('student-a');await b.login('student-b');const id=(await a.api('/projects')).data.projects[0].id;
  for(let index=0;index<22;index++)runtime.store.saveDraft(id,studentA,{code:`학생 가의 초안 ${index}`,baseVersion:0,clientSequence:1},`tab-${index}`);
  const other=runtime.store.createProject(studentA,{title:'다른 프로젝트',code:''});runtime.store.saveDraft(other.id,studentA,{code:'다른 프로젝트의 초안',baseVersion:0,clientSequence:1},'other-project');
  assert.equal((await b.api(`/projects/${id}/drafts?clientId=fresh-tab`)).data.draft,null);assert.deepEqual((await b.api(`/projects/${id}/drafts/list`)).data.drafts,[]);
  runtime.store.saveDraft(id,studentB,{code:'학생 나의 코드',baseVersion:0,clientSequence:1},'tab-21');
  const list=await a.api(`/projects/${id}/drafts/list`);assert.equal(list.data.drafts.length,20);assert.equal(list.data.drafts[0].clientId,'tab-21');assert.ok(list.data.drafts.every(draft=>draft.userId==='student-a'&&draft.projectId===id));assert.ok(list.data.drafts.every(draft=>draft.code!=='학생 나의 코드'&&draft.code!=='다른 프로젝트의 초안'));
  const bList=await b.api(`/projects/${id}/drafts/list`);assert.equal(bList.data.drafts.length,1);assert.equal(bList.data.drafts[0].code,'학생 나의 코드');
  runtime.store.addMember(id,teacher,studentB.id,'viewer');assert.equal((await b.api(`/projects/${id}/drafts?clientId=tab-21`)).data.draft,null);assert.deepEqual((await b.api(`/projects/${id}/drafts/list`)).data.drafts,[]);
});

test('다른 탭에서 계정이 바뀌면 읽기 요청도 이전 계정의 화면에 데이터를 넘기지 않는다',async(t)=>{
  const {client}=await httpFixture(t),c=client(),anonymous=client();await c.login('student-a');const id=(await c.api('/projects')).data.projects[0].id;await c.login('student-b');
  for(const path of ['/bootstrap',`/projects/${id}/drafts?clientId=tab`,`/projects/${id}/drafts/list`,`/projects/${id}/export`]) {const stale=await c.api(path,{headers:{'X-Classroom-User':'student-a'}});assert.equal(stale.status,409,path);assert.equal(stale.data.code,'session_changed');assert.equal(stale.data.projects,undefined);assert.equal(stale.data.draft,undefined);assert.equal(stale.data.checkpoints,undefined);}
  for(const path of ['/bootstrap',`/projects/${id}/drafts`,`/projects/${id}/export`]) {const expired=await anonymous.api(path,{headers:{'X-Classroom-User':'student-a'}});assert.equal(expired.status,401,path);assert.equal(expired.data.code,'session_changed');}
  const session=await anonymous.api('/session');assert.equal(session.status,200);assert.equal(session.data.user,null);
});

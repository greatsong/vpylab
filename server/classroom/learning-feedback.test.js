import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStore, DEMO_USERS } from './store.js';
import { createClassroomApp } from './app.js';
import { verifiedGitHubIdentity } from './learning-feedback.js';
import { initGitHubLearningSchema } from './github-learning.js';

const [teacher,studentA,studentB]=DEMO_USERS;
function githubIdentity(id,login='actual-github-user') {return {provider:'github',identity_data:{sub:String(id),user_name:login}};}
function seedEvent(store,projectId,{id='gh-'+randomUUID(),authorId=910000002,login='demo-student-a',kind='pull_request',title='관찰을 담은 제안',body='변경 전후의 결과를 비교했습니다.',occurredAt='2026-10-28T01:00:00.000Z',source='simulator',metadata={}}={}) {
  initGitHubLearningSchema(store.db);store.db.prepare('INSERT INTO github_learning_events(id,project_id,source_key,repository_id,installation_id,kind,action,title,body,url,sha,github_author_id,github_author_login,occurred_at,received_at,source,metadata) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(id,projectId,id,1,1,kind,'opened',title,body,'https://github.com/local-classroom/team/pull/1','a'.repeat(40),authorId,login,occurredAt,occurredAt,source,JSON.stringify({simulated:source==='simulator',...metadata}));return id;
}
async function fixture(t,options={}) {
  const runtime=createClassroomApp({localMode:true,...options}),server=runtime.app.listen(0,'127.0.0.1');await once(server,'listening');const origin=`http://127.0.0.1:${server.address().port}`;
  t.after(async()=>{await runtime.githubService.stopWorker();await new Promise(resolve=>server.close(resolve));runtime.store.close();});
  const apiFor=(userId,{token}={})=>{
    const cookie=userId&&!token?'vpylab_v2_session='+runtime.store.createSession(userId):'';
    return async(path,{method='GET',body,headers={}}={})=>{const response=await fetch(origin+'/api/v2'+path,{method,headers:{origin,...(cookie?{cookie}:{}),...(userId?{'X-Classroom-User':userId}:{}),...(token?{authorization:'Bearer '+token}:{}),...(body!==undefined?{'content-type':'application/json'}:{}),...headers},...(body!==undefined?{body:JSON.stringify(body)}:{})});return {status:response.status,data:await response.json()};};
  };
  return {...runtime,apiFor,id:runtime.store.listProjects(teacher)[0]?.id};
}

test('GitHub 숫자 ID는 검증된 provider identity에서만 읽고 로그인 이름으로 추측하지 않는다',()=>{
  assert.deepEqual(verifiedGitHubIdentity([githubIdentity(123,'renamed-login')]),{githubId:123,login:'renamed-login'});
  for(const identities of [[{provider:'email',identity_data:{sub:'123',user_name:'same'}}],[{provider:'github',identity_data:{user_name:'same'}}],[{provider:'github',id:'123',identity_data:{user_name:'same'}}],[githubIdentity('9007199254740993')],[githubIdentity(-1)],[{provider:'github',identity_data:{sub:'123',provider_id:'456'}}],[githubIdentity(123),githubIdentity(456)]])assert.equal(verifiedGitHubIdentity(identities),null);
});

test('운영 로그인은 Supabase가 검증한 identity만 자동 연결하고 요청·프로필 위조는 무시한다',async(t)=>{
  const users={valid:{id:'real-a',name:'학습자 가',role:'student',authUser:{id:'real-a',identities:[githubIdentity(81001,'verified-login')]}},spoof:{id:'real-b',name:'학습자 나',role:'student',githubId:81001,authUser:{id:'real-b',identities:[{provider:'email',identity_data:{sub:'81001'}}],user_metadata:{provider_id:'81001',user_name:'verified-login'}}}};
  const {store,apiFor}=await fixture(t,{localMode:false,verifyToken:async(token)=>users[token]});const a=apiFor('real-a',{token:'valid'}),b=apiFor('real-b',{token:'spoof'});
  assert.equal((await a('/session')).status,200);assert.equal(store.githubIdentity('real-a').githubId,81001);assert.equal(store.githubIdentity('real-a').source,'supabase_verified');
  assert.equal((await b('/session',{headers:{'X-GitHub-User':'81001'}})).status,200);assert.equal(store.githubIdentity('real-b'),null);
  assert.equal((await b('/projects',{method:'POST',body:{title:'위조 연결 시도',githubId:81001,githubLogin:'verified-login'}})).status,201);assert.equal(store.githubIdentity('real-b'),null);
  assert.throws(()=>store.syncGitHubIdentity('real-b',[githubIdentity(81001)]),error=>error.code==='github_identity_conflict');assert.equal(store.githubIdentity('real-a').githubId,81001);
});

test('학생은 자신의 근거·다음 질문을 보고 팀 기록은 작성자 숫자 ID로만 구분한다',async(t)=>{
  const {store,apiFor,id}=await fixture(t),a=apiFor(studentA.id),tc=apiFor(teacher.id),own=seedEvent(store,id,{authorId:910000002,login:'새로-바뀐-이름'}),peer=seedEvent(store,id,{authorId:910000003,kind:'review'}),unknown=seedEvent(store,id,{authorId:null,login:'demo-student-a',kind:'commit'});
  const data=await a(`/projects/${id}/learning`);assert.equal(data.status,200);assert.equal(data.data.mode,'simulator');assert.equal(data.data.students.length,1);assert.equal(data.data.students[0].userId,studentA.id);assert.deepEqual(data.data.students[0].evidenceIds,[own]);assert.equal(data.data.students[0].identity.source,'local_demo');assert.equal(data.data.students[0].prompts.length,5);assert.equal(data.data.events.find(event=>event.id===peer).authorUserId,studentB.id);assert.equal(data.data.events.find(event=>event.id===unknown).authorUserId,null);
  assert.equal(data.data.students[0].summary.score,undefined);assert.ok(data.data.students[0].summary.limitations.some(value=>value.includes('자동 판정하지 않습니다')));
  const mine=await a(`/projects/${id}/learning-evidence?scope=mine`),team=await a(`/projects/${id}/learning-evidence?scope=team`);assert.deepEqual(mine.data.events.map(event=>event.id),[own]);assert.equal(team.data.events.length,3);
  assert.equal((await a(`/projects/${id}/student-evidence/${studentA.id}`)).status,200);assert.equal((await a(`/projects/${id}/student-evidence/${studentB.id}`)).status,403);assert.equal((await tc(`/projects/${id}/student-evidence/${studentB.id}`)).status,200);assert.equal((await tc(`/projects/${id}/learning`)).data.students.length,2);
});

test('교사 개인 관찰 기록은 작성 교사만 보고 학생 공유·팀 공유 범위를 구분한다',async(t)=>{
  const {store,apiFor,id}=await fixture(t),otherTeacher=store.ensureUser({id:'teacher-two',name:'함께 참여한 교사',role:'teacher'});store.joinProject(otherTeacher,store.getProject(id).inviteCode);const tc=apiFor(teacher.id),other=apiFor(otherTeacher.id),a=apiFor(studentA.id),b=apiFor(studentB.id),evidenceId=seedEvent(store,id);
  const notes=[{visibility:'private',studentId:studentA.id,comment:'작성 교사만 보는 개인 관찰',evidenceIds:[evidenceId]},{visibility:'student',studentId:studentA.id,comment:'학생 가에게 전달할 다음 질문',evidenceIds:[evidenceId]},{visibility:'team',comment:'팀 모두가 확인하는 관찰',evidenceIds:[evidenceId]}];
  const created=[];for(const body of notes){const result=await tc(`/projects/${id}/feedback`,{method:'POST',body});assert.equal(result.status,201);created.push(result.data.feedback);}
  const otherNote=await other(`/projects/${id}/feedback`,{method:'POST',body:{visibility:'private',studentId:studentA.id,comment:'두 번째 교사의 비공개 관찰'}});assert.equal(otherNote.status,201);
  for(const [api,visible,hidden] of [[tc,[created[0].id,created[1].id,created[2].id],[otherNote.data.feedback.id]],[other,[otherNote.data.feedback.id,created[1].id,created[2].id],[created[0].id]],[a,[created[1].id,created[2].id],[created[0].id,otherNote.data.feedback.id]],[b,[created[2].id],[created[0].id,created[1].id,otherNote.data.feedback.id]]]) {
    for(const suffix of ['', '/export']) {const detail=await api(`/projects/${id}${suffix}`);assert.equal(detail.status,200);assert.deepEqual(new Set(detail.data.feedback.map(item=>item.id)),new Set(visible));assert.ok(detail.data.feedback.every(item=>!hidden.includes(item.id)));}
  }
  const ownEvidence=await a(`/projects/${id}/student-evidence/${studentA.id}`);assert.ok(ownEvidence.data.feedback.every(item=>item.visibility!=='private'));
  const dashboard=await other('/teacher');assert.ok(dashboard.data.projects.find(project=>project.id===id).feedback.every(item=>item.id!==created[0].id));
  assert.equal(store.getJobs(id).length,0);assert.ok(!JSON.stringify((await tc(`/projects/${id}/learning`)).data.events).includes('작성 교사만 보는 개인 관찰'));
});

test('근거는 같은 프로젝트의 사건만 참조하며 오래된 근거 요약도 피드백에 보존한다',async(t)=>{
  const {store,apiFor,id}=await fixture(t),tc=apiFor(teacher.id),a=apiFor(studentA.id),oldId=seedEvent(store,id,{title:'옛 PR 원문 근거',occurredAt:'2026-01-01T00:00:00.000Z'});
  const saved=await tc(`/projects/${id}/feedback`,{method:'POST',body:{visibility:'student',studentId:studentA.id,comment:'이 근거에서 선택 이유를 찾아보세요.',evidenceIds:[oldId]}});assert.equal(saved.status,201);assert.deepEqual(saved.data.feedback.evidenceIds,[oldId]);assert.equal(saved.data.feedback.evidence[0].title,'옛 PR 원문 근거');
  for(let index=0;index<201;index++)seedEvent(store,id,{title:`최근 근거 ${index}`,occurredAt:'2026-10-28T00:00:00.000Z'});
  const learning=await a(`/projects/${id}/learning`);assert.equal(learning.data.events.length,200);assert.ok(!learning.data.events.some(event=>event.id===oldId));assert.equal(learning.data.hasMore,true);
  const exported=await a(`/projects/${id}/export`);assert.equal(exported.data.feedback[0].evidence[0].id,oldId);assert.equal(exported.data.feedback[0].evidence[0].title,'옛 PR 원문 근거');
  const another=store.createProject(teacher,{title:'다른 프로젝트',code:''}),foreignId=seedEvent(store,another.id);
  for(const body of [{studentId:studentA.id,comment:'다른 프로젝트 근거',evidenceIds:[foreignId]},{studentId:studentA.id,comment:'없는 근거',evidenceIds:['not-found']},{studentId:studentA.id,comment:'중복 근거',evidenceIds:[oldId,oldId]},{visibility:'private',comment:'대상을 지정하지 않은 관찰'}])assert.equal((await tc(`/projects/${id}/feedback`,{method:'POST',body})).status,422);
  assert.equal(store.feedback(id,teacher).length,1);assert.equal((await a(`/projects/${id}/feedback`,{method:'POST',body:{studentId:studentA.id,comment:'교사 기록 위조',visibility:'private'}})).status,403);
});

test('검증한 GitHub 연결과 비공개 기록·근거 스냅샷은 재시작 후 유지된다',()=>{
  const directory=mkdtempSync(join(tmpdir(),'vpylab-learning-')),filename=join(directory,'state.sqlite');let store;
  try {store=createStore({filename,localMode:true});const id=store.listProjects(teacher)[0].id;initGitHubLearningSchema(store.db);const evidenceId=seedEvent(store,id);const note=store.addFeedback(id,teacher,{studentId:studentA.id,comment:'재시작 후에도 비공개',visibility:'private',evidenceIds:[evidenceId]});store.close();store=createStore({filename});assert.equal(store.githubIdentity(studentA.id).githubId,910000002);assert.equal(store.feedback(id,teacher)[0].id,note.id);assert.equal(store.feedback(id,teacher)[0].evidence[0].id,evidenceId);assert.deepEqual(store.feedback(id,studentA),[]);assert.equal(store.getJobs(id).length,0);}finally{store?.close();rmSync(directory,{recursive:true,force:true});}
});


test('App 봇 PR은 실제 GitHub 작성자와 검증된 VPyLab 제출자를 구분하고 위조 metadata는 무시한다',async(t)=>{
  const {store,apiFor,id}=await fixture(t),a=apiFor(studentA.id),job=store.enqueueJob({projectId:id,kind:'proposal',payload:{authorId:studentA.id,code:'검증할 코드'},dedupeKey:'requester-proof-job'}),metadata={serviceGenerated:true,jobId:job.id,requestedByUserId:studentA.id};
  const submitted=seedEvent(store,id,{source:'app',authorId:998877,login:'vpylab[bot]',metadata}),forgedWebhook=seedEvent(store,id,{source:'webhook',authorId:998877,login:'vpylab[bot]',metadata}),wrongRequester=seedEvent(store,id,{source:'app',authorId:null,metadata:{...metadata,requestedByUserId:studentB.id}});
  const another=store.createProject(teacher,{title:'다른 팀 작업',code:''}),foreignJob=store.enqueueJob({projectId:another.id,kind:'proposal',payload:{authorId:studentA.id},dedupeKey:'foreign-requester-job'}),foreign=seedEvent(store,id,{source:'app',authorId:null,metadata:{...metadata,jobId:foreignJob.id}});
  const mine=await a(`/projects/${id}/learning-evidence?scope=mine`);assert.equal(mine.status,200);assert.deepEqual(mine.data.events.map(event=>event.id),[submitted]);const event=mine.data.events[0];assert.equal(event.githubAuthorId,998877);assert.equal(event.authorUserId,null);assert.equal(event.requestedByUserId,studentA.id);assert.equal(event.requestedByName,studentA.name);assert.equal(event.attributionLabel,'VPyLab 제출자');
  const own=await a(`/projects/${id}/student-evidence/${studentA.id}`);assert.equal(own.data.summary.evidenceCount,1);assert.deepEqual(own.data.events.map(item=>item.id),[submitted]);
  const team=await a(`/projects/${id}/learning`);for(const eventId of [forgedWebhook,wrongRequester,foreign])assert.equal(team.data.events.find(item=>item.id===eventId).requestedByUserId,null);
  const sameAuthor=seedEvent(store,id,{source:'simulator',authorId:910000002,metadata});const updated=await a(`/projects/${id}/student-evidence/${studentA.id}`);assert.equal(updated.data.events.filter(item=>item.id===sameAuthor).length,1);assert.equal(store.githubIdentity(studentA.id).githubId,910000002);
});

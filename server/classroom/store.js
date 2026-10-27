import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { verifiedGitHubIdentity, summarizeLearningEvidence } from './learning-feedback.js';

export class HttpError extends Error {
  constructor(status, code, message, extra = {}) { super(message); Object.assign(this, { status, code, extra }); }
}
export const now = () => new Date().toISOString();
const parse = (value, fallback = null) => value ? JSON.parse(value) : fallback;
const encode = (value) => JSON.stringify(value);
export const publicUser = ({ id, name, role }) => ({ id, name, role });
export const DEMO_USERS = [
  { id: 'teacher', name: '선생님', role: 'teacher' },
  { id: 'student-a', name: '학생 가', role: 'student' },
  { id: 'student-b', name: '학생 나', role: 'student' },
];
const starterCode = 'from vpython import *\n\nscene.background = color.white\nball = sphere(pos=vector(0, 0, 0), radius=0.5, color=color.blue)\nground = box(pos=vector(0, -1, 0), size=vector(8, 0.2, 4), color=color.green)\n';

export function createStore({ filename = ':memory:', localMode = false } = {}) {
  if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true });
  const db = new DatabaseSync(filename);
  db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,name TEXT NOT NULL,role TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS github_identities(user_id TEXT PRIMARY KEY REFERENCES users(id),github_id INTEGER NOT NULL UNIQUE,github_login TEXT,source TEXT NOT NULL,verified_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS operations(user_id TEXT NOT NULL REFERENCES users(id),operation_key TEXT NOT NULL,method TEXT NOT NULL,path TEXT NOT NULL,request_hash TEXT NOT NULL,status INTEGER NOT NULL,response TEXT NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(user_id,operation_key));
    CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),expires_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS projects(id TEXT PRIMARY KEY,title TEXT NOT NULL,problem TEXT NOT NULL,success_criteria TEXT NOT NULL,code TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 0,owner_id TEXT NOT NULL REFERENCES users(id),invite_code TEXT NOT NULL UNIQUE,ai_policy TEXT NOT NULL DEFAULT 'optional',source TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS members(project_id TEXT REFERENCES projects(id),user_id TEXT REFERENCES users(id),role TEXT NOT NULL,PRIMARY KEY(project_id,user_id));
    CREATE TABLE IF NOT EXISTS checkpoints(id TEXT PRIMARY KEY,project_id TEXT REFERENCES projects(id),version INTEGER NOT NULL,code TEXT NOT NULL,message TEXT NOT NULL,evidence TEXT NOT NULL,author_id TEXT REFERENCES users(id),created_at TEXT NOT NULL,UNIQUE(project_id,version));
    CREATE TABLE IF NOT EXISTS drafts(project_id TEXT REFERENCES projects(id),user_id TEXT REFERENCES users(id),client_id TEXT NOT NULL,code TEXT NOT NULL,base_version INTEGER NOT NULL,client_sequence INTEGER NOT NULL,updated_at TEXT NOT NULL,PRIMARY KEY(project_id,user_id,client_id));
    CREATE TABLE IF NOT EXISTS issues(id TEXT PRIMARY KEY,project_id TEXT REFERENCES projects(id),title TEXT NOT NULL,body TEXT NOT NULL,author_id TEXT REFERENCES users(id),state TEXT NOT NULL DEFAULT 'open',created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS proposals(id TEXT PRIMARY KEY,project_id TEXT REFERENCES projects(id),title TEXT NOT NULL,code TEXT NOT NULL,base_version INTEGER NOT NULL,evidence TEXT NOT NULL,author_id TEXT REFERENCES users(id),state TEXT NOT NULL DEFAULT 'open',created_at TEXT NOT NULL,merged_at TEXT,merged_by TEXT REFERENCES users(id));
    CREATE TABLE IF NOT EXISTS reviews(id TEXT PRIMARY KEY,project_id TEXT REFERENCES projects(id),proposal_id TEXT REFERENCES proposals(id),author_id TEXT REFERENCES users(id),decision TEXT NOT NULL,comment TEXT NOT NULL,created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS feedback(id TEXT PRIMARY KEY,project_id TEXT NOT NULL REFERENCES projects(id),student_id TEXT REFERENCES users(id),teacher_id TEXT NOT NULL REFERENCES users(id),comment TEXT NOT NULL,criteria TEXT NOT NULL,created_at TEXT NOT NULL,visibility TEXT NOT NULL DEFAULT 'team',evidence_ids TEXT NOT NULL DEFAULT '[]',evidence_snapshot TEXT NOT NULL DEFAULT '[]');
    CREATE TABLE IF NOT EXISTS github_bindings(project_id TEXT PRIMARY KEY REFERENCES projects(id),data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS github_jobs(id TEXT PRIMARY KEY,project_id TEXT NOT NULL REFERENCES projects(id),kind TEXT NOT NULL,payload TEXT NOT NULL,state TEXT NOT NULL DEFAULT 'pending',attempts INTEGER NOT NULL DEFAULT 0,available_at TEXT NOT NULL,last_error TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,dedupe_key TEXT UNIQUE);
    CREATE INDEX IF NOT EXISTS checkpoints_project ON checkpoints(project_id,version);
    CREATE INDEX IF NOT EXISTS jobs_pending ON github_jobs(state,available_at);
  `);
  if (!db.prepare('PRAGMA table_info(projects)').all().some(column=>column.name==='source')) db.exec('ALTER TABLE projects ADD COLUMN source TEXT');
  if (!db.prepare('PRAGMA table_info(proposals)').all().some(column=>column.name==='merged_by')) db.exec('ALTER TABLE proposals ADD COLUMN merged_by TEXT REFERENCES users(id)');
  const feedbackColumns=db.prepare('PRAGMA table_info(feedback)').all().map(column=>column.name);
  if(!feedbackColumns.includes('visibility')) {db.exec('ALTER TABLE feedback ADD COLUMN visibility TEXT');db.exec("UPDATE feedback SET visibility=CASE WHEN student_id IS NULL THEN 'team' ELSE 'student' END WHERE visibility IS NULL");}
  if(!feedbackColumns.includes('evidence_ids'))db.exec("ALTER TABLE feedback ADD COLUMN evidence_ids TEXT NOT NULL DEFAULT '[]'");
  if(!feedbackColumns.includes('evidence_snapshot'))db.exec("ALTER TABLE feedback ADD COLUMN evidence_snapshot TEXT NOT NULL DEFAULT '[]'");
  let transactionDepth=0,savepointSerial=0;
  const store = {
    db,
    close() { db.close(); },
    transaction(fn) {
      const nested=transactionDepth>0||db.isTransaction===true, savepoint=`classroom_tx_${++savepointSerial}`;
      db.exec(nested?`SAVEPOINT ${savepoint}`:'BEGIN IMMEDIATE'); transactionDepth++;
      try { const result=fn(); if(result&&typeof result.then==='function')throw new Error('데이터베이스 트랜잭션은 동기 작업만 지원합니다.'); db.exec(nested?`RELEASE SAVEPOINT ${savepoint}`:'COMMIT'); return result; }
      catch(error) { db.exec(nested?`ROLLBACK TO SAVEPOINT ${savepoint}`:'ROLLBACK'); if(nested)db.exec(`RELEASE SAVEPOINT ${savepoint}`); throw error; }
      finally { transactionDepth--; }
    },
    operation({userId,key,method,path,requestHash},execute) {
      return store.transaction(()=>{
        const previous=db.prepare('SELECT * FROM operations WHERE user_id=? AND operation_key=?').get(userId,key);
        if(previous) {
          if(previous.method!==method||previous.path!==path||previous.request_hash!==requestHash)throw new HttpError(409,'idempotency_key_conflict','같은 요청 키에 다른 내용을 사용할 수 없습니다. 새로운 작업으로 다시 시도해주세요.');
          return {status:previous.status,body:parse(previous.response),replayed:true};
        }
        let result;
        try { result=store.transaction(execute); }
        catch(error) { if(error.status>=400&&error.status<500) result={status:error.status,body:{code:error.code||'request_failed',message:error.message,...error.extra}}; else throw error; }
        db.prepare('INSERT INTO operations VALUES(?,?,?,?,?,?,?,?)').run(userId,key,method,path,requestHash,result.status,encode(result.body),now());
        return {...result,replayed:false};
      });
    },
    user(id) { return db.prepare('SELECT * FROM users WHERE id=?').get(id) || null; },
    ensureUser(user) { db.prepare('INSERT INTO users(id,name,role) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,role=excluded.role').run(user.id, user.name, user.role); return store.user(user.id); },
    githubIdentity(userId) { const row=db.prepare('SELECT * FROM github_identities WHERE user_id=?').get(userId); return row?{githubId:row.github_id,login:row.github_login,source:row.source,verifiedAt:row.verified_at}:null; },
    syncGitHubIdentity(userId,identities) {
      const identity=verifiedGitHubIdentity(identities);
      if(!identity){db.prepare('DELETE FROM github_identities WHERE user_id=?').run(userId);return null;}
      const existing=db.prepare('SELECT user_id FROM github_identities WHERE github_id=?').get(identity.githubId);
      if(existing&&existing.user_id!==userId)throw new HttpError(409,'github_identity_conflict','이 GitHub 계정의 연결 상태를 관리자가 확인해야 합니다.');
      db.prepare('INSERT INTO github_identities VALUES(?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET github_id=excluded.github_id,github_login=excluded.github_login,source=excluded.source,verified_at=excluded.verified_at').run(userId,identity.githubId,identity.login,'supabase_verified',now());return store.githubIdentity(userId);
    },
    attributeLearningEvents(id,actor,events) {
      store.accessProject(id,actor);const identities=new Map(db.prepare('SELECT u.id,u.name,g.github_id FROM members m JOIN users u ON u.id=m.user_id JOIN github_identities g ON g.user_id=u.id WHERE m.project_id=?').all(id).map(row=>[row.github_id,row])),members=new Map(store.members(id).map(member=>[member.id,member]));
      const findJob=db.prepare('SELECT kind,payload FROM github_jobs WHERE id=? AND project_id=?');
      return events.map(event=>{
        const author=identities.get(event.githubAuthorId),metadata=event.metadata||{};let requester=null;
        if(['app','simulator'].includes(event.source)&&metadata.serviceGenerated===true&&typeof metadata.jobId==='string'&&typeof metadata.requestedByUserId==='string') {
          const job=findJob.get(metadata.jobId,id),payload=job?parse(job.payload,{}):null;
          if(job&&payload.authorId===metadata.requestedByUserId&&((job.kind==='proposal'&&event.kind==='pull_request')||(job.kind==='issue'&&event.kind==='issue')))requester=members.get(payload.authorId)||null;
        }
        return {...event,authorUserId:author?.id||null,authorName:author?.name||null,requestedByUserId:requester?.id||null,requestedByName:requester?.name||null,attributionLabel:requester?'VPyLab 제출자':author?'GitHub 작성자':null};
      });
    },
    studentEvidence(id,actor,studentId,events,options={}) {
      store.accessProject(id,actor);if(actor.role!=='teacher'&&actor.id!==studentId)throw new HttpError(403,'student_evidence_denied','자신의 학습 근거만 확인할 수 있습니다.');
      const member=store.members(id).find(candidate=>candidate.id===studentId&&candidate.systemRole==='student');if(!member)throw new HttpError(404,'student_not_found','프로젝트에 참여한 학생을 선택해주세요.');
      const attributed=store.attributeLearningEvents(id,actor,events),ownEvents=attributed.filter(event=>event.authorUserId===studentId||event.requestedByUserId===studentId),checkpoints=store.checkpoints(id).filter(item=>item.authorId===studentId),reviews=store.reviews(id).filter(item=>item.authorId===studentId),reflections=checkpoints.filter(item=>Object.values(item.evidence).some(Boolean)).map(item=>({checkpointId:item.id,authorId:item.authorId,version:item.version,...item.evidence,createdAt:item.createdAt}));
      return {student:{id:member.id,name:member.name},githubIdentity:store.githubIdentity(studentId),summary:summarizeLearningEvidence(ownEvents,{checkpoints,reviews,reflections,...options}),events:ownEvents,checkpoints,reviews,reflections,feedback:store.feedback(id,actor).filter(item=>item.visibility==='team'||item.studentId===studentId)};
    },
    users() { return db.prepare('SELECT * FROM users ORDER BY role,name').all().map(publicUser); },
    session(id) { if(!id)return null; const row = db.prepare('SELECT user_id FROM sessions WHERE id=? AND expires_at>?').get(id, now()); return row ? store.user(row.user_id) : null; },
    createSession(userId) { const id = randomUUID() + randomUUID(); db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(id, userId, new Date(Date.now() + 12*60*60*1000).toISOString()); return id; },
    deleteSession(id) { if(id) db.prepare('DELETE FROM sessions WHERE id=?').run(id); },
    getProject(id) { const row = db.prepare('SELECT * FROM projects WHERE id=?').get(id); return row ? projectFrom(row) : null; },
    accessProject(id, actor, {write=false,manage=false}={}) {
      const project = store.getProject(id);
      if (!project) throw new HttpError(404,'project_not_found','프로젝트를 찾을 수 없습니다.');
      const member = db.prepare('SELECT role FROM members WHERE project_id=? AND user_id=?').get(id,actor.id);
      const participating = project.ownerId === actor.id || Boolean(member);
      const myRole = actor.role === 'teacher' && participating ? 'teacher' : (project.ownerId === actor.id ? 'owner' : member?.role);
      if (!myRole || (write && myRole === 'viewer') || (manage && !['teacher','owner'].includes(myRole))) throw new HttpError(403,'access_denied','이 작업을 수행할 권한이 없습니다.');
      return {...project,myRole};
    },
    listProjects(actor) {
      const rows = db.prepare('SELECT DISTINCT p.* FROM projects p LEFT JOIN members m ON m.project_id=p.id WHERE p.owner_id=? OR m.user_id=? ORDER BY p.updated_at DESC').all(actor.id,actor.id);
      return rows.map(row=>store.accessProject(row.id,actor));
    },
    createProject(actor,input) {
      return store.transaction(()=>{
        const id=randomUUID(), timestamp=now(), inviteCode=randomUUID().slice(0,8).toUpperCase();
        db.prepare('INSERT INTO projects(id,title,problem,success_criteria,code,owner_id,invite_code,ai_policy,source,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(id,input.title,input.problem||'',input.successCriteria||'',input.code||'',actor.id,inviteCode,input.aiPolicy||'optional',input.source?encode(input.source):null,timestamp,timestamp);
        db.prepare('INSERT INTO members VALUES(?,?,?)').run(id,actor.id,'owner');
        db.prepare('INSERT INTO checkpoints VALUES(?,?,?,?,?,?,?,?)').run(randomUUID(),id,0,input.code||'','프로젝트 시작',encode({hypothesis:'',observation:'',aiUse:'',reasoning:'',nextStep:''}),actor.id,timestamp);
        return store.accessProject(id,actor);
      });
    },
    joinProject(actor,inviteCode) { const row=db.prepare('SELECT id FROM projects WHERE invite_code=?').get(inviteCode); if(!row) throw new HttpError(404,'invalid_invite','초대 코드를 확인해주세요.'); db.prepare("INSERT OR IGNORE INTO members VALUES(?,?,'editor')").run(row.id,actor.id); return store.accessProject(row.id,actor); },
    updateSettings(id,actor,input) { store.accessProject(id,actor,{manage:true}); const project=store.getProject(id); db.prepare('UPDATE projects SET title=?,problem=?,success_criteria=?,ai_policy=?,updated_at=? WHERE id=?').run(input.title??project.title,input.problem??project.problem,input.successCriteria??project.successCriteria,input.aiPolicy??project.aiPolicy,now(),id); return store.accessProject(id,actor); },
    members(id) { return db.prepare('SELECT u.id,u.name,u.role AS systemRole,m.role FROM members m JOIN users u ON u.id=m.user_id WHERE project_id=?').all(id); },
    addMember(id,actor,userId,role) { const project=store.accessProject(id,actor,{manage:true}); if(!store.user(userId)) throw new HttpError(404,'user_not_found','사용자를 찾을 수 없습니다.'); if(project.ownerId===userId) throw new HttpError(400,'owner_role','프로젝트 소유자의 역할은 변경할 수 없습니다.'); db.prepare('INSERT INTO members VALUES(?,?,?) ON CONFLICT(project_id,user_id) DO UPDATE SET role=excluded.role').run(id,userId,role); return store.members(id); },
    checkpoint(id) { return db.prepare('SELECT * FROM checkpoints WHERE project_id=? ORDER BY version DESC LIMIT 1').get(id) ? checkpointFrom(db.prepare('SELECT * FROM checkpoints WHERE project_id=? ORDER BY version DESC LIMIT 1').get(id)) : null; },
    checkpoints(id) { return db.prepare('SELECT * FROM checkpoints WHERE project_id=? ORDER BY version DESC').all(id).map(checkpointFrom); },
    draft(id,actor,clientId) { const row=db.prepare('SELECT * FROM drafts WHERE project_id=? AND user_id=? AND client_id=?').get(id,actor.id,clientId); return row ? draftFrom(row) : null; },
    latestDraft(id,actor) { const project=store.accessProject(id,actor); if(project.myRole==='viewer')return null; const row=db.prepare('SELECT * FROM drafts WHERE project_id=? AND user_id=? ORDER BY updated_at DESC,rowid DESC LIMIT 1').get(id,actor.id); return row?draftFrom(row):null; },
    listDrafts(id,actor) { const project=store.accessProject(id,actor); if(project.myRole==='viewer')return []; return db.prepare('SELECT * FROM drafts WHERE project_id=? AND user_id=? ORDER BY updated_at DESC,rowid DESC LIMIT 20').all(id,actor.id).map(draftFrom); },
    saveDraft(id,actor,input,clientId) {
      store.accessProject(id,actor,{write:true});
      return store.transaction(()=>{ const previous=store.draft(id,actor,clientId); if(previous && input.clientSequence <= previous.clientSequence) { if(input.clientSequence===previous.clientSequence && input.code===previous.code && input.baseVersion===previous.baseVersion) return previous; throw new HttpError(409,'draft_sequence_conflict','더 최근 초안이 이미 저장되어 있습니다.',{draft:previous}); }
        const latest=db.prepare('SELECT updated_at FROM drafts WHERE project_id=? AND user_id=? ORDER BY updated_at DESC LIMIT 1').get(id,actor.id),timestamp=new Date(Math.max(Date.now(),latest?Date.parse(latest.updated_at)+1:0)).toISOString();
        db.prepare('INSERT INTO drafts VALUES(?,?,?,?,?,?,?) ON CONFLICT(project_id,user_id,client_id) DO UPDATE SET code=excluded.code,base_version=excluded.base_version,client_sequence=excluded.client_sequence,updated_at=excluded.updated_at').run(id,actor.id,clientId,input.code,input.baseVersion,input.clientSequence,timestamp); return store.draft(id,actor,clientId); });
    },
    saveCheckpoint(id,actor,input) {
      return store.transaction(()=>{ const project=store.accessProject(id,actor,{write:true}); return store.writeCheckpoint(project,actor,input); });
    },
    writeCheckpoint(project,actor,input) {
      if(project.version!==input.baseVersion) throw new HttpError(409,'version_conflict','팀의 최신 저장본이 변경되었습니다. 최신 코드와 비교해주세요.',{current:store.checkpoint(project.id)});
      const id=randomUUID(), version=project.version+1,timestamp=now();
      db.prepare('INSERT INTO checkpoints VALUES(?,?,?,?,?,?,?,?)').run(id,project.id,version,input.code,input.message||'실험 결과 저장',encode(input.evidence||{}),actor.id,timestamp);
      const updated=db.prepare('UPDATE projects SET code=?,version=?,updated_at=? WHERE id=? AND version=?').run(input.code,version,timestamp,project.id,input.baseVersion);
      if(updated.changes!==1) throw new HttpError(409,'version_conflict','팀의 최신 저장본이 변경되었습니다.',{current:store.checkpoint(project.id)});
      store.enqueueJob({projectId:project.id,kind:'checkpoint',payload:{checkpointId:id,version,code:input.code,message:input.message||'실험 결과 저장',authorId:actor.id},dedupeKey:`checkpoint:${id}`});
      return store.checkpoint(project.id);
    },
    issues(id) { return db.prepare('SELECT * FROM issues WHERE project_id=? ORDER BY created_at DESC').all(id).map(row=>({id:row.id,projectId:row.project_id,title:row.title,body:row.body,authorId:row.author_id,state:row.state,createdAt:row.created_at})); },
    addIssue(id,actor,input) { store.accessProject(id,actor,{write:true}); const issueId=randomUUID(); db.prepare('INSERT INTO issues VALUES(?,?,?,?,?,?,?)').run(issueId,id,input.title,input.body||'',actor.id,'open',now()); return store.issues(id).find(x=>x.id===issueId); },
    proposals(id) { return db.prepare('SELECT * FROM proposals WHERE project_id=? ORDER BY created_at DESC').all(id).map(proposalFrom); },
    proposal(id,proposalId) { const row=db.prepare('SELECT * FROM proposals WHERE id=? AND project_id=?').get(proposalId,id); if(!row) throw new HttpError(404,'proposal_not_found','제안을 찾을 수 없습니다.'); return proposalFrom(row); },
    addProposal(id,actor,input) { const project=store.accessProject(id,actor,{write:true}); if(project.version!==input.baseVersion) throw new HttpError(409,'version_conflict','최신 저장본을 바탕으로 제안해주세요.',{current:store.checkpoint(id)}); const proposalId=randomUUID(); db.prepare('INSERT INTO proposals(id,project_id,title,code,base_version,evidence,author_id,state,created_at,merged_at,merged_by) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(proposalId,id,input.title,input.code,input.baseVersion,encode(input.evidence||{}),actor.id,'open',now(),null,null); return store.proposal(id,proposalId); },
    reviews(id) { return db.prepare('SELECT * FROM reviews WHERE project_id=? ORDER BY rowid DESC').all(id).map(row=>({id:row.id,projectId:row.project_id,proposalId:row.proposal_id,authorId:row.author_id,decision:row.decision,comment:row.comment,createdAt:row.created_at})); },
    addReview(id,proposalId,actor,input) { store.accessProject(id,actor,{write:true}); const proposal=store.proposal(id,proposalId); if(proposal.state!=='open') throw new HttpError(409,'proposal_closed','이미 종료된 제안입니다.'); if(proposal.authorId===actor.id) throw new HttpError(403,'self_review','자신의 제안은 직접 승인하거나 검토할 수 없습니다.'); const reviewId=randomUUID(); db.prepare('INSERT INTO reviews VALUES(?,?,?,?,?,?,?)').run(reviewId,id,proposalId,actor.id,input.decision,input.comment||'',now()); return store.reviews(id).find(x=>x.id===reviewId); },
    mergeProposal(id,proposalId,actor) { return store.transaction(()=>{ const project=store.accessProject(id,actor,{write:true}), proposal=store.proposal(id,proposalId); if(proposal.state!=='open') throw new HttpError(409,'proposal_closed','이미 종료된 제안입니다.'); const decisions=new Map(),eligibleReviewers=new Set(store.members(id).filter(member=>member.role!=='viewer'||member.systemRole==='teacher').map(member=>member.id)); for(const review of store.reviews(id).filter(x=>x.proposalId===proposalId&&x.authorId!==proposal.authorId&&eligibleReviewers.has(x.authorId))) if(!decisions.has(review.authorId)) decisions.set(review.authorId,review.decision); if(actor.role!=='teacher' && (![...decisions.values()].includes('approve') || [...decisions.values()].includes('request_changes'))) throw new HttpError(403,'review_required','다른 팀원의 승인과 변경 요청 해결이 필요합니다.'); const checkpoint=store.writeCheckpoint(project,store.user(proposal.authorId),{code:proposal.code,baseVersion:proposal.baseVersion,message:`제안 반영: ${proposal.title}`,evidence:proposal.evidence}); db.prepare("UPDATE proposals SET state='merged',merged_at=?,merged_by=? WHERE id=?").run(now(),actor.id,proposalId); return {checkpoint,proposal:store.proposal(id,proposalId)}; }); },
    feedback(id,actor) {
      if(actor)store.accessProject(id,actor);
      return db.prepare('SELECT * FROM feedback WHERE project_id=? ORDER BY rowid DESC').all(id).filter(row=>{
        if(!actor)return true;const visibility=row.visibility||(row.student_id?'student':'team');
        if(visibility==='private')return row.teacher_id===actor.id;
        return visibility==='team'||actor.role==='teacher'||row.student_id===actor.id;
      }).map(row=>({id:row.id,projectId:row.project_id,studentId:row.student_id,teacherId:row.teacher_id,comment:row.comment,criteria:parse(row.criteria,{}),createdAt:row.created_at,visibility:row.visibility||(row.student_id?'student':'team'),evidenceIds:parse(row.evidence_ids,[]),evidence:parse(row.evidence_snapshot,[])}));
    },
    addFeedback(id,actor,input) {
      store.accessProject(id,actor);if(actor.role!=='teacher')throw new HttpError(403,'teacher_required','교사만 피드백을 남길 수 있습니다.');
      if(input.studentId&&!store.members(id).some(member=>member.id===input.studentId&&member.systemRole==='student'))throw new HttpError(422,'invalid_feedback_student','프로젝트에 참여한 학생을 선택해주세요.');
      const visibility=input.visibility||(input.studentId?'student':'team'),evidenceIds=input.evidenceIds||[];
      if(!['private','student','team'].includes(visibility)||(['private','student'].includes(visibility)&&!input.studentId))throw new HttpError(422,'invalid_feedback_visibility','개별 피드백과 관찰 기록에는 대상 학생을 지정해주세요.');
      if(!Array.isArray(evidenceIds)||evidenceIds.length>50||evidenceIds.some(value=>typeof value!=='string'||!value||value.length>200)||new Set(evidenceIds).size!==evidenceIds.length)throw new HttpError(422,'invalid_evidence_ids','근거는 중복 없이 최대 50개까지 선택할 수 있습니다.');
      const hasLedger=db.prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name='github_learning_events'").get(),evidence=[];
      for(const evidenceId of evidenceIds){const row=hasLedger?db.prepare('SELECT id,kind,title,url,sha,source FROM github_learning_events WHERE project_id=? AND id=?').get(id,evidenceId):null;if(!row)throw new HttpError(422,'invalid_feedback_evidence','현재 프로젝트에서 수집한 학습 근거를 선택해주세요.');evidence.push({...row});}
      const feedbackId=randomUUID();db.prepare('INSERT INTO feedback(id,project_id,student_id,teacher_id,comment,criteria,created_at,visibility,evidence_ids,evidence_snapshot) VALUES(?,?,?,?,?,?,?,?,?,?)').run(feedbackId,id,input.studentId||null,actor.id,input.comment,encode(input.criteria||{}),now(),visibility,encode(evidenceIds),encode(evidence));return store.feedback(id,actor).find(item=>item.id===feedbackId);
    },
    getGithub(id) { const row=db.prepare('SELECT data FROM github_bindings WHERE project_id=?').get(id); return row ? parse(row.data) : null; },
    setGithub(id,data) { db.prepare('INSERT INTO github_bindings VALUES(?,?) ON CONFLICT(project_id) DO UPDATE SET data=excluded.data').run(id,encode(data)); return data; },
    enqueueJob({projectId,kind,payload,dedupeKey}) { const id=randomUUID(),timestamp=now(); db.prepare('INSERT OR IGNORE INTO github_jobs(id,project_id,kind,payload,available_at,created_at,updated_at,dedupe_key) VALUES(?,?,?,?,?,?,?,?)').run(id,projectId,kind,encode(payload),timestamp,timestamp,timestamp,dedupeKey||null); return store.getJobs(projectId).find(x=>x.id===id)||store.getJobs(projectId).find(x=>x.dedupeKey===dedupeKey); },
    getJobs(id) { return db.prepare('SELECT * FROM github_jobs WHERE project_id=? ORDER BY created_at DESC').all(id).map(row=>({id:row.id,projectId:row.project_id,kind:row.kind,payload:parse(row.payload,{}),state:row.state,attempts:row.attempts,availableAt:row.available_at,lastError:row.last_error,createdAt:row.created_at,updatedAt:row.updated_at,dedupeKey:row.dedupe_key})); },
    detail(id,actor) { const project=store.accessProject(id,actor); return {project,members:store.members(id),checkpoint:store.checkpoint(id),checkpoints:store.checkpoints(id),issues:store.issues(id),proposals:store.proposals(id),reviews:store.reviews(id),feedback:store.feedback(id,actor),reflections:store.checkpoints(id).filter(x=>Object.values(x.evidence).some(Boolean)).map(x=>({checkpointId:x.id,authorId:x.authorId,version:x.version,...x.evidence,createdAt:x.createdAt})),github:store.getGithub(id),jobs:store.getJobs(id)}; },
    teacherOverview(actor) { if(actor.role!=='teacher') throw new HttpError(403,'teacher_required','교사만 확인할 수 있습니다.'); return {projects:store.listProjects(actor).map(project=>{ const detail=store.detail(project.id,actor); return {...project,memberCount:detail.members.length,checkpointCount:detail.checkpoints.length,issueCount:detail.issues.length,proposalCount:detail.proposals.length,reviewCount:detail.reviews.length,feedback:detail.feedback,reflections:detail.reflections,latestCheckpoint:detail.checkpoint}; }),criteria:['문제 정의와 성공 기준','가설과 실험의 연결','관찰을 바탕으로 한 수정','동료 의견에 대한 응답','다음 실험 계획']}; },
  };
  if(localMode) {
    for(const [index,user] of DEMO_USERS.entries()) {store.ensureUser(user);db.prepare('INSERT INTO github_identities VALUES(?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET github_id=excluded.github_id,github_login=excluded.github_login,source=excluded.source,verified_at=excluded.verified_at').run(user.id,910000001+index,`demo-${user.id}`,'local_demo',now());}
    if(!db.prepare('SELECT id FROM projects LIMIT 1').get()) {
      const project=store.createProject(DEMO_USERS[0],{title:'우리 팀의 첫 번째 3D 실험',problem:'물체의 움직임을 관찰하고 설명할 수 있는 실험을 만듭니다.',successCriteria:'실험 조건을 바꾸고 결과를 비교하여 자신의 설명을 남깁니다.',code:starterCode,aiPolicy:'optional'});
      store.addMember(project.id,DEMO_USERS[0],'student-a','editor'); store.addMember(project.id,DEMO_USERS[0],'student-b','editor');
    }
  }
  return store;
}
function projectFrom(r) { return {id:r.id,title:r.title,problem:r.problem,successCriteria:r.success_criteria,code:r.code,version:r.version,ownerId:r.owner_id,inviteCode:r.invite_code,aiPolicy:r.ai_policy,source:parse(r.source),createdAt:r.created_at,updatedAt:r.updated_at}; }
function checkpointFrom(r) { return {id:r.id,projectId:r.project_id,version:r.version,code:r.code,message:r.message,evidence:parse(r.evidence,{}),authorId:r.author_id,createdAt:r.created_at}; }
function draftFrom(r) { return {projectId:r.project_id,userId:r.user_id,clientId:r.client_id,code:r.code,baseVersion:r.base_version,clientSequence:r.client_sequence,updatedAt:r.updated_at}; }
function proposalFrom(r) { return {id:r.id,projectId:r.project_id,title:r.title,code:r.code,baseVersion:r.base_version,evidence:parse(r.evidence,{}),authorId:r.author_id,state:r.state,createdAt:r.created_at,mergedAt:r.merged_at,mergedBy:r.merged_by}; }

import express from 'express';
import { createHash } from 'node:crypto';
import helmet from 'helmet';
import cors from 'cors';
import { rateLimit, ipKeyGenerator } from 'express-rate-limit';
import { createClient } from '@supabase/supabase-js';
import { createStore, HttpError, DEMO_USERS, publicUser } from './store.js';
import { createGitHubService, createGitHubRouter, createGitHubWebhookRouter } from './github.js';

const COOKIE = 'vpylab_v2_session';
const loopback = (value) => ['127.0.0.1','::1','::ffff:127.0.0.1'].includes(value);
function cookieValue(req) { const match=req.headers.cookie?.split(';').map(x=>x.trim()).find(x=>x.startsWith(`${COOKIE}=`)); return match?.slice(COOKIE.length+1); }
function field(value, name, {required=false,max=5000}={}) { if(typeof value!=='string' || value.length>max || (required && !value.trim())) throw new HttpError(422,'invalid_input',`${name} 항목을 확인해주세요. 최대 ${max}자까지 입력할 수 있습니다.`); return value; }
function optionalField(value,name,options) { return value===undefined ? undefined : field(value,name,options); }
function code(value) { field(value,'코드',{max:50*1024}); if(Buffer.byteLength(value,'utf8')>50*1024) throw new HttpError(422,'code_too_large','코드는 50KB까지 저장할 수 있습니다.'); return value; }
function version(value) { if(!Number.isSafeInteger(value)||value<0) throw new HttpError(422,'invalid_version','저장본 번호를 확인해주세요.'); return value; }
function policy(value) { if(!['optional','disabled'].includes(value)) throw new HttpError(422,'invalid_ai_policy','AI 사용 정책을 확인해주세요.'); return value; }
function evidence(value={}) { if(!value || typeof value!=='object' || Array.isArray(value)) throw new HttpError(422,'invalid_evidence','실험 기록을 확인해주세요.'); return Object.fromEntries(['hypothesis','observation','aiUse','reasoning','nextStep'].map(key=>[key,field(value[key]??'','실험 기록',{max:10000})])); }
function source(value) { if(value===undefined||value===null)return null; if(!value||typeof value!=='object'||!['lesson','mission','example','reference'].includes(value.kind))throw new HttpError(422,'invalid_source','수업 자료의 출처를 확인해주세요.'); return {kind:value.kind,id:field(value.id,'자료 번호',{required:true,max:200}),title:field(value.title,'자료 제목',{required:true,max:300}),...(value.courseId?{courseId:field(value.courseId,'과정 번호',{max:200})}:{})}; }
function canonical(value) { if(Array.isArray(value))return '['+value.map(canonical).join(',')+']'; if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonical(value[key])).join(',')+'}'; return JSON.stringify(value); }
function clientId(req) { return field(req.body?.clientId??req.query.clientId??req.headers['x-client-id']??'default','편집 창 식별자',{required:true,max:200}); }

export function createClassroomApp({store:providedStore,filename,localMode=false,allowedOrigins=['http://127.0.0.1:4043','http://localhost:4043'],verifyToken,githubConfig,fetchImpl,githubService:providedGithubService}={}) {
  const store=providedStore||createStore({filename,localMode});
  const app=express();
  const githubService=providedGithubService||createGitHubService({store,localMode,config:githubConfig,fetchImpl});
  app.disable('x-powered-by');
  app.use(helmet());
  app.use((req,res,next)=>{ if(localMode && (!loopback(req.socket.remoteAddress)||!['127.0.0.1','localhost','[::1]','::1'].includes(req.hostname)))return next(new HttpError(403,'local_only','로컬 수업 서버는 이 컴퓨터의 localhost 주소에서만 사용할 수 있습니다.')); next(); });
  app.use(cors({origin(origin,callback){callback(null,!origin||allowedOrigins.includes(origin));},credentials:true}));
  app.use(rateLimit({windowMs:60000,limit:6000,standardHeaders:'draft-8',legacyHeaders:false,message:{code:'rate_limited',message:'요청이 많습니다. 잠시 후 다시 시도해주세요.'}}));
  app.use('/api/v2',createGitHubWebhookRouter({service:githubService}));
  app.use(express.json({limit:'256kb'}));
  app.use((req,res,next)=>{
    if(!['GET','HEAD','OPTIONS'].includes(req.method)) {
      const origin=req.headers.origin;
      const ownOrigin=`${req.protocol}://${req.headers.host}`;
      if(!origin || (origin!==ownOrigin && !allowedOrigins.includes(origin))) return next(new HttpError(403,'origin_denied','허용된 수업 화면에서 요청해주세요.'));
      if(!req.is('application/json') && req.method!=='DELETE') return next(new HttpError(415,'json_required','JSON 요청이 필요합니다.'));
    }
    next();
  });
  let supabase;
  const tokenVerifier=verifyToken||async function(token) {
    if(!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) throw new HttpError(503,'auth_unavailable','Supabase 인증 설정이 필요합니다.');
    supabase??=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data,error}=await supabase.auth.getUser(token);
    if(error||!data.user) throw new HttpError(401,'invalid_session','로그인 정보를 다시 확인해주세요.');
    return {id:data.user.id,name:data.user.user_metadata?.display_name||data.user.email?.split('@')[0]||'학습자',role:data.user.app_metadata?.classroom_role==='teacher'?'teacher':'student',authUser:data.user};
  };
  app.use(async(req,res,next)=>{
    try {
      if(localMode) req.actor=store.session(cookieValue(req));
      else { const token=/^Bearer (.+)$/i.exec(req.headers.authorization||'')?.[1]; if(token) { const verified=await tokenVerifier(token); if(!verified?.id) throw new HttpError(401,'invalid_session','로그인 정보를 확인해주세요.'); req.actor=store.transaction(()=>{const actor=store.ensureUser({id:verified.id,name:typeof verified.name==='string'?verified.name.slice(0,120):'학습자',role:verified.role==='teacher'?'teacher':'student'});if(verified.authUser){if(verified.authUser.id!==verified.id)throw new HttpError(401,'invalid_identity','인증된 GitHub 연결 정보를 확인해주세요.');if(Array.isArray(verified.authUser.identities))store.syncGitHubIdentity(actor.id,verified.authUser.identities);}return actor;}); } }
      if(req.headers['x-classroom-user']!==undefined) { if(!req.actor)throw new HttpError(401,'session_changed','로그인이 만료되었거나 계정이 변경되었습니다. 현재 화면을 새로 열어주세요.'); if(req.headers['x-classroom-user']!==req.actor.id)throw new HttpError(409,'session_changed','로그인 계정이 변경되었습니다. 현재 화면을 새로 열어주세요.'); }
      next();
    } catch(error) { next(error); }
  });
  app.use(rateLimit({windowMs:60000,limit:1200,keyGenerator:req=>req.actor?`user:${req.actor.id}`:ipKeyGenerator(req.ip),skip:req=>!req.actor,standardHeaders:'draft-8',legacyHeaders:false,message:{code:'rate_limited',message:'요청이 많습니다. 잠시 후 다시 시도해주세요.'}}));
  const requireActor=(req,res,next)=>req.actor?next():next(new HttpError(401,'authentication_required','먼저 로그인해주세요.'));
  const api=express.Router();
  const mutate=(status,handler)=>(req,res)=>{
    const key=req.headers['idempotency-key'];
    if(key!==undefined&&(typeof key!=='string'||! /^[A-Za-z0-9][A-Za-z0-9._:-]{7,199}$/.test(key)))throw new HttpError(422,'invalid_idempotency_key','요청 키는 영문·숫자·구분자로 8~200자까지 지정할 수 있습니다.');
    if(req.params.id)store.accessProject(req.params.id,req.actor);
    const execute=()=>({status,body:handler(req)});
    const result=key?store.operation({userId:req.actor.id,key,method:req.method,path:req.originalUrl.split('?')[0],requestHash:createHash('sha256').update(canonical(req.body??null)).digest('hex')},execute):execute();
    if(result.replayed)res.setHeader('Idempotency-Replayed','true');
    res.status(result.status).json(result.body);
  };
  const learningData=req=>{
    if(typeof githubService.listLearningEvents!=='function')throw new HttpError(503,'learning_unavailable','GitHub 학습 기록을 준비하고 있습니다. 로컬 저장은 계속 사용할 수 있습니다.');
    const result=githubService.listLearningEvents(req.params.id,req.actor),sync=result.sync||{state:'never'};
    return {...result,events:store.attributeLearningEvents(req.params.id,req.actor,result.events||[]),mode:githubService.mode||'offline',authMethod:githubService.status?.(req.params.id,req.actor)?.authMethod||githubService.mode||'offline',sync:{...sync,lastSyncedAt:sync.completedAt||null,partial:sync.state==='partial'||Boolean(result.hasMore),error:sync.errorCode||null}};
  };
  api.get('/projects/:id/learning',requireActor,(req,res)=>{
    const data=learningData(req),students=store.members(req.params.id).filter(member=>member.systemRole==='student'&&(req.actor.role==='teacher'||member.id===req.actor.id)).map(member=>{
      const own=store.studentEvidence(req.params.id,req.actor,member.id,data.events,{hasMore:data.hasMore,coverageNotice:data.coverageNotice});
      return {userId:member.id,name:member.name,identity:own.githubIdentity,evidenceIds:own.events.map(event=>event.id),prompts:own.summary.nextQuestions,summary:own.summary,feedback:own.feedback};
    });
    res.json({...data,students,unattributedCount:data.events.filter(event=>!event.authorUserId&&!event.requestedByUserId).length});
  });
  api.get('/projects/:id/learning-evidence',requireActor,(req,res)=>{
    const scope=req.query.scope||'mine';if(!['mine','team'].includes(scope))throw new HttpError(422,'invalid_learning_scope','본인 또는 팀 기록 범위를 선택해주세요.');
    const data=learningData(req);res.json({...data,scope,events:scope==='mine'?data.events.filter(event=>event.authorUserId===req.actor.id||event.requestedByUserId===req.actor.id):data.events,githubIdentity:store.githubIdentity(req.actor.id),unattributedCount:data.events.filter(event=>!event.authorUserId&&!event.requestedByUserId).length,notice:'숫자 GitHub ID를 검증한 계정만 연결합니다. 기록 건수는 성적이나 사고력의 점수가 아닙니다.'});
  });
  api.get('/projects/:id/student-evidence/:studentId',requireActor,(req,res)=>{
    const data=learningData(req),own=store.studentEvidence(req.params.id,req.actor,req.params.studentId,data.events,{hasMore:data.hasMore,coverageNotice:data.coverageNotice});res.json({...own,mode:data.mode,sync:data.sync,hasMore:data.hasMore,coverageNotice:data.coverageNotice});
  });
  api.get('/health',(req,res)=>res.json({ok:true,service:'vpylab-classroom-v2',localMode,storage:'sqlite',githubMode:githubService.mode||'offline'}));
  api.get('/readiness',(req,res)=>{
    const checks={database:'unavailable',authentication:localMode?'local':'missing_configuration'};
    try {
      const broken=store.db.prepare('SELECT p.id FROM projects p LEFT JOIN checkpoints c ON c.project_id=p.id AND c.version=p.version WHERE c.id IS NULL OR p.code!=c.code LIMIT 1').get();
      if(broken)throw new Error('저장본 불일치');checks.database='ok';
      if(!localMode&&!verifyToken&&(!process.env.SUPABASE_URL||!process.env.SUPABASE_ANON_KEY))return res.status(503).json({ok:false,checks});
      checks.authentication=localMode?'local':'configured';res.json({ok:true,checks});
    }catch{res.status(503).json({ok:false,checks});}
  });
  api.get('/session',(req,res)=>res.json({user:req.actor?publicUser(req.actor):null,localMode,users:localMode?store.users():[]}));
  api.post('/session/local',(req,res)=>{
    if(!localMode) throw new HttpError(404,'local_session_disabled','이 서버에서는 데모 로그인을 사용할 수 없습니다.');
    const user=DEMO_USERS.find(x=>x.id===req.body.userId);
    if(!user) throw new HttpError(422,'invalid_user','제공된 데모 계정을 선택해주세요.');
    store.deleteSession(cookieValue(req));
    res.cookie(COOKIE,store.createSession(user.id),{httpOnly:true,sameSite:'strict',secure:false,path:'/api/v2',maxAge:12*60*60*1000});
    res.json({user:publicUser(user),localMode});
  });
  api.delete('/session',(req,res)=>{store.deleteSession(cookieValue(req));res.clearCookie(COOKIE,{httpOnly:true,sameSite:'strict',path:'/api/v2'});res.json({user:null,localMode});});
  api.get('/bootstrap',(req,res)=>res.json({user:req.actor?publicUser(req.actor):null,role:req.actor?.role||null,localMode,users:localMode?store.users():[],projects:req.actor?store.listProjects(req.actor):[]}));
  api.get('/projects',requireActor,(req,res)=>res.json({projects:store.listProjects(req.actor)}));
  api.post('/projects',requireActor,mutate(201,req=>{
    const input={title:field(req.body.title,'프로젝트 이름',{required:true,max:120}),problem:field(req.body.problem??'','문제 정의',{max:10000}),successCriteria:field(req.body.successCriteria??'','성공 기준',{max:10000}),code:code(req.body.code??''),aiPolicy:policy(req.body.aiPolicy??'optional'),source:source(req.body.source)};
    return {project:store.createProject(req.actor,input)};
  }));
  api.post('/projects/join',requireActor,mutate(200,req=>({project:store.joinProject(req.actor,field(req.body.inviteCode,'초대 코드',{required:true,max:100}).trim().toUpperCase())})));
  api.get('/projects/:id',requireActor,(req,res)=>res.json(store.detail(req.params.id,req.actor)));
  api.patch('/projects/:id/settings',requireActor,mutate(200,req=>{
    const input={title:optionalField(req.body.title,'프로젝트 이름',{required:true,max:120}),problem:optionalField(req.body.problem,'문제 정의',{max:10000}),successCriteria:optionalField(req.body.successCriteria,'성공 기준',{max:10000}),aiPolicy:req.body.aiPolicy===undefined?undefined:policy(req.body.aiPolicy)};
    return {project:store.updateSettings(req.params.id,req.actor,input)};
  }));
  api.get('/projects/:id/drafts/list',requireActor,(req,res)=>res.json({drafts:store.listDrafts(req.params.id,req.actor)}));
  api.get('/projects/:id/drafts',requireActor,(req,res)=>{
    const project=store.accessProject(req.params.id,req.actor),exact=project.myRole==='viewer'?null:store.draft(req.params.id,req.actor,clientId(req)),draft=exact||store.latestDraft(req.params.id,req.actor);
    res.json({draft,checkpoint:store.checkpoint(req.params.id),recoveredFromClientId:!exact&&draft?draft.clientId:null});
  });
  api.put('/projects/:id/drafts',requireActor,mutate(200,req=>({draft:store.saveDraft(req.params.id,req.actor,{code:code(req.body.code),baseVersion:version(req.body.baseVersion),clientSequence:version(req.body.clientSequence)},clientId(req))})));
  api.post('/projects/:id/checkpoints',requireActor,mutate(201,req=>{
    const checkpoint=store.saveCheckpoint(req.params.id,req.actor,{code:code(req.body.code),baseVersion:version(req.body.baseVersion),message:field(req.body.message??'','저장 설명',{max:2000}),evidence:evidence(req.body.evidence)});
    return {checkpoint,project:store.accessProject(req.params.id,req.actor)};
  }));
  api.post('/projects/:id/issues',requireActor,mutate(201,req=>({issue:store.addIssue(req.params.id,req.actor,{title:field(req.body.title,'질문 제목',{required:true,max:200}),body:field(req.body.body??'','질문 내용',{max:10000})})})));
  api.post('/projects/:id/proposals',requireActor,mutate(201,req=>({proposal:store.addProposal(req.params.id,req.actor,{title:field(req.body.title,'제안 제목',{required:true,max:200}),code:code(req.body.code),baseVersion:version(req.body.baseVersion),evidence:evidence(req.body.evidence)})})));
  api.post('/projects/:id/proposals/:proposalId/reviews',requireActor,mutate(201,req=>{
    if(!['approve','request_changes'].includes(req.body.decision))throw new HttpError(422,'invalid_decision','검토 결과를 선택해주세요.');
    return {review:store.addReview(req.params.id,req.params.proposalId,req.actor,{decision:req.body.decision,comment:field(req.body.comment??'','검토 의견',{max:10000})})};
  }));
  api.post('/projects/:id/proposals/:proposalId/merge',requireActor,mutate(200,req=>({...store.mergeProposal(req.params.id,req.params.proposalId,req.actor),project:store.accessProject(req.params.id,req.actor)})));
  api.post('/projects/:id/members',requireActor,mutate(200,req=>{
    if(!['editor','viewer'].includes(req.body.role))throw new HttpError(422,'invalid_role','편집자 또는 관찰자를 선택해주세요.');
    return {members:store.addMember(req.params.id,req.actor,field(req.body.userId,'사용자',{required:true,max:200}),req.body.role)};
  }));
  api.post('/projects/:id/feedback',requireActor,mutate(201,req=>{
    const criteria={};
    if(req.body.criteria!==undefined&&(!req.body.criteria||typeof req.body.criteria!=='object'||Array.isArray(req.body.criteria)))throw new HttpError(422,'invalid_criteria','평가 영역별 의견을 확인해주세요.');
    for(const key of ['problem','experiment','reasoning','collaboration','nextStep'])if(req.body.criteria?.[key]!==undefined)criteria[key]=field(req.body.criteria[key],'평가 영역 의견',{max:2000});
    return {feedback:store.addFeedback(req.params.id,req.actor,{studentId:req.body.studentId==null||req.body.studentId===''?undefined:field(req.body.studentId,'학생 식별자',{required:true,max:200}),comment:field(req.body.comment,'교사 피드백',{required:true,max:2000}),criteria,visibility:optionalField(req.body.visibility,'공개 범위',{required:true,max:20}),evidenceIds:req.body.evidenceIds??[]})};
  }));
  api.get('/projects/:id/export',requireActor,(req,res)=>{const detail=store.detail(req.params.id,req.actor);res.setHeader('Content-Disposition',`attachment; filename="vpylab-${req.params.id}.json"`);res.json({schemaVersion:2,exportedAt:new Date().toISOString(),...detail});});
  api.get('/teacher',requireActor,(req,res)=>res.json(store.teacherOverview(req.actor)));
  app.use('/api/v2',api);
  app.use('/api/v2',createGitHubRouter({store,requireActor,localMode,service:githubService}));
  app.use((req,res)=>res.status(404).json({code:'not_found',message:'요청한 기능을 찾을 수 없습니다.'}));
  app.use((error,req,res,next)=>{if(res.headersSent)return next(error); const status=error.status||((error.type==='entity.too.large')?413:500);res.status(status).json({code:error.code||'server_error',message:status>=500?'요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.':error.message,...error.extra});});
  return {app,store,githubService,requireActor};
}

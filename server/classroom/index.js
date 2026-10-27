import dotenv from 'dotenv';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClassroomApp } from './app.js';

// 이전 운영 환경 파일 대신 새 교실 전용 설정만 읽습니다.
dotenv.config({ path: process.env.CLASSROOM_ENV_FILE || '.env.classroom.local', quiet: true });

export function startClassroomServer({port=Number(process.env.CLASSROOM_PORT||4044),localMode=process.env.CLASSROOM_LOCAL_MODE==='1'||process.env.CLASSROOM_MODE==='local',filename=process.env.CLASSROOM_DB_PATH||resolve(fileURLToPath(new URL('../../',import.meta.url)),'.local/classroom-v2.sqlite')}={}) {
  const allowedOrigins=(process.env.CLASSROOM_ALLOWED_ORIGINS||'http://127.0.0.1:4043,http://localhost:4043').split(',').map(x=>x.trim()).filter(Boolean);
  const runtime=createClassroomApp({filename,localMode,allowedOrigins});
  const host=localMode?'127.0.0.1':process.env.CLASSROOM_HOST||'127.0.0.1';
  const server=runtime.app.listen(port,host,()=>process.stdout.write(`VPyLab 새 수업 서버: http://${host}:${server.address().port} (${localMode?'로컬 데모':'Supabase 인증'})\n`));
  runtime.githubService.startWorker();
  let closed=false;
  let closing;
  const close=()=>{if(closed)return closing;closed=true;const serverClosed=new Promise((done)=>server.close(done));closing=Promise.all([runtime.githubService.stopWorker(),serverClosed]).then(()=>runtime.store.close());return closing;};
  return {...runtime,server,close};
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {const runtime=startClassroomServer();process.on('SIGINT',()=>runtime.close());process.on('SIGTERM',()=>runtime.close());}

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createStore, DEMO_USERS } from '../../server/classroom/store.js';
import { snapshotDatabase, verifyDatabase, verifySnapshot, rehearseRestore } from './backup.mjs';

function fixture(t) {const directory=mkdtempSync(join(tmpdir(),'vpylab-backup-test-')),filename=join(directory,'source.sqlite'),store=createStore({filename,localMode:true});t.after(()=>{store.close();rmSync(directory,{recursive:true,force:true});});return {directory,filename,store,id:store.listProjects(DEMO_USERS[0])[0].id};}

test('WAL에 남은 확정 코드·초안·재시도 결과를 일관된 백업으로 보존한다',async(t)=>{
  const {directory,filename,store,id}=fixture(t),student=DEMO_USERS[1];
  store.saveDraft(id,student,{code:'개인 초안',baseVersion:0,clientSequence:1},'tab');
  const checkpoint=store.operation({userId:student.id,key:'backup-operation-key',method:'POST',path:`/projects/${id}/checkpoints`,requestHash:'hash'},()=>({status:201,body:{checkpoint:store.saveCheckpoint(id,student,{code:'WAL 안의 코드',baseVersion:0,message:'관찰 결과',evidence:{observation:'변화를 확인했습니다.'}})}}));
  assert.ok(existsSync(filename+'-wal'));const destination=join(directory,'backup.sqlite'),snapshot=await snapshotDatabase({source:filename,destination});assert.equal(snapshot.counts.checkpoints,4); /* 예시 프로젝트 1개와 동료 리뷰 시험용 팀 2개의 시작 저장본 3개 + 새 저장본 1개 */assert.equal(snapshot.counts.operations,1);assert.equal(snapshot.counts.github_jobs,1);assert.equal(snapshot.counts.drafts,1);assert.equal(verifySnapshot(destination).manifestChecked,true);assert.equal(statSync(destination).mode&0o777,0o600);
  const restored=createStore({filename:destination});try{assert.equal(restored.checkpoint(id).id,checkpoint.body.checkpoint.id);assert.equal(restored.checkpoint(id).code,'WAL 안의 코드');assert.equal(restored.draft(id,student,'tab').code,'개인 초안');assert.equal(restored.operation({userId:student.id,key:'backup-operation-key',method:'POST',path:`/projects/${id}/checkpoints`,requestHash:'hash'},()=>{throw new Error('재실행 금지');}).replayed,true);}finally{restored.close();}
});

test('복구 리허설은 임시 복구본만 쓰고 원본 도메인을 그대로 둔다',async(t)=>{
  const {filename}=fixture(t),before=verifyDatabase(filename),result=await rehearseRestore(filename),after=verifyDatabase(filename);assert.equal(result.ok,true);assert.equal(result.temporaryRestoreOnly,true);assert.equal(result.cleanedUp,true);assert.equal(before.fingerprint,after.fingerprint);assert.equal(before.fingerprint,result.fingerprint);
});

test('기존 백업과 원본 파일의 덮어쓰기를 거부한다',async(t)=>{
  const {directory,filename}=fixture(t),destination=join(directory,'backup.sqlite');await snapshotDatabase({source:filename,destination});const before=readFileSync(destination);await assert.rejects(snapshotDatabase({source:filename,destination}),/덮어쓸 수 없습니다/);await assert.rejects(snapshotDatabase({source:filename,destination:filename}),/덮어쓸 수 없습니다/);assert.deepEqual(readFileSync(destination),before);
});

test('코드와 이력이 불일치하면 손상된 상태를 정상 백업으로 승인하지 않는다',async(t)=>{
  const {directory,filename,store,id}=fixture(t);store.db.prepare('UPDATE projects SET code=? WHERE id=?').run('이력 밖 변경',id);const destination=join(directory,'invalid.sqlite');await assert.rejects(snapshotDatabase({source:filename,destination}),/버전이 일치하지 않습니다/);assert.equal(existsSync(destination),false);
});

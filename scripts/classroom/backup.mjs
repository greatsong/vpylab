import * as sqlite from 'node:sqlite';
import { createHash, randomUUID } from 'node:crypto';
import { chmodSync, closeSync, existsSync, fsyncSync, lstatSync, mkdirSync, mkdtempSync, openSync, readFileSync, readSync, linkSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const requiredTables=['users','sessions','projects','members','checkpoints','drafts','issues','proposals','reviews','feedback','operations','github_bindings','github_jobs'];
const identifier=value=>'"'+value.replaceAll('"','""')+'"';
function hashFile(filename) { const digest=createHash('sha256'),descriptor=openSync(filename,'r'),buffer=Buffer.alloc(64*1024); try {let length;while((length=readSync(descriptor,buffer,0,buffer.length,null))>0)digest.update(buffer.subarray(0,length));return digest.digest('hex');}finally{closeSync(descriptor);} }
function requireFile(filename) { const path=resolve(filename); if(!existsSync(path)||!statSync(path).isFile())throw new Error('원본 데이터베이스 파일을 찾을 수 없습니다.'); return path; }
function syncFile(filename) { const descriptor=openSync(filename,'r');try{fsyncSync(descriptor);}finally{closeSync(descriptor);} }
function syncDirectory(directory) { let descriptor;try{descriptor=openSync(directory,'r');fsyncSync(descriptor);}finally{if(descriptor!==undefined)closeSync(descriptor);} }

export function verifyDatabase(filename) {
  const path=requireFile(filename), db=new sqlite.DatabaseSync(path,{readOnly:true});
  try {
    db.exec('PRAGMA busy_timeout=5000; PRAGMA query_only=ON; BEGIN');
    const integrity=db.prepare('PRAGMA integrity_check').all();
    if(integrity.length!==1||Object.values(integrity[0])[0]!=='ok')throw new Error('데이터베이스 무결성 검사에 실패했습니다.');
    if(db.prepare('PRAGMA foreign_key_check').all().length)throw new Error('데이터베이스 참조 무결성 검사에 실패했습니다.');
    const tables=db.prepare("SELECT name,sql FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
    for(const name of requiredTables)if(!tables.some(table=>table.name===name))throw new Error(`수업 데이터 테이블이 누락되었습니다: ${name}`);
    const broken=db.prepare(`SELECT p.id FROM projects p LEFT JOIN checkpoints c ON c.project_id=p.id AND c.version=p.version
      WHERE c.id IS NULL OR p.code!=c.code OR (SELECT COUNT(*) FROM checkpoints h WHERE h.project_id=p.id)!=p.version+1
      OR EXISTS(SELECT 1 FROM checkpoints h WHERE h.project_id=p.id AND (h.version<0 OR h.version>p.version)) LIMIT 1`).get();
    if(broken)throw new Error('프로젝트 코드와 저장 이력의 버전이 일치하지 않습니다.');
    const counts={},digest=createHash('sha256');
    for(const table of tables) {
      digest.update(table.name+'\n'+table.sql+'\n');counts[table.name]=0;
      for(const row of db.prepare(`SELECT rowid AS __backup_rowid__,* FROM ${identifier(table.name)} ORDER BY rowid`).iterate()) {digest.update(JSON.stringify(row)+'\n');counts[table.name]++;}
    }
    const fingerprint=digest.digest('hex');db.exec('COMMIT');
    return {ok:true,counts,fingerprint,bytes:statSync(path).size};
  }finally{db.close();}
}

export async function snapshotDatabase({source,destination,manifest=true}) {
  if(typeof sqlite.backup!=='function')throw new Error('백업 도구에는 node:sqlite.backup을 제공하는 Node.js 22.16 이상이 필요합니다.');
  const sourcePath=requireFile(source),destinationPath=resolve(destination),manifestPath=destinationPath+'.manifest.json';
  if(sourcePath===destinationPath||existsSync(destinationPath)||existsSync(manifestPath))throw new Error('백업 목적지는 원본과 달라야 하며 기존 파일을 덮어쓸 수 없습니다.');
  mkdirSync(dirname(destinationPath),{recursive:true,mode:0o700});
  const temporary=destinationPath+'.partial-'+randomUUID(),descriptor=openSync(temporary,'wx',0o600);closeSync(descriptor);
  const sourceDb=new sqlite.DatabaseSync(sourcePath,{readOnly:true});
  try {sourceDb.exec('PRAGMA busy_timeout=5000; PRAGMA query_only=ON');await sqlite.backup(sourceDb,temporary,{rate:64});}
  catch(error){rmSync(temporary,{force:true});throw error;}
  finally{sourceDb.close();}
  try {
    chmodSync(temporary,0o600);const verification=verifyDatabase(temporary);syncFile(temporary);
    if(existsSync(destinationPath))throw new Error('백업 중 목적지 파일이 생성되어 작업을 중단했습니다.');
    linkSync(temporary,destinationPath);rmSync(temporary);syncDirectory(dirname(destinationPath));
    const result={format:'vpylab-classroom-sqlite-v2',createdAt:new Date().toISOString(),source:sourcePath,snapshot:destinationPath,sha256:hashFile(destinationPath),...verification};
    if(manifest){writeFileSync(manifestPath,JSON.stringify(result,null,2)+'\n',{flag:'wx',mode:0o600});syncFile(manifestPath);syncDirectory(dirname(manifestPath));}
    return result;
  }catch(error){rmSync(temporary,{force:true});throw error;}
}

export function verifySnapshot(filename) {
  const path=requireFile(filename),result=verifyDatabase(path),manifestPath=path+'.manifest.json';
  if(existsSync(manifestPath)) {
    const manifest=JSON.parse(readFileSync(manifestPath,'utf8'));
    if(manifest.sha256!==hashFile(path)||manifest.fingerprint!==result.fingerprint)throw new Error('백업 파일이 기록된 해시와 일치하지 않습니다.');
  }
  return {...result,manifestChecked:existsSync(manifestPath)};
}

export async function rehearseRestore(source) {
  const sourcePath=requireFile(source),directory=mkdtempSync(join(tmpdir(),'vpylab-restore-'));
  try {
    const backup=await snapshotDatabase({source:sourcePath,destination:join(directory,'snapshot.sqlite')}),restoredPath=join(directory,'restored.sqlite');
    const restored=await snapshotDatabase({source:backup.snapshot,destination:restoredPath,manifest:false});
    if(backup.fingerprint!==restored.fingerprint)throw new Error('복구본의 내용이 백업과 일치하지 않습니다.');
    const db=new sqlite.DatabaseSync(restoredPath);
    try {db.exec('BEGIN IMMEDIATE; CREATE TABLE __restore_probe(value TEXT); INSERT INTO __restore_probe VALUES(\'복구 쓰기 확인\'); ROLLBACK');}finally{db.close();}
    const reopened=verifyDatabase(restoredPath);
    if(reopened.fingerprint!==backup.fingerprint)throw new Error('복구본 재시작 검증에 실패했습니다.');
    return {ok:true,source:sourcePath,temporaryRestoreOnly:true,cleanedUp:true,counts:reopened.counts,fingerprint:reopened.fingerprint};
  }finally{rmSync(directory,{recursive:true,force:true});}
}

function usage() {return `수업 데이터 백업 도구 (Node.js 22.16 이상)\n\n  node scripts/classroom/backup.mjs snapshot --db .local/classroom-v2.sqlite --out .local/backups/수업전.sqlite\n  node scripts/classroom/backup.mjs verify --db .local/backups/수업전.sqlite\n  node scripts/classroom/backup.mjs rehearse --db .local/classroom-v2.sqlite\n\n스냅샷은 SQLite online backup API를 사용합니다. rehearse는 임시 폴더에서만 복구하며 원본은 변경하지 않습니다.\n`;}
async function main(args) {
  if(!args.length||args.includes('--help')){process.stdout.write(usage());return;}
  const [command,...remaining]=args,options={};
  for(let index=0;index<remaining.length;index+=2) {const option=remaining[index],value=remaining[index+1];if(!['--db','--out'].includes(option)||!value||value.startsWith('--'))throw new Error('명령 형식을 확인해주세요. --help로 사용법을 볼 수 있습니다.');options[option.slice(2)]=value;}
  if(!options.db)throw new Error('--db로 원본 또는 검증할 데이터베이스를 지정해주세요.');
  let result;
  if(command==='snapshot') {if(!options.out)throw new Error('--out으로 새 백업 파일 경로를 지정해주세요.');result=await snapshotDatabase({source:options.db,destination:options.out});}
  else if(command==='verify')result=verifySnapshot(options.db);
  else if(command==='rehearse')result=await rehearseRestore(options.db);
  else throw new Error('snapshot, verify, rehearse 중 하나를 선택해주세요.');
  process.stdout.write(JSON.stringify(result,null,2)+'\n');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main(process.argv.slice(2)).catch(error=>{process.stderr.write(`백업 검증 실패: ${error.message}\n`);process.exitCode=1;});

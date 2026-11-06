import { expect, it, vi } from 'vitest';
import { fetchPublicForgeModules, publishForgeModule, unpublishForgeModule, forkForgeModule } from './registry';
import { builtInModule, moduleProgram, MODULE_PREFIX } from './modules';
function client(result,user={id:'owner'}){
  const q={};for(const key of ['select','eq','like','order','range','insert','update','limit'])q[key]=vi.fn(()=>q);
  q.single=vi.fn(()=>Promise.resolve(result));q.maybeSingle=q.single;q.then=(resolve,reject)=>Promise.resolve(result).then(resolve,reject);
  return {auth:{getUser:vi.fn(async()=>({data:{user}}))},from:vi.fn(()=>q),q};
}
it('공개 모듈만 조회하며 손상되거나 실행 코드뿐인 게시물은 미리보기에서 실행하지 않는다',async()=>{
  const module=builtInModule('cat'),c=client({data:[{id:'public-id',title:'내 고양이',description:'설명',code:moduleProgram(module),author_alias:'별명'},{id:'edited',code:moduleProgram(module)+'\nraise Exception("MUST NOT RUN")'},{id:'bad',code:'print("unsafe")'}]});
  const data=await fetchPublicForgeModules({client:c});expect(c.q.eq).toHaveBeenCalledWith('is_public',true);expect(c.q.like).toHaveBeenCalledWith('code',MODULE_PREFIX+'%');expect(data.modules).toHaveLength(1);expect(data.modules[0].recipe).toEqual(module.recipe);expect(data.modules[0].id).toBe('public-id');
});
it('공개 내리기는 로그인 소유자 필터를 포함하고 실패를 알린다',async()=>{
  const c=client({data:{id:'own-module'}});expect(await unpublishForgeModule('own-module',{client:c})).toBe('own-module');expect(c.q.update).toHaveBeenCalledWith({is_public:false});expect(c.q.eq).toHaveBeenCalledWith('user_id','owner');
  await expect(unpublishForgeModule('other-module',{client:client({data:null})})).rejects.toThrow('내 모듈');
});
it('공개 등록은 인증 소유자와 검증된 레시피로 코드를 재생성한다',async()=>{
  const c=client({data:{id:'published'}}),module=builtInModule('bell');
  const result=await publishForgeModule({...module,code:'unsafe'},{client:c,alias:'방울친구'});
  const record=c.q.insert.mock.calls[0][0];expect(record.user_id).toBe('owner');expect(record.is_public).toBe(true);expect(record.category).toBe('SN');expect(record.author_alias).toBe('방울친구');expect(record.code).toBe(moduleProgram(module));expect(result.recordId).toBe('published');
});
it('로그인 실패나 게시 실패를 성공으로 표시하지 않는다',async()=>{
  const c=client({data:null},null);await expect(publishForgeModule(builtInModule('cat'),{client:c})).rejects.toThrow('로그인');expect(c.from).not.toHaveBeenCalled();
  const failure=client({data:null,error:{message:'RLS'}});await expect(publishForgeModule(builtInModule('cat'),{client:failure})).rejects.toThrow('공개 등록하지 못했습니다');
});
it('포크 시점에 비공개 기록과 원본 스냅샷을 저장한다',async()=>{
  const source=builtInModule('bear'),sourceId='10000000-0000-4000-8000-000000000001';
  const c=client({data:null});const queue=[{data:{id:sourceId,title:'곰 원본',description:'참고',code:moduleProgram(source),author_alias:'첫 제작자',is_public:true}},{data:{id:'new',created_at:'2026-11-07T00:00:00Z'}}];c.q.single.mockImplementation(()=>Promise.resolve(queue.shift()));
  const fork=await forkForgeModule(sourceId,{client:c,alias:'포크한 사람'}),insert=c.q.insert.mock.calls[0][0];
  expect(insert.is_public).toBe(false);expect(insert.remix_from).toBe(sourceId);expect(insert.remix_from_author).toBe('첫 제작자');expect(fork.source.title).toBe('곰 원본');expect(fork.recordId).toBe(insert.id);expect(fork.forkedAt).toBeTruthy();
});
it('다시 공개할 때 내 포크 기록을 갱신하며 원본·참고 프로젝트를 보존한다',async()=>{
  const id='10000000-0000-4000-8000-000000000002',sourceId='10000000-0000-4000-8000-000000000001';
  const module={...builtInModule('cat'),recordId:id,source:{id:sourceId,title:'원본 고양이',author:'원작자'},references:[{title:'참고 작품',url:'https://example.com/project'}]},c=client({data:null});
  const queue=[{data:{id,user_id:'owner',remix_from:sourceId}},{data:{id}}];c.q.single.mockImplementation(()=>Promise.resolve(queue.shift()));
  await publishForgeModule(module,{client:c});expect(c.q.insert).not.toHaveBeenCalled();const update=c.q.update.mock.calls[0][0];expect(update.is_public).toBe(true);expect(update.remix_from_title).toBe('원본 고양이');expect(update.code).toContain('https://example.com/project');
});
it('다른 사람의 기록이나 출처가 바뀐 포크 기록을 덮어쓰지 않는다',async()=>{
  const id='10000000-0000-4000-8000-000000000002',c=client({data:{id,user_id:'other',remix_from:null}});
  await expect(publishForgeModule({...builtInModule('cat'),recordId:id},{client:c})).rejects.toThrow('내 포크 기록');expect(c.q.update).not.toHaveBeenCalled();
});
it('원본 삭제로 FK가 비어도 출처 스냅샷을 보존해 내 포크를 재공개한다',async()=>{
  const id='10000000-0000-4000-8000-000000000002',sourceId='10000000-0000-4000-8000-000000000001';
  const module={...builtInModule('cat'),recordId:id,source:{id:sourceId,title:'삭제된 원본',author:'원작자'}},c=client({data:null});
  const queue=[{data:{id,user_id:'owner',remix_from:null,remix_from_title:'삭제된 원본',remix_from_author:'원작자'}},{data:{id}}];c.q.single.mockImplementation(()=>Promise.resolve(queue.shift()));
  await publishForgeModule(module,{client:c});const record=c.q.update.mock.calls[0][0];expect(record.remix_from).toBeNull();expect(record.remix_from_title).toBe('삭제된 원본');expect(record.code).toContain(sourceId);
});
it('공개 응답이 비었거나 갱신한 행이 다르면 성공을 반환하지 않는다',async()=>{
  await expect(publishForgeModule(builtInModule('cat'),{client:client({data:null})})).rejects.toThrow('공개 등록하지 못했습니다');
  const id='10000000-0000-4000-8000-000000000002',c=client({data:null}),queue=[{data:{id,user_id:'owner',remix_from:null}},{data:{id:'wrong'}}];c.q.single.mockImplementation(()=>Promise.resolve(queue.shift()));
  await expect(publishForgeModule({...builtInModule('cat'),recordId:id},{client:c})).rejects.toThrow('공개 등록하지 못했습니다');
});
it('내 계정 모듈은 실제 공개 상태와 게시 행 ID를 제공한다',async()=>{
  const {fetchOwnForgeModules}=await import('./registry');const module=builtInModule('cat');const c=client({data:[{id:'published-id',code:moduleProgram(module),is_public:true},{id:'private-id',code:moduleProgram(module),is_public:false}]});
  const own=await fetchOwnForgeModules({client:c});expect(own.map(m=>m.published)).toEqual([true,false]);expect(own[0].recordId).toBe('published-id');expect(own[0].publicListing).toBeUndefined();
});

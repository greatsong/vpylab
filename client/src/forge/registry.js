import { supabase } from '../lib/supabase';
import { makeForgeModule, moduleFromPublishedCode, moduleProgram, MODULE_PREFIX } from './modules';

// 기존 게시 테이블과 소유자 RLS를 사용합니다. 공개 코드의 표식으로 모듈만 조회합니다.
export async function fetchPublicForgeModules({page=0,client=supabase}={}) {
  const {data,error}=await client.from('vpylab_gallery')
    .select('id,title,description,code,author_alias,user_id,created_at')
    .eq('is_public',true).like('code',MODULE_PREFIX+'%')
    .order('created_at',{ascending:false}).range(page*12,page*12+11);
  if(error)throw new Error('공개 모듈을 불러오지 못했습니다. 잠시 후 다시 시도하세요.');
  return {modules:(data||[]).flatMap(row=>{
    const module=moduleFromPublishedCode(row.code);
    return module?[{...module,id:row.id,title:row.title,description:row.description,author:row.author_alias||'익명',ownerId:row.user_id,published:true,publicListing:true}]:[];
  }),hasMore:(data||[]).length===12};
}
export async function fetchOwnForgeModules({client=supabase}={}) {
  const {data:{user}}=await client.auth.getUser();if(!user)return [];
  const {data,error}=await client.from('vpylab_gallery').select('id,title,description,code,author_alias,user_id,is_public,created_at').eq('user_id',user.id).like('code',MODULE_PREFIX+'%').order('created_at',{ascending:false}).limit(50);
  if(error)throw new Error('계정에 등록된 모듈 기록을 불러오지 못했습니다.');
  return (data||[]).flatMap(row=>{const module=moduleFromPublishedCode(row.code);return module?[{...module,recordId:row.id,author:row.author_alias||'익명',published:row.is_public,ownerId:user.id}]:[];});
}

export async function publishForgeModule(input,{alias=input.author||'익명',thumbnail=null,client=supabase}={}) {
  const {data:{user},error:authError}=await client.auth.getUser();
  if(authError||!user)throw new Error('로그인한 뒤 공개 등록할 수 있습니다.');
  const module=makeForgeModule(input.recipe,input);
  const record={
    user_id:user.id,title:module.title,description:module.description,code:moduleProgram(module),
    thumbnail,category:module.recipe.presetId==='bell'?'SN':'CR',is_public:true,author_alias:String(alias).slice(0,80),
    remix_from:module.source?.id||null,remix_from_title:module.source?.title||null,remix_from_author:module.source?.author||null,
  };
  if(!moduleFromPublishedCode(record.code))throw new Error('모듈 내용을 확인하지 못했습니다. 참고 기록과 모양을 확인하세요.');
  let query;
  if(module.recordId){
    const {data:existing,error:readError}=await client.from('vpylab_gallery').select('id,user_id,remix_from,remix_from_title,remix_from_author,author_alias').eq('id',module.recordId).eq('user_id',user.id).single();
    const deletedSource=existing?.remix_from===null&&module.source&&existing.remix_from_title===module.source.title&&existing.remix_from_author===module.source.author;
    if(readError||!existing||existing.user_id!==user.id||(!deletedSource&&(existing.remix_from||null)!==(module.source?.id||null)))throw new Error('내 포크 기록과 원본 출처를 확인할 수 없습니다. 원본에서 다시 포크해 주세요.');
    if(deletedSource)record.remix_from=null;
    query=client.from('vpylab_gallery').update(record).eq('id',module.recordId).eq('user_id',user.id);
  }else query=client.from('vpylab_gallery').insert(record);
  const {data,error}=await query.select('id').single();
  if(error||!data||(module.recordId&&data.id!==module.recordId))throw new Error('공개 등록하지 못했습니다. 현재 작업은 그대로 있으니 다시 시도하세요.');
  return {...module,recordId:data.id,author:alias,published:true};
}

// 포크 시점에 비공개 파생 프로젝트를 기록합니다. 공개는 별도 사용자 동작입니다.
export async function forkForgeModule(sourceId,{alias='익명',client=supabase}={}) {
  const {data:{user},error:authError}=await client.auth.getUser();
  if(authError||!user)throw new Error('포크 기록을 남기려면 먼저 로그인하세요.');
  const {data:source,error:sourceError}=await client.from('vpylab_gallery').select('id,title,description,code,author_alias,is_public').eq('id',sourceId).eq('is_public',true).single();
  const original=source&&!sourceError&&source.is_public?moduleFromPublishedCode(source.code):null;
  if(!original)throw new Error('공개된 원본 모듈을 확인할 수 없습니다. 목록을 새로 불러오세요.');
  const id=crypto.randomUUID(),module=makeForgeModule(original.recipe,{id,recordId:id,title:source.title+' · 내 포크',description:source.description,source:{id:source.id,title:source.title,author:source.author_alias||'익명'},references:original.references});
  const code=moduleProgram(module);if(!moduleFromPublishedCode(code))throw new Error('포크할 모듈 내용을 확인하지 못했습니다.');
  const {data,error}=await client.from('vpylab_gallery').insert({id,user_id:user.id,title:module.title,description:module.description,code,category:module.recipe.presetId==='bell'?'SN':'CR',is_public:false,author_alias:String(alias).slice(0,80),remix_from:source.id,remix_from_title:module.source.title,remix_from_author:module.source.author}).select('id,created_at').single();
  if(error||!data)throw new Error('포크 기록을 저장하지 못했습니다. 원본은 바뀌지 않았습니다. 다시 시도하세요.');
  return {...module,forkedAt:data.created_at};
}

export async function unpublishForgeModule(id,{client=supabase}={}) {
  const {data:{user},error:authError}=await client.auth.getUser();
  if(authError||!user)throw new Error('로그인한 뒤 내 모듈을 비공개로 바꿀 수 있습니다.');
  const {data,error}=await client.from('vpylab_gallery').update({is_public:false}).eq('id',id).eq('user_id',user.id).select('id').maybeSingle();
  if(error||!data)throw new Error('내 모듈의 공개 상태를 바꾸지 못했습니다. 다시 시도하세요.');
  return data.id;
}

// Supabase SQL Editor에 붙여넣을 마이그레이션 SQL을 출력합니다.
// 절대 service role key를 코드나 명령어에 넣지 마세요.
//   SUPABASE_PROJECT_REF=xxxx node supabase/run-migration.mjs
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(join(__dirname, 'migrations/001_vpylab_schema.sql'), 'utf-8');

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || 'your-project-ref';

// SQL을 여러 문장으로 나눠서 실행할 수 없으므로,
// Supabase의 pg_net이나 RPC를 사용해야 함
// 대안: service_role로 Supabase SQL Editor API 호출

// Supabase에는 직접 SQL 실행 REST API가 없으므로,
// pg 패키지로 직접 연결하거나 Supabase Dashboard에서 실행해야 함

// 간단한 방법: 각 SQL문을 REST API의 rpc로 실행
// 하지만 가장 확실한 방법은 대시보드의 SQL Editor 사용

console.log('=== VPy Lab DB 마이그레이션 SQL ===');
console.log('');
console.log('Supabase 대시보드의 SQL Editor에서 실행해주세요:');
console.log(`https://supabase.com/dashboard/project/${PROJECT_REF}/sql/new`);
console.log('');
console.log('--- SQL 시작 ---');
console.log(sql);
console.log('--- SQL 끝 ---');

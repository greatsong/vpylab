#!/usr/bin/env node
/**
 * VPyLab — Phase 1~3 마이그레이션 적용 스크립트
 *
 * 사용법:
 *   1) Supabase PAT(Personal Access Token)이 있다면 자동 적용:
 *        export SUPABASE_ACCESS_TOKEN=sbp_xxxxxxxxxxxxxxxxx
 *        node scripts/apply-migrations.mjs
 *      (PAT은 https://supabase.com/dashboard/account/tokens 에서 발급)
 *
 *   2) PAT이 없으면 Dashboard SQL Editor URL을 출력 → 클릭해서 붙여넣고 Run:
 *        node scripts/apply-migrations.mjs
 *
 *   3) 특정 마이그레이션만 적용하려면:
 *        node scripts/apply-migrations.mjs 010_team_projects.sql
 */
import { readFileSync, readdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_REF = 'fipdcjhtfslinfmalwjn';
const MIGRATIONS_DIR = join(__dirname, '..', 'supabase', 'migrations');

// Plan C에서 새로 추가된 마이그레이션들 (이전 것은 이미 적용된 것으로 가정)
const PLAN_C_MIGRATIONS = [
  '009_code_revisions.sql',
  '010_team_projects.sql',
  '011_github_sync.sql',
];

function listAvailable() {
  return readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();
}

function dashboardUrl() {
  return `https://supabase.com/dashboard/project/${PROJECT_REF}/sql/new`;
}

async function applyViaPAT(token, sql, label) {
  const url = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });
  const text = await res.text();
  if (!res.ok) {
    let errMsg = text;
    try { errMsg = JSON.parse(text).message || JSON.parse(text).error || text; } catch { /* */ }
    throw new Error(`[${label}] HTTP ${res.status}: ${errMsg}`);
  }
  return text;
}

async function main() {
  const arg = process.argv[2];
  let targets;

  if (arg) {
    targets = [arg];
  } else {
    targets = PLAN_C_MIGRATIONS.filter(f => listAvailable().includes(f));
  }

  if (targets.length === 0) {
    console.error('적용할 마이그레이션을 찾을 수 없습니다.');
    process.exit(1);
  }

  console.log('=== VPyLab — Plan C 마이그레이션 적용 ===');
  console.log('대상:', targets.join(', '));
  console.log('');

  const PAT = process.env.SUPABASE_ACCESS_TOKEN;
  if (PAT && PAT.startsWith('sbp_')) {
    console.log('🔑 PAT 감지됨 — Supabase Management API로 자동 적용을 시도합니다.\n');

    for (const file of targets) {
      const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf-8');
      console.log(`▶ ${file} 적용 중...`);
      try {
        await applyViaPAT(PAT, sql, file);
        console.log(`  ✅ 적용 완료`);
      } catch (e) {
        console.error(`  ❌ 실패: ${e.message}`);
        console.error('');
        console.error('자동 적용 실패. Dashboard에서 수동으로 실행해주세요:');
        console.error(`  ${dashboardUrl()}`);
        console.error('');
        console.error(`그리고 ${file}의 내용을 붙여넣고 Run을 누르세요.`);
        process.exit(1);
      }
    }
    console.log('\n🎉 모든 마이그레이션 적용 완료!');
    return;
  }

  // PAT이 없으면 Dashboard URL + SQL 출력
  console.log('ℹ️  SUPABASE_ACCESS_TOKEN 환경변수가 없습니다.');
  console.log('아래 URL에서 SQL Editor를 열어 마이그레이션을 붙여넣고 Run하세요:');
  console.log('');
  console.log(`  ${dashboardUrl()}`);
  console.log('');
  console.log('또는 PAT을 설정해서 자동 적용:');
  console.log('  export SUPABASE_ACCESS_TOKEN=sbp_...   (https://supabase.com/dashboard/account/tokens)');
  console.log('  node scripts/apply-migrations.mjs');
  console.log('');

  for (const file of targets) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf-8');
    console.log(`\n========== ${file} ==========`);
    console.log(sql);
    console.log(`========== /${file} ==========\n`);
  }
}

main().catch(e => {
  console.error('치명적 오류:', e.message);
  process.exit(1);
});

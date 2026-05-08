#!/usr/bin/env node

/**
 * 갤러리 썸네일 백필 파이프라인
 *
 * Supabase에서 thumbnail이 비어 있는 공개 작품을 가져와 VPyLab 실행 화면을
 * 브라우저로 렌더링한 뒤 캔버스 캡처 이미지를 thumbnail 컬럼에 저장합니다.
 * 캡처가 비어 있거나 실패하면 코드/메타데이터 기반 포스터 썸네일로 대체합니다.
 */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createPosterThumbnail } from '../client/src/engine/thumbnail.js';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const ENV_FILES = [
  '.env.local',
  'server/.env',
  'client/.env.local',
  'client/.env',
  'client/.env.production',
];

function parseEnvValue(value) {
  let parsed = String(value || '').trim();
  if ((parsed.startsWith('"') && parsed.endsWith('"')) || (parsed.startsWith("'") && parsed.endsWith("'"))) {
    parsed = parsed.slice(1, -1);
  }
  return parsed.replace(/\\n/g, '\n');
}

function loadEnv() {
  const env = { ...process.env };
  for (const file of ENV_FILES) {
    const fullPath = path.join(ROOT, file);
    if (!fs.existsSync(fullPath)) continue;
    const raw = fs.readFileSync(fullPath, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!match || match[1].startsWith('#')) continue;
      if (!env[match[1]]) env[match[1]] = parseEnvValue(match[2]);
    }
  }
  return env;
}

function readArg(name, fallback = null) {
  const prefix = `${name}=`;
  const found = process.argv.find(arg => arg.startsWith(prefix));
  if (found) return found.slice(prefix.length);
  return fallback;
}

function normalizeBaseUrl(value) {
  return String(value || '').replace(/\/+$/, '');
}

async function supabaseFetch(env, pathAndQuery, options = {}) {
  const url = `${env.SUPABASE_URL}${pathAndQuery}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Supabase ${response.status}: ${body}`);
  }

  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function fetchTargetWorks(env, { limit, includeExisting }) {
  const params = new URLSearchParams();
  params.set('select', 'id,title,description,code,category,github_repo,author_alias,thumbnail,created_at');
  params.set('is_public', 'eq.true');
  params.set('order', 'created_at.asc');
  if (limit) params.set('limit', String(limit));

  if (includeExisting) {
    return supabaseFetch(env, `/rest/v1/vpylab_gallery?${params}`);
  }

  params.set('or', '(thumbnail.is.null,thumbnail.eq.)');

  try {
    return await supabaseFetch(env, `/rest/v1/vpylab_gallery?${params}`);
  } catch (error) {
    if (!String(error.message || '').includes('thumbnail.eq.')) throw error;
    params.delete('or');
    params.set('thumbnail', 'is.null');
    return await supabaseFetch(env, `/rest/v1/vpylab_gallery?${params}`);
  }
}

function shouldUseChromeExecutable() {
  const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  return fs.existsSync(chromePath) ? chromePath : undefined;
}

async function captureWorkThumbnail(page, appUrl, work, waitMs) {
  await page.goto(`${appUrl}/sandbox?play=${encodeURIComponent(work.id)}`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForSelector('[data-vpylab-viewport] canvas, canvas', { timeout: 30000 });
  await page.waitForTimeout(waitMs);

  return page.evaluate(async () => {
    const canvas = document.querySelector('[data-vpylab-viewport] canvas') || document.querySelector('canvas');
    const mod = await import('/src/engine/thumbnail.js');
    return mod.captureThumbnail(canvas);
  });
}

async function updateThumbnail(env, id, thumbnail) {
  await supabaseFetch(env, `/rest/v1/vpylab_gallery?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ thumbnail }),
  });
}

async function main() {
  const env = loadEnv();
  env.SUPABASE_URL = normalizeBaseUrl(env.SUPABASE_URL || env.VITE_SUPABASE_URL);
  env.SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY가 없습니다.');
  }

  const appUrl = normalizeBaseUrl(readArg('--app-url', env.VPYLAB_APP_URL || 'http://127.0.0.1:4033'));
  const limit = Number(readArg('--limit', '0')) || 0;
  const waitMs = Number(readArg('--wait-ms', env.THUMBNAIL_CAPTURE_WAIT_MS || '12000'));
  const dryRun = process.argv.includes('--dry-run');
  const includeExisting = process.argv.includes('--include-existing');
  const works = await fetchTargetWorks(env, { limit, includeExisting });

  console.log(`대상 작품: ${works.length}개${includeExisting ? ' (기존 썸네일 포함)' : ''}${dryRun ? ' (dry-run)' : ''}`);
  if (works.length === 0) return;

  const browser = await chromium.launch({
    headless: true,
    executablePath: shouldUseChromeExecutable(),
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
  });

  let captured = 0;
  let poster = 0;
  let failed = 0;

  for (const [index, work] of works.entries()) {
    const label = `${index + 1}/${works.length} ${work.title || work.id}`;
    try {
      const capturedThumbnail = await captureWorkThumbnail(page, appUrl, work, waitMs);
      const thumbnail = capturedThumbnail || createPosterThumbnail({
        title: work.title,
        description: work.description,
        category: work.category,
        code: work.code,
        repo: work.github_repo,
        author: work.author_alias,
      });

      if (capturedThumbnail) captured += 1;
      else poster += 1;

      if (!dryRun) await updateThumbnail(env, work.id, thumbnail);
      console.log(`✓ ${label} · ${capturedThumbnail ? 'capture' : 'poster'}`);
    } catch (error) {
      failed += 1;
      const thumbnail = createPosterThumbnail({
        title: work.title,
        description: work.description,
        category: work.category,
        code: work.code,
        repo: work.github_repo,
        author: work.author_alias,
      });
      if (!dryRun) await updateThumbnail(env, work.id, thumbnail);
      poster += 1;
      console.log(`! ${label} · poster fallback (${error.message})`);
    }
  }

  await browser.close();
  console.log(`완료: capture ${captured}개, poster ${poster}개, 실패 ${failed}개`);
}

main().catch(error => {
  console.error(error.message);
  process.exit(1);
});

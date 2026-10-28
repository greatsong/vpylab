// 다른 프로젝트 폴더: greatsong-project/paths.json(폴더 재편 스크립트가 관리)에서 찾는다.
// 환경 변수 GREATSONG_ROOT로 greatsong-project 위치를 바꿀 수 있다.
import { existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

export function projectDir(name) {
  let root = process.env.GREATSONG_ROOT;
  for (let d = dirname(fileURLToPath(import.meta.url)); !root && d !== dirname(d); d = dirname(d)) {
    if (existsSync(join(d, 'paths.json'))) root = d;
  }
  if (!root) throw new Error('greatsong-project/paths.json을 찾지 못했습니다. GREATSONG_ROOT를 지정하세요.');
  return join(root, JSON.parse(readFileSync(join(root, 'paths.json'), 'utf8'))[name]);
}

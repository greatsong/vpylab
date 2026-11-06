import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const publicDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '../../public');
import { glowscriptProjects, getGlowscriptProject } from './glowscript-projects';

it('지정한 두 폴더의 33개 원본·출처·썸네일을 빠짐없이 보존한다', () => {
  expect(glowscriptProjects).toHaveLength(33);
  expect(new Set(glowscriptProjects.map(project => project.id)).size).toBe(33);
  expect(glowscriptProjects.filter(project => project.folder.startsWith('2024'))).toHaveLength(27);
  expect(glowscriptProjects.filter(project => project.folder.startsWith('2021'))).toHaveLength(6);
  for (const project of glowscriptProjects) {
    const source = JSON.parse(readFileSync(join(publicDirectory, project.sourcePath.slice(1)), 'utf8'));
    expect(createHash('sha256').update(source.source).digest('hex')).toBe(source.sha256);
    expect(source.sourceUrl).toBe(project.sourceUrl);
    expect(source.originalName).toBe(project.originalName);
    expect(source.code.startsWith('from vpython import *\n')).toBe(true);
    if (project.thumbnail) expect(readFileSync(join(publicDirectory, project.thumbnail.slice(1))).subarray(1, 4).toString()).toBe('PNG');
  }
});

it('교사·연수작을 학생 작품으로 분류하지 않고 빈 프로젝트를 실행 가능으로 표시하지 않는다', () => {
  for (const project of glowscriptProjects.filter(project => /선생님|석리송/.test(project.originalName))) {
    expect(project.kind).toBe('reference');
  }
  expect(getGlowscriptProject('gs2021-05').credit).toContain('교사 변형');
  expect(getGlowscriptProject('gs2024-24').pythonCheck).toBe('empty');
  expect(getGlowscriptProject('gs2024-02').pythonCheck).toBe('ready');
  expect(getGlowscriptProject('gs2024-02').adapted).toBe(true);
});

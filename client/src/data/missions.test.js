/**
 * 미션 데이터 무결성 테스트
 */
import { describe, it, expect } from 'vitest';
import missions, { categories, getMissionsByCategory, getMissionById } from './missions';
import { gradeCodeChecks } from '../engine/grading-engine';

describe('missions 데이터 무결성', () => {
  it('30개 미션이 존재한다', () => {
    expect(missions.length).toBe(30);
  });

  it('모든 미션에 필수 필드가 있다', () => {
    const requiredFields = ['id', 'category', 'level', 'title', 'description', 'gradeType', 'starterCode', 'solutionCode', 'assertions', 'hints'];

    for (const mission of missions) {
      for (const field of requiredFields) {
        expect(mission[field], `${mission.id}에 ${field} 필드 누락`).toBeDefined();
      }
    }
  });

  it('모든 미션의 title/description에 ko/en이 있다', () => {
    for (const mission of missions) {
      expect(mission.title.ko, `${mission.id} title.ko 누락`).toBeTruthy();
      expect(mission.title.en, `${mission.id} title.en 누락`).toBeTruthy();
      expect(mission.description.ko, `${mission.id} description.ko 누락`).toBeTruthy();
      expect(mission.description.en, `${mission.id} description.en 누락`).toBeTruthy();
    }
  });

  it('ID가 고유하다', () => {
    const ids = missions.map(m => m.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('카테고리가 유효한 값이다', () => {
    const validCategories = Object.keys(categories);
    for (const mission of missions) {
      expect(validCategories).toContain(mission.category);
    }
  });

  it('난이도가 1~4 범위이다', () => {
    for (const mission of missions) {
      expect(mission.level).toBeGreaterThanOrEqual(1);
      expect(mission.level).toBeLessThanOrEqual(4);
    }
  });

  it('gradeType이 유효하다', () => {
    const validTypes = ['A', 'B', 'A+B', 'notes', 'run', 'code'];
    for (const mission of missions) {
      expect(validTypes).toContain(mission.gradeType);
    }
  });

  it('assertions 배열이 존재한다 (사운드 미션은 빈 배열 허용)', () => {
    for (const mission of missions) {
      expect(Array.isArray(mission.assertions), `${mission.id} assertions가 배열이 아님`).toBe(true);
      // 사운드(SN) 카테고리는 빈 assertions 허용 (사운드 재생 기반 미션)
      if (mission.category !== 'SN') {
        expect(mission.assertions.length, `${mission.id} assertions 비어있음`).toBeGreaterThan(0);
      }
    }
  });

  it('힌트가 1개 이상이다', () => {
    for (const mission of missions) {
      expect(mission.hints.length, `${mission.id} hints 비어있음`).toBeGreaterThan(0);
    }
  });

  it('모든 힌트에 ko/en이 있다', () => {
    for (const mission of missions) {
      for (let i = 0; i < mission.hints.length; i++) {
        expect(mission.hints[i].ko, `${mission.id} hints[${i}].ko 누락`).toBeTruthy();
        expect(mission.hints[i].en, `${mission.id} hints[${i}].en 누락`).toBeTruthy();
      }
    }
  });

  it('B등급 미션에 referenceTrajectory가 있다', () => {
    const bMissions = missions.filter(m => m.gradeType.includes('B'));
    for (const mission of bMissions) {
      expect(mission.referenceTrajectory, `${mission.id}에 referenceTrajectory 누락`).toBeDefined();
      expect(mission.referenceTrajectory.length).toBeGreaterThan(0);
    }
  });

  it('notes 미션에는 expectedNotes가 있다', () => {
    const noteMissions = missions.filter(m => m.gradeType === 'notes');
    for (const mission of noteMissions) {
      expect(Array.isArray(mission.expectedNotes), `${mission.id} expectedNotes가 배열이 아님`).toBe(true);
      expect(mission.expectedNotes.length, `${mission.id} expectedNotes 비어있음`).toBeGreaterThan(0);
    }
  });

  it('code 미션에는 codeChecks가 있고, 시작 코드는 바로 통과하지 않는다', () => {
    const codeMissions = missions.filter(m => m.gradeType === 'code');
    for (const mission of codeMissions) {
      expect(Array.isArray(mission.codeChecks), `${mission.id} codeChecks가 배열이 아님`).toBe(true);
      expect(mission.codeChecks.length, `${mission.id} codeChecks 비어있음`).toBeGreaterThan(0);

      const starterResult = gradeCodeChecks(mission.starterCode, mission.codeChecks);
      const solutionResult = gradeCodeChecks(mission.solutionCode, mission.codeChecks);

      expect(starterResult.passed, `${mission.id} 시작 코드가 채점 통과함`).toBe(false);
      expect(solutionResult.passed, `${mission.id} 모범 답안이 채점 실패함`).toBe(true);
    }
  });
});

describe('미션 유틸 함수', () => {
  it('getMissionsByCategory로 CT 미션 조회', () => {
    const ctMissions = getMissionsByCategory('CT');
    expect(ctMissions.length).toBe(5);
    expect(ctMissions.every(m => m.category === 'CT')).toBe(true);
  });

  it('getMissionById로 특정 미션 조회', () => {
    const mission = getMissionById('SC-1');
    expect(mission).toBeDefined();
    expect(mission.title.ko).toBe('등속 직선 운동');
  });

  it('존재하지 않는 ID는 undefined', () => {
    expect(getMissionById('INVALID')).toBeUndefined();
  });
});

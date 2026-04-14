/**
 * 미션 데이터 무결성 테스트
 */
import { describe, it, expect } from 'vitest';
import missions, { categories, getMissionsByCategory, getMissionById } from './missions';

describe('missions 데이터 무결성', () => {
  it('16개 미션이 존재한다', () => {
    expect(missions.length).toBe(16);
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
    const validTypes = ['A', 'B', 'A+B', 'notes', 'run'];
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

  it('B등급 미션에 referenceTrajectory가 있다', () => {
    const bMissions = missions.filter(m => m.gradeType.includes('B'));
    for (const mission of bMissions) {
      expect(mission.referenceTrajectory, `${mission.id}에 referenceTrajectory 누락`).toBeDefined();
      expect(mission.referenceTrajectory.length).toBeGreaterThan(0);
    }
  });
});

describe('미션 유틸 함수', () => {
  it('getMissionsByCategory로 CT 미션 조회', () => {
    const ctMissions = getMissionsByCategory('CT');
    expect(ctMissions.length).toBe(2);
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

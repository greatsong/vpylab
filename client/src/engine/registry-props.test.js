/**
 * 채점 레지스트리 속성 추출 테스트 — 브릿지와 재생기가 공유하는 규칙
 */
import { describe, it, expect } from 'vitest';
import { getRegistryProps, getRegistryUpdates, resolveBoxSize } from './registry-props';

describe('getRegistryProps — 생성 커맨드', () => {
  it('box는 size = (length, height, width) 규약으로 저장한다', () => {
    const props = getRegistryProps({ type: 'box', pos: [0, 0, 0], length: 2, height: 3, width: 4 });
    expect(props.size).toEqual([2, 3, 4]);
    expect(resolveBoxSize({ size: [1, 1, 1], height: 5 })).toEqual([1, 5, 1]);
  });

  it('종류별 기본값을 채우고 생성 인자를 덮어쓴다', () => {
    const sphere = getRegistryProps({ type: 'sphere', pos: [1, 2, 3], color: [1, 0, 0], emissive: true, texture: 'wood' });
    expect(sphere.radius).toBe(1);
    expect(sphere.emissive).toBe(true);
    expect(sphere.texture).toBe('wood');

    const cylinder = getRegistryProps({ type: 'cylinder', axis: [0, 3, 0], radius: 0.5 });
    expect(cylinder.axis).toEqual([0, 3, 0]);
    expect(cylinder.radius).toBe(0.5);

    const label = getRegistryProps({ type: 'label', text: '안녕', height: 20 });
    expect(label.text).toBe('안녕');
  });
});

describe('getRegistryUpdates — 갱신 커맨드', () => {
  it('박스의 height만 바뀌면 기존 size의 다른 성분을 유지한다', () => {
    const obj = { type: 'box', props: { size: [2, 1, 3] } };
    expect(getRegistryUpdates({ id: 'a', height: 4 }, obj).size).toEqual([2, 4, 3]);
  });

  it('조명이 아닌 객체의 emissive, 조명의 intensity를 각각 기록한다', () => {
    expect(getRegistryUpdates({ id: 'a', emissive: true }, { type: 'sphere', props: {} })).toEqual({ emissive: true });
    expect(getRegistryUpdates({ id: 'a', emissive: true, intensity: 2 }, { type: 'local_light', props: {} })).toEqual({ intensity: 2 });
  });

  it('pos, color, visible, opacity, radius, axis를 그대로 반영한다', () => {
    const updates = getRegistryUpdates(
      { id: 'a', pos: [1, 1, 1], color: [0, 1, 0], visible: false, opacity: 0.5, radius: 2, axis: [0, 0, 5] },
      { type: 'cone', props: {} },
    );
    expect(updates).toEqual({ pos: [1, 1, 1], color: [0, 1, 0], visible: false, opacity: 0.5, radius: 2, axis: [0, 0, 5] });
  });
});

import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ from: vi.fn(), ids: [] }));
vi.mock('../lib/supabase', () => ({ supabase: { from: mocks.from } }));
vi.mock('../data/student-projects', () => ({ studentProjectIds: mocks.ids }));
import useGalleryStore from './galleryStore';

beforeEach(() => {
  mocks.from.mockReset();
  mocks.ids.length = 0;
  useGalleryStore.setState({ works: [], featuredWorks: [], page: 0, hasMore: true, error: null, loading: false, filters: { category: 'all', sort: 'latest', search: '' } });
});

it('확인된 작품이 없으면 일반 공개 작품을 대신 채우지 않는다', async () => {
  useGalleryStore.setState({ works: [{ id: 'old-demo' }], featuredWorks: [{ id: 'old-demo' }] });
  await useGalleryStore.getState().fetchWorks(true);
  await useGalleryStore.getState().fetchFeaturedWorks();
  expect(mocks.from).not.toHaveBeenCalled();
  expect(useGalleryStore.getState().works).toEqual([]);
  expect(useGalleryStore.getState().featuredWorks).toEqual([]);
  expect(useGalleryStore.getState().hasMore).toBe(false);
});

it('공개 상태와 확인된 ID를 모두 DB 조회에서 제한한다', async () => {
  mocks.ids.push('confirmed-project');
  const query = { select: vi.fn(), eq: vi.fn(), in: vi.fn(), range: vi.fn(), order: vi.fn(), limit: vi.fn(), then: resolve => resolve({ data: [], error: null }) };
  for (const key of ['select', 'eq', 'in', 'range', 'order', 'limit']) query[key].mockReturnValue(query);
  mocks.from.mockReturnValue(query);
  await useGalleryStore.getState().fetchWorks(true);
  await useGalleryStore.getState().fetchFeaturedWorks();
  expect(query.eq).toHaveBeenCalledWith('is_public', true);
  expect(query.in.mock.calls).toEqual([['id', ['confirmed-project']], ['id', ['confirmed-project']]]);
});

it('통신 오류를 작품 없음과 구분한다', async () => {
  mocks.ids.push('confirmed-project');
  const query = { select: () => query, eq: () => query, in: () => query, range: () => query, order: () => query, then: resolve => resolve({ data: null, error: { message: 'offline' } }) };
  mocks.from.mockReturnValue(query);
  await useGalleryStore.getState().fetchWorks(true);
  expect(useGalleryStore.getState().error).toBeTruthy();
  expect(useGalleryStore.getState().loading).toBe(false);
});

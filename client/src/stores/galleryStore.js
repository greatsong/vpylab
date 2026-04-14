import { create } from 'zustand';
import { supabase } from '../lib/supabase';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4034';

/**
 * 사용자 프로필을 일괄 조회하여 작품에 매핑
 * vpylab_gallery.user_id → vpylab_profiles.id (둘 다 auth.users FK)
 */
async function attachProfiles(works) {
  if (!works || works.length === 0) return works;
  const userIds = [...new Set(works.map(w => w.user_id))];
  const { data: profiles } = await supabase
    .from('vpylab_profiles')
    .select('id, display_name, avatar_url')
    .in('id', userIds);
  const profileMap = {};
  for (const p of (profiles || [])) profileMap[p.id] = p;
  return works.map(w => ({
    ...w,
    vpylab_profiles: profileMap[w.user_id] || { display_name: '익명', avatar_url: null },
  }));
}

const useGalleryStore = create((set, get) => ({
  works: [],
  featuredWorks: [],
  currentWork: null,
  myWorks: [],
  loading: false,
  publishing: false,
  hasMore: true,
  page: 0,
  filters: { category: 'all', sort: 'latest', search: '' },

  setFilters: (filters) => set({ filters: { ...get().filters, ...filters }, works: [], page: 0, hasMore: true }),

  // === 갤러리 목록 조회 ===
  fetchWorks: async (reset = false) => {
    const { filters, page, works } = get();
    const pageSize = 12;
    const currentPage = reset ? 0 : page;

    set({ loading: true });

    let query = supabase
      .from('vpylab_gallery')
      .select('id, title, description, thumbnail, category, view_count, like_count, remix_count, github_url, created_at, user_id')
      .eq('is_public', true)
      .range(currentPage * pageSize, (currentPage + 1) * pageSize - 1);

    if (filters.category !== 'all') {
      query = query.eq('category', filters.category);
    }
    if (filters.search) {
      query = query.ilike('title', `%${filters.search}%`);
    }

    switch (filters.sort) {
      case 'popular':
        query = query.order('like_count', { ascending: false });
        break;
      case 'views':
        query = query.order('view_count', { ascending: false });
        break;
      default:
        query = query.order('created_at', { ascending: false });
    }

    const { data, error } = await query;

    if (!error && data) {
      const withProfiles = await attachProfiles(data);
      const newWorks = reset ? withProfiles : [...works, ...withProfiles];
      set({
        works: newWorks,
        page: currentPage + 1,
        hasMore: data.length === pageSize,
        loading: false,
      });
    } else {
      set({ loading: false });
    }
  },

  // === 추천 작품 조회 (Home 하이라이트) ===
  fetchFeaturedWorks: async () => {
    let { data } = await supabase
      .from('vpylab_gallery')
      .select('id, title, thumbnail, like_count, view_count, github_url, user_id')
      .eq('is_public', true)
      .eq('is_featured', true)
      .order('created_at', { ascending: false })
      .limit(6);

    if (!data || data.length < 4) {
      const { data: popular } = await supabase
        .from('vpylab_gallery')
        .select('id, title, thumbnail, like_count, view_count, github_url, user_id')
        .eq('is_public', true)
        .order('like_count', { ascending: false })
        .limit(6);
      data = popular;
    }

    const withProfiles = await attachProfiles(data || []);
    set({ featuredWorks: withProfiles });
  },

  // === 작품 상세 조회 ===
  fetchWork: async (id) => {
    set({ loading: true, currentWork: null });

    const { data } = await supabase
      .from('vpylab_gallery')
      .select('*')
      .eq('id', id)
      .single();

    if (data) {
      const [withProfile] = await attachProfiles([data]);
      set({ currentWork: withProfile, loading: false });

      // 조회수 증가
      supabase.rpc('vpylab_increment_view', { work_id: id });

      // Remix 원본 정보 로드
      if (data.remix_from) {
        const { data: original } = await supabase
          .from('vpylab_gallery')
          .select('id, title, user_id')
          .eq('id', data.remix_from)
          .single();
        if (original) {
          const [origWithProfile] = await attachProfiles([original]);
          set({ currentWork: { ...get().currentWork, originalWork: origWithProfile } });
        }
      }

      // 이 작품의 Remix 목록
      const { data: remixes } = await supabase
        .from('vpylab_gallery')
        .select('id, title, thumbnail, user_id')
        .eq('remix_from', id)
        .eq('is_public', true)
        .order('created_at', { ascending: false })
        .limit(10);

      if (remixes && remixes.length > 0) {
        const remixesWithProfiles = await attachProfiles(remixes);
        set({ currentWork: { ...get().currentWork, remixes: remixesWithProfiles } });
      }
    } else {
      set({ loading: false });
    }
  },

  // === 작품 발행 (갤러리 + GitHub Pages) ===
  publishWork: async ({ title, description, code, thumbnail, category, remixFrom, htmlContent, githubToken }) => {
    set({ publishing: true });

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('로그인이 필요합니다.');

      let githubUrl = null;
      let githubRepo = null;
      let warnings = [];

      if (githubToken && htmlContent) {
        const res = await fetch(`${API_BASE}/api/publish`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: htmlContent, title, githubToken }),
        });
        const result = await res.json();

        if (res.ok && result.success) {
          githubUrl = result.githubUrl;
          githubRepo = result.githubRepo;
          warnings = result.warnings || [];
        } else {
          console.warn('GitHub Pages 발행 실패:', result.error);
          warnings.push(result.error || 'GitHub Pages 발행 실패');
        }
      }

      const { data, error } = await supabase
        .from('vpylab_gallery')
        .insert({
          user_id: user.id,
          title,
          description: description || '',
          code,
          thumbnail,
          category: category || 'free',
          remix_from: remixFrom || null,
          github_url: githubUrl,
          github_repo: githubRepo,
        })
        .select()
        .single();

      if (error) throw error;

      if (remixFrom) {
        supabase.rpc('vpylab_increment_remix', { work_id: remixFrom });
      }

      set({ publishing: false });
      return { data, githubUrl, warnings };
    } catch (err) {
      set({ publishing: false });
      return { error: err.message };
    }
  },

  // === 좋아요 토글 ===
  toggleLike: async (galleryId) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { data: liked } = await supabase.rpc('vpylab_toggle_like', { work_id: galleryId });

    const current = get().currentWork;
    if (current?.id === galleryId) {
      set({
        currentWork: {
          ...current,
          like_count: current.like_count + (liked ? 1 : -1),
          _isLiked: liked,
        },
      });
    }

    return liked;
  },

  // === 좋아요 확인 ===
  checkIfLiked: async (galleryId) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { data } = await supabase
      .from('vpylab_gallery_likes')
      .select('id')
      .eq('gallery_id', galleryId)
      .eq('user_id', user.id)
      .maybeSingle();

    return !!data;
  },

  // === 내 작품 목록 ===
  fetchMyWorks: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('vpylab_gallery')
      .select('id, title, thumbnail, category, is_public, view_count, like_count, github_url, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    set({ myWorks: data || [] });
  },

  // === 작품 삭제 ===
  deleteWork: async (id) => {
    const { error } = await supabase
      .from('vpylab_gallery')
      .delete()
      .eq('id', id);

    if (!error) {
      set({
        myWorks: get().myWorks.filter(w => w.id !== id),
        works: get().works.filter(w => w.id !== id),
      });
    }
    return { error };
  },
}));

export default useGalleryStore;

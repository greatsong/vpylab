import { create } from 'zustand';
import { supabase } from '../lib/supabase';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4034';

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
      .select('id, title, description, thumbnail, category, view_count, like_count, remix_count, github_url, created_at, user_id, vpylab_profiles!inner(display_name, avatar_url)')
      .eq('is_public', true)
      .range(currentPage * pageSize, (currentPage + 1) * pageSize - 1);

    // 카테고리 필터
    if (filters.category !== 'all') {
      query = query.eq('category', filters.category);
    }

    // 검색
    if (filters.search) {
      query = query.ilike('title', `%${filters.search}%`);
    }

    // 정렬
    switch (filters.sort) {
      case 'popular':
        query = query.order('like_count', { ascending: false });
        break;
      case 'views':
        query = query.order('view_count', { ascending: false });
        break;
      default: // latest
        query = query.order('created_at', { ascending: false });
    }

    const { data, error } = await query;

    if (!error && data) {
      const newWorks = reset ? data : [...works, ...data];
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
    const { data } = await supabase
      .from('vpylab_gallery')
      .select('id, title, thumbnail, like_count, view_count, github_url, vpylab_profiles!inner(display_name)')
      .eq('is_public', true)
      .eq('is_featured', true)
      .order('created_at', { ascending: false })
      .limit(6);

    // featured가 부족하면 인기순으로 채우기
    if (!data || data.length < 4) {
      const { data: popular } = await supabase
        .from('vpylab_gallery')
        .select('id, title, thumbnail, like_count, view_count, github_url, vpylab_profiles!inner(display_name)')
        .eq('is_public', true)
        .order('like_count', { ascending: false })
        .limit(6);
      set({ featuredWorks: popular || [] });
    } else {
      set({ featuredWorks: data });
    }
  },

  // === 작품 상세 조회 ===
  fetchWork: async (id) => {
    set({ loading: true, currentWork: null });

    const { data } = await supabase
      .from('vpylab_gallery')
      .select('*, vpylab_profiles!inner(display_name, avatar_url)')
      .eq('id', id)
      .single();

    if (data) {
      set({ currentWork: data, loading: false });

      // 조회수 증가 (본인 작품은 서버에서 제외)
      supabase.rpc('vpylab_increment_view', { work_id: id });

      // Remix 원본 정보 로드
      if (data.remix_from) {
        const { data: original } = await supabase
          .from('vpylab_gallery')
          .select('id, title, vpylab_profiles!inner(display_name)')
          .eq('id', data.remix_from)
          .single();
        if (original) {
          set({ currentWork: { ...get().currentWork, originalWork: original } });
        }
      }

      // 이 작품의 Remix 목록
      const { data: remixes } = await supabase
        .from('vpylab_gallery')
        .select('id, title, thumbnail, vpylab_profiles!inner(display_name)')
        .eq('remix_from', id)
        .eq('is_public', true)
        .order('created_at', { ascending: false })
        .limit(10);

      if (remixes) {
        set({ currentWork: { ...get().currentWork, remixes } });
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

      // GitHub Pages 발행 (GitHub 토큰이 있을 때만)
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
          // GitHub 발행 실패해도 갤러리 등록은 진행
          console.warn('GitHub Pages 발행 실패:', result.error);
          warnings.push(result.error || 'GitHub Pages 발행 실패');
        }
      }

      // 갤러리 DB에 등록
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

      // 원본 작품의 remix_count 증가
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

    // 현재 작품의 like_count 로컬 업데이트
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

  // === 현재 사용자가 좋아요 했는지 확인 ===
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

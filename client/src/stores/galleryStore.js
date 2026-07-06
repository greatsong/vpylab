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
    vpylab_profiles: profileMap[w.user_id] || {
      display_name: w.author_alias || '익명',
      avatar_url: null
    },
  }));
}

/**
 * /api/publish 계열 요청 공통 헤더
 * 서버가 Supabase 인증을 요구하므로 액세스 토큰을 Authorization 헤더로 전달
 */
async function buildPublishHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
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

    // 성능: 목록에서 thumbnail 제외 — GalleryCard에서 Intersection Observer로 개별 lazy fetch
    let query = supabase
      .from('vpylab_gallery')
      .select('id, title, description, category, view_count, like_count, remix_count, github_url, github_repo, author_alias, created_at, user_id')
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
    // 성능: thumbnail 제외, 단일 쿼리로 인기순 폴백 통합
    const cols = 'id, title, description, category, like_count, view_count, remix_count, github_url, github_repo, author_alias, created_at, user_id';

    let { data } = await supabase
      .from('vpylab_gallery')
      .select(cols)
      .eq('is_public', true)
      .eq('is_featured', true)
      .order('created_at', { ascending: false })
      .limit(6);

    if (!data || data.length < 4) {
      const { data: popular } = await supabase
        .from('vpylab_gallery')
        .select(cols)
        .eq('is_public', true)
        .order('like_count', { ascending: false })
        .limit(6);
      data = popular;
    }

    const withProfiles = await attachProfiles(data || []);
    set({ featuredWorks: withProfiles });
  },

  // === 작품 코드만 가져오기 (Play 모드용, 경량) ===
  fetchWorkCode: async (id) => {
    const { data } = await supabase
      .from('vpylab_gallery')
      .select('code')
      .eq('id', id)
      .single();
    return data?.code || null;
  },

  // === 썸네일 개별 조회 (GalleryCard lazy loading용) ===
  fetchThumbnail: async (id) => {
    const { data } = await supabase
      .from('vpylab_gallery')
      .select('thumbnail')
      .eq('id', id)
      .single();
    return data?.thumbnail || null;
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
          .select('id, title, author_alias, user_id')
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
        .select('id, title, description, category, view_count, like_count, remix_count, github_url, github_repo, author_alias, created_at, user_id')
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
  publishWork: async ({
    title,
    description,
    code,
    thumbnail,
    category,
    remixFrom,
    htmlContent,
    githubToken,
    authorAlias,
    projectId = null,
    existingRepo = null,
    sourceRevisionId = null,
  }) => {
    set({ publishing: true });

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('로그인이 필요합니다.');

      let githubUrl = null;
      let githubRepo = null;
      let warnings = [];
      let githubPending = false;
      let githubError = null;

      if (githubToken && htmlContent) {
        // GitHub 발행 실패(401/403/네트워크)여도 갤러리 스냅샷 등록은 계속 진행합니다.
        try {
          const res = await fetch(`${API_BASE}/api/publish`, {
            method: 'POST',
            headers: await buildPublishHeaders(),
            body: JSON.stringify({
              code: htmlContent,
              pythonCode: code,
              title,
              description,
              category,
              remixFrom,
              existingRepo,
              githubToken,
            }),
          });
          const result = await res.json();

          if (res.ok && result.success) {
            githubUrl = result.githubUrl;
            githubRepo = result.githubRepo;
            warnings = result.warnings || [];
          } else {
            githubPending = true;
            githubError = result.error || 'GitHub Pages 발행 실패';
          }
        } catch (netErr) {
          githubPending = true;
          githubError = netErr.message || 'GitHub 발행 서버에 연결할 수 없습니다.';
        }
      }

      // Remix 출처 비정규화 — 원작이 나중에 삭제되어도 출처 표기를 유지합니다.
      let remixFromTitle = null;
      let remixFromAuthor = null;
      if (remixFrom) {
        const { data: original } = await supabase
          .from('vpylab_gallery')
          .select('title, author_alias, user_id')
          .eq('id', remixFrom)
          .single();
        if (original) {
          remixFromTitle = original.title;
          const [origWithProfile] = await attachProfiles([original]);
          remixFromAuthor = origWithProfile?.vpylab_profiles?.display_name
            || original.author_alias
            || '익명';
        }
      }

      const galleryInsert = {
        user_id: user.id,
        title,
        description: description || '',
        code,
        thumbnail,
        category: category || 'free',
        remix_from: remixFrom || null,
        github_url: githubUrl,
        github_repo: githubRepo,
        author_alias: authorAlias || '익명',
        project_id: projectId || null,
        source_revision_id: sourceRevisionId || null,
        remix_from_title: remixFromTitle,
        remix_from_author: remixFromAuthor,
      };

      let { data, error } = await supabase
        .from('vpylab_gallery')
        .insert(galleryInsert)
        .select()
        .single();

      // 아직 마이그레이션이 적용되지 않은 배포 환경에서도 발행 자체는 살립니다.
      // 오류 메시지에 언급된 선택적 컬럼을 하나씩 제거하며 재시도합니다.
      const optionalColumns = ['project_id', 'source_revision_id', 'remix_from_title', 'remix_from_author'];
      const removed = new Set();
      while (error) {
        const missing = optionalColumns.find(
          col => !removed.has(col) && (error.message || '').includes(col)
        );
        if (!missing) break;
        removed.add(missing);
        delete galleryInsert[missing];
        const retry = await supabase
          .from('vpylab_gallery')
          .insert(galleryInsert)
          .select()
          .single();
        data = retry.data;
        error = retry.error;
      }

      if (error) throw error;

      if (remixFrom) {
        supabase.rpc('vpylab_increment_remix', { work_id: remixFrom });
      }

      set({ publishing: false });
      return { data, githubUrl, warnings, githubPending, githubError };
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
      .select('id, title, description, thumbnail, category, is_public, view_count, like_count, remix_count, github_url, github_repo, author_alias, created_at, user_id, remix_from')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    set({ myWorks: data || [] });
  },

  // === GitHub 리포에서 코드 가져오기 (POST body로 토큰 전달 — 보안) ===
  fetchCodeFromGitHub: async (githubRepo, githubToken) => {
    const res = await fetch(`${API_BASE}/api/publish/fetch`, {
      method: 'POST',
      headers: await buildPublishHeaders(),
      body: JSON.stringify({ repo: githubRepo, githubToken }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data; // { code, title, sha }
  },

  // === 기존 작품 업데이트 (GitHub + Supabase) ===
  // makePublic: true — 비공개(Fork 초안) 작품을 갤러리에 공개하며,
  // 최초 공개 시에만 원작의 remix_count를 증가시킵니다.
  updateWork: async ({ id, title, description, code, htmlContent, githubRepo, githubToken, makePublic = false }) => {
    set({ publishing: true });
    try {
      // GitHub 리포 업데이트
      if (githubRepo && githubToken && htmlContent) {
        const res = await fetch(`${API_BASE}/api/publish/update`, {
          method: 'PUT',
          headers: await buildPublishHeaders(),
          body: JSON.stringify({ githubRepo, title, code: htmlContent, pythonCode: code, description, githubToken }),
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error);
      }

      // Supabase 레코드 업데이트
      const updates = {};
      if (code !== undefined) updates.code = code;
      if (title) updates.title = title;
      if (description !== undefined) updates.description = description;

      // 공개 전환: 중복 remix_count 증가 방지를 위해 이전 공개 상태를 먼저 확인
      let wasPublic = null;
      let remixFromId = null;
      if (makePublic) {
        const { data: existing } = await supabase
          .from('vpylab_gallery')
          .select('is_public, remix_from')
          .eq('id', id)
          .single();
        wasPublic = existing?.is_public ?? null;
        remixFromId = existing?.remix_from || null;
        updates.is_public = true;
      }

      if (Object.keys(updates).length > 0) {
        const { error } = await supabase
          .from('vpylab_gallery')
          .update(updates)
          .eq('id', id);

        if (error) throw error;
      }

      // 최초 공개일 때만 원작 remix_count 증가 (재공개 시 중복 방지)
      if (makePublic && wasPublic === false && remixFromId) {
        supabase.rpc('vpylab_increment_remix', { work_id: remixFromId });
      }

      set({ publishing: false });
      return { success: true, madePublic: makePublic && wasPublic === false };
    } catch (err) {
      set({ publishing: false });
      return { error: err.message };
    }
  },

  // === 비공개 작품(Fork 초안 등)을 갤러리에 공개 ===
  republishWork: async (id) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('로그인이 필요합니다.');

      const { data: work, error: fetchError } = await supabase
        .from('vpylab_gallery')
        .select('id, is_public, remix_from, user_id')
        .eq('id', id)
        .single();

      if (fetchError || !work) throw new Error('작품을 찾을 수 없습니다.');
      if (work.user_id !== user.id) throw new Error('내 작품만 공개할 수 있습니다.');

      // 이미 공개된 작품 — remix_count 중복 증가 없이 그대로 종료
      if (work.is_public) return { success: true, alreadyPublic: true };

      const { error } = await supabase
        .from('vpylab_gallery')
        .update({ is_public: true })
        .eq('id', id);

      if (error) throw error;

      // Fork(Remix) 작품의 최초 공개 시점에만 원작 remix_count 증가
      if (work.remix_from) {
        supabase.rpc('vpylab_increment_remix', { work_id: work.remix_from });
      }

      // 로컬 상태 갱신
      const current = get().currentWork;
      if (current?.id === id) {
        set({ currentWork: { ...current, is_public: true } });
      }
      set({ myWorks: get().myWorks.map(w => (w.id === id ? { ...w, is_public: true } : w)) });

      return { success: true };
    } catch (err) {
      return { error: err.message };
    }
  },

  // === 작품 Fork (GitHub fork + 갤러리 등록) ===
  forkWork: async ({ sourceId, sourceRepo, githubToken }) => {
    set({ publishing: true });
    try {
      // GitHub fork
      const res = await fetch(`${API_BASE}/api/publish/fork`, {
        method: 'POST',
        headers: await buildPublishHeaders(),
        body: JSON.stringify({ sourceRepo, githubToken }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);

      // 원본 작품 정보 가져오기
      const { data: source } = await supabase
        .from('vpylab_gallery')
        .select('title, description, code, category, thumbnail, author_alias, user_id')
        .eq('id', sourceId)
        .single();

      if (!source) throw new Error('원본 작품을 찾을 수 없습니다.');

      // 원작 작성자 표시명 (attribution 스냅샷용)
      const [sourceWithProfile] = await attachProfiles([source]);
      const sourceAuthor = sourceWithProfile?.vpylab_profiles?.display_name
        || source.author_alias
        || '익명';

      // 갤러리에 새 작품 등록 (비공개 초안)
      const { data: { user } } = await supabase.auth.getUser();

      // 현재 사용자 프로필에서 display_name 가져오기
      const { data: myProfile } = await supabase
        .from('vpylab_profiles')
        .select('display_name')
        .eq('id', user.id)
        .single();

      const forkInsert = {
        user_id: user.id,
        title: `${source.title} (Remix)`,
        description: source.description,
        code: source.code,
        thumbnail: source.thumbnail,
        category: source.category,
        remix_from: sourceId,
        github_url: result.githubUrl,
        github_repo: result.forkedRepo,
        author_alias: myProfile?.display_name || '익명',
        is_public: false,
        // 출처 스냅샷 — 원작이 삭제되어도 attribution 유지
        remix_from_title: source.title,
        remix_from_author: sourceAuthor,
      };

      let { data, error } = await supabase
        .from('vpylab_gallery')
        .insert(forkInsert)
        .select()
        .single();

      // attribution 마이그레이션이 아직 적용되지 않은 환경에서도 Fork 자체는 살립니다.
      if (error && /remix_from_(title|author)/i.test(error.message || '')) {
        delete forkInsert.remix_from_title;
        delete forkInsert.remix_from_author;
        const retry = await supabase
          .from('vpylab_gallery')
          .insert(forkInsert)
          .select()
          .single();
        data = retry.data;
        error = retry.error;
      }

      if (error) throw error;

      // remix_count 증가는 재발행 시에만 처리

      set({ publishing: false });
      return { data, githubUrl: result.githubUrl, forkedRepo: result.forkedRepo };
    } catch (err) {
      set({ publishing: false });
      return { error: err.message };
    }
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

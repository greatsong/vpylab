import { create } from 'zustand';
import { supabase } from '../lib/supabase';

const THEMES = [
  'creative-light', 'deep-dark',
  'ocean-breeze', 'sunset-glow',
  'forest-night', 'lavender-dream',
  'midnight-purple', 'rose-garden',
  'cyber-neon',
];

const THEME_META = {
  'creative-light':  { label: '크리에이티브', icon: '☀️', dark: false },
  'deep-dark':       { label: '딥 다크', icon: '🌙', dark: true },
  'ocean-breeze':    { label: '바다 바람', icon: '🌊', dark: false },
  'sunset-glow':     { label: '노을빛', icon: '🌅', dark: false },
  'forest-night':    { label: '깊은 숲', icon: '🌲', dark: true },
  'lavender-dream':  { label: '라벤더', icon: '💜', dark: false },
  'midnight-purple': { label: '자정 퍼플', icon: '🔮', dark: true },
  'rose-garden':     { label: '장미 정원', icon: '🌹', dark: false },
  'cyber-neon':      { label: '사이버 네온', icon: '⚡', dark: true },
};

const useAppStore = create((set) => ({
  // 테마
  theme: localStorage.getItem('vpylab-theme') || 'creative-light',
  setTheme: (theme) => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('vpylab-theme', theme);
    set({ theme });
  },

  // 언어
  locale: localStorage.getItem('vpylab-locale') || 'ko',
  setLocale: (locale) => {
    localStorage.setItem('vpylab-locale', locale);
    set({ locale });
  },

  // 미션 진행 상태 { [missionId]: { score, passed, completedAt } }
  missionProgress: JSON.parse(localStorage.getItem('vpylab-progress') || '{}'),
  completeMission: (missionId, score) => set((state) => {
    const prev = state.missionProgress[missionId];
    // 기존 최고 점수보다 높을 때만 업데이트
    if (prev && prev.score >= score) return state;
    const updated = {
      ...state.missionProgress,
      [missionId]: { score, passed: true, completedAt: new Date().toISOString() },
    };
    localStorage.setItem('vpylab-progress', JSON.stringify(updated));
    return { missionProgress: updated };
  }),
  getMissionScore: (missionId) => {
    const state = useAppStore.getState();
    return state.missionProgress[missionId]?.score ?? null;
  },
  getCompletedCount: (category) => {
    const state = useAppStore.getState();
    return Object.entries(state.missionProgress)
      .filter(([id, p]) => id.startsWith(category) && p.passed)
      .length;
  },

  // 로그인 시 localStorage 진행률을 Supabase에 동기화
  syncProgressToServer: async () => {
    const state = useAppStore.getState();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || Object.keys(state.missionProgress).length === 0) return;

    // 각 완료된 미션에 대해 제출 기록이 없으면 추가
    for (const [missionId, progress] of Object.entries(state.missionProgress)) {
      if (!progress.passed) continue;
      // 이미 제출 기록이 있는지 확인
      const { data: existing } = await supabase
        .from('vpylab_submissions')
        .select('id')
        .eq('user_id', user.id)
        .eq('mission_id', missionId)
        .eq('passed', true)
        .limit(1);

      if (!existing || existing.length === 0) {
        await supabase.from('vpylab_submissions').insert({
          user_id: user.id,
          mission_id: missionId,
          code: '(synced from localStorage)',
          score: progress.score,
          passed: true,
        });
      }
    }
  },

  // 상수
  THEMES,
  THEME_META,
}));

// 초기 테마 적용
const savedTheme = localStorage.getItem('vpylab-theme') || 'creative-light';
document.documentElement.setAttribute('data-theme', savedTheme);

export default useAppStore;

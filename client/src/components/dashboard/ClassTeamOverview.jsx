import { useEffect, useState } from 'react';
import { useI18n } from '../../i18n/useI18n';
import useAuthStore from '../../stores/authStore';
import { supabase } from '../../lib/supabase';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4034';

/**
 * 교사 학급 팀 프로젝트 개요.
 * 학급 학생들이 참여 중인 GitHub 공동 프로젝트와 팀원별 기여 이력(리비전 수)을 보여준다.
 * 팀 데이터는 RLS로 멤버만 접근 가능하므로, 교사 소유권을 검증하는 서버 엔드포인트를 통해 집계한다.
 */
export default function ClassTeamOverview() {
  const { user } = useAuthStore();
  const { t } = useI18n();
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 교사의 학급 목록
  useEffect(() => {
    if (!user) return;
    supabase
      .from('vpylab_classes')
      .select('id, name')
      .eq('teacher_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data: rows }) => {
        setClasses(rows || []);
        if (rows?.length > 0) setSelectedClassId(rows[0].id);
        else setLoading(false);
      });
  }, [user]);

  // 선택된 학급의 팀 프로젝트 개요 조회
  useEffect(() => {
    if (!selectedClassId) return;
    let cancelled = false;

    const fetchOverview = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) throw new Error(t('dashboard.team.loginRequired'));

        const res = await fetch(
          `${API_BASE}/api/projects/class-overview?classId=${encodeURIComponent(selectedClassId)}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || t('dashboard.team.loadError'));
        if (!cancelled) setData(json);
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchOverview();
    return () => { cancelled = true; };
  }, [selectedClassId, t]);

  const fmtDate = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  };

  if (classes.length === 0 && !loading) {
    return (
      <div
        className="rounded-md p-6 text-sm"
        style={{ backgroundColor: 'var(--color-bg-panel)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
      >
        {t('dashboard.team.noClasses')}
      </div>
    );
  }

  return (
    <div>
      {/* 학급 선택 */}
      {classes.length > 0 && (
        <div className="flex gap-2 flex-wrap mb-6">
          {classes.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedClassId(c.id)}
              className="mission-filter-btn"
              data-active={selectedClassId === c.id || undefined}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      {loading && (
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{t('common.loading')}</p>
      )}

      {error && !loading && (
        <div
          className="rounded-md p-4 text-sm"
          style={{ backgroundColor: 'var(--color-bg-panel)', border: '1px solid var(--color-danger, #e5484d)', color: 'var(--color-danger, #e5484d)' }}
        >
          {error}
        </div>
      )}

      {!loading && !error && data && (
        <>
          {/* 요약 */}
          <div className="flex gap-4 flex-wrap mb-6 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            <span>{t('dashboard.team.studentCount')}: <strong style={{ color: 'var(--color-text-primary)' }}>{data.studentCount}</strong></span>
            <span>{t('dashboard.team.projectCount')}: <strong style={{ color: 'var(--color-text-primary)' }}>{data.projects.length}</strong></span>
          </div>

          {data.projects.length === 0 ? (
            <div
              className="rounded-md p-6 text-sm"
              style={{ backgroundColor: 'var(--color-bg-panel)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
            >
              {t('dashboard.team.noProjects')}
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {data.projects.map((p) => {
                const maxRev = Math.max(1, ...p.contributions.map((c) => c.revisionCount));
                return (
                  <div
                    key={p.projectId}
                    className="rounded-md p-5"
                    style={{ backgroundColor: 'var(--color-bg-panel)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)' }}
                  >
                    <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
                      <h3 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                        {p.title}
                      </h3>
                      <div className="flex gap-3 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        <span>{t('dashboard.team.members')}: {p.memberCount}</span>
                        <span>{t('dashboard.team.revisions')}: {p.totalRevisions}</span>
                        {p.githubCommits > 0 && <span>GitHub: {p.githubCommits}</span>}
                        <span>{t('dashboard.team.lastActivity')}: {fmtDate(p.lastCommitAt || p.updatedAt)}</span>
                      </div>
                    </div>

                    {/* 팀원별 기여도 막대 */}
                    <div className="flex flex-col gap-2">
                      {p.contributions.map((c) => (
                        <div key={c.userId} className="flex items-center gap-3">
                          <div className="flex items-center gap-2 shrink-0" style={{ width: '9rem' }}>
                            {c.avatar ? (
                              <img src={c.avatar} alt="" className="w-5 h-5 rounded-full" />
                            ) : (
                              <div className="w-5 h-5 rounded-full shrink-0" style={{ background: 'var(--color-bg-tertiary)' }} />
                            )}
                            <span
                              className="text-xs truncate"
                              style={{ color: c.isClassStudent ? 'var(--color-text-primary)' : 'var(--color-text-muted)' }}
                              title={c.isClassStudent ? c.name : `${c.name} (${t('dashboard.team.external')})`}
                            >
                              {c.name}
                            </span>
                            {c.role === 'owner' && (
                              <span
                                className="text-[10px] px-1 rounded shrink-0"
                                style={{ background: 'var(--color-accent-soft, var(--color-bg-tertiary))', color: 'var(--color-accent)' }}
                              >
                                {t('dashboard.team.owner')}
                              </span>
                            )}
                          </div>
                          <div className="flex-1 h-3 rounded-full overflow-hidden" style={{ background: 'var(--color-bg-tertiary)' }}>
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${(c.revisionCount / maxRev) * 100}%`, background: 'var(--color-accent)', minWidth: c.revisionCount > 0 ? '4px' : '0' }}
                            />
                          </div>
                          <span className="text-xs shrink-0" style={{ width: '2.5rem', textAlign: 'right', color: 'var(--color-text-secondary)' }}>
                            {c.revisionCount}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

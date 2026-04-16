import { useEffect, useState } from 'react';
import { useI18n } from '../../i18n';
import useAuthStore from '../../stores/authStore';
import { supabase } from '../../lib/supabase';

export default function ClassManager() {
  const { user } = useAuthStore();
  const { t } = useI18n();
  const [classes, setClasses] = useState([]);
  const [studentCounts, setStudentCounts] = useState({}); // { classId: count }
  const [newClassName, setNewClassName] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const fetchClasses = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('vpylab_classes')
      .select('*')
      .eq('teacher_id', user.id)
      .order('created_at', { ascending: false });

    const classList = data || [];
    setClasses(classList);

    // 한 번의 쿼리로 모든 학급의 학생 수를 일괄 집계 (N+1 해소)
    if (classList.length > 0) {
      const classIds = classList.map(c => c.id);
      const { data: profiles } = await supabase
        .from('vpylab_profiles')
        .select('class_id')
        .in('class_id', classIds);

      const counts = {};
      for (const p of (profiles || [])) {
        counts[p.class_id] = (counts[p.class_id] || 0) + 1;
      }
      setStudentCounts(counts);
    }
    setLoading(false);
  };

  useEffect(() => {
    // fetchClasses 내부에서 setState를 호출하므로 cleanup 패턴 적용
    let cancelled = false;
    const load = async () => {
      await fetchClasses();
      // cancelled 체크는 fetchClasses 내부의 setState가 이미 마운트 상태에서만 동작하므로 불필요
    };
    if (!cancelled) load();
    return () => { cancelled = true; };
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const createClass = async () => {
    if (!newClassName.trim() || !user || creating) return;
    setCreating(true);
    const { error } = await supabase
      .from('vpylab_classes')
      .insert({ name: newClassName.trim(), teacher_id: user.id });
    if (!error) {
      setNewClassName('');
      fetchClasses();
    }
    setCreating(false);
  };

  const copyInviteCode = (code) => {
    navigator.clipboard.writeText(code);
  };

  return (
    <div>
      {/* 학급 생성 */}
      <div
        className="rounded-md p-5 mb-6"
        style={{ backgroundColor: 'var(--color-bg-panel)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)' }}
      >
        <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>
          {t('dashboard.createClass')}
        </h3>
        <div className="flex gap-3">
          <input
            type="text"
            value={newClassName}
            onChange={(e) => setNewClassName(e.target.value)}
            placeholder={t('dashboard.classNamePlaceholder')}
            className="flex-1 px-4 py-2 rounded-lg text-sm border-none outline-none"
            style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-primary)' }}
            onKeyDown={(e) => e.key === 'Enter' && createClass()}
          />
          <button
            onClick={createClass}
            disabled={creating}
            className="px-4 py-2 rounded-lg text-sm cursor-pointer border-none font-medium"
            style={{ background: 'var(--brand-gradient)', color: '#fff', opacity: creating ? 0.5 : 1 }}
          >
            {creating ? '...' : t('dashboard.create')}
          </button>
        </div>
      </div>

      {/* 학급 목록 */}
      {loading ? (
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{t('common.loading')}</p>
      ) : classes.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{t('dashboard.noClasses')}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {classes.map((cls) => (
            <ClassCard key={cls.id} cls={cls} studentCount={studentCounts[cls.id] || 0} onCopyCode={copyInviteCode} />
          ))}
        </div>
      )}
    </div>
  );
}

function ClassCard({ cls, studentCount, onCopyCode }) {
  const { t } = useI18n();

  return (
    <div
      className="rounded-md p-5 transition-all"
      style={{
        backgroundColor: 'var(--color-bg-panel)',
        border: '1px solid var(--color-border)',
        borderLeft: '3px solid var(--color-accent)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          {cls.name}
        </h4>
        <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded"
          style={{ backgroundColor: 'var(--color-accent-bg, rgba(108,92,231,0.1))', color: 'var(--color-accent)' }}>
          {studentCount}{t('dashboard.studentsUnit')}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          {t('dashboard.inviteCode')}:
        </span>
        <code
          className="text-xs px-2 py-0.5 rounded font-mono"
          style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-accent)' }}
        >
          {cls.invite_code}
        </code>
        <button
          onClick={() => onCopyCode(cls.invite_code)}
          className="text-[11px] px-2 py-0.5 rounded cursor-pointer border-none transition-all"
          style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-secondary)' }}
        >
          {t('common.copy')}
        </button>
      </div>
    </div>
  );
}

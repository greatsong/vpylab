import { useEffect, useState } from 'react';
import { useI18n } from '../../i18n';
import useAuthStore from '../../stores/authStore';
import { supabase } from '../../lib/supabase';

export default function ClassManager() {
  const { user } = useAuthStore();
  const { t } = useI18n();
  const [classes, setClasses] = useState([]);
  const [newClassName, setNewClassName] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchClasses = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('vpylab_classes')
      .select('*')
      .eq('teacher_id', user.id)
      .order('created_at', { ascending: false });
    setClasses(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchClasses(); }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const createClass = async () => {
    if (!newClassName.trim() || !user) return;
    const { error } = await supabase
      .from('vpylab_classes')
      .insert({ name: newClassName.trim(), teacher_id: user.id });
    if (!error) {
      setNewClassName('');
      fetchClasses();
    }
  };

  const copyInviteCode = (code) => {
    navigator.clipboard.writeText(code);
  };

  return (
    <div>
      {/* 학급 생성 */}
      <div
        className="rounded-xl p-6 mb-6"
        style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}
      >
        <h3 className="text-base font-medium mb-4" style={{ color: 'var(--color-text-primary)' }}>
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
            className="px-4 py-2 rounded-lg text-sm cursor-pointer border-none font-medium"
            style={{ background: 'var(--brand-gradient)', color: '#fff' }}
          >
            {t('dashboard.create')}
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
            <ClassCard key={cls.id} cls={cls} onCopyCode={copyInviteCode} />
          ))}
        </div>
      )}
    </div>
  );
}

function ClassCard({ cls, onCopyCode }) {
  const { t } = useI18n();
  const [studentCount, setStudentCount] = useState(0);

  useEffect(() => {
    supabase
      .from('vpylab_profiles')
      .select('id', { count: 'exact', head: true })
      .eq('class_id', cls.id)
      .then(({ count }) => setStudentCount(count || 0));
  }, [cls.id]);

  return (
    <div
      className="rounded-xl p-5"
      style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}
    >
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-base font-medium" style={{ color: 'var(--color-text-primary)' }}>
          {cls.name}
        </h4>
        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          {studentCount}{t('dashboard.studentsUnit')}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          {t('dashboard.inviteCode')}:
        </span>
        <code
          className="text-sm px-3 py-1 rounded-lg font-mono"
          style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-accent)' }}
        >
          {cls.invite_code}
        </code>
        <button
          onClick={() => onCopyCode(cls.invite_code)}
          className="text-xs px-2.5 py-1 rounded-lg cursor-pointer border-none"
          style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-secondary)' }}
        >
          {t('common.copy')}
        </button>
      </div>
    </div>
  );
}

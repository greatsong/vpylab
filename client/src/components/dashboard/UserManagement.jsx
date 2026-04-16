import { useEffect, useState } from 'react';
import { useI18n } from '../../i18n';
import { supabase } from '../../lib/supabase';

export default function UserManagement() {
  const { t } = useI18n();
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(null); // 변경 중인 user id

  const fetchUsers = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('vpylab_profiles')
      .select('id, display_name, avatar_url, role, created_at')
      .order('created_at', { ascending: false });
    setUsers(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const toggleRole = async (userId, currentRole) => {
    const newRole = currentRole === 'teacher' ? 'student' : 'teacher';
    setUpdating(userId);
    const { error } = await supabase.rpc('vpylab_set_user_role', {
      target_user_id: userId,
      new_role: newRole,
    });
    if (!error) {
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
      );
    }
    setUpdating(null);
  };

  const filtered = users.filter((u) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return u.display_name?.toLowerCase().includes(q);
  });

  return (
    <div>
      {/* 검색 */}
      <div
        className="rounded-md p-5 mb-6"
        style={{ backgroundColor: 'var(--color-bg-panel)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)' }}
      >
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('dashboard.searchUsers')}
          className="w-full px-4 py-2 rounded-lg text-sm border-none outline-none"
          style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-primary)' }}
        />
      </div>

      {/* 사용자 목록 */}
      {loading ? (
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{t('common.loading')}</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{t('dashboard.noUsers')}</p>
      ) : (
        <div
          className="rounded-md overflow-hidden"
          style={{ backgroundColor: 'var(--color-bg-panel)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)' }}
        >
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: 'var(--color-bg-tertiary)' }}>
                <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-muted)' }}>
                  {t('dashboard.student')}
                </th>
                <th className="text-center px-4 py-3 font-medium" style={{ color: 'var(--color-text-muted)' }}>
                  {t('dashboard.role')}
                </th>
                <th className="text-center px-4 py-3 font-medium" style={{ color: 'var(--color-text-muted)' }}>
                  {t('dashboard.changeRole')}
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr
                  key={u.id}
                  className="border-t"
                  style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-primary)' }}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {u.avatar_url ? (
                        <img src={u.avatar_url} alt="" className="w-6 h-6 rounded-full" />
                      ) : (
                        <span
                          className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold"
                          style={{ backgroundColor: 'var(--brand-primary)', color: '#fff' }}
                        >
                          {(u.display_name || '?')[0].toUpperCase()}
                        </span>
                      )}
                      <span style={{ color: 'var(--color-text-primary)' }}>{u.display_name}</span>
                    </div>
                  </td>
                  <td className="text-center px-4 py-3">
                    <span
                      className="text-xs px-2 py-0.5 rounded-full"
                      style={{
                        backgroundColor: u.role === 'admin'
                          ? 'var(--color-accent)'
                          : u.role === 'teacher'
                            ? 'var(--brand-primary)'
                            : 'var(--color-bg-tertiary)',
                        color: u.role === 'student' ? 'var(--color-text-secondary)' : '#fff',
                      }}
                    >
                      {u.role === 'admin' ? 'Admin' : t(`auth.${u.role}`)}
                    </span>
                  </td>
                  <td className="text-center px-4 py-3">
                    {u.role === 'admin' ? (
                      <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>—</span>
                    ) : (
                      <button
                        onClick={() => toggleRole(u.id, u.role)}
                        disabled={updating === u.id}
                        className="text-xs px-3 py-1 rounded-lg cursor-pointer border-none transition-all"
                        style={{
                          backgroundColor: u.role === 'teacher' ? 'var(--color-bg-tertiary)' : 'var(--brand-primary)',
                          color: u.role === 'teacher' ? 'var(--color-text-secondary)' : '#fff',
                          opacity: updating === u.id ? 0.5 : 1,
                        }}
                      >
                        {updating === u.id
                          ? '...'
                          : u.role === 'teacher'
                            ? t('dashboard.makeStudent')
                            : t('dashboard.makeTeacher')}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

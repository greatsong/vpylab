import { useEffect, useState } from 'react';
import { useI18n } from '../../i18n';
import useAuthStore from '../../stores/authStore';
import { supabase } from '../../lib/supabase';

export default function StudentProgress() {
  const { user } = useAuthStore();
  const { t } = useI18n();
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState(null);
  const [students, setStudents] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);

  // 교사의 학급 목록
  useEffect(() => {
    if (!user) return;
    supabase
      .from('vpylab_classes')
      .select('*')
      .eq('teacher_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setClasses(data || []);
        if (data?.length > 0) setSelectedClassId(data[0].id);
        setLoading(false);
      });
  }, [user]);

  // 선택된 학급의 학생 + 제출 기록
  useEffect(() => {
    if (!selectedClassId) return;

    const fetchData = async () => {
      setLoading(true);
      // 학급 학생 목록
      const { data: studentData } = await supabase
        .from('vpylab_profiles')
        .select('id, display_name, avatar_url')
        .eq('class_id', selectedClassId)
        .eq('role', 'student')
        .order('display_name');

      setStudents(studentData || []);

      // 학급 학생들의 제출 기록
      if (studentData?.length > 0) {
        const studentIds = studentData.map((s) => s.id);
        const { data: submissionData } = await supabase
          .from('vpylab_submissions')
          .select('user_id, mission_id, score, passed, created_at')
          .in('user_id', studentIds)
          .eq('passed', true)
          .order('created_at', { ascending: false });

        setSubmissions(submissionData || []);
      } else {
        setSubmissions([]);
      }
      setLoading(false);
    };

    fetchData();
  }, [selectedClassId]);

  // 학생별 완료 미션 수 계산
  const getStudentStats = (studentId) => {
    const studentSubs = submissions.filter((s) => s.user_id === studentId);
    const uniqueMissions = new Set(studentSubs.map((s) => s.mission_id));
    const totalScore = studentSubs.reduce((sum, s) => sum + s.score, 0);
    return { completed: uniqueMissions.size, totalScore };
  };

  if (loading && classes.length === 0) {
    return <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{t('common.loading')}</p>;
  }

  if (classes.length === 0) {
    return <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{t('dashboard.noClasses')}</p>;
  }

  return (
    <div>
      {/* 학급 선택 */}
      <div className="flex gap-2 mb-6">
        {classes.map((cls) => (
          <button
            key={cls.id}
            onClick={() => setSelectedClassId(cls.id)}
            className="px-3 py-1.5 rounded-lg text-xs cursor-pointer border-none transition-all"
            style={{
              backgroundColor: selectedClassId === cls.id ? 'var(--brand-primary)' : 'var(--color-bg-tertiary)',
              color: selectedClassId === cls.id ? '#fff' : 'var(--color-text-secondary)',
            }}
          >
            {cls.name}
          </button>
        ))}
      </div>

      {/* 학생 목록 */}
      {loading ? (
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{t('common.loading')}</p>
      ) : students.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{t('dashboard.noStudents')}</p>
      ) : (
        <div
          className="rounded-xl overflow-hidden"
          style={{ border: '1px solid var(--color-border)' }}
        >
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
                <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-muted)' }}>
                  {t('dashboard.student')}
                </th>
                <th className="text-center px-4 py-3 font-medium" style={{ color: 'var(--color-text-muted)' }}>
                  {t('dashboard.completedMissions')}
                </th>
                <th className="text-center px-4 py-3 font-medium" style={{ color: 'var(--color-text-muted)' }}>
                  {t('dashboard.totalScore')}
                </th>
              </tr>
            </thead>
            <tbody>
              {students.map((student) => {
                const stats = getStudentStats(student.id);
                return (
                  <tr
                    key={student.id}
                    className="border-t"
                    style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-primary)' }}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {student.avatar_url ? (
                          <img src={student.avatar_url} alt="" className="w-6 h-6 rounded-full" />
                        ) : (
                          <span
                            className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold"
                            style={{ backgroundColor: 'var(--brand-primary)', color: '#fff' }}
                          >
                            {(student.display_name || '?')[0].toUpperCase()}
                          </span>
                        )}
                        <span style={{ color: 'var(--color-text-primary)' }}>{student.display_name}</span>
                      </div>
                    </td>
                    <td className="text-center px-4 py-3">
                      <span style={{ color: 'var(--color-accent)' }}>{stats.completed}</span>
                      <span style={{ color: 'var(--color-text-muted)' }}> / 10</span>
                    </td>
                    <td className="text-center px-4 py-3" style={{ color: 'var(--color-text-secondary)' }}>
                      {stats.totalScore}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

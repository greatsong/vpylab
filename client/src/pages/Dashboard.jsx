import { useState } from 'react';
import { Link } from 'react-router-dom';
import Header from '../components/layout/Header';
import { useI18n } from '../i18n/useI18n';
import useAuthStore from '../stores/authStore';
import ClassManager from '../components/dashboard/ClassManager';
import StudentProgress from '../components/dashboard/StudentProgress';
import UserManagement from '../components/dashboard/UserManagement';

export default function Dashboard() {
  const { user } = useAuthStore();
  const isTeacher = useAuthStore((s) => s.isTeacher());
  const isAdmin = useAuthStore((s) => s.isAdmin());
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState('classes');

  if (!user) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
        <Header />
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-center">
            <p className="text-lg mb-4" style={{ color: 'var(--color-text-primary)' }}>{t('dashboard.loginRequired')}</p>
            <button
              onClick={() => useAuthStore.getState().setAuthModalOpen(true)}
              className="px-6 py-2 rounded-lg cursor-pointer border-none font-medium"
              style={{ background: 'var(--color-accent)', color: '#fff' }}
            >
              {t('auth.login')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!isTeacher) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
        <Header />
        <div className="max-w-3xl mx-auto px-6 py-12">
          <h1 className="text-2xl font-bold mb-6" style={{ color: 'var(--color-text-primary)' }}>
            {t('dashboard.studentView')}
          </h1>
          <StudentView />
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'classes', label: t('dashboard.classes') },
    { id: 'progress', label: t('dashboard.studentProgress') },
    ...(isAdmin ? [{ id: 'users', label: t('dashboard.userManagement') }] : []),
  ];

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
      <Header />
      <main className="flex-1 container-main py-8 w-full">
        {/* 브레드크럼 + 제목 */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1.5">
            <Link to="/" className="text-xs no-underline" style={{ color: 'var(--color-text-muted)' }}>
              {t('nav.home')}
            </Link>
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>/</span>
          </div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
            {t('dashboard.title')}
          </h1>
        </div>

        {/* 탭 — mission-filter-btn 스타일 */}
        <div className="flex gap-2 flex-wrap mb-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="mission-filter-btn"
              data-active={activeTab === tab.id || undefined}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 콘텐츠 */}
        {activeTab === 'classes' && <ClassManager />}
        {activeTab === 'progress' && <StudentProgress />}
        {activeTab === 'users' && <UserManagement />}
      </main>
    </div>
  );
}

// 학생 뷰: 초대 코드 입력
function StudentView() {
  const { profile, joinClass } = useAuthStore();
  const { t } = useI18n();
  const [inviteCode, setInviteCode] = useState('');
  const [message, setMessage] = useState('');

  const handleJoin = async () => {
    if (!inviteCode.trim()) return;
    const { error } = await joinClass(inviteCode.trim());
    if (error) {
      setMessage(error.message);
    } else {
      setMessage(t('dashboard.joinSuccess'));
      setInviteCode('');
    }
  };

  return (
    <div>
      {profile?.class_id ? (
        <div
          className="rounded-md p-5"
          style={{ backgroundColor: 'var(--color-bg-panel)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)' }}
        >
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            {t('dashboard.alreadyJoined')}
          </p>
        </div>
      ) : (
        <div
          className="rounded-md p-5"
          style={{ backgroundColor: 'var(--color-bg-panel)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)' }}
        >
          <h3 className="text-base font-medium mb-4" style={{ color: 'var(--color-text-primary)' }}>
            {t('dashboard.joinClass')}
          </h3>
          <div className="flex gap-3">
            <input
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              placeholder={t('dashboard.inviteCodePlaceholder')}
              className="flex-1 px-4 py-2 rounded-lg text-sm border-none outline-none"
              style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-primary)' }}
            />
            <button
              onClick={handleJoin}
              className="px-4 py-2 rounded-lg text-sm cursor-pointer border-none font-medium"
              style={{ background: 'var(--color-accent)', color: '#fff' }}
            >
              {t('dashboard.join')}
            </button>
          </div>
          {message && (
            <p className="mt-3 text-xs" style={{ color: 'var(--color-accent)' }}>{message}</p>
          )}
        </div>
      )}
    </div>
  );
}

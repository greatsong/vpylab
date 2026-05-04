import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { I18nProvider } from './i18n';
import Home from './pages/Home';
import AuthCallback from './pages/AuthCallback';
import AuthModal from './components/auth/AuthModal';
import useAuthStore from './stores/authStore';
import './index.css';

// 배포 후 구 청크 404 → 자동 새로고침 (Vite + SPA 배포 공통 이슈)
function lazyWithRetry(importFn) {
  return lazy(() =>
    importFn().catch(() => {
      window.location.reload();
      return new Promise(() => {}); // 새로고침 중 렌더 방지
    })
  );
}

// Code splitting — Monaco + Three.js는 Sandbox/Mission 진입 시에만 로드
const Sandbox = lazyWithRetry(() => import('./pages/Sandbox'));
const Missions = lazyWithRetry(() => import('./pages/Missions'));
const MissionPlay = lazyWithRetry(() => import('./pages/MissionPlay'));
const Courses = lazyWithRetry(() => import('./pages/Courses'));
const About = lazyWithRetry(() => import('./pages/About'));
const Dashboard = lazyWithRetry(() => import('./pages/Dashboard'));
const Gallery = lazyWithRetry(() => import('./pages/Gallery'));
const GalleryDetail = lazyWithRetry(() => import('./pages/GalleryDetail'));
const SharedCodeLoader = lazyWithRetry(() => import('./pages/SharedCodeLoader'));
const Docs = lazyWithRetry(() => import('./pages/Docs'));
const Privacy = lazyWithRetry(() => import('./pages/Privacy'));

function AppContent() {
  const initialize = useAuthStore((s) => s.initialize);

  useEffect(() => {
    const cleanup = initialize();
    return () => { if (cleanup) cleanup(); };
  }, [initialize]);

  return (
    <>
      <AuthModal />
      <Suspense fallback={
        <div className="h-screen flex items-center justify-center"
          style={{ backgroundColor: 'var(--color-bg-primary)', color: 'var(--color-text-muted)' }}>
          로딩 중...
        </div>
      }>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/courses" element={<Courses />} />
          <Route path="/courses/:courseId" element={<Courses />} />
          <Route path="/courses/:courseId/:lessonId" element={<Courses />} />
          <Route path="/sandbox" element={<Sandbox />} />
          <Route path="/missions" element={<Missions />} />
          <Route path="/mission/:missionId" element={<MissionPlay />} />
          <Route path="/docs" element={<Docs />} />
          <Route path="/about" element={<About />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/gallery" element={<Gallery />} />
          <Route path="/gallery/:id" element={<GalleryDetail />} />
          <Route path="/s/:id" element={<SharedCodeLoader />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
        </Routes>
      </Suspense>
    </>
  );
}

function App() {
  return (
    <I18nProvider>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </I18nProvider>
  );
}

export default App;

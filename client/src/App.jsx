import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { I18nProvider } from './i18n';
import Home from './pages/Home';
import AuthCallback from './pages/AuthCallback';
import AuthModal from './components/auth/AuthModal';
import useAuthStore from './stores/authStore';
import './index.css';

// Code splitting — Monaco + Three.js는 Sandbox/Mission 진입 시에만 로드
const Sandbox = lazy(() => import('./pages/Sandbox'));
const Missions = lazy(() => import('./pages/Missions'));
const MissionPlay = lazy(() => import('./pages/MissionPlay'));
const About = lazy(() => import('./pages/About'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Gallery = lazy(() => import('./pages/Gallery'));
const GalleryDetail = lazy(() => import('./pages/GalleryDetail'));
const SharedCodeLoader = lazy(() => import('./pages/SharedCodeLoader'));
const AILabIndex = lazy(() => import('./pages/ai-lab/AILabIndex'));
const TeachableMachine = lazy(() => import('./pages/ai-lab/TeachableMachine'));
const RLPlayground = lazy(() => import('./pages/ai-lab/RLPlayground'));
const NeuralNetViz = lazy(() => import('./pages/ai-lab/NeuralNetViz'));
const PoseDance = lazy(() => import('./pages/ai-lab/PoseDance'));
const PhysicsPrediction = lazy(() => import('./pages/ai-lab/PhysicsPrediction'));

function AppContent() {
  const initialize = useAuthStore((s) => s.initialize);

  useEffect(() => {
    initialize();
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
          <Route path="/sandbox" element={<Sandbox />} />
          <Route path="/missions" element={<Missions />} />
          <Route path="/mission/:missionId" element={<MissionPlay />} />
          <Route path="/about" element={<About />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/gallery" element={<Gallery />} />
          <Route path="/gallery/:id" element={<GalleryDetail />} />
          <Route path="/s/:id" element={<SharedCodeLoader />} />
          <Route path="/ai-lab" element={<AILabIndex />} />
          <Route path="/ai-lab/teachable" element={<TeachableMachine />} />
          <Route path="/ai-lab/rl" element={<RLPlayground />} />
          <Route path="/ai-lab/neural-viz" element={<NeuralNetViz />} />
          <Route path="/ai-lab/pose-dance" element={<PoseDance />} />
          <Route path="/ai-lab/physics" element={<PhysicsPrediction />} />
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

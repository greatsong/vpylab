import { Component, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../index.css';
import './classroom.css';
import ClassroomApp from './ClassroomApp.jsx';

class ClassroomBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <main className="classroom-shell cr-empty"><h1>화면을 다시 준비해야 합니다.</h1><p>이 기기에 보존된 초안은 새로고침 후 다시 불러옵니다.</p><button className="cr-button" onClick={() => window.location.reload()}>다시 열기</button></main>;
    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(<StrictMode><ClassroomBoundary><ClassroomApp /></ClassroomBoundary></StrictMode>);

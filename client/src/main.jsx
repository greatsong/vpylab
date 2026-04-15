import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Monaco Editor의 비동기 작업 취소 시 발생하는 무해한 "Canceled" 에러 무시
window.addEventListener('unhandledrejection', (e) => {
  if (e.reason?.name === 'Canceled' || e.reason?.message === 'Canceled') {
    e.preventDefault();
  }
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

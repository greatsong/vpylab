/**
 * Express API 주소. 운영은 VITE_API_URL(Railway), 개발은 localhost:4034.
 * 교실 LAN 모드(VITE_LAN_MODE=1)는 같은 출처('')로 보내 LAN 서버가 안내 응답을 돌려줍니다.
 */
export const LAN_MODE = import.meta.env.VITE_LAN_MODE === '1';
export const API_BASE = import.meta.env.VITE_API_URL || (LAN_MODE ? '' : 'http://localhost:4034');

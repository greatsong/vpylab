/**
 * VPyLab — 3D 뷰포트 썸네일 캡처
 * Three.js renderer의 현재 프레임을 JPEG base64로 변환
 */

/**
 * Three.js renderer에서 현재 프레임을 캡처
 * @param {HTMLCanvasElement} canvas - renderer.domElement
 * @param {number} maxWidth - 최대 너비 (기본 400)
 * @param {number} quality - JPEG 품질 0~1 (기본 0.7)
 * @returns {string} base64 JPEG 문자열 (data:image/jpeg;base64,...)
 */
export function captureThumbnail(canvas, maxWidth = 400, quality = 0.7) {
  if (!canvas) return null;

  // 원본 캔버스에서 리사이즈
  const ratio = Math.min(maxWidth / canvas.width, 1);
  const w = Math.round(canvas.width * ratio);
  const h = Math.round(canvas.height * ratio);

  const offscreen = document.createElement('canvas');
  offscreen.width = w;
  offscreen.height = h;
  const ctx = offscreen.getContext('2d');
  ctx.drawImage(canvas, 0, 0, w, h);

  return offscreen.toDataURL('image/jpeg', quality);
}

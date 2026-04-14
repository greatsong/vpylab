/**
 * HiDPI Canvas 유틸리티
 * 모든 AI Lab 캔버스에서 선명한 렌더링을 위해 사용
 */

/**
 * 캔버스를 HiDPI 해상도로 설정하고 2D 컨텍스트를 반환한다.
 * @param {HTMLCanvasElement} canvas
 * @param {number} logicalWidth  — CSS 논리 픽셀 너비
 * @param {number} logicalHeight — CSS 논리 픽셀 높이
 * @returns {CanvasRenderingContext2D}
 */
export function setupHiDPICanvas(canvas, logicalWidth, logicalHeight) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = logicalWidth * dpr;
  canvas.height = logicalHeight * dpr;
  canvas.style.width = `${logicalWidth}px`;
  canvas.style.height = `${logicalHeight}px`;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

/**
 * CSS 변수에서 색상 값을 읽어온다.
 * Canvas 2D 컨텍스트는 var()를 지원하지 않으므로
 * getComputedStyle로 실제 값을 가져와야 한다.
 */
export function getCSSColor(varName, fallback = '#888') {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(varName).trim() || fallback;
}

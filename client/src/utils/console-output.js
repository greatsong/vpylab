// 콘솔에 보관할 최대 줄 수 — rate() 루프 안의 print가 끝없이 쌓여 화면이 느려지는 것을 막는다
export const MAX_CONSOLE_LINES = 1000;

/**
 * 콘솔 출력 목록에 한 줄 추가 (오래된 줄부터 버림)
 */
export function appendOutput(prev, text, type) {
  const next = [...prev, { text, type, id: Date.now() + Math.random() }];
  return next.length > MAX_CONSOLE_LINES ? next.slice(-MAX_CONSOLE_LINES) : next;
}

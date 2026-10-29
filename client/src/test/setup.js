import '@testing-library/jest-dom';

// Node 22+는 자체 localStorage 전역(--localstorage-file 없이는 비어 있는 객체)을 두어 jsdom의 것을 가립니다.
// getItem이 없으면 메모리 Storage로 바꿔 둡니다. CI(Node 20)에서는 jsdom의 localStorage가 그대로 쓰입니다.
function memoryStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(String(key), String(value)); },
    removeItem: (key) => { map.delete(key); },
    clear: () => map.clear(),
    key: (index) => [...map.keys()][index] ?? null,
    get length() { return map.size; },
  };
}
for (const name of ['localStorage', 'sessionStorage']) {
  if (typeof globalThis[name]?.getItem !== 'function') {
    Object.defineProperty(globalThis, name, { value: memoryStorage(), configurable: true, writable: true });
  }
}

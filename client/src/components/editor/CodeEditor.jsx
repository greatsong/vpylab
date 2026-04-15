import { useRef, useCallback } from 'react';
import Editor, { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import useAppStore from '../../stores/appStore';

// Monaco Web Worker 설정 — 누락 시 "MonacoEnvironment.getWorker" 오류 발생
self.MonacoEnvironment = {
  getWorker() {
    return new editorWorker();
  },
};

loader.config({ monaco });

const MONACO_THEME_MAP = {
  'creative-light': 'vs',
  'deep-dark': 'vs-dark',
  'ocean-breeze': 'vs',
  'sunset-glow': 'vs',
  'forest-night': 'vs-dark',
  'lavender-dream': 'vs',
  'midnight-purple': 'vs-dark',
  'rose-garden': 'vs',
  'cyber-neon': 'vs-dark',
};

const DEFAULT_CODE = `from vpython import *

# 구를 만들고 움직여보세요
ball = sphere(pos=vector(0, 0, 0), radius=0.5, color=color.cyan)
ball.velocity = vector(1, 0, 0)

dt = 0.01
while True:
    rate(100)
    ball.pos = ball.pos + ball.velocity * dt

    # 벽에 부딪히면 반사
    if abs(ball.pos.x) > 5:
        ball.velocity.x = -ball.velocity.x
`;

export default function CodeEditor({ code, onChange, fontSize = 14 }) {
  const editorRef = useRef(null);
  const theme = useAppStore((s) => s.theme);

  const handleMount = useCallback((editor) => {
    editorRef.current = editor;
    editor.focus();
  }, []);

  return (
    <div className="h-full w-full overflow-hidden" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
      <Editor
        height="100%"
        language="python"
        theme={MONACO_THEME_MAP[theme] || 'vs-dark'}
        value={code ?? DEFAULT_CODE}
        onChange={onChange}
        onMount={handleMount}
        options={{
          fontSize,
          fontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, Consolas, monospace",
          fontLigatures: true,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          lineNumbers: 'on',
          roundedSelection: true,
          padding: { top: 12 },
          tabSize: 4,
          insertSpaces: true,
          automaticLayout: true,
          wordWrap: 'on',
          bracketPairColorization: { enabled: true },
          renderLineHighlight: 'line',
          cursorBlinking: 'smooth',
          cursorSmoothCaretAnimation: 'on',
          smoothScrolling: true,
          suggest: {
            showKeywords: true,
            showSnippets: true,
          },
        }}
      />
    </div>
  );
}

export { DEFAULT_CODE };

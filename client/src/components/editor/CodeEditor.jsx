import { useRef, useCallback } from 'react';
import Editor, { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import useAppStore from '../../stores/appStore';
import { registerVpylabCompletions } from './vpylab-completions';

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

export default function CodeEditor({ code, onChange, fontSize = 14, readOnly = false }) {
  const editorRef = useRef(null);
  const theme = useAppStore((s) => s.theme);

  const handleMount = useCallback((editor) => {
    editorRef.current = editor;
    // VPyLab 전용 자동 완성(색·음·효과음·API)은 첫 마운트 때 한 번만 등록된다
    registerVpylabCompletions(monaco);
    editor.focus();
    // 폰트 합자 명시적 OFF — props만으로 안 먹는 환경 방어
    editor.updateOptions({ fontLigatures: false });
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
          readOnly,
          fontSize,
          fontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, Consolas, monospace",
          fontLigatures: false,  // 학생이 != 를 ≠ 로 오인하지 않도록 합자 OFF
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
          // 문자열 안(색상['빨, 음표("도)에서도 제안이 뜨도록 strings 를 켠다
          quickSuggestions: { other: true, comments: false, strings: true },
          quickSuggestionsDelay: 50,
          suggestOnTriggerCharacters: true,
          acceptSuggestionOnEnter: 'on',
          suggest: {
            showKeywords: true,
            showSnippets: true,
            // 스니펫 탭 정지 안(sphere(color=|))에서도 자동 제안이 뜨게
            snippetsPreventQuickSuggestions: false,
            preview: false,
          },
        }}
      />
    </div>
  );
}

export { DEFAULT_CODE };

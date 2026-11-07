import { useRef, useCallback, useEffect, useState } from 'react';
import Editor, { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import useAppStore from '../../stores/appStore';
import { codeVocabulary } from '../../data/code-vocabulary';
import { claimWordTip, rememberWord } from '../../utils/word-help';
import useAuthStore from '../../stores/authStore';
import TypingWordTip from '../learning/TypingWordTip';
import { registerPythonHelp, pythonContext } from './python-completions';

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
  const editorRef = useRef(null),hostRef=useRef(null),cleanupRef=useRef(()=>{});
  const [tip,setTip]=useState(null);
  const locale=useAppStore(s=>s.locale),owner=useAuthStore(s=>s.user?.id);
  useEffect(()=>()=>cleanupRef.current(),[]);
  const theme = useAppStore((s) => s.theme);

  const handleMount = useCallback((editor) => {
    editorRef.current = editor;
    editor.focus();
    // 폰트 합자 명시적 OFF — props만으로 안 먹는 환경 방어
    editor.updateOptions({ fontLigatures: false });
    cleanupRef.current();
    let pending=null,hideTimer=null,lastKey='';
    const hide=()=>{clearTimeout(pending);clearTimeout(hideTimer);setTip(null);};
    const changed=editor.onDidChangeModelContent(event=>{
      hide();
      if(!editor.getModel()?.getValue()||event.changes.some(c=>c.rangeLength>0))lastKey='';
      if(event.isFlush||event.isUndoing||event.isRedoing||event.changes.length!==1||event.changes[0].text.length>30||event.changes[0].text.includes('\n')){lastKey='';return;}
      pending=setTimeout(()=>{
        if(!editor.hasTextFocus()||editor.getDomNode()?.querySelector('.suggest-widget.visible'))return;
        const p=editor.getPosition(),model=editor.getModel();if(!p||!model)return;
        const prefix=model.getValueInRange({startLineNumber:1,startColumn:1,endLineNumber:p.lineNumber,endColumn:p.column});
        if(prefix.length>100000||pythonContext(prefix).blocked)return;
        const match=prefix.match(/([\p{L}_][\p{L}\p{N}_]*)[ \t]*(?:[=(])?[ \t]*$/u),term=match&&codeVocabulary.find(w=>w.id===match[1]);
        if(!term){lastKey='';return;}
        const tokenKey=term.id+':'+(prefix.length-match[0].length);if(tokenKey===lastKey)return;
        const userId=useAuthStore.getState().user?.id;
        const point=editor.getScrolledVisiblePosition(p),host=hostRef.current,dom=editor.getDomNode();if(!point||!host||!dom||!claimWordTip(userId,term.id))return;
        lastKey=tokenKey;const width=Math.min(320,host.clientWidth-16),relativeTop=dom.getBoundingClientRect().top-host.getBoundingClientRect().top,below=relativeTop+point.top+point.height+8;
        setTip({term,owner:userId,left:Math.max(8,Math.min(point.left,host.clientWidth-width-8)),top:below+215<host.clientHeight?below:Math.max(8,relativeTop+point.top-215),width});
        hideTimer=setTimeout(()=>setTip(null),6000);
      },320);
    });
    const scroll=editor.onDidScrollChange(e=>{if(e.scrollTopChanged||e.scrollLeftChanged)hide();}),blur=editor.onDidBlurEditorWidget(hide),keys=editor.onKeyDown(e=>{if(e.keyCode===monaco.KeyCode.Escape)hide();});
    cleanupRef.current=()=>{clearTimeout(pending);clearTimeout(hideTimer);changed.dispose();scroll.dispose();blur.dispose();keys.dispose();};

  }, []);

  return (
    <div ref={hostRef} className="h-full w-full overflow-hidden flex flex-col relative" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
      <div className="flex justify-end px-3 py-1 shrink-0"><button type="button" disabled={readOnly} onClick={()=>{editorRef.current?.focus();editorRef.current?.trigger('word-help','editor.action.triggerSuggest',{});}} className="text-xs border-0 bg-transparent cursor-pointer" style={{color:'var(--color-text-muted)'}} title={locale==='ko'?'Tab으로 적용 · Esc로 닫기':'Tab to accept · Esc to close'}>{locale==='ko'?'자동 완성':'Complete'}</button></div>
      <div className="flex-1 min-h-0"><Editor
        height="100%"
        language="python"
        theme={MONACO_THEME_MAP[theme] || 'vs-dark'}
        value={code ?? DEFAULT_CODE}
        onChange={onChange}
        onMount={handleMount}
        beforeMount={instance=>registerPythonHelp(instance,()=>useAppStore.getState().locale||'ko')}
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
          quickSuggestions: {other:true,comments:false,strings:false},
          suggestOnTriggerCharacters: true,
          acceptSuggestionOnEnter: 'off',
          wordBasedSuggestions: 'currentDocument',
          parameterHints: {enabled:true},
          suggest: {
            showKeywords: true,
            showSnippets: true,
          },
        }}
      /></div>
      {tip&&tip.owner===owner&&<TypingWordTip tip={tip} ko={locale==='ko'} onClose={()=>setTip(null)} onRemember={()=>{rememberWord(owner,tip.term.id);setTip(null);}}/>}
    </div>
  );
}

export { DEFAULT_CODE };

import { WordPicture } from './CodeVocabulary';
import './code-vocabulary.css';
export default function TypingWordTip({tip,ko,onClose,onRemember}){
 const term=tip.term;
 return <aside className="typing-word-tip" aria-label={ko?'입력한 단어 뜻':'Meaning of the word you typed'} style={{left:tip.left,top:tip.top,width:tip.width}} onMouseDown={e=>e.preventDefault()}>
  <button type="button" className="typing-tip-close" aria-label={ko?'단어 뜻 닫기':'Close word meaning'} onClick={onClose}>×</button>
  <div className="vocabulary-definition"><WordPicture term={term.id} ko={ko}/><div><p className="vocabulary-meaning"><code>{term.id}</code> <strong>{ko?term.meaning:''}</strong></p>{ko&&<small className="typing-tip-reading">{term.reading}</small>}<p>{ko?term.explanation:term.english}</p><pre><code>{term.example}</code></pre><button type="button" className="vocabulary-remember" onClick={onRemember}>{ko?'알겠어요':'Got it'}</button></div></div>
 </aside>;
}

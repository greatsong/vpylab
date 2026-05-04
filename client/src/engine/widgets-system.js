/**
 * VPyLab — UI 위젯 시스템
 * Python에서 생성한 slider/button/checkbox/radio/menu/winput을
 * 메인 스레드의 DOM 패널에 렌더링하고, 사용자 입력을 Worker로 전달.
 *
 * 보안:
 * - 모든 텍스트는 textContent로만 설정 (innerHTML 금지)
 * - 위젯 ID는 신뢰된 워커에서 생성됨 (sanitize 불필요)
 */

import { postEvent, postWidgetValue } from './pyodide-singleton';

// 위젯 패널 DOM 컨테이너
let panelEl = null;
const widgetRegistry = new Map(); // id → { el, kind, value }

function ensurePanel() {
  if (panelEl) return panelEl;
  panelEl = document.querySelector('[data-vpylab-widgets]');
  if (panelEl) return panelEl;

  panelEl = document.createElement('div');
  panelEl.setAttribute('data-vpylab-widgets', '');
  panelEl.style.cssText = [
    'position:absolute', 'top:8px', 'right:8px',
    'max-width:280px', 'max-height:60%',
    'overflow:auto', 'z-index:10',
    'padding:10px 12px', 'border-radius:8px',
    'background:rgba(255,255,255,0.92)',
    'box-shadow:0 2px 8px rgba(0,0,0,0.15)',
    'font:13px/1.4 "DM Sans", "Noto Sans KR", sans-serif',
    'color:#222',
    'display:flex', 'flex-direction:column', 'gap:8px',
  ].join(';');

  // 3D 뷰포트 컨테이너 안에 부착 (없으면 body)
  const host = document.querySelector('[data-vpylab-viewport]') || document.body;
  // 호스트가 static positioning이면 위젯이 화면 우상단에 잘못 붙으므로 보정
  const cs = host && host.nodeType === 1 ? getComputedStyle(host) : null;
  if (cs && cs.position === 'static' && host !== document.body) {
    host.style.position = 'relative';
  }
  host.appendChild(panelEl);
  return panelEl;
}

function removePanelIfEmpty() {
  if (panelEl && widgetRegistry.size === 0) {
    panelEl.remove();
    panelEl = null;
  }
}

/**
 * 위젯 생성
 */
export function createWidget(cmd) {
  const panel = ensurePanel();
  const wrap = document.createElement('div');
  wrap.dataset.widgetId = cmd.id;
  wrap.style.cssText = 'display:flex;align-items:center;gap:8px;';

  let inputEl = null;

  switch (cmd.kind) {
    case 'slider': {
      const label = document.createElement('span');
      label.textContent = String(cmd.value ?? cmd.min ?? 0);
      label.style.cssText = 'min-width:36px;text-align:right;font-variant-numeric:tabular-nums;';
      inputEl = document.createElement('input');
      inputEl.type = 'range';
      inputEl.min = String(cmd.min ?? 0);
      inputEl.max = String(cmd.max ?? 1);
      inputEl.step = String(cmd.step ?? 0.01);
      inputEl.value = String(cmd.value ?? cmd.min ?? 0);
      inputEl.style.flex = '1';
      if (cmd.length) inputEl.style.width = `${cmd.length}px`;
      inputEl.addEventListener('input', () => {
        const v = parseFloat(inputEl.value);
        label.textContent = inputEl.value;
        widgetRegistry.get(cmd.id).value = v;
        postWidgetValue(cmd.id, v);
        postEvent({ name: 'widget', widget: cmd.id, value: v });
      });
      wrap.appendChild(inputEl);
      wrap.appendChild(label);
      break;
    }

    case 'button': {
      inputEl = document.createElement('button');
      inputEl.type = 'button';
      inputEl.textContent = String(cmd.text ?? 'Button');
      inputEl.style.cssText = 'padding:6px 12px;border-radius:6px;border:1px solid #999;background:#f5f5f5;cursor:pointer;';
      inputEl.addEventListener('click', () => {
        postEvent({ name: 'widget', widget: cmd.id });
      });
      wrap.appendChild(inputEl);
      break;
    }

    case 'checkbox': {
      const id = `vp_cb_${cmd.id}`;
      inputEl = document.createElement('input');
      inputEl.type = 'checkbox';
      inputEl.id = id;
      inputEl.checked = Boolean(cmd.checked);
      const label = document.createElement('label');
      label.htmlFor = id;
      label.textContent = String(cmd.text ?? '');
      inputEl.addEventListener('change', () => {
        const v = inputEl.checked;
        widgetRegistry.get(cmd.id).value = v;
        postWidgetValue(cmd.id, v);
        postEvent({ name: 'widget', widget: cmd.id, value: v });
      });
      wrap.appendChild(inputEl);
      wrap.appendChild(label);
      break;
    }

    case 'radio': {
      const id = `vp_rd_${cmd.id}`;
      inputEl = document.createElement('input');
      inputEl.type = 'radio';
      inputEl.id = id;
      inputEl.name = String(cmd.name ?? 'radio_group');
      inputEl.checked = Boolean(cmd.checked);
      const label = document.createElement('label');
      label.htmlFor = id;
      label.textContent = String(cmd.text ?? '');
      inputEl.addEventListener('change', () => {
        if (inputEl.checked) {
          const v = cmd.radio_value ?? cmd.text;
          widgetRegistry.get(cmd.id).value = v;
          postWidgetValue(cmd.id, v);
          postEvent({ name: 'widget', widget: cmd.id, value: v });
        }
      });
      wrap.appendChild(inputEl);
      wrap.appendChild(label);
      break;
    }

    case 'menu': {
      inputEl = document.createElement('select');
      inputEl.style.cssText = 'padding:4px 6px;border-radius:6px;border:1px solid #999;background:#fff;';
      for (const choice of (cmd.choices || [])) {
        const opt = document.createElement('option');
        opt.value = String(choice);
        opt.textContent = String(choice);
        if (choice === cmd.selected) opt.selected = true;
        inputEl.appendChild(opt);
      }
      inputEl.addEventListener('change', () => {
        const v = inputEl.value;
        widgetRegistry.get(cmd.id).value = v;
        postWidgetValue(cmd.id, v);
        postEvent({ name: 'widget', widget: cmd.id, value: v });
      });
      wrap.appendChild(inputEl);
      break;
    }

    case 'winput': {
      const promptEl = document.createElement('span');
      promptEl.textContent = String(cmd.prompt ?? '');
      promptEl.style.cssText = 'min-width:60px;color:#444;';
      inputEl = document.createElement('input');
      inputEl.type = cmd.input_type === 'string' ? 'text' : 'number';
      inputEl.style.cssText = 'flex:1;padding:4px 6px;border-radius:6px;border:1px solid #999;background:#fff;';
      const submit = () => {
        let v = inputEl.value;
        if (cmd.input_type !== 'string') {
          const n = parseFloat(v);
          v = Number.isFinite(n) ? n : null;
        }
        widgetRegistry.get(cmd.id).value = v;
        postWidgetValue(cmd.id, v);
        postEvent({ name: 'widget', widget: cmd.id, value: v });
      };
      inputEl.addEventListener('change', submit);
      inputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') submit();
      });
      wrap.appendChild(promptEl);
      wrap.appendChild(inputEl);
      break;
    }

    default:
      console.warn(`[Widgets] 알 수 없는 위젯 종류: ${cmd.kind}`);
      return;
  }

  if (inputEl && cmd.disabled) inputEl.disabled = true;
  if (cmd.visible === false) wrap.style.display = 'none';

  panel.appendChild(wrap);
  widgetRegistry.set(cmd.id, { el: wrap, input: inputEl, kind: cmd.kind, value: cmd.value });
}

export function updateWidget(cmd) {
  const w = widgetRegistry.get(cmd.id);
  if (!w) return;
  if (cmd.value !== undefined && w.input) {
    if (w.kind === 'slider') {
      w.input.value = String(cmd.value);
      // 라벨 업데이트
      const label = w.el.querySelector('span');
      if (label) label.textContent = String(cmd.value);
    } else if (w.kind === 'checkbox') {
      w.input.checked = Boolean(cmd.value);
    } else if (w.kind === 'menu' || w.kind === 'winput') {
      w.input.value = String(cmd.value);
    }
    w.value = cmd.value;
  }
  if (cmd.text !== undefined && w.kind === 'button') {
    w.input.textContent = String(cmd.text);
  }
  if (cmd.disabled !== undefined && w.input) {
    w.input.disabled = Boolean(cmd.disabled);
  }
  if (cmd.visible !== undefined) {
    w.el.style.display = cmd.visible ? 'flex' : 'none';
  }
}

export function deleteWidget(cmd) {
  const w = widgetRegistry.get(cmd.id);
  if (!w) return;
  w.el.remove();
  widgetRegistry.delete(cmd.id);
  removePanelIfEmpty();
}

export function clearWidgets() {
  for (const [, w] of widgetRegistry) w.el.remove();
  widgetRegistry.clear();
  if (panelEl) {
    panelEl.remove();
    panelEl = null;
  }
}

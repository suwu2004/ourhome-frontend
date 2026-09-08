import { useEffect, useRef, useState } from 'react';
import { TheaterRoom as TheaterRoomV2 } from './TheaterRoomV2.jsx';

const THINKING_EVENT = 'ourhome-theater-thinking';

function installTheaterThinkingRelay() {
  if (typeof window === 'undefined' || window.__ourhomeTheaterThinkingRelayInstalled) return;
  window.__ourhomeTheaterThinkingRelayInstalled = true;
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (...args) => {
    const response = await originalFetch(...args);
    const input = args[0];
    const url = typeof input === 'string' || input instanceof URL ? String(input) : input?.url || '';
    if (/\/theater\/books\/[^/]+\/chat(?:\?|$)/i.test(url)) {
      response.clone().json().then(data => {
        const thinking = String(data?.assistant_message?.reasoning_content || '').trim();
        if (!thinking) return;
        window.dispatchEvent(new CustomEvent(THINKING_EVENT, { detail: { thinking, at: Date.now(), url } }));
      }).catch(() => {});
    }
    return response;
  };
}

installTheaterThinkingRelay();

function readContextButton() {
  if (typeof document === 'undefined') return { text: '', tokens: 0 };
  const button = [...document.querySelectorAll('button')].find(node => node.textContent?.trim().startsWith('◎ 上下文'));
  const text = button?.textContent?.trim() || '';
  const match = text.match(/◎\s*上下文\s*([\d.]+[kKmM万]?|—)/);
  if (!match || match[1] === '—') return { text, tokens: 0 };
  const raw = match[1].toLowerCase();
  const amount = Number.parseFloat(raw);
  if (!Number.isFinite(amount)) return { text, tokens: 0 };
  return { text, tokens: raw.endsWith('m') ? Math.round(amount * 1_000_000) : raw.endsWith('k') ? Math.round(amount * 1_000) : raw.endsWith('万') ? Math.round(amount * 10_000) : Math.round(amount) };
}

function findChatScroller(shell) {
  return [...shell.querySelectorAll('div')].find(node => {
    const style = window.getComputedStyle(node);
    return style.overflowY === 'auto' && node.scrollHeight > node.clientHeight;
  }) || null;
}

function findLatestAssistantColumn(scroller) {
  if (!scroller) return null;
  const rows = [...scroller.children].filter(node => node instanceof HTMLElement);
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const row = rows[index];
    const columns = [...row.children].filter(node => node instanceof HTMLElement);
    if (columns.length < 2) continue;
    const column = columns[1];
    if (window.getComputedStyle(row).flexDirection !== 'row-reverse') return column;
  }
  return null;
}

function mountThinkingElement(column, thinking, open, setOpen) {
  if (!column || !thinking) return;
  const existing = column.querySelector('[data-ourhome-theater-thinking="true"]');
  if (existing) existing.remove();

  const wrap = document.createElement('div');
  wrap.dataset.ourhomeTheaterThinking = 'true';
  wrap.style.cssText = 'display:flex;flex-direction:column;align-items:flex-start;margin-top:0;padding:0;';

  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = `💭 想了想${open ? ' ▲' : ' ▼'}`;
  button.setAttribute('aria-expanded', open ? 'true' : 'false');
  button.style.cssText = 'border:0;background:transparent;padding:0;color:#8B8177;font-family:inherit;font-size:10.5px;line-height:1.4;cursor:pointer;display:inline-flex;align-items:center;gap:3px;';
  button.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    setOpen(value => !value);
  });
  wrap.appendChild(button);

  if (open) {
    const detail = document.createElement('div');
    detail.textContent = thinking;
    detail.style.cssText = 'margin-top:4px;padding:8px 12px;border-radius:10px;background:rgba(120,100,80,.08);color:#8B8177;font-size:12px;line-height:1.6;white-space:pre-wrap;font-style:italic;box-shadow:0 4px 16px rgba(80,55,25,.08);max-width:min(420px,78vw);';
    wrap.appendChild(detail);
  }
  column.appendChild(wrap);
}

export function TheaterRoom(props) {
  const [thinking, setThinking] = useState('');
  const [thinkingOpen, setThinkingOpen] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const [contextUsage, setContextUsage] = useState({ text: '', tokens: 0 });
  const shellRef = useRef(null);

  useEffect(() => {
    const onThinking = event => {
      const value = String(event.detail?.thinking || '').trim();
      if (!value) return;
      setThinking(value);
      setThinkingOpen(false);
    };
    window.addEventListener(THINKING_EVENT, onThinking);
    return () => window.removeEventListener(THINKING_EVENT, onThinking);
  }, []);

  useEffect(() => {
    if (!props.visible || !thinking) return undefined;
    const shell = shellRef.current;
    if (!shell) return undefined;
    let frame = 0;
    const sync = () => {
      frame = 0;
      const scroller = findChatScroller(shell);
      const column = findLatestAssistantColumn(scroller);
      if (column) mountThinkingElement(column, thinking, thinkingOpen, setThinkingOpen);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(sync);
    };
    schedule();
    const observer = new MutationObserver(schedule);
    observer.observe(shell, { childList: true, subtree: true, characterData: true });
    const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(schedule) : null;
    if (resizeObserver) resizeObserver.observe(shell);
    window.addEventListener('resize', schedule);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      observer.disconnect();
      resizeObserver?.disconnect();
      window.removeEventListener('resize', schedule);
    };
  }, [props.visible, thinking, thinkingOpen]);

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return undefined;
    const onClickCapture = event => {
      const button = event.target?.closest?.('button');
      if (!button || !button.textContent?.trim().startsWith('◎ 上下文')) return;
      event.preventDefault();
      event.stopPropagation();
      setContextUsage(readContextButton());
      setContextOpen(open => !open);
    };
    shell.addEventListener('click', onClickCapture, true);
    return () => shell.removeEventListener('click', onClickCapture, true);
  }, []);

  useEffect(() => {
    if (!contextOpen) return undefined;
    const close = event => {
      if (shellRef.current?.contains(event.target)) return;
      setContextOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [contextOpen]);

  return (
    <div ref={shellRef} style={{ position: 'absolute', inset: 0, pointerEvents: props.visible ? 'auto' : 'none' }}>
      <TheaterRoomV2 {...props} />
      {props.visible && contextOpen && (
        <div style={{ position: 'absolute', right: 14, bottom: 62, zIndex: 40, width: 'min(78vw, 300px)', padding: '12px 14px', borderRadius: 14, background: props.theme?.white || '#fff', border: `1px solid ${props.theme?.border || '#E7D8B9'}`, boxShadow: '0 10px 28px rgba(80,55,25,.14)', color: props.theme?.text || '#4C433A' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <b style={{ fontSize: 12.5 }}>上下文用量</b>
            <button type="button" onClick={() => setContextOpen(false)} aria-label="关闭上下文用量" style={{ border: 0, background: 'transparent', color: props.theme?.muted || '#8B8177', fontSize: 14, cursor: 'pointer', padding: 0 }}>×</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, marginTop: 10 }}>
            <div style={{ padding: '8px 9px', borderRadius: 10, background: props.theme?.borderLight || 'rgba(120,100,80,.06)' }}><div style={{ fontSize: 9.5, color: props.theme?.muted || '#8B8177' }}>最近一次上下文</div><div style={{ marginTop: 3, fontSize: 14, fontWeight: 700 }}>{contextUsage.tokens ? contextUsage.tokens.toLocaleString('zh-CN') : '—'}</div></div>
            <div style={{ padding: '8px 9px', borderRadius: 10, background: props.theme?.borderLight || 'rgba(120,100,80,.06)' }}><div style={{ padding: '8px 9px', borderRadius: 10, background: props.theme?.borderLight || 'rgba(120,100,80,.06)' }}><div style={{ fontSize: 9.5, color: props.theme?.muted || '#8B8177' }}>消息轮次</div><div style={{ marginTop: 3, fontSize: 14, fontWeight: 700 }}>最近 50 轮</div></div>
          </div>
          <div style={{ marginTop: 9, fontSize: 9.5, color: props.theme?.muted || '#8B8177', lineHeight: 1.55 }}>这里显示最近一次实际送入模型的上下文量；小剧场与正式 Chat 使用同一套上下文管理思路。</div>
        </div>
      )}
    </div>
  );
}

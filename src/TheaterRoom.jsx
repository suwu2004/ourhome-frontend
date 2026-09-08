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
        window.dispatchEvent(new CustomEvent(THINKING_EVENT, {
          detail: { thinking, at: Date.now(), url },
        }));
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
  let tokens = 0;
  if (match && match[1] !== '—') {
    const raw = match[1].toLowerCase();
    const amount = Number.parseFloat(raw);
    if (Number.isFinite(amount)) tokens = raw.endsWith('m') ? Math.round(amount * 1_000_000) : raw.endsWith('k') ? Math.round(amount * 1_000) : raw.endsWith('万') ? Math.round(amount * 10_000) : Math.round(amount);
  }
  return { text, tokens };
}

export function TheaterRoom(props) {
  const [thinking, setThinking] = useState('');
  const [thinkingOpen, setThinkingOpen] = useState(false);
  const [thinkingPosition, setThinkingPosition] = useState(null);
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
    if (!props.visible || !thinking) {
      setThinkingPosition(null);
      return undefined;
    }
    const shell = shellRef.current;
    if (!shell) return undefined;

    let frame = 0;
    const locateThinking = () => {
      frame = 0;
      const scroller = [...shell.querySelectorAll('div')].find(node => {
        const style = window.getComputedStyle(node);
        return style.overflowY === 'auto' && node.scrollHeight > node.clientHeight;
      });
      if (!scroller) return;
      const rows = [...scroller.children].filter(node => node instanceof HTMLElement);
      if (!rows.length) return;
      const row = rows[rows.length - 1];
      const rowChildren = [...row.children].filter(node => node instanceof HTMLElement);
      const bubble = rowChildren[1] || row;
      const shellRect = shell.getBoundingClientRect();
      const bubbleRect = bubble.getBoundingClientRect();
      const nextTop = bubbleRect.bottom - shellRect.top + 5;
      const nextLeft = Math.max(14, bubbleRect.left - shellRect.left);
      setThinkingPosition({ top: nextTop, left: nextLeft, maxWidth: Math.min(420, Math.max(180, shellRect.width - nextLeft - 14)) });
    };
    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(locateThinking);
    };

    schedule();
    const scroller = [...shell.querySelectorAll('div')].find(node => {
      const style = window.getComputedStyle(node);
      return style.overflowY === 'auto';
    });
    scroller?.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    const observer = new MutationObserver(schedule);
    observer.observe(shell, { childList: true, subtree: true, characterData: true });
    const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(schedule) : null;
    if (resizeObserver) resizeObserver.observe(shell);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      scroller?.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      observer.disconnect();
      resizeObserver?.disconnect();
    };
  }, [props.visible, thinking]);

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
    <div ref={shellRef} style={{ position: 'absolute', inset: 0 }}>
      <TheaterRoomV2 {...props} />
      {props.visible && thinking && thinkingPosition && (
        <div style={{ position: 'absolute', top: thinkingPosition.top, left: thinkingPosition.left, width: `min(${thinkingPosition.maxWidth}px, calc(100% - ${thinkingPosition.left + 14}px))`, zIndex: 30, pointerEvents: 'auto' }}>
          <button type="button" onClick={() => setThinkingOpen(open => !open)} style={{ border: 0, background: 'transparent', padding: 0, color: props.theme?.muted || '#8B8177', fontFamily: 'inherit', fontSize: 10.5, lineHeight: 1.4, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
            💭 想了想{thinkingOpen ? ' ▲' : ' ▼'}
          </button>
          {thinkingOpen && <div style={{ marginTop: 4, padding: '8px 12px', borderRadius: 10, background: props.theme?.borderLight || 'rgba(120,100,80,.08)', color: props.theme?.muted || '#8B8177', fontSize: 12, lineHeight: 1.6, whiteSpace: 'pre-wrap', fontStyle: 'italic', boxShadow: '0 4px 16px rgba(80,55,25,.08)' }}>{thinking}</div>}
        </div>
      )}
      {props.visible && contextOpen && (
        <div style={{ position: 'absolute', right: 14, bottom: 62, zIndex: 40, width: 'min(78vw, 300px)', padding: '12px 14px', borderRadius: 14, background: props.theme?.white || '#fff', border: `1px solid ${props.theme?.border || '#E7D8B9'}`, boxShadow: '0 10px 28px rgba(80,55,25,.14)', color: props.theme?.text || '#4C433A' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <b style={{ fontSize: 12.5 }}>上下文用量</b>
            <button type="button" onClick={() => setContextOpen(false)} aria-label="关闭上下文用量" style={{ border: 0, background: 'transparent', color: props.theme?.muted || '#8B8177', fontSize: 14, cursor: 'pointer', padding: 0 }}>×</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, marginTop: 10 }}>
            <div style={{ padding: '8px 9px', borderRadius: 10, background: props.theme?.borderLight || 'rgba(120,100,80,.06)' }}><div style={{ fontSize: 9.5, color: props.theme?.muted || '#8B8177' }}>最近一次上下文</div><div style={{ marginTop: 3, fontSize: 14, fontWeight: 700 }}>{contextUsage.tokens ? contextUsage.tokens.toLocaleString('zh-CN') : '—'}</div></div>
            <div style={{ padding: '8px 9px', borderRadius: 10, background: props.theme?.borderLight || 'rgba(120,100,80,.06)' }}><div style={{ fontSize: 9.5, color: props.theme?.muted || '#8B8177' }}>消息轮次</div><div style={{ marginTop: 3, fontSize: 14, fontWeight: 700 }}>最近 50 轮</div></div>
          </div>
          <div style={{ marginTop: 9, fontSize: 9.5, color: props.theme?.muted || '#8B8177', lineHeight: 1.55 }}>这里显示最近一次实际送入模型的上下文量；小剧场与正式 Chat 使用同一套上下文管理思路。</div>
        </div>
      )}
    </div>
  );
}

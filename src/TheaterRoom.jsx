import { useEffect, useRef, useState } from 'react';
import { TheaterRoom as TheaterRoomV2 } from './TheaterRoomV2.jsx';

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

export function TheaterRoom(props) {
  const [contextOpen, setContextOpen] = useState(false);
  const [contextUsage, setContextUsage] = useState({ text: '', tokens: 0 });
  const shellRef = useRef(null);

  useEffect(() => {
    if (!props.visible) return undefined;
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
  }, [props.visible]);

  useEffect(() => {
    if (!contextOpen) return undefined;
    const close = event => {
      if (shellRef.current?.contains(event.target)) return;
      setContextOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [contextOpen]);

  // Keep Theater fully unmounted while hidden so it cannot block formal Chat.
  if (!props.visible) return null;

  return (
    <div ref={shellRef} style={{ position: 'absolute', inset: 0, zIndex: 25, display: 'block', pointerEvents: 'auto' }}>
      <TheaterRoomV2 {...props} />
      {contextOpen && (
        <div style={{ position: 'absolute', right: 14, bottom: 62, zIndex: 40, width: 'min(78vw, 300px)', padding: '12px 14px', borderRadius: 14, background: props.theme?.white || '#fff', border: `1px solid ${props.theme?.border || '#E7D8B9'}`, boxShadow: '0 10px 28px rgba(80,55,25,.14)', color: props.theme?.text || '#4C433A' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <b style={{ fontSize: 12.5 }}>上下文用量</b>
            <button type="button" onClick={() => setContextOpen(false)} aria-label="关闭上下文用量" style={{ border: 0, background: 'transparent', color: props.theme?.muted || '#8B8177', fontSize: 14, cursor: 'pointer', padding: 0 }}>×</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, marginTop: 10 }}>
            <div style={{ padding: '8px 9px', borderRadius: 10, background: props.theme?.borderLight || 'rgba(120,100,80,.06)' }}>
              <div style={{ fontSize: 9.5, color: props.theme?.muted || '#8B8177' }}>最近一次上下文</div>
              <div style={{ marginTop: 3, fontSize: 14, fontWeight: 700 }}>{contextUsage.tokens ? contextUsage.tokens.toLocaleString('zh-CN') : '—'}</div>
            </div>
            <div style={{ padding: '8px 9px', borderRadius: 10, background: props.theme?.borderLight || 'rgba(120,100,80,.06)' }}>
              <div style={{ fontSize: 9.5, color: props.theme?.muted || '#8B8177' }}>消息轮次</div>
              <div style={{ marginTop: 3, fontSize: 14, fontWeight: 700 }}>最近 50 轮</div>
            </div>
          </div>
          <div style={{ marginTop: 9, fontSize: 9.5, color: props.theme?.muted || '#8B8177', lineHeight: 1.55 }}>这里显示最近一次实际送入模型的上下文量；小剧场与正式 Chat 使用同一套上下文管理思路。</div>
        </div>
      )}
    </div>
  );
}

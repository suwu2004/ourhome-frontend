import { useEffect, useState } from 'react';
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
        window.dispatchEvent(new CustomEvent(THINKING_EVENT, { detail: { thinking } }));
      }).catch(() => {});
    }
    return response;
  };
}

installTheaterThinkingRelay();

export function TheaterRoom(props) {
  const [thinking, setThinking] = useState('');
  const [thinkingOpen, setThinkingOpen] = useState(false);

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

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <TheaterRoomV2 {...props} />
      {props.visible && thinking && (
        <div style={{ position: 'absolute', right: 14, bottom: 76, zIndex: 20, maxWidth: 'min(72vw, 420px)', pointerEvents: 'auto' }}>
          <button type="button" onClick={() => setThinkingOpen(open => !open)} style={{ border: 0, background: 'transparent', padding: 0, color: props.theme?.muted || '#8B8177', fontFamily: 'inherit', fontSize: 10.5, cursor: 'pointer' }}>
            💭 想了想{thinkingOpen ? ' ▲' : ' ▼'}
          </button>
          {thinkingOpen && <div style={{ marginTop: 4, padding: '8px 12px', borderRadius: 10, background: props.theme?.borderLight || 'rgba(120,100,80,.08)', color: props.theme?.muted || '#8B8177', fontSize: 12, lineHeight: 1.6, whiteSpace: 'pre-wrap', fontStyle: 'italic', boxShadow: '0 4px 16px rgba(80,55,25,.08)' }}>{thinking}</div>}
        </div>
      )}
    </div>
  );
}

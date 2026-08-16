import { useMemo, useState } from 'react';
import { apiFetch, BACKEND } from './api.js';
import './DrawingRoom.css';

const HISTORY_KEY = 'ourhome:drawing-history:v1';
const HISTORY_LIMIT = 24;

function readHistory() {
  try {
    const value = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    return Array.isArray(value) ? value.filter(item => item?.image).slice(0, HISTORY_LIMIT) : [];
  } catch {
    return [];
  }
}

function normalizeImage(payload) {
  const direct = payload?.image_url || payload?.url || payload?.image;
  if (typeof direct === 'string' && direct.trim()) return direct.trim();
  const first = Array.isArray(payload?.data) ? payload.data[0] : null;
  if (typeof first?.url === 'string' && first.url.trim()) return first.url.trim();
  if (typeof first?.b64_json === 'string' && first.b64_json.trim()) return `data:image/png;base64,${first.b64_json.trim()}`;
  if (typeof payload?.b64_json === 'string' && payload.b64_json.trim()) return `data:image/png;base64,${payload.b64_json.trim()}`;
  return '';
}

function DrawingMark() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <path d="M14 49 41.7 21.3l7 7L21 56H14v-7Z" />
      <path d="m38.7 24.3 7 7M45 18l3.5-3.5a4 4 0 0 1 5.7 0l1.3 1.3a4 4 0 0 1 0 5.7L52 25" />
      <path d="M13 13h22M13 21h14M13 29h8" />
    </svg>
  );
}

export default function DrawingRoom({ onClose }) {
  const [prompt, setPrompt] = useState('');
  const [image, setImage] = useState('');
  const [history, setHistory] = useState(readHistory);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [error, setError] = useState('');

  const canDraw = useMemo(() => prompt.trim().length > 0 && !drawing, [prompt, drawing]);

  const remember = (nextImage, nextPrompt) => {
    const entry = { id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, image: nextImage, prompt: nextPrompt, created_at: new Date().toISOString() };
    const next = [entry, ...history.filter(item => item.image !== nextImage)].slice(0, HISTORY_LIMIT);
    setHistory(next);
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(next)); } catch { /* device storage can be unavailable */ }
  };

  const generate = async () => {
    const text = prompt.trim();
    if (!text || drawing) return;
    setDrawing(true);
    setError('');
    try {
      const response = await apiFetch(`${BACKEND}/drawing/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: text }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || payload?.message || '画笔暂时没有接上生图接口');
      const nextImage = normalizeImage(payload);
      if (!nextImage) throw new Error('这次没有收到画面，再画一次就好');
      setImage(nextImage);
      remember(nextImage, text);
    } catch (cause) {
      setError(cause?.message || '画笔暂时没有接上生图接口');
    } finally {
      setDrawing(false);
    }
  };

  return (
    <section className="drawing-room">
      <header className="drawing-room__header ourhome-safe-top">
        <button type="button" className="drawing-room__back" onClick={onClose} aria-label="返回主页">←</button>
        <div className="drawing-room__title">
          <strong>画画</strong>
          <span>draw together</span>
        </div>
        <button type="button" className={`drawing-room__album ${historyOpen ? 'is-active' : ''}`} onClick={() => setHistoryOpen(value => !value)} aria-label="打开小画册" aria-expanded={historyOpen}>
          <svg viewBox="0 0 28 28" aria-hidden="true"><rect x="5" y="6" width="18" height="16" rx="3" /><path d="m7.5 19 5-5 3.4 3.2 2.2-2.2 3.4 3.4M9 10.5h.1" /></svg>
        </button>
      </header>

      <div className="drawing-room__body">
        <main className="drawing-room__stage">
          <div className={`drawing-room__paper ${image ? 'has-image' : ''}`}>
            {image ? <img src={image} alt={prompt ? `根据“${prompt}”生成的画` : '生成的画'} /> : <div className="drawing-room__empty"><DrawingMark /><p>把心里想的，画给我看。</p><span>一句话，也可以长成一张画。</span></div>}
            {drawing && <div className="drawing-room__painting"><i /><span>正在画……</span></div>}
          </div>
          {error && <p className="drawing-room__error" role="alert">{error}</p>}
        </main>

        {historyOpen && (
          <aside className="drawing-room__history" aria-label="小画册">
            <div className="drawing-room__history-head"><strong>小画册</strong><span>{history.length} 张</span></div>
            {history.length === 0 ? <p className="drawing-room__history-empty">第一张画还在等你。</p> : <div className="drawing-room__history-grid">{history.map(item => <button key={item.id} type="button" onClick={() => { setImage(item.image); setPrompt(item.prompt || ''); setHistoryOpen(false); }}><img src={item.image} alt="" /><span>{item.prompt || '没有题目的画'}</span></button>)}</div>}
          </aside>
        )}
      </div>

      <footer className="drawing-room__composer ourhome-safe-bottom">
        <div className="drawing-room__input">
          <textarea rows={1} value={prompt} onChange={event => setPrompt(event.target.value)} placeholder="想画什么，就告诉我……" maxLength={1200} />
          <button type="button" onClick={generate} disabled={!canDraw} aria-label="开始画">{drawing ? '…' : '✦'}</button>
        </div>
        <span className="drawing-room__hint">生成的画会先留在小画册里，之后再接进光影相册。</span>
      </footer>
    </section>
  );
}

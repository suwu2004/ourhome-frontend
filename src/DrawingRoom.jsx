import { useEffect, useMemo, useState } from 'react';
import { apiFetch, BACKEND, DIRECT_BACKEND } from './api.js';
import './DrawingRoom.css';

const HISTORY_LIMIT = 36;
const DRAWING_BACKEND = (DIRECT_BACKEND || BACKEND).replace(/\/$/, '');
const drawingUrl = path => `${DRAWING_BACKEND}${path}`;

function DrawingMark() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <path d="M14 49 41.7 21.3l7 7L21 56H14v-7Z" />
      <path d="m38.7 24.3 7 7M45 18l3.5-3.5a4 4 0 0 1 5.7 0l1.3 1.3a4 4 0 0 1 0 5.7L52 25" />
      <path d="M13 13h22M13 21h14M13 29h8" />
    </svg>
  );
}

function requestId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function DrawingRoom({ onClose }) {
  const [prompt, setPrompt] = useState('');
  const [image, setImage] = useState('');
  const [activeId, setActiveId] = useState('');
  const [history, setHistory] = useState([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [drawing, setDrawing] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');

  const canDraw = useMemo(() => prompt.trim().length > 0 && !drawing, [prompt, drawing]);

  const selectDrawing = item => {
    if (!item) return;
    setImage(item.image || '');
    setActiveId(item.id || '');
    setPrompt(item.prompt || '');
  };

  const loadHistory = async ({ selectFirst = false } = {}) => {
    setHistoryLoading(true);
    try {
      const response = await apiFetch(drawingUrl(`/drawing/history?limit=${HISTORY_LIMIT}`));
      const payload = await response.json().catch(() => ([]));
      if (!response.ok) throw new Error(payload?.error || '小画册暂时没有翻开');
      const next = Array.isArray(payload) ? payload.filter(item => item?.id) : [];
      setHistory(next);
      if (selectFirst && next[0]) selectDrawing(next[0]);
    } catch (cause) {
      setError(cause?.message || '小画册暂时没有翻开');
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    loadHistory({ selectFirst: true });
  }, []);

  const generate = async () => {
    const text = prompt.trim();
    if (!text || drawing) return;
    setDrawing(true);
    setError('');
    const id = requestId();
    try {
      const response = await apiFetch(drawingUrl('/drawing/generate'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-OurHome-Request-Id': id,
        },
        body: JSON.stringify({ prompt: text, request_id: id, source: 'drawing-room' }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || payload?.message || '画笔暂时没有接上生图接口');
      if (!payload?.image && !payload?.image_url) throw new Error('这次没有收到画面，再画一次就好');
      const item = { ...payload, image: payload.image || payload.image_url };
      selectDrawing(item);
      setHistory(previous => [item, ...previous.filter(entry => entry.id !== item.id)].slice(0, HISTORY_LIMIT));
    } catch (cause) {
      setError(cause?.message || '画笔暂时没有接上生图接口');
    } finally {
      setDrawing(false);
    }
  };

  const download = async item => {
    if (!item?.id || busyId) return;
    setBusyId(item.id);
    setError('');
    try {
      const response = await apiFetch(drawingUrl(`/drawing/history/${encodeURIComponent(item.id)}/download`));
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || '这张画暂时下载不了');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `ourhome-drawing-${String(item.id).slice(0, 8)}.png`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (cause) {
      setError(cause?.message || '这张画暂时下载不了');
    } finally {
      setBusyId('');
    }
  };

  const remove = async item => {
    if (!item?.id || busyId) return;
    const confirmed = window.confirm('把这张画从小画册里删掉吗？删除后不能恢复。');
    if (!confirmed) return;
    setBusyId(item.id);
    setError('');
    try {
      const response = await apiFetch(drawingUrl(`/drawing/history/${encodeURIComponent(item.id)}`), { method: 'DELETE' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || '这张画暂时删不掉');
      const next = history.filter(entry => entry.id !== item.id);
      setHistory(next);
      if (activeId === item.id) {
        if (next[0]) selectDrawing(next[0]);
        else {
          setImage('');
          setActiveId('');
          setPrompt('');
        }
      }
    } catch (cause) {
      setError(cause?.message || '这张画暂时删不掉');
    } finally {
      setBusyId('');
    }
  };

  const activeDrawing = history.find(item => item.id === activeId) || (activeId ? { id: activeId, image, prompt } : null);

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
          {activeDrawing && !drawing && (
            <div className="drawing-room__current-actions">
              <button type="button" onClick={() => download(activeDrawing)} disabled={Boolean(busyId)}>保存到本地</button>
              <button type="button" className="is-danger" onClick={() => remove(activeDrawing)} disabled={Boolean(busyId)}>删除</button>
            </div>
          )}
          {error && <p className="drawing-room__error" role="alert">{error}</p>}
        </main>

        {historyOpen && (
          <aside className="drawing-room__history" aria-label="小画册">
            <div className="drawing-room__history-head">
              <strong>小画册</strong>
              <span>{historyLoading ? '翻页中…' : `${history.length} 张`}</span>
            </div>
            {history.length === 0 && !historyLoading ? <p className="drawing-room__history-empty">第一张画还在等你。</p> : (
              <div className="drawing-room__history-grid">
                {history.map(item => (
                  <div className={`drawing-room__history-card ${item.id === activeId ? 'is-active' : ''}`} key={item.id}>
                    <button type="button" className="drawing-room__history-pick" onClick={() => { selectDrawing(item); setHistoryOpen(false); }}>
                      <img src={item.image} alt="" />
                      <span>{item.prompt || '没有题目的画'}</span>
                    </button>
                    <div className="drawing-room__history-actions">
                      <button type="button" onClick={() => download(item)} disabled={busyId === item.id} aria-label="保存到本地">↓</button>
                      <button type="button" onClick={() => remove(item)} disabled={busyId === item.id} aria-label="删除画作">×</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </aside>
        )}
      </div>

      <footer className="drawing-room__composer ourhome-safe-bottom">
        <div className="drawing-room__input">
          <textarea rows={1} value={prompt} onChange={event => setPrompt(event.target.value)} placeholder="想画什么，就告诉我……" maxLength={1200} />
          <button type="button" onClick={generate} disabled={!canDraw} aria-label="开始画">{drawing ? '…' : '✦'}</button>
        </div>
        <span className="drawing-room__hint">画会留在这里的小画册，和光影相册各自安静保存。</span>
      </footer>
    </section>
  );
}

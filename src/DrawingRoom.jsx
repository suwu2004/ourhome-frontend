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

async function readErrorPayload(response) {
  const raw = await response.text().catch(() => '');
  let payload = {};
  try { payload = raw ? JSON.parse(raw) : {}; } catch { /* handled below */ }
  return { payload, raw };
}

function friendlyDrawingError(response, payload = {}, raw = '', fallback = '画笔暂时没有接上生图接口') {
  const status = Number(response?.status || 0);
  const code = String(payload?.code || payload?.error_code || payload?.type || '').toLowerCase();
  const detail = String(payload?.error?.message || payload?.message || (typeof payload?.error === 'string' ? payload.error : '') || '').trim();
  const source = `${code} ${detail} ${raw}`.toLowerCase();

  if (status === 401 || status === 403 || /invalid.*(key|token)|unauthori[sz]ed|api.?key/.test(source)) {
    return '画画 API 的密钥没有通过验证，请检查「设置 → API 与模型 → 画画 API」里的 Key。';
  }
  if (status === 402 || /insufficient|balance|quota|credit|billing|余额|额度/.test(source)) {
    return '画画 API 的额度暂时不够了，检查一下吉祥 AI 的余额或调用额度。';
  }
  if (status === 404 || /model.*not.*found|unknown.*model|模型不存在|model.*does not exist/.test(source)) {
    return '画画模型没有找到，先确认模型名是不是 GPT-magic2。';
  }
  if (status === 429 || /rate.?limit|too many requests|频率/.test(source)) {
    return '画画 API 现在有点忙，等一会儿再画一次就好。';
  }
  if (status === 408 || status === 502 || status === 503 || status === 504 || /timeout|timed out|gateway|upstream/.test(source)) {
    return '生图服务这会儿没有及时回应，画室线路还在，过一会儿再试一次。';
  }
  if (/unsupported|not support|images\/generations|image generation/.test(source) && /endpoint|format|unsupported|not support/.test(source)) {
    return '这个画画模型暂时不接受当前生图接口格式，需要调整上游接口适配。';
  }
  if (detail) return `画画没有成功：${detail.slice(0, 220)}`;
  return fallback;
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
      const { payload, raw } = await readErrorPayload(response);
      if (!response.ok) throw new Error(friendlyDrawingError(response, payload, raw, '小画册暂时没有翻开'));
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
      const { payload, raw } = await readErrorPayload(response);
      if (!response.ok) throw new Error(friendlyDrawingError(response, payload, raw));
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
        const { payload, raw } = await readErrorPayload(response);
        throw new Error(friendlyDrawingError(response, payload, raw, '这张画暂时下载不了'));
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
      const { payload, raw } = await readErrorPayload(response);
      if (!response.ok) throw new Error(friendlyDrawingError(response, payload, raw, '这张画暂时删不掉'));
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

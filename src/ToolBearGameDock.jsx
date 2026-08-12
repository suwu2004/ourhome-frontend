import { createPortal } from 'react-dom';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch, BACKEND } from './api.js';
import { useTheme } from './ThemeContext.jsx';
import './ToolBearGameDock.css';

const SESSION_KEY = 'ourhome_session_id';
const MODEL_STORE = 'ourhome_toybox_budget_model_v1';

const GAME_META = {
  harmony: { icon: '💌', title: '默契大考验' },
  drawing: { icon: '🎨', title: '你画我猜' },
  secret: { icon: '🔐', title: '暗号猜猜' },
  gomoku: { icon: '⚫', title: '五子棋' },
};

async function requestJson(path, options = {}) {
  const response = await apiFetch(`${BACKEND}${path}`, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || '这里暂时没有接上');
  return data;
}

async function postJson(path, body = {}) {
  return requestJson(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function isModelCandidate(model) {
  const value = String(model || '').toLowerCase();
  if (!value) return false;
  return !/(embedding|rerank|tts|whisper|audio|image[-_ ]?gen|dall[-_ ]?e|stable[-_ ]?diffusion|moderation|ocr|transcrib)/i.test(value);
}

function explicitPriceHint(model) {
  const value = String(model || '').toLowerCase();
  const matches = [...value.matchAll(/(?:^|[-_\[(（])(?:x|price|cost)?\s*(0\.\d{1,4})(?=[\])）_\-])/g)]
    .map(match => Number(match[1]))
    .filter(number => Number.isFinite(number) && number > 0 && number < 1);
  return matches.length ? Math.min(...matches) : null;
}

function budgetScore(model) {
  const value = String(model || '').toLowerCase();
  const explicit = explicitPriceHint(value);
  if (explicit !== null) return explicit;
  let score = 50;
  if (/flash[-_ ]?lite|nano/.test(value)) score = 1;
  else if (/haiku|mini|lite|small/.test(value)) score = 2;
  else if (/flash|instant/.test(value)) score = 3;
  else if (/sonnet/.test(value)) score = 7;
  else if (/opus|pro|max/.test(value)) score = 12;
  if (/thinking|reasoning/.test(value)) score += 0.8;
  return score;
}

function pickCheapest(models) {
  return [...models]
    .filter(isModelCandidate)
    .sort((a, b) => budgetScore(a) - budgetScore(b) || String(a).localeCompare(String(b)))[0] || '';
}

function readString(key) {
  try { return localStorage.getItem(key) || ''; } catch { return ''; }
}

function writeString(key, value) {
  try { localStorage.setItem(key, value || ''); } catch { /* ignore */ }
}

function detectActiveGame() {
  if (document.querySelector('.gomoku-overlay')) return 'gomoku';
  if (document.querySelector('.toy-harmony')) return 'harmony';
  if (document.querySelector('.toy-drawing')) return 'drawing';
  if (document.querySelector('.toy-secret')) return 'secret';
  return '';
}

function useActiveGame() {
  const [game, setGame] = useState(() => detectActiveGame());
  useEffect(() => {
    let frame = 0;
    const refresh = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const next = detectActiveGame();
        setGame(current => current === next ? current : next);
      });
    };
    const observer = new MutationObserver(refresh);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    refresh();
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, []);
  return game;
}

function syncOriginalGameModel(value) {
  if (!value) return;
  writeString(MODEL_STORE, value);
  const select = document.querySelector('.toy-budget-panel select');
  if (!select || select.value === value) return;
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
  if (setter) setter.call(select, value);
  else select.value = value;
  select.dispatchEvent(new Event('change', { bubbles: true }));
}

function formatTime(value) {
  const date = new Date(value || Date.now());
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function harmonyChoiceText(run, choice) {
  const state = run?.state || {};
  const key = String(choice || '').toUpperCase();
  if (key === 'A') return state.option_a || 'A';
  if (key === 'B') return state.option_b || 'B';
  return String(choice || '').trim();
}

function harmonySummary(run) {
  const result = run?.result || {};
  const mine = harmonyChoiceText(run, result.user_choice);
  const luze = harmonyChoiceText(run, result.luze_choice);
  if (result.matched) {
    const shared = mine || luze;
    return shared ? `我们都选了「${shared}」` : '想到一起了 ♡';
  }
  if (mine || luze) return `你选「${mine || '—'}」 · 陆泽选「${luze || '—'}」`;
  return '这题答案不一样';
}

function summarizeRun(run) {
  const result = run?.result || {};
  const state = run?.state || {};
  if (run?.status === 'invited') return '等你接招';
  if (run?.status === 'active') return '还没下完';
  if (run?.status === 'abandoned') return '中途收起来了';
  if (run?.game === 'harmony') return harmonySummary(run);
  if (run?.game === 'drawing') return result.guess ? `陆泽猜：${result.guess}` : '画完一张';
  if (run?.game === 'secret') return result.won ? `猜中了「${result.answer || state.answer || ''}」` : `答案「${result.answer || state.answer || ''}」`;
  if (run?.game === 'gomoku') {
    if (result.winner === 'user') return '你赢了 👿';
    if (result.winner === 'luze') return '陆泽赢了';
    return result.winner === 'draw' ? '平局' : '棋局结束';
  }
  return '玩完一局';
}

function GameHistory({ game, open, onClose, theme }) {
  const [history, setHistory] = useState([]);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadHistory = useCallback(async () => {
    if (!open || !game) return;
    setError('');
    try {
      const data = await requestJson('/toybox/history?limit=100');
      const rows = Array.isArray(data?.runs) ? data.runs : [];
      setHistory(rows.filter(run => run.game === game));
    } catch (err) {
      setError(err.message || '这一册暂时翻不开');
    }
  }, [game, open]);

  useEffect(() => { loadHistory(); }, [loadHistory]);
  useEffect(() => { if (!open) { setSelected(null); setDetail(null); } }, [open]);

  const openDetail = async run => {
    setSelected(run);
    setDetail(null);
    setLoading(true);
    try { setDetail(await requestJson(`/toybox/runs/${run.id}`)); }
    catch { setDetail(run); }
    finally { setLoading(false); }
  };

  if (!open) return null;
  const meta = GAME_META[game] || GAME_META.harmony;
  const resolvedDetail = detail || selected;
  const drawingImage = game === 'drawing'
    ? (resolvedDetail?.state?.image_url || resolvedDetail?.result?.image_url || '')
    : '';
  return createPortal(
    <div className="toy-game-layer" style={{ '--tg-paper': theme.white, '--tg-cream': theme.cream, '--tg-text': theme.text, '--tg-muted': theme.muted, '--tg-line': theme.border, '--tg-honey': theme.honeyDeep }} onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="toy-game-history-sheet">
        <header>
          <button type="button" onClick={() => selected ? setSelected(null) : onClose()}>{selected ? '←' : '×'}</button>
          <div><b>{selected ? '这一局' : `${meta.title}记录`}</b><small>{selected ? formatTime(selected.created_at) : '只放这个游戏的历史'}</small></div>
          <span>{meta.icon}</span>
        </header>
        {selected ? (
          <div className="toy-game-history-detail">
            <h3>{selected.title || meta.title}</h3>
            <p className="toy-game-result">{summarizeRun(resolvedDetail)}</p>
            {drawingImage && (
              <figure style={{ margin: '10px 0 14px', padding: 8, border: `1px solid ${theme.border}`, borderRadius: 15, background: theme.cream }}>
                <img src={drawingImage} alt="这一局保存的画" style={{ display: 'block', width: '100%', maxHeight: 360, objectFit: 'contain', borderRadius: 10, background: 'var(--tg-cream)' }} />
                <figcaption style={{ marginTop: 6, textAlign: 'center', color: theme.muted, fontSize: 9 }}>这张画已经留在云端记录里。</figcaption>
              </figure>
            )}
            {loading && <p className="toy-game-muted">正在翻这一页……</p>}
            {(detail?.events || []).map(event => (
              <div className="toy-game-event" key={event.id}>
                <i>{event.actor === 'luze' ? '泽' : event.actor === 'user' ? '檀' : '·'}</i>
                <div><b>{event.event_type}</b><p>{event.payload?.note || event.payload?.guess || event.payload?.choice || event.payload?.title || ''}</p></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="toy-game-history-list">
            {error && <p className="toy-game-error">{error}</p>}
            {!error && history.length === 0 && <p className="toy-game-empty">这个游戏还没有旧记录。</p>}
            {history.map(run => (
              <button type="button" key={run.id} onClick={() => openDetail(run)}>
                <span>{meta.icon}</span><div><b>{run.title || meta.title}</b><small>{formatTime(run.created_at)} · {run.initiator === 'luze' ? '陆泽发起' : '你发起'}</small><p>{summarizeRun(run)}</p></div><i>›</i>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>,
    document.body,
  );
}

function GameChat({ game, open, onClose, theme }) {
  const [sessionId, setSessionId] = useState('');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [models, setModels] = useState([]);
  const [model, setModel] = useState('');
  const [loadingModels, setLoadingModels] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const listRef = useRef(null);
  const meta = GAME_META[game] || GAME_META.harmony;

  const loadMessages = useCallback(async id => {
    if (!id) return;
    const rows = await requestJson(`/sessions/${id}/messages`);
    setMessages(Array.isArray(rows) ? rows.slice(-40) : []);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    (async () => {
      setLoadingModels(true);
      setError('');
      try {
        const [sessions, modelData] = await Promise.all([requestJson('/sessions'), requestJson('/settings/models')]);
        if (cancelled) return;
        const sessionList = Array.isArray(sessions) ? sessions : [];
        const stored = readString(SESSION_KEY);
        let target = sessionList.find(item => String(item.id) === stored) || sessionList.find(item => item.name === '日常') || sessionList[0];
        if (!target) target = await postJson('/sessions', { name: '日常' });
        if (cancelled) return;
        setSessionId(String(target.id));
        writeString(SESSION_KEY, String(target.id));

        const choices = (Array.isArray(modelData?.models) ? modelData.models : []).map(String).filter(isModelCandidate);
        const cheapest = pickCheapest(choices);
        setModels(choices);
        setModel(cheapest);
        syncOriginalGameModel(cheapest);
        await loadMessages(target.id);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Chat 暂时没打开');
      } finally {
        if (!cancelled) setLoadingModels(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, loadMessages]);

  useEffect(() => {
    if (!open || !sessionId) return undefined;
    const timer = window.setInterval(() => loadMessages(sessionId).catch(() => {}), 7000);
    return () => window.clearInterval(timer);
  }, [open, sessionId, loadMessages]);

  useEffect(() => {
    const node = listRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages, sending]);

  const chooseModel = value => {
    setModel(value);
    syncOriginalGameModel(value);
  };

  const send = async event => {
    event.preventDefault();
    const text = input.trim();
    if (!text || !sessionId || sending) return;
    setInput('');
    setSending(true);
    setError('');
    setMessages(items => [...items, { id: `temp-${Date.now()}`, role: 'user', content: text }]);
    try {
      await postJson('/chat', { session_id: sessionId, message: text, model: model || undefined });
      await loadMessages(sessionId);
    } catch (err) {
      setError(err.message || '这句话没发出去');
      await loadMessages(sessionId).catch(() => {});
    } finally {
      setSending(false);
    }
  };

  if (!open) return null;
  return createPortal(
    <aside className="toy-game-chat" style={{ '--tg-paper': theme.white, '--tg-cream': theme.cream, '--tg-text': theme.text, '--tg-muted': theme.muted, '--tg-line': theme.border, '--tg-honey': theme.honeyDeep }}>
      <header><div><b>边玩边聊</b><small>{meta.icon} {meta.title} · 同一个主 Chat，会读云端游戏记录</small></div><button type="button" onClick={onClose}>×</button></header>
      <label className="toy-game-model"><span>省钱模型</span><select value={model} disabled={loadingModels} onChange={event => chooseModel(event.target.value)}>{models.length ? models.map(item => <option key={item} value={item}>{item}</option>) : <option value="">{loadingModels ? '正在挑最便宜的…' : '暂无模型'}</option>}</select></label>
      <div className="toy-game-chat-list" ref={listRef}>
        {messages.map(message => {
          const mine = message.role === 'user';
          return <div className={`toy-game-chat-line ${mine ? 'is-mine' : 'is-luze'}`} key={message.id}><i>{mine ? '檀' : '泽'}</i><p>{message.content}</p></div>;
        })}
        {sending && <div className="toy-game-chat-line is-luze"><i>泽</i><p>想了想……</p></div>}
      </div>
      {error && <div className="toy-game-error">{error}</div>}
      <form onSubmit={send}><textarea rows={1} value={input} onChange={event => setInput(event.target.value)} placeholder="一边玩，一边跟他说……" /><button type="submit" disabled={sending || !input.trim()}>↑</button></form>
    </aside>,
    document.body,
  );
}

export default function ToolBearGameDock() {
  const game = useActiveGame();
  const { theme } = useTheme();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  useEffect(() => {
    setHistoryOpen(false);
    setChatOpen(false);
  }, [game]);

  if (!game) return null;
  return (
    <>
      {createPortal(
        <div className="toy-game-actions" aria-label={`${GAME_META[game]?.title || '游戏'}工具`}>
          <button type="button" onClick={() => { setChatOpen(false); setHistoryOpen(true); }}>📖<span>记录</span></button>
          <button type="button" className="is-chat" onClick={() => { setHistoryOpen(false); setChatOpen(value => !value); }}>💬<span>陆泽</span></button>
        </div>,
        document.body,
      )}
      <GameHistory game={game} open={historyOpen} onClose={() => setHistoryOpen(false)} theme={theme} />
      <GameChat game={game} open={chatOpen} onClose={() => setChatOpen(false)} theme={theme} />
    </>
  );
}

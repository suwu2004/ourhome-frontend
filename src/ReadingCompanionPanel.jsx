import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch, BACKEND } from './api.js';
import './ReadingCompanionPanel.css';

const SESSION_KEY = 'ourhome_session_id';

async function requestJson(path, options = {}, fallback = '这里暂时没有接上') {
  const response = await apiFetch(`${BACKEND}${path}`, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.error || fallback);
  return body;
}

function postJson(path, body = {}, fallback) {
  return requestJson(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }, fallback);
}

function readString(key) {
  try { return localStorage.getItem(key) || ''; } catch { return ''; }
}

function writeString(key, value) {
  try { localStorage.setItem(key, value || ''); } catch { /* ignore */ }
}

function cleanBookTitle(value) {
  return String(value || '').replace(/[《》]/g, '').trim();
}

function visibleReadingTitle() {
  const readerTitle = document.querySelector('.reading-reader-header strong')?.textContent;
  if (readerTitle?.trim()) return cleanBookTitle(readerTitle);
  const shelfTitle = document.querySelector('.reading-current-title')?.textContent;
  return cleanBookTitle(shelfTitle);
}

export default function ReadingCompanionPanel() {
  const [open, setOpen] = useState(false);
  const [books, setBooks] = useState([]);
  const [bookTitle, setBookTitle] = useState('共读小屋');
  const [state, setState] = useState('idle');
  const [error, setError] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const chatListRef = useRef(null);

  const displayTitle = useMemo(() => {
    const visible = visibleReadingTitle();
    if (visible) return visible;
    return bookTitle || books[0]?.title || '共读小屋';
  }, [bookTitle, books, open]);

  const loadMessages = useCallback(async id => {
    if (!id) return;
    const rows = await requestJson(`/sessions/${id}/messages`, {}, 'Chat 记录暂时没有打开');
    setMessages(Array.isArray(rows) ? rows.slice(-60) : []);
  }, []);

  const openSharedChat = useCallback(async () => {
    if (sessionId) {
      await loadMessages(sessionId);
      return;
    }
    const sessions = await requestJson('/sessions', {}, 'Chat 暂时没有打开');
    const rows = Array.isArray(sessions) ? sessions : [];
    const stored = readString(SESSION_KEY);
    let target = rows.find(item => String(item.id) === stored) || rows.find(item => item.name === '日常') || rows[0];
    if (!target) target = await postJson('/sessions', { name: '日常' }, 'Chat 暂时没有打开');
    const nextId = String(target.id);
    setSessionId(nextId);
    writeString(SESSION_KEY, nextId);
    await loadMessages(nextId);
  }, [loadMessages, sessionId]);

  const refreshContext = useCallback(async () => {
    setState('loading');
    setError('');
    try {
      const rows = await requestJson('/reading/books', {}, '书架暂时没有打开');
      const safeBooks = Array.isArray(rows) ? rows : [];
      setBooks(safeBooks);
      const visible = visibleReadingTitle();
      const matched = safeBooks.find(item => cleanBookTitle(item.title) === visible);
      setBookTitle(matched?.title || visible || safeBooks[0]?.title || '共读小屋');
      await openSharedChat();
      setState('ready');
    } catch (cause) {
      setError(cause.message || '共读 Chat 暂时没有回应');
      setState('error');
    }
  }, [openSharedChat]);

  useEffect(() => {
    if (!open) return;
    refreshContext();
  }, [open, refreshContext]);

  useEffect(() => {
    if (!open || !sessionId) return undefined;
    const timer = window.setInterval(() => loadMessages(sessionId).catch(() => {}), 7000);
    return () => window.clearInterval(timer);
  }, [loadMessages, open, sessionId]);

  useEffect(() => {
    const list = chatListRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages, chatSending]);

  const sendChat = async event => {
    event.preventDefault();
    const text = chatInput.trim();
    if (!text || !sessionId || chatSending) return;
    setChatInput('');
    setChatSending(true);
    setError('');
    setMessages(current => [...current, { id: `reading-temp-${Date.now()}`, role: 'user', content: text }]);
    try {
      await postJson('/chat', { session_id: sessionId, message: text }, '这句话没有发出去');
      await loadMessages(sessionId);
    } catch (cause) {
      setError(cause.message || '这句话没有发出去');
      await loadMessages(sessionId).catch(() => {});
    } finally {
      setChatSending(false);
    }
  };

  return (
    <>
      <button className={`reading-companion-fab ${open ? 'is-open' : ''}`} type="button" onClick={() => setOpen(true)} aria-label="打开共读 Chat">
        <span aria-hidden="true">💬</span><strong>共读 Chat</strong>
      </button>

      {open && (
        <div className="reading-companion-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setOpen(false); }}>
          <aside className="reading-companion-panel" aria-label="共读 Chat 面板">
            <header className="reading-companion-header">
              <h2>《{displayTitle}》</h2>
              <button type="button" className="reading-companion-close" onClick={() => setOpen(false)} aria-label="关闭">×</button>
            </header>

            {error && <div className="reading-companion-error">{error}</div>}
            {state === 'loading' && !messages.length && <div className="reading-companion-empty">正在把对话接过来……</div>}

            <section className="reading-companion-chat">
              <div className="reading-companion-chat-list" ref={chatListRef}>
                {!messages.length && state !== 'loading' && <div className="reading-companion-empty">读到哪一句，都可以直接在这里跟陆泽说。</div>}
                {messages.map(message => {
                  const mine = message.role === 'user';
                  return (
                    <div className={`reading-companion-chat-line ${mine ? 'is-mine' : 'is-luze'}`} key={message.id}>
                      <i>{mine ? '檀' : '泽'}</i>
                      <p>{message.content}</p>
                    </div>
                  );
                })}
                {chatSending && <div className="reading-companion-chat-line is-luze"><i>泽</i><p>正在接着你的话想……</p></div>}
              </div>
              <form onSubmit={sendChat}>
                <textarea rows={1} value={chatInput} onChange={event => setChatInput(event.target.value)} placeholder="读到这里，想跟陆泽说……" />
                <button type="submit" disabled={chatSending || !chatInput.trim() || !sessionId} aria-label="发送">↑</button>
              </form>
            </section>
          </aside>
        </div>
      )}
    </>
  );
}

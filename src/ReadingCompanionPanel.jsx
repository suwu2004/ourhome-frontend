import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch, BACKEND } from './api.js';
import './ReadingCompanionPanel.css';
import './ReadingNotes.css';

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

function shortDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
}

export default function ReadingCompanionPanel() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('chat');
  const [books, setBooks] = useState([]);
  const [bookId, setBookId] = useState('');
  const [book, setBook] = useState(null);
  const [annotations, setAnnotations] = useState([]);
  const [notes, setNotes] = useState([]);
  const [state, setState] = useState('idle');
  const [error, setError] = useState('');
  const [busyKey, setBusyKey] = useState('');
  const [onlyUnanswered, setOnlyUnanswered] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const chatListRef = useRef(null);

  const visibleAnnotations = useMemo(() => onlyUnanswered
    ? annotations.filter(item => !String(item.luze_reply || '').trim())
    : annotations, [annotations, onlyUnanswered]);

  const loadMessages = useCallback(async id => {
    if (!id) return;
    const rows = await requestJson(`/sessions/${id}/messages`, {}, 'Chat 记录暂时没有打开');
    setMessages(Array.isArray(rows) ? rows.slice(-50) : []);
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

  const loadBooks = useCallback(async () => {
    const rows = await requestJson('/reading/books', {}, '书架暂时没有打开');
    setBooks(Array.isArray(rows) ? rows : []);
    setBookId(current => current || rows?.[0]?.id || '');
    return rows;
  }, []);

  const loadBook = useCallback(async selectedBookId => {
    if (!selectedBookId) {
      setBook(null);
      setAnnotations([]);
      setNotes([]);
      return;
    }
    const [bookBody, annotationsBody, notesBody] = await Promise.all([
      requestJson(`/reading/books/${selectedBookId}`, {}, '这本书暂时没有打开'),
      requestJson(`/reading/books/${selectedBookId}/annotations`, {}, '批注暂时没有打开'),
      requestJson(`/reading/books/${selectedBookId}/notes?author=luze&limit=100`, {}, '陆泽的书签暂时没有打开'),
    ]);
    setBook(bookBody);
    setAnnotations(Array.isArray(annotationsBody) ? annotationsBody : []);
    setNotes(Array.isArray(notesBody) ? notesBody : []);
  }, []);

  const refresh = useCallback(async selectedBookId => {
    setState('loading');
    setError('');
    try {
      const rows = books.length ? books : await loadBooks();
      const target = selectedBookId || bookId || rows?.[0]?.id || '';
      await Promise.all([target ? loadBook(target) : Promise.resolve(), openSharedChat()]);
      setState('ready');
    } catch (cause) {
      setError(cause.message || '共读 Chat 暂时没有回应');
      setState('error');
    }
  }, [bookId, books, loadBook, loadBooks, openSharedChat]);

  useEffect(() => {
    if (!open || state !== 'idle') return;
    refresh();
  }, [open, refresh, state]);

  useEffect(() => {
    if (!open || !bookId || state === 'idle') return;
    loadBook(bookId).catch(cause => setError(cause.message || '这本书暂时没有打开'));
  }, [bookId, loadBook, open, state]);

  useEffect(() => {
    if (!open || tab !== 'chat' || !sessionId) return undefined;
    const timer = window.setInterval(() => loadMessages(sessionId).catch(() => {}), 7000);
    return () => window.clearInterval(timer);
  }, [loadMessages, open, sessionId, tab]);

  useEffect(() => {
    const list = chatListRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages, chatSending, tab]);

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

  const askLuZe = async annotation => {
    setBusyKey(`reply:${annotation.id}`);
    setError('');
    try {
      const updated = await postJson(`/reading/annotations/${annotation.id}/luze-reply`, {}, '陆泽这次没有接上批注');
      setAnnotations(current => current.map(item => item.id === updated.id ? updated : item));
    } catch (cause) {
      setError(cause.message || '陆泽这次没有接上批注');
    } finally {
      setBusyKey('');
    }
  };

  const clearLuZeReply = async annotation => {
    setBusyKey(`clear:${annotation.id}`);
    setError('');
    try {
      const updated = await requestJson(`/reading/annotations/${annotation.id}/luze-reply`, { method: 'DELETE' }, '旧回复没有清除成功');
      setAnnotations(current => current.map(item => item.id === updated.id ? updated : item));
    } catch (cause) {
      setError(cause.message || '旧回复没有清除成功');
    } finally {
      setBusyKey('');
    }
  };

  const updateBookmark = async (note, patch) => {
    setBusyKey(`bookmark:${note.id}`);
    setError('');
    try {
      const updated = await requestJson(`/reading/notes/${note.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch),
      }, '书签没有保存成功');
      setNotes(current => current.map(item => item.id === updated.id ? updated : item)
        .sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || new Date(b.updated_at) - new Date(a.updated_at)));
    } catch (cause) {
      setError(cause.message || '书签没有保存成功');
    } finally {
      setBusyKey('');
    }
  };

  const deleteBookmark = async note => {
    if (!window.confirm('把陆泽留下的这张书签擦掉吗？')) return;
    setBusyKey(`bookmark:${note.id}`);
    setError('');
    try {
      await requestJson(`/reading/notes/${note.id}`, { method: 'DELETE' }, '书签没有删除成功');
      setNotes(current => current.filter(item => item.id !== note.id));
    } catch (cause) {
      setError(cause.message || '书签没有删除成功');
    } finally {
      setBusyKey('');
    }
  };

  return (
    <>
      <button className={`reading-companion-fab ${open ? 'is-open' : ''}`} type="button" onClick={() => setOpen(true)} aria-label="打开共读 Chat">
        <span aria-hidden="true">💬</span><strong>共读 Chat</strong>
      </button>

      {open && (
        <div className="reading-companion-backdrop">
          <aside className="reading-companion-panel" aria-label="共读 Chat 面板">
            <header className="reading-companion-header">
              <div><span className="reading-companion-kicker">READING CHAT</span><h2>边读边聊</h2><p>和主 Chat 是同一段对话，批注和书签留在旁边。</p></div>
              <button type="button" className="reading-companion-close" onClick={() => setOpen(false)} aria-label="关闭">×</button>
            </header>

            <div className="reading-companion-toolbar">
              <label><span>共读书</span><select value={bookId} onChange={event => setBookId(event.target.value)}>
                {!books.length && <option value="">书架还是空的</option>}
                {books.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
              </select></label>
              <button type="button" onClick={() => refresh(bookId)} disabled={state === 'loading'} aria-label="刷新共读内容">↻</button>
            </div>

            <nav className="reading-companion-tabs" aria-label="共读内容">
              <button type="button" className={tab === 'chat' ? 'active' : ''} onClick={() => setTab('chat')}>Chat</button>
              <button type="button" className={tab === 'annotations' ? 'active' : ''} onClick={() => setTab('annotations')}>批注 <span>{annotations.length}</span></button>
              <button type="button" className={tab === 'bookmarks' ? 'active' : ''} onClick={() => setTab('bookmarks')}>书签 <span>{notes.length}</span></button>
            </nav>

            {error && <div className="reading-companion-error">{error}</div>}
            {state === 'loading' && <div className="reading-companion-empty">正在把共读角落收拾好……</div>}

            {state !== 'loading' && tab === 'chat' && (
              <section className="reading-companion-chat">
                <div className="reading-companion-chat-list" ref={chatListRef}>
                  {!messages.length && <div className="reading-companion-empty">读到哪里都可以直接跟陆泽说。</div>}
                  {messages.map(message => {
                    const mine = message.role === 'user';
                    return <div className={`reading-companion-chat-line ${mine ? 'is-mine' : 'is-luze'}`} key={message.id}><i>{mine ? '檀' : '泽'}</i><p>{message.content}</p></div>;
                  })}
                  {chatSending && <div className="reading-companion-chat-line is-luze"><i>泽</i><p>正在接着你的话想……</p></div>}
                </div>
                <form onSubmit={sendChat}><textarea rows={1} value={chatInput} onChange={event => setChatInput(event.target.value)} placeholder="一边读，一边跟他说……" /><button type="submit" disabled={chatSending || !chatInput.trim() || !sessionId}>↑</button></form>
              </section>
            )}

            {state !== 'loading' && tab === 'annotations' && (
              <section className="reading-companion-content">
                <label className="reading-companion-filter"><input type="checkbox" checked={onlyUnanswered} onChange={event => setOnlyUnanswered(event.target.checked)} />只看还没回的</label>
                {!visibleAnnotations.length && <div className="reading-companion-empty">{annotations.length ? '这些批注都回应过啦。' : '还没有批注，选中一段文字就能写。'}</div>}
                <div className="reading-companion-annotation-list">
                  {visibleAnnotations.map(annotation => {
                    const chapter = book?.chapters?.find(item => item.id === annotation.chapter_id);
                    return <article className="reading-companion-annotation" key={annotation.id}>
                      <div className="reading-companion-meta"><span>{chapter?.title || `第 ${Number(annotation.chapter_index) + 1} 章`}</span><time>{shortDate(annotation.updated_at)}</time></div>
                      <blockquote>“{annotation.quote}”</blockquote>
                      <div className="reading-companion-bubble reading-companion-bubble--tan"><small>檀檀</small><p>{annotation.note || '只轻轻划了这一句。'}</p></div>
                      {annotation.luze_reply
                        ? <div className="reading-companion-bubble reading-companion-bubble--luze"><small>陆泽</small><p>{annotation.luze_reply}</p><time>{shortDate(annotation.luze_replied_at)}</time></div>
                        : <div className={`reading-companion-pending status-${annotation.luze_reply_status || 'idle'}`}>{annotation.luze_reply_status === 'failed' ? '上次没送达，可以再戳一下。' : '陆泽还没在这句旁边写字。'}</div>}
                      <div className="reading-companion-actions"><button type="button" onClick={() => askLuZe(annotation)} disabled={Boolean(busyKey)}>{busyKey === `reply:${annotation.id}` ? '正在读……' : annotation.luze_reply ? '重新回应' : '让陆泽回应'}</button>{annotation.luze_reply && <button className="ghost" type="button" onClick={() => clearLuZeReply(annotation)} disabled={Boolean(busyKey)}>清除旧回复</button>}</div>
                    </article>;
                  })}
                </div>
              </section>
            )}

            {state !== 'loading' && tab === 'bookmarks' && (
              <section className="reading-companion-content">
                {!notes.length && <div className="reading-companion-empty">陆泽还没留下书签。</div>}
                <div className="reading-companion-note-bookmarks">{notes.map(note => <article className={`reading-companion-bookmark ${note.pinned ? 'is-pinned' : ''}`} key={note.id}>
                  <header><span>{note.kind === 'quote' ? '摘抄' : '感想'}</span><time>{shortDate(note.updated_at)}</time></header>
                  {note.quote && <blockquote>“{note.quote}”</blockquote>}{note.content && <p>{note.content}</p>}
                  <footer><button type="button" onClick={() => updateBookmark(note, { pinned: !note.pinned })} disabled={Boolean(busyKey)}>{note.pinned ? '取消置顶' : '置顶'}</button><button type="button" className="is-danger" onClick={() => deleteBookmark(note)} disabled={Boolean(busyKey)}>擦掉</button></footer>
                </article>)}</div>
              </section>
            )}
          </aside>
        </div>
      )}
    </>
  );
}

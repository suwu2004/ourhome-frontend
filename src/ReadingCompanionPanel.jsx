import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch, BACKEND } from './api.js';
import './ReadingCompanionPanel.css';
import './ReadingNotes.css';

async function readJson(response, fallback) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.error || fallback);
  return body;
}

function shortDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function tokenCount(value) {
  const number = Number(value) || 0;
  return number >= 10000 ? `${(number / 10000).toFixed(1)}万` : String(number);
}

export default function ReadingCompanionPanel() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('annotations');
  const [books, setBooks] = useState([]);
  const [bookId, setBookId] = useState('');
  const [book, setBook] = useState(null);
  const [annotations, setAnnotations] = useState([]);
  const [notes, setNotes] = useState([]);
  const [workbench, setWorkbench] = useState({ totals: {}, chapter_notes: [], runs: [] });
  const [state, setState] = useState('idle');
  const [error, setError] = useState('');
  const [busyKey, setBusyKey] = useState('');
  const [instruction, setInstruction] = useState('');
  const [onlyUnanswered, setOnlyUnanswered] = useState(false);

  const noteByChapter = useMemo(() => new Map(
    (workbench.chapter_notes || []).map(note => [String(note.chapter_id), note]),
  ), [workbench.chapter_notes]);

  const visibleAnnotations = useMemo(() => {
    if (!onlyUnanswered) return annotations;
    return annotations.filter(item => !String(item.luze_reply || '').trim());
  }, [annotations, onlyUnanswered]);

  const loadBooks = useCallback(async () => {
    const response = await apiFetch(`${BACKEND}/reading/books`);
    const rows = await readJson(response, '书架暂时没有打开');
    setBooks(Array.isArray(rows) ? rows : []);
    setBookId(current => current || rows?.[0]?.id || '');
    return rows;
  }, []);

  const loadBook = useCallback(async selectedBookId => {
    if (!selectedBookId) {
      setBook(null);
      setAnnotations([]);
      setNotes([]);
      setWorkbench({ totals: {}, chapter_notes: [], runs: [] });
      return;
    }
    const [bookResponse, annotationsResponse, notesResponse, workbenchResponse] = await Promise.all([
      apiFetch(`${BACKEND}/reading/books/${selectedBookId}`),
      apiFetch(`${BACKEND}/reading/books/${selectedBookId}/annotations`),
      apiFetch(`${BACKEND}/reading/books/${selectedBookId}/notes?author=luze&limit=100`),
      apiFetch(`${BACKEND}/reading/workbench?book_id=${encodeURIComponent(selectedBookId)}&limit=100`),
    ]);
    const [bookBody, annotationsBody, notesBody, workbenchBody] = await Promise.all([
      readJson(bookResponse, '这本书暂时没有打开'),
      readJson(annotationsResponse, '批注暂时没有打开'),
      readJson(notesResponse, '陆泽的书签暂时没有打开'),
      readJson(workbenchResponse, '预读工作台暂时没有打开'),
    ]);
    setBook(bookBody);
    setAnnotations(Array.isArray(annotationsBody) ? annotationsBody : []);
    setNotes(Array.isArray(notesBody) ? notesBody : []);
    setWorkbench(workbenchBody || { totals: {}, chapter_notes: [], runs: [] });
  }, []);

  const refresh = useCallback(async selectedBookId => {
    setState('loading');
    setError('');
    try {
      const rows = books.length ? books : await loadBooks();
      const target = selectedBookId || bookId || rows?.[0]?.id || '';
      if (target) await loadBook(target);
      setState('ready');
    } catch (cause) {
      setError(cause.message || '共读小屋暂时没有回应');
      setState('error');
    }
  }, [bookId, books, loadBook, loadBooks]);

  useEffect(() => {
    if (!open || state !== 'idle') return;
    refresh();
  }, [open, refresh, state]);

  useEffect(() => {
    if (!open || !bookId || state === 'idle') return;
    loadBook(bookId).catch(cause => setError(cause.message || '这本书暂时没有打开'));
  }, [bookId, loadBook, open, state]);

  const askLuZe = async annotation => {
    setBusyKey(`reply:${annotation.id}`);
    setError('');
    try {
      const response = await apiFetch(`${BACKEND}/reading/annotations/${annotation.id}/luze-reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instruction: instruction.trim() || undefined }),
      });
      const updated = await readJson(response, '陆泽这次没有接上批注');
      setAnnotations(current => current.map(item => item.id === updated.id ? updated : item));
      setInstruction('');
      await loadBook(bookId);
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
      const response = await apiFetch(`${BACKEND}/reading/annotations/${annotation.id}/luze-reply`, { method: 'DELETE' });
      const updated = await readJson(response, '旧回复没有清除成功');
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
      const response = await apiFetch(`${BACKEND}/reading/notes/${note.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const updated = await readJson(response, '书签没有保存成功');
      setNotes(current => current
        .map(item => item.id === updated.id ? updated : item)
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
      const response = await apiFetch(`${BACKEND}/reading/notes/${note.id}`, { method: 'DELETE' });
      await readJson(response, '书签没有删除成功');
      setNotes(current => current.filter(item => item.id !== note.id));
    } catch (cause) {
      setError(cause.message || '书签没有删除成功');
    } finally {
      setBusyKey('');
    }
  };

  const generateChapterNote = async chapter => {
    setBusyKey(`note:${chapter.id}`);
    setError('');
    try {
      const response = await apiFetch(`${BACKEND}/reading/books/${bookId}/chapter-notes/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chapter_index: chapter.chapter_index, force: noteByChapter.get(String(chapter.id))?.status === 'ready' }),
      });
      await readJson(response, '这一章的预读笔记没有生成成功');
      await loadBook(bookId);
    } catch (cause) {
      setError(cause.message || '这一章的预读笔记没有生成成功');
    } finally {
      setBusyKey('');
    }
  };

  return (
    <>
      <button
        className={`reading-companion-fab ${open ? 'is-open' : ''}`}
        type="button"
        onClick={() => setOpen(value => !value)}
        aria-label={open ? '收起陆泽共读回应' : '打开陆泽共读回应'}
      >
        <span aria-hidden="true">泽</span>
        <strong>{open ? '收起' : '共读回应'}</strong>
      </button>

      {open && (
        <div className="reading-companion-backdrop" onClick={() => setOpen(false)}>
          <aside className="reading-companion-panel" onClick={event => event.stopPropagation()} aria-label="陆泽共读回应面板">
            <header className="reading-companion-header">
              <div>
                <span className="reading-companion-kicker">LUZE · READING TOGETHER</span>
                <h2>陆泽也坐进来了</h2>
                <p>他能看书架、进度和批注，也能把回应、摘抄和感想留在这里。</p>
              </div>
              <button type="button" className="reading-companion-close" onClick={() => setOpen(false)} aria-label="关闭">×</button>
            </header>

            <div className="reading-companion-toolbar">
              <label>
                <span>正在共读</span>
                <select value={bookId} onChange={event => setBookId(event.target.value)}>
                  {!books.length && <option value="">书架还是空的</option>}
                  {books.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
                </select>
              </label>
              <button type="button" onClick={() => refresh(bookId)} disabled={state === 'loading'}>刷新</button>
            </div>

            <nav className="reading-companion-tabs" aria-label="共读回应分类">
              <button type="button" className={tab === 'annotations' ? 'active' : ''} onClick={() => setTab('annotations')}>
                批注对话 <span>{annotations.length}</span>
              </button>
              <button type="button" className={tab === 'bookmarks' ? 'active' : ''} onClick={() => setTab('bookmarks')}>
                陆泽书签 <span>{notes.length}</span>
              </button>
              <button type="button" className={tab === 'workbench' ? 'active' : ''} onClick={() => setTab('workbench')}>
                预读工作台 <span>{workbench.chapter_notes?.length || 0}</span>
              </button>
            </nav>

            {error && <div className="reading-companion-error">{error}</div>}
            {state === 'loading' && <div className="reading-companion-empty">正在把书和批注搬过来……</div>}
            {state !== 'loading' && !bookId && <div className="reading-companion-empty">先导入一本书，陆泽就能一起读了。</div>}

            {state !== 'loading' && bookId && tab === 'annotations' && (
              <section className="reading-companion-content">
                <div className="reading-companion-instruction">
                  <textarea
                    value={instruction}
                    onChange={event => setInstruction(event.target.value)}
                    maxLength={1200}
                    placeholder="可以悄悄补一句：想让陆泽从哪个角度回应（不填也可以）"
                  />
                  <label>
                    <input type="checkbox" checked={onlyUnanswered} onChange={event => setOnlyUnanswered(event.target.checked)} />
                    只看还没回的
                  </label>
                </div>

                {!visibleAnnotations.length && (
                  <div className="reading-companion-empty">
                    {annotations.length ? '这些批注陆泽都回应过啦。' : '还没有批注。划一句喜欢的话，再回来戳陆泽。'}
                  </div>
                )}

                <div className="reading-companion-annotation-list">
                  {visibleAnnotations.map(annotation => {
                    const chapter = book?.chapters?.find(item => item.id === annotation.chapter_id);
                    const replying = busyKey === `reply:${annotation.id}`;
                    const clearing = busyKey === `clear:${annotation.id}`;
                    return (
                      <article className="reading-companion-annotation" key={annotation.id}>
                        <div className="reading-companion-meta">
                          <span>{chapter?.title || `第 ${Number(annotation.chapter_index) + 1} 章`}</span>
                          <time>{shortDate(annotation.updated_at)}</time>
                        </div>
                        <blockquote>“{annotation.quote}”</blockquote>
                        <div className="reading-companion-bubble reading-companion-bubble--tan">
                          <small>檀檀</small>
                          <p>{annotation.note || '只轻轻划了这一句。'}</p>
                        </div>

                        {annotation.luze_reply ? (
                          <div className="reading-companion-bubble reading-companion-bubble--luze">
                            <small>陆泽 · {annotation.luze_reply_model || '共读回应'}</small>
                            <p>{annotation.luze_reply}</p>
                            <time>{shortDate(annotation.luze_replied_at)}</time>
                          </div>
                        ) : (
                          <div className={`reading-companion-pending status-${annotation.luze_reply_status || 'idle'}`}>
                            {annotation.luze_reply_status === 'failed' ? '上次回应没有送达，可以再戳一下。' : '陆泽还没有在这句旁边写字。'}
                          </div>
                        )}

                        <div className="reading-companion-actions">
                          <button type="button" onClick={() => askLuZe(annotation)} disabled={Boolean(busyKey)}>
                            {replying ? '正在读这一句……' : annotation.luze_reply ? '重新回应' : '让陆泽回应'}
                          </button>
                          {annotation.luze_reply && (
                            <button className="ghost" type="button" onClick={() => clearLuZeReply(annotation)} disabled={Boolean(busyKey)}>
                              {clearing ? '清除中……' : '清除旧回复'}
                            </button>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            )}

            {state !== 'loading' && bookId && tab === 'bookmarks' && (
              <section className="reading-companion-content">
                {!notes.length && (
                  <div className="reading-companion-empty">陆泽还没留下独立书签。可以在聊天里让他摘一句、写点感想或置顶一句话。</div>
                )}
                <div className="reading-companion-note-bookmarks">
                  {notes.map(note => {
                    const chapter = book?.chapters?.find(item => Number(item.chapter_index) === Number(note.chapter_index));
                    const busy = busyKey === `bookmark:${note.id}`;
                    return (
                      <article className={`reading-companion-bookmark ${note.pinned ? 'is-pinned' : ''}`} key={note.id}>
                        <header>
                          <span>{chapter?.title || '整本书'} · {note.kind === 'quote' ? '摘抄' : '感想'}</span>
                          <time>{shortDate(note.updated_at)}</time>
                        </header>
                        {note.quote && <blockquote>“{note.quote}”</blockquote>}
                        {note.content && <p>{note.content}</p>}
                        <footer>
                          <button type="button" onClick={() => updateBookmark(note, { pinned: !note.pinned })} disabled={Boolean(busyKey)}>
                            {busy ? '保存中…' : note.pinned ? '取消置顶' : '置顶'}
                          </button>
                          <button type="button" className="is-danger" onClick={() => deleteBookmark(note)} disabled={Boolean(busyKey)}>擦掉</button>
                        </footer>
                      </article>
                    );
                  })}
                </div>
              </section>
            )}

            {state !== 'loading' && bookId && tab === 'workbench' && (
              <section className="reading-companion-content reading-companion-workbench">
                <div className="reading-companion-stats">
                  <div><strong>{workbench.totals?.calls || 0}</strong><span>处理次数</span></div>
                  <div><strong>{tokenCount(workbench.totals?.input_tokens)}</strong><span>输入 tokens</span></div>
                  <div><strong>{tokenCount(workbench.totals?.output_tokens)}</strong><span>输出 tokens</span></div>
                  <div><strong>{workbench.totals?.failed || 0}</strong><span>失败记录</span></div>
                </div>

                <div className="reading-companion-note-list">
                  {(book?.chapters || []).map(chapter => {
                    const note = noteByChapter.get(String(chapter.id));
                    const generating = busyKey === `note:${chapter.id}`;
                    return (
                      <article key={chapter.id} className={`reading-companion-note status-${note?.status || 'missing'}`}>
                        <div className="reading-companion-note-heading">
                          <div>
                            <span>第 {Number(chapter.chapter_index) + 1} 章</span>
                            <strong>{chapter.title}</strong>
                          </div>
                          <button type="button" onClick={() => generateChapterNote(chapter)} disabled={Boolean(busyKey)}>
                            {generating ? '正在预读……' : note?.status === 'ready' ? '重新预读' : '生成笔记'}
                          </button>
                        </div>
                        {note?.status === 'ready' && <p>{note.summary}</p>}
                        {note?.status === 'failed' && <p className="reading-companion-note-error">{note.error || '这一章预读失败了。'}</p>}
                        {!note && <p className="reading-companion-note-muted">还没有内部预读笔记；默认只允许预读当前阅读进度以内的章节。</p>}
                        {note && (
                          <footer>
                            <span>{note.model || '未记录模型'}</span>
                            <span>{tokenCount(note.input_tokens)} + {tokenCount(note.output_tokens)} tokens</span>
                            <span>{note.duration_ms ? `${(Number(note.duration_ms) / 1000).toFixed(1)}s` : ''}</span>
                          </footer>
                        )}
                      </article>
                    );
                  })}
                </div>
              </section>
            )}
          </aside>
        </div>
      )}
    </>
  );
}

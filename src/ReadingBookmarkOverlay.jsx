import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { apiFetch, BACKEND } from './api.js';
import './ReadingBookmarkOverlay.css';

async function requestJson(path, options = {}, fallback = '这里暂时没有接上') {
  const response = await apiFetch(`${BACKEND}${path}`, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.error || fallback);
  return body;
}

function shortDate(value) {
  const date = new Date(value || 0);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
}

export default function ReadingBookmarkOverlay() {
  const [portalTarget, setPortalTarget] = useState(null);
  const [open, setOpen] = useState(false);
  const [state, setState] = useState('idle');
  const [error, setError] = useState('');
  const [bookmarks, setBookmarks] = useState([]);
  const [deletingId, setDeletingId] = useState('');

  useEffect(() => {
    const syncTarget = () => {
      const next = document.querySelector('.reading-room--shelf .reading-shelf-intro');
      setPortalTarget(current => current === next ? current : next);
      if (!next) setOpen(false);
    };
    syncTarget();
    const observer = new MutationObserver(syncTarget);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  const loadBookmarks = useCallback(async () => {
    setState('loading');
    setError('');
    try {
      const booksBody = await requestJson('/reading/books', {}, '书架暂时没有打开');
      const books = Array.isArray(booksBody) ? booksBody : [];
      const groups = await Promise.all(books.map(async book => {
        const annotations = await requestJson(`/reading/books/${book.id}/annotations`, {}, '书签暂时没有打开');
        if (!Array.isArray(annotations) || !annotations.length) return [];
        const detail = await requestJson(`/reading/books/${book.id}`, {}, '这本书暂时没有打开');
        const chapterMap = new Map((detail.chapters || []).map(chapter => [Number(chapter.chapter_index), chapter.title]));
        return annotations.map(annotation => ({
          ...annotation,
          book_title: book.title,
          chapter_title: chapterMap.get(Number(annotation.chapter_index)) || `第 ${Number(annotation.chapter_index) + 1} 篇`,
        }));
      }));
      const rows = groups.flat().sort((a, b) => new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0));
      setBookmarks(rows);
      setState('ready');
    } catch (cause) {
      setError(cause.message || '书签暂时没有打开');
      setState('error');
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    loadBookmarks();
  }, [loadBookmarks, open]);

  const groupedCount = useMemo(() => new Set(bookmarks.map(item => item.book_id)).size, [bookmarks]);

  const deleteBookmark = async bookmark => {
    if (deletingId) return;
    if (!window.confirm('把这条波浪线书签擦掉吗？')) return;
    setDeletingId(bookmark.id);
    setError('');
    try {
      await requestJson(`/reading/annotations/${bookmark.id}`, { method: 'DELETE' }, '书签没有删除成功');
      setBookmarks(current => current.filter(item => item.id !== bookmark.id));
    } catch (cause) {
      setError(cause.message || '书签没有删除成功');
    } finally {
      setDeletingId('');
    }
  };

  if (!portalTarget) return null;

  return createPortal(
    <>
      <button className="reading-bookmark-star" type="button" onClick={() => setOpen(true)} aria-label="打开共读书签" title="共读书签">
        <span aria-hidden="true">☆</span>
      </button>

      {open && createPortal(
        <div className="reading-bookmark-layer" onMouseDown={event => { if (event.target === event.currentTarget) setOpen(false); }}>
          <section className="reading-bookmark-panel" aria-label="共读书签">
            <header>
              <div><span>OUR BOOKMARKS</span><h2>书签</h2>{state === 'ready' && <p>{bookmarks.length} 段 · {groupedCount} 本书</p>}</div>
              <button type="button" onClick={() => setOpen(false)} aria-label="关闭书签">×</button>
            </header>

            {error && <div className="reading-bookmark-error">{error}</div>}
            {state === 'loading' && <div className="reading-bookmark-empty">正在把夹在书里的句子找回来……</div>}
            {state === 'ready' && !bookmarks.length && <div className="reading-bookmark-empty">还没有书签。读正文时选中一句话，就能把它变成波浪线收藏。</div>}

            <div className="reading-bookmark-list">
              {bookmarks.map(bookmark => (
                <article className="reading-bookmark-card" key={bookmark.id}>
                  <header><strong>《{bookmark.book_title}》</strong><span>{bookmark.chapter_title}</span></header>
                  <blockquote>“{bookmark.quote}”</blockquote>
                  {bookmark.luze_reply && <div className="reading-bookmark-luze"><i>泽</i><p>{bookmark.luze_reply}</p></div>}
                  <footer><time>{shortDate(bookmark.updated_at || bookmark.created_at)}</time><button type="button" onClick={() => deleteBookmark(bookmark)} disabled={Boolean(deletingId)}>{deletingId === bookmark.id ? '擦掉中…' : '移除'}</button></footer>
                </article>
              ))}
            </div>
          </section>
        </div>,
        document.body,
      )}
    </>,
    portalTarget,
  );
}

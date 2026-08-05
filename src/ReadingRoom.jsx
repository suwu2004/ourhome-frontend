import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch, BACKEND } from './api.js';
import { useTheme } from './ThemeContext.jsx';
import './ReadingRoom.css';

function formatCount(value) {
  const number = Number(value) || 0;
  if (number >= 10000) return `${(number / 10000).toFixed(number >= 100000 ? 0 : 1)} 万字`;
  return `${number} 字`;
}

function splitParagraphs(content) {
  return String(content || '')
    .split(/\n{2,}|\n/)
    .map(item => item.trim())
    .filter(Boolean);
}

function progressForChapter(chapterIndex, chapterCount) {
  if (!chapterCount) return 0;
  return Number((((chapterIndex + 1) / chapterCount) * 100).toFixed(2));
}

export function ReadingRoom({ onClose }) {
  const { darkMode, theme: C } = useTheme();
  const [books, setBooks] = useState([]);
  const [booksState, setBooksState] = useState('loading');
  const [bookError, setBookError] = useState('');
  const [activeBook, setActiveBook] = useState(null);
  const [activeChapterIndex, setActiveChapterIndex] = useState(0);
  const [tocOpen, setTocOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [readerState, setReaderState] = useState('idle');
  const fileInputRef = useRef(null);
  const readerRef = useRef(null);
  const saveTimerRef = useRef(null);

  const roomStyle = {
    '--reading-bg': C.cream || '#fff8ed',
    '--reading-paper': C.white || '#fffdf8',
    '--reading-text': C.text || '#35261d',
    '--reading-muted': C.muted || '#9d856f',
    '--reading-border': C.border || '#eadcc7',
    '--reading-accent': C.honeyDeep || '#b97a1f',
    '--reading-accent-soft': C.honeyLight || '#f6e8c7',
    '--reading-blush': C.blush || '#efd0c8',
  };

  const loadBooks = useCallback(async () => {
    setBooksState('loading');
    setBookError('');
    try {
      const response = await apiFetch(`${BACKEND}/reading/books`);
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || '书架没有打开');
      setBooks(Array.isArray(data) ? data : []);
      setBooksState('ready');
    } catch (error) {
      setBookError(error.message || '书架没有打开');
      setBooksState('error');
    }
  }, []);

  useEffect(() => {
    loadBooks();
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, [loadBooks]);

  const openBook = useCallback(async bookId => {
    setReaderState('loading');
    setBookError('');
    try {
      const response = await apiFetch(`${BACKEND}/reading/books/${bookId}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || '这本书没有打开');
      const chapters = Array.isArray(data.chapters) ? data.chapters : [];
      const savedIndex = Math.max(0, Math.min(Number(data.progress?.chapter_index) || 0, Math.max(0, chapters.length - 1)));
      setActiveBook({ ...data, chapters });
      setActiveChapterIndex(savedIndex);
      setTocOpen(false);
      setReaderState('ready');
      window.requestAnimationFrame(() => readerRef.current?.scrollTo({ top: 0 }));
    } catch (error) {
      setBookError(error.message || '这本书没有打开');
      setReaderState('error');
    }
  }, []);

  const saveProgress = useCallback((book, chapterIndex, extra = {}) => {
    if (!book?.id) return;
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(async () => {
      try {
        await apiFetch(`${BACKEND}/reading/books/${book.id}/progress`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chapter_index: chapterIndex,
            paragraph_index: extra.paragraph_index || 0,
            char_offset: extra.char_offset || 0,
            progress_percent: progressForChapter(chapterIndex, book.chapters?.length || book.chapter_count),
          }),
        });
      } catch (error) {
        console.error('保存阅读进度失败:', error);
      }
    }, 420);
  }, []);

  const selectChapter = useCallback(index => {
    if (!activeBook?.chapters?.length) return;
    const safeIndex = Math.max(0, Math.min(index, activeBook.chapters.length - 1));
    setActiveChapterIndex(safeIndex);
    setTocOpen(false);
    readerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    saveProgress(activeBook, safeIndex);
  }, [activeBook, saveProgress]);

  const importBook = async event => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || uploading) return;
    setUploading(true);
    setBookError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await apiFetch(`${BACKEND}/reading/books/import`, { method: 'POST', body: formData });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || '这本书没有导入成功');
      await loadBooks();
      await openBook(data.id);
    } catch (error) {
      setBookError(error.message || '这本书没有导入成功');
    } finally {
      setUploading(false);
    }
  };

  const deleteBook = async book => {
    if (!window.confirm(`确定把《${book.title}》从共读小屋移走吗？阅读进度也会一起删除。`)) return;
    setBookError('');
    try {
      const response = await apiFetch(`${BACKEND}/reading/books/${book.id}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || '没有删除成功');
      setBooks(current => current.filter(item => item.id !== book.id));
      if (activeBook?.id === book.id) setActiveBook(null);
    } catch (error) {
      setBookError(error.message || '没有删除成功');
    }
  };

  const renameBook = async book => {
    const title = window.prompt('给这本书换个名字：', book.title);
    if (!title?.trim() || title.trim() === book.title) return;
    try {
      const response = await apiFetch(`${BACKEND}/reading/books/${book.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || '书名没有保存成功');
      setBooks(current => current.map(item => item.id === book.id ? { ...item, title: data.title } : item));
      setActiveBook(current => current?.id === book.id ? { ...current, title: data.title } : current);
    } catch (error) {
      setBookError(error.message || '书名没有保存成功');
    }
  };

  const currentChapter = activeBook?.chapters?.[activeChapterIndex] || null;
  const paragraphs = useMemo(() => splitParagraphs(currentChapter?.content), [currentChapter?.content]);
  const readingPercent = activeBook ? progressForChapter(activeChapterIndex, activeBook.chapters.length) : 0;

  if (activeBook) {
    return (
      <main className={`reading-room reading-room--reader ${darkMode ? 'is-dark' : ''}`} style={roomStyle}>
        <header className="reading-reader-header">
          <button type="button" onClick={() => { setActiveBook(null); setTocOpen(false); loadBooks(); }} aria-label="返回书架">←</button>
          <div>
            <span>TOGETHER READING</span>
            <strong>{activeBook.title}</strong>
          </div>
          <button type="button" onClick={() => setTocOpen(value => !value)} aria-label="打开目录">☰</button>
        </header>

        <div className="reading-progress" aria-label={`已读 ${Math.round(readingPercent)}%`}>
          <i style={{ width: `${readingPercent}%` }} />
        </div>

        {tocOpen && (
          <div className="reading-toc-layer" onMouseDown={event => { if (event.target === event.currentTarget) setTocOpen(false); }}>
            <aside className="reading-toc" aria-label="目录">
              <header><div><span>CONTENTS</span><h2>一起读到这里</h2></div><button type="button" onClick={() => setTocOpen(false)}>×</button></header>
              <div>
                {activeBook.chapters.map(chapter => (
                  <button
                    type="button"
                    key={chapter.id || chapter.chapter_index}
                    className={chapter.chapter_index === activeChapterIndex ? 'is-active' : ''}
                    onClick={() => selectChapter(chapter.chapter_index)}
                  >
                    <small>{String(chapter.chapter_index + 1).padStart(2, '0')}</small>
                    <span>{chapter.title}</span>
                  </button>
                ))}
              </div>
            </aside>
          </div>
        )}

        <section className="reading-page" ref={readerRef}>
          {readerState === 'loading' && <p className="reading-status">正在翻开这本书…</p>}
          {readerState !== 'loading' && currentChapter && (
            <article>
              <div className="reading-chapter-mark">{String(activeChapterIndex + 1).padStart(2, '0')} / {String(activeBook.chapters.length).padStart(2, '0')}</div>
              <h1>{currentChapter.title}</h1>
              <div className="reading-ornament">✦　♡　✦</div>
              <div className="reading-prose">
                {paragraphs.map((paragraph, index) => <p key={`${activeChapterIndex}-${index}`}>{paragraph}</p>)}
              </div>
            </article>
          )}
        </section>

        <footer className="reading-reader-footer">
          <button type="button" disabled={activeChapterIndex <= 0} onClick={() => selectChapter(activeChapterIndex - 1)}>← 上一篇</button>
          <span>{Math.round(readingPercent)}%</span>
          <button type="button" disabled={activeChapterIndex >= activeBook.chapters.length - 1} onClick={() => selectChapter(activeChapterIndex + 1)}>下一篇 →</button>
        </footer>
      </main>
    );
  }

  return (
    <main className={`reading-room reading-room--shelf ${darkMode ? 'is-dark' : ''}`} style={roomStyle}>
      <header className="reading-shelf-header">
        <button type="button" onClick={onClose} aria-label="回到主页">←</button>
        <div><span>OUR LITTLE LIBRARY</span><h1>共读小屋</h1><p>把想一起读的文字，慢慢放进来。</p></div>
        <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} aria-label="导入文本">＋</button>
      </header>

      <input ref={fileInputRef} hidden type="file" accept=".txt,.md,text/plain,text/markdown" onChange={importBook} />

      <section className="reading-shelf-body">
        <div className="reading-shelf-intro">
          <span>FIRST SHELF</span>
          <h2>我们正在读</h2>
          <p>第一阶段已经能导入 TXT、按日期或章节拆分，并替我们记住读到哪里。</p>
          <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}>{uploading ? '正在把书放上架…' : '导入一本 TXT'}</button>
        </div>

        {bookError && <div className="reading-error">{bookError}</div>}
        {booksState === 'loading' && <p className="reading-status">正在整理书架…</p>}
        {booksState === 'ready' && books.length === 0 && (
          <button className="reading-empty" type="button" onClick={() => fileInputRef.current?.click()}>
            <i>📖</i><strong>第一层书架还空着</strong><span>把《期待回信.txt》放进来试试看</span>
          </button>
        )}

        <div className="reading-book-grid">
          {books.map((book, index) => {
            const percentage = Number(book.progress?.progress_percent) || 0;
            return (
              <article className="reading-book-card" key={book.id}>
                <button className="reading-book-cover" type="button" onClick={() => openBook(book.id)}>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <div><small>OUR BOOK</small><strong>{book.title}</strong><em>陆泽 ♡ 叶檀</em></div>
                </button>
                <div className="reading-book-info">
                  <button type="button" onClick={() => openBook(book.id)}><strong>{book.title}</strong><span>{book.chapter_count} 篇 · {formatCount(book.total_chars)}</span></button>
                  <div className="reading-book-progress"><i style={{ width: `${percentage}%` }} /><span>{Math.round(percentage)}%</span></div>
                  <div className="reading-book-actions"><button type="button" onClick={() => renameBook(book)}>改名</button><button type="button" onClick={() => deleteBook(book)}>移走</button></div>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}

export default ReadingRoom;

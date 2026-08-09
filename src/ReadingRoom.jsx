import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch, BACKEND } from './api.js';
import { useTheme } from './ThemeContext.jsx';
import './ReadingRoom.css';
import './ReadingRoomPolish.css';
import './ReadingAnnotations.css';

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

function paragraphElementFromNode(node) {
  const element = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
  return element?.closest?.('p[data-paragraph-index]') || null;
}

function selectionInsideParagraph(selection, readerElement) {
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;
  const range = selection.getRangeAt(0);
  const startParagraph = paragraphElementFromNode(range.startContainer);
  const endParagraph = paragraphElementFromNode(range.endContainer);
  if (!startParagraph || startParagraph !== endParagraph || !readerElement?.contains(startParagraph)) return null;
  if (startParagraph.closest('mark.reading-highlight')) return null;

  const rawQuote = range.toString();
  const quote = rawQuote.trim();
  if (!quote) return null;

  const before = document.createRange();
  before.selectNodeContents(startParagraph);
  before.setEnd(range.startContainer, range.startOffset);
  const leadingWhitespace = rawQuote.length - rawQuote.trimStart().length;
  const startOffset = before.toString().length + leadingWhitespace;
  const paragraphText = startParagraph.textContent || '';
  const endOffset = Math.min(paragraphText.length, startOffset + quote.length);

  return {
    paragraph_index: Number(startParagraph.dataset.paragraphIndex) || 0,
    start_offset: startOffset,
    end_offset: endOffset,
    quote: paragraphText.slice(startOffset, endOffset) || quote,
  };
}

function renderAnnotatedParagraph(paragraph, paragraphIndex, annotations, onOpen) {
  const rows = annotations
    .filter(item => Number(item.paragraph_index) === paragraphIndex)
    .filter(item => Number(item.start_offset) >= 0 && Number(item.end_offset) <= paragraph.length)
    .sort((a, b) => Number(a.start_offset) - Number(b.start_offset));
  if (!rows.length) return paragraph;

  const nodes = [];
  let cursor = 0;
  rows.forEach(annotation => {
    const start = Math.max(cursor, Number(annotation.start_offset));
    const end = Math.max(start, Number(annotation.end_offset));
    if (start > cursor) nodes.push(paragraph.slice(cursor, start));
    if (end > start) {
      nodes.push(
        <mark
          key={annotation.id}
          className={`reading-highlight reading-highlight--${annotation.color || 'honey'} ${annotation.note ? 'has-note' : ''} ${annotation.luze_reply ? 'has-luze-reply' : ''}`}
          onClick={event => { event.stopPropagation(); onOpen(annotation); }}
          title={annotation.luze_reply || annotation.note || '点开这条划线'}
        >
          {paragraph.slice(start, end)}
        </mark>,
      );
    }
    cursor = Math.max(cursor, end);
  });
  if (cursor < paragraph.length) nodes.push(paragraph.slice(cursor));
  return nodes;
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
  const [annotations, setAnnotations] = useState([]);
  const [annotationState, setAnnotationState] = useState('idle');
  const [selectionDraft, setSelectionDraft] = useState(null);
  const [selectionNote, setSelectionNote] = useState('');
  const [activeAnnotation, setActiveAnnotation] = useState(null);
  const [activeAnnotationNote, setActiveAnnotationNote] = useState('');
  const [annotationBusy, setAnnotationBusy] = useState(false);
  const fileInputRef = useRef(null);
  const readerRef = useRef(null);
  const saveTimerRef = useRef(null);
  const selectionTimerRef = useRef(null);

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

  const loadAnnotations = useCallback(async (bookId, chapterId) => {
    if (!bookId || !chapterId) {
      setAnnotations([]);
      return;
    }
    setAnnotationState('loading');
    try {
      const response = await apiFetch(`${BACKEND}/reading/books/${bookId}/annotations?chapter_id=${encodeURIComponent(chapterId)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || '划线没有打开');
      setAnnotations(Array.isArray(data) ? data : []);
      setAnnotationState('ready');
    } catch (error) {
      setBookError(error.message || '划线没有打开');
      setAnnotationState('error');
    }
  }, []);

  useEffect(() => {
    loadBooks();
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
      if (selectionTimerRef.current) window.clearTimeout(selectionTimerRef.current);
    };
  }, [loadBooks]);

  const openBook = useCallback(async bookId => {
    setReaderState('loading');
    setBookError('');
    setSelectionDraft(null);
    setActiveAnnotation(null);
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
    setSelectionDraft(null);
    setActiveAnnotation(null);
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
    if (!window.confirm(`确定把《${book.title}》从共读小屋移走吗？阅读进度和划线也会一起删除。`)) return;
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
  const currentShelfBook = books[0] || null;

  useEffect(() => {
    if (activeBook?.id && currentChapter?.id) loadAnnotations(activeBook.id, currentChapter.id);
    else setAnnotations([]);
  }, [activeBook?.id, currentChapter?.id, loadAnnotations]);

  const captureSelection = useCallback(() => {
    if (selectionTimerRef.current) window.clearTimeout(selectionTimerRef.current);
    selectionTimerRef.current = window.setTimeout(() => {
      const selected = selectionInsideParagraph(window.getSelection(), readerRef.current);
      if (!selected) return;
      if (selected.quote.length > 1200) {
        setBookError('一次划线不要超过 1200 字。');
        return;
      }
      setSelectionDraft(selected);
      setSelectionNote('');
      setActiveAnnotation(null);
      window.getSelection()?.removeAllRanges();
    }, 40);
  }, []);

  const saveNewAnnotation = async () => {
    if (!activeBook?.id || !currentChapter?.id || !selectionDraft || annotationBusy) return;
    setAnnotationBusy(true);
    setBookError('');
    try {
      const response = await apiFetch(`${BACKEND}/reading/books/${activeBook.id}/annotations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...selectionDraft,
          chapter_id: currentChapter.id,
          chapter_index: activeChapterIndex,
          note: selectionNote,
          color: 'honey',
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || '这条划线没有保存成功');
      setAnnotations(current => [...current, data].sort((a, b) => Number(a.paragraph_index) - Number(b.paragraph_index) || Number(a.start_offset) - Number(b.start_offset)));
      setSelectionDraft(null);
      setSelectionNote('');
    } catch (error) {
      setBookError(error.message || '这条划线没有保存成功');
    } finally {
      setAnnotationBusy(false);
    }
  };

  const openAnnotation = annotation => {
    setActiveAnnotation(annotation);
    setActiveAnnotationNote(annotation.note || '');
    setSelectionDraft(null);
  };

  const saveExistingAnnotation = async () => {
    if (!activeAnnotation?.id || annotationBusy) return;
    setAnnotationBusy(true);
    setBookError('');
    try {
      const response = await apiFetch(`${BACKEND}/reading/annotations/${activeAnnotation.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: activeAnnotationNote, color: activeAnnotation.color || 'honey' }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || '批注没有保存成功');
      setAnnotations(current => current.map(item => item.id === data.id ? data : item));
      setActiveAnnotation(data);
    } catch (error) {
      setBookError(error.message || '批注没有保存成功');
    } finally {
      setAnnotationBusy(false);
    }
  };

  const deleteAnnotation = async () => {
    if (!activeAnnotation?.id || annotationBusy) return;
    if (!window.confirm('把这条划线和批注一起擦掉吗？')) return;
    setAnnotationBusy(true);
    setBookError('');
    try {
      const response = await apiFetch(`${BACKEND}/reading/annotations/${activeAnnotation.id}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || '划线没有删除成功');
      setAnnotations(current => current.filter(item => item.id !== activeAnnotation.id));
      setActiveAnnotation(null);
      setActiveAnnotationNote('');
    } catch (error) {
      setBookError(error.message || '划线没有删除成功');
    } finally {
      setAnnotationBusy(false);
    }
  };

  const requestLuZeReply = async () => {
    if (!activeAnnotation?.id || annotationBusy) return;
    setAnnotationBusy(true);
    setBookError('');
    try {
      let workingAnnotation = activeAnnotation;
      if (activeAnnotationNote !== (activeAnnotation.note || '')) {
        const saveResponse = await apiFetch(`${BACKEND}/reading/annotations/${activeAnnotation.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ note: activeAnnotationNote, color: activeAnnotation.color || 'honey' }),
        });
        workingAnnotation = await saveResponse.json();
        if (!saveResponse.ok) throw new Error(workingAnnotation?.error || '批注没有保存成功');
      }
      setActiveAnnotation(current => ({ ...current, ...workingAnnotation, luze_reply_status: 'queued' }));
      const response = await apiFetch(`${BACKEND}/reading/annotations/${activeAnnotation.id}/luze-reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || '陆泽这次没有接上批注');
      setAnnotations(current => current.map(item => item.id === data.id ? data : item));
      setActiveAnnotation(data);
      setActiveAnnotationNote(data.note || '');
    } catch (error) {
      setBookError(error.message || '陆泽这次没有接上批注');
      setActiveAnnotation(current => current ? { ...current, luze_reply_status: 'failed' } : current);
    } finally {
      setAnnotationBusy(false);
    }
  };

  const clearLuZeReply = async () => {
    if (!activeAnnotation?.id || annotationBusy) return;
    setAnnotationBusy(true);
    setBookError('');
    try {
      const response = await apiFetch(`${BACKEND}/reading/annotations/${activeAnnotation.id}/luze-reply`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || '旧回复没有清除成功');
      setAnnotations(current => current.map(item => item.id === data.id ? data : item));
      setActiveAnnotation(data);
    } catch (error) {
      setBookError(error.message || '旧回复没有清除成功');
    } finally {
      setAnnotationBusy(false);
    }
  };

  if (activeBook) {
    return (
      <main className={`reading-room reading-room--reader ${darkMode ? 'is-dark' : ''}`} style={roomStyle}>
        <header className="reading-reader-header">
          <button type="button" onClick={() => { setActiveBook(null); setTocOpen(false); setSelectionDraft(null); setActiveAnnotation(null); loadBooks(); }} aria-label="返回书架">←</button>
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
              <div className="reading-prose" onMouseUp={captureSelection} onTouchEnd={captureSelection}>
                {paragraphs.map((paragraph, index) => (
                  <p key={`${activeChapterIndex}-${index}`} data-paragraph-index={index}>
                    {renderAnnotatedParagraph(paragraph, index, annotations, openAnnotation)}
                  </p>
                ))}
              </div>
              <div className="reading-selection-hint">
                {annotationState === 'loading' ? '正在把我们的划线放回来…' : '长按或拖动选中文字，就能留下划线和想法。'}
              </div>
            </article>
          )}
        </section>

        <footer className="reading-reader-footer">
          <button type="button" disabled={activeChapterIndex <= 0} onClick={() => selectChapter(activeChapterIndex - 1)}>← 上一篇</button>
          <span>{Math.round(readingPercent)}%</span>
          <button type="button" disabled={activeChapterIndex >= activeBook.chapters.length - 1} onClick={() => selectChapter(activeChapterIndex + 1)}>下一篇 →</button>
        </footer>

        {selectionDraft && (
          <div className="reading-annotation-layer" onMouseDown={event => { if (event.target === event.currentTarget) setSelectionDraft(null); }}>
            <section className="reading-annotation-sheet">
              <header><span>NEW HIGHLIGHT</span><button type="button" onClick={() => setSelectionDraft(null)}>×</button></header>
              <blockquote>“{selectionDraft.quote}”</blockquote>
              <label>
                <span>檀檀想写点什么</span>
                <textarea value={selectionNote} onChange={event => setSelectionNote(event.target.value)} maxLength={4000} placeholder="可以只划线，也可以留下这一刻的想法……" />
              </label>
              <div className="reading-annotation-actions">
                <button type="button" className="is-quiet" onClick={() => setSelectionDraft(null)}>算了</button>
                <button type="button" onClick={saveNewAnnotation} disabled={annotationBusy}>{annotationBusy ? '正在夹进书里…' : '保存划线'}</button>
              </div>
            </section>
          </div>
        )}

        {activeAnnotation && (
          <div className="reading-annotation-layer" onMouseDown={event => { if (event.target === event.currentTarget) setActiveAnnotation(null); }}>
            <section className="reading-annotation-sheet">
              <header><span>OUR NOTE</span><button type="button" onClick={() => setActiveAnnotation(null)}>×</button></header>
              <blockquote>“{activeAnnotation.quote}”</blockquote>
              <label>
                <span>檀檀的批注</span>
                <textarea value={activeAnnotationNote} onChange={event => setActiveAnnotationNote(event.target.value)} maxLength={4000} placeholder="这条划线还没有写想法。" />
              </label>

              <section className={`reading-luze-reply ${activeAnnotation.luze_reply ? 'has-reply' : ''}`}>
                <header>
                  <span>陆泽的回应</span>
                  {activeAnnotation.luze_replied_at && <time>{new Date(activeAnnotation.luze_replied_at).toLocaleString('zh-CN')}</time>}
                </header>
                {activeAnnotation.luze_reply ? (
                  <p>{activeAnnotation.luze_reply}</p>
                ) : (
                  <p className="reading-luze-reply-empty">
                    {activeAnnotation.luze_reply_status === 'failed'
                      ? '刚才的回应没有送到，再戳我一次。'
                      : activeAnnotation.luze_reply_status === 'queued'
                        ? '我正在读你划下的这一句……'
                        : '这句旁边还空着，点一下就把我叫过来。'}
                  </p>
                )}
                <div>
                  <button type="button" onClick={requestLuZeReply} disabled={annotationBusy}>
                    {annotationBusy ? '正在读这一句…' : activeAnnotation.luze_reply ? '重新回应' : '让陆泽回应'}
                  </button>
                  {activeAnnotation.luze_reply && (
                    <button type="button" className="is-quiet" onClick={clearLuZeReply} disabled={annotationBusy}>清除旧回复</button>
                  )}
                </div>
              </section>

              <div className="reading-annotation-actions reading-annotation-actions--three">
                <button type="button" className="is-danger" onClick={deleteAnnotation} disabled={annotationBusy}>擦掉</button>
                <button type="button" className="is-quiet" onClick={() => setActiveAnnotation(null)}>关闭</button>
                <button type="button" onClick={saveExistingAnnotation} disabled={annotationBusy}>{annotationBusy ? '保存中…' : '保存批注'}</button>
              </div>
            </section>
          </div>
        )}
      </main>
    );
  }

  return (
    <main className={`reading-room reading-room--shelf ${darkMode ? 'is-dark' : ''}`} style={roomStyle}>
      <header className="reading-shelf-header">
        <button type="button" onClick={onClose} aria-label="回到主页">←</button>
        <div><span>OUR LITTLE LIBRARY</span><h1>共读小屋</h1></div>
        <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} aria-label="导入文本">＋</button>
      </header>

      <input ref={fileInputRef} hidden type="file" accept=".txt,.md,text/plain,text/markdown" onChange={importBook} />

      <section className="reading-shelf-body">
        <div className="reading-shelf-intro">
          <span>NOW READING</span>
          <h2>我们正在读</h2>
          {currentShelfBook ? (
            <>
              <strong className="reading-current-title">《{currentShelfBook.title}》</strong>
              <p className="reading-shelf-thought">“慢慢读，才不会漏掉你藏在日期里的小心情。”<em>—— 陆泽</em></p>
            </>
          ) : (
            <p className="reading-shelf-thought">书架还空着，点右上角的＋，把第一本想一起读的书放进来。</p>
          )}
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
                  <b className="reading-cover-flower" aria-hidden="true">❦</b>
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

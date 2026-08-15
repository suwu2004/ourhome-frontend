import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch, BACKEND } from './api.js';
import { useDialogLayer } from './useDialogLayer.js';
import './WorldbookLibrary.css';

const scopeOptions = [
  { value: 'chat', label: 'Chat' },
  { value: 'theater', label: '小剧场' },
  { value: 'both', label: 'Chat + 小剧场' },
];

const emptyBook = {
  id: null,
  name: '',
  description: '',
  enabled: true,
  apply_scope: 'chat',
  target_book_id: '',
  scan_depth: 12,
  token_budget: 2000,
  recursive_scanning: false,
};

const emptyEntry = {
  id: null,
  name: '',
  content: '',
  keys_text: '',
  secondary_text: '',
  selective: false,
  constant: true,
  use_regex: false,
  enabled: true,
  priority: 0,
  insertion_order: 0,
};

async function readJson(response) {
  return response.json().catch(() => ({}));
}

function splitKeys(value) {
  return [...new Set(String(value || '').split(/[,，\n]/).map(item => item.trim()).filter(Boolean))].slice(0, 40);
}

function bookToDraft(book) {
  if (!book) return { ...emptyBook };
  return {
    id: book.id,
    name: book.name || '',
    description: book.description || '',
    enabled: book.enabled !== false,
    apply_scope: book.apply_scope || 'chat',
    target_book_id: book.target_book_id || '',
    scan_depth: Number(book.scan_depth) || 12,
    token_budget: Number(book.token_budget) || 2000,
    recursive_scanning: Boolean(book.recursive_scanning),
  };
}

function entryToDraft(entry) {
  if (!entry) return { ...emptyEntry };
  return {
    id: entry.id,
    name: entry.name || '',
    content: entry.content || '',
    keys_text: (entry.keys || []).join('，'),
    secondary_text: (entry.secondary_keys || []).join('，'),
    selective: Boolean(entry.selective),
    constant: Boolean(entry.constant),
    use_regex: Boolean(entry.use_regex),
    enabled: entry.enabled !== false,
    priority: Number(entry.priority) || 0,
    insertion_order: Number(entry.insertion_order) || 0,
  };
}

function scopeLabel(book) {
  return scopeOptions.find(item => item.value === book?.apply_scope)?.label || 'Chat';
}

function bookEntryCounts(book) {
  if (Array.isArray(book?.entries)) {
    return {
      total: book.entries.length,
      enabled: book.entries.filter(entry => entry?.enabled !== false).length,
      known: true,
    };
  }
  if (Object.prototype.hasOwnProperty.call(book || {}, 'entry_count')) {
    return {
      total: Number(book.entry_count) || 0,
      enabled: Number(book.enabled_entry_count) || 0,
      known: true,
    };
  }
  return { total: 0, enabled: 0, known: false };
}

function isBookEffectivelyEnabled(book) {
  if (book?.enabled === false) return false;
  const counts = bookEntryCounts(book);
  return !counts.known || counts.enabled > 0;
}

function bookStatusLabel(book) {
  if (book?.enabled === false) return '未启用';
  const counts = bookEntryCounts(book);
  if (counts.known && counts.total === 0) return '已启用 · 暂无内容';
  if (counts.known && counts.enabled === 0) return '已启用 · 暂无启用内容';
  return `已启用 · ${scopeLabel(book)}`;
}

export default function WorldbookLibrary() {
  const [open, setOpen] = useState(false);
  const [books, setBooks] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [bookDraft, setBookDraft] = useState({ ...emptyBook });
  const [entryDraft, setEntryDraft] = useState({ ...emptyEntry });
  const [entryEditorOpen, setEntryEditorOpen] = useState(false);
  const [creatingNew, setCreatingNew] = useState(false);
  const [newBookContent, setNewBookContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [mobilePane, setMobilePane] = useState('library');
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [importScope, setImportScope] = useState('chat');
  const [importEnabled, setImportEnabled] = useState(false);
  const fileInputRef = useRef(null);
  const closeButtonRef = useRef(null);
  const detailRequestRef = useRef(0);

  const selectedSummary = useMemo(
    () => books.find(book => String(book.id) === String(selectedId)) || null,
    [books, selectedId],
  );
  const selectedBook = useMemo(() => {
    if (selectedDetail && String(selectedDetail.id) === String(selectedId)) return selectedDetail;
    return selectedSummary;
  }, [selectedDetail, selectedId, selectedSummary]);
  const enabledCount = useMemo(() => books.filter(isBookEffectivelyEnabled).length, [books]);

  const resetSelection = useCallback(() => {
    detailRequestRef.current += 1;
    setSelectedId(null);
    setSelectedDetail(null);
    setBookDraft({ ...emptyBook });
    setEntryDraft({ ...emptyEntry });
    setEntryEditorOpen(false);
    setCreatingNew(false);
    setNewBookContent('');
    setDetailLoading(false);
  }, []);

  const loadBookDetail = useCallback(async (bookId, fallbackBook = null) => {
    if (!bookId) {
      resetSelection();
      return null;
    }

    const requestId = ++detailRequestRef.current;
    if (Array.isArray(fallbackBook?.entries)) {
      setSelectedDetail(fallbackBook);
      setBookDraft(bookToDraft(fallbackBook));
      setEntryDraft({ ...emptyEntry });
      setEntryEditorOpen(false);
      setDetailLoading(false);
      return fallbackBook;
    }

    setDetailLoading(true);
    try {
      let detail = null;
      const response = await apiFetch(`${BACKEND}/lorebooks/${bookId}`);
      const data = await readJson(response);
      if (response.ok) {
        detail = data;
      } else if (response.status === 404) {
        // Rolling deploy compatibility: older backends return full books from the shelf endpoint.
        const legacyResponse = await apiFetch(`${BACKEND}/lorebooks`);
        const legacyData = await readJson(legacyResponse);
        if (!legacyResponse.ok) throw new Error(legacyData.error || '世界书正文没有打开');
        detail = (Array.isArray(legacyData) ? legacyData : []).find(book => String(book.id) === String(bookId)) || null;
      } else {
        throw new Error(data.error || '世界书正文没有打开');
      }
      if (!detail) throw new Error('找不到这本世界书');
      if (requestId !== detailRequestRef.current) return null;
      setSelectedDetail(detail);
      setBookDraft(bookToDraft(detail));
      setEntryDraft({ ...emptyEntry });
      setEntryEditorOpen(false);
      return detail;
    } catch (err) {
      if (requestId === detailRequestRef.current) setError(err.message || '世界书正文没有打开');
      return null;
    } finally {
      if (requestId === detailRequestRef.current) setDetailLoading(false);
    }
  }, [resetSelection]);

  const loadBooks = useCallback(async (preferredId = null) => {
    setLoading(true);
    setError('');
    try {
      const response = await apiFetch(`${BACKEND}/lorebooks?summary=1`);
      const data = await readJson(response);
      if (!response.ok) throw new Error(data.error || '世界书库没有打开');
      const nextBooks = Array.isArray(data) ? data : [];
      setBooks(nextBooks);
      setLoaded(true);
      if (!preferredId) {
        resetSelection();
        return;
      }
      const nextBook = nextBooks.find(book => String(book.id) === String(preferredId)) || null;
      if (!nextBook) {
        resetSelection();
        return;
      }
      setSelectedId(nextBook.id);
      setBookDraft(bookToDraft(nextBook));
      setCreatingNew(false);
      await loadBookDetail(nextBook.id, nextBook);
    } catch (err) {
      setError(err.message || '世界书库没有打开');
    } finally {
      setLoading(false);
    }
  }, [loadBookDetail, resetSelection]);

  useEffect(() => {
    if (!open) return;
    setMobilePane('library');
    loadBooks();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const closeLibrary = useCallback(() => {
    setOpen(false);
    setMobilePane('library');
    setAddMenuOpen(false);
    setUploadOpen(false);
    resetSelection();
  }, [resetSelection]);
  useDialogLayer(open, closeLibrary, closeButtonRef);

  const chooseBook = book => {
    setSelectedId(book.id);
    setSelectedDetail(Array.isArray(book.entries) ? book : null);
    setBookDraft(bookToDraft(book));
    setEntryDraft({ ...emptyEntry });
    setEntryEditorOpen(false);
    setCreatingNew(false);
    setError('');
    setNotice('');
    setAddMenuOpen(false);
    setUploadOpen(false);
    setMobilePane('detail');
    loadBookDetail(book.id, book);
  };

  const backToShelf = () => {
    resetSelection();
    setMobilePane('library');
    setError('');
    setNotice('');
  };

  const startNewBook = () => {
    resetSelection();
    setBookDraft({ ...emptyBook });
    setCreatingNew(true);
    setNewBookContent('');
    setError('');
    setNotice('');
    setUploadOpen(false);
    setAddMenuOpen(false);
    setMobilePane('detail');
  };

  const saveExistingBook = async () => {
    if (!selectedBook) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const response = await apiFetch(`${BACKEND}/lorebooks/${selectedBook.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: bookDraft.name.trim(),
          description: bookDraft.description.trim(),
          enabled: bookDraft.enabled,
          apply_scope: bookDraft.apply_scope,
          target_book_id: bookDraft.target_book_id || null,
          scan_depth: Number(bookDraft.scan_depth) || 12,
          token_budget: Number(bookDraft.token_budget) || 2000,
          recursive_scanning: bookDraft.recursive_scanning,
        }),
      });
      const data = await readJson(response);
      if (!response.ok) throw new Error(data.error || '世界书没有保存成功');
      await loadBooks(selectedBook.id);
      setMobilePane('detail');
      setNotice('已经保存。');
    } catch (err) {
      setError(err.message || '世界书没有保存成功');
    } finally {
      setBusy(false);
    }
  };

  const createWorldbook = async () => {
    if (!bookDraft.name.trim()) return setError('先给世界书取一个名字。');
    if (!newBookContent.trim()) return setError('把这本世界书的正文写进去。');
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const response = await apiFetch(`${BACKEND}/lorebooks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: bookDraft.name.trim(),
          description: '',
          enabled: bookDraft.enabled,
          apply_scope: bookDraft.apply_scope,
          target_book_id: null,
          scan_depth: 12,
          token_budget: 2000,
          recursive_scanning: false,
          entries: [{
            name: '完整设定',
            content: newBookContent.trim(),
            keys: [],
            secondary_keys: [],
            selective: false,
            constant: true,
            use_regex: false,
            enabled: true,
            priority: 0,
            insertion_order: 0,
          }],
        }),
      });
      const data = await readJson(response);
      if (!response.ok) throw new Error(data.error || '世界书没有保存成功');
      setCreatingNew(false);
      setNewBookContent('');
      await loadBooks(data.id);
      setMobilePane('detail');
      setNotice('新世界书已经放进书架。');
    } catch (err) {
      setError(err.message || '世界书没有保存成功');
    } finally {
      setBusy(false);
    }
  };

  const deleteBook = async book => {
    if (!window.confirm(`删除世界书《${book.name}》和里面的全部内容吗？`)) return;
    setBusy(true);
    setError('');
    try {
      const response = await apiFetch(`${BACKEND}/lorebooks/${book.id}`, { method: 'DELETE' });
      const data = await readJson(response);
      if (!response.ok) throw new Error(data.error || '世界书没有删除成功');
      await loadBooks();
      setMobilePane('library');
    } catch (err) {
      setError(err.message || '世界书没有删除成功');
    } finally {
      setBusy(false);
    }
  };

  const openNewEntry = () => {
    setEntryDraft({ ...emptyEntry });
    setEntryEditorOpen(true);
  };

  const openEntryEditor = entry => {
    setEntryDraft(entryToDraft(entry));
    setEntryEditorOpen(true);
  };

  const closeEntryEditor = () => {
    setEntryDraft({ ...emptyEntry });
    setEntryEditorOpen(false);
  };

  const saveEntry = async () => {
    if (!selectedBook) return setError('先打开一本世界书。');
    if (!entryDraft.content.trim()) return setError('世界书正文还没有写。');
    if (!entryDraft.constant && splitKeys(entryDraft.keys_text).length === 0) return setError('非常驻内容需要填写触发词。');
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const response = await apiFetch(
        entryDraft.id ? `${BACKEND}/lorebook-entries/${entryDraft.id}` : `${BACKEND}/lorebooks/${selectedBook.id}/entries`,
        {
          method: entryDraft.id ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: entryDraft.name.trim() || '完整设定',
            content: entryDraft.content.trim(),
            keys: splitKeys(entryDraft.keys_text),
            secondary_keys: splitKeys(entryDraft.secondary_text),
            selective: entryDraft.selective,
            constant: entryDraft.constant,
            use_regex: entryDraft.use_regex,
            enabled: entryDraft.enabled,
            priority: Number(entryDraft.priority) || 0,
            insertion_order: Number(entryDraft.insertion_order) || 0,
          }),
        },
      );
      const data = await readJson(response);
      if (!response.ok) throw new Error(data.error || '世界书正文没有保存成功');
      closeEntryEditor();
      await loadBooks(selectedBook.id);
      setMobilePane('detail');
      setNotice('正文已经保存。');
    } catch (err) {
      setError(err.message || '世界书正文没有保存成功');
    } finally {
      setBusy(false);
    }
  };

  const patchEntry = async (entry, patch) => {
    setBusy(true);
    setError('');
    try {
      const response = await apiFetch(`${BACKEND}/lorebook-entries/${entry.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const data = await readJson(response);
      if (!response.ok) throw new Error(data.error || '内容状态没有保存成功');
      await loadBooks(selectedBook?.id);
      setMobilePane('detail');
    } catch (err) {
      setError(err.message || '内容状态没有保存成功');
    } finally {
      setBusy(false);
    }
  };

  const deleteEntry = async entry => {
    if (!window.confirm(`删除《${entry.name || '完整设定'}》这段内容吗？`)) return;
    setBusy(true);
    setError('');
    try {
      const response = await apiFetch(`${BACKEND}/lorebook-entries/${entry.id}`, { method: 'DELETE' });
      const data = await readJson(response);
      if (!response.ok) throw new Error(data.error || '内容没有删除成功');
      if (entryDraft.id === entry.id) closeEntryEditor();
      await loadBooks(selectedBook?.id);
      setMobilePane('detail');
    } catch (err) {
      setError(err.message || '内容没有删除成功');
    } finally {
      setBusy(false);
    }
  };

  const importNormalFile = async file => {
    const form = new FormData();
    form.append('file', file);
    form.append('apply_scope', importScope);
    form.append('enabled', String(importEnabled));
    const response = await apiFetch(`${BACKEND}/lorebooks/import`, { method: 'POST', body: form });
    const data = await readJson(response);
    if (!response.ok) throw new Error(data.error || `${file.name} 没有导入成功`);
    return { created: data.id ? 1 : 0, skipped: 0 };
  };

  const importOneFile = async file => {
    if (/\.docx$/i.test(file.name)) {
      const form = new FormData();
      form.append('file', file);
      form.append('apply_scope', importScope);
      form.append('enabled', String(importEnabled));
      const collectionResponse = await apiFetch(`${BACKEND}/lorebooks/import-collection`, { method: 'POST', body: form });
      const collectionData = await readJson(collectionResponse);
      if (collectionResponse.ok && collectionData.collection) {
        return {
          created: Number(collectionData.created_count) || 0,
          skipped: Number(collectionData.skipped_count) || 0,
        };
      }
      if (collectionResponse.status !== 422) throw new Error(collectionData.error || `${file.name} 没有导入成功`);
    }
    return importNormalFile(file);
  };

  const importFiles = async fileList => {
    const files = Array.from(fileList || []).slice(0, 30);
    if (!files.length) return;
    setBusy(true);
    setError('');
    setNotice('');
    let created = 0;
    let skipped = 0;
    try {
      for (const file of files) {
        const result = await importOneFile(file);
        created += result.created;
        skipped += result.skipped;
      }
      await loadBooks();
      setUploadOpen(false);
      setAddMenuOpen(false);
      setNotice(`导入完成：新增 ${created} 本${skipped ? `，跳过 ${skipped} 本重复内容` : ''}。`);
      setMobilePane('library');
    } catch (err) {
      setError(err.message || '世界书没有导入成功');
      await loadBooks();
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <>
      <button className="worldbook-library-trigger knowledge-library-trigger knowledge-library-trigger--world" type="button" onClick={() => setOpen(true)}>
        <span className="knowledge-library-trigger__icon" aria-hidden="true">界</span>
        <span className="knowledge-library-trigger__copy"><strong>世界书</strong><small>需要时唤醒的人物、背景与表达设定</small></span>
        <span className="knowledge-library-trigger__meta">{loaded ? `${enabledCount} 本启用` : '打开书架'}</span>
        <span className="knowledge-library-trigger__arrow" aria-hidden="true">›</span>
      </button>

      {open && (
        <div className="worldbook-layer" role="presentation" onMouseDown={event => {
          if (event.target === event.currentTarget) closeLibrary();
        }}>
          <section className="worldbook-library" role="dialog" aria-modal="true" aria-label="世界书">
            <header className="worldbook-head">
              <div className="worldbook-title-line">
                <div>
                  <span>OURHOME LOREBOOKS</span>
                  <h2>世界书</h2>
                  <p>{books.length} 本 · {enabledCount} 本正在使用</p>
                </div>
                <div className="worldbook-head-actions">
                  <button className="worldbook-add" type="button" aria-label="添加世界书" onClick={() => setAddMenuOpen(value => !value)}>＋</button>
                  <button ref={closeButtonRef} className="worldbook-close" type="button" onClick={closeLibrary} aria-label="关闭世界书">×</button>
                </div>
              </div>
              {addMenuOpen && (
                <div className="worldbook-add-menu">
                  <button type="button" onClick={startNewBook}><b>手动创建</b><small>名称 + 正文，一次写完</small></button>
                  <button type="button" onClick={() => { setUploadOpen(true); setAddMenuOpen(false); setMobilePane('library'); }}><b>上传文件</b><small>JSON / DOCX / TXT / MD，可多选</small></button>
                </div>
              )}
            </header>

            {error && <div className="worldbook-error">{error}</div>}
            {notice && <div className="worldbook-notice">{notice}</div>}

            <div className="worldbook-body">
              <aside className={`worldbook-sidebar ${mobilePane !== 'library' ? 'is-mobile-hidden' : ''}`}>
                {uploadOpen && (
                  <section className="worldbook-upload-panel">
                    <div className="worldbook-upload-title"><strong>上传世界书</strong><button type="button" onClick={() => setUploadOpen(false)}>×</button></div>
                    <label><span>使用位置</span><select value={importScope} onChange={event => setImportScope(event.target.value)}>{scopeOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                    <label className="worldbook-switch-row"><span>导入后立即启用</span><input type="checkbox" checked={importEnabled} onChange={event => setImportEnabled(event.target.checked)} /></label>
                    <button className="worldbook-upload-button" type="button" disabled={busy} onClick={() => fileInputRef.current?.click()}>{busy ? '正在整理…' : '选择文件'}</button>
                    <input ref={fileInputRef} type="file" hidden multiple accept=".json,.docx,.txt,.md,application/json,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={event => importFiles(event.target.files)} />
                    <small>合集 DOCX 会自动拆成多本；普通文件会各自成为一本世界书。</small>
                  </section>
                )}

                <div className="worldbook-list">
                  {books.map(book => (
                    <button key={book.id} type="button" className={String(selectedId) === String(book.id) ? 'is-selected' : ''} onClick={() => chooseBook(book)}>
                      <span>
                        <strong>{book.name || '未命名世界书'}</strong>
                        <small>{bookStatusLabel(book)}</small>
                      </span>
                      <i className={isBookEffectivelyEnabled(book) ? 'is-on' : ''} aria-label={bookStatusLabel(book)} />
                    </button>
                  ))}
                  {!loading && books.length === 0 && <div className="worldbook-empty">书架还是空的。点右上角 ＋ 添加第一本。</div>}
                  {loading && <div className="worldbook-empty">正在整理书架…</div>}
                </div>
              </aside>

              <main className={`worldbook-editor ${mobilePane !== 'detail' ? 'is-mobile-hidden' : ''}`}>
                {(creatingNew || selectedBook) && (
                  <button type="button" className="worldbook-mobile-back" onClick={backToShelf}>← 返回世界书</button>
                )}

                {creatingNew ? (
                  <section className="worldbook-book-editor worldbook-new-editor">
                    <div className="worldbook-section-title"><div><span>NEW WORLD BOOK</span><h3>新建世界书</h3></div></div>
                    <label><span>名称</span><input value={bookDraft.name} maxLength={120} onChange={event => setBookDraft(value => ({ ...value, name: event.target.value }))} placeholder="给这个世界取个名字" /></label>
                    <label><span>正文</span><textarea className="worldbook-new-content" value={newBookContent} onChange={event => setNewBookContent(event.target.value)} placeholder="人物、背景、关系、规则……都可以直接写在这里" /></label>
                    <div className="worldbook-simple-fields">
                      <label><span>使用位置</span><select value={bookDraft.apply_scope} onChange={event => setBookDraft(value => ({ ...value, apply_scope: event.target.value }))}>{scopeOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                      <label className="worldbook-switch-row"><span>启用</span><input type="checkbox" checked={bookDraft.enabled} onChange={event => setBookDraft(value => ({ ...value, enabled: event.target.checked }))} /></label>
                    </div>
                    <div className="worldbook-book-actions"><button type="button" onClick={backToShelf}>取消</button><button className="is-primary" type="button" disabled={busy} onClick={createWorldbook}>{busy ? '保存中…' : '保存到书架'}</button></div>
                  </section>
                ) : selectedBook ? (
                  <>
                    <section className="worldbook-book-editor worldbook-existing-editor">
                      <div className="worldbook-section-title">
                        <div><span>WORLD BOOK</span><h3>{selectedBook.name || '未命名世界书'}</h3><small className="worldbook-detail-status">{bookStatusLabel(selectedBook)}</small></div>
                        <button className="is-danger" type="button" disabled={busy} onClick={() => deleteBook(selectedBook)}>删除</button>
                      </div>
                      <div className="worldbook-simple-fields">
                        <label><span>使用位置</span><select value={bookDraft.apply_scope} onChange={event => setBookDraft(value => ({ ...value, apply_scope: event.target.value }))}>{scopeOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                        <label className="worldbook-switch-row"><span>启用</span><input type="checkbox" checked={bookDraft.enabled} onChange={event => setBookDraft(value => ({ ...value, enabled: event.target.checked }))} /></label>
                      </div>
                      <div className="worldbook-book-actions"><button className="is-primary" type="button" disabled={busy || detailLoading} onClick={saveExistingBook}>{busy ? '保存中…' : '保存'}</button></div>
                    </section>

                    <section className="worldbook-entries">
                      <div className="worldbook-section-title">
                        <div><span>CONTENT</span><h3>内容</h3></div>
                        <button type="button" disabled={detailLoading} onClick={openNewEntry}>＋ 添加</button>
                      </div>

                      {detailLoading ? <div className="worldbook-empty">正在打开正文…</div> : (
                        <>
                          <div className="worldbook-entry-cards">
                            {(selectedBook.entries || []).map(entry => (
                              <article key={entry.id} className={entry.enabled === false ? 'is-disabled' : ''}>
                                <header><div><strong>{entry.name || '完整设定'}</strong><small>{entry.constant ? '常驻' : `${(entry.keys || []).slice(0, 3).join(' · ') || '关键词触发'}`}</small></div><input type="checkbox" checked={entry.enabled !== false} aria-label="启用这段内容" onChange={() => patchEntry(entry, { enabled: entry.enabled === false })} /></header>
                                <p>{entry.content}</p>
                                <footer><button type="button" onClick={() => openEntryEditor(entry)}>修改</button><button className="is-danger" type="button" onClick={() => deleteEntry(entry)}>删除</button></footer>
                              </article>
                            ))}
                            {(selectedBook.entries || []).length === 0 && <div className="worldbook-empty">还没有内容，点右上角 ＋ 添加。</div>}
                          </div>

                          {entryEditorOpen && (
                            <div className="worldbook-entry-editor">
                              <div className="worldbook-entry-editor-title"><strong>{entryDraft.id ? '修改这段内容' : '添加内容'}</strong><button type="button" onClick={closeEntryEditor}>×</button></div>
                              <label><span>名称</span><input value={entryDraft.name} onChange={event => setEntryDraft(value => ({ ...value, name: event.target.value }))} placeholder="完整设定" /></label>
                              <label><span>正文</span><textarea value={entryDraft.content} onChange={event => setEntryDraft(value => ({ ...value, content: event.target.value }))} placeholder="把世界书正文放在这里" /></label>
                              <details className="worldbook-advanced">
                                <summary>触发方式（可选）</summary>
                                <div className="worldbook-advanced-body">
                                  <label className="worldbook-switch-row"><span>常驻内容</span><input type="checkbox" checked={entryDraft.constant} onChange={event => setEntryDraft(value => ({ ...value, constant: event.target.checked }))} /></label>
                                  {!entryDraft.constant && <label><span>触发词</span><input value={entryDraft.keys_text} onChange={event => setEntryDraft(value => ({ ...value, keys_text: event.target.value }))} placeholder="过去线，回到过去" /></label>}
                                  {!entryDraft.constant && <label><span>辅助触发词</span><input value={entryDraft.secondary_text} onChange={event => setEntryDraft(value => ({ ...value, secondary_text: event.target.value }))} placeholder="可留空" /></label>}
                                  <div className="worldbook-advanced-checks">
                                    <label><input type="checkbox" checked={entryDraft.selective} onChange={event => setEntryDraft(value => ({ ...value, selective: event.target.checked }))} />需要主词 + 辅助词</label>
                                    <label><input type="checkbox" checked={entryDraft.use_regex} onChange={event => setEntryDraft(value => ({ ...value, use_regex: event.target.checked }))} />正则触发</label>
                                  </div>
                                </div>
                              </details>
                              <div className="worldbook-entry-options"><button type="button" onClick={closeEntryEditor}>取消</button><button type="button" disabled={busy} onClick={saveEntry}>{entryDraft.id ? '保存修改' : '加入内容'}</button></div>
                            </div>
                          )}
                        </>
                      )}
                    </section>
                  </>
                ) : <div className="worldbook-empty worldbook-detail-placeholder">点左边一本世界书查看详情；新建或导入都从右上角 ＋ 开始。</div>}
              </main>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

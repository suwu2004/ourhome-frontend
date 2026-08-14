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

export default function WorldbookLibrary() {
  const [open, setOpen] = useState(false);
  const [books, setBooks] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [bookDraft, setBookDraft] = useState({ ...emptyBook });
  const [entryDraft, setEntryDraft] = useState({ ...emptyEntry });
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

  const selectedBook = useMemo(
    () => books.find(book => String(book.id) === String(selectedId)) || null,
    [books, selectedId],
  );
  const enabledCount = useMemo(() => books.filter(book => book.enabled).length, [books]);

  const loadBooks = useCallback(async (preferredId = null) => {
    setLoading(true);
    setError('');
    try {
      const response = await apiFetch(`${BACKEND}/lorebooks`);
      const data = await readJson(response);
      if (!response.ok) throw new Error(data.error || '世界书库没有打开');
      const nextBooks = Array.isArray(data) ? data : [];
      setBooks(nextBooks);
      setLoaded(true);
      const nextId = preferredId || selectedId || nextBooks[0]?.id || null;
      setSelectedId(nextId);
      setBookDraft(bookToDraft(nextBooks.find(book => String(book.id) === String(nextId))));
      setEntryDraft({ ...emptyEntry });
    } catch (err) {
      setError(err.message || '世界书库没有打开');
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  useEffect(() => {
    if (!open) return;
    loadBooks();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const closeLibrary = useCallback(() => setOpen(false), []);
  useDialogLayer(open, closeLibrary, closeButtonRef);

  const chooseBook = book => {
    setSelectedId(book.id);
    setBookDraft(bookToDraft(book));
    setEntryDraft({ ...emptyEntry });
    setError('');
    setNotice('');
    setAddMenuOpen(false);
    setUploadOpen(false);
    setMobilePane('detail');
  };

  const startNewBook = () => {
    setSelectedId(null);
    setBookDraft({ ...emptyBook });
    setEntryDraft({ ...emptyEntry });
    setError('');
    setNotice('');
    setUploadOpen(false);
    setAddMenuOpen(false);
    setMobilePane('detail');
  };

  const saveBook = async () => {
    if (!bookDraft.name.trim()) return setError('先给世界书取一个名字。');
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const response = await apiFetch(`${BACKEND}/lorebooks${bookDraft.id ? `/${bookDraft.id}` : ''}`, {
        method: bookDraft.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: bookDraft.name.trim(),
          description: bookDraft.description.trim(),
          enabled: bookDraft.enabled,
          apply_scope: bookDraft.apply_scope,
          target_book_id: null,
          scan_depth: Number(bookDraft.scan_depth) || 12,
          token_budget: Number(bookDraft.token_budget) || 2000,
          recursive_scanning: bookDraft.recursive_scanning,
        }),
      });
      const data = await readJson(response);
      if (!response.ok) throw new Error(data.error || '世界书没有保存成功');
      await loadBooks(data.id || bookDraft.id);
      setNotice('已经保存。');
    } catch (err) {
      setError(err.message || '世界书没有保存成功');
    } finally {
      setBusy(false);
    }
  };

  const toggleBook = async book => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const response = await apiFetch(`${BACKEND}/lorebooks/${book.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !book.enabled }),
      });
      const data = await readJson(response);
      if (!response.ok) throw new Error(data.error || '世界书状态没有保存成功');
      await loadBooks(book.id);
    } catch (err) {
      setError(err.message || '世界书状态没有保存成功');
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
      setSelectedId(null);
      setBookDraft({ ...emptyBook });
      await loadBooks();
      setMobilePane('library');
    } catch (err) {
      setError(err.message || '世界书没有删除成功');
    } finally {
      setBusy(false);
    }
  };

  const saveEntry = async () => {
    if (!selectedBook) return setError('先保存这本世界书，再添加内容。');
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
      setEntryDraft({ ...emptyEntry });
      await loadBooks(selectedBook.id);
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
      if (entryDraft.id === entry.id) setEntryDraft({ ...emptyEntry });
      await loadBooks(selectedBook?.id);
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
    const response = await apiFetch(`${BACKEND}/lorebooks/import`, { method: 'POST', body: form });
    const data = await readJson(response);
    if (!response.ok) throw new Error(data.error || `${file.name} 没有导入成功`);
    if (!importEnabled && data.id) {
      const patchResponse = await apiFetch(`${BACKEND}/lorebooks/${data.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: false }),
      });
      if (!patchResponse.ok) throw new Error(`${file.name} 已导入，但关闭状态没有保存成功`);
    }
    return { created: data.id ? 1 : 0, skipped: 0, preferredId: data.id || null };
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
          preferredId: collectionData.created?.[0]?.id || null,
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
    let preferredId = null;
    try {
      for (const file of files) {
        const result = await importOneFile(file);
        created += result.created;
        skipped += result.skipped;
        preferredId = preferredId || result.preferredId;
      }
      await loadBooks(preferredId);
      setUploadOpen(false);
      setAddMenuOpen(false);
      setNotice(`导入完成：新增 ${created} 本${skipped ? `，跳过 ${skipped} 本重复内容` : ''}。`);
      setMobilePane('library');
    } catch (err) {
      setError(err.message || '世界书没有导入成功');
      await loadBooks(preferredId);
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
                  <button type="button" onClick={startNewBook}><b>手动创建</b><small>自己写名称和正文</small></button>
                  <button type="button" onClick={() => { setUploadOpen(true); setAddMenuOpen(false); setMobilePane('library'); }}><b>上传文件</b><small>JSON / DOCX / TXT / MD，可多选</small></button>
                </div>
              )}
            </header>

            {error && <div className="worldbook-error">{error}</div>}
            {notice && <div className="worldbook-notice">{notice}</div>}

            <nav className="worldbook-mobile-tabs" aria-label="世界书页面">
              <button type="button" className={mobilePane === 'library' ? 'is-active' : ''} onClick={() => setMobilePane('library')}>书架 <b>{books.length}</b></button>
              <button type="button" className={mobilePane === 'detail' ? 'is-active' : ''} onClick={() => setMobilePane('detail')}>详情</button>
            </nav>

            <div className="worldbook-body">
              <aside className={`worldbook-sidebar ${mobilePane !== 'library' ? 'is-mobile-hidden' : ''}`}>
                {uploadOpen && (
                  <section className="worldbook-upload-panel">
                    <div className="worldbook-upload-title"><strong>上传世界书</strong><button type="button" onClick={() => setUploadOpen(false)}>×</button></div>
                    <label><span>使用位置</span><select value={importScope} onChange={event => setImportScope(event.target.value)}>{scopeOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                    <label className="worldbook-switch-row"><span>导入后立即启用</span><input type="checkbox" checked={importEnabled} onChange={event => setImportEnabled(event.target.checked)} /></label>
                    <button className="worldbook-upload-button" type="button" disabled={busy} onClick={() => fileInputRef.current?.click()}>{busy ? '正在整理…' : '选择文件'}</button>
                    <input ref={fileInputRef} type="file" hidden multiple accept=".json,.docx,.txt,.md,application/json,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={event => importFiles(event.target.files)} />
                    <small>合集 DOCX 会自动拆成多本；普通文件会各自成为一本世界书。默认关闭更安全，确认后再启用即可。</small>
                  </section>
                )}

                <div className="worldbook-list">
                  {books.map(book => (
                    <button key={book.id} type="button" className={String(selectedId) === String(book.id) ? 'is-selected' : ''} onClick={() => chooseBook(book)}>
                      <span>
                        <strong>{book.name || '未命名世界书'}</strong>
                        <small>{book.enabled ? `已启用 · ${scopeLabel(book)}` : '未启用'}</small>
                      </span>
                      <i className={book.enabled ? 'is-on' : ''} aria-label={book.enabled ? '已启用' : '未启用'} />
                    </button>
                  ))}
                  {!loading && books.length === 0 && <div className="worldbook-empty">书架还是空的。点右上角 ＋ 添加第一本。</div>}
                  {loading && <div className="worldbook-empty">正在整理书架…</div>}
                </div>
              </aside>

              <main className={`worldbook-editor ${mobilePane !== 'detail' ? 'is-mobile-hidden' : ''}`}>
                {(selectedBook || !bookDraft.id) ? (
                  <>
                    <section className="worldbook-book-editor">
                      <div className="worldbook-section-title">
                        <div><span>{bookDraft.id ? 'WORLD BOOK' : 'NEW WORLD BOOK'}</span><h3>{bookDraft.id ? bookDraft.name || '未命名世界书' : '新建世界书'}</h3></div>
                        {bookDraft.id && <button className="is-danger" type="button" disabled={busy} onClick={() => deleteBook(selectedBook)}>删除</button>}
                      </div>

                      <label><span>名称</span><input value={bookDraft.name} maxLength={120} onChange={event => setBookDraft(value => ({ ...value, name: event.target.value }))} placeholder="例如：一颗透明的心" /></label>
                      <label><span>简介（可选）</span><textarea className="worldbook-description" value={bookDraft.description} maxLength={2000} onChange={event => setBookDraft(value => ({ ...value, description: event.target.value }))} placeholder="简单写它负责什么" /></label>
                      <div className="worldbook-simple-fields">
                        <label><span>使用位置</span><select value={bookDraft.apply_scope} onChange={event => setBookDraft(value => ({ ...value, apply_scope: event.target.value }))}>{scopeOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                        <label className="worldbook-switch-row"><span>启用</span><input type="checkbox" checked={bookDraft.enabled} onChange={event => setBookDraft(value => ({ ...value, enabled: event.target.checked }))} /></label>
                      </div>
                      <div className="worldbook-book-actions">
                        <button className="is-primary" type="button" disabled={busy} onClick={saveBook}>{busy ? '保存中…' : '保存世界书'}</button>
                        {selectedBook && <button type="button" disabled={busy} onClick={() => toggleBook(selectedBook)}>{selectedBook.enabled ? '停用' : '启用'}</button>}
                      </div>
                    </section>

                    {selectedBook && (
                      <section className="worldbook-entries">
                        <div className="worldbook-section-title">
                          <div><span>CONTENT</span><h3>正文</h3></div>
                          <button type="button" onClick={() => setEntryDraft({ ...emptyEntry })}>＋ 添加</button>
                        </div>

                        <div className="worldbook-entry-cards">
                          {(selectedBook.entries || []).map(entry => (
                            <article key={entry.id} className={entry.enabled === false ? 'is-disabled' : ''}>
                              <header><div><strong>{entry.name || '完整设定'}</strong><small>{entry.constant ? '常驻' : `${(entry.keys || []).slice(0, 3).join(' · ') || '关键词触发'}`}</small></div><input type="checkbox" checked={entry.enabled !== false} aria-label="启用这段内容" onChange={() => patchEntry(entry, { enabled: entry.enabled === false })} /></header>
                              <p>{entry.content}</p>
                              <footer><button type="button" onClick={() => setEntryDraft(entryToDraft(entry))}>修改</button><button className="is-danger" type="button" onClick={() => deleteEntry(entry)}>删除</button></footer>
                            </article>
                          ))}
                          {(selectedBook.entries || []).length === 0 && <div className="worldbook-empty">还没有正文，下面添加一段即可。</div>}
                        </div>

                        <div className="worldbook-entry-editor">
                          <label><span>这一段的名称</span><input value={entryDraft.name} onChange={event => setEntryDraft(value => ({ ...value, name: event.target.value }))} placeholder="完整设定" /></label>
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

                          <div className="worldbook-entry-options">
                            {entryDraft.id && <button type="button" onClick={() => setEntryDraft({ ...emptyEntry })}>取消修改</button>}
                            <button type="button" disabled={busy} onClick={saveEntry}>{entryDraft.id ? '保存修改' : '加入正文'}</button>
                          </div>
                        </div>
                      </section>
                    )}
                  </>
                ) : <div className="worldbook-empty">从左边选一本世界书，或者点右上角 ＋。</div>}
              </main>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

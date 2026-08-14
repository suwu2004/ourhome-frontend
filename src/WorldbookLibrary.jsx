import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch, BACKEND } from './api.js';
import { useDialogLayer } from './useDialogLayer.js';
import './WorldbookLibrary.css';

const scopeOptions = [
  { value: 'theater', label: '仅小剧场' },
  { value: 'chat', label: '仅 Chat' },
  { value: 'both', label: '两边都用' },
];

const emptyBook = {
  id: null,
  name: '',
  description: '',
  enabled: true,
  apply_scope: 'theater',
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
  constant: false,
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
  if (!book) return emptyBook;
  return {
    id: book.id,
    name: book.name || '',
    description: book.description || '',
    enabled: book.enabled !== false,
    apply_scope: book.apply_scope || 'theater',
    target_book_id: book.target_book_id || '',
    scan_depth: Number(book.scan_depth) || 12,
    token_budget: Number(book.token_budget) || 2000,
    recursive_scanning: Boolean(book.recursive_scanning),
  };
}

function entryToDraft(entry) {
  if (!entry) return emptyEntry;
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

export default function WorldbookLibrary() {
  const [open, setOpen] = useState(false);
  const [books, setBooks] = useState([]);
  const [theaterBooks, setTheaterBooks] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [bookDraft, setBookDraft] = useState(emptyBook);
  const [entryDraft, setEntryDraft] = useState(emptyEntry);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [mobilePane, setMobilePane] = useState('library');
  const [importScope, setImportScope] = useState('theater');
  const [importTarget, setImportTarget] = useState('');
  const fileInputRef = useRef(null);
  const closeButtonRef = useRef(null);

  const selectedBook = useMemo(
    () => books.find(book => String(book.id) === String(selectedId)) || null,
    [books, selectedId],
  );
  const enabledCount = useMemo(() => books.filter(book => book.enabled).length, [books]);
  const entryCount = useMemo(() => books.reduce((sum, book) => sum + (book.entries?.length || 0), 0), [books]);

  const loadBooks = useCallback(async (preferredId = null) => {
    setLoading(true);
    setError('');
    try {
      const [loreResponse, theaterResponse] = await Promise.all([
        apiFetch(`${BACKEND}/lorebooks`),
        apiFetch(`${BACKEND}/theater/books`),
      ]);
      const loreData = await readJson(loreResponse);
      const theaterData = await readJson(theaterResponse);
      if (!loreResponse.ok) throw new Error(loreData.error || '世界书库没有打开');
      const nextBooks = Array.isArray(loreData) ? loreData : [];
      setBooks(nextBooks);
      setLoaded(true);
      if (theaterResponse.ok) setTheaterBooks(Array.isArray(theaterData) ? theaterData : []);
      const nextId = preferredId || selectedId || nextBooks[0]?.id || null;
      setSelectedId(nextId);
      setBookDraft(bookToDraft(nextBooks.find(book => String(book.id) === String(nextId))));
      setEntryDraft(emptyEntry);
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
    setEntryDraft(emptyEntry);
    setError('');
    setMobilePane('detail');
  };

  const startNewBook = () => {
    setSelectedId(null);
    setBookDraft(emptyBook);
    setEntryDraft(emptyEntry);
    setError('');
    setMobilePane('detail');
  };

  const saveBook = async () => {
    if (!bookDraft.name.trim()) return setError('先给世界书取一个名字。');
    setBusy(true);
    setError('');
    try {
      const response = await apiFetch(`${BACKEND}/lorebooks${bookDraft.id ? `/${bookDraft.id}` : ''}`, {
        method: bookDraft.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: bookDraft.name.trim(),
          description: bookDraft.description.trim(),
          enabled: bookDraft.enabled,
          apply_scope: bookDraft.target_book_id ? 'theater' : bookDraft.apply_scope,
          target_book_id: bookDraft.target_book_id || null,
          scan_depth: Number(bookDraft.scan_depth),
          token_budget: Number(bookDraft.token_budget),
          recursive_scanning: bookDraft.recursive_scanning,
        }),
      });
      const data = await readJson(response);
      if (!response.ok) throw new Error(data.error || '世界书没有保存成功');
      await loadBooks(data.id || bookDraft.id);
    } catch (err) {
      setError(err.message || '世界书没有保存成功');
    } finally {
      setBusy(false);
    }
  };

  const toggleBook = async book => {
    setBusy(true);
    setError('');
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
    if (!window.confirm(`删除世界书《${book.name}》和里面的全部条目吗？`)) return;
    setBusy(true);
    setError('');
    try {
      const response = await apiFetch(`${BACKEND}/lorebooks/${book.id}`, { method: 'DELETE' });
      const data = await readJson(response);
      if (!response.ok) throw new Error(data.error || '世界书没有删除成功');
      setSelectedId(null);
      await loadBooks();
    } catch (err) {
      setError(err.message || '世界书没有删除成功');
    } finally {
      setBusy(false);
    }
  };

  const saveEntry = async () => {
    if (!selectedBook) return setError('先保存或选择一本世界书。');
    if (!entryDraft.content.trim()) return setError('世界书条目的正文还没有写。');
    if (!entryDraft.constant && splitKeys(entryDraft.keys_text).length === 0) return setError('填写触发词，或者把这条设为常驻。');
    setBusy(true);
    setError('');
    try {
      const response = await apiFetch(
        entryDraft.id ? `${BACKEND}/lorebook-entries/${entryDraft.id}` : `${BACKEND}/lorebooks/${selectedBook.id}/entries`,
        {
          method: entryDraft.id ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: entryDraft.name.trim() || '未命名条目',
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
      if (!response.ok) throw new Error(data.error || '世界书条目没有保存成功');
      setEntryDraft(emptyEntry);
      await loadBooks(selectedBook.id);
    } catch (err) {
      setError(err.message || '世界书条目没有保存成功');
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
      if (!response.ok) throw new Error(data.error || '条目状态没有保存成功');
      await loadBooks(selectedBook?.id);
    } catch (err) {
      setError(err.message || '条目状态没有保存成功');
    } finally {
      setBusy(false);
    }
  };

  const deleteEntry = async entry => {
    if (!window.confirm(`删除条目《${entry.name || '未命名条目'}》吗？`)) return;
    setBusy(true);
    try {
      const response = await apiFetch(`${BACKEND}/lorebook-entries/${entry.id}`, { method: 'DELETE' });
      const data = await readJson(response);
      if (!response.ok) throw new Error(data.error || '条目没有删除成功');
      if (entryDraft.id === entry.id) setEntryDraft(emptyEntry);
      await loadBooks(selectedBook?.id);
    } catch (err) {
      setError(err.message || '条目没有删除成功');
    } finally {
      setBusy(false);
    }
  };

  const importFile = async file => {
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('apply_scope', importTarget ? 'theater' : importScope);
      if (importTarget) form.append('target_book_id', importTarget);
      const response = await apiFetch(`${BACKEND}/lorebooks/import`, { method: 'POST', body: form });
      const data = await readJson(response);
      if (!response.ok) throw new Error(data.error || '这份世界书没有导入成功');
      await loadBooks(data.id);
    } catch (err) {
      setError(err.message || '这份世界书没有导入成功');
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const exportBook = async book => {
    setBusy(true);
    setError('');
    try {
      const response = await apiFetch(`${BACKEND}/lorebooks/${book.id}/export`);
      if (!response.ok) {
        const data = await readJson(response);
        throw new Error(data.error || '世界书没有导出成功');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${book.name || 'worldbook'}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message || '世界书没有导出成功');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button className="worldbook-library-trigger knowledge-library-trigger knowledge-library-trigger--world" type="button" onClick={() => setOpen(true)}>
        <span className="knowledge-library-trigger__icon" aria-hidden="true">界</span>
        <span className="knowledge-library-trigger__copy"><strong>世界书</strong><small>人物、地点、背景与关键词唤醒知识</small></span>
        <span className="knowledge-library-trigger__meta">{loaded ? `${enabledCount} 本启用` : '打开书架'}</span>
        <span className="knowledge-library-trigger__arrow" aria-hidden="true">›</span>
      </button>

      {open && (
        <div className="worldbook-layer" role="presentation" onMouseDown={event => {
          if (event.target === event.currentTarget) closeLibrary();
        }}>
          <section className="worldbook-library" role="dialog" aria-modal="true" aria-label="世界书库">
            <header className="worldbook-head">
              <div>
                <span>OURHOME LOREBOOKS</span>
                <h2>世界书库</h2>
                <p>书架里每一本都是一个设定文件夹；进入一本书后，设置和内容都放在同一页。</p>
              </div>
              <button ref={closeButtonRef} type="button" onClick={closeLibrary} aria-label="关闭世界书库">×</button>
            </header>

            <div className="worldbook-summary">
              <span><b>{books.length}</b> 本世界书</span>
              <span><b>{enabledCount}</b> 本启用</span>
              <span><b>{entryCount}</b> 个条目</span>
              <button type="button" onClick={() => loadBooks(selectedId)} disabled={loading || busy}>{loading ? '整理中' : '刷新'}</button>
            </div>
            {error && <div className="worldbook-error">{error}</div>}

            <nav className="worldbook-mobile-tabs" aria-label="世界书库页面">
              <button type="button" className={mobilePane === 'library' ? 'is-active' : ''} onClick={() => setMobilePane('library')}>书架 <b>{books.length}</b></button>
              <button type="button" className={mobilePane === 'detail' ? 'is-active' : ''} onClick={() => setMobilePane('detail')}>{bookDraft.id ? '当前世界书' : '新建世界书'} <b>{selectedBook?.entries?.length || 0}</b></button>
            </nav>

            <div className="worldbook-body">
              <aside className={`worldbook-sidebar ${mobilePane !== 'library' ? 'is-mobile-hidden' : ''}`}>
                <button className="worldbook-new" type="button" onClick={startNewBook}>＋ 新建世界书</button>
                <div className="worldbook-import">
                  <strong>导入兼容世界书</strong>
                  <select value={importScope} onChange={event => setImportScope(event.target.value)} disabled={Boolean(importTarget)}>
                    {scopeOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                  <select value={importTarget} onChange={event => setImportTarget(event.target.value)}>
                    <option value="">不绑定某本小剧场</option>
                    {theaterBooks.map(book => <option key={book.id} value={book.id}>绑定《{book.title}》</option>)}
                  </select>
                  <input
                    ref={fileInputRef}
                    hidden
                    type="file"
                    accept=".json,.docx,.txt,.md,application/json,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown"
                    onChange={event => importFile(event.target.files?.[0])}
                  />
                  <button type="button" onClick={() => fileInputRef.current?.click()} disabled={busy}>上传 JSON / Word / 文本</button>
                  <small>兼容 Lorebook V3、Character Card V2/V3、SillyTavern/Risu 常见字段；暂不执行导入文件里的脚本。</small>
                </div>
                <div className="worldbook-list">
                  {loading && books.length === 0 && <div className="worldbook-empty">正在翻世界书…</div>}
                  {!loading && books.length === 0 && <div className="worldbook-empty">这里还是空的，可以新建，也可以直接导入一份。</div>}
                  {books.map(book => (
                    <button key={book.id} type="button" className={String(book.id) === String(selectedId) ? 'is-selected' : ''} onClick={() => chooseBook(book)}>
                      <span><strong>{book.name}</strong><small>{book.entries?.length || 0} 条 · {scopeOptions.find(option => option.value === book.apply_scope)?.label || '仅小剧场'}</small></span>
                      <i className={book.enabled ? 'is-on' : ''} />
                    </button>
                  ))}
                </div>
              </aside>

              <main className="worldbook-editor">
                <section className={`worldbook-book-editor ${mobilePane !== 'detail' ? 'is-mobile-hidden' : ''}`}>
                  <div className="worldbook-section-title">
                    <div><span>{bookDraft.id ? 'BOOK SETTINGS' : 'NEW LOREBOOK'}</span><h3>{bookDraft.id ? '世界书设置' : '新建世界书'}</h3></div>
                    {selectedBook && <div><button type="button" onClick={() => toggleBook(selectedBook)} disabled={busy}>{selectedBook.enabled ? '停用' : '启用'}</button><button className="is-danger" type="button" onClick={() => deleteBook(selectedBook)} disabled={busy}>删除</button></div>}
                  </div>
                  <label><span>名称</span><input value={bookDraft.name} maxLength={120} onChange={event => setBookDraft(current => ({ ...current, name: event.target.value }))} placeholder="例如：陆宅、城南世界、共同生活设定" /></label>
                  <label><span>说明</span><input value={bookDraft.description} maxLength={2000} onChange={event => setBookDraft(current => ({ ...current, description: event.target.value }))} placeholder="这本世界书收着什么" /></label>
                  <div className="worldbook-grid-fields">
                    <label><span>生效范围</span><select value={bookDraft.target_book_id ? 'theater' : bookDraft.apply_scope} disabled={Boolean(bookDraft.target_book_id)} onChange={event => setBookDraft(current => ({ ...current, apply_scope: event.target.value }))}>{scopeOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                    <label><span>绑定小剧场</span><select value={bookDraft.target_book_id} onChange={event => setBookDraft(current => ({ ...current, target_book_id: event.target.value }))}><option value="">不单独绑定</option>{theaterBooks.map(book => <option key={book.id} value={book.id}>《{book.title}》</option>)}</select></label>
                    <label><span>扫描最近消息</span><input type="number" min="1" max="100" value={bookDraft.scan_depth} onChange={event => setBookDraft(current => ({ ...current, scan_depth: event.target.value }))} /></label>
                    <label><span>单轮预算</span><input type="number" min="128" max="12000" step="128" value={bookDraft.token_budget} onChange={event => setBookDraft(current => ({ ...current, token_budget: event.target.value }))} /></label>
                  </div>
                  <div className="worldbook-book-actions">
                    <label title="一条设定被唤醒后，可以用它的内容继续寻找关联设定，最多继续两轮。"><input type="checkbox" checked={bookDraft.recursive_scanning} onChange={event => setBookDraft(current => ({ ...current, recursive_scanning: event.target.checked }))} />允许关联设定继续唤醒</label>
                    <div>{selectedBook && <button type="button" title="导出兼容 Lorebook V3 的 JSON 文件，用来备份或迁移。" onClick={() => exportBook(selectedBook)} disabled={busy}>导出备份</button>}<button className="is-primary" type="button" onClick={saveBook} disabled={busy}>{busy ? '保存中' : bookDraft.id ? '保存设置' : '创建世界书'}</button></div>
                  </div>
                  <small className="worldbook-book-help">关联唤醒最多继续两轮；导出的 JSON 是兼容 Lorebook V3 的备份文件。</small>
                </section>

                {selectedBook && (
                  <section className={`worldbook-entries ${mobilePane !== 'detail' ? 'is-mobile-hidden' : ''}`}>
                    <div className="worldbook-section-title"><div><span>BOOK CONTENT</span><h3>设定内容</h3></div><button type="button" onClick={() => { setEntryDraft(emptyEntry); setMobilePane('detail'); }}>＋ 添加设定</button></div>
                    <div className="worldbook-entry-cards">
                      {(selectedBook.entries || []).length === 0 && <div className="worldbook-empty">这本书还没有设定。常驻内容一直生效，普通内容会在聊到关键词时自动出现。</div>}
                      {(selectedBook.entries || []).map(entry => (
                        <article key={entry.id} className={entry.enabled ? '' : 'is-disabled'}>
                          <header><div><strong>{entry.name || '未命名条目'}</strong><small>{entry.constant ? '常驻' : (entry.keys || []).join('、') || '无触发词'} · 优先级 {entry.priority || 0}</small></div><button type="button" onClick={() => patchEntry(entry, { enabled: !entry.enabled })}>{entry.enabled ? '启用' : '停用'}</button></header>
                          <p>{entry.content}</p>
                          <footer><button type="button" onClick={() => { setEntryDraft(entryToDraft(entry)); setMobilePane('detail'); }}>编辑</button><button className="is-danger" type="button" onClick={() => deleteEntry(entry)}>删除</button></footer>
                        </article>
                      ))}
                    </div>

                    <div className="worldbook-entry-editor">
                      <div className="worldbook-section-title"><div><span>{entryDraft.id ? 'EDIT ENTRY' : 'NEW ENTRY'}</span><h3>{entryDraft.id ? '修改设定' : '添加设定'}</h3></div>{entryDraft.id && <button type="button" onClick={() => setEntryDraft(emptyEntry)}>取消编辑</button>}</div>
                      <label><span>设定名称</span><input value={entryDraft.name} maxLength={120} onChange={event => setEntryDraft(current => ({ ...current, name: event.target.value }))} /></label>
                      <label><span>正文</span><textarea rows={7} maxLength={40000} value={entryDraft.content} onChange={event => setEntryDraft(current => ({ ...current, content: event.target.value }))} placeholder="模型真正会读到的设定内容" /></label>
                      <div className="worldbook-grid-fields">
                        <label><span>主要触发词</span><input value={entryDraft.keys_text} onChange={event => setEntryDraft(current => ({ ...current, keys_text: event.target.value }))} placeholder="用逗号分隔" /></label>
                        <label><span>次要触发词</span><input value={entryDraft.secondary_text} onChange={event => setEntryDraft(current => ({ ...current, secondary_text: event.target.value }))} placeholder="选择性匹配时使用" /></label>
                        <label><span>优先级</span><input type="number" value={entryDraft.priority} onChange={event => setEntryDraft(current => ({ ...current, priority: event.target.value }))} /></label>
                        <label><span>插入顺序</span><input type="number" value={entryDraft.insertion_order} onChange={event => setEntryDraft(current => ({ ...current, insertion_order: event.target.value }))} /></label>
                      </div>
                      <div className="worldbook-entry-options">
                        <label><input type="checkbox" checked={entryDraft.constant} onChange={event => setEntryDraft(current => ({ ...current, constant: event.target.checked }))} />常驻</label>
                        <label><input type="checkbox" checked={entryDraft.selective} onChange={event => setEntryDraft(current => ({ ...current, selective: event.target.checked }))} />主要词与次要词共同命中</label>
                        <label><input type="checkbox" checked={entryDraft.use_regex} onChange={event => setEntryDraft(current => ({ ...current, use_regex: event.target.checked }))} />安全正则</label>
                        <button type="button" onClick={saveEntry} disabled={busy}>{busy ? '保存中' : entryDraft.id ? '保存设定' : '保存到这本书'}</button>
                      </div>
                    </div>
                  </section>
                )}
              </main>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

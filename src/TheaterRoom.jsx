import { useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch, BACKEND } from './api.js';

const emptySettings = {
  premise: '',
  characters: '',
  rules: '',
};

const importStarter = `剧场名：

世界观：

人设 / 角色关系：

禁区 / 写作规则：
`;

const theaterImportSections = [
  ['title', /^(?:#+\s*)?(?:剧场名|小剧场名|书名|标题|世界名|世界名称)\s*[：:]\s*(.*)$/i],
  ['premise', /^(?:#+\s*)?(?:世界观|背景|剧情设定|故事设定|世界设定|故事背景|设定)\s*[：:]?\s*(.*)$/i],
  ['characters', /^(?:#+\s*)?(?:人设|人物设定|角色卡|角色|角色关系|关系|人物关系|cp|主角)\s*[：:]?\s*(.*)$/i],
  ['rules', /^(?:#+\s*)?(?:禁区|避雷|规则|写作规则|注意事项|不能|不要|防ooc|防 OOC|ooc)\s*[：:]?\s*(.*)$/i],
];

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${month}/${day} ${hour}:${minute}`;
}

function Field({ label, hint, value, onChange, rows = 4, placeholder, theme }) {
  return (
    <label style={{ display: 'block' }}>
      <span style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
        <b style={{ color: theme.text, fontSize: 13, letterSpacing: '.06em' }}>{label}</b>
        {hint && <small style={{ color: theme.mutedLight, fontSize: 10 }}>{hint}</small>}
      </span>
      <textarea
        value={value}
        rows={rows}
        onChange={event => onChange(event.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%',
          minHeight: rows * 26,
          resize: 'vertical',
          border: `1.5px solid ${theme.border}`,
          borderRadius: 12,
          background: theme.surface,
          color: theme.text,
          padding: '10px 11px',
          outline: 'none',
          fontFamily: 'inherit',
          fontSize: 13,
          lineHeight: 1.65,
          boxSizing: 'border-box',
        }}
      />
    </label>
  );
}

function makeBookDraft(title = '未命名小剧本') {
  return { title, settings: { ...emptySettings } };
}

function appendSection(target, key, value) {
  const text = String(value || '').trim();
  if (!text) return;
  target[key] = [target[key], text].filter(Boolean).join('\n').trim();
}

function parseTheaterImport(rawText) {
  const text = String(rawText || '').replace(/\r\n/g, '\n').trim();
  const draft = makeBookDraft('导入的小世界');
  if (!text) return draft;

  const buckets = { premise: '', characters: '', rules: '' };
  let current = 'premise';
  const lines = text.split('\n');

  lines.forEach(line => {
    const trimmed = line.trim();
    const matched = theaterImportSections.find(([, pattern]) => pattern.test(trimmed));
    if (matched) {
      const [section, pattern] = matched;
      const inline = trimmed.match(pattern)?.[1]?.trim() || '';
      if (section === 'title') {
        if (inline) draft.title = inline.slice(0, 80);
        current = 'premise';
      } else {
        current = section;
        appendSection(buckets, current, inline);
      }
      return;
    }
    appendSection(buckets, current, line);
  });

  const headingTitle = text.match(/^#\s+(.+)$/m)?.[1]?.trim();
  if (draft.title === '导入的小世界' && headingTitle) draft.title = headingTitle.slice(0, 80);

  draft.settings = {
    premise: buckets.premise.trim(),
    characters: buckets.characters.trim(),
    rules: buckets.rules.trim(),
  };
  if (!draft.settings.premise && !draft.settings.characters && !draft.settings.rules) {
    draft.settings.premise = text;
  }
  return draft;
}

export function TheaterRoom({ visible, theme, leaveRoom, selectedModel, availableModels = [] }) {
  const C = theme;
  const [books, setBooks] = useState([]);
  const [selectedBookId, setSelectedBookId] = useState(null);
  const [bookDraft, setBookDraft] = useState(makeBookDraft());
  const [loadingBooks, setLoadingBooks] = useState(false);
  const [savingBook, setSavingBook] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatting, setChatting] = useState(false);
  const [error, setError] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importPreview, setImportPreview] = useState(makeBookDraft('导入的小世界'));
  const [importingWorld, setImportingWorld] = useState(false);
  const [importingFile, setImportingFile] = useState(false);
  const [mode, setMode] = useState('interactive');
  const [lengthMode, setLengthMode] = useState('long');
  const [model, setModel] = useState(selectedModel || '');
  const chatEndRef = useRef(null);
  const worldFileInputRef = useRef(null);

  const selectedBook = useMemo(
    () => books.find(book => String(book.id) === String(selectedBookId)) || null,
    [books, selectedBookId],
  );

  const modelOptions = useMemo(
    () => [...new Set([model, selectedModel, ...availableModels].map(item => String(item || '').trim()).filter(Boolean))],
    [availableModels, model, selectedModel],
  );

  useEffect(() => {
    if (selectedModel) setModel(selectedModel);
  }, [selectedModel]);

  useEffect(() => {
    if (visible) loadBooks();
  }, [visible]);

  useEffect(() => {
    if (!selectedBook) return;
    setBookDraft({
      title: selectedBook.title || '未命名小剧本',
      settings: { ...emptySettings, ...(selectedBook.settings || {}) },
    });
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 80);
  }, [selectedBook?.id]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [selectedBook?.messages?.length, chatting]);

  const loadBooks = async () => {
    setLoadingBooks(true);
    setError('');
    try {
      const response = await apiFetch(`${BACKEND}/theater/books`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '剧场书架没有打开');
      setBooks(Array.isArray(data) ? data : []);
      if (selectedBookId && !data.some(book => String(book.id) === String(selectedBookId))) {
        setSelectedBookId(null);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingBooks(false);
    }
  };

  const createBook = async () => {
    setSavingBook(true);
    setError('');
    try {
      const response = await apiFetch(`${BACKEND}/theater/books`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(makeBookDraft(`小世界 ${books.length + 1}`)),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '小世界没有创建成功');
      setBooks(items => [data, ...items]);
      setSelectedBookId(data.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingBook(false);
    }
  };

  const updateImportText = value => {
    setImportText(value);
    setImportPreview(parseTheaterImport(value));
  };

  const openImportPanel = () => {
    setError('');
    setImportOpen(true);
    if (!importText.trim()) updateImportText(importStarter);
  };

  const importWorld = async () => {
    const draft = parseTheaterImport(importText);
    if (!draft.settings.premise.trim() && !draft.settings.characters.trim() && !draft.settings.rules.trim()) {
      setError('先把世界观、人设或者规则贴进来。');
      return;
    }
    setImportingWorld(true);
    setError('');
    try {
      const response = await apiFetch(`${BACKEND}/theater/books`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '这个小世界没有导入成功');
      setBooks(items => [data, ...items]);
      setSelectedBookId(data.id);
      setImportOpen(false);
      setImportText('');
      setImportPreview(makeBookDraft('导入的小世界'));
    } catch (err) {
      setError(err.message);
    } finally {
      setImportingWorld(false);
    }
  };

  const importWorldFile = async file => {
    if (!file) return;
    setImportingFile(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await apiFetch(`${BACKEND}/theater/import-world`, { method: 'POST', body: formData });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '世界书没有导入成功');
      setBooks(items => [data, ...items]);
      setSelectedBookId(data.id);
      setImportOpen(false);
      setImportText('');
      setImportPreview(makeBookDraft('导入的小世界'));
    } catch (err) {
      setError(err.message);
    } finally {
      setImportingFile(false);
      if (worldFileInputRef.current) worldFileInputRef.current.value = '';
    }
  };

  const saveBook = async () => {
    if (!selectedBook) return;
    setSavingBook(true);
    setError('');
    try {
      const response = await apiFetch(`${BACKEND}/theater/books/${selectedBook.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bookDraft),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '设定没有保存成功');
      setBooks(items => items.map(book => (book.id === data.id ? { ...book, ...data, messages: book.messages || [] } : book)));
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingBook(false);
    }
  };

  const deleteBook = async book => {
    if (!window.confirm(`删除《${book.title || '未命名小剧本'}》和里面的互动记录吗？`)) return;
    setError('');
    try {
      const response = await apiFetch(`${BACKEND}/theater/books/${book.id}`, { method: 'DELETE' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || '删除失败');
      setBooks(items => items.filter(item => item.id !== book.id));
      if (String(selectedBookId) === String(book.id)) setSelectedBookId(null);
    } catch (err) {
      setError(err.message);
    }
  };

  const patchDraftSettings = patch => {
    setBookDraft(current => ({
      ...current,
      settings: { ...current.settings, ...patch },
    }));
  };

  const sendChat = async (overrideText = null) => {
    const text = (overrideText ?? chatInput).trim();
    if (!selectedBook) return;
    if (!text) {
      setError('先在小剧场里说一句。');
      return;
    }
    setChatting(true);
    setError('');
    setChatInput('');
    try {
      const response = await apiFetch(`${BACKEND}/theater/books/${selectedBook.id}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          play_mode: mode,
          length_mode: lengthMode,
          model,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '小剧场这次没有接上');
      setBooks(items => items.map(book => {
        if (String(book.id) !== String(selectedBook.id)) return book;
        return {
          ...book,
          messages: [
            ...(book.messages || []),
            data.user_message,
            { ...data.assistant_message, choices: data.choices || [] },
          ].filter(Boolean),
          message_count: (book.message_count || 0) + 2,
          last_message_at: data.assistant_message?.created_at || new Date().toISOString(),
        };
      }));
    } catch (err) {
      setError(err.message);
      setChatInput(text);
    } finally {
      setChatting(false);
    }
  };

  const goBackToShelf = () => {
    setSelectedBookId(null);
    setError('');
  };

  const renderShelf = () => (
    <main style={{ flex: 1, overflowY: 'auto', padding: '18px min(18px, 4vw) 28px' }}>
      <section style={{ maxWidth: 920, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div>
            <div style={{ color: C.text, fontSize: 20, fontWeight: 700 }}>剧场书架</div>
            <div style={{ color: C.mutedLight, fontSize: 11, letterSpacing: '.12em', marginTop: 3 }}>每一本书，都是一个小世界。</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button type="button" onClick={openImportPanel} style={{ border: `1px solid ${C.honeyMid}`, borderRadius: 999, background: C.honeyLight, color: C.honeyDeep, padding: '10px 13px', fontFamily: 'inherit', cursor: 'pointer' }}>导入世界</button>
            <button type="button" onClick={createBook} disabled={savingBook} style={{ border: 'none', borderRadius: 999, background: `linear-gradient(145deg, ${C.honey}, ${C.honeyDeep})`, color: C.white, padding: '10px 15px', fontFamily: 'inherit', cursor: savingBook ? 'default' : 'pointer', opacity: savingBook ? .65 : 1 }}>＋ 新书</button>
          </div>
        </div>
        {error && <div style={{ marginBottom: 12, color: C.blushDeep, fontSize: 12 }}>{error}</div>}
        {importOpen && (
          <section style={{ border: `1px solid ${C.border}`, borderRadius: 16, background: C.white, padding: 14, marginBottom: 16, boxShadow: `0 10px 26px ${C.borderLight}66` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
              <div>
                <div style={{ color: C.text, fontWeight: 700 }}>一键导入小世界</div>
                <div style={{ color: C.mutedLight, fontSize: 10.5, marginTop: 3 }}>把世界观、人设、关系和禁区整段贴进来，也可以上传 .docx 世界书，不会额外花 API 额度。</div>
              </div>
              <button type="button" onClick={() => setImportOpen(false)} style={{ border: 'none', background: 'transparent', color: C.muted, fontFamily: 'inherit', cursor: 'pointer' }}>收起</button>
            </div>
            <textarea
              value={importText}
              onChange={event => updateImportText(event.target.value)}
              rows={8}
              placeholder="可以直接贴：剧场名、世界观、人设、关系、禁区、写作规则……"
              style={{ width: '100%', boxSizing: 'border-box', border: `1.5px solid ${C.border}`, borderRadius: 13, background: C.surface, color: C.text, padding: '10px 11px', outline: 'none', resize: 'vertical', fontFamily: 'inherit', fontSize: 13, lineHeight: 1.65 }}
            />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8, marginTop: 10 }}>
              {[
                ['书名', importPreview.title],
                ['世界观', importPreview.settings.premise ? `${importPreview.settings.premise.length} 字` : '未识别'],
                ['人设', importPreview.settings.characters ? `${importPreview.settings.characters.length} 字` : '未识别'],
                ['规则', importPreview.settings.rules ? `${importPreview.settings.rules.length} 字` : '未识别'],
              ].map(([label, value]) => (
                <div key={label} style={{ border: `1px solid ${C.borderLight}`, borderRadius: 12, background: C.cream, padding: '8px 9px', minWidth: 0 }}>
                  <span style={{ display: 'block', color: C.mutedLight, fontSize: 9, letterSpacing: '.12em' }}>{label}</span>
                  <b style={{ display: 'block', color: C.text, fontSize: 12, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</b>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
              <input ref={worldFileInputRef} type="file" accept=".docx,.txt,.md,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown" style={{ display: 'none' }} onChange={event => importWorldFile(event.target.files?.[0])} />
              <button type="button" onClick={() => worldFileInputRef.current?.click()} disabled={importingFile} style={{ border: `1px solid ${C.honeyMid}`, borderRadius: 999, background: C.honeyLight, color: C.honeyDeep, padding: '8px 12px', fontFamily: 'inherit', cursor: importingFile ? 'default' : 'pointer', opacity: importingFile ? .65 : 1 }}>{importingFile ? '读取中' : '上传 Word'}</button>
              <button type="button" onClick={() => updateImportText(importStarter)} style={{ border: `1px solid ${C.border}`, borderRadius: 999, background: C.surface, color: C.muted, padding: '8px 12px', fontFamily: 'inherit', cursor: 'pointer' }}>填模板</button>
              <button type="button" onClick={importWorld} disabled={importingWorld} style={{ border: 'none', borderRadius: 999, background: `linear-gradient(145deg, ${C.honey}, ${C.honeyDeep})`, color: C.white, padding: '8px 14px', fontFamily: 'inherit', cursor: importingWorld ? 'default' : 'pointer', opacity: importingWorld ? .65 : 1 }}>{importingWorld ? '导入中' : '生成一本书'}</button>
            </div>
          </section>
        )}
        {loadingBooks && <div style={{ color: C.muted, padding: '24px 0', textAlign: 'center' }}>正在整理书架…</div>}
        {!loadingBooks && books.length === 0 && (
          <button type="button" onClick={createBook} style={{ width: '100%', border: `1.5px dashed ${C.honeyMid}`, borderRadius: 16, background: C.white, color: C.honeyDeep, padding: '30px 18px', fontFamily: 'inherit', fontSize: 15, cursor: 'pointer' }}>
            还没有小剧本。点这里创建第一本书。
          </button>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(132px, 1fr))', gap: 14 }}>
          {books.map((book, index) => (
            <div key={book.id} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button
                type="button"
                onClick={() => setSelectedBookId(book.id)}
                style={{
                  minHeight: 188,
                  border: `1px solid ${C.border}`,
                  borderRadius: 12,
                  background: `linear-gradient(135deg, ${index % 3 === 0 ? '#fff8dc' : index % 3 === 1 ? '#fff0e8' : '#eef8ef'}, ${C.white})`,
                  color: C.text,
                  boxShadow: `0 12px 24px ${C.borderLight}88`,
                  padding: 14,
                  textAlign: 'left',
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <span>
                  <span style={{ display: 'block', color: C.honeyDeep, fontSize: 10, letterSpacing: '.16em', marginBottom: 8 }}>BOOK {String(index + 1).padStart(2, '0')}</span>
                  <b style={{ display: 'block', fontSize: 17, lineHeight: 1.35 }}>{book.title || '未命名小剧本'}</b>
                </span>
                <span style={{ color: C.muted, fontSize: 11, lineHeight: 1.6 }}>
                  {book.message_count ? `${book.message_count} 条互动` : '设定待填写'}
                  <br />
                  {book.last_message_at ? formatDate(book.last_message_at) : formatDate(book.created_at)}
                </span>
              </button>
              <button type="button" onClick={() => deleteBook(book)} style={{ border: 'none', background: 'transparent', color: C.muted, fontFamily: 'inherit', fontSize: 11, cursor: 'pointer' }}>删除</button>
            </div>
          ))}
        </div>
      </section>
    </main>
  );

  const renderBook = () => {
    if (!selectedBook) return null;
    const messages = selectedBook.messages || [];
    const settingsReady = bookDraft.settings.premise.trim() || bookDraft.settings.characters.trim();
    return (
      <main style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ flexShrink: 0, borderBottom: `1px solid ${C.border}`, background: C.white, padding: '12px 14px' }}>
          <div style={{ maxWidth: 960, margin: '0 auto', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 9 }}>
            <button type="button" onClick={goBackToShelf} style={{ border: 'none', background: 'transparent', color: C.honeyDeep, fontFamily: 'inherit', cursor: 'pointer' }}>← 书架</button>
            <input value={bookDraft.title} onChange={event => setBookDraft(current => ({ ...current, title: event.target.value }))} style={{ flex: '1 1 180px', minWidth: 0, border: `1px solid ${C.border}`, borderRadius: 999, background: C.surface, color: C.text, padding: '8px 12px', outline: 'none', fontFamily: 'inherit', fontSize: 14 }} />
            <button type="button" onClick={saveBook} disabled={savingBook} style={{ border: `1px solid ${C.border}`, borderRadius: 999, background: C.honeyLight, color: C.honeyDeep, padding: '8px 12px', fontFamily: 'inherit', cursor: savingBook ? 'default' : 'pointer' }}>{savingBook ? '保存中' : '保存设定'}</button>
          </div>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '14px min(16px, 4vw)' }}>
          <section style={{ maxWidth: 960, margin: '0 auto', display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: 14 }}>
            <aside style={{ flex: '1 1 290px', minWidth: 0, border: `1px solid ${C.border}`, borderRadius: 14, background: C.white, padding: 13 }}>
              <Field theme={C} label="世界观 / 剧情设定" rows={4} value={bookDraft.settings.premise} onChange={value => patchDraftSettings({ premise: value })} placeholder="这里写这个小世界的基础设定。" />
              <div style={{ height: 10 }} />
              <Field theme={C} label="角色卡 / 关系" rows={4} value={bookDraft.settings.characters} onChange={value => patchDraftSettings({ characters: value })} placeholder="人物性格、关系张力、称呼、不能崩的点。" />
              <div style={{ height: 10 }} />
              <Field theme={C} label="禁区 / 写作规则" rows={3} value={bookDraft.settings.rules} onChange={value => patchDraftSettings({ rules: value })} placeholder="不要突兀和解、不要现代词、不要跳出剧情解释……" />
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                {[
                  ['interactive', '互动'],
                  ['story', '纯文'],
                ].map(([value, label]) => (
                  <button key={value} type="button" onClick={() => setMode(value)} style={{ border: `1px solid ${mode === value ? C.honeyMid : C.border}`, background: mode === value ? C.honeyLight : C.surface, color: mode === value ? C.honeyDeep : C.muted, borderRadius: 999, padding: '7px 12px', fontFamily: 'inherit', cursor: 'pointer' }}>{label}</button>
                ))}
                {[
                  ['short', '短'],
                  ['long', '长'],
                  ['extra_long', '超长'],
                ].map(([value, label]) => (
                  <button key={value} type="button" onClick={() => setLengthMode(value)} style={{ border: `1px solid ${lengthMode === value ? C.blush : C.border}`, background: lengthMode === value ? '#FFF0E9' : C.surface, color: lengthMode === value ? C.blushDeep : C.muted, borderRadius: 999, padding: '7px 12px', fontFamily: 'inherit', cursor: 'pointer' }}>{label}</button>
                ))}
              </div>
              <select value={model} onChange={event => setModel(event.target.value)} style={{ width: '100%', marginTop: 10, border: `1px solid ${C.border}`, background: C.surface, color: C.muted, borderRadius: 999, padding: '7px 10px', fontFamily: 'inherit', fontSize: 11 }}>
                {modelOptions.length ? modelOptions.map(item => <option key={item} value={item}>{item}</option>) : <option value="">默认模型</option>}
              </select>
            </aside>

            <section style={{ flex: '2 1 360px', minWidth: 0, border: `1px solid ${C.border}`, borderRadius: 14, background: 'linear-gradient(180deg, #fffdfa, #fff8ef)', padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div>
                  <div style={{ color: C.text, fontWeight: 700 }}>{bookDraft.title || '未命名小剧本'}</div>
                  <div style={{ color: C.mutedLight, fontSize: 10, letterSpacing: '.12em' }}>{settingsReady ? '设定已准备，可以开始 chat' : '先填一点设定，再开始 chat'}</div>
                </div>
              </div>
              <div style={{ minHeight: 300, maxHeight: '54vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, padding: '4px 2px 12px' }}>
                {messages.length === 0 && (
                  <div style={{ color: C.muted, fontSize: 13, lineHeight: 1.8, padding: '30px 10px', textAlign: 'center' }}>
                    这本书还没有开演。你可以直接用聊天的方式说：从哪里开始、你扮演谁、想让剧情怎么动。
                  </div>
                )}
                {messages.map(message => (
                  <div key={message.id} style={{ alignSelf: message.role === 'user' ? 'flex-end' : 'stretch', maxWidth: message.role === 'user' ? '82%' : '100%' }}>
                    <div style={{ color: message.role === 'user' ? C.honeyDeep : C.mutedLight, fontSize: 10, marginBottom: 4, textAlign: message.role === 'user' ? 'right' : 'left' }}>{message.role === 'user' ? '你 / 导演' : '小剧场'} · {formatDate(message.created_at)}</div>
                    <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.85, fontSize: message.role === 'user' ? 13.5 : 14.5, color: C.text, background: message.role === 'user' ? C.honeyLight : C.white, border: `1px solid ${message.role === 'user' ? C.honeyMid : C.border}`, borderRadius: message.role === 'user' ? '16px 16px 4px 16px' : 13, padding: '10px 12px' }}>{message.content}</div>
                    {Array.isArray(message.choices) && message.choices.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 8 }}>
                        {message.choices.map((choice, index) => (
                          <button key={`${choice}-${index}`} type="button" onClick={() => sendChat(`选择走向 ${index + 1}：${choice}`)} disabled={chatting} style={{ textAlign: 'left', border: `1px solid ${C.border}`, borderRadius: 12, background: C.surface, color: C.text, padding: '9px 10px', fontFamily: 'inherit', cursor: chatting ? 'default' : 'pointer' }}>{index + 1}. {choice}</button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                {chatting && <div style={{ color: C.muted, fontSize: 12, padding: '4px 2px' }}>小剧场正在接戏…</div>}
                <div ref={chatEndRef} />
              </div>
              {error && <div style={{ color: C.blushDeep, fontSize: 12, marginBottom: 8 }}>{error}</div>}
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, border: `1.5px solid ${C.border}`, borderRadius: 20, background: C.surface, padding: '7px 7px 7px 10px' }}>
                <textarea value={chatInput} onChange={event => setChatInput(event.target.value)} rows={1} placeholder="在小剧场里说话、下导演指令、选择走向……" style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', color: C.text, resize: 'none', fontFamily: 'inherit', fontSize: 14, lineHeight: 1.6, padding: '5px 0' }} />
                <button type="button" onClick={() => sendChat()} disabled={chatting || !chatInput.trim()} style={{ width: 36, height: 36, border: 'none', borderRadius: '50%', background: chatInput.trim() && !chatting ? `linear-gradient(145deg, ${C.honey}, ${C.honeyDeep})` : C.honeyMid, color: C.white, fontFamily: 'inherit', cursor: chatInput.trim() && !chatting ? 'pointer' : 'default' }}>↑</button>
              </div>
            </section>
          </section>
        </div>
      </main>
    );
  };

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', opacity: visible ? 1 : 0, pointerEvents: visible ? 'auto' : 'none', transition: 'opacity .4s ease', background: C.cream }}>
      <header className="ourhome-safe-top" style={{ background: C.white, borderBottom: `1px solid ${C.border}`, paddingLeft: 16, paddingRight: 16, paddingBottom: 12, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span onClick={selectedBook ? goBackToShelf : leaveRoom} style={{ fontSize: 18, color: C.honeyDeep, cursor: 'pointer', padding: 4 }}>←</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.text, letterSpacing: '.05em' }}>{selectedBook ? selectedBook.title : '小剧场'}</div>
          <div style={{ fontSize: 10, color: C.mutedLight, letterSpacing: '.14em' }}>{selectedBook ? 'story chat' : 'theater bookshelf'}</div>
        </div>
        <button type="button" onClick={loadBooks} disabled={loadingBooks} style={{ border: `1px solid ${C.border}`, background: C.surface, color: C.honeyDeep, borderRadius: 999, padding: '6px 10px', fontFamily: 'inherit', fontSize: 11, cursor: loadingBooks ? 'default' : 'pointer' }}>{loadingBooks ? '整理中' : '刷新'}</button>
      </header>
      {selectedBook ? renderBook() : renderShelf()}
    </div>
  );
}

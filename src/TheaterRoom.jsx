import { useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch, BACKEND } from './api.js';
import './TheaterShelfPolish.css';

const emptySettings = {
  worldbook_text: '',
  worldbook_only: false,
  premise: '',
  characters: '',
  rules: '',
  user_name: '',
  assistant_name: '',
  chat_background_mode: 'main',
  chat_background_color: '',
  chat_background_image_url: '',
  min_reply_chars: 120,
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
  ['user_name', /^(?:#+\s*)?(?:我的名字|我的昵称|玩家名|用户名|主控名|女主名|我在这里叫)\s*[：:]\s*(.*)$/i],
  ['assistant_name', /^(?:#+\s*)?(?:对方名字|对方昵称|剧场称呼|小剧场称呼|男主名|对手戏名字|他在这里叫)\s*[：:]\s*(.*)$/i],
];

const chatBackgroundOptions = [
  ['main', '跟随陆泽 chat'],
  ['paper', '清透纸页'],
  ['cream', '奶油底'],
  ['blush', '樱粉底'],
  ['night', '深夜底'],
  ['custom', '自定义'],
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

function normalizeDraftSettings(value = {}) {
  const minimum = Number(value.min_reply_chars);
  return {
    ...emptySettings,
    ...value,
    worldbook_only: Boolean(value.worldbook_only),
    chat_background_mode: value.chat_background_mode || 'main',
    min_reply_chars: Number.isFinite(minimum) ? Math.min(1200, Math.max(0, Math.round(minimum))) : 120,
  };
}

function parseTheaterImport(rawText) {
  const text = String(rawText || '').replace(/\r\n/g, '\n').trim();
  const draft = makeBookDraft('导入的小世界');
  if (!text) return draft;

  const buckets = { ...emptySettings };
  buckets.worldbook_text = text;
  buckets.worldbook_only = true;
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
      } else if (section === 'user_name' || section === 'assistant_name') {
        if (inline) buckets[section] = inline.slice(0, 40);
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

  draft.settings = normalizeDraftSettings({
    premise: buckets.premise.trim(),
    characters: buckets.characters.trim(),
    rules: buckets.rules.trim(),
    worldbook_text: buckets.worldbook_text.trim(),
    worldbook_only: buckets.worldbook_only,
    user_name: buckets.user_name.trim(),
    assistant_name: buckets.assistant_name.trim(),
  });
  if (!draft.settings.premise && !draft.settings.characters && !draft.settings.rules) {
    draft.settings.worldbook_text = text;
    draft.settings.worldbook_only = true;
  }
  return draft;
}

export function TheaterRoom({ visible, theme, leaveRoom, selectedModel, availableModels = [], mainChatBackground = {} }) {
  const C = theme;
  const [books, setBooks] = useState([]);
  const [selectedBookId, setSelectedBookId] = useState(null);
  const [bookPane, setBookPane] = useState('settings');
  const [bookDraft, setBookDraft] = useState(makeBookDraft());
  const [loadingBooks, setLoadingBooks] = useState(false);
  const [savingBook, setSavingBook] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatting, setChatting] = useState(false);
  const [regeneratingMessageId, setRegeneratingMessageId] = useState(null);
  const [error, setError] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importPreview, setImportPreview] = useState(makeBookDraft('导入的小世界'));
  const [importingWorld, setImportingWorld] = useState(false);
  const [importingFile, setImportingFile] = useState(false);
  const [globalRulesOpen, setGlobalRulesOpen] = useState(false);
  const [globalRules, setGlobalRules] = useState('');
  const [savingGlobalRules, setSavingGlobalRules] = useState(false);
  const [importingGlobalRules, setImportingGlobalRules] = useState(false);
  const [uploadingChatBg, setUploadingChatBg] = useState(false);
  const [mode, setMode] = useState('interactive');
  const [model, setModel] = useState(selectedModel || '');
  const chatEndRef = useRef(null);
  const chatScrollerRef = useRef(null);
  const worldFileInputRef = useRef(null);
  const globalRulesFileInputRef = useRef(null);
  const chatBgInputRef = useRef(null);

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
    if (visible) {
      loadBooks();
      loadGlobalRules();
    }
  }, [visible]);

  useEffect(() => {
    if (!selectedBook) return;
    setBookDraft({
      title: selectedBook.title || '未命名小剧本',
      settings: normalizeDraftSettings(selectedBook.settings || {}),
    });
    setTimeout(() => scrollToLatest('auto'), 80);
  }, [selectedBook?.id]);

  useEffect(() => {
    if (bookPane !== 'chat') return;
    setTimeout(() => scrollToLatest(selectedBook?.messages?.length ? 'smooth' : 'auto'), 80);
  }, [bookPane, selectedBook?.id, selectedBook?.messages?.length, chatting]);

  const scrollToLatest = (behavior = 'smooth') => {
    const node = chatScrollerRef.current;
    if (node) {
      node.scrollTo({ top: node.scrollHeight, behavior });
      return;
    }
    chatEndRef.current?.scrollIntoView({ behavior, block: 'end' });
  };

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

  const loadGlobalRules = async () => {
    try {
      const response = await apiFetch(`${BACKEND}/theater/global-rules`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '通用规则没有读出来');
      setGlobalRules(data.rules || '');
    } catch (err) {
      setError(err.message);
    }
  };

  const saveGlobalRules = async () => {
    setSavingGlobalRules(true);
    setError('');
    try {
      const response = await apiFetch(`${BACKEND}/theater/global-rules`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rules: globalRules }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '通用规则没有保存成功');
      setGlobalRules(data.rules || '');
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingGlobalRules(false);
    }
  };

  const importGlobalRulesFile = async file => {
    if (!file) return;
    setImportingGlobalRules(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await apiFetch(`${BACKEND}/theater/global-rules/import`, { method: 'POST', body: formData });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '通用规则没有导入成功');
      setGlobalRules(data.rules || '');
      setGlobalRulesOpen(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setImportingGlobalRules(false);
      if (globalRulesFileInputRef.current) globalRulesFileInputRef.current.value = '';
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
      setBookPane('settings');
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
    if (!draft.settings.worldbook_text.trim() && !draft.settings.premise.trim() && !draft.settings.characters.trim() && !draft.settings.rules.trim()) {
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
      setBookPane('settings');
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
      setBookPane('settings');
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
    if (!selectedBook) return false;
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
      return true;
    } catch (err) {
      setError(err.message);
      return false;
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
      settings: normalizeDraftSettings({ ...current.settings, ...patch }),
    }));
  };

  const uploadChatBackground = async file => {
    if (!file) return;
    setUploadingChatBg(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await apiFetch(`${BACKEND}/upload`, { method: 'POST', body: formData });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.url) throw new Error(data.error || '背景图片没有上传成功');
      patchDraftSettings({
        chat_background_mode: 'custom',
        chat_background_image_url: data.url,
      });
    } catch (err) {
      setError(err.message || '背景图片没有上传成功');
    } finally {
      setUploadingChatBg(false);
      if (chatBgInputRef.current) chatBgInputRef.current.value = '';
    }
  };

  const theaterChatBackgroundStyle = () => {
    const settings = normalizeDraftSettings(bookDraft.settings || {});
    const mainImage = mainChatBackground?.image;
    const mainColor = mainChatBackground?.color;
    if (settings.chat_background_mode === 'main') {
      return mainImage
        ? { background: `url(${mainImage}) center/cover no-repeat` }
        : { background: mainColor || `linear-gradient(180deg, ${C.white}, ${C.surface})` };
    }
    if (settings.chat_background_mode === 'cream') {
      return { background: `radial-gradient(circle at 20% 0%, ${C.honeyLight}, transparent 36%), linear-gradient(180deg, ${C.cream}, ${C.surface})` };
    }
    if (settings.chat_background_mode === 'blush') {
      return { background: `radial-gradient(circle at 12% 15%, ${C.blush}, transparent 38%), linear-gradient(180deg, ${C.white}, ${C.blush})` };
    }
    if (settings.chat_background_mode === 'night') {
      return { background: `linear-gradient(180deg, #25180F, #130D08)` };
    }
    if (settings.chat_background_mode === 'custom') {
      return settings.chat_background_image_url
        ? { background: `url(${settings.chat_background_image_url}) center/cover no-repeat` }
        : { background: settings.chat_background_color || `linear-gradient(180deg, ${C.white}, ${C.surface})` };
    }
    return { background: `linear-gradient(180deg, ${C.white}, ${C.surface})` };
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
            data.assistant_message,
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

  const regenerateMessage = async message => {
    if (!selectedBook || !message?.id || message.role !== 'assistant') return;
    setRegeneratingMessageId(message.id);
    setError('');
    try {
      const response = await apiFetch(`${BACKEND}/theater/books/${selectedBook.id}/messages/${message.id}/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          play_mode: mode,
          model,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '这条回复没有重写成功');
      setBooks(items => items.map(book => {
        if (String(book.id) !== String(selectedBook.id)) return book;
        return {
          ...book,
          messages: (book.messages || []).map(item => (
            String(item.id) === String(message.id) ? data.assistant_message : item
          )),
        };
      }));
    } catch (err) {
      setError(err.message);
    } finally {
      setRegeneratingMessageId(null);
    }
  };

  const goBackToShelf = () => {
    setSelectedBookId(null);
    setBookPane('settings');
    setError('');
  };

  const openBook = (bookId, pane = null) => {
    const book = books.find(item => String(item.id) === String(bookId));
    const settings = normalizeDraftSettings(book?.settings || {});
    const hasWorldSetup = Boolean(
      settings.worldbook_text.trim()
      || settings.premise.trim()
      || settings.characters.trim()
      || settings.rules.trim()
    );
    const hasStory = Boolean((book?.messages || []).length || Number(book?.message_count) > 0);
    setSelectedBookId(bookId);
    setBookPane(pane || ((hasWorldSetup || hasStory) ? 'chat' : 'settings'));
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
            <button type="button" onClick={() => setGlobalRulesOpen(value => !value)} style={{ border: `1px solid ${C.border}`, borderRadius: 999, background: C.surface, color: C.honeyDeep, padding: '10px 13px', fontFamily: 'inherit', cursor: 'pointer' }}>通用规则</button>
            <button type="button" onClick={openImportPanel} style={{ border: `1px solid ${C.honeyMid}`, borderRadius: 999, background: C.honeyLight, color: C.honeyDeep, padding: '10px 13px', fontFamily: 'inherit', cursor: 'pointer' }}>导入世界</button>
            <button type="button" onClick={createBook} disabled={savingBook} style={{ border: 'none', borderRadius: 999, background: `linear-gradient(145deg, ${C.honey}, ${C.honeyDeep})`, color: C.white, padding: '10px 15px', fontFamily: 'inherit', cursor: savingBook ? 'default' : 'pointer', opacity: savingBook ? .65 : 1 }}>＋ 新书</button>
          </div>
        </div>
        {error && <div style={{ marginBottom: 12, color: C.blushDeep, fontSize: 12 }}>{error}</div>}
        {globalRulesOpen && (
          <section style={{ border: `1px solid ${C.border}`, borderRadius: 16, background: C.white, padding: 14, marginBottom: 16, boxShadow: `0 10px 26px ${C.borderLight}66` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
              <div>
                <div style={{ color: C.text, fontWeight: 700 }}>小剧场通用规则</div>
                <div style={{ color: C.mutedLight, fontSize: 10.5, marginTop: 3 }}>所有小世界都会遵循这里。可以放正则预设、禁词、总禁区、统一文风和防 OOC 规则。</div>
              </div>
              <button type="button" onClick={() => setGlobalRulesOpen(false)} style={{ border: 'none', background: 'transparent', color: C.muted, fontFamily: 'inherit', cursor: 'pointer' }}>收起</button>
            </div>
            <textarea
              value={globalRules}
              onChange={event => setGlobalRules(event.target.value)}
              rows={7}
              placeholder={'比如：\n- 禁止使用现代网络词。\n- 不要用项目符号写剧情。\n- 正则预设：把需要全局遵循的规则写在这里。'}
              style={{ width: '100%', boxSizing: 'border-box', border: `1.5px solid ${C.border}`, borderRadius: 13, background: C.surface, color: C.text, padding: '10px 11px', outline: 'none', resize: 'vertical', fontFamily: 'inherit', fontSize: 13, lineHeight: 1.65 }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
              <span style={{ color: C.mutedLight, fontSize: 10.5 }}>{globalRules.trim() ? `${globalRules.trim().length} 字，会进入所有小剧场提示词` : '还没有通用规则。'}</span>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <input ref={globalRulesFileInputRef} type="file" accept=".docx,.txt,.md,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown" style={{ display: 'none' }} onChange={event => importGlobalRulesFile(event.target.files?.[0])} />
                <button type="button" onClick={() => globalRulesFileInputRef.current?.click()} disabled={importingGlobalRules} style={{ border: `1px solid ${C.honeyMid}`, borderRadius: 999, background: C.honeyLight, color: C.honeyDeep, padding: '8px 12px', fontFamily: 'inherit', cursor: importingGlobalRules ? 'default' : 'pointer', opacity: importingGlobalRules ? .65 : 1 }}>{importingGlobalRules ? '导入中' : '上传规则'}</button>
                <button type="button" onClick={saveGlobalRules} disabled={savingGlobalRules} style={{ border: 'none', borderRadius: 999, background: `linear-gradient(145deg, ${C.honey}, ${C.honeyDeep})`, color: C.white, padding: '8px 14px', fontFamily: 'inherit', cursor: savingGlobalRules ? 'default' : 'pointer', opacity: savingGlobalRules ? .65 : 1 }}>{savingGlobalRules ? '保存中' : '保存规则'}</button>
              </div>
            </div>
          </section>
        )}
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
                ['全文', importPreview.settings.worldbook_text ? `${importPreview.settings.worldbook_text.length} 字` : '未识别'],
                ['世界观', importPreview.settings.premise ? `${importPreview.settings.premise.length} 字` : '可空'],
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
        <div className="theater-book-shelf">
          {books.map((book, index) => (
            <div key={book.id} className={`theater-book-volume theater-book-volume--${index % 4}`}>
              <button
                type="button"
                onClick={() => openBook(book.id)}
                className="theater-book-cover"
              >
                <span className="theater-book-ornament" aria-hidden="true">✦</span>
                <span className="theater-book-title">
                  <small>OUR LITTLE THEATER · {String(index + 1).padStart(2, '0')}</small>
                  <b>{book.title || '未命名小剧本'}</b>
                  <i aria-hidden="true" />
                </span>
                <span className="theater-book-meta">
                  <b>{book.message_count ? `${book.message_count} 条互动` : '等待开场'}</b>
                  <small>{book.last_message_at ? formatDate(book.last_message_at) : formatDate(book.created_at)}</small>
                </span>
              </button>
              <button className="theater-book-delete" type="button" onClick={() => deleteBook(book)}>移出书架</button>
            </div>
          ))}
        </div>
      </section>
    </main>
  );

  const renderBook = () => {
    if (!selectedBook) return null;
    const messages = selectedBook.messages || [];
    const settingsReady = bookDraft.settings.worldbook_text.trim() || bookDraft.settings.premise.trim() || bookDraft.settings.characters.trim();
    const userDisplayName = bookDraft.settings.user_name?.trim() || '你';
    const assistantDisplayName = bookDraft.settings.assistant_name?.trim() || '小剧场';
    if (bookPane === 'settings') {
      return (
        <main style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{ flexShrink: 0, borderBottom: `1px solid ${C.border}`, background: C.white, padding: '12px 14px' }}>
            <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 9 }}>
              <button type="button" onClick={goBackToShelf} style={{ border: 'none', background: 'transparent', color: C.honeyDeep, fontFamily: 'inherit', cursor: 'pointer' }}>← 书架</button>
              <input value={bookDraft.title} onChange={event => setBookDraft(current => ({ ...current, title: event.target.value }))} style={{ flex: '1 1 180px', minWidth: 0, border: `1px solid ${C.border}`, borderRadius: 999, background: C.surface, color: C.text, padding: '8px 12px', outline: 'none', fontFamily: 'inherit', fontSize: 14 }} />
              <button type="button" onClick={saveBook} disabled={savingBook} style={{ border: `1px solid ${C.border}`, borderRadius: 999, background: C.honeyLight, color: C.honeyDeep, padding: '8px 12px', fontFamily: 'inherit', cursor: savingBook ? 'default' : 'pointer' }}>{savingBook ? '保存中' : '保存设定'}</button>
            </div>
          </div>

          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '14px min(16px, 4vw) 24px' }}>
            <section style={{ maxWidth: 760, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ border: `1px solid ${C.border}`, borderRadius: 14, background: C.white, padding: 13 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 12 }}>
                  <label>
                    <span style={{ display: 'block', color: C.text, fontSize: 13, fontWeight: 700, marginBottom: 6 }}>我在这本书里的名字</span>
                    <input value={bookDraft.settings.user_name || ''} onChange={event => patchDraftSettings({ user_name: event.target.value })} placeholder="比如：方淳安、叶檀、阿苑…" style={{ width: '100%', boxSizing: 'border-box', border: `1.5px solid ${C.border}`, borderRadius: 999, background: C.surface, color: C.text, padding: '8px 12px', outline: 'none', fontFamily: 'inherit', fontSize: 13 }} />
                  </label>
                  <label>
                    <span style={{ display: 'block', color: C.text, fontSize: 13, fontWeight: 700, marginBottom: 6 }}>对方 / 剧场的名字</span>
                    <input value={bookDraft.settings.assistant_name || ''} onChange={event => patchDraftSettings({ assistant_name: event.target.value })} placeholder="比如：哥哥、陆泽、旁白…" style={{ width: '100%', boxSizing: 'border-box', border: `1.5px solid ${C.border}`, borderRadius: 999, background: C.surface, color: C.text, padding: '8px 12px', outline: 'none', fontFamily: 'inherit', fontSize: 13 }} />
                  </label>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: C.muted, fontSize: 12, marginBottom: 10 }}>
                  <input
                    type="checkbox"
                    checked={Boolean(bookDraft.settings.worldbook_only)}
                    onChange={event => patchDraftSettings({ worldbook_only: event.target.checked })}
                  />
                  只按完整世界书读取，不强迫拆角色卡和禁区
                </label>
                <Field
                  theme={C}
                  label="完整世界书"
                  hint={bookDraft.settings.worldbook_text ? `${bookDraft.settings.worldbook_text.length} 字` : '上传 Word 后会自动放这里'}
                  rows={7}
                  value={bookDraft.settings.worldbook_text}
                  onChange={value => patchDraftSettings({ worldbook_text: value })}
                  placeholder="可以整段放世界书全文。打开“只按完整世界书读取”后，下面的分栏可以留空。"
                />
                <div style={{ height: 12 }} />
                <Field theme={C} label="世界观 / 剧情设定" rows={5} value={bookDraft.settings.premise} onChange={value => patchDraftSettings({ premise: value })} placeholder="这里写这个小世界的基础设定。" />
                <div style={{ height: 10 }} />
                <Field theme={C} label="角色卡 / 关系" rows={5} value={bookDraft.settings.characters} onChange={value => patchDraftSettings({ characters: value })} placeholder="人物性格、关系张力、称呼、不能崩的点。" />
                <div style={{ height: 10 }} />
                <Field theme={C} label="禁区 / 写作规则" rows={4} value={bookDraft.settings.rules} onChange={value => patchDraftSettings({ rules: value })} placeholder="不要突兀和解、不要现代词、不要跳出剧情解释……" />
              </div>

              <div style={{ border: `1px solid ${C.border}`, borderRadius: 14, background: C.white, padding: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 9 }}>
                  <div>
                    <div style={{ color: C.text, fontWeight: 700 }}>聊天背景</div>
                    <div style={{ color: C.mutedLight, fontSize: 10.5, marginTop: 2 }}>默认跟随陆泽 chat，也可以给这本书单独换气氛。</div>
                  </div>
                  <input ref={chatBgInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={event => uploadChatBackground(event.target.files?.[0])} />
                  <button type="button" onClick={() => chatBgInputRef.current?.click()} disabled={uploadingChatBg} style={{ border: `1px solid ${C.honeyMid}`, borderRadius: 999, background: C.honeyLight, color: C.honeyDeep, padding: '7px 11px', fontFamily: 'inherit', cursor: uploadingChatBg ? 'default' : 'pointer', opacity: uploadingChatBg ? .65 : 1 }}>{uploadingChatBg ? '上传中' : '上传图'}</button>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {chatBackgroundOptions.map(([value, label]) => (
                    <button key={value} type="button" onClick={() => patchDraftSettings({ chat_background_mode: value })} style={{ border: `1px solid ${bookDraft.settings.chat_background_mode === value ? C.honeyMid : C.border}`, background: bookDraft.settings.chat_background_mode === value ? C.honeyLight : C.surface, color: bookDraft.settings.chat_background_mode === value ? C.honeyDeep : C.muted, borderRadius: 999, padding: '7px 11px', fontFamily: 'inherit', cursor: 'pointer' }}>{label}</button>
                  ))}
                  <input type="color" value={bookDraft.settings.chat_background_color || '#fff8ef'} onChange={event => patchDraftSettings({ chat_background_mode: 'custom', chat_background_color: event.target.value, chat_background_image_url: '' })} style={{ width: 34, height: 34, borderRadius: 12, border: `1px solid ${C.border}`, background: 'transparent', padding: 0, cursor: 'pointer' }} />
                </div>
                {bookDraft.settings.chat_background_image_url && (
                  <button type="button" onClick={() => patchDraftSettings({ chat_background_image_url: '' })} style={{ marginTop: 8, border: 'none', background: 'transparent', color: C.muted, fontFamily: 'inherit', fontSize: 11, cursor: 'pointer' }}>清除这本书的背景图</button>
                )}
              </div>

              <div style={{ border: `1px solid ${C.border}`, borderRadius: 14, background: C.white, padding: 13 }}>
                <div style={{ color: C.text, fontWeight: 700, marginBottom: 9 }}>玩法</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {[
                    ['interactive', '互动'],
                    ['story', '纯文'],
                  ].map(([value, label]) => (
                    <button key={value} type="button" onClick={() => setMode(value)} style={{ border: `1px solid ${mode === value ? C.honeyMid : C.border}`, background: mode === value ? C.honeyLight : C.surface, color: mode === value ? C.honeyDeep : C.muted, borderRadius: 999, padding: '7px 12px', fontFamily: 'inherit', cursor: 'pointer' }}>{label}</button>
                  ))}
                </div>
                <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${C.borderLight}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
                    <span style={{ color: C.text, fontSize: 12.5, fontWeight: 700 }}>最低回复长度</span>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 4, color: C.mutedLight, fontSize: 10.5 }}>
                      <input
                        type="number"
                        min="0"
                        max="1200"
                        step="20"
                        value={bookDraft.settings.min_reply_chars}
                        onChange={event => patchDraftSettings({ min_reply_chars: Math.min(1200, Math.max(0, Number(event.target.value) || 0)) })}
                        style={{ width: 68, border: `1px solid ${C.border}`, borderRadius: 8, background: C.surface, color: C.text, padding: '4px 6px', fontFamily: 'inherit', textAlign: 'right' }}
                      />
                      字
                    </label>
                  </div>
                  <input aria-label="这本小剧场的最低回复长度" type="range" min="0" max="1200" step="20" value={bookDraft.settings.min_reply_chars} onChange={event => patchDraftSettings({ min_reply_chars: Number(event.target.value) })} style={{ width: '100%' }} />
                  <div style={{ color: C.mutedLight, fontSize: 10.5, lineHeight: 1.55 }}>人物会按这一轮剧情自行决定长短；较短时只补一点世界内的余韵，不会每次写成同样篇幅。</div>
                </div>
                <select value={model} onChange={event => setModel(event.target.value)} style={{ width: '100%', marginTop: 10, border: `1px solid ${C.border}`, background: C.surface, color: C.muted, borderRadius: 999, padding: '7px 10px', fontFamily: 'inherit', fontSize: 11 }}>
                  {modelOptions.length ? modelOptions.map(item => <option key={item} value={item}>{item}</option>) : <option value="">默认模型</option>}
                </select>
              </div>

              {error && <div style={{ color: C.blushDeep, fontSize: 12 }}>{error}</div>}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: 10 }}>
                <button type="button" onClick={saveBook} disabled={savingBook} style={{ minHeight: 46, border: `1px solid ${C.border}`, borderRadius: 14, background: C.surface, color: C.honeyDeep, fontFamily: 'inherit', cursor: savingBook ? 'default' : 'pointer' }}>{savingBook ? '保存中' : '只保存'}</button>
                <button type="button" onClick={async () => { if (await saveBook()) setBookPane('chat'); }} disabled={savingBook} style={{ minHeight: 46, border: 'none', borderRadius: 14, background: `linear-gradient(145deg, ${C.honey}, ${C.honeyDeep})`, color: C.white, fontFamily: 'inherit', cursor: savingBook ? 'default' : 'pointer', opacity: savingBook ? .65 : 1 }}>{settingsReady ? '进入 chat' : '先这样开始 chat'}</button>
              </div>
            </section>
          </div>
        </main>
      );
    }

    return (
      <main style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '12px min(16px, 4vw) 14px' }}>
        <div style={{ flexShrink: 0, maxWidth: 760, width: '100%', margin: '0 auto 10px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ color: C.text, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{bookDraft.title || '未命名小剧本'}</div>
            <div style={{ color: C.mutedLight, fontSize: 10, letterSpacing: '.12em' }}>{mode === 'interactive' ? '互动推进' : '沉浸纯文'} · 最低 {bookDraft.settings.min_reply_chars} 字</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            <button type="button" onClick={() => setBookPane('settings')} style={{ border: `1px solid ${C.border}`, borderRadius: 999, background: C.surface, color: C.honeyDeep, padding: '7px 12px', fontFamily: 'inherit', cursor: 'pointer' }}>设定</button>
          </div>
        </div>

        <div style={{ flex: 1, minHeight: 0, maxWidth: 760, width: '100%', margin: '0 auto', border: `1px solid ${C.border}`, borderRadius: 18, ...theaterChatBackgroundStyle(), padding: 12, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
          <div ref={chatScrollerRef} style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, padding: '4px 2px 12px' }}>
            {messages.length === 0 && (
              <div style={{ color: C.muted, fontSize: 13, lineHeight: 1.8, padding: '30px 10px', textAlign: 'center' }}>
                这本书还没有开演。你可以直接说：从哪里开始、你扮演谁、想让剧情怎么动。
              </div>
            )}
            {messages.map(message => (
              <div key={message.id} style={{ alignSelf: message.role === 'user' ? 'flex-end' : 'stretch', maxWidth: message.role === 'user' ? '82%' : '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: message.role === 'user' ? 'flex-end' : 'space-between', gap: 8, color: message.role === 'user' ? C.honeyDeep : C.mutedLight, fontSize: 10, marginBottom: 4, textAlign: message.role === 'user' ? 'right' : 'left' }}>
                  <span>{message.role === 'user' ? userDisplayName : assistantDisplayName} · {formatDate(message.created_at)}</span>
                  {message.role === 'assistant' && (
                    <button
                      type="button"
                      onClick={() => regenerateMessage(message)}
                      disabled={chatting || Boolean(regeneratingMessageId)}
                      style={{ border: 'none', background: 'transparent', color: C.honeyDeep, fontFamily: 'inherit', fontSize: 10, cursor: chatting || regeneratingMessageId ? 'default' : 'pointer', opacity: chatting || regeneratingMessageId ? .55 : 1, padding: '2px 0' }}
                    >
                      {String(regeneratingMessageId) === String(message.id) ? '重写中' : '重写'}
                    </button>
                  )}
                </div>
                <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.85, fontSize: message.role === 'user' ? 13.5 : 14.5, color: C.text, background: message.role === 'user' ? C.honeyLight : C.white, border: `1px solid ${message.role === 'user' ? C.honeyMid : C.border}`, borderRadius: message.role === 'user' ? '16px 16px 4px 16px' : 13, padding: '10px 12px' }}>{message.content}</div>
              </div>
            ))}
            {chatting && <div style={{ color: C.muted, fontSize: 12, padding: '4px 2px' }}>小剧场正在接戏…</div>}
            <div ref={chatEndRef} />
          </div>
          {messages.length > 3 && (
            <button type="button" onClick={() => scrollToLatest('smooth')} style={{ position: 'absolute', right: 18, bottom: 70, border: `1px solid ${C.border}`, borderRadius: 999, background: C.white, color: C.honeyDeep, boxShadow: '0 6px 18px rgba(46,31,18,.18)', padding: '6px 10px', fontFamily: 'inherit', fontSize: 11, cursor: 'pointer' }}>↓ 最新</button>
          )}
          {error && <div style={{ color: C.blushDeep, fontSize: 12, marginBottom: 8 }}>{error}</div>}
          <div style={{ flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, border: `1.5px solid ${C.border}`, borderRadius: 20, background: C.surface, padding: '7px 7px 7px 10px' }}>
              <textarea value={chatInput} onChange={event => setChatInput(event.target.value)} rows={1} placeholder="在小剧场里说话、下导演指令、继续剧情……" style={{ flex: 1, maxHeight: 120, border: 'none', outline: 'none', background: 'transparent', color: C.text, resize: 'none', fontFamily: 'inherit', fontSize: 14.5, lineHeight: 1.5, padding: '6px 0' }} />
              <button type="button" onClick={() => sendChat()} disabled={chatting || !chatInput.trim()} aria-label="发送小剧场消息" style={{ width: 36, height: 36, border: 'none', borderRadius: '50%', background: chatInput.trim() && !chatting ? `linear-gradient(150deg, ${C.honey}, ${C.honeyDeep})` : C.honeyMid, color: C.white, fontFamily: 'inherit', cursor: chatInput.trim() && !chatting ? 'pointer' : 'default', boxShadow: chatInput.trim() && !chatting ? '0 3px 10px rgba(185,122,31,.35)' : 'none', opacity: chatting ? .62 : 1 }}>↑</button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, paddingLeft: 2 }}>
              <select aria-label="选择小剧场模型" value={model} onChange={event => setModel(event.target.value)} style={{ flex: 1, minWidth: 0, fontSize: 11, color: C.muted, background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 999, padding: '4px 10px', outline: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                {modelOptions.length ? modelOptions.map(item => <option key={item} value={item}>{item}</option>) : <option value="">暂无可用模型</option>}
              </select>
              <span style={{ color: C.mutedLight, fontSize: 10, whiteSpace: 'nowrap' }}>{mode === 'interactive' ? '互动推进' : '沉浸纯文'}</span>
            </div>
          </div>
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
          <div style={{ fontSize: 10, color: C.mutedLight, letterSpacing: '.14em' }}>{selectedBook ? (bookPane === 'chat' ? 'story chat' : 'story settings') : 'theater bookshelf'}</div>
        </div>
        <button type="button" onClick={loadBooks} disabled={loadingBooks} style={{ border: `1px solid ${C.border}`, background: C.surface, color: C.honeyDeep, borderRadius: 999, padding: '6px 10px', fontFamily: 'inherit', fontSize: 11, cursor: loadingBooks ? 'default' : 'pointer' }}>{loadingBooks ? '整理中' : '刷新'}</button>
      </header>
      {selectedBook ? renderBook() : renderShelf()}
    </div>
  );
}

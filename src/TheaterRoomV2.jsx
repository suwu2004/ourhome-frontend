import { useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch, BACKEND } from './api.js';
import { MessageActionSheet } from './MessageActionSheet.jsx';
import { Stars } from './ChatDecorations.jsx';
import './TheaterShelfPolish.css';

const THEATER_MIN_REPLY_MAX = 4000;

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

const importStarter = `剧场名：\n\n世界观：\n\n人设 / 角色关系：\n\n禁区 / 写作规则：\n`;
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

function createTheaterRequestId() {
  const randomId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `theater-${randomId}`;
}

function theaterSendFingerprint({ bookId, text, mode, model }) {
  return JSON.stringify([String(bookId || ''), String(text || ''), String(mode || ''), String(model || '')]);
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${month}/${day} ${hour}:${minute}`;
}

function formatClock(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function compactUsageNumber(value) {
  const number = Number(value) || 0;
  if (!number) return '—';
  if (number >= 1_000_000) return `${(number / 1_000_000).toFixed(number >= 10_000_000 ? 0 : 1)}m`;
  if (number >= 1000) return `${(number / 1000).toFixed(number >= 10_000 ? 0 : 1)}k`;
  return String(number);
}

function TheaterAvatar({ isMe, src, theme }) {
  return (
    <div style={{
      width: 30, height: 30, borderRadius: '50%', flexShrink: 0, overflow: 'hidden',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 12, fontWeight: 700, color: theme.white,
      background: isMe ? `linear-gradient(150deg, #F2AFA2, ${theme.blushDeep})` : `linear-gradient(150deg, #E8B45A, ${theme.honeyDeep})`,
      boxShadow: `0 2px 6px ${isMe ? 'rgba(232,144,122,.3)' : 'rgba(185,122,31,.25)'}`,
    }}>
      {src ? <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (isMe ? '檀' : '泽')}
    </div>
  );
}

function Field({ label, hint, value, onChange, rows = 4, placeholder, theme }) {
  return (
    <label style={{ display: 'block' }}>
      <span style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
        <b style={{ color: theme.text, fontSize: 13, letterSpacing: '.06em' }}>{label}</b>
        {hint && <small style={{ color: theme.mutedLight, fontSize: 10 }}>{hint}</small>}
      </span>
      <textarea value={value} rows={rows} onChange={event => onChange(event.target.value)} placeholder={placeholder} style={{ width: '100%', minHeight: rows * 26, resize: 'vertical', border: `1.5px solid ${theme.border}`, borderRadius: 12, background: theme.surface, color: theme.text, padding: '10px 11px', outline: 'none', fontFamily: 'inherit', fontSize: 13, lineHeight: 1.65, boxSizing: 'border-box' }} />
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
    min_reply_chars: Number.isFinite(minimum) ? Math.min(THEATER_MIN_REPLY_MAX, Math.max(0, Math.round(minimum))) : 120,
  };
}

function parseTheaterImport(rawText) {
  const text = String(rawText || '').replace(/\r\n/g, '\n').trim();
  const draft = makeBookDraft('导入的小世界');
  if (!text) return draft;
  const buckets = { ...emptySettings, worldbook_text: text, worldbook_only: true };
  let current = 'premise';
  text.split('\n').forEach(line => {
    const trimmed = line.trim();
    const matched = theaterImportSections.find(([, pattern]) => pattern.test(trimmed));
    if (!matched) {
      appendSection(buckets, current, line);
      return;
    }
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

function toActionMessage(message) {
  return {
    ...message,
    role: message.role === 'user' ? 'me' : 'ai',
    text: message.content || '',
    createdAt: message.created_at,
    time: formatClock(message.created_at),
  };
}

export function TheaterRoom({ visible, theme, leaveRoom, selectedModel, availableModels = [], mainChatBackground = {}, myAvatar = '', partnerAvatar = '', myBubbleColor = '', partnerBubbleColor = '' }) {
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
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importingWorld, setImportingWorld] = useState(false);
  const [importingFile, setImportingFile] = useState(false);
  const [uploadingChatBg, setUploadingChatBg] = useState(false);
  const [mode, setMode] = useState('interactive');
  const [model, setModel] = useState(selectedModel || '');
  const [theaterModels, setTheaterModels] = useState(() => [...availableModels]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState('');
  const [lastContextTokens, setLastContextTokens] = useState(0);
  const [lastOutputTokens, setLastOutputTokens] = useState(0);
  const [nearLatest, setNearLatest] = useState(true);
  const [messageAction, setMessageAction] = useState(null);
  const [messageActionLoading, setMessageActionLoading] = useState(false);
  const [messageActionError, setMessageActionError] = useState('');
  const [editingMessage, setEditingMessage] = useState(null);
  const [rollbackUndo, setRollbackUndo] = useState(null);

  const chatEndRef = useRef(null);
  const chatScrollerRef = useRef(null);
  const nearLatestRef = useRef(true);
  const chatSendLockRef = useRef(false);
  const chatRetryRef = useRef(null);
  const worldFileInputRef = useRef(null);
  const chatBgInputRef = useRef(null);

  const selectedBook = useMemo(() => books.find(book => String(book.id) === String(selectedBookId)) || null, [books, selectedBookId]);
  const messages = selectedBook?.messages || [];
  const userDisplayName = bookDraft.settings.user_name?.trim() || '你';
  const assistantDisplayName = bookDraft.settings.assistant_name?.trim() || '小剧场';
  const modelOptions = useMemo(() => [...new Set([model, selectedModel, ...theaterModels, ...availableModels].map(item => String(item || '').trim()).filter(Boolean))], [availableModels, model, selectedModel, theaterModels]);

  useEffect(() => {
    if (selectedModel && !model) setModel(selectedModel);
  }, [model, selectedModel]);

  useEffect(() => {
    setTheaterModels(current => [...new Set([...current, ...availableModels].map(item => String(item || '').trim()).filter(Boolean))]);
  }, [availableModels]);

  useEffect(() => {
    if (visible) loadBooks();
  }, [visible]);

  useEffect(() => {
    if (!selectedBook) return;
    setBookDraft({ title: selectedBook.title || '未命名小剧本', settings: normalizeDraftSettings(selectedBook.settings || {}) });
  }, [selectedBook?.id]);

  useEffect(() => {
    if (bookPane !== 'chat') return;
    nearLatestRef.current = true;
    setNearLatest(true);
    const timer = setTimeout(() => scrollToLatest('auto'), 80);
    return () => clearTimeout(timer);
  }, [bookPane, selectedBook?.id]);

  useEffect(() => {
    if (bookPane !== 'chat' || !nearLatestRef.current) return;
    const timer = setTimeout(() => scrollToLatest('smooth'), 80);
    return () => clearTimeout(timer);
  }, [bookPane, selectedBook?.messages?.length, chatting]);

  const patchSelectedBook = (bookId, updater) => {
    setBooks(items => items.map(book => String(book.id) === String(bookId) ? updater(book) : book));
  };

  const rememberUsage = data => {
    if (Number(data?.input_tokens)) setLastContextTokens(Number(data.input_tokens));
    if (Number(data?.output_tokens)) setLastOutputTokens(Number(data.output_tokens));
  };

  const scrollToLatest = (behavior = 'smooth') => {
    nearLatestRef.current = true;
    setNearLatest(true);
    const node = chatScrollerRef.current;
    if (node) {
      node.scrollTo({ top: node.scrollHeight, behavior });
      return;
    }
    chatEndRef.current?.scrollIntoView({ behavior, block: 'end' });
  };

  const handleChatScroll = event => {
    const node = event.currentTarget;
    const nextNearLatest = node.scrollHeight - node.scrollTop - node.clientHeight < 72;
    if (nextNearLatest === nearLatestRef.current) return;
    nearLatestRef.current = nextNearLatest;
    setNearLatest(nextNearLatest);
  };

  const refreshModels = async () => {
    setModelsLoading(true);
    setModelsError('');
    try {
      const response = await apiFetch(`${BACKEND}/settings/models`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || '模型拉取失败');
      const next = [...new Set([model, ...(Array.isArray(data?.models) ? data.models : [])].map(item => String(item || '').trim()).filter(Boolean))];
      setTheaterModels(next);
      if (!model && next[0]) setModel(next[0]);
      return next;
    } catch (err) {
      setModelsError(err?.message || '模型拉取失败');
      return [];
    } finally {
      setModelsLoading(false);
    }
  };

  const loadBooks = async () => {
    setLoadingBooks(true);
    setError('');
    try {
      const response = await apiFetch(`${BACKEND}/theater/books`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '剧场书架没有打开');
      const nextBooks = Array.isArray(data) ? data : [];
      setBooks(nextBooks);
      if (selectedBookId && !nextBooks.some(book => String(book.id) === String(selectedBookId))) setSelectedBookId(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingBooks(false);
    }
  };

  const createBook = async () => {
    setSavingBook(true);
    setError('');
    setAddMenuOpen(false);
    setImportOpen(false);
    try {
      const response = await apiFetch(`${BACKEND}/theater/books`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(makeBookDraft(`小世界 ${books.length + 1}`)) });
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

  const importWorld = async () => {
    const draft = parseTheaterImport(importText);
    if (!draft.settings.worldbook_text.trim() && !draft.settings.premise.trim() && !draft.settings.characters.trim() && !draft.settings.rules.trim()) {
      setError('先把小世界设定贴进来。');
      return;
    }
    setImportingWorld(true);
    setError('');
    try {
      const response = await apiFetch(`${BACKEND}/theater/books`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(draft) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '这个小世界没有导入成功');
      setBooks(items => [data, ...items]);
      setSelectedBookId(data.id);
      setBookPane('settings');
      setImportOpen(false);
      setImportText('');
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
      const response = await apiFetch(`${BACKEND}/theater/books/${selectedBook.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(bookDraft) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '设定没有保存成功');
      setBooks(items => items.map(book => book.id === data.id ? { ...book, ...data, messages: book.messages || [] } : book));
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

  const patchDraftSettings = patch => setBookDraft(current => ({ ...current, settings: normalizeDraftSettings({ ...current.settings, ...patch }) }));
  const patchStructuredSetting = patch => patchDraftSettings({ ...patch, worldbook_only: false });

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
      patchDraftSettings({ chat_background_mode: 'custom', chat_background_image_url: data.url });
    } catch (err) {
      setError(err.message || '背景图片没有上传成功');
    } finally {
      setUploadingChatBg(false);
      if (chatBgInputRef.current) chatBgInputRef.current.value = '';
    }
  };

  const theaterChatBackgroundStyle = () => {
    const settings = normalizeDraftSettings(bookDraft.settings || {});
    if (settings.chat_background_mode === 'main') return mainChatBackground?.image ? { background: `url(${mainChatBackground.image}) center/cover no-repeat` } : { background: mainChatBackground?.color || `linear-gradient(180deg, ${C.white}, ${C.surface})` };
    if (settings.chat_background_mode === 'paper') return { background: `linear-gradient(180deg, ${C.white}, ${C.cream})` };
    if (settings.chat_background_mode === 'cream') return { background: `radial-gradient(circle at 20% 0%, ${C.honeyLight}, transparent 36%), linear-gradient(180deg, ${C.cream}, ${C.surface})` };
    if (settings.chat_background_mode === 'blush') return { background: `radial-gradient(circle at 12% 15%, ${C.blush}, transparent 38%), linear-gradient(180deg, ${C.white}, ${C.blush})` };
    if (settings.chat_background_mode === 'night') return { background: 'linear-gradient(180deg, #25180F, #130D08)' };
    if (settings.chat_background_mode === 'custom') return settings.chat_background_image_url ? { background: `url(${settings.chat_background_image_url}) center/cover no-repeat` } : { background: settings.chat_background_color || `linear-gradient(180deg, ${C.white}, ${C.surface})` };
    return { background: `linear-gradient(180deg, ${C.white}, ${C.surface})` };
  };

  const postTheaterChat = async ({ bookId, text, requestId }) => {
    const response = await apiFetch(`${BACKEND}/theater/books/${bookId}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-OurHome-Request-Id': requestId },
      body: JSON.stringify({ message: text, play_mode: mode, model }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || '小剧场这次没有接上');
    return data;
  };

  const submitEditedMessage = async text => {
    if (!selectedBook || !editingMessage) return;
    const bookId = selectedBook.id;
    const originalMessages = [...messages];
    const targetIndex = originalMessages.findIndex(item => String(item.id) === String(editingMessage.id));
    if (targetIndex < 0) {
      setMessageActionError('页面里找不到这条消息，请刷新后再试。');
      return;
    }
    chatSendLockRef.current = true;
    setChatting(true);
    setMessageActionLoading(true);
    setError('');
    setMessageActionError('');
    let hiddenIds = [];
    try {
      const prepareResponse = await apiFetch(`${BACKEND}/theater/books/${bookId}/messages/${editingMessage.id}/edit-prepare`, { method: 'POST' });
      const prepared = await prepareResponse.json().catch(() => ({}));
      if (!prepareResponse.ok) throw new Error(prepared.error || '这条消息没有进入编辑状态');
      hiddenIds = Array.isArray(prepared.hiddenIds) ? prepared.hiddenIds : [];
      const data = await postTheaterChat({ bookId, text, requestId: createTheaterRequestId() });
      const kept = originalMessages.slice(0, targetIndex);
      const nextMessages = [...kept, data.user_message, data.assistant_message].filter(Boolean);
      patchSelectedBook(bookId, book => ({ ...book, messages: nextMessages, message_count: nextMessages.length, last_message_at: data.assistant_message?.created_at || new Date().toISOString() }));
      rememberUsage(data);
      setEditingMessage(null);
      setChatInput('');
      setRollbackUndo(null);
      nearLatestRef.current = true;
      setNearLatest(true);
    } catch (err) {
      if (hiddenIds.length) {
        await apiFetch(`${BACKEND}/theater/books/${bookId}/messages/${editingMessage.id}/rollback/undo`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message_ids: hiddenIds }),
        }).catch(() => null);
      }
      setMessageActionError(err.message || '重新发送失败');
      setError(err.message || '重新发送失败');
      setChatInput(text);
    } finally {
      chatSendLockRef.current = false;
      setChatting(false);
      setMessageActionLoading(false);
    }
  };

  const sendChat = async (overrideText = null) => {
    const text = (overrideText ?? chatInput).trim();
    if (!selectedBook || chatSendLockRef.current) return;
    if (!text) {
      setError('先在小剧场里说一句。');
      return;
    }
    if (editingMessage) {
      await submitEditedMessage(text);
      return;
    }
    const fingerprint = theaterSendFingerprint({ bookId: selectedBook.id, text, mode, model });
    const requestId = chatRetryRef.current?.fingerprint === fingerprint ? chatRetryRef.current.requestId : createTheaterRequestId();
    chatSendLockRef.current = true;
    chatRetryRef.current = { fingerprint, requestId };
    nearLatestRef.current = true;
    setNearLatest(true);
    setChatting(true);
    setError('');
    setChatInput('');
    try {
      const data = await postTheaterChat({ bookId: selectedBook.id, text, requestId });
      chatRetryRef.current = null;
      patchSelectedBook(selectedBook.id, book => ({
        ...book,
        messages: [...(book.messages || []), data.user_message, data.assistant_message].filter(Boolean),
        message_count: (book.messages || []).length + 2,
        last_message_at: data.assistant_message?.created_at || new Date().toISOString(),
      }));
      rememberUsage(data);
    } catch (err) {
      setError(err.message);
      setChatInput(text);
    } finally {
      chatSendLockRef.current = false;
      setChatting(false);
    }
  };

  const regenerateMessage = async message => {
    if (!selectedBook || !message?.id || message.role !== 'assistant') return;
    setRegeneratingMessageId(message.id);
    setError('');
    try {
      const response = await apiFetch(`${BACKEND}/theater/books/${selectedBook.id}/messages/${message.id}/regenerate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ play_mode: mode, model }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '这条回复没有重新生成成功');
      patchSelectedBook(selectedBook.id, book => ({ ...book, messages: (book.messages || []).map(item => String(item.id) === String(message.id) ? data.assistant_message : item) }));
      rememberUsage(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setRegeneratingMessageId(null);
    }
  };

  const openMessageActions = message => {
    if (chatting || messageActionLoading || regeneratingMessageId) return;
    const index = messages.findIndex(item => String(item.id) === String(message.id));
    setMessageAction({ message: toActionMessage(message), mode: 'menu', afterCount: index < 0 ? 0 : Math.max(0, messages.length - index - 1) });
    setMessageActionError('');
  };

  const startEditMessage = actionMessage => {
    const index = messages.findIndex(item => String(item.id) === String(actionMessage.id));
    setEditingMessage({ id: actionMessage.id, draftBefore: chatInput, afterCount: index < 0 ? 0 : Math.max(0, messages.length - index - 1) });
    setChatInput(actionMessage.text || '');
    setMessageAction(null);
    setMessageActionError('');
    setRollbackUndo(null);
  };

  const cancelEditMessage = () => {
    if (!editingMessage || messageActionLoading) return;
    setChatInput(editingMessage.draftBefore || '');
    setEditingMessage(null);
    setMessageActionError('');
  };

  const confirmRollback = async () => {
    if (!selectedBook || !messageAction || messageAction.mode !== 'rollback' || messageActionLoading) return;
    const targetId = messageAction.message.id;
    const index = messages.findIndex(item => String(item.id) === String(targetId));
    if (index < 0 || messageAction.afterCount === 0) {
      setMessageAction(null);
      return;
    }
    setMessageActionLoading(true);
    setMessageActionError('');
    try {
      const response = await apiFetch(`${BACKEND}/theater/books/${selectedBook.id}/messages/${targetId}/rollback`, { method: 'POST' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || '回到这里失败');
      const hiddenMessages = messages.slice(index + 1);
      const keptMessages = messages.slice(0, index + 1);
      patchSelectedBook(selectedBook.id, book => ({ ...book, messages: keptMessages, message_count: keptMessages.length, last_message_at: keptMessages.at(-1)?.created_at || book.last_message_at }));
      setRollbackUndo({ targetId, hiddenIds: Array.isArray(data.hiddenIds) ? data.hiddenIds : hiddenMessages.map(item => item.id), hiddenMessages });
      setMessageAction(null);
      setEditingMessage(null);
    } catch (err) {
      setMessageActionError(err.message || '回到这里失败');
    } finally {
      setMessageActionLoading(false);
    }
  };

  const undoRollback = async () => {
    if (!selectedBook || !rollbackUndo || messageActionLoading) return;
    setMessageActionLoading(true);
    setMessageActionError('');
    try {
      const response = await apiFetch(`${BACKEND}/theater/books/${selectedBook.id}/messages/${rollbackUndo.targetId}/rollback/undo`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message_ids: rollbackUndo.hiddenIds }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || '撤销回溯失败');
      const restoredIds = new Set((data.restoredIds || []).map(id => String(id)));
      if (rollbackUndo.hiddenIds.some(id => !restoredIds.has(String(id)))) throw new Error('有一部分消息没有恢复，请刷新小剧场后再试。');
      patchSelectedBook(selectedBook.id, book => {
        const nextMessages = [...(book.messages || []), ...rollbackUndo.hiddenMessages];
        return { ...book, messages: nextMessages, message_count: nextMessages.length, last_message_at: nextMessages.at(-1)?.created_at || book.last_message_at };
      });
      setRollbackUndo(null);
    } catch (err) {
      setError(err.message || '撤销失败，请再试一次。');
    } finally {
      setMessageActionLoading(false);
    }
  };

  const goBackToShelf = () => {
    setSelectedBookId(null);
    setBookPane('settings');
    setError('');
    setMessageAction(null);
    setEditingMessage(null);
    setRollbackUndo(null);
    setAddMenuOpen(false);
    setImportOpen(false);
  };

  const openBook = (bookId, pane = null) => {
    const book = books.find(item => String(item.id) === String(bookId));
    const settings = normalizeDraftSettings(book?.settings || {});
    const hasWorldSetup = Boolean(settings.worldbook_text.trim() || settings.premise.trim() || settings.characters.trim() || settings.rules.trim());
    const hasStory = Boolean((book?.messages || []).length || Number(book?.message_count) > 0);
    setSelectedBookId(bookId);
    setBookPane(pane || ((hasWorldSetup || hasStory) ? 'chat' : 'settings'));
    setError('');
    setMessageAction(null);
    setEditingMessage(null);
    setRollbackUndo(null);
  };

  const modelControl = ({ settings = false } = {}) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: settings ? 10 : 0, flex: settings ? '1 1 100%' : '1 1 auto', minWidth: 0 }}>
      <select aria-label="选择小剧场模型" value={model} onChange={event => setModel(event.target.value)} style={{ flex: 1, minWidth: 0, fontSize: 11, color: C.muted, background: settings ? C.surface : 'transparent', border: `1px solid ${C.border}`, borderRadius: 999, padding: settings ? '7px 10px' : '4px 10px', outline: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
        {modelOptions.length ? modelOptions.map(item => <option key={item} value={item}>{item}</option>) : <option value="">暂无可用模型</option>}
      </select>
      <button type="button" onClick={refreshModels} disabled={modelsLoading} aria-label="重新拉取当前 API 站点的模型" title={modelsError || '重新拉取当前 API 站点的模型'} style={{ width: settings ? 30 : 26, height: settings ? 30 : 26, flexShrink: 0, borderRadius: '50%', border: `1px solid ${modelsError ? C.blushDeep : C.border}`, background: C.surface, color: modelsError ? C.blushDeep : C.honeyDeep, cursor: modelsLoading ? 'default' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, lineHeight: 1, opacity: modelsLoading ? .55 : 1 }}>{modelsLoading ? '…' : '↻'}</button>
    </div>
  );

  const renderShelf = () => (
    <main style={{ flex: 1, overflowY: 'auto', padding: '18px min(18px, 4vw) 28px' }}>
      <section style={{ maxWidth: 920, margin: '0 auto' }}>
        <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div><div style={{ color: C.text, fontSize: 20, fontWeight: 700 }}>剧场书架</div><div style={{ color: C.mutedLight, fontSize: 11, letterSpacing: '.12em', marginTop: 3 }}>每一本书，都是一个小世界。</div></div>
          <button type="button" aria-label="添加小世界" onClick={() => setAddMenuOpen(open => !open)} style={{ width: 42, height: 42, flexShrink: 0, border: `1px solid ${C.honeyMid}`, borderRadius: '50%', background: C.honeyLight, color: C.honeyDeep, fontFamily: 'inherit', fontSize: 24, lineHeight: 1, cursor: 'pointer' }}>＋</button>
          {addMenuOpen && <div style={{ position: 'absolute', zIndex: 5, right: 0, top: 48, width: 'min(260px, calc(100vw - 44px))', padding: 7, display: 'grid', gap: 6, border: `1px solid ${C.border}`, borderRadius: 15, background: C.white, boxShadow: '0 14px 34px rgba(54,35,16,.17)' }}>
            <button type="button" onClick={createBook} disabled={savingBook} style={{ minHeight: 58, border: 0, borderRadius: 11, background: C.cream, color: C.text, padding: '9px 12px', textAlign: 'left', fontFamily: 'inherit', cursor: savingBook ? 'default' : 'pointer' }}><b style={{ display: 'block', fontSize: 13 }}>手动创建</b><small style={{ display: 'block', color: C.muted, marginTop: 3 }}>自己设计一个小世界</small></button>
            <button type="button" onClick={() => { setError(''); setAddMenuOpen(false); setImportOpen(true); }} style={{ minHeight: 58, border: 0, borderRadius: 11, background: C.cream, color: C.text, padding: '9px 12px', textAlign: 'left', fontFamily: 'inherit', cursor: 'pointer' }}><b style={{ display: 'block', fontSize: 13 }}>导入文件 / 世界书</b><small style={{ display: 'block', color: C.muted, marginTop: 3 }}>Word、TXT、MD，或直接粘贴设定</small></button>
          </div>}
        </div>
        {error && <div style={{ marginBottom: 12, color: C.blushDeep, fontSize: 12 }}>{error}</div>}
        {importOpen && <section style={{ border: `1px solid ${C.border}`, borderRadius: 16, background: C.white, padding: 14, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}><div><b style={{ color: C.text }}>添加小世界</b><div style={{ color: C.mutedLight, fontSize: 10.5, marginTop: 3 }}>完整世界书直接放进来就行。</div></div><button type="button" onClick={() => setImportOpen(false)} style={{ border: 0, background: 'transparent', color: C.muted }}>×</button></div>
          <textarea value={importText} onChange={event => setImportText(event.target.value)} rows={8} placeholder="直接粘贴完整设定，或者用下面的文件导入。" style={{ width: '100%', boxSizing: 'border-box', border: `1.5px solid ${C.border}`, borderRadius: 13, background: C.surface, color: C.text, padding: '10px 11px', outline: 'none', resize: 'vertical', fontFamily: 'inherit', fontSize: 13, lineHeight: 1.65 }} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
            <input ref={worldFileInputRef} type="file" accept=".docx,.txt,.md,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown" style={{ display: 'none' }} onChange={event => importWorldFile(event.target.files?.[0])} />
            <button type="button" onClick={() => worldFileInputRef.current?.click()} disabled={importingFile} style={{ border: `1px solid ${C.honeyMid}`, borderRadius: 999, background: C.honeyLight, color: C.honeyDeep, padding: '8px 12px', fontFamily: 'inherit' }}>{importingFile ? '读取中' : '选择文件'}</button>
            <button type="button" onClick={() => setImportText(importStarter)} style={{ border: `1px solid ${C.border}`, borderRadius: 999, background: C.surface, color: C.muted, padding: '8px 12px', fontFamily: 'inherit' }}>填模板</button>
            <button type="button" onClick={importWorld} disabled={importingWorld || !importText.trim()} style={{ border: 0, borderRadius: 999, background: `linear-gradient(145deg, ${C.honey}, ${C.honeyDeep})`, color: C.white, padding: '8px 14px', fontFamily: 'inherit', opacity: importingWorld || !importText.trim() ? .55 : 1 }}>{importingWorld ? '添加中' : '放进书架'}</button>
          </div>
        </section>}
        {loadingBooks && <div style={{ color: C.muted, padding: '24px 0', textAlign: 'center' }}>正在整理书架…</div>}
        {!loadingBooks && books.length === 0 && <button type="button" onClick={createBook} style={{ width: '100%', border: `1.5px dashed ${C.honeyMid}`, borderRadius: 16, background: C.white, color: C.honeyDeep, padding: '30px 18px', fontFamily: 'inherit', fontSize: 15 }}>还没有小剧本。点这里创建第一本书。</button>}
        <div className="theater-book-shelf">{books.map((book, index) => <div key={book.id} className={`theater-book-volume theater-book-volume--${index % 4}`}>
          <button type="button" onClick={() => openBook(book.id)} className="theater-book-cover"><span className="theater-book-ornament" aria-hidden="true">✦</span><span className="theater-book-title"><small>OUR LITTLE THEATER · {String(index + 1).padStart(2, '0')}</small><b>{book.title || '未命名小剧本'}</b><i aria-hidden="true" /></span><span className="theater-book-meta"><b>{book.message_count ? `${book.message_count} 条互动` : '等待开场'}</b><small>{book.last_message_at ? formatDate(book.last_message_at) : formatDate(book.created_at)}</small></span></button>
          <button className="theater-book-delete" type="button" onClick={() => deleteBook(book)}>移出书架</button>
        </div>)}</div>
      </section>
    </main>
  );

  const renderSettings = () => {
    const settingsReady = bookDraft.settings.worldbook_text.trim() || bookDraft.settings.premise.trim() || bookDraft.settings.characters.trim();
    return <main style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ flexShrink: 0, borderBottom: `1px solid ${C.border}`, background: C.white, padding: '12px 14px' }}><div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 9 }}>
        <button type="button" onClick={goBackToShelf} style={{ border: 0, background: 'transparent', color: C.honeyDeep, fontFamily: 'inherit' }}>← 书架</button>
        <input value={bookDraft.title} onChange={event => setBookDraft(current => ({ ...current, title: event.target.value }))} style={{ flex: '1 1 180px', minWidth: 0, border: `1px solid ${C.border}`, borderRadius: 999, background: C.surface, color: C.text, padding: '8px 12px', outline: 'none', fontFamily: 'inherit', fontSize: 14 }} />
        <button type="button" onClick={saveBook} disabled={savingBook} style={{ border: `1px solid ${C.border}`, borderRadius: 999, background: C.honeyLight, color: C.honeyDeep, padding: '8px 12px', fontFamily: 'inherit' }}>{savingBook ? '保存中' : '保存'}</button>
      </div></div>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '14px min(16px, 4vw) 24px' }}><section style={{ maxWidth: 760, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ border: `1px solid ${C.border}`, borderRadius: 14, background: C.white, padding: 13 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 12 }}>
            <label><span style={{ display: 'block', color: C.text, fontSize: 13, fontWeight: 700, marginBottom: 6 }}>我在这本书里的名字</span><input value={bookDraft.settings.user_name || ''} onChange={event => patchDraftSettings({ user_name: event.target.value })} placeholder="比如：叶檀、阿苑…" style={{ width: '100%', boxSizing: 'border-box', border: `1.5px solid ${C.border}`, borderRadius: 999, background: C.surface, color: C.text, padding: '8px 12px', outline: 'none', fontFamily: 'inherit', fontSize: 13 }} /></label>
            <label><span style={{ display: 'block', color: C.text, fontSize: 13, fontWeight: 700, marginBottom: 6 }}>对方 / 剧场的名字</span><input value={bookDraft.settings.assistant_name || ''} onChange={event => patchDraftSettings({ assistant_name: event.target.value })} placeholder="比如：陆泽、哥哥、旁白…" style={{ width: '100%', boxSizing: 'border-box', border: `1.5px solid ${C.border}`, borderRadius: 999, background: C.surface, color: C.text, padding: '8px 12px', outline: 'none', fontFamily: 'inherit', fontSize: 13 }} /></label>
          </div>
          <Field theme={C} label="完整世界书" hint={bookDraft.settings.worldbook_text ? `${bookDraft.settings.worldbook_text.length} 字` : '人物、背景、关系、规则都可以放一起'} rows={8} value={bookDraft.settings.worldbook_text} onChange={value => patchDraftSettings({ worldbook_text: value })} placeholder="直接放完整世界书。没有必要先拆成几栏。" />
          <details open={!bookDraft.settings.worldbook_text.trim()} style={{ marginTop: 12, border: `1px solid ${C.borderLight}`, borderRadius: 12, background: C.cream }}><summary style={{ padding: '10px 11px', color: C.honeyDeep, fontSize: 12, cursor: 'pointer', fontWeight: 650 }}>分栏补充（可选）</summary><div style={{ padding: '0 11px 11px' }}><div style={{ color: C.mutedLight, fontSize: 10.5, lineHeight: 1.55, marginBottom: 10 }}>只有想单独补充某一部分时再打开这里。</div><Field theme={C} label="世界观 / 剧情设定" rows={4} value={bookDraft.settings.premise} onChange={value => patchStructuredSetting({ premise: value })} placeholder="可留空" /><div style={{ height: 9 }} /><Field theme={C} label="角色卡 / 关系" rows={4} value={bookDraft.settings.characters} onChange={value => patchStructuredSetting({ characters: value })} placeholder="可留空" /><div style={{ height: 9 }} /><Field theme={C} label="禁区 / 写作规则" rows={4} value={bookDraft.settings.rules} onChange={value => patchStructuredSetting({ rules: value })} placeholder="可留空" /></div></details>
        </div>
        <details style={{ border: `1px solid ${C.border}`, borderRadius: 14, background: C.white, padding: '0 13px' }}><summary style={{ padding: '12px 0', color: C.text, fontWeight: 700, cursor: 'pointer' }}>聊天背景（可选）</summary><div style={{ paddingBottom: 13 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 9 }}><div style={{ color: C.mutedLight, fontSize: 10.5 }}>默认跟随正式 Chat，也可以给这本书单独换气氛。</div><input ref={chatBgInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={event => uploadChatBackground(event.target.files?.[0])} /><button type="button" onClick={() => chatBgInputRef.current?.click()} disabled={uploadingChatBg} style={{ border: `1px solid ${C.honeyMid}`, borderRadius: 999, background: C.honeyLight, color: C.honeyDeep, padding: '7px 11px', fontFamily: 'inherit' }}>{uploadingChatBg ? '上传中' : '上传图'}</button></div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{chatBackgroundOptions.map(([value, label]) => <button key={value} type="button" onClick={() => patchDraftSettings({ chat_background_mode: value })} style={{ border: `1px solid ${bookDraft.settings.chat_background_mode === value ? C.honeyMid : C.border}`, background: bookDraft.settings.chat_background_mode === value ? C.honeyLight : C.surface, color: bookDraft.settings.chat_background_mode === value ? C.honeyDeep : C.muted, borderRadius: 999, padding: '7px 11px', fontFamily: 'inherit' }}>{label}</button>)}<input type="color" value={bookDraft.settings.chat_background_color || '#fff8ef'} onChange={event => patchDraftSettings({ chat_background_mode: 'custom', chat_background_color: event.target.value, chat_background_image_url: '' })} style={{ width: 34, height: 34, borderRadius: 12, border: `1px solid ${C.border}`, background: 'transparent', padding: 0 }} /></div>
          {bookDraft.settings.chat_background_image_url && <button type="button" onClick={() => patchDraftSettings({ chat_background_image_url: '' })} style={{ marginTop: 8, border: 0, background: 'transparent', color: C.muted, fontFamily: 'inherit', fontSize: 11 }}>清除背景图</button>}
        </div></details>
        <div style={{ border: `1px solid ${C.border}`, borderRadius: 14, background: C.white, padding: 13 }}><div style={{ color: C.text, fontWeight: 700, marginBottom: 9 }}>玩法</div><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{[['interactive', '互动'], ['story', '纯文']].map(([value, label]) => <button key={value} type="button" onClick={() => setMode(value)} style={{ border: `1px solid ${mode === value ? C.honeyMid : C.border}`, background: mode === value ? C.honeyLight : C.surface, color: mode === value ? C.honeyDeep : C.muted, borderRadius: 999, padding: '7px 12px', fontFamily: 'inherit' }}>{label}</button>)}</div>
          <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${C.borderLight}` }}><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}><span style={{ color: C.text, fontSize: 12.5, fontWeight: 700 }}>最低回复长度</span><label style={{ display: 'flex', alignItems: 'center', gap: 4, color: C.mutedLight, fontSize: 10.5 }}><input type="number" min="0" max={THEATER_MIN_REPLY_MAX} step="20" value={bookDraft.settings.min_reply_chars} onChange={event => patchDraftSettings({ min_reply_chars: Math.min(THEATER_MIN_REPLY_MAX, Math.max(0, Number(event.target.value) || 0)) })} style={{ width: 68, border: `1px solid ${C.border}`, borderRadius: 8, background: C.surface, color: C.text, padding: '4px 6px', fontFamily: 'inherit', textAlign: 'right' }} /> 字</label></div><input aria-label="这本小剧场的最低回复长度" type="range" min="0" max={THEATER_MIN_REPLY_MAX} step="20" value={bookDraft.settings.min_reply_chars} onChange={event => patchDraftSettings({ min_reply_chars: Number(event.target.value) })} style={{ width: '100%' }} /><div style={{ color: C.mutedLight, fontSize: 10.5, lineHeight: 1.55 }}>这是柔性下限，具体长短仍跟着这一轮剧情走。</div></div>
          {modelControl({ settings: true })}{modelsError && <div style={{ marginTop: 6, color: C.blushDeep, fontSize: 10.5 }}>{modelsError}</div>}
        </div>
        {error && <div style={{ color: C.blushDeep, fontSize: 12 }}>{error}</div>}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: 10 }}><button type="button" onClick={saveBook} disabled={savingBook} style={{ minHeight: 46, border: `1px solid ${C.border}`, borderRadius: 14, background: C.surface, color: C.honeyDeep, fontFamily: 'inherit' }}>{savingBook ? '保存中' : '只保存'}</button><button type="button" onClick={async () => { if (await saveBook()) setBookPane('chat'); }} disabled={savingBook} style={{ minHeight: 46, border: 0, borderRadius: 14, background: `linear-gradient(145deg, ${C.honey}, ${C.honeyDeep})`, color: C.white, fontFamily: 'inherit', opacity: savingBook ? .65 : 1 }}>{settingsReady ? '进入 chat' : '先这样开始 chat'}</button></div>
      </section></div>
    </main>;
  };

  const renderChat = () => <main style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: 0 }}>
    <div style={{ position: 'relative', flex: 1, minHeight: 0, overflow: 'hidden', ...theaterChatBackgroundStyle() }}>
      <div ref={chatScrollerRef} onScroll={handleChatScroll} style={{ position: 'absolute', inset: 0, overflowY: 'auto', overscrollBehaviorY: 'contain', WebkitOverflowScrolling: 'touch', padding: '16px 14px 8px' }}>
        {messages.length === 0 && <div style={{ color: C.muted, fontSize: 13, lineHeight: 1.8, padding: '30px 10px', textAlign: 'center' }}>这本书还没有开演。直接说从哪里开始就好。</div>}
        {messages.map((message, index) => {
          const isMe = message.role === 'user';
          const isLast = index === messages.length - 1;
          return <div key={message.id} style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 120px' }}>
            <div style={{ display: 'flex', marginBottom: 14, flexDirection: isMe ? 'row-reverse' : 'row', alignItems: 'flex-end', gap: 6 }}>
              <TheaterAvatar isMe={isMe} src={isMe ? myAvatar : partnerAvatar} theme={C} />
              <div style={{ maxWidth: '72%', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ padding: '10px 14px', fontSize: 14.5, lineHeight: 1.72, color: C.text, borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px', background: isMe ? (myBubbleColor || C.blush) : (partnerBubbleColor || C.white), border: `1px solid ${isMe ? '#F5CABB' : C.border}`, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{message.content}</div>
                {!isMe && isLast && <button type="button" onClick={() => regenerateMessage(message)} disabled={chatting || Boolean(regeneratingMessageId) || messageActionLoading} style={{ border: 0, padding: '3px 0', background: 'transparent', fontSize: 10.5, color: C.muted, cursor: chatting || regeneratingMessageId ? 'default' : 'pointer', alignSelf: 'flex-start', fontFamily: 'inherit', opacity: chatting || regeneratingMessageId ? .55 : 1 }}>{String(regeneratingMessageId) === String(message.id) ? '重新生成中…' : '↻ 重新生成'}</button>}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start', gap: 4, flexShrink: 0 }}>
                <span style={{ fontSize: 9.5, color: C.mutedLight }}>{formatClock(message.created_at)}</span>
                <button type="button" onClick={() => openMessageActions(message)} disabled={chatting || messageActionLoading || Boolean(regeneratingMessageId)} aria-label="打开小剧场消息操作" title="编辑或回到这里" style={{ width: 40, height: 40, border: 0, borderRadius: 999, background: 'transparent', color: C.muted, cursor: chatting || messageActionLoading ? 'default' : 'pointer', opacity: .78, fontSize: 20, lineHeight: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 1, fontFamily: 'inherit' }}><span aria-hidden="true" style={{ transform: 'translateY(-2px)' }}>⌄</span></button>
              </div>
            </div>
          </div>;
        })}
        {chatting && <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, marginBottom: 14 }}><TheaterAvatar isMe={false} src={partnerAvatar} theme={C} /><div style={{ padding: '10px 16px', borderRadius: '18px 18px 18px 4px', background: partnerBubbleColor || C.white, border: `1px solid ${C.border}`, fontSize: 12, color: C.muted, letterSpacing: '.12em', fontStyle: 'italic' }}>{editingMessage ? '正在按修改后的内容重新接戏…' : '穿越中…'}</div></div>}
        <div ref={chatEndRef} />
      </div>
    </div>

    <div className="ourhome-safe-bottom" style={{ background: C.white, borderTop: `1px solid ${C.border}`, paddingTop: 10, paddingLeft: 14, paddingRight: 14, flexShrink: 0 }}>
      {messages.length > 3 && !nearLatest && <div className="theater-latest-row" style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 2px 8px' }}><button type="button" onClick={() => scrollToLatest('smooth')} aria-label="跳到小剧场最新消息" style={{ border: `1px solid ${C.border}`, borderRadius: 999, background: C.white, color: C.honeyDeep, boxShadow: '0 4px 12px rgba(46,31,18,.14)', padding: '6px 10px', fontFamily: 'inherit', fontSize: 11 }}>最新</button></div>}
      {editingMessage && <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, padding: '8px 10px', borderRadius: 12, background: C.honeyLight, border: `1px solid ${C.honeyMid}` }}><div style={{ flex: 1, minWidth: 0 }}><div style={{ color: C.honeyDeep, fontSize: 11.5, fontWeight: 700 }}>正在重新编辑这条消息</div><div style={{ color: C.muted, fontSize: 10, marginTop: 2 }}>发送后会从这里重新接剧情，后面的 {editingMessage.afterCount} 条会收进旧分支。</div></div><button type="button" onClick={cancelEditMessage} disabled={messageActionLoading} style={{ flexShrink: 0, minWidth: 44, minHeight: 34, border: 0, borderRadius: 999, background: C.surface, color: C.muted, fontFamily: 'inherit', fontSize: 11 }}>取消</button></div>}
      {rollbackUndo && <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, padding: '8px 10px', borderRadius: 12, background: C.honeyLight, border: `1px solid ${C.honeyMid}` }}><span style={{ flex: 1, color: C.honeyDeep, fontSize: 11, lineHeight: 1.5 }}>已回到这里，收起了 {rollbackUndo.hiddenMessages.length} 条消息。</span><button type="button" onClick={undoRollback} disabled={messageActionLoading} style={{ minWidth: 52, minHeight: 34, border: `1px solid ${C.honeyMid}`, borderRadius: 999, background: C.white, color: C.honeyDeep, fontFamily: 'inherit', fontSize: 11, fontWeight: 700 }}>撤销</button></div>}
      {error && <div role="alert" style={{ marginBottom: 8, padding: '7px 10px', borderRadius: 10, background: 'rgba(214,120,104,.1)', color: C.blushDeep, fontSize: 10.5, lineHeight: 1.5 }}>{error}</div>}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, background: C.surface, border: `1.5px solid ${editingMessage ? C.honey : C.border}`, borderRadius: 22, padding: '6px 6px 6px 10px' }}><textarea value={chatInput} onChange={event => setChatInput(event.target.value)} rows={1} placeholder={editingMessage ? '修改好后重新发送…' : '在云端漫游'} style={{ flex: 1, maxHeight: 120, border: 'none', outline: 'none', background: 'transparent', color: C.text, resize: 'none', fontFamily: 'inherit', fontSize: 14.5, lineHeight: 1.5, padding: '6px 0' }} /><button type="button" onClick={() => sendChat()} disabled={chatting || messageActionLoading || !chatInput.trim()} aria-label={editingMessage ? '重新发送修改后的小剧场消息' : '发送小剧场消息'} style={{ width: 36, height: 36, border: 'none', borderRadius: '50%', background: chatInput.trim() && !chatting && !messageActionLoading ? `linear-gradient(150deg, ${C.honey}, ${C.honeyDeep})` : C.honeyMid, color: C.white, fontFamily: 'inherit', opacity: chatting || messageActionLoading ? .62 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>↑</button></div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, paddingLeft: 2 }}>{modelControl()}<button type="button" title={lastOutputTokens ? `最近一轮生成 ${lastOutputTokens.toLocaleString('zh-CN')} tokens` : '最近一轮上下文用量'} style={{ minWidth: 86, height: 26, flexShrink: 0, borderRadius: 999, border: `1px solid ${C.border}`, background: 'transparent', color: C.muted, padding: '0 9px', fontFamily: 'inherit', fontSize: 9.5, whiteSpace: 'nowrap' }}>◎ 上下文 {compactUsageNumber(lastContextTokens)}</button></div>
    </div>
  </main>;

  return <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', opacity: visible ? 1 : 0, pointerEvents: visible ? 'auto' : 'none', transition: 'opacity .4s ease', background: C.cream }}>
    <header className="ourhome-safe-top theater-chat-header" style={{ background: C.white, borderBottom: `1px solid ${C.border}`, paddingLeft: 16, paddingRight: 16, flexShrink: 0 }}>
      <div className="theater-chat-header-row" style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 10 }}>
        <div style={{ display: 'flex', gap: 5 }}><button type="button" onClick={selectedBook ? goBackToShelf : leaveRoom} aria-label={selectedBook ? '回到剧场书架' : '回到主页'} style={{ fontSize: 18, color: C.honeyDeep, background: 'transparent', border: 0, padding: 4, width: 30, height: 30, cursor: 'pointer' }}>←</button></div>
        <div className="theater-chat-header-title" style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: 'min(58vw, 360px)', textAlign: 'center', pointerEvents: 'none' }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: C.text, letterSpacing: '.04em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedBook ? selectedBook.title : '小剧场'}</div>
          <div style={{ fontSize: 10, color: chatting ? C.honey : C.muted, letterSpacing: '.12em', marginTop: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}><div style={{ width: 5, height: 5, borderRadius: '50%', background: chatting ? C.honey : C.mutedLight, boxShadow: chatting ? `0 0 5px ${C.honey}` : 'none', transition: 'background .3s, box-shadow .3s' }} /><span>{selectedBook ? (bookPane === 'chat' ? (chatting ? '穿越中…' : '穿越平行时空') : '小剧场设定') : 'theater bookshelf'}</span></div>
        </div>
        <div className="theater-chat-header-actions" style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
          {selectedBook && bookPane === 'chat' && <button type="button" onClick={() => setBookPane('settings')} aria-label="打开小剧场设定" title="设定" style={{ fontSize: 20, lineHeight: 1, color: C.honeyDeep, background: C.honeyLight, border: `1px solid ${C.honeyMid}`, borderRadius: 10, width: 30, height: 30, padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Arial, sans-serif' }}>♡</button>}
          <button type="button" onClick={loadBooks} disabled={loadingBooks} aria-label="刷新小剧场书架和消息" title="刷新小剧场书架和消息" style={{ fontSize: 19, lineHeight: 1, color: C.honeyDeep, background: C.honeyLight, border: `1px solid ${C.honeyMid}`, borderRadius: 10, width: 30, height: 30, padding: 0, cursor: loadingBooks ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: loadingBooks ? .55 : 1, fontFamily: 'Arial, sans-serif' }}>{loadingBooks ? '…' : '↻'}</button>
        </div>
      </div>
      <Stars theme={C} />
    </header>
    {selectedBook ? (bookPane === 'settings' ? renderSettings() : renderChat()) : renderShelf()}
    <MessageActionSheet action={messageAction} loading={messageActionLoading} error={messageActionError} theme={C} setAction={setMessageAction} startEditMessage={startEditMessage} confirmRollback={confirmRollback} userName={userDisplayName} assistantName={assistantDisplayName} rollbackNote="只调整这本小剧场的剧情分支；旧消息和旧记忆会保留为归档，不会直接删除。" />
  </div>;
}

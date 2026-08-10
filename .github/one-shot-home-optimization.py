from pathlib import Path
import re


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)


app_path = Path('src/App.jsx')
app = app_path.read_text()

old_load = '''  const loadMessagesFor = (id) => {
    setSessionSummaryError('');
    return Promise.all([
      apiFetch(`${BACKEND}/sessions/${id}/messages`).then(r => r.json()),
      apiFetch(`${BACKEND}/sessions/${id}/summary`).then(r => r.json()).catch(() => null),
    ])
      .then(([data, summary]) => {
        const mapped = (Array.isArray(data) ? data : []).map(mapDbMessage);
        setMsgs(mapped);
        setVisible(mapped.length);
        setHasHistory(mapped.length > 0);
        setSessionSummary(summary && summary.id ? summary : null);
        scrollChatToBottomNow();
      });
  };'''
new_load = '''  const loadMessagesFor = (id) => {
    const targetSessionId = String(id);
    setSessionSummaryError('');
    return Promise.all([
      apiFetch(`${BACKEND}/sessions/${id}/messages`).then(r => r.json()),
      apiFetch(`${BACKEND}/sessions/${id}/summary`).then(r => r.json()).catch(() => null),
    ])
      .then(([data, summary]) => {
        const mapped = (Array.isArray(data) ? data : []).map(mapDbMessage);
        if (String(sessionIdRef.current) !== targetSessionId) return mapped;
        setMsgs(mapped);
        setVisible(mapped.length);
        setHasHistory(mapped.length > 0);
        setSessionSummary(summary && summary.id ? summary : null);
        scrollChatToBottomNow();
        return mapped;
      });
  };'''
app = replace_once(app, old_load, new_load, 'session load race guard')

app = replace_once(
    app,
    '''    loadMessagesFor(targetSessionId)
      .then(() => {
        if (targetMessageId) {''',
    '''    loadMessagesFor(targetSessionId)
      .then(() => {
        if (String(sessionIdRef.current) !== String(targetSessionId)) return;
        if (targetMessageId) {''',
    'notification stale load guard',
)

app = replace_once(
    app,
    '''        if (target) {
          setSessionId(target.id);
          localStorage.setItem(SESSION_KEY, target.id);''',
    '''        if (target) {
          sessionIdRef.current = target.id;
          setSessionId(target.id);
          localStorage.setItem(SESSION_KEY, target.id);''',
    'initial session ref',
)

app = replace_once(
    app,
    '''            .then(data => {
              setSessionId(data.id);
              localStorage.setItem(SESSION_KEY, data.id);
              setSessions([data]);''',
    '''            .then(data => {
              sessionIdRef.current = data.id;
              setSessionId(data.id);
              localStorage.setItem(SESSION_KEY, data.id);
              setSessions([data]);''',
    'created initial session ref',
)

old_switch = '''  const switchSession = (id) => {
    if (id === sessionId) { setDrawerOpen(false); return; }
    if (editingMessage) {
      setInput(editingMessage.draftBefore || "");
      setPendingFile(editingMessage.pendingFileBefore || null);
    }
    setEditingMessage(null);
    setMessageAction(null);
    setRollbackUndo(null);
    setMessageActionError("");
    setTokenUsageOpen(false);
    chatStickToBottomRef.current = true;
    sessionIdRef.current = id;
    setSessionId(id);
    localStorage.setItem(SESSION_KEY, id);
    apiFetch(`${BACKEND}/sessions/${id}/messages`)
      .then(r => r.json())
      .then(data => {
        const mapped = (Array.isArray(data) ? data : []).map(mapDbMessage);
        setMsgs(mapped);
        setVisible(mapped.length);
        setHasHistory(mapped.length > 0);
        scrollChatToBottomNow();
      })
      .catch(console.error);
    setDrawerOpen(false);
  };'''
new_switch = '''  const switchSession = (id) => {
    if (String(id) === String(sessionId)) { setDrawerOpen(false); return; }
    if (editingMessage) {
      setInput(editingMessage.draftBefore || "");
      setPendingFile(editingMessage.pendingFileBefore || null);
    }
    setEditingMessage(null);
    setMessageAction(null);
    setRollbackUndo(null);
    setMessageActionError("");
    setSessionSummary(null);
    setTokenUsageOpen(false);
    chatStickToBottomRef.current = true;
    sessionIdRef.current = id;
    setSessionId(id);
    localStorage.setItem(SESSION_KEY, id);
    loadMessagesFor(id).catch(console.error);
    setDrawerOpen(false);
  };'''
app = replace_once(app, old_switch, new_switch, 'session switch centralization')

app = replace_once(
    app,
    '''      .then(() => {
        fetchSessions();
        if (id === sessionId) {''',
    '''      .then(() => {
        localStorage.removeItem(`ourhome_chat_draft:${id}`);
        fetchSessions();
        if (String(id) === String(sessionId)) {''',
    'deleted session draft cleanup',
)

app = replace_once(
    app,
    '''                setHasHistory(false);
                setSessionId(null);
                apiFetch(`${BACKEND}/sessions`, {''',
    '''                setHasHistory(false);
                sessionIdRef.current = null;
                setSessionId(null);
                apiFetch(`${BACKEND}/sessions`, {''',
    'deleted last session ref reset',
)

app = replace_once(
    app,
    '''                  .then(data => {
                    setSessionId(data.id);
                    localStorage.setItem(SESSION_KEY, data.id);
                    fetchSessions();''',
    '''                  .then(data => {
                    sessionIdRef.current = data.id;
                    setSessionId(data.id);
                    localStorage.setItem(SESSION_KEY, data.id);
                    fetchSessions();''',
    'replacement daily session ref',
)

old_pick = '''  const pickFile = (file) => {
    if (!file) return;
    setImageUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    apiFetch(`${BACKEND}/upload`, { method: 'POST', body: formData })
      .then(r => r.json())
      .then(data => {
        setPendingFile({ url: data.url, type: data.type, name: data.name });
        setImageUploading(false);
      })
      .catch(err => { console.error(err); setImageUploading(false); });
  };'''
new_pick = '''  const pickFile = (file) => {
    if (!file) return;
    const uploadSessionId = sessionIdRef.current;
    setImageUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    apiFetch(`${BACKEND}/upload`, { method: 'POST', body: formData })
      .then(r => r.json())
      .then(data => {
        if (String(sessionIdRef.current) === String(uploadSessionId)) {
          setPendingFile({ url: data.url, type: data.type, name: data.name });
        }
        setImageUploading(false);
      })
      .catch(err => { console.error(err); setImageUploading(false); });
  };'''
app = replace_once(app, old_pick, new_pick, 'attachment upload session guard')

old_jump = '''  const jumpToSearchResult = (r) => {
    setSearchOpen(false);
    const jump = { id: r.id, query: lastSearchQuery || searchQuery.trim() };
    if (r.session_id === sessionId) {
      setPendingSearchJump(jump);
    } else {
      setSessionId(r.session_id);
      localStorage.setItem(SESSION_KEY, r.session_id);
      setPendingSearchJump(jump);
      loadMessagesFor(r.session_id).catch(console.error);
    }
  };'''
new_jump = '''  const jumpToSearchResult = (r) => {
    setSearchOpen(false);
    const jump = { id: r.id, query: lastSearchQuery || searchQuery.trim() };
    if (String(r.session_id) === String(sessionId)) {
      setPendingSearchJump(jump);
    } else {
      setPendingSearchJump(jump);
      switchSession(r.session_id);
    }
  };'''
app = replace_once(app, old_jump, new_jump, 'search jump session routing')

app_path.write_text(app)


chat_path = Path('src/ChatRoom.jsx')
chat = chat_path.read_text()
chat = replace_once(
    chat,
    '''const CHAT_DRAFT_PREFIX = 'ourhome_chat_draft:';
const conversationCache = new Map();

function chatDraftKey(sessionId) {''',
    '''const CHAT_DRAFT_PREFIX = 'ourhome_chat_draft:';
const CHAT_CACHE_LIMIT = 12;
const conversationCache = new Map();
const pendingAttachmentCache = new Map();

function rememberCache(cache, key, value) {
  if (!key) return;
  cache.delete(key);
  cache.set(key, value);
  while (cache.size > CHAT_CACHE_LIMIT) {
    cache.delete(cache.keys().next().value);
  }
}

function readCache(cache, key) {
  if (!key || !cache.has(key)) return undefined;
  const value = cache.get(key);
  cache.delete(key);
  cache.set(key, value);
  return value;
}

function chatDraftKey(sessionId) {''',
    'bounded chat caches',
)

chat = replace_once(
    chat,
    '''  const [cachedSessionId, setCachedSessionId] = useState(null);
  const draftSessionRef = useRef(null);
  const messagesAtSessionChangeRef = useRef(msgs);''',
    '''  const [cachedSessionId, setCachedSessionId] = useState(null);
  const draftSessionRef = useRef(null);
  const attachmentSessionRef = useRef(null);
  const messagesAtSessionChangeRef = useRef(msgs);''',
    'attachment session ref',
)

chat = replace_once(
    chat,
    '''    messagesAtSessionChangeRef.current = msgs;
    waitingForFreshMessagesRef.current = true;
    setCachedSessionId(sessionId);
    setCachedConversation(conversationCache.get(String(sessionId)) || []);
  }, [sessionId]);''',
    '''    messagesAtSessionChangeRef.current = msgs;
    waitingForFreshMessagesRef.current = true;
    setCachedSessionId(sessionId);
    setCachedConversation(readCache(conversationCache, String(sessionId)) || []);
  }, [sessionId]);''',
    'read cached conversation as LRU',
)

chat = replace_once(
    chat,
    '''    const stableMessages = msgs.filter(message => !String(message?.id || '').startsWith('temp-'));
    conversationCache.set(String(sessionId), stableMessages);
  }, [msgs, sessionId]);

  useEffect(() => {
    if (!sessionId || editingMessage || draftSessionRef.current === sessionId) return;''',
    '''    const stableMessages = msgs.filter(message => !String(message?.id || '').startsWith('temp-'));
    rememberCache(conversationCache, String(sessionId), stableMessages);
  }, [msgs, sessionId]);

  useEffect(() => {
    const previousKey = attachmentSessionRef.current;
    const nextKey = sessionId ? String(sessionId) : null;
    if (previousKey && previousKey !== nextKey) {
      if (pendingFile) rememberCache(pendingAttachmentCache, previousKey, pendingFile);
      else pendingAttachmentCache.delete(previousKey);
    }
    attachmentSessionRef.current = nextKey;
    if (!nextKey || editingMessage) return;
    setPendingFile(readCache(pendingAttachmentCache, nextKey) || null);
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId || editingMessage || String(draftSessionRef.current) === String(sessionId)) return;''',
    'per-session attachment restoration',
)

chat = replace_once(
    chat,
    '''    draftSessionRef.current = sessionId;
    try {''',
    '''    draftSessionRef.current = sessionId;
    try {''',
    'draft ref normalization anchor',
)

chat = replace_once(
    chat,
    '''  const sendWithDraftCleanup = model => {
    if (!editingMessage && sessionId) {
      try { localStorage.removeItem(chatDraftKey(sessionId)); } catch { /* ignore storage failures */ }
    }
    return send(model);
  };''',
    '''  const sendWithDraftCleanup = model => {
    if (!editingMessage && sessionId) {
      try { localStorage.removeItem(chatDraftKey(sessionId)); } catch { /* ignore storage failures */ }
      pendingAttachmentCache.delete(String(sessionId));
    }
    return send(model);
  };''',
    'attachment cleanup on send',
)

chat_path.write_text(chat)


test_path = Path('scripts/app-shell-regression.test.mjs')
tests = test_path.read_text()
tests = replace_once(
    tests,
    '''const [manifestText, install, native, styles, finalHeaders, config, androidManifest, themeContext, root, vault, offline, installSettings, gradle] = await Promise.all([''',
    '''const [manifestText, install, native, styles, finalHeaders, config, androidManifest, themeContext, root, app, chatRoom, roomBoundary, vault, offline, installSettings, gradle] = await Promise.all([''',
    'regression source variables',
)
tests = replace_once(
    tests,
    '''  readFile(new URL('../src/Root.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/VaultPage.jsx', import.meta.url), 'utf8'),''',
    '''  readFile(new URL('../src/Root.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/App.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/ChatRoom.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/RoomBoundary.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/VaultPage.jsx', import.meta.url), 'utf8'),''',
    'regression source reads',
)

tests = replace_once(
    tests,
    '''test('home shelf uses one DOM observer for all injected room entries', () => {
  assert.equal((root.match(/useHomeShelfTarget\\(\\)/g) || []).length, 2);
  assert.match(root, /function HomeShelfEntries/);
});''',
    '''test('home shelf uses one observer and stops its retry timer after discovery', () => {
  assert.equal((root.match(/useHomeShelfTarget\\(\\)/g) || []).length, 2);
  assert.match(root, /function HomeShelfEntries/);
  assert.match(root, /const stopRetry =/);
  assert.match(root, /stopRetry\\(\\);\\n      observer\\?\\.disconnect\\(\\)/);
});

test('core App defers its first mount but stays alive after the first core-room visit', () => {
  assert.match(root, /persistentAppMounted/);
  assert.match(root, /setPersistentAppMounted\\(true\\)/);
  assert.match(root, /\\{persistentAppMounted && \\(/);
  assert.doesNotMatch(root, /<App key=\\{room\\}/);
});

test('room recovery is isolated when navigating between persistent rooms', () => {
  assert.match(roomBoundary, /componentDidUpdate\\(previousProps\\)/);
  assert.match(roomBoundary, /previousProps\\.room !== this\\.props\\.room/);
});

test('Chat ignores stale session reads and routes search jumps through normal switching', () => {
  assert.match(app, /const targetSessionId = String\\(id\\)/);
  assert.match(app, /String\\(sessionIdRef\\.current\\) !== targetSessionId/);
  assert.match(app, /setSessionSummary\\(null\\)/);
  assert.match(app, /loadMessagesFor\\(id\\)\\.catch\\(console\\.error\\)/);
  assert.match(app, /switchSession\\(r\\.session_id\\)/);
});

test('Chat scopes attachments to their conversation and bounds memory caches', () => {
  assert.match(chatRoom, /CHAT_CACHE_LIMIT = 12/);
  assert.match(chatRoom, /pendingAttachmentCache/);
  assert.match(chatRoom, /attachmentSessionRef/);
  assert.match(chatRoom, /while \\(cache\\.size > CHAT_CACHE_LIMIT\\)/);
  assert.match(app, /const uploadSessionId = sessionIdRef\\.current/);
  assert.match(app, /String\\(sessionIdRef\\.current\\) === String\\(uploadSessionId\\)/);
  assert.match(app, /localStorage\\.removeItem\\(`ourhome_chat_draft:\\$\\{id\\}`\\)/);
});''',
    'expanded home and chat regression coverage',
)

test_path.write_text(tests)

from pathlib import Path


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 exact match, found {count}')
    return text.replace(old, new, 1)

app_path = Path('src/App.jsx')
chat_path = Path('src/ChatRoom.jsx')
test_path = Path('scripts/app-shell-regression.test.mjs')

app = app_path.read_text()
chat = chat_path.read_text()
test = test_path.read_text()

app = replace_once(
    app,
    '''  const loadMessagesFor = (id) => {\n    setSessionSummaryError('');\n    return Promise.all([\n      apiFetch(`${BACKEND}/sessions/${id}/messages`).then(r => r.json()),\n      apiFetch(`${BACKEND}/sessions/${id}/summary`).then(r => r.json()).catch(() => null),\n    ])\n      .then(([data, summary]) => {\n        const mapped = (Array.isArray(data) ? data : []).map(mapDbMessage);\n        setMsgs(mapped);\n        setVisible(mapped.length);\n        setHasHistory(mapped.length > 0);\n        setSessionSummary(summary && summary.id ? summary : null);\n        scrollChatToBottomNow();\n      });\n  };''',
    '''  const loadMessagesFor = (id) => {\n    const targetSessionId = String(id);\n    setSessionSummaryError('');\n    return Promise.all([\n      apiFetch(`${BACKEND}/sessions/${id}/messages`).then(r => r.json()),\n      apiFetch(`${BACKEND}/sessions/${id}/summary`).then(r => r.json()).catch(() => null),\n    ])\n      .then(([data, summary]) => {\n        const mapped = (Array.isArray(data) ? data : []).map(mapDbMessage);\n        if (String(sessionIdRef.current) !== targetSessionId) return mapped;\n        setMsgs(mapped);\n        setVisible(mapped.length);\n        setHasHistory(mapped.length > 0);\n        setSessionSummary(summary && summary.id ? summary : null);\n        scrollChatToBottomNow();\n        return mapped;\n      });\n  };''',
    'guard loadMessagesFor',
)

app = replace_once(
    app,
    '''    loadMessagesFor(targetSessionId)\n      .then(() => {\n        if (targetMessageId) {''',
    '''    loadMessagesFor(targetSessionId)\n      .then(() => {\n        if (String(sessionIdRef.current) !== String(targetSessionId)) return;\n        if (targetMessageId) {''',
    'guard notification jump',
)

app = replace_once(
    app,
    '''        if (target) {\n          setSessionId(target.id);\n          localStorage.setItem(SESSION_KEY, target.id);''',
    '''        if (target) {\n          sessionIdRef.current = target.id;\n          setSessionId(target.id);\n          localStorage.setItem(SESSION_KEY, target.id);''',
    'prime initial session ref',
)

app = replace_once(
    app,
    '''            .then(data => {\n              setSessionId(data.id);\n              localStorage.setItem(SESSION_KEY, data.id);\n              setSessions([data]);''',
    '''            .then(data => {\n              sessionIdRef.current = data.id;\n              setSessionId(data.id);\n              localStorage.setItem(SESSION_KEY, data.id);\n              setSessions([data]);''',
    'prime created initial session ref',
)

app = replace_once(
    app,
    '''  const switchSession = (id) => {\n    if (id === sessionId) { setDrawerOpen(false); return; }\n    if (editingMessage) {\n      setInput(editingMessage.draftBefore || "");\n      setPendingFile(editingMessage.pendingFileBefore || null);\n    }\n    setEditingMessage(null);\n    setMessageAction(null);\n    setRollbackUndo(null);\n    setMessageActionError("");\n    setTokenUsageOpen(false);\n    chatStickToBottomRef.current = true;\n    sessionIdRef.current = id;\n    setSessionId(id);\n    localStorage.setItem(SESSION_KEY, id);\n    apiFetch(`${BACKEND}/sessions/${id}/messages`)\n      .then(r => r.json())\n      .then(data => {\n        const mapped = (Array.isArray(data) ? data : []).map(mapDbMessage);\n        setMsgs(mapped);\n        setVisible(mapped.length);\n        setHasHistory(mapped.length > 0);\n        scrollChatToBottomNow();\n      })\n      .catch(console.error);\n    setDrawerOpen(false);\n  };''',
    '''  const switchSession = (id) => {\n    const targetSessionId = String(id);\n    if (String(sessionId) === targetSessionId) { setDrawerOpen(false); return; }\n    if (editingMessage) {\n      setInput(editingMessage.draftBefore || "");\n      setPendingFile(editingMessage.pendingFileBefore || null);\n    }\n    setEditingMessage(null);\n    setMessageAction(null);\n    setRollbackUndo(null);\n    setMessageActionError("");\n    setTokenUsageOpen(false);\n    setSessionSummary(null);\n    chatStickToBottomRef.current = true;\n    sessionIdRef.current = id;\n    setSessionId(id);\n    localStorage.setItem(SESSION_KEY, id);\n    loadMessagesFor(id).catch(console.error);\n    setDrawerOpen(false);\n  };''',
    'centralize switchSession loading',
)

app = replace_once(
    app,
    '''      .then(() => {\n        fetchSessions();\n        if (id === sessionId) {\n          localStorage.removeItem(SESSION_KEY);''',
    '''      .then(() => {\n        fetchSessions();\n        try { localStorage.removeItem(`ourhome_chat_draft:${id}`); } catch { /* ignore storage cleanup failures */ }\n        if (String(id) === String(sessionId)) {\n          localStorage.removeItem(SESSION_KEY);''',
    'clean deleted session draft',
)

app = replace_once(
    app,
    '''                setMsgs([]);\n                setVisible(0);\n                setHasHistory(false);\n                setSessionId(null);''',
    '''                setMsgs([]);\n                setVisible(0);\n                setHasHistory(false);\n                sessionIdRef.current = null;\n                setSessionId(null);''',
    'clear deleted session ref',
)

app = replace_once(
    app,
    '''                  .then(data => {\n                    setSessionId(data.id);\n                    localStorage.setItem(SESSION_KEY, data.id);\n                    fetchSessions();''',
    '''                  .then(data => {\n                    sessionIdRef.current = data.id;\n                    setSessionId(data.id);\n                    localStorage.setItem(SESSION_KEY, data.id);\n                    fetchSessions();''',
    'prime replacement session ref',
)

app = replace_once(
    app,
    '''  const pickFile = (file) => {\n    if (!file) return;\n    setImageUploading(true);\n    const formData = new FormData();\n    formData.append('file', file);\n    apiFetch(`${BACKEND}/upload`, { method: 'POST', body: formData })\n      .then(r => r.json())\n      .then(data => {\n        setPendingFile({ url: data.url, type: data.type, name: data.name });\n        setImageUploading(false);\n      })\n      .catch(err => { console.error(err); setImageUploading(false); });\n  };''',
    '''  const pickFile = (file) => {\n    if (!file) return;\n    const uploadSessionId = sessionIdRef.current;\n    setImageUploading(true);\n    const formData = new FormData();\n    formData.append('file', file);\n    apiFetch(`${BACKEND}/upload`, { method: 'POST', body: formData })\n      .then(r => r.json())\n      .then(data => {\n        if (String(sessionIdRef.current) === String(uploadSessionId)) {\n          setPendingFile({ url: data.url, type: data.type, name: data.name });\n        }\n        setImageUploading(false);\n      })\n      .catch(err => { console.error(err); setImageUploading(false); });\n  };''',
    'scope upload result to session',
)

app = replace_once(
    app,
    '''    if (r.session_id === sessionId) {\n      setPendingSearchJump(jump);\n    } else {\n      setSessionId(r.session_id);\n      localStorage.setItem(SESSION_KEY, r.session_id);\n      setPendingSearchJump(jump);\n      loadMessagesFor(r.session_id).catch(console.error);\n    }''',
    '''    if (String(r.session_id) === String(sessionId)) {\n      setPendingSearchJump(jump);\n    } else {\n      setPendingSearchJump(jump);\n      switchSession(r.session_id);\n    }''',
    'route search jumps through switchSession',
)

chat = replace_once(
    chat,
    '''const CHAT_DRAFT_PREFIX = 'ourhome_chat_draft:';\nconst conversationCache = new Map();''',
    '''const CHAT_DRAFT_PREFIX = 'ourhome_chat_draft:';\nconst MAX_CHAT_SESSION_CACHE = 12;\nconst conversationCache = new Map();\nconst pendingAttachmentCache = new Map();\n\nfunction setBoundedSessionCache(cache, sessionId, value) {\n  const key = String(sessionId || '');\n  if (!key) return;\n  cache.delete(key);\n  if (value == null) return;\n  cache.set(key, value);\n  while (cache.size > MAX_CHAT_SESSION_CACHE) {\n    cache.delete(cache.keys().next().value);\n  }\n}''',
    'bound Chat caches',
)

chat = replace_once(
    chat,
    '''  const draftSessionRef = useRef(null);\n  const messagesAtSessionChangeRef = useRef(msgs);''',
    '''  const draftSessionRef = useRef(null);\n  const attachmentSessionRef = useRef(null);\n  const messagesAtSessionChangeRef = useRef(msgs);''',
    'track attachment session',
)

chat = replace_once(
    chat,
    '''    const stableMessages = msgs.filter(message => !String(message?.id || '').startsWith('temp-'));\n    conversationCache.set(String(sessionId), stableMessages);\n  }, [msgs, sessionId]);\n\n  useEffect(() => {\n    if (!sessionId || editingMessage || draftSessionRef.current === sessionId) return;''',
    '''    const stableMessages = msgs.filter(message => !String(message?.id || '').startsWith('temp-'));\n    setBoundedSessionCache(conversationCache, sessionId, stableMessages);\n  }, [msgs, sessionId]);\n\n  useEffect(() => {\n    const currentSessionKey = sessionId ? String(sessionId) : '';\n    const previousSessionKey = attachmentSessionRef.current;\n    if (previousSessionKey && previousSessionKey !== currentSessionKey) {\n      setBoundedSessionCache(pendingAttachmentCache, previousSessionKey, pendingFile || null);\n    }\n    attachmentSessionRef.current = currentSessionKey || null;\n    if (!currentSessionKey || editingMessage) return;\n    setPendingFile(pendingAttachmentCache.get(currentSessionKey) || null);\n  }, [sessionId]);\n\n  useEffect(() => {\n    if (!sessionId || editingMessage || draftSessionRef.current === sessionId) return;''',
    'scope pending attachments by session',
)

chat = replace_once(
    chat,
    '''  const sendWithDraftCleanup = model => {\n    if (!editingMessage && sessionId) {\n      try { localStorage.removeItem(chatDraftKey(sessionId)); } catch { /* ignore storage failures */ }\n    }\n    return send(model);\n  };''',
    '''  const sendWithDraftCleanup = model => {\n    if (!editingMessage && sessionId) {\n      try { localStorage.removeItem(chatDraftKey(sessionId)); } catch { /* ignore storage failures */ }\n      pendingAttachmentCache.delete(String(sessionId));\n    }\n    return send(model);\n  };''',
    'clear attachment cache after send',
)

# Extend app-shell regression coverage with ChatRoom source and the new invariants.
test = replace_once(
    test,
    '''const [manifestText, install, native, styles, finalHeaders, config, androidManifest, themeContext, root, vault, offline, installSettings, gradle, appUpdate, updaterPlugin, mainActivity, androidWorkflow, nativeNotifications, notificationsPlugin, reminderReceiver, appSource, settingsSource] = await Promise.all([''',
    '''const [manifestText, install, native, styles, finalHeaders, config, androidManifest, themeContext, root, vault, offline, installSettings, gradle, appUpdate, updaterPlugin, mainActivity, androidWorkflow, nativeNotifications, notificationsPlugin, reminderReceiver, appSource, settingsSource, chatRoomSource] = await Promise.all([''',
    'add ChatRoom test source binding',
)

test = replace_once(
    test,
    '''  readFile(new URL('../src/App.jsx', import.meta.url), 'utf8'),\n  readFile(new URL('../src/SettingsRoom.jsx', import.meta.url), 'utf8'),\n]);''',
    '''  readFile(new URL('../src/App.jsx', import.meta.url), 'utf8'),\n  readFile(new URL('../src/SettingsRoom.jsx', import.meta.url), 'utf8'),\n  readFile(new URL('../src/ChatRoom.jsx', import.meta.url), 'utf8'),\n]);''',
    'load ChatRoom for regression tests',
)

anchor = '''test('expired private backgrounds recover without an upload loop', () => {'''
insert = '''test('Chat session switching rejects stale responses and scopes attachments', () => {\n  assert.match(appSource, /const targetSessionId = String\\(id\\)/);\n  assert.match(appSource, /String\\(sessionIdRef\\.current\\) !== targetSessionId/);\n  assert.match(appSource, /setSessionSummary\\(null\\)/);\n  assert.match(appSource, /loadMessagesFor\\(id\\)\\.catch/);\n  assert.match(appSource, /const uploadSessionId = sessionIdRef\\.current/);\n  assert.match(appSource, /String\\(sessionIdRef\\.current\\) === String\\(uploadSessionId\\)/);\n  assert.match(appSource, /switchSession\\(r\\.session_id\\)/);\n  assert.match(appSource, /ourhome_chat_draft:\\$\\{id\\}/);\n  assert.match(chatRoomSource, /MAX_CHAT_SESSION_CACHE = 12/);\n  assert.match(chatRoomSource, /pendingAttachmentCache/);\n  assert.match(chatRoomSource, /setBoundedSessionCache\\(conversationCache/);\n  assert.match(chatRoomSource, /pendingAttachmentCache\\.delete\\(String\\(sessionId\\)\\)/);\n});\n\n'''
if anchor not in test:
    raise SystemExit('regression test insertion anchor missing')
test = test.replace(anchor, insert + anchor, 1)

app_path.write_text(app)
chat_path.write_text(chat)
test_path.write_text(test)

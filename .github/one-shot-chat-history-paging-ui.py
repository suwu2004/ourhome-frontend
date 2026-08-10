from pathlib import Path


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, got {count}')
    return text.replace(old, new, 1)

app_path = Path('src/App.jsx')
app = app_path.read_text()
app = replace_once(
    app,
    "const SESSION_TOKEN_HARD_LIMIT = 290_000;\n",
    "const SESSION_TOKEN_HARD_LIMIT = 290_000;\nconst CHAT_HISTORY_PAGE_SIZE = 240;\n",
    'history page constant',
)
app = replace_once(
    app,
    "  const [visible, setVisible] = useState(0);\n  const [thinking, setThinking] = useState(false);\n",
    "  const [visible, setVisible] = useState(0);\n  const [hasMoreChatHistory, setHasMoreChatHistory] = useState(false);\n  const [chatHistoryBefore, setChatHistoryBefore] = useState('');\n  const [chatHistoryLoading, setChatHistoryLoading] = useState(false);\n  const [thinking, setThinking] = useState(false);\n",
    'history states',
)
old_load = """  const loadMessagesFor = (id) => {
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
  };
"""
new_load = """  const loadMessagesFor = (id, { full = false } = {}) => {
    const targetSessionId = String(id);
    const historyUrl = full
      ? `${BACKEND}/sessions/${id}/messages`
      : `${BACKEND}/sessions/${id}/messages?limit=${CHAT_HISTORY_PAGE_SIZE}`;
    setSessionSummaryError('');
    return Promise.all([
      apiFetch(historyUrl).then(async response => {
        const data = await response.json().catch(() => ([]));
        if (!response.ok) throw new Error(data?.error || '聊天记录没有回来');
        return data;
      }),
      apiFetch(`${BACKEND}/sessions/${id}/summary`).then(r => r.json()).catch(() => null),
    ])
      .then(([data, summary]) => {
        const rows = Array.isArray(data) ? data : (Array.isArray(data?.messages) ? data.messages : []);
        const mapped = rows.map(mapDbMessage);
        if (String(sessionIdRef.current) !== targetSessionId) return mapped;
        setMsgs(mapped);
        setVisible(mapped.length);
        setHasHistory(mapped.length > 0);
        setHasMoreChatHistory(!full && !Array.isArray(data) && Boolean(data?.hasMore));
        setChatHistoryBefore(!full && !Array.isArray(data) ? String(data?.nextBefore || '') : '');
        setSessionSummary(summary && summary.id ? summary : null);
        scrollChatToBottomNow();
        return mapped;
      });
  };

  const loadOlderMessages = async () => {
    if (!sessionId || !hasMoreChatHistory || !chatHistoryBefore || chatHistoryLoading) return;
    const targetSessionId = String(sessionId);
    const list = listRef.current;
    const previousHeight = list?.scrollHeight || 0;
    const previousTop = list?.scrollTop || 0;
    setChatHistoryLoading(true);
    try {
      const response = await apiFetch(`${BACKEND}/sessions/${sessionId}/messages?limit=${CHAT_HISTORY_PAGE_SIZE}&before=${encodeURIComponent(chatHistoryBefore)}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || '更早的聊天记录没有回来');
      if (String(sessionIdRef.current) !== targetSessionId) return;
      const rows = Array.isArray(data) ? data : (Array.isArray(data?.messages) ? data.messages : []);
      const mapped = rows.map(mapDbMessage);
      if (Array.isArray(data)) {
        setMsgs(mapped);
        setVisible(mapped.length);
        setHasMoreChatHistory(false);
        setChatHistoryBefore('');
        return;
      }
      if (mapped.length) {
        setMsgs(current => [...mapped, ...current]);
        setVisible(current => current + mapped.length);
      }
      setHasMoreChatHistory(Boolean(data?.hasMore));
      setChatHistoryBefore(String(data?.nextBefore || ''));
      requestAnimationFrame(() => {
        const nextList = listRef.current;
        if (!nextList) return;
        nextList.scrollTop = previousTop + Math.max(0, nextList.scrollHeight - previousHeight);
      });
    } catch (error) {
      console.error(error);
    } finally {
      setChatHistoryLoading(false);
    }
  };
"""
app = replace_once(app, old_load, new_load, 'paged history loader')
app = replace_once(
    app,
    "    loadMessagesFor(targetSessionId)\n",
    "    loadMessagesFor(targetSessionId, { full: Boolean(targetMessageId) })\n",
    'notification full history fallback',
)
app = replace_once(
    app,
    "  const switchSession = (id) => {\n",
    "  const switchSession = (id, { full = false } = {}) => {\n",
    'switch session options',
)
app = replace_once(
    app,
    "    setTokenUsageOpen(false);\n    setSessionSummary(null);\n    chatStickToBottomRef.current = true;\n",
    "    setTokenUsageOpen(false);\n    setSessionSummary(null);\n    setHasMoreChatHistory(false);\n    setChatHistoryBefore('');\n    chatStickToBottomRef.current = true;\n",
    'switch history reset',
)
app = replace_once(
    app,
    "    loadMessagesFor(id).catch(console.error);\n    setDrawerOpen(false);\n",
    "    loadMessagesFor(id, { full }).catch(console.error);\n    setDrawerOpen(false);\n",
    'switch paged load',
)
old_jump = """  const jumpToSearchResult = (r) => {
    setSearchOpen(false);
    const jump = { id: r.id, query: lastSearchQuery || searchQuery.trim() };
    if (String(r.session_id) === String(sessionId)) {
      setPendingSearchJump(jump);
    } else {
      setPendingSearchJump(jump);
      switchSession(r.session_id);
    }
  };
"""
new_jump = """  const jumpToSearchResult = (r) => {
    setSearchOpen(false);
    const jump = { id: r.id, query: lastSearchQuery || searchQuery.trim() };
    if (String(r.session_id) === String(sessionId)) {
      setPendingSearchJump(jump);
      if (!msgs.some(message => String(message.id) === String(r.id))) {
        loadMessagesFor(sessionId, { full: true }).catch(console.error);
      }
    } else {
      setPendingSearchJump(jump);
      switchSession(r.session_id, { full: true });
    }
  };
"""
app = replace_once(app, old_jump, new_jump, 'search full history fallback')
app = replace_once(
    app,
    "        visible={visible}\n        formatMsgTime={formatMsgTime}\n",
    "        visible={visible}\n        hasMoreChatHistory={hasMoreChatHistory}\n        chatHistoryLoading={chatHistoryLoading}\n        loadOlderMessages={loadOlderMessages}\n        formatMsgTime={formatMsgTime}\n",
    'ChatRoom history props',
)
app_path.write_text(app)

room_path = Path('src/ChatRoom.jsx')
room = room_path.read_text()
room = replace_once(
    room,
    "const MAX_CHAT_SESSION_CACHE = 12;\n",
    "const MAX_CHAT_SESSION_CACHE = 12;\nconst MAX_CACHED_MESSAGES_PER_SESSION = 320;\n",
    'cache message cap',
)
room = replace_once(
    room,
    "    thinking, listRef, onListScroll, bgImage, bgColor, ready, msgs, visible, formatMsgTime, highlightMsgId,\n",
    "    thinking, listRef, onListScroll, bgImage, bgColor, ready, msgs, visible, hasMoreChatHistory, chatHistoryLoading, loadOlderMessages, formatMsgTime, highlightMsgId,\n",
    'ChatRoom paging props',
)
room = replace_once(
    room,
    "    setBoundedSessionCache(conversationCache, sessionId, stableMessages);\n",
    "    setBoundedSessionCache(conversationCache, sessionId, stableMessages.slice(-MAX_CACHED_MESSAGES_PER_SESSION));\n",
    'bounded message cache',
)
room = replace_once(
    room,
    "          {!ready && (\n            <div style={{ textAlign: \"center\", fontSize: 11, color: C.muted, letterSpacing: \".15em\", padding: \"30px 0\" }}>正在开门…</div>\n          )}\n          {visibleMessages.map((m, idx) => {\n",
    "          {!ready && (\n            <div style={{ textAlign: \"center\", fontSize: 11, color: C.muted, letterSpacing: \".15em\", padding: \"30px 0\" }}>正在开门…</div>\n          )}\n          {ready && hasMoreChatHistory && !showingCachedConversation && (\n            <div style={{ display: 'flex', justifyContent: 'center', padding: '2px 0 14px' }}>\n              <button type=\"button\" onClick={loadOlderMessages} disabled={chatHistoryLoading} style={{ border: `1px solid ${C.border}`, background: C.white, color: C.honeyDeep, borderRadius: 999, padding: '6px 12px', fontSize: 10.5, fontFamily: 'inherit', cursor: chatHistoryLoading ? 'default' : 'pointer' }}>\n                {chatHistoryLoading ? '正在翻以前的聊天…' : '查看更早的消息'}\n              </button>\n            </div>\n          )}\n          {visibleMessages.map((m, idx) => {\n",
    'older history button',
)
room = replace_once(
    room,
    "                  [chatUsage.totalChars, '聊天字数'],\n                  [chatUsage.currentContextTokens, '当前上下文'],\n                  [chatUsage.totalOutputTokens, '累计生成'],\n",
    "                  [chatUsage.totalChars, hasMoreChatHistory ? '已加载字数' : '聊天字数'],\n                  [chatUsage.currentContextTokens, '当前上下文'],\n                  [chatUsage.totalOutputTokens, hasMoreChatHistory ? '已加载生成' : '累计生成'],\n",
    'usage labels for partial history',
)
room_path.write_text(room)

pkg_path = Path('package.json')
pkg = pkg_path.read_text()
if 'scripts/chat-history-paging-regression.test.mjs' not in pkg:
    anchor = 'scripts/global-sync-regression.test.mjs'
    if anchor not in pkg:
        raise SystemExit('test:app anchor missing')
    pkg = pkg.replace(anchor, anchor + ' scripts/chat-history-paging-regression.test.mjs', 1)
pkg_path.write_text(pkg)

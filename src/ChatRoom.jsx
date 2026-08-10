import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { LIGHT_THEME } from './theme.js';
import { HighlightedText, Stars } from './ChatDecorations.jsx';
import { ViewportChatImage } from './ViewportChatImage.jsx';

const CHAT_DRAFT_PREFIX = 'ourhome_chat_draft:';
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

function chatDraftKey(sessionId) {
  return sessionId ? `${CHAT_DRAFT_PREFIX}${sessionId}` : '';
}

function messageDateKey(date) {
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function formatMsgDate(date) {
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
}

function compactUsageNumber(value) {
  const amount = Number(value) || 0;
  if (amount >= 10000) return `${(amount / 10000).toFixed(amount >= 100000 ? 0 : 1)}万`;
  if (amount >= 1000) return `${(amount / 1000).toFixed(amount >= 10000 ? 0 : 1)}k`;
  return String(amount);
}

function Avatar({ isMe, src, theme = LIGHT_THEME }) {
  return (
    <div style={{
      width: 30, height: 30, borderRadius: "50%", flexShrink: 0, overflow: "hidden",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 12, fontWeight: 700, color: theme.white,
      background: isMe ? `linear-gradient(150deg, #F2AFA2, ${theme.blushDeep})` : `linear-gradient(150deg, #E8B45A, ${theme.honeyDeep})`,
      boxShadow: `0 2px 6px ${isMe ? "rgba(232,144,122,.3)" : "rgba(185,122,31,.25)"}`,
    }}>
      {src ? <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (isMe ? "檀" : "泽")}
    </div>
  );
}

export function ChatRoom(props) {
  const {
    stage, view, C, leaveRoom, setDrawerOpen, setSearchOpen, setSearchQuery,
    setLastSearchQuery, setSearchResults, setSearchMeta, setSearchScope,
    thinking, listRef, onListScroll, bgImage, bgColor, ready, msgs, visible, formatMsgTime, highlightMsgId,
    highlightQuery, myAvatar, partnerAvatar, myBubbleColor, partnerBubbleColor,
    toggleThinking, openMessageActions, messageAction, messageActionLoading, regenerateLast,
    regenerating, editingMessage, cancelEditMsg, rollbackUndo, undoRollback,
    sessionTokenPressure, generateCurrentSessionSummary, sessionSummaryLoading,
    sessionSummary, messageActionError, setMessageActionError, sessionSummaryError, tokenUsageOpen,
    setTokenUsageOpen, chatUsage, sessionId, pendingFile, imageUploading,
    setPendingFile, chatImageInputRef, pickFile, chatInputRef, input, setInput,
    send, selectedModel, chooseModel, availableModels, loadActiveModels,
    modelsLoading, modelsError,
  } = props;

  const [chatModel, setChatModel] = useState(selectedModel || '');
  const [cachedConversation, setCachedConversation] = useState(null);
  const [cachedSessionId, setCachedSessionId] = useState(null);
  const draftSessionRef = useRef(null);
  const attachmentSessionRef = useRef(null);
  const messagesAtSessionChangeRef = useRef(msgs);
  const waitingForFreshMessagesRef = useRef(false);
  const showingCachedConversation = cachedSessionId === sessionId && cachedConversation !== null;
  const renderedMessages = showingCachedConversation ? cachedConversation : msgs;
  const visibleMessages = renderedMessages.slice(0, showingCachedConversation ? renderedMessages.length : Math.max(0, visible));
  const modelOptions = [...new Set([
    chatModel,
    selectedModel,
    ...availableModels,
  ].map(item => String(item || '').trim()).filter(Boolean))];

  useEffect(() => {
    if (!availableModels.length) {
      if (!chatModel && selectedModel) setChatModel(selectedModel);
      return;
    }
    if (availableModels.includes(chatModel)) return;
    setChatModel(availableModels.includes(selectedModel) ? selectedModel : availableModels[0]);
  }, [availableModels, chatModel, selectedModel]);

  useEffect(() => {
    if (!sessionId) {
      waitingForFreshMessagesRef.current = false;
      setCachedSessionId(null);
      setCachedConversation(null);
      return;
    }
    messagesAtSessionChangeRef.current = msgs;
    waitingForFreshMessagesRef.current = true;
    setCachedSessionId(sessionId);
    setCachedConversation(readCache(conversationCache, String(sessionId)) || []);
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    if (waitingForFreshMessagesRef.current) {
      if (msgs === messagesAtSessionChangeRef.current) return;
      waitingForFreshMessagesRef.current = false;
      setCachedSessionId(null);
      setCachedConversation(null);
    }
    const stableMessages = msgs.filter(message => !String(message?.id || '').startsWith('temp-'));
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
    if (!sessionId || editingMessage || String(draftSessionRef.current) === String(sessionId)) return;
    draftSessionRef.current = sessionId;
    try {
      setInput(localStorage.getItem(chatDraftKey(sessionId)) || '');
    } catch {
      setInput('');
    }
  }, [editingMessage, sessionId, setInput]);

  useLayoutEffect(() => {
    const textarea = chatInputRef.current;
    if (!textarea) return;
    textarea.style.height = '0px';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    textarea.style.overflowY = textarea.scrollHeight > 120 ? 'auto' : 'hidden';
  }, [chatInputRef, input]);

  const updateChatDraft = value => {
    setInput(value);
    if (!editingMessage && sessionId) {
      try {
        const key = chatDraftKey(sessionId);
        if (value) localStorage.setItem(key, value);
        else localStorage.removeItem(key);
      } catch {
        // Draft persistence is a convenience layer; storage failures must not block typing.
      }
    }
    if (messageActionError) setMessageActionError("");
  };

  const sendWithDraftCleanup = model => {
    if (!editingMessage && sessionId) {
      try { localStorage.removeItem(chatDraftKey(sessionId)); } catch { /* ignore storage failures */ }
      pendingAttachmentCache.delete(String(sessionId));
    }
    return send(model);
  };

  return (
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", opacity: (stage === "home" && view === "chat") ? 1 : 0, pointerEvents: (stage === "home" && view === "chat") ? "auto" : "none", transition: "opacity .4s ease" }}>
        <header className="ourhome-safe-top" style={{ background: C.white, borderBottom: `1px solid ${C.border}`, paddingLeft: 16, paddingRight: 16, flexShrink: 0 }}>
          <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: 10 }}>
            <div style={{ display: 'flex', gap: 5 }}>
              <button onClick={leaveRoom} aria-label="回到主页" style={{ fontSize: 18, color: C.honeyDeep, background: 'transparent', border: 0, padding: 4, width: 30, height: 30, cursor: 'pointer' }}>←</button>
              <button onClick={() => setDrawerOpen(true)} style={{ fontSize: 11.5, color: C.honeyDeep, background: C.honeyLight, border: `1px solid ${C.honeyMid}`, borderRadius: 10, padding: "5px 8px", cursor: "pointer", letterSpacing: ".03em", fontWeight: 500 }}>对话</button>
            </div>
            <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)", textAlign: "center" }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: C.text, letterSpacing: ".04em" }}>陆泽</div>
              <div style={{ fontSize: 10, color: thinking ? C.honey : C.muted, letterSpacing: ".18em", marginTop: 2, display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                <div style={{ width: 5, height: 5, borderRadius: "50%", background: thinking ? C.honey : C.mutedLight, boxShadow: thinking ? `0 0 5px ${C.honey}` : "none", transition: "background .3s, box-shadow .3s" }} />
                <span>{thinking ? "想你中…" : "miss you"}</span>
              </div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => { setSearchOpen(true); setSearchQuery(""); setLastSearchQuery(''); setSearchResults([]); setSearchMeta({ total: 0, page: 1, hasMore: false }); setSearchScope('current'); }} style={{ fontSize: 14, color: C.honeyDeep, background: C.honeyLight, border: `1px solid ${C.honeyMid}`, borderRadius: 10, width: 30, height: 30, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>🔍</button>
            </div>
          </div>
          <Stars theme={C} />
        </header>

        <div style={{ position: "relative", flex: 1, minHeight: 0, overflow: "hidden", background: bgImage ? `url(${bgImage}) center/cover no-repeat` : (bgColor || "#FDFAF5") }}>
          <div ref={listRef} onScroll={onListScroll} style={{ position: "absolute", inset: 0, overflowY: "auto", overscrollBehaviorY: "contain", WebkitOverflowScrolling: "touch", padding: "16px 14px 8px" }}>
          {!ready && (
            <div style={{ textAlign: "center", fontSize: 11, color: C.muted, letterSpacing: ".15em", padding: "30px 0" }}>正在开门…</div>
          )}
          {visibleMessages.map((m, idx) => {
            const isMe = m.role === "me";
            const isLast = idx === visibleMessages.length - 1;
            const dateKey = messageDateKey(m.createdAt);
            const previousDateKey = idx > 0 ? messageDateKey(renderedMessages[idx - 1].createdAt) : '';
            const showDateDivider = Boolean(dateKey && dateKey !== previousDateKey);
            return (
              <div key={m.id} style={{ contentVisibility: "auto", containIntrinsicSize: "auto 120px" }}>
                {showDateDivider && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: idx === 0 ? '2px 8px 18px' : '10px 8px 18px' }}>
                    <span style={{ flex: 1, height: 1, background: C.border }} />
                    <span style={{ color: C.muted, fontSize: 10.5, letterSpacing: '.06em', whiteSpace: 'nowrap' }}>{formatMsgDate(m.createdAt)}</span>
                    <span style={{ flex: 1, height: 1, background: C.border }} />
                  </div>
                )}
                <div id={`msg-${m.id}`} style={{ display: "flex", marginBottom: 14, flexDirection: isMe ? "row-reverse" : "row", alignItems: "flex-end", gap: 6, background: highlightMsgId === m.id ? C.honeyLight : "transparent", borderRadius: 14, padding: highlightMsgId === m.id ? "6px 4px" : "0px", transition: "background .6s ease" }}>
                  <Avatar isMe={isMe} src={isMe ? myAvatar : partnerAvatar} theme={C} />
                  <div style={{ maxWidth: "72%", display: "flex", flexDirection: "column", gap: 6 }}>
                    {m.image && (
                      <ViewportChatImage src={m.image} rootRef={listRef} borderColor={isMe ? "#F5CABB" : C.border} />
                    )}
                    {m.file && (
                      <a href={m.file.url} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 14, background: isMe ? (myBubbleColor || C.blush) : (partnerBubbleColor || C.white), border: `1px solid ${isMe ? "#F5CABB" : C.border}`, textDecoration: "none", color: C.text, maxWidth: "100%" }}>
                        <span style={{ fontSize: 20 }}>📄</span>
                        <span style={{ fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.file.name}</span>
                      </a>
                    )}
                    {!isMe && m.thinking && (
                      <div>
                        <span onClick={() => toggleThinking(m.id)} style={{ fontSize: 10.5, color: C.muted, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 3 }}>
                          💭 想了想{m.thinkingOpen ? " ▲" : " ▼"}
                        </span>
                        {m.thinkingOpen && (
                          <div style={{ fontSize: 12, lineHeight: 1.6, color: C.muted, background: C.borderLight, borderRadius: 10, padding: "8px 12px", marginTop: 4, whiteSpace: "pre-wrap", fontStyle: "italic" }}>{m.thinking}</div>
                        )}
                      </div>
                    )}
                    {m.text && (
                      <div style={{ padding: "10px 14px", fontSize: 14.5, lineHeight: 1.72, color: C.text, borderRadius: isMe ? "18px 18px 4px 18px" : "18px 18px 18px 4px", background: isMe ? (myBubbleColor || C.blush) : (partnerBubbleColor || C.white), border: `1px solid ${isMe ? "#F5CABB" : C.border}`, whiteSpace: "pre-wrap", wordBreak: "break-word" }}><HighlightedText text={m.text} query={highlightMsgId === m.id ? highlightQuery : ''} /></div>
                    )}
                    {!isMe && isLast && !thinking && !showingCachedConversation && (
                      <button type="button" onClick={() => regenerateLast(chatModel)} disabled={regenerating} style={{ border: 0, padding: "3px 0", background: "transparent", fontSize: 10.5, color: C.muted, cursor: regenerating ? "default" : "pointer", alignSelf: "flex-start", fontFamily: "inherit" }}>{regenerating ? "思考中…" : "↻ 重新生成"}</button>
                    )}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: isMe ? "flex-end" : "flex-start", gap: 4, flexShrink: 0 }}>
                    <span style={{ fontSize: 9.5, color: C.mutedLight }}>{m.time || formatMsgTime(m.createdAt)}</span>
                    <button
                      type="button"
                      onClick={() => openMessageActions(m)}
                      disabled={showingCachedConversation || thinking || messageActionLoading || String(m.id).startsWith('temp-')}
                      aria-label={`${isMe ? '我的' : '陆泽的'}消息操作`}
                      title={showingCachedConversation ? "正在同步最新内容" : "编辑或回到这里"}
                      style={{ width: 40, height: 40, border: 0, borderRadius: 999, background: "transparent", color: C.muted, cursor: showingCachedConversation || thinking || messageActionLoading || String(m.id).startsWith('temp-') ? "default" : "pointer", opacity: showingCachedConversation || String(m.id).startsWith('temp-') ? .28 : .78, fontSize: 20, lineHeight: 1, display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 1, fontFamily: "inherit" }}
                    ><span aria-hidden="true" style={{ transform: "translateY(-2px)" }}>⌄</span></button>
                  </div>
                </div>
              </div>
            );
          })}
          {thinking && !showingCachedConversation && (
            <div style={{ display: "flex", alignItems: "flex-end", gap: 6, marginBottom: 14 }}>
              <Avatar isMe={false} src={partnerAvatar} theme={C} />
              <div style={{ padding: "10px 16px", borderRadius: "18px 18px 18px 4px", background: C.white, border: `1px solid ${C.border}`, fontSize: 12, color: C.muted, letterSpacing: ".15em", fontStyle: "italic" }}>想你中…</div>
            </div>
          )}
          </div>
        </div>

        <div className="ourhome-safe-bottom" style={{ background: C.white, borderTop: `1px solid ${C.border}`, paddingTop: 10, paddingLeft: 14, paddingRight: 14, flexShrink: 0 }}>
          {editingMessage && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, padding: "8px 10px", borderRadius: 12, background: C.honeyLight, border: `1px solid ${C.honeyMid}` }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: C.honeyDeep }}>正在重新编辑这条消息</div>
                <div style={{ fontSize: 10, lineHeight: 1.5, color: C.muted, marginTop: 2 }}>发送后会收起后面的 {editingMessage.afterCount} 条，陆泽会按新内容重新回复。</div>
              </div>
              <button type="button" onClick={cancelEditMsg} disabled={messageActionLoading} style={{ flexShrink: 0, minWidth: 44, minHeight: 34, border: 0, borderRadius: 999, background: "rgba(255,255,255,.72)", color: C.muted, cursor: messageActionLoading ? "default" : "pointer", fontFamily: "inherit", fontSize: 11 }}>取消</button>
            </div>
          )}
          {rollbackUndo && !editingMessage && (
            <div role="status" style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, padding: "8px 10px", borderRadius: 12, background: C.honeyLight, border: `1px solid ${C.honeyMid}` }}>
              <span style={{ flex: 1, fontSize: 11, lineHeight: 1.5, color: C.honeyDeep }}>已回到这里，收起了 {rollbackUndo.hiddenMessages.length} 条消息。</span>
              <button type="button" onClick={undoRollback} disabled={messageActionLoading} style={{ minWidth: 52, minHeight: 34, border: `1px solid ${C.honeyMid}`, borderRadius: 999, background: C.white, color: C.honeyDeep, cursor: messageActionLoading ? "default" : "pointer", fontFamily: "inherit", fontSize: 11 }}>{messageActionLoading ? "恢复中…" : "撤销"}</button>
            </div>
          )}
          {sessionTokenPressure !== 'normal' && !editingMessage && (
            <div role="status" style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 8, padding: "8px 10px", borderRadius: 12, background: sessionTokenPressure === 'hard' ? "rgba(214,120,104,.12)" : C.honeyLight, border: `1px solid ${sessionTokenPressure === 'hard' ? C.blushDeep : C.honeyMid}` }}>
              <span style={{ flex: 1, minWidth: 0, color: sessionTokenPressure === 'hard' ? C.blushDeep : C.honeyDeep, fontSize: 10.8, lineHeight: 1.55 }}>
                {sessionTokenPressure === 'hard' ? '这个窗口已经很接近截断临界点，先生成简介再开新窗口会更稳。' : '这个窗口快接近长聊临界点了，可以先给它留一份简介。'}
              </span>
              <button type="button" onClick={generateCurrentSessionSummary} disabled={sessionSummaryLoading} style={{ flexShrink: 0, minHeight: 30, border: 0, borderRadius: 999, padding: "0 10px", background: sessionSummaryLoading ? C.honeyMid : C.honey, color: C.white, fontSize: 10.5, cursor: sessionSummaryLoading ? "default" : "pointer", fontFamily: "inherit" }}>{sessionSummaryLoading ? "生成中…" : sessionSummary ? "更新简介" : "生成简介"}</button>
            </div>
          )}
          {messageActionError && !messageAction && (
            <div role="alert" style={{ marginBottom: 8, padding: "7px 10px", borderRadius: 10, background: "rgba(214,120,104,.1)", color: C.blushDeep, fontSize: 10.5, lineHeight: 1.5 }}>{messageActionError}</div>
          )}
          {sessionSummaryError && (
            <div role="alert" style={{ marginBottom: 8, padding: "7px 10px", borderRadius: 10, background: "rgba(214,120,104,.1)", color: C.blushDeep, fontSize: 10.5, lineHeight: 1.5 }}>{sessionSummaryError}</div>
          )}
          {tokenUsageOpen && (
            <div id="chat-token-usage" style={{ marginBottom: 8, padding: "10px 11px", borderRadius: 14, background: C.honeyLight, border: `1px solid ${C.honeyMid}` }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: C.honeyDeep }}>当前对话用量</div>
                <button type="button" onClick={() => setTokenUsageOpen(false)} aria-label="收起 token 用量" style={{ width: 28, height: 28, border: 0, borderRadius: "50%", background: "rgba(255,255,255,.68)", color: C.muted, cursor: "pointer", fontFamily: "inherit", fontSize: 12 }}>✕</button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 7 }}>
                {[
                  [chatUsage.totalChars, '聊天字数'],
                  [chatUsage.currentContextTokens, '当前上下文'],
                  [chatUsage.totalOutputTokens, '累计生成'],
                ].map(([value, label]) => (
                  <div key={label} style={{ minWidth: 0, textAlign: "center", background: "rgba(255,255,255,.68)", borderRadius: 10, padding: "7px 3px" }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.honeyDeep, overflow: "hidden", textOverflow: "ellipsis" }}>{Number(value).toLocaleString('zh-CN')}</div>
                    <div style={{ fontSize: 9.5, color: C.muted, marginTop: 1 }}>{label}</div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 9.5, color: C.muted, lineHeight: 1.5, marginTop: 7 }}>上下文是陆泽下一次回复会带着的聊天量；累计生成是这段对话里已经生成的 token。</div>
              <div style={{ marginTop: 9, paddingTop: 9, borderTop: `1px solid ${C.honeyMid}` }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: C.honeyDeep }}>{sessionSummary?.title || "窗口简介"}</div>
                    <div style={{ marginTop: 2, fontSize: 9.5, color: C.muted }}>{sessionSummary ? `${sessionSummary.message_count || msgs.length} 条消息 · 已托管在云端` : "这个聊天窗口还没有生成简介"}</div>
                  </div>
                  <button type="button" onClick={generateCurrentSessionSummary} disabled={sessionSummaryLoading || !sessionId} style={{ flexShrink: 0, minHeight: 28, border: `1px solid ${C.honeyMid}`, borderRadius: 999, background: C.white, color: C.honeyDeep, cursor: sessionSummaryLoading ? "default" : "pointer", padding: "0 9px", fontFamily: "inherit", fontSize: 10 }}>{sessionSummaryLoading ? "生成中…" : sessionSummary ? "更新" : "生成"}</button>
                </div>
                {sessionSummary?.summary && (
                  <p style={{ margin: "7px 0 0", color: C.text, fontSize: 10.5, lineHeight: 1.6, whiteSpace: "pre-wrap", maxHeight: 120, overflowY: "auto" }}>{sessionSummary.summary}</p>
                )}
              </div>
            </div>
          )}
          {(pendingFile || imageUploading) && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              {imageUploading ? (
                <div style={{ width: 52, height: 52, borderRadius: 10, border: `1px solid ${C.border}`, background: C.cream, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: 9, color: C.muted }}>上传中…</span>
                </div>
              ) : pendingFile && pendingFile.type && pendingFile.type.startsWith('image/') ? (
                <div style={{ position: "relative", width: 52, height: 52, borderRadius: 10, overflow: "hidden", border: `1px solid ${C.border}` }}>
                  <img src={pendingFile.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  <span onClick={() => setPendingFile(null)} style={{ position: "absolute", top: 2, right: 2, width: 16, height: 16, borderRadius: "50%", background: "rgba(46,31,18,.6)", color: C.white, fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>✕</span>
                </div>
              ) : pendingFile && (
                <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.cream, maxWidth: "80%" }}>
                  <span style={{ fontSize: 16 }}>📄</span>
                  <span style={{ fontSize: 11.5, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pendingFile.name}</span>
                  <span onClick={() => setPendingFile(null)} style={{ fontSize: 11, color: C.muted, cursor: "pointer", marginLeft: 4 }}>✕</span>
                </div>
              )}
            </div>
          )}
          <div style={{ display: "flex", alignItems: "flex-end", gap: 8, background: C.surface, border: `1.5px solid ${editingMessage ? C.honey : C.border}`, borderRadius: 22, padding: "6px 6px 6px 10px" }}>
            <button type="button" onClick={() => chatImageInputRef.current?.click()} disabled={Boolean(editingMessage) || messageActionLoading} aria-label="添加图片或文件" style={{ width: 30, height: 30, borderRadius: "50%", border: "none", background: "transparent", color: C.muted, fontSize: 18, cursor: editingMessage || messageActionLoading ? "default" : "pointer", opacity: editingMessage ? .3 : 1, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>＋</button>
            <input ref={chatImageInputRef} type="file" style={{ display: "none" }} onChange={e => pickFile(e.target.files?.[0])} />
            <textarea ref={chatInputRef} rows={1} placeholder={editingMessage ? "修改好后重新发送…" : "在云端漫步"} value={input} onChange={e => updateChatDraft(e.target.value)} style={{ flex: 1, maxHeight: 120, border: "none", outline: "none", background: "transparent", fontSize: 14.5, color: C.text, lineHeight: 1.5, resize: "none", fontFamily: "inherit", padding: "6px 0" }} />
            <button type="button" onClick={() => sendWithDraftCleanup(chatModel)} disabled={(!input.trim() && !pendingFile) || thinking || messageActionLoading} aria-label={editingMessage ? "重新发送修改后的消息" : "发送消息"} style={{ width: 36, height: 36, borderRadius: "50%", border: "none", cursor: (input.trim() || pendingFile) && !thinking && !messageActionLoading ? "pointer" : "default", background: (input.trim() || pendingFile) && !thinking && !messageActionLoading ? `linear-gradient(150deg, ${C.honey}, ${C.honeyDeep})` : C.honeyMid, color: C.white, fontSize: 15, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: (input.trim() || pendingFile) && !thinking && !messageActionLoading ? `0 3px 10px rgba(185,122,31,.35)` : "none", opacity: thinking || messageActionLoading ? .62 : 1, transition: "background .2s, box-shadow .2s, opacity .2s, transform .15s" }}>{editingMessage && messageActionLoading ? "…" : "↑"}</button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, paddingLeft: 2 }}>
            <select aria-label="选择聊天模型" value={chatModel} onChange={e => { const nextModel = e.target.value; setMessageActionError(""); setChatModel(nextModel); chooseModel(nextModel); }} style={{ flex: 1, minWidth: 0, fontSize: 11, color: C.muted, background: "transparent", border: `1px solid ${C.border}`, borderRadius: 999, padding: "4px 10px", outline: "none", cursor: "pointer", fontFamily: "inherit" }}>
              {modelOptions.length > 0 ? (
                modelOptions.map(m => <option key={m} value={m}>{m}</option>)
              ) : (
                <option value="">暂无可用模型</option>
              )}
            </select>
            <button
              type="button"
              onClick={() => loadActiveModels(chatModel)}
              disabled={modelsLoading}
              aria-label="重新拉取当前 API 站点的模型"
              title={modelsError || '重新拉取当前 API 站点的模型'}
              style={{ width: 26, height: 26, flexShrink: 0, borderRadius: '50%', border: `1px solid ${modelsError ? C.blushDeep : C.border}`, background: C.surface, color: modelsError ? C.blushDeep : C.honeyDeep, cursor: modelsLoading ? 'default' : 'pointer', fontFamily: 'inherit', opacity: modelsLoading ? .55 : 1 }}
            >{modelsLoading ? '…' : '↻'}</button>
            <button
              type="button"
              onClick={() => setTokenUsageOpen(open => !open)}
              aria-expanded={tokenUsageOpen}
              aria-controls="chat-token-usage"
              style={{ minWidth: 86, height: 26, flexShrink: 0, borderRadius: 999, border: `1px solid ${tokenUsageOpen ? C.honeyMid : C.border}`, background: tokenUsageOpen ? C.honeyLight : "transparent", color: tokenUsageOpen ? C.honeyDeep : C.muted, cursor: "pointer", padding: "0 9px", fontFamily: "inherit", fontSize: 9.5, whiteSpace: "nowrap" }}
            >◎ 上下文 {compactUsageNumber(chatUsage.currentContextTokens)}</button>
          </div>

        </div>
      </div>
  );
}

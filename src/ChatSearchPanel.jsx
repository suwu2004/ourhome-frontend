export function ChatSearchPanel({
  open,
  theme: C,
  query,
  setQuery,
  searching,
  results,
  scope,
  setScope,
  meta,
  lastQuery,
  onClose,
  onSearch,
  onLoadMore,
  onJump,
  HighlightedText,
}) {
  const semanticLabel = meta?.semanticAvailable ? '语义搜索' : '关键词搜索';

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 50,
          background: 'rgba(46,31,18,.35)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity .25s',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          zIndex: 55,
          width: '88%',
          maxWidth: 390,
          maxHeight: 'min(76dvh, 640px)',
          transform: open ? 'translate(-50%, -50%) scale(1)' : 'translate(-50%, -50%) scale(.96)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'all .22s ease',
          background: C.surface,
          borderRadius: 18,
          border: `1px solid ${C.border}`,
          boxShadow: '0 20px 60px rgba(100,70,30,.25)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '16px 18px 12px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: '.04em', color: C.text }}>🔍 搜索聊天记录</span>
          <span onClick={onClose} style={{ fontSize: 15, color: C.muted, cursor: 'pointer', padding: 4 }}>✕</span>
        </div>
        <div style={{ padding: '11px 18px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={query}
              onChange={event => setQuery(event.target.value)}
              onKeyDown={event => { if (event.key === 'Enter') onSearch(); }}
              placeholder="输入想找的事，比如医院、小姨、QQ音乐…"
              style={{ flex: 1, minWidth: 0, fontSize: 13, color: C.text, background: C.cream, border: `1px solid ${C.border}`, borderRadius: 999, padding: '8px 14px', outline: 'none' }}
            />
            <button onClick={onSearch} style={{ fontSize: 12, color: C.white, background: C.honey, border: 'none', borderRadius: 999, padding: '0 16px', cursor: 'pointer', letterSpacing: '.05em' }}>{searching ? '搜中…' : '搜'}</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 9 }}>
            {[
              ['current', '当前对话'],
              ['all', '全部对话'],
            ].map(([key, label]) => (
              <button key={key} type="button" onClick={() => setScope(key)} style={{ border: `1px solid ${scope === key ? C.honey : C.border}`, background: scope === key ? C.honeyLight : 'transparent', color: scope === key ? C.honeyDeep : C.muted, borderRadius: 999, padding: '4px 10px', fontSize: 10.5, cursor: 'pointer' }}>{label}</button>
            ))}
            {results.length > 0 && <span style={{ marginLeft: 'auto', fontSize: 10.5, color: C.muted }}>{semanticLabel} · {meta.total} 条</span>}
          </div>
        </div>
        <div className="ourhome-scroll" style={{ flex: 1, overflowY: 'auto', padding: '14px 18px 18px' }}>
          {searching && results.length === 0 && (
            <div style={{ textAlign: 'center', fontSize: 12, color: C.muted, padding: '20px 0' }}>翻找中…</div>
          )}
          {!searching && lastQuery && results.length === 0 && (
            <div style={{ textAlign: 'center', fontSize: 12, color: C.muted, padding: '20px 0' }}>没找到相关的内容。</div>
          )}
          {results.map(result => {
            const resultKind = result.match_type === 'semantic' ? '语义相关' : '关键词命中';
            return (
              <button type="button" key={result.id} onClick={() => onJump(result)} style={{ display: 'block', width: '100%', marginBottom: 12, padding: 0, paddingBottom: 12, border: 0, borderBottom: `1px solid ${C.borderLight}`, cursor: 'pointer', background: 'transparent', textAlign: 'left', color: 'inherit' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: C.honeyDeep }}>{result.role === 'user' ? '檀' : '泽'} · {result.sessions?.name || result.session_name || ''}</span>
                  <span style={{ fontSize: 9.5, color: C.mutedLight }}>{new Date(result.created_at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div style={{ fontSize: 13, lineHeight: 1.55, color: C.text }}><HighlightedText text={result.snippet || result.content} query={lastQuery} /></div>
                <div style={{ fontSize: 9.5, color: C.mutedLight, marginTop: 4 }}>{resultKind} · 点一下回到原文</div>
              </button>
            );
          })}
          {meta.hasMore && (
            <button type="button" disabled={searching} onClick={onLoadMore} style={{ display: 'block', margin: '4px auto 0', border: `1px solid ${C.honeyMid}`, color: C.honeyDeep, background: C.honeyLight, borderRadius: 999, padding: '6px 15px', fontSize: 11.5, cursor: 'pointer' }}>{searching ? '继续翻找…' : '加载更多'}</button>
          )}
        </div>
      </div>
    </>
  );
}

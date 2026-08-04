function formatMessageTime(value) {
  const date = typeof value === 'string' || typeof value === 'number' ? new Date(value) : value;
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function MessageActionSheet({
  action,
  loading,
  error,
  theme: C,
  setAction,
  startEditMessage,
  confirmRollback,
}) {
  const close = () => {
    if (!loading) setAction(null);
  };

  return (
    <>
      <div onClick={close} style={{ position: "absolute", inset: 0, zIndex: 60, background: "rgba(46,31,18,.34)", opacity: action ? 1 : 0, pointerEvents: action ? "auto" : "none", transition: "opacity .2s" }} />
      <section
        role="dialog"
        aria-modal="true"
        aria-hidden={!action}
        aria-label="消息操作"
        style={{ position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 65, padding: "18px 18px max(18px, env(safe-area-inset-bottom))", background: C.surface, borderRadius: "22px 22px 0 0", borderTop: `1px solid ${C.border}`, boxShadow: "0 -18px 50px rgba(70,45,20,.18)", transform: action ? "translateY(0)" : "translateY(105%)", pointerEvents: action ? "auto" : "none", transition: "transform .25s cubic-bezier(.2,.8,.2,1)" }}
      >
        {action && (
          <>
            <div style={{ width: 38, height: 4, borderRadius: 999, background: C.border, margin: "0 auto 14px" }} />
            {action.mode === 'menu' ? (
              <>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>这条消息</div>
                    <div style={{ fontSize: 10.5, color: C.muted, marginTop: 2 }}>{action.message.role === 'me' ? '叶檀' : '陆泽'} · {action.message.time || formatMessageTime(action.message.createdAt)}</div>
                  </div>
                  <button type="button" onClick={close} aria-label="关闭消息操作" style={{ width: 38, height: 38, border: 0, borderRadius: "50%", background: C.cream, color: C.muted, cursor: "pointer", fontFamily: "inherit", fontSize: 15 }}>✕</button>
                </div>
                <div style={{ margin: "13px 0 14px", padding: "10px 12px", borderRadius: 12, background: C.cream, color: C.text, fontSize: 12.5, lineHeight: 1.65, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden", whiteSpace: "pre-wrap" }}>{action.message.text || '（附件消息）'}</div>
                <div style={{ display: "grid", gap: 9 }}>
                  {action.message.role === 'me' && action.message.text && (
                    <button type="button" onClick={() => startEditMessage(action.message)} style={{ minHeight: 48, border: `1px solid ${C.honeyMid}`, borderRadius: 14, background: C.honeyLight, color: C.honeyDeep, cursor: "pointer", fontFamily: "inherit", fontSize: 13.5, fontWeight: 700 }}>✎ 重新编辑并发送</button>
                  )}
                  <button
                    type="button"
                    disabled={action.afterCount === 0}
                    onClick={() => setAction(current => current ? { ...current, mode: 'rollback' } : null)}
                    style={{ minHeight: 48, border: `1px solid ${C.border}`, borderRadius: 14, background: C.white, color: action.afterCount === 0 ? C.mutedLight : C.text, cursor: action.afterCount === 0 ? "default" : "pointer", fontFamily: "inherit", fontSize: 13.5 }}
                  >{action.afterCount === 0 ? '已经在当前时间点' : `↶ 回到这里 · 收起后面 ${action.afterCount} 条`}</button>
                </div>
                {error && <div role="alert" style={{ marginTop: 10, color: C.blushDeep, fontSize: 11, textAlign: "center" }}>{error}</div>}
              </>
            ) : (
              <>
                <div style={{ fontSize: 16, fontWeight: 700, color: C.text, textAlign: "center" }}>回到这条消息？</div>
                <div style={{ marginTop: 8, color: C.muted, fontSize: 12, lineHeight: 1.7, textAlign: "center" }}>后面的 {action.afterCount} 条消息会暂时收起来，不会删除；完成后可以立即撤销。</div>
                <div style={{ marginTop: 10, padding: "8px 10px", borderRadius: 10, background: C.cream, color: C.muted, fontSize: 10.5, lineHeight: 1.6 }}>聊天回溯只调整对话分支，已经执行过的金库、日历等操作不会跟着撤销。</div>
                {error && <div role="alert" style={{ marginTop: 10, color: C.blushDeep, fontSize: 11, textAlign: "center" }}>{error}</div>}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1.35fr", gap: 10, marginTop: 16 }}>
                  <button type="button" onClick={() => setAction(current => current ? { ...current, mode: 'menu' } : null)} disabled={loading} style={{ minHeight: 48, border: `1px solid ${C.border}`, borderRadius: 14, background: C.white, color: C.muted, cursor: loading ? "default" : "pointer", fontFamily: "inherit", fontSize: 13 }}>再想想</button>
                  <button type="button" onClick={confirmRollback} disabled={loading} style={{ minHeight: 48, border: 0, borderRadius: 14, background: `linear-gradient(150deg, ${C.honey}, ${C.honeyDeep})`, color: C.white, cursor: loading ? "default" : "pointer", opacity: loading ? .65 : 1, fontFamily: "inherit", fontSize: 13.5, fontWeight: 700 }}>{loading ? '正在回到这里…' : '确认回到这里'}</button>
                </div>
              </>
            )}
          </>
        )}
      </section>
    </>
  );
}

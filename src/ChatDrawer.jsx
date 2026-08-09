import { Stars } from './ChatDecorations.jsx';

export function ChatDrawer({
  open,
  theme: C,
  onClose,
  createSession,
  sessions,
  sessionId,
  switchSession,
  renameSession,
  deleteSession,
}) {
  return (
    <>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, zIndex: 20, background: "rgba(46,31,18,.2)", opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none", transition: "opacity .25s", willChange: "opacity" }} />
      <aside aria-hidden={!open} style={{ position: "absolute", left: 0, top: 0, bottom: 0, zIndex: 25, width: 252, background: C.white, borderRight: `1px solid ${C.border}`, display: "flex", flexDirection: "column", transform: open ? "translate3d(0,0,0)" : "translate3d(-100%,0,0)", transition: "transform .28s cubic-bezier(.4,0,.2,1)", willChange: "transform", boxShadow: open ? "8px 0 32px rgba(100,70,30,.1)" : "none" }}>
        <div className="ourhome-safe-top" style={{ paddingLeft: 20, paddingRight: 20, paddingBottom: 14, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: ".04em" }}>聊天栖息地</span>
          <button type="button" onClick={onClose} aria-label="关闭对话列表" style={{ fontSize: 15, color: C.muted, cursor: "pointer", padding: 4, border: 0, background: "transparent", fontFamily: "inherit" }}>✕</button>
        </div>
        <button type="button" onClick={createSession} style={{ margin: "4px 14px 12px", padding: "10px 0", textAlign: "center", border: `1.5px dashed ${C.honeyMid}`, color: C.honeyDeep, borderRadius: 12, fontSize: 13, cursor: "pointer", background: "transparent", letterSpacing: ".1em", fontFamily: "inherit" }}>✦ 新对话</button>
        <Stars theme={C} />
        <div style={{ padding: "6px 0", flex: 1, overflowY: "auto" }}>
          {sessions.map(session => (
            <div key={session.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 14px 10px 20px", background: session.id === sessionId ? C.honeyLight : "transparent", borderRadius: "0 12px 12px 0", margin: "1px 8px 1px 0", transition: "background .15s" }}>
              <button type="button" onClick={() => switchSession(session.id)} style={{ flex: 1, minWidth: 0, padding: 0, border: 0, background: "transparent", textAlign: "left", fontSize: 14, cursor: "pointer", color: session.id === sessionId ? C.honeyDeep : C.text, fontWeight: session.id === sessionId ? 600 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "inherit" }}>{session.name}</button>
              <button type="button" onClick={() => renameSession(session.id, session.name)} aria-label={`重命名${session.name}`} style={{ padding: 2, border: 0, background: "transparent", fontSize: 11, color: C.muted, cursor: "pointer", flexShrink: 0, fontFamily: "inherit" }}>改</button>
              <button type="button" onClick={() => deleteSession(session.id)} aria-label={`删除${session.name}`} style={{ padding: 2, border: 0, background: "transparent", fontSize: 11, color: C.muted, cursor: "pointer", flexShrink: 0, fontFamily: "inherit" }}>删</button>
            </div>
          ))}
        </div>
        <div className="ourhome-safe-bottom" style={{ paddingTop: 14, paddingLeft: 20, paddingRight: 20, borderTop: `1px solid ${C.border}`, fontSize: 10, color: C.muted, letterSpacing: ".15em" }}>
          <span>since 2025.03.07</span>
        </div>
      </aside>
    </>
  );
}

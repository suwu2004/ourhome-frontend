import { SettingsGroup } from './SettingsGroup.jsx';

export function MemoryRoom({
  theme: C,
  visible,
  leaveRoom,
  resetKey,
  systemPromptInput,
  setSystemPromptInput,
  temperatureInput,
  setTemperatureInput,
  minReplyCharsInput,
  setMinReplyCharsInput,
  savePersona,
  savingPersona,
  newMemory,
  setNewMemory,
  saveMemory,
  savingMemory,
  memoriesLoading,
  memories,
  editingMemoryId,
  editingMemoryText,
  setEditingMemoryText,
  startEditMemory,
  cancelEditMemory,
  saveEditMemory,
  deleteMemory,
}) {
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", opacity: visible ? 1 : 0, pointerEvents: visible ? "auto" : "none", transition: "opacity .4s ease", background: C.cream }}>
      <header className="ourhome-safe-top" style={{ background: C.white, borderBottom: `1px solid ${C.border}`, paddingLeft: 16, paddingRight: 16, paddingBottom: 12, flexShrink: 0, display: "flex", alignItems: "center", gap: 10 }}>
        <span onClick={leaveRoom} style={{ fontSize: 18, color: C.honeyDeep, cursor: "pointer", padding: 4 }}>←</span>
        <span style={{ fontSize: 16, fontWeight: 700, color: C.text, letterSpacing: ".04em" }}>✦ 记忆</span>
      </header>
      <div className="ourhome-scroll" style={{ flex: 1, overflowY: "auto", padding: "16px 14px" }}>
        <SettingsGroup theme={C} title="人设" subtitle="陆泽的核心设定与回复随机性" resetKey={resetKey}>
          <textarea value={systemPromptInput} onChange={e => setSystemPromptInput(e.target.value)} rows={8} placeholder="陆泽的人设设定…" style={{ width: "100%", fontSize: 12.5, lineHeight: 1.6, color: C.text, background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, padding: "8px 12px", outline: "none", marginBottom: 8, resize: "vertical", fontFamily: "inherit" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 11.5, color: C.muted, flexShrink: 0 }}>随机性 {temperatureInput}</span>
            <input type="range" min="0" max="1" step="0.1" value={temperatureInput} onChange={e => setTemperatureInput(e.target.value)} style={{ flex: 1 }} />
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 5 }}>
              <span style={{ fontSize: 11.5, color: C.muted }}>最低回复长度</span>
              <label style={{ display: "flex", alignItems: "center", gap: 4, color: C.mutedLight, fontSize: 10.5 }}>
                <input
                  type="number"
                  min="0"
                  max="600"
                  step="10"
                  value={minReplyCharsInput}
                  onChange={e => setMinReplyCharsInput(Math.min(600, Math.max(0, Number(e.target.value) || 0)))}
                  style={{ width: 62, border: `1px solid ${C.border}`, borderRadius: 8, background: C.surface, color: C.text, padding: "4px 6px", fontFamily: "inherit", textAlign: "right" }}
                />
                字
              </label>
            </div>
            <input aria-label="陆泽最低回复长度" type="range" min="0" max="600" step="10" value={minReplyCharsInput} onChange={e => setMinReplyCharsInput(Number(e.target.value))} style={{ width: "100%" }} />
            <div style={{ fontSize: 10.5, lineHeight: 1.55, color: C.mutedLight }}>陆泽仍会自己判断该说多长；不足下限时只把当前内容说完整，不会另起无关话题。设为 0 就只按语境决定。</div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <span onClick={savePersona} style={{ fontSize: 12, color: C.white, cursor: "pointer", padding: "5px 14px", background: systemPromptInput.trim() ? `linear-gradient(150deg, ${C.honey}, ${C.honeyDeep})` : C.honeyMid, borderRadius: 999 }}>{savingPersona ? "存中…" : "保存人设"}</span>
          </div>
        </SettingsGroup>

        <SettingsGroup theme={C} title="长期记忆" subtitle="稳定偏好、重要约定和长期资料" resetKey={resetKey}>
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            <input value={newMemory} onChange={e => setNewMemory(e.target.value)} onKeyDown={e => { if (e.key === "Enter") saveMemory(); }} placeholder="记下点什么…" style={{ flex: 1, fontSize: 13, color: C.text, background: C.white, border: `1px solid ${C.border}`, borderRadius: 999, padding: "7px 14px", outline: "none" }} />
            <button onClick={saveMemory} disabled={!newMemory.trim() || savingMemory} style={{ fontSize: 12, color: C.white, background: newMemory.trim() ? C.honey : C.honeyMid, border: "none", borderRadius: 999, padding: "0 16px", cursor: newMemory.trim() ? "pointer" : "default", letterSpacing: ".05em" }}>{savingMemory ? "存中…" : "记住"}</button>
          </div>
          {memoriesLoading && (
            <div style={{ textAlign: "center", fontSize: 12, color: C.muted, letterSpacing: ".1em", padding: "20px 0" }}>翻找中…</div>
          )}
          {!memoriesLoading && memories.length === 0 && (
            <div style={{ textAlign: "center", fontSize: 12, color: C.muted, letterSpacing: ".1em", padding: "20px 0" }}>还没有存下来的记忆。</div>
          )}
          {!memoriesLoading && memories.map((m, idx) => (
            <div key={m.id ?? idx} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: idx === memories.length - 1 ? "none" : `1px solid ${C.borderLight}` }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                {m.timestamp && (
                  <div style={{ fontSize: 10, color: C.mutedLight, letterSpacing: ".1em", marginBottom: 4 }}>
                    {new Date(m.timestamp).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </div>
                )}
                {editingMemoryId !== m.id && (
                  <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
                    <span onClick={() => startEditMemory(m)} style={{ fontSize: 11, color: C.honeyDeep, cursor: "pointer" }}>编辑</span>
                    <span onClick={() => deleteMemory(m.id)} style={{ fontSize: 11, color: C.blushDeep, cursor: "pointer" }}>删除</span>
                  </div>
                )}
              </div>
              {editingMemoryId === m.id ? (
                <div>
                  <textarea value={editingMemoryText} onChange={e => setEditingMemoryText(e.target.value)} rows={3} style={{ width: "100%", fontSize: 13.5, lineHeight: 1.6, color: C.text, background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, padding: 8, outline: "none", resize: "vertical", fontFamily: "inherit" }} />
                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 6 }}>
                    <span onClick={cancelEditMemory} style={{ fontSize: 11.5, color: C.muted, cursor: "pointer", padding: "4px 8px" }}>取消</span>
                    <span onClick={saveEditMemory} style={{ fontSize: 11.5, color: C.white, cursor: "pointer", padding: "4px 10px", background: C.honey, borderRadius: 999 }}>保存</span>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: 13.5, lineHeight: 1.7, color: C.text, whiteSpace: "pre-wrap" }}>{m.summary}</div>
              )}
            </div>
          ))}
        </SettingsGroup>
      </div>
    </div>
  );
}

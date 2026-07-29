import { useMemo } from 'react';
import { SettingsGroup } from './SettingsGroup.jsx';

const MEMORY_EVENT_TYPE_OPTIONS = [
  ['note', '记录'],
  ['project', '项目'],
  ['todo', '待办'],
  ['life', '生活'],
  ['emotion', '情绪'],
  ['relationship', '关系'],
  ['memory', '记忆'],
];

function eventDateKey(event) {
  if (event?.event_date) return String(event.event_date).slice(0, 10);
  if (!event?.occurred_at) return '';
  const date = new Date(event.occurred_at);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function formatHistoryDate(event) {
  const raw = eventDateKey(event);
  if (!raw) return '某日';
  const [year, month, day] = raw.split('-');
  return `${Number(year)}年${Number(month)}月${Number(day)}日`;
}

function formatEventClock(event) {
  if (!event?.occurred_at) return '';
  const date = new Date(event.occurred_at);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function normalizedEventText(event) {
  return `${event?.title || ''}${event?.summary || ''}`
    .toLocaleLowerCase('zh-CN')
    .replace(/[，。！？、；：,.!?;:\s"'“”‘’（）()[\]【】]/g, '');
}

function bigrams(text) {
  const normalized = String(text || '');
  const set = new Set();
  for (let index = 0; index < normalized.length - 1; index += 1) {
    set.add(normalized.slice(index, index + 2));
  }
  return set;
}

function eventSimilarity(left, right) {
  const leftText = normalizedEventText(left);
  const rightText = normalizedEventText(right);
  if (!leftText || !rightText) return 0;
  if (leftText.includes(rightText.slice(0, 14)) || rightText.includes(leftText.slice(0, 14))) return 1;
  const leftBigrams = bigrams(leftText);
  const rightBigrams = bigrams(rightText);
  let overlap = 0;
  for (const item of leftBigrams) {
    if (rightBigrams.has(item)) overlap += 1;
  }
  const union = new Set([...leftBigrams, ...rightBigrams]).size || 1;
  return overlap / union;
}

function mergeSimilarEvents(events = []) {
  const groups = [];
  for (const event of events) {
    const dateKey = eventDateKey(event);
    const existing = groups.find(group => {
      if (group.dateKey !== dateKey) return false;
      if ((group.event.title || '') === (event.title || '')) return true;
      return eventSimilarity(group.event, event) >= 0.24;
    });
    if (existing) {
      existing.items.push(event);
    } else {
      groups.push({ dateKey, event, items: [event] });
    }
  }
  return groups;
}

function sentencePunctuation(text) {
  return /[。！？!?]$/.test(String(text || '').trim()) ? '' : '。';
}

function historySentence(event) {
  const title = String(event?.title || '').trim();
  const summary = String(event?.summary || '').trim();
  const titlePart = title ? `${title}${sentencePunctuation(title)}` : '';
  return `${formatHistoryDate(event)}，${titlePart}${summary}${sentencePunctuation(summary)}`;
}

export function MemoryRoom({
  theme: C,
  visible,
  leaveRoom,
  resetKey,
  systemPromptInput,
  setSystemPromptInput,
  temperatureInput,
  setTemperatureInput,
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
  memoryEventDraft,
  setMemoryEventDraft,
  saveManualMemoryEvent,
  savingMemoryEvent,
  memoryEventError,
  memoryLog,
  editingMemoryEventId,
  editingMemoryEventDraft,
  setEditingMemoryEventDraft,
  startEditMemoryEvent,
  cancelEditMemoryEvent,
  saveEditMemoryEvent,
  deleteMemoryEvent,
}) {
  const timelineEvents = useMemo(() => mergeSimilarEvents(memoryLog.events || []), [memoryLog.events]);

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

        <SettingsGroup theme={C} title="大事年表" subtitle="手动添加，或明确让陆泽把重要事情记进年表" resetKey={resetKey}>
          <div style={{ padding: 12, borderRadius: 14, background: C.white, border: `1px solid ${C.borderLight}`, marginBottom: 12 }}>
            <input
              value={memoryEventDraft.title}
              onChange={e => setMemoryEventDraft(draft => ({ ...draft, title: e.target.value }))}
              placeholder="标题，比如：M3 记忆库优化"
              style={{ width: "100%", marginBottom: 8, fontSize: 12.5, color: C.text, background: C.cream, border: `1px solid ${C.border}`, borderRadius: 10, padding: "8px 10px", outline: "none", fontFamily: "inherit" }}
            />
            <textarea
              value={memoryEventDraft.summary}
              onChange={e => setMemoryEventDraft(draft => ({ ...draft, summary: e.target.value }))}
              rows={3}
              placeholder="按“谁在什么地点发生了什么事”的方式补一条…"
              style={{ width: "100%", fontSize: 12.5, lineHeight: 1.6, color: C.text, background: C.cream, border: `1px solid ${C.border}`, borderRadius: 10, padding: "8px 10px", outline: "none", resize: "vertical", fontFamily: "inherit" }}
            />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 8 }}>
              <input
                type="date"
                value={memoryEventDraft.event_date || ''}
                onChange={e => setMemoryEventDraft(draft => ({ ...draft, event_date: e.target.value }))}
                style={{ minWidth: 0, width: 122, flexShrink: 0, fontSize: 12, color: C.text, background: C.white, border: `1px solid ${C.border}`, borderRadius: 999, padding: "7px 10px", outline: "none", fontFamily: "inherit" }}
              />
              <select
                value={memoryEventDraft.event_type}
                onChange={e => setMemoryEventDraft(draft => ({ ...draft, event_type: e.target.value }))}
                style={{ minWidth: 0, flex: 1, fontSize: 12, color: C.text, background: C.white, border: `1px solid ${C.border}`, borderRadius: 999, padding: "7px 10px", outline: "none", fontFamily: "inherit" }}
              >
                {MEMORY_EVENT_TYPE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <button
                type="button"
                onClick={saveManualMemoryEvent}
                disabled={savingMemoryEvent}
                style={{ flexShrink: 0, border: 0, background: memoryEventDraft.title.trim() && memoryEventDraft.summary.trim() ? `linear-gradient(150deg, ${C.honey}, ${C.honeyDeep})` : C.honeyMid, color: C.white, borderRadius: 999, padding: "7px 14px", fontSize: 12, cursor: savingMemoryEvent ? "default" : "pointer", opacity: savingMemoryEvent ? .7 : 1, fontFamily: "inherit" }}
              >{savingMemoryEvent ? "补进年表中…" : "补进年表"}</button>
            </div>
            {memoryEventError && <div role="alert" style={{ marginTop: 8, color: C.blushDeep, fontSize: 11 }}>{memoryEventError}</div>}
          </div>
          {timelineEvents.length === 0 ? (
            <div style={{ color: C.muted, fontSize: 12, lineHeight: 1.7, padding: "12px 0" }}>还没有年表记录。可以在这里手动写，也可以在聊天里告诉陆泽“这件事记进年表”。</div>
          ) : (
            <div style={{ display: "grid", gap: 9 }}>
              {timelineEvents.slice(0, 12).map(group => {
                const event = group.event;
                return (
                  <article key={event.id} style={{ display: "grid", gridTemplateColumns: "74px 1fr", gap: 10, opacity: event.status === 'resolved' ? .55 : 1 }}>
                    <time style={{ color: C.mutedLight, fontSize: 10, lineHeight: 1.35, paddingTop: 2 }}>
                      <span style={{ display: "block" }}>{eventDateKey(event).slice(0, 4)}</span>
                      <span style={{ display: "block" }}>{eventDateKey(event).slice(5).replace('-', '/')}</span>
                      {formatEventClock(event) && <span style={{ display: "block" }}>{formatEventClock(event)}</span>}
                    </time>
                    <div style={{ paddingBottom: 10, borderBottom: `1px solid ${C.borderLight}` }}>
                      {editingMemoryEventId === event.id ? (
                        <div>
                          <input value={editingMemoryEventDraft.title} onChange={e => setEditingMemoryEventDraft(draft => ({ ...draft, title: e.target.value }))} style={{ width: "100%", marginBottom: 7, fontSize: 12.5, color: C.text, background: C.white, border: `1px solid ${C.border}`, borderRadius: 9, padding: "7px 9px", outline: "none", fontFamily: "inherit" }} />
                          <textarea value={editingMemoryEventDraft.summary} onChange={e => setEditingMemoryEventDraft(draft => ({ ...draft, summary: e.target.value }))} rows={3} style={{ width: "100%", fontSize: 12.5, lineHeight: 1.55, color: C.text, background: C.white, border: `1px solid ${C.border}`, borderRadius: 9, padding: "7px 9px", outline: "none", resize: "vertical", fontFamily: "inherit" }} />
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 6 }}>
                            <input type="date" value={editingMemoryEventDraft.event_date || ''} onChange={e => setEditingMemoryEventDraft(draft => ({ ...draft, event_date: e.target.value }))} style={{ width: 116, flexShrink: 0, fontSize: 11.5, color: C.text, background: C.white, border: `1px solid ${C.border}`, borderRadius: 999, padding: "5px 8px", outline: "none", fontFamily: "inherit" }} />
                            <select value={editingMemoryEventDraft.event_type} onChange={e => setEditingMemoryEventDraft(draft => ({ ...draft, event_type: e.target.value }))} style={{ minWidth: 0, flex: 1, fontSize: 11.5, color: C.text, background: C.white, border: `1px solid ${C.border}`, borderRadius: 999, padding: "5px 8px", outline: "none", fontFamily: "inherit" }}>
                              {MEMORY_EVENT_TYPE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                            </select>
                            <span onClick={cancelEditMemoryEvent} style={{ fontSize: 11, color: C.muted, cursor: "pointer" }}>取消</span>
                            <span onClick={saveEditMemoryEvent} style={{ fontSize: 11, color: C.white, cursor: "pointer", padding: "4px 9px", background: C.honey, borderRadius: 999 }}>保存</span>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 3, flexWrap: "wrap" }}>
                            <b style={{ color: C.text, fontSize: 12.5 }}>{event.title}</b>
                            <span style={{ color: C.honeyDeep, background: C.honeyLight, borderRadius: 999, padding: "2px 7px", fontSize: 9 }}>{event.event_type}</span>
                            {group.items.length > 1 && <span style={{ color: C.muted, background: C.surface, borderRadius: 999, padding: "2px 7px", fontSize: 9 }}>合并 {group.items.length} 条</span>}
                          </div>
                          <p style={{ margin: 0, color: C.muted, fontSize: 11.5, lineHeight: 1.65 }}>{historySentence(event)}</p>
                          {event.emotion && <small style={{ display: "block", marginTop: 5, color: C.blushDeep, fontSize: 10 }}>情绪：{event.emotion}</small>}
                          <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
                            <span onClick={() => startEditMemoryEvent(event)} style={{ fontSize: 11, color: C.honeyDeep, cursor: "pointer" }}>编辑</span>
                            <span onClick={() => deleteMemoryEvent(event.id)} style={{ fontSize: 11, color: C.blushDeep, cursor: "pointer" }}>删除</span>
                          </div>
                        </>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </SettingsGroup>
      </div>
    </div>
  );
}

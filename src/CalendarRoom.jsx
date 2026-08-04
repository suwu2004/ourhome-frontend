import { MILESTONE_KINDS, milestoneDisplay } from './milestoneDates.js';

export function CalendarRoom(props) {
  const {
    stage, view, C, leaveRoom, calendarTab, setCalendarTab, calendarMonth,
    changeMonth, monthEntries, dayColors, openDay, setColorPickerDate,
    milestonesLoading, milestones, deleteMilestoneRemote, newMilestoneKind,
    setNewMilestoneKind, newMilestoneName, setNewMilestoneName, newMilestoneDate,
    setNewMilestoneDate, addMilestone, scheduleEvents, deleteScheduleEvent,
    newScheduleTitle, setNewScheduleTitle, newScheduleTime, setNewScheduleTime,
    createScheduleEvent, savingSchedule, notifStatus, enablePushNotifications,
    subscribing, wishes, toggleWish, deleteWish, newWishText, setNewWishText,
    addWish, colorPickerDate, setDayColor, calendarDayOpen, setCalendarDayOpen,
    dayEntriesLoading, dayEntries, editingMoodId, startEditMood, deleteMoodEntry,
    editingMoodText, setEditingMoodText, cancelEditMood, saveEditMood,
    selectedMood, setSelectedMood, newMoodText, setNewMoodText, askAiWriteMood,
    aiMoodWriting, submitMoodEntry,
  } = props;

  return (
    <>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", opacity: (stage === "home" && view === "calendar") ? 1 : 0, pointerEvents: (stage === "home" && view === "calendar") ? "auto" : "none", transition: "opacity .4s ease", background: C.cream }}>
        <header className="ourhome-safe-top" style={{ background: C.white, borderBottom: `1px solid ${C.border}`, paddingLeft: 16, paddingRight: 16, paddingBottom: 0, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, paddingBottom: 10 }}>
            <span onClick={leaveRoom} style={{ fontSize: 18, color: C.honeyDeep, cursor: "pointer", padding: 4 }}>←</span>
            <span style={{ fontSize: 16, fontWeight: 700, color: C.text, letterSpacing: ".04em" }}>心情日历</span>
          </div>
          <div style={{ display: "flex", gap: 0 }}>
            {[
              { key: 'calendar', label: '📅 日历' },
              { key: 'milestones', label: '♡ 重要时刻' },
              { key: 'schedule', label: '⏰ 日程' },
              { key: 'wishes', label: '⭐ 心愿' },
            ].map(tab => (
              <span key={tab.key} onClick={() => setCalendarTab(tab.key)} style={{ flex: 1, textAlign: "center", fontSize: 11.5, padding: "8px 0 10px", cursor: "pointer", color: calendarTab === tab.key ? C.honeyDeep : C.muted, borderBottom: calendarTab === tab.key ? `2px solid ${C.honeyDeep}` : "2px solid transparent", fontWeight: calendarTab === tab.key ? 700 : 400, transition: "all .15s" }}>{tab.label}</span>
            ))}
          </div>
        </header>
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 14px" }}>

          {/* ===== 日历 Tab ===== */}
          {calendarTab === 'calendar' && (<>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 18, marginBottom: 16 }}>
            <span onClick={() => changeMonth(-1)} style={{ fontSize: 16, color: C.honeyDeep, cursor: "pointer", padding: 4 }}>‹</span>
            <span style={{ fontSize: 14.5, fontWeight: 700, color: C.text }}>{calendarMonth.replace('-', '年')}月</span>
            <span onClick={() => changeMonth(1)} style={{ fontSize: 16, color: C.honeyDeep, cursor: "pointer", padding: 4 }}>›</span>
          </div>
          {(() => {
            const [y, m] = calendarMonth.split('-').map(Number);
            const firstDay = new Date(y, m - 1, 1).getDay();
            const daysInMonth = new Date(y, m, 0).getDate();
            const today = new Date();
            const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
            const cells = [];
            for (let i = 0; i < firstDay; i++) cells.push(null);
            for (let d = 1; d <= daysInMonth; d++) cells.push(d);
            return (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
                {['日', '一', '二', '三', '四', '五', '六'].map(w => (
                  <div key={w} style={{ textAlign: "center", fontSize: 11, color: C.muted, paddingBottom: 4 }}>{w}</div>
                ))}
                {cells.map((d, idx) => {
                  if (d === null) return <div key={idx} />;
                  const dateStr = `${calendarMonth}-${String(d).padStart(2, '0')}`;
                  const dayMoods = monthEntries.filter(e => e.date === dateStr);
                  const isToday = dateStr === todayStr;
                  const customColor = dayColors[dateStr];
                  let pressTimer = null;
                  return (
                    <div
                      key={idx}
                      onClick={() => openDay(dateStr)}
                      onContextMenu={e => { e.preventDefault(); setColorPickerDate(dateStr); }}
                      onTouchStart={() => { pressTimer = setTimeout(() => setColorPickerDate(dateStr), 480); }}
                      onTouchEnd={() => clearTimeout(pressTimer)}
                      onTouchMove={() => clearTimeout(pressTimer)}
                      style={{ aspectRatio: "1", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", borderRadius: 10, cursor: "pointer", background: customColor || (isToday ? C.honeyLight : C.white), border: `1px solid ${isToday ? C.honeyDeep : (customColor ? 'transparent' : C.border)}`, gap: 2, position: "relative" }}
                    >
                      <span style={{ fontSize: 13, color: isToday ? C.honeyDeep : C.text, fontWeight: isToday ? 700 : 400 }}>{d}</span>
                      {dayMoods.length > 0 && <span style={{ fontSize: 12 }}>{dayMoods[0].mood || '✦'}</span>}
                    </div>
                  );
                })}
              </div>
            );
          })()}
          <div style={{ textAlign: "center", fontSize: 10, color: C.mutedLight, marginTop: 8, letterSpacing: ".05em" }}>长按（电脑右键）格子可以改颜色</div>
          </>)}

          {/* ===== 重要时刻 Tab：轻手账风格 ===== */}
          {calendarTab === 'milestones' && (
            <section
              className="milestone-journal"
              style={{
                '--milestone-text': C.text,
                '--milestone-muted': C.muted,
                '--milestone-faint': C.mutedLight,
                '--milestone-paper': C.white,
                '--milestone-cream': C.cream,
                '--milestone-line': C.border,
                '--milestone-honey': C.honey,
                '--milestone-honey-deep': C.honeyDeep,
                '--milestone-butter': C.honeyLight,
                '--milestone-blush': C.blush,
              }}
            >
              <header className="milestone-journal-heading">
                <span>OUR LITTLE DATES</span>
                <h2>把喜欢的日子收好</h2>
                <p>纪念日、生日和节日，快到时会去主页便签里轻轻提醒。</p>
              </header>

              {milestonesLoading && <div className="milestone-empty">正在翻找我们的小日子…</div>}
              {!milestonesLoading && milestones.length === 0 && <div className="milestone-empty">这里还空着，先收好第一个日子吧。</div>}

              <div className="milestone-card-list">
                {milestones.map(ms => {
                  const display = milestoneDisplay(ms);
                  if (!display) return null;
                  const kind = MILESTONE_KINDS[display.kind];
                  return (
                    <article className={`milestone-card milestone-card--${display.kind}`} key={ms.id}>
                      <div className="milestone-card-meta">
                        <span>{kind.label}</span>
                        <time dateTime={ms.date}>{ms.date.replace(/-/g, '.')}</time>
                      </div>
                      <h3>{ms.label}</h3>
                      <p className="milestone-card-kicker">{display.kicker}</p>
                      <div className={`milestone-card-count milestone-card-count--${display.state}`}>
                        <strong>{display.value}</strong>
                        {display.unit && <span>{display.unit}</span>}
                      </div>
                      {display.state === 'past' && display.nextDays <= 30 && (
                        <p className="milestone-card-next">下一个纪念节点还有 {display.nextDays} 天</p>
                      )}
                      <button type="button" className="milestone-card-remove" onClick={() => deleteMilestoneRemote(ms.id, ms.label)}>移除</button>
                    </article>
                  );
                })}
              </div>

              <form className="milestone-add-card" onSubmit={event => { event.preventDefault(); addMilestone(); }}>
                <div className="milestone-add-title"><span>ADD A DATE</span><b>再收好一个日子</b></div>
                <div className="milestone-kind-picker" aria-label="重要日子类型">
                  {Object.entries(MILESTONE_KINDS).map(([key, kind]) => (
                    <button type="button" className={newMilestoneKind === key ? 'is-active' : ''} key={key} onClick={() => setNewMilestoneKind(key)}>{kind.label}</button>
                  ))}
                </div>
                <label>
                  <span>写下名称</span>
                  <input value={newMilestoneName} onChange={e => setNewMilestoneName(e.target.value)} placeholder={newMilestoneKind === 'birthday' ? '例如：老婆生日' : newMilestoneKind === 'festival' ? '例如：七夕' : '例如：第一次旅行'} />
                </label>
                <label>
                  <span>是哪一天</span>
                  <input type="date" value={newMilestoneDate} onChange={e => setNewMilestoneDate(e.target.value)} />
                </label>
                <footer>
                  <small>保存过的日子会按年回到十日倒计时里；情人节与 520 已自动照看。</small>
                  <button type="submit" disabled={!newMilestoneName.trim() || !newMilestoneDate}>收好</button>
                </footer>
              </form>
            </section>
          )}

          {/* ===== 日程提醒 Tab ===== */}
          {calendarTab === 'schedule' && (<>
          <div style={{ marginTop: 4 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: C.text, marginBottom: 8 }}>✦ 日程提醒</div>
            {scheduleEvents.length === 0 && (
              <div style={{ fontSize: 11.5, color: C.muted, padding: "8px 0" }}>还没有日程，加一个吧。</div>
            )}
            {scheduleEvents.map(ev => (
              <div key={ev.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: "8px 12px", opacity: ev.notified ? 0.55 : 1 }}>
                <span style={{ fontSize: 14 }}>{ev.notified ? "✓" : "⏰"}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: C.text }}>{ev.title}</div>
                  <div style={{ fontSize: 10.5, color: C.mutedLight }}>{new Date(ev.remind_at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</div>
                </div>
                <span onClick={() => deleteScheduleEvent(ev.id)} style={{ fontSize: 11, color: C.muted, cursor: "pointer" }}>删</span>
              </div>
            ))}
            <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: "10px 12px", marginTop: 6 }}>
              <input value={newScheduleTitle} onChange={e => setNewScheduleTitle(e.target.value)} placeholder="要提醒什么事…" style={{ width: "100%", fontSize: 13, color: C.text, background: "transparent", border: "none", outline: "none", marginBottom: 8, fontFamily: "inherit" }} />
              <input type="datetime-local" value={newScheduleTime} onChange={e => setNewScheduleTime(e.target.value)} style={{ width: "100%", fontSize: 13, color: C.text, background: C.cream, border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 8px", outline: "none", marginBottom: 8, fontFamily: "inherit" }} />
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <span onClick={createScheduleEvent} style={{ fontSize: 12, color: C.white, cursor: "pointer", padding: "5px 14px", background: (newScheduleTitle.trim() && newScheduleTime) ? `linear-gradient(150deg, ${C.honey}, ${C.honeyDeep})` : C.honeyMid, borderRadius: 999 }}>{savingSchedule ? "存中…" : "加提醒"}</span>
              </div>
            </div>
            {notifStatus !== 'granted' && (
              <div onClick={enablePushNotifications} style={{ marginTop: 10, fontSize: 11.5, color: C.honeyDeep, cursor: "pointer", textAlign: "center", padding: "8px 0", border: `1px dashed ${C.honeyMid}`, borderRadius: 10 }}>
                {subscribing ? "开启中…" : "🔔 点这里开启提醒通知"}
              </div>
            )}
          </div>
          </>)}

          {/* ===== 心愿单 Tab ===== */}
          {calendarTab === 'wishes' && (<>
          <div style={{ marginTop: 4 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: C.text, marginBottom: 8 }}>✦ 心愿单</div>
            {wishes.length === 0 && (
              <div style={{ fontSize: 11.5, color: C.muted, padding: "8px 0" }}>还没有心愿，写第一个吧。</div>
            )}
            {wishes.map(w => (
              <div key={w.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: "8px 12px" }}>
                <span onClick={() => toggleWish(w.id, w.done)} style={{ width: 18, height: 18, borderRadius: "50%", border: `1.5px solid ${w.done ? C.honey : C.border}`, background: w.done ? C.honey : "transparent", color: C.white, fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>{w.done ? "✓" : ""}</span>
                <span style={{ flex: 1, fontSize: 13, color: w.done ? C.mutedLight : C.text, textDecoration: w.done ? "line-through" : "none" }}>{w.content}</span>
                <span style={{ fontSize: 10, color: C.mutedLight, flexShrink: 0 }}>{w.author}</span>
                <span onClick={() => deleteWish(w.id)} style={{ fontSize: 11, color: C.muted, cursor: "pointer", flexShrink: 0 }}>删</span>
              </div>
            ))}
            <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
              <input value={newWishText} onChange={e => setNewWishText(e.target.value)} onKeyDown={e => { if (e.key === "Enter") addWish(); }} placeholder="想一起做的事…" style={{ flex: 1, fontSize: 13, color: C.text, background: C.white, border: `1px solid ${C.border}`, borderRadius: 999, padding: "7px 14px", outline: "none" }} />
              <button onClick={addWish} style={{ fontSize: 12, color: C.white, background: newWishText.trim() ? C.honey : C.honeyMid, border: "none", borderRadius: 999, padding: "0 16px", cursor: "pointer" }}>加</button>
            </div>
          </div>
          </>)}

        </div>
      </div>

      {/* ===== 日期颜色选择器 ===== */}
      <div onClick={() => setColorPickerDate(null)} style={{ position: "absolute", inset: 0, zIndex: 58, background: "rgba(46,31,18,.35)", opacity: colorPickerDate ? 1 : 0, pointerEvents: colorPickerDate ? "auto" : "none", transition: "opacity .2s" }} />
      <div style={{ position: "absolute", left: "50%", top: "50%", zIndex: 59, width: "78%", maxWidth: 300, transform: colorPickerDate ? "translate(-50%, -50%) scale(1)" : "translate(-50%, -50%) scale(.96)", opacity: colorPickerDate ? 1 : 0, pointerEvents: colorPickerDate ? "auto" : "none", transition: "all .2s ease", background: C.surface, borderRadius: 16, border: `1px solid ${C.border}`, boxShadow: "0 20px 60px rgba(100,70,30,.25)", padding: "18px 18px 16px" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 12, textAlign: "center" }}>{colorPickerDate} 的颜色</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginBottom: 12 }}>
          {['#FDE8E0', '#D9F0D9', '#D6E8FA', '#FFF3D6', '#F0DCF5', '#FFFFFF'].map(c => (
            <span key={c} onClick={() => setDayColor(colorPickerDate, c)} style={{ width: 32, height: 32, borderRadius: 8, background: c, cursor: "pointer", border: `1.5px solid ${C.border}` }} />
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: 11, color: C.muted }}>自选颜色</span>
          <input type="color" onChange={e => setDayColor(colorPickerDate, e.target.value)} style={{ width: 36, height: 32, borderRadius: 8, border: `1px solid ${C.border}`, cursor: "pointer", padding: 0, background: "none" }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span onClick={() => setDayColor(colorPickerDate, null)} style={{ fontSize: 11.5, color: C.muted, cursor: "pointer", textDecoration: "underline" }}>恢复默认</span>
          <span onClick={() => setColorPickerDate(null)} style={{ fontSize: 11.5, color: C.honeyDeep, cursor: "pointer" }}>完成</span>
        </div>
      </div>

      <div onClick={() => setCalendarDayOpen(null)} style={{ position: "absolute", inset: 0, zIndex: 50, background: "rgba(46,31,18,.35)", opacity: calendarDayOpen ? 1 : 0, pointerEvents: calendarDayOpen ? "auto" : "none", transition: "opacity .25s" }} />
      <div style={{ position: "absolute", left: "50%", top: "50%", zIndex: 55, width: "82%", maxWidth: 360, maxHeight: "70vh", transform: calendarDayOpen ? "translate(-50%, -50%) scale(1)" : "translate(-50%, -50%) scale(.96)", opacity: calendarDayOpen ? 1 : 0, pointerEvents: calendarDayOpen ? "auto" : "none", transition: "all .22s ease", background: C.surface, borderRadius: 18, border: `1px solid ${C.border}`, boxShadow: "0 20px 60px rgba(100,70,30,.25)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "16px 18px 12px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: ".04em", color: C.text }}>{calendarDayOpen}</span>
          <span onClick={() => setCalendarDayOpen(null)} style={{ fontSize: 15, color: C.muted, cursor: "pointer", padding: 4 }}>✕</span>
        </div>
        <div style={{ padding: "10px 18px", borderBottom: `1px solid ${C.borderLight}`, display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <span style={{ fontSize: 10.5, color: C.muted, marginRight: 2 }}>格子颜色</span>
          {['#FDE8E0', '#D5EBD5', '#D6E6F5', '#F5DFA0', '#E8D5F0', '#FFFFFF'].map(c => (
            <span key={c} onClick={() => setDayColor(calendarDayOpen, c === '#FFFFFF' ? null : c)} style={{ width: 20, height: 20, borderRadius: "50%", background: c, cursor: "pointer", border: dayColors[calendarDayOpen] === c ? `2px solid ${C.honeyDeep}` : `1px solid ${C.border}`, boxShadow: c === '#FFFFFF' ? 'inset 0 0 0 1px #eee' : 'none' }} />
          ))}
          <input type="color" value={dayColors[calendarDayOpen] || '#ffffff'} onChange={e => setDayColor(calendarDayOpen, e.target.value)} style={{ width: 22, height: 22, borderRadius: "50%", border: `1px solid ${C.border}`, cursor: "pointer", padding: 0, background: "none", marginLeft: 2 }} />
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "14px 18px" }}>
          {dayEntriesLoading && (
            <div style={{ textAlign: "center", fontSize: 12, color: C.muted, padding: "16px 0" }}>翻找中…</div>
          )}
          {!dayEntriesLoading && dayEntries.length === 0 && (
            <div style={{ textAlign: "center", fontSize: 12, color: C.muted, padding: "16px 0" }}>这天还没有留言。</div>
          )}
          {!dayEntriesLoading && dayEntries.map(e => (
            <div key={e.id} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: `1px solid ${C.borderLight}` }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 3 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {e.mood && <span style={{ fontSize: 14 }}>{e.mood}</span>}
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: C.honeyDeep }}>{e.author}</span>
                </div>
                {editingMoodId !== e.id && (
                  <div style={{ display: "flex", gap: 8 }}>
                    <span onClick={() => startEditMood(e)} style={{ fontSize: 10.5, color: C.muted, cursor: "pointer" }}>改</span>
                    <span onClick={() => deleteMoodEntry(e.id)} style={{ fontSize: 10.5, color: C.muted, cursor: "pointer" }}>删</span>
                  </div>
                )}
              </div>
              {editingMoodId === e.id ? (
                <div>
                  <textarea value={editingMoodText} onChange={ev => setEditingMoodText(ev.target.value)} rows={2} style={{ width: "100%", fontSize: 13, color: C.text, background: C.cream, border: `1px solid ${C.border}`, borderRadius: 10, padding: 8, outline: "none", resize: "vertical", fontFamily: "inherit" }} />
                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
                    <span onClick={cancelEditMood} style={{ fontSize: 11, color: C.muted, cursor: "pointer", padding: "3px 8px" }}>取消</span>
                    <span onClick={saveEditMood} style={{ fontSize: 11, color: C.white, cursor: "pointer", padding: "3px 10px", background: C.honey, borderRadius: 999 }}>保存</span>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: 13.5, lineHeight: 1.6, color: C.text, whiteSpace: "pre-wrap" }}>{e.content}</div>
              )}
            </div>
          ))}
        </div>
        <div style={{ padding: "10px 18px 16px", borderTop: `1px solid ${C.border}`, flexShrink: 0 }}>
          <div style={{ fontSize: 10.5, color: C.mutedLight, marginBottom: 6 }}>选一个心情，或者自己输入喜欢的表情</div>
          <div style={{ display: "flex", gap: 6, marginBottom: 8, alignItems: "center", flexWrap: "wrap" }}>
            {['😊', '🥰', '😢', '😡', '😴', '😐'].map(em => (
              <span key={em} onClick={() => setSelectedMood(em === selectedMood ? null : em)} style={{ fontSize: 18, cursor: "pointer", padding: "4px 6px", borderRadius: 8, background: selectedMood === em ? C.honeyLight : "transparent", border: selectedMood === em ? `1px solid ${C.honeyMid}` : "1px solid transparent" }}>{em}</span>
            ))}
            <input value={selectedMood && !['😊', '🥰', '😢', '😡', '😴', '😐'].includes(selectedMood) ? selectedMood : ''} onChange={e => setSelectedMood(e.target.value || null)} placeholder="🍀 自己输入" maxLength={4} style={{ width: 82, fontSize: 14, textAlign: "center", color: C.text, background: C.cream, border: `1.5px dashed ${C.honeyMid}`, borderRadius: 8, padding: "5px 6px", outline: "none", fontFamily: "inherit" }} />
          </div>
          <textarea value={newMoodText} onChange={e => setNewMoodText(e.target.value)} placeholder="这天想留点什么…" rows={2} style={{ width: "100%", fontSize: 13.5, color: C.text, background: C.cream, border: `1px solid ${C.border}`, borderRadius: 10, padding: 8, outline: "none", resize: "vertical", fontFamily: "inherit" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
            <span onClick={askAiWriteMood} style={{ fontSize: 11.5, color: C.honeyDeep, cursor: "pointer" }}>{aiMoodWriting ? "陆泽在写…" : "✦ 请陆泽写一句"}</span>
            <span onClick={submitMoodEntry} style={{ fontSize: 12, color: C.white, cursor: "pointer", padding: "5px 14px", background: newMoodText.trim() ? `linear-gradient(150deg, ${C.honey}, ${C.honeyDeep})` : C.honeyMid, borderRadius: 999 }}>记下</span>
          </div>
        </div>
      </div>
    </>
  );
}

